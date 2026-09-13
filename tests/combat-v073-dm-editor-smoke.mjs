import assert from 'node:assert/strict';
import fs from 'node:fs';

const dmSetup = fs.readFileSync('js/combat-v073-dm-setup.js', 'utf8');
const combatTab = fs.readFileSync('js/dm-combat-tab-manager.js', 'utf8');
const librarySync = fs.readFileSync('js/combat-unit-library-sync.js', 'utf8');
const utils = fs.readFileSync('js/utils.js', 'utf8');
const dmPanel = fs.readFileSync('pantalla_dm.html', 'utf8');

assert.ok(dmPanel.includes('data-tab="tab-combate"'), 'DM panel must keep the existing Combat menu button');
assert.ok(dmPanel.includes('id="tab-combate"'), 'DM panel must expose the existing Combat tab host');
assert.ok(utils.includes('ensureDmCombatTabManagerAssets'), 'utils must attach the Combat Library Manager to the existing DM Combat tab');
assert.ok(utils.includes("'js/dm-combat-tab-manager.js'"), 'DM Combat tab integration script must be loaded from the panel');

assert.ok(combatTab.includes("getElementById('tab-combate')"), 'Combat Library Manager must mount inside the existing DM Combat tab');
assert.ok(combatTab.includes('Combat Library'), 'Combat tab must contain the Combat Library UI');
assert.ok(combatTab.includes('FORCE SYNC UNIT LIBRARY'), 'Combat tab must expose canonical Unit Library repair sync');
assert.ok(combatTab.includes('autoSeedUnitLibrary'), 'missing canonical Units must be materialized automatically for the DM');
assert.ok(combatTab.includes('Combat Sprite Mockup'), 'Combat tab must expose the Combat Sprite mockup');
assert.ok(combatTab.includes('ARRASTRA EL SPRITE'), 'sprite mockup must support direct dragging');
assert.ok(combatTab.includes('dm-combat-tab-sprite-x') && combatTab.includes('dm-combat-tab-sprite-y') && combatTab.includes('dm-combat-tab-sprite-scale'), 'sprite mockup must expose X/Y/Scale controls');
assert.ok(combatTab.includes('SAVE COMBAT SPRITE'), 'Combat tab must persist the edited Combat Sprite');
assert.ok(combatTab.includes("legacyNpcs: 'campaña/base_datos_npcs'"), 'Combat Library must bridge the historical NPC database');
assert.ok(combatTab.includes("subscribe(ROOTS.legacyNpcs, 'legacyNpcs')"), 'Combat Library must subscribe to historical NPC records');
assert.ok(combatTab.includes("subscribe(ROOTS.skills, 'skills')"), 'Combat Library must subscribe to the canonical Skill Library');
assert.ok(combatTab.includes('linkedPlayerUnit') && combatTab.includes('linkedActor'), 'Player visual resolution must include linked Player Unit and Actor sources');
assert.ok(combatTab.includes('row.savePaths = sources.savePaths'), 'Player sprite persistence must target all resolved canonical linked records');
assert.ok(combatTab.includes('onAuthStateChanged'), 'Firebase library listeners must wait for authentication');
assert.ok(combatTab.includes('ENEMIES · ALL SOURCES'), 'enemy selector must combine canonical Units with hostile Actor/NPC sources');
assert.ok(combatTab.includes('dm-combat-tab-sprite-placeholder'), 'mock battlefield must diagnose missing sprites instead of rendering blank');
assert.ok(combatTab.includes('SPRITE NO\\nCARGA') && combatTab.includes('SIN COMBAT\\nSPRITE'), 'mock battlefield must label missing/broken sprites');
assert.ok(combatTab.includes('120 / 120 HP'), 'mock battlefield must include visible combat UI context');
assert.ok(!combatTab.includes('LuminousVttActorLibrary') && !combatTab.includes('CombatEngine'), 'Combat tab manager must not revive legacy VTT/CombatEngine');

assert.ok(librarySync.includes("updates[`${ROOTS.units}/${id}`]"), 'Unit sync must update canonical Unit records individually');
assert.ok(librarySync.includes("updates[`${ROOTS.skills}/${id}`]"), 'Skill sync must update canonical Skill records individually');
assert.ok(librarySync.includes('goblins.firebasePayload()'), 'Goblin Units must participate in canonical materialization');
assert.ok(!librarySync.includes('.remove('), 'canonical sync must preserve unrelated Firebase records');

assert.ok(dmSetup.includes('ENCOUNTER SETUP · COMBAT v0.7.3'), 'Viewer must retain Encounter Setup');
assert.ok(dmSetup.includes('FIELD solamente.'), 'Viewer Encounter Setup must declare field-only responsibility');
assert.ok(dmSetup.includes('ensureLibraryMaterialized'), 'Viewer DM setup must repair missing canonical Units before deployment');
assert.ok(!dmSetup.includes('COMBAT ASSET + SKILL EDITOR'), 'duplicate legacy editor must not remain in the Viewer');
assert.ok(!dmSetup.includes('SAVE EQUIPPED SKILLS') && !dmSetup.includes('SAVE SPRITE'), 'asset/Skill editing belongs only to the realtime DM panel');
assert.ok(!dmSetup.includes('LuminousVttActorLibrary') && !dmSetup.includes('CombatEngine'), 'Encounter Setup must not revive legacy VTT/CombatEngine');

console.log('combat v0.7.3 DM Combat Library + field-only Encounter Setup smoke: ok');
