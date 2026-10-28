import assert from 'node:assert/strict';
import {setup,jwt} from './helpers/audio-r2-fixture.mjs';
import {createHandler} from '../services/audio-r2/worker.mjs';
const {request,handler,env,objects,setActive}=setup();
const bytes=new Uint8Array([73,68,51,4,0,0,0,0,0,4,1,2,3,4]);
assert.equal((await request('/tracks?kind=music&name=Prueba',{uid:'player',method:'PUT',body:bytes})).status,403);
assert.equal((await handler(new Request('https://limbus-audio.account.workers.dev/catalog',{headers:{Authorization:'Bearer fake'}}),env)).status,401);
assert.equal((await request('/catalog?scope=encounter',{uid:'outsider'})).status,403);
assert.equal((await request('/tracks?kind=sfx',{method:'PUT',body:new TextEncoder().encode('<html>fake</html>')})).status,415);
assert.equal((await request('/tracks?kind=music',{method:'PUT',body:bytes,headers:{'Content-Length':String(26*1024*1024)}})).status,413);
assert.equal((await request('/catalog',{headers:{Origin:'https://evil.test'}})).status,403);
let response=await request('/tracks?kind=music&name=Mi%20canci%C3%B3n',{method:'PUT',body:bytes});assert.equal(response.status,201);
const uploaded=await response.json();assert.match(uploaded.track.id,/^r2_[a-f0-9]{64}$/);assert.equal(uploaded.track.label,'Mi canción');assert.equal(uploaded.track.bytes,bytes.length);
response=await request('/tracks?kind=sfx&name=Duplicada',{method:'PUT',body:bytes});assert.equal((await response.json()).duplicate,true);assert.equal(objects.size,1);
response=await request('/catalog',{uid:'player'});const catalog=await response.json();assert.equal(catalog.tracks.length,1);assert.equal(catalog.bytes,bytes.length);
const audioUrl=catalog.tracks[0].url;assert.equal(audioUrl.includes('auth='),false);
response=await handler(new Request(audioUrl),env);assert.equal(response.status,200);assert.deepEqual(new Uint8Array(await response.arrayBuffer()),bytes);
response=await handler(new Request(audioUrl,{headers:{Range:'bytes=3-6'}}),env);assert.equal(response.status,206);assert.equal(response.headers.get('Content-Range'),'bytes 3-6/14');assert.deepEqual(new Uint8Array(await response.arrayBuffer()),bytes.slice(3,7));
assert.equal((await handler(new Request(audioUrl,{headers:{Range:'bytes=999-'}}),env)).status,416);
assert.equal((await handler(new Request(audioUrl.replace(/sig=[a-f0-9]+/,'sig=bad')),env)).status,403);
const expired=new URL(audioUrl);expired.searchParams.set('e','1');assert.equal((await handler(new Request(expired),env)).status,403);
setActive({music:{trackId:uploaded.track.id,active:false}});
assert.equal((await request('/tracks/'+uploaded.track.id,{method:'DELETE'})).status,409);assert.equal(objects.size,1);
setActive({});assert.equal((await request('/tracks/'+uploaded.track.id,{method:'DELETE',uid:'player'})).status,403);
assert.equal((await request('/tracks/'+uploaded.track.id,{method:'DELETE'})).status,200);assert.equal(objects.size,0);
console.log('R2 Worker: authenticated DM uploads, player reads, isolated membership, binary validation/size, deduplication, signed playback/ranges, CORS and active deletion guards passed.');

// Upload failures identify the failing service without logging raw exceptions.
const diagnostics=[];const originalConsoleError=console.error;
console.error=(...args)=>diagnostics.push(args);
try {
 for(const [operation,path,method,pattern] of [
  ['put','/tracks?kind=music','PUT',/R2.*guardado/],
  ['head','/tracks?kind=music','PUT',/consultar el archivo en R2/],
  ['list','/catalog','GET',/consultar la biblioteca en R2/]
 ]){
  const f=setup();f.env.AUDIO_BUCKET[operation]=async()=>{throw Error('provider internals: secret-token-and-private-object');};
  const response=await f.request(path,{method,...(method==='PUT'?{body:bytes}:{})});
  assert.equal(response.status,503);assert.match((await response.json()).error,pattern);
  assert.equal(f.objects.size,0);assert.equal(response.headers.get('Access-Control-Allow-Origin'),'https://sokcrow.github.io');
 }
 {
  const f=setup();const handler=createHandler(async()=>{throw Error('https://private.firebaseio.com/path?auth=private-token');});
  const response=await handler(new Request('https://limbus-audio.account.workers.dev/tracks?kind=music',{method:'PUT',headers:{Authorization:'Bearer '+jwt('dm')},body:bytes}),f.env);
  assert.equal(response.status,503);assert.match((await response.json()).error,/conectar con Firebase/);assert.equal(f.objects.size,0);
 }
 {
  const f=setup();const handler=createHandler(async()=>new Response('invalid-json'));
  const response=await handler(new Request('https://limbus-audio.account.workers.dev/catalog',{headers:{Authorization:'Bearer '+jwt('dm')}}),f.env);
  assert.equal(response.status,503);assert.match((await response.json()).error,/Firebase no devolvió una respuesta válida/);
 }
 for(const [variable,value,pattern] of [
  ['FIREBASE_DATABASE_URL',undefined,/dirección de Firebase/],
  ['FIREBASE_DATABASE_URL','not-a-url',/dirección de Firebase/],
  ['FIREBASE_DATABASE_URL','https://example.com',/dirección de Firebase/],
  ['FIREBASE_PROJECT_ID',undefined,/proyecto de Firebase/],
  ['AUDIO_BUCKET',{},/vincular el bucket R2/],
  ['AUDIO_SIGNING_KEY','short',/clave de firma válida/]
 ]){
  const f=setup();f.env[variable]=value;
  const response=await f.request('/tracks?kind=music',{method:'PUT',body:bytes});
  assert.equal(response.status,503);assert.match((await response.json()).error,pattern);assert.equal(f.objects.size,0);
 }
 {
  const f=setup();f.env.AUDIO_BUCKET.put=async()=>null;
  const response=await f.request('/tracks?kind=music',{method:'PUT',body:bytes});
  assert.equal(response.status,503);assert.match((await response.json()).error,/R2.*guardado/);assert.equal(f.objects.size,0);
 }
 const records=JSON.stringify(diagnostics);
 assert.ok(diagnostics.length>=4);assert.match(records,/r2-write/);assert.match(records,/r2-read/);assert.match(records,/r2-list/);assert.match(records,/firebase/);
 assert.doesNotMatch(records,/private-token|secret-token|provider internals|firebaseio|Bearer|signature/);
} finally {console.error=originalConsoleError;}
console.log('Worker configuration and Firebase/R2 failure stages, CORS and sanitized diagnostics passed.');
