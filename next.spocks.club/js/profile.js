'use strict';

import {
  format_duration,
  format_number,
  updateLabel
} from './common.js';

/**
 * @typedef Setting
 * @type {Object}
 * @property {!string}   type
 * @property {?string}   qualifier
 * @property {!number}   id
 */

export class Profile {
  updateQueue = [];
  userId = null;

  constructor() {
    if (Profile._instance) {
      return Profile._instance;
    }

    Profile._instance = this;

    const userId = Number($('#userid').val());
    if (userId > 0) {
      this.userId = userId;
    }

    addEventListener('beforeunload', event => {
      if (this.updateQueue.length > 0) {
        // event.preventDefault();
      }

      this.pushUpdates().catch(error => console.error(`Failed to push updates to remote: ${error.toLocaleString()}`));
    });
  }

  /**
     * Load settings from server
     *
     * @param {...Setting} settings
     * @return {Promise<Partial<Record<string, Setting[]>>>}
     */
  async #getData(...settings) {
    if (!this.isLoggedIn()) {
      throw new Error('Not logged in');
    }

    const data = await $.ajax({
      url: '/ajax.php',
      method: 'POST',
      data: {
        a: 101,
        json: JSON.stringify(settings)
      },
      dataType: 'json'
    });

    return Object.groupBy(data, ({
      type,
      qualifier
    }) => (qualifier === null) ? type : `${type}:${qualifier}`);
  }

  /**
     * Push setting updates to server
     *
     * @param {...Setting} settings
     * @return {Promise<void>}
     */
  async #updateData(...settings) {
    if (!this.isLoggedIn()) {
      throw new Error('Not logged in');
    }

    const aggregatedSettings = {};

    for (const [settingType, obj] of Object.entries(Object.groupBy(settings, ({
      type
    }) => type))) {
      aggregatedSettings[settingType] = {};

      for (const [settingQualifier, items] of Object.entries(Object.groupBy(obj, ({
        qualifier
      }) => qualifier))) {
        aggregatedSettings[settingType][settingQualifier] = [];

        for (const [idStr, settingGroup] of Object.entries(Object.groupBy(items, ({
          id
        }) => id))) {
          if (settingGroup.length === 1) {
            const {
              type,
              qualifier,
              id,
              ...values
            } = settingGroup[0];
            aggregatedSettings[settingType][settingQualifier].push({
              id: id,
              ...values
            });
          } else {
            const setting = Object.assign({}, ...settingGroup);
            aggregatedSettings[settingType][settingQualifier].push(setting);
          }
        }
      }
    }

    await $.ajax({
      url: '/ajax.php',
      method: 'POST',
      data: {
        a: 100,
        json: JSON.stringify(aggregatedSettings)
      },
      dataType: 'json'
    });
  }

  /**
     * Get settings from local storage
     *
     * @param {...Setting} settings
     * @return {{}}
     */
  #getLocalData(...settings) {
    // Not implemented yet
    return [];
  }

  /**
     * Update settings in local storage
     *
     * @param {...Setting} settings
     */
  #updateLocalData(...settings) {
    // Not implemented yet
  }

  /**
     * Check whether the user is logged in
     *
     * @return {boolean}
     */
  isLoggedIn() {
    return this.userId !== null;
  }

  /**
     * Load settings from local/remote storage
     *
     * @param {...Setting} settings
     * @return {Promise<Setting[]>}
     */
  async loadSettings(...settings) {
    const aggregatedSettings = [];
    const groups = Object.groupBy(settings, ({
      type
    }) => type);

    for (const [type, obj] of Object.entries(groups)) {
      for (const [qualifier, items] of Object.entries(Object.groupBy(obj, ({
        qualifier
      }) => qualifier))) {
        const ids = new Set(items.map(({
          id
        }) => id));
        aggregatedSettings.push({
          type: type,
          qualifier: qualifier === 'null' ? null : qualifier,
          ids: ids.has(-1) ? [-1] : Array.from(ids)
        });
      }
    }

    let values;
    let remoteValues = {};
    const localValues = this.#getLocalData(...settings);

    try {
      remoteValues = await this.#getData(...aggregatedSettings);
    } catch (e) {
      if (e instanceof Error) {
        console.warn(`Failed to fetch user settings: ${e.toLocaleString()}`);
      } else {
        let jqXHR, textStatus, errorThrown;
        e.fail((xhr, status, error) => {
          jqXHR = xhr;
          textStatus = status;
          errorThrown = error;
        });

        console.warn(`Failed to fetch user settings: ${textStatus}\n${errorThrown}`);
      }
    }

    if (localValues.length > 0) {
      //return $.extend(true, [], remoteValues, localValues);
      values = {};
    } else {
      values = remoteValues;
    }

    if (Object.keys(values).length > 0) {
      $(document).trigger('loaded.spock.settings', [values]);
    }

    return values;
  }

  /**
     * Update settings locally and queue updates
     *
     * @param {...Setting} settings
     */
  updateSettings(...settings) {
    this.#updateLocalData(...settings);
    this.updateQueue.push(...settings);
    console.debug(`${settings.length} setting(s) added to the update queue. ${this.updateQueue.length} unprocessed elements remaining.`);

    // TODO: don't push updates immediately; wait for user confirmation
    this.pushUpdates().catch(error => console.error(error));
  }

  /**
     *
     * @return {Promise<void>}
     */
  async pushUpdates() {
    if (this.updateQueue.length === 0) {
      return;
    }

    try {
      await this.#updateData(...this.updateQueue);
      console.debug(`pushUpdates(): Successfully updated ${this.updateQueue.length.toLocaleString()} settings.`);
      this.updateQueue.length = 0;
    } catch (e) {
      console.error(`pushUpdates(): Failed to update ${this.updateQueue.length.toLocaleString()} settings [${e.message}]`);
      return;
    }

    // TODO: Clear locally saved settings
  }
}

