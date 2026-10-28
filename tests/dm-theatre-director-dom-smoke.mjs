import {JSDOM} from 'jsdom';
import {mountDirector} from './helpers/dm-director-fixture.mjs';
import fs from 'node:fs/promises';import path from 'node:path';import assert from 'node:assert/strict';
let dom;
const page={locator:selector=>({click:async()=>dom.window.document.querySelector(selector).click()}),route:async()=>{},setContent:async html=>{
 dom=new JSDOM(html,{url:'http://dm-workspace.test/',runScripts:'outside-only',pretendToBeVisual:true});
 dom.window.HTMLDialogElement.prototype.showModal=function(){this.open=true};
 dom.window.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new dom.window.Event('close'))};
 dom.window.alert=()=>{};
 class Audio {constructor(src=''){this.src=src;this.paused=true;this.duration=100;this.currentTime=0;}addEventListener(){}play(){this.paused=false;return Promise.resolve()}pause(){this.paused=true}load(){}removeAttribute(k){this[k]=''}}
 dom.window.Audio=Audio;
},evaluate:async(fn,arg)=>dom.window.eval(`(${fn.toString()})(${JSON.stringify(arg)})`),addStyleTag:async()=>{},addScriptTag:async({path:p})=>dom.window.eval(await fs.readFile(p,'utf8'))};
await mountDirector(page);
const w=dom.window,d=w.document;const expectedErrors=[];w.console.error=(...args)=>expectedErrors.push(args);const tick=()=>new Promise(r=>setTimeout(r,40));
const menu=d.querySelector('.theatre-dm-menu');menu.open=true;await tick();
assert.equal(d.querySelectorAll('#theatre-stage').length,1);
assert.equal(d.querySelectorAll('.actor-control-card').length,1);
d.querySelector('.btn-show').click();await tick();assert.equal(d.querySelector('.actor-control-card').dataset.visible,'true');
d.querySelector('.btn-hide').click();await tick();assert.equal(d.querySelector('.actor-control-card').dataset.visible,'false');
d.querySelector('.dm-director-actor-speak').click();assert.equal(d.querySelector('#dm-theatre-composer-modal').open,true);
d.querySelector('#theatre-dialogue-input').value='Una intervención';d.querySelector('#btn-send-dialogue').click();await tick();assert.equal(w.writeId,1);assert.equal(d.querySelector('#theatre-dialogue-input').value,'');
assert.equal(d.querySelectorAll('#theatre-log-container .dialogue-row').length,2);
w.LuminousAudio.openOptions();d.querySelector('[data-audio-command="play-music"]').click();await tick();assert.equal(w.testRead('campaña/audio_director/music').active,true);
d.querySelector('[data-audio-command="pause-music"]').click();await tick();assert.equal(w.testRead('campaña/audio_director/music').active,false);
w.testWrite('campaña/estado_mundo/escena_actual/actores/active_aldara',null);await tick();
assert.equal(d.querySelector('.theatre-dm-composer').dataset.actorRetired,'true');
assert.equal((await w.LuminousTheatreState.publishIntervention('late',{actorId:'active_aldara',mensaje:'No revivir'})).reason,'actor-retired');
// Real catalog keys, pagination source identity and rejected-write feedback.
w.LuminousDmTheatreWorkspace.activate('cast');
const npcs={};for(let i=0;i<55;i++)npcs['guard_'+i]={nombre:'Guardia',sprite:'Assets/Images/Buttons/Theatre.png'};
w.testWrite('campaña/base_datos_npcs',npcs);await tick();
assert.equal(d.querySelectorAll('#dm-director-roster-grid .dm-director-person-card').length,48);
[...d.querySelectorAll('#dm-director-roster-grid button')].find(b=>b.textContent==='Mostrar más personajes').click();
assert.equal(d.querySelectorAll('#dm-director-roster-grid .dm-director-person-card').length,55);
w.rejectNextWrite=true;d.querySelector('#dm-director-roster-grid .dm-director-person-card:last-child').click();await tick();
assert.match(d.querySelector('#dm-director-view-cast [role="status"]').textContent,/No se pudo añadir/);
d.querySelector('#dm-director-roster-grid .dm-director-person-card:last-child').click();await tick();
assert.ok(Object.values(w.testRead('campaña/estado_mundo/escena_actual/actores')).some(a=>a.sourceId==='guard_54'));
// Six valid instances: oldest is hidden, never removed from the cast.
for(let i=0;i<6;i++)w.testWrite('campaña/estado_mundo/escena_actual/actores/cast_'+i,{nombre:'Actor',sprite:'Assets/Images/Buttons/Theatre.png'});
for(let i=0;i<6;i++)await w.LuminousTheatreState.updateVisibleActors('cast_'+i,{sprite:'Assets/Images/Buttons/Theatre.png'});
assert.equal(Object.values(w.testRead('campaña/estado_mundo/escena_actual/actores_visibles')).length,5);
assert.ok(!Object.values(w.testRead('campaña/estado_mundo/escena_actual/actores_visibles')).includes('cast_0'));
assert.ok(w.testRead('campaña/estado_mundo/escena_actual/actores/cast_0'));
// P1: player queues use persistent assigned IDs, not the DM's spawned IDs.
const sprite = 'Assets/Images/Buttons/Theatre.png';
w.testWrite('campaña/actores/player_actor', {nombre:'Jugador asignado',sprite});
w.testWrite('campaña/base_datos_npcs/player_npc', {nombre:'Asignado desde NPC',sprite});
w.testWrite('campaña/estado_mundo/escena_actual/actores/player_instance', {nombre:'Jugador asignado',sourceId:'player_actor',sprite});
for (const id of ['player_actor','player_npc']) {
  const message = {actorId:id,mensaje:'Mensaje de jugador',sprite};
  // A legacy/direct player queue entry has no actorScope field.
  const result = await w.LuminousTheatreState.publishIntervention('player_'+id,message);
  assert.equal(result.published,true);
  assert.equal(result.payload.actorId,id);
  assert.equal(w.testRead('campaña/estado_mundo/escena_actual/actores/'+id),null);
  assert.ok(!Object.values(w.testRead('campaña/estado_mundo/escena_actual/actores_visibles')).includes(id));
  const queued = await w.LuminousTheatreState.enqueueIntervention(message);
  assert.equal(queued.queued,true);
  assert.equal(w.testRead('campaña/teatro/cola/'+queued.key).actorScope,'assigned');
}
assert.equal((await w.LuminousTheatreState.publishIntervention('missing',{actorId:'not_registered',nombre:'Jugador asignado'})).published,false);
// A queued scene instance stays retired even if a library ID happens to match.
const scoped = await w.LuminousTheatreState.enqueueIntervention({actorId:'cast_0',mensaje:'Instancia temporal',sprite});
const scopedMessage = w.testRead('campaña/teatro/cola/'+scoped.key);
assert.equal(scopedMessage.actorScope,'scene');
w.testWrite('campaña/estado_mundo/escena_actual/actores/cast_0',null);
w.testWrite('campaña/actores/cast_0',{nombre:'Otra identidad',sprite});
assert.equal((await w.LuminousTheatreState.publishIntervention('scoped',scopedMessage)).reason,'actor-retired');
assert.equal(w.testRead('campaña/estado_mundo/escena_actual/actores/cast_0'),null);
// P2: switching A -> B tracks B; a roster's automatic Narrator fallback does not.
w.testWrite('campaña/estado_mundo/escena_actual/actores/speaker_a',{nombre:'A',sprite});
w.testWrite('campaña/estado_mundo/escena_actual/actores/speaker_b',{nombre:'B',sprite});
w.LuminousDmTheatreWorkspace.openComposer('speaker_a');
const speaker = d.querySelector('#theatre-speaker-select');
const composer = d.querySelector('.theatre-dm-composer');
speaker.value='speaker_b';speaker.dispatchEvent(new w.Event('change',{bubbles:true}));
w.testWrite('campaña/estado_mundo/escena_actual/actores/speaker_a',null);await tick();
assert.equal(composer.dataset.actorId,'speaker_b');
assert.equal(composer.dataset.actorRetired,'false');
d.querySelector('#theatre-dialogue-input').value='Mensaje para B';
const beforeSend=w.writeId;d.querySelector('#btn-send-dialogue').click();await tick();
assert.equal(w.writeId,beforeSend+1);
assert.equal(d.querySelector('#theatre-dialogue-input').value,'');
w.testWrite('campaña/estado_mundo/escena_actual/actores/speaker_b',null);await tick();
assert.equal(speaker.value,'narrador');
assert.equal(composer.dataset.actorId,'speaker_b');
assert.equal(composer.dataset.actorRetired,'true');
speaker.value='narrador';speaker.dispatchEvent(new w.Event('change',{bubbles:true}));
assert.equal(composer.dataset.actorId,'narrador');
assert.equal(composer.dataset.actorRetired,'false');
console.log('P1 assigned IDs / retired instance scope and P2 explicit speaker switching: passed');
console.log('DOM functional integration passed: real engine + controls + compositor + canonical log + audio play/pause + retirement.');
w.close();

// End-to-end legacy player path: raw push -> DM queue processor -> archive.
await mountDirector(page);
const playerWindow=dom.window;
playerWindow.testWrite('campaña/actores/assigned_e2e',{nombre:'Jugador E2E',sprite});
playerWindow.testDb.ref('campaña/teatro/cola').push({actorId:'assigned_e2e',nombre:'Jugador E2E',mensaje:'Hola',sprite,createdAt:Date.now()});
const deadline=Date.now()+6000;
while (Date.now()<deadline && !Object.values(playerWindow.testRead('campaña/teatro/log')||{}).some(message=>message.actorId==='assigned_e2e')) await tick();
assert.equal(Object.values(playerWindow.testRead('campaña/teatro/log')).filter(message=>message.actorId==='assigned_e2e').length,1);
assert.equal(Object.values(playerWindow.testRead('campaña/teatro/cola')||{}).filter(message=>message.actorId==='assigned_e2e').length,0);
assert.equal(playerWindow.testRead('campaña/estado_mundo/escena_actual/actores/assigned_e2e'),null);
playerWindow.close();
console.log('Legacy assigned player queue: published and archived exactly once without a cast instance.');
