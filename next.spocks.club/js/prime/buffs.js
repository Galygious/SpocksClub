'use strict';

import {
    API_BASE_URL
} from '../common.js';
import {
    makeApiRequest
} from './api.js';

/**
 * @typedef {object} Buff
 * @property {BuffAttributes} attributes
 * @property {number} buff_id
 * @property {string} buff_id_str
 * @property {number[]} condition_codes
 * @property {number} cooldown
 * @property {IdRefs} id_refs
 * @property {number} modifier_code
 * @property {number} op
 * @property {number[]} ranked_chances
 * @property {number} ranked_value_type
 * @property {number[]} ranked_values
 * @property {boolean} ranks_up
 * @property {number} schema_id
 * @property {boolean} show_percentage
 * @property {number} source_id
 * @property {number} source_type
 * @property {number} target_code
 * @property {number} trigger_code
 */

/**
 * @typedef {object} BuffAttributes
 * @property {number[]} [battle_types]
 * @property {number} [charges]
 * @property {number} [count]
 * @property {number} [duration_seconds]
 * @property {number} [faction_id]
 * @property {number} [grade]
 * @property {number} [max_level]
 * @property {number} [module_id]
 * @property {number} [num_rounds]
 * @property {number} [officer_stat]
 * @property {number} [percentage]
 * @property {number} [required_round]
 * @property {number[]} [resources]
 * @property {boolean} [scale_with_level]
 * @property {number} [state]
 */

/**
 * @typedef {object} IdRefs
 * @property {number} [art_file_reference]
 * @property {number} art_id
 * @property {number} loca_id
 */

/**
 * Stripped-down version of `Buff`
 *
 * @typedef {object} BuffInfo
 * @property {number} id
 * @property {number} [art_id]
 * @property {number} [loca_id]
 * @property {number} value_type
 * @property {boolean} value_is_percentage
 * @property {object[]} values
 * @property {number} values.chance
 * @property {number} values.value
 */


export const ClientModifierType = Object.freeze({
    ModEnergyDamage: 0,
    ModKineticDamage: 1,
    ModAllDamage: 2,
    ModShotsPerAttack: 3,
    ModAllLoadSpeed: 4,
    ModAllReloadSpeed: 5,
    ModAccuracy: 6,
    ModArmorPiercing: 7,
    ModShieldPiercing: 8,
    ModCritChance: 9,
    ModCritDamage: 10,
    ModShipDodge: 11,
    ModShipArmor: 12,
    ModShields: 13,
    ModCptManeuverEffect: 14,
    ModOffAbilityEffect: 15,
    ModShieldHpRepair: 16,
    ModHullHpRepair: 17,
    ModAddState: 18,
    ModRemoveState: 19,
    ModParsteelProtection: 20,
    ModTritaniumProtection: 21,
    ModDilithiumProtection: 22,
    ModCombatParsteelReward: 23,
    ModCombatTritaniumReward: 24,
    ModCombatDilithiumReward: 25,
    ModCombatIntelReward: 26,
    ModCombatLootDropChance: 27,
    ModCombatLootDropQuantity: 28,
    ModCombatXpReward: 29,
    ModMissionsParsteelReward: 30,
    ModMissionsTritaniumReward: 31,
    ModMissionsDilithiumReward: 32,
    ModMissionsIntelReward: 33,
    ModMissionsLootDropChance: 34,
    ModMissionsLootDropQuantity: 35,
    ModMissionsXPReward: 36,
    ModFactionPointsFederationReward: 37,
    ModFactionPointsKlingonReward: 38,
    ModFactionPointsRomulanReward: 39,
    ModFactionPointsAllReward: 40,
    ModMiningRateParsteel: 41,
    ModMiningRateTritanium: 42,
    ModMiningRateDilithium: 43,
    ModMiningRateOre: 44,
    ModMiningRateHydrocarbon: 45,
    ModMiningRewardParsteel: 46,
    ModMiningRewardTritanium: 47,
    ModMiningRewardDilithium: 48,
    ModMiningRewardOre: 49,
    ModMiningRewardHydrocarbon: 50,
    ModRepairCostsParsteel: 51,
    ModRepairCostsTritanium: 52,
    ModRepairCostsDilithium: 53,
    ModRepairCostAll: 54,
    ModRepairTime: 55,
    ModOfficerStatAttack: 56,
    ModOfficerStatDefense: 57,
    ModOfficerStatHealth: 58,
    ModOfficerStatAll: 59,
    ModShieldHpMax: 60,
    ModHullHpMax: 61,
    ModImpulseSpeed: 62,
    ModWarpSpeed: 63,
    ModWarpDistance: 64,
    ModEnterWarpDelay: 65,
    ModCargoCapacity: 66,
    ModCargoProtection: 67,
    ModAutoRecall: 68,
    ModEnergyLoadSpeed: 69,
    ModKineticLoadSpeed: 70,
    ModEnergyReloadSpeed: 71,
    ModKineticReloadSpeed: 72,
    ModAllDefenses: 73,
    ModAllPiercing: 74,
    ModShieldRegenTime: 75,
    ModShieldMitigation: 76,
    ModRepairCostsPost: 79,
    ModResourceProtection: 100,
    ModCombatResourceReward: 101,
    ModMissionResourceReward: 102,
    ModFactionPointsRewards: 103,
    ModFactionPointsLosses: 104,
    ModMiningRate: 105,
    ModMiningReward: 106,
    ModRepairCosts: 107,
    ModStarbaseModuleConstructionSpeed: 108,
    ModStarbaseModuleConstructionCost: 109,
    ModResearchSpeed: 110,
    ModResearchCost: 111,
    ModResourceGeneration: 112,
    ModResourceStorage: 113,
    ModForceFieldRechargeSpeed: 114,
    ModForcefieldHp: 115,
    ModComponentCost: 116,
    ModShipConstructionSpeed: 117,
    ModShipConstructionCost: 118,
    ModTierUpSpeed: 119,
    ModFactionPointsPenaltyReduction: 120,
    ModFactionStoreLootBonus: 121,
    ModOfficerLevelUpCost: 122,
    ModOfficerPromoteCost: 123,
    ModScanShip: 124,
    ModScanStation: 125,
    ModScanSystem: 126,
    ModIncomingStationAttackInformation: 127,
    ModIncomingStationAttackAdvancedWarning: 128,
    ModShipScrapResourceBonus: 129,
    ModShipScrapLootBonus: 130,
    ModShipScrapSpeed: 131,
    ModAwayMissionSpeed: 132,
    ModAwayMissionResourceRewards: 133,
    ModAwayMissionLootBonus: 134,
    ModResourceProducerResourceStorage: 135,
    ModWarehouseResourceStorage: 136,
    ModVaultResourceStorage: 137,
    ModHullID: 138,
    ModShipInventorySize: 139,
    ModScanCost: 140,
    ModTradeTax: 141,
    ModRepairStation: 142,
    ModArmadaSize: 143,
    ModCombatPveRewards: 145,
    ModCombatOutlawsRewards: 146,
    ModJumpAndTowCostEff: 147,
    ModCombatBorgRewards: 148,
    ModCombatArmadaRewards: 149,
    ModSkillCloakingCooldown: 150,
    ModSkillCloakingDuration: 151,
    ModSkillCloakingCost: 152,
    ModSkillCloakingSneakChance: 153,
    ModSkillCloakingRevealChance: 154,
    ModSkillcloakingresetcloakingcooldown: 155,
    ModCombatPlunderedCargoRewards: 156,
    ModSkillSupportShipAbilityCooldown: 157,
    ModSkillSupportShipAbilityDuration: 158,
    ModSkillSupportShipAbilityCost: 159,
    ModSkillSupportShipAbilityDurationPercentage: 160,
    ModCombatActianVenomRewards: 161,
    ModSkillDebuffDuration: 162,
    ModSkillDebuffCost: 163,
    ModSkillDebuffDurationPercentage: 164,
    ModDepositoryStorage: 165,
    ModRelocationRange: 166,
    ModAntiCloaking: 167,
    ModCombatUncommonArmadaRewards: 170,
    ModCombatRareArmadaRewards: 171,
    ModCombatEpicArmadaRewards: 172,
    ModCombatUncommonOutlawArmadaRewards: 173,
    ModCombatRareOutlawArmadaRewards: 174,
    ModCombatEpicOutlawArmadaRewards: 175,
    ModCombatSourceArmadaRewards: 176,
    ModCombatJemhadarRewards: 177,
    ModCombatSourceSoloArmadaRewards: 178,
    ModPreCombatSoloArmadaEliteCreditRewards: 179,
    ModSkillArmadaSupportAbilityCooldown: 201,
    ModSkillArmadaSupportDuration: 202,
    ModSkillArmadaSupportCost: 203,
    ModSkillArmadaSupportDurationPercentage: 204,
    ModCombatOfficerPakledRewards: 205,
    ModPreCombatSoloArmadaBorgRewards: 206,
    ModCombatBorgVinculumFragmentsRewards: 207,
    ModCombatG4G5AllShipPartsRewards: 209,
    ModCombatG4G5DestroyerShipPartsRewards: 211,
    ModCombatG4G5ExplorerShipPartsRewards: 212,
    ModCombatG4G5BattleshipShipPartsRewards: 213,
    ModCombatArtifactGachaRewards: 215,
    ModCombatComplexNanotechRewards: 217,
    ModFcCooldownSpeed: 218,
    ModJanewayFcCooldownSpeed: 219,
    ModBdAbilityEffect: 220,
    ModForbiddenTechUnslotCost: 222,
    ModBypassShields: 223,
    ModInstantArmadaUnlocked: 224,
    ModHullRepair: 225,
    ModSkillCuttingBeamAbilityCost: 226,
    ModForbiddenTechTierUpCost: 227,
    ModForbiddenTechLevelUpCost: 228,
    ModSimultaneousArmada: 233,
    ModSkillCuttingBeamPvEBaseDamagePercentage: 240,
    ModSkillCuttingBeamPvPBaseDamagePercentage: 241,
    ModSkillCuttingBeamAccumulateBeams: 251,
    ModIsolyticDamage: 707,
    ModIsolyticDefense: 808,
    ModCargoGeneration: 809,
    ModHazardTypeAMitigation: 810,
    ModHazardTypeBMitigation: 811,
    ModHazardTypeCMitigation: 812,
    ModHazardTypeDMitigation: 813,
    ModHazardBaseMitigation: 814,
    ModHazardTypeEMitigation: 815,
    ModCombatParsteelT2Reward: 60001,
    ModCombatTritaniumT2Reward: 60002,
    ModCombatDilithiumT2Reward: 60003,
    ModJumpingPointsCost: 67002,
    ModTrelliumRewards: 67003,
    ModSkillSelfHealingCost: 68001,
    ModSkillSelfHealingCooldown: 68002,
    ModSkillSelfHealingIncrease: 68003,
    ModHostileLoot: 71001,
    ModChaosTechUnslotCost: 72001,
    ModChaosTechTierUpCost: 72002,
    ModChaosTechLevelUpCost: 72003,
    ModNone: -1000,
});

