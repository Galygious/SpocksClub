'use strict';

import {
  makeApiRequest
} from './api.js';
import {
  EntityType,
  InventoryItemType,
  RequirementType
} from './common.js';
import {
  sanitizeText,
  TranslationCategory,
  TranslationLoader
} from './translations.js';

const RESEARCH_TREE_SKINS = 2880499238;
const RESEARCH_TREE_PROJECTILES = 849605304;
const RESEARCH_TREE_CLOAKING = 1214217282;
const RESEARCH_TREE_ASA = 273083916;

/**
 * Enum for prime categories
 *
 * @readonly
 * @enum {number}
 */
export const PrimeCategory = Object.freeze({
  None: 0,
  Visual: 1,
  GradeLimited: 2,
  Grindable: 3,
  EventStore: 4,
  StoreExclusive: 5
});

/**
 * The `PrimeResources` constant is a frozen object that categorizes various prime resources into specific categories.
 * It maps numerical resource ids to the corresponding `PrimeCategory` type, enabling classification of resources based on their usage or functionality.
 *
 * FIXME: this object is maintained manually and should be moved out of this code base
 */
export const PrimeResources = Object.freeze({
  // likely only visual indicators/legacy content
  2311131421: PrimeCategory.Visual, // Outlaw Research Credits
  1151598288: PrimeCategory.Visual, // Apex Research Medal
  659387578: PrimeCategory.Visual, // Service Award
  4098101920: PrimeCategory.Visual, // Merit of Honor
  2259259992: PrimeCategory.Visual, // Culver Particle
  3421688572: PrimeCategory.Visual, // Rare Culver Particle
  3747911450: PrimeCategory.Visual, // Rodinium Particle
  3013926942: PrimeCategory.Visual, // Spore Drive Component
  4093807541: PrimeCategory.Visual, // Expansion Cube Prime Particle
  1682491449: PrimeCategory.Visual, // Seal of Ko'tal
  37402236: PrimeCategory.Visual, // Premium Mirror Dust
  3595837517: PrimeCategory.Visual, // Static Tachyons
  2267970579: PrimeCategory.Visual, // Charged Tachyons
  3960781802: PrimeCategory.Visual, // Transogen Forge Dust

  // permanent drip/loop
  237886430: PrimeCategory.Grindable, // Prime Particle
  1297728430: PrimeCategory.Grindable, // Prime Dolamide Particle
  3273793479: PrimeCategory.Grindable, // Prime Orbit Medallion
  2059547286: PrimeCategory.Grindable, // Away Teams Particle
  436271016: PrimeCategory.Grindable, // Faction Event Particle
  4225730129: PrimeCategory.Grindable, // Elite Recruit Prime Particle
  1404457690: PrimeCategory.Grindable, // Repair Prime Particle
  1173620904: PrimeCategory.Grindable, // Prime Valor Emblem

  // event stores
  3659057791: PrimeCategory.EventStore, // Cloaked Racketeer Token
  758217009: PrimeCategory.EventStore, // Swarm Prime Particle
  2785203998: PrimeCategory.EventStore, // Ship Parts Prime Particle
  2044488551: PrimeCategory.EventStore, // Syndicate Prime Particle
  4090059819: PrimeCategory.EventStore, // Prime Particle Key
  2481969951: PrimeCategory.EventStore, // Weapon Prime Particle
  1913135262: PrimeCategory.EventStore, // Astral Prime Particle
  1079063455: PrimeCategory.EventStore, // Omega Particle
  3788797977: PrimeCategory.EventStore, // Prime Cosmic Particle
  4225901140: PrimeCategory.EventStore // Prime Mirror Particle
});

/**
 * Enum for tree types
 *
 * @readonly
 * @enum {number}
 */
export const TreeType = Object.freeze({
  Standard: 0,
  ShipCosmetics: 1,
  FactionStore: 2,
  FleetCommanders: 3,
  Artifacts: 4
});

/** @typedef {object} ResearchTree
 * @property {number} id
 * @property {number} art_id
 * @property {string} art_category
 * @property {string} art_prefix
 * @property {number} loca_id
 * @property {?string} name
 * @property {string} tree_name
 * @property {number} sorting_index
 * @property {number} type
 * @property {EntityType} entity_type
 * @property {number} entity_id
 * @property {number} faction_id
 * @property {number} view_level
 * @property {number[]} projects
 */

/**
 * @typedef {object} ResearchProject
 * @property {number} id
 * @property {number} art_id
 * @property {number} loca_id
 * @property {?string} name
 * @property {?string} description
 * @property {number} column
 * @property {number} row
 * @property {number} unlock_level
 * @property {number} view_level
 * @property {number} generation
 * @property {boolean} doubler
 * @property {ResearchTree} research_tree
 * @property {ResearchProjectLevel[]} levels
 * @property {BuffInfo[]} buffs
 */

