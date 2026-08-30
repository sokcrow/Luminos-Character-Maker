const { test, expect } = require('@playwright/test');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{execFileSync}=require('node:child_process');
const ROOT=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(ROOT,file),'utf8');
const GEN_FILES=['topology.js','surface-core.js','horizontal-plane-core.js','building-physics-core.js','semantic-map-core.js','building-semantic-core.js','building-archetype-core.js','vertical-portal.js','building-navigation-core.js','procedural-zone-core.js','urban-fabric-core.js','procedural-building-generator.js','procedural-generator-core.js'];
const GEN_KEYS=['LuminousVttTopology','LuminousVttSurfaceCore','LuminousVttHorizontalPlanes','LuminousVttBuildingPhysics','LuminousVttSemanticMap','LuminousVttBuildingSemantics','LuminousVttBuildingArchetypes','LuminousVttVerticalPortal','LuminousVttBuildingNavigation','LuminousVttProceduralZone','LuminousVttUrbanFabric','LuminousVttProceduralBuildings','LuminousVttProceduralGenerator'];
function withGenerator(run){const original=new Map(GEN_KEYS.map(k=>[k,global[k]]));try{for(let i=0;i<GEN_FILES.length;i++){const resolved=require.resolve(path.join(ROOT,'js/vtt',GEN_FILES[i]));delete require.cache[resolved];global[GEN_KEYS[i]]=require(resolved);}return run(global.LuminousVttProceduralGenerator);}finally{for(const f of GEN_FILES){try{delete require.cache[require.resolve(path.join(ROOT,'js/vtt',f))];}catch(_){}}for(const key of GEN_KEYS){const value=original.get(key);if(value===undefined)delete global[key];else global[key]=value;}}}
function loadHotfixForRuntimeTest(){
  const source=read('js/vtt/live-map-creator-hotfix.js')
    .replace(/\bexport\s+(?=(?:async\s+)?function)/g,'')
    .replace(/\nautoStart\(\);\s*$/,'');
  const sandbox={console:{warn(){},error(){}},setTimeout,clearTimeout};
  vm.createContext(sandbox);
  vm.runInContext(`${source}\n;globalThis.__hotfix={createMapSafely};`,sandbox,{filename:'live-map-creator-hotfix.runtime-test.js'});
  return sandbox.__hotfix;
}

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

test('DM creator exposes the professional non-destructive Zone Creator workflow',()=>{
  const source=read('js/vtt/procedural-generator-authoring-bootstrap.js');
  for(const token of ['CREAR ZONA','TIPO DE ZONA','1×1 CHUNK · 40×40','2×2 CHUNKS · 80×80','3×3 CHUNKS · 120×120','data-proc-random','GENERAR PREVIEW','REROLL','CANCELAR PREVIEW','ENCUADRAR','INTERIORES','MUROS/PUERTAS','procedural-preview-renderer-patch.js'])expect(source).toContain(token);
  expect(source).toContain('chunkCols:size');expect(source).toContain('chunkRows:size');expect(source).toContain('procedural.preview(values())');expect(source).toContain("procedural.apply(lastPlan,{replaceScene:true})");
  expect(source).toContain('procedural.previewAsync?procedural.previewAsync(values())');
  const previewStart=source.indexOf('function preview('),createStart=source.indexOf('function createZone()');expect(previewStart).toBeGreaterThan(-1);expect(createStart).toBeGreaterThan(previewStart);expect(source.slice(previewStart,createStart)).not.toContain('procedural.apply(');
});

test('DM creator requires a current valid preview and explicit destructive confirmation',()=>{
  const source=read('js/vtt/procedural-generator-authoring-bootstrap.js');
  expect(source).toContain('apply.disabled=busy||!lastPlan?.validation?.valid');
  expect(source).toContain("window.confirm('CREAR ZONA reemplazará la geometría y semántica actual. Los tokens de jugador se conservarán. ¿Continuar?')");
  expect(source).toContain('function generationChanged');expect(source).toContain('clearPreview();syncUi()');
  expect(source).toContain("addEventListener('change',()=>generationChanged())");expect(source).toContain("addEventListener('input',()=>generationChanged())");
  expect(source).toContain('requestRevision!==generationRevision');
});

test('DM creator keeps preview presentation separate from generated scene state',()=>{
  const source=read('js/vtt/procedural-generator-authoring-bootstrap.js'),renderer=read('js/vtt/procedural-preview-renderer-patch.js');
  expect(source).toMatch(/mapData\.proceduralEditor\.previewPlan=(?:lastPlan|generated)/);expect(source).toContain('mapData.proceduralEditor.previewOptions');
  expect(renderer).toMatch(/mapData\??\.dmEditMode\?\.active===true/);expect(renderer).toMatch(/mapData\??\.proceduralEditor\?\.previewPlan/);expect(renderer).toContain('isExporting');
});

