const {test,expect}=require('@playwright/test');
const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const ROOT=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(ROOT,file),'utf8');

test('2x2 and 3x3 Zone Creator preview/reroll are forced through one 40x40 generator chunk',()=>{
  const runtime=read('js/vtt/procedural-chunk-streaming-runtime.js');
  expect(runtime).toContain("PREVIEW_SELECTOR='[data-proc-preview],[data-proc-reroll]'");
  expect(runtime).toContain('function capturePreviewSizing(event)');
  expect(runtime).toContain("input.value='1'");
  expect(runtime).toContain('mapData.proceduralEditor.logicalChunkSize=logical');
  expect(runtime).toContain('queueMicrotask(()=>{if(input.isConnected)input.value=String(logical);})');
  expect(runtime).toContain("doc.addEventListener('click',capturePreviewSizing,true)");
});

test('streaming create uses the restored logical selector size while applying only lazy 1x1 chunks',()=>{
  const runtime=read('js/vtt/procedural-chunk-streaming-runtime.js'),core=read('js/vtt/procedural-chunk-streaming-core.js');
  expect(runtime).toContain('const plan=mapData.proceduralEditor?.previewPlan,size=selectedLogicalSize()');
  expect(runtime).toContain('buildDescriptor(previewPlan,size)');
  expect(runtime).toContain('procedural.apply(plan,{replaceScene:true,persist:false})');
  expect(core).toContain('chunkCols:1');expect(core).toContain('chunkRows:1');
});

test('lazy preview runtime parses cleanly',()=>{
  execFileSync(process.execPath,['--input-type=module','--check'],{input:read('js/vtt/procedural-chunk-streaming-runtime.js'),stdio:['pipe','pipe','pipe']});
});
