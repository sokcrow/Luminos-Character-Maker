(function(global){
  "use strict";
  if(global.LuminousEnchanterUi) return;
  const doc=global.document;
  if(!doc) return;

  const state={
    open:false,provider:null,viewer:null,items:[],providerMaterials:[],selectedItem:null,
    service:null,definitionId:null,rank:1,gem:null,anchorId:null,quote:null,pending:false,
    rewriteProcedure:null,nextDefinitionId:null,rewriteRank:1,gemQualityAfter:null,
    onSave:null,onClose:null,getWorldTimestamp:null,unsubscribeWorldTime:null,
    worldTimestamp:null,status:"",saveUncertain:false,
  };

  const services=()=>global.LuminousItemEnchanterServiceRuntime || null;
  const engine=()=>global.LuminousItemEnchantmentEngine || null;
  const catalog=()=>global.LuminousEnchantmentCatalog || null;
  const magic=()=>global.LuminousItemMagicRuntime || null;
  const magicKnowledge=()=>global.LuminousItemMagicKnowledgeRuntime || null;
  const gems=()=>global.LuminousOreIngotGemCatalog || null;
  const clone=v=>v==null?v:JSON.parse(JSON.stringify(v));
  const asArray=v=>v==null?[]:(Array.isArray(v)?v:[v]);
  const esc=v=>String(v??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
  const roman=n=>["","I","II","III","IV","V"][Number(n)] || String(n||"");
  const itemId=item=>String(item?.instanceId || item?.id || "");
  const itemName=item=>String(item?.displayName || item?.name || item?.nombre || item?.baseItemName || item?.definitionId || "Item");
  const kindOf=item=>engine()?.itemKindOf?.(item) || String(item?.itemType || item?.category || "item");
  const ahn=n=>new Intl.NumberFormat("en-US",{maximumFractionDigits:0}).format(Math.max(0,Number(n)||0))+" AHN";

  function allViewerItems(viewer={}){
    const raw=[
      ...Object.values(viewer.inventario_activo || {}),
      ...Object.values(viewer.inventario_stash || {}),
    ].filter(Boolean);
    const seen=new Set();
    return raw.filter(item=>{
      const id=itemId(item);
      if(id && seen.has(id)) return false;
      if(id) seen.add(id);
      return true;
    });
  }

  function providerJobs(){
    return Object.values(state.viewer?.enchanterJobs || {}).filter(job=>
      job?.status==="in_service" && job.itemBefore
      && (!job.providerId || String(job.providerId)===String(state.provider?.id || "")));
  }
  function serviceItems(items=allViewerItems(state.viewer)){
    const all=[...items.filter(Boolean)];
    const seen=new Set(all.map(itemId));
    for(const job of providerJobs()){
      if(!seen.has(job.itemInstanceId)){
        all.push(clone(job.itemBefore));
        seen.add(job.itemInstanceId);
      }
    }
    return all;
  }
  function pendingJob(){
    const id=itemId(state.selectedItem);
    return providerJobs().find(job=>job.itemInstanceId===id) || null;
  }

  function applyPlayerSnapshot(snapshot){
    if(!snapshot || typeof snapshot!=="object") return;
    // Keep the surrounding Player runtime object (listeners/nonenumerable state)
    // while committing only Enchanter-owned Player fields locally.
    for(const key of ["inventario_activo","inventario_stash","ahn","finance",
      "itemMagicKnowledge","enchantmentCompendium","enchanterTransactions","enchanterJobs"]){
      if(Object.prototype.hasOwnProperty.call(snapshot,key)) state.viewer[key]=clone(snapshot[key]);
    }
    state.items=serviceItems();
    state.selectedItem=state.items.find(item=>itemId(item)===itemId(state.selectedItem)) || null;
  }

  function restoreUnconfirmedService(beforePlayer, beforeProviderMaterials){
    if(!beforePlayer || !state.viewer) return;
    // A failed/ambiguous Firebase write must never leave provisional AHN,
    // Enchantments or transaction receipts inside the live Player object:
    // unrelated saves could otherwise accidentally persist them later.
    const fields=["inventario_activo","inventario_stash","ahn","finance",
      "itemMagicKnowledge","enchantmentCompendium","enchanterTransactions","enchanterJobs"];
    const selectedId=itemId(state.selectedItem);
    for(const key of fields){
      if(Object.prototype.hasOwnProperty.call(beforePlayer,key))
        state.viewer[key]=clone(beforePlayer[key]);
      else delete state.viewer[key];
    }
    state.providerMaterials=clone(beforeProviderMaterials || []);
    state.items=serviceItems();
    state.selectedItem=state.items.find(item=>itemId(item)===selectedId) || null;
    state.gem=null;
    state.quote=null;
  }

  function providerName(){
    return String(state.provider?.name || "Enchanter");
  }

  function humanize(value){
    return String(value || "").replace(/_/g," ").replace(/\b\w/g,ch=>ch.toUpperCase());
  }

  const reasonLabels=Object.freeze({
    service_not_offered:"Este proveedor no ofrece ese servicio.",
    unknown_service:"Servicio no disponible.",
    provider_rank_cap:"El proveedor no domina ese rango.",
    relic_rank_not_reproducible:"Las Reliquias de Rango IV/V no pueden reproducirse por servicio normal.",
    provider_does_not_know_recipe:"El proveedor no conoce esta receta.",
    ineligible_equipment_kind:"Este tipo de Item no acepta Encantamientos.",
    missing_or_invalid_item_tier:"El Item no tiene un Tier válido para este proceso.",
    base_enchantment_slots_exceeded:"No quedan Slots de Encantamiento suficientes.",
    hard_conflict:"Existe un conflicto con un Encantamiento instalado.",
    duplicate_non_stackable_enchantment:"Ese Encantamiento ya está instalado.",
    enchantment_already_installed:"Ese Encantamiento ya está instalado.",
    item_has_no_magical_durability:"El Item no tiene Durabilidad Mágica que reparar.",
    magical_repair_price_unresolved:"El proveedor no ha fijado una tarifa de reparación mágica.",
    missing_ritual_materials:"Faltan materiales rituales.",
    provider_material_unpriced:"El proveedor no tiene precio para uno de los materiales.",
    service_price_unresolved:"El proveedor no ha fijado precio para este servicio.",
    enchantment_not_installed:"El Item no tiene ese Encantamiento.",
    enchantment_not_removable:"Ese Encantamiento no puede retirarse normalmente.",
    bound_enchantment_not_removable:"Un Bind impide retirar ese Encantamiento.",
    gem_quality_downgrade_unresolved:"El proveedor debe definir la calidad de la gema después del procedimiento.",
    bound_gem_removal_destroys_item:"Extraer una gema Bound destruye el Item.",
    gem_not_in_loose_inventory:"La gema ya no está disponible en el inventario del jugador.",
    recovered_gem_inventory_collision:"No se puede devolver la gema: existe otro Item con la misma identidad.",
    recovered_gem_inventory_unavailable:"No se puede devolver la gema al inventario.",
    npc_altered_outcome_unresolved:"El encantador no tiene configurado un resultado alternativo para este intento.",
    npc_outcome_not_authored:"El DM debe definir qué sucede si este encantador pierde el control.",
    timed_service_requires_persistence:"Este servicio requiere guardar el encargo antes de comenzar.",
    item_already_in_service:"Este Item ya está en servicio.",
    service_item_changed_during_delivery:"El Item cambió mientras estaba en servicio; no se puede entregar automáticamente.",
    service_knowledge_changed_during_delivery:"El conocimiento del Item cambió; la entrega necesita revisión.",
    service_not_ready:"El Item todavía no está listo para retirarse.",
    service_world_time_unavailable:"No se pudo consultar el reloj oficial de campaña.",
    magic_not_detected:"Hay que detectar primero las propiedades mágicas del Item.",
    service_item_must_be_unequipped:"Desequipa el Item antes de entregarlo al Enchanter.",
    service_item_identity_collision:"Ya existe otro Item con esa identidad; no se puede entregar.",
    service_inventory_full:"Libera un espacio en el inventario o alijo para retirar tu Item.",
    invalid_service_escrow:"El encargo no tiene un Item válido para entregar.",
    removable_curse_not_found:"No hay una Maldición removible en este Item.",
    replacement_enchantment_required:"Selecciona un Encantamiento de reemplazo.",
    direct_enchantment_required:"Esta inscripción requiere un procedimiento de gema.",
    service_duration_out_of_band:"La entrega supera los límites permitidos para este Rango.",
    unknown_rewrite_procedure:"El procedimiento de reescritura no está disponible.",
    gem_quality_downgrade_unresolved:"Selecciona la calidad final de la gema después de reescribir.",
    bound_enchantment_not_rewritable:"Un Bind impide reescribir esta gema.",
    relic_drawback_inseparable:"Ese drawback de Reliquia es inseparable.",
  });

  function reasonText(reason){
    return reasonLabels[reason] || humanize(reason || "No disponible");
  }

  function invalidateConfirmation(){
    const checkbox=doc.getElementById("enchanter-ui-confirm");
    if(checkbox) checkbox.checked=false;
    const destruction=doc.getElementById("enchanter-ui-confirm-destruction");
    if(destruction) destruction.checked=false;
    state.quote=null;
  }

  function mount(){
    let root=doc.getElementById("luminous-enchanter-ui");
    if(root) return root;
    root=doc.createElement("div");
    root.id="luminous-enchanter-ui";
    root.className="enchanter-ui-overlay";
    root.setAttribute("aria-hidden","true");
    root.innerHTML=`
      <div class="enchanter-ui-shell" role="dialog" aria-modal="true" aria-labelledby="enchanter-ui-title">
        <header class="enchanter-ui-header">
          <div><span>ARCANE SERVICE TERMINAL</span><strong id="enchanter-ui-title">ENCHANTER</strong></div>
          <button type="button" class="enchanter-ui-close" aria-label="Cerrar">×</button>
        </header>
        <div class="enchanter-ui-body">
          <aside class="enchanter-ui-items">
            <h3>ITEMS</h3>
            <div id="enchanter-ui-item-list"></div>
            <details class="enchanter-ui-unavailable"><summary>UNAVAILABLE</summary><div id="enchanter-ui-item-unavailable"></div></details>
          </aside>
          <main class="enchanter-ui-service">
            <div class="enchanter-ui-controls">
              <label>SERVICE<select id="enchanter-ui-service"></select></label>
              <label id="enchanter-ui-enchantment-wrap">ENCHANTMENT<select id="enchanter-ui-enchantment"></select></label>
              <label id="enchanter-ui-rank-wrap">RANK<select id="enchanter-ui-rank"><option value="1">I</option><option value="2">II</option><option value="3">III</option></select></label>
              <label id="enchanter-ui-gem-wrap" hidden>GEM ANCHOR<select id="enchanter-ui-gem"></select></label>
              <label id="enchanter-ui-anchor-wrap" hidden>GEM SOCKET<select id="enchanter-ui-anchor"></select></label>
              <label id="enchanter-ui-procedure-wrap" hidden>PROCEDURE<select id="enchanter-ui-procedure"></select></label>
              <label id="enchanter-ui-replacement-wrap" hidden>REPLACEMENT ENCHANTMENT<select id="enchanter-ui-replacement"></select></label>
              <label id="enchanter-ui-rewrite-rank-wrap" hidden>REPLACEMENT RANK<select id="enchanter-ui-rewrite-rank"><option value="1">I</option><option value="2">II</option><option value="3">III</option></select></label>
              <label id="enchanter-ui-gem-quality-wrap" hidden>GEM QUALITY AFTER REWRITE<select id="enchanter-ui-gem-quality"></select></label>
            </div>
            <section id="enchanter-ui-current" class="enchanter-ui-card"></section>
            <section id="enchanter-ui-validation" class="enchanter-ui-card"></section>
          </main>
          <aside class="enchanter-ui-preview">
            <h3>PREVIEW</h3>
            <div id="enchanter-ui-preview-content"></div>
          </aside>
        </div>
        <footer class="enchanter-ui-footer">
          <div id="enchanter-ui-status">READY</div>
          <label id="enchanter-ui-destruction-wrap" class="enchanter-ui-confirm" hidden><input id="enchanter-ui-confirm-destruction" type="checkbox"> CONFIRMO LA DESTRUCCIÓN IRREVERSIBLE DEL ITEM</label>
          <label class="enchanter-ui-confirm"><input id="enchanter-ui-confirm" type="checkbox"> CONFIRM SERVICE</label>
          <button id="enchanter-ui-commit" type="button">COMMIT</button>
        </footer>
      </div>`;
    doc.body.appendChild(root);
    root.querySelector(".enchanter-ui-close")?.addEventListener("click",close);
    root.addEventListener("click",event=>{if(event.target===root) close();});
    root.querySelector("#enchanter-ui-service")?.addEventListener("change",event=>{if(state.pending) return;invalidateConfirmation();state.service=event.target.value;state.definitionId=null;state.gem=null;state.anchorId=null;state.rewriteProcedure=null;state.nextDefinitionId=null;state.gemQualityAfter=null;render();});
    root.querySelector("#enchanter-ui-enchantment")?.addEventListener("change",event=>{if(state.pending) return;invalidateConfirmation();state.definitionId=event.target.value;state.rewriteProcedure=null;state.nextDefinitionId=null;state.gemQualityAfter=null;render();});
    root.querySelector("#enchanter-ui-rank")?.addEventListener("change",event=>{if(state.pending) return;invalidateConfirmation();state.rank=Math.max(1,Math.min(3,Number(event.target.value)||1));render();});
    root.querySelector("#enchanter-ui-gem")?.addEventListener("change",event=>{if(state.pending) return;invalidateConfirmation();state.gem=state.items.find(item=>itemId(item)===event.target.value)||null;render();});
    root.querySelector("#enchanter-ui-anchor")?.addEventListener("change",event=>{if(state.pending) return;invalidateConfirmation();state.anchorId=event.target.value||null;render();});
    root.querySelector("#enchanter-ui-procedure")?.addEventListener("change",event=>{if(state.pending)return;invalidateConfirmation();state.rewriteProcedure=event.target.value;render();});
    root.querySelector("#enchanter-ui-replacement")?.addEventListener("change",event=>{if(state.pending)return;invalidateConfirmation();state.nextDefinitionId=event.target.value;render();});
    root.querySelector("#enchanter-ui-rewrite-rank")?.addEventListener("change",event=>{if(state.pending)return;invalidateConfirmation();state.rewriteRank=Number(event.target.value)||1;render();});
    root.querySelector("#enchanter-ui-gem-quality")?.addEventListener("change",event=>{if(state.pending)return;invalidateConfirmation();state.gemQualityAfter=event.target.value||null;render();});
    root.querySelector("#enchanter-ui-commit")?.addEventListener("click",commit);
    return root;
  }

  function serviceList(){
    const ids=asArray(state.provider?.services);
    return ids.filter(id=>services()?.SERVICE_IDS?.includes?.(id));
  }

  function installed(item){
    return engine()?.appliedEnchantments?.(item) || [];
  }

  function selectedDefinitionOptions(){
    const svc=state.service;
    if(["strengthen","remove_rewrite"].includes(svc)){
      const view=state.selectedItem && state.viewer
        ? magicKnowledge()?.presentation?.(state.viewer,state.selectedItem) : null;
      if(view?.magicDetected!==true) return [];
      return installed(state.selectedItem).map((ref,index)=>{
        const def=catalog()?.get?.(ref.definitionId);
        // Player visibility follows Identify/Arcana knowledge, never raw registry data.
        const known=view?.enchantmentLines?.[index]?.known===true;
        const label=view?.enchantmentLines?.[index]?.text || `Inscripción sin identificar ${index+1}`;
        return def ? {id:def.id,key:ref.anchorId?`anchor:${ref.anchorId}`:`direct:${index}`,
          name:known?label:`Inscripción sin identificar ${index+1}`,
          rank:ref.rank,displayRank:known&&view?.knowledge?.rankKnown===true?ref.rank:null,ref} : null;
      }).filter(Boolean);
    }
    return asArray(state.provider?.knownEnchantments).map(id=>catalog()?.get?.(id)).filter(Boolean).map(def=>({id:def.id,name:def.name}));
  }

  function eligibleForService(item){
    if(!item) return {eligible:false,reason:"missing_item"};
    const svc=state.service;
    if(["enchant","bind","curse","mount_gem"].includes(svc)){
      if(!catalog()?.ELIGIBLE_ITEM_KINDS?.includes?.(kindOf(item))) return {eligible:false,reason:"ineligible_equipment_kind"};
      if((engine()?.baseSlotCapacity?.(item) ?? 0)<=0 && svc!=="mount_gem") return {eligible:false,reason:"base_enchantment_slots_exceeded"};
      return {eligible:true};
    }
    if(["strengthen","remove_rewrite"].includes(svc)){
      const detected=magicKnowledge()?.presentation?.(state.viewer,item)?.magicDetected===true;
      if(!detected) return {eligible:false,reason:"magic_not_detected"};
      return installed(item).length ? {eligible:true}:{eligible:false,reason:"enchantment_not_installed"};
    }
    if(["identify","curse_analysis","remove_curse","magical_repair","extract_gem"].includes(svc)){
      // Eligibility is visible before the Player pays or studies Arcana.
      // Never partition unknown objects using the true isMagicItem/anchor state.
      const detected=magicKnowledge()?.presentation?.(state.viewer,item)?.magicDetected===true;
      if(!detected) return {eligible:true};
      if(svc==="extract_gem" && !(engine()?.gemAnchors?.(item)?.length))
        return {eligible:false,reason:"gem_anchor_not_found"};
      return {eligible:true};
    }
    return {eligible:true};
  }

  function materialsForTransaction(){
    // Escrowed Items exist only in service-job cards, never as consumable inputs.
    return allViewerItems(state.viewer).filter(item=>
      itemId(item)!==itemId(state.selectedItem)
      && itemId(item)!==itemId(state.gem));
  }

  function definitionChoice(){
    const opts=selectedDefinitionOptions();
    if(!state.definitionId && opts.length) state.definitionId=opts[0].key || opts[0].id;
    return opts.find(entry=>(entry.key || entry.id)===state.definitionId) || opts[0] || null;
  }

  function gemOptions(){
    return allViewerItems(state.viewer).filter(item=>{
      const id=String(item.definitionId || item.id || "");
      return Boolean(gems()?.gemMagicProfile?.(id)) && item!==state.selectedItem;
    });
  }

  function anchors(){
    // Socket counts are themselves hidden magical information.
    if(magicKnowledge()?.presentation?.(state.viewer,state.selectedItem)?.magicDetected!==true)
      return [];
    return engine()?.gemAnchors?.(state.selectedItem) || [];
  }

  function buildQuote(){
    const svc=state.service;
    const S=services();
    if(!S || !state.selectedItem || !svc) return {quoted:false,reason:"missing_selection"};
    const playerMaterials=materialsForTransaction();
    // Shop-provider stock is in a separate Firebase subtree and cannot be
    // atomically spent here. Never quote a Player service using that stock.
    const common={playerMaterials,providerMaterials:[],recipeProvided:false};
    const choice=definitionChoice();

    if(["enchant","bind","curse","mount_gem"].includes(svc)){
      if(!choice) return {quoted:false,reason:"provider_does_not_know_recipe"};
      if(svc==="mount_gem" && !state.gem) return {quoted:false,reason:"gem_anchor_required"};
      return S.quoteEnchantService(state.provider,state.selectedItem,choice.id,state.rank,{
        ...common,serviceId:svc,gem:svc==="mount_gem"?state.gem:null,
      });
    }
    if(svc==="strengthen"){
      if(!choice) return {quoted:false,reason:"enchantment_not_installed"};
      return S.quoteStrengthenService(state.provider,state.selectedItem,choice.id,Number(choice.rank)+1,common);
    }
    if(["magical_repair","remove_curse","extract_gem"].includes(svc)
       && magicKnowledge()?.presentation?.(state.viewer,state.selectedItem)?.magicDetected!==true)
      return {quoted:false,reason:"magic_not_detected"};
    if(svc==="magical_repair") return S.quoteMagicalRepair(state.provider,state.selectedItem,common);
    if(["identify","curse_analysis","remove_curse"].includes(svc)) return S.quoteFixedService(state.provider,svc,common);
    if(svc==="remove_rewrite"){
      if(!choice)return {quoted:false,reason:"enchantment_not_installed"};
      const gemAnchored=choice.ref?.source==="gem";
      const procedure=state.rewriteProcedure || (gemAnchored?"item_side_remove":"direct_remove");
      if(gemAnchored){
        if(!["item_side_remove","rewrite"].includes(procedure))
          return {quoted:false,reason:"gem_anchored_enchantment_requires_anchor_procedure"};
        return S.quoteGemProcedure(state.provider,state.selectedItem,choice.ref.anchorId,procedure,{
          ...common,nextDefinitionId:procedure==="rewrite"?state.nextDefinitionId:null,
          rank:state.rewriteRank,
          gemQualityAfter:state.gemQualityAfter || state.provider?.gemQualityAfter ||
            state.provider?.safeExtractionGemQuality || null,
        });
      }
      if(procedure==="direct_rewrite"){
        if(!state.nextDefinitionId)return {quoted:false,reason:"replacement_enchantment_required"};
        return S.quoteDirectRewriteService(state.provider,state.selectedItem,choice.id,
          state.nextDefinitionId,{...common,rank:state.rewriteRank});
      }
      if(procedure!=="direct_remove")return {quoted:false,reason:"unknown_rewrite_procedure"};
      const gate=engine()?.canRemoveEnchantment?.(state.selectedItem,choice.id);
      if(!gate?.allowed)return {quoted:false,reason:gate?.reason || "enchantment_not_removable"};
      const fixed=S.quoteFixedService(state.provider,"remove_rewrite",common);
      return fixed.quoted?{...fixed,definitionId:choice.id,procedure:"direct_remove"}:fixed;
    }
    if(svc==="extract_gem"){
      const list=anchors();
      if(!state.anchorId && list.length) state.anchorId=list[0].anchorId;
      return S.quoteGemProcedure(state.provider,state.selectedItem,state.anchorId,"safe_extract",{
        ...common,
        gemQualityAfter:state.provider?.gemQualityAfter || state.provider?.safeExtractionGemQuality || null,
      });
    }
    return {quoted:false,reason:"unknown_service"};
  }

  function currentCard(){
    const item=state.selectedItem;
    if(!item) return "<p>Select an Item.</p>";
    const refs=installed(item);
    const slots=item.magic?.enchantmentSlots || {used:engine()?.slotsUsed?.(refs)||0,max:engine()?.baseSlotCapacity?.(item)||0};
    const view=magicKnowledge()?.presentation?.(state.viewer,item);
    if(view?.magicDetected!==true) {
      return `<h4>${esc(itemName(item))}</h4><p>Inscripciones mágicas no detectadas.</p>`;
    }
    const rows=refs.length ? refs.map((ref,index)=>{
      const line=view?.enchantmentLines?.[index];
      const label=line?.text || `Inscripción sin identificar ${index+1}`;
      return `<li><b>${esc(label)}</b></li>`;
    }).join("") : "<li>No installed Enchantments.</li>";
    return `<h4>${esc(itemName(item))}</h4><div class="enchanter-ui-slotbar"><span>SLOTS ${esc(slots.used)} / ${esc(slots.max)}</span></div><ul>${rows}</ul>`;
  }

  function pendingJobForItem(item){
    return providerJobs().find(job=>job.itemInstanceId===itemId(item)) || null;
  }
  function renderItems(){
    const good=state.items.filter(item=>pendingJobForItem(item) || eligibleForService(item).eligible);
    const bad=state.items.filter(item=>!pendingJobForItem(item) && !eligibleForService(item).eligible);
    if(!state.selectedItem || !good.includes(state.selectedItem)) {
      invalidateConfirmation();
      state.selectedItem=good[0] || null;
    }
    const host=doc.getElementById("enchanter-ui-item-list");
    const unavailable=doc.getElementById("enchanter-ui-item-unavailable");
    if(host) host.innerHTML=good.length ? good.map((item,index)=>`<button type="button" data-enchanter-item="${index}" class="${item===state.selectedItem?"active":""}"><strong>${esc(itemName(item))}</strong><span>${esc(pendingJobForItem(item)?"EN SERVICIO":humanize(kindOf(item)))}</span></button>`).join("") : "<p>No eligible Items.</p>";
    if(unavailable) unavailable.innerHTML=bad.map(item=>`<div class="enchanter-ui-disabled"><strong>${esc(itemName(item))}</strong><span>${esc(reasonText(eligibleForService(item).reason))}</span></div>`).join("") || "<p>None.</p>";
    host?.querySelectorAll("[data-enchanter-item]").forEach(button=>button.addEventListener("click",()=>{
      if(state.pending) return;
      invalidateConfirmation();
      state.selectedItem=good[Number(button.dataset.enchanterItem)] || null;
      state.definitionId=null;state.gem=null;state.anchorId=null;state.rewriteProcedure=null;state.nextDefinitionId=null;state.gemQualityAfter=null;render();
    }));
  }

  function renderControls(){
    const serviceSelect=doc.getElementById("enchanter-ui-service");
    const serviceIds=serviceList();
    if(!state.service || !serviceIds.includes(state.service)) state.service=serviceIds[0] || null;
    if(serviceSelect){
      serviceSelect.innerHTML=serviceIds.map(id=>`<option value="${esc(id)}">${esc(services()?.SERVICE_LABELS?.[id] || humanize(id))}</option>`).join("");
      serviceSelect.value=state.service || "";
    }

    const options=selectedDefinitionOptions();
    const defSelect=doc.getElementById("enchanter-ui-enchantment");
    const defWrap=doc.getElementById("enchanter-ui-enchantment-wrap");
    const needsDef=["enchant","bind","curse","mount_gem","strengthen","remove_rewrite"].includes(state.service);
    if(defWrap) defWrap.hidden=!needsDef;
    if(needsDef && defSelect){
      if(!state.definitionId || !options.some(x=>(x.key || x.id)===state.definitionId))
        state.definitionId=options[0]?.key || options[0]?.id || null;
      defSelect.innerHTML=options.map(entry=>`<option value="${esc(entry.key || entry.id)}">${esc(entry.name)}${entry.displayRank?` · ${esc(roman(entry.displayRank))}`:""}</option>`).join("");
      defSelect.value=state.definitionId || "";
    }

    const rankWrap=doc.getElementById("enchanter-ui-rank-wrap");
    const needsRank=["enchant","bind","curse","mount_gem"].includes(state.service);
    if(rankWrap) rankWrap.hidden=!needsRank;
    const rankSelect=doc.getElementById("enchanter-ui-rank");
    if(rankSelect){
      [...rankSelect.options].forEach(option=>option.disabled=Number(option.value)>Number(state.provider?.maxRank || 1));
      if(state.rank>Number(state.provider?.maxRank || 1)) state.rank=Number(state.provider?.maxRank || 1);
      rankSelect.value=String(state.rank);
    }

    const gemWrap=doc.getElementById("enchanter-ui-gem-wrap");
    const gemSelect=doc.getElementById("enchanter-ui-gem");
    const needGem=state.service==="mount_gem";
    if(gemWrap) gemWrap.hidden=!needGem;
    if(needGem && gemSelect){
      const opts=gemOptions();
      if(!state.gem || !opts.includes(state.gem)) state.gem=opts[0] || null;
      gemSelect.innerHTML=opts.map(item=>`<option value="${esc(itemId(item))}">${esc(itemName(item))}</option>`).join("");
      gemSelect.value=state.gem?itemId(state.gem):"";
    }

    const anchorWrap=doc.getElementById("enchanter-ui-anchor-wrap");
    const anchorSelect=doc.getElementById("enchanter-ui-anchor");
    const needAnchor=state.service==="extract_gem";
    if(anchorWrap) anchorWrap.hidden=!needAnchor;
    if(needAnchor && anchorSelect){
      const list=anchors();
      if(!state.anchorId || !list.some(a=>a.anchorId===state.anchorId)) state.anchorId=list[0]?.anchorId || null;
      anchorSelect.innerHTML=list.map((anchor,index)=>{
        const profile=gems()?.gemMagicProfile?.(anchor.gemDefinitionId);
        const label=profile?.displayName || humanize(anchor.gemDefinitionId || `Gem ${index+1}`);
        return `<option value="${esc(anchor.anchorId)}">${esc(label)} · ${esc(humanize(anchor.gemQuality))}</option>`;
      }).join("");
      anchorSelect.value=state.anchorId || "";
    }

    const rewriting=state.service==="remove_rewrite";
    const current=rewriting?definitionChoice():null;
    const gemAnchored=current?.ref?.source==="gem";
    const procedures=gemAnchored
      ? [["item_side_remove","Extraer gema · reescritura en Item"],["rewrite","Reescribir encantamiento de gema"]]
      : [["direct_remove","Retirar encantamiento"],["direct_rewrite","Reemplazar encantamiento"]];
    if(rewriting && (!state.rewriteProcedure || !procedures.some(([id])=>id===state.rewriteProcedure))){
      state.rewriteProcedure=procedures[0][0];
      state.nextDefinitionId=null;state.gemQualityAfter=null;
    }
    const procedureWrap=doc.getElementById("enchanter-ui-procedure-wrap");
    const procedureSelect=doc.getElementById("enchanter-ui-procedure");
    if(procedureWrap) procedureWrap.hidden=!rewriting;
    if(rewriting && procedureSelect){
      procedureSelect.innerHTML=procedures.map(([id,label])=>
        `<option value="${esc(id)}">${esc(label)}</option>`).join("");
      procedureSelect.value=state.rewriteProcedure;
    }
    const replacing=rewriting && ["direct_rewrite","rewrite"].includes(state.rewriteProcedure);
    const replacementWrap=doc.getElementById("enchanter-ui-replacement-wrap");
    const replacementSelect=doc.getElementById("enchanter-ui-replacement");
    if(replacementWrap)replacementWrap.hidden=!replacing;
    if(replacing && replacementSelect){
      const known=asArray(state.provider?.knownEnchantments)
        .map(id=>catalog()?.get?.(id)).filter(Boolean);
      if(!known.some(def=>def.id===state.nextDefinitionId))state.nextDefinitionId=null;
      replacementSelect.innerHTML='<option value="">SELECCIONA...</option>'+
        known.map(def=>`<option value="${esc(def.id)}">${esc(def.name)}</option>`).join("");
      replacementSelect.value=state.nextDefinitionId || "";
    }
    const rewriteRankWrap=doc.getElementById("enchanter-ui-rewrite-rank-wrap");
    const rewriteRankSelect=doc.getElementById("enchanter-ui-rewrite-rank");
    if(rewriteRankWrap)rewriteRankWrap.hidden=!replacing;
    if(replacing && rewriteRankSelect){
      const maxRank=Number(state.provider?.maxRank || 1);
      if(state.rewriteRank>maxRank || state.rewriteRank<1)
        state.rewriteRank=Math.min(maxRank,Number(current?.rank)||1);
      [...rewriteRankSelect.options].forEach(option=>option.disabled=Number(option.value)>maxRank);
      rewriteRankSelect.value=String(state.rewriteRank);
    }
    const qualityNeeded=rewriting && gemAnchored;
    const qualityWrap=doc.getElementById("enchanter-ui-gem-quality-wrap");
    const qualitySelect=doc.getElementById("enchanter-ui-gem-quality");
    if(qualityWrap)qualityWrap.hidden=!qualityNeeded;
    if(qualityNeeded && qualitySelect){
      const grades=["ruined","poor","standard","fine","exceptional"];
      const original=engine()?.gemAnchors?.(state.selectedItem)?.find(anchor=>
        anchor.anchorId===current?.ref?.anchorId)?.gemQuality;
      const oldGrade=grades.indexOf(original);
      const catalogGrades=gems()?.GEM_STABLE_RANK_BY_QUALITY ||
        {ruined:0,poor:1,standard:1,fine:2,exceptional:3};
      const choices=grades.filter((id,index)=>index<oldGrade &&
        Object.prototype.hasOwnProperty.call(catalogGrades,id));
      // Only show physically degraded outputs; Standard and Poor share a
      // channel Rank but Standard is still a higher-quality Gem.
      if(!choices.includes(state.gemQualityAfter))state.gemQualityAfter=null;
      if(!state.gemQualityAfter){
        const authored=state.provider?.gemQualityAfter || state.provider?.safeExtractionGemQuality;
        if(choices.includes(authored))state.gemQualityAfter=authored;
      }
      qualitySelect.innerHTML='<option value="">ELIGE CALIDAD FINAL...</option>'+
        choices.map(id=>`<option value="${esc(id)}">${esc(humanize(id))}</option>`).join("");
      qualitySelect.value=state.gemQualityAfter || "";
    }
  }

  function renderPreview(){
    const job=pendingJob();
    state.quote=job?null:buildQuote();
    const validation=doc.getElementById("enchanter-ui-validation");
    const previewHost=doc.getElementById("enchanter-ui-preview-content");
    const commitButton=doc.getElementById("enchanter-ui-commit");
    const confirm=doc.getElementById("enchanter-ui-confirm");
    const destruction=doc.getElementById("enchanter-ui-confirm-destruction");
    const destructionWrap=doc.getElementById("enchanter-ui-destruction-wrap");
    if(destructionWrap) destructionWrap.hidden=!state.quote?.destroysItem || Boolean(job);
    const needsDestruction=state.quote?.destroysItem===true && !job;
    const destructionConfirmed=!needsDestruction || destruction?.checked===true;
    const wallet=services()?.walletBalance?.(state.viewer) || {resolved:false,balance:0};
    if(job){
      const ready=services()?.serviceReady?.(job,state.worldTimestamp)===true;
      const finish=new Date(Number(job.readyAt)).toLocaleString("es");
      if(validation) validation.innerHTML=ready
        ? "<h4>LISTO PARA RETIRAR</h4><p>El trabajo del Enchanter ha terminado.</p>"
        : "<h4>EN SERVICIO</h4><p>El Item permanece con el Enchanter hasta la fecha de entrega.</p>";
      if(previewHost) previewHost.innerHTML=`<h4>${esc(services()?.SERVICE_LABELS?.[job.service] || humanize(job.service))}</h4>
        <p>Entrega: ${esc(finish)}.</p><p>Pagado al iniciar: ${esc(ahn(job.totalAhn))}.</p>`;
      if(commitButton){
        commitButton.textContent=ready?"RETIRAR ITEM":"EN PROCESO";
        commitButton.disabled=state.pending || state.saveUncertain || typeof state.onSave!=="function" || !ready || confirm?.checked!==true;
      }
      return;
    }
    if(commitButton) commitButton.textContent="CONFIRM SERVICE";

    if(!state.quote?.quoted){
      if(validation) validation.innerHTML=`<h4>BLOCKED</h4><p>${esc(reasonText(state.quote?.reason))}</p>`;
      if(previewHost) previewHost.innerHTML="<p>Resolve the blocked condition to preview this service.</p>";
      if(commitButton) commitButton.disabled=true;
      return;
    }

    const preview=services()?.playerServicePreview?.(state.viewer,state.provider,state.selectedItem,state.quote) || null;
    const persistenceReady=typeof state.onSave==="function";
    const paymentUnresolved=!wallet.resolved;
    const insufficient=wallet.resolved && wallet.balance<Number(state.quote.totalAhn || 0);
    // A projected copy is safe for this subset of services. Never run Identify,
    // Curse Analysis or other knowledge-writing actions while previewing.
    const projectable=["enchant","mount_gem","strengthen","remove_rewrite","extract_gem","magical_repair"].includes(state.service);
    let projected=null;
    if(projectable){
      try { projected=services()?.previewServiceResult?.(state.selectedItem,state.quote) || null; }
      catch (_) { projected=null; } // UI preview failure cannot commit or rewrite knowledge.
    }
    const itemAfter=projected?.previewed===true ? projected.item : null;
    const beforeSlots=engine()?.baseSlotCapacity?.(state.selectedItem);
    const afterSlots=itemAfter ? engine()?.slotsUsed?.(engine()?.appliedEnchantments?.(itemAfter)||[]) : null;
    const itemWasMagic=magic()?.isMagicItem?.(state.selectedItem)===true;
    const originalMagicVisible=!itemWasMagic ||
      magicKnowledge()?.presentation?.(state.viewer,state.selectedItem)?.magicDetected===true;
    const projectedSlots=originalMagicVisible && Number.isFinite(Number(afterSlots)) && Number.isFinite(Number(beforeSlots))
      ? `<p>Slots ocupados después del servicio: ${esc(afterSlots)} / ${esc(beforeSlots)}</p>`
      : "";
    if(validation) validation.innerHTML=state.saveUncertain
      ? `<h4>SAVE NOT CONFIRMED</h4><p class="danger">El resultado local no pudo confirmarse en la base de datos. Recarga la ficha antes de intentar pagar otra vez.</p>`
      : !persistenceReady
        ? `<h4>SERVICIO NO DISPONIBLE</h4><p class="danger">No hay una conexión de guardado segura. El Item y los AHN no serán modificados.</p>`
        : paymentUnresolved
        ? `<h4>PAYMENT</h4><p class="danger">No se pudo verificar el saldo AHN.</p>`
        : insufficient
          ? `<h4>PAYMENT</h4><p class="danger">AHN insuficiente · Se necesitan ${esc(ahn(state.quote.totalAhn))}</p>`
          : `<h4>READY</h4><p>Provider validation passed.</p>`;

    const materials=asArray(preview?.materials).map(row=>`<li>${esc(row.label)}${row.quantity!=null?` ×${esc(row.quantity)}`:""}${row.suppliedBy?` · ${esc(row.suppliedBy)}`:""}</li>`).join("");
    const effects=asArray(preview?.effects).map(text=>`<li>${esc(text)}</li>`).join("");
    const duration=preview?.duration?.hours!=null?`${preview.duration.hours} h`:(preview?.duration?.band?.label || "—");
    if(previewHost) previewHost.innerHTML=`
      <div class="enchanter-ui-price">${esc(ahn(preview?.priceAhn ?? state.quote.totalAhn))}</div>
      <dl>
        <dt>Time</dt><dd>${esc(duration)}</dd>
        <dt>Difficulty</dt><dd>${esc(preview?.difficulty?.text || "—")}</dd>
        <dt>Controlled Result</dt><dd>${esc(preview?.controlledResult?.text || "—")}</dd>
        <dt>Projected Magic</dt><dd>${preview?.projectedMagicalDurability!=null?`${esc(preview.projectedMagicalDurability)} MD`:"—"}</dd>
      </dl>
      <h4>Resultado previsto</h4>
      <p>${esc(itemName(state.selectedItem))} · ${esc(services()?.SERVICE_LABELS?.[state.service] || humanize(state.service))}</p>
      ${projectedSlots || "<p>El resultado se confirmará al ejecutar el servicio.</p>"}
      <h4>Effects</h4><ul>${effects || "<li>—</li>"}</ul>
      <h4>Materials</h4><ul>${materials || "<li>None</li>"}</ul>`;
    if(needsDestruction && validation && persistenceReady && !state.saveUncertain && !paymentUnresolved && !insufficient){
      validation.innerHTML='<h4>DESTRUCCIÓN IRREVERSIBLE</h4><p>Extraer esta gema Bound destruirá el Item. Debes confirmar la pérdida para continuar.</p>';
    }
    if(commitButton) commitButton.disabled=state.pending || state.saveUncertain || !persistenceReady || paymentUnresolved || insufficient || confirm?.checked!==true || !destructionConfirmed;
  }

  function render(){
    if(!state.open) return;
    // Choose a service-eligible Item before building the dependent definition selectors.
    renderItems();
    renderControls();
    const current=doc.getElementById("enchanter-ui-current");
    if(current) current.innerHTML=currentCard();
    renderPreview();
    const confirm=doc.getElementById("enchanter-ui-confirm");
    if(confirm && !confirm.dataset.bound){
      confirm.dataset.bound="true";
      confirm.addEventListener("change",renderPreview);
      doc.getElementById("enchanter-ui-confirm-destruction")?.addEventListener("change",renderPreview);
    }
    const status=doc.getElementById("enchanter-ui-status");
    if(status) status.textContent=state.status || (state.pending?"PROCESSING…":"READY");
  }

  async function commit(){
    const job=pendingJob();
    if(state.pending || state.saveUncertain || !state.selectedItem || (!job && !state.quote?.quoted)) return;
    const confirm=doc.getElementById("enchanter-ui-confirm");
    if(!confirm?.checked){state.status="CONFIRM SERVICE FIRST";render();return;}
    if(state.quote?.destroysItem===true
      && doc.getElementById("enchanter-ui-confirm-destruction")?.checked!==true){
      state.status="CONFIRMA LA DESTRUCCIÓN DEL ITEM";render();return;
    }
    state.pending=true;state.status="PROCESSING SERVICE…";render();
    const tx=`ui:${Date.now()}:${itemId(state.selectedItem)}:${state.service}`;
    const beforePlayer=clone(state.viewer);
    const providerMaterialsBefore=clone(state.providerMaterials);
    let locallyCommitted=false;
    let saveConfirmed=false;
    try{
      if(typeof state.onSave!=="function")
        throw new Error("El servicio no está disponible sin una conexión para guardar los cambios.");
      const common={
        transactionId:tx,
        playerMaterials:materialsForTransaction(),
        providerMaterials:[],
        providerId:state.provider?.id || null,
        provider:state.provider,
        viewer:state.viewer,
        appliedBy:state.provider?.id || state.provider?.name || "enchanter",
        locationId:state.provider?.locationId || null,
      };
      const timed=state.quote?.duration?.resolved===true && Number(state.quote.duration.hours)>0;
      if(job?.clockSource==="campaign" || timed){
        if(typeof state.getWorldTimestamp!=="function")
          throw new Error(reasonText("service_world_time_unavailable"));
        const worldTimestamp=await state.getWorldTimestamp();
        if(worldTimestamp==null || worldTimestamp==="")
          throw new Error(reasonText("service_world_time_unavailable"));
        common.worldTimestamp=worldTimestamp;
        state.worldTimestamp=worldTimestamp;
      }
      if((job || timed) && typeof state.onSave!=="function")
        throw new Error(reasonText("timed_service_requires_persistence"));
      let result;
      if(job){
        result=services().completeDeferredServiceTransaction(state.viewer,job.jobId,{
          worldTimestamp:common.worldTimestamp,
        });
      }else if(timed){
        result=services().startDeferredServiceTransaction(state.viewer,state.selectedItem,state.quote,common);
      }else{
        result=services().commitServiceTransaction(state.viewer,state.selectedItem,state.quote,{
          ...common,
          confirmDestruction:state.quote.destroysItem===true
            && doc.getElementById("enchanter-ui-confirm-destruction")?.checked===true,
        });
      }
      if(!result.committed) throw new Error(reasonText(result.reason));
      if(result.player) applyPlayerSnapshot(result.player);
      locallyCommitted=true;
      confirm.checked=false;
      // A local service receipt is not proof of persisted payment or item state.
      const persisted=await state.onSave({result,item:state.selectedItem,viewer:state.viewer,beforePlayer,providerMaterialsBefore,providerMaterialsAfter:clone(state.providerMaterials)});
      if(persisted?.snapshot) applyPlayerSnapshot(persisted.snapshot);
      saveConfirmed=true;
      state.items=serviceItems();
      state.gem=null;
      state.quote=null;
      state.status=result.started
        ? "EN SERVICIO — ENTREGA PROGRAMADA"
        : `COMPLETE // ${services()?.SERVICE_LABELS?.[result.service] || humanize(result.service)}`;
      global.dispatchEvent?.(new CustomEvent("luminous:enchanter-service-committed",{detail:{result,item:state.selectedItem}}));
    }catch(error){
      // Remote writes may have succeeded despite an ambiguous network error.
      // Do not re-charge on this page until authoritative state is reloaded.
      if(locallyCommitted && !saveConfirmed){
        restoreUnconfirmedService(beforePlayer,providerMaterialsBefore);
        state.saveUncertain=true;
      }
      state.status=locallyCommitted && !saveConfirmed
        ? "SAVE NOT CONFIRMED — RECARGA LA FICHA ANTES DE REINTENTAR"
        : `BLOCKED // ${error.message || error}`;
    }finally{
      state.pending=false;render();
    }
  }

  function open(context={}){
    if(!services() || !engine() || !catalog()) return {opened:false,reason:"enchanter_runtime_unavailable"};
    const profile=services().normalizeProviderProfile(context.provider || global.LuminousActiveEnchanterProvider || {});
    if(!profile.services.length) return {opened:false,reason:"provider_has_no_enchanter_services"};
    state.provider=profile;
    state.viewer=context.viewer || context.unit || {};
    state.unsubscribeWorldTime?.();
    state.unsubscribeWorldTime=null;
    state.worldTimestamp=null;
    state.getWorldTimestamp=typeof context.getWorldTimestamp==="function"
      ? context.getWorldTimestamp:null;
    state.items=serviceItems(context.items || allViewerItems(state.viewer));
    state.providerMaterials=asArray(context.providerMaterials || context.provider?.providerMaterials).map(item=>item);
    state.selectedItem=context.item || state.items[0] || null;
    state.service=context.service && profile.services.includes(context.service)?context.service:profile.services[0];
    state.definitionId=null;state.rank=1;state.gem=null;state.anchorId=null;state.quote=null;state.pending=false;
    state.rewriteProcedure=null;state.nextDefinitionId=null;state.rewriteRank=1;state.gemQualityAfter=null;
    // Do not clear saveUncertain across panel reopenings in this page session.
    state.onSave=context.onSave || null;state.onClose=context.onClose || null;
    state.status=state.saveUncertain?"SAVE NOT CONFIRMED — RECARGA LA FICHA ANTES DE REINTENTAR":"";
    const root=mount();
    invalidateConfirmation();
    state.open=true;
    if(typeof context.subscribeWorldTimestamp==="function"){
      state.unsubscribeWorldTime=context.subscribeWorldTimestamp(timestamp=>{
        state.worldTimestamp=timestamp;
        if(state.open && !state.pending) render();
      });
    }else if(state.getWorldTimestamp){
      Promise.resolve().then(()=>state.getWorldTimestamp()).then(timestamp=>{
        if(!state.open) return;
        state.worldTimestamp=timestamp;
        render();
      }).catch(()=>{});
    }
    root.classList.add("active");root.setAttribute("aria-hidden","false");
    const title=doc.getElementById("enchanter-ui-title");if(title) title.textContent=providerName().toUpperCase();
    render();
    return {opened:true};
  }

  function close(){
    const root=mount();
    root.classList.remove("active");root.setAttribute("aria-hidden","true");
    state.open=false;
    state.unsubscribeWorldTime?.();
    state.unsubscribeWorldTime=null;
    if(typeof state.onClose==="function") state.onClose();
  }

  global.addEventListener?.("luminous:open-enchanter",event=>open(event.detail || {}));

  global.LuminousEnchanterUi=Object.freeze({
    version:1,state,mount,open,close,render,buildQuote,eligibleForService,reasonText,
  });
})(window);
