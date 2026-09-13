import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (file) => fs.readFileSync(file, 'utf8');
const viewer = read('Battle-viewer.html');
const adapter = read('js/combat-v073-live-adapter.js');
const plans = read('js/combat-v073-plan-sync.js');
const remote = read('js/combat-v073-remote-intents.js');
const camera = read('js/combat-v073-camera-controls.js');
const dmSetup = read('js/combat-v073-dm-setup.js');
const manager = read('js/dm-combat-tab-manager.js');
const librarySync = read('js/combat-unit-library-sync.js');
const rules = JSON.parse(read('database.rules.json'));

assert.ok(adapter.includes('humanPlayer ? "remote" : "ai"'), 'other human Players must be remote, not local AI');
assert.ok(adapter.includes('unit.scale') && adapter.includes('unit.spriteX') && adapter.includes('unit.spriteY'), 'visual fields must participate in hydration signature');
assert.ok(adapter.includes('unit.speedTie') && adapter.includes('unit.speedRollTurn'), 'persisted Speed authority must participate in hydration signature');
assert.ok(adapter.includes('viewerRole: state.role'), 'runtime hydration must know Player vs DM viewer role');

assert.ok(plans.includes("luminous:combat073-plan-change"), 'live plan changes must sync before READY');
assert.ok(plans.includes('updates[`${ROOT}/plannedActions/${owner}/${i}`]=plans[i]?payloadFor'), 'non-ready plans must still be persisted for remote intent display');
assert.ok(plans.includes('targetSide') && plans.includes('itemType'), 'support item metadata must survive Firebase plan sync');
assert.ok(plans.includes('async function syncLivePlans'), 'render-driven plan sync must use a dedicated non-READY path');
assert.ok(plans.includes('if(!plans.some(Boolean))return false'), 'empty hydration renders must not delete persisted plans');
const liveSyncStart = plans.indexOf('async function syncLivePlans');
const liveSyncEnd = plans.indexOf('function queue', liveSyncStart);
const liveSyncBody = plans.slice(liveSyncStart, liveSyncEnd);
assert.ok(!liveSyncBody.includes('readyPlayers'), 'render-driven plan sync must never overwrite READY state');
assert.ok(plans.includes("mode==='live'?syncLivePlans(detail):syncReady(detail)"), 'READY and live-plan writes must stay separated');

assert.ok(remote.includes("unit?.controlled==='remote'"), 'remote intent bridge must target human allies only');
assert.ok(remote.includes('inferTargetSide'), 'remote intent bridge must infer ally/enemy target side');
assert.ok(remote.includes("targetSide==='ally'?'hp_healing':'offensive'"), 'ally-targeted items must render as support intents');
assert.ok(remote.includes('combat.render?.()'), 'remote plan updates must redraw the combat field');

assert.ok(camera.includes("addEventListener('wheel'"), 'Combat Viewer must support wheel zoom');
assert.ok(camera.includes("event.button!==1"), 'middle mouse button must own camera pan');
assert.ok(camera.includes('2.75'), 'manual camera zoom must be bounded');
assert.ok(camera.includes("if(!wasMoved)reset()"), 'middle click without drag must reset camera');
assert.ok(camera.includes('minX') && camera.includes('minY'), 'camera pan must clamp to battlefield bounds');

assert.ok(viewer.includes('COMBAT_LIVE_REMOTE_CONTROL_PATCH_MISSING'), 'Viewer must fail closed if remote-player alpha patch no longer matches');
assert.ok(viewer.includes('js/combat-v073-remote-intents.js'), 'Viewer must load remote intent bridge');
assert.ok(viewer.includes('js/combat-v073-camera-controls.js'), 'Viewer must load camera hotfix');

assert.ok(librarySync.includes('kobolds.firebasePayload()'), 'canonical sync must materialize Kobolds');
assert.ok(librarySync.includes('goblins.firebasePayload()'), 'canonical sync must materialize Goblins');
assert.ok(librarySync.includes('wolves.firebasePayload()'), 'canonical sync must materialize Wolves');
assert.ok(librarySync.includes('kobolds.firebaseSkillPayload(schema)'), 'canonical sync must materialize Kobold Skills');
assert.ok(librarySync.includes('wolves.firebaseSkillPayload(schema)'), 'canonical sync must materialize Wolf Skills');
assert.ok(librarySync.includes('if (!force && existingUnits[id]) continue'), 'auto sync must preserve existing Unit edits');
assert.ok(librarySync.includes('if (!force && existingSkills[id]) continue'), 'auto sync must preserve existing Skill edits');
assert.ok(!librarySync.includes('.remove('), 'canonical materializer must never delete unrelated library records');

