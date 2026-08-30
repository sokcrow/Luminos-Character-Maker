const { test, expect } = require('@playwright/test');
const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const ROOT=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(ROOT,file),'utf8');

const authoring=()=>read('js/vtt/procedural-generator-authoring-bootstrap.js');
const runtime=()=>read('js/vtt/procedural-generator-bootstrap.js');
const renderer=()=>read('js/vtt/procedural-preview-renderer-patch.js');
const mapPatch=()=>read('js/vtt/procedural-map-authoring-patch.js');
const topologyState=()=>read('js/vtt/topology-replace-state-patch.js');

function loadPreviewCore(){
  const key='LuminousVttProceduralPreviewRenderer',previous=global[key],file=path.join(ROOT,'js/vtt/procedural-preview-renderer-patch.js');
  delete global[key];delete require.cache[require.resolve(file)];const api=require(file);
  return{api,restore(){delete require.cache[require.resolve(file)];if(previous===undefined)delete global[key];else global[key]=previous;}};
}

test('DM Edit Mode exposes a dedicated professional CREAR ZONA launcher and panel',()=>{
  const src=authoring();
  expect(src).toContain("PANEL_ID='vtt-procedural-zone-panel'");
  expect(src).toContain('MAP CREATOR');
  expect(src).toContain('CREAR ZONA');
  expect(src).toContain('ZONE CREATOR');
  expect(src).toContain('PROCEDURAL MAP AUTHORING');
  expect(src).toContain("const enabled=()=>mapData.dmEditMode?.active===true");
});

test('Zone Creator offers 1x1, 2x2 and 3x3 technical chunk sizes',()=>{
  const src=authoring();
  expect(src).toContain('1×1 CHUNK · 40×40');
  expect(src).toContain('2×2 CHUNKS · 80×80');
  expect(src).toContain('3×3 CHUNKS · 120×120');
  expect(src).toContain('chunkCols:size');
  expect(src).toContain('chunkRows:size');
});

test('Zone Creator exposes professional urban fabric controls and profile reset',()=>{
  const src=authoring();
  for(const token of ['data-proc-density','data-proc-attach','data-proc-alley','data-proc-service','data-proc-secondary'])expect(src).toContain(token);
  for(const key of ['density','attachBias','alleyBias','serviceAccessBias','secondaryRoadChance'])expect(src).toContain(key);
  expect(src).toContain('data-proc-reset');
  expect(src).toContain('procedural.profile(selectedProfileId())');
});

test('runtime accepts a customized profile object without creating a parallel procedural format',()=>{
  const src=runtime();
  expect(src).toContain('const {profile,profileId,...rest}=options||{}');
  expect(src).toContain("const profileInput=profile||profileId||'mixed_urban'");
  expect(src).toContain('profileId:profileInput');
  expect(src).toContain("profile:(id='mixed_urban')=>({...fabric.normalizeProfile(id)})");
  expect(src).toContain('createZone');
});

test('generation edits invalidate stale previews before CREAR ZONA can apply',()=>{
  const src=authoring();
  expect(src).toContain('function generationChanged');
  expect(src).toContain("by('[data-proc-seed]')?.addEventListener('input',()=>generationChanged())");
  expect(src).toContain("by('[data-proc-size]')?.addEventListener('change',()=>generationChanged())");
  expect(src).toContain("panel.querySelectorAll('input[type=range]').forEach(input=>input.addEventListener('input',()=>generationChanged()))");
  expect(src).toContain('mapData.proceduralEditor.previewPlan=null');
  expect(src).toContain('apply.disabled=busy||!lastPlan?.validation?.valid');
});

test('DM gets visual preview controls, auto-fit, reroll and explicit cancel',()=>{
  const src=authoring();
  for(const option of ['showChunks','showParcels','showRooms','showTopology','showLabels'])expect(src).toContain(option);
  expect(src).toContain('function fitPreview');
  expect(src).toContain('camera.centerOnWorldPoint?.');
  expect(src).toContain('GENERAR PREVIEW');
  expect(src).toContain('REROLL');
  expect(src).toContain('CANCELAR PREVIEW');
  expect(src).toContain('ENCUADRAR');
});

