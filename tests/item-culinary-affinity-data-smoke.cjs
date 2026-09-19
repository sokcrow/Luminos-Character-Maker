const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

(async () => {
  delete globalThis.LuminousCulinaryAffinityCatalog;
  delete globalThis.LuminousItemAffinityEngine;

  await import(pathToFileURL(path.resolve(__dirname, '../js/item-affinity-engine.js')).href);
  await import(pathToFileURL(path.resolve(__dirname, '../js/item-culinary-affinity-data.js')).href);

  const engine = globalThis.LuminousItemAffinityEngine;
  const data = globalThis.LuminousCulinaryAffinityCatalog;

  assert.ok(engine);
  assert.ok(data);
  assert.equal(data.VERSION, 1);
  assert.equal(data.listItemIds().length, 115);
  assert.equal(new Set(data.listItemIds()).size, 115);

  for (const itemId of data.listItemIds()) {
    const affinities = data.get(itemId);
    assert.ok(affinities, `missing affinities for ${itemId}`);
    assert.equal(engine.isCanonicalAffinityDistribution(affinities), true, `affinity total must be 100 for ${itemId}`);
    for (const target of Object.keys(affinities)) {
      assert.equal(engine.VALID_TARGETS.has(target), true, `invalid target ${target} on ${itemId}`);
    }
  }

  assert.deepEqual(data.get('apple'), {
    survival: 30,
    con_save: 25,
    nature: 25,
    perception: 20,
  });
  assert.deepEqual(data.get('meat_wolf'), {
    survival: 35,
    athletics: 25,
    perception: 20,
    con_save: 20,
  });
  assert.deepEqual(data.get('meat_draconic'), {
    arcana: 30,
    con_save: 25,
    athletics: 25,
    int_save: 20,
  });

  const appleBranch = engine.branchAffinityWeights(data.get('apple'));
  assert.deepEqual(appleBranch, { wis: 50, con: 25, int: 25 });

  console.log('Culinary affinity data smoke: OK (115 items, canonical 100-point distributions)');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
