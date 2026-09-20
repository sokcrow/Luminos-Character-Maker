(function(global){
  "use strict";
  if(global.LuminousCookingUi){
    if(typeof module!=="undefined"&&module.exports) module.exports=global.LuminousCookingUi;
    return;
  }
  const VERSION=1;
  const doc=global.document;
  function cookingRuntime(){ return global.LuminousCookingRuntime || null; }
  function catalog(){ return global.LuminousCookingRecipeCatalog || null; }
  function resolver(){ return global.LuminousCookingRecipeResolver || null; }
  function equipment(){ return global.LuminousCookingEquipmentEngine || null; }
  function hud(){ return global.LuminousInventoryHudV2 || null; }
  function esc(value){ return String(value??"").replace(/[&<>"']/g,function(ch){ return {"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[ch]; }); }
  function unit(){ return hud()?.state?.unit || global.currentPlayerData || global.datosJugador || null; }

  function ensureUi(){
    if(!doc) return null;
    let launch=doc.getElementById("inventory-v2-cook-button");
    if(!launch){
      const tabs=doc.querySelector("#inventory-modal .inventory-tabs");
      if(tabs){
        launch=doc.createElement("button");
        launch.type="button";
        launch.id="inventory-v2-cook-button";
        launch.className="inv-tab-btn";
        launch.textContent="COOK";
        launch.addEventListener("click",function(event){ event.preventDefault(); event.stopPropagation(); open(); });
        tabs.appendChild(launch);
      }
    }
    let modal=doc.getElementById("cooking-v1-modal");
    if(modal) return modal;
    modal=doc.createElement("div");
    modal.id="cooking-v1-modal";
    modal.style.cssText="display:none;position:fixed;inset:0;background:rgba(0,0,0,.82);z-index:12100;align-items:center;justify-content:center;padding:16px;";
    modal.innerHTML=
      '<div style="width:min(760px,97vw);max-height:90vh;overflow:auto;background:#090909;border:1px solid #c49a00;padding:18px;color:#eee;">'+
        '<div style="display:flex;justify-content:space-between;align-items:center;gap:12px;"><div><small style="color:#c49a00;letter-spacing:.13em;">COOKING V1</small><h3 style="margin:3px 0;">Recipe Execution</h3></div><button type="button" data-cook-close style="background:#222;color:#fff;border:1px solid #555;padding:7px 12px;">X</button></div>'+
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:14px 0;">'+
          '<label>Recipe<select id="cooking-v1-recipe" style="width:100%;background:#111;color:#fff;border:1px solid #444;padding:8px;"></select></label>'+
          '<label>Station<select id="cooking-v1-station" style="width:100%;background:#111;color:#fff;border:1px solid #444;padding:8px;"></select></label>'+
        '</div>'+
        '<div id="cooking-v1-preview" style="border:1px solid #333;background:#101010;padding:10px;min-height:80px;"></div>'+
        '<label style="display:block;margin-top:12px;">Cooking Check Result<input id="cooking-v1-check" type="number" value="10" style="width:100%;box-sizing:border-box;background:#111;color:#fff;border:1px solid #444;padding:9px;font-size:20px;"></label>'+
        '<div id="cooking-v1-status" style="min-height:24px;color:#f0b24d;margin:10px 0;"></div>'+
        '<button type="button" data-cook-confirm style="width:100%;padding:11px;background:#c49a00;border:none;color:#111;font-weight:800;">COOK</button>'+
      '</div>';
    doc.body.appendChild(modal);
    modal.querySelector("[data-cook-close]").addEventListener("click",function(){ modal.style.display="none"; });
    modal.querySelector("#cooking-v1-recipe").addEventListener("change",renderPreview);
    modal.querySelector("#cooking-v1-station").addEventListener("change",renderPreview);
    modal.querySelector("[data-cook-confirm]").addEventListener("click",execute);
    return modal;
  }

  function craftable(){
    const u=unit();
    if(!u || !resolver() || !catalog()) return [];
    const view=cookingRuntime()?.inventoryView?.(u,{includeStash:true});
    if(!view) return [];
    return resolver().craftableRecipes(view.rows);
  }

  function fillOptions(modal){
    const recipes=craftable();
    const recipeSel=modal.querySelector("#cooking-v1-recipe");
    recipeSel.innerHTML=recipes.length
      ? recipes.map(function(row){ return '<option value="'+esc(row.recipeId)+'">'+esc(row.recipe.name)+'</option>'; }).join("")
      : '<option value="">No craftable recipes</option>';
    const stationSel=modal.querySelector("#cooking-v1-station");
    const stations=equipment()?.STATIONS || {};
    stationSel.innerHTML='<option value="">No station / improvised</option>'+Object.values(stations).map(function(row){
      return '<option value="'+esc(row.id)+'">'+esc(row.label)+'</option>';
    }).join("");
  }

  function renderPreview(){
    const modal=ensureUi();
    const u=unit();
    const recipeId=modal.querySelector("#cooking-v1-recipe").value;
    const stationId=modal.querySelector("#cooking-v1-station").value;
    const host=modal.querySelector("#cooking-v1-preview");
    if(!u || !recipeId){ host.innerHTML="No craftable recipe selected."; return; }
    const result=cookingRuntime().previewCook(u,recipeId,{includeStash:true,equipment:{stationId:stationId}});
    if(!result.valid){ host.innerHTML='<b>BLOCKED</b> // '+esc(result.reason); return; }
    const eq=result.equipment||{};
    const missing=[
      ...(eq.missingToolIds||[]).map(function(x){return "Tool: "+x;}),
      ...(eq.missingStationIds||[]).map(function(x){return "Station: "+x;})
    ];
    host.innerHTML=
      '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;">'+
        '<div><small>RECIPE TH</small><br><b>'+result.recipeTh+'</b></div>'+
        '<div><small>EFFECTIVE TH</small><br><b>'+result.effectiveTh+'</b></div>'+
        '<div><small>MISMATCH</small><br><b>'+Number(eq.improperEquipmentCount||0)+'</b></div>'+
      '</div>'+
      '<div style="margin-top:8px;color:#aaa;">'+(missing.length?esc(missing.join(" · ")):"Equipment valid")+'</div>'+
      '<div style="margin-top:6px;color:#888;">Ingredients: '+esc(result.concreteRecipe.ingredients.map(function(x){return (x.displayName||x.name||x.itemId||x.id)+" ["+(x.role||"major")+"]";}).join(", "))+'</div>';
  }

  async function execute(){
    const modal=ensureUi();
    const u=unit();
    const recipeId=modal.querySelector("#cooking-v1-recipe").value;
    const stationId=modal.querySelector("#cooking-v1-station").value;
    const check=Number(modal.querySelector("#cooking-v1-check").value);
    const status=modal.querySelector("#cooking-v1-status");
    if(!u || !recipeId || !Number.isFinite(check)){ status.textContent="Recipe and Check Result are required."; return; }
    const result=cookingRuntime().executeCook(u,recipeId,check,{includeStash:true,equipment:{stationId:stationId}});
    if(!result.cooked){ status.textContent="BLOCKED // "+String(result.reason||"cook_failed").replaceAll("_"," ").toUpperCase(); return; }
    try {
      const peer=hud()?.state?.peer;
      if(peer?.save) await peer.save(u);
    } catch(error){ status.textContent="COOKED, SAVE ERROR // "+(error?.message||error); return; }
    status.textContent="COOKED // "+result.item.displayName+" // "+result.item.stars+"★ // Taste "+result.item.taste+" // ₳"+(result.item.productionValueAhn??"—");
    hud()?.renderAll?.();
    fillOptions(modal);
    renderPreview();
  }

  function open(){
    const modal=ensureUi();
    if(!modal) return false;
    fillOptions(modal);
    modal.style.display="flex";
    renderPreview();
    return true;
  }

  function boot(){ ensureUi(); return true; }
  if(doc){
    if(doc.readyState==="loading") doc.addEventListener("DOMContentLoaded",boot,{once:true});
    else boot();
  }
  const API=Object.freeze({VERSION:VERSION,boot:boot,open:open,craftable:craftable,renderPreview:renderPreview});
  global.LuminousCookingUi=API;
  if(typeof module!=="undefined"&&module.exports) module.exports=API;
})(typeof window!=="undefined"?window:globalThis);
