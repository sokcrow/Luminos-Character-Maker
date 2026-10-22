import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const timers=new Map(),writes=[],batches=[];let timerId=0;
const db={ref:()=>({update(data){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});writes.push({data,resolve,reject});return promise;}})};
const context=vm.createContext({console,Math,Uint32Array,Promise,JSON,Map,Set,
 setTimeout(fn){const id=++timerId;timers.set(id,fn);return id;},clearTimeout(id){timers.delete(id);},
 addEventListener(){},LuminousCombatLiveAdapter073:{state:{db,role:'dm',round:1}},
 LuminousCombat073:{combatants:()=>({enemy:{hp:10,maxHp:10}})},
 LuminousCombatPlaybackSync:{enabled:()=>true,assertOwner(){},batchUpdates(row){batches.push(row);row.seq=batches.length;return {['batch/'+row.seq]:JSON.stringify(row)};},commitUpdates:v=>v},
});context.window=context;
vm.runInContext(fs.readFileSync('js/combat-v073-authority.js','utf8'),context);
const a=context.LuminousCombatAuthority073;
Object.assign(a.state,{current:{id:'round',phase:'running',round:1},runningLocal:true,executingGeneration:'round'});
assert.equal(a.publishPresentation(),undefined,'Coin presentation must not return a network wait');
a.publishPresentation();
const flush=[...timers.values()].at(-1);flush();
assert.equal(writes.length,1,'simultaneous cues coalesce');
assert.equal(batches[0].combatants,undefined,'presentation transport carries deltas, not the full inventory');
a.publishPresentation();a.queueCheckpoint('action');
assert.equal(writes.length,2,'next cue submits without awaiting previous ACK');
let drained=false;a.state.writeChain.then(()=>{drained=true;});
await Promise.resolve();assert.equal(drained,false);
writes[0].resolve();writes[1].resolve();
await new Promise(resolve=>setImmediate(resolve));
assert.equal(writes.length,3,'checkpoint follows accepted presentations');
assert.equal(drained,false,'checkpoint remains a durability barrier');
writes[2].resolve();await a.state.writeChain;assert.equal(drained,true);
a.publishPresentation();[...timers.values()].at(-1)();
const failed=Error('transport disconnected');writes.at(-1).reject(failed);
await assert.rejects(a.state.writeChain,/transport disconnected/);
await Promise.resolve();assert.throws(()=>a.publishPresentation(),/transport disconnected/);

await import('../js/combat-v073-playback.js');
const protocol=globalThis.LuminousCombatPlayback,started=[],resolvers=[],applied=[],events=[],errors=[];
let finished=false;
const consumer=protocol.createConsumer({generation:'round',apply:s=>applied.push(s),onEvent:e=>events.push(e.sequence),onError:e=>errors.push(e.message),
 present(cue,args){started.push(args[0].ownerId);return new Promise(resolve=>resolvers.push(resolve));},finish(){finished=true;}});
const cue=(sequence,owner)=>({sequence,type:'Presentation',cue:'powerCoin',args:[{ownerId:owner},{index:0}],changes:sequence===1?[{unitId:'enemy',after:{hp:9}},{unitId:'ally',after:{hp:10}}]:[]});
const payload={seq:1,eventCursor:2,type:'round_complete',events:[cue(1,'ally'),cue(2,'enemy')],combatants:{enemy:{hp:9}}};
const envelope={seq:1,generation:'round',schemaVersion:1,engineVersion:protocol.engineVersion,payload:JSON.stringify(payload)};
consumer.receive(envelope);await new Promise(resolve=>setImmediate(resolve));
assert.deepEqual(started,['ally','enemy'],'both Clash Coin animations begin before either finishes');
assert.deepEqual(events,[1,2]);assert.equal(applied.length,1,'one render for all changes in an event');assert.equal(finished,false);
resolvers.forEach(resolve=>resolve());await consumer.idle();assert.equal(finished,true);assert.equal(consumer.cursor(),1);
consumer.receive(envelope);await consumer.idle();assert.equal(started.length,2,'repeated transport does not replay Coins');
consumer.receive({...envelope,payload:JSON.stringify({...payload,type:'different'})});await consumer.idle();assert.deepEqual(errors,['PLAYBACK_BATCH_CONFLICT']);
// Regression: each flushed transport frame must copy only unsent events,
// even after many Coins and following a restored journal cursor.
await import('../js/combat-v073-steps.js');
const steps=globalThis.LuminousCombatSteps.create({rules:{}});
for(let i=0;i<250;i++)steps.emit('Presentation',null,{cue:'powerCoin',index:i});
assert.equal(steps.events().length,250);
assert.deepEqual(steps.events(248).map(e=>e.sequence),[249,250]);
assert.deepEqual(steps.events(250),[]);
steps.resetJournal(400);steps.emit('RoundRestored',null,{});
assert.deepEqual(steps.events(400).map(e=>e.sequence),[401]);
assert.deepEqual(steps.events(399).map(e=>e.sequence),[401]);
// Exercise the shipped surface as well as the engine: dropping either cursor
// here resends old events or restarts a recovered sequence at one.
const source=fs.readFileSync('combat/source/combat-v073-live.html','utf8');
const surfaceSource=source.slice(source.indexOf('window.LuminousCombatStepRuntime=Object.freeze({'),source.indexOf('  captureExecution(queue,resolvedKeys){'));
const surfaceContext=vm.createContext({window:{LuminousCombatSteps:globalThis.LuminousCombatSteps},combatStepRuntime:()=>steps});
vm.runInContext(surfaceSource+'});',surfaceContext);
const surface=surfaceContext.window.LuminousCombatStepRuntime;
assert.deepEqual(surface.events(401),[]);
surface.resetJournal(700);steps.emit('RoundRestored',null,{});
assert.deepEqual(surface.events(700).map(e=>e.sequence),[701]);
// Send multiple batches through the production surface and transport into the
// production consumer. A repeated event must fail, rather than be ignored.
const transportContext=vm.createContext({console,JSON,Math,Map,Set,addEventListener(){},
 LuminousCombatStepRuntime:surface,LuminousCombatPlayback:protocol});
transportContext.window=transportContext;
vm.runInContext(fs.readFileSync('js/combat-v073-playback-sync.js','utf8'),transportContext);
const transport=transportContext.LuminousCombatPlaybackSync;
transport.state.authority={state:{current:{id:'integrated',round:1,playback:{session:transport.session}}}};
surface.resetJournal(0);
const received=[],failures=[];
const live=protocol.createConsumer({generation:'integrated',apply(){},present(){},finish(){},onEvent:e=>received.push(e.sequence),onError:e=>failures.push(e.message)});
for(let i=0;i<3;i++){
 steps.emit('Presentation',null,{cue:'powerCoin',args:[]});
 const updates=transport.batchUpdates({type:i===2?'round_complete':'presentation'});
 const batch=Object.values(updates)[0];
 assert.deepEqual(JSON.parse(batch.payload).events.map(e=>e.sequence),[i+1]);
 await live.receive(batch);
}
assert.deepEqual(received,[1,2,3]);assert.deepEqual(failures,[]);assert.equal(live.cursor(),3);
console.log('Presentation transport: incremental journal, coalescing, nonblocking ACKs, durable barriers, failure propagation, parallel Coins and duplicate/conflict replay passed.');
