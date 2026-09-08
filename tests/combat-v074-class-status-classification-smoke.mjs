import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

for (const key of [
  'LuminousStatusLibrary',
  'LuminousStatusEngine',
  'LuminousClassStatusClassification',
  'STATUS_REGISTRY',
]) delete globalThis[key];

await import('../js/status-library.js');
await import('../js/status-engine.js');
await import('../js/class-status-classification.js');

const library = globalThis.LuminousStatusLibrary;
const engine = globalThis.LuminousStatusEngine;
const classification = globalThis.LuminousClassStatusClassification;

assert.ok(library, 'canonical Status Library must load');
assert.ok(engine, 'Status Engine must load');
assert.ok(classification, 'class Status classification bridge must load');

const rage = library.get('rage');
assert.ok(rage, 'Rage must be registered in the canonical Status Library');
assert.equal(rage.name, 'Rage');
assert.equal(rage.type, 'positive');
assert.equal(rage.mode, 'zero');
assert.equal(rage.icon, 'https://imgur.com/j3C7GzS.png');
assert.equal(rage.category, 'class_status');

for (const id of ['reckless_attack_armed', 'countercharm']) {
  assert.equal(library.get(id), null, `${id} is an internal Trait effect, not a Status definition`);
  assert.equal(classification.isInternalTraitEffect(id), true);
}

for (const id of ['sorcery_points', 'sorcerypoints']) {
  assert.equal(library.get(id), null, `${id} is a Class resource, not a Status definition`);
  assert.equal(classification.isResourceOnly(id), true);
}

const unit = {};
engine.applyStatus(unit, 'rage', { mode: 'set', duration: 'until_removed' });
engine.applyStatus(unit, 'reckless_attack_armed', { mode: 'set', duration: 'next_skill' });
engine.applyStatus(unit, 'countercharm', { mode: 'set', count: 2 });

assert.equal(engine.hasStatus(unit, 'rage'), true, 'Rage remains a real Status');
assert.equal(engine.hasStatus(unit, 'reckless_attack_armed'), true, 'Reckless may keep an internal transient marker for mechanics');
assert.equal(engine.hasStatus(unit, 'countercharm'), true, 'Countercharm may keep an internal action-effect marker for mechanics');

const visible = engine.listStatuses(unit).map((entry) => entry.id).sort();
assert.deepEqual(visible, ['rage'], 'only real Status Effects may render in the Status HUD');
assert.equal(engine.getDefinition('reckless_attack_armed').hidden, true);
assert.equal(engine.getDefinition('countercharm').hidden, true);

const sorcererSource = fs.readFileSync(path.join(root, 'js/sorcerer-class-runtime.js'), 'utf8');
assert.match(sorcererSource, /const STATE_ROOT = "classResources"/);
assert.match(sorcererSource, /sorceryPoints/);
assert.doesNotMatch(sorcererSource, /applyStatus\([^\n]*sorcery[_ ]?points/i);

const barbarianSource = fs.readFileSync(path.join(root, 'js/trait-catalog-core.js'), 'utf8');
assert.match(barbarianSource, /statusId: "rage"/);
assert.match(barbarianSource, /statusId: "haste"/);

console.log('Class Status classification smoke passed: Rage is visible; Reckless/Countercharm are internal; Sorcery Points are a Class resource.');
