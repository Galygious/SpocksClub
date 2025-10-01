'use strict';

import {
  default as Mustache
} from 'https://cdnjs.cloudflare.com/ajax/libs/mustache.js/4.2.0/mustache.min.js';

import {
  BuffContext,
  BuffModifier
} from './prime/buffs.js';
import {
  RequirementType
} from './prime/common.js';
import {
  requirementData,
  resolveRequirements
} from './prime/requirements.js';
import {
  getResourceMap,
  TimeResourceIds,
  TimeResources
} from './prime/resources.js';
import {
  API_BASE_URL,
  Counter,
  debounce,
  stripHTML,
  AuctionScore
} from './common.js';
import {
  Efficiencies
} from './efficiencies.js';
import {
  Profile,
  loadSettings
} from './profile.js';

/**
 * Comprehensive Operations Requirements Calculator
 * Shows all buildings and research prerequisites up to a target Operations level
 */
export class ComprehensiveOpsCalculator {
  /** @type {number} */
  #targetOpsLevel = 1;

  /** @type {Node} */
  #requirementTree = null;

  /** @type {Efficiencies} */
  #costEfficiencies = null;

  /** @type {AbortController} */
  #abortController = null;

  /** @type {Map<number, Set<number>>} */
  #completedItems = new Map();

  /**
     * Create a new comprehensive Operations calculator
     */
  constructor() {
    this.#abortController = new AbortController();
    this.#completedItems.set(RequirementType.Building, new Set());
    this.#completedItems.set(RequirementType.Research, new Set());
  }

  /**
     * Destroy the calculator and clean up event handlers
     */
  destroy() {
    $('#comprehensive-ops-body').off('updated.spock.efficiencies');
    $('#comprehensive-ops-form').off('submit');
    $('#comprehensive-ops-targetLevel').off('change');

    this.#abortController.abort();
  }

  /**
     * Initialize the calculator with target Operations level
     * @param {number} [targetOpsLevel]
     * @return {Promise<void>}
     */
  async load(targetOpsLevel = 1) {
    this.#targetOpsLevel = Math.max(1, Math.min(70, targetOpsLevel || 1));

    // Load completed progress from profile
    await this.#loadCompletedProgress();

    this.#resetSubmitButton();
    this.#setLevelInputs();

    $('#comprehensive-ops-form').on('submit', async(event) => {
      if (this.#abortController.signal.aborted) {
        $().off(event);
        return;
      }

      event.preventDefault();

      const targetLevel = Number($('#comprehensive-ops-targetLevel').val());

      if (targetLevel >= 1 && targetLevel <= 70) {
        this.#targetOpsLevel = targetLevel;
        $('#comprehensive-ops-level-display').text(targetLevel);
        $('#comprehensive-ops-pro-tip-level').text(targetLevel);
        await this.renderBody();
      }
    });

    $('#comprehensive-ops-targetLevel').on('change', (event) => {
      if (this.#abortController.signal.aborted) {
        $().off(event);
        return;
      }
      this.#resetSubmitButton();
    });

    $('#comprehensive-show-completed').on('change', async(event) => {
      if (this.#abortController.signal.aborted) {
        $().off(event);
        return;
      }
      // Re-render the tree with the new filter setting
      const showCompleted = $(event.target).is(':checked');
      await this.#renderTree(this.#requirementTree, showCompleted);
      // Update cost calculations to reflect the filter
      await this.#updateCost();
    });

    // Load initial data
    await this.renderBody();
  }

