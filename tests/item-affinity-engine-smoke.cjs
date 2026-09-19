const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

(async () => {
  delete globalThis.LuminousItemAffinityEngine;
  await import(pathToFileURL(path.resolve(__dirname, '../js/item-affinity-engine.js')).href);
  const affinity = globalThis.LuminousItemAffinityEngine;

  assert.ok(affinity);
  assert.equal(affinity.VERSION, 2);
  assert.equal(affinity.CANONICAL_AFFINITY_TOTAL, 100);
  assert.equal(affinity.TARGET_BRANCH.arcana, 'int');
  assert.equal(affinity.TARGET_BRANCH.survival, 'wis');
  assert.equal(affinity.TARGET_BRANCH.con_save, 'con');

  const item = {
    id: 'test_ingredient',
    culinaryAffinities: {
      survival: 50,
      arcana: 30,
      con_save: 20,
      invalid_target: 99,
    },
  };

  const entries = affinity.normalizeAffinityEntries(item);
  assert.deepEqual(entries.map((entry) => [entry.target, entry.weight, entry.branch]), [
    ['arcana', 30, 'int'],
    ['con_save', 20, 'con'],
    ['survival', 50, 'wis'],
  ]);
  assert.equal(affinity.affinityTotal(item), 100);
  assert.equal(affinity.isCanonicalAffinityDistribution(item), true);
  assert.equal(affinity.isCanonicalAffinityDistribution({ arcana: 40, survival: 20 }), false);

  const normalized = affinity.normalizedAffinityPercentages(item);
  assert.deepEqual(normalized.map((entry) => [entry.target, entry.percent]), [
    ['arcana', 30],
    ['con_save', 20],
    ['survival', 50],
  ]);

  assert.deepEqual(affinity.branchAffinityWeights(item), {
    int: 30,
    con: 20,
    wis: 50,
  });

  assert.equal(affinity.pickWeightedAffinity(item, { roll: 0.00 }).target, 'arcana');
  assert.equal(affinity.pickWeightedAffinity(item, { roll: 0.29 }).target, 'arcana');
  assert.equal(affinity.pickWeightedAffinity(item, { roll: 0.30 }).target, 'con_save');
  assert.equal(affinity.pickWeightedAffinity(item, { roll: 0.49 }).target, 'con_save');
  assert.equal(affinity.pickWeightedAffinity(item, { roll: 0.50 }).target, 'survival');
  assert.equal(affinity.pickWeightedAffinity(item, { roll: 0.99 }).target, 'survival');

  const nonNormalized = {
    culinaryAffinities: {
      arcana: 10,
      history: 10,
      survival: 5,
    },
  };
  const profile = affinity.affinityProfile(nonNormalized);
  assert.equal(profile.totalWeight, 25);
  assert.deepEqual(profile.branchWeights, { int: 20, wis: 5 });
  assert.deepEqual(
    profile.normalizedPercentages.map((entry) => [entry.target, entry.percent]),
    [['arcana', 40], ['history', 40], ['survival', 20]]
  );

  const instance = affinity.materializeCulinaryAffinity(item, {
    sourceInstanceId: 'ingredient-instance-a',
    roll: 0.30,
  });
  assert.equal(instance.culinaryProperties.length, 1);
  assert.equal(instance.culinaryProperties[0].target, 'con_save');
  assert.equal(instance.culinaryProperties[0].sourceInstanceId, 'ingredient-instance-a');
  assert.equal(instance.culinaryProperties[0].affinityBranch, 'con');
  assert.equal(Object.hasOwn(instance.culinaryProperties[0], 'affinityWeight'), false);

  const processed = affinity.materializeCulinaryAffinity({
    id: 'processed_test_ingredient',
    culinaryAffinities: { arcana: 100 },
    sourceInstanceId: 'ingredient-instance-a',
    culinaryProperties: instance.culinaryProperties,
  }, {
    roll: 0.0,
  });
  assert.equal(processed.culinaryProperties[0].target, 'con_save');
  assert.equal(processed.culinaryProperties[0].sourceInstanceId, 'ingredient-instance-a');

  console.log('Item Affinity V1 smoke: OK (weights, branch projection, RNG and provenance)');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
