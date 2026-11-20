/* Sok's approved Director surface; existing controls remain the authority for
   casting, visibility, expressions and publishing. No prototype game data runs. */
(function(global){
 'use strict';
 const doc=global.document;
 function mount(){
  if(!global.LuminousDmTheatreWorkspace||!global.LuminousDirectorTemplates||doc.getElementById('dm-canonical-director'))return;
  const menu=doc.querySelector('#modulo-teatro > .theatre-dm-menu');
  const native=doc.getElementById('theatre-director-panel');
  const root=doc.createElement('dialog');root.id='dm-canonical-director';root.setAttribute('aria-label','Director de Teatro');
  root.innerHTML=global.LuminousDirectorTemplates.theatre;
  doc.body.appendChild(root);
  const $=id=>root.querySelector('#'+id);
  const workspace=global.LuminousDmTheatreWorkspace;
  const stageSlot=native.querySelector('.dm-director-stage-slot');
  root.querySelector('.scene-banner').prepend(stageSlot);
  const placeholder=$('theatre-log-container');
  placeholder.replaceWith(doc.getElementById('theatre-log-container'));
  const utility=doc.createElement('dialog');utility.id='dm-canonical-utility';utility.className='canonical-utility';
  utility.setAttribute('aria-label','Herramientas de escena');
  const header=doc.createElement('header');header.innerHTML='<h2>Herramientas de escena</h2><button type="button" aria-label="Cerrar herramientas">×</button>';
  header.querySelector('button').onclick=()=>utility.close();utility.appendChild(header);
  utility.appendChild(native);doc.body.appendChild(utility);
  const castView=native.querySelector('#dm-director-view-cast');
  const libraryPane=doc.createElement('section');libraryPane.setAttribute('aria-label','Biblioteca de personajes');
  while(castView.firstChild)libraryPane.appendChild(castView.firstChild);
  const scenePane=doc.createElement('section');scenePane.setAttribute('aria-label','Personajes en escena');scenePane.appendChild(doc.getElementById('live-actors-list'));
  const castTabs=doc.createElement('nav');castTabs.className='canonical-cast-tabs';castTabs.setAttribute('aria-label','Administrar elenco');
  function selectCastPane(library){
   scenePane.hidden=library;libraryPane.hidden=!library;
   castTabs.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String((b.dataset.castPane==='library')===library)));
  }
  for(const [label,library] of [['En escena',false],['Biblioteca',true]]){
   const tab=doc.createElement('button');tab.type='button';tab.textContent=label;tab.dataset.castPane=library?'library':'scene';
   tab.onclick=()=>selectCastPane(library);castTabs.appendChild(tab);
  }
  const sceneHelp=doc.createElement('p');sceneHelp.className='dm-director-hint';sceneHelp.textContent='Estos personajes ya están disponibles para escribir. Mostrar u ocultar solo cambia su presencia en el escenario.';scenePane.prepend(sceneHelp);
  selectCastPane(false);castView.append(castTabs,scenePane,libraryPane);
  const addActors=doc.createElement('button');addActors.type='button';addActors.id='canonical-add-actors';addActors.className='primary-btn canonical-add-actors';addActors.textContent='Añadir desde biblioteca';
  addActors.onclick=()=>{tools('cast');selectCastPane(true);};
  const castHelp=doc.createElement('p');castHelp.className='hint-small';castHelp.textContent='Añade actores desde tu biblioteca y pulsa su tarjeta para escribir. Jugadores y NPC se muestran por separado.';
  root.querySelector('.left-col').prepend(addActors,castHelp);
  const editorSummary=doc.querySelector('#theatre-actor-studio-loader>summary');if(editorSummary)editorSummary.textContent='Editor de personajes';
  const notes=doc.createElement('textarea');notes.setAttribute('aria-label','Notas del DM en este dispositivo');notes.placeholder='Notas privadas de esta escena';
  const context=global.LuminousCombatContext?.id||'default';const notesKey='limbus.director.notes.'+context;
  try{notes.value=global.localStorage.getItem(notesKey)||'';}catch(_){}
  notes.oninput=()=>{try{global.localStorage.setItem(notesKey,notes.value);}catch(_){status('No se pudieron guardar las notas en este dispositivo.');}};
  utility.appendChild(notes);notes.hidden=true;
  const hint=doc.createElement('p');hint.setAttribute('role','status');root.querySelector('.left-col').appendChild(hint);
  function status(message){hint.textContent=message;}
  function close(){
   if(utility.open)utility.close();
   const composer=doc.getElementById('dm-theatre-composer-modal');if(composer?.open)composer.close();
   if(root.open)root.close();menu.open=false;
   menu.querySelector('summary')?.focus({preventScroll:true});
  }
  function sync(){
   if(menu.open){if(!root.open)root.showModal();}
   else if(root.open)root.close();
  }
  root.addEventListener('cancel',event=>{event.preventDefault();close();});
  root.addEventListener('close',()=>{if(!root.open)menu.open=false;});
  root.addEventListener('click',event=>{if(event.target===root)close();});
  menu.addEventListener('toggle',sync);
  root.querySelector('.canonical-close').onclick=close;
  function mobile(view){
   $('layout').dataset.mobileView=view;
   root.querySelectorAll('[data-mobile-tab]').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.mobileTab===view)));
  }
  root.querySelectorAll('[data-mobile-tab]').forEach(b=>b.onclick=()=>mobile(b.dataset.mobileTab));
  const sceneView=doc.getElementById('dm-director-view-scenes');
  const sceneGroups={};
  for(const [group,ids] of Object.entries({background:['theatre-background-input'],scene:['theatre-scenario-name','theatre-location-input','theatre-scenario-tags']})){
   const section=doc.createElement('section');section.dataset.sceneFields=group;
   const heading=doc.createElement('h3');heading.textContent=group==='background'?'Fondo del escenario':'Título y lugar';section.appendChild(heading);
   for(const id of ids){const input=doc.getElementById(id);if(!input)continue;const label=doc.createElement('label');label.textContent=({ 'theatre-background-input':'Imagen del fondo (URL)','theatre-scenario-name':'Título','theatre-location-input':'Lugar','theatre-scenario-tags':'Etiquetas de escenario'})[id];label.appendChild(input);section.appendChild(label);}
   sceneView.appendChild(section);sceneGroups[group]=section;
  }
  const applyScene=doc.getElementById('btn-update-scene');
  const applyRow=doc.createElement('div');applyRow.className='canonical-scene-apply';applyScene.textContent='Aplicar cambios a la escena';applyRow.appendChild(applyScene);sceneView.appendChild(applyRow);
  const checksButton=doc.createElement('button');checksButton.type='button';checksButton.className='tool-item';checksButton.dataset.tool='checks';checksButton.textContent='Checks y tiradas';checksButton.onclick=()=>tools('checks');root.querySelector('.tool-list').prepend(checksButton);
  function tools(view){
   notes.hidden=true;native.hidden=false;
   const route=view==='background'||view==='scene'?'scenes':view;
   workspace.activate(route);header.querySelector('h2').textContent=({cast:'Gestionar elenco',scenes:'Biblioteca de escenarios',background:'Fondo del escenario',scene:'Título y lugar',settings:'Presentación y ritmo',checks:'Checks y tiradas'})[view];
   native.querySelector('.dm-director-cast-pane').hidden=false;
   native.dataset.canonicalView=route;utility.dataset.toolView=view;
   if(route==='scenes'){
    for(const child of sceneView.children)child.hidden=view!=='scenes' && child!==sceneGroups[view] && child!==applyRow;
    if(view==='scenes')Object.values(sceneGroups).forEach(section=>section.hidden=false);
   }
   if(view==='cast')selectCastPane(false);
   if(!utility.open)utility.showModal();
  }
  $('filterBtn').onclick=()=>tools('cast');$('sceneLibraryBtn').onclick=()=>tools('scenes');$('settingsBtn').onclick=()=>tools('settings');
  $('playSceneBtn').onclick=close;
  root.querySelectorAll('[data-step]').forEach(b=>b.onclick=()=>{
   if(b.dataset.step==='actors')mobile('actors');
   else if(b.dataset.step==='write')workspace.openComposer();else close();
  });
  const quickActions=root.querySelector('.action-grid');
  for(const action of quickActions.querySelectorAll('[data-action]')){
   const type=action.dataset.action;
   if(!['ambience','narration','action'].includes(type)){action.remove();continue;}
   if(type==='ambience'){const label=action.querySelector('.act-name');if(label)label.textContent='Música';action.setAttribute('aria-label','Música');}
  }
  const speaker=doc.getElementById('theatre-speaker-select');
  $('addDialogueBtn').onclick=$('composeHintBtn').onclick=()=>workspace.openComposer();
  root.querySelectorAll('[data-action]').forEach(b=>b.onclick=()=>{
   if(b.dataset.action==='ambience')global.LuminousAudio?.openOptions();
   else{
    workspace.openComposer(b.dataset.action==='narration'?'narrador':undefined);
    const type=doc.getElementById('dm-tipo-dialogo-select');
    if(!Array.from(type.options).some(o=>o.value==='actuar'))type.add(new Option('Acción','actuar'));
    type.value=b.dataset.action==='narration'?'narracion':'actuar';
   }
  });
  root.querySelectorAll('[data-tool]').forEach(b=>b.onclick=async()=>{
   const tool=b.dataset.tool;
   if(tool==='actors')tools('cast');
   else if(tool==='background'||tool==='scene'||tool==='checks')tools(tool);
   else if(tool==='notes'){
    header.querySelector('h2').textContent='Notas del DM · este dispositivo';native.hidden=true;notes.hidden=false;utility.dataset.toolView='notes';utility.showModal();notes.focus();
   }else if(tool==='clear'&&global.confirm('¿Eliminar el registro de Teatro de este encuentro?')){
    try{const path=global.LuminousTheatreState.getPaths().log;await global.firebase.database().ref(path).remove();status('Registro eliminado.');}
    catch(_){status('No se pudo eliminar el registro. Revisa la conexión y los permisos.');}
   }
  });
  $('helpBtn').onclick=()=>status('Elige un personaje para escribir. Añadir desde biblioteca carga personajes para escribir; Gestionar elenco permite mostrarlos, ocultarlos o retirarlos. Ver escena vuelve al visor.');
  $('saveBtn').onclick=()=>{
   const blob=new Blob([doc.getElementById('theatre-log-container').innerText],{type:'text/plain;charset=utf-8'});
   const url=URL.createObjectURL(blob),a=doc.createElement('a');a.href=url;a.download='limbus-teatro.txt';a.click();global.setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  const log=doc.getElementById('theatre-log-container');
  for(const [id,key] of [['showPortraitsToggle','portraits'],['showNamesToggle','names'],['showActionsToggle','actions']]){
   $(id).onchange=()=>{log.dataset[key]=String($(id).checked);};
  }
  let autoScroll=true;$('autoScrollToggle').onchange=()=>{autoScroll=$('autoScrollToggle').checked;log.dataset.autoScroll=String(autoScroll);};
  new MutationObserver(()=>{if(autoScroll){const scroll=log.querySelector('.dialogue-scroll-area');if(scroll)scroll.scrollTop=scroll.scrollHeight;}}).observe(log,{childList:true,subtree:true});
  let actors={},sort=false,sceneInputsInitialized=false;
  function actorImage(id,actor){return workspace.resolveActorIcon(id,actor)||'Assets/Images/Buttons/Player.svg';}
  function render(){
   const players=[],npcs=[];const query=$('searchActors').value.trim().toLocaleLowerCase();
   for(const option of speaker.options){
    if(option.value==='narrador')continue;
    const actor=actors[option.value];if(!actor)continue;
    (workspace.isPlayerActor(option.value,actor)?players:npcs).push({id:option.value,name:workspace.resolveActorName(option.value,actor),actor});
   }
   $('playerCount').textContent=String(players.length);$('npcCount').textContent=String(npcs.length);
   for(const [items,container,isPlayer] of [[players,$('playerGrid'),true],[npcs,$('npcGrid'),false]]){
    container.replaceChildren();
    if(sort)items.sort((a,b)=>a.name.localeCompare(b.name,'es'));
    for(const item of items.filter(x=>isPlayer||x.name.toLocaleLowerCase().includes(query))){
     const button=doc.createElement('button');button.type='button';button.className='character'+(isPlayer?' player':'');button.dataset.actorId=item.id;
     button.setAttribute('aria-label','Hablar como '+item.name);
     const image=doc.createElement('img');image.className='avatar';image.src=actorImage(item.id,item.actor);image.alt='';image.onerror=()=>{image.onerror=null;image.src='Assets/Images/Buttons/Player.svg';};
     const label=doc.createElement('span');label.className='label';label.textContent=item.name;button.append(image,label);
     button.onclick=()=>workspace.openComposer(item.id);container.appendChild(button);
    }
    if(!container.childElementCount){const p=doc.createElement('p');p.className='hint-small';p.textContent=isPlayer?'No hay jugadores en el elenco.':'No hay personajes que coincidan. Añádelos desde Gestionar elenco.';container.appendChild(p);}
   }
  }
  $('searchActors').oninput=render;$('sortBtn').onclick=()=>{sort=!sort;$('sortBtn').setAttribute('aria-pressed',String(sort));render();};
  new MutationObserver(render).observe(speaker,{childList:true,subtree:true});
  const scenePath=global.LuminousTheatreState?.getPaths?.().scene||'campaña/estado_mundo/escena_actual';
  global.firebase?.database?.().ref(scenePath).on('value',snapshot=>{
   const scene=snapshot.val()||{};actors=scene.actores||{};render();
   if(!sceneInputsInitialized){
    sceneInputsInitialized=true;
    for(const [id,value] of Object.entries({'theatre-background-input':scene.fondo,'theatre-scenario-name':scene.nombre,'theatre-location-input':scene.locacion,'theatre-scenario-tags':(scene.sub_etiquetas||[]).join(', '),'theatre-scenario-region':scene.region||scene.seccion||scene.capitulo,'theatre-scenario-category':scene.categoria})){
     const input=doc.getElementById(id);if(input&&!input.value)input.value=value||'';
    }
   }
   $('sceneTitle').textContent=scene.nombre||scene.locacion||'Sin escenario';
   $('sceneLocation').textContent=scene.locacion?'Lugar · '+scene.locacion:'';
  });
  utility.addEventListener('click',event=>{if(event.target===utility)utility.close();});
  // Reuse the publishing form in the prototype's independent portrait composer.
  const modal=doc.getElementById('dm-theatre-composer-modal');
  modal.classList.add('composer-dialog');
  const composeLayout=doc.createElement('div');composeLayout.className='composer-layout';
  const portrait=doc.createElement('aside');portrait.className='composer-portrait-zone';
  const portraitImage=doc.createElement('img');portraitImage.className='composer-big-portrait';portraitImage.alt='Retrato del personaje';portrait.appendChild(portraitImage);
  const caption=doc.createElement('div');caption.className='composer-character-caption';const name=doc.createElement('h3');caption.appendChild(name);portrait.appendChild(caption);
  const content=doc.createElement('div');content.className='composer-content';while(modal.firstChild)content.appendChild(modal.firstChild);
  const composerHeader=content.querySelector('.dm-theatre-composer-head');composerHeader.classList.add('composer-top');
  const closeComposer=composerHeader.querySelector('button');closeComposer.className='icon-btn close-btn';closeComposer.textContent='×';closeComposer.setAttribute('aria-label','Cerrar compositor');
  const nativeComposer=content.querySelector('.theatre-dm-composer');
  const selectorRow=nativeComposer.querySelector('.theatre-dm-composer-selects');selectorRow.classList.add('form-grid');
  const advanced=doc.createElement('details');advanced.className='composer-speaker-options';const summary=doc.createElement('summary');summary.textContent='Personaje y tipo de intervención';advanced.appendChild(summary);
  for(const [id,label] of [['theatre-speaker-select','Personaje'],['dm-tipo-dialogo-select','Tipo'],['theatre-expression-select','Expresión'],['theatre-language-select','Idioma']]){
   const select=content.querySelector('#'+id);if(!select)continue;
   const field=doc.createElement('label');field.className='form-field';field.appendChild(doc.createTextNode(label));select.classList.add('field-control');field.appendChild(select);
   (id==='theatre-speaker-select'||id==='dm-tipo-dialogo-select'?advanced:selectorRow).appendChild(field);
  }
  selectorRow.after(advanced);
  const textarea=content.querySelector('#theatre-dialogue-input');textarea.classList.add('field-control','input-textarea');
  const footer=doc.createElement('div');footer.className='composer-footer';
  const cancel=doc.createElement('button');cancel.type='button';cancel.className='muted-btn';cancel.textContent='Cancelar';cancel.onclick=()=>modal.close();
  const retire=doc.createElement('button');retire.type='button';retire.className='muted-btn';retire.id='composer-retire-actor';retire.textContent='Retirar del elenco';
  const retireStatus=doc.createElement('p');retireStatus.setAttribute('role','status');retireStatus.className='hint-small';
  retire.onclick=()=>{
   const id=speaker.value;
   const control=[...doc.querySelectorAll('#live-actors-list [data-actor-id]')].find(card=>card.dataset.actorId===id)?.querySelector('.btn-remove');
   if(!control||control.disabled){retireStatus.textContent='Este personaje ya no está disponible o tiene un cambio pendiente.';return;}
   retire.disabled=true;retire.dataset.pendingActor=id;retireStatus.textContent='';control.click();
  };
  doc.addEventListener('luminous:theatre-retire-result',event=>{
   if(event.detail.actorId!==retire.dataset.pendingActor)return;
   retire.disabled=false;delete retire.dataset.pendingActor;
   if(event.detail.success){if(nativeComposer.dataset.actorId===event.detail.actorId)modal.close();}
   else if(!event.detail.cancelled)retireStatus.textContent='No se pudo retirar el personaje. Revisa la conexión y los permisos.';
  });
  footer.appendChild(retire);nativeComposer.appendChild(retireStatus);
  const send=content.querySelector('#btn-send-dialogue');send.classList.add('primary-btn');send.textContent='Enviar';footer.append(cancel,send);nativeComposer.appendChild(footer);
  composeLayout.append(portrait,content);modal.appendChild(composeLayout);
  function updatePortrait(){retire.hidden=speaker.value==='narrador'||!actors[speaker.value];const actor=actors[speaker.value]||{};portraitImage.src=actorImage(speaker.value,actor);name.textContent=workspace.resolveActorName(speaker.value,actor);const title=composerHeader.querySelector('h3');if(title.textContent==='Escribir intervención')title.textContent='Nueva intervención';}
  speaker.addEventListener('change',updatePortrait);new MutationObserver(updatePortrait).observe(modal,{attributes:true,attributeFilter:['open']});
  doc.addEventListener('luminous:theatre-portraits-changed',()=>{render();updatePortrait();});
  sync();render();
  global.LuminousCanonicalDirector=Object.freeze({open:()=>{menu.open=true;sync();},close,mobile,tools});
 }
 if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})(window);
