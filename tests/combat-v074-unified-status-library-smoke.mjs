import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

for (const key of ['LuminousStatusLibrary','LuminousStatusEngine','LuminousConditionRuntime','LuminousElementalStatusRuntime','LuminousElementalStatusCompatibility','STATUS_REGISTRY']) {
  delete globalThis[key];
}

const library = require('../js/status-library.js');
assert.equal(library.version, '0.7.4-unified');

const sourceDefinitions = library.list().filter((entry) => entry.canonicalSource === 'alpha-v0.7.3-combat-engine-1');
assert.equal(sourceDefinitions.length, 48, 'the migrated alpha v0.7.3 registry must remain complete');
for (const definition of sourceDefinitions) {
  assert.ok(definition.icon, `${definition.id} must keep its migrated icon`);
  assert.ok(definition.name, `${definition.id} must keep its migrated name`);
  assert.ok(definition.description, `${definition.id} must keep its migrated description`);
}

const exactIcons = {
  bleed:'https://imgur.com/mp9fbme.png',
  rupture:'https://limbuscompany.wiki.gg/wiki/Special:Redirect/file/Rupture.png',
  tremor:'https://imgur.com/fuDGjpn.png',
  sinking:'https://imgur.com/ZnulGzZ.png',
  burn:'https://imgur.com/L4bRd44.png',
  paralyze:'https://imgur.com/9TkO8Ce.png',
  poise:'https://imgur.com/KFEmJB5.png',
  chill:'https://imgur.com/kJY0rBP.png',
  frozen:'https://imgur.com/dbhWrJQ.png',
  shock:'https://imgur.com/KMQuv3T.png',
  corrosion:'https://imgur.com/gUySOsd.png',
  poison:'https://imgur.com/FNjARTt.png',
  decay:'https://imgur.com/TBIak3k.png',
  radiance:'https://imgur.com/kT4mJUi.png',
  blinded:'https://imgur.com/ZFpviIn.png',
  paralyzed:'https://imgur.com/BqchBbA.png',
  confusion:'https://imgur.com/eadmX77.png',
  invisible:'https://imgur.com/Vn90820.png',
  deafened:'https://imgur.com/QwqqQd2.png',
};
for (const [id, icon] of Object.entries(exactIcons)) assert.equal(library.get(id)?.icon, icon, `${id} icon drifted`);

assert.equal(library.resolveId('paralysis'), 'paralyze');
assert.equal(library.resolveId('binding'), 'bind');
assert.equal(library.resolveId('offense_up'), 'offense_level_up');
assert.equal(library.resolveId('defense_down'), 'defense_level_down');
assert.equal(library.resolveId('vulnerability'), 'fragile');
assert.equal(library.resolveId('hp_healing_boost'), 'hp_healing_up');
assert.equal(library.get('paralysis'), library.get('paralyze'));
assert.notEqual(library.get('paralysis'), library.get('paralyzed'), 'Limbus Paralysis and D&D Paralyzed must stay distinct');

assert.match(library.get('poise').description, /5% Critical Hit Chance per Potency/);
assert.equal(library.get('protection').maxCount, 99, 'source semantics must beat the older modular cap');
assert.equal(library.get('sleep').mode, 'single', 'source definition must remain canonical');
assert.ok(library.get('burn').rules.length > 0, 'modular mechanics must be retained inside the same definition');
assert.ok(library.get('corrosion').rules.length > 0, 'elemental mechanics must be retained inside the same definition');
assert.ok(library.has('crit_dmg_up'), 'runtime-only statuses must remain extensions of the same library');
assert.ok(library.has('slash_dmg_up'), 'generated runtime statuses must remain in the same library');
assert.equal(library.get('force'), null, 'Force is an element, not a stored Status in the canonical source');

// Known canonical definitions are immutable through legacy STATUS_REGISTRY writes.
const poiseBefore = library.get('poise');
globalThis.STATUS_REGISTRY.poise = { name:'WRONG POISE', icon:'wrong.png', description:'wrong' };
assert.equal(library.get('poise'), poiseBefore);
assert.equal(globalThis.STATUS_REGISTRY.poise.name, 'Poise');
delete globalThis.STATUS_REGISTRY.poise;
assert.equal(globalThis.STATUS_REGISTRY.poise.name, 'Poise');

// Unknown third-party statuses may still register, but they become Library extensions.
globalThis.STATUS_REGISTRY.test_extension = { name:'Test Extension', type:'neutral', mode:'single' };
assert.equal(library.get('test_extension')?.canonicalSource, 'runtime-extension');
assert.equal(globalThis.STATUS_REGISTRY.test_extension.name, 'Test Extension');