assert.ok(manager.includes('autoSeedUnitLibrary'), 'DM Combat Library must auto-seed missing canonical Units');
assert.ok(manager.includes('linkedPlayerUnit') && manager.includes('linkedActor'), 'Player sprite editor must resolve linked Unit and Actor records');
assert.ok(manager.includes('row.savePaths = sources.savePaths'), 'Player sprite save must propagate to all linked canonical sources');
assert.ok(manager.includes("subscribe(ROOTS.skills, 'skills')"), 'Combat Library status must track canonical Skills');
assert.ok(manager.includes('FORCE SYNC UNIT LIBRARY'), 'manual force-sync must remain available as repair action');

const campaignRules = rules.rules?.['campaña'] || {};
const actorWrite = campaignRules.actores?.['.write'] || '';
const legacyNpcWrite = campaignRules.base_datos_npcs?.['.write'] || '';
assert.ok(actorWrite.includes("child('config').child('dm_uid')"), 'linked Actor saves must accept the configured DM authority');
assert.ok(legacyNpcWrite.includes("child('config').child('dm_uid')"), 'legacy NPC saves must accept the configured DM authority');

assert.ok(dmSetup.includes('FIELD solamente.'), 'Viewer Encounter Setup must be field deployment only');
assert.ok(dmSetup.includes('ensureLibraryMaterialized'), 'Viewer must repair an empty canonical Unit Library for the DM');
assert.ok(!dmSetup.includes('COMBAT ASSET + SKILL EDITOR'), 'legacy duplicate asset editor must be removed from Viewer');
assert.ok(!dmSetup.includes('SAVE EQUIPPED SKILLS'), 'legacy duplicate Skill editor must be removed from Viewer');
assert.ok(!dmSetup.includes('SAVE SPRITE'), 'legacy duplicate sprite editor must be removed from Viewer');

await import('../js/unit-rank-runtime.js');
await import('../js/universal-action-economy.js');
await import('../js/universal-ranged-ammo-runtime.js');
await import('../js/goblin-unit-runtime.js');
await import('../js/wolf-unit-runtime.js');
await import('../js/skill-catalog-kobold-tier1.js');
await import('../js/skill-catalog-wolf.js');
await import('../js/unit-catalog-kobold-tier1.js');
await import('../js/unit-catalog-goblin.js');
await import('../js/unit-catalog-wolf.js');

const kobolds = globalThis.LuminousKoboldUnitCatalog;
const goblins = globalThis.LuminousGoblinUnitCatalog;
const wolves = globalThis.LuminousWolfUnitCatalog;
assert.ok(kobolds && goblins && wolves, 'all three canonical Unit catalogs must initialize');

const koboldPayload = kobolds.firebasePayload();
const goblinPayload = goblins.firebasePayload();
const wolfPayload = wolves.firebasePayload();
assert.equal(Object.keys(koboldPayload).length, 5, 'five canonical Kobold variants must be deployable');
assert.deepEqual(Object.keys(goblinPayload).sort(), ['goblin', 'goblin_boss'], 'Goblin and Goblin Boss must be deployable');
assert.deepEqual(Object.keys(wolfPayload).sort(), ['dire_wolf', 'wolf'], 'Wolf and Dire Wolf must be deployable');

for (const [id, unit] of [...Object.entries(koboldPayload), ...Object.entries(wolfPayload)]) {
  const sprite = unit.combatSprite || unit.sprite_combate || unit.visual?.spriteUrl || unit.icono || unit.img;
  assert.ok(sprite, `${id} must expose a combat sprite before field deployment`);
  const skills = unit.action_slots || unit.skillIds || unit.skillSlotIds || unit.mechanics?.skills || [];
  assert.ok(Array.isArray(skills) && skills.length > 0, `${id} must expose canonical combat Skills`);
}

for (const [id, unit] of Object.entries(goblinPayload)) {
  assert.equal(unit.metadata?.spritePending, true, `${id} must explicitly report its missing canonical sprite instead of silently failing`);
  assert.equal(unit.metadata?.weaponSkillsPendingCanonicalCatalog, true, `${id} must explicitly report pending weapon Skills`);
  assert.ok(Array.isArray(unit.traitIds) && unit.traitIds.length > 0, `${id} must still expose implemented Traits`);
  assert.ok(Array.isArray(unit.mechanics?.weaponLoadout) && unit.mechanics.weaponLoadout.length > 0, `${id} must expose implemented weapon mechanics`);
}

console.log('combat v0.7.3 live sync/camera/library hotfix smoke: ok');
