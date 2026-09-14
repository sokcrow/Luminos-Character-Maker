const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

(async () => {
  delete globalThis.LuminousItemIconRegistry;
  await import(pathToFileURL(path.resolve(__dirname, '../js/item-icon-registry.js')).href);
  const registry = globalThis.LuminousItemIconRegistry;

  assert.ok(registry);
  assert.equal(registry.VERSION, 8);
  assert.equal(registry.DEFAULT_GROUP, 'generic_item');
  assert.equal(Object.keys(registry.GROUPS).length, 74);
  assert.equal(registry.has('healing_hp'), true);
  assert.equal(registry.has('weapon_melee'), true);
  assert.equal(registry.has('trap'), false);
  assert.equal(registry.has('currency'), false);

  const groups = registry.list();
  assert.equal(new Set(groups.map((entry) => entry.id)).size, groups.length);
  for (const entry of groups) {
    assert.equal(typeof entry.label, 'string');
    assert.equal(typeof entry.labelEs, 'string');
    assert.match(entry.icon, /^https:\/\/imgur\.com\/[A-Za-z0-9]+\.png$/);
  }

  assert.deepEqual(
    registry.list({ domain: 'equipment' }).map((entry) => entry.id),
    ['weapon_melee', 'weapon_ranged', 'shield', 'accessory', 'armor_light', 'armor_medium', 'armor_heavy']
  );

  assert.deepEqual(
    registry.list({ domain: 'material' }).filter((entry) => entry.id.startsWith('meat_')).map((entry) => entry.id),
    ['meat_mammal', 'meat_bird', 'meat_fish', 'meat_shellfish', 'meat_reptile', 'meat_draconic', 'meat_insectoid']
  );

  assert.deepEqual(
    registry.list({ domain: 'material' }).filter((entry) => ['hide_mammal', 'pelt_fur', 'hide_reptile', 'hide_draconic'].includes(entry.id)).map((entry) => entry.id),
    ['hide_mammal', 'pelt_fur', 'hide_reptile', 'hide_draconic']
  );

  assert.deepEqual(
    registry.list({ domain: 'material' }).filter((entry) => entry.id.startsWith('hard_')).map((entry) => entry.id),
    ['hard_bone', 'hard_claw', 'hard_horn']
  );

  assert.deepEqual(
    registry.list({ domain: 'material' }).filter((entry) => ['scale_reptile', 'shell_carapace', 'chitin_plate'].includes(entry.id)).map((entry) => entry.id),
    ['scale_reptile', 'shell_carapace', 'chitin_plate']
  );

  assert.deepEqual(
    registry.list({ domain: 'material' }).filter((entry) => ['feather_raw', 'animal_fiber_raw', 'silk_raw'].includes(entry.id)).map((entry) => entry.id),
    ['feather_raw', 'animal_fiber_raw', 'silk_raw']
  );

  assert.deepEqual(
    registry.list({ domain: 'material' }).filter((entry) => ['organ_internal', 'organ_sensory', 'organ_brain', 'organ_gland'].includes(entry.id)).map((entry) => entry.id),
    ['organ_internal', 'organ_sensory', 'organ_brain', 'organ_gland']
  );

  assert.deepEqual(
    registry.list({ domain: 'material' }).filter((entry) => ['blood', 'hemolymph', 'ichor'].includes(entry.id)).map((entry) => entry.id),
    ['blood', 'hemolymph', 'ichor']
  );

  assert.deepEqual(
    registry.list({ domain: 'material' }).filter((entry) => ['venom_raw', 'acid_secretion', 'ink_secretion', 'bio_secretion'].includes(entry.id)).map((entry) => entry.id),
    ['venom_raw', 'acid_secretion', 'ink_secretion', 'bio_secretion']
  );

  assert.equal(registry.canonicalGroupId('Light Armor'), 'armor_light');
  assert.equal(registry.canonicalGroupId('Melee Weapon'), 'weapon_melee');
  assert.equal(registry.canonicalGroupId('food_meat'), 'food');
  assert.equal(registry.canonicalGroupId('meat'), 'meat_mammal');
  assert.equal(registry.canonicalGroupId('hide_leather'), 'hide_mammal');
  assert.equal(registry.canonicalGroupId('fur_pelt'), 'pelt_fur');
  assert.equal(registry.canonicalGroupId('bone_horn'), 'hard_bone');
  assert.equal(registry.canonicalGroupId('bone'), 'hard_bone');
  assert.equal(registry.canonicalGroupId('fang'), 'hard_claw');
  assert.equal(registry.canonicalGroupId('tusk'), 'hard_horn');
  assert.equal(registry.canonicalGroupId('scale'), 'scale_reptile');
  assert.equal(registry.canonicalGroupId('shell'), 'shell_carapace');
  assert.equal(registry.canonicalGroupId('chitin'), 'chitin_plate');
  assert.equal(registry.canonicalGroupId('feather'), 'feather_raw');
  assert.equal(registry.canonicalGroupId('down'), 'feather_raw');
  assert.equal(registry.canonicalGroupId('wool'), 'animal_fiber_raw');
  assert.equal(registry.canonicalGroupId('raw_silk'), 'silk_raw');
  assert.equal(registry.canonicalGroupId('heart'), 'organ_internal');
  assert.equal(registry.canonicalGroupId('eye'), 'organ_sensory');
  assert.equal(registry.canonicalGroupId('brain'), 'organ_brain');
  assert.equal(registry.canonicalGroupId('gland'), 'organ_gland');
  assert.equal(registry.canonicalGroupId('humanoid_blood'), 'blood');
  assert.equal(registry.canonicalGroupId('hemolymph'), 'hemolymph');
  assert.equal(registry.canonicalGroupId('exotic_fluid'), 'ichor');
  assert.equal(registry.canonicalGroupId('venom'), 'venom_raw');
  assert.equal(registry.canonicalGroupId('toxic_secretion'), 'venom_raw');
  assert.equal(registry.canonicalGroupId('acid'), 'acid_secretion');
  assert.equal(registry.canonicalGroupId('ink'), 'ink_secretion');
  assert.equal(registry.canonicalGroupId('pheromone'), 'bio_secretion');
  assert.equal(registry.canonicalGroupId('exotic_secretion'), 'bio_secretion');
  assert.equal(registry.get('missing-family').id, 'generic_item');
  assert.equal(registry.get('missing-family', { fallback: false }), null);

  const expectedIcons = {
    healing_hp: 'https://imgur.com/GcnX53v.png',
    food: 'https://imgur.com/uFmUpuD.png',
    meat_mammal: 'https://imgur.com/GQAGWzK.png',
    meat_bird: 'https://imgur.com/4Y6KfFh.png',
    meat_fish: 'https://imgur.com/KZ6Y7LQ.png',
    meat_shellfish: 'https://imgur.com/cUkw6rB.png',
    meat_reptile: 'https://imgur.com/LZ3maix.png',
    meat_draconic: 'https://imgur.com/QJZhEJC.png',
    meat_insectoid: 'https://imgur.com/bZoLZeb.png',
    hide_mammal: 'https://imgur.com/nK6vQIR.png',
    pelt_fur: 'https://imgur.com/12IQYXa.png',
    hide_reptile: 'https://imgur.com/llKa6G5.png',
    hide_draconic: 'https://imgur.com/F1YNegu.png',
    hard_bone: 'https://imgur.com/HrqeZ0a.png',
    hard_claw: 'https://imgur.com/gjLEUIT.png',
    hard_horn: 'https://imgur.com/H1kn8fD.png',
    scale_reptile: 'https://imgur.com/cJz55WQ.png',
    shell_carapace: 'https://imgur.com/TgCPNLU.png',
    chitin_plate: 'https://imgur.com/0785C1C.png',
    feather_raw: 'https://imgur.com/EPkBtW0.png',
    animal_fiber_raw: 'https://imgur.com/A3FpNXr.png',
    silk_raw: 'https://imgur.com/NYnkd17.png',
    organ_internal: 'https://imgur.com/rXlXbOG.png',
    organ_sensory: 'https://imgur.com/tPLOEZe.png',
    organ_brain: 'https://imgur.com/9MdgTfI.png',
    organ_gland: 'https://imgur.com/4kqV4TO.png',
    blood: 'https://imgur.com/7a75QU2.png',
    hemolymph: 'https://imgur.com/Kwwd6A7.png',
    ichor: 'https://imgur.com/KHKQKjb.png',
    venom_raw: 'https://imgur.com/8dBvLD5.png',
    acid_secretion: 'https://imgur.com/akDUWvj.png',
    ink_secretion: 'https://imgur.com/pcc7tsi.png',
    bio_secretion: 'https://imgur.com/YzrMRpI.png',
    toxin_material: 'https://imgur.com/8dBvLD5.png',
  };
  for (const [id, icon] of Object.entries(expectedIcons)) assert.equal(registry.resolveIcon(id), icon);

  assert.equal(registry.resolveIcon('food_meat'), 'https://imgur.com/uFmUpuD.png');
  assert.equal(registry.resolveIcon('hide_leather'), 'https://imgur.com/nK6vQIR.png');
  assert.equal(registry.resolveIcon('bone_horn'), 'https://imgur.com/HrqeZ0a.png');
  assert.equal(registry.resolveIcon('claw'), 'https://imgur.com/gjLEUIT.png');
  assert.equal(registry.resolveIcon('horn'), 'https://imgur.com/H1kn8fD.png');
  assert.equal(registry.resolveIcon('scale'), 'https://imgur.com/cJz55WQ.png');
  assert.equal(registry.resolveIcon('carapace'), 'https://imgur.com/TgCPNLU.png');
  assert.equal(registry.resolveIcon('chitin'), 'https://imgur.com/0785C1C.png');
  assert.equal(registry.resolveIcon('flight_feather'), 'https://imgur.com/EPkBtW0.png');
  assert.equal(registry.resolveIcon('animal_hair'), 'https://imgur.com/A3FpNXr.png');
  assert.equal(registry.resolveIcon('silk'), 'https://imgur.com/NYnkd17.png');
  assert.equal(registry.resolveIcon('heart'), 'https://imgur.com/rXlXbOG.png');
  assert.equal(registry.resolveIcon('eye'), 'https://imgur.com/tPLOEZe.png');
  assert.equal(registry.resolveIcon('brain'), 'https://imgur.com/9MdgTfI.png');
  assert.equal(registry.resolveIcon('gland'), 'https://imgur.com/4kqV4TO.png');
  assert.equal(registry.resolveIcon('draconic_blood'), 'https://imgur.com/7a75QU2.png');
  assert.equal(registry.resolveIcon('exotic_fluid'), 'https://imgur.com/KHKQKjb.png');
  assert.equal(registry.resolveIcon('raw_venom'), 'https://imgur.com/8dBvLD5.png');
  assert.equal(registry.resolveIcon('acid'), 'https://imgur.com/akDUWvj.png');
  assert.equal(registry.resolveIcon('ink'), 'https://imgur.com/pcc7tsi.png');
  assert.equal(registry.resolveIcon('scent'), 'https://imgur.com/YzrMRpI.png');
  assert.equal(registry.resolveIcon('healing_hp', { iconOverride: 'https://example.test/custom.png' }), 'https://example.test/custom.png');

  console.log(`Item icon registry smoke: OK (${groups.length} families)`);
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
