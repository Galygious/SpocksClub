"use strict";

import {
    default as Mustache
} from 'https://cdnjs.cloudflare.com/ajax/libs/mustache.js/4.2.0/mustache.min.js';

import {
    ConsumableCategory
} from './prime/consumables.js';
import {
    getResearchTrees
} from './prime/research.js';
import {
    getScrappingOptions,
    sortShips
} from './prime/ships.js';

import {
    Buff,
    BuffEffect,
    BuffModifier
} from './prime/buffs.js';
import {
    AuctionScore,
    MAX_OPS,
    RequirementType
} from './prime/common.js';
import {
    TimeResourceIds,
    TimeResources,
    fetchResource,
    getResourceTokens,
    getResourceConversion,
    getResources,
    RESOURCE_LATINUM,
    getSpeedUps
} from './prime/resources.js';
import {
    API_BASE_URL,
    Counter,
    format_duration,
    format_number,
    stripHTML,
    toRomanNumerals
} from './common.js';
import {
    TranslationCategory,
    TranslationLoader
} from './prime/translations.js';


export class Efficiencies {
    buffs;
    modifiers = {};

    /** @type {{upgrade: Map.<number, Counter>, repair: Map.<number, Counter>}} */
    bonuses = {
        upgrade: new Map(),
        repair: new Map()
    };

    /** @type {Map.<number, WeakRef<Buff>>} */
    buffMap = new Map();

    /** @type {BuffContext[]} */
    context = [];

    /** @type {AbortController} */
    abortController;

    /**
     * Create a new Efficiency instance
     *
     * @param {...number|string} modifiers
     */
    constructor(...modifiers) {
        for (const modifier of modifiers) {
            let mod;

            if (typeof modifier === 'string') {
                mod = BuffEffect.findByName(modifier);
            } else {
                mod = BuffEffect[modifier];
            }

            if (mod !== undefined) {
                this.modifiers[mod.name] = mod.modifier_code || modifier;
            }
        }

        this.abortController = new AbortController();
    }

    /**
     * Create a new Efficiency instance with applicable
     * modifiers for requirement types
     *
     * @param {Set.<RequirementType>} requirementTypes
     * @returns {Efficiencies}
     */
    static forRequirements(requirementTypes) {
        let modifiers = [];

        for (const reqType of requirementTypes) {
            switch (reqType) {
                case RequirementType.Building:
                    modifiers.push(BuffModifier.ModStarbaseModuleConstructionCost, BuffModifier.ModStarbaseModuleConstructionSpeed);
                    break;
                case RequirementType.Research:
                    modifiers.push(BuffModifier.ModResearchCost, BuffModifier.ModResearchSpeed);
                    break;
                case RequirementType.ShipTier:
                    modifiers.push(BuffModifier.ModShipConstructionCost, BuffModifier.ModShipConstructionSpeed, BuffModifier.ModComponentCost, BuffModifier.ModTierUpSpeed);
                    break;
            }
        }

        if (modifiers.length > 0) {
            return new Efficiencies(...modifiers);
        }
    }

    static getEfficiencyTag(modifier_code) {
        switch (modifier_code) {
            case BuffModifier.ModStarbaseModuleConstructionCost:
            case BuffModifier.ModStarbaseModuleConstructionSpeed:
            case BuffModifier.ModResearchCost:
            case BuffModifier.ModResearchSpeed:
            case BuffModifier.ModShipConstructionCost:
            case BuffModifier.ModShipConstructionSpeed:
            case BuffModifier.ModComponentCost:
            case BuffModifier.ModTierUpSpeed:
            case BuffModifier.ModForbiddenTechLevelUpCost:
            case BuffModifier.ModForbiddenTechTierUpCost:
            case BuffModifier.ModChaosTechLevelUpCost:
            case BuffModifier.ModChaosTechTierUpCost:
            case BuffModifier.ModOfficerLevelUpCost:
            case BuffModifier.ModOfficerPromoteCost:
                return 'upgrade';
            case BuffModifier.ModRepairCostsParsteel:
            case BuffModifier.ModRepairCostsTritanium:
            case BuffModifier.ModRepairCostsDilithium:
            case BuffModifier.ModRepairCostAll:
            case BuffModifier.ModRepairCosts:
            case BuffModifier.ModRepairTime:
                return 'repair';
            default:
                break;
        }
    }

    static getEfficiencyIcon(modifier_code) {
        switch (modifier_code) {
            case BuffModifier.ModStarbaseModuleConstructionSpeed:
                return document.getElementById('mustache-efficiency-building-time-icon') ?.innerHTML;
            case BuffModifier.ModStarbaseModuleConstructionCost:
                return document.getElementById('mustache-efficiency-building-cost-icon') ?.innerHTML;
            case BuffModifier.ModResearchSpeed:
                return document.getElementById('mustache-efficiency-research-time-icon') ?.innerHTML;
            case BuffModifier.ModResearchCost:
                return document.getElementById('mustache-efficiency-research-cost-icon') ?.innerHTML;
            case BuffModifier.ModShipConstructionCost:
                return document.getElementById('mustache-efficiency-ship-cost-icon') ?.innerHTML;
            case BuffModifier.ModComponentCost:
                return document.getElementById('mustache-efficiency-component-cost-icon') ?.innerHTML;
            case BuffModifier.ModShipConstructionSpeed:
                return document.getElementById('mustache-efficiency-ship-time-icon') ?.innerHTML;
            case BuffModifier.ModTierUpSpeed:
                return document.getElementById('mustache-efficiency-tier-up-time-icon') ?.innerHTML;
            case BuffModifier.ModRepairCosts:
                return document.getElementById('mustache-efficiency-repair-cost-icon') ?.innerHTML;
            case BuffModifier.ModRepairTime:
                return document.getElementById('mustache-efficiency-repair-time-icon') ?.innerHTML;
            case BuffModifier.ModForbiddenTechLevelUpCost:
            case BuffModifier.ModForbiddenTechTierUpCost:
            case BuffModifier.ModChaosTechLevelUpCost:
            case BuffModifier.ModChaosTechTierUpCost:
                return document.getElementById('mustache-efficiency-ft-cost-icon') ?.innerHTML;
            default:
                return document.getElementById('mustache-efficiency-unknown-icon') ?.innerHTML;
        }
    }

    static getResourceRestrictions(buff) {
        if (buff.attributes ?.resources === undefined) {
            switch (buff.modifier_code) {
                case BuffModifier.ModStarbaseModuleConstructionSpeed:
                    return JSON.stringify(Object.values(TimeResources.building).map(({
                        id
                    }) => id));
                case BuffModifier.ModResearchSpeed:
                    return JSON.stringify(Object.values(TimeResources.research).map(({
                        id
                    }) => id));
                case BuffModifier.ModShipConstructionSpeed:
                    return JSON.stringify(Object.values(TimeResources.ship_construction).map(({
                        id
                    }) => id));
                case BuffModifier.ModTierUpSpeed:
                    return JSON.stringify(Object.values(TimeResources.ship_tier_up).map(({
                        id
                    }) => id));
                case BuffModifier.ModRepairTime:
                    return JSON.stringify(Object.values(TimeResources.ship_repair).map(({
                        id
                    }) => id));
            }
        }

        return JSON.stringify(buff.attributes ?.resources ?? []);
    }

    static generateOptions(values, maxLevel, format) {
        let options = '';

        for (let i = 0; i < maxLevel; i++) {
            options += `<option data-level="${i + 1}" value="${values[i]}">${i + 1} (${values[i].toLocaleString(undefined, format)})</option>`;
        }

        return options;
    }

    static generateCombinedOptions(buffs, maxLevel) {
        const ranked_values = buffs.map(({
            ranked_values,
            show_percentage
        }) => ranked_values.map(v => [v, v.toLocaleString(undefined, show_percentage ? {
            style: 'percent',
            maximumFractionDigits: 2
        } : undefined)]));
        let options = '';

        for (let i = 0; i < maxLevel; i++) {
            const display = ranked_values.flatMap(buff => buff[i][1]).join('&thinsp;/&thinsp;');
            options += `<option data-level="${i + 1}" value="${ranked_values[0][i][0]}">${i + 1} (${display})</option>`;
        }

        return options;
    }

    /**
     *
     * @param {Buff} buff
     * @return {string}
     */
    static generateLevelOptions(buff) {
        const tag = this.getEfficiencyTag(buff.modifier_code);
        const format = buff.show_percentage ? {
            style: 'percent',
            maximumFractionDigits: 2
        } : undefined;
        const maxLevel = Math.max(...buff.source_data.levels.map(({
            id
        }) => id));

        if (buff.source_data.tree ?.fleet_commander !== undefined) {
            const fleetCommander = buff.source_data.tree.fleet_commander;
            const skill = fleetCommander.skills.find(({
                research_id
            }) => research_id === buff.source_id);

            if (skill.type === 2 || skill.type === 3) {
                let selectable = '';

                if (skill.type === 3) {
                    // Selectable skills
                    selectable = `<div class="input-group-text bg-primary-subtle" data-bs-toggle="tooltip" data-bs-placement="right" data-bs-title="Enable selectable Skill">
                                      <input class="form-check-input btn-check fc-radio-select setting-input setting-trigger mt-0" type="radio" id="fc-skill-${fleetCommander.id}-${skill.group}-${buff.source_id}" name="fc-skill-${fleetCommander.id}-${skill.group}" autocomplete="off" data-setting-type="fleet_commander:selected" data-setting-commander="${fleetCommander.id}" data-setting-id="${buff.source_id}" data-setting-group="${skill.group}" data-setting-skill-type="${skill.type}" aria-label="Activate selectable Fleet Commander Skill" value="${buff.source_id}">
                                      <label class="fa-solid" for="fc-skill-${fleetCommander.id}-${skill.group}-${buff.source_id}"></label>
                                  </div>`;
                }

                const suffix = Array.from(window.crypto.getRandomValues(new Uint8Array(4)), n => n.toString(16).padStart(2, '0')).join('');
                return `<div class="input-group z-0">
                            <select class="form-select setting-input ${tag}-efficiency-source conditional-buff" style="border-top-right-radius: 0 !important; border-bottom-right-radius: 0 !important;" data-setting-type="${buff.source_data.type}" data-setting-id="${buff.source_id}" data-buff="${buff.buff_id}" data-modifier="${buff.modifier_code}" data-op="${buff.op}" data-resources="${this.getResourceRestrictions(buff)}" data-buff-active="0">
                                <option data-level="0" value="0">0</option>
                                ${this.generateOptions(buff.ranked_values, maxLevel, format)}
                            </select>
                            ${selectable}
                            <input type="checkbox" class="btn-check fc-checkbox-slot setting-input setting-trigger" id="fc-slotted-${suffix}" autocomplete="off" data-setting-type="fleet_commander:slotted" data-setting-id="${fleetCommander.id}">
                            <label class="btn" for="fc-slotted-${suffix}" style="border-radius: 0 5px 5px 0 !important;" data-bs-toggle="tooltip" data-bs-placement="right" data-bs-title="(Un)slot Fleet Commander"><i class="fa-solid fa-chair-office"></i></label>
                        </div>`;
            }

        } else if (buff.additional_buffs !== undefined) {
            let options;
            let hiddenOptions = '';
            const hasCondition = (buff.attributes.module_id !== undefined && buff.source_data ?.name ?.startsWith('DRYDOCK'));

            for (const additionalBuff of buff.additional_buffs) {
                hiddenOptions += `<select class="form-select setting-input ${tag}-efficiency-source buff-group ${hasCondition ? 'conditional-buff' : ''} d-none" data-setting-type="${buff.source_data.type}" data-setting-id="${buff.source_id}" data-buff="${additionalBuff.buff_id}" data-modifier="${additionalBuff.modifier_code}" data-op="${additionalBuff.op}" data-resources="${this.getResourceRestrictions(additionalBuff)}" ${hasCondition ? 'data-buff-active="0"' : ''} disabled>
                                      <option data-level="0" value="0">0</option>
                                      ${this.generateOptions(additionalBuff.ranked_values, maxLevel, additionalBuff.show_percentage ? {
                    style:                 'percent',
                    maximumFractionDigits: 2
                } : undefined)}
                                  </select>`;
            }

            if (hasCondition) {
                options = `<div class="input-group">
                               <select class="form-select setting-input ${tag}-efficiency-source conditional-buff buff-group" data-setting-type="${buff.source_data.type}" data-setting-id="${buff.source_id}" data-buff="${buff.buff_id}" data-modifier="${buff.modifier_code}" data-op="${buff.op}" data-resources="${this.getResourceRestrictions(buff)}" data-buff-active="${buff.source_id === 17 ? '1' : '0'}">
                                   <option data-level="0" value="0">0</option>
                                   ${this.generateCombinedOptions([buff, ...buff.additional_buffs], maxLevel)}
                               </select>
                               <div class="input-group-text" style="border-radius: 0 5px 5px 0 !important;">
                                   <input class="form-check-input drydock-radio-select setting-input setting-trigger mt-0" type="radio" name="drydock-radio" aria-label="Select ${buff.source_data.name}" value="${buff.source_id}" data-setting-type="drydock:selected" data-setting-id="${buff.source_id}" ${buff.source_id === 17 ? 'checked' : ''}>
                               </div>
                           </div>
                           ${hiddenOptions}`;
            } else {
                options = `<select class="form-select setting-input ${tag}-efficiency-source buff-group" data-setting-type="${buff.source_data.type}" data-setting-id="${buff.source_id}" data-buff="${buff.buff_id}" data-modifier="${buff.modifier_code}" data-op="${buff.op}" data-resources="${this.getResourceRestrictions(buff)}">
                               <option data-level="0" value="0">0</option>
                               ${this.generateCombinedOptions([buff, ...buff.additional_buffs], maxLevel)}
                           </select>
                           ${hiddenOptions}`;
            }

            return `<div class="upgrade-efficiency-group">${options}</div>`;
        }

        return `<select class="form-select setting-input ${tag}-efficiency-source z-0" data-setting-type="${buff.source_data.type}" data-setting-id="${buff.source_id}" data-buff="${buff.buff_id}" data-modifier="${buff.modifier_code}" data-op="${buff.op}" data-resources="${this.getResourceRestrictions(buff)}">
                    <option data-level="0" value="0">0</option>
                    ${this.generateOptions(buff.ranked_values, maxLevel, format)}
                </select>`;
    }

