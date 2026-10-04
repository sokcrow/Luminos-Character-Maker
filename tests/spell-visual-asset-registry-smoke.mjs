import assert from 'node:assert/strict';
import fs from 'node:fs';

delete globalThis.LuminousItemIconRegistry;
delete globalThis.LuminousSpellVisualAssetRegistry;

await import('../js/item-icon-registry.js');
await import('../js/spell-visual-asset-registry.js');

const registry = globalThis.LuminousSpellVisualAssetRegistry;
assert.ok(registry);
assert.equal(registry.VERSION, 1);

for (const entry of registry.list()) {
  assert.ok(['status','spell_unit','item'].includes(entry.kind), entry.id);
  assert.ok(Array.isArray(entry.tags) && entry.tags.length >= 3, entry.id);
  assert.equal(fs.existsSync(entry.path), true, entry.path);
}

assert.equal(registry.byKind('status').length, 9);
assert.equal(registry.byKind('spell_unit').length, 4);
assert.equal(registry.byKind('item').length, 2);

assert.equal(registry.get('minor_illusion').id, 'illusion');
assert.equal(registry.get('bonfire').id, 'create_bonfire');
assert.equal(registry.get('dancing_lights').id, 'dancing_light');
assert.equal(registry.get('blade_ward').id, 'blade_guard');
assert.equal(registry.get('encode_thoughts').id, 'thought_strand');

assert.deepEqual(
  registry.byTag('summon').map((entry) => entry.id).sort(),
  ['create_bonfire','infestation']
);
assert.deepEqual(
  registry.byTag('background_unit').map((entry) => entry.id).sort(),
  ['mage_hand','produce_flame']
);
assert.deepEqual(
  registry.byTag('temporary_item').map((entry) => entry.id).sort(),
  ['magic_stone','thought_strand']
);

assert.equal(registry.resolve('thought_strand'), 'Assets/Icons/items/utility/thought_strand.png');
assert.equal(registry.resolve('magic_stone'), 'Assets/Icons/items/resource/ammo.png');
assert.equal(registry.get('magic_stone').reuseExisting, true);

console.log('Spell visual asset registry smoke: OK');
