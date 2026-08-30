const { test, expect } = require("@playwright/test");
const path = require("path");

const HUD = path.resolve(__dirname, "../js/inventory-hud-v2.js");
const BRIDGE = path.resolve(__dirname, "../js/item-equipment-bridge.js");
const CSS = path.resolve(__dirname, "../css/inventory-hud-v2.css");

async function bootHarness(page) {
  await page.setContent(`<!doctype html><html><head></head><body>
    <div id="inventory-modal" class="inventory-modal"><div class="inventory-modal-content">
      <div class="inventory-tabs">
        <button class="inv-tab-btn active" data-tab="inv-active">Inventario Activo</button>
        <button class="inv-tab-btn" data-tab="inv-stash">Stash/Alijo</button>
        <button class="inv-tab-btn" data-tab="inv-sintesis">SÍNTESIS</button>
      </div>
      <div class="inventory-body-wrapper"><div class="inventory-left-panel">
        <div class="inventory-tab-content active" id="inv-active"><div class="inv-grid" id="inv-active-grid">
          <div class="item-slot" data-key="blade_1">Blade</div><div class="item-slot" data-key="coat_1">Coat</div>
        </div></div>
        <div class="inventory-tab-content" id="inv-stash"><div class="inv-grid" id="inv-stash-grid"><div class="item-slot" data-key="med_1">Med</div></div></div>
        <div class="inventory-tab-content" id="inv-sintesis"></div>
      </div><div class="item-detail-card active" id="item-detail-card"><div id="detail-title">Item</div><div id="detail-equip-btn-container"></div></div></div>
    </div></div>
  </body></html>`);
  await page.addStyleTag({ path: CSS });
  await page.evaluate(() => {
    const active = {
      blade_1:{instanceId:"blade_1",definitionId:"blade",nombre:"Test Workshop Blade",category:"weapon",tier:3,qualityTier:3,condition:90,conditionMax:100,quantity:1},
      coat_1:{instanceId:"coat_1",definitionId:"coat",nombre:"Reinforced Coat",category:"armor",tier:2,qualityTier:2,condition:100,conditionMax:100,quantity:1}
    };
    const stash = { med_1:{instanceId:"med_1",definitionId:"med",nombre:"Medical Ampoule",category:"consumable",quantity:2,qualityTier:2,condition:100,conditionMax:100} };
    window.playerId="player_test"; window.datosJugador={id:"player_test"}; window.__active=active; window.__stash=stash; window.__saves=[];
    window.db={ref(p){return{on(e,h){if(p==="campaña/ajustes_globales/alijo_desbloqueado")queueMicrotask(()=>h({val:()=>true}))},off(){}}}};
    const categoryOf=i=>String(i?.category||i?.tipo_categoria||"item").toLowerCase(); const itemId=i=>String(i?.instanceId||i?.key||"");
    const equipmentSchema=i=>({kind:categoryOf(i),handCost:categoryOf(i)==="weapon"?1:0});
    window.LuminousItemRuntime={itemId,categoryOf,equipmentSchema,resolveItem:i=>({...i,displayName:i.nombre||i.name||i.definitionId}),getConditionState:i=>Number(i.condition??100)<=50?"damaged":"good",hasFunction:(i,f)=>f==="use"&&categoryOf(i)==="consumable",quantityOf:i=>Number(i.quantity??1),findItem(unit,ref){const wanted=typeof ref==="object"?itemId(ref):String(ref);for(const c of [unit.inventario_activo,unit.inventario_stash])for(const [k,i] of Object.entries(c||{}))if(k===wanted||itemId(i)===wanted)return i;return null},equipItem(unit,item){item.equipped=true;item.equippedPartIds=["left_hand"];return{equipped:true,item,assignment:{partIds:["left_hand"]}}},unequipItem(unit,item){item.equipped=false;item.equippedPartIds=[];return{unequipped:true,item}},useItem(unit,item){if(Number(item.quantity||0)<=0)return{used:false,reason:"empty"};item.quantity-=1;return{used:true,item}}};
    window.LuminousItemInventoryRuntime={...window.LuminousItemRuntime,activeContainer:u=>({key:"inventario_activo",value:u.inventario_activo}),stashContainer:u=>({key:"inventario_stash",value:u.inventario_stash}),moveItem(unit,ref,from,to){const source=from==="stash"?unit.inventario_stash:unit.inventario_activo,target=to==="stash"?unit.inventario_stash:unit.inventario_activo,key=Object.keys(source).find(k=>k===ref||itemId(source[k])===ref);if(!key)return{moved:false,reason:"missing"};target[key]=source[key];delete source[key];return{moved:true,item:target[key]}},findItem:(u,r)=>window.LuminousItemRuntime.findItem(u,r)};
    window.LuminousItemPersistenceRuntime={applyInventoryState(unit,s){unit.inventario_activo=s.inventario_activo;unit.inventario_stash=s.inventario_stash;unit.equipment={accessories:[]};const r=s.equipmentRefs||{};if(r.mainHand)unit.equipment.mainHand=unit.inventario_activo[r.mainHand];if(r.offHand)unit.equipment.offHand=unit.inventario_activo[r.offHand];if(r.armor)unit.equipment.armor=unit.inventario_activo[r.armor];if(r.shield)unit.equipment.shield=unit.inventario_activo[r.shield];unit.equipment.accessories=(r.accessoryIds||[]).map(id=>unit.inventario_activo[id]).filter(Boolean);return{applied:true}},subscribePlayerInventory(db,pid,cb){queueMicrotask(()=>cb({schemaVersion:2,inventario_activo:window.__active,inventario_stash:window.__stash,equipmentRefs:{},attunedItemInstanceIds:[]}));return()=>{}},async saveInventoryState(db,pid,unit){window.__saves.push({active:Object.keys(unit.inventario_activo||{}),stash:Object.keys(unit.inventario_stash||{}),mainHand:unit.equipment?.mainHand?.instanceId||null,offHand:unit.equipment?.offHand?.instanceId||null,armor:unit.equipment?.armor?.instanceId||null});return{saved:true}}};
  });
  await page.addScriptTag({ path: BRIDGE });
  await page.addScriptTag({ path: HUD });
  await page.waitForFunction(() => window.LuminousInventoryHudV2?.state?.unit);
}

