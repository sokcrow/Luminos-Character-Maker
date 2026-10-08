(function(global){
  "use strict";
  if(global.LuminousEnchanterUi) return;
  const doc=global.document;
  if(!doc) return;

  const state={
    open:false,provider:null,viewer:null,items:[],providerMaterials:[],selectedItem:null,
    service:null,definitionId:null,rank:1,gem:null,anchorId:null,quote:null,pending:false,
    onSave:null,onClose:null,status:"",
  };

  const services=()=>global.LuminousItemEnchanterServiceRuntime || null;
  const engine=()=>global.LuminousItemEnchantmentEngine || null;
  const catalog=()=>global.LuminousEnchantmentCatalog || null;
  const magic=()=>global.LuminousItemMagicRuntime || null;
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
    removable_curse_not_found:"No hay una Maldición removible en este Item.",
    relic_drawback_inseparable:"Ese drawback de Reliquia es inseparable.",
  });

  function reasonText(reason){
    return reasonLabels[reason] || humanize(reason || "No disponible");
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
          <label class="enchanter-ui-confirm"><input id="enchanter-ui-confirm" type="checkbox"> CONFIRM SERVICE</label>
          <button id="enchanter-ui-commit" type="button">COMMIT</button>
        </footer>
      </div>`;
    doc.body.appendChild(root);
    root.querySelector(".enchanter-ui-close")?.addEventListener("click",close);
    root.addEventListener("click",event=>{if(event.target===root) close();});
    root.querySelector("#enchanter-ui-service")?.addEventListener("change",event=>{state.service=event.target.value;state.definitionId=null;state.gem=null;state.anchorId=null;render();});
    root.querySelector("#enchanter-ui-enchantment")?.addEventListener("change",event=>{state.definitionId=event.target.value;render();});
    root.querySelector("#enchanter-ui-rank")?.addEventListener("change",event=>{state.rank=Math.max(1,Math.min(3,Number(event.target.value)||1));render();});
    root.querySelector("#enchanter-ui-gem")?.addEventListener("change",event=>{state.gem=state.items.find(item=>itemId(item)===event.target.value)||null;render();});
    root.querySelector("#enchanter-ui-anchor")?.addEventListener("change",event=>{state.anchorId=event.target.value||null;render();});
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
      return installed(state.selectedItem).map(ref=>{
        const def=catalog()?.get?.(ref.definitionId);
        return def ? {id:def.id,name:def.name,rank:ref.rank,ref} : null;
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
    if(svc==="strengthen") return installed(item).length ? {eligible:true}:{eligible:false,reason:"enchantment_not_installed"};
    if(svc==="remove_rewrite") return installed(item).length ? {eligible:true}:{eligible:false,reason:"enchantment_not_installed"};
    if(["identify","curse_analysis","remove_curse","magical_repair","extract_gem"].includes(svc)){
      if(!magic()?.isMagicItem?.(item)) return {eligible:false,reason:"item_has_no_magic"};
      if(svc==="extract_gem" && !(engine()?.gemAnchors?.(item)?.length)) return {eligible:false,reason:"gem_anchor_not_found"};
      return {eligible:true};
    }
    return {eligible:true};
  }

  function materialsForTransaction(){
    return state.items.filter(item=>item!==state.selectedItem && item!==state.gem);
  }

  function definitionChoice(){
    const opts=selectedDefinitionOptions();
    if(!state.definitionId && opts.length) state.definitionId=opts[0].id;
    return opts.find(entry=>entry.id===state.definitionId) || opts[0] || null;
  }

  function gemOptions(){
    return state.items.filter(item=>{
      const id=String(item.definitionId || item.id || "");
      return Boolean(gems()?.gemMagicProfile?.(id)) && item!==state.selectedItem;
    });
  }

  function anchors(){
    return engine()?.gemAnchors?.(state.selectedItem) || [];
  }

  function buildQuote(){
    const svc=state.service;
    const S=services();
    if(!S || !state.selectedItem || !svc) return {quoted:false,reason:"missing_selection"};
    const playerMaterials=materialsForTransaction();
    const common={playerMaterials,providerMaterials:state.providerMaterials,recipeProvided:false};
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
    if(svc==="magical_repair") return S.quoteMagicalRepair(state.provider,state.selectedItem,common);
    if(["identify","curse_analysis","remove_curse"].includes(svc)) return S.quoteFixedService(state.provider,svc,common);
    if(svc==="remove_rewrite"){
      if(!choice) return {quoted:false,reason:"enchantment_not_installed"};
      const gate=engine()?.canRemoveEnchantment?.(state.selectedItem,choice.id);
      if(!gate?.allowed) return {quoted:false,reason:gate?.reason || "enchantment_not_removable"};
      const fixed=S.quoteFixedService(state.provider,"remove_rewrite",common);
      return fixed.quoted ? {...fixed,definitionId:choice.id,procedure:"direct_remove"} : fixed;
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
    const rows=refs.length ? refs.map(ref=>{
      const def=catalog()?.get?.(ref.definitionId);
      return `<li><b>${esc(def?.name || "Unknown Magic")}</b> <span>Rank ${esc(roman(ref.rank))}</span></li>`;
    }).join("") : "<li>No installed Enchantments.</li>";
    return `<h4>${esc(itemName(item))}</h4><div class="enchanter-ui-slotbar"><span>SLOTS ${esc(slots.used)} / ${esc(slots.max)}</span></div><ul>${rows}</ul>`;
  }

  function renderItems(){
    const good=state.items.filter(item=>eligibleForService(item).eligible);
    const bad=state.items.filter(item=>!eligibleForService(item).eligible);
    if(!state.selectedItem || !good.includes(state.selectedItem)) state.selectedItem=good[0] || null;
    const host=doc.getElementById("enchanter-ui-item-list");
    const unavailable=doc.getElementById("enchanter-ui-item-unavailable");
    if(host) host.innerHTML=good.length ? good.map((item,index)=>`<button type="button" data-enchanter-item="${index}" class="${item===state.selectedItem?"active":""}"><strong>${esc(itemName(item))}</strong><span>${esc(humanize(kindOf(item)))}</span></button>`).join("") : "<p>No eligible Items.</p>";
    if(unavailable) unavailable.innerHTML=bad.map(item=>`<div class="enchanter-ui-disabled"><strong>${esc(itemName(item))}</strong><span>${esc(reasonText(eligibleForService(item).reason))}</span></div>`).join("") || "<p>None.</p>";
    host?.querySelectorAll("[data-enchanter-item]").forEach(button=>button.addEventListener("click",()=>{
      state.selectedItem=good[Number(button.dataset.enchanterItem)] || null;
      state.definitionId=null;state.gem=null;state.anchorId=null;render();
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
      if(!state.definitionId || !options.some(x=>x.id===state.definitionId)) state.definitionId=options[0]?.id || null;
      defSelect.innerHTML=options.map(entry=>`<option value="${esc(entry.id)}">${esc(entry.name)}${entry.rank?` · ${esc(roman(entry.rank))}`:""}</option>`).join("");
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
  }

  function renderPreview(){
    state.quote=buildQuote();
    const validation=doc.getElementById("enchanter-ui-validation");
    const previewHost=doc.getElementById("enchanter-ui-preview-content");
    const commitButton=doc.getElementById("enchanter-ui-commit");
    const confirm=doc.getElementById("enchanter-ui-confirm");
    const wallet=services()?.walletBalance?.(state.viewer) || {resolved:false,balance:0};

    if(!state.quote?.quoted){
      if(validation) validation.innerHTML=`<h4>BLOCKED</h4><p>${esc(reasonText(state.quote?.reason))}</p>`;
      if(previewHost) previewHost.innerHTML="<p>Resolve the blocked condition to preview this service.</p>";
      if(commitButton) commitButton.disabled=true;
      return;
    }

    const preview=services()?.playerServicePreview?.(state.viewer,state.provider,state.selectedItem,state.quote) || null;
    const insufficient=wallet.resolved && wallet.balance<Number(state.quote.totalAhn || 0);
    if(validation) validation.innerHTML=insufficient
      ? `<h4>PAYMENT</h4><p class="danger">Insufficient AHN · Need ${esc(ahn(state.quote.totalAhn))}</p>`
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
      <h4>Effects</h4><ul>${effects || "<li>—</li>"}</ul>
      <h4>Materials</h4><ul>${materials || "<li>None</li>"}</ul>`;
    if(commitButton) commitButton.disabled=state.pending || insufficient || confirm?.checked!==true;
  }

  function render(){
    if(!state.open) return;
    renderControls();
    renderItems();
    renderControls();
    const current=doc.getElementById("enchanter-ui-current");
    if(current) current.innerHTML=currentCard();
    renderPreview();
    const confirm=doc.getElementById("enchanter-ui-confirm");
    if(confirm && !confirm.dataset.bound){
      confirm.dataset.bound="true";
      confirm.addEventListener("change",renderPreview);
    }
    const status=doc.getElementById("enchanter-ui-status");
    if(status) status.textContent=state.status || (state.pending?"PROCESSING…":"READY");
  }

  async function commit(){
    if(state.pending || !state.quote?.quoted || !state.selectedItem) return;
    const confirm=doc.getElementById("enchanter-ui-confirm");
    if(!confirm?.checked){state.status="CONFIRM SERVICE FIRST";render();return;}
    state.pending=true;state.status="PROCESSING SERVICE…";render();
    const tx=`ui:${Date.now()}:${itemId(state.selectedItem)}:${state.service}`;
    try{
      const result=services().commitServiceTransaction(state.viewer,state.selectedItem,state.quote,{
        transactionId:tx,
        playerMaterials:materialsForTransaction(),
        providerMaterials:state.providerMaterials,
        providerId:state.provider?.id || null,
        viewer:state.viewer,
        appliedBy:state.provider?.id || state.provider?.name || "enchanter",
        locationId:state.provider?.locationId || null,
      });
      if(!result.committed) throw new Error(reasonText(result.reason));
      state.status=`COMPLETE // ${services()?.SERVICE_LABELS?.[state.service] || humanize(state.service)}`;
      confirm.checked=false;
      if(typeof state.onSave==="function") await state.onSave({result,item:state.selectedItem,viewer:state.viewer});
      global.dispatchEvent?.(new CustomEvent("luminous:enchanter-service-committed",{detail:{result,item:state.selectedItem}}));
    }catch(error){
      state.status=`BLOCKED // ${error.message || error}`;
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
    state.items=context.items || allViewerItems(state.viewer);
    state.providerMaterials=asArray(context.providerMaterials || context.provider?.providerMaterials).map(item=>item);
    state.selectedItem=context.item || state.items[0] || null;
    state.service=context.service && profile.services.includes(context.service)?context.service:profile.services[0];
    state.definitionId=null;state.rank=1;state.gem=null;state.anchorId=null;state.quote=null;state.pending=false;
    state.onSave=context.onSave || null;state.onClose=context.onClose || null;state.status="";
    const root=mount();
    state.open=true;
    root.classList.add("active");root.setAttribute("aria-hidden","false");
    const title=doc.getElementById("enchanter-ui-title");if(title) title.textContent=providerName().toUpperCase();
    render();
    return {opened:true};
  }

  function close(){
    const root=mount();
    root.classList.remove("active");root.setAttribute("aria-hidden","true");
    state.open=false;
    if(typeof state.onClose==="function") state.onClose();
  }

  global.addEventListener?.("luminous:open-enchanter",event=>open(event.detail || {}));

  global.LuminousEnchanterUi=Object.freeze({
    version:1,state,mount,open,close,render,buildQuote,eligibleForService,reasonText,
  });
})(window);
