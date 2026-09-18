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
  "const particles=[];\n  let cssW=0,cssH=0,dpr=1,lastFrame=0,enabled=true;",
  "const w=Math.max(1,host.clientWidth||innerWidth),h=Math.max(1,host.clientHeight||innerHeight),nextDpr=Math.min(2,window.devicePixelRatio||1);",
  "if(entry){if(entry.ready&&onReady)onReady(entry);return entry}",
  "const bg=requestTexture(BG_URL,()=>host.classList.add('webgl2-background-ready'));",
  "const entry=requestTexture(url,()=>img.classList.add('webgl2-texture-backed'));",
  "function renderSprites(){\n    const rows=Array.from(document.querySelectorAll('.sprite-img')).map(img=>{",
  "const local=parsePath(path.getAttribute('d')),tone=intentToneFromClass(path),color=[...intentColors[tone]],secondary=path.classList.contains('atk-weight-secondary');color[3]*=opacity;",
  "particles.push({x,y,kind,range,start:performance.now(),life:310,seed:Math.random()*1000})",
  "const rays=p.range?7:10;for(let r=0;r<rays;r++){",
  "version:'0.8.0',",
];
for(const signature of requiredAlphaSignatures){
  assert.ok(alpha.includes(signature),`canonical alpha renderer signature changed: ${signature.slice(0,70)}`);
}
assert.ok(alpha.includes("lastFrame=now;if(enabled&&!rafId)rafId=requestAnimationFrame(frame)"),'canonical alpha still exposes the legacy continuous RAF loop for bootstrap patching');
assert.ok(alpha.includes('transition:transform .52s cubic-bezier(.18,.76,.22,1)'),'canonical battlefield still has an animated camera transform');

assert.ok(viewer.includes('COMBAT_WEBGL_PERF_PATCH_MISSING'),'renderer optimization patch must fail closed when alpha signatures drift');
assert.ok(viewer.includes('__luminousLivePlanSignature'),'live plan events must be deduplicated instead of deep-cloning and dispatching on every renderer pass');
assert.ok(viewer.includes('livePlanSignature=JSON.stringify([round,planReady,plannedActions])'),'live plan dedupe must include round, readiness and plan content');
assert.ok(viewer.includes("lowPowerDevice=coarsePointer||((navigator.hardwareConcurrency||8)<=4)||((navigator.deviceMemory||8)<=4)"),'renderer must identify mobile/low-power clients');
assert.ok(viewer.includes('dprCap=lowPowerDevice?1:1.5'),'low-power clients must render WebGL at DPR 1 while stronger clients retain higher quality');
assert.ok(viewer.includes('const domSpriteMode=lowPowerDevice'),'low-power clients must use hybrid DOM sprite composition');
assert.ok(viewer.includes('if(domSpriteMode)return'),'hybrid mode must skip per-frame WebGL sprite DOM geometry/style mirroring');
assert.ok(viewer.includes('const webglTextureCachePatch="if(entry)return entry"'),'ready texture cache hits must not invoke onReady and reawaken the RAF loop');
assert.ok(viewer.includes('const intentPathCache=new WeakMap()'),'intent path geometry must be cached between planning renders');
assert.ok(viewer.includes('cached={d,points:parsePath(d)}'),'intent paths must only be reparsed when their SVG path changes');
assert.ok(viewer.includes("lowPowerDevice?4:7")&&viewer.includes("lowPowerDevice?6:10"),'particle ray count must scale down on low-power clients');
assert.ok(viewer.includes('let rafId=0,dirty=true,continuousUntil=0,surfaceActive=true,parentVisibilityObserver=null,cameraTransitionActive=false'),'renderer must track dirty/on-demand, visibility, and camera transition state');
assert.ok(viewer.includes("host.classList.contains('round-running')||cameraTransitionActive||now<continuousUntil"),'continuous RAF must cover active camera transitions without relying on a short fixed timeout');
assert.ok(viewer.includes('if(!dirty&&!continuous)return'),'idle frames must stop when nothing changed');
assert.ok(viewer.includes("field.addEventListener('transitionrun',handleCameraTransition)"),'camera transition start must wake and sustain the renderer');
assert.ok(viewer.includes("field.addEventListener('transitionend',handleCameraTransition)"),'camera transition completion must stop continuous rendering after a final redraw');
assert.ok(viewer.includes("field.addEventListener('transitioncancel',handleCameraTransition)"),'cancelled camera transitions must clear continuous rendering state');
assert.ok(viewer.includes('cameraTransitionActive=false;continuousUntil=0'),'hiding Combat must clear transient animation state');
assert.ok(viewer.includes('MutationObserver'),'DOM combat changes must invalidate the renderer on demand');
assert.ok(viewer.includes('ResizeObserver'),'layout changes must invalidate renderer geometry without permanent RAF');
assert.ok(viewer.includes('ensureFrame(340)'),'GPU clash particles must explicitly wake the renderer for their lifetime');
assert.ok(viewer.includes("animate&&!host.classList.contains('round-running')?140:0"),'mutation wake tail must stay short and not extend an already-active round');
assert.ok(viewer.includes("version:'0.8.3-review-fixes'"),'patched renderer must advertise the review-fixed hybrid demand-render mode');
assert.ok(viewer.includes('requestRender:ensureFrame'),'renderer must expose a manual invalidation hook for future runtime integrations');
assert.ok(viewer.includes("renderMode:()=>rafId?'active':'idle'"),'renderer diagnostics must expose whether RAF is active or idle');
assert.ok(viewer.includes("spriteMode:()=>domSpriteMode?'dom-hybrid':'webgl'"),'renderer diagnostics must expose sprite composition mode');
assert.ok(viewer.includes("qualityMode:()=>lowPowerDevice?'low-power':'full'"),'renderer diagnostics must expose quality mode');
assert.ok(viewer.includes('surfaceActive:()=>surfaceActive'),'renderer diagnostics must expose whether Combat is currently visible');
assert.ok(viewer.includes('parentVisibilityObserver=new parent.MutationObserver(syncSurfaceActive)'),'Combat iframe must observe only its own parent visibility so hidden Combat stops rendering');
assert.ok(viewer.includes("attributeFilter:['class','style','aria-hidden']"),'parent visibility observer must be limited to visibility-relevant attributes');
assert.ok(viewer.includes('if(rafId){cancelAnimationFrame(rafId);rafId=0}'),'switching away from Combat must cancel an active RAF immediately');
assert.ok(viewer.includes('surfaceActive&&!document.hidden'),'hidden Combat surfaces and hidden tabs must not keep active RAF alive');

console.log('combat v0.7.3 player renderer performance smoke: ok');
