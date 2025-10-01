'use strict';

import {
  API_BASE_URL
} from './api.js';

/**
 * An enumeration representing various translation categories, where each category is associated with a specific route.
 * The object is frozen to prevent modifications.
 */
export const TranslationCategory = Object.freeze({
  buildings: {
    route: 'buildings',
    supports_id: true
  },
  building_buffs: {
    route: 'building_buffs',
    supports_id: true
  },
  consumables: {
    route: 'consumables',
    supports_id: true
  },
  factions: {
    route: 'factions',
    supports_id: true
  },
  forbidden_tech: {
    route: 'forbidden_tech',
    supports_id: true
  },
  hostiles: {
    route: 'hostiles',
    supports_id: true
  },
  loyalty: {
    route: 'syndicates/raw',
    supports_id: false
  },
  officers: {
    route: 'officers',
    supports_id: true
  },
  researches: {
    route: 'researches',
    supports_id: true
  },
  research_trees: {
    route: 'research_trees',
    supports_id: false
  },
  resources: {
    route: 'resources',
    supports_id: true
  },
  ships: {
    route: 'ships',
    supports_id: true
  },
  ship_components: {
    route: 'ship_components',
    supports_id: true
  },
  synergy_groups: {
    route: 'synergies',
    supports_id: true
  },
  systems: {
    route: 'systems',
    supports_id: false
  },
  territory: {
    route: 'territory',
    supports_id: false
  },
  traits: {
    route: 'traits',
    supports_id: true
  }
});

/**
 * The `TranslationLoader` class is responsible for managing and loading translation data.
 * This includes fetching translation data for specified categories, ensuring that duplicate
 * fetch requests for the same category are avoided, and maintaining an internal cache of
 * translation data.
 *
 * This class is designed to optimize translation data retrieval by using promises and
 * locking mechanisms to handle concurrent fetch requests efficiently.
 */
export class TranslationLoader {
  static #idCache = {};
  static #locaCache = {};
  static #data = {};
  static #locks = {};
  static #procLocks = {};

  /**
     * Fetches translations for a specified category and language from the API.
     *
     * @param {string} category - The category of translations to retrieve.
     * @param {string} [language='en'] - The language code for the desired translations. Defaults to 'en'.
     * @return {Promise<Object>} A promise that resolves to the translation data object for the specified category and language, or an empty array in case of an error.
     */
  static async #fetch(category, language = 'en') {
    const url = `${API_BASE_URL}/translations/${language}/${category}`;

    try {
      return await $.getJSON(url);
    } catch (error) {
      console.error(`Error fetching '${language}' translations for ${category}: ${error?.status} ${error?.statusText}`);
    }

