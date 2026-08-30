const {test,expect}=require('@playwright/test');
const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const ROOT=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(ROOT,file),'utf8');

test('streamed chunk state synchronizes a small descriptor instead of full generated geometry',()=>{
  const source=read('js/vtt/procedural-chunk-streaming-runtime.js');
  expect(source).toContain("STATE_ROOT='campaña/estado_mundo/vttProceduralChunkState'");
  expect(source).toContain('descriptor:core.createDescriptor(desc)');
  expect(source).toContain('activeSignature:plan?.signature||null');
  expect(source).not.toContain('payload.plan=');
  expect(source).not.toContain('payload.topology=');
  expect(source).not.toContain('payload.surfaceCells=');
});

test('players request transitions while the DM is authoritative for chunk changes',()=>{
  const source=read('js/vtt/procedural-chunk-streaming-runtime.js');
  expect(source).toContain("REQUEST_ROOT='vtt_procedural_chunk_transition_requests'");
  expect(source).toContain("status:'pending'");
  expect(source).toContain("if(isDm){Promise.resolve(activateChunk");
  expect(source).toContain('else Promise.resolve(requestTransition');
  expect(source).toContain("if(!isDm)return;const request=snapshot.val()||{}");
  expect(source).toContain("subscribe(requestRootRef(),'child_added'");
  expect(source).toContain("status:'applied'");
  expect(source).toContain("status:'denied'");
});

test('all clients subscribe to authoritative active chunk state and regenerate locally',()=>{
  const source=read('js/vtt/procedural-chunk-streaming-runtime.js');
  expect(source).toContain("subscribe(stateRef(),'value'");
  expect(source).toContain('applyRemoteState(snapshot)');
  expect(source).toContain('await activateChunk(next,next.activeChunk,{persist:false,publish:false,center:false})');
  expect(source).toContain('if(persist)await persistChunk(plan);if(publish)await publishChunkState(next,plan)');
});

test('stale and non-adjacent player requests are rejected before generation',()=>{
  const source=read('js/vtt/procedural-chunk-streaming-runtime.js');
  expect(source).toContain("reason='STALE_CHUNK_REQUEST'");
  expect(source).toContain("reason='INVALID_CHUNK_TRANSITION'");
  expect(source).toContain('Math.abs(dx)>1||Math.abs(dy)>1||!core.containsChunk(desc,target)');
});

test('authoritative synchronization reuses the existing Firebase host and parses cleanly',()=>{
  const source=read('js/vtt/procedural-chunk-streaming-runtime.js');
  expect(source).toContain('window.LuminousVttMapAuthoringState');
  expect(source).toContain('stateApi?.hostFirebase?.(window)');
  execFileSync(process.execPath,['--input-type=module','--check'],{input:source,stdio:['pipe','pipe','pipe']});
});
