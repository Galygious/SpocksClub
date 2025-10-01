"use strict";

import {
    default as Mustache
} from 'https://cdnjs.cloudflare.com/ajax/libs/mustache.js/4.2.0/mustache.min.js';

import {
    BuffContext,
    BuffModifier
} from "./prime/buffs.js";
import {
    AuctionScore,
    RequirementType
} from './prime/common.js';
import {
    requirementData,
    resolveRequirements
} from "./prime/requirements.js";
import {
    getResourceMap,
    TimeResourceIds,
    TimeResources
} from './prime/resources.js';
import {
    API_BASE_URL,
    Counter,
    debounce,
    stripHTML
} from './common.js';
import {
    Efficiencies
} from './efficiencies.js';
import {
    Profile,
    loadSettings
} from "./profile.js";
import {
    InventoryAlertModal
} from './inventory.js';


/**
 * @typedef BsNode
 * @type {Object}
 * @property {number}       nodeId
 * @property {BsNode[]}     nodes
 * @property {object}       state
 * @property {boolean}      state.checked
 * @property {boolean}      state.expanded
 * @property {boolean}      state.disabledf
 * @property {boolean}      state.selected
 * @property {boolean}      state.checked
 * @property {boolean}      hidden
 * @property {string}       icon
 * @property {string}       text
 * @property {object}       payload
 * @property {string}       payload.type
 * @property {number}       payload.requirement_type
 * @property {number}       payload.id
 * @property {number}       payload.level
 * @property {string}       payload.name
 * @property {Counter}      payload.base_cost
 * @property {Counter}      payload.net_cost
 * @property {Counter}      payload.base_time
 * @property {Counter}      payload.net_time
 */

class RequirementsCalculator {
    static supportedTypes = {
        building: {
            icon: 'fa-building',
            modifiers: {
                cost: BuffModifier.ModStarbaseModuleConstructionCost,
                time: BuffModifier.ModStarbaseModuleConstructionSpeed
            },
            type: RequirementType.Building
        },
        research: {
            icon: 'fa-flask',
            modifiers: {
                cost: BuffModifier.ModResearchCost,
                time: BuffModifier.ModResearchSpeed
            },
            type: RequirementType.Research
        }
    };

    /** @type {number} */
    maxLevel;

    /** @type {number} */
    unlockLevel;

    /** @type {Node} */
    requirementTree;

    /** @type {Efficiencies} */
    #costEfficiencies;

    /** @type {AbortController} */
    #abortController;

    /**
     * Create a new RequirementsCalculator instance
     *
     * @param {string} type Entity type (building, research)
     * @param {number} id   Building/Research ID
     */
    constructor(type, id) {
        this.type = type;
        this.reqType = this.constructor.supportedTypes[this.type].type;
        this.id = id;
        this.#abortController = new AbortController();
    }

    /**
     * Remove event handlers from input elements before
     * a new RequirementsCalculator instance is created
     */
    destroy() {
        $('#requirements-body').off('updated.spock.efficiencies');
        $('#requirements-calc-form').off('submit');
        $('#requirements-startLevel, #requirements-targetLevel').off('change');

        this.#abortController.abort();
    }