/**
 * @typedef {object} ResearchProjectLevel
 * @property {number} id
 * @property {number} grade
 * @property {number} power
 * @property {Requirement[]} requirements
 * @property {Map<number, number>} cost
 * @property {number} time
 * @property {InventoryItem[]} rewards
 */

/** @type {object[]} */
let treeData;

/** @type {Promise<void>} */
let treesLoading;

/** @type {object[]} */
let fcData;

/** @type {Promise<void>} */
let fcsLoading;

/** @type {Object<number, Promise<void>>} */
const treeProjectsLoading = {};

/** @type {Object<number, Promise<void>>} */
const projectsLoading = {};

/** @type {Promise<void>} */
let projectIdsLoading;

/** @type {number[]} */
let projectIds;

/** @type {Map<number, ResearchTree>} */
const researchTreeMap = new Map();

/** @type {Map<number, ResearchProject>} */
const researchProjectMap = new Map();

/**
 * Fetches research tree data. This function ensures that the data is loaded only once
 * by making an API request to retrieve research trees. If the data is already being loaded or has
 * been loaded, it reuses the existing promise or cached data.
 *
 * @return {Promise<void>} A promise that resolves when the research tree data has been fetched and cached.
 */
async function fetchResearchTrees() {
  if (treeData === undefined) {
    if (treesLoading === undefined) {
      const promise = makeApiRequest('v1/researchTrees', []);
      treesLoading = promise;
      treeData = await promise;
    } else {
      await treesLoading;
    }
  }
}

/**
 * Fetches a list of fleet commanders from the API. If the fleet commanders' data
 * has not been previously fetched, it will make an API request to retrieve the data.
 * Otherwise, it ensures that any ongoing data loading processes are awaited.
 *
 * @return {Promise<void>} A promise that resolves once the fleet commanders' data has been fetched or any pending loading process is complete.
 */
async function fetchFleetCommanders() {
  if (fcData === undefined) {
    const promise = makeApiRequest('v1/fleetcommanders', []);
    fcsLoading = promise;
    fcData = await promise;
  } else {
    await treesLoading;
  }
}

/**
 * Fetches the research projects for the given tree ID. If the projects are already being loaded, returns the existing promise.
 *
 * @param {number} tree_id - The unique identifier of the research tree to fetch projects for.
 * @return {Promise<Object[]>} A promise that resolves to the research tree projects data, or null if loading fails.
 */
async function fetchResearchTreeProjects(tree_id) {
  let promise;

  if (treeProjectsLoading[tree_id] === undefined) {
    promise = makeApiRequest(`research/tree/${tree_id}`, []);
    treeProjectsLoading[tree_id] = promise;
  } else {
    promise = treeProjectsLoading[tree_id];
  }

  return await promise;
}

/**
 * Fetches research data for a given research ID. Ensures that the data is retrieved from the API only once per ID,
 * managing concurrent requests for the same research ID.
 *
 * @param {number} research_id - The unique identifier of the research to fetch.
 * @return {Promise<?Object>} A promise that resolves to the research data as an object, or null if the request fails.
 */
async function fetchResearch(research_id) {
  let promise;

  if (projectsLoading[research_id] === undefined) {
    promise = makeApiRequest(`research/${research_id}`);
    projectsLoading[research_id] = promise;
  } else {
    promise = projectsLoading[research_id];
  }

  try {
    return await promise;
  } catch (e) {
    return null;
  }
}

/**
 * Fetches and retrieves a list of research IDs from the API.
 * Ensures that the research IDs are only fetched once and subsequent calls
 * will use the same data or await the in-progress fetch request.
 *
 * @return {Promise<void>} A promise that resolves to an array of research IDs.
 */
async function fetchResearchIds() {
  if (projectIds === undefined) {
    if (projectIdsLoading === undefined) {
      const promise = makeApiRequest('research', []);
      projectIdsLoading = promise;
      const data = await promise;
      projectIds = [...data.map(research => research.id)];
    } else {
      await projectIdsLoading;
    }
  }
}

/**
 * Caches a research project by using its data and stores it in the researchProjectMap.
 * If the research project is already cached, it retrieves the cached version.
 *
 * @param {Object} data - The data object representing the research project.
 * @return {Promise<ResearchProject>} The cached or newly created research project object.
 */