export const BuffConditions = Object.freeze({
    0: {
        name: 'SelfExplorer',
        text: 'Applies when your ship is an Explorer'
    },
    1: {
        name: 'SelfInterceptor',
        text: 'Applies when your ship is an Interceptor'
    },
    2: {
        name: 'SelfBattleship',
        text: 'Applies when your ship is a Battleship'
    },
    3: {
        name: 'SelfSurveyor',
        text: 'Applies when your ship is a Survey'
    },
    4: {
        name: 'EnemyExplorer',
        text: 'Applies against enemy Explorers'
    },
    5: {
        name: 'EnemyInterceptor',
        text: 'Applies against enemy Interceptors'
    },
    6: {
        name: 'EnemyBattleship',
        text: 'Applies against enemy Battleships'
    },
    7: {
        name: 'EnemySurvey',
        text: 'Applies against enemy Surveys'
    },
    8: {
        name: 'EnemySentinel',
        text: 'Applies against enemy Defense Platforms'
    },
    9: {
        name: 'CondCargoFull',
        text: 'Applies when your ship\'s cargo is full'
    },
    10: {
        name: 'CondCargoEmpty',
        text: 'Applies when your ship\'s cargo is empty'
    },
    12: {
        name: 'CondSelfMining',
        text: 'Applies when your ship is currently mining'
    },
    13: {
        // name: 'CondEnemyStation', text: 'Applies against enemy stations'
        name: 'CondSelfAttacking',
        text: 'Applies when your ship is attacking'
    },
    14: {
        name: 'SelfOrSentinelAttacked',
        text: 'Applies when your ship or your Defense Platforms are under attack'
    },
    16: {
        name: 'EnemyStronger',
        text: 'Applies when the enemy ship is stronger than your ship'
    },
    17: {
        name: 'CondEnemyHullFaction',
        text: 'Applies when the enemy ship\'s hull belongs to a specific faction'
    },
    27: {
        name: 'CondEnemyHostile',
        text: 'Applies when the enemy is a hostile'
    },
    28: {
        name: 'CondEnemyPlayer',
        text: 'Applies when the enemy is a player'
    },
    33: {
        name: 'CondSelfHasMorale',
        text: 'Applies when your ship has Morale'
    },
    34: {
        name: 'CondSelfHasHullBreach',
        text: 'Applies when your ship has a Hull Breach'
    },
    35: {
        name: 'CondSelfHasBurning',
        text: 'Applies when your ship is Burning'
    },
    36: {
        name: 'CondTargetHasMorale',
        text: 'Apples when the enemy ship has Morale'
    },
    37: {
        name: 'CondTargetHasHullBreach',
        text: 'Applies when the enemy ship has a Hull Breach'
    },
    38: {
        name: 'CondTargetHasBurning',
        text: 'Applies when the enemy ship is Burning'
    },
    39: {
        name: 'CondModuleEnergy',
        text: 'Applies to energy weapons'
    },
    40: {
        name: 'CondModuleKinetic',
        text: 'Applies to kinetic weapons'
    },
    41: {
        name: 'CondHitEnemyWithEnergy',
        text: 'Applies when you hit the enemy with an energy weapon'
    },
    42: {
        name: 'CondHitEnemyWithKinetic',
        text: 'Applies when you hit the enemy with a kinetic weapon'
    },
    43: {
        name: 'CondHullHealthBelow',
        text: 'Applies when your hull health is below a certain threshold'
    },
    44: {
        name: 'CondHullHealthBelowStartOfCombat',
        text: 'Applies when your hull health is below a certain threshold at the start of combat'
    },
    53: {
        name: 'CondSelfHasAssimilated',
        text: 'Applies when your ship is assimilated'
    },
    54: {
        name: 'CondTargetHasAssimilated',
        text: 'Applies when the enemy ship is assimilated'
    },
    57: {
        name: 'CondEnemyNonArmadaHostile',
        text: 'Applies when the enemy is a non-Armada hostile'
    },
    59: {
        name: 'CondEnemyToaTrialHostile',
        text: 'Applies when the enemy is a Q\'s Trials hostile'
    },
    102: {
        name: 'CondSelfShipGrade',
        text: 'Applies when your ship is of a specific grade'
    },
    113: {
        name: 'CondSelfHullFaction',
        text: 'Applies when your ship\'s hull belongs to a specific faction'
    },
    114: {
        name: 'CondSelfAtStation',
        text: 'Applies when your ship is docked in station'
    },
    116: {
        name: 'SelfSentinel',
        text: 'Applies to your station\'s Defense Platforms'
    },
    117: {
        name: 'CondEnemySentinel',
        text: 'Applies against enemy station\'s Defense Platforms'
    },
    118: {
        name: 'CondResourceId',
        text: 'Applies to specific resources'
    },
    119: {
        name: 'CondSelfModuleId',
        text: 'Applies when your ship is docked at a specific Drydock'
    },
    120: {
        name: 'CondSelfShipGrade1',
        text: 'Applies to Grade 1 ships'
    },
    121: {
        name: 'CondSelfShipGrade2',
        text: 'Applies to Grade 2 ships'
    },
    122: {
        name: 'CondSelfShipGrade3',
        text: 'Applies to Grade 3 ships'
    },
    123: {
        name: 'CondSelfShipGrade4',
        text: 'Applies to Grade 4 (or above) ships'
    },
    124: {
        name: 'CondSelfIsFederation',
        text: 'Applies to Federation faction ships'
    },
    125: {
        name: 'CondSelfIsRomulan',
        text: 'Applies to Romulan faction ships'
    },
    126: {
        name: 'CondSelfIsKlingon',
        text: 'Applies to Klingon faction ships'
    },
    127: {
        name: 'CondTargetIsSwarm',
        text: 'Applies when the target is a Swarm Hostile'
    },
    129: {
        name: 'CondTargetIsArmada',
        text: 'Applies when you\'re fighting an Armada Target'
    },
    131: {
        name: 'CondSelfIsNotArmada',
        text: 'Applies when your ship is not part of an Armada'
    },
    132: {
        name: 'CondTargetShipGrade1',
        text: 'Applies when the target ship is of Grade 1'
    },
    133: {
        name: 'CondTargetShipGrade2',
        text: 'Applies when the target ship is of Grade 2'
    },
    134: {
        name: 'CondTargetShipGrade3',
        text: 'Applies when the target ship is of Grade 3'
    },
    135: {
        name: 'CondTargetShipGrade4',
        text: 'Applies when the target ship is of Grade 4'
    },
    137: {
        name: 'CondTargetPlayerNotStation',
        text: 'Does not apply in station combat'
    },
    150: {
        name: 'CondSelfHullMudd',
        text: 'Applies to Stella'
    },
    151: {
        name: 'CondSelfHullBotanyBay',
        text: 'Applies to Botany Bay'
    },
    152: {
        name: 'CondSelfHullDiscovery',
        text: 'Applies to USS Discovery'
    },
    153: {
        name: 'CondSelfHullSarcophagus',
        text: 'Applies to Sarcophagus'
    },
    154: {
        name: 'CondSelfHullVidar',
        text: 'Applies to Vi\'Dar'
    },
    155: {
        name: 'CondSelfHullDvor',
        text: 'Applies to Ferengi D\'Vor'
    },
    156: {
        name: 'CondSelfHullFranklin',
        text: 'Applies to USS Franklin'
    },
    157: {
        name: 'CondSelfHullBlackJellyfish',
        text: 'Applies to ISS Jellyfish'
    },
    158: {
        name: 'CondSelfHullFranklin2',
        text: 'Applies to USS Franklin-A'
    },
    159: {
        name: 'CondSelfHullEnterprise',
        text: 'Applies to USS Enterprise'
    },
    160: {
        name: 'CondSelfHullEnterpriseA',
        text: 'Applies to USS Enterprise-A'
    },
    161: {
        name: 'CondSelfHullD4',
        text: 'Applies to D4 Class'
    },
    162: {
        name: 'CondSelfHullHeghta',
        text: 'Applies to Hegh\'ta'
    },
    163: {
        name: 'CondSelfHullAugur',
        text: 'Applies to Augur'
    },
    164: {
        name: 'CondSelfHullTribune',
        text: 'Applies to Tribune'
    },
    165: {
        name: 'CondSelfHullSaladin',
        text: 'Applies to USS Saladin'
    },
    166: {
        name: 'CondSelfHullCenturion',
        text: 'Applies to Centurion'
    },
    167: {
        name: 'CondSelfHullBortas',
        text: 'Applies to Bortas'
    },
    170: {
        name: 'CondCombatBattleType',
        text: function(buff_effect) {
            if (buff_effect ?.attributes ?.battle_types !== undefined) {
                let labels = [];

                for (const battle_type of buff_effect.attributes.battle_types) {
                    switch (battle_type) {
                        case 4:
                            labels.push('On Docking Point (i.e., Capture Node or Mining Node)');
                            break;
                        default:
                            labels.push(`Missing translation [${battle_type}]`);
                    }
                }

                return `<li>Applies when your ship is engaged in a special battle type (here: ${labels.join('; ')})</li>`;
            }

            return `<li>Applies when your ship is engaged in a special battle type (i.e., Territory Capture or Mission Hostile)</li>`;
        }
    },
    171: {
        name: 'CondCombatGameContext',
        text: function(buff_effect) {
            if (buff_effect ?.attributes ?.game_context !== undefined) {
                let label;

                switch (buff_effect.attributes.game_context) {
                    case 'mining_node':
                        label = 'Mining Node';
                        break;
                    default:
                        label = `Missing translation [${buff_effect.attributes.game_context}]`;
                }

                return `<li>Applies when your ship is subject to a special context (here: ${label})</li>`;
            }

            return `<li>Applies when your ship is subject to a special context (i.e., docked on Capture Node)</li>`;
        }
    },
    172: {
        name: 'CondSelfHullIsogenMiner',
        text: 'Applies to Meridian'
    },
    173: {
        name: 'CondSelfHullUSSHydra',
        text: 'Applies to USS Hydra'
    },
    174: {
        name: 'CondSelfHullVortaVor',
        text: 'Applies to Vorta Vor'
    },
    175: {
        name: 'CondSelfHullBChor',
        text: 'Applies to B\'Chor'
    },
    176: {
        name: 'CondSelfShipGrade5',
        text: 'Applies to Grade 5 ships'
    },
    177: {
        name: 'CondTargetShipGrade5',
        text: 'Applies when the target ship is of Grade 5'
    },
    178: {
        name: 'CondTargetMaxLevel',
        text: function(buff_effect) {
            return `<li>Applies when the target ship is Level ${buff_effect.attributes.max_level} or below</li>`;
        }
    },
    179: {
        name: 'CondSelfCloaked',
        text: 'Applies when your ship is cloaked'
    },
    180: {
        name: 'CondSelfHullD3',
        text: 'Applies to D3 Class'
    },
    181: {
        name: 'CondSelfHullLegionary',
        text: 'Applies to Legionary'
    },
    182: {
        name: 'CondSelfHullBrel',
        text: 'Applies to B\'Rel'
    },
    183: {
        name: 'CondSelfHullGladius',
        text: 'Applies to Gladius'
    },
    184: {
        name: 'CondSelfHullKtinga',
        text: 'Applies to K\'T\'inga'
    },
    185: {
        name: 'CondSelfHullValdore',
        text: 'Applies to Valdore'
    },
    186: {
        name: 'CondSelfHullKorinar',
        text: 'Applies to Korinar'
    },
    187: {
        name: 'CondSelfHullPilum',
        text: 'Applies to Pilum'
    },
    188: {
        name: 'CondSelfHullNova',
        text: 'Applies to Nova'
    },
    189: {
        name: 'CondSelfHullCorvus',
        text: 'Applies to Corvus'
    },
    190: {
        name: 'CondSelfHullVorcha',
        text: 'Applies to Vor\'cha'
    },
    191: {
        name: 'CondSelfHullQuvsompek',
        text: 'Applies to Quv\'Sompek'
    },
    192: {
        name: 'CondSelfHullSanctus',
        text: 'Applies to Sanctus'
    },
    193: {
        name: 'CondSelfHullAmalgam',
        text: 'Applies to Amalgam'
    },
    194: {
        name: 'CondSelfCerritosBuffed',
        text: 'Applies when your ship is buffed by the USS Cerritos'
    },
    195: {
        name: 'CondSelfHullCerritos',
        text: 'Applies to USS Cerritos'
    },
    196: {
        name: 'CondSelfHullIndSurvey',
        text: 'Applies to independent Surveys'
    },
    197: {
        name: 'CondSelfHullDvorFeesha',
        text: 'Applies to D\'Vor Feesha'
    },
    199: {
        name: 'CondSelfAtGroupArmada',
        text: 'Applies when your ship is at a group Armada'
    },
    200: {
        name: 'CondSelfIsInvader',
        text: 'Applies when you are invading during Infinite Incursions'
    },
    201: {
        name: 'CondSelfIsDefender',
        text: 'Applies when you are defending during Infinite Incursions'
    },
    202: {
        name: 'CondSelfIsKVKActive',
        text: 'Applies during Infinite Incursions'
    },
    203: {
        name: 'CondSelfLoyaltyLevel30',
        text: 'Applies when you\'ve reached Syndicate Level 30'
    },
    204: {
        name: 'CondSelfLoyaltyLevel33',
        text: 'Applies when you\'ve reached Syndicate Level 33'
    },
    205: {
        name: 'CondSelfLoyaltyLevel35',
        text: 'Applies when you\'ve reached Syndicate Level 35'
    },
    206: {
        name: 'CondSelfShipDebuffed',
        text: 'Applies when your ship is debuffed (e.g., by Mantis sting)'
    },
    207: {
        name: 'CondSelfHullMantis',
        text: 'Applies to Mantis'
    },
    208: {
        name: 'CondSelfAtSoloArmada',
        text: 'Applies when your ship is at a solo Armada'
    },
    209: {
        name: 'CondSelfHullDefiant',
        text: 'Applies to USS Defiant'
    },
    215: {
        name: 'CondSelfHullRotarran',
        text: 'Applies to Rotarran'
    },
    216: {
        name: 'CondSelfHullDderidex',
        text: 'Applies to D\'deridex'
    },
    217: {
        name: 'CondSelfHullEnterpriseD',
        text: 'Applies to USS Enterprise-D'
    },
    220: {
        name: 'CondSelfHullKelvin',
        text: 'Applies to USS Kelvin'
    },
    224: {
        name: 'CondSelfAtGroupArmadaOrTargetDominion',
        text: 'Applies when your ship is at a group Armada or the target is a Dominion (note: might need correction)'
    },
    225: {
        name: 'CondSelfHullShipGrade6Faction',
        text: 'Applies when your ship\'s hull is Grade 6 of a specific faction'
    },
    230: {
        name: 'CondSelfIsASB',
        text: 'Applies to Alliance Starbase'
    },
    231: {
        name: 'CondSelfAtAssault',
        text: 'Applies when your ship is at an assault'
    },
    235: {
        name: 'CondSelfAtAssault2',
        text: 'Applies when your ship is at an assault'
    },
    236: {
        name: 'CondTargetStation',
        text: 'Applies when the target is a station' // This seems wrong
        // name: 'CondSelfAtArmada', text: 'Applies when your ship is part of an armada'
    },
    238: {
        name: 'CondSelfHullVidarTalios',
        text: 'Applies to Vi\'Dar Talios'
    },
    240: {
        name: 'CondSelfIsFedKlingRom',
        text: 'Applies when your ship belongs to the Federation, Klingon, or Romulan factions'
    },
    241: {
        name: 'CondSelfTitanAMaxFortified',
        text: 'Applies when your ship is max-fortified by a USS Titan-A'
    },
    242: {
        name: 'CondSelfTitanAFortified',
        text: 'Applies when your ship is fortified by a USS Titan-A'
    },
    243: {
        name: 'CondSelfHullTitanA',
        text: 'Applies to USS Titan-A'
    },
    244: {
        name: 'CondSelfHullVoyager',
        text: 'Applies to USS Voyager'
    },
    245: {
        name: 'CondSelfAtFormationArmada',
        text: 'Applies when your ship is at a Formation Armada'
    },
    246: {
        name: 'CondSelfOfficerTalNotOnBridge',
        text: 'Applies when Officer Tal is not on the bridge'
    },
    247: {
        name: 'CondTargetStateAny',
        text: 'Applies when the target has any Status Effect applied (e.g., Morale, Hull Breach, Burning, Assimilate)'
    },
    248: {
        name: 'CondSelfStateAny',
        text: 'Applies when your ship has any Status Effect applied (e.g., Morale, Hull Breach, Burning, Assimilate)'
    },
    249: {
        name: 'CondSelfHullRealta',
        text: 'Applies to Realta'
    },
    250: {
        name: 'CondSelfHullMonaveen',
        text: 'Applies to Monaveen'
    },
    251: {
        name: 'CondSelfShipGrade6',
        text: 'Applies to Grade 6 ships'
    },
    252: {
        name: 'CondTargetShipGrade6',
        text: 'Applies when the target ship is of Grade 6'
    },
    253: {
        name: 'CondSelfHullSelkie',
        text: 'Applies to Selkie'
    },
    254: {
        name: 'CondSelfHullNewgrange',
        text: 'Applies to USS Newgrange'
    },
    255: {
        name: 'CondSelfHullGrishnar',
        text: 'Applies to Grishnar'
    },
    256: {
        name: 'CondSelfHullDivitae',
        text: 'Applies to Divitae'
    },
    257: {
        name: 'CondSelfHullAkira',
        text: 'Applies to USS Akira'
    },
    258: {
        name: 'CondSelfHullMinerva',
        text: 'Applies to Minerva'
    },
    259: {
        name: 'CondSelfHullNeghVar',
        text: 'Applies to Negh\'Var'
    },
    260: {
        name: 'CondSelfHullUSSTitan',
        text: 'Applies to USS Titan'
    },
    261: {
        name: 'CondSelfHullKoskarii',
        text: 'Applies to Kos\'karii'
    },
    262: {
        name: 'CondSelfHullVelox',
        text: 'Applies to Velox'
    },
    263: {
        name: 'CondSelfHullEnterpriseE',
        text: 'Applies to USS Enterprise-E'
    },
    264: {
        name: 'CondSelfHullKrencha',
        text: 'Applies to Krencha'
    },
    265: {
        name: 'CondSelfHullScimitar',
        text: 'Applies to Scimitar'
    },
    270: {
        name: 'CondSelfHullBorgCube',
        text: 'Applies to Borg Cube'
    },
    271: {
        name: 'CondSelfHullNX01',
        text: 'Applies to Enterprise NX-01'
    },
    272: {
        name: 'CondSelfHullGornEvis',
        text: 'Applies to Gorn Eviscerator'
    },
    280: {
        name: 'CondSelfHullNseaProtector',
        text: 'Applies to NSEA Protector'
    },
    300: {
        name: 'CondSelfAtWaveDefenseChallenge',
        text: 'Applies when your ship is in a Wave Defense'
    },
    69001: {
        name: 'CondEnemyInvadingEntity',
        text: 'Applies when you\'re fighting an Invading Entity'
    },
    69003: {
        name: 'CondEnemyArmadaOrInvadingEntity',
        text: 'Applies when you\'re fighting an Armada target or Invading Entity'
    },
    71001: {
        name: 'CondSelfHullVindicator',
        text: 'Applies to The Vindicator'
    },
    71900: {
        name: 'CondSelfAtArenaInstance',
        text: 'Applies while in Arena'
    },
    720010: {
        name: 'CondEnemyArmadaOrHostile',
        text: 'Applies when you\'re fighting Hostiles or Armadas'
    },
    73002: {
        name: 'CondSelfHullRevenant',
        text: 'Applies to SS Revenant'
    },
    74005: {
        name: 'CondEnemyNonArmadaHostile',
        text: 'Applies when you\'re fighting Non-Armada Hostiles'
    },
    75003: {
        name: 'CondSelfHullRelativity',
        text: 'Applies to USS Relativity'
    },
    77001: {
        name: 'CondSelfHullJunker',
        text: 'Applies to GS-31'
    }
});

