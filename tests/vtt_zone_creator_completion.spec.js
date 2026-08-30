const {test,expect}=require('@playwright/test');
const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const ROOT=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(ROOT,file),'utf8');

function loadPreview(){const file=path.join(ROOT,'js/vtt/procedural-preview-renderer-patch.js'),previous=global.LuminousVttProceduralPreviewRenderer;delete global.LuminousVttProceduralPreviewRenderer;delete require.cache[require.resolve(file)];const api=require(file);return{api,restore(){delete require.cache[require.resolve(file)];if(previous===undefined)delete global.LuminousVttProceduralPreviewRenderer;else global.LuminousVttProceduralPreviewRenderer=previous;}};}

test('completed Zone Creator exposes ghost preview, editable fabric and Building Mix',()=>{
  const authoring=read('js/vtt/procedural-generator-authoring-bootstrap.js'),runtime=read('js/vtt/procedural-generator-bootstrap.js'),preview=read('js/vtt/procedural-preview-renderer-patch.js'),mix=read('js/vtt/procedural-building-mix-patch.js');
  for(const token of ['DENSIDAD','EDIF. PEGADOS','CALLEJONES','SERVICIO','VÍAS SEC.','03 · BUILDING MIX','TIENDAS','APARTAMENTOS','TALLERES','ALMACENES','GENERAR PREVIEW','CANCELAR PREVIEW','ENCUADRAR'])expect(authoring).toContain(token);
  for(const option of ['showChunks','showParcels','showRooms','showTopology','showLabels'])expect(authoring).toContain(option);
  expect(authoring).toContain('buildingMix:customBuildingMix()');expect(authoring).toMatch(/mapData\.proceduralEditor\.previewPlan=(?:lastPlan|generated)/);
  expect(preview).toContain('mapData.dmEditMode?.active===true');expect(preview).toContain('!isExporting');expect(preview).toContain('drawPreview(renderer,camera,mapData)');
  expect(runtime).toContain("import './procedural-building-mix-patch.js'");expect(mix).toContain('fabric.profile?.buildingMix');expect(mix).toContain('eligibleWeights');
});

test('preview footprint derivation spans chunk boundaries without creating gameplay boundaries',()=>{
  const loaded=loadPreview();try{
    const footprints=loaded.api.footprintByBuilding({generated:{surfaceCells:[{buildingId:'a',col:38,row:4},{buildingId:'a',col:40,row:6},{buildingId:'b',col:80,row:10}]}});
    expect(footprints.get('a')).toEqual({minCol:38,minRow:4,maxCol:40,maxRow:6});expect(footprints.get('b')).toEqual({minCol:80,minRow:10,maxCol:80,maxRow:10});
  }finally{loaded.restore();}
});

test('preview visually distinguishes all four generated building archetypes',()=>{
  const loaded=loadPreview();try{const colors=['shop','apartment_building','workshop','warehouse'].map(loaded.api.archetypeColor);expect(new Set(colors).size).toBe(4);}finally{loaded.restore();}
});

test('preview path cannot apply a plan and apply remains gated by a valid lastPlan',()=>{
  const source=read('js/vtt/procedural-generator-authoring-bootstrap.js'),previewStart=source.indexOf('function preview('),createStart=source.indexOf('function createZone()');
  expect(previewStart).toBeGreaterThan(-1);expect(createStart).toBeGreaterThan(previewStart);expect(source.slice(previewStart,createStart)).not.toContain('procedural.apply(');
  expect(source).toContain('if(!lastPlan?.validation?.valid||busy)return null');expect(source).toContain('sceneHasContent()&&!window.confirm');
});

test('final Zone Creator modules parse as JavaScript',()=>{
  for(const file of ['js/vtt/procedural-preview-renderer-patch.js','js/vtt/procedural-building-mix-patch.js','js/vtt/procedural-generator-worker.js'])execFileSync(process.execPath,['--check',path.join(ROOT,file)],{stdio:'pipe'});
  for(const file of ['js/vtt/procedural-generator-bootstrap.js','js/vtt/procedural-generator-authoring-bootstrap.js'])execFileSync(process.execPath,['--input-type=module','--check'],{input:read(file),stdio:['pipe','pipe','pipe']});
});
