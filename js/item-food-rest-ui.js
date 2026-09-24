(function(global){
  "use strict";
  if(global.LuminousFoodRestUi){
    if(typeof module!=="undefined"&&module.exports) module.exports=global.LuminousFoodRestUi;
    return;
  }

  const VERSION=1;
  const doc=global.document;

  function runtime(){ return global.LuminousFoodRestRuntime || null; }
  function normalizeId(value){ return String(value??"").trim().toLowerCase().replace(/[^a-z0-9]+/g,"_").replace(/^_+|_+$/g,""); }
  function escapeHtml(value){ return String(value??"").replace(/[&<>"']/g,function(ch){ return {"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[ch]; }); }
  function itemName(item){ item=item||{}; return String(item.displayName || item.name || item.nombre || item.recipeId || item.itemId || item.id || "Food"); }

  function ensureModal(){
    if(!doc) return null;
    let modal=doc.getElementById("food-rest-v1-modal");
    if(modal) return modal;
    modal=doc.createElement("div");
    modal.id="food-rest-v1-modal";
    modal.style.cssText="display:none;position:fixed;inset:0;background:rgba(0,0,0,.78);z-index:12000;align-items:center;justify-content:center;padding:16px;";
    modal.innerHTML=
      '<div style="width:min(560px,96vw);max-height:86vh;overflow:auto;background:#0b0b0b;border:1px solid #c49a00;padding:18px;box-shadow:0 0 30px #000;">'+
        '<div style="display:flex;justify-content:space-between;gap:12px;align-items:center;margin-bottom:12px;">'+
          '<div><div style="font-size:12px;color:#c49a00;letter-spacing:.12em;">CULINARY REST V1</div><h3 id="food-rest-v1-title" style="margin:4px 0;color:#fff;">REST</h3></div>'+
          '<button type="button" data-food-rest-close style="background:#222;color:#fff;border:1px solid #555;padding:7px 12px;cursor:pointer;">X</button>'+
        '</div>'+
        '<label style="display:flex;gap:8px;align-items:center;color:#ddd;margin:8px 0 14px;"><input type="radio" name="food-rest-v1-choice" value="activity" checked><span>Activity only</span></label>'+
        '<label style="display:flex;gap:8px;align-items:center;color:#ddd;margin:8px 0;"><input type="radio" name="food-rest-v1-choice" value="eat_drink"><span>Eat / Drink</span></label>'+
        '<div id="food-rest-v1-list" style="display:grid;gap:8px;margin:12px 0;"></div>'+
        '<div id="food-rest-v1-status" style="min-height:22px;color:#f0b24d;font-size:13px;margin:8px 0;"></div>'+
        '<button type="button" data-food-rest-confirm style="width:100%;padding:11px;background:#c49a00;color:#111;border:none;font-weight:700;cursor:pointer;">CONFIRM</button>'+
      '</div>';
    doc.body.appendChild(modal);
    return modal;
  }

  function openRest(unit,restType,options){
    options=options||{};
    if(!doc || !runtime()) return Promise.resolve({completed:false,reason:"food_rest_ui_unavailable"});
    const modal=ensureModal();
    const list=modal.querySelector("#food-rest-v1-list");
    const title=modal.querySelector("#food-rest-v1-title");
    const status=modal.querySelector("#food-rest-v1-status");
    const confirm=modal.querySelector("[data-food-rest-confirm]");
    const close=modal.querySelector("[data-food-rest-close]");
    const foods=runtime().listEdibleInventory(unit,{includeStash:options.includeStash!==false});
    title.textContent=normalizeId(restType).startsWith("long")?"LONG REST":"SHORT REST";
    status.textContent="";
    list.innerHTML=foods.length?foods.map(function(row,index){
      const p=row.profile||{};
      const desc=[
        p.hungerSlotsRestored?"Hunger +"+p.hungerSlotsRestored:"",
        p.hydrationSlotsRestored?"Hydration +"+p.hydrationSlotsRestored:"",
        p.spRestore?"SP +"+p.spRestore:"",
        p.culinaryEffects&&p.culinaryEffects.length?p.culinaryEffects.length+" effect(s)":""
      ].filter(Boolean).join(" · ");
      return '<label style="display:flex;gap:10px;align-items:center;padding:9px;border:1px solid #333;background:#111;color:#eee;">'+
        '<input type="radio" name="food-rest-v1-food" value="'+index+'">'+
        '<span style="flex:1;"><strong>'+escapeHtml(itemName(row.item))+'</strong><br><small style="color:#aaa;">'+escapeHtml(desc||"Food")+' · '+escapeHtml(row.containerType)+'</small></span>'+
      '</label>';
    }).join(""):'<div style="color:#888;padding:8px;border:1px dashed #333;">No edible food in accessible inventory.</div>';

    modal.style.display="flex";
    return new Promise(function(resolve){
      function cleanup(){
        modal.style.display="none";
        confirm.onclick=null;
        close.onclick=null;
      }
      close.onclick=function(){ cleanup(); resolve({completed:false,reason:"cancelled"}); };
      confirm.onclick=async function(){
        const choice=(modal.querySelector('input[name="food-rest-v1-choice"]:checked')||{}).value || "activity";
        let foodRef=null;
        if(choice==="eat_drink"){
          const selected=modal.querySelector('input[name="food-rest-v1-food"]:checked');
          if(!selected){ status.textContent="Select food or choose Activity only."; return; }
          const row=foods[Number(selected.value)];
          foodRef=row?(row.key || row.item):null;
        }
        const result=runtime().performRest(unit,restType,Object.assign({},options,{choice:choice,foodRef:foodRef}));
        if(!result.completed){ status.textContent=String(result.reason||"Rest blocked").replaceAll("_"," ").toUpperCase(); return; }
        try { if(options.onComplete) await options.onComplete(result,unit); }
        catch(error){ status.textContent="SAVE ERROR // "+(error&&error.message||error); return; }
        cleanup();
        resolve(result);
      };
    });
  }

  const API=Object.freeze({VERSION:VERSION,ensureModal:ensureModal,openRest:openRest});
  global.LuminousFoodRestUi=API;
  if(typeof module!=="undefined"&&module.exports) module.exports=API;
})(typeof window!=="undefined"?window:globalThis);
