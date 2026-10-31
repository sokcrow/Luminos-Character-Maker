import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read = path => fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');
const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));
const data = {campaña:{jugadores:{alice:{uid:'uid-a',nombre:'Alice'},bob:{uid:'uid-b',nombre:'Bob'}},base_datos_npcs:{},actores:{},estado_mundo:{vinculos:{alice:{hopkins:{nivel:8,puntos:-4,notas:'Solo DM',beneficios:['Orden — +1 poder de Clash cuando corresponda.']}}}}}};
const listeners = [];
let failWrite = false, writes = 0;
function get(path){return path.split('/').filter(Boolean).reduce((o,k)=>o?.[k],data);}
function set(path,value){const parts=path.split('/').filter(Boolean);let target=data;for(const part of parts.slice(0,-1))target=target[part] ||= {};if(value==null)delete target[parts.at(-1)];else target[parts.at(-1)]=clone(value);}
function snapshot(path){return {val:()=>clone(get(path))??null};}
const db={ref(path=''){return {
  on(event,callback){listeners.push({path,callback});callback(snapshot(path));},
  off(event,callback){const i=listeners.findIndex(row=>row.path===path&&row.callback===callback);if(i>=0)listeners.splice(i,1);},
  async once(){return snapshot(path);},
  async update(updates){if(failWrite)throw Error('PERMISSION_DENIED');writes++;for(const [key,value]of Object.entries(updates))set(path?path+'/'+key:key,value);for(const row of [...listeners])row.callback(snapshot(row.path));}
};}};
const database=()=>db;database.ServerValue={TIMESTAMP:123};
const context=vm.createContext({console,setTimeout,clearTimeout});context.window=context;context.firebase={database,apps:[{}]};
for(const path of ['js/social-link-core.js','js/character-manager-engine.js','js/bond-engine.js'])vm.runInContext(read(path),context,{filename:path});
const core=context.LuminousSocialLinkCore,manager=context.LuminousCharacterManager,bonds=context.LuminousBondManager;
manager.init({db});
const actor={nombre:'Hopkins',titulo:'Líder',tipo:'NPC',sprite:'Assets/Hopkins.png',socialLink:{enabled:true,combatant:true,players:{alice:true},description:'Un líder exigente.'}};
await manager.saveActor({actorId:'hopkins',actor,playerId:null});
assert.equal(get(core.PUBLIC_ROOT+'/alice/hopkins').name,'Hopkins');
assert.equal(get(core.PUBLIC_ROOT+'/bob/hopkins'),undefined,'Only selected player receives the NPC');
assert.equal(get(core.ROOT+'/alice/hopkins/nivel'),8,'Unlock never resets archived progress');
await bonds.setBond('alice','hopkins',{nivel:10,puntos:12,historia:'Publicada',recuerdos:['Nos ayudó.']});
assert.equal(get(core.ROOT+'/alice/hopkins/nivel'),10);
assert.equal(get(core.ROOT+'/alice/hopkins/notas'),'Solo DM','Progress edits retain private notes');
const view=core.playerView(get(core.PUBLIC_ROOT+'/alice/hopkins'),get(core.ROOT+'/alice/hopkins'));
assert.equal(view.rank,10);assert.equal(view.threshold,null);assert.equal(view.story,'Publicada');assert.ok(!('notas'in view));assert.ok(!JSON.stringify(view).includes('Solo DM'));
await manager.saveActor({actorId:'hopkins',actor:{socialLink:{...actor.socialLink,players:{bob:true}}}});
assert.equal(get(core.PUBLIC_ROOT+'/alice/hopkins'),undefined);assert.ok(get(core.PUBLIC_ROOT+'/bob/hopkins'));
assert.equal(get(core.ROOT+'/alice/hopkins/nivel'),10,'Revocation archives rather than deletes progress');
await manager.saveActor({actorId:'hopkins',actor:{socialLink:{...actor.socialLink,enabled:false,players:{bob:true}}}});
assert.equal(get(core.PUBLIC_ROOT+'/bob/hopkins'),undefined);
await manager.saveActor({actorId:'hopkins',actor:{socialLink:actor.socialLink}});
assert.equal(get(core.ROOT+'/alice/hopkins/nivel'),10,'Re-enabling preserves progress');
await manager.saveActor({actorId:'hopkins',actor:{nombre:'Hopkins actualizado'}});
assert.equal(get(core.PUBLIC_ROOT+'/alice/hopkins').name,'Hopkins actualizado','Metadata updates reach the published profile');
const before=JSON.stringify(data),beforeWrites=writes;
await assert.rejects(manager.saveActor({actorId:'hopkins',actor:{socialLink:{enabled:true,players:{missing:true}}}}),/jugadores seleccionados/);
assert.equal(writes,beforeWrites);assert.equal(JSON.stringify(data),before);
failWrite=true;
await assert.rejects(manager.saveActor({actorId:'hopkins',actor:{nombre:'No guardado'}}),/PERMISSION_DENIED/);
assert.equal(JSON.stringify(data),before,'Failed publication never partly saves the actor');
failWrite=false;
await assert.rejects(manager.saveActor({actorId:'hopkins',playerId:'alice',actor:{socialLink:actor.socialLink}}),/Social Link se configura/);
assert.equal(core.playerView({enabled:false,name:'Secreto'},{}),null);
assert.equal(core.normalizeProgress({nivel:40,puntos:-6}).nivel,10);assert.equal(core.normalizeProgress({puntos:-6}).puntos,-6);
assert.throws(()=>core.safeKey('alice/hopkins'),/no válido/);
await manager.deleteActor('hopkins');
assert.equal(get(core.PUBLIC_ROOT+'/alice/hopkins'),undefined,'Deleting an NPC withdraws its HUD publication');
assert.equal(get(core.ROOT+'/alice/hopkins/nivel'),10);
const html=read('hoja_personaje.html');assert.ok(html.indexOf('js/social-link-core.js')<html.indexOf('js/social-link-hud.js'));assert.equal((html.match(/name="act_hud_vinculos"/g)||[]).length,1);
const hud=read('js/social-link-hud.js');assert.ok(!/\.update\(|\.set\(|\.transaction\(/.test(hud),'Player HUD has no game-state writes');
console.log('Social Link: atomic NPC publication, recipient isolation, rank 10, archived progress, failure handling and read-only HUD OK.');
manager.destroy();
