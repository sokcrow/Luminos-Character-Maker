(function(g){
  'use strict';
  const doc=g.document,$=id=>doc.getElementById(id),q=new URLSearchParams(g.location.search),local=q.get('mode')==='local',id=q.get('encounter');
  let db,auth,user,players={},host=false,frame;
  const say=text=>{$('mirror-message').textContent=text;};
  function script(src){return new Promise((resolve,reject)=>{const s=doc.createElement('script');s.src=src;s.onload=resolve;s.onerror=()=>reject(Error('No se pudo cargar la conexión.'));doc.head.appendChild(s);});}
  function open(encounterId,isLocal,metadata){
    host=isLocal||metadata.hostUid===user?.uid;
    $('mirror-bar').hidden=false;$('mirror-card').hidden=true;$('mirror-end').hidden=!host;
    $('mirror-identity').textContent=isLocal?'Local en este dispositivo':'Online con tu grupo';
    if(!isLocal){$('mirror-share').href=g.location.href.split('?')[0]+'?encounter='+encounterId;$('mirror-share').hidden=false;}
    frame=doc.createElement('iframe');frame.id='mirror-view';frame.title='Encuentro separado';frame.allow='autoplay';
    frame.style.cssText='display:block;position:absolute;inset:0;width:100%;height:100%;border:0';
    frame.src='Battle-viewer.html?encounter='+encounterId+(isLocal?'&mode=local':'');$('mirror-main').appendChild(frame);
    let lootAttempts=0;const lootTimer=g.setInterval(()=>{
      const adapter=frame.contentWindow?.LuminousCombatLiveAdapter073?.state;
      const own=adapter?.playerId||Object.entries(adapter?.players||{}).find(([,p])=>(p.uid||p.vinculado_a||p.vinculo_jugador)===adapter?.uid)?.[0];
      if(adapter?.db&&own){g.clearInterval(lootTimer);void g.LuminousPlayerPostCombatLoot.install({db:adapter.db,playerId:own}).catch(error=>console.error('[Post-combat]',error));}
      else if(++lootAttempts>240)g.clearInterval(lootTimer);
    },100);
    if(host){let attempts=0;const timer=g.setInterval(async()=>{
      const setup=frame.contentWindow?.LuminousCombatDmSetup073;
      if(!setup?.state.started||!Object.keys(setup.state.players).length){if(++attempts>240)g.clearInterval(timer);return;}
      g.clearInterval(timer);
      // Joining/reloading never redeploys or heals an existing encounter.
      try{
        const stateRef=setup.state.db.ref('campaña/combate/estado');
        if((await stateRef.once('value')).val()?.formationInitialized)return;
        for(const playerId of Object.keys(setup.state.players))if(!setup.state.combatants['player:'+playerId])await setup.deployPlayer(playerId);
        await stateRef.update({formationInitialized:true});
      }catch(error){console.error('[Encounter deployment]',error);}
    },100);}
  }
  $('mirror-end').onclick=()=>$('mirror-result').showModal();
  $('mirror-confirm-end').onclick=async()=>{
    const button=$('mirror-confirm-end');button.disabled=true;
    try{const resolver=frame?.contentWindow?.LuminousBattleViewerDmConsole074;if(!resolver?.finishEncounter)throw Error('Espera a que cargue el encuentro.');$('mirror-result').close();await resolver.finishEncounter($('mirror-outcome').value,{confirm:false});frame.hidden=true;$('mirror-card').hidden=false;$('mirror-create').hidden=true;$('mirror-end').hidden=true;say('Encuentro finalizado. Los resultados se conservaron aquí.');}
    catch(error){$('mirror-result').showModal();g.alert(error.userMessage||'No se pudo finalizar el encuentro. Vuelve a intentarlo.');}finally{button.disabled=false;}
  };
  async function join(){
    if(!/^[A-Za-z0-9_-]{1,100}$/.test(id||''))throw Error('El enlace de encuentro es inválido.');
    const meta=(await db.ref(`campaña/encuentros/${id}`).once('value')).val();
    if(!meta||!meta.members?.[user.uid])throw Error('Tu cuenta no está incluida en este encuentro. Pide al anfitrión que te añada al crear el grupo.');
    open(id,false,meta);
  }
  $('mirror-create').onsubmit=async event=>{
    event.preventDefault();const button=event.currentTarget.querySelector('button');button.disabled=true;
    try{
      const ids=[...$('mirror-party').selectedOptions].map(o=>o.value),isLocal=$('mirror-mode').value==='local';
      if(!ids.length||isLocal&&ids.length!==1)throw Error('Para local, selecciona un solo personaje.');
      const selected=Object.fromEntries(ids.map(k=>[k,JSON.parse(JSON.stringify(players[k]))]));
      if(isLocal)selected[ids[0]].uid=user.uid;
      const members={[user.uid]:true};for(const p of Object.values(selected)){const uid=p.uid||p.vinculado_a||p.vinculo_jugador;if(!uid)throw Error('Cada personaje online debe estar vinculado a una cuenta.');p.uid=uid;members[uid]=true;}
      const encounterId='mirror-'+(g.crypto?.randomUUID?.()||Date.now().toString(36)),campaign={jugadores:selected,config:{dm_uid:user.uid},estado_mundo:{instancia_activa:'combate'},combate:{estado:{phase:'PRE_COMBAT_PLANNING',round:1,active:true,encounterId,presentation:'full'}}};
      say('Preparando la biblioteca y los personajes…');
      for(const name of ['actores','base_datos_unidades','base_datos_skills'])campaign[name]=(await db.ref('campaña/'+name).once('value')).val()||{};
      const record={hostUid:user.uid,members,mode:isLocal?'local':'online',createdAt:Date.now(),state:{'campaña':campaign}};
      if(isLocal)g.localStorage.setItem('luminous:encounter:'+encounterId,JSON.stringify(record));
      else await db.ref('campaña/encuentros/'+encounterId).set(record);
      g.location.href=g.location.pathname+'?encounter='+encounterId+(isLocal?'&mode=local':'');
    }catch(error){say(error.code==='PERMISSION_DENIED'?'Firebase rechazó la creación. Publica las reglas de esta versión y vuelve a intentarlo.':error.message);}finally{button.disabled=false;}
  };
  async function boot(){
    if(local&&id){const meta=JSON.parse(g.localStorage.getItem('luminous:encounter:'+id)||'null');if(!meta)throw Error('Este dispositivo no tiene guardado ese encuentro local.');open(id,true,meta);return;}
    for(const part of ['app','auth','database'])await script(`https://www.gstatic.com/firebasejs/8.10.1/firebase-${part}.js`);
    if(!g.firebase.apps.length)g.firebase.initializeApp(g.LuminousCombatFirebaseConfig);auth=g.firebase.auth();db=g.firebase.database();
    $('mirror-login').onsubmit=async event=>{event.preventDefault();try{await auth.signInWithEmailAndPassword($('mirror-email').value.trim(),$('mirror-password').value);$('mirror-password').value='';}catch(error){say('No se pudo iniciar sesión. Revisa tus datos y conexión.');}};
    auth.onAuthStateChanged(async current=>{
      user=current;$('mirror-login').hidden=Boolean(user);$('mirror-create').hidden=true;
      if(!user){say('Entra con la cuenta de tu personaje.');return;}
      try{if(id){await join();return;}players=(await db.ref('campaña/jugadores').once('value')).val()||{};const configuredDm=(await db.ref('campaña/config/dm_uid').once('value')).val();const dm=user.uid===configuredDm||user.uid==='e9JwFZrtk6g8UMqq2Hf9EHVY7Ay1';
        $('mirror-party').replaceChildren();for(const [key,p]of Object.entries(players)){const option=doc.createElement('option');option.value=key;option.textContent=p.characterName||p.nombre||p.name||key;option.selected=(p.uid||p.vinculado_a||p.vinculo_jugador)===user.uid;$('mirror-party').appendChild(option);}
        if(!dm&&!Object.values(players).some(p=>(p.uid||p.vinculado_a||p.vinculo_jugador)===user.uid))throw Error('Tu cuenta todavía no tiene un personaje vinculado.');
        $('mirror-create').hidden=false;say('Prepara un encuentro separado para ti o tu grupo.');
      }catch(error){say(error.message);}
    });
  }
  boot().catch(error=>say(error.message));
})(window);
