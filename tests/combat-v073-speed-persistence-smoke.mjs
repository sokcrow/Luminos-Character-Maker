import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const viewer=fs.readFileSync('Battle-viewer.html','utf8');
const speed=fs.readFileSync('js/combat-v073-speed-authority.js','utf8');
const adapter=fs.readFileSync('js/combat-v073-live-adapter.js','utf8');

assert.ok(viewer.includes('js/combat-v073-speed-authority.js'),'Viewer must load speed authority');
assert.ok(speed.includes("adapterState()?.role==='dm'"),'only DM may author speed rolls');
assert.ok(speed.includes('speedRollTurn:state.round'),'speed roll must be stamped with round');
assert.ok(speed.includes('speedTie:Math.random()'),'fallback speed tie must be generated once and persisted');
assert.ok(speed.includes('const original=state.originalRollUnitSpeed'),'DM authority must preserve the packed runtime turn-start Speed rules');
assert.ok(speed.includes('const result=original(draft,state.round)'),'authoritative Speed must evaluate the original roller on a detached clone');
assert.ok(speed.includes('speedBaseRoll:base'),'authoritative Speed must persist the original base roll after modifiers are evaluated');
const authority=fs.readFileSync('js/combat-v073-authority.js','utf8');
assert.ok(authority.includes('proneSpeedRound:Math.max(0,Math.trunc(finite(unit.proneSpeedRound,0)))'),'authority snapshots must persist Prone forced-Speed turn state');
assert.ok(authority.includes('confusionTurnMode:unit.confusionTurnMode==null?null:clone(unit.confusionTurnMode)'),'authority snapshots must persist locked Confusion turn state');
assert.ok(speed.includes('speedRolledAt:global.firebase.database.ServerValue.TIMESTAMP'),'speed roll must record authoritative timestamp');
assert.ok(speed.includes("state.db.ref(`${ROOT}/combatants`)"),'speed persistence must transact the canonical combatant collection');
assert.ok(speed.includes('ref.transaction(current=>'),'speed persistence must use one collection transaction');
assert.ok(speed.includes('if(rolledTurn===expectedRound&&speed!=null&&speed>=1&&tie!=null)continue'),'same round refresh must not reroll legal Speed; invalid Speed 0 must be rerolled');
assert.ok(speed.includes('return changed?next:undefined'),'transaction must abort when every combatant already has this round speed');
assert.ok(!speed.includes("a.state.lastSignature=''"),'Speed refresh must not invalidate the whole adapter hydration cache');
assert.ok(!speed.includes('a.hydrateNow()'),'Speed refresh must not rebuild the Combat runtime or reset Player menus');
assert.ok(speed.includes('refreshRuntimeSpeedView'),'persisted Speed changes must refresh the live runtime in place');
assert.ok(speed.includes("global.addEventListener('luminous:combat073-hydrated',()=>{"),'Speed authority must react to real Combat hydration');
assert.ok(speed.includes('if(state.roundReady)state.lastFormationRound=0;'),'real Combat hydration must permit canonical Speed formation to be restored after runtime rebuilds');
assert.ok(speed.includes('refreshRuntimeSpeedView();'),'real Combat hydration must apply canonical Speed formation/visibility without a manual roll');
assert.ok(speed.includes('global.LuminousCombat073?.render?.()'),'in-place Speed refresh must repaint through the real Combat runtime');
assert.ok(!speed.includes('runtime()?.render?.()'),'Speed refresh must not call an undefined runtime() helper');
assert.ok(speed.includes('state.refreshTimer=global.setTimeout'),'speed-driven runtime refreshes must be debounced');
assert.ok(!speed.includes('`${ROOT}/combatants/${key}`'),'speed authority must not issue one transaction per combatant');