    static generateConsolidatedLevelOptions(buff, placeholder = 'Inactive') {
        const tag = this.getEfficiencyTag(buff.modifier_code);

        let consolidatedValues = [];
        let limit = buff.ranked_values.length;
        const format = buff.show_percentage ? {
            style: 'percent',
            maximumFractionDigits: 2
        } : undefined;

        switch (buff.source_data.type) {
            case 'consumable':
            case 'consumables':
            case 'exocomp':
            case 'territory_service':
            case 'syndicate':
            case 'alliance_syndicate':
                limit = MAX_OPS;
                break;
        }

        for (const group of Object.values(Object.groupBy([...buff.ranked_values.slice(0, limit).entries()], ([, v]) => v))) {
            const minLevel = Math.min(...group.map(([i]) => i)) + 1;
            const maxLevel = Math.max(...group.map(([i]) => i)) + 1;
            const expectedLength = maxLevel - minLevel + 1;

            if (group.length === expectedLength) {
                consolidatedValues.push({
                    min: minLevel,
                    max: maxLevel,
                    value: group[0][1]
                });
            } else {
                const value = group[0][1];
                const levels = group.map(([i]) => i + 1).sort((a, b) => a - b);
                let chunks = [];

                for (let i = 0; i < levels.length; i++) {
                    if (i === 0) {
                        chunks.push([levels[0]]);
                    } else if (levels[i] !== levels[i - 1] + 1) {
                        chunks.push([levels[i]]);
                    } else {
                        chunks[chunks.length - 1].push(levels[i]);
                    }
                }

                for (const chunk of chunks) {
                    consolidatedValues.push({
                        min: Math.min(...chunk),
                        max: Math.max(...chunk),
                        value: value
                    });
                }
            }
        }

        if (consolidatedValues.length === 0) {
            return;
        }

        consolidatedValues.sort(({
            min: a
        }, {
            min: b
        }) => a - b);
        const loyaltyTier = buff.source_data.type === 'syndicate' || buff.source_data.type === 'alliance_syndicate' ? `data-level="${buff.source_data.tier}"` : '';
        const territoryBuff = buff.source_data.type === 'territory_service' ? `data-service-id="${buff.source_id}"` : '';
        let settingAttrs = `data-setting-type="${buff.source_data.type}" data-setting-id="${territoryBuff !== '' ? buff.buff_id : buff.source_id}" ${territoryBuff} ${loyaltyTier} data-buff="${buff.buff_id}" data-modifier="${buff.modifier_code}" data-op="${buff.op}" data-resources="${this.getResourceRestrictions(buff)}"`;

        if (buff.source_data ?.tied_research !== undefined) {
            settingAttrs += `data-tied-research-id="${buff.source_data.tied_research.id}" data-tied-research-min-level="${buff.source_data.tied_research.min_level}"`;
        }

        if (consolidatedValues.length > 1) {
            let options = `<select class="form-select setting-input ${tag}-efficiency-source" ${settingAttrs}><option data-level="0" value="0">${placeholder}</option>`;

            for (let {
                    min,
                    max,
                    value
                } of consolidatedValues) {
                if (min === max) {
                    options += `<option data-min-level="${min}" data-max-level="${max}" value="${value}">Ops ${min} (${value.toLocaleString(undefined, format)})</option>`;
                } else {
                    options += `<option data-min-level="${min}" data-max-level="${max}" value="${value}">Ops ${min}&ndash;${max} (${value.toLocaleString(undefined, format)})</option>`;
                }
            }

            options += '</select>';
            return options;

        } else {
            const id = `checkbox-${buff.source_data.type}-${buff.buff_id}`;
            return `<input type="checkbox" class="form-check-input setting-input ${buff.source_data?.tied_research ? 'setting-trigger' : ''} ${tag}-efficiency-source me-1" id="${id}" ${settingAttrs} value="${consolidatedValues[0].value}">
                    <label class="form-check-label" for="${id}">${consolidatedValues[0].value.toLocaleString(undefined, format)}</label>`;
        }
    }

    /**
     * Destructor
     */
    destroy() {
        this.abortController.abort();
    }

    /**
     * Find all applicable efficiencies (without checking conditions)
     *
     * @returns {Promise<void>}
     */
    async load() {
        this.buffs = {};
        this.buffMap.clear();

        const syndicateBuffIds = (await $.getJSON(`${API_BASE_URL}/v1/enhancedSyndicate`)).flatMap(({
            buffs
        }) => buffs.flatMap(({
            buffId
        }) => buffId));

        const addEfficiencies = (source, modifier, buffs) => {
            if (!this.buffs.hasOwnProperty(source)) {
                this.buffs[source] = {};
            }

            this.buffs[source][modifier] = [...buffs];

            for (const buff of this.buffs[source][modifier]) {
                this.buffMap.set(buff.buff_id, new WeakRef(buff));
            }
        };

        for (const [modifier, modifierCode] of Object.entries(this.modifiers)) {
            const matches = await Buff.findByModifierCode(modifierCode);

            for (const source of Object.keys(matches)) {
                let buffs = matches[source];

                if (source === 'consumables') {
                    // WA: manually exclude certain buffs because they were misclassified by Scopely
                    const isSyndicateBuff = source_data => {
                        if (source_data === undefined || source_data.category !== ConsumableCategory.Syndicate) {
                            return false;
                        }

                        return syndicateBuffIds.includes(source_data.buff_id);
                    };

                    const syndicateBuffs = buffs.filter(({
                        source_data
                    }) => isSyndicateBuff(source_data));
                    if (syndicateBuffs.length > 0) {
                        addEfficiencies('syndicate', modifier, syndicateBuffs);
                    }

                    const allianceSyndicateBuffs = buffs.filter(({
                        source_data
                    }) => source_data ?.category === ConsumableCategory.AllianceSyndicate);
                    if (allianceSyndicateBuffs.length > 0) {
                        addEfficiencies('alliance_syndicate', modifier, allianceSyndicateBuffs);
                    }

                    const exocomps = buffs.filter(({
                        source_data
                    }) => source_data ?.requires_slot);
                    if (exocomps.length > 0) {
                        addEfficiencies('exocomp', modifier, exocomps)
                    }

                    const excludedConsumables = new Set([
                        ...syndicateBuffs.map(({
                            source_data
                        }) => source_data.id),
                        ...allianceSyndicateBuffs.map(({
                            source_data
                        }) => source_data.id),
                        ...exocomps.map(({
                            source_data
                        }) => source_data.id)
                    ]);

                    buffs = buffs.filter(({
                        source_data
                    }) => !excludedConsumables.has(source_data.id));

                } else if (source === 'research') {
                    const territoryServices = buffs.filter(({
                        buff_id_str
                    }) => buff_id_str.startsWith('Research_Service_'));

                    if (territoryServices.length > 0) {
                        addEfficiencies('territory_service', modifier, territoryServices);
                        buffs = buffs.filter(({
                            buff_id_str
                        }) => !buff_id_str.startsWith('Research_Service_'));
                    }
                }

                addEfficiencies(source, modifier, buffs);
            }
        }
    }

    /**
     * Render all cost and efficiency tables
     *
     * @param {{base_cost: Counter, base_time: Counter, net_cost?: Counter, net_time?: Counter}} cost
     * @param {...BuffContext} context
     * @returns {Promise<void>}
     */
    async displayCostAndBonuses(cost, ...context) {
        const tag = this.getTag(context);
        const {
            bonuses,
            buffIds
        } = this.prepareBonuses(...context);

        this.bonuses[tag] = bonuses;
        this.context.push(...context);

        await Promise.all([
            this.buildCostTable(tag, cost),
            this.buildEfficiencyTables(tag, buffIds),
            this.buildCumulativeEfficiencyTable(tag, bonuses, cost)
        ]);

        $('#operations-range').parents('table').toggle($('select.setting-input[data-setting-type="consumable"], select.setting-input[data-setting-type="syndicate"], select.setting-input[data-setting-type="alliance_syndicate"], select.setting-input[data-setting-type="territory_service"]').length > 0);
        $('#syndicate-range').parents('table').toggle($('select.setting-input[data-setting-type="syndicate"]').length > 0);
        $('#alliance-syndicate-range').parents('table').toggle($('select.setting-input[data-setting-type="alliance_syndicate"]').length > 0);
    }

    /**
     * Render all efficiency tables
     *
     * @param {...BuffContext} context
     * @returns {Promise<void>}
     */
    async displayBonuses(...context) {
        const tag = this.getTag(context);
        const {
            bonuses,
            buffIds
        } = this.prepareBonuses(...context);

        this.bonuses[tag] = bonuses;
        this.context.push(...context);
        await this.buildEfficiencyTables(tag, buffIds);

        $('#operations-range').parents('table').toggle($('select.setting-input[data-setting-type="consumable"], select.setting-input[data-setting-type="syndicate"], select.setting-input[data-setting-type="alliance_syndicate"], select.setting-input[data-setting-type="territory_service"]').length > 0);
        $('#syndicate-range').parents('table').toggle($('select.setting-input[data-setting-type="syndicate"]').length > 0);
        $('#alliance-syndicate-range').parents('table').toggle($('select.setting-input[data-setting-type="alliance_syndicate"]').length > 0);
    }

    /**
     *
     * @param {BuffContext[]} context
     * @return {any}
     */
    getTag(context) {
        const modifiers = context.map(({
            modifier
        }) => modifier);
        if (modifiers.length !== (new Set(modifiers)).size) {
            throw new Error('Multiple modifiers are not supported: ' + modifiers.join(', '));
        }

        const tags = new Set(context.map(({
            modifier
        }) => this.constructor.getEfficiencyTag(modifier)));
        if (tags.size !== 1) {
            throw new Error('Multiple tags are not supported: ' + [...tags].join(', '));
        }

        return tags.keys().next().value;
    }

