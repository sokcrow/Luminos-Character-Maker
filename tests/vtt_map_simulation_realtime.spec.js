const {test,expect}=require('@playwright/test');
const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const ROOT=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(ROOT,file),'utf8');

function checkModule(file){execFileSync(process.execPath,['--input-type=module','--check'],{input:read(file),stdio:['pipe','pipe','pipe']});}

test('map simulation modules parse and bootstrap after regional transition',()=>{
  execFileSync(process.execPath,['--check',path.join(ROOT,'js/vtt/map-simulation-core.js')]);
  checkModule('js/vtt/map-simulation-runtime.js');
  checkModule('js/vtt/main.js');
  const main=read('js/vtt/main.js');
  const transition=main.indexOf("import('./regional-local-transition-runtime.js')");
  const simulation=main.indexOf("import('./map-simulation-runtime.js')");
  expect(transition).toBeGreaterThan(-1);
  expect(simulation).toBeGreaterThan(transition);
  expect(main).toContain('window.LuminousVttRuntime?.mapSimulation?.stop?.()');
  expect(main).toContain('window.LuminousVttRuntime?.worldStreaming?.stop?.()');
});

test('map simulation has no polling, frame writes, movement writes, or permanent Firebase value listener',()=>{
  const runtime=read('js/vtt/map-simulation-runtime.js');
  expect(runtime).not.toContain('setInterval(');
  expect(runtime).not.toContain('setTimeout(');
  expect(runtime).not.toContain('requestAnimationFrame(');
  expect(runtime).not.toContain("addEventListener('mousemove'");
  expect(runtime).not.toContain('.on(\'value\'');
  expect(runtime).not.toContain('.on("value"');
  expect(runtime).toContain("once('value')");
  expect(runtime).toContain("globalThis.addEventListener?.('luminous:world-scheduler-updated',onWorldClock)");
});

test('persistent map state stays under the existing DM-authoritative world-state rules',()=>{
  const runtime=read('js/vtt/map-simulation-runtime.js');
  const rules=JSON.parse(read('database.rules.json'));
  expect(runtime).toContain("PERSIST_ROOT='campaña/estado_mundo/mapSimulationZones'");
  expect(rules.rules['campaña']['estado_mundo']['.write']).toContain("auth.uid === 'e9JwFZrtk6g8UMqq2Hf9EHVY7Ay1'");
  expect(runtime).toContain('if(!isDm||!db)return');
});

test('meaningful entity changes use one compact path update and dormant flushes use one record write',()=>{
  const runtime=read('js/vtt/map-simulation-runtime.js');
  expect(runtime).toContain('updates[`entities/${entityId}`]=entry');
  expect(runtime).toContain('await zoneRef(identity).update(updates)');
  expect(runtime).toContain('await zoneRef(identity).set({...record,lastPersistReason:reason})');
  expect(runtime).not.toContain('mapData:clone(mapData)');
  expect(runtime).not.toContain('JSON.stringify(mapData)');
});

test('world object writes emit stable map deltas but procedural replaceAll does not fan out deltas',()=>{
  const source=read('js/vtt/world-object-state.js');
  expect(source).toContain("new root.CustomEvent('vtt:map-delta'");
  const save=source.slice(source.indexOf('async function saveInstance'),source.indexOf('async function deleteInstance'));
  const remove=source.slice(source.indexOf('async function deleteInstance'),source.indexOf('async function replaceAll'));
  const replace=source.slice(source.indexOf('async function replaceAll'),source.indexOf('async function saveDefinition'));
  expect(save).toContain("operation:'upsert'");
  expect(remove).toContain("operation:'remove'");
  expect(replace).not.toContain('emitMapDelta');
});

test('runtime exposes host-fed eight-player reconciliation without adding a player-root realtime listener',()=>{
  const runtime=read('js/vtt/map-simulation-runtime.js');
  expect(runtime).toContain('reconcileActors:(actors,now=worldNowMs())=>reconcile(actors,now)');
  expect(runtime).not.toContain("campaña/jugadores");
  expect(runtime).toContain('maxActiveZones:8');
  expect(runtime).toContain('maxWarmZones:16');
});

test('dormant records are evicted locally after persistence instead of accumulating visited Zones',()=>{
  const runtime=read('js/vtt/map-simulation-runtime.js');
  expect(runtime).toContain('async function releaseDormant');
  expect(runtime).toContain('loadedZones.delete(key)');
  expect(runtime).toContain('store.forget(identity,{onlyPristine:false})');
});

test('existing chunk streaming performance budgets remain unchanged',()=>{
  const runtime=read('js/vtt/world-streaming-runtime.js');
  expect(runtime).toContain('maxActiveChunks:8');
  expect(runtime).toContain('maxWarmChunks:16');
  expect(runtime).toContain('warmTtlMs:30000');
});
