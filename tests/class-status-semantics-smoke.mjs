import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

for (const key of [
  'LuminousStatusEngine',
  'LuminousStatusLibrary',
  'LuminousTraitEngine',
  'LuminousTraitCatalogCore',
  'LuminousClassStatusSemantics',
  'STATUS_REGISTRY',
]) delete globalThis[key];

await import('../js/status-engine.js');
await import('../js/status-library.js');
await import('../js/trait-engine.js');
await import('../js/trait-catalog-core.js');
await import('../js/class-status-semantics.js');

const library = globalThis.LuminousStatusLibrary;
const semantics = globalThis.LuminousClassStatusSemantics;
assert.ok(library, 'Status Library must load');
assert.equal(semantics?.version, '0.7.4-class-status-semantics');
semantics.install();

// Rage is a real visible combat Status and owns the supplied canonical icon.
assert.equal(library.has('rage'), true);
assert.equal(library.get('rage')?.name, 'Rage');
assert.equal(library.get('rage')?.mode, 'zero');
assert.equal(library.get('rage')?.icon, 'https://imgur.com/j3C7GzS.png');

// Bardic Inspiration is a visible Status. Potency carries its Power bonus and Count carries the consumable instance.
assert.equal(library.has('bardic_inspiration'), true);
assert.equal(library.get('bardic_inspiration')?.name, 'Bardic Inspiration');
assert.equal(library.get('bardic_inspiration')?.mode, 'double');
assert.equal(library.get('bardic_inspiration')?.icon, 'https://imgur.com/LaZgHYg.png');
assert.equal(library.get('bardic_inspiration')?.classId, 'bard');

// Psychic Blade is a visible College of Whispers Status whose Count tracks remaining charges.
assert.equal(library.has('psychic_blade'), true);
assert.equal(library.get('psychic_blade')?.name, 'Psychic Blade');
assert.equal(library.get('psychic_blade')?.mode, 'single');
assert.equal(library.get('psychic_blade')?.icon, 'https://imgur.com/vEDE8Q8.png');
assert.equal(library.get('psychic_blade')?.archetypeId, 'college_of_whispers');

// Class resources and Action/Passive implementation markers are not Status Effects.
assert.equal(library.has('sorcery_points'), false, 'Sorcery Points are a Sorcerer class resource, not a Status');
assert.equal(library.has('reckless_attack_armed'), false, 'Reckless Attack arming is internal Trait state');
assert.equal(library.has('countercharm'), false, 'Countercharm is an Action effect, not a canonical Status');
assert.equal(library.has('wild_instincts'), false, 'Wild Instincts is a Trait, not a Status');
assert.equal(library.has('haste'), true, 'Wild Instincts may still apply the canonical Haste Status');

// Reckless Attack must use Trait flags rather than polluting statusEffects.
const reckless = globalThis.LuminousTraitCatalogCore.getDefinition('reckless_attack');
assert.ok(reckless, 'Reckless Attack must remain in the Trait catalog');
const arm = reckless.effects.find((effect) => effect.id === 'reckless_attack_arm');
assert.deepEqual(arm?.operations, [{ type: 'set_flag', flagId: 'reckless_attack_armed', value: true }]);
const disarm = reckless.effects.find((effect) => effect.id === 'reckless_attack_disarm');
assert.deepEqual(disarm?.operations, [{ type: 'clear_flag', flagId: 'reckless_attack_armed' }]);
assert.equal(reckless.effects.some((effect) => (effect.operations || []).some((op) => op.type === 'apply_status' && op.statusId === 'reckless_attack_armed')), false);
assert.equal(reckless.rules.some((rule) => rule.statusId === 'reckless_attack_armed'), false);
for (const rule of reckless.rules.filter((rule) => ['coin', 'status'].includes(rule.type))) {
  if (rule.type === 'coin' || rule.statusId === 'fragile') {
    assert.equal(rule.whileStatus, undefined);
    assert.ok((rule.conditions || []).some((condition) => condition.flagId === 'reckless_attack_armed' && condition.operator === 'truthy'));
  }
}

// Legacy/runtime Action markers stay hidden while real class Statuses stay visible.
const unit = {
  statusEffects: {
    rage: { id: 'rage', count: 1, potency: 0 },
    haste: { id: 'haste', count: 2, potency: 0 },
    bardic_inspiration: { id: 'bardic_inspiration', count: 1, potency: 3 },
    psychic_blade: { id: 'psychic_blade', count: 2, potency: 0 },
    countercharm: { id: 'countercharm', count: 2, potency: 0 },
    reckless_attack_armed: { id: 'reckless_attack_armed', count: 1, potency: 0 },
  },
};
const visible = globalThis.LuminousStatusEngine.listStatuses(unit).map((entry) => entry.id).sort();
assert.deepEqual(visible, ['bardic_inspiration', 'haste', 'psychic_blade', 'rage']);

// Existing Trait runtimes must still reference the same canonical ids.
const bardSource = fs.readFileSync(path.join(root, 'js/bard-class-runtime.js'), 'utf8');
assert.match(bardSource, /bardic_inspiration/);
const whispersSource = fs.readFileSync(path.join(root, 'js/college-of-whispers-runtime.js'), 'utf8');
assert.match(whispersSource, /psychic_blade/);

// Sorcerer keeps Sorcery Points in classResources; it must not regress into the Status Library.
const sorcererSource = fs.readFileSync(path.join(root, 'js/sorcerer-class-runtime.js'), 'utf8');
assert.match(sorcererSource, /classResources/);
assert.match(sorcererSource, /sorceryPoints/);
assert.doesNotMatch(sorcererSource, /statusId\s*:\s*["']sorcery_points["']/);

const managerSource = fs.readFileSync(path.join(root, 'js/statusManager.js'), 'utf8');
assert.match(managerSource, /class-status-semantics\.js/);

console.log('Class Status semantics smoke passed: Rage, Bardic Inspiration, and Psychic Blade visible; internal Action markers hidden; Sorcery Points remain a resource.');
