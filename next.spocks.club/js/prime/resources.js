'use strict';

import {
  makeApiRequest
} from './api.js';
import {
  sanitizeText,
  TranslationCategory,
  TranslationLoader
} from './translations.js';

/** @typedef {object} Resource
 *  @property {number} id
 *  @property {number} art_id
 *  @property {number} loca_id
 *  @property {string} name
 *  @property {number} grade
 *  @property {Rarity} rarity
 *  @property {Subtype} subtype
 *  @property {number} sorting_index
 *  @property {string} sorting_key
 *  @property {number} generation
 *  @property {?number} cap
 *  @property {boolean} exceed_cap
 *  @property {object} group
 *  @property {number} group.id
 *  @property {string} group.name
 *  @property {ShowInInventoryRule} show_in_inventory_rule
 *  @property {boolean} skip_cargo
 *  @property {OwnerType} owner_type
 */

/** @typedef {object} ResourceConversion
 * @property {number} id
 * @property {string} id_str
 * @property {ConversionType} conversion_type
 * @property {Subtype} subtype
 * @property {number} generation
 * @property {number} activate_level_up
 * @property {number} free_skip_threshold
 * @property {object[]} rate
 * @property {number} rate.multiplier
 * @property {number} rate.threshold
 */

/** @type {Promise<object[]>} */
let specsLoading;

/** @type {ResourceConversion[]} */
let conversionData;

/** @type {Promise<object[]>} */
let resourcesLoading;
/** @type {object[]} */
let resourceData;

/** @type {Map.<number, Resource>} */
const resourceMap = new Map();

/** Resource ID for Latinum */
export const RESOURCE_LATINUM = 4272690020;

/**
 * Enum for resource conversion types
 *
 * @readonly
 * @enum {number}
 */
export const ConversionType = Object.freeze({
  Resources: 0,
  Time: 1,
  ShipXp: 2
});

/**
 * Enum for job types
 *
 * @readonly
 * @enum {number}
 */
export const JobType = Object.freeze({
  ShipConstruction: 0,
  ComponentConstruction: 1,
  ShipRefit: 2,
  Research: 3,
  StarbaseConstruction: 4,
  RepairFleet: 5,
  Refinement: 6,
  StarbaseRepair: 7,
  BattleReportCleanup: 8,
  StartMission: 8,
  AllianceContributionCooldown: 10,
  ShipTierUp: 11,
  ShipScrap: 12,
  AwayAssignment: 13
});

/**
 * Enum for resource owner types
 *
 * @readonly
 * @enum {number}
 */
export const OwnerType = Object.freeze({
  Player: 0,
  Alliance: 1
});

/**
 * Enum for resource inventory rules
 *
 * @readonly
 * @enum {number}
 */
export const ShowInInventoryRule = Object.freeze({
  Never: 0,
  Hidden: 1,
  Always: 2,
  Owned: 3
});

/**
 * Enum for resource subtypes
 *
 * @readonly
 * @enum {number}
 */
export const Subtype = Object.freeze({
  None: 0,
  Soft: 1,
  Hard: 2,
  RawMaterial: 3,
  RefinedMaterial: 4,
  Token: 5,
  Intel: 6,
  FactionPoint: 7,
  SpeedupToken: 8,
  ResourceBatch: 9,
  Daily: 10,
  Material: 11,
  PeaceShieldToken: 12,
  PeaceShield: 13,
  ScrappedMaterial: 14,
  TerritoryCapture: 15,
  CosmeticsShard: 16
});

/**
 * Map of time resources
 *
 * @readonly
 * @type {Readonly<{ship_scrap: {0: {sorting_key: string, name: string, icon: string, sorting_index: number, id: number}, 1: {sorting_key: string, name: string, icon: string, sorting_index: number, id: number}}, ship_repair: {0: {sorting_key: string, name: string, icon: string, sorting_index: number, id: number}, 1: {sorting_key: string, name: string, icon: string, sorting_index: number, id: number}}, ship_construction: {0: {sorting_key: string, name: string, icon: string, sorting_index: number, id: number}, 1: {sorting_key: string, name: string, icon: string, sorting_index: number, id: number}}, ship_tier_up: {0: {sorting_key: string, name: string, icon: string, sorting_index: number, id: number}, 1: {sorting_key: string, name: string, icon: string, sorting_index: number, id: number}}, building: {0: {sorting_key: string, name: string, icon: string, sorting_index: number, id: number}, 1: {sorting_key: string, name: string, icon: string, sorting_index: number, id: number}}, research: {0: {sorting_key: string, name: string, icon: string, sorting_index: number, id: number}, 1: {sorting_key: string, name: string, icon: string, sorting_index: number, id: number}}}>}
 */