    /**
     * Update all cost and efficiency tables
     *
     * @param {{base_cost: Counter, base_time: Counter, net_cost?: Counter, net_time?: Counter}} cost
     * @param {BuffContext} context
     * @returns {Promise<void>}
     */
    async updateCostAndBonuses(cost, ...context) {
        if (cost.base_cost.size === 0 && cost.base_time.size === 0) {
            // Nothing to display
            $(`.upgrade-cost-row, .upgrade-time-row, #upgrade-efficiency-rows > tr`).addClass('d-none');
            $(`#cumulative-upgrade-efficiencies-table tfoot`).addClass('d-none');
            return;
        }

        const tag = this.getTag(context);
        const buffContext = new Map(context.map(ctx => [ctx.modifier, ctx]));

        await this.updateCostTable(cost, ...buffContext.keys());

        $(`#${tag}-efficiency-rows > tr`).each(( /** Number */ index, /** HTMLElement */ row) => {
            const resource = Number(row.firstChild ?.dataset.resource);
            if (Number.isNaN(resource)) {
                return;
            }

            if (!(cost.base_cost.has(resource) || cost.base_time.has(resource))) {
                row.classList.add('d-none');
                return;
            } else {
                row.classList.remove('d-none');
            }

            $(row.lastChild).find(`.${tag}-efficiency`).each(( /** Number */ idx, /** HTMLElement */ bonus) => {
                const modifier = Number(bonus.dataset.modifier);
                if (Number.isNaN(modifier)) {
                    return;
                }

                const ctx = buffContext.get(modifier);
                const span = $(bonus).parent();

                if (ctx === undefined || !ctx.resources.has(resource)) {
                    span.addClass('d-none');
                } else {
                    span.removeClass('d-none');
                }
            });
        });

        $(`#cumulative-${tag}-efficiencies-table tfoot`).toggleClass('d-none', $(`#${tag}-efficiency-rows > tr:not(.d-none)`).length !== 0);

        $(`.${tag}-efficiency-source`).each(( /** Number */ index, /** HTMLElement */ row) => {
            const buffId = Number(row.dataset.buff);
            const modifier = Number(row.dataset.modifier);
            if (Number.isNaN(buffId) || Number.isNaN(modifier)) {
                return;
            }

            const ctx = buffContext.get(modifier);
            if (ctx === undefined) {
                $(row).addClass('disabled-buff').closest('tr').addClass('d-none');
                return;
            }

            const buff = this.buffMap.get(buffId).deref();
            if (buff === undefined) {
                $(row).addClass('disabled-buff').closest('tr').addClass('d-none');
                console.error(`Missing buff data for buff #${buffId}`);
                return;
            }

            if (ctx.applies(buff)) {
                $(row).removeClass('disabled-buff').closest('tr').removeClass('d-none');
            } else {
                $(row).addClass('disabled-buff').closest('tr').addClass('d-none');
            }
        });

        $('#operations-range').parents('table').toggle($('select.setting-input[data-setting-type="consumable"]:not(.disabled-buff), select.setting-input[data-setting-type="syndicate"]:not(.disabled-buff), select.setting-input[data-setting-type="alliance_syndicate"]:not(.disabled-buff), select.setting-input[data-setting-type="territory_service"]:not(.disabled-buff)').length > 0);
        $('#syndicate-range').parents('table').toggle($('select.setting-input[data-setting-type="syndicate"]:not(.disabled-buff)').length > 0);
        $('#alliance-syndicate-range').parents('table').toggle($('select.setting-input[data-setting-type="alliance_syndicate"]:not(.disabled-buff)').length > 0);
    }

    /**
     *
     * @param {{base_cost: Counter, base_time: Counter, net_cost?: Counter, net_time?: Counter}} cost
     * @param {...number} modifiers
     * @return {Promise<void>}
     */
    async updateCostTable(cost, ...modifiers) {
        let tag = 'upgrade';

        const tags = new Set(modifiers.map(m => this.constructor.getEfficiencyTag(m)));
        if (tags.size > 1) {
            throw new Error('Multiple tags are not supported: ' + [...tags].join(', '));
        } else if (tags.size === 1) {
            tag = tags.keys().next().value;
        }

        const table = $(`#${tag}-cost-table`);
        let auctionScore = 0;
        const resources = new Set(cost.base_cost.keys());

        table.find(`.${tag}-cost-row`).each(( /** Number */ index, /** HTMLElement */ row) => {
            const resource = Number(row.dataset.resource);
            if (Number.isNaN(resource)) {
                return;
            }

            const base = row.querySelector(`.${tag}-cost-base`);
            const net = row.querySelector(`.${tag}-cost-net`);
            const needed = row.querySelector(`.${tag}-cost-needed`);

            if (!cost.base_cost.has(resource)) {
                $(row).addClass('d-none');
                base.dataset.amount = 0;
                net.dataset.amount = 0;

                if (needed !== null) {
                    needed.dataset.amount = 0;
                }

                return;
            } else {
                $(row).removeClass('d-none');
                resources.delete(resource);
            }

            const baseCost = cost.base_cost.get(resource);
            const netCost = cost.net_cost ?.get(resource) ?? baseCost;
            const auctionMultiplier = Number(net.dataset.auction);

            if (auctionMultiplier > 0) {
                auctionScore += netCost * auctionMultiplier;
            }

            base.dataset.amount = baseCost;
            net.dataset.amount = netCost;

            if (needed !== null) {
                const available = row.querySelector(`.${tag}-cost-on-hand`);
                needed.dataset.amount = Math.max(0, netCost - Number(available ?.dataset.amount ?? 0));
            }
        });

        if (resources.size !== 0) {
            throw new Error(`Missing ${tag} resources: ${JSON.stringify([...resources])}`);
        }

        table.find(`.${tag}-time-row`).each(( /** Number */ index, /** HTMLElement */ row) => {
            const resource = Number(row.dataset.timeResource);
            if (Number.isNaN(resource)) {
                return;
            }

            const base = row.querySelector(`.${tag}-time-base`);
            const net = row.querySelector(`.${tag}-time-net`);
            const needed = row.querySelector(`.${tag}-time-needed`);

            if (!cost.base_time.has(resource)) {
                $(row).addClass('d-none');
                base.dataset.seconds = 0;
                net.dataset.seconds = 0;
                needed.dataset.seconds = 0;
            } else {
                $(row).removeClass('d-none');
            }

            const baseTime = cost.base_time.get(resource);
            const netTime = cost.net_time ?.get(resource) ?? baseTime;

            base.dataset.seconds = baseTime;
            net.dataset.seconds = netTime;

            if (needed !== null) {
                const available = row.querySelector(`.${tag}-time-on-hand`);
                needed.dataset.seconds = Math.max(0, netTime - Number(available ?.dataset.seconds ?? 0));
            }
        });

        $(`#${tag}-auction-value`).attr('data-amount', auctionScore).text(auctionScore.toLocaleString());
        $(table).parents('div.card').first().trigger('rendered.spock');
    }

