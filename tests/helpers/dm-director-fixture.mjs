import fs from "node:fs/promises";
import path from "node:path";
const scenePath = "campaña/estado_mundo/escena_actual";
const actor = {nombre:"Aldara", icono:"Assets/Images/Buttons/Player.svg", sprite:"Assets/Images/Buttons/Theatre.png", expresiones:{Neutral:"Assets/Images/Buttons/Theatre.png"}};
export async function mountDirector(page, {delayDashboardAuth = false, authUid = "dm", lateChecks = false, lateRollVisualizer = false} = {}) {
  await page.route('http://dm-workspace.test/**', async route => {
    const pathname = decodeURIComponent(new URL(route.request().url()).pathname).slice(1);
    const target = path.resolve(pathname);
    if (!target.startsWith(process.cwd()+path.sep)) return route.abort();
    try { await route.fulfill({path:target}); } catch { await route.fulfill({status:404,body:''}); }
  });
  const html = await fs.readFile('hoja_de_DM.html','utf8');
  const section = html.slice(html.indexOf('<section id="modulo-teatro"'), html.indexOf('<section id="modulo-combate"'))
    .replace('class="game-module hidden" aria-hidden="true"','class="game-module active-module" aria-hidden="false"');
  await page.setContent(`<!doctype html><html lang="es"><head><base href="http://dm-workspace.test/"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body class="on-game-dashboard"><main>${section}</main></body></html>`);
  await page.evaluate(({actor,scenePath,authUid}) => {
    const clone = value => JSON.parse(JSON.stringify(value ?? null));
    const data = {campaña:{config:{dm_uid:authUid},base_datos_npcs:{aldara:actor,nosprite:{nombre:'Sin imagen'}},actores:{},jugadores:{},estado_mundo:{instancia_activa:'teatro',escena_actual:{nombre:"Escena guardada",fondo:"https://assets.test/old.png",locacion:"Lugar guardado",escenarioId:"stored-scene",region:"Región guardada",categoria:"Categoría guardada",sub_etiquetas:["noche"],actores:{active_aldara:{...actor,identityId:'aldara'}},actores_visibles:[],max_actores_visibles:5}},teatro:{log:{first:{nombre:'Aldara',actorId:'active_aldara',mensaje:'Bienvenidos al Teatro.',icono:actor.icono,tipo_dialogo:'dialogo'},second:{mensaje:'La noche comienza.',tipo_dialogo:'narracion'}}}}};
    const listeners = [];
    const read = p => p.split('/').filter(Boolean).reduce((v,k)=>v?.[k],data) ?? null;
    const snap = (p,v=read(p)) => ({val:()=>clone(v),exists:()=>v!==null,key:p.split('/').pop(),child:k=>snap(p+'/'+k,v?.[k]??null),forEach:fn=>Object.entries(v||{}).forEach(([k,value])=>fn(snap(p+'/'+k,value)))});
    const resolveStamp = v => v && typeof v==='object' ? v['.sv']==='timestamp' ? Date.now() : Object.fromEntries(Object.entries(v).map(([k,x])=>[k,resolveStamp(x)])) : v;
    function write(p,v) {
      const keys=p.split('/').filter(Boolean); let n=data;
      for(const k of keys.slice(0,-1)) n=n[k]??={};
      const before=read(p); if(v===null) delete n[keys.at(-1)]; else n[keys.at(-1)]=resolveStamp(v);
      for(const l of [...listeners]) {
        if (l.event==='value' && (p===l.p || p.startsWith(l.p+'/') || l.p.startsWith(p+'/'))) l.fn(snap(l.p,l.project?l.project():read(l.p)));
        if (l.event==='child_added' && p.startsWith(l.p+'/') && before===null && v!==null) l.fn(snap(p));
      }
    }
    const checkedWrite = async (p,v) => { if(window.rejectNextWrite){window.rejectNextWrite=false;throw Error('PERMISSION_DENIED');} write(p,v); };
    function ref(p='',q={}) {
      const project=()=>{const value=read(p);if(!q.keyOrder&&!q.last)return value;let entries=Object.entries(value||{}).sort(([a],[b])=>a<b?-1:a>b?1:0);if(q.end!==undefined)entries=entries.filter(([key])=>key<=q.end);if(q.last)entries=entries.slice(-q.last);return Object.fromEntries(entries);};
      return {key:p.split('/').pop(),toString:()=>p,child:k=>ref(p+'/'+k),
      on(event,fn){listeners.push({p,event,fn,project});if(event==='value')fn(snap(p,project()));},off(event,fn){for(let i=listeners.length-1;i>=0;i--)if(listeners[i].p===p&&listeners[i].event===event&&listeners[i].fn===fn)listeners.splice(i,1);},
      once:async()=>{window.testQueries.push({p,...q});return snap(p,project());},set:v=>checkedWrite(p,v),remove:()=>checkedWrite(p,null),
      update:async values=>{for(const[k,v]of Object.entries(values))await checkedWrite(p?p+'/'+k:k,v);},
      transaction:async(fn,done)=>{const next=fn(clone(read(p)));let committed=next!==undefined;if(committed)await checkedWrite(p,next);const result={committed,snapshot:snap(p)};done?.(null,committed,result.snapshot);return result;},
      push(v){const r=ref(p+'/msg_'+(++window.writeId));if(v!==undefined)r.set(v);return r;},orderByChild(){return this;},orderByKey(){return ref(p,{...q,keyOrder:true});},endAt(end){return ref(p,{...q,end});},limitToLast(last){return ref(p,{...q,last});},limitToFirst(){return this;}
    }; }
    window.testQueries=[];window.testListenerCount=p=>listeners.filter(l=>l.p===p).length;
    window.writeId=0;window.testDb={ref};window.testRead=read;window.testWrite=write;
    const database=()=>window.testDb;database.ServerValue={TIMESTAMP:{'.sv':'timestamp'}};
    window.firebase={apps:[{}],database,auth:()=>({currentUser:{uid:authUid,getIdToken:async()=>window.testToken||'not-configured'},onAuthStateChanged:fn=>{fn({uid:authUid,getIdToken:async()=>window.testToken||'not-configured'});return()=>{};}})};
    window.LuminousInstanceControl={bindDashboard(){}};
  },{actor,scenePath,authUid});
  if (delayDashboardAuth) await page.evaluate(() => {
    const original = window.firebase.auth, pending = [];
    window.firebase.auth = () => ({...original(), onAuthStateChanged(fn) { pending.push(fn); return () => {}; }});
    window.testReleaseAuth = () => { for (const fn of pending.splice(0)) fn(original().currentUser); };
  });
  for (const file of ['on-game-dashboard','theatre-hud','theatre-message-policy','theatre-actor-studio','theatre-dm-workspace','luminous-audio-director','director-prototype-theatre','director-prototype-audio','director-prototype-integration','theatre-check-coordinator','dm-npc-rolls','theatre-opposed-checks','theatre-roll-menu']) await page.addStyleTag({path:`css/${file}.css`});
  for (const file of ['theatre-engine','theatre-controls','on-game-dashboard']) await page.addScriptTag({path:`js/${file}.js`});
  await page.evaluate(()=>document.dispatchEvent(new Event('DOMContentLoaded')));
  for (const file of ['theatre-director-menu-guard','theatre-intervention-ux-core','proficiency-runtime','theatre-roll-visualizer','theatre-check-coordinator','director-prototype-templates','theatre-dm-workspace','theatre-prototype-layout','theatre-roll-menu','audio-cloud-library','luminous-audio-director'].filter(file=>(!lateChecks || file!=='theatre-check-coordinator') && (!lateRollVisualizer || file!=='theatre-roll-visualizer'))) await page.addScriptTag({path:`js/${file}.js`});
  if(lateChecks) await page.addScriptTag({path:'js/theatre-check-coordinator.js'});
  await page.locator('.theatre-dm-menu-toggle').click();
}
