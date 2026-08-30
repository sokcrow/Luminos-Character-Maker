const { test, expect } = require("@playwright/test");
const path = require("path");

const HUD = path.resolve(__dirname, "../js/inventory-hud-v2.js");
const BRIDGE = path.resolve(__dirname, "../js/item-equipment-bridge.js");
const LAYOUT = path.resolve(__dirname, "../js/inventory-hud-v2-approved-layout.js");
const PERSISTENCE_BRIDGE = path.resolve(__dirname, "../js/item-equipment-v2-persistence.js");
const CSS = path.resolve(__dirname, "../css/inventory-hud-v2.css");
const APPROVED_CSS = path.resolve(__dirname, "../css/inventory-hud-v2-approved-layout.css");

async function bootHarness(page) {
  await page.setContent(`<!doctype html><html><head></head><body>
    <div id="inventory-modal" class="inventory-modal"><div class="inventory-modal-content">
      <div class="inventory-tabs">
        <button class="inv-tab-btn active" data-tab="inv-active">Inventario Activo</button>
        <button class="inv-tab-btn" data-tab="inv-stash">Stash/Alijo</button>
        <button class="inv-tab-btn" data-tab="inv-sintesis">SÍNTESIS</button>
      </div>
      <div class="inventory-body-wrapper"><div class="inventory-left-panel">
        <div class="inventory-tab-content active" id="inv-active">
          <div class="inv-grid" id="inv-active-grid">
            <div class="item-slot" data-key="blade_1">Blade</div>
            <div class="item-slot" data-key="aug_1">Augment</div>
          </div>
          <div id="equipment-panel" class="cyber-panel">
            <h3 class="cyber-panel-title">EQUIPAMIENTO TÁCTICO</h3>
            <div class="equipamiento-layout"><div class="equip-slot" data-slot-id="arma_principal">Legacy</div></div>
          </div>
        </div>
        <div class="inventory-tab-content" id="inv-stash"><div class="inv-grid" id="inv-stash-grid"></div></div>
        <div class="inventory-tab-content" id="inv-sintesis"></div>
      </div><div class="item-detail-card active" id="item-detail-card"><div id="detail-title">Item</div><div id="detail-equip-btn-container"></div></div></div>
    </div></div>
  </body></html>`);

  await page.addStyleTag({ path: CSS });
  await page.addStyleTag({ path: APPROVED_CSS });
  await page.evaluate(() => {
    const active = {
      blade_1:{instanceId:"blade_1",definitionId:"blade",nombre:"Test Workshop Blade",category:"weapon",tier:3,qualityTier:3,condition:90,conditionMax:100,quantity:1},
      aug_1:{instanceId:"aug_1",definitionId:"augment",nombre:"Soma Myofiber Reinforcement",category:"augmentation",tier:5,qualityTier:4,condition:100,conditionMax:100,quantity:1}
    };
    window.playerId="player_test";
    window.datosJugador={id:"player_test"};
    window.__active=active;
    window.__saves=[];
    window.__updates=[];
    window.db={ref(p){return{
      on(e,h){if(p==="campaña/ajustes_globales/alijo_desbloqueado")queueMicrotask(()=>h({val:()=>true}))},
      off(){},
      async update(value){window.__updates.push({path:p,value})},
      async set(value){window.__updates.push({path:p,value})}
    }}};

    const categoryOf=i=>String(i?.category||i?.tipo_categoria||"item").toLowerCase();
    const itemId=i=>String(i?.instanceId||i?.key||"");
    window.LuminousItemRuntime={
      itemId,categoryOf,
      equipmentSchema:i=>({kind:categoryOf(i),handCost:categoryOf(i)==="weapon"?1:0}),
      resolveItem:i=>({...i,displayName:i.nombre||i.name||i.definitionId}),
      getConditionState:()=>"good",
      hasFunction:()=>false,
      quantityOf:i=>Number(i.quantity??1),
      findItem(unit,ref){const wanted=typeof ref==="object"?itemId(ref):String(ref);for(const c of [unit.inventario_activo,unit.inventario_stash])for(const [k,i] of Object.entries(c||{}))if(k===wanted||itemId(i)===wanted)return i;return null},
      equipItem(unit,item){item.equipped=true;return{equipped:true,item,assignment:{partIds:["left_hand"]}}},
      unequipItem(unit,item){item.equipped=false;return{unequipped:true,item}}
    };
    window.LuminousItemInventoryRuntime={
      ...window.LuminousItemRuntime,
      activeContainer:u=>({key:"inventario_activo",value:u.inventario_activo}),
      stashContainer:u=>({key:"inventario_stash",value:u.inventario_stash}),
      findItem:(u,r)=>window.LuminousItemRuntime.findItem(u,r),
      moveItem(){return{moved:false,reason:"not_used"}}
    };
    window.LuminousItemAugmentationRuntime={
      installedAugments(unit,create=false){if(!Array.isArray(unit.augmentations)&&create)unit.augmentations=[];return{key:"augmentations",value:Array.isArray(unit.augmentations)?unit.augmentations:[]}},
      canInstallAugment(unit,item){return categoryOf(item)==="augmentation"?{allowed:true,item,body:{matchedPartIds:["torso"]}}:{allowed:false,reason:"not_augment"}},
      installAugment(unit,item){if(!Array.isArray(unit.augmentations))unit.augmentations=[];item.installed=true;item.equipped=true;unit.augmentations.push(item);return{installed:true,item}},
      removeAugment(unit,item){unit.augmentations=(unit.augmentations||[]).filter(entry=>itemId(entry)!==itemId(item));item.installed=false;item.equipped=false;return{removed:true,item}}
    };
    window.LuminousItemPersistenceRuntime={
      serializeInventoryState(unit){return{schemaVersion:2,inventario_activo:unit.inventario_activo||{},inventario_stash:unit.inventario_stash||{},equipmentRefs:{},attunedItemInstanceIds:[]}},
      restoreEquipmentRefs(unit){unit.equipment={accessories:[]};return unit.equipment},
      applyInventoryState(unit,s){unit.inventario_activo=s.inventario_activo||{};unit.inventario_stash=s.inventario_stash||{};unit.equipment={accessories:[]};return{applied:true,state:s}},
      playerPaths(pid){return{equipmentRefs:`campaña/jugadores/${pid}/itemEquipmentRefs`}},
      subscribePlayerInventory(db,pid,cb){queueMicrotask(()=>cb({schemaVersion:2,inventario_activo:window.__active,inventario_stash:{},equipmentRefs:{},attunedItemInstanceIds:[]}));return()=>{}},
      async saveInventoryState(db,pid,unit){window.__saves.push({augmentIds:(unit.augmentations||[]).map(itemId)});return{saved:true,state:{itemEquipmentRefs:{}}}}
    };
  });

  await page.addScriptTag({ path: PERSISTENCE_BRIDGE });
  await page.addScriptTag({ path: BRIDGE });
  await page.addScriptTag({ path: HUD });
  await page.addScriptTag({ path: LAYOUT });
  await page.waitForFunction(() => window.LuminousInventoryHudV2?.state?.unit && window.LuminousInventoryApprovedLayout);
}

