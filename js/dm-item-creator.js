/* Visual Item Creator for the DM. No JSON, debug controls or parallel catalogs. */
(function (global) {
  "use strict";
  if (global.LuminousDmItemCreator) return;
  const doc=global.document;
  if (!doc) return;
  const core=()=>global.LuminousDmItemCreatorCore;
  const icons=()=>global.LuminousItemIconRegistry;
  const byId=id=>doc.getElementById("dmic-"+id);
  const state={open:false,busy:false,step:0,dirty:false,db:null,existing:null,collections:new Map(),loaded:false};
  const categories={weapon:"Armas",armor:"Armaduras",shield:"Escudos",accessory:"Accesorios",consumable:"Consumibles",augmentation:"Augments",material:"Materiales",ammo:"Munición",tool:"Herramientas",upgrade:"Mejoras"};
  const types={skill_check_bonus:"Bonificación de habilidad",check_threshold_reduction:"Reducir dificultad de prueba",sp_loss_reduction:"Reducir pérdida de SP",sin_resistance:"Resistencia a pecado",heal_hp_percent:"Curar HP al empezar turno",grant_skill:"Otorgar skill del catálogo"};
  const skills={acrobatics:"Acrobacias",animal_handling:"Trato con animales",arcana:"Arcanos",athletics:"Atletismo",deception:"Engaño",history:"Historia",insight:"Perspicacia",intimidation:"Intimidación",investigation:"Investigación",medicine:"Medicina",nature:"Naturaleza",perception:"Percepción",performance:"Interpretación",persuasion:"Persuasión",religion:"Religión",sleight_of_hand:"Juego de manos",stealth:"Sigilo",survival:"Supervivencia"};
  const sins={wrath:"Ira",lust:"Lujuria",sloth:"Pereza",gluttony:"Gula",gloom:"Melancolía",pride:"Orgullo",envy:"Envidia"};
  const el=(tag,props={})=>Object.assign(doc.createElement(tag),props);
  const option=(value,label)=>new Option(label,value);
  function options(select, rows, selected) {
    select.replaceChildren(...rows.map(([v,l])=>option(v,l)));
    if (selected!=null && [...select.options].some(x=>x.value===String(selected))) select.value=String(selected);
  }
  function field(name){return byId(name)?.value??"";}
  function val(name,value){if(byId(name))byId(name).value=String(value??"");}
  function check(name){return byId(name)?.checked===true;}
  function notice(msg,tone="") {
    const target=byId("status");if(!target)return;
    target.textContent=msg;target.dataset.tone=tone;
  }
  function runtimeSkillOptions() {
    const sources=[global.LuminousSkillCatalog,global.LuminousSkillRegistry,global.LuminousDmSkillCreator];
    for(const src of sources) {
      try {
        const list=src?.list?.() || src?.listSkills?.() || [];
        if(Array.isArray(list) && list.length) return list.filter(x=>x&&typeof x==="object")
          .map(x=>({id:String(x.skillId||x.id||"").trim(),name:String(x.displayName||x.nombre||x.name||"").trim()}))
          .filter(x=>x.id && x.name);
      } catch (_) {}
    }
    return [];
  }
  function mount() {
    if(byId("open"))return;
    const market=doc.getElementById("dashboard-mercado");
    if(!market)return;
    const panel=el("section",{className:"dmic-entry"});
    panel.innerHTML='<div><span class="dmic-kicker">TALLER DEL DIRECTOR</span><h4>Crea objetos originales para tu campaña</h4><p>Diseña ítems con propiedades jugables, guarda su definición y entrégalos desde el Directorio de Ítems.</p></div><button type="button" id="dmic-open" class="dmic-open">Crear ítem <span aria-hidden="true">＋</span></button>';
    market.insertBefore(panel,market.querySelector(".form-cyber-container"));
    panel.querySelector("button").addEventListener("click",()=>open());
    const overlay=el("div",{id:"dmic-overlay",className:"dmic-overlay",hidden:true});
    overlay.innerHTML=
    '<div class="dmic-shell" role="dialog" aria-modal="true" aria-labelledby="dmic-title">'+
      '<header class="dmic-header"><div><span class="dmic-kicker">LUMINOUS · ITEM CREATOR</span><h2 id="dmic-title">Nuevo ítem</h2></div><button type="button" class="dmic-close" id="dmic-close" aria-label="Cerrar creador">×</button></header>'+
      '<nav class="dmic-steps" aria-label="Pasos del creador"><button type="button" data-step="0">1. Identidad</button><button type="button" data-step="1">2. Mecánicas</button><button type="button" data-step="2">3. Vista previa</button></nav>'+
      '<div class="dmic-body">'+
      '<section class="dmic-page" data-page="0" aria-label="Identidad del objeto"><h3>Tu objeto</h3>'+
      '<div class="dmic-field"><label for="dmic-existing">Mis creaciones guardadas</label><div class="dmic-inline"><select id="dmic-existing"><option value="">Crear desde cero</option></select><button id="dmic-load" type="button" class="dmic-secondary">Editar</button><button id="dmic-new" type="button" class="dmic-secondary">Nuevo</button></div></div>'+
      '<div class="dmic-fields"><div class="dmic-field full"><label for="dmic-name">Nombre del ítem</label><input id="dmic-name" maxlength="90" autocomplete="off" placeholder="Nombre de tu creación"></div>'+
      '<div class="dmic-field"><label for="dmic-category">Categoría</label><select id="dmic-category"></select></div>'+
      '<div class="dmic-field"><label for="dmic-tier">Tier</label><select id="dmic-tier"></select></div>'+
      '<div class="dmic-field"><label for="dmic-price">Valor en AHN</label><input id="dmic-price" type="number" min="1" max="1000000000" step="1" value="100"></div>'+
      '<div class="dmic-field"><label for="dmic-tags">Etiquetas (separadas por comas)</label><input id="dmic-tags" maxlength="250" placeholder="Raro, ceremonial..."></div>'+
      '<div class="dmic-field full"><label for="dmic-description">Descripción</label><textarea id="dmic-description" rows="3" maxlength="2000" placeholder="Historia y uso del objeto"></textarea></div>'+
      '<div class="dmic-field full"><label for="dmic-icon-search">Icono oficial</label><input id="dmic-icon-search" type="search" placeholder="Buscar entre los iconos del juego"><div class="dmic-icon-line"><img id="dmic-icon-preview" alt="" src="Assets/Icons/items/fallback/generic_item.png"><select id="dmic-icon" aria-label="Icono del ítem"></select></div></div></div></section>'+
      '<section class="dmic-page" data-page="1" aria-label="Mecánicas del objeto" hidden><h3>Propiedades de juego</h3>'+
      '<p class="dmic-hint">Solo se guardan mecánicas que reconoce el motor real.</p><div class="dmic-field"><label for="dmic-condition">Resistencia máxima</label><input id="dmic-condition" type="number" min="1" max="100000" step="1" value="100"></div>'+
      '<div class="dmic-category-fields" data-category-field="weapon"><div class="dmic-field"><label for="dmic-hands">Uso del arma</label><select id="dmic-hands"><option value="1">Una mano</option><option value="2">Dos manos</option></select></div></div>'+
      '<div class="dmic-category-fields" data-category-field="accessory"><div class="dmic-field"><label for="dmic-accessory">Ubicación</label><select id="dmic-accessory"><option value="finger">Dedo</option><option value="head">Cabeza</option><option value="arm">Brazo</option><option value="hand">Mano</option><option value="foot">Pie</option><option value="legacy_accessory">Accesorio general</option></select></div></div>'+
      '<div class="dmic-category-fields" data-category-field="consumable"><div class="dmic-fields"><div class="dmic-field"><label for="dmic-action">Tiempo de uso</label><select id="dmic-action"><option value="action">Acción</option><option value="quick_action">Acción rápida</option><option value="off_combat">Fuera de combate</option></select></div><div class="dmic-field"><label for="dmic-hp">Recupera HP</label><input id="dmic-hp" type="number" min="0" max="100000" value="0"></div><div class="dmic-field"><label for="dmic-sp">Recupera SP</label><input id="dmic-sp" type="number" min="0" max="100000" value="0"></div></div></div>'+
      '<div class="dmic-category-fields" data-category-field="augmentation"><div class="dmic-fields"><div class="dmic-field"><label for="dmic-body-part">Anatomía necesaria</label><select id="dmic-body-part"><option value="eye">Ojo</option><option value="hand">Mano</option><option value="arm">Brazo</option><option value="leg">Pierna</option><option value="head">Cabeza</option><option value="torso">Torso</option><option value="foot">Pie</option></select></div><label class="dmic-check"><input id="dmic-removable" type="checkbox" checked> Permitir extracción del Augment</label></div></div>'+
      '<label class="dmic-check" id="dmic-stack-row"><input id="dmic-stackable" type="checkbox" checked> Se puede apilar en inventario</label>'+
      '<div id="dmic-effects-section"><div class="dmic-effects-heading"><div><h3>Pasivas y efectos</h3><p class="dmic-hint">Se activan cuando el objeto está equipado o instalado.</p></div><button type="button" id="dmic-add-effect" class="dmic-secondary">Añadir efecto</button></div><div id="dmic-effects"></div></div></section>'+
      '<section class="dmic-page" data-page="2" aria-label="Vista previa" hidden><h3>Así quedará en tu catálogo</h3><div class="dmic-preview"><img id="dmic-preview-image" alt=""><div><span id="dmic-preview-tier"></span><h3 id="dmic-preview-name"></h3><p id="dmic-preview-desc"></p><strong id="dmic-preview-price"></strong></div></div><div id="dmic-preview-features"></div><p class="dmic-hint">Guardar crea una definición en la campaña. No equipa ni entrega automáticamente el objeto.</p></section>'+
      '</div><footer class="dmic-footer"><div id="dmic-status" role="status" aria-live="polite"></div><div class="dmic-footer-buttons"><button type="button" id="dmic-back" class="dmic-secondary">Atrás</button><button type="button" id="dmic-next" class="dmic-primary">Siguiente</button><button type="button" id="dmic-save" class="dmic-primary" hidden>Guardar en catálogo</button></div></footer>'+
    '</div>';
    doc.body.appendChild(overlay);
    options(byId("category"),Object.entries(categories));
    options(byId("tier"),core().TIERS.map(x=>[x,"Tier "+x]));
    byId("close").addEventListener("click",close);
    byId("back").addEventListener("click",()=>setStep(state.step-1));
    byId("next").addEventListener("click",()=>next());
    byId("save").addEventListener("click",()=>save());
    byId("add-effect").addEventListener("click",()=>addEffect());
    byId("load").addEventListener("click",loadExisting);
    byId("new").addEventListener("click",()=>{if(state.dirty&&!global.confirm("¿Descartar cambios sin guardar?"))return;reset();byId("name").focus();});
    overlay.querySelectorAll("[data-step]").forEach(b=>b.addEventListener("click",()=>setStep(Number(b.dataset.step))));
    overlay.addEventListener("input",e=>{if(!["dmic-icon-search","dmic-existing"].includes(e.target.id))state.dirty=true; if(e.target.id==="dmic-icon-search")renderIcons(); renderPreview();});
    overlay.addEventListener("change",e=>{if(e.target.id!=="dmic-existing")state.dirty=true;if(e.target.id==="dmic-category"){renderCategory();renderIcons();}if(e.target.id==="dmic-icon")renderIconPreview();renderPreview();});
    overlay.addEventListener("click",e=>{if(e.target===overlay)close();const remove=e.target.closest("[data-remove-effect]");if(remove){remove.closest(".dmic-effect").remove();state.dirty=true;renderPreview();}});
    doc.addEventListener("keydown",e=>{if(state.open&&e.key==="Escape"){e.preventDefault();close();}});
    reset();
  }
  function iconEntries() {
    const category=field("category");
    const domains=["weapon","armor","shield","accessory","augmentation"].includes(category)?["equipment"]:
      category==="consumable"?["consumable"]:category==="material"?["material"]:
      category==="ammo"?["equipment","resource"]:category==="tool"?["utility","equipment"]:
      ["equipment","utility"];
    const search=field("icon-search").trim().toLowerCase();
    const all=(icons()?.list?.()||[]).filter(x=>domains.includes(x.domain)||x.id==="generic_item");
    return all.filter(x=>!search||[x.id,x.label,x.labelEs].some(t=>String(t||"").toLowerCase().includes(search))).slice(0,180);
  }
  function renderIcons(wanted) {
    const select=byId("icon"),prior=wanted||select.value;
    const rows=iconEntries().map(x=>[x.id,x.labelEs||x.label||x.id]);
    if(!rows.length) rows.push(["generic_item","Objeto genérico"]);
    options(select,rows,prior);
    renderIconPreview();
  }
  function renderIconPreview() {
    const image=byId("icon-preview");
    if(image) image.src=icons()?.resolveIcon?.(field("icon"))||icons()?.resolveIcon?.("generic_item");
  }
  function renderCategory() {
    const category=field("category");
    doc.querySelectorAll("#dmic-overlay [data-category-field]").forEach(e=>e.hidden=e.dataset.categoryField!==category);
    const equippable=["weapon","armor","shield","accessory","augmentation"].includes(category);
    byId("effects-section").hidden=!equippable;
    byId("stack-row").hidden=equippable;
  }
  function addEffect(raw={}) {
    const list=byId("effects");
    if(list.children.length>=8){notice("Máximo ocho efectos por objeto.","error");return;}
    const row=el("div",{className:"dmic-effect"});
    row.innerHTML='<div class="dmic-effect-line"><label>Tipo de efecto<select data-effect="type"></select></label><button type="button" data-remove-effect aria-label="Eliminar efecto" class="dmic-secondary">Quitar</button></div>'+
     '<div class="dmic-effect-line"><label data-target-box>Objetivo<select data-effect="target"></select></label><label data-skill-id-box hidden>Habilidad registrada<select data-effect="skillId"></select></label><label data-value-box>Valor<input data-effect="value" type="number" step="0.1" value="1"></label></div>';
    options(row.querySelector('[data-effect="type"]'),Object.entries(types),raw.type||"skill_check_bonus");
    const grantOption=[...row.querySelector('[data-effect="type"]').options].find(x=>x.value==="grant_skill");
    if(grantOption && !runtimeSkillOptions().length && raw.type!=="grant_skill")grantOption.disabled=true;
    row.querySelector('[data-effect="type"]').addEventListener("change",()=>renderEffectRow(row));
    row.querySelectorAll("input,select").forEach(e=>e.addEventListener("change",()=>{state.dirty=true;renderPreview()}));
    list.appendChild(row);
    renderEffectRow(row,raw);
    renderPreview();
  }
  function renderEffectRow(row,raw={}) {
    const type=row.querySelector('[data-effect="type"]').value;
    const target=row.querySelector('[data-effect="target"]');
    const skillId=row.querySelector('[data-effect="skillId"]');
    const value=row.querySelector('[data-effect="value"]');
    const isTarget=["skill_check_bonus","check_threshold_reduction","sin_resistance"].includes(type);
    row.querySelector("[data-target-box]").hidden=!isTarget;
    row.querySelector("[data-skill-id-box]").hidden=type!=="grant_skill";
    row.querySelector("[data-value-box]").hidden=type==="grant_skill";
    const items=type==="sin_resistance"?Object.entries(sins):Object.entries(skills);
    if(type==="check_threshold_reduction") items.unshift(["initiative","Iniciativa"]);
    options(target,items,raw.sin||raw.skill||raw.check);
    options(skillId,runtimeSkillOptions().map(x=>[x.id,x.name]),raw.skillId);
    if(type==="grant_skill" && !skillId.options.length) notice("El catálogo de Skills no está cargado. No se puede conceder una habilidad todavía.","error");
    value.value=String(raw.multiplier??raw.value??(type==="sin_resistance"?1:1));
  }
  function gatherEffects() {
    return [...byId("effects").children].map(row=>{
      const type=row.querySelector('[data-effect="type"]').value;
      const target=row.querySelector('[data-effect="target"]').value;
      return {type,value:row.querySelector('[data-effect="value"]').value,
        skill:target,check:target,sin:target,skillId:row.querySelector('[data-effect="skillId"]').value,
        availableSkillIds:runtimeSkillOptions().map(x=>x.id)};
    });
  }
  function gather() {
    return {name:field("name"),category:field("category"),tier:field("tier"),description:field("description"),
      tags:field("tags"),priceAhn:field("price"),iconFamily:field("icon"),conditionMax:field("condition"),stackable:check("stackable"),
      handCost:field("hands"),accessoryType:field("accessory"),actionCost:field("action"),
      hpRestore:field("hp"),spRestore:field("sp"),augmentPartType:field("body-part"),removable:check("removable"),
      equipmentEffects:["weapon","armor","shield","accessory","augmentation"].includes(field("category"))?gatherEffects():[]};
  }
  function renderPreview() {
    const draft=gather();
    byId("preview-name").textContent=draft.name||"Sin nombre";
    byId("preview-tier").textContent=(categories[draft.category]||"Objeto")+" · TIER "+draft.tier;
    byId("preview-desc").textContent=draft.description||"Agrega una descripción para tu creación.";
    byId("preview-price").textContent=(Number(draft.priceAhn)||0).toLocaleString("es-MX")+" AHN";
    byId("preview-image").src=icons()?.resolveIcon?.(draft.iconFamily)||icons()?.resolveIcon?.("generic_item");
    const checked=core().validateDraft(draft,{iconRegistry:icons()});
    const details=byId("preview-features");
    details.replaceChildren();
    const phrases=[];
    if(["weapon","armor","shield","accessory","augmentation"].includes(draft.category))
      phrases.push(draft.category==="augmentation"?"Implante corporal":draft.category==="weapon"?(draft.handCost==="2"?"Arma de dos manos":"Arma de una mano"):"Objeto equipable");
    if(draft.category==="consumable") phrases.push("Recupera "+(draft.hpRestore||0)+" HP / "+(draft.spRestore||0)+" SP");
    if(checked.effects.length)phrases.push(checked.effects.length+" efecto(s) de equipo");
    if(!checked.valid) phrases.push("Revisa los datos antes de guardar");
    phrases.forEach(label=>details.appendChild(el("span",{className:"dmic-preview-tag",textContent:label})));
  }
  function setStep(next) {
    state.step=Math.max(0,Math.min(2,next));
    doc.querySelectorAll("#dmic-overlay [data-page]").forEach(x=>x.hidden=Number(x.dataset.page)!==state.step);
    doc.querySelectorAll("#dmic-overlay [data-step]").forEach(x=>{const active=Number(x.dataset.step)===state.step;x.setAttribute("aria-current",active?"step":"false");});
    byId("back").hidden=state.step===0;
    byId("next").hidden=state.step===2;
    byId("save").hidden=state.step!==2;
    renderPreview();
    byId("status").textContent="";
    doc.querySelector(".dmic-body")?.scrollTo?.(0,0);
  }
  function next() {
    const draft=gather();
    if(state.step===0) {
      const checked=core().validateDraft({...draft,equipmentEffects:[]},{iconRegistry:icons()});
      if(!checked.valid){notice(checked.errors[0],"error");return;}
    }
    if(state.step===1) {
      const checked=core().validateDraft(draft,{iconRegistry:icons()});
      if(!checked.valid){notice(checked.errors[0],"error");return;}
    }
    setStep(state.step+1);
  }
  function reset() {
    state.existing=null;state.dirty=false;
    val("name","");val("category","weapon");val("tier","I");val("price","100");val("tags","");val("description","");
    val("condition","100");val("hands","1");val("accessory","finger");val("action","action");val("hp","0");val("sp","0");val("body-part","eye");
    byId("stackable").checked=true;byId("removable").checked=true;
    byId("effects").replaceChildren();
    val("icon-search","");
    renderCategory();renderIcons("weapon_melee");setStep(0);
    byId("title").textContent="Nuevo ítem";
    byId("category").disabled=false;
  }
  function open() {
    mount();if(!byId("overlay"))return;
    reset();state.open=true;byId("overlay").hidden=false;
    doc.body.classList.add("dmic-is-open");
    bindCatalog();
    byId("name").focus();
  }
  function close() {
    if(state.busy)return;
    if(state.dirty && !global.confirm("¿Descartar cambios sin guardar?"))return;
    state.open=false;byId("overlay").hidden=true;
    doc.body.classList.remove("dmic-is-open");
    state.dirty=false;
    byId("open")?.focus();
  }
  function resolveDb() {try{return global.firebase?.database?.()||null;}catch(_){return null;}}
  function bindCatalog() {
    if(state.loaded)return;
    state.db=resolveDb();
    if(!state.db?.ref) {notice("Inicia sesión como DM para guardar objetos.","error");return;}
    state.loaded=true;
    for(const path of ["campaña/base_datos_items","campaña/base_datos_aumentos"]) {
      state.db.ref(path).on("value",snap=>{
        const raw=snap.val()||{};
        [...state.collections.keys()].filter(k=>k.startsWith(path+"/")).forEach(k=>state.collections.delete(k));
        Object.entries(raw).forEach(([key,item])=>{
          if(item?.dmCustomDefinition===true)state.collections.set(path+"/"+key,item);
        });
        refreshExisting();
      },()=>notice("No se pudo cargar el listado de creaciones.","error"));
    }
  }
  function refreshExisting() {
    const select=byId("existing");if(!select)return;
    const previous=select.value,uid=global.firebase?.auth?.()?.currentUser?.uid;
    const rows=[["","Crear desde cero"],...[...state.collections.entries()]
      .filter(([,item])=>item?.createdByUid===uid)
      .sort((a,b)=>(Number(b[1]?.updatedAt||0)-Number(a[1]?.updatedAt||0)))
      .map(([path,item])=>[path,(item.nombre||item.name||"Ítem")+" · "+(categories[item.category]||"Objeto")])];
    options(select,rows,previous);
  }
  function loadExisting() {
    const path=field("existing"),item=state.collections.get(path);
    if(!item) return notice("Selecciona una creación guardada.","error");
    if(state.dirty && !global.confirm("¿Descartar los cambios actuales para editar este ítem?"))return;
    state.existing={path,revision:Number(item.revision||1)};
    byId("category").disabled=true;
    val("name",item.nombre||item.name);val("category",item.category);val("tier",item.tier);val("price",item.priceAhn||item.price);
    val("description",item.description);val("tags",(item.tags||[]).filter(t=>t!==item.category).join(", "));
    val("condition",item.conditionMax||100);val("hands",item.equipment?.handCost||1);val("accessory",item.equipment?.accessoryType||"finger");
    val("action",item.runtime?.actionCost||"action");
    val("hp",item.runtime?.effects?.hpRestore||0);val("sp",item.runtime?.effects?.spRestore||0);
    val("body-part",item.runtime?.augmentation?.targetPartTypes?.[0]||"eye");
    byId("stackable").checked=item.stackable===true;
    byId("removable").checked=item.runtime?.augmentation?.removable!==false;
    byId("effects").replaceChildren();
    (item.runtime?.equipmentEffects||[]).forEach(effect=>addEffect(effect));
    renderCategory();renderIcons(item.iconFamily);
    state.dirty=false;
    byId("title").textContent="Editar ítem";
    setStep(0);
    notice("Creación cargada. Los ítems ya entregados conservan su propia instancia.","");
  }
  async function save() {
    if(state.busy)return;
    const draft=gather();
    const db=state.db||resolveDb();
    const user=global.firebase?.auth?.()?.currentUser;
    if(!db?.ref||!user?.uid)return notice("Debes iniciar sesión para guardar.","error");
    const isEdit=Boolean(state.existing);
    const category= draft.category;
    const existing=state.existing && state.collections.get(state.existing.path);
    if(isEdit && category!==existing?.category)return notice("La categoría de una definición existente no puede cambiarse.","error");
    let path=state.existing?.path;
    if(!path) {
      const root=category==="augmentation"?"campaña/base_datos_aumentos":"campaña/base_datos_items";
      const key=db.ref(root).push().key;
      if(!key)return notice("No se pudo reservar un espacio para guardar.","error");
      path=root+"/dm_"+core().slug(draft.name).slice(0,38)+"_"+core().slug(key);
    }
    const id=path.split("/").pop();
    const result=core().buildDefinition(draft,id,{iconRegistry:icons()});
    if(!result.ok)return notice(result.errors[0],"error");
    state.busy=true;byId("save").disabled=true;byId("next").disabled=true;
    notice("Guardando definición...","");
    try {
      const before=existing||null,now=Date.now();
      const proposed={...result.definition,
        createdByUid:before?.createdByUid||user.uid,
        createdAt:before?.createdAt||now,
        updatedAt:now,revision:isEdit?(state.existing.revision+1):1};
      const outcome=await db.ref(path).transaction(current=>{
        if(isEdit) {
          if(!current || current.dmCustomDefinition!==true ||
            current.createdByUid!==user.uid || Number(current.revision||1)!==state.existing.revision)return;
          return proposed;
        }
        if(current!==null)return;
        return proposed;
      },null,false);
      if(!outcome?.committed)throw Error("La definición cambió o ya existe. Vuelve a cargarla antes de guardar.");
      state.existing={path,revision:proposed.revision};
      byId("category").disabled=true;
      state.dirty=false;
      byId("title").textContent="Editar ítem";
      state.collections.set(path,proposed);refreshExisting();
      val("existing",path);
      notice("Guardado en el catálogo. Ya puedes seleccionarlo y entregarlo desde Ítems / Mercado.","success");
    }catch(error) {
      console.error("[Luminous] DM Item Creator save failed:",error);
      notice("No se pudo guardar: "+(error?.message||"verifica tus permisos y la conexión"),"error");
    }finally{
      state.busy=false;byId("save").disabled=false;byId("next").disabled=false;
    }
  }
  function boot() {mount();}
  if(doc.readyState==="loading")doc.addEventListener("DOMContentLoaded",boot,{once:true});else boot();
  global.LuminousDmItemCreator=Object.freeze({version:1,boot,open,close,gather,renderPreview,state});
})(typeof window!=="undefined"?window:globalThis);
