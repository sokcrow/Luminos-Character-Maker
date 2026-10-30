import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {mountDirector} from './helpers/dm-director-fixture.mjs';
import {setup,jwt,origin} from './helpers/audio-r2-fixture.mjs';
const backend=setup(),bytes=new Uint8Array([73,68,51,4,0,0,0,0,0,4,1,2,3,4]);
const endpoint='https://limbus-audio.account.workers.dev';
const pause=()=>new Promise(resolve=>setTimeout(resolve,20));
async function until(check){const limit=Date.now()+3000;while(!check()&&Date.now()<limit)await pause();assert.ok(check(),'condition timed out');}
function audioMock(w,{duration=60,readyState=1}={}){w.audioElements=[];w.Audio=class extends w.EventTarget{constructor(src=''){super();this.src=src;this.paused=true;this.duration=duration;this.currentTime=0;this.readyState=readyState;this.plays=0;w.audioElements.push(this);}play(){this.paused=false;this.plays++;return Promise.resolve();}pause(){this.paused=true;}load(){}removeAttribute(key){this[key]='';}};}
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
submit.click();await until(()=>dm.LuminousAudio.getAvailableTracks('music').length===1&&!submit.disabled);
assert.equal(backend.objects.size,1);assert.match(d.querySelector('.audio-cloud-library').textContent,/Mi canción/);
submit.click();await until(()=>d.querySelector('.audio-cloud-library [role=status]').textContent.includes('1 ya estaban'));
assert.equal(backend.objects.size,1);
const song=dm.LuminousAudio.getAvailableTracks('music').find(entry=>entry.id.startsWith('r2_'));
for(const kind of ['music','ambience','sfx']) {
 assert.ok(dm.LuminousAudio.getAvailableTracks(kind).every(entry=>entry.id.startsWith('r2_')));
 assert.ok([...d.querySelector('[data-audio-select="'+kind+'"]').options].every(option=>option.value.startsWith('r2_')));
}
assert.equal(d.querySelectorAll('#pa-trackList .track-item').length,1,'only the uploaded song appears in the music catalog');
assert.equal(d.querySelectorAll('.quick-sfx').length,0,'system effects do not become quick actions');
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
async function reloadedDirector(metadata){
 const dom=new JSDOM('<!doctype html><html><head></head><body class="on-game-dashboard"></body></html>',{url:origin,runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window;audioMock(w,metadata);fetchMock(w);w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
 const database=()=>dm.testDb;database.ServerValue=dm.firebase.database.ServerValue;
 w.firebase={apps:[{}],database,auth:()=>({currentUser:{uid:'dm'},onAuthStateChanged:fn=>fn({uid:'dm',getIdToken:async()=>jwt('dm')})})};
 for(const path of ['js/director-prototype-templates.js','js/audio-cloud-library.js','js/luminous-audio-director.js'])w.eval(await fs.readFile(path,'utf8'));
 await until(()=>w.audioElements[0]?.src.includes(song.id));return w;
}
// Ordinary refreshes retain usable URLs; load-error recovery replaces revoked
// tickets, including when an ordinary catalog request is already in flight.
const music=listener.audioElements[0],originalUrl=music.src;
const originalFetch=listener.fetch;let catalogCount=0,holdCatalog=false,releaseCatalog;
listener.fetch=async(...args)=>{
 const response=await originalFetch(...args);
 if(new URL(args[0]).pathname==='/catalog'){
  catalogCount++;
  if(holdCatalog){holdCatalog=false;await new Promise(resolve=>{releaseCatalog=resolve;});}
 }
 return response;
};
backend.env.AUDIO_SIGNING_KEY='first-rotated-signing-key-with-at-least-32-characters';
assert.equal((await backend.handler(new Request(originalUrl),backend.env)).status,403);
dm.testWrite('campaña/audio_director/library_revision',1);
await until(()=>catalogCount===1);await pause();
assert.equal(music.src,originalUrl,'ordinary refresh should preserve the playback URL');
holdCatalog=true;dm.testWrite('campaña/audio_director/library_revision',2);
await until(()=>releaseCatalog);
backend.env.AUDIO_SIGNING_KEY='second-rotated-signing-key-with-at-least-32-characters';
music.dispatchEvent(new listener.Event('error'));releaseCatalog();
await until(()=>music.src!==originalUrl);
assert.equal(catalogCount,3,'recovery needs a fresh request after the pending refresh');
assert.equal((await backend.handler(new Request(music.src),backend.env)).status,200);
assert.equal(music.paused,false,'the player resumes the selected song after renewing its ticket');
music.dispatchEvent(new listener.Event('playing'));
// Without an in-flight refresh, recovery must also accept a newly signed URL.
const previousUrl=music.src;
backend.env.AUDIO_SIGNING_KEY='third-rotated-signing-key-with-at-least-32-characters';
music.dispatchEvent(new listener.Event('error'));
await until(()=>music.src!==previousUrl);
assert.equal((await backend.handler(new Request(music.src),backend.env)).status,200);
// P2: reloading a DM while R2 music is paused must resume the displayed shared
// track and position, regardless of the hidden selector's default/local choice.
dm.testWrite('campaña/audio_director/music',{trackId:song.id,active:false,startedAt:0,positionMs:12345,loop:false});
const reloaded=await reloadedDirector(),reloadMusic=reloaded.audioElements[0];
assert.equal(reloaded.document.querySelector('#pa-nowTitle').textContent,'Mi canción');
reloaded.document.querySelector('#pa-playBtn').click();await until(()=>dm.testRead('campaña/audio_director/music')?.active);
assert.equal(dm.testRead('campaña/audio_director/music').trackId,song.id,'footer must resume the shared R2 song after reload');
assert.ok(Math.abs(reloadMusic.currentTime-12.345)<1,'a pause resumes its stored position');
// P2: completion without repeat is not a resumable pause at the last sample.
for(const fromCard of [false,true]){
 await until(()=>!reloaded.document.querySelector('#pa-playBtn').disabled);
 reloadMusic.currentTime=60;reloadMusic.paused=true;reloadMusic.dispatchEvent(new reloaded.Event('ended'));
 await until(()=>dm.testRead('campaña/audio_director/music')?.active===false);
 assert.equal(dm.testRead('campaña/audio_director/music').positionMs,0,'an ended track is ready to restart');
 await until(()=>!reloaded.document.querySelector('#pa-playBtn').disabled);
 const play=fromCard?reloaded.document.querySelector('[data-track-id="'+song.id+'"] .play'):reloaded.document.querySelector('#pa-playBtn');
 play.click();await until(()=>dm.testRead('campaña/audio_director/music')?.active);
 assert.equal(dm.testRead('campaña/audio_director/music').trackId,song.id);
 assert.ok(reloadMusic.currentTime<1,'footer and card restart a completed song at zero');
}
// Old clients could store a completed song as a pause at its full duration.
// A reloaded media element has no duration until loadedmetadata arrives.
dm.testWrite('campaña/audio_director/music',{trackId:song.id,active:false,startedAt:0,positionMs:60000,loop:false});
const unknown=await reloadedDirector({duration:NaN,readyState:0}),unknownMusic=unknown.audioElements[0];
unknown.document.querySelector('#pa-playBtn').click();
assert.equal(dm.testRead('campaña/audio_director/music').active,false,'do not publish a resume before metadata validates its position');
unknownMusic.duration=60;unknownMusic.readyState=1;unknownMusic.dispatchEvent(new unknown.Event('loadedmetadata'));
await until(()=>dm.testRead('campaña/audio_director/music')?.active);
assert.ok(unknownMusic.currentTime<1,'a legacy full-duration position restarts from zero once metadata loads');
assert.ok(Date.now()-dm.testRead('campaña/audio_director/music').startedAt<1000);
await until(()=>!unknown.document.querySelector('#pa-playBtn').disabled);
dm.testWrite('campaña/audio_director/music',{trackId:song.id,active:false,startedAt:0,positionMs:20000,loop:false});
unknownMusic.duration=NaN;unknownMusic.readyState=0;
unknown.document.querySelector('#pa-playBtn').click();assert.equal(dm.testRead('campaña/audio_director/music').active,false);
unknownMusic.readyState=1;unknownMusic.dispatchEvent(new unknown.Event('loadedmetadata'));
assert.equal(dm.testRead('campaña/audio_director/music').active,false,'metadata without a finite duration is not enough to validate a pause');
unknownMusic.duration=60;unknownMusic.dispatchEvent(new unknown.Event('durationchange'));
await until(()=>dm.testRead('campaña/audio_director/music')?.active);
assert.ok(Math.abs(unknownMusic.currentTime-20)<1,'a true intermediate pause retains its position after metadata loads');
await until(()=>!unknown.document.querySelector('#pa-playBtn').disabled);
// A changed shared intent cancels an older metadata wait; its late event must
// not start an obsolete song after another DM has stopped/replaced it.
dm.testWrite('campaña/audio_director/music',{trackId:song.id,active:false,startedAt:0,positionMs:15000,loop:false});
unknownMusic.duration=NaN;unknownMusic.readyState=0;unknown.document.querySelector('#pa-playBtn').click();
dm.testWrite('campaña/audio_director/music',{trackId:'lament',active:false,startedAt:0});
unknownMusic.duration=60;unknownMusic.readyState=1;unknownMusic.dispatchEvent(new unknown.Event('loadedmetadata'));await pause();
assert.equal(dm.testRead('campaña/audio_director/music').trackId,'lament');assert.equal(dm.testRead('campaña/audio_director/music').active,false);
// Restore R2 music for the existing player and protected-delete regressions.
dm.testWrite('campaña/audio_director/music',{trackId:song.id,active:true,startedAt:Date.now(),loop:false});
// Uploaded SFX travels through the same cue bus, exactly once per listener.
d.querySelector('[aria-label="Tipo de archivo"]').value='sfx';const sound=bytes.slice();sound[13]=99;
Object.defineProperty(files,'files',{configurable:true,value:[new dm.File([sound],'Golpe.mp3',{type:'audio/mpeg'})]});submit.click();
await until(()=>dm.LuminousAudio.getAvailableTracks('sfx').length===1&&!submit.disabled);
const effect=dm.LuminousAudio.getAvailableTracks('sfx').find(entry=>entry.id.startsWith('r2_'));
await until(()=>listener.LuminousAudio.getAvailableTracks('sfx').some(entry=>entry.id===effect.id));
d.querySelector('[data-audio-select="sfx"]').value=effect.id;d.querySelector('[data-audio-command="cue"]').click();
await until(()=>listener.audioElements.filter(element=>element.src.includes(effect.id)).length===1);
dm.testWrite('campaña/audio_director/cue',dm.testRead('campaña/audio_director/cue'));await pause();
assert.equal(listener.audioElements.filter(element=>element.src.includes(effect.id)).length,1);
const late=await player();assert.equal(late.audioElements.filter(element=>element.src.includes(effect.id)).length,0);
// P2: both stop controls halt continuous ambience and already-started one-shots
// on the DM and remote players, without stopping the music channel.
// A legacy bus already active in shared state can still be stopped, but
// cannot be selected again from the Director catalog.
dm.testWrite('campaña/audio_director/ambience',{trackId:'bus',active:true,startedAt:Date.now()});
await until(()=>!listener.audioElements[1].paused);
await until(()=>dm.audioElements.some(element=>element.src.includes(effect.id)));
const playedCue=dm.testRead('campaña/audio_director/cue');
d.querySelector('#pa-stopAllEffects').click();
await until(()=>dm.testRead('campaña/audio_director/cue')?.action==='stop'&&dm.testRead('campaña/audio_director/ambience')?.active===false);
for(const w of [dm,listener,reloaded])assert.equal(w.audioElements.find(element=>element.src.includes(effect.id)).paused,true);
assert.equal(listener.audioElements[1].paused,true);assert.equal(listener.audioElements[0].paused,false);
const stoppedCue=dm.testRead('campaña/audio_director/cue');dm.testWrite('campaña/audio_director/cue',stoppedCue);await pause();
assert.equal(listener.audioElements.filter(element=>element.src.includes(effect.id)).length,1,'duplicate stop cannot replay a cue');
dm.testWrite('campaña/audio_director/cue',playedCue);await pause();
assert.equal(listener.audioElements.filter(element=>element.src.includes(effect.id)).length,1,'rollback to an already handled cue cannot restart a stopped effect');
dm.testWrite('campaña/audio_director/cue',stoppedCue);
await until(()=>!d.querySelector('[data-audio-command="cue"]').disabled);d.querySelector('[data-audio-command="cue"]').click();
await until(()=>listener.audioElements.filter(element=>element.src.includes(effect.id)).length===2);
d.querySelector('#pa-stopAllQuick').click();await until(()=>listener.audioElements.filter(element=>element.src.includes(effect.id)).every(element=>element.paused));
// A cue awaiting its R2 catalog must also be cancelled by a newer stop cue.
const delayedBytes=bytes.slice();delayedBytes[13]=17;
const delayedResult=await backend.request('/tracks?kind=sfx&name=Pending',{method:'PUT',body:delayedBytes});
const delayedEffect=(await delayedResult.json()).track;
const fetchBeforeDelay=listener.fetch;let releaseEffectCatalog;
listener.fetch=async(...args)=>{
 const response=await fetchBeforeDelay(...args);
 if(new URL(args[0]).pathname==='/catalog'&&!releaseEffectCatalog)await new Promise(resolve=>{releaseEffectCatalog=resolve;});
 return response;
};
dm.testWrite('campaña/audio_director/library_revision',Date.now());await until(()=>releaseEffectCatalog);
dm.testWrite('campaña/audio_director/cue',{cueId:delayedEffect.id,nonce:'pending-r2-cue',at:Date.now()});
await until(()=>!d.querySelector('#pa-stopAllEffects').disabled);d.querySelector('#pa-stopAllEffects').click();
await until(()=>dm.testRead('campaña/audio_director/cue')?.action==='stop');
releaseEffectCatalog();
await until(()=>listener.LuminousAudio.getAvailableTracks('sfx').some(entry=>entry.id===delayedEffect.id));await pause();
assert.equal(listener.audioElements.some(element=>element.src.includes(delayedEffect.id)),false,'a stopped pending cue cannot start after its catalog arrives');
listener.fetch=fetchBeforeDelay;
dm.testWrite('campaña/audio_director/cue',{cueId:delayedEffect.id,nonce:'fresh-r2-cue-after-stop',at:Date.now()});
await until(()=>listener.audioElements.some(element=>element.src.includes(delayedEffect.id)));
assert.equal(listener.audioElements.find(element=>element.src.includes(delayedEffect.id)).paused,false,'fresh cues remain playable after the stop generation changes');
// Deleting a currently referenced song fails; stopping makes deletion possible.
let songRow=[...d.querySelectorAll('.audio-cloud-file')].find(row=>row.textContent.includes('Mi canción'));
songRow.querySelector('button').click();await until(()=>d.querySelector('.audio-cloud-library [role=status]').textContent.includes('Detén la pista'));
assert.equal(backend.objects.size,3);
await until(()=>!d.querySelector('[data-audio-command="stop-music"]').disabled);d.querySelector('[data-audio-command="stop-music"]').click();backend.setActive({});await pause();
songRow=[...d.querySelectorAll('.audio-cloud-file')].find(row=>row.textContent.includes('Mi canción'));songRow.querySelector('button').click();
await until(()=>backend.objects.size===2&&!submit.disabled);
assert.equal(dm.LuminousAudio.getAvailableTracks('music').length,0);
unknown.close();reloaded.close();late.close();listener.close();dm.close();
console.log('R2 client integration passed: upload/deduplication, shared song/clock, signing-key recovery, paused R2 resume after DM reload, completed-track replay, shared stop for ambience/one-shots, late-join suppression and protected delete.');