    /**
     * Render table displaying cumulative upgrade cost
     *
     * @param {string} tag
     * @param {{base_cost: Counter, base_time: Counter, net_cost?: Counter, net_time?: Counter}} cost
     * @return {Promise<void>}
     */
    async buildCostTable(tag, cost) {
        const resourceIds = [...cost.base_cost.keys()];
        let resourceBatches, resourceConversions, scrappingOptions;

        const excludedResourcesFromScrapping = [
            743985951, // Tritanium
            2614028847, // Dilithium
        ];

        if (tag === 'upgrade') {
            resourceBatches = new Map(
                (await Array.fromAsync(resourceIds.map(async r => [r, await getResourceTokens(r)])))
                .filter(([, m]) => m !== null)
            );

            resourceConversions = new Map(
                (await Array.fromAsync(resourceIds.map(async r => [r, await getResourceConversion(r)])))
                .filter(([, m]) => m !== null)
            );

            scrappingOptions = new Map(
                (await Array.fromAsync(resourceIds.filter(r => !excludedResourcesFromScrapping.includes(r)).map(async r => [r, await Array.fromAsync(getScrappingOptions(r))])))
                .filter(([, m]) => m ?.length > 0)
            );
        } else {
            resourceBatches = new Map();
            resourceConversions = new Map();
            scrappingOptions = new Map();
        }

        const times = [...cost.base_time.keys()]
            .map(resource => TimeResourceIds[resource] || resource)
            .sort((a, b) => a ?.sorting_index - b ?.sorting_index)
            .map(resource => ({
                time: {
                    base: cost.base_time.get(resource.id) ?? 0,
                    net: cost.net_time ?.get(resource.id) ?? 0
                },
                ...resource
            }));

        const speedupMap = new Map(
            (await Array.fromAsync(times.map(async ({
                id
            }) => [id, await getSpeedUps(id)])))
            .filter(([, m]) => m !== null)
        );

        const resourcesToLoad = [
            ...resourceIds,
            ...[...resourceBatches.values()].flatMap(b => [...b ?.keys()]),
            ...[...speedupMap.values()].flatMap(m => [...m ?.keys()]),
            RESOURCE_LATINUM
        ];

        const resourceMap = new Map((await Array.fromAsync(getResources(resourcesToLoad))).map(r => [r.id, r]));
        const resources = resourceIds
            .map(r => resourceMap.get(r))
            .sort(({
                sorting_key: a
            }, {
                sorting_key: b
            }) => a.localeCompare(b))
            .map(resource => ({
                cost: {
                    base: cost.base_cost.get(resource.id) ?? 0,
                    net: cost.net_cost ?.get(resource.id) ?? 0
                },
                auctionScore: AuctionScore.get(resource.id) ?? 0,
                ...resource
            }));

        const table = $(`#${tag}-cost-table`);
        const resourceTemplate = document.getElementById(`mustache-${tag}-cost`).innerHTML;
        const timeTemplate = document.getElementById(`mustache-${tag}-time`).innerHTML;

        const resourceRows = Mustache.render(resourceTemplate, {
            resources: resources,
            hasConversionOptions: function() {
                return resourceBatches.has(this.id) || resourceConversions.has(this.id) || scrappingOptions.has(this.id);
            },
            renderConversionOptions: function() {
                const resource = this;
                let resourceTokens, conversionCost, scrappingOpts;

                const batches = resourceBatches.get(resource.id);
                if (batches !== undefined) {
                    resourceTokens = [...batches.keys()]
                        .map(r => resourceMap.get(r))
                        .sort(({
                            id: a
                        }, {
                            id: b
                        }) => batches.get(a) - batches.get(b))
                        .map(r => ({
                            converts_to: resource.id,
                            value: batches.get(r.id),
                            ...r
                        }));
                }

                let conversion = resourceConversions.get(resource.id);
                if (conversion !== undefined) {
                    conversionCost = {
                        parent: resource,
                        rates: conversion.rate.map(r => ({
                            parent: resource,
                            ...r
                        })),
                        ...conversion
                    };
                }

                const scrapping = scrappingOptions.get(resource.id);
                if (scrapping !== undefined) {
                    scrappingOpts = scrapping
                        .toSorted(sortShips)
                        .map( /** Ship */ ship => ({
                            levels: JSON.stringify(
                                ship.scrap_rewards ?.map(({
                                    resources
                                }) => resources.get(resource.id) ?? 0)
                            ),
                            resource: resource,
                            ship: ship
                        }));
                }

                if (resourceTokens !== undefined || conversion !== undefined || scrapping !== undefined) {
                    const template = document.getElementById('mustache-conversion-options') ?.innerHTML;
                    return template !== undefined ? Mustache.render(template, {
                        parent: resource,
                        resourceBatches: resourceTokens,
                        latinumConversion: conversionCost,
                        scrappingOptions: scrappingOpts,
                        hasResourceBatches: function() {
                            return resourceTokens !== undefined;
                        },
                        isLatinumConvertible: function() {
                            return conversionCost !== undefined;
                        },
                        hasScrappingOptions: function() {
                            return scrappingOpts !== undefined;
                        }
                    }) : undefined;
                }
            }
        });

        const timeRows = Mustache.render(timeTemplate, {
            times: times,
            hasSpeedups: function() {
                return speedupMap.has(this.id);
            },
            renderSpeedups: function() {
                const resource = this;

                const speedups = speedupMap.get(resource.id);
                if (speedups === undefined) {
                    return;
                }

                const speedupResources = [...speedups.keys()]
                    .map(r => [r, speedupMap.get(resource.id).get(r)])
                    .sort(([, a], [, b]) => a - b)
                    .map(([id, reduction_in_seconds]) => ({
                        id: id,
                        reduction_in_seconds: reduction_in_seconds
                    }));

                const template = document.getElementById('mustache-time-breakdown') ?.innerHTML;
                return template !== undefined ? Mustache.render(template, {
                    parent: resource,
                    speedupResources: speedupResources
                }) : undefined;
            }
        });

        table.find(`tbody.${tag}-cost-table-section-resources`).html(resourceRows);
        table.find(`tfoot.${tag}-cost-table-section-time`).html(timeRows);

        {
            const popoverTemplate = document.getElementById(`mustache-${tag}-popover-auction`) ?.innerHTML;
            if (popoverTemplate === undefined) {
                return;
            }

            $(`#${tag}-auction-popover`).on('inserted.bs.popover', event => {
                if (this.abortController.signal.aborted) {
                    $().off(event);
                    return;
                }

                const popover = $('#' + $(event.target).attr('aria-describedby') + ' > .popover-body');
                if (popover.length === 0) {
                    return;
                }

                const items = [];

                table.find(`.${tag}-cost-row`).each(( /** Number */ index, /** HTMLElement */ row) => {
                    const netEl = row.querySelector(`.${tag}-cost-net`);
                    const auctionMultiplier = Number(netEl.dataset.auction);

                    if (Number.isNaN(auctionMultiplier) || auctionMultiplier <= 0) {
                        return;
                    }

                    const resource = Number(row.dataset.resource);
                    const netCost = Number(netEl.dataset.amount);

                    if (Number.isNaN(resource) || Number.isNaN(netCost) || netCost <= 0) {
                        return;
                    }

                    items.push({
                        resource: resource,
                        cost: netCost,
                        value: auctionMultiplier,
                        score: netCost * auctionMultiplier
                    });
                });

                const content = Mustache.render(popoverTemplate, {
                    items: items
                });
                popover.html(content).trigger('rendered.spock');
            });
        }

        {
            $('.cost-table-settings-btn')
                .on('inserted.bs.popover', event => {
                    if (this.abortController.signal.aborted) {
                        $().off(event);
                        return;
                    }

                    const popover = document.getElementById(event.target.attributes['aria-describedby'] ?.value);
                    const body = popover ?.querySelector('.popover-body');
                    const div = document.getElementById('container-settings-popover-cost') ?.querySelector('div');

                    if (body !== null && div !== null) {
                        body.innerHTML = '';
                        body.appendChild(div);
                    }
                }).on('hide.bs.popover', event => {
                    const popover = document.getElementById(event.target.attributes['aria-describedby'] ?.value);
                    const div = popover ?.querySelector('.popover-body > div');
                    const container = document.getElementById('container-settings-popover-cost');

                    if (div !== null && container !== null) {
                        container.innerHTML = '';
                        container.appendChild(div);
                    }
                });

            const handlePreferenceChange = (event) => {
                if (this.abortController.signal.aborted) {
                    $().off(event);
                    return;
                }

                const element = event.target;

                switch (element.id) {
                    case 'option-include-tokens':
                        element.ariaSelected = element.checked;
                        const tokens = table.find('table.calc-resource-tokens tbody tr');
                        tokens.find('td:first-of-type').toggleClass(['text-muted', 'text-decoration-line-through', element.checked]);

                        if (element.checked) {
                            tokens.each(( /** number */ i, /** HTMLElement */ el) => {
                                const setting = el.querySelector('td.setting-display');
                                const target = el.querySelector('td.token-value');

                                const amount = Number(setting.dataset.amount);
                                const value = Number(setting.dataset.value);

                                target.dataset.amount = amount * value;
                                target.textContent = format_number(amount * value, target.dataset.format);
                            });
                        } else {
                            tokens.find('td.token-value').attr('data-amount', 0).text('0');
                        }

                        break;

                    case 'option-show-base':
                        element.ariaSelected = element.checked;
                        table.find('th.base-cost-col, td.base-cost-col').toggleClass('d-none', !element.checked);
                        break;

                    case 'option-format-exact':
                        table.find('td[data-format][data-format="exact"], td[data-format][data-format="rounded"]')
                            .attr('data-format', element.checked ? 'exact' : 'rounded');

                        table.trigger('rendered.spock');
                        break;
                }
            };

            $('#popover-settings-upgrade-cost input[role="switch"]').on('applied.spock.settings', handlePreferenceChange);

            $('body')
                .on('change', '.popover-body #popover-settings-upgrade-cost input[role="switch"]', handlePreferenceChange)
                .on('change', '.popover-body #popover-settings-upgrade-cost #option-alliance-helps', event => {
                    if (this.abortController.signal.aborted) {
                        $().off(event);
                        return;
                    }

                    // TODO: implement this
                });
        }

        $('.calc-resource-tokens .setting-trigger').on('applied.spock.settings', event => {
            if (this.abortController.signal.aborted) {
                $().off(event);
                return;
            }

            const setting = event.target;
            const target = setting.nextElementSibling;

            target.dataset.amount = Number(setting.dataset.amount) * Number(setting.dataset.value);
        });

        $('.calc-speedups .setting-trigger').on('applied.spock.settings', event => {
            if (this.abortController.signal.aborted) {
                $().off(event);
                return;
            }

            const setting = event.target;
            const target = setting.nextElementSibling;

            target.dataset.seconds = Number(setting.dataset.amount) * Number(setting.dataset.value);
        });

        $(document).on('processed.spock.settings', event => {
            if (this.abortController.signal.aborted) {
                $().off(event);
                return;
            }

            $('table.calc-speedups').each(( /** Number */ index, /** HTMLElement */ table) => {
                const total = Array.from(table.querySelectorAll('tbody > tr > td:last-child')).map(node => Number(node.dataset.seconds)).reduce((total, seconds) => total + seconds, 0);
                const cell = table.querySelector('td.speedup-total-value');
                const duration = format_duration(total);

                if (cell !== null) {
                    cell.dataset.seconds = total;
                    cell.textContent = duration;
                }

                $(table).parents('tr').prev().find('.upgrade-time-on-hand').attr('data-seconds', total).text(duration);
            });
        });

        $('.conversion-options-toggle')
            .on('show.bs.collapse', event => {
                if (this.abortController.signal.aborted) {
                    $().off(event);
                    return;
                }

                const /** HTMLElement */ element = event.target;
                const target = document.querySelector(`*[data-bs-target="#${element.id}"]`);
                target ?.classList.replace('fa-caret-right', 'fa-caret-down');
            })
            .on('hidden.bs.collapse', event => {
                if (this.abortController.signal.aborted) {
                    $().off(event);
                    return;
                }

                const /** HTMLElement */ element = event.target;
                const target = document.querySelector(`*[data-bs-target="#${element.id}"]`);
                target ?.classList.replace('fa-caret-down', 'fa-caret-right');
            });

        {
            // observe changes to on-hand column in cost table
            const mutationObserver = new MutationObserver((mutations, observer) => {
                if (this.abortController.signal.aborted) {
                    observer.disconnect();
                    return;
                }

                for (const mutation of mutations) {
                    const target = mutation.target;
                    const netCost = Number(target.previousElementSibling.dataset.amount);
                    const onHand = Number(target.dataset.raw) + Number(target.dataset.tokens);
                    const needed = target.nextElementSibling;

                    target.dataset.amount = onHand;
                    target.textContent = format_number(onHand, target.dataset.format);

                    const value = Math.max(0, netCost - onHand);
                    needed.dataset.amount = value;
                    needed.textContent = format_number(value, needed.dataset.format);
                }
            });

            for (const cell of table.find(`td.${tag}-cost-on-hand`).get()) {
                mutationObserver.observe(cell, {
                    attributes: true,
                    attributeFilter: ['data-raw', 'data-tokens']
                });
            }
        }

        {
            // observe changes to resource tokens in subtable
            const mutationObserver = new MutationObserver((mutations, observer) => {
                if (this.abortController.signal.aborted) {
                    observer.disconnect();
                    return;
                }

                for (const mutation of mutations) {
                    const node = mutation.target;
                    const target = $(node).parents('tr').prev(`.${tag}-cost-row`).find(`.${tag}-cost-on-hand`);

                    const oldValue = Number(mutation.oldValue);
                    const newValue = Number(node.dataset.amount);
                    const targetValue = Number(target.attr('data-tokens'));

                    target.attr('data-tokens', Math.max(targetValue - oldValue + newValue, 0));
                }
            });

            for (const cell of table.find('table.calc-resource-tokens td.token-value').get()) {
                mutationObserver.observe(cell, {
                    attributes: true,
                    attributeFilter: ['data-amount'],
                    attributeOldValue: true
                });
            }
        }

        {
            // observe changes to "needed" column in cost table
            const mutationObserver = new MutationObserver((mutations, observer) => {
                if (this.abortController.signal.aborted) {
                    observer.disconnect();
                    return;
                }

                for (const mutation of mutations) {
                    const node = mutation.target;
                    const needed = Number(node.dataset.amount);

                    const subtable = $(node).parents('tr').next(`[id^="${tag}-cost-conversion-sub-table"]`);
                    if (subtable.length === 0) {
                        continue;
                    }

                    {
                        // update latinum conversion
                        const div = subtable.find('.calc-lat-conversion');
                        const rates = div.find('table tbody tr td:first-child span');
                        const span = [...rates.get()].sort(({
                            dataset: a
                        }, {
                            dataset: b
                        }) => Number(a.amount) - Number(b.amount)).findLast(({
                            dataset
                        }) => Number(dataset.amount) <= needed);

                        if (span !== undefined) {
                            const costPerUnit = Number(span.parentElement.nextElementSibling.querySelector('span').dataset.amount);
                            const cost = needed * costPerUnit;

                            div.find('.latinum-conversion-needed').attr('data-amount', needed);
                            div.find('.latinum-conversion-rate').attr('data-amount', costPerUnit);
                            div.find('.latinum-conversion-cost').attr('data-amount', cost).parents('p').trigger('rendered.spock');
                        }
                    }

                    {
                        // update scrapping options
                        const table = subtable.find('table.calc-scrapping-options');
                        table.find('tbody > tr').each(( /** Number */ index, /** HTMLElement */ row) => {
                            const scrapOnlyAtMax = row.querySelector('td:nth-child(2)');
                            const scrapAtMax = row.querySelector('td:nth-child(3)');
                            const partialScrap = row.querySelector('td:nth-child(4)');
                            const rewardsAtMax = row.querySelector('td:nth-child(5)');
                            const totalRewards = row.querySelector('td:nth-child(6)');
                            const totalRewardsMaxOnly = row.querySelector('td:nth-child(7)');

                            const scrappingRewards = JSON.parse(totalRewards.dataset.levels);
                            const rewardAtMaxLevel = scrappingRewards[scrappingRewards.length - 1];

                            rewardsAtMax.dataset.amount = rewardAtMaxLevel;
                            rewardsAtMax.textContent = format_number(rewardAtMaxLevel, rewardsAtMax.dataset.format);

                            if (needed <= 0) {
                                scrapOnlyAtMax.textContent = 0;
                                scrapAtMax.textContent = 0;
                                partialScrap.textContent = 0;
                                totalRewards.textContent = 0;
                                totalRewards.dataset.amount = 0;
                                totalRewardsMaxOnly.textContent = 0;
                                totalRewardsMaxOnly.dataset.amount = 0;
                            } else {
                                const remainder = needed % rewardAtMaxLevel;
                                let maxScraps = Math.trunc(needed / rewardAtMaxLevel);
                                let partialIndex = scrappingRewards.findIndex(r => r >= remainder);
                                let maxScrapsOnly, rewards, rewardsMaxOnly;

                                if (rewardAtMaxLevel === scrappingRewards[partialIndex]) {
                                    partialIndex = -1;
                                }

                                if (partialIndex === -1) {
                                    maxScrapsOnly = ++maxScraps;
                                    rewardsMaxOnly = rewards = maxScrapsOnly * rewardAtMaxLevel;
                                } else {
                                    rewards = (maxScraps * rewardAtMaxLevel) + scrappingRewards[partialIndex];
                                    maxScrapsOnly = maxScraps + 1;
                                    rewardsMaxOnly = maxScrapsOnly * rewardAtMaxLevel;
                                }

                                scrapOnlyAtMax.textContent = maxScrapsOnly;
                                scrapAtMax.textContent = maxScraps;
                                partialScrap.textContent = partialIndex + 1;
                                totalRewards.textContent = format_number(rewards, totalRewards.dataset.format);
                                totalRewards.dataset.amount = rewards;
                                totalRewardsMaxOnly.textContent = format_number(rewardsMaxOnly, totalRewardsMaxOnly.dataset.format);
                                totalRewardsMaxOnly.dataset.amount = rewardsMaxOnly;
                            }
                        });
                    }
                }
            });

            for (const cell of table.find(`.${tag}-cost-needed`).get()) {
                const subtable = $(cell).parents('tr').next(`[id^="${tag}-cost-conversion-sub-table"]`);
                if (subtable.length === 0) {
                    continue;
                }

                mutationObserver.observe(cell, {
                    attributes: true,
                    attributeFilter: ['data-amount']
                });
            }
        }

        $('a.scrapping-toggle-mode').on('click', event => {
            if (this.abortController.signal.aborted) {
                $().off(event);
                return;
            }

            const table = $(event.target).closest('table');
            const newMode = event.target.dataset.mode === 'max' ? 'partial' : 'max';

            if (newMode === 'partial') {
                table.find('.scrapping-mode-max').addClass('d-none');
                table.find('.scrapping-mode-partial').removeClass('d-none');
            } else if (newMode === 'max') {
                table.find('.scrapping-mode-partial').addClass('d-none');
                table.find('.scrapping-mode-max').removeClass('d-none');
            }

            event.target.dataset.mode = newMode;
        });
    }

