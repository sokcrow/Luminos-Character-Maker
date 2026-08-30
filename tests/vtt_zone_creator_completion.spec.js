const {test,expect}=require('@playwright/test');
const fs=require('node:fs'),path=require('node:path');
const ROOT=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(ROOT,file),'utf8');

test('professional Zone Creator completion contract stays wired end to end',()=>{
  const authoring=read('js/vtt/procedural-generator-authoring-bootstrap.js');
  const runtime=read('js/vtt/procedural-generator-bootstrap.js');
  const preview=read('js/vtt/procedural-preview-renderer-patch.js');
  const mix=read('js/vtt/procedural-building-mix-patch.js');
  expect(authoring).toContain('03 · BUILDING MIX');
  expect(authoring).toContain('buildingMix:customBuildingMix()');
  expect(authoring).toContain('GENERAR PREVIEW');
  expect(authoring).toContain('CANCELAR PREVIEW');
  expect(authoring).toContain('ENCUADRAR');
  expect(preview).toContain('mapData.proceduralEditor?.previewPlan');
  expect(preview).toContain('mapData.dmEditMode?.active===true');
  expect(runtime).toContain("import './procedural-building-mix-patch.js'");
  expect(mix).toContain('fabric.profile?.buildingMix');
  expect(mix).toContain('eligibleWeights');
});