    return [];
  }

  /**
     * Fetches translations for the specified categories that are not already loaded.
     *
     * @param {Iterable.<string>} categories - The categories of translations to fetch.
     * @param {Iterable.<string>} languages - The languages to fetch translations in.
     * @return {Promise<void>} A promise that resolves when all missing categories have been fetched,
     * or rejects if there is an error in fetching any category.
     */
  static async #fetchAll(categories, languages) {
    const categoriesSet = new Set(categories);
    const promises = [];

    for (const language of languages) {
      if (this.#data[language] === undefined) {
        this.#data[language] = {};
      }

      const missingCategories = categoriesSet.difference(new Set(Object.keys(this.#data[language] ?? {})));
      for (const category of missingCategories) {
        if (this.#data[language][category] !== undefined) {
          continue;
        }

        if (this.#locks[language] === undefined) {
          this.#locks[language] = {};
        }

        if (this.#locks[language][category] === undefined) {
          this.#locks[language][category] = Promise.withResolvers();

          promises.push(
            this.#fetch(category, language)
              .then(data => {
                this.#data[language][category] = data;
                this.#locks[language][category].resolve();
              })
              .catch(error => {
                this.#data[language][category] = [];
                this.#locks[language][category].reject(error);
              })
          );
        } else {
          promises.push(this.#locks[language][category].promise);
        }
      }
    }

    await Promise.all(promises);
  }

  /**
     * Retrieves all raw data for a given category and language.
     *
     * @param {string} category - The category of data to retrieve.
     * @param {string} [language='en'] - The language of the data to retrieve. Defaults to 'en'.
     * @return {Object} The raw data object for the specified category and language.
     */
  static async getAllRaw(category, language = 'en') {
    await this.#fetchAll([category], [language]);
    return this.#data[language][category];
  }

  /**
     * Retrieves raw data for a specific category and ID, filtered by the specified language.
     *
     * @param {string} category - The category of the data to retrieve.
     * @param {number} id - The unique identifier of the specific item to return.
     * @param {string} [language='en'] - The language of the data to filter by. Defaults to 'en'.
     * @return {Iterable.<Object>|undefined} The raw data object matching the provided category and ID, or undefined if no match is found.
     */
  static async getRaw(category, id, language = 'en') {
    await this.#fetchAll([category], [language]);
    const data = this.#data[language][category];
    return data.filter(item => Number(item.id) === id);
  }

  /**
     * Retrieves all translations for a specific category and language, processes the data,
     * and caches the results for subsequent access.
     *
     * @param {string} category - The category of translations to retrieve.
     * @param {string} [language='en'] - The language of the translations to retrieve. Defaults to 'en'.
     * @return {Promise<Map<number, Map<string, string>>>} A promise that resolves to a nested `Map`.
     * The outer map's keys represent `loca_id` values, and the inner maps associate `translation_key` with corresponding text.
     */
  static async getAllByLoca(category, language = 'en') {
    if (this.#locaCache[language] === undefined) {
      this.#locaCache[language] = {};
    }

    if (this.#locaCache[language][category] !== undefined) {
      return this.#locaCache[language][category];
    }

    const lockKey = `${language}/${category}/loca`;
    if (this.#procLocks[lockKey] !== undefined) {
      return await this.#procLocks[lockKey].promise;
    } else {
      this.#procLocks[lockKey] = Promise.withResolvers();
    }

    await this.#fetchAll([category], [language]);
    const data = this.#data[language][category];
    const re = /(?<translation_key>.+)_(?<loca_id>\d+)$/;

    const translationMap = new Map();

    for (const item of data) {
      const key = item.key;
      const text = item.text;

      let translation_key;
      let loca_id;

      const match = key.match(re);
      if (match === null) {
        translation_key = key;
        loca_id = NaN;
      } else {
        translation_key = match.groups.translation_key;
        loca_id = Number(match.groups.loca_id);
      }

      const keyMap = translationMap.get(loca_id) ?? new Map();
      if (keyMap.size === 0) {
        translationMap.set(loca_id, keyMap);
      }

      keyMap.set(translation_key, text);
    }

    this.#locaCache[language][category] = translationMap;
    this.#procLocks[lockKey].resolve(translationMap);
    return translationMap;
  }

  /**
     * Retrieves a specific translation by loca ID.
     *
     * @param {string} category - The category of translations to retrieve.
     * @param {number} loca_id - The loca id for the localization entry.
     * @param {string} [language='en'] - The language code for the desired translations.
     * @return {Promise<Map<string, string>|undefined>} A promise that resolves to the translation string if found, or undefined if not found.
     */
  static async getKeysByLoca(category, loca_id, language = 'en') {
    const translationMap = await this.getAllByLoca(category, language);
    return translationMap ?.get(loca_id);
  }

  /**
     * Retrieves a translation for a specific key based on category, loca ID, and language.
     *
     * @param {string} category - The category to which the translation key belongs.
     * @param {number} loca_id - The loca ID used to determine the translations.
     * @param {string} key - The specific key to retrieve the translation for.
     * @param {?string} [fallback='Missing translation'] - The fallback string to return if the key is not found.
     * @param {string} [language='en'] - The language code to determine which language to use for the translation.
     * @return {Promise<string>} A promise that resolves to the translated string or the fallback if not found.
     */
  static async getByLoca(category, loca_id, key, fallback = 'Missing translation', language = 'en') {
    const translationKeys = await this.getKeysByLoca(category, loca_id, language);
    return translationKeys ?.get(key) ?? fallback;
  }

  /**
     * Retrieves all translations by their IDs for a specific category and language.
     *
     * @param {string} category - The category for which translations are being fetched.
     * @param {string} [language='en'] - The language in which translations are required. Defaults to 'en'.
     * @return {Promise<Map<number, Map<string, string>>>} A promise that resolves to a map where the key is the ID (number)
     *         and the value is another map with keys as translation keys (string)
     *         and values as translated text (string).
     */
  static async getAllById(category, language = 'en') {
    if (this.#idCache[language] === undefined) {
      this.#idCache[language] = {};
    }

    if (this.#idCache[language][category] !== undefined) {
      return this.#idCache[language][category];
    }

    const lockKey = `${language}/${category}/id`;
    if (this.#procLocks[lockKey] !== undefined) {
      return await this.#procLocks[lockKey].promise;
    } else {
      this.#procLocks[lockKey] = Promise.withResolvers();
    }

    await this.#fetchAll([category], [language]);
    const data = this.#data[language][category];
    const translationMap = new Map();

    for (const item of data) {
      const id = Number(item.id);
      const key = item.key;
      const text = item.text;

      const keyMap = translationMap.get(id) ?? new Map();
      if (keyMap.size === 0) {
        translationMap.set(id, keyMap);
      }

      keyMap.set(key, text);
    }

    this.#idCache[language][category] = translationMap;
    this.#procLocks[lockKey].resolve(translationMap);
    return translationMap;
  }

  /**
     * Retrieves a specific item by its ID within a given category and language.
     *
     * @param {string} category - The category to search within.
     * @param {number} id - The unique identifier of the item to retrieve.
     * @param {string} [language='en'] - The language in which to perform the retrieval. Defaults to 'en'.
     * @return {Promise<Map<string, string>|undefined>} A promise that resolves to the item corresponding to the given ID, or undefined if not found.
     */
  static async getKeysById(category, id, language = 'en') {
    const translationMap = await this.getAllById(category, language);
    return translationMap ?.get(id);
  }

  /**
     * Retrieves a translated value by its key and identifier.
     *
     * @param {string} category - The category to search within.
     * @param {number} id - The unique identifier of the item.
     * @param {string} key - The key for the translation lookup.
     * @param {?string} [fallback='Missing translation'] - The fallback value if no translation is found.
     * @param {string} [language='en'] - The desired language for the translation.
     * @return {Promise<string>} A promise that resolves to the translated value or the fallback value if no match is found.
     */
  static async getById(category, id, key, fallback = 'Missing translation', language = 'en') {
    const translationKeys = await this.getKeysById(category, id, language);

    for (const [k, v] of translationKeys) {
      const [loca] = k.split(/_(\d+)$/, 1);
      if (loca === key) {
        return v;
      }
    }

    return fallback;
  }
}

/**
 * Sanitizes the provided text by removing specific patterns including color tags, formatting placeholders,
 * and other unwanted elements, then trims the resulting text.
 *
 * @param {string} text - The text string to be sanitized.
 * @return {string} A sanitized version of the input text with unwanted elements removed.
 */
export function sanitizeText(text) {
  return text
    ?.replaceAll(/<color=#[a-fA-F0-9]+>(.*?)<\/color>/g, '$1')
    .replaceAll('+{0:P0}', '')
    .replaceAll(/\s\(\{\d+:#,.*:#,#}\)/g, '')
    .replaceAll('⇵', '★')
    .replaceAll('⇴', '⬧')
    .trim();
}