/**
 * Load settings that are present in the DOM by looking at
 * elements with .setting-display or .setting-input
 *
 * @param {Array.<Setting>} [settings=[]]   additional settings
 */
export async function loadSettings(settings = []) {
  $('.setting-display, .setting-input').each((i, el) => {
    const [type, qualifier] = el.dataset.settingType ?.split(':', 2) ?? [undefined, undefined];
    const id = Number(el.dataset.settingId);

    if (type !== undefined && !Number.isNaN(id)) {
      settings.push({
        type: type,
        qualifier: qualifier ?? null,
        id: id
      });
    }

    if (el.dataset.tiedBuildingId !== undefined) {
      settings.push({
        type: 'building',
        qualifier: null,
        id: Number(el.dataset.tiedBuildingId)
      });
    }

    if (el.dataset.tiedResearchId !== undefined) {
      settings.push({
        type: 'research',
        qualifier: null,
        id: Number(el.dataset.tiedResearchId)
      });
    }
  });

  const profile = new Profile();
  return await profile.loadSettings(...settings);
}

/**
 * @param {string}  settingType
 * @param {int}     id
 * @param {object}  values
 */
export function updateSetting(settingType, id, values) {
  const profile = new Profile();
  const [type, qualifier] = settingType.split(':', 2);

  profile.updateSettings({
    type: type,
    qualifier: qualifier ?? null,
    id,
    ...values
  });
}

/**
 * Helper function for updating settings in DOM
 *
 * @param  {HTMLElement}  element
 * @param  {Setting}      setting
 */
export function applySetting(element, setting) {
  const {
    type,
    qualifier,
    id,
    ...values
  } = setting;
  let key, value;

  if (element.dataset.settingKey !== undefined) {
    key = element.dataset.settingKey;
    value = values[key];
  } else {
    const keys = Object.keys(values);

    if (keys.length === 0) {
      console.warn(`applySetting(): failed to apply setting ${type} for keys ${JSON.stringify(keys)} to element #${element.id}`);
      return;
    } else if (keys.length === 1) {
      key = keys[0];
      value = values[key];
    }
  }

  if (value === undefined) {
    console.warn(`applySetting(): failed to apply setting ${type} (id=${id}, value=${JSON.stringify(value)}) on element #${element.id}`);
    return;
  }

  const el = $(element);

  if (element.dataset.settingTarget !== undefined) {
    const target = element.dataset.settingTarget;
    element.dataset[target] = value;
  } else {
    if (el.attr(`data-${key}`)) {
      el.attr(`data-${key}`, value);
    }

    switch (element.tagName) {
    case 'INPUT':
      if (element.type === 'checkbox') {
        element.checked = Boolean(value);
      } else if (element.type === 'radio') {
        if (setting.state !== undefined) {
          element.checked = setting.state;
        } else {
          element.checked = value.includes(Number(el.val()));
        }

      } else {
        el.val(value);
      }

      break;

    case 'SELECT':
      let optionSet = false;

      el.find('option').each((i, option) => {
        if (Number(option.dataset[key]) === value) {
          option.selected = true;
          optionSet = true;
          return false;
        }
      });

      if (!optionSet) {
        el.val(value);
      }

      break;

    default:
      if (element.classList.contains('format-num')) {
        element.textContent = format_number(Number(value), element.dataset.format);
      } else if (el.hasClass('format-duration')) {
        element.textContent = format_duration(Number(value));
      } else {
        element.textContent = Number(value).toLocaleString();
      }

      break;
    }
  }

  if (element.classList.contains('setting-trigger')) {
    $(element).trigger('applied.spock.settings', [setting]);
  }

  if (element.classList.contains('range-update-label')) {
    updateLabel(element);
  }
}