    /**
     * Load entity data and initialize form inputs
     *
     * @param {number} [startLevel]
     * @param {number} [targetLevel]
     * @return {Promise<void>}
     */
    async load(startLevel = undefined, targetLevel = undefined) {
        const data = await $.getJSON(`${API_BASE_URL}/${this.type}/${this.id}`);
        this.maxLevel = Math.max(...data.levels.map(({
            id
        }) => Number(id)));
        this.unlockLevel = Math.max(Number(data.unlock_level ?? 1), 1);

        this.#resetSubmitButton();
        this.#setLevelInputs(startLevel, targetLevel);

        $('.calculator-step-input').removeClass('invisible');

        $('#requirements-calc-form').on('submit', event => {
            if (this.#abortController.signal.aborted) {
                $().off(event);
                return;
            }

            const form = event.target;
            $(form).find('input').removeClass('is-invalid');

            const startLevel = Number($('#requirements-startLevel').val());
            const targetLevel = Number($('#requirements-targetLevel').val());

            const button = $('#requirements-calc-submit');
            const icon = button.children('i');

            if (targetLevel > startLevel && targetLevel <= this.maxLevel) {
                icon.removeClass('fa-play fa-check fa-xmark').addClass('fa-loader');

                const params = new URLSearchParams({
                    type: this.type,
                    id: this.id,
                    startLevel: startLevel,
                    targetLevel: targetLevel
                });
                window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);

                this.renderBody(startLevel, targetLevel)
                    .then(() => {
                        button.removeClass('btn-primary btn-danger').addClass('btn-success').prop('disabled', true);
                        icon.removeClass('fa-play fa-loader fa-xmark').addClass('fa-check');
                        $('.calculator-step-submit').removeClass('d-none');
                    })
                    .catch((error) => {
                        console.error(`Error while loading requirements for levels L${startLevel} -> L${targetLevel}: ${error.message}\n${error.stack}`);
                        button.removeClass('btn-primary btn-success').addClass('btn-danger').prop('disabled', true);
                        icon.removeClass('fa-play fa-loader fa-check').addClass('fa-xmark');
                    });
            } else {
                button.removeClass('btn-primary btn-success').addClass('btn-danger').prop('disabled', true);
                icon.removeClass('fa-play fa-loader fa-check').addClass('fa-xmark');
            }

        });

        $('#requirements-startLevel, #requirements-targetLevel').on('invalid', event => {
            if (this.#abortController.signal.aborted) {
                $().off(event);
                return;
            }

            const input = $(event.target);
            input.addClass('is-invalid');
        });

        $(document).on('click', function(e) {
            if (!$(e.target).closest('.popover').length && !$(e.target).closest('.cost-table-settings-btn').length) {
                $('.cost-table-settings-btn').popover('hide');
            }
        });

        // Handle the collapse show event
        $(document).on('show.bs.collapse', '.collapse', function() {
            const target = $(this).attr('id');
            $(`.toggle-caret[data-bs-target="#${target}"]`).removeClass('fa-caret-right').addClass('fa-caret-down');
        });

