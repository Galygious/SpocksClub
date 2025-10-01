'use strict';

import {
  makeApiRequest
} from './api.js';
import {
  TranslationCategory,
  TranslationLoader
} from './translations.js';

/**
 * Enum for consumable categories
 *
 * @readonly
 * @enum {number}
 */
export const ConsumableCategory = Object.freeze({
  Galaxy: 1056678826,
  Station: 2950573209,
  Combat: 1870147103,
  AllianceGalaxy: 3015541956,
  AllianceStation: 962322620,
  AllianceCombat: 2609345038,
  IncursionGalaxy: 3306469306,
  IncursionCombat: 851535659,
  Prime: 3777668171,
  Syndicate: 3579973015,
  AllianceSyndicate: 3425519913,
  LoopMuseum: 4237677914,
  HijackedRefits: 1194469140,
  ForgeConsumable: 2007884498
});

export async function getConsumable(consumable_id) {
  throw new Error('Not implemented');
}

export async function* getConsumables(consumable_id) {
  throw new Error('Not implemented');
}

export async function* getAllConsumables() {
  throw new Error('Not implemented');
}
