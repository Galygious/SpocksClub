'use strict';

import {
  makeApiRequest
} from './api.js';
import {
  Rarity,
  RequirementType
} from './common.js';
import {
  sanitizeText,
  TranslationCategory,
  TranslationLoader
} from './translations.js';

/**
 * Enum for hull types
 *
 * @readonly
 * @enum {number}
 */
export const HullType = Object.freeze({
  Destroyer: 0,
  Interceptor: 0,
  Survey: 1,
  Explorer: 2,
  Battleship: 3,
  Defense: 4,
  ArmadaTarget: 5

});

/** @typedef {object} Ship
 * @property {number} id
 * @property {number} art_id
 * @property {number} loca_id
 * @property {?string} name
 * @property {number} grade
 * @property {number} generation
 * @property {Rarity} rarity
 * @property {HullType} hull_type
 * @property {number} max_tier
 * @property {number} max_level
 * @property {?object} faction
 * @property {number} faction.id
 * @property {number} faction.loca_id
 *
 * @property {number} blueprints_required
 * @property {?Map<number, number>} blueprint_costs
 * @property {Requirement[]} requirements
 *
 * @property {Map<number, number>} cost
 * @property {number} time
 *
 * @property {Map<number, number>} repair_cost
 * @property {number} repair_time
 *
 * @property {ShipTier[]} tiers
 * @property {ShipLevel[]} levels
 *
 * @property {?number} scrap_level
 * @property {?Map<number, number>} base_scrap
 * @property {?ScrapReward[]} scrap_rewards
 *
 */

/** @typedef {object} ShipTier
 * @property {number} tier
 * @property {number} duration
 * @property {ShipComponent[]} components
 * @property {ShipBonus} buffs
 */

/** @typedef {object} ShipLevel
 * @property {number} level
 * @property {number} xp
 * @property {ShipLevelUpBonus} buffs
 */

/** @typedef {object} ShipComponent
 * @property {number} id
 * @property {number} art_id
 * @property {number} loca_id
 * @property {?string} name
 * @property {object} data
 * @property {string} tag
 * @property {number} order
 * @property {Map<number, number>} build_cost
 * @property {Map<number, number>} repair_cost
 * @property {number} repair_time
 */

/** @typedef {object} ShipBonus
 * @property {number} cargo
 * @property {number} protected_cargo
 */

/** @typedef {object} ShipLevelUpBonus
 * @property {number} shield_hp_bonus
 * @property {number} hull_hp_bonus
 */

/** @typedef {object} ScrapReward
 * @property {number} level
 * @property {number} scrap_time
 * @property {Map<number, number>} resources
 */

/** @type {Object<number, Promise<object[]>>} */
const shipsLoading = {};

/** @type {Promise<void>} */
let allShipsLoading;

/** @type {Map<number, Ship>} */
const shipMap = new Map();

/** @type {Map.<number, ShipComponent>} */
const shipComponentsMap = new Map();

const inFlightByResource = new Map();
const dataByResource = new Map();

/**
 * Helper function for fetching ship data asynchronously
 *
 * @param {number} hull_id
 * @return {Promise<?object>}
 */
async function fetchShip(hull_id) {
  let promise;

  if (shipsLoading[hull_id] === undefined) {
    promise = makeApiRequest(`v1/ship/${hull_id}`);
    shipsLoading[hull_id] = promise;
  } else {
    promise = shipsLoading[hull_id];
  }

  try {
    return await promise;
  } catch (e) {
    return null;
  }
}

/**
 * Fetches and caches the list of ship IDs from the API.
 * Ensures that the API request is only made once and subsequent calls
 * return the cached data or wait for the ongoing request to complete.
 *
 * @return {Promise<object[]>} A promise that resolves when the ship IDs have been fetched and cached.
 */
async function fetchAllShips() {
  if (allShipsLoading === undefined) {
    const promise = makeApiRequest('v1/ship', []);
    allShipsLoading = promise;
    return await promise;
  } else {
    return await allShipsLoading;
  }
}

/**
 * Fetches all ships available for scrapping for a given resource.
 * Utilizes a loading state to prevent duplicate API requests for the same resource.
 *
 * @param {string|number} resource_id - The ID of the resource to fetch ships for.
 * @returns {Promise<any>} A promise that resolves to the list of ships for scrapping.
 */
async function fetchAllShipsForScrapResource(resource_id) {
  const key = String(resource_id);

  if (dataByResource.has(key)) {
    return dataByResource.get(key);
  }

  if (!inFlightByResource.has(key)) {
    inFlightByResource.set(key, makeApiRequest(`v1/ship/scrap/${key}`, []));
  }

  try {
    const data = await inFlightByResource.get(key);
    dataByResource.set(key, data);
    return data;
  } finally {
    // avoid leaking promises after resolve/reject
    inFlightByResource.delete(key);
  }
}