export const BuffCondition = Object.freeze(
    Object.fromEntries([...Object.entries(BuffConditions)]
        .filter(([, v]) => v.name !== undefined)
        .map(([condition_code, {
            name
        }]) => [name, Number(condition_code)]))
);

export const BuffOperations = Object.freeze({
    0: {
        name: 'Set',
        label: 'Set Value',
        title: 'Absolute Value',
        description: 'The target value will be set to the specified bonus value. [buffedValue = bonus]'
    },
    1: {
        name: 'Add',
        label: 'Additive',
        title: 'Additive Bonus',
        description: 'This bonus is added to the target base value'
    },
    2: {
        name: 'Sub',
        label: 'Subtractive',
        title: 'Subtractive Bonus (Reduction)',
        description: 'This bonus is subtracted from the target base value'
    },
    3: {
        name: 'MultiplyAdd',
        label: 'Multiplicative Bonus',
        title: 'Multiplicative Bonus',
        description: 'The target value will be multiplied with this bonus. [buffedValue = base * (1 + bonus)]'
    },
    4: {
        name: 'MultiplySub',
        label: 'Multiplicative Reduction',
        title: 'Multiplicative Reduction',
        description: 'The target value will be divided by this bonus. [buffedValue = base / (1 + bonus)]'
    },
    5: {
        name: 'MultiplyBaseAdd',
        label: 'Multiplicative Bonus (based on Officer Statistic)',
        title: 'Multiplicative Bonus (based on Officer Statistic)',
        description: 'The target value will be multiplied with this bonus. [buffedValue = base * ((1 + bonus) * stat)]'
    },
    6: {
        name: 'MultiplyBaseSub',
        label: 'Multiplicative Reduction (based on Officer Statistic)',
        title: 'Multiplicative Reduction (based on Officer Statistic)',
        description: 'The target value will be divided by this bonus. [buffedValue = base / ((1 + bonus) * stat)]'
    },
    7: {
        name: 'ScalarAdd',
        label: 'Additive Bonus (after other modifiers)',
        title: 'True Bonus',
        description: 'This bonus increases the target value after all other research and bonuses have been applied (true modifier)'
    },
    8: {
        name: 'ScalarSub',
        label: 'Reduction (after other modifiers)',
        title: 'True Reduction',
        description: 'The target value will be reduced after all other research and bonuses have been applied (true modifier)'
    }
});

