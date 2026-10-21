/* The same combat paths and subscriptions, persisted on this device only. */
(function(g){
  'use strict';
  const copy=v=>v==null?null:JSON.parse(JSON.stringify(v));
  function create(key,uid){
    const saved=JSON.parse(g.localStorage.getItem(key)||'null');
    if(!saved?.state||saved.hostUid!==uid)throw Error('No se encontró el encuentro local de esta cuenta.');
    let data=saved.state;const listeners=new Set();let serial=0,chain=Promise.resolve();
    const parts=p=>String(p||'').split('/').filter(Boolean);
    const get=p=>parts(p).reduce((v,k)=>v?.[k],data)??null;
    const materialize=v=>v&&typeof v==='object'?(v['.sv']==='timestamp'?Date.now():Array.isArray(v)?v.map(materialize):Object.fromEntries(Object.entries(v).map(([k,c])=>[k,materialize(c)]))):v;
    function put(path,value){const ks=parts(path);if(!ks.length){data=copy(value)||{};return;}let node=data;for(const k of ks.slice(0,-1))node=node[k]??={};if(value==null)delete node[ks.at(-1)];else node[ks.at(-1)]=materialize(copy(value));}
    function snapshot(value,key=null){return {key,val:()=>copy(value),exists:()=>value!=null,child:p=>snapshot(parts(p).reduce((v,k)=>v?.[k],value)??null,parts(p).at(-1)),forEach(fn){for(const [k,v]of Object.entries(value||{}))if(fn(snapshot(v,k))===true)return true;return false;}};}
    function selected(path,query){
      let value=get(path);if(!query)return copy(value);
      let rows=Object.entries(value||{}).sort(([a,av],[b,bv])=>query.by?((av?.[query.by]??0)-(bv?.[query.by]??0)||a.localeCompare(b)):a.localeCompare(b));
      if(query.start!=null)rows=rows.filter(([k])=>k>=query.start);
      if(query.equal!==undefined)rows=rows.filter(([k,v])=>(query.by?v?.[query.by]:k)===query.equal);
      if(query.limit)rows=rows.slice(0,query.limit);return rows.length?Object.fromEntries(rows):null;
    }
    function notify(){for(const row of [...listeners]){
      const value=selected(row.path,row.query),signature=JSON.stringify(value);
      if(row.event==='value'){if(signature!==row.last){row.last=signature;row.fn(snapshot(value,parts(row.path).at(-1)));}}
      else if(row.event==='child_added'){for(const [k,v]of Object.entries(value||{}))if(!row.keys.has(k)){row.keys.add(k);row.fn(snapshot(v,k));}}
    }}
    function commit(fn){const task=chain.then(async()=>{const result=fn();g.localStorage.setItem(key,JSON.stringify({...saved,state:data}));queueMicrotask(notify);return result;});chain=task.catch(()=>{});return task;}
    function ref(path='',query=null){
      if(path==='.info/connected'||path==='.info/serverTimeOffset'){const val=path.endsWith('connected')?true:0;return {on(_e,fn){queueMicrotask(()=>fn(snapshot(val)));return fn;},off(){},once:async()=>snapshot(val)};}
      const api={key:parts(path).at(-1)||null,child:p=>ref([path,p].filter(Boolean).join('/')),get parent(){return ref(parts(path).slice(0,-1).join('/'));},get root(){return ref();},
        toString:()=>`local://${key}/${path}`,once:async()=>{await chain;return snapshot(selected(path,query),parts(path).at(-1));},get:async()=>api.once('value'),
        on(event,fn){const row={path,query,event,fn,last:undefined,keys:new Set()};listeners.add(row);queueMicrotask(notify);return fn;},off(event,fn){for(const row of listeners)if(row.path===path&&(!event||row.event===event)&&(!fn||row.fn===fn))listeners.delete(row);},
        set:value=>commit(()=>put(path,value)),remove:()=>api.set(null),update:values=>commit(()=>{for(const [p,v]of Object.entries(values||{}))put([path,p].filter(Boolean).join('/'),v);}),
        transaction:fn=>commit(()=>{const next=fn(copy(get(path)));if(next===undefined)return {committed:false,snapshot:snapshot(get(path))};put(path,next);return {committed:true,snapshot:snapshot(get(path))};}),
        push(value){const child=api.child(`local-${Date.now()}-${++serial}`);if(value!==undefined)void child.set(value);return child;},
        orderByKey:()=>ref(path,{...query}),orderByChild:by=>ref(path,{...query,by}),startAt:start=>ref(path,{...query,start}),equalTo:equal=>ref(path,{...query,equal}),limitToFirst:limit=>ref(path,{...query,limit})};
      return api;
    }
    return {ref,goOffline(){},goOnline(){},metadata:saved};
  }
  g.LuminousCombatLocalStore=Object.freeze({create});
})(typeof window==='undefined'?globalThis:window);