test('final zone creation is destructive only after a valid preview and warns on existing scene content',()=>{
  const src=authoring();
  expect(src).toContain('if(!lastPlan?.validation?.valid||busy)return null');
  expect(src).toContain('sceneHasContent()&&!window.confirm');
  expect(src).toContain('reemplazará la geometría y semántica actual');
  expect(src).toContain("procedural.apply(lastPlan,{replaceScene:true})");
  expect(src).toContain('Los tokens de jugador se conservan');
});

test('applied DM zones persist topology atomically and save the patched map definition',()=>{
  const src=runtime();
  expect(src).toContain("import './procedural-map-authoring-patch.js'");
  expect(src).toContain('async function persist');
  expect(src).toContain('runtime.bridge.replaceAll(mapData.topology||[])');
  expect(src).toContain('mapBridge.saveDefinition(authoring.definitionFromMapData(mapData))');
  expect(src).toContain("emit('vtt:procedural-persisted'");
  expect(src).toContain('const shouldPersist=options.persist!==false');
  expect(src).toContain('Zona aplicada, pero no se pudo guardar');
});

test('procedural map metadata is part of canonical map authoring load/save instead of UI-only state',()=>{
  const src=mapPatch();
  expect(src).toContain('__proceduralAware:true');
  expect(src).toContain('procedural:clone(raw.procedural??fallback.procedural??null)');
  expect(src).toContain('mapData.procedural=clone(normalized.procedural)');
  expect(src).toContain('definitionFromMapData');
  expect(src).toContain('applyDefinition');
});

test('topology state bridge supports one atomic full replacement for generated zones',()=>{
  const src=topologyState();
  expect(src).toContain('async function replaceAll');
  expect(src).toContain('base.recordFromElements');
  expect(src).toContain("db.ref(`${base.TOPOLOGY_ROOT}/${bridge.mapId}/elements`).set(record)");
  expect(src).toContain('Object.freeze({ ...bridge, replaceElement, replaceAll })');
});

test('preview renderer derives building footprints without turning chunks into gameplay geometry',()=>{
  const loaded=loadPreviewCore();
  try{
    const map=loaded.api.footprintByBuilding({generated:{surfaceCells:[
      {buildingId:'a',col:38,row:4},{buildingId:'a',col:40,row:6},{buildingId:'b',col:80,row:10}
    ]}});
    expect(map.get('a')).toEqual({minCol:38,minRow:4,maxCol:40,maxRow:6});
    expect(map.get('b')).toEqual({minCol:80,minRow:10,maxCol:80,maxRow:10});
  }finally{loaded.restore();}
});

test('preview renderer is DM-only, non-exporting and supports zone/chunk/parcel/building/topology overlays',()=>{
  const src=renderer();
  expect(src).toContain('mapData.dmEditMode?.active===true');
  expect(src).toContain('!isExporting');
  expect(src).toContain('mapData.proceduralEditor?.previewPlan');
  for(const fn of ['drawZone','drawCorridors','drawParcels','drawBuildings','drawTopology','drawLegend'])expect(src).toContain(`function ${fn}`);
  expect(src).toContain("ctx.strokeStyle='#f0ca59'");
  expect(src).toContain('plan.zone?.chunkSize');
});

test('preview renderer uses distinct archetype presentation for quick DM reading',()=>{
  const loaded=loadPreviewCore();
  try{
    const colors=['shop','apartment_building','workshop','warehouse'].map(loaded.api.archetypeColor);
    expect(new Set(colors).size).toBe(4);
  }finally{loaded.restore();}
});

test('DM Map Creator modules parse as JavaScript',()=>{
  for(const f of ['js/vtt/procedural-preview-renderer-patch.js','js/vtt/procedural-map-authoring-patch.js','js/vtt/topology-replace-state-patch.js'])execFileSync(process.execPath,['--check',path.join(ROOT,f)],{stdio:'pipe'});
  for(const f of ['js/vtt/procedural-generator-bootstrap.js','js/vtt/procedural-generator-authoring-bootstrap.js'])execFileSync(process.execPath,['--input-type=module','--check'],{input:read(f),stdio:['pipe','pipe','pipe']});
});