/**
 * Caches ship data for later use. If the ship data exists in the cache, it retrieves and returns the cached data.
 * Otherwise, it processes the input data, constructs a ship entry, stores it in the cache, and returns the entry.
 *
 * @param {Object} data - The input data representing a ship to be cached.
 * @return {Promise<Ship>} A promise resolving to the processed and cached ship entry.
 */
async function cacheShip(data) {
  const ship = shipMap.get(data.id);
  if (ship !== undefined) {
    return ship;
  }

  const shipName = await TranslationLoader.getByLoca(TranslationCategory.ships.route, data.loca_id, 'ship_name', null);
  const entry = {
    id: data.id,
    art_id: data.art_id,
    loca_id: data.loca_id,
    name: shipName ? sanitizeText(shipName) : null,
    grade: data.grade,
    generation: data.grade < 6 ? 0 : 1,
    rarity: typeof data.rarity === 'number' ? data.rarity : Rarity[data.rarity],
    hull_type: typeof data.hull_type === 'number' ? data.hull_type : HullType[data.hull_type],
    max_tier: data.max_tier,
    max_level: data.max_level,
    faction: data.faction ?.id > 0 ? {
      id: data.faction.id,
      loca_id: data.faction.loca_id
    } : null,

    blueprints_required: data.blueprints_required,
    blueprint_costs: data.blueprint_costs ?.length > 0 ? new Map([
      [data.blueprint_costs[0].cost.resource_id, data.blueprint_costs[0].cost.amount]
    ]) : null,
    requirements: data.build_requirements.map(req => ({
      ...req,
      requirement_type: typeof req.requirement_type === 'number' ? req.requirement_type : RequirementType[req.requirement_type]
    })),

    cost: data.build_cost ?.length > 0 ? new Map(data.build_cost.map(({
      resource_id,
      amount
    }) => [resource_id, amount])) : null,
    time: data.build_time_in_seconds,

    repair_cost: data.repair_cost ?.length > 0 ? new Map(data.repair_cost.map(({
      resource_id,
      amount
    }) => [resource_id, amount])) : null,
    repair_time: data.repair_time,

    tiers: await getShipTiers(data.tiers),
    levels: data.levels.map(level => ({
      level: level.level,
      xp: level.xp,
      buffs: {
        shield_hp_bonus: level.shield,
        hull_hp_bonus: level.health
      }
    })),

    scrap_level: data.scrap_level > 0 ? data.scrap_level : null,
    base_scrap: (!data.scrap_level || data.scrap_level === -1) ? null : data.base_scrap ?.length > 0 ? new Map(data.base_scrap.map(({
      resource_id,
      amount
    }) => [resource_id, amount])) : null,
    scrap_rewards: (!data.scrap_level || data.scrap_level === -1) ? null : data.scrap ?.map(scrap => ({
      level: scrap.level,
      scrap_time: scrap.scrap_time_seconds,
      resources: new Map(scrap.resources.map(({
        resource_id,
        amount
      }) => [resource_id, amount]))
    }))
  };

  shipMap.set(entry.id, entry);
  return entry;
}

/**
 * Retrieves and processes ship tier data, including associated components, and returns a structured list of ship tiers.
 *
 * @param {object[]} tiers - An array of tier data objects, where each object contains information about a ship tier and its components.
 * @return {Promise<ShipTier[]>} A promise that resolves to an array of processed ship tier objects, with their respective components and properties.
 */
async function getShipTiers(tiers) {
  /** @type {ShipTier[]} */
  const shipTiers = [];

  for (const tierData of tiers) {
    const components = [];

    for (const componentData of tierData.components) {
      const cachedComponent = shipComponentsMap.get(componentData.id);
      if (cachedComponent !== undefined) {
        components.push(cachedComponent);
        continue;
      }

      let componentName = await TranslationLoader.getByLoca(TranslationCategory.ship_components.route, componentData.loca_id, 'component_name', null);
      if (!componentName) {
        switch (componentData.data.tag) {
        case 'Cargo':
          componentName = 'Cargo Bay';
          break;
        case 'Special':
          if (componentData.data.hasOwnProperty('mining_speed')) {
            componentName = 'Mining Laser';
            break;
          }
          // fallthrough
        default:
          componentName = componentData.data.tag;
          break;
        }
      }

      /** @type {ShipComponent} */
      const component = {
        id: componentData.id,
        art_id: componentData.art_id,
        loca_id: componentData.loca_id,
        name: componentName ? sanitizeText(componentName) : null,
        data: componentData.data,
        tag: componentData.data.tag,
        order: componentData.order,
        build_cost: new Map(componentData.build_cost.map(({
          resource_id,
          amount
        }) => [resource_id, amount])),
        repair_cost: new Map(componentData.repair_cost.map(({
          resource_id,
          amount
        }) => [resource_id, amount])),
        repair_time: componentData.repair_time
      };

      shipComponentsMap.set(component.id, component);
      components.push(component);
    }

    shipTiers.push({
      tier: tierData.tier,
      duration: tierData.duration,
      components: components,
      buffs: {
        cargo: tierData.buffs.cargo,
        protected_cargo: tierData.buffs.protected
      }
    });
  }

  return shipTiers;
}

