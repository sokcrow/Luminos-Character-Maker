const { test, expect } = require('@playwright/test');
const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const ROOT=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(ROOT,file),'utf8');

test('procedural runtime persists every canonical scene store cleared or replaced by CREAR ZONA',()=>{
  const src=read('js/vtt/procedural-generator-bootstrap.js');
  expect(src).toContain('runtime.bridge.replaceAll(mapData.topology||[])');
  expect(src).toContain('runtime.verticalBridge.replaceAll(mapData.verticalPortals||[])');
  expect(src).toContain('liveRuntime.worldObjects.bridge.replaceAll(mapData.worldObjects||[])');
  expect(src).toContain('mapBridge.saveDefinition(authoring.definitionFromMapData(mapData))');
  expect(src).toContain("emit('vtt:procedural-persisted'");
  expect(src).toContain("emit('vtt:procedural-persist-failed'");
});

test('topology bridge replaces the generated topology with one canonical Firebase set',()=>{
  const src=read('js/vtt/topology-replace-state-patch.js');
  expect(src).toContain('async function replaceAll');
  expect(src).toContain('base.recordFromElements');
  expect(src).toContain("db.ref(`${base.TOPOLOGY_ROOT}/${bridge.mapId}/elements`).set(record)");
  expect(src).toContain('replaceElement, replaceAll');
});

test('vertical portal bridge can atomically clear stale stairs elevators and ramps when a Zone replaces a scene',()=>{
  const src=read('js/vtt/vertical-portal-state.js');
  expect(src).toContain('async function replaceAll');
  expect(src).toContain('portalsRef().set(recordFromPortals(normalized, runtime, mapData))');
  expect(src).toContain('replaceAll,');
});

test('world-object bridge can atomically clear stale persistent objects when a Zone replaces a scene',()=>{
  const src=read('js/vtt/world-object-state.js');
  expect(src).toContain('async function replaceAll');
  expect(src).toContain('db.ref(objectsPath).set(record)');
  expect(src).toContain('deleteInstance,replaceAll,saveDefinition');
});

test('procedural seed profile signature and Zone contract travel with canonical map definitions',()=>{
  const src=read('js/vtt/procedural-map-authoring-patch.js');
  expect(src).toContain('__proceduralAware:true');
  expect(src).toContain('procedural:clone(raw.procedural??fallback.procedural??null)');
  expect(src).toContain('mapData.procedural=clone(normalized.procedural)');
  expect(src).toContain('definitionFromMapData');
});

test('zone persistence modules parse as JavaScript',()=>{
  for(const file of ['js/vtt/procedural-map-authoring-patch.js','js/vtt/topology-replace-state-patch.js','js/vtt/vertical-portal-state.js','js/vtt/world-object-state.js'])execFileSync(process.execPath,['--check',path.join(ROOT,file)],{stdio:'pipe'});
  execFileSync(process.execPath,['--input-type=module','--check'],{input:read('js/vtt/procedural-generator-bootstrap.js'),stdio:['pipe','pipe','pipe']});
});
