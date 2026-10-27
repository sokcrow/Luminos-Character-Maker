(function(global){
 'use strict';
 const API=()=>global.LuminousSessionMvpRuntime;
 const clean=v=>String(v??'');
 const escape=v=>clean(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const style=`
 #limbus-session-mvp-action{position:fixed;bottom:max(16px,env(safe-area-inset-bottom));right:16px;z-index:2150000;background:#291c10;color:#f4cb80;border:1px solid #b78b40;min-height:44px;padding:9px 16px;cursor:pointer;font-weight:700}
 #limbus-session-mvp-shade{position:fixed;inset:0;z-index:2150001;background:rgba(0,0,0,.85);display:grid;place-items:center;padding:16px;box-sizing:border-box}
 #limbus-session-mvp-shade[hidden],#limbus-session-mvp-action[hidden]{display:none}\n #limbus-session-mvp-dialog{width:min(760px,100%);max-height:min(90dvh,900px);overflow:auto;overscroll-behavior:contain;background:linear-gradient(155deg,#302116,#100f12);border:2px solid #ae7931;color:#f8ead8;box-shadow:0 16px 65px #000;padding:clamp(12px,3vw,28px);box-sizing:border-box;font:16px/1.4 Arial,sans-serif}
 #limbus-session-mvp-dialog h2{color:#ffd284;font-size:clamp(23px,4vw,34px);margin:0 0 12px}
 #limbus-session-mvp-dialog p{margin:8px 0 14px}
 #limbus-session-mvp-dialog button{border:1px solid #b99053;background:#45301a;color:#ffe4ac;min-height:44px;padding:10px 14px;cursor:pointer;font:inherit}
 #limbus-session-mvp-dialog button:disabled{opacity:.43;cursor:not-allowed}
 #limbus-session-mvp-dialog .mvp-actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:15px}
 #limbus-session-mvp-dialog .mvp-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,210px),1fr));gap:10px}
 #limbus-session-mvp-dialog .mvp-card{border:1px solid #634b2c;background:#221914;display:flex;align-items:center;gap:9px;padding:9px;min-width:0}
 #limbus-session-mvp-dialog .mvp-card img{width:52px;height:52px;object-fit:cover;flex-shrink:0}
 #limbus-session-mvp-dialog .mvp-card span{overflow-wrap:anywhere}
 #limbus-session-mvp-dialog .mvp-primary{background:#b27a25;color:#130b04;font-weight:bold;border-color:#f1ce82}
 #limbus-session-mvp-dialog .mvp-muted{opacity:.7;font-size:13px}
 #limbus-session-mvp-dialog .mvp-error{color:#ff9b8d;white-space:pre-wrap}
 @media(max-width:600px){#limbus-session-mvp-shade{padding:7px}#limbus-session-mvp-dialog{max-height:calc(100dvh - 14px);padding:13px}#limbus-session-mvp-dialog .mvp-grid{grid-template-columns:repeat(2,minmax(0,1fr))}#limbus-session-mvp-dialog .mvp-card{flex-wrap:wrap}}
 `;
 let db,uid='',playerId='',dm=false,current=null,closedId='',dialog,shade,action,roster=[],selected=new Set(),error='';
 const renderPortrait=(c)=>c.portrait?'<img src="'+escape(c.portrait)+'" alt="" loading="lazy" onerror="this.style.display=\'none\'">':'';
 function bindButton(button,handler){button.addEventListener('click',()=>Promise.resolve().then(handler).catch(e=>{error=String(e?.message||e);render();}));}
 function ensure(){
  if(!global.document?.body)return false;
  if(!global.document.getElementById('limbus-session-mvp-style')){const s=document.createElement('style');s.id='limbus-session-mvp-style';s.textContent=style;document.head.appendChild(s);}
  if(!action){action=document.createElement('button');action.id='limbus-session-mvp-action';action.type='button';action.textContent='MVP DE SESIÓN';action.hidden=true;document.body.appendChild(action);bindButton(action,openSetup);}
  if(!shade){shade=document.createElement('div');shade.id='limbus-session-mvp-shade';shade.hidden=true;shade.setAttribute('role','presentation');dialog=document.createElement('section');dialog.id='limbus-session-mvp-dialog';dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');dialog.setAttribute('aria-label','MVP de sesión');shade.appendChild(dialog);document.body.appendChild(shade);}
  return true;
 }
 async function openSetup(){
  if(!dm)return;
  const records=(await db.ref('campaña/jugadores').once('value')).val()||{};
  roster=API().candidateList(records);selected=new Set(roster.map(row=>row.id));error='';render('setup');
 }
 function close(){closedId=current?.id||'';shade.hidden=true;}
 function modal(title,body,buttons=[]){
  ensure();shade.hidden=false;dialog.replaceChildren();
  const h=document.createElement('h2');h.textContent=title;dialog.append(h);
  const content=document.createElement('div');content.innerHTML=body;dialog.append(content);
  if(error){const p=document.createElement('p');p.className='mvp-error';p.textContent=error;dialog.append(p);}
  const bar=document.createElement('div');bar.className='mvp-actions';dialog.append(bar);
  buttons.forEach(b=>{const el=document.createElement('button');el.type='button';el.textContent=b.label;if(b.primary)el.className='mvp-primary';el.disabled=Boolean(b.disabled);bar.append(el);bindButton(el,b.run);});
  return content;
 }
 async function finish(){await API().award({db,uid});error='';}
 function render(mode){
  if(!ensure()||!API())return;
  action.hidden=!dm||Boolean(current&&['voting','coins','awarding'].includes(current.phase));
  if(mode==='setup'){
   const body='<p>Selecciona los jugadores activos de esta sesión (mínimo dos). Los autovotos están prohibidos.</p><div class="mvp-grid">'+roster.map(c=>'<label class="mvp-card"><input type="checkbox" data-candidate="'+escape(c.id)+'" '+(selected.has(c.id)?'checked':'')+'>'+renderPortrait(c)+'<span>'+escape(c.name)+'</span></label>').join('')+'</div>';
   const el=modal('VOTACIÓN · MVP DE SESIÓN',body,[{label:'Cancelar',run:close},{label:'Iniciar votación',primary:true,run:async()=>{const ids=[...el.querySelectorAll('[data-candidate]:checked')].map(x=>x.dataset.candidate);await API().start({db,uid,selectedIds:ids});error='';}}]);return;
  }
  if(!current||!['voting','coins','awarding','completed'].includes(current.phase)||current.phase==='completed'&&current.id===closedId){shade.hidden=true;return;}
  const c=current.candidates||{},ids=Object.keys(c),mine=Boolean(c[playerId]&&c[playerId].uid===uid);
  if(current.phase==='voting'){
   const body='<p>Elige a otro participante. Tu personaje no puede recibir tu voto.</p><div class="mvp-grid">'+ids.map(id=>'<div class="mvp-card">'+renderPortrait(c[id])+'<span>'+escape(c[id].name)+'</span><button type="button" data-vote="'+escape(id)+'" '+(!mine||id===playerId||current.votes?.[playerId]?'disabled':'')+'>Votar</button></div>').join('')+'</div><p class="mvp-muted">Votos registrados: '+Object.keys(current.votes||{}).length+' / '+ids.length+'</p>';
   const el=modal('MVP DE SESIÓN · VOTACIÓN',body,dm?[{label:'Cerrar votación',primary:true,run:async()=>{await API().close({db,uid});error='';}}]:[{label:'Ocultar',run:close}]);
   el.querySelectorAll('[data-vote]').forEach(btn=>bindButton(btn,async()=>{await API().vote({db,uid,voterId:playerId,candidateId:btn.dataset.vote});error='';}));return;
  }
  if(current.phase==='coins'){
   const active=current.tiedIds||[],clicked=current.coinClicks||{},round=current.coinRound;
   const body='<p>Ronda '+round+'. Cada candidato empatado debe pulsar su moneda. Cada cara tiene 50% de probabilidad; no se admiten modificadores de suerte.</p><div class="mvp-grid">'+active.map(id=>'<div class="mvp-card"><span>'+escape(c[id]?.name||id)+'</span><button data-coin="'+escape(id)+'" '+(!mine||id!==playerId||clicked[id]?'disabled':'')+'>'+(clicked[id]?'Moneda lanzada':'🪙 Lanzar moneda')+'</button></div>').join('')+'</div>';
   const allClicked=active.every(id=>clicked[id]===round),el=modal('MVP DE SESIÓN · DESEMPATE',body,dm?[{label:'Resolver monedas',primary:true,disabled:!allClicked,run:async()=>{await API().resolveCoins({db,uid});error='';}}]:[{label:'Ocultar',run:close}]);
   el.querySelectorAll('[data-coin]').forEach(btn=>bindButton(btn,async()=>{await API().clickCoin({db,uid,voterId:playerId});error='';}));return;
  }
  const winner=c[current.winnerId],reward=current.rewardXp||API().xpForLevel(winner?.level);
  const body='<div class="mvp-card">'+renderPortrait(winner||{})+'<strong>'+escape(winner?.name||'Ganador')+'</strong></div><p><strong>+'+reward+' XP</strong> · Nivel '+(winner?.level||1)+'</p>'+(current.phase==='completed'?'<p>Recompensa entregada.</p>':'<p>El DM debe confirmar la entrega de experiencia.</p>');
  modal('MVP DE SESIÓN · GANADOR',body,current.phase==='awarding'&&dm?[{label:'Entregar EXP',primary:true,run:finish}]:[{label:'Confirmar',primary:true,run:close}]);
 }
 async function boot(){
  if(!ensure()||!global.firebase?.database||!global.firebase?.auth||!API())return;
  db=global.firebase.database();
  global.firebase.auth().onAuthStateChanged(async user=>{
   if(!user)return;
   uid=user.uid;let cfg='';
   try{cfg=(await db.ref('campaña/config/dm_uid').once('value')).val()||'';}catch(_){}
   dm=uid===cfg||uid==='e9JwFZrtk6g8UMqq2Hf9EHVY7Ay1';
   const players=(await db.ref('campaña/jugadores').once('value')).val()||{};
   playerId=Object.entries(players).find(([,p])=>p?.uid===uid)?.[0]||'';
   db.ref(API().PATH).on('value',snap=>{const oldId=current?.id;current=snap.val();if(oldId!==current?.id)closedId='';render();});
   render();
  });
 }
 if(global.document){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();}
})(typeof window!=='undefined'?window:globalThis);
