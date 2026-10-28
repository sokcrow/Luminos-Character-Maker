import fs from 'node:fs';
import path from 'node:path';
import {encode,roundFingerprint} from './helpers/combat-pair-validation.mjs';
const directory=path.resolve(process.argv[2]||'artifacts/combat-pair');
const errors=[];
const read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
let manifest;
try{manifest=read(path.join(directory,'manifest.json'))}catch(error){errors.push('Missing/invalid manifest: '+error.message);manifest={cases:[]}}
const entries=Array.isArray(manifest.cases)?manifest.cases:[];
const order=['before','after','after','before'];
if(manifest.schemaVersion!==2)errors.push('Unsupported/incomplete measurement schema');
if(entries.length!==4||entries.some((entry,index)=>entry.iteration!==index||entry.label!==order[index]))errors.push('Exactly four ordered ABBA cases are required');
if(!['before','after'].every(label=>/^[a-f0-9]{40}$/.test(manifest.labels?.[label]||''))||manifest.labels?.before===manifest.labels?.after)errors.push('Distinct baseline/candidate commit SHAs are required');
const percentile=(rows,p)=>rows.length?rows.slice().sort((a,b)=>a-b)[Math.min(rows.length-1,Math.ceil(rows.length*p)-1)]:null;
const cases=entries.slice(0,4).map((entry,index)=>{
 const issues=[];
 // Use the expected fixed paths, never a path supplied by a partial manifest.
 const caseDir=path.join(directory,`${index+1}-${order[index]}`);
 let raw={};
 try{raw=read(path.join(caseDir,'raw.json'))}catch(error){issues.push('Missing/invalid raw data: '+error.message)}
 if(entry.complete!==true||raw.complete!==true||raw.failure)issues.push('Manifest and raw case must both be complete');
 if(raw.schemaVersion!==2||raw.iteration!==index||raw.label!==order[index]||raw.sha!==manifest.labels?.[order[index]])issues.push('Raw case identity/schema does not match manifest');
 if(raw.accounts!==2||raw.players!==1||raw.clients?.length!==2)issues.push('Exactly one DM and one Player are required');
 if(!Array.isArray(raw.errors)||raw.errors.length)issues.push('Missing error coverage or browser errors');
 if(raw.traceFailure)issues.push('Chromium trace capture failed');
 try{const trace=read(path.join(caseDir,'chromium-trace.json'));if(!Array.isArray(trace.traceEvents)||!trace.traceEvents.length)throw Error('empty trace')}catch(error){issues.push('Missing/invalid Chromium trace: '+error.message)}
 const ending=raw.ending,times=['requestedAt','endedAt','theatreAt','playerHiddenAt'].map(key=>ending?.[key]);
 if(times.some((value,i)=>!Number.isFinite(value)||value<=0||(i>0&&value<times[i-1])))issues.push('Missing/incomplete encounter ending');
 const rounds=Array.isArray(raw.rounds)?raw.rounds:[];
 if(rounds.length!==3||rounds.some((round,i)=>round.round!==i+1))issues.push('Three completed ordered rounds are required');
 const fingerprints=[];
 for(const round of rounds){try{fingerprints.push(roundFingerprint(round))}catch(error){issues.push(`Round ${round.round}: ${error.message}`)}}
 const telemetry=raw.clients?.[1]?.telemetry;
 const samples=Array.isArray(telemetry?.frames)?telemetry.frames.filter(row=>row.running&&row.visibility==='visible'):[];
 if(samples.some(row=>!Number.isFinite(row.ms)||row.ms<=0||!Number.isFinite(row.at)))issues.push('Invalid frame intervals/timestamps');
 for(let round=1;round<=3;round++){
   const rows=samples.filter(row=>row.round===round);
   // A single fast frame cannot stand in for a measured Clash. Each round must
   // have >=60 visible frames spanning >=1 second, in chronological order.
   if(rows.length<60||rows.at(-1)?.at-rows[0]?.at<1000||rows.some((row,i)=>i&&row.at<=rows[i-1].at))issues.push(`Round ${round}: insufficient/invalid visible frame coverage`);
 }
 const frames=samples.filter(row=>Number.isFinite(row.ms)&&row.ms>0).map(row=>row.ms);
 const total=frames.reduce((sum,ms)=>sum+ms,0),longTasks=telemetry?.longTasks||[];
 return {label:order[index],iteration:index,complete:issues.length===0,validationErrors:issues,fingerprint:fingerprints,
 frameCount:frames.length,fps:frames.length?1000*frames.length/total:null,median:percentile(frames,.5),p95:percentile(frames,.95),p99:percentile(frames,.99),max:frames.length?Math.max(...frames):null,
 longTaskCount:longTasks.length,longTaskMs:longTasks.reduce((sum,row)=>sum+row.duration,0),rounds,ending};
});
for(const row of cases)for(const issue of row.validationErrors)errors.push(`Case ${row.iteration+1}: ${issue}`);
const comparable=cases.length===4&&cases.every(row=>row.complete)&&cases.every(row=>encode(row.fingerprint)===encode(cases[0].fingerprint));
if(cases.every(row=>row.complete)&&cases.length===4&&!comparable)errors.push('Workload/results/canonical states differ across ABBA cases');
const valid=errors.length===0&&comparable;
const candidate=cases.filter(row=>row.label==='after');
const budgetPassed=valid&&candidate.every(row=>row.p95<=33.3&&row.max<10000);
const failed=!valid||!budgetPassed;
const lines=['# Single-player Clash comparison','','Synthetic Combat entry shell + iframe; not the full character sheet or real campaign assets. Headless Chromium is not a hardware FPS guarantee.','','| Case | Valid | Frames | Mean FPS¹ | Median ms | P95 ms | P99 ms | Max ms |','|---|---|---:|---:|---:|---:|---:|---:|'];
const fmt=value=>value==null?'missing':value.toFixed(2);
for(const row of cases)lines.push(`| ${row.iteration+1} ${row.label} | ${row.complete} | ${row.frameCount} | ${fmt(row.fps)} | ${fmt(row.median)} | ${fmt(row.p95)} | ${fmt(row.p99)} | ${fmt(row.max)} |`);
lines.push('','¹ Frame count / sum of sampled visible combat frame intervals. Observations in an invalid case do not establish a valid comparison.');
if(valid){
 const baseline=cases.filter(row=>row.label==='before'),mean=(rows,key)=>rows.reduce((sum,row)=>sum+row[key],0)/rows.length;
 lines.push('',`Mean case P95: ${fmt(mean(baseline,'p95'))} → ${fmt(mean(candidate,'p95'))} ms. Mean sampled FPS: ${fmt(mean(baseline,'fps'))} → ${fmt(mean(candidate,'fps'))}.`);
}
lines.push('',`Comparison validity: ${valid?'PASS':'FAIL'}.`, `Frame-time budget (P95 ≤ 33.3 ms; no interval ≥ 10 s): ${!valid?'NOT EVALUATED — invalid comparison':budgetPassed?'PASS':'FAIL'}.`);
if(errors.length)lines.push('','Validation failures:',...errors.map(error=>'- '+error));
fs.mkdirSync(directory,{recursive:true});
fs.writeFileSync(path.join(directory,'report.md'),lines.join('\n')+'\n');
fs.writeFileSync(path.join(directory,'summary.json'),JSON.stringify({cases,valid,sameWorkloadAndOutcome:comparable,budgetPassed,validationErrors:errors,failed},null,2));
console.log(lines.join('\n'));if(failed)process.exitCode=1;
