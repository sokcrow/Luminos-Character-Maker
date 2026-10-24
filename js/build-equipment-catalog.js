/* Shared, data-driven Build equipment. New skill powers except Shield Bash are provisional. */
(function(global){
"use strict";
if(global.LuminousBuildWeaponCatalog&&global.LuminousBuildSkillCatalog)return;
const clone=x=>x==null?x:JSON.parse(JSON.stringify(x));
const coin=(index,effects=[])=>({index,type:"normal",status:"active",effects});
const hit=(status,potency,count)=>({trigger:"[On Hit]",target:status==="poise"?"self":"target",type:"status",status,potency,count});
const defs={};
function skill(id,name,tier,damageType,status,sin,power,increment,count,opts={}){
 const coins=Array.from({length:count},(_,i)=>coin(i,i===count-1&&status?[hit(status,opts.potency??1,opts.count??1)]:[]));
 defs[id]={id,name,type:"Attack",skillFamily:"attack",tier,basePower:power,coinPower:increment,coinAmount:count,
  coinType:"positive",attackWeight:1,skillRange:opts.ranged?5:1,skillAmount:tier===1?3:tier===2?2:1,
  targetingType:"Focused Attack",damageType,sinAffinity:sin,sourceType:"weapon",requiresWeapon:true,
  isItemSkill:true,isDefense:false,isClashable:true,isUnclashable:false,effects:[],coins,schemaVersion:2,
  metadata:{buildEquipmentSkill:true,balanceStatus:"provisional",deckCopies:tier===1?3:tier===2?2:1}};
 return id;
}
function deck(prefix,label,damage,status,sins,powers,opts={}){
 const out={};
 [1,2,3].forEach((tier,i)=>{out["tier"+tier]=skill(prefix+"_"+["i","ii","iii"][i],
 label+" "+["I","II","III"][i],tier,damage,status,sins[i],...powers[i],opts);});
 return out;
}
const sword=deck("jeske_sword_poise","Filo de Poise","slash","poise",["pride","wrath","envy"],[[5,3,2],[6,3,2],[7,4,2]],{potency:2,count:1});
const revolver=deck("jeske_revolver_poise","Disparo de Poise","pierce","poise",["pride","gloom","envy"],[[5,3,1],[6,4,1],[8,5,1]],{ranged:true,potency:2,count:1});
const bleed=deck("calipsys_bleed","Garra Sangrienta","blunt","bleed",["lust","wrath","envy"],[[5,3,2],[6,4,2],[7,5,2]],{potency:2,count:1});
const tremor=deck("calipsys_tremor","Pulso Sísmico","blunt","tremor",["sloth","gloom","pride"],[[5,3,2],[6,4,2],[7,5,2]],{potency:2,count:1});
const burn=deck("calipsys_burn","Núcleo Ígneo","blunt","burn",["wrath","lust","gluttony"],[[5,3,2],[6,4,2],[7,5,2]],{potency:2,count:1});
const chill=deck("calipsys_chill","Impacto Glacial","blunt","chill",["gloom","sloth","pride"],[[5,3,2],[6,4,2],[7,5,2]],{potency:2,count:1});
defs.jeske_shield_bash={id:"jeske_shield_bash",name:"Shield Bash",type:"Attack",tier:1,
 basePower:6,coinPower:5,coinAmount:1,coinType:"positive",attackWeight:1,
 damageType:"blunt",sinAffinity:"sloth",skillRange:1,skillAmount:1,
 sourceType:"equipment",weaponUsage:"shield",isItemSkill:true,isClashable:true,
 effects:[],coins:[coin(0,[hit("tremor",2,1)])],inDeck:false,availability:{type:"granted"},
 schemaVersion:2,metadata:{buildEquipmentSkill:true,deckCopies:0,originalSpec:true}};
defs.jeske_clashable_guard={id:"jeske_clashable_guard",name:"Clashable Guard",type:"Defense",
 defenseType:"clashable_guard",isDefense:true,isClashable:true,tier:1,
 basePower:6,coinPower:0,coinAmount:1,damageType:"blunt",sinAffinity:"sinless",
 sourceType:"equipment",inDeck:false,availability:{type:"granted"},
 effects:[],coins:[coin(0)],schemaVersion:2,
 metadata:{buildEquipmentSkill:true,deckCopies:0,balanceStatus:"provisional"}};
const passive=(...effects)=>effects.map(effect=>({trigger:"passive",...effect}));
const entries=[
 {id:"jeske_poise_blade",name:"Espada de Jeske",category:"weapon",iconFamily:"weapon_sword",
 damageType:"slash",equipment:{kind:"weapon",handCost:1},price:125,
 runtime:{buildLoadouts:{defaultMode:"sword",modes:{sword:{name:"Espada · Poise",deck:sword}}}}},
 {id:"jeske_poise_revolver",name:"Revólver de Jeske",category:"weapon",iconFamily:"weapon_firearm_revolver",
 damageType:"pierce",equipment:{kind:"weapon",handCost:1},price:160,
 runtime:{buildLoadouts:{defaultMode:"revolver",modes:{revolver:{name:"Revólver · Poise",deck:revolver}}}}},
 {id:"jeske_guard_shield",name:"Escudo de Jeske",category:"shield",iconFamily:"shield",price:100,
 equipment:{kind:"shield",handCost:1},
 runtime:{equipmentEffects:passive({type:"grant_skill",skillId:"jeske_clashable_guard"},
 {type:"grant_skill",skillId:"jeske_shield_bash"})}},
 {id:"jeske_regenerative_armor",name:"Armadura Regenerativa de Jeske",category:"armor",iconFamily:"armor_medium",price:240,
 equipment:{kind:"armor"},runtime:{equipmentEffects:[{type:"heal_hp_percent",trigger:"on_turn_start",value:5}]}},
 {id:"jeske_ocular_augment",name:"Augment Ocular de Jeske",category:"augmentation",iconFamily:"organ_sensory",price:210,
 runtime:{augmentation:{enabled:true,targetPartTypes:["eye"],requiredPartCount:1,removable:false},
 equipmentEffects:passive({type:"skill_check_bonus",skill:"perception",value:1},
 {type:"check_threshold_reduction",check:"analyze",value:2})}},
 {id:"calipsys_gloom_armor",name:"Armadura Gloom de Calipsys",category:"armor",iconFamily:"armor_medium",price:250,
 equipment:{kind:"armor"},runtime:{equipmentEffects:passive({type:"sin_resistance",sin:"gloom",multiplier:0.5},
 {type:"sp_loss_reduction",value:3})}},
 {id:"calipsys_fourfold_gauntlets",name:"Guanteletes de Cuatro Modos de Calipsys",category:"weapon",
 iconFamily:"weapon_blunt",damageType:"blunt",equipment:{kind:"weapon",handCost:2},price:280,
 runtime:{buildLoadouts:{defaultMode:"bleed",modes:{bleed:{name:"Bleed",deck:bleed},
 tremor:{name:"Tremor",deck:tremor},burn:{name:"Burn",deck:burn},chill:{name:"Chill",deck:chill}}}}}
];
const ITEMS=Object.freeze(entries.map(row=>Object.freeze({...row,definitionId:row.id,
 displayName:row.name,nombre:row.name,itemType:row.category,stackable:false,quantity:1,
 qualityTier:2,conditionMax:100,damageTypes:row.damageType?[row.damageType]:undefined,
 tags:[row.category,"build_equipment"],tier:"II",productionValueAhn:row.price,unitValueAhn:row.price})));
const byId=Object.fromEntries(ITEMS.map(item=>[item.id,item]));
const WEAPON_SETS=Object.freeze([Object.freeze({
 id:"jeske_weapon_set",name:"Arsenal de Jeske",defaultMode:"sword",
 modes:Object.freeze({
   sword:Object.freeze({name:"Espada y Escudo",mainHand:"jeske_poise_blade",
     offHand:"jeske_guard_shield",shield:"jeske_guard_shield"}),
   revolver:Object.freeze({name:"Revólver",mainHand:"jeske_poise_revolver",
     offHand:null,shield:null})
 })
})]);
global.LuminousBuildWeaponCatalog=Object.freeze({VERSION:2,ITEMS,WEAPON_SETS,get(id){return clone(byId[id]||null)},
 list(){return ITEMS.map(clone)}});
global.LuminousBuildSkillCatalog=Object.freeze({DEFINITIONS:Object.freeze(defs),
 list(){return Object.values(defs).map(clone)},get(id){return clone(defs[id]||null)}});
if(typeof module!=="undefined"&&module.exports)module.exports=global.LuminousBuildWeaponCatalog;
})(typeof window!=="undefined"?window:globalThis);