        // Handle the collapse hide event
        $(document).on('hide.bs.collapse', '.collapse', function() {
            const target = $(this).attr('id');
            $(`.toggle-caret[data-bs-target="#${target}"]`).removeClass('fa-caret-down').addClass('fa-caret-right');
        });
    }

    showProTipIfNeeded() {
        const KEY = 'uix_tip_needed_click_dismissed';
        const dismissed = localStorage.getItem(KEY) === '1';
        const el = document.getElementById('upgrade-pro-tip');
        if (!el) return;
        if (!dismissed) el.classList.remove('d-none');

        // close button
        el.querySelector('[data-dismiss-pro-tip]')?.addEventListener('click', () => {
            localStorage.setItem(KEY, '1');
            el.classList.add('d-none');
        }, {
            once: true
        });
    }

    reflectNeededClickability() {
        const profile = new Profile();
        $('#upgrade-cost-table td.upgrade-cost-needed').each(function() {
            const needed = Number($(this).attr('data-amount') || 0);
            $(this).toggleClass('needed-clickable', profile.isLoggedIn() && needed > 0);
        });
    }

    /**
     * Render body of requirements calculator
     *
     * @param {number} startLevel
     * @param {number} targetLevel
     * @return {Promise<void>}
     */
    async renderBody(startLevel, targetLevel) {
        await this.buildTree(startLevel, targetLevel);
        await this.renderTree();

        const cost = this.#calculateBaseCost();
        await this.renderTables(cost);

        // Ensure the modal’s listeners exist (safe to call once)
        InventoryAlertModal.wire();

        this.#showProTipIfNeeded();
        await this.applySettings();
        await this.updateCost();

        $('#requirements-body').on('updated.spock.efficiencies', event => {
            if (this.#abortController.signal.aborted) {
                $().off(event);
                return;
            }

            this.updateCost();
        }).trigger('rendered.spock');

        this.#reflectNeededClickability();
    }

    /**
     *
     * @param {BsNode.payload} payload
     */
    static renderIndividual(payload) {
        const individualTemplate = document.querySelector("#mustache-individual-breakdown").innerHTML;
        const {
            base_cost,
            base_time,
            level,
            name,
            net_cost,
            net_time
        } = payload;
        const resourceMap = getResourceMap();

        const html = Mustache.render(individualTemplate, {
            level: level,
            name: name,
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
                        needed: Math.max(0, net - available),
                    };
                }),
            times: Array.from(base_time)
                .sort(([a], [b]) => TimeResourceIds[a].sorting_index - TimeResourceIds[a].sorting_index)
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

    /**
     * Render requirement tree using BS TreeView
     *
     * @return {Promise<void>}
     */
    async renderTree() {
        let treeNodes = [];
        let supportedTypes = [...Object.values(this.constructor.supportedTypes)].map(({
            type
        }) => type);

        const build_view = (node, parent = undefined) => {
            if (!supportedTypes.includes(node.model.requirement_type)) {
                return;
            }

            let obj = {
                text: `Level ${node.model.requirement_level}, ${node.model.name}<div class="d-inline-flex position-relative"><button class="btn btn-sm detail-icon stretched-link ms-1"><i class="fa-light fa-money-check-dollar-pen"></i></button></div>`,
                icon: 'fa-regular ' + Object.values(this.constructor.supportedTypes).find(({
                    type
                }) => node.model.requirement_type === type).icon,
                selectable: false,
                state: {
                    checked: false,
                },
                payload: {
                    id: node.model.requirement_id,
                    level: node.model.requirement_level,
                    name: node.model.name,
                    type: Object.entries(this.constructor.supportedTypes).find(([, value]) => node.model.requirement_type === value.type)[0],
                    requirement_type: node.model.requirement_type,
                    ...this.#getUpgradeCost(node.model),
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
                build_view(node.children[i], obj);
            }
        };

        build_view(this.requirementTree);

        $('#requirements-tree').treeview({
            data: treeNodes,
            expandIcon: 'fa-solid fa-caret-right',
            collapseIcon: 'fa-solid fa-caret-down',
            indent: 1.25,
            parentsMarginLeft: '1.25rem',
            openNodeLinkOnNewTab: true,
            searchResultBackColor: '#4c9be8',
            searchResultColor: '#fff',
            showCheckbox: true,
            uncheckedIcon: 'fa-regular fa-square',
            checkedIcon: 'fa-regular fa-check-square',

            /**
             *
             * @param {jQuery.Event} event
             * @param {BsNode}       node
             */
            onNodeUnchecked: (event, node) => {
                // uncheck parent nodes
                let tree = $('#requirements-tree');
                let parents = [];
                let queue = [node];

                while (queue.length > 0) {
                    const n = queue.shift();
                    if (n === undefined || n?.parentId === undefined) {
                        continue;
                    }

                    const parent = tree.treeview('getParent', [n]);
                    if (parent === undefined) {
                        continue;
                    }

                    parents.push(parent);
                    queue.push(parent);
                }

                tree.treeview('uncheckNode', [parents, {
                    silent: true
                }]);
                this.updateCost();
            },

            /**
             *
             * @param {jQuery.Event} event
             * @param {BsNode}       node
             */
            onNodeChecked: (event, node) => {
                // check all nodes in subtree
                let children = [];
                let queue = [node];

                while (queue.length > 0) {
                    const n = queue.shift();
                    if (n === undefined || n ? .nodes === undefined) {
                        continue;
                    }

                    children.push(...n.nodes.map(({
                        nodeId
                    }) => nodeId));
                    queue.push(...n.nodes);
                }

                $('#requirements-tree').treeview('checkNode', [children, {
                    silent: true
                }]);
                this.updateCost();
            },

            /**
             *
             * @param {jQuery.Event} event
             * @param {BsNode}       node
             */
            onNodeInspected: function(event, node) {
                RequirementsCalculator.renderIndividual(node.payload);
            }
        });

        $('#requirements-expand-all').on('click', event => {
            if (this.#abortController.signal.aborted) {
                $().off(event);
                return;
            }

            $('#requirements-tree').treeview('expandAll');
        });

        $('#requirements-collapse-all').on('click', event => {
            if (this.#abortController.signal.aborted) {
                $().off(event);
                return;
            }

            $('#requirements-tree').treeview('collapseAll');
        });

        $('#requirements-check-all').on('click', event => {
            if (this.#abortController.signal.aborted) {
                $().off(event);
                return;
            }

            $('#requirements-tree').treeview('checkAll', [{
                silent: true
            }]);
            this.updateCost();
        });

        $('#requirements-uncheck-all').on('click', event => {
            if (this.#abortController.signal.aborted) {
                $().off(event);
                return;
            }

            const tree = $('#requirements-tree');
            tree.treeview('uncheckAll', [{
                silent: true
            }]);

            const nodes = tree.treeview('getHidden');
            if (nodes.length > 0) {
                tree.treeview('showNode', [nodes, {
                    silent: true
                }]);
            }

            this.updateCost();
        });

        $('#requirements-hide-done').on('click', event => {
            if (this.#abortController.signal.aborted) {
                $().off(event);
                return;
            }

            const tree = $('#requirements-tree');
            const nodes = tree.treeview('getChecked');
            tree.treeview('hideNode', [nodes, {
                silent: true
            }]);
        });

        $('#requirements-reset-tree').on('click', event => {
            if (this.#abortController.signal.aborted) {
                $().off(event);
                return;
            }

            const tree = $('#requirements-tree');
            tree.treeview('expandAll');
            tree.treeview('uncheckAll', [{
                silent: true
            }]);

            const nodes = tree.treeview('getHidden');
            if (nodes.length > 0) {
                tree.treeview('showNode', [nodes, {
                    silent: true
                }]);
            }

            this.applySettings();
            this.updateCost();
        });

        const filter = $('#requirements-tree-filter');
        const processInput = debounce(event => {
            if (this.#abortController.signal.aborted) {
                $().off(event);
                return;
            }

            const text = filter.val();
            if (text.length > 2) {
                $('#requirements-clear-search').removeClass('invisible');
                $('#requirements-tree').treeview('search', [text, {
                    ignoreCase: true,
                    exactMatch: false,
                    revealResults: true
                }]);
            } else if (text.length === 0) {
                $('#requirements-clear-search').addClass('invisible');
                $('#requirements-tree').treeview('clearSearch');
            }
        }, 200);

        filter.on('keyup', processInput);

        $('#requirements-clear-search').on('click', event => {
            if (this.#abortController.signal.aborted) {
                $().off(event);
                return;
            }

            $('#requirements-tree').treeview('clearSearch');
            $(event.target).addClass('invisible');
            filter.val('');
        });
    }

    /**
     * Render all efficiency tables
     *
     * @param {{base_cost: Counter, base_time: Counter}} cost
     */
    async renderTables(cost) {
        let context = [];
        let reqTypes = new Set();

        this.requirementTree.walk({
            strategy: 'breadth'
        }, node => {
            reqTypes.add(node.model.requirement_type);
        });

        for (const type of reqTypes) {
            switch (type) {
                case RequirementType.Building:
                    context.push(new BuffContext(BuffModifier.ModStarbaseModuleConstructionCost, [], cost[RequirementType.Building].base_cost.keys()), new BuffContext(BuffModifier.ModStarbaseModuleConstructionSpeed, [], cost[RequirementType.Building].base_time.keys()));
                    break;
                case RequirementType.Research:
                    context.push(new BuffContext(BuffModifier.ModResearchCost, [], cost[RequirementType.Research].base_cost.keys()), new BuffContext(BuffModifier.ModResearchSpeed, [], cost[RequirementType.Research].base_time.keys()));
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
     * Reset color and icon of the submit button
     */
    resetSubmitButton() {
        const submitBtn = $('#requirements-calc-submit');
        const submitIco = submitBtn.children('i');
        submitBtn.removeClass('btn-success btn-danger').addClass('btn-primary').prop('disabled', false);
        submitIco.removeClass('fa-loader fa-check fa-xmark').addClass('fa-play');
    }

    /**
     * Update min/max bounds of level inputs & install handlers
     */
    setLevelInputs(startLevel = undefined, targetLevel = undefined) {
        const lvlList = $('#entity-levels').empty();
        for (let i = 0; i <= this.maxLevel; i++) {
            lvlList.append(`<option value="${i}"></option>`);
        }

        const startLevelInput = $('#requirements-startLevel');
        const targetLevelInput = $('#requirements-targetLevel');
        const lvlInputs = startLevelInput.add(targetLevelInput);

        if (startLevel || targetLevel) {
            startLevelInput.val(startLevel ?? '');
            startLevelInput.attr('min', this.id === 0 ? 1 : 0);
            startLevelInput.attr('max', (targetLevel ?? this.maxLevel) - 1);

            targetLevelInput.val(targetLevel ?? '');
            targetLevelInput.attr('min', (startLevel ?? this.id === 0 ? 1 : 0) + 1);
            targetLevelInput.attr('max', this.maxLevel);
        } else {
            lvlInputs.attr('min', this.id === 0 ? 1 : 0);
            lvlInputs.attr('max', this.maxLevel);
            lvlInputs.val('');
        }

        const submitBtn = $('#requirements-calc-submit');
        const submitIco = submitBtn.children('i');

        const resetSubmitBtn = () => {
            submitBtn.removeClass('btn-success btn-danger').addClass('btn-primary').prop('disabled', false);
            submitIco.removeClass('fa-loader fa-check fa-xmark').addClass('fa-play');
        };

        startLevelInput.on('change', event => {
            let startLevel = startLevelInput.val();
            if (startLevel === '') {
                targetLevelInput.attr('min', 0);
            }

            startLevel = Number(startLevel);
            targetLevelInput.attr('min', Math.min(startLevel + 1, this.maxLevel));
            resetSubmitBtn();
        });

        targetLevelInput.on('change', event => {
            let targetLevel = targetLevelInput.val();
            if (targetLevel === '') {
                startLevelInput.attr('max', this.maxLevel);
            }

            targetLevel = Number(targetLevel);
            startLevelInput.attr('max', Math.min(targetLevel - 1, this.maxLevel));
            resetSubmitBtn();
        });
    }

    /**
     * Build an internal representation of a dependency tree
     *
     * @param {number} startLevel
     * @param {number} targetLevel
     * @return {Promise<Node>}
     */
    async buildTree(startLevel, targetLevel) {
        let requirements = [];
        let target;

        for (let i = targetLevel; i > startLevel; --i) {
            requirements.push({
                requirement_type: this.reqType,
                requirement_id: this.id,
                requirement_level: i
            });
        }

        if (startLevel > 0) {
            target = {
                requirement_type: this.reqType,
                requirement_id: this.id,
                requirement_level: startLevel
            };
        } else {
            target = {
                requirement_type: RequirementType.Building,
                requirement_id: 0,
                requirement_level: this.unlockLevel
            };
        }

        this.requirementTree = await resolveRequirements(requirements, target);
    }

    /**
     * Get upgrade cost for a single requirement
     *
     * @param {Requirement} requirement
     * @returns {object}
     */
    getUpgradeCost(requirement) {
        const costData = requirementData[requirement.requirement_type].find(({
            id
        }) => id === requirement.requirement_id);
        if (costData === undefined) {
            return;
        }

        const levelCost = costData.levels.find(({
            id
        }) => id === requirement.requirement_level);
        if (levelCost === undefined) {
            return;
        }

        let upgrade_cost, upgrade_time, time_resource;

        switch (requirement.requirement_type) {
            case RequirementType.Building:
                upgrade_cost = new Counter(levelCost.costs ? .map(({
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
            base_time: new Counter([
                [time_resource, upgrade_time]
            ])
        };
    }

    /**
     * Calculate cumulative base upgrade costs of all unchecked nodes in the tree
     *
     * @return {{base_time: Counter, net_time: Counter, base_cost: Counter, net_cost: Counter}}
     */
    calculateCost() {
        let costData = {};

        for ( /** BsNode */ const node of $('#requirements-tree').treeview('getUnchecked')) {
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

            const cost = this.#costEfficiencies.apply(payload.base_cost, new BuffContext(this.constructor.supportedTypes[payload.type].modifiers.cost, [], payload.base_cost.keys()));
            payload.net_cost = cost;

            const time = this.#costEfficiencies.apply(payload.base_time, new BuffContext(this.constructor.supportedTypes[payload.type].modifiers.time, [], payload.base_time.keys()));
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
     * Calculate cumulative base upgrade costs of all unchecked nodes in the tree
     *
     * @returns {{base_cost: Counter, base_time: Counter}}
     */
    calculateBaseCost() {
        let costData = {};

        for ( /** BsNode */ const node of $('#requirements-tree').treeview('getUnchecked')) {
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
     * Calculate cumulative net upgrade costs of all unchecked nodes in the tree
     *
     * @returns {{net_cost: Counter, net_time: Counter}}
     */
    calculateNetCost() {
        let costData = {};

        for ( /** BsNode */ const node of $('#requirements-tree').treeview('getUnchecked')) {
            const payload = node.payload;

            if (!costData.hasOwnProperty(payload.type)) {
                costData[payload.requirement_type] = {
                    net_cost: new Counter(),
                    net_time: new Counter()
                };
            }

            const cost = this.#costEfficiencies.apply(payload.base_cost, new BuffContext(this.constructor.supportedTypes[payload.type].modifiers.cost, [], payload.base_cost.keys()));
            payload.net_cost = cost;

            const time = this.#costEfficiencies.apply(payload.base_time, new BuffContext(this.constructor.supportedTypes[payload.type].modifiers.time, [], payload.base_time.keys()));
            payload.net_time = time;

            costData[payload.requirement_type].net_cost.iextend(cost);
            costData[payload.requirement_type].net_time.iextend(time);
        }

        const total_cost = new Counter();
        const total_time = new Counter();

        for (const cost of Object.values(costData)) {
            total_cost.iextend(cost.net_cost);
            total_time.iextend(cost.net_time);
        }

        return {
            net_cost: total_cost,
            net_time: total_time,
            ...costData
        };
    }

    /**
     * Load & apply settings
     *
     * @return {Promise<void>}
     */
    async applySettings() {
        let additionalSettings = [];
        const reqTypes = {
            [RequirementType.Building]: 'building',
            [RequirementType.Research]: 'research'
        };

        this.requirementTree.walk({
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

        const tree = $('#requirements-tree');

        if (Object.keys(settings).length > 0) {
            for (const node of tree.treeview('getEnabled')) {
                const setting = settings[node.payload.type] ? .find(({
                    id
                }) => id === node.payload.id);
                if (setting ? .qualifier === null && setting ? .level >= node.payload.level) {
                    node.state.checked = true;
                }
            }
        }

        tree.treeview('render');
    }

    /**
     * Recalculate upgrade cost
     *
     */
    async updateCost() {
        const cost = this.#calculateCost();
        const {
            base_cost,
            base_time,
            net_cost,
            net_time,
            ...breakdown
        } = cost;

        let context = [];

        for (const [type, data] of [...Object.entries(breakdown)].map(([k, v]) => [Number(k), v])) {
            switch (type) {
                case RequirementType.Building:
                    context.push(
                        new BuffContext(BuffModifier.ModStarbaseModuleConstructionCost, [], data.base_cost.keys()),
                        new BuffContext(BuffModifier.ModStarbaseModuleConstructionSpeed, [], data.base_time.keys())
                    );
                    break;
                case RequirementType.Research:
                    context.push(
                        new BuffContext(BuffModifier.ModResearchCost, [], data.base_cost.keys()),
                        new BuffContext(BuffModifier.ModResearchSpeed, [], data.base_time.keys())
                    );
                    break;
            }
        }

        await this.#costEfficiencies.updateCostAndBonuses(cost, ...context);
        $('#requirements-cost-col').trigger('rendered.spock');
    }
}



$(document)
    .off('click.needalert', '#upgrade-cost-table td.upgrade-cost-needed.needed-clickable')
    .on('click.needalert', '#upgrade-cost-table td.upgrade-cost-needed.needed-clickable', function(ev) {
        ev.preventDefault();
        ev.stopPropagation();

        const $td = $(this);
        const resourceId = Number($td.data('resource'));
        const $row = $td.closest('tr.upgrade-cost-row');

        // Parse the amount from the Cost column instead of Needed
        const $costCell = $row.find('td.upgrade-cost-net');
        const costAmount = Math.max(0, Number($costCell.attr('data-amount') || 0));
        if (!Number.isFinite(costAmount) || costAmount <= 0) return;

        // Resource name from the row
        const $nameCell = $row.find('td[data-resource]').first();
        const resourceName = $nameCell.length ?
            $nameCell.text().trim().replace(/\s+/g, ' ') :
            `#${resourceId}`;

        // ✅ Correct availability check
        if (!window.InventoryAlertModal ? .openForResource) {
            console.warn('InventoryAlertModal is not available on this page.');
            return;
        }

        // Open and prefill using costAmount
        window.InventoryAlertModal.openForResource(resourceId, resourceName, {
            upgradeTarget: Math.ceil(costAmount),
            alertName: `${resourceName} - Requirements Calculator`
        });

        // (Optional) If your modal doesn’t auto-select the Upgrade tab:
        setTimeout(() => {
            const tab = document.querySelector('#tab-upgrade');
            tab && new bootstrap.Tab(tab).show();
        }, 0);
    });

$(async () => {
    let requirementsCalculator;
    const types = Object.keys(RequirementsCalculator.supportedTypes).join(',');
    const normalize = (s) =>
        s.normalize('NFD')
        .replace(/[\u0300-\u036f]|'|\*|\\\*|★|⇴|⇵/g, '')
        .replace(/Σ/g, 'sigma')
        .replace(/Ω/g, 'omega')
        .replace(/  +/g, ' ');

    const autocompleteData = (await $.getJSON(`${API_BASE_URL}/v1/autocomplete/names?types=${types}`))
        .toSorted((a, b) => a.name.localeCompare(b.name))
        .map(({
            name,
            ...other
        }) => {
            const sanitizedName = stripHTML(name);
            return {
                name: sanitizedName,
                nameNormalized: normalize(sanitizedName),
                ...other
            };
        });

    const autocomplete = new Autocomplete('requirements-search', {
        onSearch({
            currentValue
        }) {
            const pattern = new RegExp(normalize(currentValue), 'i');
            return autocompleteData.filter(element => element.nameNormalized.match(pattern));
        },
        onResults({
            matches
        }) {
            return matches.map(el => `<li>${el.name} <i class="fa-solid ${RequirementsCalculator?.supportedTypes[el?.type]?.icon ?? 'fa-circle-question'} float-end mt-1"></i></li>`).join('');
        },
        onSubmit({
            object
        }) {
            $('#requirements-search').val(object.name);
            requirementsCalculator ? .destroy();
            requirementsCalculator = new RequirementsCalculator(object.type, object.id);

            const profile = new Profile();
            profile.loadSettings({
                    type: object.type,
                    qualifier: null,
                    id: object.id
                }, {
                    type: object.type,
                    qualifier: 'targetLevel',
                    id: object.id
                })
                .then(settings => {
                    const startLevel = settings[object.type] ? .find(({
                        id,
                        qualifier
                    }) => id === object.id && qualifier === null) ? .level;
                    const targetLevel = settings[object.type] ? .find(({
                        id,
                        qualifier
                    }) => id === object.id && qualifier === 'targetLevel') ? .level;
                    return requirementsCalculator.load(startLevel, targetLevel);
                }, () => requirementsCalculator.load())
                .catch((error) => console.error(`Error during initialization of requirements calculator: ${error.message}\n${error.stack}`));
        },
    });

    $('#modal-tutorial-requirements').on('hidden.bs.modal', () => {
        // Pause the video when the modal is closed
        $('#yt-tutorial-requirements iframe')[0] ? .contentWindow.postMessage('{"event":"command","func":"pauseVideo","args":""}', '*');
    });

    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('type') && urlParams.has('id')) {
        const object = autocompleteData.find(({
            type,
            id
        }) => urlParams.get('type') === type && Number(urlParams.get('id')) === id);
        if (object !== undefined) {
            let startLevel = Number(urlParams.get('startLevel') ?? NaN);
            let targetLevel = Number(urlParams.get('targetLevel') ?? NaN);

            if (Number.isNaN(startLevel) && Number.isNaN(targetLevel)) {
                const profile = new Profile();
                const settings = await profile.loadSettings({
                    type: object.type,
                    qualifier: null,
                    id: object.id
                }, {
                    type: object.type,
                    qualifier: 'targetLevel',
                    id: object.id
                });

                startLevel = settings[object.type] ? .find(({
                    id,
                    qualifier
                }) => id === object.id && qualifier === null)?.level ?? NaN;
                targetLevel = settings[object.type]?.find(({
                    id,
                    qualifier
                }) => id === object.id && qualifier === 'targetLevel')?.level ?? NaN;
            }

            $('#requirements-search').val(object.name);
            autocomplete.showBtn();

            requirementsCalculator = new RequirementsCalculator(object.type, object.id);
            await requirementsCalculator.load(!Number.isNaN(startLevel) ? startLevel : undefined, !Number.isNaN(targetLevel) ? targetLevel : undefined);
        }
    }
});