export const BuffOperation = Object.freeze(
    Object.fromEntries([...Object.entries(BuffOperations)].map(([op_code, {
        name
    }]) => [name, Number(op_code)]))
);

export const BuffTarget = Object.freeze({
    0: 'Officer',
    1: 'Ship',
    2: 'All Ships',
    3: 'Captain',
    4: 'Bridge Officers',
    5: 'Officers',
    6: 'Enemy Ship',
    7: 'Enemy Captain',
    8: 'Enemy Bridge Officers',
    9: 'Enemy Officers',
    10: 'All Enemy Ships',
    11: 'Below Deck Officers',
    104: 'Station',
    105: 'Q\'s Trials',
    201: 'Own Ships in System',
    202: 'Alliance Ships in System',
    203: 'Enemy Ship',
    204: 'System'
});

export const BuffTrigger = Object.freeze({
    0: 'Target defeated',
    1: 'Own ship defeated',
    2: 'Target\'s shields depleted',
    3: 'Shields depleted',
    6: 'Hull Damage taken',
    7: 'Shield Damage taken',
    10: 'Enemy takes hit',
    13: 'Hit taken',
    14: 'Target hull health below threshold',
    15: 'Hull health below threshold',
    16: 'Critical shot fired',
    17: 'Critical shot taken',
    18: 'Round Start',
    19: 'Round End',
    20: 'Battle won',
    21: 'Battle lost',
    22: 'Mission completed',
    23: 'Mining completed',
    24: 'Ship launched',
    25: 'Combat Start',
    26: 'Ship recalled',
    118: 'Passive (always active)'
});

