'use strict';

export const MAX_OPS = 70;
export const MAX_SYNDICATE = 65;

/**
 * A `Map` object that associates resource ids with their corresponding scores in a Material Spend event (Auction).
 *
 * FIXME: this object is maintained manually and should be moved out of this code base
 */
export const AuctionScore = new Map([
  [2453327618, 20], // 3★ Uncommon Refined Ore
  [2599869530, 20], // 3★ Uncommon Refined Gas
  [2367328925, 20], // 3★ Uncommon Refined Crystal

  [3337738024, 30], // 3★ Rare Refined Ore
  [3371789218, 30], // 3★ Rare Refined Gas
  [1787682553, 30], // 3★ Rare Refined Crystal

  [1904955588, 40], // 4★ Uncommon Refined Ore
  [3628066968, 40], // 4★ Uncommon Refined Gas
  [3909684597, 40], // 4★ Uncommon Refined Crystal

  [920308245, 60], // 4★ Rare Refined Ore
  [810120542, 60], // 4★ Rare Refined Gas
  [3965052272, 60], // 4★ Rare Refined Crystal

  [4027233615, 240], // 4★ Epic Refined Ore
  [2290570913, 240], // 4★ Epic Refined Gas
  [292446021, 240], // 4★ Epic Refined Crystal

  [2258174662, 90], // 5★ Uncommon Refined Ore
  [3329003172, 90], // 5★ Uncommon Refined Gas
  [1371250883, 90], // 5★ Uncommon Refined Crystal

  [4109746240, 180], // 5★ Rare Refined Ore
  [768674708, 180], // 5★ Rare Refined Gas
  [3053746170, 180], // 5★ Rare Refined Crystal

  [3491022712, 600], // 5★ Epic Refined Ore
  [2859248631, 600], // 5★ Epic Refined Gas
  [3939844739, 600], // 5★ Epic Refined Crystal

  [2315861452, 600], // 6★ Uncommon Refined Ore
  [283093647, 600], // 6★ Uncommon Refined Gas
  [923421495, 600], // 6★ Uncommon Refined Crystal

  [1781346845, 1200], // 6★ Rare Refined Ore
  [1967964279, 1200], // 6★ Rare Refined Gas
  [1586008427, 1200], // 6★ Rare Refined Crystal

  [2044184714, 0], // 6★ Epic Refined Ore
  [2821198840, 0], // 6★ Epic Refined Gas
  [2041076071, 0], // 6★ Epic Refined Crystal

  [3816701685, 0], // 7★ Uncommon Refined Ore
  [3867315800, 0], // 7★ Uncommon Refined Gas
  [1348542369, 0], // 7★ Uncommon Refined Crystal

  [3342994272, 0], // 7★ Rare Refined Ore
  [2554075924, 0], // 7★ Rare Refined Gas
  [592114938, 0], // 7★ Rare Refined Crystal

  [653553225, 0], // 7★ Epic Refined Ore
  [2262181937, 0], // 7★ Epic Refined Gas
  [2517102751, 0] // 7★ Epic Refined Crystal
]);

/**
 * Enum for entity types
 *
 * @readonly
 * @enum {number}
 */
export const EntityType = Object.freeze({
  Invalid: 0,
  Ship: 73015892,
  System: 232004982,
  Player: 859804212,
  Gameworld: 1025095082,
  Officers: 1211023646,
  Alliance: 1794481137,
  Party: 2028949976,
  Npc: 2100681965,
  DeployedFleet: 2129559302
});

/**
 * @typedef {object} InventoryItem
 * @property {number} id
 * @property {InventoryItemType} type
 * @property {number} count
 */

/**
 * Enum for inventory item types
 *
 * @readonly
 * @enum {number}
 */
export const InventoryItemType = Object.freeze({
  Undefined: -1,
  Component: 0,
  Blueprint: 1,
  Chest: 2,
  Resource: 3,
  ConsumableBattle: 4,
  MissionAccess: 5,
  ConnectionUnlock: 6,
  GalaxyTransition: 7,
  Consumable: 8,
  Officer: 9,
  Ship: 10,
  OfficerShard: 11,
  Cosmetics: 12,
  Worker: 13,
  ForbiddenTechShard: 14,
  Stack: 100,
  Speedup: 101,
  ResourceBatch: 102,
  Shield: 103,
  ForbiddenTech: 104
});

/**
 * Enum for item rarities
 *
 * @readonly
 * @enum {number}
 */
export const Rarity = Object.freeze({
  Base: 0,
  Common: 1,
  Uncommon: 2,
  Rare: 3,
  Epic: 4
});

/**
 * Enum for requirement types
 *
 * @readonly
 * @enum {number}
 */
export const RequirementType = Object.freeze({
  Building: 1,
  ModuleLevel: 1,
  BuildingLevel: 1,
  Research: 2,
  ResearchLevel: 2,
  FactionRank: 3,
  AllianceLevel: 4,
  OfficerRank: 5,
  OfficerLevel: 6,
  TotalOfficerLevel: 7,
  ShipTier: 8,
  NumOfficerAtGivenTiers: 9
});
