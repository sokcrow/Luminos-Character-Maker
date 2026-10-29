/* Approved DM roll surface. Existing modules own every roll and command. */
(function(global){
 'use strict';
 const doc=global.document;if(!doc?.body?.classList.contains('on-game-dashboard')||global.LuminousDmRollMenu)return;
 const $=id=>doc.getElementById(id);
 const node=(tag,cls,text)=>{const n=doc.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
 let menu,mode='player',compose,npc,inbox,results,status,modeTabs,history=new Map(),generation=0,unsub=[],profiles={};
 function feedback(text){if(status&&status.textContent!==text)status.textContent=text;}
 function bindControls(){
  const core=$('theatre-check-director'),host=$('dm-director-view-checks');if(!core||!host)return;
  if(!menu){
   menu=node('section','dm-roll-menu');menu.id='dm-roll-menu';
   const heading=node('header','roll-head');heading.append(node('small','','Mecánicas del DM'),node('h2','','Dirección de tiradas'),node('p','','Solicita una tirada, controla un NPC o dirige un enfrentamiento.'));
   modeTabs=node('nav','roll-mode-tabs');modeTabs.setAttribute('aria-label','Modo de tirada');modeTabs.setAttribute('role','tablist');
   for(const [id,title,copy]of [['player','Jugador','Solicitar una tirada'],['npc','NPC','Tirar como personaje del DM'],['opposed','Enfrentada','Retador contra retado']]){
    const tab=node('button','');tab.type='button';tab.dataset.rollMode=id;tab.setAttribute('role','tab');tab.append(node('span','',title),node('small','',copy));tab.onclick=()=>selectMode(id);modeTabs.appendChild(tab);
   }
   status=node('p','roll-status');status.setAttribute('role','status');
   menu.append(heading,modeTabs,status);host.appendChild(menu);menu.appendChild(core);
   core.classList.add('roll-core');compose=core.querySelector('.theatre-check-compose');inbox=core.querySelector('.theatre-check-inbox');
   const grid=core.querySelector('.theatre-check-director-workspace');grid.prepend(compose);grid.appendChild(inbox);
   const asideTabs=node('nav','roll-follow-tabs');asideTabs.setAttribute('aria-label','Seguimiento de tiradas');
   const pending=node('div','roll-pending');
   const list=$('theatre-check-request-list');pending.appendChild(list);inbox.prepend(pending);
   results=node('div','roll-results');results.hidden=true;results.setAttribute('aria-live','polite');inbox.appendChild(results);
   for(const [id,title]of [['pending','Pendientes'],['results','Resultados']]){
    const b=node('button','',title);b.type='button';b.dataset.rollFollow=id;b.setAttribute('aria-pressed',String(id==='pending'));
    if(id==='pending'){const count=$('theatre-check-pending-count');if(count)b.appendChild(count);}
    b.onclick=()=>{pending.hidden=id!=='pending';results.hidden=id!=='results';asideTabs.querySelectorAll('button').forEach(t=>t.setAttribute('aria-pressed',String(t===b)));};asideTabs.appendChild(b);
   }
   inbox.prepend(asideTabs);inbox.querySelector('h3')?.remove();
   const preview=compose.querySelector('.theatre-check-compose-preview');preview.classList.add('roll-summary');inbox.append(node('h3','','Resumen de la tirada'),preview);const coins=node('div','roll-coins');coins.setAttribute('aria-hidden','true');for(let i=0;i<5;i++)coins.appendChild(node('i','roll-coin'));inbox.appendChild(coins);
   const settings=node('details','roll-settings'),summary=node('summary','','Visibilidad y ajustes');settings.appendChild(summary);
   for(const id of ['theatre-check-x','theatre-check-threshold-visibility']){const field=$(id)?.closest('label');if(field)settings.appendChild(field);}
   compose.querySelector('.theatre-check-compose-grid').after(settings);
   const step=node('h3','','Quién va a tirar y qué debe resolver');compose.prepend(step);
   const labels={'theatre-check-target-player':'Personaje','theatre-check-kind':'Tipo de tirada','theatre-check-ability':'Característica','theatre-check-skill':'Habilidad','theatre-check-threshold':'Umbral opcional','theatre-check-modifier':'Condición','theatre-check-tip':'Motivo o indicación','theatre-check-x':'Ajuste X','theatre-check-threshold-visibility':'Visibilidad del umbral'};
   for(const[id,text]of Object.entries(labels)){const label=$(id)?.closest('label')?.querySelector('span');if(label)label.textContent=text;}
   translateOptions('theatre-check-kind',{ability:'Característica',save:'Salvación',skill:'Habilidad'});
   translateOptions('theatre-check-modifier',{neutral:'Neutral',advantage:'Ventaja',disadvantage:'Desventaja'});
   decorateParticipant('theatre-check-target-player');
   menu.addEventListener('change',refreshPortraits);
   renderHistory();
  }
  const found=$('theatre-npc-roll-director');
  if(found&&found!==npc){if(status.textContent==='Cargando los controles de tirada del NPC…')feedback('');npc=found;npc.classList.add('roll-npc-form');compose.after(npc);const preview=npc.querySelector('.theatre-npc-roll-preview');if(preview)inbox.appendChild(preview);const title=npc.querySelector('.theatre-npc-roll-title span');if(title)title.textContent='Tirada del NPC';translateOptions('theatre-npc-roll-kind',{ability:'Característica',save:'Salvación',skill:'Habilidad'});decorateParticipant('theatre-npc-roll-actor');}
  const selector=$('theatre-check-mode');if(selector)selector.closest('label').hidden=true;
  refreshPortraits();applyMode();
 }
 function decorateParticipant(id){const field=$(id)?.closest('label');if(!field||field.parentElement.classList.contains('roll-participant'))return;const wrapper=node('div','roll-participant wide');const portrait=node('img','roll-participant-portrait');portrait.alt='';field.before(wrapper);wrapper.append(portrait,field);}
 function refreshPortraits(){
  for(const[id,actor]of [['theatre-check-target-player',profiles[$('theatre-check-target-player')?.value]],['theatre-npc-roll-actor',global.LuminousCharacterManager?.getActor?.($('theatre-npc-roll-actor')?.value)?.actor]]){
   const image=$(id)?.closest('.roll-participant')?.querySelector('img');if(!image)continue;
   const url=global.LuminousDmTheatreWorkspace?.safeImage(global.LuminousTheatreInterventionUx?.iconFromActor(actor))||'Assets/Images/Buttons/Player.svg';
   if(image.getAttribute('src')!==url){image.src=url;image.onerror=()=>{image.onerror=null;image.src='Assets/Images/Buttons/Player.svg';};}
  }
 }
 function translateOptions(id,labels){for(const o of $(id)?.options||[])if(labels[o.value])o.textContent=labels[o.value];}
 function selectMode(next){
  if(next==='opposed'&&!$('theatre-check-mode')){feedback('Las tiradas enfrentadas se están cargando. Inténtalo de nuevo en un momento.');return;}
  mode=next;feedback('');
  const select=$('theatre-check-mode');if(select){select.value=mode==='opposed'?'opposed':'individual';select.dispatchEvent(new Event('change',{bubbles:true}));}
  applyMode();
 }
 function applyMode(){
  if(!menu)return;
  compose.hidden=mode==='npc';if(npc)npc.hidden=mode!=='npc';
  for(const b of modeTabs.querySelectorAll('button')){b.setAttribute('aria-selected',String(b.dataset.rollMode===mode));b.tabIndex=b.dataset.rollMode===mode?0:-1;}
  menu.dataset.mode=mode;
  const playerPreview=inbox.querySelector('.roll-summary'),npcPreview=inbox.querySelector('.theatre-npc-roll-preview');if(playerPreview)playerPreview.hidden=mode==='npc';if(npcPreview)npcPreview.hidden=mode!=='npc';
  const threshold=$('theatre-check-threshold');if(threshold)threshold.closest('label').hidden=mode==='opposed';
  if(mode==='npc'&&!npc)feedback('Cargando los controles de tirada del NPC…');
 }
 function renderHistory(){
  if(!results)return;results.replaceChildren();
  const rows=[...history.values()].sort((a,b)=>b.time-a.time).slice(0,30);
  if(!rows.length){results.appendChild(node('p','roll-empty','Sin resultados todavía. Las tiradas completadas aparecerán aquí.'));return;}
  for(const row of rows){const card=node('article','roll-result');card.append(node('strong','',row.name),node('span','',row.label));
   const number=Number.isFinite(row.total)?String(row.total):'Oculto';const outcome=row.outcome==='passed'?'Superado':row.outcome==='failed'?'Fallido':'';
   card.appendChild(node('b','',[number,outcome].filter(Boolean).join(' · ')));results.appendChild(card);
  }
 }
 function stopHistory(){generation++;for(const off of unsub.splice(0))off();history.clear();profiles={};refreshPortraits();renderHistory();}
 async function bindHistory(){
  stopHistory();const gen=generation,db=global.firebase?.database?.(),user=global.firebase?.auth?.().currentUser;if(!db||!user)return;
  try{
   const config=(await db.ref('campaña/config/dm_uid').once('value')).val();if(gen!==generation||(user.uid!==config&&user.uid!=='e9JwFZrtk6g8UMqq2Hf9EHVY7Ay1'))return;
   const room=global.LuminousTheatreCheckCoordinator?.roomKey?.()||'default';const children=new Map();
   const listen=(path,fn)=>{const ref=db.ref(path).limitToLast(30);const on=snap=>{if(gen===generation)fn(snap.val()||{});};ref.on('value',on,()=>{if(gen===generation)feedback('No se pudieron cargar todos los resultados. Revisa la conexión y los permisos.');});const off=()=>ref.off('value',on);unsub.push(off);return off;};
   const names=new Map();
   const playersRef=db.ref('campaña/jugadores');const onPlayers=snap=>{
    if(gen!==generation)return;const players=Object.values(snap.val()||{}).filter(p=>p?.uid);profiles=Object.fromEntries(players.map(p=>[p.uid,p]));refreshPortraits();
    const uids=new Set(players.map(p=>p.uid));for(const p of players)names.set(p.uid,p.characterName||p.character_name||p.nombre||p.name||'Jugador');
    for(const[uid,off]of children)if(!uids.has(uid)){off();children.delete(uid);for(const key of history.keys())if(key.startsWith('player:'+uid+':'))history.delete(key);}
    for(const p of players)if(!children.has(p.uid))children.set(p.uid,listen('theatre_check_results/'+p.uid,records=>{
     for(const key of history.keys())if(key.startsWith('player:'+p.uid+':'))history.delete(key);
     for(const[id,r]of Object.entries(records))if((r.roomKey||'default')===room)history.set('player:'+p.uid+':'+id,{name:names.get(p.uid)||'Jugador',label:r.label||'Check',total:typeof r.total==='number'?r.total:null,outcome:r.outcome,time:r.clientCompletedAt||r.completedAt||0});renderHistory();
    }));renderHistory();
   };
   playersRef.on('value',onPlayers,()=>{if(gen===generation)feedback('No se pudieron cargar los jugadores para consultar sus resultados.');});unsub.push(()=>playersRef.off('value',onPlayers));
   const path=global.LuminousTheatreRolls?.resolveRollPath?.(doc.body.dataset.theatreRoomId||'default');if(path)listen(path,records=>{
    for(const key of history.keys())if(key.startsWith('shared:'))history.delete(key);
    for(const[id,r]of Object.entries(records))history.set('shared:'+id,{name:r.roller?.name||'Tirada',label:r.check?.label||r.label||'Tirada de monedas',total:typeof r.total==='number'?r.total:null,outcome:r.check?.outcome||r.publicOutcome,time:r.clientCreatedAt||r.createdAt||0});renderHistory();
   });
  }catch(_){if(gen===generation)feedback('No se pudieron cargar los resultados. Revisa la conexión y los permisos.');}
 }
 doc.addEventListener('click',event=>{if(event.target.closest('#theatre-check-request-list button'))selectMode('player');});
 doc.addEventListener('luminous:theatre-check-mode',event=>{if(mode!=='npc'){mode=event.detail?.mode==='opposed'?'opposed':'player';applyMode();}});
 function start(){const host=$('dm-director-view-checks');if(!host)return;bindControls();new MutationObserver(bindControls).observe(host,{childList:true,subtree:true});
  host.addEventListener('keydown',event=>{if(!event.target.closest('.roll-mode-tabs'))return;if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const tabs=[...modeTabs.querySelectorAll('button')],index=tabs.indexOf(doc.activeElement),next=event.key==='Home'?0:event.key==='End'?2:(index+(event.key==='ArrowRight'?1:2))%3;selectMode(tabs[next].dataset.rollMode);tabs[next].focus();});
  global.firebase?.auth?.().onAuthStateChanged(bindHistory);global.addEventListener('luminous:player-instance-changed',bindHistory);
 }
 global.LuminousDmRollMenu=Object.freeze({selectMode});if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',start,{once:true});else start();
})(window);
