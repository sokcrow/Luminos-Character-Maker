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
console.log('DOM functional integration passed: real engine + controls + compositor + canonical log + audio play/pause + retirement.');
w.close();
