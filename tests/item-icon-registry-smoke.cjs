const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

(async () => {
  delete globalThis.LuminousItemIconRegistry;
  await import(pathToFileURL(path.resolve(__dirname, '../js/item-icon-registry.js')).href);
  const registry = globalThis.LuminousItemIconRegistry;

  assert.ok(registry);
  assert.equal(registry.VERSION, 5);
  assert.equal(registry.DEFAULT_GROUP, 'generic_item');
  assert.equal(Object.keys(registry.GROUPS).length, 61);
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
  assert.equal(registry.get('missing-family').id, 'generic_item');
  assert.equal(registry.get('missing-family', { fallback: false }), null);
  assert.equal(registry.resolveIcon('healing_hp'), 'https://imgur.com/GcnX53v.png');
  assert.equal(registry.resolveIcon('food'), 'https://imgur.com/uFmUpuD.png');
  assert.equal(registry.resolveIcon('food_meat'), 'https://imgur.com/uFmUpuD.png');
  assert.equal(registry.resolveIcon('meat_mammal'), 'https://imgur.com/GQAGWzK.png');
  assert.equal(registry.resolveIcon('meat_bird'), 'https://imgur.com/4Y6KfFh.png');
  assert.equal(registry.resolveIcon('meat_fish'), 'https://imgur.com/KZ6Y7LQ.png');
  assert.equal(registry.resolveIcon('meat_shellfish'), 'https://imgur.com/cUkw6rB.png');
  assert.equal(registry.resolveIcon('meat_reptile'), 'https://imgur.com/LZ3maix.png');
  assert.equal(registry.resolveIcon('meat_draconic'), 'https://imgur.com/QJZhEJC.png');
  assert.equal(registry.resolveIcon('meat_insectoid'), 'https://imgur.com/bZoLZeb.png');
  assert.equal(registry.resolveIcon('hide_mammal'), 'https://imgur.com/nK6vQIR.png');
  assert.equal(registry.resolveIcon('pelt_fur'), 'https://imgur.com/12IQYXa.png');
  assert.equal(registry.resolveIcon('hide_reptile'), 'https://imgur.com/llKa6G5.png');
  assert.equal(registry.resolveIcon('hide_draconic'), 'https://imgur.com/F1YNegu.png');
  assert.equal(registry.resolveIcon('hide_leather'), 'https://imgur.com/nK6vQIR.png');
  assert.equal(registry.resolveIcon('hard_bone'), 'https://imgur.com/HrqeZ0a.png');
  assert.equal(registry.resolveIcon('hard_claw'), 'https://imgur.com/gjLEUIT.png');
  assert.equal(registry.resolveIcon('hard_horn'), 'https://imgur.com/H1kn8fD.png');
  assert.equal(registry.resolveIcon('bone_horn'), 'https://imgur.com/HrqeZ0a.png');
  assert.equal(registry.resolveIcon('claw'), 'https://imgur.com/gjLEUIT.png');
  assert.equal(registry.resolveIcon('horn'), 'https://imgur.com/H1kn8fD.png');
  assert.equal(registry.resolveIcon('scale_reptile'), 'https://imgur.com/cJz55WQ.png');
  assert.equal(registry.resolveIcon('shell_carapace'), 'https://imgur.com/TgCPNLU.png');
  assert.equal(registry.resolveIcon('chitin_plate'), 'https://imgur.com/0785C1C.png');
  assert.equal(registry.resolveIcon('scale'), 'https://imgur.com/cJz55WQ.png');
  assert.equal(registry.resolveIcon('carapace'), 'https://imgur.com/TgCPNLU.png');
  assert.equal(registry.resolveIcon('chitin'), 'https://imgur.com/0785C1C.png');
  assert.equal(registry.resolveIcon('healing_hp', { iconOverride: 'https://example.test/custom.png' }), 'https://example.test/custom.png');

  console.log(`Item icon registry smoke: OK (${groups.length} families)`);
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