  /**
     * Load completed progress from SpocksClub profile
     * @return {Promise<void>}
     */
  async #loadCompletedProgress() {
    try {
      const profile = new Profile();
      if (profile.isLoggedIn()) {
        // Load all building and research progress
        const settings = await profile.loadSettings(
          // Operations level
          { type: 'building', qualifier: null, id: 0 },
          // All buildings
          { type: 'building', qualifier: null, id: -1 }, // Special ID for all buildings
          // All research
          { type: 'research', qualifier: null, id: -1 }  // Special ID for all research
        );

        // Store completed items
        if (settings.building) {
          for (const setting of settings.building) {
            if (setting.level && setting.level > 0) {
              this.#completedItems.get(RequirementType.Building).add(setting.id);
            }
          }
        }

        if (settings.research) {
          for (const setting of settings.research) {
            if (setting.level && setting.level > 0) {
              this.#completedItems.get(RequirementType.Research).add(setting.id);
            }
          }
        }

        console.log(`Loaded progress: ${this.#completedItems.get(RequirementType.Building).size} buildings, ${this.#completedItems.get(RequirementType.Research).size} research items`);
      }
    } catch (error) {
      console.warn('Failed to load progress from profile:', error);
    }
  }

  /**
     * Check if an item is completed
     * @param {number} requirementType
     * @param {number} requirementId
     * @param {number} requirementLevel
     * @return {boolean}
     */
  #isCompleted(requirementType, requirementId, requirementLevel) {
    if (requirementType === RequirementType.Building && requirementId === 0) {
      // Special case for Operations
      return this.#targetOpsLevel <= requirementLevel;
    }

    const completedLevels = this.#completedItems.get(requirementType);
    return completedLevels ? completedLevels.has(requirementId) : false;
  }

  /**
     * Get all prerequisites for Operations level X
     * @param {number} opsLevel
     * @return {Promise<Array<{requirement_type: number, requirement_id: number, requirement_level: number}>>}
     */
  async #getAllOpsPrerequisites(opsLevel) {
    const prerequisites = new Set();

    // Start with Operations level X as the target
    const target = {
      requirement_type: RequirementType.Building,
      requirement_id: 0,
      requirement_level: opsLevel
    };

    // Use the existing resolveRequirements function to get the full tree
    const tree = await resolveRequirements([], target);

    // Walk the tree to collect all prerequisites
    const collectPrerequisites = (node) => {
      if (!node) {
        return;
      }

      // Add this node if it's not Operations itself
      if (!(node.model.requirement_type === RequirementType.Building && node.model.requirement_id === 0)) {
        prerequisites.add(`${node.model.requirement_type}-${node.model.requirement_id}-${node.model.requirement_level}`);
      }

      // Recursively collect children
      for (const child of node.children) {
        collectPrerequisites(child);
      }
    };

    collectPrerequisites(tree);

    // Convert back to requirement objects
    return Array.from(prerequisites).map(key => {
      const [type, id, level] = key.split('-').map(Number);
      return { requirement_type: type, requirement_id: id, requirement_level: level };
    });
  }

  /**
     * Build comprehensive requirement tree for Operations level
     * @return {Promise<Node>}
     */
  async #buildComprehensiveTree() {
    const allPrerequisites = await this.#getAllOpsPrerequisites(this.#targetOpsLevel);

    // Group by type and ID to find maximum required levels
    const maxLevels = new Map();

    for (const req of allPrerequisites) {
      const key = `${req.requirement_type}-${req.requirement_id}`;
      const current = maxLevels.get(key);
      if (!current || req.requirement_level > current.level) {
        maxLevels.set(key, req);
      }
    }

    // Create requirements for maximum levels of each prerequisite
    const requirements = Array.from(maxLevels.values());

    // Add the target Operations level itself
    requirements.push({
      requirement_type: RequirementType.Building,
      requirement_id: 0,
      requirement_level: this.#targetOpsLevel
    });

    console.log(`Building comprehensive tree with ${requirements.length} requirements for Operations level ${this.#targetOpsLevel}`);

    // Build the tree
    this.#requirementTree = await resolveRequirements(requirements, {
      requirement_type: RequirementType.Building,
      requirement_id: 0,
      requirement_level: 1 // Start from Operations level 1 as baseline
    });

    return this.#requirementTree;
  }


  /**
     * Render the comprehensive requirements body
     * @return {Promise<void>}
     */
  async renderBody() {
    try {
      await this.#buildComprehensiveTree();

      const showCompleted = $('#comprehensive-show-completed').is(':checked');
      await this.#renderTree(this.#requirementTree, showCompleted);

      const cost = this.#calculateBaseCost();
      await this.#renderTables(cost);

      this.#showProTipIfNeeded();
      await this.#applySettings();
      await this.#updateCost();

      $('#comprehensive-ops-body').on('updated.spock.efficiencies', () => {
        if (this.#abortController.signal.aborted) {
          return;
        }
        this.#updateCost();
      }).trigger('rendered.spock');

    } catch (error) {
      console.error(`Error rendering comprehensive requirements: ${error.message}\n${error.stack}`);
    }
  }

  /**
     * Render the requirement tree using BSTreeView
     * @param {Node} tree
     * @param {boolean} showCompleted
     * @return {Promise<void>}
     */
  async #renderTree(tree, showCompleted = true) {
    const treeNodes = [];

    const buildView = (node, parent = undefined) => {
      if (!node) {
        return;
      }

      // Skip non-building/research requirements (like faction ranks, etc.)
      if (node.model.requirement_type !== RequirementType.Building &&
                node.model.requirement_type !== RequirementType.Research) {
        return;
      }

      const isCompleted = this.#isCompleted(
        node.model.requirement_type,
        node.model.requirement_id,
        node.model.requirement_level
      );

      // Skip this node if it's completed and we're not showing completed items
      if (isCompleted && !showCompleted) {
        return;
      }

      const obj = {
        text: `Level ${node.model.requirement_level}, ${node.model.name || 'Unknown'}${isCompleted ? ' ✓' : ''}`,
        icon: 'fa-regular ' + (node.model.requirement_type === RequirementType.Building ? 'fa-building' : 'fa-flask'),
        selectable: false,
        state: {
          checked: false
        },
        payload: {
          id: node.model.requirement_id,
          level: node.model.requirement_level,
          name: node.model.name || 'Unknown',
          type: node.model.requirement_type === RequirementType.Building ? 'building' : 'research',
          requirement_type: node.model.requirement_type,
          isCompleted: isCompleted,
          ...this.#getUpgradeCost(node.model)
        }
      };

      if (parent === undefined) {
        treeNodes.push(obj);
      } else {
        if (!Object.hasOwn(parent, 'nodes')) {
          parent.nodes = [];
        }
        parent.nodes.push(obj);
      }

      for (let i = 0, childCount = node.children.length; i < childCount; i++) {
        buildView(node.children[i], obj);
      }
    };

    buildView(tree);

    $('#comprehensive-ops-tree').treeview({
      data: treeNodes,
      expandIcon: 'fa-solid fa-caret-right',
      collapseIcon: 'fa-solid fa-caret-down',
      indent: 1.25,
      parentsMarginLeft: '1.25rem',
      openNodeLinkOnNewTab: true,
      searchResultBackColor: '#4c9be8',
      searchResultColor: '#fff',
      showCheckbox: false, // Read-only view
      uncheckedIcon: 'fa-regular fa-square',
      checkedIcon: 'fa-regular fa-check-square',

      onNodeInspected: function(event, node) {
        ComprehensiveOpsCalculator.renderIndividual(node.payload);
      }
    });

    // Expand all by default for comprehensive view
    $('#comprehensive-ops-tree').treeview('expandAll');

    // Setup expand/collapse controls
    $('#comprehensive-expand-all').on('click', (event) => {
      if (this.#abortController.signal.aborted) {
        return;
      }
      $('#comprehensive-ops-tree').treeview('expandAll');
    });

    $('#comprehensive-collapse-all').on('click', (event) => {
      if (this.#abortController.signal.aborted) {
        return;
      }
      $('#comprehensive-ops-tree').treeview('collapseAll');
    });
  }

  /**
     * Render efficiency tables
     * @param {{base_cost: Counter, base_time: Counter}} cost
     * @return {Promise<void>}
     */
  async #renderTables(cost) {
    const context = [];
    const reqTypes = new Set();

    this.#requirementTree.walk({
      strategy: 'breadth'
    }, node => {
      reqTypes.add(node.model.requirement_type);
    });

    for (const type of reqTypes) {
      switch (type) {
      case RequirementType.Building:
        context.push(
          new BuffContext(BuffModifier.ModStarbaseModuleConstructionCost, [], cost[RequirementType.Building].base_cost.keys()),
          new BuffContext(BuffModifier.ModStarbaseModuleConstructionSpeed, [], cost[RequirementType.Building].base_time.keys())
        );
        break;
      case RequirementType.Research:
        context.push(
          new BuffContext(BuffModifier.ModResearchCost, [], cost[RequirementType.Research].base_cost.keys()),
          new BuffContext(BuffModifier.ModResearchSpeed, [], cost[RequirementType.Research].base_time.keys())
        );
        break;
      }
    }

    this.#costEfficiencies = Efficiencies.forRequirements(reqTypes);
    await this.#costEfficiencies.load();

    await this.#costEfficiencies.displayCostAndBonuses(
      cost,
      ...context
    );
  }

  /**
     * Get upgrade cost for a requirement
     * @param {Object} requirement
     * @returns {Object}
     */
  #getUpgradeCost(requirement) {
    const costData = requirementData[requirement.requirement_type]?.find(({
      id
    }) => id === requirement.requirement_id);
    if (!costData) {
      return {};
    }

    const levelCost = costData.levels.find(({
      id
    }) => id === requirement.requirement_level);
    if (!levelCost) {
      return {};
    }

    let upgrade_cost, upgrade_time, time_resource;

    switch (requirement.requirement_type) {
    case RequirementType.Building:
      upgrade_cost = new Counter(levelCost.costs?.map(({
        resource_id,
        amount
      }) => [Number(resource_id), Number(amount)]) ?? []);
      upgrade_time = levelCost.build_time_in_seconds;
      time_resource = TimeResources.building[levelCost.generation].id;
      break;
    case RequirementType.Research:
      upgrade_cost = new Counter([...Object.entries(levelCost.resource_cost)].map(([resource_id, amount]) => [Number(resource_id), Number(amount)]));
      upgrade_time = levelCost.research_time_in_seconds;
      time_resource = TimeResources.research[costData.generation].id;
      break;
    }

    return {
      base_cost: upgrade_cost,
      base_time: new Counter([[time_resource, upgrade_time]])
    };
  }

  /**
     * Calculate base costs for all unchecked nodes
     * @returns {{base_cost: Counter, base_time: Counter}}
     */
  #calculateBaseCost() {
    const costData = {};

    // For comprehensive view, include all visible (non-filtered) items
    const tree = $('#comprehensive-ops-tree');
    const allNodes = tree.treeview ? tree.treeview('getNodes') : [];

    for (const node of allNodes) {
      const payload = node.payload;

      if (!costData.hasOwnProperty(payload.requirement_type)) {
        costData[payload.requirement_type] = {
          base_cost: new Counter(),
          base_time: new Counter()
        };
      }

      costData[payload.requirement_type].base_cost.iextend(payload.base_cost);
      costData[payload.requirement_type].base_time.iextend(payload.base_time);
    }

    const total_cost = new Counter();
    const total_time = new Counter();

    for (const cost of Object.values(costData)) {
      total_cost.iextend(cost.base_cost);
      total_time.iextend(cost.base_time);
    }

    return {
      base_cost: total_cost,
      base_time: total_time,
      ...costData
    };
  }

  /**
     * Load and apply settings
     * @return {Promise<void>}
     */
  async #applySettings() {
    // Similar to original requirements calculator
    const additionalSettings = [];
    const reqTypes = {
      [RequirementType.Building]: 'building',
      [RequirementType.Research]: 'research'
    };

    this.#requirementTree.walk({
      strategy: 'breadth'
    }, node => {
      additionalSettings.push({
        type: reqTypes[node.model.requirement_type],
        qualifier: null,
        id: node.model.requirement_id
      });
    });

    let settings = {};
    try {
      settings = await loadSettings(additionalSettings);
    } catch (error) {
      console.error(`Error loading settings: ${error.message}\n${error.stack}`);
    }
  }

  /**
     * Update cost calculations
     * @return {Promise<void>}
     */
  async #updateCost() {
    const cost = this.#calculateCost();
    await this.#costEfficiencies.updateCostAndBonuses(cost);
    $('#comprehensive-ops-cost-col').trigger('rendered.spock');
  }

  /**
     * Calculate net costs with efficiencies applied
     * @returns {Object}
     */
  #calculateCost() {
    const costData = {};

    const tree = $('#comprehensive-ops-tree');
    const allNodes = tree.treeview ? tree.treeview('getNodes') : [];

    for (const node of allNodes) {
      const payload = node.payload;

      if (!costData.hasOwnProperty(payload.requirement_type)) {
        costData[payload.requirement_type] = {
          base_cost: new Counter(),
          net_cost: new Counter(),
          base_time: new Counter(),
          net_time: new Counter()
        };
      }

      costData[payload.requirement_type].base_cost.iextend(payload.base_cost);
      costData[payload.requirement_type].base_time.iextend(payload.base_time);

      const cost = this.#costEfficiencies.apply(payload.base_cost, new BuffContext(
        payload.type === 'building' ? BuffModifier.ModStarbaseModuleConstructionCost : BuffModifier.ModResearchCost,
        [],
        payload.base_cost.keys()
      ));
      payload.net_cost = cost;

      const time = this.#costEfficiencies.apply(payload.base_time, new BuffContext(
        payload.type === 'building' ? BuffModifier.ModStarbaseModuleConstructionSpeed : BuffModifier.ModResearchSpeed,
        [],
        payload.base_time.keys()
      ));
      payload.net_time = time;

      costData[payload.requirement_type].net_cost.iextend(cost);
      costData[payload.requirement_type].net_time.iextend(time);
    }

    const base_cost = new Counter();
    const net_cost = new Counter();
    const base_time = new Counter();
    const net_time = new Counter();

    for (const cost of Object.values(costData)) {
      base_cost.iextend(cost.base_cost);
      net_cost.iextend(cost.net_cost);
      base_time.iextend(cost.base_time);
      net_time.iextend(cost.net_time);
    }

    return {
      base_cost: base_cost,
      base_time: base_time,
      net_cost: net_cost,
      net_time: net_time,
      ...costData
    };
  }

  /**
     * Reset submit button
     */
  #resetSubmitButton() {
    const submitBtn = $('#comprehensive-ops-submit');
    const submitIco = submitBtn.children('i');
    submitBtn.removeClass('btn-success btn-danger').addClass('btn-primary').prop('disabled', false);
    submitIco.removeClass('fa-loader fa-check fa-xmark').addClass('fa-play');
  }

  /**
     * Set up level input controls
     */
  #setLevelInputs() {
    const targetLevelInput = $('#comprehensive-ops-targetLevel');
    targetLevelInput.val(this.#targetOpsLevel);
    targetLevelInput.attr('min', 1);
    targetLevelInput.attr('max', 70);
  }

  /**
     * Show pro tip if needed
     */
  #showProTipIfNeeded() {
    const KEY = 'uix_tip_comprehensive_ops_dismissed';
    const dismissed = localStorage.getItem(KEY) === '1';
    const el = document.getElementById('comprehensive-ops-pro-tip');
    if (!el) {
      return;
    }
    if (!dismissed) {
      el.classList.remove('d-none');
    }

    el.querySelector('[data-dismiss-comprehensive-tip]')?.addEventListener('click', () => {
      localStorage.setItem(KEY, '1');
      el.classList.add('d-none');
    }, { once: true });
  }

  /**
     * Static method to render individual requirement details
     * @param {Object} payload
     */
  static renderIndividual(payload) {
    const individualTemplate = document.querySelector('#mustache-individual-breakdown').innerHTML;
    const {
      base_cost,
      base_time,
      level,
      name,
      net_cost,
      net_time,
      isCompleted
    } = payload;

    const resourceMap = getResourceMap();

    const html = Mustache.render(individualTemplate, {
      level: level,
      name: name,
      isCompleted: isCompleted,
      completedBadge: isCompleted ? '<span class="badge bg-success ms-2">Completed</span>' : '',
      resources: Array.from(base_cost)
        .sort(([a], [b]) => resourceMap.get(a).sorting_key.localeCompare(resourceMap.get(b).sorting_key))
        .map(([resource_id, amount]) => {
          const available = Number($(`.upgrade-cost-on-hand[data-setting-id="${resource_id}"]`).attr('data-amount'));
          const net = net_cost.get(resource_id);

          return {
            id: resource_id,
            auctionScore: AuctionScore[resource_id] ?? 0,
            cost: {
              base: amount,
              net: net
            },
            on_hand: available,
            needed: Math.max(0, net - available)
          };
        }),
      times: Array.from(base_time)
        .sort(([a], [b]) => TimeResourceIds[a].sorting_index - TimeResourceIds[b].sorting_index)
        .map(([resource_id, seconds]) => ({
          id: resource_id,
          seconds: {
            base: seconds,
            net: net_time.get(resource_id)
          }
        })),
      auctionScore: Array.from(net_cost).reduce((acc, curr) => acc + (curr[1] * (AuctionScore.get(curr[0]) ?? 0)), 0)
    });

    $('#individual-modal-holder').html(html).trigger('rendered.spock');
    new bootstrap.Modal('#breakdown-modal').show();
  }
}

// Initialize the comprehensive calculator when the page loads
let comprehensiveOpsCalculator;

$(async() => {
  comprehensiveOpsCalculator = new ComprehensiveOpsCalculator();

  // Initialize with default values
  await comprehensiveOpsCalculator.load(1);

  // Handle tab switching to initialize calculator when tab becomes active
  $('#calculator-tabs').on('shown.bs.tab', async(event) => {
    const targetTab = $(event.target).attr('id');
    if (targetTab === 'tab-comprehensive') {
      // Re-initialize or refresh the comprehensive calculator
      const targetLevel = Number($('#comprehensive-ops-targetLevel').val()) || 1;
      await comprehensiveOpsCalculator.load(targetLevel);
    }
  });
});
