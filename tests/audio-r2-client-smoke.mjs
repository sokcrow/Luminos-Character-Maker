import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {mountDirector} from './helpers/dm-director-fixture.mjs';
import {setup,jwt,origin} from './helpers/audio-r2-fixture.mjs';
const backend=setup(),bytes=new Uint8Array([73,68,51,4,0,0,0,0,0,4,1,2,3,4]);
const endpoint='https://limbus-audio.account.workers.dev';
const pause=()=>new Promise(resolve=>setTimeout(resolve,20));
async function until(check){const limit=Date.now()+3000;while(!check()&&Date.now()<limit)await pause();assert.ok(check(),'condition timed out');}
function audioMock(w){w.audioElements=[];w.Audio=class{constructor(src=''){this.src=src;this.paused=true;this.duration=60;this.currentTime=0;this.readyState=1;this.plays=0;w.audioElements.push(this);}play(){this.paused=false;this.plays++;return Promise.resolve();}pause(){this.paused=true;}addEventListener(){}load(){}removeAttribute(key){this[key]='';}};}
function fetchMock(w){w.fetch=(url,options={})=>backend.handler(new Request(String(url),{...options,headers:{...options.headers,Origin:origin}}),backend.env);}
let dom;
const page={route:async()=>{},locator:selector=>({click:async()=>dom.window.document.querySelector(selector).click()}),setContent:async html=>{dom=new JSDOM(html,{url:origin,runScripts:'outside-only',pretendToBeVisual:true});const w=dom.window;w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'));};w.alert=()=>{};w.confirm=()=>true;audioMock(w);fetchMock(w);},evaluate:async(fn,arg)=>dom.window.eval(`(${fn.toString()})(${JSON.stringify(arg)})`),addStyleTag:async()=>{},addScriptTag:async({path})=>dom.window.eval(await fs.readFile(path,'utf8'))};
await mountDirector(page);
const dm=dom.window,d=dm.document;dm.testToken=jwt('dm');
dm.XMLHttpRequest=class{
 constructor(){this.upload={};this.headers={Origin:origin};}
 open(method,url){this.method=method;this.url=url;}
 setRequestHeader(key,value){this.headers[key]=value;}
 send(file){const reader=new dm.FileReader();reader.onload=async()=>{if(this.aborted)return;try{this.upload.onprogress?.({lengthComputable:true,loaded:file.size,total:file.size});const result=await backend.handler(new Request(this.url,{method:this.method,headers:this.headers,body:new Uint8Array(reader.result)}),backend.env);if(this.aborted)return;this.status=result.status;this.responseText=await result.text();this.onload();}catch{this.onerror();}};reader.readAsArrayBuffer(file);}
 abort(){this.aborted=true;this.onabort?.();}
};
dm.testWrite('campaña/config/audio_service_url',endpoint);await pause();
const files=d.querySelector('[aria-label="Seleccionar archivos de audio"]');
const submit=[...d.querySelectorAll('.audio-upload-controls button')].find(b=>b.textContent==='Subir archivos');
Object.defineProperty(files,'files',{configurable:true,value:[new dm.File([bytes],'Mi canción.mp3',{type:'audio/mpeg'})]});
submit.click();await until(()=>dm.LuminousAudio.getAvailableTracks('music').length===2&&!submit.disabled);
assert.equal(backend.objects.size,1);assert.match(d.querySelector('.audio-cloud-library').textContent,/Mi canción/);
submit.click();await until(()=>d.querySelector('.audio-cloud-library [role=status]').textContent.includes('1 ya estaban'));
assert.equal(backend.objects.size,1);
const song=dm.LuminousAudio.getAvailableTracks('music').find(entry=>entry.id.startsWith('r2_'));
const musicSelect=d.querySelector('[data-audio-select="music"]');musicSelect.value=song.id;
d.querySelector('[data-audio-command="play-music"]').click();await until(()=>dm.testRead('campaña/audio_director/music')?.trackId===song.id);
backend.setActive({music:{trackId:song.id,active:true}});
assert.ok(dm.audioElements[0].src.includes(song.id));
async function player(){
 const dom=new JSDOM('<!doctype html><html><head></head><body></body></html>',{url:origin,runScripts:'outside-only',pretendToBeVisual:true});const w=dom.window;audioMock(w);fetchMock(w);
 const database=()=>dm.testDb;database.ServerValue=dm.firebase.database.ServerValue;
 w.firebase={apps:[{}],database,auth:()=>({currentUser:{uid:'player'},onAuthStateChanged:fn=>{fn({uid:'player',getIdToken:async()=>jwt('player')});}})};
 w.eval(await fs.readFile('js/audio-cloud-library.js','utf8'));w.eval(await fs.readFile('js/luminous-audio-director.js','utf8'));await until(()=>w.audioElements[0]?.src.includes(song.id));return w;
}
const listener=await player();assert.equal(listener.audioElements[0].paused,false);assert.equal(listener.document.querySelector('.audio-cloud-library').hidden,true);
// Uploaded SFX travels through the same cue bus, exactly once per listener.
d.querySelector('[aria-label="Tipo de archivo"]').value='sfx';const sound=bytes.slice();sound[13]=99;
Object.defineProperty(files,'files',{configurable:true,value:[new dm.File([sound],'Golpe.mp3',{type:'audio/mpeg'})]});submit.click();
await until(()=>dm.LuminousAudio.getAvailableTracks('sfx').length===3&&!submit.disabled);
const effect=dm.LuminousAudio.getAvailableTracks('sfx').find(entry=>entry.id.startsWith('r2_'));
await until(()=>listener.LuminousAudio.getAvailableTracks('sfx').some(entry=>entry.id===effect.id));
d.querySelector('[data-audio-select="sfx"]').value=effect.id;d.querySelector('[data-audio-command="cue"]').click();
await until(()=>listener.audioElements.filter(element=>element.src.includes(effect.id)).length===1);
dm.testWrite('campaña/audio_director/cue',dm.testRead('campaña/audio_director/cue'));await pause();
assert.equal(listener.audioElements.filter(element=>element.src.includes(effect.id)).length,1);
const late=await player();assert.equal(late.audioElements.filter(element=>element.src.includes(effect.id)).length,0);
// Deleting a currently referenced song fails; stopping makes deletion possible.
let songRow=[...d.querySelectorAll('.audio-cloud-file')].find(row=>row.textContent.includes('Mi canción'));
songRow.querySelector('button').click();await until(()=>d.querySelector('.audio-cloud-library [role=status]').textContent.includes('Detén la pista'));
assert.equal(backend.objects.size,2);
await until(()=>!d.querySelector('[data-audio-command="stop-music"]').disabled);d.querySelector('[data-audio-command="stop-music"]').click();backend.setActive({});await pause();
songRow=[...d.querySelectorAll('.audio-cloud-file')].find(row=>row.textContent.includes('Mi canción'));songRow.querySelector('button').click();
await until(()=>backend.objects.size===1&&!submit.disabled);
assert.equal(dm.LuminousAudio.getAvailableTracks('music').length,1);
late.close();listener.close();dm.close();
console.log('R2 client integration passed: real file upload, duplicate prevention, catalog, DM/player synchronized song, one-shot SFX, late-join suppression and protected delete.');
