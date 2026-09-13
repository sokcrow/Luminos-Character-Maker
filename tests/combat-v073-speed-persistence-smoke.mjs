import assert from 'node:assert/strict';
import fs from 'node:fs';

const viewer=fs.readFileSync('Battle-viewer.html','utf8');
const speed=fs.readFileSync('js/combat-v073-speed-authority.js','utf8');

assert.ok(viewer.includes('js/combat-v073-speed-authority.js'),'Viewer must load speed authority');
assert.ok(speed.includes("adapterState()?.role==='dm'"),'only DM may author speed rolls');
assert.ok(speed.includes('speedRollTurn:state.round'),'speed roll must be stamped with round');
assert.ok(speed.includes('speedTie:Math.random()'),'speed tie must be generated once and persisted');
assert.ok(speed.includes('speedRolledAt:global.firebase.database.ServerValue.TIMESTAMP'),'speed roll must record authoritative timestamp');
assert.ok(speed.includes('ref.transaction(current=>'),'speed persistence must use a transaction');
assert.ok(speed.includes("if(rolledTurn===state.round&&speed!=null&&tie!=null)return"),'same round refresh must not reroll speed');
assert.ok(speed.includes("a.state.lastSignature=''"),'persisted speed changes must invalidate adapter hydration cache');
assert.ok(speed.includes('a.hydrateNow()'),'persisted speed changes must rehydrate runtime');
assert.ok(speed.includes("`${ROOT}/combatants/${key}`"),'speed must persist on canonical Firebase combatant');

console.log('combat v0.7.3 speed persistence smoke: ok');
