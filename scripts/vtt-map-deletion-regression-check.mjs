import assert from 'node:assert/strict';

await import('../js/vtt/map-authoring.js');
await import('../js/vtt/map-authoring-state.js');

const baseAuthoring=globalThis.LuminousVttMapAuthoring;
const state=globalThis.LuminousVttMapAuthoringState;
assert.ok(baseAuthoring?.createDefinition,'map authoring must load');
assert.ok(state?.createBridge,'map authoring state must load');

function dmRoot({firebase=null}={}){
  return{
    LuminousVttMapAuthoring:baseAuthoring,
    firebase,
    document:{body:{classList:{contains:(name)=>name==='on-game-dashboard'}}},
  };
}

async function expectCode(promise,code){
  await assert.rejects(promise,(error)=>error?.message===code,`expected ${code}`);
}

// Local contract: inactive maps may be deleted, the active map may not, and
// nonexistent ids must fail rather than reporting a false success.
{
  const root=dmRoot();
  const bridge=state.createBridge({root,mapData:{id:'seed'}});
  const first=await bridge.createDefinition({id:'delete_contract_a',name:'Delete A'});
  const second=await bridge.createDefinition({id:'delete_contract_b',name:'Delete B'});

  await bridge.activate(first.id);
  await expectCode(bridge.deleteDefinition(first.id),'ACTIVE_MAP_CANNOT_BE_DELETED');
  assert.ok(bridge.get(first.id),'active map must remain after rejected deletion');

  assert.equal(await bridge.deleteDefinition(second.id),true);
  assert.equal(bridge.get(second.id),null,'inactive map must be removed');
  assert.equal(bridge.list().length,1);

  await expectCode(bridge.deleteDefinition('missing_map'),'MAP_NOT_FOUND');
}

function failingDeleteFirebase(){
  const values=new Map();
  const normalize=(path='')=>String(path).replace(/^\/+|\/+$/g,'');
  const clone=(value)=>value==null?value:JSON.parse(JSON.stringify(value));
  let failPath='';

  const makeRef=(rawPath='')=>{
    const path=normalize(rawPath);
    return{
      child(id){return makeRef(path?`${path}/${id}`:id);},
      async transaction(updateFn){
        const current=values.has(path)?clone(values.get(path)):null;
        const next=updateFn(current);
        if(next===undefined)return{committed:false,snapshot:{val:()=>current}};
        values.set(path,clone(next));
        return{committed:true,snapshot:{val:()=>clone(next)}};
      },
      async once(){const current=values.has(path)?clone(values.get(path)):null;return{val:()=>current};},
      async set(value){values.set(path,clone(value));},
      async remove(){
        if(path===failPath)throw new Error('SIMULATED_DELETE_FAILURE');
        values.delete(path);
      },
      on(){},off(){},update(){},
    };
  };

  const db={ref:(path='')=>makeRef(path)};
  function database(){return db;}
  database.ServerValue={TIMESTAMP:{'.sv':'timestamp'}};
  const firebase={database,auth:()=>({currentUser:{uid:state.DM_UID}})};
  return{
    firebase,
    values,
    failDeleteForMap(mapId){failPath=`${state.MAPS_ROOT}/${mapId}`;},
  };
}

// Remote failure contract: deleting optimistically must be rolled back locally
// if RTDB remove fails, otherwise the UI and persistence disagree.
{
  const store=failingDeleteFirebase();
  const root=dmRoot({firebase:store.firebase});
  const bridge=state.createBridge({root,mapData:{id:'seed'}});
  const created=await bridge.createDefinition({id:'delete_rollback_map',name:'Rollback Map'});
  const persistedKey=`${state.MAPS_ROOT}/${created.id}`;
  assert.ok(store.values.has(persistedKey),'map must be persisted before deletion test');

  store.failDeleteForMap(created.id);
  await assert.rejects(bridge.deleteDefinition(created.id),/SIMULATED_DELETE_FAILURE/);
  assert.ok(bridge.get(created.id),'failed remote delete must restore local map');
  assert.ok(store.values.has(persistedKey),'failed remote delete must leave persisted map intact');
}

console.log('vtt map deletion regression: ok');
