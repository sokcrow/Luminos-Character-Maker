import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const root=process.cwd();
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const viewer=read('Battle-viewer.html');
const bundlePaths=[
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
const encoded=bundlePaths.map(read).join('').replace(/\s+/g,'');
const alpha=zlib.gunzipSync(Buffer.from(encoded,'base64')).toString('utf8');

const requiredAlphaSignatures=[
  "const w=Math.max(1,host.clientWidth||innerWidth),h=Math.max(1,host.clientHeight||innerHeight),nextDpr=Math.min(2,window.devicePixelRatio||1);",
  "const bg=requestTexture(BG_URL,()=>host.classList.add('webgl2-background-ready'));",
  "const entry=requestTexture(url,()=>img.classList.add('webgl2-texture-backed'));",
  "particles.push({x,y,kind,range,start:performance.now(),life:310,seed:Math.random()*1000})",
  "version:'0.8.0',",
];
for(const signature of requiredAlphaSignatures){
  assert.ok(alpha.includes(signature),`canonical alpha renderer signature changed: ${signature.slice(0,70)}`);
}
assert.ok(alpha.includes("lastFrame=now;if(enabled&&!rafId)rafId=requestAnimationFrame(frame)"),'canonical alpha still exposes the legacy continuous RAF loop for bootstrap patching');

assert.ok(viewer.includes('COMBAT_WEBGL_PERF_PATCH_MISSING'),'renderer optimization patch must fail closed when alpha signatures drift');
assert.ok(viewer.includes("dprCap=coarse?1.25:1.5"),'player renderer must cap DPR more aggressively, especially on coarse/mobile pointers');
assert.ok(viewer.includes('let rafId=0,dirty=true,continuousUntil=0'),'renderer must track dirty/on-demand state instead of unconditional continuous rendering');
assert.ok(viewer.includes("particles.length>0||host.classList.contains('round-running')||now<continuousUntil"),'continuous RAF must be restricted to active combat/VFX windows');
assert.ok(viewer.includes('if(!dirty&&!continuous)return'),'idle frames must stop when nothing changed');
assert.ok(viewer.includes('MutationObserver'),'DOM combat changes must invalidate the renderer on demand');
assert.ok(viewer.includes('ResizeObserver'),'layout changes must invalidate renderer geometry without permanent RAF');
assert.ok(viewer.includes('ensureFrame(340)'),'GPU clash particles must explicitly wake the renderer for their lifetime');
assert.ok(viewer.includes("version:'0.8.1-demand'"),'patched renderer must advertise demand-render mode');
assert.ok(viewer.includes('requestRender:ensureFrame'),'renderer must expose a manual invalidation hook for future runtime integrations');
assert.ok(viewer.includes("renderMode:()=>rafId?'active':'idle'"),'renderer diagnostics must expose whether RAF is active or idle');
assert.ok(viewer.includes('!document.hidden'),'hidden tabs must not keep the active combat RAF loop alive');

console.log('combat v0.7.3 player renderer performance smoke: ok');