export const TimeResources = Object.freeze({
  building: {
    0: {
      id: 464174086,
      name: 'Construction Time',
      job: JobType.StarbaseConstruction,
      icon: 'fa-clock',
      sorting_index: 0,
      sorting_key: '999999-00-0-construction'
    },
    1: {
      id: 970306389,
      name: '&Sigma;-Construction Time',
      job: JobType.StarbaseConstruction,
      icon: 'fa-clock text-warning-emphasis',
      sorting_index: 1,
      sorting_key: '999999-01-1-construction'
    }
  },
  research: {
    0: {
      id: 678208761,
      name: 'Research Time',
      job: JobType.Research,
      icon: 'fa-hourglass-clock',
      sorting_index: 2,
      sorting_key: '999999-02-0-research'
    },
    1: {
      id: 1176288552,
      name: '&Sigma;-Research Time',
      job: JobType.Research,
      icon: 'fa-hourglass-clock text-warning-emphasis',
      sorting_index: 3,
      sorting_key: '999999-03-1-research'
    },
    2: {
      id: 52061878,
      name: 'T3-Research Time',
      job: JobType.Research,
      icon: 'fa-hourglass-clock text-danger-emphasis',
      sorting_index: 4,
      sorting_key: '999999-04-2-research'
    }
  },
  ship_construction: {
    0: {
      id: 3082310861,
      name: 'Ship Construction Time',
      job: JobType.ShipConstruction,
      icon: 'fa-hammer-brush',
      sorting_index: 5,
      sorting_key: '999999-05-0-ship-construction'
    },
    1: {
      id: 463772647,
      name: '&Sigma;-Ship Construction Time',
      job: JobType.ShipConstruction,
      icon: 'fa-hammer-brush text-warning-emphasis',
      sorting_index: 6,
      sorting_key: '999999-06-1-ship-construction'
    }
  },
  ship_tier_up: {
    0: {
      id: 458793900,
      name: 'Ship Tier-Up Time',
      job: JobType.ShipTierUp,
      icon: 'fa-turn-up',
      sorting_index: 7,
      sorting_key: '999999-07-0-tier'
    },
    1: {
      id: 38009378,
      name: '&Sigma;-Tier-Up Time',
      job: JobType.ShipTierUp,
      icon: 'fa-turn-up text-warning-emphasis',
      sorting_index: 8,
      sorting_key: '999999-08-1-tier'
    }
  },
  ship_repair: {
    0: {
      id: 1280257028,
      name: 'Ship Repair Time',
      job: JobType.RepairFleet,
      icon: 'fa-wrench',
      sorting_index: 9,
      sorting_key: '999999-09-0-repair'
    },
    1: {
      id: 2632691675,
      name: '&Sigma;-Ship Repair Time',
      job: JobType.RepairFleet,
      icon: 'fa-wrench text-warning-emphasis',
      sorting_index: 10,
      sorting_key: '999999-10-1-repair'
    }
  },
  ship_scrap: {
    0: {
      id: 3975529500,
      name: 'Scrapping Time',
      job: JobType.ShipScrap,
      icon: 'fa-recycle',
      sorting_index: 11,
      sorting_key: '999999-11-0-scrap'
    },
    1: {
      id: 183509829,
      name: '&Sigma;-Scrapping Time',
      job: JobType.ShipScrap,
      icon: 'fa-recycle text-warning-emphasis',
      sorting_index: 12,
      sorting_key: '999999-12-1-scrap'
    }
  }
});

export const TimeResourceIds = Object.freeze(
  Object.fromEntries(
    [...Object.entries(TimeResources)]
      .flatMap(([type, values]) => [...Object.entries(values)].map(([generation, data]) => [data.id, {
        type: type,
        generation: Number(generation),
        ...data
      }]))
  )
);

/**
 * Returns rendered icon and name for a given resource
 *
 * @param {number|Resource} resource
 * @param {{style?: string, includeName?: boolean}} args
 * @return {string}
 */
