import fs from 'node:fs';
import path from 'node:path';
const directory=path.resolve(process.argv[2]||'artifacts/combat-pair');
const manifest=JSON.parse(fs.readFileSync(path.join(directory,'manifest.json'),'utf8'));
const percentile=(rows,p)=>rows.length?rows.slice().sort((a,b)=>a-b)[Math.min(rows.length-1,Math.ceil(rows.length*p)-1)]:null;
const cases=manifest.cases.map(entry=>{
 const raw=JSON.parse(fs.readFileSync(path.join(directory,`${entry.iteration+1}-${entry.label}`,'raw.json'),'utf8'));
 const telemetry=raw.clients?.[1]?.telemetry,frames=telemetry?.frames?.filter(row=>row.running&&row.visibility==='visible').map(row=>row.ms)||[];
 const total=frames.reduce((sum,ms)=>sum+ms,0),longTasks=telemetry?.longTasks||[];
 return {...entry,frameCount:frames.length,fps:frames.length?1000*frames.length/total:null,median:percentile(frames,.5),p95:percentile(frames,.95),p99:percentile(frames,.99),max:frames.length?Math.max(...frames):null,longTaskCount:longTasks.length,longTaskMs:longTasks.reduce((sum,row)=>sum+row.duration,0),observers:telemetry?.observers,rounds:raw.rounds,ending:raw.ending,traceFailure:raw.traceFailure};
});
const lines=['# Single-player Clash comparison','','Synthetic authenticated Combat entry shell + Battle Viewer iframe; not the complete character sheet or real campaign assets. Headless Chromium timing is not a hardware FPS guarantee. Each case uses 3 rounds without reload, 5 seconds idle, normal Coins and timing. Raw observer/profile data and Chromium CPU trace accompany each case.','','| Case | Complete | Frames | Mean FPS¹ | Median ms | P95 ms | P99 ms | Max ms | Long tasks ms |','|---|---|---:|---:|---:|---:|---:|---:|---:|'];
const fmt=value=>value==null?'missing':value.toFixed(2);
for(const row of cases)lines.push(`| ${row.iteration+1} ${row.label} | ${row.complete} | ${row.frameCount} | ${fmt(row.fps)} | ${fmt(row.median)} | ${fmt(row.p95)} | ${fmt(row.p99)} | ${fmt(row.max)} | ${fmt(row.longTaskMs)} |`);
lines.push('','¹ Frame count / sum of sampled frame intervals, during running combat only. This is separate from presentation skew. Missing or incomplete samples never count as a pass.');
const baseline=cases.filter(row=>row.label==='before'&&row.complete&&row.frameCount),candidate=cases.filter(row=>row.label==='after'&&row.complete&&row.frameCount);
if(baseline.length&&candidate.length){
 const mean=(rows,key)=>rows.reduce((sum,row)=>sum+row[key],0)/rows.length;
 lines.push('',`Mean case P95: ${fmt(mean(baseline,'p95'))} → ${fmt(mean(candidate,'p95'))} ms. Mean sampled FPS: ${fmt(mean(baseline,'fps'))} → ${fmt(mean(candidate,'fps'))}.`);
}
const failed=cases.some(row=>!row.complete||!row.frameCount||row.traceFailure)||!baseline.length||!candidate.length||candidate.some(row=>row.p95>33.3||row.max>=10000);
lines.push('',`Frame-time budget (P95 ≤ 33.3 ms; no interval ≥ 10 s): ${failed?'FAIL / incomplete':'PASS'}.`);
fs.writeFileSync(path.join(directory,'report.md'),lines.join('\n')+'\n');
fs.writeFileSync(path.join(directory,'summary.json'),JSON.stringify({cases,failed},null,2));
console.log(lines.join('\n'));if(failed)process.exitCode=1;
