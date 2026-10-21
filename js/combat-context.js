/* Opt-in encounter namespace. Story combat keeps its original database. */
(function(g){
  'use strict';
  const q=new URLSearchParams(g.location?.search||''),id=q.get('encounter')||'',local=q.get('mode')==='local';
  if(!id)return;
  if(!/^[A-Za-z0-9_-]{1,100}$/.test(id))throw Error('Encuentro inválido.');
  const root=`campaña/encuentros/${id}`,key=`luminous:encounter:${id}`;
  const api={id,root,local,key,isolated:true};
  if(local){
    const saved=JSON.parse(g.localStorage.getItem(key)||'null');
    if(!saved?.hostUid)throw Error('Prepara este encuentro local antes de abrirlo.');
    const db=g.LuminousCombatLocalStore.create(key,saved.hostUid),user={uid:saved.hostUid,getIdToken:async()=> 'local'};
    const auth={currentUser:user,onAuthStateChanged(fn){queueMicrotask(()=>fn(user));return()=>{};}};
    const database=()=>db;database.ServerValue={TIMESTAMP:{'.sv':'timestamp'}};
    g.firebase={apps:[{name:'local'}],initializeApp(){return this.apps[0];},auth:()=>auth,database};
    api.hostUid=saved.hostUid;
  }else{
    const sdk=g.firebase,original=sdk.database;
    const cache=new WeakMap();
    const database=function(...args){const raw=original.apply(sdk,args);if(!cache.has(raw))cache.set(raw,{ref(path=''){return String(path).startsWith('.info/')?raw.ref(path):raw.ref(`${root}/state/${String(path).replace(/^\/+|\/+$/g,'')}`);},goOffline:()=>raw.goOffline(),goOnline:()=>raw.goOnline(),useEmulator:(...v)=>raw.useEmulator(...v),app:raw.app});return cache.get(raw);};
    database.ServerValue=original.ServerValue;Object.defineProperty(sdk,'database',{value:database,configurable:true});
  }
  g.LuminousCombatContext=Object.freeze(api);
})(window);
