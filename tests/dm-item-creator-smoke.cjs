/* Node 22 smoke: real item engines, no Firebase access or example assets. */
const assert=require("node:assert/strict");
require("../js/item-icon-registry.js");
require("../js/item-runtime-engine.js");
require("../js/item-inventory-runtime.js");
require("../js/item-persistence-runtime.js");
require("../js/item-equipment-effects-runtime.js");
require("../js/item-augmentation-runtime.js");
require("../js/dm-local-item-manager-v3.js");
require("../js/dm-item-creator-core.js");

const model=globalThis.LuminousDmItemCreatorCore;
const icons=globalThis.LuminousItemIconRegistry;
const inventory=globalThis.LuminousItemInventoryRuntime;
const persistence=globalThis.LuminousItemPersistenceRuntime;
const effectRuntime=globalThis.LuminousEquipmentEffects;
const catalog=globalThis.LuminousDmLocalItemManagerV3;
const id="dm_example_abcdefghijklmnopqrstuvwxyz123";
const base={name:"Espada de prueba",category:"weapon",tier:"II",priceAhn:1200,description:"Un arma creada por el DM.",
  iconFamily:"weapon_sword",handCost:2,stackable:false,equipmentEffects:[
    {type:"skill_check_bonus",skill:"athletics",value:2},
    {type:"sp_loss_reduction",value:1},
  ]};
const result=model.buildDefinition(base,id,{iconRegistry:icons});
assert.equal(result.ok,true,result.errors.join("; "));
assert.equal(result.definition.definitionId,id);
assert.equal(result.definition.equipment.handCost,2);
assert.equal(result.definition.icon,icons.resolveIcon("weapon_sword"));
assert.equal(result.definition.runtime.equipmentEffects[0].skill,"athletics");
assert.equal(result.definition.stackable,false);
assert.equal(result.definition.conditionMax,100);
assert.equal(model.buildDefinition({...base,conditionMax:0},id,{iconRegistry:icons}).ok,false);
const instance=inventory.createItemInstance(result.definition,{quantity:1});
const granted={...result.definition,...instance};
const serialized=persistence.serializeInventoryState({inventario_activo:{[instance.instanceId]:granted},inventario_stash:{},equipment:{mainHand:granted,offHand:granted}});
assert.equal(serialized.inventario_activo[instance.instanceId].equipment.handCost,2,"Equipment schema survives Firebase save");
assert.equal(serialized.inventario_activo[instance.instanceId].runtime.equipmentEffects.length,2,"Combat effects survive Firebase save");
const hud={};
const applied=persistence.applyInventoryState(hud,serialized);
assert.equal(applied.applied,true);
assert.equal(hud.equipment.mainHand?.instanceId,instance.instanceId);
assert.equal(globalThis.LuminousItemRuntime.equipmentSchema(hud.equipment.mainHand).handCost,2);
assert.equal(effectRuntime.skillCheckBonus(hud,"athletics"),2);
assert.equal(effectRuntime.mitigateSpLoss(hud,3),2);
assert.equal(catalog.normalizeDefinition(result.definition,{source:"campaña/base_datos_items",fallbackId:id}).category,"weapon");

const healing=model.buildDefinition({...base,name:"Poción",category:"consumable",iconFamily:"healing_hp",stackable:true,actionCost:"quick_action",hpRestore:12,spRestore:4,equipmentEffects:[]},id+"_heal",{iconRegistry:icons});
assert.equal(healing.ok,true,healing.errors.join("; "));
assert.equal(globalThis.LuminousItemRuntime.runtimeUseProfile(healing.definition).hp,12);
assert.equal(globalThis.LuminousItemRuntime.runtimeUseProfile(healing.definition).sp,4);
assert.equal(healing.definition.runtime.actionCost,"quick_action");
const aug=model.buildDefinition({...base,name:"Ojo implantado",category:"augmentation",iconFamily:"generic_item",augmentPartType:"eye",removable:false,equipmentEffects:[]},id+"_eye",{iconRegistry:icons});
assert.equal(aug.ok,true,aug.errors.join("; "));
assert.deepEqual(aug.definition.runtime.augmentation.targetPartTypes,["eye"]);
assert.equal(aug.definition.runtime.augmentation.removable,false);
assert.equal(aug.definition.stackable,false);
assert.equal(catalog.normalizeDefinition(aug.definition,{source:"campaña/base_datos_aumentos",fallbackId:aug.definition.id}).category,"augmentation");

const invalid=model.buildDefinition({...base,priceAhn:0,handCost:7},id+"_invalid",{iconRegistry:icons});
assert.equal(invalid.ok,false,"No invalid price or hand count");
assert.equal(model.buildDefinition({...base,iconFamily:"made_up_icon"},id,{iconRegistry:icons}).ok,false,"Only real icon registry keys");
assert.equal(model.buildDefinition({...base,equipmentEffects:[{type:"grant_skill",skillId:"invented",value:1}]},id,{iconRegistry:icons}).ok,false,
  "Unknown Skill must not be silently granted");
assert.equal(model.buildDefinition({...base,equipmentEffects:[{type:"sin_resistance",sin:"wrath",value:0.75}]},id,{iconRegistry:icons}).ok,true);
const empty=model.buildDefinition({...base,name:"  ",equipmentEffects:[]},id,{iconRegistry:icons});
assert.equal(empty.ok,false);
assert.equal(model.buildDefinition({...base,category:"material",iconFamily:"generic_item",equipmentEffects:[]},id,{iconRegistry:icons}).ok,true);

// Responsive controls: mobile & desktop share the same JS creator entrypoint.
const fs=require("node:fs");
const path=require("node:path");
const css=fs.readFileSync(path.join(__dirname,"../css/dm-item-creator.css"),"utf8");
assert.match(css,/@media\(max-width:700px\)/);
assert.match(css, /orientation:landscape/);
assert.match(css, /safe-area-inset-bottom/);
console.log("DM_ITEM_CREATOR_SMOKE_PASS");
