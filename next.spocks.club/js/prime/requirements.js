'use strict';

import {
  API_BASE_URL
} from '../common.js';
import {
  RequirementType
} from './common.js';

/** @type {{number: object[]}} */
export const requirementData = {
  [RequirementType.Building]: null,
  [RequirementType.Research]: null
};

/** @type {{number: Map.<number, object>}} */
const levelRequirementsCache = {
  [RequirementType.Building]: new Map(),
  [RequirementType.Research]: new Map()
};

/** @type {{number: Map.<number, object[]>}} */
const translationData = {
  [RequirementType.Building]: new Map(),
  [RequirementType.Research]: new Map()
};

/** @type {{number: ?PromiseWithResolvers}} */
const dataLoading = {
  [RequirementType.Building]: null,
  [RequirementType.Research]: null
};


/**
 * @typedef Requirement
 * @type {Object}
 * @property {number} requirement_type
 * @property {number} requirement_id
 * @property {number} requirement_level
 */

/**
 * @param {number} requirement_type
 * @returns {Promise<Array>}
 */
async function fetchRequirementData(requirement_type) {
  if (requirementData[requirement_type] === undefined) {
    return;
  }

  if (requirementData[requirement_type] !== null) {
    return requirementData[requirement_type];
  }

  if (dataLoading[requirement_type] === null) {
    let dataUrl, translationUrl, translationKey;
    dataLoading[requirement_type] = Promise.withResolvers();

    switch (Number(requirement_type)) {
    case RequirementType.Building:
      dataUrl = `${API_BASE_URL}/building`;
      translationUrl = `${API_BASE_URL}/translations/en/buildings`;
      translationKey = 'starbase_module';
      break;

    case RequirementType.Research:
      dataUrl = `${API_BASE_URL}/research`;
      translationUrl = `${API_BASE_URL}/translations/en/researches`;
      translationKey = 'research_project_name';
      break;

    case RequirementType.FactionRank:
      dataUrl = `${API_BASE_URL}/v1/factions`;
      translationUrl = `${API_BASE_URL}/translations/en/factions`;
      translationKey = 'faction_name';
      break;

    case RequirementType.OfficerRank:
    case RequirementType.OfficerLevel:
      dataUrl = `${API_BASE_URL}/officer`;
      translationUrl = `${API_BASE_URL}/translations/en/officers`;
      translationKey = 'officer_name_short';
      break;

    case RequirementType.ShipTier:
      dataUrl = `${API_BASE_URL}/ship`;
      translationUrl = `${API_BASE_URL}/translations/en/ships`;
      translationKey = 'ship_name';
      break;

    default:
      dataLoading[requirement_type].resolve([]);
      return [];
    }

    try {
      const [data, translations] = await Promise.all([
        $.getJSON(dataUrl),
        $.getJSON(translationUrl)
      ]);

      requirementData[requirement_type] = data;
      translationData[requirement_type] = new Map(translations.filter(({
        key
      }) => key.startsWith(translationKey)).map(({
        id,
        text
      }) => [Number(id), text]));

      dataLoading[requirement_type].resolve(data);
    } catch (e) {
      dataLoading[requirement_type].reject(e);
      throw e;
    }
  } else {
    await dataLoading[requirement_type];
  }

  return requirementData[requirement_type];
}

/**
 * @param {Requirement} requirement
 * @returns {Promise<string>}
 */
async function fetchRequirementTranslation(requirement) {
  await fetchRequirementData(requirement.requirement_type);
  return translationData[requirement.requirement_type] ?.get(requirement.requirement_id) ?? 'Missing translation';
}

/**
 * @param {Requirement} target
 * @returns {Promise<Array.<Requirement>>}
 */
async function getRequirements(target) {
  const cache = levelRequirementsCache[target.requirement_type];
  const entry = cache ?.get(target.requirement_id);

  if (entry !== undefined) {
    return entry.get(target.requirement_level) ?? [];
  }

  const data = (await fetchRequirementData(target.requirement_type)) ?.find(({
    id
  }) => target.requirement_id === id);
  if (data === undefined) {
    return [];
  }

  const levelRequirements = new Map(data.levels.map(({
    id,
    requirements
  }) => [id, requirements.map(req => ({
    requirement_type: Number(req.requirement_type),
    requirement_id: Number(req.requirement_id),
    requirement_level: Number(req.requirement_level)
  }))]));

  cache.set(Number(data.id), levelRequirements);
  return levelRequirements.get(target.requirement_level) ?? [];
}

/**
 * Resolve requirements
 *
 * @param {Requirement} target
 * @returns {Promise<Map<number, number>>}
 */
async function getSatisfiedRequirements(target) {
  const satisfied = new Map([
    [target.requirement_id, target.requirement_level]
  ]);
  const queue = [target];

  while (queue.length > 0) {
    const req = queue.shift();
    if (req === undefined) {
      continue;
    }

    if (req.requirement_type !== RequirementType.Building && req.requirement_type !== RequirementType.Research) {
      continue;
    }

    // console.debug(`[0] Checking ${await fetchRequirementTranslation(req)} L${req.requirement_level}`);

    for (let i = req.requirement_level; i > 0; --i) {
      const requirements = (await getRequirements({ ...req,
        requirement_level: i
      })).filter(r => r.requirement_type === RequirementType.Building || r.requirement_type === RequirementType.Research);

      for (const r of requirements) {
        const level = satisfied.get(r.requirement_id);

        if (level === undefined) {
          // console.debug(`[1] Discovered new requirement ${await fetchRequirementTranslation(r)} L${r.requirement_level}`);
          queue.push(r);
        } else if (level < r.requirement_level) {
          // console.debug(`[2] Discovered higher requirement ${await fetchRequirementTranslation(r)} L${r.requirement_level}`);
          const index = queue.findIndex(({
            requirement_type,
            requirement_id
          }) => requirement_type === r.requirement_type && requirement_id === r.requirement_id);
          if (index !== -1) {
            queue[index] = r;
          } else {
            queue.push(r);
          }
        } else {
          // console.debug(`[3] Requirement ${name} L${r.requirement_level} is already covered by L${level}`);
          continue;
        }

        satisfied.set(r.requirement_id, r.requirement_level);
      }
    }
  }

  return satisfied;
}

