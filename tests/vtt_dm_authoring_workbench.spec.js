const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { execFileSync } = require('node:child_process');

const ROOT=path.resolve(__dirname,'..');
const FILE='js/vtt/dm-authoring-shell-polish.js';
const read=()=>fs.readFileSync(path.join(ROOT,FILE),'utf8');

async function loadModule(){
  const tmp=path.join(os.tmpdir(),`luminous-dm-workbench-${process.pid}-${Date.now()}.mjs`);
  fs.writeFileSync(tmp,read());
  const mod=await import(`${pathToFileURL(tmp).href}?t=${Date.now()}`);
  return{mod,tmp};
}

test('DM workbench classifies existing authoring toolbars without replacing their contracts',async()=>{
  const {mod,tmp}=await loadModule();
  try{
    expect(mod.toolbarGroup('vtt-procedural-generator-toolbar')).toBe('zone');
    expect(mod.toolbarGroup('vtt-topology-toolbar')).toBe('construction');
    expect(mod.toolbarGroup('vtt-floor-opening-toolbar')).toBe('vertical');
    expect(mod.toolbarGroup('vtt-lighting-toolbar')).toBe('environment');
    expect(mod.toolbarGroup('vtt-semantic-toolbar')).toBe('semantics');
    expect(mod.toolbarGroup('vtt-building-semantic-toolbar')).toBe('semantics');
    expect(mod.toolbarGroup('vtt-building-archetype-toolbar')).toBe('semantics');
    expect(mod.toolbarGroup('vtt-building-navigation-toolbar')).toBe('semantics');
  }finally{fs.unlinkSync(tmp);}
});

test('streaming readout reports one live chunk inside the logical zone',async()=>{
  const {mod,tmp}=await loadModule();
  try{
    const info=mod.describeStreaming({procedural:{streaming:{chunkCols:3,chunkRows:3,activeChunk:{col:1,row:2}}}});
    expect(info.label).toBe('CHUNK 2,3');
    expect(info.detail).toBe('8 / 9');
    expect(info.cols).toBe(3);expect(info.rows).toBe(3);
  }finally{fs.unlinkSync(tmp);}
});

test('workbench exposes professional zone launch, safe cancel, status and non-invasive shortcuts',()=>{
  const source=read();
  expect(source).toContain('DM AUTHORING');
  expect(source).toContain('MAP WORKBENCH');
  expect(source).toContain('data-dm-create-zone>CREAR ZONA');
  expect(source).toContain("LuminousVttProceduralGeneratorAuthoringRuntime?.clearPreview?.()");
  expect(source).toContain("LuminousVttSemanticAuthoringRuntime?.setTool?.('select')");
  expect(source).toContain("if(key==='z')handled=openZoneCreator(root)");
  expect(source).toContain("else if(key==='w')handled=clickTool(root,'[data-vtt-tool=\"wall\"]')");
  expect(source).toContain("else if(key==='d')handled=clickTool(root,'[data-vtt-tool=\"door\"]')");
  expect(source).toContain('LuminousVttPerformanceGuard');
  expect(source).toContain('SAVED ${snapshot.savedFrames||0}');
  expect(source).toContain('MutationObserver');
});

test('workbench keeps toolbars as original DOM nodes and only reparents them',()=>{
  const source=read();
  expect(source).toContain('body.appendChild(toolbar)');
  expect(source).not.toContain('toolbar.cloneNode');
  expect(source).not.toContain('toolbar.outerHTML');
  expect(source).toContain('body.appendChild(toolbar)');
});

test('DM workbench parses as an ES module',()=>{
  execFileSync(process.execPath,['--input-type=module','--check'],{input:read(),stdio:['pipe','pipe','pipe']});
});