const patchStart=viewer.indexOf('const liveDeckPatch=`');
const patchEnd=viewer.indexOf('`;',patchStart);
const liveDeckPatch=patchStart>=0&&patchEnd>patchStart?viewer.slice(patchStart,patchEnd+2):'';
assert.ok(liveDeckPatch.includes('ensureUnknownAISlots();'),'Patched viewer hydration must keep AI slot initialization');
assert.ok(!liveDeckPatch.includes('initializeBattleSP'),'Patched viewer hydration must preserve canonical SP');
assert.ok(!liveDeckPatch.includes('rollTurnSpeeds'),'Patched viewer hydration must remove the local rollTurnSpeeds call');
assert.ok(viewer.includes('speedBaseRoll:Number(d.speedBaseRoll??d.speed)||0,speedRollTurn:Number(d.speedRollTurn)||0,speedTie:Number(d.speedTie)||0'),'Runtime spawn must preserve canonical Speed roll metadata instead of resetting it to zero');
assert.ok(viewer.includes('confusionTurnMode:d.confusionTurnMode??null,proneSpeedRound:Number(d.proneSpeedRound)||0'),'Runtime spawn must preserve transient forced-Speed condition state');
const hydrationStart=adapter.indexOf('function hydrationSignature');
const hydrationEnd=adapter.indexOf('function setRoleUi',hydrationStart);
const hydrationSource=hydrationStart>=0&&hydrationEnd>hydrationStart?adapter.slice(hydrationStart,hydrationEnd):'';
assert.ok(!hydrationSource.includes('unit.speed,'),'speed-only changes must not invalidate the full Combat hydration signature');
assert.ok(!hydrationSource.includes('unit.speedTie'),'speedTie-only changes must not invalidate the full Combat hydration signature');
assert.ok(!hydrationSource.includes('unit.speedRollTurn'),'speedRollTurn-only changes must not invalidate the full Combat hydration signature');
assert.ok(hydrationSource.includes('unit.proneSpeedRound')&&hydrationSource.includes('unit.confusionTurnMode'),'condition turn-state changes must still invalidate full hydration');
assert.ok(speed.includes('roundReady:false'),'Speed authority must wait for the canonical round before authoring Speed');
assert.ok(speed.includes('!state.roundReady||!state.db?.ref||!isDm()'),'DM Speed rolls must be blocked until Firebase round state is known');
assert.ok(speed.includes('syncRuntimeSpeedsFromCanonical'),'legacy runtime Speed must be overwritten from canonical combatants');
assert.ok(speed.includes('patchLegacySpeedRollers'),'legacy rollTurnSpeeds/rollUnitSpeed must be patched to canonical reads');
assert.ok(speed.includes('global.rollTurnSpeeds=function authoritativeSpeedSync'),'legacy turn Speed rolls must not randomize per viewer');
assert.ok(speed.includes('lastFormationRound:0'),'Speed formation side effects must be tracked per canonical round');
assert.ok(speed.includes('function canonicalRoundComplete'),'formation must wait until every active unit has canonical Speed for the round');
assert.ok(speed.includes('function applyRoundSideEffectsOnce'),'formation/visibility must be guarded behind a once-per-round gate');
assert.ok(speed.includes('state.lastFormationRound===expected'),'repeated same-round rollTurnSpeeds calls must not relayout units');
assert.ok(speed.includes('global.layoutSpeedFormation?.()'),'canonical turn Speed sync must preserve formation refresh side effects');
assert.ok(speed.includes('global.syncAllUnitVisibility?.()'),'canonical turn Speed sync must preserve visibility refresh side effects');
assert.ok(speed.includes('global.rollUnitSpeed=function authoritativeUnitSpeed'),'legacy unit Speed rolls must not randomize per viewer');

// A round seal and the background Speed listener can request the same roll.
// Both must await one child transaction; sealed rounds must start none.
let releaseRoll,transactions=0;
const gate=new Promise(resolve=>{releaseRoll=resolve;});
const rows={enemy:{id:'enemy',hp:12,speedRollTurn:1,speed:1,speedTie:0}};
const db={ref(){return {async transaction(update){transactions++;await gate;const result=update(rows);return {committed:result!==undefined};}};}};
const sandbox={console,Math,JSON,Number,String,Object,Array,Promise,setInterval:()=>1,clearInterval(){},setTimeout:()=>1,clearTimeout(){},addEventListener(){},firebase:{database:{ServerValue:{TIMESTAMP:1}}},LuminousCombatLiveAdapter073:{state:{role:'dm'}},LuminousCombatAuthority073:{state:{preparingRound:true,runningLocal:false}}};
sandbox.window=sandbox;vm.runInNewContext(speed,sandbox);
const api=sandbox.LuminousCombatSpeedAuthority073;Object.assign(api.state,{db,round:2,roundReady:true});
const sealing=api.ensureRoundSpeeds({preparing:true}),background=api.ensureRoundSpeeds();
assert.equal(transactions,1,'concurrent requests must share one Speed transaction');releaseRoll();
assert.deepEqual(await Promise.all([sealing,background]),[true,true]);
sandbox.LuminousCombatAuthority073.state.runningLocal=true;
assert.equal(await api.ensureRoundSpeeds(),false,'running/sealing authority must prevent new background writes');assert.equal(transactions,1);

console.log('combat v0.7.3 speed persistence smoke: ok');

// A startup buff changes canonical Speed within the same round. Apply the new
// order once; ordinary same-round reads still must not relayout repeatedly.
const speedRows={unit:{id:'unit',speed:3,speedBaseRoll:3,speedRollTurn:1,speedTie:0.25}};
let layouts=0;
sandbox.LuminousCombat073={combatants:()=>speedRows,render(){}};
sandbox.LuminousCombatLiveAdapter073.state.hydratedOnce=true;
sandbox.layoutSpeedFormation=()=>{layouts++};
sandbox.rollTurnSpeeds=()=>{};sandbox.rollUnitSpeed=()=>{};
api.patchLegacySpeedRollers();
Object.assign(api.state,{round:1,roundReady:true,lastFormationRound:0,combatants:JSON.parse(JSON.stringify(speedRows))});
api.forceRuntimeRefresh();api.refreshRuntimeSpeedView();
assert.equal(layouts,1);
api.state.combatants.unit.speed=8;
assert.equal(api.forceRuntimeRefresh(),true,'A canonical startup Speed change invalidates the previous order');
api.refreshRuntimeSpeedView();
assert.equal(speedRows.unit.speed,8);
assert.equal(speedRows.unit.speedBaseRoll,3);
assert.equal(speedRows.unit.speedTie,0.25);
assert.equal(layouts,2,'Formation refreshes once for the new Speed');
sandbox.rollTurnSpeeds(1);sandbox.rollTurnSpeeds(1);
assert.equal(layouts,2,'Repeated same-round reads do not keep relaying out');
assert.equal(api.forceRuntimeRefresh(),false,'The same snapshot is idempotent');
console.log('Startup Speed formation refresh: canonical changes update order once without another roll.');