async function cacheResearch(data) {
  const project = researchProjectMap.get(data.id);
  if (project !== undefined) {
    return project;
  }

  const researchTree = await getResearchTree(data.research_tree);
  const researchName = await TranslationLoader.getByLoca(TranslationCategory.researches.route, data.loca_id, 'research_project_name', null);

  let researchDescription;
  if (data.research_tree === RESEARCH_TREE_SKINS || data.research_tree === RESEARCH_TREE_PROJECTILES || data.research_tree === RESEARCH_TREE_CLOAKING || data.research_tree === RESEARCH_TREE_ASA) {
    // FIXME: descriptions for these research nodes are in /ship_buffs but no API route supports this
    researchDescription = await TranslationLoader.getByLoca(TranslationCategory.ships.route, data.loca_id, 'ship_ability_desc', null);
  } else {
    researchDescription = await TranslationLoader.getByLoca(TranslationCategory.researches.route, data.loca_id, 'research_project_description', null);
  }

  const research = {
    id: data.id,
    art_id: data.art_id,
    loca_id: data.loca_id,
    name: researchName ? sanitizeText(researchName) : null,
    description: researchDescription ? sanitizeText(researchDescription) : null,
    column: data.column,
    row: data.row,
    unlock_level: data.unlock_level,
    view_level: data.view_level,
    generation: data.generation,
    doubler: data.doubler,
    research_tree: researchTree,
    levels: data.levels.map(level =>
      ({
        id: level.id,
        grade: level.grade,
        power: level.military_might,
        requirements: level.requirements.map(req => ({
          ...req,
          requirement_type: typeof req.requirement_type === 'number' ? req.requirement_type : RequirementType[req.requirement_type]
        })),
        cost: Object.keys(level.resource_cost).length > 0 ?
          new Map([...Object.entries(level.resource_cost)].map(([resource_id, amount]) => [Number(resource_id), amount])) : null,
        time: level.research_time_in_seconds,
        rewards: Object.keys(level.rewards).length > 0 ? [...Object.values(level.rewards)].flatMap(group =>
          group.map(i => ({
            id: i ?.params ?.ref_id ?? null,
            type: typeof i.type === 'number' ? i.type : InventoryItemType[i.type],
            count: i.count
          }))
        ) : null
      })),
    buffs: data.buffs.map(buff => ({
      id: buff.id,
      value_type: buff.value_type,
      value_is_percentage: buff.value_is_percentage,
      values: buff.values.toSpliced(data.levels.length)
    }))
  };

  researchProjectMap.set(research.id, research);
  return research;
}

/**
 * Fetches and retrieves all research trees, caching the results for future use.
 *
 * If the internal `researchTreeMap` cache already contains data, it will return the cached data immediately.
 * Otherwise, it fetches the research tree data, processes it, and populates the cache before returning the result.
 *
 * The returned research trees include detailed information such as tree name, type, entity type, associated IDs,
 * and other metadata. Names are localized and sanitized as required.
 *
 * @return {Map<number, ResearchTree>} A map containing the research trees, where each key is a tree ID and each value is a tree object with its details.
 */
export async function getResearchTrees() {
  if (researchTreeMap.size > 0) {
    return researchTreeMap;
  }

  await Promise.all([fetchResearchTrees(), fetchFleetCommanders()]);

  for (let i = 0; i < treeData.length; i++) {
    const data = treeData[i];

    let treeName, additionalInfo = {};
    if (data.entity_type !== EntityType.Officers) {
      treeName = await TranslationLoader.getByLoca(TranslationCategory.research_trees.route, data.id_refs.loca_id, 'research_tree_name', null);
    } else {
      const commander = fcData.find(({
        id
      }) => id === data.entity_id);
      const commanderName = await TranslationLoader.getById(TranslationCategory.officers.route, data.entity_id, 'officer_name', null);
      const commanderNameShort = await TranslationLoader.getById(TranslationCategory.officers.route, data.entity_id, 'officer_name_short', null);
      treeName = `FC ${commanderNameShort?.toUpperCase() ?? 'UNKNOWN'} – ${data.tree_name.toUpperCase()}`;

      let skillTree;
      fcData.find(({
        skillTrees
      }) => skillTrees.find(tree => {
        if (data.id === tree.id) {
          skillTree = tree;
          return true;
        }

        return false;
      }));

      additionalInfo.fleet_commander = {
        id: commander ?.id,
        art_id: commander ?.artId,
        loca_id: commander ?.locaId,
        name: commanderName,
        short_name: commanderNameShort,
        sort_index: commander ?.sortIndex,
        skills: skillTree ?.skills.map(({
          researchId,
          type,
          groupId
        }) => ({
          research_id: researchId,
          type: type,
          group: groupId ?? null
        }))
      };
    }

    let artCategory = 'research',
      artPrefix = '';
    const treeType = typeof data.type === 'number' ? data.type : TreeType[data.type];

    switch (data.type) {
    case TreeType.ShipCosmetics:
      switch (data.id) {
      case RESEARCH_TREE_SKINS:
      case RESEARCH_TREE_ASA:
        artCategory = 'skins';
        artPrefix = 'ship_skin_';
        break;
      case RESEARCH_TREE_PROJECTILES:
        artCategory = 'skins';
        artPrefix = 'projectile_';
        break;
      case RESEARCH_TREE_CLOAKING:
        artCategory = 'skins';
        artPrefix = 'ship_cloaking_';
        break;
      }
      break;
    case TreeType.FactionStore:
      artCategory = 'buffs';
      break;
    case TreeType.FleetCommanders:
      artCategory = 'skills';
      break;
    case TreeType.Artifacts:
      artCategory = 'artifacts';
      break;
    }

    const tree = {
      id: data.id,
      art_id: data.id_refs.art_id,
      art_category: artCategory,
      art_prefix: artPrefix,
      loca_id: data.id_refs.loca_id,
      name: treeName ? sanitizeText(treeName) : null,
      tree_name: data.tree_name,
      sorting_index: i,
      type: treeType,
      entity_type: typeof data.entity_type === 'number' ? data.entity_type : EntityType[data.entity_type],
      entity_id: data.entity_id !== -1 ? data.entity_id : null,
      faction_id: data.faction_id !== -1 ? data.faction_id : null,
      view_level: data.view_level,
      projects: data.projects,
      ...additionalInfo
    };

    researchTreeMap.set(tree.id, tree);
  }

  return researchTreeMap;
}