    /**
     * Build cost efficiency tables grouped by buff source
     *
     * @param {string} tag
     * @param {Set.<number>} buffIds
     * @returns {Promise<void>}
     */
    async buildEfficiencyTables(tag, buffIds) {
        if (buffIds.size === 0) {
            return;
        }
        const activeBuffs = Object.fromEntries(
            [...Object.entries(this.buffs)]
            .map(([source, x]) => [source,
                Object.fromEntries(
                    [...Object.entries(x)].map(([modifier, buffs]) => [modifier, buffs.filter(({
                        buff_id
                    }) => buffIds.has(buff_id))])
                )
            ])
        );

        let miscBuffs = {};
        let multipleBuffs = {};
        let researchTrees = activeBuffs.hasOwnProperty('research') ? await getResearchTrees() : new Map();
        const researchTreeIds = [...researchTrees.keys()];
        let syndicateData, allianceSyndicateData, territoryData, territoryTranslations;

        for (const source of Object.keys(activeBuffs)) {
            let multiples = new Set([...[...Object.values(activeBuffs[source])]
                .map(buffs => buffs.reduce((acc, curr) => acc.increment(curr.source_id), new Counter()))
                .reduce((acc, curr) => acc.iextend(curr), new Counter()).entries()
            ].filter(([source_id, count]) => count > 1 && source_id !== null).map(([source_id]) => source_id));

            if (multiples.size > 0) {
                multipleBuffs[source] = multiples;
            }

            for (const [modifier, buffs] of Object.entries(activeBuffs[source])) {
                switch (source) {
                    case 'building':
                    case 'starbase':
                        buffs.sort(({
                            source_data: a
                        }, {
                            source_data: b
                        }) => a.name.localeCompare(b.name));
                        break;

                    case 'research':
                        for (const {
                                source_data
                            } of buffs) {
                            if (source_data.name !== undefined) {
                                source_data.name = source_data.name.replace(/<color=[^>]*>(.*?)<\/color>/g, '$1');
                            }
                        }

                        buffs.sort(({
                            source_data: a
                        }, {
                            source_data: b
                        }) => {
                            // TODO: use sortResearch instead
                            const aIndex = researchTreeIds.findIndex(id => id === a.research_tree);
                            const bIndex = researchTreeIds.findIndex(id => id === b.research_tree);

                            if (aIndex === bIndex) {
                                const {
                                    column: aColumn,
                                    row: aRow
                                } = a;
                                const {
                                    column: bColumn,
                                    row: bRow
                                } = b;

                                return aColumn === bColumn ? aRow - bRow : aColumn - bColumn;
                            }

                            return aIndex - bIndex;
                        });

                        for (const {
                                source_data
                            } of buffs) {
                            source_data.tree = researchTrees.get(source_data.research_tree);
                        }

                        break;

                    case 'consumables':
                    case 'exocomp':
                        for (const {
                                buff_id,
                                buff_id_str,
                                source_data
                            } of buffs) {
                            let sanitizedName = source_data.name ?.replace('+{0:P0}', '').replace(/<color=[^>]*>(.*?)<\/color>/, '$1').trim();
                            let buffIdStr;

                            switch (source_data.category) {
                                case ConsumableCategory.LoopMuseum:
                                    buffIdStr = buff_id_str
                                        .replace(/^Consumable_LoopMuseum_ArchiveEntry_Amalgam_Amalgam_ShipPart_CE_(\d+)$/, (match, p1) => `Amalgam Parts CE (Amalgam Archive Pillar ${p1})`)
                                        .replace(/^Consumable_LoopMuseum_ArchiveEntry_BotanyBay_BotanyBay_ShipPart_CE_(\d+)$/, (match, p1) => `Botany Bay Components CE (Botany Bay Archive Pillar ${p1})`)
                                        .replace(/^Consumable_LoopMuseum_ArchiveEntry_Dvor_Dvor_ShipPart_CE_(\d+)$/, (match, p1) => `Ferengi D'Vor Components CE (D'Vor Archive Pillar ${p1})`)
                                        .replace(/^Consumable_LoopMuseum_ArchiveEntry_DvorFeesha_DvorFeesha_ShipPart_CE_(\d+)$/, (match, p1) => `D'Vor Feesha Components CE (D'Vor Feesha Archive Pillar ${p1})`)
                                        .replace(/^Consumable_LoopMuseum_ArchiveEntry_Franklin_Franklin_ShipPart_CE_(\d+)$/, (match, p1) => `USS Franklin Components CE (USS Franklin Archive Pillar ${p1})`)
                                        .replace(/^Consumable_LoopMuseum_ArchiveEntry_FranklinA_FranklinA_ShipPart_CE_(\d+)$/, (match, p1) => `USS Franklin-A Components CE (USS Franklin-A Archive Pillar ${p1})`)
                                        .replace(/^Consumable_LoopMuseum_ArchiveEntry_Monaveen_Monaveen_ShipPart_CE_(\d+)$/, (match, p1) => `Monaveen Component CE (Monaveen Archive Pillar ${p1})`)
                                        .replace(/^Consumable_LoopMuseum_ArchiveEntry_USSVoyager_AllShip_Repair_CE_(\d+)$/, (match, p1) => `Ship Repair CE (USS Voyager Archive Pillar ${p1})`)
                                        .replace(/^Consumable_LoopMuseum_ArchiveEntry_USSVoyager_USSVoyager_ShipPart_CE_(\d+)$/, (match, p1) => `USS Voyager Component CE (USS Voyager Archive Pillar ${p1})`)
                                        .replace(/^Consumable_LoopMuseum_ArchiveEntry_Vidar_Vidar_ShipPart_CE_(\d+)$/, (match, p1) => `Vi'dar Components CE (Vi'dar Archive Pillar ${p1})`)
                                        .replace(/^Consumable_LoopMuseum_ArchiveEntry_VidarTalios_VidarTalios_ShipPart_CE_(\d+)$/, (match, p1) => `Vi'dar Talios Components CE (Vi'dar Talios Archive Pillar ${p1})`)
                                        .replace('Consumable_LoopMuseum_ArchiveEntry', 'Archive Pillar')
                                        .replace(/consumable(_?)/i, '')
                                        .replaceAll('_', ' ');

                                    if (buff_id_str.startsWith('Consumable_LoopMuseum_ArchiveEntry_Amalgam_')) {
                                        source_data.tied_research = {
                                            id: 3377057527,
                                            min_level: 1
                                        };
                                    } else if (buff_id_str.startsWith('Consumable_LoopMuseum_ArchiveEntry_BotanyBay_')) {
                                        source_data.tied_research = {
                                            id: 3264988847,
                                            min_level: 1
                                        };
                                    } else if (buff_id_str.startsWith('Consumable_LoopMuseum_ArchiveEntry_Dvor_')) {
                                        source_data.tied_research = {
                                            id: 1942197868,
                                            min_level: 1
                                        };
                                    } else if (buff_id_str.startsWith('Consumable_LoopMuseum_ArchiveEntry_DvorFeesha_')) {
                                        source_data.tied_research = {
                                            id: 17021379,
                                            min_level: 1
                                        };
                                    } else if (buff_id_str.startsWith('Consumable_LoopMuseum_ArchiveEntry_Franklin_')) {
                                        source_data.tied_research = {
                                            id: 1461049097,
                                            min_level: 1
                                        };
                                    } else if (buff_id_str.startsWith('Consumable_LoopMuseum_ArchiveEntry_FranklinA_')) {
                                        source_data.tied_research = {
                                            id: 2519742531,
                                            min_level: 1
                                        };
                                    } else if (buff_id_str.startsWith('Consumable_LoopMuseum_ArchiveEntry_Monaveen_')) {
                                        source_data.tied_research = {
                                            id: 682449233,
                                            min_level: 1
                                        };
                                    } else if (buff_id_str.startsWith('Consumable_LoopMuseum_ArchiveEntry_Vidar_')) {
                                        source_data.tied_research = {
                                            id: 4031998999,
                                            min_level: 1
                                        };
                                    } else if (buff_id_str.startsWith('Consumable_LoopMuseum_ArchiveEntry_VidarTalios_')) {
                                        source_data.tied_research = {
                                            id: 2889046528,
                                            min_level: 1
                                        };
                                    } else if (buff_id_str.startsWith('Consumable_LoopMuseum_ArchiveEntry_USSVoyager_')) {
                                        source_data.tied_research = {
                                            id: 3588148676,
                                            min_level: 1
                                        };
                                    }

                                    break;

                                case ConsumableCategory.HijackedRefits:
                                    {
                                        switch (buff_id) {
                                            // Consumable_Cosmetics_Skins_Enterprise_NCC-1701_Hijacked_1 (consumable #763842233)
                                            case 1374772836:
                                                buffIdStr = await TranslationLoader.getByLoca(TranslationCategory.researches.route, 78550, "research_project_name", "Consumable_Cosmetics_Skins_Enterprise_NCC-1701_Hijacked_1");
                                                source_data.tied_research = {
                                                    id: 3295995870,
                                                    min_level: 1
                                                };
                                                break;
                                                // Consumable_Cosmetics_Skins_Enterprise-A_NCC-1701_Hijacked_1 (consumable #3363056864)
                                            case 3936366621:
                                                buffIdStr = await TranslationLoader.getByLoca(TranslationCategory.researches.route, 78553, "research_project_name", "Consumable_Cosmetics_Skins_Enterprise-A_NCC-1701_Hijacked_1");
                                                source_data.tied_research = {
                                                    id: 2460526134,
                                                    min_level: 1
                                                };
                                                break;
                                                // Consumable_Cosmetics_Skins_Enterprise-D_NCC-1701_Hijacked_1 (consumable #1360319107)
                                            case 3634241470:
                                                buffIdStr = await TranslationLoader.getByLoca(TranslationCategory.researches.route, 78556, "research_project_name", "Consumable_Cosmetics_Skins_Enterprise-D_NCC-1701_Hijacked_1");
                                                source_data.tied_research = {
                                                    id: 3213223873,
                                                    min_level: 1
                                                };
                                                break;
                                                // Consumable_Cosmetics_Skins_Enterprise-E_NCC-1701_Hijacked_1 (consumable #448114959)
                                            case 3981046368:
                                                buffIdStr = await TranslationLoader.getByLoca(TranslationCategory.researches.route, 78559, "research_project_name", "Consumable_Cosmetics_Skins_Enterprise-E_NCC-1701_Hijacked_1");
                                                source_data.tied_research = {
                                                    id: 1660126282,
                                                    min_level: 1
                                                };
                                                break;
                                                // Consumable_Cosmetics_Skins_D4_D7_Hijacked_1 (consumable #3054865607)
                                            case 1790217582:
                                                buffIdStr = await TranslationLoader.getByLoca(TranslationCategory.researches.route, 78551, "research_project_name", "Consumable_Cosmetics_Skins_D4_D7_Hijacked_1");
                                                source_data.tied_research = {
                                                    id: 3369409546,
                                                    min_level: 1
                                                };
                                                break;
                                                // Consumable_Cosmetics_Skins_Heghta_D7_Hijacked_1 (consumable #2584884044)
                                            case 3390601117:
                                                buffIdStr = await TranslationLoader.getByLoca(TranslationCategory.researches.route, 78554, "research_project_name", "Consumable_Cosmetics_Skins_Heghta_D7_Hijacked_1");
                                                source_data.tied_research = {
                                                    id: 872959430,
                                                    min_level: 1
                                                };
                                                break;
                                                // Consumable_Cosmetics_Skins_Rotarran_D7_Hijacked_1 (consumable #2774486917)
                                            case 564688091:
                                                buffIdStr = await TranslationLoader.getByLoca(TranslationCategory.researches.route, 78557, "research_project_name", "Consumable_Cosmetics_Skins_Rotarran_D7_Hijacked_1");
                                                source_data.tied_research = {
                                                    id: 200793205,
                                                    min_level: 1
                                                };
                                                break;
                                                // Consumable_Cosmetics_Skins_Krencha_D7_Hijacked_1 (consumable #3358495392)
                                            case 1938477260:
                                                buffIdStr = await TranslationLoader.getByLoca(TranslationCategory.researches.route, 78560, "research_project_name", "Consumable_Cosmetics_Skins_Krencha_D7_Hijacked_1");
                                                source_data.tied_research = {
                                                    id: 3756043192,
                                                    min_level: 1
                                                };
                                                break;
                                                // Consumable_Cosmetics_Skins_Augur_BirdOfPrey_Hijacked_1 (consumable #2153621468)
                                            case 1030292592:
                                                buffIdStr = await TranslationLoader.getByLoca(TranslationCategory.researches.route, 78552, "research_project_name", "Consumable_Cosmetics_Skins_Augur_BirdOfPrey_Hijacked_1");
                                                source_data.tied_research = {
                                                    id: 4288148796,
                                                    min_level: 1
                                                };
                                                break;
                                                // Consumable_Cosmetics_Skins_Tribune_BirdOfPrey_Hijacked_1 (consumable #2496565344)
                                            case 156650971:
                                                buffIdStr = await TranslationLoader.getByLoca(TranslationCategory.researches.route, 78555, "research_project_name", "Consumable_Cosmetics_Skins_Tribune_BirdOfPrey_Hijacked_1");
                                                source_data.tied_research = {
                                                    id: 3620293224,
                                                    min_level: 1
                                                };
                                                break;
                                                // Consumable_Cosmetics_Skins_DDeridex_BirdOfPrey_Hijacked_1 (consumable #2738754233)
                                            case 3711636802:
                                                buffIdStr = await TranslationLoader.getByLoca(TranslationCategory.researches.route, 78558, "research_project_name", "Consumable_Cosmetics_Skins_DDeridex_BirdOfPrey_Hijacked_1");
                                                source_data.tied_research = {
                                                    id: 3510314419,
                                                    min_level: 1
                                                };
                                                break;
                                                // Consumable_Cosmetics_Skins_Scimitar_BirdOfPrey_Hijacked_1 (consumable #3255658666)
                                            case 1769747628:
                                                buffIdStr = await TranslationLoader.getByLoca(TranslationCategory.researches.route, 78561, "research_project_name", "Consumable_Cosmetics_Skins_Scimitar_BirdOfPrey_Hijacked_1");
                                                source_data.tied_research = {
                                                    id: 439426387,
                                                    min_level: 1
                                                };
                                                break;
                                                // Consumable_Cosmetics_Skins_Hijacked_Reliant_Hijacked_Splicer_Loot_Increase_M79 (consumable #1597451120)
                                            case 1597451120:
                                                buffIdStr = await TranslationLoader.getByLoca(TranslationCategory.researches.route, 79550, "research_project_name", "Consumable_Cosmetics_Skins_Hijacked_Reliant_Hijacked_Splicer_Loot_Increase_M79");
                                                source_data.tied_research = {
                                                    id: 1338297870,
                                                    min_level: 1
                                                };
                                                break;
                                                // Consumable_Cosmetics_Skins_Hijacked_Reliant_Augment_Rep_Increase_M79 (consumable #1122903964)
                                            case 1122903964:
                                                buffIdStr = await TranslationLoader.getByLoca(TranslationCategory.researches.route, 79550, "research_project_name", "Consumable_Cosmetics_Skins_Hijacked_Reliant_Augment_Rep_Increase_M79");
                                                source_data.tied_research = {
                                                    id: 1338297870,
                                                    min_level: 1
                                                };
                                                break;
                                                // Consumable_Cosmetics_Skins_USS-Intrepid_NCC-1701_Hijacked_1 (consumable #1479077607)
                                            case 234451068:
                                                buffIdStr = await TranslationLoader.getByLoca(TranslationCategory.researches.route, 79401, "research_project_name", "Consumable_Cosmetics_Skins_USS-Intrepid_NCC-1701_Hijacked_1");
                                                source_data.tied_research = {
                                                    id: 3967376159,
                                                    min_level: 1
                                                };
                                                break;
                                                // Consumable_Cosmetics_Skins_USS-Newton_NCC-1701_Hijacked_1 (consumable #789683014)
                                            case 3261322363:
                                                buffIdStr = await TranslationLoader.getByLoca(TranslationCategory.researches.route, 79402, "research_project_name", "Consumable_Cosmetics_Skins_USS-Newton_NCC-1701_Hijacked_1");
                                                source_data.tied_research = {
                                                    id: 3477973989,
                                                    min_level: 1
                                                };
                                                break;
                                                // Consumable_Cosmetics_Skins_USS-Crozier_NCC-1701_Hijacked_1 (consumable #3126122376)
                                            case 963677798:
                                                buffIdStr = await TranslationLoader.getByLoca(TranslationCategory.researches.route, 79403, "research_project_name", "Consumable_Cosmetics_Skins_USS-Crozier_NCC-1701_Hijacked_1");
                                                source_data.tied_research = {
                                                    id: 4019462116,
                                                    min_level: 1
                                                };
                                                break;
                                                // Consumable_Cosmetics_Skins_USS-Titan_NCC-1701_Hijacked_1 (consumable #2410973315)
                                            case 1218790865:
                                                buffIdStr = await TranslationLoader.getByLoca(TranslationCategory.researches.route, 79404, "research_project_name", "Consumable_Cosmetics_Skins_USS-Titan_NCC-1701_Hijacked_1");
                                                source_data.tied_research = {
                                                    id: 70844555,
                                                    min_level: 1
                                                };
                                                break;
                                                // Consumable_Cosmetics_Skins_BRel_D7_Hijacked_1 (consumable #1153262784)
                                            case 3748948273:
                                                buffIdStr = await TranslationLoader.getByLoca(TranslationCategory.researches.route, 79405, "research_project_name", "Consumable_Cosmetics_Skins_BRel_D7_Hijacked_1");
                                                source_data.tied_research = {
                                                    id: 4004596781,
                                                    min_level: 1
                                                };
                                                break;
                                                // Consumable_Cosmetics_Skins_Korinar_D7_Hijacked_1 (consumable #2336881019)
                                            case 2059187482:
                                                buffIdStr = await TranslationLoader.getByLoca(TranslationCategory.researches.route, 79406, "research_project_name", "Consumable_Cosmetics_Skins_Korinar_D7_Hijacked_1");
                                                source_data.tied_research = {
                                                    id: 1399576019,
                                                    min_level: 1
                                                };
                                                break;
                                                // Consumable_Cosmetics_Skins_QuvSompek_D7_Hijacked_1 (consumable #1853948127)
                                            case 932699236:
                                                buffIdStr = await TranslationLoader.getByLoca(TranslationCategory.researches.route, 79407, "research_project_name", "Consumable_Cosmetics_Skins_QuvSompek_D7_Hijacked_1");
                                                source_data.tied_research = {
                                                    id: 3931956038,
                                                    min_level: 1
                                                };
                                                break;
                                                // Consumable_Cosmetics_Skins_KosKarii_D7_Hijacked_1 (consumable #1541171877)
                                            case 1843132286:
                                                buffIdStr = await TranslationLoader.getByLoca(TranslationCategory.researches.route, 79408, "research_project_name", "Consumable_Cosmetics_Skins_KosKarii_D7_Hijacked_1");
                                                source_data.tied_research = {
                                                    id: 2026794319,
                                                    min_level: 1
                                                };
                                                break;
                                                // Consumable_Cosmetics_Skins_Gladius_BirdOfPrey_Hijacked_1 (consumable #2219909164)
                                            case 4109472242:
                                                buffIdStr = await TranslationLoader.getByLoca(TranslationCategory.researches.route, 79409, "research_project_name", "Consumable_Cosmetics_Skins_Gladius_BirdOfPrey_Hijacked_1");
                                                source_data.tied_research = {
                                                    id: 2642420101,
                                                    min_level: 1
                                                };
                                                break;
                                                // Consumable_Cosmetics_Skins_Pilum_BirdOfPrey_Hijacked_1 (consumable #3859968721)
                                            case 3431948021:
                                                buffIdStr = await TranslationLoader.getByLoca(TranslationCategory.researches.route, 79410, "research_project_name", "Consumable_Cosmetics_Skins_Pilum_BirdOfPrey_Hijacked_1");
                                                source_data.tied_research = {
                                                    id: 1663343658,
                                                    min_level: 1
                                                };
                                                break;
                                                // Consumable_Cosmetics_Skins_Sanctus_BirdOfPrey_Hijacked_1 (consumable #238346757)
                                            case 2698019113:
                                                buffIdStr = await TranslationLoader.getByLoca(TranslationCategory.researches.route, 79411, "research_project_name", "Consumable_Cosmetics_Skins_Sanctus_BirdOfPrey_Hijacked_1");
                                                source_data.tied_research = {
                                                    id: 3924714278,
                                                    min_level: 1
                                                };
                                                break;
                                                // Consumable_Cosmetics_Skins_Velox_BirdOfPrey_Hijacked_1 (consumable #2483351531)
                                            case 3244563750:
                                                buffIdStr = await TranslationLoader.getByLoca(TranslationCategory.researches.route, 79412, "research_project_name", "Consumable_Cosmetics_Skins_Velox_BirdOfPrey_Hijacked_1");
                                                source_data.tied_research = {
                                                    id: 2394078557,
                                                    min_level: 1
                                                };
                                                break;
                                        }
                                    }
                                    break;

                                default:
                                    buffIdStr = buff_id_str
                                        .replace(/^Consumable_cosmetic_skin_SS_Rev_M73_EV_(\d+)_CE$/, (match, p1) => 'SS Revenant Skin MK' + toRomanNumerals(Number(p1) + 1))
                                        .replace('Consumable_M69_Pivot_', '')
                                        .replace(/consumable(_?)/i, '')
                                        .replaceAll('_', ' ')
                                        .replace(/([A-Z]+)/g, ' $1').replace(/([A-Z][a-z])/g, ' $1');

                                    if (buff_id_str.startsWith('Consumable_cosmetic_skin_SS_Rev_M73_EV')) {
                                        source_data.custom_category = "SS Revenant Evolution";

                                        switch (buff_id) {
                                            // Consumable_cosmetic_skin_SS_Rev_M73_EV_1_CE
                                            case 4133468225:
                                                source_data.tied_research = {
                                                    id: 2798426755,
                                                    min_level: 1
                                                };
                                                break;
                                                // Consumable_cosmetic_skin_SS_Rev_M73_EV_2_CE
                                            case 2266817172:
                                                source_data.tied_research = {
                                                    id: 2820514009,
                                                    min_level: 1
                                                };
                                                break;
                                                // Consumable_cosmetic_skin_SS_Rev_M73_EV_3_CE
                                            case 3260358108:
                                                source_data.tied_research = {
                                                    id: 107681902,
                                                    min_level: 1
                                                };
                                                break;
                                        }
                                    } else if (buff_id_str.startsWith('Consumable_M69_Pivot_')) {
                                        source_data.custom_category = "IAP (Grabthar's Hammer)";
                                    }

                                    break;
                            }

                            source_data.name = sanitizedName ?? `${buffIdStr}⁺`;
                        }

                        buffs.sort(({
                            source_data: a
                        }, {
                            source_data: b
                        }) => {
                            const {
                                grade: aGrade,
                                rarity: aRarity
                            } = a;
                            const {
                                grade: bGrade,
                                rarity: bRarity
                            } = b;

                            return aGrade === bGrade ? aRarity - bRarity : aGrade - bGrade;
                        });

                        break;

                    case 'syndicate':
                        if (syndicateData === undefined) {
                            syndicateData = await $.getJSON(`${API_BASE_URL}/v1/enhancedSyndicate`);
                        }

                        buffs.forEach(buff => {
                            const tierData = syndicateData.find(({
                                buffs
                            }) => buffs.find(({
                                buffId
                            }) => buffId === buff.buff_id));
                            if (tierData === undefined) {
                                return;
                            }

                            buff.source_data.type = 'syndicate';
                            buff.source_data.tier = tierData.tier;
                            buff.source_data.description = `Syndicate L${tierData.tier}`;
                            buff.source_data.name = stripHTML(buff.source_data ?.name) ?.replace('+{0:P0}', '').trim();
                        });

                        buffs.sort(({
                            source_data: a
                        }, {
                            source_data: b
                        }) => {
                            const cmp = a.tier - b.tier;
                            return cmp === 0 ? a.name.localeCompare(b.name) : cmp;
                        });

                        if (!miscBuffs.hasOwnProperty(modifier)) {
                            miscBuffs[modifier] = [];
                        }

                        miscBuffs[modifier].push(...buffs.filter(({
                            source_data
                        }) => source_data.tier !== undefined));
                        break;

                    case 'alliance_syndicate':
                        if (allianceSyndicateData === undefined) {
                            allianceSyndicateData = await $.getJSON(`${API_BASE_URL}/v1/enhancedSyndicate/alliance`);
                        }

                        buffs.forEach(buff => {
                            buff.source_data.type = 'alliance_syndicate';
                            buff.source_data.tier = allianceSyndicateData.find(({
                                buffs
                            }) => buffs.find(({
                                buffId
                            }) => buffId === buff.buff_id)) ?.tier;
                            buff.source_data.description = `Emerald Chain L${buff.source_data.tier}`;
                            buff.source_data.name = stripHTML(buff.source_data.name).replace('+{0:P0}', '').trim();
                        });

                        buffs.sort(({
                            source_data: a
                        }, {
                            source_data: b
                        }) => {
                            const cmp = a.tier - b.tier;
                            return cmp === 0 ? a.name.localeCompare(b.name) : cmp;
                        });

                        if (!miscBuffs.hasOwnProperty(modifier)) {
                            miscBuffs[modifier] = [];
                        }

                        miscBuffs[modifier].push(...buffs.filter(({
                            source_data
                        }) => source_data.tier !== undefined));
                        break;

                    case 'territory_service':
                        if (territoryData === undefined || territoryTranslations === undefined) {
                            try {
                                [territoryData, territoryTranslations] = await Promise.all([
                                    $.getJSON(`${API_BASE_URL}/v1/territory`),
                                    $.getJSON(`${API_BASE_URL}/translations/en/territory`)
                                ]);
                            } catch (e) {
                                console.error('Failed to load territory data');
                                console.error(e);

                                territoryData = {};
                                territoryTranslations = [];
                            }
                        }

                        buffs.forEach(buff => {
                            const service = Object.values(territoryData ?.services ?? {}).find(({
                                buff_id
                            }) => buff_id === buff.buff_id);
                            const serviceName = territoryTranslations.find(({
                                id,
                                key
                            }) => Number(id) === buff.buff_id && key.startsWith('services_name_'));
                            const territories = Object.values(territoryData ?.territories ?? {}).filter(({
                                services
                            }) => services.includes(service.id));
                            const territoryNames = territories.map(({
                                name
                            }) => name).sort((a, b) => a.localeCompare(b));

                            buff.source_id = service ?.id;
                            buff.source_data.type = 'territory_service';
                            buff.source_data.name = serviceName ?.text ?? `${buff.buff_id_str} (Missing translation)`;
                            buff.source_data.tier = Number(buff.buff_id_str.split('_')[2].slice(1));
                            buff.source_data.description = `${buff.source_data.tier}⇴ Territory Service<br><span class="text-muted">${territoryNames.join(', ')}</span>`;
                        });

                        if (!miscBuffs.hasOwnProperty(modifier)) {
                            miscBuffs[modifier] = [];
                        }

                        miscBuffs[modifier].push(...buffs.sort(({
                            source_data: a
                        }, {
                            source_data: b
                        }) => {
                            const cmp = a.name.localeCompare(b.name);
                            return cmp === 0 ? a.tier - b.tier : cmp;
                        }));

                        break;
                }
            }
        }

        for (const source of Object.keys(multipleBuffs)) {
            for (const source_id of multipleBuffs[source]) {
                const buffs = [...Object.entries(activeBuffs[source])].flatMap(([modifier, buffs]) => buffs.filter(({
                    source_id: s
                }) => source_id === s));
                const remainingBuffs = buffs.slice(1).map(buff => {
                    const {
                        source_data,
                        ...rest
                    } = buff;
                    return rest;
                });

                let primaryBuff;
                for (const modifier of Object.keys(activeBuffs[source])) {
                    const match = activeBuffs[source][modifier].find(({
                        buff_id
                    }) => buff_id === buffs[0].buff_id);
                    if (match !== undefined) {
                        primaryBuff = match;
                        break;
                    }
                }

                if (primaryBuff === undefined) {
                    continue;
                }

                const idsToRemove = new Set(remainingBuffs.map(({
                    buff_id
                }) => buff_id));
                primaryBuff.additional_buffs = remainingBuffs;

                for (const modifier of Object.keys(activeBuffs[source])) {
                    activeBuffs[source][modifier] = activeBuffs[source][modifier].filter(({
                        buff_id
                    }) => !idsToRemove.has(buff_id));
                }
            }
        }

        for (const [source, buffs] of Object.entries(activeBuffs)) {
            switch (source) {
                case 'starbase':
                    await this.renderEfficiencyTable(`#building-${tag}-efficiencies-table`, 'mustache-efficiency-building', buffs);
                    break;

                case 'research':
                    await this.renderEfficiencyTable(`#research-${tag}-efficiencies-table`, 'mustache-efficiency-research', buffs);
                    break;

                case 'consumables':
                    await this.renderEfficiencyTable(`#consumable-${tag}-efficiencies-table`, 'mustache-efficiency-consumable', buffs);
                    break;

                case 'exocomp':
                    await this.renderEfficiencyTable(`#exocomp-${tag}-efficiencies-table`, 'mustache-efficiency-exocomp', buffs);
                    break;

                default:
                    break;
            }
        }

        if (Object.keys(miscBuffs).length > 0) {
            await this.renderEfficiencyTable(`#misc-${tag}-efficiencies-table`, 'mustache-efficiency-misc', miscBuffs);
        }

        const researchTable = $(`#research-${tag}-efficiencies-table`);
        researchTable.find('.fc-checkbox-slot').on('change', event => {
            if (this.abortController.signal.aborted) {
                $().off(event);
                return;
            }

            const checkboxes = $(`.fc-checkbox-slot[data-setting-type="fleet_commander:slotted"][data-setting-id="${event.target.dataset.settingId}"]`);
            checkboxes.not(event.target).prop('checked', event.target.checked);
            this.checkConditionalBuffs(checkboxes.siblings('select.conditional-buff'));
        });

        researchTable.find('.fc-radio-select').on('change', event => {
            if (this.abortController.signal.aborted) {
                $().off(event);
                return;
            }

            this.checkConditionalBuffs($(`input[type=radio][name="${event.target.name}"]`).closest('div.input-group').children('select.conditional-buff'));
        });

        $('#building-repair-efficiencies-table').find('.drydock-radio-select').on('change', event => {
            if (this.abortController.signal.aborted) {
                $().off(event);
                return;
            }

            const radio = event.target;
            $(`input[type=radio][name="${radio.name}"]`).not(radio).closest('div.upgrade-efficiency-group').find('select.conditional-buff').attr('data-buff-active', 0);
            $(radio).closest('div.upgrade-efficiency-group').find('select.conditional-buff').attr('data-buff-active', Number(radio.checked));
        });

        $('#operations-range[data-update-handler-installed!="1"]')
            .attr('data-update-handler-installed', 1)
            .on('input', event => {
                if (this.abortController.signal.aborted) {
                    $().off(event);
                    return;
                }

                $('#operations-range-value').text(event.target.value);
            })
            .on('change applied.spock.settings', event => {
                if (this.abortController.signal.aborted) {
                    $().off(event);
                    return;
                }

                this.updateLevelBanding(
                    $('select.setting-input[data-setting-type="consumable"], select.setting-input[data-setting-type="syndicate"], select.setting-input[data-setting-type="alliance_syndicate"], select.setting-input[data-setting-type="territory_service"]'),
                    Number(event.target.value)
                );
            });

        $('#syndicate-range[data-update-handler-installed!="1"]')
            .attr('data-update-handler-installed', 1)
            .on('input', event => {
                if (this.abortController.signal.aborted) {
                    $().off(event);
                    return;
                }

                $('#syndicate-range-value').text(event.target.value);
            })
            .on('change applied.spock.settings', event => {
                if (this.abortController.signal.aborted) {
                    $().off(event);
                    return;
                }

                this.updateLevelBanding(
                    $('select.setting-input[data-setting-type="syndicate"]'),
                    undefined,
                    Number(event.target.value)
                );
            });

        $('#alliance-syndicate-range[data-update-handler-installed!="1"]')
            .attr('data-update-handler-installed', 1)
            .on('input', event => {
                if (this.abortController.signal.aborted) {
                    $().off(event);
                    return;
                }

                $('#alliance-syndicate-range-value').text(event.target.value);
            })
            .on('change applied.spock.settings', event => {
                if (this.abortController.signal.aborted) {
                    $().off(event);
                    return;
                }

                this.updateLevelBanding(
                    $('select.setting-input[data-setting-type="alliance_syndicate"]'),
                    undefined,
                    Number(event.target.value)
                );
            });

        $(document).on('loaded.spock.settings', /** jQuery.Event */ event => {
            if (this.abortController.signal.aborted) {
                $().off(event);
                return;
            }

            this.calculateBonuses();
            $('#cost-calc-body, #requirements-body, #allocation-cost-efficiencies').trigger('updated.spock.efficiencies', [this]);
        });

        $('.setting-input.upgrade-efficiency-source[data-update-handler-installed!="1"], .setting-input.repair-efficiency-source[data-update-handler-installed!="1"]')
            .attr('data-update-handler-installed', 1)
            .on('change', /** jQuery.Event */ event => {
                if (this.abortController.signal.aborted) {
                    $().off(event);
                    return;
                }

                if (event.target.classList.contains('buff-group')) {
                    const level = Number(event.target.selectedOptions[0].dataset.level);

                    if (!Number.isNaN(level)) {
                        $(event.target)
                            .siblings('select.buff-group')
                            .find(`option[data-level="${level}"]`).prop('selected', true);
                    }
                }

                this.calculateBonuses();
                $(event.target).trigger('updated.spock.efficiencies', [this]);
            });
    }