/**
 * Helper function for updating settings with tied attributes in DOM
 *
 * @param  {HTMLElement}  element
 * @param  {Map<string, Map<number, number>>} settings
 */
export function applyTiedSettings(element, settings) {
  let tiedSetting = null;

  if (element.dataset.tiedBuildingId !== undefined) {
    tiedSetting = {
      type: 'building',
      qualifier: null,
      id: Number(element.dataset.tiedBuildingId),
      level: settings.get('building') ?.get(Number(element.dataset.tiedBuildingId)) ?.level ?? 0,
      min_level: Number(element.dataset.tiedBuildingMinLevel)
    };
  } else if (element.dataset.tiedResearchId !== undefined) {
    tiedSetting = {
      type: 'research',
      qualifier: null,
      id: Number(element.dataset.tiedResearchId),
      level: settings.get('research') ?.get(Number(element.dataset.tiedResearchId)) ?.level ?? 0,
      min_level: Number(element.dataset.tiedResearchMinLevel)
    };
  }

  if (tiedSetting === null) {
    return;
  }

  if (element.tagName === 'INPUT') {
    const shouldCheck = tiedSetting.level >= tiedSetting.min_level;

    if (element.type === 'checkbox' || element.type === 'radio') {
      element.checked = shouldCheck;
    } else {
      console.warn(`applyTiedSettings(): failed to apply tied setting (${JSON.stringify(tiedSetting)}) on element #${element.id} [unsupported input type]`);
    }
  } else {
    console.warn(`applyTiedSettings(): failed to apply tied setting (${JSON.stringify(tiedSetting)}) on element #${element.id} [unsupported tag]`);
  }

  if (element.classList.contains('setting-trigger')) {
    $(element).trigger('applied.spock.settings', [tiedSetting]);
  }

  if (element.classList.contains('range-update-label')) {
    updateLabel(element);
  }
}

/**
 * Event handler for updating settings
 *
 * @param  {Event}  event
 */
function onSettingChanged(event) {
  const element = event.currentTarget;

  const settings = Object.keys(element.dataset).filter((key) => key.startsWith('setting')).reduce((result, attr) => {
    let key = attr.replace('setting', '');
    key = key.charAt(0).toLowerCase() + key.slice(1);
    const value = element.dataset[attr];

    result[key] = Number.isNaN(Number(value)) ? value : Number(value);
    return result;
  }, {});

  let value;
  if (element.tagName === 'INPUT' && (element.type === 'checkbox' || element.type === 'radio')) {
    value = element.checked;
  } else if (element.tagName === 'SELECT') {
    const option = element.querySelector('option:checked');
    if (option.dataset.level !== undefined) {
      settings.level = Number(option.dataset.level);
    }

    value = Number.isNaN(Number(option.value)) ? option.value : Number(option.value);
  } else {
    const v = $(element).val();
    const n = Number(v);
    value = Number.isNaN(n) ? v : n;
  }

  if (settings ?.key !== undefined) {
    settings[settings.key] = value;
    delete settings.key;
  } else {
    settings.value = value;
  }

  const {
    type,
    id,
    ...values
  } = settings;
  updateSetting(type, id, values);
}

/**
 * Install handlers for updating settings
 */
export function installHandlers() {
  for (const element of $('.setting-input[data-default-handler-installed!="1"]').not('.setting-custom-handler')) {
    $(element).on('change', onSettingChanged);
    element.dataset.defaultHandlerInstalled = '1';
  }
}

$(() => {
  /**
     * Event handler for loaded.spock.settings
     *
     * @param {jQuery.Event} event
     * @param settings
     */
  function onSettingsLoaded(event, settings) {
    const elements = $('.setting-display, .setting-input').not('.setting-custom-handler');
    const allSettings = new Map();

    for (const [type, values] of Object.entries(settings)) {
      const settings = new Map(values.map(o => [o.id, o]));
      allSettings.set(type, settings);
    }

    for (const [type, settings] of allSettings.entries()) {
      // check regular settings
      for (const element of elements.filter(`[data-setting-type="${type}"]`)) {
        const id = Number(element.dataset.settingId);
        if (Number.isNaN(id)) {
          continue;
        }

        const setting = settings.get(id);
        if (setting === undefined) {
          continue;
        }

        applySetting(element, setting);
      }

      // check settings tied to buildings/research
      let elementFilter;

      if (type === 'building') {
        elementFilter = '[data-tied-building-id]';
      } else if (type === 'research') {
        elementFilter = '[data-tied-research-id]';
      } else {
        continue;
      }

      for (const element of elements.filter(elementFilter)) {
        applyTiedSettings(element, allSettings);
      }
    }

    $(document).trigger('processed.spock.settings', [allSettings]);
  }

  // register default handlers
  $(document)
    .on('rendered.spock', installHandlers)
    .on('loaded.spock.settings', onSettingsLoaded);
});
