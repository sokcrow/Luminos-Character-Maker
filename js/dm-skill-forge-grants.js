/* DM Skill Forge: grant defensive Skills without changing the attack Deck. */
(function(global){
  "use strict";
  const doc=global.document;
  if(!doc?.getElementById("editorScroll"))return;
  const $=id=>doc.getElementById(id);
  const roots=Object.freeze({players:"campaña/jugadores",units:"campaña/base_datos_unidades",
    combatants:"campaña/combate/combatants",skills:"campaña/base_datos_skills"});
  const clean=v=>String(v??"").trim();
  const values=v=>Array.isArray(v)?v:Object.values(v&&typeof v==="object"?v:{});
  const ids=v=>[...new Set(values(v).map(row=>clean(row?.skillId||row?.id||row)).filter(Boolean))];
  const firebase=global.firebase;
  if(!firebase?.auth||!firebase?.database)return;
  const db=firebase.database();
  const section=doc.createElement("section");
  section.className="section forge-assignment";
  section.hidden=true;
  section.innerHTML=[
    '<div class="section-title">Entregar al personaje</div>',
    '<div class="section-body">',
    '<p class="forge-progress-copy">Las defensas creadas por el Director se pueden conceder sin reemplazar las Skills del Deck. Primero guarda la habilidad en la biblioteca.</p>',
    '<div class="grid2">',
    '<label class="field"><span class="field-name">Personaje que la recibe</span>',
    '<select id="forge-grant-player"><option value="">Selecciona un personaje…</option></select></label>',
    '<div class="field"><span class="field-name">Entrega</span>',
    '<button class="btn primary" id="forge-grant-submit" type="button" disabled>Otorgar defensa</button></div>',
    '</div><p id="forge-grant-message" class="forge-feedback" role="status" aria-live="polite">',
    'Al otorgarla, estará disponible entre sus defensas de combate.</p>',
    '</div>'
  ].join("");
  const scroll=$("editorScroll");
  scroll.insertBefore(section,scroll.querySelector(".forge-advance"));
  const select=$("forge-grant-player"),button=$("forge-grant-submit"),message=$("forge-grant-message");
  let authorized=false,players={},subscribed=false;
  const notify=(text,isError=false)=>{
    message.textContent=text;
    message.style.color=isError?"#efa397":"#c9d5c7";
  };
  function renderPlayers(){
    const selected=select.value;
    select.replaceChildren(new Option("Selecciona un personaje…",""));
    Object.entries(players).map(([id,p])=>({
      id,label:clean(p?.nombre||p?.name||p?.characterName||p?.nombre_personaje||"Personaje")
    })).sort((a,b)=>a.label.localeCompare(b.label,"es"))
      .forEach(p=>select.add(new Option(p.label,p.id)));
    if(players[selected])select.value=selected;
    button.disabled=!authorized||!select.value;
  }
  function showOnStep(step){
    section.hidden=Number(step)!==3;
  }
  doc.addEventListener("luminous:forge-step",event=>showOnStep(event.detail?.step));
  select.addEventListener("change",()=>{button.disabled=!authorized||!select.value;});
  firebase.auth().onAuthStateChanged(async user=>{
    authorized=false;
    button.disabled=true;
    if(!user)return;
    try{
      const configured=clean((await db.ref("campaña/config/dm_uid").once("value")).val());
      if(user.uid!==configured&&user.uid!=="e9JwFZrtk6g8UMqq2Hf9EHVY7Ay1")return;
      authorized=true;
      if(!subscribed){
        subscribed=true;
        db.ref(roots.players).on("value",snap=>{
          players=snap.val()||{};renderPlayers();
        },()=>notify("No se pudo abrir el directorio de personajes.",true));
      }
      renderPlayers();
    }catch(error){notify("No se pudo comprobar el permiso del Director.",true);}
  });
  button.addEventListener("click",async()=>{
    if(!authorized)return;
    const playerId=clean(select.value),skillId=clean($("f-id")?.value);
    if(!playerId||!players[playerId]){notify("Selecciona un personaje de tu campaña.",true);return;}
    if(!skillId){notify("Primero guarda la habilidad en la biblioteca.",true);return;}
    button.disabled=true;
    notify("Preparando la entrega…");
    try{
      const skill=(await db.ref(roots.skills+"/"+skillId).once("value")).val();
      if(!skill){notify("Guarda la habilidad antes de entregarla.",true);return;}
      if(clean(skill.name)!==clean($("f-name")?.value)){
        notify("Has cambiado la habilidad. Guarda la versión actual antes de entregarla.",true);return;
      }
      if(!(skill.isDefense===true||clean(skill.type).toLowerCase()==="defense")){
        notify("Los ataques y conjuros se equipan en el Deck del personaje. Esta entrega está reservada a defensas.",true);return;
      }
      const loadout=global.LuminousCombatSkillLoadout074;
      const core=global.LuminousDmPlayerLoadoutCore;
      if(!loadout?.resolvePlayerUnit||!core?.activeCombatantForPlayer)throw Error("Los vínculos de personaje no están disponibles.");
      const player=players[playerId];
      const [unitsSnapshot,combatantsSnapshot]=await Promise.all([
        db.ref(roots.units).once("value"),db.ref(roots.combatants).once("value")]);
      const units=unitsSnapshot.val()||{},combatants=combatantsSnapshot.val()||{};
      const actor={playerId,sourceId:playerId,ownerUid:player?.uid||player?.ownerUid||null,
        linkedActorId:player?.actorId||null,actorId:player?.actorId||null,
        unitId:player?.unitId||player?.unit_id||null,raw:player};
      const linked=loadout.resolvePlayerUnit(actor,units);
      if(!linked.ok){
        notify("Ese personaje necesita una unidad vinculada antes de recibir habilidades.",true);return;
      }
      const active=core.activeCombatantForPlayer(playerId,combatants,player?.uid||player?.ownerUid||"");
      if(!active.ok&&active.reason!=="NOT_DEPLOYED"){
        notify("Hay más de una unidad activa para este personaje. Revisa su vinculación antes de entregar.",true);return;
      }
      const grantList=(source)=>[...new Set([
        ...ids(source?.grantedSkillIds),...ids(source?.characterBuild?.grantedSkillIds),skillId
      ])];
      const playerGrants=grantList(player);
      const unitGrants=grantList(linked.unit);
      const updates={};
      updates[roots.players+"/"+playerId+"/grantedSkillIds"]=playerGrants;
      updates[roots.players+"/"+playerId+"/characterBuild/grantedSkillIds"]=playerGrants;
      updates[roots.units+"/"+linked.unitId+"/grantedSkillIds"]=unitGrants;
      updates[roots.units+"/"+linked.unitId+"/characterBuild/grantedSkillIds"]=unitGrants;
      if(active.ok){
        const combatant=combatants[active.key]||{};
        const activeGrants=grantList(combatant);
        updates[roots.combatants+"/"+active.key+"/grantedSkillIds"]=activeGrants;
        updates[roots.combatants+"/"+active.key+"/characterBuild/grantedSkillIds"]=activeGrants;
      }
      await db.ref().update(updates);
      notify("Defensa otorgada a "+clean(player?.nombre||player?.name||"tu personaje")+
        (active.ok?". También se actualizó su unidad desplegada.":". Estará disponible al entrar en combate."));
    }catch(error){
      notify("No se pudo completar la entrega. Revisa el acceso a la campaña y vuelve a intentarlo.",true);
      console.error("[Skill Forge] grant failed",error);
    }finally{button.disabled=!authorized||!select.value;}
  });
})(window);