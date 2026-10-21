(function(global){
  'use strict';
  const doc=global.document,$=id=>doc.getElementById(id),api=global.LuminousCombatSession;
  const state={uid:null,dm:false,player:null,playerId:null,encounter:{},instance:'ninguno',connected:false,subs:[],generation:0,busy:false};
  const say=(text,error=false)=>{$('combat-entry-message').textContent=text;$('combat-entry-card').dataset.error=String(error);};
  function actionError(error){
    if(error?.userMessage)return error.userMessage;
    const code=String(error?.code||'').toLowerCase(),message=String(error?.message||'');
    if(code.includes('permission'))return 'No tienes permiso para cambiar este encuentro. Entra con la cuenta del DM.';
    if(code.includes('network')||code.includes('unavailable'))return 'No se pudo conectar. Revisa tu conexión e inténtalo de nuevo.';
    if(message.startsWith('Firebase rechazó')||message.startsWith('No se pudo preparar el botín'))return message;
    if(message.startsWith('Espera a que termine la ronda')||message.startsWith('Cambia la presentación entre rondas'))return message;
    return 'No se pudo completar la acción. Vuelve a intentarlo.';
  }
  function teardown(){for(const off of state.subs.splice(0))off();$('combat-entry-view')?.remove();}
  function watch(path,handler,generation){const ref=db.ref(path),listener=snap=>{if(generation===state.generation)handler(snap.val());};ref.on('value',listener,error=>say('No se pudo cargar el encuentro. Revisa tu conexión y vuelve a entrar.',true));state.subs.push(()=>ref.off('value',listener));}
  function render(){
    const authorized=state.dm||state.player;
    const ended=state.encounter?.estado?.phase==='ENDED'||state.encounter?.estado?.active===false;
    const showingResult=ended&&state.instance==='combate'&&['result','blackout'].includes(state.encounter?.estado?.transition);
    const participating=global.LuminousCombatParticipants?.includes(state.encounter.combatants,{uid:state.uid,playerId:state.playerId})===true;
    const active=authorized&&(state.dm||(state.instance==='combate'&&participating))&&(!ended||showingResult)&&Boolean(state.encounter?.estado);
    $('combat-entry-bar').hidden=!state.uid;
    $('combat-entry-start').hidden=!state.dm;
    $('combat-entry-end').hidden=!state.dm||!active||ended;
    $('combat-entry-open').hidden=!state.dm||active;
    $('combat-entry-presentation-label').hidden=!state.dm||!active||ended;
    const locked=api.blocked(state.encounter)||showingResult;
    $('combat-entry-start').disabled=state.busy||!state.connected||locked;
    $('combat-entry-end').disabled=state.busy||!state.connected||(locked&&state.encounter?.estado?.phase!=='ENDING');
    $('combat-entry-open').disabled=state.busy||!state.connected;
    $('combat-entry-presentation').disabled=state.busy||!state.connected||locked;
    $('combat-entry-presentation').value=state.encounter?.estado?.presentation==='simple'?'simple':'full';
    $('combat-entry-start').textContent=active?'Volver al encuentro':'Abrir encuentro';
    $('combat-entry-identity').textContent=state.dm?'Director':state.player?.characterName||state.player?.nombre||'Jugador';
    $('combat-entry-sheet').href=state.dm?'pantalla_dm.html':'hoja_personaje.html';
    $('combat-entry-sheet').textContent=state.dm?'Panel del DM':'Mi ficha';
    if(!state.uid)return;
    $('combat-entry-card').hidden=Boolean(active);
    const existing=$('combat-entry-view'),encounterId=state.encounter?.estado?.encounterId||'';
    if(active&&existing&&((!ended&&existing.dataset.ended==='true')||(existing.dataset.encounter&&existing.dataset.encounter!==encounterId)))existing.remove();
    if(active&&!$('combat-entry-view')){
      const frame=doc.createElement('iframe');frame.id='combat-entry-view';frame.title='Encuentro de combate';frame.allow='autoplay';frame.src='Battle-viewer.html';$('combat-entry-main').appendChild(frame);
      frame.dataset.encounter=encounterId;
    }
    // Keep the ended viewer alive for the normal result/loot lifecycle. It is
    // replaced on the next encounter, or removed when leaving combat/signing out.
    if(!active&&!ended)$('combat-entry-view')?.remove();
    const frame=$('combat-entry-view');if(frame){frame.hidden=!active;frame.dataset.encounter=encounterId;frame.dataset.ended=String(ended);}
    if(!active)say(!authorized?'Esta cuenta todavía no tiene un personaje asignado. Pide al DM que lo vincule.':!state.connected?'Reconectando con la campaña…':ended?'Encuentro finalizado. Los resultados se han conservado.':state.dm?'Abre un encuentro y añade los personajes y enemigos desde «Encuentro».':'Tu personaje permanece en teatro. Entrarás cuando el DM lo añada al encuentro.');
  }
  async function action(fn){if(state.busy)return;state.busy=true;render();try{await fn();$('combat-entry-menu').open=false;}catch(error){console.error('[Combat entry]',error);global.alert(actionError(error));}finally{state.busy=false;render();}}
  let auth,db;
  try{if(!global.firebase.apps.length)global.firebase.initializeApp(global.LuminousCombatFirebaseConfig);auth=global.firebase.auth();db=global.firebase.database();}
  catch(error){say('No se pudo conectar con Luminous. Recarga la página para volver a intentarlo.',true);console.error('[Combat entry]',error);return;}
  $('combat-entry-login').onsubmit=async event=>{event.preventDefault();const button=event.currentTarget.querySelector('button');button.disabled=true;try{await auth.signInWithEmailAndPassword($('combat-entry-email').value.trim(),$('combat-entry-password').value);$('combat-entry-password').value='';}catch(error){say(error.code==='auth/network-request-failed'?'No se pudo conectar. Revisa tu conexión.':'No se pudo iniciar sesión. Revisa tu correo y contraseña.',true);}finally{button.disabled=false;}};
  $('combat-entry-open').onclick=$('combat-entry-start').onclick=()=>action(()=>api.start({db,uid:state.uid}));
  $('combat-entry-end').onclick=()=>{$('combat-entry-menu').open=false;$('combat-entry-end-dialog').showModal();};
  $('combat-entry-confirm-end').onclick=()=>action(async()=>{
    const consoleApi=$('combat-entry-view')?.contentWindow?.LuminousBattleViewerDmConsole074;
    $('combat-entry-end-dialog').close();
    try{await api.end({result:$('combat-entry-result').value,finishEncounter:consoleApi?.finishEncounter});}
    catch(error){$('combat-entry-end-dialog').showModal();throw error;}
  });
  $('combat-entry-presentation').onchange=event=>{const value=event.target.value;return action(()=>api.presentation({db,value}));};
  $('combat-entry-signout').onclick=()=>action(()=>auth.signOut());
  auth.onAuthStateChanged(async user=>{
    const generation=++state.generation;teardown();Object.assign(state,{uid:user?.uid||null,dm:false,player:null,playerId:null,encounter:{},connected:false});
    $('combat-entry-card').hidden=false;$('combat-entry-login').hidden=Boolean(user);$('combat-entry-title').textContent=user?'Tu encuentro':'Entra al combate';
    if(!user){$('combat-entry-end-dialog').close();render();say('Usa la misma cuenta que utilizas en tu ficha de personaje.');return;}
    say('Cargando tu campaña…');
    try{
      const dm=await db.ref('campaña/config/dm_uid').once('value');if(generation!==state.generation)return;
      state.dm=user.uid===dm.val()||user.uid==='e9JwFZrtk6g8UMqq2Hf9EHVY7Ay1';
      watch('.info/connected',value=>{state.connected=value===true;render();},generation);
      watch('campaña/jugadores',players=>{const matches=Object.entries(players||{}).filter(([,p])=>(p.uid||p.vinculado_a||p.vinculo_jugador)===state.uid);state.player=matches.length===1?matches[0][1]:null;state.playerId=matches.length===1?matches[0][0]:null;render();},generation);
      watch(`${api.ROOT}/combatants`,value=>{state.encounter.combatants=value||{};render();},generation);
      watch(`${api.ROOT}/estado`,value=>{state.encounter.estado=value||null;render();},generation);
      watch(`${api.ROOT}/authority/current/phase`,value=>{state.encounter.authority={current:{phase:value}};render();},generation);
      watch(api.INSTANCE,instance=>{state.instance=instance||'ninguno';render();},generation);
    }catch(error){say('No se pudo cargar tu campaña. Revisa tu conexión y vuelve a entrar.',true);console.error('[Combat entry]',error);}
  },()=>say('No se pudo restaurar tu sesión. Recarga la página para volver a entrar.',true));
  global.addEventListener('beforeunload',teardown,{once:true});
})(window);
