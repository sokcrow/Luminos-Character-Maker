import assert from 'node:assert/strict';

globalThis.window = globalThis;

const fakeUnits = {
  kobold_dagger: { id: 'kobold_dagger', name: 'Kobold · Dagger', species: 'kobold', actorCategory: 'enemy', metadata: { canonicalUnit: true }, visual: { spriteUrl: 'kobold.png' }, action_slots: ['kobold_dagger_jab'] },
  goblin: { id: 'goblin', name: 'Goblin', species: 'goblin', actorCategory: 'enemy', metadata: { canonicalUnit: true, spritePending: true }, action_slots: ['goblin_scimitar_slash'] },
  wolf: { id: 'wolf', name: 'Wolf', species: 'wolf', actorCategory: 'enemy', metadata: { canonicalUnit: true }, visual: { spriteUrl: 'wolf.png' }, action_slots: ['wolf_bite'] },
};
const fakeSkills = {
  kobold_dagger_jab: { id: 'kobold_dagger_jab' },
  goblin_scimitar_slash: { id: 'goblin_scimitar_slash' },
  wolf_bite: { id: 'wolf_bite' },
};

globalThis.CombatSkillSchema = {};
globalThis.LuminousKoboldTier1SkillCatalog = {};
globalThis.LuminousGoblinTier1SkillCatalog = {};
globalThis.LuminousWolfSkillCatalog = {};
globalThis.LuminousKoboldUnitCatalog = {
  firebasePayload: () => ({ kobold_dagger: fakeUnits.kobold_dagger }),
  firebaseSkillPayload: () => ({ kobold_dagger_jab: fakeSkills.kobold_dagger_jab }),
};
globalThis.LuminousGoblinUnitCatalog = {
  firebasePayload: () => ({ goblin: fakeUnits.goblin }),
  firebaseSkillPayload: () => ({ goblin_scimitar_slash: fakeSkills.goblin_scimitar_slash }),
};
globalThis.LuminousWolfUnitCatalog = {
  firebasePayload: () => ({ wolf: fakeUnits.wolf }),
  firebaseSkillPayload: () => ({ wolf_bite: fakeSkills.wolf_bite }),
};
globalThis.LuminousUnitCombatInstantiator = {};
globalThis.LuminousCombat073UnitDeployBridge = {};

class FakeElement {
  constructor(id = '') { this.id = id; this.value = ''; this.innerHTML = ''; this.dataset = {}; this.listeners = new Map(); }
  addEventListener(type, handler) { this.listeners.set(type, handler); }
  dispatchEvent(event) { const handler = this.listeners.get(event.type); if (handler) handler(event); return true; }
}

const typeSelect = new FakeElement('dm-combat-tab-type');
typeSelect.value = 'unit';
const entitySelect = new FakeElement('dm-combat-tab-entity');
const encounterSelect = new FakeElement('c073-unit');
const elements = new Map([
  ['dm-combat-tab-type', typeSelect],
  ['dm-combat-tab-entity', entitySelect],
  ['c073-unit', encounterSelect],
]);
globalThis.document = { head: {}, getElementById(id) { return elements.get(id) || null; } };

const dmManagerState = { selectedType: 'unit', selectedKey: '', units: {}, skills: {} };
globalThis.LuminousDmCombatTabManager = {
  state: dmManagerState,
  descriptorsFor(type) {
    if (type !== 'unit' && type !== 'enemy') return [];
    return Object.entries(dmManagerState.units).map(([id, unit]) => ({ key: `unit:${id}`, id, name: unit.name || id }));
  },
};
typeSelect.addEventListener('change', () => {
  const rows = globalThis.LuminousDmCombatTabManager.descriptorsFor(typeSelect.value);
  entitySelect.innerHTML = '<option value="">— Seleccionar —</option>' + rows.map((row) => `<option value="${row.key}">${row.name}</option>`).join('');
});
globalThis.LuminousCombatDmSetup073 = { state: { units: {} } };

function makeDb({ failWrites = false } = {}) {
  const listeners = new Map();
  const remote = {
    'campaña/base_datos_unidades': {},
    'campaña/base_datos_skills': {},
    'campaña/combate/libraryManifest/units': {},
    'campaña/combate/libraryManifest/skills': {},
  };
  function notify() { for (const [root, handler] of listeners.entries()) handler({ val: () => remote[root] || {} }); }
  function ref(path = '') {
    return {
      once: async () => ({ val: () => remote[path] || {} }),
      on(type, handler) { if (type !== 'value') return; listeners.set(path, handler); handler({ val: () => remote[path] || {} }); },
      off() { listeners.delete(path); },
      async update(updates) {
        if (failWrites) throw new Error('PERMISSION_DENIED');
        for (const [fullPath, value] of Object.entries(updates || {})) {
          for (const root of Object.keys(remote)) {
            if (!fullPath.startsWith(`${root}/`)) continue;
            remote[root][fullPath.slice(root.length + 1)] = value;
          }
        }
        notify();
      },
    };
  }
  return { ref, remote };
}

await import(`../js/universal-library-runtime.js?real-ui-library=${Date.now()}`);
await import(`../js/combat-unit-library-sync.js?real-ui-smoke=${Date.now()}`);
const api = globalThis.LuminousCombatUnitLibrarySync;
assert.ok(api, 'Unit Library sync runtime must initialize');
assert.equal(api.version, '2.1.0');

const db = makeDb();
const result = await api.ensureMissing(db);
assert.equal(result.unitCount, 3, 'canonical payload must contain all test families');
assert.ok(dmManagerState.units.kobold_dagger, 'Panel DM state must receive Kobold before relying on Firebase persistence');
assert.ok(dmManagerState.units.goblin, 'Panel DM state must receive Goblin before relying on Firebase persistence');
assert.ok(dmManagerState.units.wolf, 'Panel DM state must receive Wolf before relying on Firebase persistence');
assert.match(entitySelect.innerHTML, /Kobold · Dagger/, 'clickable Panel DM Unit selector must render Kobold');
assert.match(entitySelect.innerHTML, /Goblin/, 'clickable Panel DM Unit selector must render Goblin');
assert.match(entitySelect.innerHTML, /Wolf/, 'clickable Panel DM Unit selector must render Wolf');
assert.match(encounterSelect.innerHTML, /Kobold · Dagger/, 'Encounter Setup selector must render Kobold');
assert.match(encounterSelect.innerHTML, /Goblin/, 'Encounter Setup selector must render Goblin');
assert.match(encounterSelect.innerHTML, /Wolf/, 'Encounter Setup selector must render Wolf');
assert.ok(db.remote['campaña/base_datos_unidades'].goblin, 'successful materialization must still persist canonical Units to Firebase');
assert.ok(db.remote['campaña/combate/libraryManifest/units'].goblin, 'successful materialization must publish a lightweight manifest entry');

dmManagerState.units = {};
globalThis.LuminousCombatDmSetup073.state.units = {};
entitySelect.innerHTML = '';
encounterSelect.innerHTML = '';
const deniedDb = makeDb({ failWrites: true });
await assert.rejects(() => api.syncAll(deniedDb), /PERMISSION_DENIED/);
assert.ok(dmManagerState.units.goblin, 'local canonical fallback must survive a Firebase write failure');
assert.match(entitySelect.innerHTML, /Goblin/, 'Panel DM selector must stay populated after a Firebase write failure');
assert.match(encounterSelect.innerHTML, /Goblin/, 'Encounter selector must stay populated after a Firebase write failure');

console.log('DM Combat real UI Unit Library + manifest empty-Firebase smoke: ok');