export const BuffEffect = Object.freeze({
    '-1000': {
        category: undefined,
        type: undefined,
        label: undefined,
        name: 'ModNone'
    },
    '-18': {
        category: undefined,
        type: undefined,
        label: undefined,
        name: 'FleetForbiddenTechRating'
    },
    '-17': {
        category: undefined,
        type: undefined,
        label: undefined,
        name: 'FleetOfficerBonusHealth'
    },
    '-16': {
        category: undefined,
        type: undefined,
        label: undefined,
        name: 'FleetOfficerBonusDefense'
    },
    '-15': {
        category: undefined,
        type: undefined,
        label: undefined,
        name: 'FleetOfficerBonusAttack'
    },
    '-14': {
        category: undefined,
        type: undefined,
        label: undefined,
        name: 'FleetStrength'
    },
    '-13': {
        category: undefined,
        type: undefined,
        label: undefined,
        name: 'FleetOfficerRating'
    },
    '-12': {
        category: undefined,
        type: undefined,
        label: undefined,
        name: 'FleetSensorRating'
    },
    '-11': {
        category: undefined,
        type: undefined,
        label: undefined,
        name: 'FleetDeflectorRating'
    },
    '-10': {
        category: undefined,
        type: undefined,
        label: undefined,
        name: 'FleetHealthRating'
    },
    '-9': {
        category: undefined,
        type: undefined,
        label: undefined,
        name: 'FleetDefenseRating'
    },
    '-8': {
        category: undefined,
        type: undefined,
        label: undefined,
        name: 'FleetOffenseRating'
    },
    '-7': {
        category: undefined,
        type: undefined,
        label: undefined,
        name: 'FleetGrade'
    },
    '-6': {
        category: undefined,
        type: undefined,
        label: undefined,
        name: 'ShipShieldDamage'
    },
    '-5': {
        category: undefined,
        type: undefined,
        label: undefined,
        name: 'ShipHullDamage'
    },
    '-4': {
        category: undefined,
        type: undefined,
        label: undefined,
        name: 'FleetMiningBonus'
    },
    '-3': {
        category: undefined,
        type: undefined,
        label: undefined,
        name: 'ShipPlating'
    },
    '-2': {
        category: undefined,
        type: undefined,
        label: undefined,
        name: 'ShipAbsorption'
    },
    '-1': {
        category: undefined,
        type: undefined,
        label: undefined,
        name: 'ShipDamagePerRound'
    },
    0: {
        category: 'Combat',
        type: 'Weapon Damage',
        label: 'Energy Weapon Damage',
        name: 'ModEnergyDamage'
    },
    1: {
        category: 'Combat',
        type: 'Weapon Damage',
        label: 'Kinetic Weapon Damage',
        name: 'ModKineticDamage'
    },
    2: {
        category: 'Combat',
        type: 'Weapon Damage',
        label: 'Weapon Damage',
        name: 'ModAllDamage'
    },
    3: {
        category: 'Combat',
        type: 'Weapon Shots',
        label: undefined,
        name: 'ModShotsPerAttack'
    },
    4: {
        category: 'Combat',
        type: 'Weapon Charge',
        label: undefined,
        name: 'ModAllLoadSpeed'
    },
    5: {
        category: 'Combat',
        type: 'Weapon Recharge',
        label: undefined,
        name: 'ModAllReloadSpeed'
    },
    6: {
        category: 'Combat',
        type: 'Penetration',
        label: 'Accuracy',
        name: 'ModAccuracy'
    },
    7: {
        category: 'Combat',
        type: 'Penetration',
        label: 'Armor Piercing',
        name: 'ModArmorPiercing'
    },
    8: {
        category: 'Combat',
        type: 'Penetration',
        label: 'Shield Piercing',
        name: 'ModShieldPiercing'
    },
    9: {
        category: 'Combat',
        type: 'Critical Chance',
        label: 'Critical Chance',
        name: 'ModCritChance'
    },
    10: {
        category: 'Combat',
        type: 'Critical Damage',
        label: 'Critical Damage',
        name: 'ModCritDamage'
    },
    11: {
        category: 'Combat',
        type: 'Standard Mitigation',
        label: 'Dodge',
        name: 'ModShipDodge'
    },
    12: {
        category: 'Combat',
        type: 'Standard Mitigation',
        label: 'Armor',
        name: 'ModShipArmor'
    },
    13: {
        category: 'Combat',
        type: 'Standard Mitigation',
        label: 'Shield Deflection',
        name: 'ModShields'
    },
    14: {
        category: 'Combat',
        type: 'Ability Effectiveness',
        label: 'Captain Maneuver Effectiveness',
        name: 'ModCptManeuverEffect'
    },
    15: {
        category: undefined,
        type: 'Ability Effectiveness',
        label: 'Officer Ability Effectiveness',
        name: 'ModOffAbilityEffect'
    },
    16: {
        category: 'Combat',
        type: 'Shield Repair',
        label: 'Shield Repair',
        name: 'ModShieldHpRepair'
    },
    17: {
        category: undefined,
        type: undefined,
        label: undefined,
        name: 'ModHullHpRepair'
    },
    18: {
        category: 'Combat',
        type: 'Status Effect',
        label: 'Apply State',
        name: 'ModAddState'
    },
    19: {
        category: 'Combat',
        type: 'Status Effect',
        label: 'Remove State',
        name: 'ModRemoveState'
    },
    20: {
        category: undefined,
        type: undefined,
        label: undefined,
        name: 'ModParsteelProtection'
    },
    21: {
        category: undefined,
        type: undefined,
        label: undefined,
        name: 'ModTritaniumProtection'
    },
    22: {
        category: undefined,
        type: undefined,
        label: undefined,
        name: 'ModDilithiumProtection'
    },
    23: {
        category: 'Utility',
        type: 'Hostile Loot',
        label: 'Parsteel Rewards',
        name: 'ModCombatParsteelReward'
    },
    24: {
        category: 'Utility',
        type: 'Hostile Loot',
        label: 'Tritanium Rewards',
        name: 'ModCombatTritaniumReward'
    },
    25: {
        category: 'Utility',
        type: 'Hostile Loot',
        label: 'Dilithium Rewards',
        name: 'ModCombatDilithiumReward'
    },
    26: {
        category: undefined,
        type: undefined,
        label: undefined,
        name: 'ModCombatIntelReward'
    },
    27: {
        category: undefined,
        type: undefined,
        label: undefined,
        name: 'ModCombatLootDropChance'
    },
    28: {
        category: undefined,
        type: undefined,
        label: undefined,
        name: 'ModCombatLootDropQuantity'
    },
    29: {
        category: 'Utility',
        type: 'XP Reward',
        label: 'XP Reward',
        name: 'ModCombatXpReward'
    },
    30: {
        category: undefined,
        type: undefined,
        label: undefined,
        name: 'ModMissionsParsteelReward'
    },
    31: {
        category: undefined,
        type: undefined,
        label: undefined,
        name: 'ModMissionsTritaniumReward'
    },
    32: {
        category: undefined,
        type: undefined,
        label: undefined,
        name: 'ModMissionsDilithiumReward'
    },
    33: {
        category: undefined,
        type: undefined,
        label: undefined,
        name: 'ModMissionsIntelReward'
    },
    34: {
        category: undefined,
        type: undefined,
        label: undefined,
        name: 'ModMissionsLootDropChance'
    },
    35: {
        category: undefined,
        type: undefined,
        label: undefined,
        name: 'ModMissionsLootDropQuantity'
    },
    36: {
        category: undefined,
        type: undefined,
        label: undefined,
        name: 'ModMissionsXPReward'
    },
    37: {
        category: 'Utility',
        type: 'Faction Reputation',
        label: 'Federation Reputation Gains/Losses',
        name: 'ModFactionPointsFederationReward'
    },
    38: {
        category: 'Utility',
        type: 'Faction Reputation',
        label: 'Klingon Reputation Gains/Losses',
        name: 'ModFactionPointsKlingonReward'
    },
    39: {
        category: 'Utility',
        type: 'Faction Reputation',
        label: 'Romulan Reputation Gains/Losses',
        name: 'ModFactionPointsRomulanReward'
    },
    40: {
        category: 'Utility',
        type: 'Faction Reputation',
        label: 'FKR Reputation Gains/Losses',
        name: 'ModFactionPointsAllReward'
    },
    41: {
        category: 'Utility',
        type: 'Mining Speed',
        label: 'Parsteel Mining',
        name: 'ModMiningRateParsteel'
    },
    42: {
        category: 'Utility',
        type: 'Mining Speed',
        label: 'Tritanium Mining',
        name: 'ModMiningRateTritanium'
    },
    43: {
        category: 'Utility',
        type: 'Mining Speed',
        label: 'Dilithium Mining',
        name: 'ModMiningRateDilithium'
    },
    44: {
        category: 'Utility',
        type: 'Mining Speed',
        label: 'Ore Mining',
        name: 'ModMiningRateOre'
    },
    45: {
        category: 'Utility',
        type: 'Mining Speed',
        label: 'Gas Mining',
        name: 'ModMiningRateHydrocarbon'
    },
    46: {
        category: undefined,
        type: undefined,
        label: undefined,
        name: 'ModMiningRewardParsteel'
    },
    47: {
        category: undefined,
        type: undefined,
        label: undefined,
        name: 'ModMiningRewardTritanium'
    },
    48: {
        category: undefined,
        type: undefined,
        label: undefined,
        name: 'ModMiningRewardDilithium'
    },
    49: {
        category: undefined,
        type: undefined,
        label: undefined,
        name: 'ModMiningRewardOre'
    },
    50: {
        category: undefined,
        type: undefined,
        label: undefined,
        name: 'ModMiningRewardHydrocarbon'
    },
    51: {
        category: undefined,
        type: undefined,
        label: undefined,
        name: 'ModRepairCostsParsteel'
    },
    52: {
        category: undefined,
        type: undefined,
        label: undefined,
        name: 'ModRepairCostsTritanium'
    },
    53: {
        category: undefined,
        type: undefined,
        label: undefined,
        name: 'ModRepairCostsDilithium'
    },
    54: {
        category: undefined,
        type: undefined,
        label: undefined,
        name: 'ModRepairCostAll'
    },
    55: {
        category: 'Economy',
        type: 'Repair Speed',
        label: undefined,
        name: 'ModRepairTime'
    },
    56: {
        category: 'Utility',
        type: 'Officer Stats',
        label: 'Attack',
        name: 'ModOfficerStatAttack'
    },
    57: {
        category: 'Utility',
        type: 'Officer Stats',
        label: 'Defense',
        name: 'ModOfficerStatDefense'
    },
    58: {
        category: 'Utility',
        type: 'Officer Stats',
        label: 'Health',
        name: 'ModOfficerStatHealth'
    },
    59: {
        category: 'Utility',
        type: 'Officer Stats',
        label: 'All Officer Stats',
        name: 'ModOfficerStatAll'
    },
    60: {
        category: 'Combat',
        type: 'Shield Health',
        label: 'Shield Health',
        name: 'ModShieldHpMax'
    },
    61: {
        category: 'Combat',
        type: 'Hull Health',
        label: 'Hull Health',
        name: 'ModHullHpMax'
    },
    62: {
        category: 'Utility',
        type: 'Impulse Speed',
        label: 'Impulse Speed',
        name: 'ModImpulseSpeed'
    },
    63: {
        category: 'Utility',
        type: 'Warp Speed',
        label: 'Warp Speed',
        name: 'ModWarpSpeed'
    },
    64: {
        category: 'Utility',
        type: 'Warp Range',
        label: 'Warp Range',
        name: 'ModWarpDistance'
    },
    65: {
        category: undefined,
        type: undefined,
        label: undefined,
        name: 'ModEnterWarpDelay'
    },
    66: {
        category: 'Utility',
        type: 'Cargo Capacity',
        label: 'Cargo Capacity',
        name: 'ModCargoCapacity'
    },
    67: {
        category: 'Utility',
        type: 'Protected Cargo',
        label: 'Protected Cargo',
        name: 'ModCargoProtection'
    },
    68: {
        category: undefined,
        type: undefined,
        label: undefined,
        name: 'ModAutoRecall'
    },
    69: {
        category: undefined,
        type: undefined,
        label: undefined,
        name: 'ModEnergyLoadSpeed'
    },
    70: {
        category: undefined,
        type: undefined,
        label: undefined,
        name: 'ModKineticLoadSpeed'
    },
    71: {
        category: undefined,
        type: undefined,
        label: undefined,
        name: 'ModEnergyReloadSpeed'
    },
    72: {
        category: undefined,
        type: undefined,
        label: undefined,
        name: 'ModKineticReloadSpeed'
    },
    73: {
        category: 'Combat',
        type: 'Mitigation',
        label: 'Mitigation',
        name: 'ModAllDefenses'
    },
    74: {
        category: 'Combat',
        type: 'Penetration',
        label: 'Penetration',
        name: 'ModAllPiercing'
    },
    75: {
        category: 'Combat',
        type: 'Shield Regeneration',
        label: 'Shield Regeneration',
        name: 'ModShieldRegenTime'
    },
    76: {
        category: 'Combat',
        type: 'Shield Mitigation',
        label: 'Shield Mitigation',
        name: 'ModShieldMitigation'
    },
    77: {
        category: 'Ship Ability',
        type: 'Special Ability',
        label: 'Combat Scavenger',
        name: undefined,
    },
    79: {
        category: 'Combat',
        type: 'Repair Cost',
        label: 'Repair Cost (after bonuses)',
        name: 'ModRepairCostsPost'
    },
    80: {
        category: 'Utility',
        type: 'Faction Reputation',
        label: 'Federation Reputation Gains',
        name: undefined
    },
    81: {
        category: 'Utility',
        type: 'Faction Reputation',
        label: 'Klingon Reputation Gains',
        name: undefined
    },
    82: {
        category: 'Utility',
        type: 'Faction Reputation',
        label: 'Romulan Reputation Gains',
        name: undefined
    },
    83: {
        category: 'Utility',
        type: 'Faction Reputation',
        label: 'Faction Reputation Gains',
        name: undefined
    },
    84: {
        category: 'Utility',
        type: 'Faction Reputation',
        label: 'Federation Reputation Losses',
        name: undefined
    },
    85: {
        category: 'Utility',
        type: 'Faction Reputation',
        label: 'Klingon Reputation Losses',
        name: undefined
    },
    86: {
        category: 'Utility',
        type: 'Faction Reputation',
        label: 'Romulan Reputation Losses',
        name: undefined
    },
    87: {
        category: 'Utility',
        type: 'Faction Reputation',
        label: 'Faction Reputation Losses',
        name: undefined
    },
    88: {
        category: 'Utility',
        type: 'Alliance Reputation',
        label: 'Alliance Reputation Gains',
        name: undefined
    },
    100: {
        category: undefined,
        type: undefined,
        label: undefined,
        name: 'ModResourceProtection'
    },
    101: {
        category: undefined,
        type: undefined,
        label: undefined,
        name: 'ModCombatResourceReward'
    },
    102: {
        category: undefined,
        type: undefined,
        label: undefined,
        name: 'ModMissionResourceReward'
    },
    103: {
        category: 'Utility',
        type: 'Faction Reputation',
        label: 'Faction Reputation Gains',
        name: 'ModFactionPointsRewards'
    },
    104: {
        category: 'Utility',
        type: 'Faction Reputation',
        label: 'Faction Reputation Losses',
        name: 'ModFactionPointsLosses'
    },
    105: {
        category: 'Utility',
        type: 'Mining Speed',
        label: 'Mining Speed',
        name: 'ModMiningRate'
    },
    106: {
        category: 'Utility',
        type: 'Mining Bonus',
        label: 'Mining Bonus',
        name: 'ModMiningReward'
    },
    107: {
        category: 'Economy',
        type: 'Repair Cost',
        label: 'Repair Cost',
        name: 'ModRepairCosts'
    },
    108: {
        category: 'Economy',
        type: 'Construction Speed',
        label: 'Construction Speed',
        name: 'ModStarbaseModuleConstructionSpeed'
    },
    109: {
        category: 'Economy',
        type: 'Building Cost',
        label: 'Building Cost',
        name: 'ModStarbaseModuleConstructionCost'
    },
    110: {
        category: 'Economy',
        type: 'Research Speed',
        label: 'Research Speed',
        name: 'ModResearchSpeed'
    },
    111: {
        category: 'Economy',
        type: 'Research Cost',
        label: 'Research Cost',
        name: 'ModResearchCost'
    },
    112: {
        category: 'Economy',
        type: 'Resource Production',
        label: 'Production Speed',
        name: 'ModResourceGeneration'
    },
    113: {
        category: undefined,
        type: undefined,
        label: undefined,
        name: 'ModResourceStorage'
    },
    114: {
        category: undefined,
        type: undefined,
        label: undefined,
        name: 'ModForceFieldRechargeSpeed'
    },
    115: {
        category: undefined,
        type: undefined,
        label: undefined,
        name: 'ModForcefieldHp'
    },
    116: {
        category: 'Economy',
        type: 'Ship Upgrades',
        label: 'Ship Component Cost',
        name: 'ModComponentCost'
    },
    117: {
        category: 'Economy',
        type: 'Ship Upgrades',
        label: 'Ship Construction Time',
        name: 'ModShipConstructionSpeed'
    },
    118: {
        category: 'Economy',
        type: 'Ship Upgrades',
        label: 'Ship Construction Cost',
        name: 'ModShipConstructionCost'
    },
    119: {
        category: 'Economy',
        type: 'Ship Upgrades',
        label: 'Tier-Up Speed',
        name: 'ModTierUpSpeed'
    },
    120: {
        category: undefined,
        type: undefined,
        label: undefined,
        name: 'ModFactionPointsPenaltyReduction'
    },
    121: {
        category: undefined,
        type: undefined,
        label: undefined,
        name: 'ModFactionStoreLootBonus'
    },
    122: {
        category: undefined,
        type: undefined,
        label: undefined,
        name: 'ModOfficerLevelUpCost'
    },
    123: {
        category: undefined,
        type: undefined,
        label: undefined,
        name: 'ModOfficerPromoteCost'
    },
    124: {
        category: undefined,
        type: undefined,
        label: undefined,
        name: 'ModScanShip'
    },
    125: {
        category: undefined,
        type: undefined,
        label: undefined,
        name: 'ModScanStation'
    },
    126: {
        category: undefined,
        type: undefined,
        label: undefined,
        name: 'ModScanSystem'
    },
    127: {
        category: undefined,
        type: undefined,
        label: undefined,
        name: 'ModIncomingStationAttackInformation'
    },
    128: {
        category: undefined,
        type: undefined,
        label: undefined,
        name: 'ModIncomingStationAttackAdvancedWarning'
    },
    129: {
        category: undefined,
        type: undefined,
        label: undefined,
        name: 'ModShipScrapResourceBonus'
    },
    130: {
        category: undefined,
        type: undefined,
        label: undefined,
        name: 'ModShipScrapLootBonus'
    },
    131: {
        category: 'Economy',
        type: 'Scrapping Speed',
        label: 'Scrapping Speed',
        name: 'ModShipScrapSpeed'
    },
    132: {
        category: undefined,
        type: undefined,
        label: undefined,
        name: 'ModAwayMissionSpeed'
    },
    133: {
        category: undefined,
        type: undefined,
        label: undefined,
        name: 'ModAwayMissionResourceRewards'
    },
    134: {
        category: undefined,
        type: undefined,
        label: undefined,
        name: 'ModAwayMissionLootBonus'
    },
    135: {
        category: 'Economy',
        type: 'Resource Production',
        label: 'Production Capacity',
        name: 'ModResourceProducerResourceStorage'
    },
    136: {
        category: 'Economy',
        type: 'Resource Storage',
        label: 'Warehouse Capacity',
        name: 'ModWarehouseResourceStorage'
    },
    137: {
        category: 'Economy',
        type: 'Resource Storage',
        label: 'Vault Capacity',
        name: 'ModVaultResourceStorage'
    },
    138: {
        category: undefined,
        type: undefined,
        label: undefined,
        name: 'ModHullID'
    },
    139: {
        category: undefined,
        type: undefined,
        label: undefined,
        name: 'ModShipInventorySize'
    },
    140: {
        category: undefined,
        type: undefined,
        label: undefined,
        name: 'ModScanCost'
    },
    141: {
        category: undefined,
        type: undefined,
        label: undefined,
        name: 'ModTradeTax'
    },
    142: {
        category: undefined,
        type: undefined,
        label: undefined,
        name: 'ModRepairStation'
    },
    143: {
        category: undefined,
        type: undefined,
        label: undefined,
        name: 'ModArmadaSize'
    },
    145: {
        category: 'Utility',
        type: 'Hostile Loot',
        label: 'Hostile Loot',
        name: 'ModCombatPveRewards'
    },
    146: {
        category: 'Utility',
        type: 'Hostile Loot',
        label: 'Eclipse Loot',
        name: 'ModCombatOutlawsRewards'
    },
    147: {
        category: 'Utility',
        type: 'Travel Cost',
        label: 'Cultivated Mycelium Efficiency',
        name: 'ModJumpAndTowCostEff'
    },
    148: {
        category: 'Utility',
        type: 'Hostile Loot',
        label: 'Nanoprobe Loot',
        name: 'ModCombatBorgRewards'
    },
    149: {
        category: 'Utility',
        type: 'Armada Loot',
        label: 'Armada Loot',
        name: 'ModCombatArmadaRewards'
    },
    150: {
        category: 'Combat',
        type: 'Cloaking',
        label: 'Cloaking Cooldown',
        name: 'ModSkillCloakingCooldown'
    },
    151: {
        category: 'Combat',
        type: 'Cloaking',
        label: 'Cloaking Duration',
        name: 'ModSkillCloakingDuration'
    },
    152: {
        category: 'Combat',
        type: 'Cloaking',
        label: 'Cloaking Cost',
        name: 'ModSkillCloakingCost'
    },
    153: {
        category: 'Combat',
        type: 'Cloaking',
        label: 'Cloaking Hide Chance',
        name: 'ModSkillCloakingSneakChance'
    },
    154: {
        category: 'Combat',
        type: 'Cloaking',
        label: 'Cloaking Reveal Chance',
        name: 'ModSkillCloakingRevealChance'
    },
    155: {
        category: 'Combat',
        type: 'Cloaking',
        label: 'Cloaking Cooldown Reset',
        name: 'ModSkillcloakingresetcloakingcooldown'
    },
    156: {
        category: 'Utility',
        type: 'Hostile Loot',
        label: 'Plundered Cargo Loot',
        name: 'ModCombatPlunderedCargoRewards'
    },
    157: {
        category: 'Ship Ability',
        type: 'Special Ability',
        label: 'Cerritos Support Cooldown',
        name: 'ModSkillSupportShipAbilityCooldown'
    },
    158: {
        category: undefined,
        type: undefined,
        label: undefined,
        name: 'ModSkillSupportShipAbilityDuration'
    },
    159: {
        category: undefined,
        type: undefined,
        label: undefined,
        name: 'ModSkillSupportShipAbilityCost'
    },
    160: {
        category: undefined,
        type: undefined,
        label: undefined,
        name: 'ModSkillSupportShipAbilityDurationPercentage'
    },
    161: {
        category: 'Utility',
        type: 'Hostile Loot',
        label: 'Actian Venom Loot',
        name: 'ModCombatActianVenomRewards'
    },
    162: {
        category: undefined,
        type: undefined,
        label: undefined,
        name: 'ModSkillDebuffDuration'
    },
    163: {
        category: undefined,
        type: undefined,
        label: undefined,
        name: 'ModSkillDebuffCost'
    },
    164: {
        category: undefined,
        type: undefined,
        label: undefined,
        name: 'ModSkillDebuffDurationPercentage'
    },
    165: {
        category: undefined,
        type: undefined,
        label: undefined,
        name: 'ModDepositoryStorage'
    },
    166: {
        category: undefined,
        type: undefined,
        label: undefined,
        name: 'ModRelocationRange'
    },
    167: {
        category: undefined,
        type: undefined,
        label: undefined,
        name: 'ModAntiCloaking'
    },
    170: {
        category: 'Utility',
        type: 'Armada Loot',
        label: 'Uncommon Armada Credits Loot',
        name: 'ModCombatUncommonArmadaRewards'
    },
    171: {
        category: 'Utility',
        type: 'Armada Loot',
        label: 'Rare Armada Credits Loot',
        name: 'ModCombatRareArmadaRewards'
    },
    172: {
        category: 'Utility',
        type: 'Armada Loot',
        label: 'Epic Armada Credits Loot',
        name: 'ModCombatEpicArmadaRewards'
    },
    173: {
        category: 'Utility',
        type: 'Armada Loot',
        label: 'Uncommon Exchange Loot',
        name: 'ModCombatUncommonOutlawArmadaRewards'
    },
    174: {
        category: 'Utility',
        type: 'Armada Loot',
        label: 'Rare Exchange Loot',
        name: 'ModCombatRareOutlawArmadaRewards'
    },
    175: {
        category: 'Utility',
        type: 'Armada Loot',
        label: 'Epic Exchange Loot',
        name: 'ModCombatEpicOutlawArmadaRewards'
    },
    176: {
        category: 'Utility',
        type: 'Armada Loot',
        label: 'Cardassian Armada Loot',
        name: 'ModCombatSourceArmadaRewards'
    },
    177: {
        category: 'Utility',
        type: 'Hostile Loot',
        label: 'Dominion Loot',
        name: 'ModCombatJemhadarRewards'
    },
    178: {
        category: 'Utility',
        type: 'Armada Loot',
        label: 'Dominion Solo Armada Credits Loot',
        name: 'ModCombatSourceSoloArmadaRewards'
    },
    179: {
        category: 'Utility',
        type: 'Armada Loot',
        label: 'Dominion Solo Armada Edicts Loot',
        name: 'ModPreCombatSoloArmadaEliteCreditRewards'
    },
    201: {
        category: undefined,
        type: undefined,
        label: undefined,
        name: 'ModSkillArmadaSupportAbilityCooldown'
    },
    202: {
        category: undefined,
        type: undefined,
        label: undefined,
        name: 'ModSkillArmadaSupportDuration'
    },
    203: {
        category: 'Ship Ability',
        type: 'Special Ability',
        label: 'Defiant Armada Reinforce Cost',
        name: 'ModSkillArmadaSupportCost'
    },
    204: {
        category: undefined,
        type: undefined,
        label: undefined,
        name: 'ModSkillArmadaSupportDurationPercentage'
    },
    205: {
        category: 'Utility',
        type: 'Hostile Loot',
        label: 'Actian Venom & Inert Nanoprobe Loot',
        name: 'ModCombatOfficerPakledRewards'
    },
    206: {
        category: 'Utility',
        type: 'Armada Loot',
        label: 'Borg Solo Armada Credits Loot',
        name: 'ModPreCombatSoloArmadaBorgRewards'
    },
    207: {
        category: 'Utility',
        type: 'Armada Loot',
        label: 'Borg Expansion Cube Armada Loot',
        name: 'ModCombatBorgVinculumFragmentsRewards'
    },
    209: {
        category: 'Utility',
        type: 'Hostile Loot',
        label: 'Broken Ship Parts Loot',
        name: 'ModCombatG4G5AllShipPartsRewards'
    },
    211: {
        category: 'Utility',
        type: 'Hostile Loot',
        label: 'Broken Interceptor Parts Loot',
        name: 'ModCombatG4G5DestroyerShipPartsRewards'
    },
    212: {
        category: 'Utility',
        type: 'Hostile Loot',
        label: 'Broken Explorer Parts Loot',
        name: 'ModCombatG4G5ExplorerShipPartsRewards'
    },
    213: {
        category: 'Utility',
        type: 'Hostile Loot',
        label: 'Broken Battleship Parts Loot',
        name: 'ModCombatG4G5BattleshipShipPartsRewards'
    },
    215: {
        category: 'Utility',
        type: 'Armada Loot',
        label: 'Uncommon Formation Armada Loot',
        name: 'ModCombatArtifactGachaRewards'
    },
    217: {
        category: 'Utility',
        type: 'Armada Loot',
        label: 'Rare Formation Armada Loot',
        name: 'ModCombatComplexNanotechRewards'
    },
    218: {
        category: undefined,
        type: undefined,
        label: undefined,
        name: 'ModFcCooldownSpeed'
    },
    219: {
        category: 'Economy',
        type: 'FC Unslot Cooldown',
        label: 'FC Janeway',
        name: 'ModJanewayFcCooldownSpeed'
    },
    220: {
        category: undefined,
        type: undefined,
        label: undefined,
        name: 'ModBdAbilityEffect'
    },
    222: {
        category: 'Economy',
        type: 'Forbidden Tech',
        label: 'FT Unslot Cost',
        name: 'ModForbiddenTechUnslotCost'
    },
    223: {
        category: undefined,
        type: undefined,
        label: undefined,
        name: 'ModBypassShields'
    },
    224: {
        category: 'Utility',
        type: 'Combat Utility',
        label: 'Armada Speed-Ups',
        name: 'ModInstantArmadaUnlocked'
    },
    225: {
        category: 'Combat',
        type: 'Mending',
        label: 'Hull Repair',
        name: 'ModHullRepair'
    },
    226: {
        category: 'Ship Ability',
        type: 'Special Ability',
        label: 'Cutting Beam Charge',
        name: 'ModSkillCuttingBeamAbilityCost'
    },
    227: {
        category: 'Economy',
        type: 'Forbidden Tech',
        label: 'FT Tier-Up Cost',
        name: 'ModForbiddenTechTierUpCost'
    },
    228: {
        category: 'Economy',
        type: 'Forbidden Tech',
        label: 'FT Level-Up Cost',
        name: 'ModForbiddenTechLevelUpCost'
    },
    233: {
        category: 'Utility',
        type: 'Combat Utility',
        label: 'Simultaneous Armadas',
        name: 'ModSimultaneousArmada'
    },
    240: {
        category: undefined,
        type: undefined,
        label: undefined,
        name: 'ModSkillCuttingBeamPvEBaseDamagePercentage'
    },
    241: {
        category: undefined,
        type: undefined,
        label: undefined,
        name: 'ModSkillCuttingBeamPvPBaseDamagePercentage'
    },
    242: {
        category: 'Utility',
        type: 'Hostile Loot',
        label: 'Xindi Loot',
        name: undefined
    },
    243: {
        category: 'Combat',
        type: 'Critical Damage Floor',
        label: 'Critical Damage Floor',
        name: undefined
    },
    245: {
        category: 'Ship Ability',
        type: 'Special Ability',
        label: 'Cutting Beam PvE Damage',
        name: undefined
    },
    251: {
        category: 'Ship Ability',
        type: 'Special Ability',
        label: 'Cutting Beam Charge & Efficiency',
        name: 'ModSkillCuttingBeamAccumulateBeams'
    },
    707: {
        category: 'Combat',
        type: 'Isolytic Damage',
        label: 'Isolytic Damage',
        name: 'ModIsolyticDamage'
    },
    808: {
        category: 'Combat',
        type: 'Isolytic Mitigation',
        label: 'Isolytic Defense',
        name: 'ModIsolyticDefense'
    },
    809: {
        category: undefined,
        type: undefined,
        label: undefined,
        name: 'ModCargoGeneration'
    },
    810: {
        category: 'Utility',
        type: 'Hazard Mitigation',
        label: 'Ion Storm Resistance',
        name: 'ModHazardTypeAMitigation'
    },
    811: {
        category: 'Utility',
        type: 'Hazard Mitigation',
        label: 'Asteroid Field Resistance',
        name: 'ModHazardTypeBMitigation'
    },
    812: {
        category: 'Utility',
        type: 'Hazard Mitigation',
        label: 'Radiation Resistance',
        name: 'ModHazardTypeCMitigation'
    },
    813: {
        category: 'Utility',
        type: 'Hazard Mitigation',
        label: 'Nameless Resistance',
        name: 'ModHazardTypeDMitigation'
    },
    814: {
        category: 'Utility',
        type: 'Hazard Mitigation',
        label: 'Base Hazard Resistance',
        name: 'ModHazardBaseMitigation'
    },
    815: {
        category: 'Utility',
        type: 'Hazard Mitigation',
        label: 'Magnetic Minefield Resistance',
        name: 'ModHazardTypeEMitigation'
    },
    3000: {
        category: 'Utility',
        type: 'Combat Utility',
        label: 'Attack Queue',
        name: undefined,
    },
    60001: {
        category: undefined,
        type: undefined,
        label: undefined,
        name: 'ModCombatParsteelT2Reward'
    },
    60002: {
        category: undefined,
        type: undefined,
        label: undefined,
        name: 'ModCombatTritaniumT2Reward'
    },
    60003: {
        category: undefined,
        type: undefined,
        label: undefined,
        name: 'ModCombatDilithiumT2Reward'
    },
    65003: {
        category: 'Utility',
        type: 'Hostile Loot',
        label: 'Volatile Isomatter Loot',
        name: undefined
    },
    67001: {
        category: 'Combat',
        type: 'Apex Barrier',
        label: 'Apex Barrier',
        name: undefined
    },
    67002: {
        category: 'Utility',
        type: 'Travel Cost',
        label: 'Rift Key Cost',
        name: 'ModJumpingPointsCost'
    },
    67003: {
        category: 'Utility',
        type: 'Hostile Loot',
        label: 'Trellium Loot',
        name: 'ModTrelliumRewards'
    },
    68001: {
        category: 'Ship Ability',
        type: 'Field Repair',
        label: 'Healing Cost',
        name: 'ModSkillSelfHealingCost'
    },
    68002: {
        category: 'Ship Ability',
        type: 'Field Repair',
        label: 'Healing Cooldown',
        name: 'ModSkillSelfHealingCooldown'
    },
    68003: {
        category: 'Ship Ability',
        type: 'Field Repair',
        label: 'Healing',
        name: 'ModSkillSelfHealingIncrease'
    },
    68005: {
        category: 'Utility',
        type: 'Combat Utility',
        label: 'Wave Defense Central Entity HHP',
        name: undefined,
    },
    71001: {
        category: 'Utility',
        type: 'Hostile Loot',
        label: 'Non-Armada Hostile Loot',
        name: 'ModHostileLoot'
    },
    72001: {
        category: 'Economy',
        type: 'Chaos Tech',
        label: 'CT Unslot Cost',
        name: 'ModChaosTechUnslotCost'
    },
    72002: {
        category: 'Economy',
        type: 'Chaos Tech',
        label: 'CT Tier-Up Cost',
        name: 'ModChaosTechTierUpCost'
    },
    72003: {
        category: 'Economy',
        type: 'Chaos Tech',
        label: 'CT Level-Up Cost',
        name: 'ModChaosTechLevelUpCost'
    },
    72004: {
        category: 'Utility',
        type: 'Hostile Loot',
        label: 'Neural Net Chip Loot',
        name: undefined
    },
    73002: {
        category: 'Utility',
        type: 'Hostile Loot',
        label: 'Chaos Module Loot',
        name: undefined
    },
    73003: {
        category: 'Utility',
        type: 'Armada Loot',
        label: 'Borg Type 03 Solo Armada Credits Loot',
        name: undefined
    },
    74003: {
        category: 'Utility',
        type: 'Armada Loot',
        label: 'Krenim Invading Entity Loot',
        name: undefined
    },
    75003: {
        category: 'Utility',
        type: 'Armada Loot',
        label: 'Krenim Formation Armada Loot',
        name: undefined
    },
    76001: {
        category: 'Combat',
        type: 'Apex Shred',
        label: 'Apex Shred',
        name: undefined
    },
    77002: {
        category: 'Ship Ability',
        type: 'Special Ability',
        label: 'Gravitational Blast Damage',
        name: undefined,
    },
    77005: {
        category: 'Ship Ability',
        type: 'Special Ability',
        label: 'Gravitational Blast Targets (Non-Armada Hostiles)',
        name: undefined,
    },
    78001: {
        category: 'Economy',
        type: 'Officer Shard Cost',
        label: 'DS9 Crew CE',
        name: undefined,
    },
    78002: {
        category: 'Economy',
        type: 'Officer Shard Cost',
        label: 'TNG Crew CE',
        name: undefined,
    },
    78003: {
        category: 'Economy',
        type: 'Officer Shard Cost',
        label: 'Ferengi Crew CE',
        name: undefined,
    },
    78004: {
        category: 'Economy',
        type: 'Officer Shard Cost',
        label: 'Borg Crew CE',
        name: undefined,
    },
    78005: {
        category: 'Economy',
        type: 'Officer Shard Cost',
        label: 'Lower Decks Crew CE',
        name: undefined,
    },
    78006: {
        category: 'Economy',
        type: 'Officer Shard Cost',
        label: 'PvP Strike Team Crew CE',
        name: undefined,
    },
    78007: {
        category: 'Economy',
        type: 'Officer Shard Cost',
        label: 'SNW Crew CE',
        name: undefined,
    },
    78008: {
        category: 'Economy',
        type: 'Officer Shard Cost',
        label: 'VOY Crew CE',
        name: undefined,
    },
    78009: {
        category: 'Economy',
        type: 'Officer Shard Cost',
        label: 'Enterprise-E Crew CE',
        name: undefined,
    },
    78010: {
        category: 'Utility',
        type: 'Hostile Loot',
        label: 'Augment Exiles Loot',
        name: undefined
    },
    78015: {
        category: 'Utility',
        type: 'Hostile Loot',
        label: 'Augment Exiles Reputation',
        name: undefined
    },
    690010: {
        category: 'Ship Ability',
        type: 'Special Ability',
        label: 'Omega-13',
        name: undefined,
    },
    findByName(name) {
        const result = [...Object.entries(this)].find(([, data]) => data.name ?.toLowerCase() === name.toLowerCase());
        if (result !== undefined) {
            return {
                modifier_code: Number(result[0]),
                ...result[1]
            };
        }
    }
});

