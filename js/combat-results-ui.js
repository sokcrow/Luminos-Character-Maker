(function(global){
 'use strict';
 const STATUS='campaña/combate/estado',INSTANCE='campaña/estado_mundo/instancia_activa';
 const clean=v=>String(v??'');
 const escape=v=>clean(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 let db,uid='',myPlayerId='',state=null,instance='',overlay=null,seen=new Set(),timer=null,loadingTimer=null,offState=null,offInstance=null,authGeneration=0,previousFocus=null;
 const seal={victory:'Assets/Images/Combat/Victory_Battle_Result.png',defeat:'Assets/Images/Combat/Defeat_Battle_Result.png'};
 const css=`
 #limbus-results-overlay{position:fixed;inset:0;background:#000;z-index:2147483400;color:#f7e9d1;font:16px/1.4 Arial,sans-serif;display:flex;align-items:center;justify-content:center;box-sizing:border-box;padding:max(16px,env(safe-area-inset-top)) max(16px,env(safe-area-inset-right)) max(16px,env(safe-area-inset-bottom)) max(16px,env(safe-area-inset-left))}
 #limbus-results-overlay[hidden]{display:none}
 #limbus-results-overlay .results-board{width:min(1120px,100%);max-height:94dvh;overflow:auto;box-sizing:border-box;border:2px solid #b57c28;background:linear-gradient(135deg,#241812,#08080a);box-shadow:0 20px 90px #000;padding:clamp(12px,2vw,28px)}
 #limbus-results-overlay .results-layout{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,1fr);gap:18px}
 #limbus-results-overlay .results-mvp{min-height:280px;position:relative;background:radial-gradient(ellipse at top,#47301b,#0d0b09);display:flex;flex-direction:column;justify-content:flex-end;align-items:center;border:1px solid #7d5728}
 #limbus-results-overlay .results-mvp>img{width:100%;max-height:50dvh;object-fit:contain;object-position:bottom}
 #limbus-results-overlay .results-mvp-label{padding:12px 10px;background:linear-gradient(90deg,#24170c,#684314,#24170c);width:100%;box-sizing:border-box;text-align:center;font-weight:900;letter-spacing:.04em;font-size:clamp(22px,4vw,46px);color:#ffd47c;text-transform:uppercase}
 #limbus-results-overlay .results-mvp-name{text-align:center;padding:10px;color:#ffcb78;font-weight:700}
 #limbus-results-overlay .results-side{display:flex;flex-direction:column;gap:13px;min-width:0}
 #limbus-results-overlay .results-own{background:#30231b;border:1px solid #b48746;padding:12px}
 #limbus-results-overlay .results-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;max-height:48dvh;overflow:auto}
 #limbus-results-overlay .results-actor{display:flex;gap:9px;align-items:center;padding:8px;background:#29201b;min-width:0}
 #limbus-results-overlay .results-actor img{height:56px;width:56px;object-fit:cover;flex-shrink:0}
 #limbus-results-overlay .results-actor .results-initial{height:56px;width:56px;flex-shrink:0;background:#593f22;display:grid;place-items:center;color:#f9d19b}
 #limbus-results-overlay .results-actor-text{min-width:0;overflow-wrap:anywhere}
 #limbus-results-overlay .results-xp{color:#ffd076;font-weight:800}
 #limbus-results-overlay .results-bonus{font-size:12px;color:#aee6ad}
 #limbus-results-overlay .results-button{position:sticky;bottom:0;min-height:48px;background:#bc7e23;color:#170f07;border:2px solid #f5c77a;font:700 21px Arial;cursor:pointer;width:100%}
 #limbus-results-overlay .results-button:focus-visible{outline:3px solid #fff;outline-offset:2px}
 #limbus-results-overlay .results-title{color:#ffd076;font-size:28px;margin:0 0 12px}
 @media(max-width:650px){#limbus-results-overlay{padding:6px}#limbus-results-overlay .results-board{max-height:calc(100dvh - 12px);padding:10px}#limbus-results-overlay .results-layout{grid-template-columns:1fr;gap:8px}#limbus-results-overlay .results-mvp{min-height:150px}#limbus-results-overlay .results-mvp>img{max-height:23dvh}#limbus-results-overlay .results-mvp-label{font-size:27px}#limbus-results-overlay .results-list{max-height:27dvh}#limbus-results-overlay .results-actor img,#limbus-results-overlay .results-actor .results-initial{width:42px;height:42px}}
 `;
 function portrait(actor){const src=clean(actor?.portrait);return src?'<img src="'+escape(src)+'" alt="" onerror="this.style.display=\'none\'">':'<div class="results-initial">'+escape(clean(actor?.name).slice(0,1)||'?')+'</div>';}
 function ensure(){
  if(overlay||!document.body)return;
  const style=document.createElement('style');style.textContent=css;style.id='limbus-results-style';document.head.appendChild(style);
  overlay=document.createElement('div');overlay.id='limbus-results-overlay';overlay.hidden=true;overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-label','Resultados del combate');document.body.appendChild(overlay);overlay.addEventListener('keydown',event=>{const button=overlay.querySelector('button');if(event.key==='Tab'&&button){event.preventDefault();button.focus();}if(event.key==='Escape'&&button){event.preventDefault();button.click();}});
 }
 function card(actor,row){return '<div class="results-actor">'+portrait(actor)+'<div class="results-actor-text"><strong>'+escape(actor.name)+'</strong><div class="results-xp">+'+(Number(row?.xp)||0)+' EXP</div>'+(Number(row?.bonusXp)>0?'<div class="results-bonus">MVP +'+row.bonusXp+' EXP</div>':'')+'</div></div>';}
 function confirmed(id){try{return global.localStorage?.getItem('limbus-results:'+uid+':'+id)==='confirmed';}catch(_){return false;}}
 function hide(){if(timer)clearTimeout(timer);if(loadingTimer)clearTimeout(loadingTimer);timer=loadingTimer=null;if(overlay){overlay.hidden=true;overlay.replaceChildren();delete overlay.dataset.encounter;}previousFocus?.focus?.();previousFocus=null;}
 function finish(id){seen.add(id);try{global.localStorage?.setItem('limbus-results:'+uid+':'+id,'confirmed');}catch(_){}hide();}
 function pending(id){
  overlay.innerHTML='<section class="results-board"><p aria-live="polite">Los resultados todavía no están disponibles. Puedes continuar; las recompensas confirmadas se conservan.</p><button class="results-button" type="button">Continuar</button></section>';
  overlay.querySelector('button').addEventListener('click',()=>finish(id),{once:true});overlay.querySelector('button').focus();
 }
 function render(){
  const e=state,roster=Array.isArray(e?.resultRoster)?e.resultRoster:[];
  if(!roster.length){pending(clean(e?.encounterId));return;}
  const id=clean(e.xpAward?.encounterId||e.encounterId);
  if(!id||seen.has(id)||confirmed(id)||!['victory','defeat'].includes(clean(e.result)))return;
  const mvp=e.mvp||roster[0],award=Object.fromEntries((e.rewardRows||[]).map(row=>[row.id,row]));
  const mine=roster.find(x=>x.id==='player:'+myPlayerId);
  const mineRow=mine?award[mine.id]:null;
  const medal=e.result==='victory'?'VICTORIA':'DERROTA';
  const own=mine?card(mine,mineRow):'<div class="results-own">Resultados del encuentro · Vista del DM</div>';
  const hero=mvp.portrait?'<img src="'+escape(mvp.portrait)+'" alt="" onerror="this.style.display=\'none\'">':'';
  const board='<section class="results-board"><h2 class="results-title">'+medal+' · RESULTADOS</h2><div class="results-layout"><div class="results-mvp">'+hero+'<div class="results-mvp-label">MVP DE COMBATE</div><div class="results-mvp-name">'+escape(mvp.name||'Participante')+'</div></div><div class="results-side"><div class="results-own"><div> TU PERSONAJE</div>'+own+'</div><div>PARTICIPANTES</div><div class="results-list">'+roster.map(a=>card(a,award[a.id])).join('')+'</div><button class="results-button" type="button" id="limbus-results-confirm">CONFIRMAR</button></div></div></section>';
  overlay.innerHTML=board;
  overlay.querySelector('#limbus-results-confirm')?.addEventListener('click',()=>finish(id),{once:true});overlay.querySelector('button')?.focus();
 }
 function maybeStart(){
  if(!overlay)return;
  if(!state||instance!=='teatro'||state.phase!=='ENDED'){hide();return;}
  const id=clean(state.encounterId);
  if(!id||seen.has(id)||confirmed(id)||!['victory','defeat'].includes(clean(state.result))){hide();return;}
  if(overlay.dataset.encounter===id){if(!loadingTimer)render();return;}
  hide();previousFocus=document.activeElement;overlay.dataset.encounter=id;overlay.hidden=false;
  overlay.style.background='#000';overlay.innerHTML='<div role="status" aria-live="polite" tabindex="-1">Preparando resultados…</div>';overlay.firstElementChild.focus();
  loadingTimer=setTimeout(()=>{loadingTimer=null;if(overlay.dataset.encounter!==id||instance!=='teatro')return;render();overlay.style.background='rgba(0,0,0,.96)';},650);
 }
 function boot(){
  if(!global.firebase?.database||!global.firebase?.auth)return;
  ensure();db=global.firebase.database();
  global.firebase.auth().onAuthStateChanged(async user=>{
   const generation=++authGeneration;offState?.();offInstance?.();offState=offInstance=null;hide();state=null;instance='';seen=new Set();uid=user?.uid||'';myPlayerId='';
   if(!user)return;
   try{
    const players=(await db.ref('campaña/jugadores').once('value')).val()||{};
    if(generation!==authGeneration)return;
    myPlayerId=Object.keys(players).find(k=>players[k]?.uid===uid)||'';
    const stateRef=db.ref(STATUS),instanceRef=db.ref(INSTANCE);
    const stateHandler=s=>{if(generation!==authGeneration)return;state=s.val();maybeStart();},instanceHandler=s=>{if(generation!==authGeneration)return;instance=s.val();maybeStart();};
    const onError=()=>hide();
    stateRef.on('value',stateHandler,onError);instanceRef.on('value',instanceHandler,onError);
    offState=()=>stateRef.off('value',stateHandler);offInstance=()=>instanceRef.off('value',instanceHandler);
   }catch(_){hide();}
  });
 }
 if(global.document){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();}
})(typeof window!=='undefined'?window:globalThis);