export function formatResource(resource, args = {}) {
  const options = $.extend({
    style: 'max-height: 24px;',
    includeName: true
  }, args);

  if (typeof resource === 'number' || Number.isInteger(resource)) {
    const timeResource = TimeResourceIds[resource];
    if (timeResource !== undefined) {
      return `<i class="fa-solid fa-lg ${timeResource.icon} me-1" style="padding: 3px;" data-time-resource="${timeResource.id}"></i>${timeResource.name}`;
    }

    const materialResource = resourceMap.get(resource);
    if (materialResource !== undefined) {
      return `<img class="resource-icon object-fit-scale me-1" style="${options.style}" src="/assets/prime/resources/${materialResource.art_id}.png" alt="${materialResource.name}" data-resource="${resource}">` + (options.includeName ? `${materialResource.name}` : '');
    }

    throw new Error(`Invalid resource: ${resource}`);
  }

  // `<div class="resource" style="background-image:url('/assets/prime/resources/${resource.art_id}.png')"></div>${resource.name}`
  return `<img class="resource-icon object-fit-scale me-1" style="${options.style}" src="/assets/prime/resources/${resource.art_id}.png" alt="${resource.name}" data-resource="${resource.id}">` + (options.includeName ? `${resource.name}` : '');

}

/**
 * Helper function for fetching resources asynchronously
 *
 * @return {Promise<void>}
 */
async function fetchResources() {
  if (resourceData === undefined) {
    if (resourcesLoading === undefined) {
      const promise = makeApiRequest('v1/resourcespecs', []);
      resourcesLoading = promise;
      resourceData = await promise;
    } else {
      await resourcesLoading;
    }
  }
}

/**
 * Helper function for fetching resource conversion specs asynchronously
 * @return {Promise<void>}
 */
async function fetchConversionSpec() {
  if (conversionData === undefined) {
    if (specsLoading === undefined) {
      const promise = makeApiRequest('v1/conversionspecs', []);
      specsLoading = promise;
      conversionData = await promise;
    } else {
      await specsLoading;
    }
  }
}

/**
 * Asynchronously fetch details for a given resource
 * Use `getResource()` instead.
 *
 * @param {number} resource_id
 * @return {Promise<?Resource>}
 * @deprecated
 */
export async function fetchResource(resource_id) {
  return getResource(resource_id);
}

/**
 * Retrieves a resource by its ID. If the resource is not already cached, it fetches the resource data,
 * translates the resource name, sanitizes it, and stores the resource in a map for future retrieval.
 *
 * @param {number} resource_id - The unique identifier of the resource to retrieve.
 * @return {Promise<?Resource>} A promise that resolves to the resource object if found, or null if the resource does not exist.
 */
export async function getResource(resource_id) {
  const resource = resourceMap.get(resource_id);
  if (resource !== undefined) {
    return resource;
  }

  await fetchResources();
  const data = resourceData.find(({
    id
  }) => resource_id === id);
  if (data === undefined) {
    return null;
  }

  const resourceName = await TranslationLoader.getByLoca(TranslationCategory.resources.route, data.id_refs.loca_id, 'resource_name', data.name);
  const sanitizedName = sanitizeText(resourceName) ?? 'Missing Translation';
  const internalName = resourceName === null || resourceName === 'Mission Token' ? `${sanitizedName} (${data.id_str.replace(/^(Resource|Token)_/, '')})` : `${sanitizedName}`;

  const entry = {
    id: data.id,
    id_str: data.id_str,
    art_id: data.id_refs.art_id,
    loca_id: data.id_refs.loca_id,
    grade: data.grade,
    rarity: data.rarity,
    subtype: data.subtype,
    sorting_index: data.sorting_index,
    generation: data.generation,
    cap: data.cap,
    group: {
      id: data.resource_group_id,
      name: data.resource_group_id_str
    },
    show_in_inventory_rule: data.show_in_inventory_rule,
    skip_cargo: data.skip_cargo,
    owner_type: data.owner_type,
    sorting_key: `${data.grade}-${data.rarity}-${data.sorting_index.toString().padStart(9, '0')}-${resourceName}`,
    name: sanitizedName,
    internal_name: internalName
  };

  resourceMap.set(entry.id, entry);
  return entry;
}

/**
 * Asynchronously iterates over a list of resource IDs and yields each corresponding resource.
 *
 * @param {Iterable<number>} resource_ids - An array of resource IDs to fetch the resources for.
 * @return {AsyncGenerator<Resource>} An asynchronous generator that yields each fetched resource object.
 */