test("builds Equipment above a preserved 5x2 Active Inventory grid", async ({page}) => {
  await bootHarness(page);
  await expect(page.locator(".inventory-v2-equipment")).toHaveCount(1);
  await expect(page.locator(".inventory-v2-carry")).toHaveCount(1);
  const layout=await page.locator("#inv-active-grid").evaluate(el=>({columns:getComputedStyle(el).gridTemplateColumns.split(" ").filter(Boolean).length,stack:Boolean(el.closest(".inventory-v2-active-stack")),carry:Boolean(el.closest(".inventory-v2-carry"))}));
  expect(layout.columns).toBe(5); expect(layout.stack).toBe(true); expect(layout.carry).toBe(true);
  await expect(page.locator('.inv-tab-btn[data-tab="inv-active"]')).toHaveText("LOADOUT");
});

test("equips an Active item into visible Equipment and persists it", async ({page}) => {
  await bootHarness(page);
  await page.locator('#inv-active-grid .item-slot[data-key="blade_1"]').click();
  await page.locator('[data-equipment-slot="mainHand"]').click();
  await page.waitForFunction(()=>window.__saves.length>0);
  expect((await page.evaluate(()=>window.__saves.at(-1))).mainHand).toBe("blade_1");
  await expect(page.locator('[data-equipment-slot="mainHand"] .inventory-v2-eq-name')).toContainText("Test Workshop Blade");
});

test("moves Active to Stash through runtime and persistence", async ({page}) => {
  await bootHarness(page);
  await page.locator('#inv-active-grid .item-slot[data-key="coat_1"]').click();
  const store=page.locator("#inventory-v2-actions .inventory-v2-action",{hasText:"STORE / GUARDAR"});
  await expect(store).toBeEnabled(); await store.click();
  await page.waitForFunction(()=>window.__saves.length>0);
  const saved=await page.evaluate(()=>window.__saves.at(-1));
  expect(saved.active).not.toContain("coat_1"); expect(saved.stash).toContain("coat_1");
});
