(function (global) {
  "use strict";
  // Editable ten-point Skill Deck. Uses the learned-skills HUD and a single V2 rule contract.
  if (global.LuminousPlayerDeckManager || !global.document) return;
  const ROOT = "campaña/jugadores/";
  const DEFAULT_ART = "Assets/Images/Buttons/Skills.png";
  const FALLBACK_SPLASH = "Assets/Images/Buttons/Player.svg";
  const ROMAN = {1:"I",2:"II",3:"III"};
  const Rules=global.LuminousSkillDeckRulesV2 || (typeof require==='function'?require('./skill-deck-rules-v2.js'):null);
  if(!Rules)return;
  const state = {
    playerId:"", character:null, uid:"", initialized:false, ref:null, handler:null,
    presets:[], active:0, savedDeckKey:"", dirty:false, busy:false,
    selected:"", filter:"all", search:"", lastError:"", status:"Cargando habilidades…",
    authUnsubscribe:null, localAccess:false
  };
  const doc=global.document;
  const el=id=>doc.getElementById(id);
  const clean=v=>String(v??"").trim();
  const normalizeId=v=>clean(v).toLowerCase().replace(/[^a-z0-9]+/g,"_").replace(/^_+|_+$/g,"");
  const esc=v=>clean(v).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
  const safeUrl=v=>{const url=clean(v);return /^(https?:\/\/|data:image\/(?:png|jpeg|jpg|webp|gif);base64,|(?:\.?\/)?Assets\/)/i.test(url)?url:"";};
  const n=(v,d=0)=>Number.isFinite(Number(v))?Number(v):d;
  const clone=obj=>JSON.parse(JSON.stringify(obj||{}));
  const normalizeDeck=Rules.normalizeDeck;
  const expandDeck=Rules.slotIds;
  function playerName() {
    const p=state.character||{};
    return clean(p.characterName||p.character_name||p.nombre||p.characterIdentity?.name||p.name)||"PERSONAJE";
  }
  function owningModel(character=state.character||global.datosJugador||{}){
    const hud=global.LuminousPlayerSkillsHud;
    if(!hud?.buildSkillViewModel)return null;
    return hud.buildSkillViewModel(character);
  }
  function catalog(){
    return global.LuminousCombatSkillLoadout074?.skillLibrary?.()||global.LuminousPlayerSignatureSkillCatalog?.DEFINITIONS||{};
  }
  function permittedSkills(character=state.character||global.datosJugador||{}){
    const model=owningModel(character);
    const defs=catalog();
    const rows=new Map();
    (model?.skills||[]).forEach(skill=>{
      const key=normalizeId(skill.id);
      if(key&&(skill.assigned||skill.learned))rows.set(key,{...defs[key],...skill,id:key});
    });
    const p=character||{};
    const raw=p.characterBuild?.grantedSkillIds||p.grantedSkillIds||[];
    const granted=Array.isArray(raw)?raw:Object.entries(raw).filter(([,enabled])=>enabled===true).map(([id])=>id);
    granted.forEach(v=>{
      const key=normalizeId(v?.skillId||v?.id||v);
      // Equipment grants remain outside the player's learned Skill Deck.
      // Never overwrite a genuinely learned Skill with an equipment-only grant.
      if(key&&defs[key]&&!rows.has(key))rows.set(key,{...defs[key],id:key,granted:true,availability:{type:"granted"}});
    });
    return Array.from(rows.values()).sort((a,b)=>n(a.tier,99)-n(b.tier,99)||clean(a.name).localeCompare(clean(b.name),"es"));
  }
  function skillById(id){return permittedSkills().find(x=>x.id===normalizeId(id))||null;}
  function typeFor(skill={}) {
    const def=clean(skill.defenseType||skill.defenseSubtype||"").toLowerCase();
    if(skill.isDefense===true||clean(skill.type).toLowerCase()==="defense"||def)return "defense";
    const t=clean(skill.damageType||skill.dmgType||skill.attackType||skill.type).toLowerCase();
    if(t.includes("slash")||t.includes("cortan"))return "slash";
    if(t.includes("pierce")||t.includes("perfor"))return "pierce";
    if(t.includes("blunt")||t.includes("contund"))return "blunt";
    if(t.includes("support")||t.includes("buff")||t.includes("heal"))return "support";
    return "special";
  }
  function artwork(skill={}) {
    for(const key of ["cardArtUrl","skillArtUrl","artUrl","artwork","imageUrl","image","iconUrl","icon","img"]){
      const found=safeUrl(skill[key]);if(found)return found;
    }
    const cat=typeFor(skill);
    const fallback={
      slash:"Assets/Icons/items/equipment/weapon_dagger.png",
      pierce:"Assets/Icons/items/equipment/weapon_spear.png",
      blunt:"Assets/Icons/items/equipment/weapon_hammer.png",
      defense:"Assets/Icons/items/equipment/shield.png",
      support:"Assets/Images/Buttons/Spells.png",
      special:DEFAULT_ART
    };
    return fallback[cat];
  }
  function splash(){
    const p=state.character||global.datosJugador||{};
    const candidates=[p.sheetArt,p.playerSheetArt,p.splashArt,p.splashArtUrl,p.visual?.splashArtUrl,p.characterBuild?.splashArtUrl,p.icono_jugador,p.icon_url,p.avatar];
    return candidates.map(safeUrl).find(Boolean)||FALLBACK_SPLASH;
  }
  function frameFor(p={}){
    const f=p.sheetArtFraming||p.playerSheetArtFraming||p.sheetArtCrop||{};
    const limit=(x,a,b,d)=>Math.min(b,Math.max(a,n(x,d)));
    return {x:limit(f.x,0,100,50),y:limit(f.y,0,100,50),zoom:limit(f.zoom,1,2.5,1)};
  }
  function prep(){
    const d=state.character?.characterBuild||{};
    const canonical=normalizeDeck(d.skillDeck||state.character?.skillDeck||{});
    const raw=d.skillDeckPresets||state.character?.skillDeckPresets||[];
    const stored=Array.isArray(raw)?raw:Object.values(raw||{});
    state.presets=Array.from({length:5},(_,i)=>{
      const row=stored[i]||{};
      return {name:clean(row.name)||("Deck "+String(i+1).padStart(2,"0")), ...normalizeDeck(row)};
    });
    state.active=Math.max(0,Math.min(4,Math.floor(n(d.activeSkillDeckPreset??state.character?.activeSkillDeckPreset,0))));
    Object.assign(state.presets[state.active],canonical);
    state.savedDeckKey=JSON.stringify(canonical);
    state.dirty=false;
  }
  function current(){return state.presets[state.active]||{name:"Deck 01",...normalizeDeck({})};}
  function isDefense(skill){return typeFor(skill)==="defense";}
  function isLegal(skill,tier){return !!skill&&!isDefense(skill)&&Rules.tier(skill.tier)===tier;}
  const validateDeck=(deck,skills=permittedSkills())=>Rules.validateDeck(deck,skills);
  function setMessage(msg,error=false){state.status=msg;state.lastError=error?msg:"";const x=el("psdm-feedback");if(x){x.textContent=msg;x.classList.toggle("is-error",error);}}
  function coins(skill={}){
    const count=Math.max(1,Math.min(12,n(skill.coinAmount??skill.coinCount??skill.coin_count,1)));
    return Array.from({length:count},(_,i)=>{
      const unbreakable=clean(skill.coins?.[i]?.type)==="unbreakable";
      return '<span class="psdm-coin'+(unbreakable?' unbreakable':'')+'" aria-label="'+(unbreakable?"Coin irrompible":"Coin")+'"></span>';
    }).join("");
  }
  function card(skill,context,index,entry=null){
    const tier=Rules.tier(entry?.tier||skill?.tier)||1,id=skill?.id||"";
    const cat=skill?typeFor(skill):"empty";
    return '<button type="button" draggable="'+Boolean(skill&&context==="library")+'" class="psdm-card '+cat+(id===state.selected?" selected":"")+
      '" data-psdm-skill="'+esc(id)+'"'+(context==="deck"?' data-psdm-slot="'+index+'"':'')+
      ' aria-label="'+esc(skill?skill.name:"Slot vacío")+'"><span class="psdm-card-index">'+
      (context==="deck"?(index+1):ROMAN[tier])+'</span>'+
      (skill?'<img src="'+esc(artwork(skill))+'" loading="lazy" alt="" onerror="this.style.display=\'none\'">':
       '<span class="psdm-card-empty">+</span>')+
      '<span class="psdm-card-tier">'+ROMAN[tier]+'</span>'+
      '<span class="psdm-card-coins">'+(skill?coins(skill):"")+'</span>'+
      '<span class="psdm-card-label">'+esc(skill?.name||"LIBRE")+'</span>'+
      (context==="deck"?'<b class="psdm-copies">'+tier+' PT</b>':"")+
      '</button>';
  }
  function coinEffects(skill={}){
    let rows=[];
    const effects=Array.isArray(skill.effects)?skill.effects:[];
    effects.forEach(e=>rows.push({e,coin:0}));
    (Array.isArray(skill.coins)?skill.coins:[]).forEach((c,i)=>{
      (Array.isArray(c.effects)?c.effects:[]).forEach(e=>rows.push({e,coin:i+1}));
    });
    if(!rows.length)return '<p class="psdm-muted">Sin efectos adicionales.</p>';
    return rows.map(({e,coin})=>{
      const statusId=clean(e.status||e.statusId);
      const definition=global.LuminousStatusLibrary?.get?.(statusId);
      const icon=safeUrl(definition?.icon);
      const name=clean(definition?.name||statusId||e.type||"Efecto").replace(/_/g," ");
      const kind=clean(e.type||"status");
      let body="";
      if(kind==="status")body=(e.target==="self"?"Obtiene ":"Inflige ")+
        (n(e.potency)>0?n(e.potency)+" Potency ":"")+
        (n(e.count)>0?n(e.count)+" Count ":"")+name;
      else if(kind==="raw_damage")body="Daño adicional +"+n(e.potency);
      else if(kind==="percentage_damage")body="Daño adicional +"+n(e.potency)+"%";
      else if(kind==="scale_power")body="Escalado de poder · "+clean(e.scaleTarget||"base");
      else body=name;
      return '<div class="psdm-effect">'+(icon?'<img alt="" src="'+esc(icon)+'">':'<span class="psdm-effect-mark">◆</span>')+
        '<span><b>'+(coin?"Coin "+coin+" · ":"")+esc(e.trigger||"[On Use]")+'</b> '+esc(body)+'</span></div>';
    }).join("");
  }
  function details(skill){
    if(!skill)return '<div class="psdm-no-skill">Selecciona una carta para ver sus estadísticas y efectos.</div>';
    const tier=Rules.tier(skill.tier)||1;
    const copies=Rules.LIMITS[tier];
    const canAdd=Rules.addCard(current(),skill,permittedSkills());
    const amount=Math.max(1,n(skill.coinAmount,1)),base=n(skill.basePower),power=n(skill.coinPower),kind=typeFor(skill);
    const action=isDefense(skill)?'<span class="psdm-info">Defensa · disponible en combate, fuera del Deck ofensivo.</span>':
      '<button type="button" class="psdm-equip" data-psdm-equip="'+esc(skill.id)+'"'+(!canAdd.valid?' disabled':'')+'>AÑADIR COPIA · '+tier+' PT</button>';
    return '<div class="psdm-detail-cover '+kind+'"><img src="'+esc(artwork(skill))+'" alt=""><span class="psdm-detail-tier">'+ROMAN[tier]+'</span>'+
      '<div class="psdm-detail-coins">'+coins(skill)+'</div></div>'+
      '<h3>'+esc(skill.name||skill.id)+'</h3>'+
      '<div class="psdm-stats"><div><small>BASE POWER</small><b>'+base+'</b></div><div><small>ATTACK WEIGHT</small><b>'+Math.max(1,n(skill.attackWeight,1))+'</b></div>'+
      '<div><small>COINS</small><b>'+amount+'</b></div><div><small>COIN POWER</small><b>'+(power>=0?"+":"")+power+'</b></div></div>'+
      '<div class="psdm-tier-line">Tier <b>'+ROMAN[tier]+'</b><span>Máx. '+copies+(tier===3?' en todo el Deck':' por Skill')+'</span></div>'+
      '<section class="psdm-detail-text"><h4>DESCRIPCIÓN</h4><p>'+esc(skill.description||skill.descripcion||"Habilidad de combate.")+'</p></section>'+
      '<section class="psdm-detail-text"><h4>EFECTOS</h4>'+coinEffects(skill)+'</section>'+action;
  }
  function visible(skills){
    return skills.filter(s=>(state.filter==="all"||typeFor(s)===state.filter)&&
      (!state.search||(clean(s.name||s.id)+" "+clean(s.damageType||"")).toLowerCase().includes(state.search)));
  }
  function render(){
    const host=el("psdm-root");if(!host)return false;
    const skills=permittedSkills(),deck=current(),selected=skillById(state.selected)||skills[0]||null;
    if(selected)state.selected=selected.id;
    const name=playerName(),art=el("psdm-splash"),frame=frameFor(state.character||{});
    if(art){
      const src=splash();
      if(art.getAttribute("src")!==src)art.src=src;
      art.style.objectPosition=frame.x+"% "+frame.y+"%";
      art.style.transformOrigin=frame.x+"% "+frame.y+"%";
      art.style.transform="scale("+frame.zoom+")";
    }
    el("psdm-player-name").textContent=name;
    el("psdm-player-label").textContent=name.toUpperCase()+" · DECK";
    el("psdm-tabs").innerHTML=state.presets.map((p,i)=>
      '<button type="button" data-psdm-tab="'+i+'" class="'+(state.active===i?'active':'')+'">'+
      String(i+1).padStart(2,"0")+'</button>').join("");
    el("psdm-deck-name").textContent=deck.name;
    const checked=validateDeck(deck,skills);
    el("psdm-slots").innerHTML=deck.entries.map((entry,i)=>
      '<div class="psdm-slot">'+card(skills.find(s=>s.id===entry.skillId),"deck",i,entry)+
      '<button type="button" class="psdm-remove" data-psdm-remove="'+esc(entry.entryId)+'" aria-label="Quitar carta '+(i+1)+'" title="Quitar carta">×</button></div>').join("")+
      (checked.remaining>0?'<button type="button" class="psdm-add-card" data-psdm-add="true" aria-label="Añadir Skill seleccionada">+<small>AÑADIR</small></button>':"");
    el("psdm-budget").textContent=checked.spent+" / "+Rules.CAPACITY+" PT · "+deck.entries.length+" CARTAS · MÁX. 1 TIER III";
    el("psdm-library").innerHTML=visible(skills).map(s=>card(s,"library",-1)).join("")||
      '<p class="psdm-empty-library">No hay habilidades disponibles con este filtro.</p>';
    el("psdm-details").innerHTML=details(selected);
    el("psdm-counter").textContent=skills.length+" Skills";
    el("psdm-feedback").textContent=state.status;
    el("psdm-feedback").classList.toggle("is-error",!!state.lastError);
    el("psdm-save").disabled=!state.dirty||state.busy||!state.uid||!state.playerId;
    el("psdm-save").textContent=state.busy?"GUARDANDO…":state.dirty?"GUARDAR CAMBIOS":"GUARDADO";
    el("psdm-search").value=state.search;
    host.querySelectorAll("[data-psdm-filter]").forEach(b=>b.classList.toggle("active",b.dataset.psdmFilter===state.filter));
    global.LuminousRuleReferences?.decorate?.(el("psdm-details"),{mode:"card"});
    return true;
  }
  function equip(id){
    const skill=skillById(id);
    if(!skill){setMessage("Esta habilidad ya no está disponible.",true);return;}
    const checked=Rules.addCard(current(),skill,permittedSkills());
    if(!checked.valid){setMessage(checked.errors.join(" "),true);render();return;}
    current().entries=checked.deck.entries;state.dirty=true;state.selected=id;
    setMessage(clean(skill.name)+" añadida. "+checked.spent+" de "+Rules.CAPACITY+" puntos.");
    render();
  }
  function remove(entryId){
    current().entries=Rules.removeCard(current(),entryId).entries;
    state.dirty=true;setMessage("Carta retirada del Deck.");render();
  }
  function switchTab(index){
    if(index<0||index>=5)return;
    state.active=index;state.dirty=true;
    state.selected=expandDeck(current()).find(Boolean)||state.selected;
    setMessage("Deck "+String(index+1).padStart(2,"0")+" seleccionado. Guarda para activarlo.");
    render();
  }
  function rename(){
    const name=global.prompt?.("Nombre de este Deck (máx. 24 caracteres)",current().name);
    if(name==null)return;
    const next=clean(name).slice(0,24);
    if(!next)return;
    current().name=next;state.dirty=true;render();
  }
  function linkedPlayerId(detail={}){
    return clean(detail.playerId||detail.characterId||global.playerId||global.currentPlayerId||"");
  }
  function handlePlayerData(detail={}){
    const fresh=detail.data||detail.player||global.datosJugador||{};
    if(!fresh||typeof fresh!=="object")return;
    const id=linkedPlayerId(detail);
    if(id&&state.playerId&&id!==state.playerId)return;
    if(id&&!state.playerId)state.playerId=id;
    // The sheet emits its authoritative playerId after auth may have already
    // discovered multiple UID-linked records. Bind that approved character.
    if(id && !state.ref) {
      const user=global.firebase?.auth?.().currentUser;
      if(user?.uid)void bindPlayerId(id,user).catch(()=>setMessage("No se pudo vincular el Deck a tu personaje.",true));
    }
    if(state.dirty){state.character=fresh;render();return;}
    state.character=fresh;prep();render();
  }
  async function bindPlayerId(id,user){
    if(!id||!user?.uid)return;
    const db=global.firebase?.database?.();if(!db)return;
    if(state.ref)state.ref.off("value",state.handler);
    const ref=db.ref(ROOT+id);
    const snap=await ref.once("value");
    const player=snap.val();
    if(!player||clean(player.uid||player.ownerUid)!==user.uid){
      setMessage("No se encontró un personaje vinculado a tu cuenta.",true);return;
    }
    state.playerId=id;state.uid=user.uid;state.character=player;prep();render();
    const handler=next=>{
      const raw=next.val();
      if(!raw||clean(raw.uid||raw.ownerUid)!==state.uid)return;
      if(state.dirty){state.character=raw;render();return;}
      state.character=raw;prep();render();
    };
    ref.on("value",handler,()=>setMessage("No se pudo sincronizar el Deck.",true));
    state.ref=ref;state.handler=handler;
  }
  function selectLinkedPlayer(entries=[],preferredId="") {
    const preferred=clean(preferredId);
    if(preferred && entries.some(([id])=>id===preferred))return preferred;
    const approved=entries.filter(([,player])=>clean(player?.status).toLowerCase()==="approved");
    if(approved.length===1)return approved[0][0];
    return entries.length===1 ? entries[0][0] : "";
  }
  async function bindAuth(user){
    if(!user?.uid){state.uid="";state.playerId="";setMessage("Inicia sesión para administrar tus Skills.",true);render();return;}
    const playerFromEvent=state.playerId||linkedPlayerId();
    if(playerFromEvent){await bindPlayerId(playerFromEvent,user);return;}
    const db=global.firebase?.database?.();if(!db)return;
    try{
      const q=await db.ref("campaña/jugadores").orderByChild("uid").equalTo(user.uid).once("value");
      const linked=Object.entries(q.val()||{}).filter(([,p])=>clean(p?.uid)===user.uid);
      const linkedId=selectLinkedPlayer(linked,state.playerId);
      if(!linkedId){setMessage("Abre tu ficha de personaje para administrar el Deck.",true);return;}
      await bindPlayerId(linkedId,user);
    }catch(e){setMessage("No se pudo validar tu personaje.",true);}
  }
  async function save(){
    if(!state.dirty||state.busy||!state.uid||!state.playerId)return;
    const skills=permittedSkills(),target=current();
    const checked=validateDeck(target,skills);
    if(!checked.valid){setMessage(checked.errors.join(" "),true);return;}
    const playerRef=global.firebase?.database?.().ref(ROOT+state.playerId);
    if(!playerRef){setMessage("No hay conexión con tu campaña.",true);return;}
    state.busy=true;render();
    try{
      // Firebase transaction prevents silently replacing a DM change mid-edit.
      // Mutate only the player's canonical deck fields and preset metadata.
      const uid=state.uid, savedKey=state.savedDeckKey, presets=clone(state.presets);
      const index=state.active, deck=checked.deck;
      let failure="";
      const result=await playerRef.transaction(player=>{
        if(!player||clean(player.uid||player.ownerUid)!==uid){failure="owner";return;}
        const canonical=normalizeDeck(player.characterBuild?.skillDeck||player.skillDeck||{});
        if(JSON.stringify(canonical)!==savedKey){failure="conflict";return;}
        // Revalidate against the current transaction snapshot, not a stale HUD.
        const serverCheck=validateDeck(deck,permittedSkills(player));
        if(!serverCheck.valid){failure="invalid";return;}
        const ids=expandDeck(deck),unique=[...new Set(ids.filter(Boolean))];
        const enabled=Object.fromEntries(unique.map(id=>[id,true]));
        const build={...(player.characterBuild||{}),
          skillDeck:{...deck,schemaVersion:2},skillSlotIds:ids,skillIds:unique,
          equippedSkillIndex:enabled,skillDeckPresets:presets,activeSkillDeckPreset:index,
          skillLoadoutSource:"player_skill_deck_manager"};
        return {...player,skillDeck:{...deck,schemaVersion:2},skillSlotIds:ids,
          skillIds:unique,equippedSkillIndex:enabled,characterBuild:build};
      },undefined,false);
      if(!result.committed)throw Error(failure==="conflict"?"CONFLICT":"SAVE_DENIED");
      state.character=result.snapshot.val();state.dirty=false;prep();
      setMessage("Deck guardado en tu personaje.");
    }catch(err){
      const msg=err?.message==="CONFLICT"?"Tu Deck cambió desde otra sesión. Reabre el menú para revisar antes de sobrescribir.":
        "No se pudo guardar el Deck. Comprueba tus permisos, habilidades o conexión.";
      setMessage(msg,true);
    }finally{state.busy=false;render();}
  }
  function mount(){
    const hud=global.LuminousPlayerSkillsHud;
    hud?.render?.();
    const root=doc.querySelector("#skills-modal .player-combat-skills-console");
    if(!root)return false;
    if(el("psdm-root"))return true;
    const modal=doc.getElementById("skills-modal");
    modal?.classList.add("psdm-enabled");
    root.innerHTML=
      '<section id="psdm-root" class="psdm" aria-label="Gestor de Skill Deck">'+
        '<header class="psdm-mast"><img src="Assets/Images/Buttons/Skills.png" alt=""><div><b>SKILL DECK</b><span>MANAGER</span></div>'+
          '<p>FORJA TU PROPIO DESTINO</p><strong>DECK ◈</strong></header>'+
        '<div class="psdm-layout">'+
          '<aside class="psdm-character psdm-frame">'+
            '<div class="psdm-art"><img id="psdm-splash" alt="Splash art del personaje"></div>'+
            '<div class="psdm-person-header" id="psdm-player-label"></div>'+
            '<div class="psdm-person-footer"><h2 id="psdm-player-name">PERSONAJE</h2><span>SKILL DECK</span>'+
              '<div id="psdm-feedback" role="status" aria-live="polite"></div></div>'+
          '</aside>'+
          '<div class="psdm-central">'+
            '<section class="psdm-deck psdm-frame"><div class="psdm-section-head"><h2 id="psdm-deck-name">DECK 01</h2>'+
              '<button type="button" class="psdm-pencil" id="psdm-rename" title="Renombrar Deck" aria-label="Renombrar Deck">✎</button>'+
              '<nav id="psdm-tabs" aria-label="Decks"></nav>'+
              '<button type="button" id="psdm-save" disabled>GUARDADO</button></div>'+
              '<div id="psdm-slots" class="psdm-slot-grid" aria-label="Cartas equipadas en el Deck"></div>'+
              '<p class="psdm-deck-note" id="psdm-budget">0 / 10 PT · MÁX. 1 TIER III</p></section>'+
            '<section class="psdm-library psdm-frame"><div class="psdm-section-head"><h2>SKILL LIBRARY</h2>'+
              '<nav class="psdm-filters" aria-label="Filtros de Skills">'+
              '<button type="button" data-psdm-filter="all">TODAS</button>'+
              '<button type="button" data-psdm-filter="slash">SLASH</button>'+
              '<button type="button" data-psdm-filter="pierce">PIERCE</button>'+
              '<button type="button" data-psdm-filter="blunt">BLUNT</button>'+
              '<button type="button" data-psdm-filter="support">SUPPORT</button>'+
              '<button type="button" data-psdm-filter="defense">DEFENSE</button>'+
              '<button type="button" data-psdm-filter="special">SPECIAL</button></nav></div>'+
              '<div class="psdm-search-row"><input id="psdm-search" type="search" aria-label="Buscar habilidad" placeholder="Buscar habilidad…" autocomplete="off">'+
              '<small id="psdm-counter"></small></div>'+
              '<div id="psdm-library" class="psdm-library-grid" aria-label="Habilidades conocidas"></div></section>'+
          '</div>'+
          '<aside class="psdm-details psdm-frame"><h2>SKILL DETAILS</h2><div id="psdm-details"></div></aside>'+
        '</div></section>';
    root.addEventListener("click",event=>{
      const target=event.target.closest("button");if(!target)return;
      if(target.dataset.psdmFilter){state.filter=target.dataset.psdmFilter;render();return;}
      if(target.dataset.psdmTab!==undefined){switchTab(Number(target.dataset.psdmTab));return;}
      if(target.id==="psdm-save"){void save();return;}
      if(target.id==="psdm-rename"){rename();return;}
      if(target.dataset.psdmEquip){equip(target.dataset.psdmEquip);return;}
      if(target.dataset.psdmRemove!==undefined){remove(target.dataset.psdmRemove);return;}
      if(target.dataset.psdmAdd!==undefined){if(state.selected)equip(state.selected);return;}
      if(target.dataset.psdmSlot!==undefined){
        const deckSkill=expandDeck(current())[Number(target.dataset.psdmSlot)];
        if(deckSkill){state.selected=deckSkill;render();}
        return;
      }
      if(target.dataset.psdmSkill){state.selected=target.dataset.psdmSkill;render();}
    });
    root.addEventListener("input",event=>{
      if(event.target.id==="psdm-search"){state.search=clean(event.target.value).toLowerCase();render();}
    });
    root.addEventListener("dragstart",event=>{
      const c=event.target.closest("[data-psdm-skill]");
      if(c&&c.draggable)event.dataTransfer?.setData("text/plain",c.dataset.psdmSkill);
    });
    root.addEventListener("dragover",event=>{if(event.target.closest("[data-psdm-add]"))event.preventDefault();});
    root.addEventListener("drop",event=>{
      const c=event.target.closest("[data-psdm-add]");if(!c)return;
      event.preventDefault();const skillId=event.dataTransfer?.getData("text/plain");
      if(skillId)equip(skillId);
    });
    return true;
  }
  function init(){
    if(state.initialized)return;
    if(!mount())return;
    state.initialized=true;state.character=global.datosJugador||null;
    if(state.character)prep();
    render();
    global.addEventListener("luminous:player-data",event=>handlePlayerData(event?.detail||{}));
    const auth=global.firebase?.auth?.();
    if(auth){state.authUnsubscribe=auth.onAuthStateChanged(user=>void bindAuth(user));}
    else setMessage("No hay sesión de campaña disponible.",true);
  }
  if(doc.readyState==="loading")doc.addEventListener("DOMContentLoaded",init,{once:true});
  else init();
  const api=Object.freeze({init,render,normalizeDeck,expandDeck,validateDeck,artwork,frameFor,typeFor,selectLinkedPlayer,state});
  global.LuminousPlayerDeckManager=api;
})(typeof window!=="undefined"?window:globalThis);
