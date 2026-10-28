import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const root=fs.mkdtempSync(path.join(os.tmpdir(),'combat-pair-report-'));
const reporter=fileURLToPath(new URL('./combat-pair-report.mjs',import.meta.url));
const order=['before','after','after','before'];
function fixture(){
 const manifest={schemaVersion:2,labels:{before:'a'.repeat(40),after:'b'.repeat(40)},cases:order.map((label,iteration)=>({label,iteration,complete:true}))};
 const raw=order.map((label,iteration)=>{
   const units={'player:p1':{hp:100,sp:0,statusEffects:{},pendingStatusEffects:[],shieldPools:{}},kobold1:{hp:80,sp:0,statusEffects:{},pendingStatusEffects:[],shieldPools:{}}};
   const rounds=[1,2,3].map(round=>{
     const cues=['clashStart','powerCoin','powerEnd','clashOutcome','clashEnd'].map((cue,index)=>({round,roundId:`random-session-${iteration}-${round}`,sequence:index+1,cue,owner:'player:p1',opponent:'kobold1',index:0,result:cue==='powerCoin'?{power:16,side:'head'}:{winner:'player:p1'},paintAt:round*10000+index*100}));
     return {round,seed:123,canonical:structuredClone(units),clients:[{units:structuredClone(units),cues:structuredClone(cues)},{units:structuredClone(units),cues:structuredClone(cues)}]};
   });
   const frames=[1,2,3].flatMap(round=>Array.from({length:70},(_,i)=>({round,running:true,visibility:'visible',at:round*10000+i*17,ms:17})));
   return {schemaVersion:2,label,iteration,sha:manifest.labels[label],complete:true,accounts:2,players:1,errors:[],rounds,clients:[{},{telemetry:{frames,longTasks:[]}}],ending:{requestedAt:50000,endedAt:51000,theatreAt:52000,playerHiddenAt:53000}};
 });
 return {manifest,raw};
}
function run(name,mutate,valid=false,budget=false){
 const dir=path.join(root,name),data=fixture();mutate?.(data);
 fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'manifest.json'),JSON.stringify(data.manifest));
 data.raw.forEach((raw,i)=>{const p=path.join(dir,`${i+1}-${order[i]}`);fs.mkdirSync(p);fs.writeFileSync(path.join(p,'raw.json'),JSON.stringify(raw));fs.writeFileSync(path.join(p,'chromium-trace.json'),JSON.stringify({traceEvents:[{name:'RunTask'}]}));});
 if(name==='missing-trace')fs.unlinkSync(path.join(dir,'2-after','chromium-trace.json'));
 if(name==='empty-trace')fs.writeFileSync(path.join(dir,'2-after','chromium-trace.json'),'{"traceEvents":[]}');
 const process=spawnSync(globalThis.process.execPath,[reporter,dir],{encoding:'utf8'});
 assert.equal(process.status,valid&&budget?0:1,name+': '+process.stderr);
 const summary=JSON.parse(fs.readFileSync(path.join(dir,'summary.json')));
 assert.equal(summary.valid,valid,name+': validity');assert.equal(summary.budgetPassed,budget,name+': budget');
 if(!valid)assert.ok(!process.stdout.includes('Mean sampled FPS:'),name+': invalid runs must not publish a comparison');
}
try{
 run('complete-with-distinct-session-identities',null,true,true);
 run('two-cases-only',data=>{data.manifest.cases=data.manifest.cases.slice(0,2)});
 run('wrong-order',data=>{data.manifest.cases[1].label='before'});
 run('duplicate-iteration',data=>{data.manifest.cases[3].iteration=0});
 run('raw-incomplete',data=>{data.raw[1].complete=false});
 run('raw-failure',data=>{data.raw[1].failure='timeout'});
 run('missing-rounds',data=>{data.raw[1].rounds=[]});
 run('missing-ending',data=>{delete data.raw[1].ending});
 run('out-of-order-ending',data=>{data.raw[1].ending.theatreAt=1});
 run('missing-trace');run('empty-trace');
 run('trace-failure',data=>{data.raw[1].traceFailure='IO failed'});
 run('one-frame',data=>{data.raw[1].clients[1].telemetry.frames=[{round:1,running:true,visibility:'visible',at:1,ms:1}]});
 run('nan-interval',data=>{data.raw[1].clients[1].telemetry.frames[0].ms=null});
 run('missing-raw-identity',data=>{delete data.raw[1].sha});
 run('damage-changed-but-clients-agree',data=>{
   const round=data.raw[1].rounds[0];round.canonical.kobold1.hp=77;
   round.clients.forEach(client=>{client.units.kobold1.hp=77});
 });
 run('coin-changed-but-clients-agree',data=>{data.raw[1].rounds[1].clients.forEach(client=>{client.cues[1].result.side='tail'})});
 run('fewer-cues-but-clients-agree',data=>{data.raw[1].rounds[2].clients.forEach(client=>{client.cues=client.cues.filter(cue=>cue.cue!=='powerEnd')})});
 run('missing-clash-phase',data=>{data.raw[1].rounds[0].clients.forEach(client=>{client.cues=client.cues.filter(cue=>cue.cue!=='clashEnd')})});
 run('duplicate-cue',data=>{data.raw[1].rounds[0].clients[1].cues.push(data.raw[1].rounds[0].clients[1].cues[0])});
 run('missing-paint',data=>{delete data.raw[1].rounds[0].clients[1].cues[0].paintAt});
 run('seed-changed',data=>{data.raw[2].rounds[2].seed=999});
 run('slow-but-valid',data=>{data.raw[1].clients[1].telemetry.frames.forEach(frame=>frame.ms=50)},true,false);
 console.log('23 reporter regressions passed: completeness, traces, coverage, ending, cross-version outcomes/cues/seeds, session normalization, and separate FPS budget.');
}finally{fs.rmSync(root,{recursive:true,force:true})}