/**
 * Resolve requirements
 *
 * @param {Array.<Requirement>} requirements
 * @param {Requirement} [limit]
 * @returns {Promise<Node>}
 */
export async function resolveRequirements(requirements, limit = undefined) {
  const tree = new TreeModel();
  let root, parent;

  const satisfied = new Map();
  const queue = [];

  let depth = 0;
  for (const req of requirements) {
    const node = tree.parse({
      depth: depth++,
      name: await fetchRequirementTranslation(req),
      ...req
    });

    if (parent === undefined) {
      root = node;
      parent = node;
    } else {
      parent.addChild(node);
      parent = node;
    }

    queue.push(node);
  }

  if (limit !== undefined) {
    const reqs = await getSatisfiedRequirements(limit);
    for (const [id, level] of reqs) {
      satisfied.set(id, new Set(Array.from({
        length: level
      }, (x, i) => i + 1)));
    }
  }

  while (queue.length > 0) {
    const node = queue.shift();
    if (node === undefined) {
      continue;
    }

    const req = node.model;

    if (satisfied.get(req.requirement_id) ?.has(req.requirement_level)) {
      // console.debug(`[1] ${debug.format_node(node)} skipped, requirement already satisfied.`);
      node.drop();
      continue;
    }

    // console.debug(`[2] Resolving ${debug.format_node(node)}...`);

    for (const r of await getRequirements(req)) {
      if (r.requirement_type !== RequirementType.Building && r.requirement_type !== RequirementType.Research) {
        continue;
      }

      // console.debug(`[3] Discovered ${await fetchRequirementTranslation(r)} L${req.requirement_level}`);
      const inQueue = queue.filter(({
        requirement_type,
        requirement_id
      }) => r.requirement_type === requirement_type && r.requirement_id === requirement_id);
      const completedLevels = satisfied.get(r.requirement_id);

      if (inQueue.some(({
        requirement_level
      }) => r.requirement_level === requirement_level) || completedLevels ?.has(r.requirement_level)) {
        // console.debug(`  -> [5] ${await fetchRequirementTranslation(r)} L${req.requirement_level} skipped, already in queue.`);
        continue;
      }

      const name = await fetchRequirementTranslation(r);
      const n = tree.parse({
        depth: req.depth + 1,
        name: name,
        ...r
      });
      node.addChild(n);
      queue.push(n);

      // console.debug(`  -> [4] ${debug.format_node(n)} added to queue.`);

      for (let i = r.requirement_level - 1, j = 2, k = n; i > 0; --i, ++j) {
        // console.debug(`  -> [6] Adding previous level ${name} L${i} to the queue.`);

        if (inQueue.some(({
          requirement_level
        }) => requirement_level === i) || completedLevels ?.has(i)) {
          // console.debug(`  -> [6] Adding previous level ${name} L${i} to the queue.`);
          break;
        }

        const p = tree.parse({
          depth: req.depth + j,
          name: name,
          ...r,
          requirement_level: i
        });
        k.addChild(p);
        queue.push(p);
        k = p;
      }
    }

    const levels = satisfied.get(req.requirement_id);
    if (levels !== undefined) {
      levels.add(req.requirement_level);
    } else {
      satisfied.set(req.requirement_id, new Set([req.requirement_level]));
    }
  }

  return root;
}

/**
 * Quickly resolve requirements until a certain target requirement
 * has been discovered. This may not necessarily be the highest level
 * of that target.
 *
 * @param {Array.<Requirement>} requirements
 * @param {Requirement} target
 * @returns {Promise<Array.<Requirement>>}
 */
export async function resolveRequirementsFast(requirements, target) {
  const result = [];
  const queue = [...requirements];

  while (queue.length > 0) {
    const requirement = queue.shift();
    if (requirement === null) {
      continue;
    }

    if (requirement.requirement_type !== RequirementType.Building && requirement.requirement_type !== RequirementType.Research) {
      continue;
    }

    result.push(requirement);

    if (requirement.requirement_type === target.requirement_type && requirement.requirement_id === target.requirement_id) {
      continue;
    }

    for (const req of await getRequirements(requirement)) {
      if (!queue.some(({
        requirement_type,
        requirement_id,
        requirement_level
      }) => requirement_type === req.requirement_type && requirement_id === req.requirement_id && requirement_level === req.requirement_level)) {
        queue.push(req);
      }
    }
  }

  return result;
}

const debug = {
  format_tree: function(root, depth = 0) {
    const lines = [('-'.repeat(depth)) + (depth > 0 ? ' ' : '') + this.format_node(root)];

    for (let i = 0, childCount = root.children.length; i < childCount; i++) {
      lines.push(...this.format_tree(root.children[i], depth + 1));
    }

    return lines;
  },
  format_node: function(node) {
    const name = node.model ?.name || fetchRequirementTranslation(node.model);
    return `${name} L${node.model.requirement_level} (#${node.model.requirement_id})`;
  },
  pprint_tree: function(root) {
    console.debug(this.format_tree(root, 0).join('\n'));
  },
  pprint_node: function(node) {
    console.debug(this.format_node(node));
  }
};
