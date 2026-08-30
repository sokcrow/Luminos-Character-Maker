const { test, expect } = require('@playwright/test');
const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const ROOT=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(ROOT,file),'utf8');
const GEN_FILES=['topology.js','surface-core.js','horizontal-plane-core.js','building-physics-core.js','semantic-map-core.js','building-semantic-core.js','building-archetype-core.js','vertical-portal.js','building-navigation-core.js','procedural-zone-core.js','urban-fabric-core.js','procedural-building-generator.js','procedural-generator-core.js'];
const GEN_KEYS=['LuminousVttTopology','LuminousVttSurfaceCore','LuminousVttHorizontalPlanes','LuminousVttBuildingPhysics','LuminousVttSemanticMap','LuminousVttBuildingSemantics','LuminousVttBuildingArchetypes','LuminousVttVerticalPortal','LuminousVttBuildingNavigation','LuminousVttProceduralZone','LuminousVttUrbanFabric','LuminousVttProceduralBuildings','LuminousVttProceduralGenerator'];
function withGenerator(run){const original=new Map(GEN_KEYS.map(k=>[k,global[k]]));try{for(let i=0;i<GEN_FILES.length;i++){const resolved=require.resolve(path.join(ROOT,'js/vtt',GEN_FILES[i]));delete require.cache[resolved];global[GEN_KEYS[i]]=require(resolved);}return run(global.LuminousVttProceduralGenerator);}finally{for(const f of GEN_FILES){try{delete require.cache[require.resolve(path.join(ROOT,'js/vtt',f))];}catch(_){}}for(const key of GEN_KEYS){const value=original.get(key);if(value===undefined)delete global[key];else global[key]=value;}}}

test('zone size presets map cleanly to the 40x40 chunk contract',()=>{
  const file=path.join(ROOT,'js/vtt/procedural-zone-core.js'),resolved=require.resolve(file);delete require.cache[resolved];const zone=require(resolved);
  expect(zone.createZone({chunkCols:1,chunkRows:1})).toMatchObject({cols:40,rows:40,chunkCols:1,chunkRows:1});
  expect(zone.createZone({chunkCols:2,chunkRows:2})).toMatchObject({cols:80,rows:80,chunkCols:2,chunkRows:2});
  expect(zone.createZone({chunkCols:3,chunkRows:3})).toMatchObject({cols:120,rows:120,chunkCols:3,chunkRows:3});delete require.cache[resolved];
});

test('1x1 and 2x2 creator presets produce fully validated procedural plans',()=>withGenerator(gen=>{
  const small=gen.generateZone({seed:'dm-ui-small',profileId:'mixed_urban',chunkCols:1,chunkRows:1,maxAttempts:8});
  const medium=gen.generateZone({seed:'dm-ui-medium',profileId:'residential',chunkCols:2,chunkRows:2,maxAttempts:8});
  expect(small.zone).toMatchObject({cols:40,rows:40,chunkCols:1,chunkRows:1});expect(small.validation.valid).toBe(true);
  expect(medium.zone).toMatchObject({cols:80,rows:80,chunkCols:2,chunkRows:2});expect(medium.validation.valid).toBe(true);
}));

test('DM creator exposes a professional non-destructive generate workflow',()=>{
  const source=read('js/vtt/procedural-generator-authoring-bootstrap.js');
  for(const token of ['CREAR ZONA','TIPO DE ZONA','data-proc-size="1"','data-proc-size="2"','data-proc-size="3"','data-proc-randomize','GENERAR PREVIEW','REROLL','APLICAR ZONA','CONFIRMAR APLICACIÓN','renderPreviewSvg','VALIDATION GATE'])expect(source).toContain(token);
  expect(source).toContain('chunkCols:selectedChunks');expect(source).toContain('chunkRows:selectedChunks');expect(source).toContain('procedural.preview(values())');expect(source).toContain("procedural.apply(lastPlan,{replaceScene:true})");
  const previewStart=source.indexOf('function preview()'),applyStart=source.indexOf('function apply()');expect(previewStart).toBeGreaterThan(-1);expect(applyStart).toBeGreaterThan(previewStart);expect(source.slice(previewStart,applyStart)).not.toContain('procedural.apply(');
});

test('DM creator requires a valid preview and a second explicit apply action',()=>{
  const source=read('js/vtt/procedural-generator-authoring-bootstrap.js');
  expect(source).toContain('applyButton.disabled=!lastPlan?.validation?.valid');expect(source).toContain('if(!applyArmed)');expect(source).toContain('applyArmed=true');expect(source).toContain('Los tokens existentes se conservarán');expect(source).toContain("addEventListener('change',invalidate)");expect(source).toContain("addEventListener('input',invalidate)");
});

test('DM authoring shell has shared professional states and keyboard focus treatment',()=>{
  const polish=read('js/vtt/dm-authoring-shell-polish.js'),semantic=read('js/vtt/semantic-map-bootstrap.js');
  expect(polish).toContain('DM MAP TOOLS');expect(polish).toContain('AUTHORING MODE');expect(polish).toContain(':focus-visible');expect(polish).toContain('[aria-pressed="true"]');expect(polish).toContain('width:228px');expect(semantic).toContain('installDmAuthoringShellPolish');
});

test('zone creator and DM shell modules parse as ESM JavaScript',()=>{
  for(const file of ['js/vtt/procedural-generator-authoring-bootstrap.js','js/vtt/dm-authoring-shell-polish.js','js/vtt/semantic-map-bootstrap.js'])execFileSync(process.execPath,['--input-type=module','--check'],{input:read(file),stdio:['pipe','pipe','pipe']});
});
