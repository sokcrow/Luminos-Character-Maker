import assert from 'node:assert/strict';
import fs from 'node:fs';

globalThis.STATUS_REGISTRY = {};
delete globalThis.LuminousItemIconRegistry;
delete globalThis.LuminousCantripBatchRuntime;
delete globalThis.LuminousCantripUtilityRuntime;
delete globalThis.LuminousWeaponCantripBatchRuntime;

await import('../js/item-icon-registry.js');
await import('../js/spell-batch-cantrips-runtime.js');
await import('../js/spell-batch-cantrips-utility-runtime.js');
await import('../js/spell-batch-weapon-cantrips-runtime.js');

const assets = [
  'Assets/Icons/items/utility/thought_strand.png',
  'Assets/Icons/status/cantrips/blade_guard.png',
  'Assets/Icons/status/cantrips/booming.png',
  'Assets/Icons/status/cantrips/dancing_light.png',
  'Assets/Icons/status/cantrips/guidance.png',
  'Assets/Icons/status/cantrips/illusion.png',
  'Assets/Icons/status/cantrips/light.png',
  'Assets/Icons/status/cantrips/resistance.png',
  'Assets/Icons/status/cantrips/shillelagh.png',
  'Assets/Images/SpellUnits/bonfire.png',
  'Assets/Images/SpellUnits/infestation.png',
  'Assets/Images/SpellUnits/mage_hand.png',
  'Assets/Images/SpellUnits/produce_flame.png',
];

const pngSignature = Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]);
for (const path of assets) {
  assert.equal(fs.existsSync(path), true, `missing cantrip asset: ${path}`);
  const data = fs.readFileSync(path);
  assert.ok(data.length > 8, `empty cantrip asset: ${path}`);
  assert.deepEqual(data.subarray(0, 8), pngSignature, `not a PNG: ${path}`);
}

const base = globalThis.LuminousCantripBatchRuntime;
const utility = globalThis.LuminousCantripUtilityRuntime;
const weapon = globalThis.LuminousWeaponCantripBatchRuntime;
const icons = globalThis.LuminousItemIconRegistry;

assert.equal(base.STATUS_DEFINITIONS.illusion.icon, 'Assets/Icons/status/cantrips/illusion.png');
assert.equal(base.STATUS_DEFINITIONS.blade_guard.icon, 'Assets/Icons/status/cantrips/blade_guard.png');
assert.equal(base.STATUS_DEFINITIONS.sword_burst.icon, 'Assets/Icons/status/cantrips/blade_guard.png');
assert.equal(base.STATUS_DEFINITIONS.dancing_light.icon, 'Assets/Icons/status/cantrips/dancing_light.png');
assert.equal(base.STATUS_DEFINITIONS.light.icon, 'Assets/Icons/status/cantrips/light.png');

assert.equal(weapon.STATUS_DEFINITIONS.booming.icon, 'Assets/Icons/status/cantrips/booming.png');
assert.equal(weapon.STATUS_DEFINITIONS.shillelagh.icon, 'Assets/Icons/status/cantrips/shillelagh.png');

assert.equal(utility.STATUS_DEFINITIONS.guidance.icon, 'Assets/Icons/status/cantrips/guidance.png');
assert.equal(utility.STATUS_DEFINITIONS.resistance.icon, 'Assets/Icons/status/cantrips/resistance.png');
assert.equal(utility.STATUS_DEFINITIONS.controlled_flame_light, undefined);
assert.equal(utility.STATUS_DEFINITIONS.thaumaturgy_booming_voice, undefined);

assert.equal(icons.get('thought_strand').icon, 'Assets/Icons/items/utility/thought_strand.png');
assert.equal(icons.get('ammo').icon, 'Assets/Icons/items/resource/ammo.png');

const caster = { id:'asset-caster', side:'allies', hp:10, maxHp:10, level:1, spellMod:1, statusEffects:{} };
const infestation = base.spawnSpellEntity(caster,'infestation',{kind:'summon',context:{combatData:{}}});
const bonfire = base.spawnSpellEntity(caster,'create_bonfire',{kind:'summon',context:{combatData:{}}});
const flame = base.spawnSpellEntity(caster,'produce_flame',{kind:'background_unit',context:{combatData:{}}});
const hand = base.spawnSpellEntity(caster,'mage_hand',{kind:'background_unit',context:{combatData:{}}});

assert.equal(infestation.visual.spriteUrl, 'Assets/Images/SpellUnits/infestation.png');
assert.equal(bonfire.visual.spriteUrl, 'Assets/Images/SpellUnits/bonfire.png');
assert.equal(flame.visual.spriteUrl, 'Assets/Images/SpellUnits/produce_flame.png');
assert.equal(hand.visual.spriteUrl, 'Assets/Images/SpellUnits/mage_hand.png');

console.log('Cantrip visual assets smoke: OK');