// Bridge old stores/callers to canonical IDs without duplicating Status stacks.
const baseEngine = Object.freeze({
  ensureStore(unit) { if (!unit.statusEffects) unit.statusEffects = {}; return unit.statusEffects; },
  getDefinition(id) { return globalThis.STATUS_REGISTRY[id] || null; },
  applyStatus(unit, id, input = {}) { const store = this.ensureStore(unit); store[id] = { id, count:Number(input.count ?? 1), potency:Number(input.potency ?? 0) }; return store[id]; },
  removeStatus(unit, id) { const store = this.ensureStore(unit); const removed = Boolean(store[id]); delete store[id]; return { removed, statusId:id }; },
  hasStatus(unit, id) { return Boolean(this.ensureStore(unit)[id]); },
  getStatus(unit, id) { return this.ensureStore(unit)[id] || null; },
  protectStatus(unit, id, protection = {}) { if (!unit.statusProtections) unit.statusProtections = {}; unit.statusProtections[id] = protection; return protection; },
  syncTraitState(unit, traitState = {}) { for (const [id, value] of Object.entries(traitState.statuses || {})) this.applyStatus(unit, id, value); return unit; },
  advanceDurations() { return []; },
  listStatuses(unit) { return Object.keys(this.ensureStore(unit)).map((id) => ({ ...this.getDefinition(id), instance:this.getStatus(unit,id) })); },
});
globalThis.LuminousStatusEngine = baseEngine;
assert.equal(library.installStatusEngineBridge(), true);
assert.equal(globalThis.LuminousStatusEngine.__luminousStatusLibraryBridge, true);

const unit = { statusEffects:{ paralysis:{ id:'paralysis', count:2, potency:0 } } };
assert.equal(globalThis.LuminousStatusEngine.hasStatus(unit, 'paralyze'), true);
assert.ok(unit.statusEffects.paralyze);
assert.equal(unit.statusEffects.paralysis, undefined);
globalThis.LuminousStatusEngine.applyStatus(unit, 'binding', { count:3 });
assert.ok(unit.statusEffects.bind);
assert.equal(unit.statusEffects.binding, undefined);
globalThis.LuminousStatusEngine.syncTraitState(unit, { statuses:{ vulnerability:{ count:2 } } });
assert.ok(unit.statusEffects.fragile);

// Compatibility layer must expose the canonical Library through condition and elemental APIs too.
globalThis.LuminousConditionRuntime = Object.freeze({
  DEFINITIONS:{ paralyzed:{ name:'WRONG PARALYZED' } }, ICONS:{},
  getDefinition(){ return { name:'WRONG PARALYZED' }; },
  installRegistry(){ globalThis.STATUS_REGISTRY.paralyzed = { name:'WRONG PARALYZED' }; },
});
globalThis.LuminousElementalStatusRuntime = Object.freeze({
  STATUS_DEFINITIONS:{ poison:{ name:'WRONG POISON' } },
  registerStatuses(){ globalThis.STATUS_REGISTRY.poison = { name:'WRONG POISON' }; },
  onEncounterEnd(){ return []; },
});
const compat = require('../js/elemental-status-compat.js');
assert.equal(compat.patchDefinitionAuthorities(), true);
assert.equal(globalThis.LuminousConditionRuntime.getDefinition('paralyzed').name, 'Paralyzed');
assert.equal(globalThis.LuminousConditionRuntime.DEFINITIONS.paralyzed.icon, 'https://imgur.com/BqchBbA.png');
assert.equal(globalThis.LuminousElementalStatusRuntime.STATUS_DEFINITIONS.poison.description, library.get('poison').description);
globalThis.LuminousConditionRuntime.installRegistry();
globalThis.LuminousElementalStatusRuntime.registerStatuses();
assert.equal(globalThis.STATUS_REGISTRY.paralyzed.name, 'Paralyzed');
assert.equal(globalThis.STATUS_REGISTRY.poison.name, 'Poison');

const managerSource = fs.readFileSync(path.join(root, 'js/statusManager.js'), 'utf8');
const compatSource = fs.readFileSync(path.join(root, 'js/elemental-status-compat.js'), 'utf8');
assert.match(managerSource, /status-library\.js/);
assert.doesNotMatch(managerSource, /const\s+STATUS_REGISTRY\s*=\s*\{/);
assert.match(compatSource, /canonical-status-library/);
assert.match(compatSource, /patchDefinitionAuthorities/);

console.log(`Unified Status Library smoke passed: ${sourceDefinitions.length} migrated source definitions + ${library.list().length - sourceDefinitions.length} runtime extensions.`);
