import assert from "node:assert/strict";
await import("../js/build-equipment-catalog.js");
await import("../js/equipment-loadout-runtime.js");
await import("../js/item-inventory-runtime.js");
await import("../js/item-equipment-effects-runtime.js");
await import("../js/combat-skill-schema.js");
await import("../js/combat-skill-loadout-074.js");
await import("../js/item-enchantment-combat-link.js");
const catalog=globalThis.LuminousBuildWeaponCatalog;
const loadouts=globalThis.LuminousEquipmentLoadouts;
const inv=globalThis.LuminousItemInventoryRuntime;
const effects=globalThis.LuminousEquipmentEffects;
const skills=globalThis.LuminousCombatSkillLoadout074;
const link=globalThis.LuminousEnchantmentCombatLink;
assert.equal(catalog.ITEMS.length,7);
assert.equal(Object.keys(globalThis.LuminousBuildSkillCatalog.DEFINITIONS).length,20);
for(const item of catalog.ITEMS){
 const instance=inv.createItemInstance(item,{quantity:1});
 assert.equal(instance.definitionId,item.id);
 assert.equal(instance.category,item.category);
 assert.deepEqual(instance.runtime,item.runtime,"ItemInstance retains trusted Build runtime effects/loadouts");
 assert.equal(instance.itemType,item.category);
 assert.equal(inv.serializeItemInstance(instance).runtime!==undefined,true);
}
function playerFor(id,mode={}){
 const def=catalog.get(id);
 const instance=inv.createItemInstance(def,{quantity:1});
 const player={id:"p1",inventario_activo:{weapon:instance},inventario_stash:{},itemEquipmentRefs:
   {mainHand:instance.instanceId,offHand:def.equipment?.handCost===2?instance.instanceId:null}};
 return {...player,activeEquipmentModes:mode};
}
const sword=playerFor("jeske_poise_blade");
const swordDeck=loadouts.deck(sword);
assert.equal(swordDeck.tier1,"jeske_sword_poise_i");
assert.deepEqual(loadouts.slotIds(sword),[
 "jeske_sword_poise_i","jeske_sword_poise_i","jeske_sword_poise_i",
 "jeske_sword_poise_ii","jeske_sword_poise_ii","jeske_sword_poise_iii"]);
assert.equal(skills.skillIdsFor(sword).includes("jeske_sword_poise_iii"),true);
assert.equal(skills.ownsSkill(sword,"jeske_sword_poise_ii"),true);
assert.equal(skills.ownsSkill(sword,"calipsys_burn_ii"),false);
assert.equal(link.skillAvailability({equipment:loadouts.hydratedEquipment(sword)},skills.skillLibrary()["jeske_sword_poise_i"]).available,true);
const revolver=playerFor("jeske_poise_revolver");
assert.equal(loadouts.deck(revolver).tier1,"jeske_revolver_poise_i");
const gauntlets=playerFor("calipsys_fourfold_gauntlets");
const id=gauntlets.inventario_activo.weapon.instanceId;
assert.equal(loadouts.modeOptions(gauntlets).length,1);
assert.equal(loadouts.modeOptions(gauntlets)[0].options.length,4);
for(const mode of ["bleed","tremor","burn","chill"]){
 const changed=loadouts.changeMode(gauntlets,id,mode,mode==="bleed"?{}:{phase:"planning",combat:true,round:2,encounterId:"combat_a"});
 assert.equal(changed.ok,true,changed.reason);
 assert.equal(loadouts.deck(changed.player).tier1,"calipsys_"+mode+"_i");
 assert.equal(loadouts.slotIds(changed.player).length,6);
 assert.equal(skills.ownsSkill(changed.player,"calipsys_"+mode+"_ii"),true);
 // Switching the deck must not overwrite learned Skills or class progression.
 assert.deepEqual(changed.player.learnedSkillIds,gauntlets.learnedSkillIds);
}
const swapped=loadouts.changeMode(gauntlets,id,"tremor",{phase:"planning",combat:true,round:2,encounterId:"combat_a"});
assert.equal(swapped.ok,true);
const already=loadouts.changeMode(swapped.player,id,"burn",{phase:"planning",combat:true,round:2,encounterId:"combat_a"});
assert.equal(already.ok,false);
assert.equal(already.reason,"free_mode_switch_already_used");
assert.equal(loadouts.changeMode(gauntlets,id,"burn",{phase:"sealed",combat:true}).ok,false);
assert.equal(loadouts.changeMode(gauntlets,"not_the_weapon","burn",{}).ok,false);
assert.equal(loadouts.deck(sword).tier1,"jeske_sword_poise_i","Mode update never modifies another player");
const shield=catalog.get("jeske_guard_shield");
const shieldInstance=inv.createItemInstance(shield);
const defended={equipment:{shield:shieldInstance}};
assert.ok(effects.grantedSkillIds(defended).includes("jeske_shield_bash"));
assert.ok(effects.grantedSkillIds(defended).includes("jeske_clashable_guard"));
assert.equal(skills.ownsSkill(defended,"jeske_shield_bash"),true);
assert.equal(skills.skillLibrary().jeske_shield_bash.basePower,6);
assert.equal(skills.skillLibrary().jeske_shield_bash.coinPower,5);
assert.deepEqual(skills.skillLibrary().jeske_shield_bash.coins[0].effects.map(e=>[e.status,e.potency,e.count]),[["tremor",2,1]]);
const armor=inv.createItemInstance(catalog.get("jeske_regenerative_armor"));
const healed={equipment:{armor},hp:50,maxHp:100,battleActive:true};
assert.equal(effects.applyTurnStart(healed,{round:1,encounterId:"a",authoritative:true}).applied,true);
assert.equal(healed.hp,55);
assert.equal(effects.applyTurnStart(healed,{round:1,encounterId:"a",authoritative:true}).applied,false);
const ocular=inv.createItemInstance(catalog.get("jeske_ocular_augment"));
const installed={augmentations:[{...ocular,installed:true,equipped:true}]};
assert.equal(effects.skillCheckBonus(installed,"perception"),1);
assert.equal(effects.checkThresholdAdjustment(installed,"analyze"),-2);
const gloom=inv.createItemInstance(catalog.get("calipsys_gloom_armor"));
assert.equal(effects.mitigateSpLoss({equipment:{armor:gloom}},8),5);
console.log("BUILD_EQUIPMENT_DECKS_PASS items, canonical 3/2/1, mode switches, grants, armor and Augment effects");