    /**
     * Helper function for rendering an efficiency table
     *
     * @param {string} tableSelector
     * @param {string} templateId
     * @param {Array<object>} buffs
     */
    async renderEfficiencyTable(tableSelector, templateId, buffs) {
        const table = $(tableSelector).children('tbody');
        const template = document.getElementById(templateId)?.innerHTML;

        if (table.length === 0 || template === undefined) {
            console.error(`Failed to render table ${tableSelector} using template ${templateId}`);
            return;
        }

        let resources = new Set();
        for (const buffArray of Object.values(buffs)) {
            for (const buff of buffArray) {
                if (buff.attributes.resources !== undefined) {
                    resources = resources.union(new Set(buff.attributes.resources));
                }

                if (buff.additional_buffs !== undefined) {
                    resources = resources.union(new Set(buff.additional_buffs.flatMap(({
                        attributes
                    }) => attributes.resources ?? [])));
                }
            }
        }

        // pre-load resources
        resources = new Set(resources);
        const resourceMap = new Map((await Array.fromAsync(getResources(resources))).map(resource => [resource.id, resource]));

        const content = Mustache.render(template, {
            ...buffs,
            divider: function() {
                return function(text, render) {
                    const content = render(text);
                    if (content === undefined || content.trim() === '') {
                        return '';
                    }

                    return content + '<tr class="efficiency-table-divider"><td class="p-1 max-colspan" colspan="6"><hr class="m-1"></td></tr>';
                }
            },
            efficiencyIcon: function() {
                if (this.additional_buffs !== undefined) {
                    const modifiers = new Set([this.modifier_code, ...this.additional_buffs.map(({
                        modifier_code
                    }) => modifier_code)]);
                    return [...modifiers].map(mod => Efficiencies.getEfficiencyIcon(mod)).join('/');
                }

                return Efficiencies.getEfficiencyIcon(this.modifier_code);
            },
            resourceRestrictions: function() {
                if ((this.attributes ?.resources === undefined || this.attributes ?.resources.length === 0) && this.additional_buffs === undefined) {
                    return;
                }

                const resources = new Set([...(this.attributes.resources ?? []), ...(this.additional_buffs ?.flatMap(({
                    attributes
                }) => attributes ?.resources ?? []) ?? [])]);
                //const resourceMap = getResourceMap();

                return [...[...resources]
                        .map(resourceId => resourceMap ?.get(resourceId))
                        .sort(({
                            sorting_key: a
                        }, {
                            sorting_key: b
                        }) => a.localeCompare(b))
                        .reduce(( /** Set */ acc, cur) => acc.add(cur.art_id), new Set())
                    ]
                    .map(artId => `<img class="resource-icon object-fit-scale me-0" style="max-height: 18px;" src="/assets/prime/resources/${artId}.png">`)
                    .join('');
            },
            consumableCategory: function() {
                if (this.source_data ?.custom_category) {
                    return this.source_data.custom_category;
                }

                switch (this.source_data ?.category) {
                    case 1056678826:
                        return 'Galaxy';
                    case 2950573209:
                        return 'Station';
                    case 1870147103:
                        return 'Combat';
                    case 3015541956:
                        return 'Alliance Galaxy';
                    case 962322620:
                        return 'Alliance Station';
                    case 2609345038:
                        return 'Alliance Combat';
                    case 3306469306:
                        return 'Incursion Galaxy';
                    case 851535659:
                        return 'Incursion Combat';
                    case 3777668171:
                        return 'Prime';
                    case 4237677914:
                        return 'Independent Archive';
                    case 2007884498:
                        return 'Forge Consumable';
                    case ConsumableCategory.HijackedRefits:
                        return 'Hijacked Refits';
                    default:
                        return undefined;
                }
            },
            rarity: function() {
                switch (this.source_data ?.rarity) {
                    case 1:
                        return 'Common';
                    case 2:
                        return 'Uncommon';
                    case 3:
                        return 'Rare';
                    case 4:
                        return 'Epic';
                    default:
                        return undefined;
                }
            },
            levelOptions: function() {
                return this.source_data ?.levels !== undefined ? Efficiencies.generateLevelOptions(this) : Efficiencies.generateConsolidatedLevelOptions(this);
            }
        });

        table.html(content);
        const conditionalBuffs = table.find('.conditional-buff');

        conditionalBuffs
            .siblings('.fc-checkbox-slot')
            .on('applied.spock.settings', /** jQuery.Event */ event => {
                if (this.abortController.signal.aborted) {
                    $().off(event);
                    return;
                }

                this.checkConditionalBuffs($(event.target).siblings('.conditional-buff'));
            });

        conditionalBuffs
            .siblings('div.input-group-text')
            .children('.fc-radio-select')
            .on('applied.spock.settings', /** jQuery.Event */ event => {
                if (this.abortController.signal.aborted) {
                    $().off(event);
                    return;
                }

                this.checkConditionalBuffs($(event.target).parent().siblings('.conditional-buff'));
            });
    }