export const BuffModifier = Object.freeze(
    Object.fromEntries([...Object.entries(BuffEffect)]
        .filter(([, v]) => v.name !== undefined)
        .map(([modifier_code, {
            name
        }]) => [name, Number(modifier_code)]))
);

export class Buff {
    static API_ENDPOINTS = {
        starbase: {
            data: `${API_BASE_URL}/building`,
            translations: `${API_BASE_URL}/translations/en/buildings`,
            translationKey: 'starbase_module'
        },
        research: {
            data: `${API_BASE_URL}/research`,
            translations: `${API_BASE_URL}/translations/en/researches`,
            translationKey: 'research_project_name'
        },
        consumables: {
            data: `${API_BASE_URL}/consumable`,
            translations: `${API_BASE_URL}/translations/en/consumables`,
            translationKey: 'consumable_name'
        },
        officerabilities: {
            data: `${API_BASE_URL}/officer`,
            translations: `${API_BASE_URL}/translations/en/officers`,
            translationKey: 'officer_ability_name'
        },
        forbiddentech: {
            data: `${API_BASE_URL}/forbiddentech`,
            translations: `${API_BASE_URL}/translations/en/forbidden_tech`,
            translationKey: 'forbidden_tech_name'
        },
    };

    static #specs = {};
    static #sources = {};
    static #translations = {};
    static #locks = {};

