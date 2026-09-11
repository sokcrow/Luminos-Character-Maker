const assert = require('node:assert/strict');
const path = require('node:path');

const registry = require(path.resolve(__dirname, '../js/item-icon-registry.js'));

assert.equal(registry.VERSION, 1);
assert.equal(registry.DEFAULT_GROUP, 'generic_item');
assert.equal(Object.keys(registry.GROUPS).length, 46);
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
assert.equal(registry.canonicalGroupId('Light Armor'), 'armor_light');
assert.equal(registry.canonicalGroupId('Melee Weapon'), 'weapon_melee');
assert.equal(registry.get('missing-family').id, 'generic_item');
assert.equal(registry.get('missing-family', { fallback: false }), null);
assert.equal(registry.resolveIcon('healing_hp'), 'https://imgur.com/GcnX53v.png');
assert.equal(registry.resolveIcon('healing_hp', { iconOverride: 'https://example.test/custom.png' }), 'https://example.test/custom.png');

console.log(`Item icon registry smoke: OK (${groups.length} families)`);
