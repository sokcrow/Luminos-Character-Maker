import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {Miniflare,Response} from 'miniflare';
import {jwt,origin,wavBytes} from './helpers/audio-r2-fixture.mjs';
const source=await fs.readFile('services/audio-r2/worker.mjs','utf8');
const upstream=[];let redirect=false;
const runtime=new Miniflare({
 modules:true,script:source,
 // Match the pinned test runtime; production's date remains in wrangler.jsonc.
 compatibilityDate:'2026-07-30',
 r2Buckets:['AUDIO_BUCKET'],
 bindings:{AUDIO_SIGNING_KEY:'runtime-test-signing-key-with-at-least-32-characters',ALLOWED_ORIGINS:origin,FIREBASE_DATABASE_URL:'https://luminous-system-default-rtdb.firebaseio.com',FIREBASE_PROJECT_ID:'luminous-system'},
 outboundService:async request=>{
  const url=new URL(request.url);upstream.push(url);
  assert.equal(url.hostname,'luminous-system-default-rtdb.firebaseio.com','only the configured Firebase host receives the token');
  assert.equal(url.searchParams.get('auth'),jwt('dm'));
  if(redirect)return new Response(null,{status:302,headers:{Location:'https://other-host.invalid/collect'}});
  assert.equal(decodeURIComponent(url.pathname),'/campaña/config/dm_uid.json');
  return new Response(JSON.stringify('dm'),{headers:{'Content-Type':'application/json'}});
 }
});
try {
 const base='https://limbus-audio.test',bytes=wavBytes();
 const options={method:'PUT',headers:{Origin:origin,Authorization:'Bearer '+jwt('dm')},body:bytes};
 let response=await runtime.dispatchFetch(base+'/tracks?kind=music&name=Runtime',options);
 assert.equal(response.status,201,await response.clone().text());
 const result=await response.json();assert.equal(result.duplicate,false);assert.equal(upstream.length,1);
 response=await runtime.dispatchFetch(base+'/catalog',{headers:options.headers});
 assert.equal(response.status,200);const catalog=await response.json();assert.equal(catalog.tracks.length,1);
 response=await runtime.dispatchFetch(catalog.tracks[0].url);
 assert.equal(response.status,200);assert.deepEqual(new Uint8Array(await response.arrayBuffer()),bytes);
 response=await runtime.dispatchFetch(catalog.tracks[0].url,{headers:{Range:'bytes=4-11'}});
 assert.equal(response.status,206);assert.deepEqual(new Uint8Array(await response.arrayBuffer()),bytes.slice(4,12));
 response=await runtime.dispatchFetch(base+'/tracks?kind=music&name=Runtime',options);
 assert.equal(response.status,200);assert.equal((await response.json()).duplicate,true);
 const bucket=await runtime.getR2Bucket('AUDIO_BUCKET');assert.equal((await bucket.list()).objects.length,1);
 redirect=true;const before=upstream.length;
 response=await runtime.dispatchFetch(base+'/catalog',{headers:options.headers});
 assert.equal(response.status,503);assert.match((await response.json()).error,/redirigió/);
 assert.equal(upstream.length,before+1,'Firebase redirects are rejected without a second request');
 console.log('Cloudflare workerd: authenticated WAV upload, real local R2 storage, catalog, signed download/ranges, duplicate and token-preserving redirect rejection passed.');
} finally {await runtime.dispose();}
