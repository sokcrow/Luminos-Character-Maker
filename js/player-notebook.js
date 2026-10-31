(function (global) {
  'use strict';
  const doc=global.document, root=doc?.getElementById('player-notebook');
  if(!root)return;
  const state={playerId:'',uid:'',notes:{},selected:null,dirty:false,busy:false,draft:null};
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const key=()=>`luminous:notebook-draft:${state.uid}:${state.playerId}`;
  function message(text){root.querySelector('[role=status]').textContent=text;}
  function backup(){if(!state.playerId||!state.uid)return;try{global.localStorage.setItem(key(),JSON.stringify({selected:state.selected,draft:state.draft}));}catch(_){}}
  function clearBackup(){try{global.localStorage.removeItem(key());}catch(_){}}
  function collect(){
    state.draft={...(state.draft||{}),title:root.querySelector('[data-note-title]').value,subtitle:root.querySelector('[data-note-subtitle]').value,
      sections:[...root.querySelectorAll('[data-note-section]')].map(row=>({heading:row.querySelector('input').value,body:row.querySelector('textarea').value}))};
  }
  function allowedToLeave(){return !state.busy&&(!state.dirty||global.confirm('Tienes cambios sin guardar. ¿Descartarlos y cambiar de nota?'));}
  function edit(id){
    if(!allowedToLeave())return;
    clearBackup(); state.selected=id;state.dirty=false;
    state.draft=id?JSON.parse(JSON.stringify(state.notes[id])):{title:'',subtitle:'',sections:[{heading:'',body:''}]};render();
  }
  function renderList(){
    const list=root.querySelector('[data-note-list]');
    list.innerHTML=Object.entries(state.notes).sort((a,b)=>(b[1].updatedAt||0)-(a[1].updatedAt||0)).map(([id,n])=>`<button type="button" data-note-open="${esc(id)}" aria-current="${id===state.selected}">${esc(n.title||'Sin título')}</button>`).join('')||'<p>Aún no tienes notas guardadas.</p>';
  }
  function render(){
    const n=state.draft||{title:'',subtitle:'',sections:[{heading:'',body:''}]};
    root.innerHTML=`<aside><button type="button" data-note-new>Nueva nota</button><label>Buscar notas<input type="search" data-note-search placeholder="Título o contenido"></label><div data-note-list></div></aside>
    <form class="player-note-editor"><label>Título<input data-note-title maxlength="160" required value="${esc(n.title)}"></label><label>Subtítulo<input data-note-subtitle maxlength="240" value="${esc(n.subtitle)}"></label><div data-note-sections>${(n.sections||[]).map((s,i)=>`<fieldset data-note-section><legend>Sección ${i+1}</legend><label>Encabezado<input maxlength="160" value="${esc(s.heading)}"></label><label>Contenido<textarea maxlength="20000">${esc(s.body)}</textarea></label><button type="button" data-note-remove="${i}">Quitar sección ${i+1}</button></fieldset>`).join('')}</div>
    <div class="player-note-toolbar"><button type="button" data-note-add>Añadir sección</button><button type="submit" data-note-save>Guardar nota</button><button type="button" data-note-delete ${state.selected?'':'hidden'}>Eliminar nota</button></div><p role="status" aria-live="polite">${state.dirty?'Cambios sin guardar.':state.playerId?'Tus notas se guardan con tu personaje.':'Esperando conexión con tu personaje…'}</p></form>`;
    renderList();setBusy(state.busy);
  }
  function setBusy(value){state.busy=value;root.querySelectorAll('button,input,textarea').forEach(n=>n.disabled=value||!state.playerId);}
  function ownedRef(){
    const uid=global.firebase?.auth?.().currentUser?.uid;
    if(!uid||uid!==state.uid||!state.playerId)throw Error('No se pudo verificar tu sesión.');
    return global.firebase.database().ref(`campaña/jugadores/${state.playerId}/notebookNotes`);
  }
  async function save(event){
    event.preventDefault();if(state.busy)return;collect();
    if(!state.draft.title.trim()){message('Escribe un título para guardar la nota.');return;}
    if(!state.draft.sections.length){message('Añade al menos una sección.');return;}
    setBusy(true);message('Guardando…');
    try{
      const ref=ownedRef(),id=state.selected||ref.push().key;
      const note={title:state.draft.title.trim(),subtitle:state.draft.subtitle.trim(),sections:state.draft.sections,updatedAt:Date.now()};
      await ref.child(id).set(note);state.notes[id]=note;state.selected=id;state.draft=note;state.dirty=false;clearBackup();render();message('Nota guardada.');
    }catch(error){backup();message('No se pudo guardar. Tus cambios siguen aquí; vuelve a intentarlo.');}
    finally{setBusy(false);}
  }
  root.addEventListener('submit',save);
  root.addEventListener('input',event=>{
    if(event.target.matches('[data-note-search]')){
      const q=event.target.value.toLocaleLowerCase();root.querySelectorAll('[data-note-open]').forEach(button=>{const note=state.notes[button.dataset.noteOpen];button.hidden=!JSON.stringify(note).toLocaleLowerCase().includes(q);});return;
    }
    collect();state.dirty=true;backup();message('Cambios sin guardar.');
  });
  root.addEventListener('click',async event=>{
    const button=event.target.closest('button');if(!button||state.busy)return;
    if(button.hasAttribute('data-note-new'))edit(null);
    if(button.dataset.noteOpen)edit(button.dataset.noteOpen);
    if(button.hasAttribute('data-note-add')){collect();if(state.draft.sections.length>=20){message('Puedes añadir hasta 20 secciones por nota.');return;}state.draft.sections.push({heading:'',body:''});state.dirty=true;backup();render();root.querySelector('[data-note-section]:last-child input')?.focus();}
    if(button.hasAttribute('data-note-remove')){collect();state.draft.sections.splice(Number(button.dataset.noteRemove),1);state.dirty=true;backup();render();}
    if(button.hasAttribute('data-note-delete')&&state.selected&&global.confirm('¿Eliminar esta nota guardada?')){
      setBusy(true);try{await ownedRef().child(state.selected).remove();delete state.notes[state.selected];state.dirty=false;clearBackup();state.selected=null;state.draft=null;render();message('Nota eliminada.');}catch(_){message('No se pudo eliminar. Vuelve a intentarlo.');}finally{setBusy(false);}
    }
  });
  function sync(data,playerId){
    const authUid=global.firebase?.auth?.().currentUser?.uid;
    if(!playerId||!authUid||data.uid!==authUid)return;
    const changed=state.playerId!==playerId||state.uid!==authUid;
    if(changed){state.playerId=playerId;state.uid=authUid;state.selected=null;state.dirty=false;state.draft=null;}
    state.notes=data.notebookNotes||{};
    if(changed){try{const saved=JSON.parse(global.localStorage.getItem(key())||'null');if(saved?.draft){state.selected=saved.selected;state.draft=saved.draft;state.dirty=true;}}catch(_){}render();}
    else renderList();
  }
  function profile(data={}){
    const label=doc.getElementById('player-profile-name'),image=doc.getElementById('player-profile-icon'),fallback=doc.getElementById('player-profile-fallback');
    if(label)label.textContent=data.characterName||data.character_name||data.nombre||'Personaje';
    const src=data.icono_jugador||data.icono||'';
    if(image){image.hidden=!src;if(src&&image.getAttribute('src')!==src)image.src=src;image.onerror=()=>{image.hidden=true;if(fallback)fallback.hidden=false;};}
    if(fallback)fallback.hidden=Boolean(src);
  }
  const logout=doc.getElementById('btn-player-logout');if(logout)doc.getElementById('player-profile-session')?.appendChild(logout);
  const codex=doc.querySelector('.sheet-tab-codex');if(codex){codex.hidden=true;codex.setAttribute('inert','');codex.setAttribute('aria-hidden','true');}
  const rules=doc.getElementById('rules-modal');
  if(rules){
    let wasOpen=false,returnFocus=null;
    new MutationObserver(()=>{
      const open=rules.classList.contains('active');
      if(open&&!wasOpen){returnFocus=doc.activeElement;rules.querySelector('button')?.focus();}
      if(!open&&wasOpen)returnFocus?.focus?.();
      wasOpen=open;
    }).observe(rules,{attributes:true,attributeFilter:['class']});
    rules.setAttribute('role','dialog');rules.setAttribute('aria-modal','true');rules.setAttribute('aria-label','Reglas del juego');
    rules.addEventListener('keydown',event=>{
      if(event.key==='Escape'){event.preventDefault();global.LuminousPlayerHudNavigation?.closeAll();return;}
      if(event.key!=='Tab')return;
      const nodes=[...rules.querySelectorAll('button,input,select,textarea,a[href],[tabindex="0"]')].filter(n=>!n.disabled&&n.getClientRects().length);
      const first=nodes[0],last=nodes.at(-1);
      if(event.shiftKey&&doc.activeElement===first){event.preventDefault();last?.focus();}
      else if(!event.shiftKey&&doc.activeElement===last){event.preventDefault();first?.focus();}
    });
  }
  global.addEventListener('luminous:player-data',event=>{profile(event.detail?.data);sync(event.detail?.data||{},event.detail?.playerId);});
  global.addEventListener('beforeunload',event=>{if(state.dirty){backup();event.preventDefault();event.returnValue='';}});
  render();profile(global.datosJugador||{});
  global.LuminousPlayerNotebook=Object.freeze({sync,state});
})(window);
