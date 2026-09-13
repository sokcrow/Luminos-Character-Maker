const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

(async () => {
  delete globalThis.LuminousItemQualityEngine;
  delete globalThis.LuminousMeatCatalog;

  await import(pathToFileURL(path.resolve(__dirname, '../js/item-quality-engine.js')).href);
  await import(pathToFileURL(path.resolve(__dirname, '../js/item-catalog-meat.js')).href);

  const quality = globalThis.LuminousItemQualityEngine;
  const meat = globalThis.LuminousMeatCatalog;

  assert.ok(quality);
  assert.ok(meat);
  assert.equal(meat.VERSION, 1);
  assert.equal(meat.FAMILY, 'meat');
  assert.equal(meat.CURRENCY, 'AHN');
  assert.equal(meat.DEFAULT_QUALITY, 'standard');
  assert.equal(meat.ITEMS.length, 39);
  assert.deepEqual(meat.ICON_FAMILIES, [
    'meat_mammal',
    'meat_bird',
    'meat_fish',
    'meat_shellfish',
    'meat_reptile',
    'meat_draconic',
    'meat_insectoid',
  ]);

  const ids = new Set();
  const names = new Set();
  for (const item of meat.ITEMS) {
    assert.equal(item.family, 'meat');
    assert.equal(item.category, 'ingredient');
    assert.equal(item.itemType, 'material');
    assert.equal(item.currency, 'AHN');
    assert.equal(item.baseQuality, 'standard');
    assert.equal(item.qualitySystem, 'universal');
    assert.equal(item.stackable, true);
    assert.equal(item.edibleRaw, true);
    assert.ok(item.priceAhn > 0);
    assert.ok(meat.ICON_FAMILIES.includes(item.iconFamily));
    assert.equal(ids.has(item.id), false, `duplicate id: ${item.id}`);
    assert.equal(names.has(item.name), false, `duplicate name: ${item.name}`);
    ids.add(item.id);
    names.add(item.name);
  }

  assert.equal(meat.get('meat_wolf').priceAhn, 180);
  assert.equal(meat.get('meat_draconic').priceAhn, 750);
  assert.equal(meat.get('meat_rodent').priceAhn, 60);
  assert.equal(meat.get('meat_wolf').iconFamily, 'meat_mammal');
  assert.equal(meat.get('meat_avian').iconFamily, 'meat_bird');
  assert.equal(meat.get('meat_fish').iconFamily, 'meat_fish');
  assert.equal(meat.get('meat_crustacean').iconFamily, 'meat_shellfish');
  assert.equal(meat.get('meat_reptilian').iconFamily, 'meat_reptile');
  assert.equal(meat.get('meat_draconic').iconFamily, 'meat_draconic');
  assert.equal(meat.get('meat_insect').iconFamily, 'meat_insectoid');

  assert.equal(meat.priceForQuality('meat_wolf', 'ruined'), 45);
  assert.equal(meat.priceForQuality('meat_wolf', 'poor'), 90);
  assert.equal(meat.priceForQuality('meat_wolf', 'standard'), 180);
  assert.equal(meat.priceForQuality('meat_wolf', 'fine'), 270);
  assert.equal(meat.priceForQuality('meat_wolf', 'exceptional'), 360);
  assert.equal(meat.priceForQuality('meat_draconic', 'exceptional'), 1500);

  const direWolfStack = meat.createHarvestStack('meat_wolf', {
    quantity: 6,
    quality: 'fine',
    originCreatureType: 'beast',
    originCreatureId: 'dire_wolf',
  });
  assert.deepEqual(direWolfStack, {
    itemId: 'meat_wolf',
    family: 'meat',
    quantity: 6,
    quality: 'fine',
    unitValueAhn: 270,
    originCreatureType: 'beast',
    originCreatureId: 'dire_wolf',
    originRaceId: null,
    originSubtypeId: null,
    sourceEntityId: null,
  });

  const moonfaeStack = meat.createHarvestStack('meat_rabbit', {
    quantity: 4,
    quality: 'exceptional',
    originCreatureType: 'humanoid',
    originRaceId: 'moonfae',
    originSubtypeId: 'crimson_moon',
  });
  assert.equal(moonfaeStack.itemId, 'meat_rabbit');
  assert.equal(moonfaeStack.originRaceId, 'moonfae');
  assert.equal(moonfaeStack.originSubtypeId, 'crimson_moon');
  assert.equal(moonfaeStack.unitValueAhn, 280);

  assert.equal(meat.list({ iconFamily: 'meat_shellfish' }).length, 2);
  assert.ok(meat.list({ tag: 'humanoid' }).length >= 5);

  console.log('Meat catalog smoke: OK (39 ingredients)');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