    /**
     * Helper function for rendering the cumulative bonuses table
     *
     * @param {string} tag
     * @param {Map.<number, Counter>} bonuses
     * @param {{base_cost: Counter, base_time: Counter, net_cost?: Counter, net_time?: Counter}} cost
     * @returns {Promise<void>}
     */
    async buildCumulativeEfficiencyTable(tag, bonuses, cost) {
        const tableBody = $(`#${tag}-efficiency-rows`).empty();
        const utilizedResources = (new Set(cost.base_cost.keys())).union(cost.base_time);

        let rows = new Map();
        for (const modifier of [...bonuses.keys()].sort((a, b) => a - b)) {
            for (const [resource, value] of bonuses.get(modifier)[3]) {
                if (!utilizedResources.has(resource)) {
                    continue;
                }

                let row = rows.get(resource) || rows.set(resource, []).get(resource);
                row.push({
                    icon: Efficiencies.getEfficiencyIcon(modifier),
                    modifier: modifier,
                    bonus: value
                });
            }
        }

        if (rows.size === 0) {
            tableBody.html(`<tr><td colspan="3"><i class="fa-solid fa-circle-info me-1"></i>No applicable ${tag} efficiency bonuses found</td></tr>`);
            return;
        }

        const resources = (await Promise.all([...rows.keys()].map(r => TimeResourceIds[r] || fetchResource(r))))
            .sort(({
                sorting_key: a
            }, {
                sorting_key: b
            }) => a.localeCompare(b));

        for (const {
                id
            } of resources) {
            const values = rows.get(id);
            const bonuses = values
                .map(({
                    icon,
                    modifier,
                    bonus
                }) => `<span class="${tag}-efficiency-bonus-span">${icon} <span class="${tag}-efficiency format-num" data-modifier="${modifier}" data-resource="${id}" data-amount="${bonus}" data-format="percent">${bonus}</span></span>`)
                .join('<div class="vr ms-2"></div>');

            tableBody.append(`<tr><td class="lookup-resource" data-resource="${id}"></td><td class="align-middle">${bonuses}</td></tr>`);
        }

        $('.bonuses-table-settings-btn')
            .on('inserted.bs.popover', event => {
                const popover = document.getElementById(event.target.attributes['aria-describedby'] ?.value);
                const body = popover ?.querySelector('.popover-body');
                const div = document.getElementById('container-settings-popover-bonuses') ?.querySelector('div');

                if (body !== null && div !== null) {
                    body.innerHTML = '';
                    body.appendChild(div);
                }
            }).on('hide.bs.popover', event => {
                const popover = document.getElementById(event.target.attributes['aria-describedby'] ?.value);
                const div = popover ?.querySelector('.popover-body > div');
                const container = document.getElementById('container-settings-popover-bonuses');

                if (div !== null && container !== null) {
                    container.innerHTML = '';
                    container.appendChild(div);
                }
            });
    }