test('live VTT integration always remounts the procedural creator into the DM edit sidebar',()=>{
  const hotfix=read('js/vtt/live-map-creator-hotfix.js'),semantic=read('js/vtt/semantic-map-bootstrap.js');
  expect(semantic).toContain("import './live-map-creator-hotfix.js'");
  expect(hotfix).toContain("TOOLBAR_ID='vtt-procedural-generator-toolbar'");
  expect(hotfix).toContain("EDIT_SIDEBAR_ID='vtt-edit-sidebar'");
  expect(hotfix).toContain('sidebar.appendChild(toolbar)');
  expect(hotfix).toContain('if(!runtime.procedural&&runtime.buildingNavigation)');
  expect(hotfix).toContain("import('./procedural-generator-authoring-bootstrap.js')");
});

test('NEW MAP is captured by a safe async path that reports save failures instead of leaking a rejection',()=>{
  const hotfix=read('js/vtt/live-map-creator-hotfix.js');
  expect(hotfix).toContain("MAP_NEW_SELECTOR='[data-map-new]'");
  expect(hotfix).toContain("doc.addEventListener('click',clickCapture,true)");
  expect(hotfix).toContain('event.stopImmediatePropagation?.()');
  expect(hotfix).toContain('await bridge.saveDefinition(created)');
  expect(hotfix).toContain("console.error('VTT NEW MAP FAILED:'");
  expect(hotfix).toContain("localNotice(root,message,'error')");
  expect(hotfix).toContain("select.dispatchEvent(new EventCtor('change',{bubbles:true}))");
});

test('NEW MAP failure path executes without throwing, restores the button, and reports the Firebase error',async()=>{
  const {createMapSafely}=loadHotfixForRuntimeTest();
  const authoring=require('../js/vtt/map-authoring.js');
  const active=authoring.createDefinition({id:'active',name:'Active'});
  const notice={textContent:'',dataset:{},hidden:true};
  const select={value:'active',dispatchEvent(){throw new Error('should not dispatch on failed save');}};
  const notifications=[];
  const bridge={
    get:id=>id==='active'?active:null,
    async saveDefinition(){throw new Error('PERMISSION_DENIED');},
  };
  const root={
    prompt:()=> 'Crash Test Map',
    LuminousVttMapAuthoring:authoring,
    LuminousVttRuntime:{engine:{mapData:active},mapAuthoring:{bridge},controller:{notify:(message,mode)=>notifications.push({message,mode})}},
    document:{querySelector:selector=>selector==='[data-map-select]'?select:null,getElementById:id=>id==='vtt-map-authoring-notice'?notice:null},
    Event:class TestEvent{},
  };
  const button={disabled:false,isConnected:true};
  const result=await createMapSafely(root,button);
  expect(result).toBeNull();
  expect(button.disabled).toBe(false);
  expect(notice.hidden).toBe(false);
  expect(notice.dataset.mode).toBe('error');
  expect(notice.textContent).toContain('PERMISSION_DENIED');
  expect(notifications.at(-1)).toEqual({message:'PERMISSION_DENIED',mode:'error'});
});

test('DM authoring shell has shared professional states and keyboard focus treatment',()=>{
  const polish=read('js/vtt/dm-authoring-shell-polish.js'),semantic=read('js/vtt/semantic-map-bootstrap.js');
  expect(polish).toContain('DM MAP TOOLS');expect(polish).toContain('AUTHORING MODE');expect(polish).toContain(':focus-visible');expect(polish).toContain('[aria-pressed="true"]');expect(polish).toContain('width:228px');expect(semantic).toContain('installDmAuthoringShellPolish');
});

test('zone creator and DM shell modules parse as ESM JavaScript',()=>{
  for(const file of ['js/vtt/procedural-generator-authoring-bootstrap.js','js/vtt/dm-authoring-shell-polish.js','js/vtt/semantic-map-bootstrap.js','js/vtt/live-map-creator-hotfix.js'])execFileSync(process.execPath,['--input-type=module','--check'],{input:read(file),stdio:['pipe','pipe','pipe']});
  execFileSync(process.execPath,['--check',path.join(ROOT,'js/vtt/procedural-preview-renderer-patch.js')],{stdio:'pipe'});
  execFileSync(process.execPath,['--check',path.join(ROOT,'js/vtt/procedural-generator-worker.js')],{stdio:'pipe'});
});
