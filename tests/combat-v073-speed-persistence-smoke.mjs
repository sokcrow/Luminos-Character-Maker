import assert from 'node:assert/strict';
import fs from 'node:fs';

const viewer=fs.readFileSync('Battle-viewer.html','utf8');
const speed=fs.readFileSync('js/combat-v073-speed-authority.js','utf8');

assert.ok(viewer.includes('js/combat-v073-speed-authority.js'),'Viewer must load speed authority');
assert.ok(speed.includes("adapterState()?.role==='dm'"),'only DM may author speed rolls');
assert.ok(speed.includes('speedRollTurn:state.round'),'speed roll must be stamped with round');
assert.ok(speed.includes('speedTie:Math.random()'),'speed tie must be generated once and persisted');
assert.ok(speed.includes('speedRolledAt:global.firebase.database.ServerValue.TIMESTAMP'),'speed roll must record authoritative timestamp');
assert.ok(speed.includes("state.db.ref(`${ROOT}/combatants`)"),'speed persistence must transact the canonical combatant collection');
assert.ok(speed.includes('ref.transaction(current=>'),'speed persistence must use one collection transaction');
assert.ok(speed.includes('if(rolledTurn===state.round&&speed!=null&&tie!=null)continue'),'same round refresh must not reroll speed');
assert.ok(speed.includes('return changed?next:undefined'),'transaction must abort when every combatant already has this round speed');
assert.ok(!speed.includes("a.state.lastSignature=''"),'Speed refresh must not invalidate the whole adapter hydration cache');
assert.ok(!speed.includes('a.hydrateNow()'),'Speed refresh must not rebuild the Combat runtime or reset Player menus');
assert.ok(speed.includes('refreshRuntimeSpeedView'),'persisted Speed changes must refresh the live runtime in place');
assert.ok(speed.includes('runtime()?.render?.()'),'in-place Speed refresh must repaint the battlefield');
assert.ok(speed.includes('state.refreshTimer=global.setTimeout'),'speed-driven runtime refreshes must be debounced');
assert.ok(!speed.includes('`${ROOT}/combatants/${key}`'),'speed authority must not issue one transaction per combatant');

assert.ok(viewer.includes('initializeBattleSP();ensureUnknownAISlots();'),'Viewer hydration must initialize SP without rerolling Speed');
const patchStart=viewer.indexOf('const liveDeckPatch=`');
const patchEnd=viewer.indexOf('`;',patchStart);
const liveDeckPatch=patchStart>=0&&patchEnd>patchStart?viewer.slice(patchStart,patchEnd+2):'';
assert.ok(liveDeckPatch.includes('initializeBattleSP();ensureUnknownAISlots();'),'Patched viewer hydration must keep SP/AI initialization');
assert.ok(!liveDeckPatch.includes('rollTurnSpeeds'),'Patched viewer hydration must remove the local rollTurnSpeeds call');
assert.ok(viewer.includes('speedBaseRoll:Number(d.speedBaseRoll??d.speed)||0,speedRollTurn:Number(d.speedRollTurn)||0,speedTie:Number(d.speedTie)||0'),'Runtime spawn must preserve canonical Speed roll metadata instead of resetting it to zero');
assert.ok(speed.includes('roundReady:false'),'Speed authority must wait for the canonical round before authoring Speed');
assert.ok(speed.includes('if(state.rolling||!state.roundReady||!state.db?.ref||!isDm())return false'),'DM Speed rolls must be blocked until Firebase round state is known');
assert.ok(speed.includes('syncRuntimeSpeedsFromCanonical'),'legacy runtime Speed must be overwritten from canonical combatants');
assert.ok(speed.includes('patchLegacySpeedRollers'),'legacy rollTurnSpeeds/rollUnitSpeed must be patched to canonical reads');
assert.ok(speed.includes('global.rollTurnSpeeds=function authoritativeSpeedSync'),'legacy turn Speed rolls must not randomize per viewer');
assert.ok(speed.includes('global.layoutSpeedFormation?.()'),'canonical turn Speed sync must preserve formation refresh side effects');
assert.ok(speed.includes('global.syncAllUnitVisibility?.()'),'canonical turn Speed sync must preserve visibility refresh side effects');
assert.ok(speed.includes('global.rollUnitSpeed=function authoritativeUnitSpeed'),'legacy unit Speed rolls must not randomize per viewer');

console.log('combat v0.7.3 speed persistence smoke: ok');
