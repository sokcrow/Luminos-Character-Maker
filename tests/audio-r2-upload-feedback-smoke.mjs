import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {setup,jwt,origin,wavBytes} from './helpers/audio-r2-fixture.mjs';
const source=await fs.readFile('js/audio-cloud-library.js','utf8');
const bytes=wavBytes();
const endpoint='https://limbus-audio.account.workers.dev';
async function fixture(){
 const backend=setup();
 const dom=new JSDOM('<div id="panel"><div class="luminous-audio-scroll"></div></div>',{url:origin,runScripts:'outside-only'});
 const w=dom.window,scenario={};let lastUpload,revisionCount=0,requests=0;
 const db={ref:path=>({on:(_event,fn)=>fn({val:()=>endpoint}),off(){},set:async()=>{revisionCount++;if(scenario.revisionError)throw Error('PERMISSION_DENIED');}})};
 w.firebase={database:{ServerValue:{TIMESTAMP:{'.sv':'timestamp'}}}};
 w.fetch=async(url,options={})=>{
  if(scenario.catalogError)return new Response(JSON.stringify({error:scenario.catalogError}),{status:503});
  const response=await backend.handler(new Request(String(url),{...options,headers:{...options.headers,Origin:origin}}),backend.env);
  if(scenario.holdNextCatalog){scenario.holdNextCatalog=false;await new Promise(resolve=>{scenario.releaseCatalog=resolve;});}
  return response;
 };
 w.XMLHttpRequest=class{
  constructor(){this.upload={};this.headers={Origin:origin};}
  open(method,url){this.method=method;this.url=url;}
  setRequestHeader(k,v){this.headers[k]=v;}
  send(file){
   requests++;this.file=file;
   if(scenario.hold){scenario.xhr=this;return;}
   const reader=new w.FileReader();reader.onload=async()=>{
    if(this.aborted)return;
    this.upload.onprogress?.({lengthComputable:true,loaded:file.size,total:file.size});
    if(scenario.network){this.onerror();return;}
    if(scenario.timeout){this.ontimeout?.();return;}
    let response=scenario.status?new Response(scenario.html||JSON.stringify({error:scenario.error}),{status:scenario.status}):await backend.handler(new Request(this.url,{method:this.method,headers:this.headers,body:new Uint8Array(reader.result)}),backend.env);
    this.status=response.status;this.responseText=await response.text();
    if(scenario.failCatalogAfterPut)scenario.catalogError='El catálogo no está disponible.';
    this.onload();
   };reader.readAsArrayBuffer(file);
  }
  abort(){this.aborted=true;this.onabort?.();}
 };
 w.eval(source);
 const lib=new w.LuminousAudioLibrary({user:{getIdToken:async()=>{if(scenario.tokenError)throw Error('auth/network-request-failed');return scenario.tokenValue||jwt('dm');}},db,onChange(){},isDirector:true});
 lib.mount(w.document.querySelector('#panel'));
 await lib.refresh();
 const original=lib.upload.bind(lib);lib.upload=(...args)=>(lastUpload=original(...args));
 function start(files=[new w.File([bytes],'Canción.wav',{type:'audio/wav'})]){
  Object.defineProperty(w.document.querySelector('input[type=file]'),'files',{configurable:true,value:files});
  [...w.document.querySelectorAll('button')].find(b=>b.textContent==='Subir archivos').click();
  return lastUpload;
 }
 return {w,dom,lib,scenario,backend,start,revisionCount:()=>revisionCount,requests:()=>requests,close(){lib.destroy();dom.window.close();},text:()=>w.document.querySelector('.audio-cloud-library').textContent};
}
// Reproduction: a catalog failure must not replace the actual failed file.
{
 const f=await fixture();Object.assign(f.scenario,{status:401,error:'Inicia sesión en Limbus.',failCatalogAfterPut:true});
 await f.start().catch(()=>{});
 assert.match(f.text(),/Canción\.wav.*Inicia sesión en Limbus\./s,'upload error and filename survive a catalog error');
 assert.equal(f.backend.objects.size,0);assert.equal(f.lib.busy,false);f.close();
}


