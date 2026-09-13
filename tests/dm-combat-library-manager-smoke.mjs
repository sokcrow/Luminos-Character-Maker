import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (file) => fs.readFileSync(file, 'utf8');
const dmPanel = read('pantalla_dm.html');
const utils = read('js/utils.js');
const manager = read('js/dm-combat-tab-manager.js');
const librarySync = read('js/combat-unit-library-sync.js');
const dmSetup = read('js/combat-v073-dm-setup.js');

// This contract intentionally targets the actual clickable DM surfaces. The old
// test only inspected dm-unit-library-seeder.html, which allowed Panel DM →
// Combate to remain broken while CI stayed green.
assert.ok(dmPanel.includes('data-tab="tab-combate"'), 'real DM panel must expose the Combat tab button');
assert.ok(dmPanel.includes('id="tab-combate"'), 'real DM panel must expose the Combat tab host');
assert.ok(utils.includes('ensureDmCombatTabManagerAssets'), 'real DM panel bootstrap must load the Combat tab manager');
assert.ok(utils.includes("'js/dm-combat-tab-manager.js'"), 'Combat tab manager must be loaded by the real DM bootstrap');
assert.ok(manager.includes("getElementById('tab-combate')"), 'Combat Library Manager must mount in the real Combat tab');
assert.ok(manager.includes('FORCE SYNC UNIT LIBRARY'), 'real Combat tab must expose the Unit Library repair trigger');
assert.ok(manager.includes("units: 'campaña/base_datos_unidades'"), 'real Combat tab must subscribe to the canonical Unit root');
assert.ok(manager.includes('ENEMIES · ALL SOURCES') && manager.includes('UNIT LIBRARY'), 'real Combat tab must expose Enemy and Unit Library selectors');

assert.ok(librarySync.includes("version: '1.3.0-real-ui'"), 'canonical Unit sync must use the real-UI fallback runtime');
assert.ok(librarySync.includes('installRuntimeFallback'), 'canonical Units must be available locally before Firebase persistence');
assert.ok(librarySync.includes('refreshCombatTabSelector'), 'local canonical Units must refresh the Panel DM selector');
assert.ok(librarySync.includes('refreshEncounterSelector'), 'local canonical Units must refresh Encounter Setup');
assert.ok(librarySync.includes('SCRIPT_LOAD_TIMEOUT'), 'catalog loader must fail instead of hanging forever on an already-loaded script');
assert.ok(librarySync.includes('DEPLOYMENT_SCRIPTS'), 'FIELD deployment runtime must remain available');
assert.ok(dmSetup.includes('c073-unit'), 'Battle Viewer DM setup must retain its Unit Library selector');
assert.ok(dmSetup.includes('ensureLibraryMaterialized'), 'Battle Viewer must still request canonical library materialization');

assert.ok(!manager.includes('LuminousVttActorLibrary') && !manager.includes('combatEngine.js'), 'real DM manager must not revive legacy VTT/CombatEngine');
console.log('DM Combat Library real-tab contract smoke: ok');