    static async #loadSpecs(sources) {
        const missingSpecs = (new Set(sources)).difference(new Set(Object.keys(this.#specs)));
        let promises = [];

        for (const source of missingSpecs) {
            if (this.#locks[source] === undefined) {
                this.#locks[source] = Promise.withResolvers();

                promises.push(
                    $.getJSON(`${API_BASE_URL}/v1/buffspecs/${source}`)
                    .then(response => {
                        this.#specs[source] = response;
                        this.#locks[source].resolve();
                    }).catch(error => this.#locks[source].reject(error))
                );
            } else {
                promises.push(this.#locks[source].promise);
            }
        }

        await Promise.all(promises);
    }

    static async# loadSources(sources) {
        const missingSources = (new Set(sources)).difference(new Set(Object.keys(this.#sources)));
        let promises = [];

        for (const source of missingSources) {
            const key = `${source}_src`;
            const endpoint = this.API_ENDPOINTS[source];
            if (endpoint === undefined) {
                continue;
            }

            if (this.#locks[key] === undefined) {
                this.#locks[key] = Promise.withResolvers();

                promises.push(
                    Promise.all([$.getJSON(endpoint.data), $.getJSON(endpoint.translations)]).then(([data, translations]) => {
                        this.#sources[source] = data;
                        this.#translations[source] = translations;
                        this.#locks[key].resolve();
                    }).catch(error => this.#locks[key].reject(error))
                );
            } else {
                promises.push(this.#locks[key].promise);
            }
        }

        await Promise.all(promises);
    }

    static async getSpecs(source) {
        if (this.#specs[source] === undefined) {
            await this.#loadSpecs(source);
        }

        return this.#specs[source];
    }

    static async findByModifierCode(modifier, sources = ['starbase', 'research', 'consumables', 'forbiddentech']) {
        await this.#loadSpecs(sources);
        let buffs = Object.fromEntries(sources.map(s => [s, []]));

        for (const source of sources) {
            const specs = this.#specs[source] ?.filter(({
                modifier_code
            }) => modifier_code === modifier);
            if (specs.length === 0) {
                continue;
            }

            const buffSources = new Map();
            const sourceIds = specs.map(({
                source_id
            }) => source_id).filter(id => id !== null);

            if (sourceIds.length > 0) {
                await this.#loadSources([source]);
                this.#sources[source] ?.filter(({
                    id
                }) => sourceIds.includes(id)).forEach(s => buffSources.set(s.id, s));
            }

            for (const buffSpec of specs) {
                let type;
                switch (source) {
                    case 'starbase':
                        type = 'building';
                        break;
                    case 'consumables':
                        type = 'consumable';
                        break;
                    default:
                        type = source;
                        break;
                }

                buffs[source].push({
                    source_data: { ...buffSources.get(buffSpec.source_id),
                        type: type,
                        name: this.#translations[source] ?.find(({
                            id,
                            key
                        }) => Number(id) === buffSpec.source_id && key.startsWith(this.API_ENDPOINTS[source].translationKey)) ?.text
                    },
                    ...buffSpec
                });
            }
        }