export async function* getResources(resource_ids) {
  await fetchResources();

  for (const id of resource_ids) {
    const resource = await getResource(id);
    if (resource) {
      yield resource;
    }
  }
}

/**
 * Retrieves an asynchronous generator that yields all resources one by one.
 *
 * This method fetches resource data and iterates over them, yielding each resource individually.
 * It is designed to handle large datasets efficiently by yielding the resources asynchronously.
 *
 * @return {AsyncGenerator<Resource>} An asynchronous generator that yields resource objects.
 */
export async function* getAllResources() {
  await fetchResources();

  for (const {
    id
  } of resourceData) {
    yield getResource(id);
  }
}

/**
 * Get resources map
 *
 * @return {Map<number, Resource>}
 * @deprecated
 */
export function getResourceMap() {
  return resourceMap;
}

/**
 * Retrieves a resource from the cache using its unique identifier.
 *
 * @param {number} resource_id - The ID of the resource to retrieve from the cache.
 * @return {?Resource} The cached resource associated with the provided ID, or undefined if no resource is found.
 */
export function getResourceFromCache(resource_id) {
  return resourceMap.get(resource_id) ?? null;
}

/**
 * Retrieves the Latinum conversion data for a given resource ID.
 *
 * @param {number} resource_id - The unique identifier of the resource whose conversion data is to be fetched.
 * @return {Promise<?ResourceConversion>} The conversion data object for the given resource ID, or null if no matching data is found.
 */
export async function getResourceConversion(resource_id) {
  await fetchConversionSpec();
  return conversionData.find(({
    id
  }) => resource_id === id) ?? null;
}

/**
 * Retrieves resources filtered by the specified type.
 *
 * This asynchronous generator iterates through the resource data
 * and yields resources that match the given type.
 *
 * @param {Subtype} type - The type of resources to filter and retrieve.
 * @return {AsyncGenerator<Promise<Resource>>} An asynchronous generator yielding the resources of the specified type.
 */
export async function* getResourcesByType(type) {
  for (const {
    id
  } of resourceData.filter(({
      subtype
    }) => subtype === type)) {
    yield getResource(id);
  }
}

/**
 * Fetches and returns a map of speed-up durations for a specific time resource,
 * filtered based on generation, supported jobs, and reduction parameters.
 *
 * @param {number} time_resource - Identifier of the time resource from which to retrieve speed-ups.
 * @return {Promise<?Map<number, number>>} A promise that resolves to a map where keys are speed-up resource IDs and values are reduction durations in seconds,
 * or null if no matching speed-ups are found or the time resource is invalid.
 */
export async function getSpeedUps(time_resource) {
  const resource = TimeResourceIds[time_resource];
  if (resource === undefined) {
    return null;
  }

  await fetchResources();
  const result = new Map(
    resourceData
      .filter(({
        generation,
        params
      }) => params !== null && params.hasOwnProperty('reduction_in_seconds') && params ?.supported_jobs.includes(resource.job) && generation === resource.generation)
      .map(({
        id,
        params
      }) => [id, params.reduction_in_seconds])
  );

  return result.size > 0 ? result : null;
}

/**
 * Retrieves resource tokens (resource batches) based on the given resource ID.
 *
 * @param {number} resource_id - The unique identifier of the resource for which tokens are retrieved.
 * @return {Promise<?Map<number, number>>} A promise that resolves to a map containing batch resource IDs as keys and their associated resource amounts as values, or null if no matching resources are found.
 */
export async function getResourceTokens(resource_id) {
  await fetchResources();

  const result = new Map(
    resourceData
      .filter(({
        params
      }) => params !== null && params.hasOwnProperty('resource_amount') && params ?.resource_id === resource_id)
      .map(({
        id,
        params
      }) => [id, params.resource_amount])
  );

  return result.size > 0 ? result : null;
}

/**
 * Helper function for sorting arrays of resources based on their sorting_key property.
 *
 * @param {Resource} a - The first resource object to compare. It should have a `sorting_key` property.
 * @param {Resource} b - The second resource object to compare. It should have a `sorting_key` property.
 * @return {number} A negative number if `a.sorting_key` comes before `b.sorting_key`,
 *                  a positive number if `a.sorting_key` comes after `b.sorting_key`,
 *                  or 0 if they are equal.
 */
export function sortResources(a, b) {
  return a.sorting_key.localeCompare(b.sorting_key);
}
