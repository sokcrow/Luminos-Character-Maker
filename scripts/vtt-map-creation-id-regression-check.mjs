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

// Browser UI path: authoring.createDefinition() -> bridge.saveDefinition().
// Freeze the candidate ourselves to model same name + same Date.now() value.
{
  const root=dmRoot();
  const bridge=state.createBridge({root,mapData:{id:'seed',grid:{cols:30,rows:30,size:70,distancePerCell:5}}});
  const authoring=root.LuminousVttMapAuthoring;
  const candidate='new_map_frozen_clock';

  const a=await bridge.saveDefinition(authoring.createDefinition({id:candidate,name:'New Map'}));
  const b=await bridge.saveDefinition(authoring.createDefinition({id:candidate,name:'New Map'}));
  const c=await bridge.saveDefinition(authoring.createDefinition({id:candidate,name:'New Map'}));

  assert.equal(a.id,candidate);
  assert.equal(b.id,`${candidate}_2`);
  assert.equal(c.id,`${candidate}_3`);
  assert.equal(bridge.list().length,3,'create-only path must never overwrite an existing map');

  const edited=await bridge.saveDefinition({...bridge.get(a.id),name:'Edited Existing Map'});
  assert.equal(edited.id,a.id,'normal save must keep the existing map id');
  assert.equal(bridge.get(a.id).name,'Edited Existing Map');
  assert.equal(bridge.list().length,3,'editing must remain an upsert, not fork a map');
}

function fakeFirebaseStore(){
  const values=new Map();
  const normalize=(path='')=>String(path).replace(/^\/+|\/+$/g,'');
  const clone=(value)=>value==null?value:JSON.parse(JSON.stringify(value));
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
      on(){},off(){},remove(){values.delete(path);},update(){},
    };
  };
  const db={ref:(path='')=>makeRef(path)};
  function database(){return db;}
  database.ServerValue={TIMESTAMP:{'.sv':'timestamp'}};
  const firebase={database,auth:()=>({currentUser:{uid:state.DM_UID}})};
  return{firebase,values};
}

// Two independent bridges simulate two DM tabs/clients with stale local caches.
// The RTDB transaction must make reservation exclusive.
{
  const shared=fakeFirebaseStore();
  const rootA=dmRoot({firebase:shared.firebase});
  const rootB=dmRoot({firebase:shared.firebase});
  const bridgeA=state.createBridge({root:rootA,mapData:{id:'seed_a'}});
  const bridgeB=state.createBridge({root:rootB,mapData:{id:'seed_b'}});
  const candidate='concurrent_map_same_id';

  const [a,b]=await Promise.all([
    bridgeA.createDefinition({id:candidate,name:'Concurrent Map'}),
    bridgeB.createDefinition({id:candidate,name:'Concurrent Map'}),
  ]);

  assert.deepEqual(new Set([a.id,b.id]),new Set([candidate,`${candidate}_2`]));
  const persisted=[...shared.values.keys()].filter((key)=>key.startsWith(`${state.MAPS_ROOT}/`));
  assert.equal(persisted.length,2,'both maps must be persisted under distinct keys');
  assert.ok(persisted.some((key)=>key.endsWith(`/${candidate}`)));
  assert.ok(persisted.some((key)=>key.endsWith(`/${candidate}_2`)));
}

console.log('vtt map creation id regression: ok');
