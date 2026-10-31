import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const copy=v=>v==null?v:JSON.parse(JSON.stringify(v));
async function scenario(operation,players,fail=false){
  const actor={nombre:'Hopkins',tipo:'NPC',socialLink:{enabled:true,players:{alice:true}}};
  const data={campaña:{base_datos_npcs:{hopkins:copy(actor)},jugadores:players,estado_mundo:{vinculos_publicados:{alice:{hopkins:{enabled:true,name:'Hopkins'}}}}}};
  const get=path=>path.split('/').filter(Boolean).reduce((o,k)=>o?.[k],data);
  let release,rejectRead,writes=0,readStarted=false;
  const db={ref(path=''){return {
    on(event,cb){if(path!=='campaña/jugadores')cb({val:()=>copy(get(path))||null});},off(){},
    once(){assert.equal(path,'campaña/jugadores');readStarted=true;return new Promise((resolve,reject)=>{release=()=>resolve({val:()=>copy(players)});rejectRead=reject;});},
    async update(updates){writes++;for(const [key,value]of Object.entries(updates)){const parts=key.split('/');let o=data;for(const p of parts.slice(0,-1))o=o[p]||={};if(value==null)delete o[parts.at(-1)];else o[parts.at(-1)]=copy(value);}}
  };}};
  const c=vm.createContext({console});c.window=c;c.firebase={database:()=>db};
  for(const p of ['js/social-link-core.js','js/character-manager-engine.js'])vm.runInContext(read(p),c);
  const manager=c.LuminousCharacterManager;manager.init({db});
  const pending=operation(manager);
  assert.equal(readStarted,true);assert.equal(writes,0,'No writes while the player directory is unknown');
  assert.equal(get('campaña/estado_mundo/vinculos_publicados/alice/hopkins/enabled'),true);
  if(fail){rejectRead(Error('PERMISSION_DENIED'));await assert.rejects(pending,/PERMISSION_DENIED/);assert.equal(writes,0);}
  else {release();await pending;}
  manager.destroy();return {get,writes};
}
const valid={alice:{uid:'qa',nombre:'Alice'}};
const saved=await scenario(m=>m.saveActor({actorId:'hopkins',actor:{titulo:'Nuevo título'}}),valid);
assert.equal(saved.get('campaña/base_datos_npcs/hopkins/socialLink/players/alice'),true);
assert.equal(saved.get('campaña/estado_mundo/vinculos_publicados/alice/hopkins/enabled'),true);
const removed=await scenario(m=>m.saveActor({actorId:'hopkins',actor:{titulo:'Limpieza real'}}),{});
assert.equal(removed.get('campaña/base_datos_npcs/hopkins/socialLink/players/alice'),undefined,'A confirmed empty directory still cleans deleted recipients');
await scenario(m=>m.saveActor({actorId:'hopkins',actor:{titulo:'No guardar'}}),valid,true);
const deleted=await scenario(m=>m.deleteActor('hopkins'),valid);
assert.equal(deleted.get('campaña/base_datos_npcs/hopkins'),undefined);
assert.equal(deleted.get('campaña/estado_mundo/vinculos_publicados/alice/hopkins'),undefined);
console.log('Social Link player readiness: delayed directory preserves valid links, real deletion prunes, read failure writes nothing, delete waits OK.');
