import assert from 'node:assert/strict';
import fs from 'node:fs';
import { gunzipSync } from 'node:zlib';

const partPaths=[
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
  'combat/combat-v073-live.bundle.part11'
];

for(const path of partPaths)assert.ok(fs.existsSync(path),`real Combat bundle part missing: ${path}`);

const encoded=partPaths.map(path=>fs.readFileSync(path,'utf8')).join('').replace(/\s+/g,'');
assert.ok(encoded.length>100000,'real Combat bundle must not be empty/truncated');

let source='';
assert.doesNotThrow(()=>{
  source=gunzipSync(Buffer.from(encoded,'base64')).toString('utf8');
},'the exact bundle loaded by Battle-viewer must base64-decode and gunzip in CI');

assert.ok(source.length>100000,'decompressed Combat runtime must contain the real engine document');
assert.ok(source.includes('id="game-container"'),'real decompressed runtime must contain #game-container');
assert.ok(source.includes('id="battlefield"'),'real decompressed runtime must contain #battlefield');

const patchNeedles=[
  ['ready-cancel','setStatus(`READY CANCELADO · Puedes corregir las acciones del Turn ${round}`);\n    return;'],
  ['ready-confirm',"planReady=true;\n  ready.textContent='CANCEL READY';"],
  ['live-control',"    unit.controlled=unit.id===PLAYER_ID?'player':'ai';\n    unit.focusMenu=unit.id===PLAYER_ID;"],
  ['live-ai-plans',"Object.values(combatData).filter(unit=>unit.controlled==='ai').forEach(unit=>{"],
  ['live-ai-arrows',"Object.values(combatData).filter(unit=>unit.controlled==='ai'&&isUnitTargetable(unit)).forEach(unit=>{"],
  ['live-plan-render',"function renderTargetArrows(){\n  const overlay=$('target-intent-overlay');"],
  ['webgl-state',"const particles=[];\n  let cssW=0,cssH=0,dpr=1,lastFrame=0,enabled=true;"],
  ['webgl-resize',"const w=Math.max(1,host.clientWidth||innerWidth),h=Math.max(1,host.clientHeight||innerHeight),nextDpr=Math.min(2,window.devicePixelRatio||1);"],
  ['webgl-cache',"if(entry){if(entry.ready&&onReady)onReady(entry);return entry}"],
  ['webgl-background',"const bg=requestTexture(BG_URL,()=>host.classList.add('webgl2-background-ready'));"],
  ['webgl-sprite',"const entry=requestTexture(url,()=>img.classList.add('webgl2-texture-backed'));"],
  ['webgl-render-sprites',"function renderSprites(){\n    const rows=Array.from(document.querySelectorAll('.sprite-img')).map(img=>{"],
  ['webgl-intent',"const local=parsePath(path.getAttribute('d')),tone=intentToneFromClass(path),color=[...intentColors[tone]],secondary=path.classList.contains('atk-weight-secondary');color[3]*=opacity;"],
  ['webgl-burst',"particles.push({x,y,kind,range,start:performance.now(),life:310,seed:Math.random()*1000})"],
  ['webgl-rays',"const rays=p.range?7:10;for(let r=0;r<rays;r++){"],
  ['webgl-api',"version:'0.8.0',"]
];

for(const [label,needle] of patchNeedles){
  assert.ok(source.includes(needle),`Battle-viewer real bootstrap patch drift: ${label}`);
}

const viewer=fs.readFileSync('Battle-viewer.html','utf8');
const dmBridge=fs.readFileSync('js/dm-combat-live-viewer.js','utf8');
const liveAdapter=fs.readFileSync('js/combat-v073-live-adapter.js','utf8');

assert.ok(viewer.includes('LuminousCombatBootstrapState'),'Battle Viewer must expose real bootstrap state to the parent DM surface');
assert.ok(viewer.includes("stage('bundle-fetch'"),'Battle Viewer must expose bundle fetch stage');
assert.ok(viewer.includes("stage('bundle-decompressed'"),'Battle Viewer must expose successful real bundle decompression');
assert.ok(viewer.includes("stage('runtime-write'"),'Battle Viewer must expose patched runtime installation');
assert.ok(viewer.includes("stage('error',message,message)"),'Battle Viewer must expose bootstrap errors instead of leaving a silent black surface');
assert.ok(viewer.includes("luminous:combat073-hydrated"),'Battle Viewer bootstrap state must reach real runtime hydration');

assert.ok(dmBridge.includes('function bootstrapState()'),'real DM bridge must inspect child Battle bootstrap state');
assert.ok(dmBridge.includes('bootstrap?.error'),'real DM bridge must surface child bootstrap failures');
assert.ok(dmBridge.includes('visibleSpriteCount>=combatantCount'),'DM readiness must require every deployed FIELD combatant to have visible sprite evidence');
assert.ok(dmBridge.includes("querySelectorAll?.('.sprite-container')"),'DM fallback must restore the real DOM sprite containers, not only image nodes');
assert.ok(dmBridge.includes("version:'1.3.0-real-bootstrap'"),'DM bridge version must identify the real-bootstrap readiness contract');
assert.ok(liveAdapter.includes('"identity-unresolved"'),'live adapter must expose canonical identity failure instead of leaving a silent DM surface');
assert.ok(liveAdapter.includes('"dm-identity-config"'),'live adapter must expose campaign DM identity resolution');
assert.ok(liveAdapter.includes('"auth-ready"'),'live adapter must expose successful Firebase authentication');

console.log(`DM Combat real bundle/bootstrap compatibility: ok · ${partPaths.length} parts · ${source.length} decompressed chars`);
