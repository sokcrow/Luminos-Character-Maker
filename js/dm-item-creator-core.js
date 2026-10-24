/* DM Item Creator: validated definitions for the existing ItemInstance/catalog runtime. */
(function (global) {
  "use strict";
  if (global.LuminousDmItemCreatorCore) return;

  const CATEGORIES = Object.freeze(["weapon","armor","shield","accessory","consumable","augmentation","material","ammo","tool","upgrade"]);
  const TIERS = Object.freeze(["I","II","III","IV","V","VI","VII","VIII","IX","X"]);
  const EFFECT_TYPES = Object.freeze(["skill_check_bonus","check_threshold_reduction","sp_loss_reduction","sin_resistance","heal_hp_percent","grant_skill"]);
  const SINS = Object.freeze(["wrath","lust","sloth","gluttony","gloom","pride","envy"]);
  const SKILLS = Object.freeze(["acrobatics","animal_handling","arcana","athletics","deception","history","insight","intimidation","investigation","medicine","nature","perception","performance","persuasion","religion","sleight_of_hand","stealth","survival"]);
  const slug = value => String(value || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"_").replace(/^_+|_+$/g,"");
  const clean = (value,max=300) => String(value == null ? "" : value).trim().slice(0,max);
  const number = value => value === "" || value == null ? NaN : Number(value);
  const array = value => Array.isArray(value) ? value : [];

  function effectOf(raw) {
    const type=clean(raw?.type);
    if (!EFFECT_TYPES.includes(type)) return {error:"Selecciona un efecto compatible con el motor de combate."};
    const value=number(raw.value);
    if (!Number.isFinite(value)) return {error:"El valor del efecto debe ser un número."};
    if (type === "skill_check_bonus") {
      const skill=slug(raw.skill);
      if (!SKILLS.includes(skill) || value < -30 || value > 30) return {error:"Elige una habilidad y una bonificación entre -30 y 30."};
      return {effect:{type,trigger:"passive",skill,value}};
    }
    if (type === "check_threshold_reduction") {
      const check=slug(raw.check);
      if (!check || check.length>80 || value<0 || value>30) return {error:"Indica la prueba y una reducción entre 0 y 30."};
      return {effect:{type,trigger:"passive",check,value}};
    }
    if (type === "sp_loss_reduction") {
      if (value<0 || value>100) return {error:"La reducción de SP debe estar entre 0 y 100."};
      return {effect:{type,trigger:"passive",value}};
    }
    if (type === "sin_resistance") {
      const sin=slug(raw.sin);
      if (!SINS.includes(sin) || value<0 || value>3) return {error:"Elige un pecado y un multiplicador entre 0 y 3."};
      return {effect:{type,trigger:"passive",sin,multiplier:value}};
    }
    if (type === "grant_skill") {
      const skillId=clean(raw.skillId,100);
      const validSkills=array(raw.availableSkillIds).map(String);
      if (!skillId || !validSkills.includes(skillId)) return {error:"Elige una habilidad registrada en el catálogo real."};
      return {effect:{type,trigger:"passive",skillId}};
    }
    if (value<0 || value>100) return {error:"La curación por turno debe estar entre 0 y 100%."};
    return {effect:{type,trigger:"on_turn_start",value}};
  }

  function validateDraft(draft = {}, options = {}) {
    const errors=[];
    const name=clean(draft.name,90);
    const category=clean(draft.category);
    const tier=clean(draft.tier);
    const price=number(draft.priceAhn);
    if (name.length<3) errors.push("Escribe un nombre de al menos 3 caracteres.");
    if (!CATEGORIES.includes(category)) errors.push("Elige una categoría de ítem.");
    if (!TIERS.includes(tier)) errors.push("Elige un Tier válido.");
    if (!Number.isSafeInteger(price) || price<1 || price>1000000000) errors.push("El valor debe ser de 1 a 1,000,000,000 AHN.");
    if (clean(draft.description,2001).length>2000) errors.push("La descripción supera 2000 caracteres.");
    if (draft.iconFamily && options.iconRegistry?.get && !options.iconRegistry.get(draft.iconFamily,{fallback:false}))
      errors.push("Selecciona un icono del registro oficial.");
    const handCost=number(draft.handCost);
    if (category==="weapon" && ![1,2].includes(handCost)) errors.push("Elige si el arma ocupa una o dos manos.");
    const hp=number(draft.hpRestore || 0),sp=number(draft.spRestore || 0);
    if (category==="consumable" && (![hp,sp].every(x=>Number.isInteger(x)&&x>=0&&x<=100000) ||
      !["action","quick_action","off_combat"].includes(draft.actionCost)))
      errors.push("Configura una acción válida y cantidades HP/SP entre 0 y 100000.");
    if (category==="augmentation" && (!/^[a-z][a-z0-9_]{0,39}$/.test(slug(draft.augmentPartType))))
      errors.push("Indica una parte corporal válida para instalar el Augment.");
    if ((category==="weapon" || category==="armor" || category==="shield" || category==="accessory" || category==="augmentation") && array(draft.equipmentEffects).length>8)
      errors.push("Se permiten hasta ocho efectos por objeto.");
    const effects=[];
    if (array(draft.equipmentEffects).length && !["weapon","armor","shield","accessory","augmentation"].includes(category))
      errors.push("Los efectos de equipamiento requieren un objeto equipable o instalado.");
    for (const raw of array(draft.equipmentEffects)) {
      const checked=effectOf(raw);
      if (checked.error) errors.push(checked.error);
      else effects.push(checked.effect);
    }
    return {valid:errors.length===0,errors,effects};
  }

  function buildDefinition(draft = {}, id = "", options = {}) {
    const check=validateDraft(draft,options);
    const definitionId=slug(id);
    if (!/^dm_[a-z0-9_]{6,120}$/.test(definitionId))
      check.errors.push("No se pudo generar una identidad única para el nuevo objeto.");
    if (check.errors.length) return {ok:false,errors:check.errors};
    const name=clean(draft.name,90),category=draft.category,price=Number(draft.priceAhn);
    const iconFamily=clean(draft.iconFamily,80) || options.iconRegistry?.DEFAULT_GROUP || "generic_item";
    const icon=options.iconRegistry?.resolveIcon?.(iconFamily) ||
      options.iconRegistry?.resolveIcon?.(options.iconRegistry?.DEFAULT_GROUP) || null;
    if (!icon) return {ok:false,errors:["El registro de iconos todavía no está disponible."]};
    const equipment=["weapon","armor","shield","accessory"].includes(category);
    const single=equipment || category==="augmentation";
    const definition={
      id:definitionId,definitionId,canonicalId:definitionId,
      name,nombre:name,displayName:name,
      description:clean(draft.description,2000),descripcion:clean(draft.description,2000),
      category,tipo_categoria:category,itemType:category,tier:draft.tier,
      priceAhn:price,price,costo:price,valorBase:price,currency:"AHN",
      stackable:single?false:draft.stackable===true,
      iconFamily,icon,icono:icon,
      tags:[category,...String(draft.tags || "").split(",").map(slug).filter(Boolean)].filter((x,i,a)=>a.indexOf(x)===i),
      dmCustomDefinition:true,
    };
    if (equipment) {
      definition.equipment={kind:category,...(category==="weapon"?{handCost:Number(draft.handCost)}:{})};
      if (category==="accessory") definition.equipment.accessoryType=slug(draft.accessoryType)||"legacy_accessory";
    }
    if (category==="consumable") {
      definition.runtime={actionCost:draft.actionCost,targetMode:"self",consumeQty:1,
        effects:{hpRestore:Number(draft.hpRestore||0),spRestore:Number(draft.spRestore||0)}};
    }
    if (category==="augmentation") {
      definition.runtime={augmentation:{enabled:true,targetPartTypes:[slug(draft.augmentPartType)],removable:draft.removable===true}};
    }
    if (check.effects.length) {
      definition.runtime=definition.runtime||{};
      definition.runtime.equipmentEffects=check.effects;
    }
    return {ok:true,definition,errors:[]};
  }
  const api=Object.freeze({VERSION:1,CATEGORIES,TIERS,EFFECT_TYPES,SINS,SKILLS,slug,validateDraft,buildDefinition});
  global.LuminousDmItemCreatorCore=api;
  if (typeof module!=="undefined" && module.exports) module.exports=api;
})(typeof globalThis!=="undefined" ? globalThis : window);
