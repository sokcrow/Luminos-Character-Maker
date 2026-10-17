import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../combat/source/combat-v073-live.html', import.meta.url), 'utf8');
const bootstrap = fs.readFileSync(new URL('../Battle-viewer.html', import.meta.url), 'utf8');
const literal = (name) => vm.runInNewContext(bootstrap.match(new RegExp('const ' + name + '=(`[^`]*`);'))[1]);
const needle = literal('liveDeckNeedle'), patch = literal('liveDeckPatch');
assert.equal(source.split(needle).length, 2);
const begin = source.indexOf('function hydrateLiveCombat(payload={}){');
const hydrate = source.slice(begin, source.indexOf('\nwindow.LuminousCombatStepRuntime=', begin)).replace(needle, patch);
const units = {}, roundNode = { textContent: '1' };
let resets = 0;
const sandbox = { UNIT_KITS: {}, AUTO_UNIT_IDS: [], PLAYER_ID: '', round: 1, deckSkills: [],
  $: () => roundNode,
  resetLiveCombatants() { for (const key of Object.keys(units)) delete units[key]; },
  spawnCombatant(unit) { units[unit.id] = { ...unit }; },
  playerDeckForUnit() { return []; }, resetPlayerDeckForUnit() {}, ensureUnknownAISlots() {},
  initializeBattleSP() { resets++; for (const unit of Object.values(units)) unit.sp = 0; },
  initializeCombatSurface() { return true; }, rollTurnSpeeds() {},
};
const context = vm.createContext(sandbox);
vm.runInContext(hydrate, context);
for (const round of [2, 3]) {
  sandbox.payload = { round, playerId: 'player:a', playIntro: false,
    combatants: [{ id: 'player:a', sp: 12 }, { id: 'enemy', sp: -8 }] };
  assert.equal(vm.runInContext('hydrateLiveCombat(payload)', context), true);
  assert.equal(units['player:a'].sp, 12);
  assert.equal(units.enemy.sp, -8);
  assert.equal(roundNode.textContent, round);
}
assert.equal(resets, 0, 'live hydration must not apply the prototype SP reset');
console.log('Live hydration preserves positive/negative SP and displays the canonical round');