test("approved Loadout retires legacy equipment and keeps Active Inventory as a 5x2 grid", async ({page}) => {
  await bootHarness(page);

  await expect(page.locator("#equipment-panel")).toBeHidden();
  await expect(page.locator('.inventory-v2-equipment [data-equipment-slot="shield"]')).toHaveCount(0);
  await expect(page.locator('.inventory-v2-equipment [data-equipment-slot="augment0"]')).toHaveCount(1);
  await expect(page.locator('.inventory-v2-equipment [data-equipment-slot="augment1"]')).toHaveCount(1);

  const layout = await page.evaluate(() => {
    const equipment = document.querySelector(".inventory-v2-equipment").getBoundingClientRect();
    const carry = document.querySelector(".inventory-v2-carry").getBoundingClientRect();
    const grid = document.getElementById("inv-active-grid");
    const style = getComputedStyle(grid);
    return {
      equipmentAboveCarry: equipment.top < carry.top,
      columns: style.gridTemplateColumns.split(" ").filter(Boolean).length,
      rows: style.gridTemplateRows.split(" ").filter(Boolean).length,
    };
  });

  expect(layout.equipmentAboveCarry).toBe(true);
  expect(layout.columns).toBe(5);
  expect(layout.rows).toBe(2);
});

test("visible Augment slot installs from Active and persists its reference", async ({page}) => {
  await bootHarness(page);

  await page.locator('#inv-active-grid .item-slot[data-key="aug_1"]').click();
  await page.locator('[data-equipment-slot="augment0"]').click();
  await page.waitForFunction(() => window.__saves.length > 0 && window.__updates.length > 0);

  await expect(page.locator('[data-equipment-slot="augment0"] .inventory-v2-eq-name')).toContainText("Soma Myofiber Reinforcement");

  const state = await page.evaluate(() => ({
    saves: window.__saves,
    updates: window.__updates,
    installed: (window.LuminousInventoryHudV2.state.unit.augmentations||[]).map(item=>item.instanceId),
  }));

  expect(state.installed).toContain("aug_1");
  expect(state.saves.at(-1).augmentIds).toContain("aug_1");
  const augmentUpdate = state.updates.find(entry => entry.path.endsWith("/itemEquipmentRefs"));
  expect(augmentUpdate.value.augmentIds).toContain("aug_1");
});

test("augment refs restore from realtime inventory state", async ({page}) => {
  await page.setContent("<html><body></body></html>");
  await page.evaluate(() => {
    window.LuminousItemPersistenceRuntime={
      serializeInventoryState(unit){return{schemaVersion:2,inventario_activo:unit.inventario_activo||{},inventario_stash:{},equipmentRefs:{},attunedItemInstanceIds:[]}},
      restoreEquipmentRefs(unit){unit.equipment={accessories:[]};return unit.equipment},
      applyInventoryState(unit,s){unit.inventario_activo=s.inventario_activo||{};unit.inventario_stash=s.inventario_stash||{};unit.equipment={accessories:[]};return{applied:true,state:s}},
      playerPaths(pid){return{equipmentRefs:`campaña/jugadores/${pid}/itemEquipmentRefs`}},
      async saveInventoryState(){return{saved:true,state:{itemEquipmentRefs:{}}}}
    };
  });
  await page.addScriptTag({ path: PERSISTENCE_BRIDGE });

  const restored = await page.evaluate(() => {
    const item={instanceId:"aug_restore",definitionId:"augment",category:"augmentation"};
    const unit={};
    const result=window.LuminousItemPersistenceRuntime.applyInventoryState(unit,{
      inventario_activo:{aug_restore:item},
      inventario_stash:{},
      equipmentRefs:{augmentIds:["aug_restore"]}
    });
    const serialized=window.LuminousItemPersistenceRuntime.serializeInventoryState(unit);
    return{
      applied:result.applied,
      augmentIds:serialized.equipmentRefs.augmentIds,
      installed:unit.augmentations?.[0]?.installed,
      equipped:unit.augmentations?.[0]?.equipped,
    };
  });

  expect(restored.applied).toBe(true);
  expect(restored.augmentIds).toEqual(["aug_restore"]);
  expect(restored.installed).toBe(true);
  expect(restored.equipped).toBe(true);
});