/**
 * Retrieves the ship data associated with the specified hull ID. If the ship is already cached,
 * it returns the cached entry. Otherwise, it fetches the ship data, processes it, and stores it in the cache.
 *
 * @param {number} hull_id - The unique identifier for the ship's hull.
 * @return {Promise<?Ship>} A Promise that resolves to the ship object if found, or `null` if the ship data is unavailable.
 */
export async function getShip(hull_id) {
  const ship = shipMap.get(hull_id);
  if (ship !== undefined) {
    return ship;
  }

  const data = await fetchShip(hull_id);
  if (!data) {
    return null;
  }

  return cacheShip(data);
}

/**
 * Asynchronously retrieves ships based on the specified hull IDs.
 * This is an asynchronous generator function that yields each ship as it is retrieved.
 *
 * @param {Iterable<number>} hull_ids - An array of numbers representing the IDs of the ship hulls to retrieve.
 * @return {AsyncGenerator<Ship>} An asynchronous generator yielding ship objects.
 */
export async function* getShips(hull_ids) {
  for (const hull_id of hull_ids) {
    const ship = await getShip(hull_id);
    if (ship) {
      yield ship;
    }
  }
}

/**
 * Asynchronously generates ship objects by fetching their details.
 * Retrieves ship IDs first and then fetches individual ship data for each ID.
 * Filters out any invalid or undefined ship data.
 *
 * @return {AsyncGenerator<Ship>} An async generator yielding ship objects one by one.
 */
export async function* getAllShips() {
  const shipData = await fetchAllShips();
  yield* shipData.map(data => cacheShip(data));
}

/**
 * Asynchronously retrieves all ships associated with a given scrap resource and yields each cached ship.
 *
 * @param {string|number} resource_id - The identifier of the scrap resource to fetch ships for.
 * @yields {Object} The cached ship data for each ship associated with the resource.
 */
export async function* getAllShipsForScrapResource(resource_id) {
  const shipData = await fetchAllShipsForScrapResource(resource_id);
  for (const data of shipData) {
    yield await cacheShip(data);
  }
}

/**
 * Retrieves a component from the cache using the given component ID.
 *
 * @param {number} component_id - The unique identifier for the component to retrieve from the cache.
 * @return {?ShipComponent} The component object if found in the cache, or null if not found.
 */
export function getComponentFromCache(component_id) {
  return shipComponentsMap.get(component_id) ?? null;
}

/**
 * Retrieves an asynchronous generator of ships that offer scrapping options
 * for the specified resource ID based on their scrap rewards.
 *
 * @param {number} resource_id - The ID of the resource to check for scrapping options.
 * @return {AsyncGenerator<Ship>} An asynchronous generator yielding ships that
 *                                   provide scrapping options containing the specified resource.
 */
export async function* getScrappingOptions(resource_id) {
  for await (const ship of getAllShipsForScrapResource(resource_id)) {
    if (!ship.scrap_level) {
      continue;
    }

    if (ship.scrap_rewards) {
      for (const {
        resources
      } of ship.scrap_rewards) {
        if (resources.has(resource_id)) {
          yield ship;
          break;
        }
      }
    }
  }
}

/**
 * Compares two ship objects and sorts them based on grade, rarity, hull type, and name.
 *
 * @param {Ship} a - The first ship object to compare.
 * @param {Ship} b - The second ship object to compare.
 * @return {number} Returns a negative number if `a` should come before `b`, a positive number if `a` should come after `b`, or 0 if they are equivalent based on the sorting criteria.
 */
export function sortShips(a, b) {
  return a.grade - b.grade || a.rarity - b.rarity || a.hull_type - b.hull_type || a.name.localeCompare(b.name);
}
