import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const viewer = read('Battle-viewer.html');
const bundlePaths = [
  'combat/combat-v073-live.bundle.part01',
  'combat/combat-v073-live.bundle.part02',
  'combat/combat-v073-live.bundle.part03',
  'combat/combat-v073-live.bundle.part04',
  'combat/combat-v073-live.bundle.part05',
  'combat/combat-v073-live.bundle.part06',
  'combat/repair/combat-v073-live.bundle.part07.r1',
  'combat/repair/combat-v073-live.bundle.part07.r2',
  'combat/repair/combat-v073-live.bundle.part07.r3',
  'combat/combat-v073-live.bundle.part08',
  'combat/combat-v073-live.bundle.part09',
  'combat/combat-v073-live.bundle.part10',
  'combat/combat-v073-live.bundle.part11',
];

for (const file of bundlePaths) {
  assert.ok(fs.existsSync(path.join(root, file)), `missing verified bundle shard: ${file}`);
  assert.ok(viewer.includes(file), `Battle-viewer must load verified shard: ${file}`);
}

const encoded = bundlePaths.map(read).join('').replace(/\s+/g, '');
const html = zlib.gunzipSync(Buffer.from(encoded, 'base64')).toString('utf8');

assert.ok(html.includes('window.LuminousCombatLiveMode=true'), 'canonical v0.7.3 live mode must be enabled');
assert.ok(html.includes('js/status-library.js'), 'shared Status Library must load');
assert.ok(html.includes('js/status-engine.js'), 'shared Status Engine must load');
assert.ok(html.includes('if(!window.LuminousStatusLibrary)'), 'alpha Status registry must defer to shared canonical Status');
assert.ok(html.includes('js/combat-v073-live-adapter.js'), 'Firebase live adapter must load');
assert.ok(html.includes('window.LuminousCombat073'), 'canonical v0.7.3 runtime facade must be exposed');
assert.ok(!html.includes('js/combatEngine.js'), 'active v0.7.3 bundle must not load legacy combatEngine.js');
assert.ok(html.includes('let rafId=0') && html.includes('ensureFrame'), 'WebGL2 renderer must use one guarded RAF chain');

assert.ok(viewer.includes('luminous:combat073-plan-ready-change'), 'Viewer bootstrap must bridge READY/CANCEL READY');
assert.ok(viewer.includes('js/combat-v073-plan-sync.js'), 'Viewer must load Firebase plan sync bridge');
assert.ok(viewer.includes('js/combat-v073-dm-setup.js'), 'Viewer must load the v0.7.3 DM encounter setup');
assert.ok(viewer.includes('COMBAT_READY_BRIDGE_PATCH_MISSING'), 'READY bridge patch must fail closed when alpha signature changes');
assert.ok(!viewer.includes('js/combatEngine.js'), 'Battle-viewer bootstrap must not load legacy CombatEngine');

const planSync = read('js/combat-v073-plan-sync.js');
assert.ok(planSync.includes('const unitId=own[0]'), 'plannedActions unitId must use canonical Firebase combatant key');
assert.ok(planSync.includes('ref().update(updates)'), 'READY state and plannedActions must commit atomically');
assert.match(planSync, /plannedActions\/\$\{ctx\.owner\}\/\$\{i\}/, 'READY must write each sealed Player action into its owned Firebase slot');
assert.match(planSync, /readyPlayers\/\$\{ctx\.owner\}/, 'READY state must be persisted for the owned Player');
assert.ok(planSync.includes('syncLiveTargets'), 'Planning edits must stream target intent instead of full action payloads');
assert.ok(planSync.includes('targetIntents:targets'), 'live Planning row must contain target intent data');

const dmSetup = read('js/combat-v073-dm-setup.js');
assert.match(dmSetup, /players:\s*'campaña\/jugadores'/, 'DM setup must read Campaign Players');
assert.match(dmSetup, /units:\s*'campaña\/base_datos_unidades'/, 'DM setup must read Unit Library');
assert.match(dmSetup, /combatants:\s*'campaña\/combate\/combatants'/, 'DM setup must write canonical combatants');
assert.match(dmSetup, /canonicalPlayerKey:\s*playerId/, 'deployed Players must carry canonical Player ownership');
assert.match(dmSetup, /canonicalOwnerUid:\s*uid\s*\|\|\s*null/, 'deployed Players must carry canonical UID ownership');
assert.match(dmSetup, /actionSlotIndex:\s*slotIndex\(slots\)/, 'deployed combatants must expose canonical action slots');
assert.match(dmSetup, /equippedSkillIndex:\s*equipped\(ids\)/, 'deployed combatants must expose equipped Skill provenance');
assert.ok(dmSetup.includes('ENCOUNTER SETUP · COMBAT v0.7.3'), 'DM encounter setup UI must be mounted in the new Viewer');
assert.ok(!dmSetup.includes('LuminousVttActorLibrary') && !dmSetup.includes('js/vtt/'), 'new DM setup must not revive the removed VTT actor library');
assert.ok(!dmSetup.includes('combatEngine.js') && !dmSetup.includes('CombatEngine'), 'new DM setup must not depend on legacy CombatEngine');

const rulesText = read('database.rules.json');
const rules = JSON.parse(rulesText);
const combatRules = rules.rules?.['campaña']?.['combate'];
assert.ok(combatRules?.plannedActions, 'Firebase rules must define plannedActions');
assert.ok(combatRules?.readyPlayers, 'Firebase rules must define readyPlayers');
const plannedWrite = combatRules.plannedActions?.['$ownerPlayerId']?.['$slotIndex']?.['.write'] || '';
const plannedValidate = combatRules.plannedActions?.['$ownerPlayerId']?.['$slotIndex']?.['.validate'] || '';
assert.ok(plannedWrite.includes("child('phase')") && plannedWrite.includes("child('state')") && plannedWrite.includes("child('status')"), 'planning rules must accept object-shaped combat state');
assert.ok(plannedValidate.includes('canonicalPlayerKey') && plannedValidate.includes('canonicalOwnerUid'), 'player writes must validate canonical ownership');
assert.ok(plannedValidate.includes("kind').val() === 'defense'"), 'defense plans must be validated');
assert.ok(plannedValidate.includes("kind').val() === 'item'") && plannedValidate.includes("kind').val() === 'global'"), 'DM-authored item/global payload shapes must be recognized');

const dm = read('hoja_de_DM.html');
assert.ok(dm.includes('data-src="Battle-viewer.html"'), 'DM Combat iframe must remain lazy-loaded');
assert.ok(!/id="battle-viewer"[^>]*\ssrc="Battle-viewer\.html"/i.test(dm), 'DM startup must not eagerly boot Combat');

console.log('combat v0.7.3 live cutover smoke: ok');