/**
 * Retrieves a specific research tree by its unique identifier.
 *
 * This function fetches all research trees and attempts to retrieve
 * the tree corresponding to the given `tree_id` from the internal research tree map.
 *
 * @param {number} tree_id - The unique identifier of the research tree to retrieve.
 * @return {?ResearchTree} The research tree associated with the given ID, or null if not found.
 */
export async function getResearchTree(tree_id) {
  await getResearchTrees();
  return researchTreeMap.get(tree_id) ?? null;
}

/**
 * Fetches research tree projects based on the specified tree ID and yields them as they are processed.
 *
 * @param {number} tree_id - The unique identifier of the research tree to retrieve projects from.
 * @return {AsyncGenerator<ResearchProject>} An asynchronous generator that yields each research project as it is cached.
 */
export async function* getResearchTreeProjects(tree_id) {
  const researchTree = await getResearchTree(tree_id);
  if (!researchTree) {
    return;
  }

  const projectsToFetch = new Set(researchTree.projects.filter(p => p !== -1));
  const cachedProjects = new Set(researchProjectMap.keys());

  if (projectsToFetch.isSubsetOf(cachedProjects)) {
    yield*[...projectsToFetch].map(research_id => researchProjectMap.get(research_id));
  }

  const projects = await fetchResearchTreeProjects(tree_id);
  if (!projects) {
    return;
  }

  for (const project of projects) {
    yield cacheResearch(project);
  }
}

/**
 * Retrieves research data for a given research ID. Fetches the research
 * from the cache if available, otherwise retrieves it from an external
 * source and updates the cache.
 *
 * @param {number} research_id - The unique identifier for the research project.
 * @return {?ResearchProject} The research data object if found, otherwise null.
 */
export async function getResearch(research_id) {
  const research = researchProjectMap.get(research_id);
  if (research !== undefined) {
    return research;
  }

  const data = await fetchResearch(research_id);
  if (!data) {
    return null;
  }

  return await cacheResearch(data);
}

/**
 * Fetches research data asynchronously for the given list of research IDs.
 * This is a generator function that yields each research data item as it becomes available.
 *
 * @param {Iterable<number>} research_ids - An array of research IDs to fetch research data for.
 * @return {AsyncGenerator<ResearchProject>} An async generator yielding research data objects for each valid research ID.
 */
export async function* getResearches(research_ids) {
  for (const research_id of research_ids) {
    const research = await getResearch(research_id);
    if (research) {
      yield research;
    }
  }
}

/**
 * Asynchronously generates all research data by fetching research IDs
 * and then yielding each research associated with those IDs.
 *
 * @return {AsyncGenerator<ResearchProject>} An async generator that yields research objects.
 */
export async function* getAllResearches() {
  const researchProjects = await makeApiRequest('research', []);

  for (const research of researchProjects) {
    yield cacheResearch(research);
  }
}

/**
 * Sorts two research objects based on their row and column properties.
 *
 * The method first compares the `row` properties of the two objects.
 * If the rows are equal, it then compares the `column` properties.
 *
 * @param {ResearchProject} a - The first research object to compare.
 * @param {ResearchProject} b - The second research object to compare.
 * @return {number} Returns a negative number if `a` should appear before `b`,
 *                  a positive number if `a` should appear after `b`,
 *                  or 0 if they are considered equal.
 */
export function sortResearch(a, b) {
  return a.research_tree.sorting_index - b.research_tree.sorting_index || a.column - b.column || a.row - b.row;
}
