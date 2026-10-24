/* Equipment -> active canonical 3/2/1 Deck. Reusable by all Builds. */
(function(global) {
"use strict";
if(global.LuminousEquipmentLoadouts)return;
const clone=v=>v==null?v:JSON.parse(JSON.stringify(v));
const clean=v=>String(v??"").trim();
const idOf=item=>clean(item?.instanceId||item?.instance_id);
const catalog=()=>global.LuminousBuildWeaponCatalog;
function definition(item){
 const id=clean(item?.definitionId||item?.definition_id||item?.id);
 return id?catalog()?.get?.(id)||null:null;
}
function actualItem(item){
 if(!item||typeof item!=="object")return null;
 const canonical=definition(item);
 return canonical?{...clone(item),...canonical,instanceId:idOf(item)||canonical.id,
   condition:item.condition??item.currentCondition??canonical.conditionMax,
   equipped:item.equipped!==false}:item;
}
function hydratedEquipment(unit={},player=unit){
 const refs=player?.itemEquipmentRefs||unit.itemEquipmentRefs||{};
 const inv=player?.inventario_activo||unit.inventario_activo||{};
 const rows=Object.values(inv).filter(item=>item&&typeof item==="object");
 const resolve=(ref)=>{
   const id=typeof ref==="object"?idOf(ref):clean(ref);
   const item=rows.find(row=>idOf(row)===id);
   return actualItem(item||((typeof ref==="object")?ref:null));
 };
 const original=unit.equipment||{};
 const equipment={...original};
 ["mainHand","offHand","armor","shield"].forEach(key=>{
   equipment[key]=resolve(refs[key])||actualItem(original[key])||null;
 });
 const accessories=Array.isArray(refs.accessoryIds)?refs.accessoryIds:
   (Array.isArray(original.accessories)?original.accessories:[]);
 equipment.accessories=accessories.map(resolve).filter(Boolean);
 return equipment;
}
function weaponEquipped(item){
 if(!item||item.disabled===true||item.broken===true)return false;
 const state=item.condition??item.currentCondition??item.currentDurability;
 return !(state!=null&&Number(state)<=0);
}
function armedLoadouts(unit={},player=unit){
 const equipment=hydratedEquipment(unit,player);
 const seen=new Set(),result=[];
 for(const item of [equipment.mainHand,equipment.offHand]){
   if(!weaponEquipped(item))continue;
   const key=idOf(item);if(!key||seen.has(key))continue;seen.add(key);
   const profile=definition(item)?.runtime?.buildLoadouts;
   if(!profile?.modes)continue;
   const options=Object.keys(profile.modes);
   if(!options.length)continue;
   const selected=clean(player?.activeEquipmentModes?.[key]||unit?.activeEquipmentModes?.[key]);
   const modeId=options.includes(selected)?selected:clean(profile.defaultMode||options[0]);
   result.push({item,instanceId:key,definitionId:item.definitionId||item.id,modeId,
     options:options.map(id=>({id,name:clean(profile.modes[id]?.name)||id})),
     deck:clone(profile.modes[modeId]?.deck||{})});
 }
 return result;
}
function active(unit={},player=unit){
 // The main hand owns the active combat Deck; an offhand weapon grants only
 // weapon actions. This avoids mixing the 3/2/1 decks of two weapons.
 return armedLoadouts(unit,player)[0]||null;
}
function deck(unit={},player=unit){return active(unit,player)?.deck||null;}
function slotIds(unit={},player=unit){
 const d=deck(unit,player);if(!d)return [];
 return [d.tier1,d.tier1,d.tier1,d.tier2,d.tier2,d.tier3].map(clean).filter(Boolean);
}
function modeOptions(unit={},player=unit){return armedLoadouts(unit,player);}
function changeMode(player={},instanceId="",requested="",options={}){
 const id=clean(instanceId),mode=clean(requested);
 const found=armedLoadouts(player,player).find(entry=>entry.instanceId===id);
 if(!found||!found.options.some(row=>row.id===mode))
   return {ok:false,reason:"not_equipped_or_mode_missing"};
 const current=clean(player.activeEquipmentModes?.[id])||found.modeId;
 if(current===mode)return {ok:true,changed:false,player:clone(player)};
 const phase=clean(options.phase).toLowerCase();
 if(options.combat===true&&!["pre_combat_planning","planning","player_planning"].includes(phase))
   return {ok:false,reason:"mode_switch_only_in_planning"};
 // The one free switch is consumed for a live combat round (not setup).
 const round=Number(options.round)||0,encounter=clean(options.encounterId);
 const ledgerKey=encounter&&round>0?encounter+"_"+round:null;
 const ledger=player.equipmentModeChangeLedger||{};
 if(ledgerKey&&ledger[ledgerKey])return {ok:false,reason:"free_mode_switch_already_used"};
 const next=clone(player);
 next.activeEquipmentModes={...(next.activeEquipmentModes||{}),[id]:mode};
 if(ledgerKey)next.equipmentModeChangeLedger={...ledger,[ledgerKey]:id};
 return {ok:true,changed:true,player:next,modeId:mode};
}
const api=Object.freeze({VERSION:1,definition,actualItem,hydratedEquipment,armedLoadouts,active,deck,slotIds,modeOptions,changeMode});
global.LuminousEquipmentLoadouts=api;
if(typeof module!=="undefined"&&module.exports)module.exports=api;
})(typeof window!=="undefined"?window:globalThis);