    /**
     *
     * @param {...BuffContext} context
     * @returns {{bonuses: Map.<number, Counter.<number, number>>, buffIds: Set.<number>}}
     */
    prepareBonuses(...context) {
        const activeBuffs = new Set();
        const bonusesByModifier = new Map();

        for (const ctx of context) {
            let resourceEffAvailable = new Set();

            for (let [modifier, buffs] of [...Object.values(this.buffs)].flatMap(Object.entries)) {
                modifier = BuffModifier[modifier];
                if (ctx.modifier !== modifier) {
                    continue;
                }

                for (const buff of buffs.filter(buff => ctx.applies(buff))) {
                    activeBuffs.add(buff.buff_id);

                    if (buff.attributes ?.resources !== undefined) {
                        resourceEffAvailable = resourceEffAvailable.union(new Set(buff.attributes.resources));
                    } else if (ctx.resources !== undefined) {
                        resourceEffAvailable = resourceEffAvailable.union(ctx.resources);
                    } else {
                        let timeResources;

                        switch (modifier) {
                            case BuffModifier.ModStarbaseModuleConstructionCost:
                                timeResources = TimeResources.building;
                                break;
                            case BuffModifier.ModResearchCost:
                                timeResources = TimeResources.research;
                                break;
                            case BuffModifier.ModShipConstructionSpeed:
                                timeResources = TimeResources.ship_construction;
                                break;
                            case BuffModifier.ModTierUpSpeed:
                                timeResources = TimeResources.ship_tier_up;
                                break;
                            case BuffModifier.ModRepairTime:
                                timeResources = TimeResources.ship_repair;
                                break;
                            case BuffModifier.ModShipScrapSpeed:
                                timeResources = TimeResources.ship_scrap;
                                break;
                            default:
                                continue;
                        }

                        for (const id of [...Object.values(timeResources)].map(({
                                id
                            }) => id)) {
                            resourceEffAvailable.add(id);
                        }
                    }
                }
            }

            bonusesByModifier.set(ctx.modifier, {
                3: new Counter([...resourceEffAvailable].map(id => [id, 0.0])),
                7: new Counter([...resourceEffAvailable].map(id => [id, 0.0]))
            });
        }

        return {
            bonuses: bonusesByModifier,
            buffIds: activeBuffs
        };
    }

    /**
     * Calculate bonuses taking selected settings into account
     */
    calculateBonuses() {
        const groups = Object.groupBy(this.context, ({
            modifier
        }) => this.constructor.getEfficiencyTag(modifier));

        for (const [tag, context] of Object.entries(groups)) {
            // Calculate cost efficiency bonus values
            const allEfficiencies = $(`.${tag}-efficiency-source`).map(function() {
                let value = Number($(this).val());

                if (this.classList.contains('disabled-buff') || (this.classList.contains('conditional-buff') && Number(this.dataset.buffActive) !== 1) || (this.type === 'checkbox' && !this.checked)) {
                    value = 0.0;
                }

                return {
                    buff_id: Number(this.dataset.buff),
                    modifier: Number(this.dataset.modifier),
                    op: Number(this.dataset.op),
                    value: value,
                    resources: new Set(JSON.parse(this.dataset.resources))
                };
            }).get();

            // Update bonus map
            if (!this.bonuses.hasOwnProperty(tag)) {
                this.bonuses[tag] = new Map();
            }

            for (const ctx of context) {
                for (const resourceId of ctx.resources) {
                    const applicableEfficiencies = allEfficiencies
                        .filter(({
                            modifier,
                            resources
                        }) => modifier === ctx.modifier && (resources.has(resourceId) || resources.size === 0));

                    const bonus = applicableEfficiencies
                        .filter(({
                            op
                        }) => op === 3)
                        .map(({
                            value
                        }) => value)
                        .reduce((acc, curr) => acc + curr, 0.0);

                    const trueBonus = applicableEfficiencies
                        .filter(({
                            op
                        }) => op === 7)
                        .map(({
                            value
                        }) => value)
                        .reduce((acc, curr) => acc + curr, 0.0);

                    if (Number.isNaN(bonus) || bonus === undefined) {
                        continue;
                    }

                    const bonuses = this.bonuses[tag].get(ctx.modifier);
                    if (bonuses === undefined) {
                        this.bonuses[tag].set(ctx.modifier, {
                            3: new Counter([
                                [resourceId, bonus]
                            ]),
                            7: new Counter([
                                [resourceId, bonus]
                            ])
                        });
                    } else {
                        bonuses[3].set(resourceId, bonus);
                        bonuses[7].set(resourceId, trueBonus);
                    }
                }
            }

            // Update cumulative efficiencies table (if present)
            $(`#cumulative-${tag}-efficiencies-table > tbody > tr span.${tag}-efficiency-bonus-span`).each(( /** Number */ index, /** HTMLElement */ row) => {
                const valueEl = row.querySelector(`span.${tag}-efficiency`);
                const modifierCode = Number(valueEl ?.dataset.modifier);
                const resourceId = Number(valueEl ?.dataset.resource);

                if (valueEl === null || Number.isNaN(modifierCode) || Number.isNaN(resourceId)) {
                    return;
                }

                const bonuses = this.bonuses[tag] ?.get(modifierCode);
                if (bonuses === undefined) {
                    return;
                }

                const stdBonus = bonuses[3] ?.get(resourceId) ?? 0;
                const trueBonus = bonuses[7] ?.get(resourceId) ?? 0;
                const style = {
                    style: 'percent',
                    maximumFractionDigits: 0
                };

                if (trueBonus > 0) {
                    const bonus = stdBonus * (1 + trueBonus);

                    valueEl.classList.remove('format-num');
                    valueEl.dataset.amount = Math.round(bonus);
                    valueEl.innerHTML = `&approx; ${bonus.toLocaleString(undefined, style)} <i class="fa-duotone fa-info-circle ms-1 mt-1" data-bs-toggle="tooltip" data-bs-placement="right" data-bs-title="Bonus includes ${stdBonus.toLocaleString(undefined, style)} standard and ${trueBonus.toLocaleString(undefined, style)} true efficiency"></i>`;
                } else {
                    valueEl.classList.add('format-num');
                    valueEl.dataset.amount = stdBonus;
                    valueEl.textContent = stdBonus.toLocaleString(undefined, style);
                }
            });
        }
    }

    /**
     * Apply efficiency bonuses
     *
     * @param {Counter} cost
     * @param {BuffContext} context
     * @returns {Counter}
     */
    apply(cost, context) {
        if (cost.size === 0) {
            return cost;
        }

        const bonusCategory = this.bonuses[this.constructor.getEfficiencyTag(context.modifier)];
        if (bonusCategory === undefined) {
            return cost;
        }

        const bonuses = bonusCategory.get(context.modifier);
        if (bonuses === undefined || !bonuses.hasOwnProperty('3') || !bonuses.hasOwnProperty('7')) {
            return cost;
        }

        const stdBonuses = bonuses[3];
        const trueBonuses = bonuses[7];

        const buffedValues = new Counter();

        for (const [resource, amount] of cost) {
            const bonus = stdBonuses ?.get(resource) ?? 0;
            const trueBonus = trueBonuses ?.get(resource) ?? 0;

            if (bonus <= 0.0 && trueBonus <= 0.0) {
                buffedValues.set(resource, amount);
            } else {
                buffedValues.set(resource, Math.round((amount / (1.0 + bonus)) / (1.0 + trueBonus)));
            }
        }

        return buffedValues;
    }

    /**
     * Get cost efficiency bonus value
     *
     * @param {number} modifier
     * @param {number} resource
     * @returns {number}
     */
    bonus(modifier, resource) {
        const bonusCategory = this.bonuses[this.constructor.getEfficiencyTag(modifier)];
        if (bonusCategory === undefined) {
            return 0;
        }

        const bonuses = bonusCategory.get(modifier);
        if (bonuses === undefined) {
            return 0;
        }

        const stdBonus = bonuses[3] ?.get(resource) ?? 0;
        const trueBonus = bonuses[7] ?.get(resource) ?? 0;
        return stdBonus * (1.0 + trueBonus);
    }

    /**
     *
     * @param {jQuery} selector
     */
    checkConditionalBuffs(selector) {
        let updateRequired = false;

        selector.each((index, element) => {
            const buff = $(element);
            const checkbox = buff.siblings('.fc-checkbox-slot');
            const radio = buff.parent().find('.fc-radio-select');

            const active = checkbox.prop('checked') && (radio.length === 0 || radio.prop('checked'));
            const oldValue = Boolean(Number(element.dataset.buffActive));

            if (active !== oldValue) {
                element.dataset.buffActive = Number(active);
                updateRequired = true;
            }
        });

        if (updateRequired) {
            this.calculateBonuses();
            $('#cost-calc-body, #requirements-body, #allocation-cost-efficiencies').trigger('updated.spock.efficiencies', [this]);
        }
    }

    /**
     *
     * @param {jQuery} selector
     * @param {Number} [level]
     * @param {Number} [syndicate]
     */
    updateLevelBanding(selector, level = undefined, syndicate = undefined) {
        let triggerUpdate = false;

        if (level !== undefined) {
            selector.children('option').each((index, element) => {
                if (Number(element.dataset.level) === 0) {
                    return;
                }

                const minLevel = Number(element.dataset.minLevel);
                const maxLevel = Number(element.dataset.maxLevel);

                if (isNaN(minLevel) || isNaN(maxLevel)) {
                    return;
                }

                element.disabled = !(minLevel <= level && maxLevel >= level);
            });
        }

        if (syndicate !== undefined) {
            selector.each((index, element) => {
                const tier = Number(element.dataset.level);
                const el = $(element);

                if (tier > syndicate) {
                    if (el.val() != 0) {
                        $(element).val(0);
                        triggerUpdate = true;
                    }
                } else {
                    $(element).children('option[data-level!=0]:enabled').prop('selected', true);
                    triggerUpdate = true;
                }
            });
        }

        if (triggerUpdate) {
            this.calculateBonuses();
            $('#cost-calc-body, #requirements-body, #allocation-cost-efficiencies').trigger('updated.spock.efficiencies', [this]);
        }
    }
}