        return buffs;
    }
}

/**
 * This callback is displayed as a global member.
 *
 * @callback buffCheckCallback
 * @param {BuffContext} context
 * @param {Buff} buff
 * @param {Set.<number>} uncheckedConditions
 * @returns {boolean}
 */

/**
 * Represents the context in which a buff is applied, including modifiers, conditions, and resources.
 */
export class BuffContext {
    /** @type {number} */
    modifier;

    /** @type {Set.<number>} */
    conditions;

    /** @type {Set.<number>} */
    resources;

    /** @type {buffCheckCallback[]} */
    exceptions;

    /**
     * Initializes a new instance of the class with the specified modifier, conditions, resources, and exceptions.
     *
     * @param {number} modifier
     * @param {Iterable.<number>} conditions
     * @param {Iterable.<number>} resources
     * @param {Iterable.<buffCheckCallback>} exceptions
     *
     */
    constructor(modifier, conditions = [], resources = [], exceptions = []) {
        this.modifier = modifier;
        this.conditions = new Set(conditions);
        this.resources = new Set(resources);
        this.exceptions = [...exceptions];
    }

    /**
     * Checks whether a buff applies given the current context
     *
     * @param {Buff} buff
     * @return {boolean}
     */
    applies(buff) {
        if (this.modifier === buff.modifier_code) {
            /** @type {Set.<number>} */
            let uncheckedConditions = (new Set(buff.condition_codes)).difference(this.conditions);

            if (uncheckedConditions.has(BuffCondition.CondResourceId)) {
                if (this.resources.intersection(new Set(buff.attributes.resources)).size > 0) {
                    uncheckedConditions.delete(BuffCondition.CondResourceId);
                }
            }

            if (uncheckedConditions.size > 0) {
                for (const callback of this.exceptions) {
                    if (callback.apply(globalThis, [this, buff, uncheckedConditions]) === true) {
                        return true;
                    }
                }
            }

            /* const result = uncheckedConditions.size === 0;

            if (result) {
                console.debug(`Buff ${buff.buff_id_str} matches conditions`);
            } else {
                console.debug(`Discarded buff ${buff.buff_id_str} due to missing conditions: ${[...uncheckedConditions].join(',')}`);
            }

            return result; */

            return uncheckedConditions.size === 0;
        }

        return false;
    }
}