for(const scenario of [
 {status:401,error:'Inicia sesión en Limbus.',match:/Inicia sesión/},
 {status:403,error:'Sólo el DM puede gestionar archivos.',match:/Sólo el DM/},
 {status:413,error:'El máximo es 25 MB por archivo.',match:/25 MB/},
 {status:415,error:'Usa un archivo MP3, OGG, WAV, FLAC o M4A válido.',match:/archivo MP3/},
 {status:500,error:'No se pudo completar la operación de audio.',match:/operación de audio/},
 {status:403,html:'<html>Access denied</html>',match:/biblioteca rechazó/},
 {network:true,match:/No se pudo conectar/},
 {timeout:true,match:/tardó demasiado/},
 {tokenError:true,match:/validar tu sesión/},
 {tokenValue:'invalid-session',match:/validar la sesión de juego/}
]){
 const f=await fixture();Object.assign(f.scenario,scenario);
 const result=await f.start();
 assert.equal(result.uploaded,0);assert.equal(result.failures.length,1);
 const row=f.w.document.querySelector('.audio-upload-results li');
 assert.equal(row.dataset.status,'error');assert.match(row.textContent,scenario.match);
 assert.match(row.textContent,/Canción\.wav/);assert.equal(f.backend.objects.size,0);
 assert.equal(f.lib.busy,false);assert.equal(f.w.document.querySelector('.audio-upload-controls button').disabled,false);
 assert.ok(f.w.document.querySelector('.audio-upload-results').compareDocumentPosition(f.lib.search)&f.w.Node.DOCUMENT_POSITION_FOLLOWING,'results appear before search/catalog');
 assert.equal(f.w.document.querySelector('.audio-upload-results img'),null,'server HTML is never injected');f.close();
}
// Actual form -> token -> XHR bytes -> Worker/R2 -> catalog -> signed download.
{
 const f=await fixture();let result=await f.start();
 assert.equal(result.uploaded,1);assert.equal(f.backend.objects.size,1);
 assert.equal(f.lib.uploadReport[0].status,'saved');assert.equal(f.revisionCount(),1);
 const entry=f.lib.tracks('music')[0];
 const media=await f.backend.handler(new Request(entry.url),f.backend.env);
 assert.equal(media.status,200);assert.deepEqual(new Uint8Array(await media.arrayBuffer()),bytes);
 result=await f.start();assert.equal(result.duplicates,1);assert.equal(f.backend.objects.size,1);
 assert.equal(f.lib.uploadReport[0].status,'duplicate');f.close();
}
for(const failure of ['revisionError','failCatalogAfterPut']){
 const f=await fixture();f.scenario[failure]=true;
 const result=await f.start();assert.equal(result.uploaded,1);assert.equal(result.failures.length,0);
 assert.equal(result.warnings.length,1);assert.equal(f.backend.objects.size,1);
 assert.equal(f.lib.tracks('music').length,1,'confirmed upload remains available when refresh/notification fails');
 assert.equal(f.lib.uploadReport[0].status,'saved');assert.match(f.text(),/guardados/);f.close();
}
// Progress 100% is only a transfer milestone; no storage claim before response.
{
 const f=await fixture();f.scenario.hold=true;
 const result=f.start([new f.w.File([bytes],'Uno.wav'),new f.w.File([bytes],'Dos.wav')]);
 for(let i=0;i<10&&!f.scenario.xhr;i++)await new Promise(resolve=>setTimeout(resolve,0));
 f.scenario.xhr.upload.onprogress({lengthComputable:true,loaded:bytes.length,total:bytes.length});
 assert.equal(f.lib.uploadReport[0].status,'confirming');assert.match(f.text(),/Esperando confirmación/);
 assert.equal(f.backend.objects.size,0);assert.equal(f.lib.uploadReport.some(r=>r.status==='saved'),false);
 f.lib.cancel.click();const completed=await result;
 assert.equal(completed.cancelled,2);assert.equal(f.requests(),1,'cancel does not silently start the next file');
 assert.ok(f.lib.uploadReport.every(r=>r.status==='cancelled'));assert.equal(f.lib.busy,false);f.close();
}
// Invalid local inputs report per-file failures without sending bytes.
{
 const f=await fixture();const huge=new f.w.File([bytes],'Grande.wav');Object.defineProperty(huge,'size',{value:26*1024*1024});
 const result=await f.start([new f.w.File(['text'],'Texto.txt'),new f.w.File([],'Vacío.wav'),huge]);
 assert.equal(result.failures.length,3);assert.equal(f.requests(),0);assert.equal(f.backend.objects.size,0);f.close();
}
{
 const f=await fixture();const result=await f.start([new f.w.File(['not audio'],'Falso.mp3')]);
 assert.equal(result.failures.length,1);assert.match(f.text(),/válido/);assert.equal(f.backend.objects.size,0);f.close();
}
console.log('Upload form: valid WAV bytes stored and downloaded, duplicate, per-file 401/403/413/415/500/network/timeout/token errors, preserved failure, confirmation stage, cancellation and post-save Firebase/catalog failures passed.');

// P2: a catalog snapshot taken before PUT must not erase confirmed uploads
// when it arrives late and the next catalog request fails.
{
 const f=await fixture();f.scenario.holdNextCatalog=true;
 const oldRefresh=f.lib.refresh();
 for(let i=0;i<30&&!f.scenario.releaseCatalog;i++)await new Promise(resolve=>setTimeout(resolve,0));
 assert.ok(f.scenario.releaseCatalog,'old empty catalog response is held');
 f.scenario.failCatalogAfterPut=true;
 const different=bytes.slice();different[different.length-1]^=1;
 const pending=f.start([new f.w.File([bytes],'Uno.wav'),new f.w.File([different],'Dos.wav')]);
 for(let i=0;i<100&&f.lib.uploadReport.filter(r=>r.status==='saved').length<2;i++)await new Promise(resolve=>setTimeout(resolve,0));
 assert.equal(f.lib.tracks('music').length,2,'both PUT responses confirm local availability');
 f.scenario.releaseCatalog();await oldRefresh;const result=await pending;
 assert.equal(result.uploaded,2);assert.equal(result.warnings.length,1);
 assert.equal(f.lib.tracks('music').length,2,'a stale catalog followed by failure cannot erase confirmed tracks');
 assert.equal(f.lib.bytes,bytes.length+different.length,'usage includes confirmed tracks absent from the stale response');
 assert.ok(f.lib.uploadReport.every(r=>r.status==='saved'));assert.equal(f.backend.objects.size,2);
 for(const entry of f.lib.tracks('music'))assert.equal((await f.backend.handler(new Request(entry.url),f.backend.env)).status,200);
 // A later successful catalog remains authoritative, including deletions.
 delete f.scenario.catalogError;f.backend.objects.clear();await f.lib.refresh();
 assert.equal(f.lib.tracks('music').length,0);assert.equal(f.lib.bytes,0);f.close();
}
console.log('P2 stale catalog + failed follow-up: confirmed tracks, bytes, signed URLs and subsequent authoritative removal passed.');
