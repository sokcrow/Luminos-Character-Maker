(function (global) {
  "use strict";

  if (global.LuminousItemEnchanterServiceRuntime) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousItemEnchanterServiceRuntime;
    return;
  }

  function safeRequire(path) {
    if (typeof require !== "function") return null;
    try { return require(path); } catch (_) { return null; }
  }

  const Enchantments = global.LuminousEnchantmentCatalog || safeRequire("./item-catalog-enchantments.js");
  const Engine = global.LuminousItemEnchantmentEngine || safeRequire("./item-enchantment-engine.js");
  const Magic = global.LuminousItemMagicRuntime || safeRequire("./item-magic-runtime.js");
  const Workshop = global.LuminousWorkshopRuntime || safeRequire("./workshop-runtime.js");
  const knowledgeRuntime = () => global.LuminousItemMagicKnowledgeRuntime || safeRequire("./item-magic-knowledge-runtime.js");
  const compendiumRuntime = () => global.LuminousEnchantmentCompendiumRuntime || safeRequire("./item-enchantment-compendium-runtime.js");
  if (!Enchantments || !Engine || !Magic) {
    throw new Error("Enchantment Catalog, Enchantment Engine and Magic Runtime are required before Enchanter Service Runtime.");
  }

  const VERSION = 6;
  const MAX_REPRODUCIBLE_RANK = 3;
  const SERVICE_IDS = Object.freeze([
    "enchant",
    "strengthen",
    "remove_rewrite",
    "identify",
    "curse_analysis",
    "remove_curse",
    "magical_repair",
    "bind",
    "curse",
    "mount_gem",
    "extract_gem",
  ]);
  const SERVICE_LABELS = Object.freeze({
    enchant:"Enchant",
    strengthen:"Strengthen Enchantment",
    remove_rewrite:"Remove / Rewrite Enchantment",
    identify:"Identify",
    curse_analysis:"Curse Analysis",
    remove_curse:"Remove Curse",
    magical_repair:"Magical Repair / Recharge",
    bind:"Bind",
    curse:"Curse",
    mount_gem:"Mount Gem",
    extract_gem:"Extract Gem",
  });
  const DURATION_BANDS = Object.freeze({
    1:Object.freeze({unit:"hours",minHours:1,maxHours:23,label:"Hours"}),
    2:Object.freeze({unit:"days",minHours:24,maxHours:72,label:"1–3 days"}),
    3:Object.freeze({unit:"days",minHours:168,maxHours:null,label:"One week or more"}),
  });

  const clone=(value)=>value==null?value:JSON.parse(JSON.stringify(value));
  const normalizeId=(value)=>String(value??"").trim().toLowerCase().replace(/[^a-z0-9]+/g,"_").replace(/^_+|_+$/g,"");
  const asArray=(value)=>value==null?[]:(Array.isArray(value)?value:[value]);
  const numberOr=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
  const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));

  function roundAhn(value) {
    const economy=global.LuminousItemEconomyStandard;
    if (economy?.roundAhn) return economy.roundAhn(value,10);
    return Math.max(0,Math.round(numberOr(value,0)/10)*10);
  }

  function normalizedServiceIds(values) {
    return Object.freeze([...new Set(asArray(values).map(normalizeId).filter((id)=>SERVICE_IDS.includes(id)))]);
  }

  function workshopContext(provider={},options={}) {
    const workshop=options.workshop || provider.workshop || provider.linkedWorkshop || null;
    if (!workshop || typeof workshop!=="object") {
      return Object.freeze({
        workshop:null,
        workshopId:provider.workshopId || provider.workshop_id || null,
        tier:null,
        reputation:null,
        specialization:null,
        priceMultiplier:1,
      });
    }
    const tier=Math.max(1,Math.trunc(numberOr(workshop.workshopTier ?? workshop.tier,1)));
    const reputation=normalizeId(workshop.reputation || "");
    const specialization=normalizeId(workshop.primarySpecialization || workshop.specialization || "");
    const priceMultiplier=Workshop?.priceMultiplier ? Math.max(0.01,numberOr(Workshop.priceMultiplier(workshop),1)) : 1;
    return Object.freeze({
      workshop:Object.freeze(clone(workshop)),
      workshopId:workshop.workshopId || workshop.id || provider.workshopId || null,
      tier,
      reputation:reputation || null,
      specialization:specialization || null,
      priceMultiplier,
    });
  }

  function normalizeReliabilityMap(raw={}) {
    const out={};
    Object.entries(raw && typeof raw==="object"?raw:{}).forEach(([key,value])=>{
      if (!Number.isFinite(Number(value))) return;
      out[normalizeId(key)]=clamp(Number(value),0,1);
    });
    return Object.freeze(out);
  }

  function normalizeProviderProfile(raw={},options={}) {
    const workshop=workshopContext(raw,options);
    const maxRank=clamp(Math.trunc(numberOr(raw.maxRank ?? raw.max_rank ?? raw.enchantmentMaxRank,1)),1,MAX_REPRODUCIBLE_RANK);
    const services=normalizedServiceIds(raw.services || raw.knownServices || raw.servicesOffered || []);
    const reliabilityValue=raw.reliability ?? raw.controlledResultProbability ?? raw.controlled_result_probability;
    const reliability=Number.isFinite(Number(reliabilityValue))?clamp(Number(reliabilityValue),0,1):null;
    const priceModifier=Math.max(0.01,numberOr(raw.priceModifier ?? raw.price_modifier,1));
    const materialPriceModifier=Math.max(0.01,numberOr(raw.materialPriceModifier ?? raw.material_price_modifier,1));

    return Object.freeze({
      id:String(raw.id || raw.providerId || raw.npcId || workshop.workshopId || "").trim(),
      name:String(raw.name || raw.nombre || raw.providerName || raw.workshopName || "Enchanter").trim(),
      portrait:raw.portrait || raw.sprite || raw.spriteUrl || null,
      hostType:normalizeId(raw.hostType || raw.providerType || (workshop.workshop ? "workshop" : "specialist")) || "specialist",
      shopId:raw.shopId || raw.shop_id || null,
      workshopId:workshop.workshopId,
      npcId:raw.npcId || raw.npc_id || null,
      maxRank,
      services,
      knownEnchantments:Object.freeze([...new Set(asArray(raw.knownEnchantments || raw.enchantmentsKnown).map(normalizeId).filter(Boolean))]),
      resonanceSpecialties:Object.freeze([...new Set(asArray(raw.resonanceSpecialties || raw.resonance_specialties).map(normalizeId).filter(Boolean))]),
      equipmentSpecialties:Object.freeze([...new Set(asArray(raw.equipmentSpecialties || raw.equipment_specialties).map(normalizeId).filter(Boolean))]),
      reliability,
      specialtyReliability:normalizeReliabilityMap(raw.specialtyReliability || raw.specialty_reliability || {}),
      unknownRecipeReliability:Number.isFinite(Number(raw.unknownRecipeReliability ?? raw.unknown_recipe_reliability))
        ? clamp(Number(raw.unknownRecipeReliability ?? raw.unknown_recipe_reliability),0,1)
        : null,
      outcomeTable:Object.freeze(asArray(raw.outcomeTable || raw.outcome_table).map((entry)=>Object.freeze({
        kind:normalizeId(entry?.kind || entry?.outcome || "altered") || "altered",
        weight:Math.max(0,numberOr(entry?.weight,1)),
        alternateEnchantmentId:normalizeId(entry?.alternateEnchantmentId || entry?.alternate_enchantment_id || ""),
        anchorState:normalizeId(entry?.anchorState || entry?.anchor_state || ""),
      }))),
      durationHoursByRank:Object.freeze({...clone(raw.durationHoursByRank || raw.duration_hours_by_rank || {})}),
      servicePriceAhn:Object.freeze({...clone(raw.servicePriceAhn || raw.service_price_ahn || {})}),
      materialSupply:normalizeId(raw.materialSupply || raw.material_supply || "mixed") || "mixed",
      canInferUnknownRecipes:raw.canInferUnknownRecipes === true || raw.can_infer_unknown_recipes === true,
      bindCapable:raw.bindCapable === true || raw.bind_capable === true || services.includes("bind"),
      curseCapable:raw.curseCapable === true || raw.curse_capable === true || services.includes("curse"),
      priceModifier,
      materialPriceModifier,
      workshopPriceMultiplier:workshop.priceMultiplier,
      workshopTier:workshop.tier,
      workshopReputation:workshop.reputation,
      workshopSpecialization:workshop.specialization,
      magicalRepairAhnPerPoint:Number.isFinite(Number(raw.magicalRepairAhnPerPoint ?? raw.magical_repair_ahn_per_point))
        ? Math.max(0,Number(raw.magicalRepairAhnPerPoint ?? raw.magical_repair_ahn_per_point))
        : null,
    });
  }

  function definitionTokens(definition={}) {
    return [...new Set([
      definition.id,
      ...asArray(definition.tags),
      ...asArray(definition.categories),
      ...asArray(definition.compatibility?.primaryResonances),
      ...asArray(definition.compatibility?.acceptedResonances),
      ...asArray(definition.compatibility?.acceptedAffinities),
    ].map(normalizeId).filter(Boolean))];
  }

  function providerKnows(provider={},definitionOrId) {
    const profile=provider.maxRank?provider:normalizeProviderProfile(provider);
    const id=normalizeId(typeof definitionOrId==="string"?definitionOrId:definitionOrId?.id);
    return Boolean(id && profile.knownEnchantments.includes(id));
  }

  function providerSpecialtyMatches(provider={},definitionOrId,item={}) {
    const profile=provider.maxRank?provider:normalizeProviderProfile(provider);
    const definition=typeof definitionOrId==="string"?Enchantments.get(definitionOrId):clone(definitionOrId);
    const tokens=definitionTokens(definition||{});
    const itemKind=Engine.itemKindOf(item);
    const resonance=profile.resonanceSpecialties.find((tag)=>tokens.includes(tag)) || null;
    const equipment=profile.equipmentSpecialties.includes(itemKind)?itemKind:null;
    const workshop=profile.workshopSpecialization && tokens.includes(profile.workshopSpecialization)
      ? profile.workshopSpecialization
      : null;
    return Object.freeze({matched:Boolean(resonance||equipment||workshop),resonance,equipment,workshop});
  }

  function effectiveReliability(provider={},definitionOrId,item={},options={}) {
    const profile=provider.maxRank?provider:normalizeProviderProfile(provider,options);
    const definition=typeof definitionOrId==="string"?Enchantments.get(definitionOrId):clone(definitionOrId);
    if (!definition) return Object.freeze({resolved:false,reason:"unknown_enchantment",probability:null});
    const known=providerKnows(profile,definition);
    const specialty=providerSpecialtyMatches(profile,definition,item);
    const tokens=[...definitionTokens(definition),Engine.itemKindOf(item)].filter(Boolean);

    let probability=profile.reliability;
    let source=probability==null?null:"base";

    for(const token of tokens){
      if (profile.specialtyReliability[token]==null) continue;
      const candidate=profile.specialtyReliability[token];
      if (probability==null || candidate>probability) {
        probability=candidate;
        source=`specialty:${token}`;
      }
    }

    if (!known && profile.unknownRecipeReliability!=null) {
      probability=probability==null
        ? profile.unknownRecipeReliability
        : Math.min(probability,profile.unknownRecipeReliability);
      source="unknown_recipe";
    }

    if (probability==null) return Object.freeze({
      resolved:false,
      reason:"provider_reliability_unset",
      probability:null,
      knownRecipe:known,
      specialty,
    });

    return Object.freeze({
      resolved:true,
      probability:clamp(probability,0,1),
      source,
      knownRecipe:known,
      specialty,
      recipeProvided:options.recipeProvided===true,
    });
  }

  function providerCanService(provider={},serviceId,context={}) {
    const profile=provider.maxRank?provider:normalizeProviderProfile(provider,context);
    const service=normalizeId(serviceId);
    if (!SERVICE_IDS.includes(service)) return Object.freeze({allowed:false,reason:"unknown_service"});
    if (!profile.services.includes(service)) return Object.freeze({allowed:false,reason:"service_not_offered",service});

    const rank=Math.max(0,Math.trunc(numberOr(context.rank ?? context.targetRank,0)));
    if (rank>MAX_REPRODUCIBLE_RANK) return Object.freeze({allowed:false,reason:"relic_rank_not_reproducible",rank});
    if (rank>0 && rank>profile.maxRank) return Object.freeze({allowed:false,reason:"provider_rank_cap",rank,maxRank:profile.maxRank});
    if (service==="bind" && !profile.bindCapable) return Object.freeze({allowed:false,reason:"provider_cannot_bind"});
    if (service==="curse" && !profile.curseCapable) return Object.freeze({allowed:false,reason:"provider_cannot_curse"});

    const definition=context.definition || (context.enchantmentId?Enchantments.get(context.enchantmentId):null);
    if (definition && ["enchant","strengthen","bind","curse","mount_gem"].includes(service)) {
      const known=providerKnows(profile,definition);
      if (!known && context.recipeProvided!==true && profile.canInferUnknownRecipes!==true) {
        return Object.freeze({allowed:false,reason:"provider_does_not_know_recipe",definitionId:definition.id});
      }
    }

    return Object.freeze({allowed:true,service,profile});
  }

  function weightedOutcome(table=[],roll=0) {
    const entries=asArray(table).filter((entry)=>numberOr(entry?.weight,0)>0);
    if (!entries.length) return Object.freeze({kind:"altered",weight:1});
    const total=entries.reduce((sum,entry)=>sum+numberOr(entry.weight,0),0);
    let cursor=clamp(numberOr(roll,0),0,0.999999999)*total;
    for(const entry of entries){
      cursor-=numberOr(entry.weight,0);
      if (cursor<=0) return Object.freeze(clone(entry));
    }
    return Object.freeze(clone(entries[entries.length-1]));
  }

  function resolveNpcOutcome(provider={},definitionOrId,item={},options={}) {
    const profile=provider.maxRank?provider:normalizeProviderProfile(provider,options);
    const reliability=effectiveReliability(profile,definitionOrId,item,options);
    if (!reliability.resolved) return Object.freeze({resolved:false,reason:reliability.reason,reliability});
    const roll=clamp(numberOr(options.roll,Math.random()),0,0.999999999);
    if (roll<reliability.probability) {
      return Object.freeze({
        resolved:true,
        kind:"controlled",
        roll,
        probability:reliability.probability,
        reliability,
      });
    }
    const remainder=(roll-reliability.probability)/Math.max(0.000001,1-reliability.probability);
    const altered=weightedOutcome(profile.outcomeTable,remainder);
    return Object.freeze({
      resolved:true,
      kind:altered.kind || "altered",
      roll,
      probability:reliability.probability,
      reliability,
      outcome:altered,
    });
  }

  function durationBand(rank) {
    return DURATION_BANDS[Math.trunc(numberOr(rank,0))] || null;
  }

  function serviceDuration(provider={},rank,definition=null,options={}) {
    const profile=provider.maxRank?provider:normalizeProviderProfile(provider,options);
    const r=Math.trunc(numberOr(rank,0));
    const band=durationBand(r);
    if (!band) return Object.freeze({resolved:false,reason:"unsupported_rank",rank:r});
    const definitionHours=definition?.serviceDurationHours ?? definition?.service_duration_hours;
    const providerHours=profile.durationHoursByRank?.[r] ?? profile.durationHoursByRank?.[String(r)];
    const requested=options.durationHours;
    const hours=[requested,definitionHours,providerHours].find((value)=>Number.isFinite(Number(value)) && Number(value)>0);
    return Object.freeze({
      resolved:hours!=null,
      hours:hours==null?null:Number(hours),
      band,
      source:hours==null?null:(requested!=null?"request":definitionHours!=null?"definition":"provider"),
    });
  }

  function itemEnchantmentBaseValueAhn(item={}) {
    const value=[
      item.enchantmentBaseValueAhn,
      item.enchantment_base_value_ahn,
      item.magic?.enchantmentBaseValueAhn,
    ].find((entry)=>Number.isFinite(Number(entry)) && Number(entry)>=0);
    return value==null?0:Number(value);
  }

  function laborQuote(item={},definitionOrId,rank,provider={},options={}) {
    const definition=typeof definitionOrId==="string"?Enchantments.get(definitionOrId):clone(definitionOrId);
    const rankData=Enchantments.resolveRank(definition,rank);
    if (!definition || !rankData) return Object.freeze({resolved:false,reason:"unsupported_rank_or_enchantment"});
    const baseValue=itemEnchantmentBaseValueAhn(item);
    const floor=Math.max(0,numberOr(rankData.laborFloorAhn,0));
    const factor=Math.max(0,numberOr(rankData.rankFactor,0));
    const rawLabor=Math.max(floor,baseValue*factor);
    const profile=provider.maxRank?provider:normalizeProviderProfile(provider,options);
    const providerAdjusted=rawLabor*profile.priceModifier;
    const facilityAdjusted=providerAdjusted*profile.workshopPriceMultiplier;
    return Object.freeze({
      resolved:true,
      currency:"AHN",
      floorAhn:roundAhn(floor),
      enchantmentBaseValueAhn:roundAhn(baseValue),
      rankFactor:factor,
      rawLaborAhn:roundAhn(rawLabor),
      providerModifier:profile.priceModifier,
      facilityModifier:profile.workshopPriceMultiplier,
      laborAhn:roundAhn(facilityAdjusted),
      normalShopRetailMarkupApplied:false,
    });
  }

  function materialUnitValueAhn(material={}) {
    const raw=[
      material.unitValueAhn,
      material.standardUnitValueAhn,
      material.productionValueAhn,
      material.totalValueAhn,
      material.priceAhn,
      material.valorBase,
      material.costo,
      material.price,
    ].find((value)=>Number.isFinite(Number(value)) && Number(value)>=0);
    return raw==null?null:Number(raw);
  }

  function materialQuote(definitionOrId,provider={},options={}) {
    const profile=provider.maxRank?provider:normalizeProviderProfile(provider,options);
    const playerMaterials=asArray(options.playerMaterials);
    const providerMaterials=asArray(options.providerMaterials);
    const combined=[...playerMaterials,...providerMaterials];
    const plan=Engine.planRecipeMaterials(definitionOrId,combined,{
      properties:options.properties,
      accidental:options.accidental,
      anchorGemInstanceId:options.gem?.instanceId || options.anchorGemInstanceId,
      gem:options.gem,
    });
    if (!plan.valid) return Object.freeze({resolved:false,reason:"missing_ritual_materials",plan});

    let providerCost=0;
    let unresolvedProviderValue=false;
    const allocations=plan.allocations.map((allocation)=>{
      const providerSupplied=allocation.materialIndex>=playerMaterials.length;
      const localIndex=providerSupplied?allocation.materialIndex-playerMaterials.length:allocation.materialIndex;
      const material=providerSupplied?providerMaterials[localIndex]:playerMaterials[localIndex];
      const unitValue=materialUnitValueAhn(material);
      if (providerSupplied && unitValue==null) unresolvedProviderValue=true;
      const cost=providerSupplied && unitValue!=null
        ? unitValue*allocation.quantity*profile.materialPriceModifier
        : 0;
      providerCost+=cost;
      return Object.freeze({
        ...clone(allocation),
        suppliedBy:providerSupplied?"provider":"player",
        materialLabel:String(material?.displayName || material?.name || material?.nombre || (providerSupplied ? "Provider material" : "Player material")).trim(),
        unitValueAhn:unitValue==null?null:roundAhn(unitValue),
        chargedAhn:roundAhn(cost),
      });
    });

    if (unresolvedProviderValue) {
      return Object.freeze({resolved:false,reason:"provider_material_unpriced",plan,allocations:Object.freeze(allocations)});
    }

    return Object.freeze({
      resolved:true,
      currency:"AHN",
      providerMaterialsAhn:roundAhn(providerCost),
      playerMaterialsDiscountAhn:roundAhn(allocations
        .filter((entry)=>entry.suppliedBy==="player" && entry.unitValueAhn!=null)
        .reduce((sum,entry)=>sum+(entry.unitValueAhn*entry.quantity),0)),
      allocations:Object.freeze(allocations),
      plan,
    });
  }

  function currentInstalledRef(item={},definitionId="") {
    const id=normalizeId(definitionId);
    return Engine.appliedEnchantments(item).find((ref)=>normalizeId(ref.definitionId)===id) || null;
  }

  function quoteEnchantService(provider={},item={},definitionOrId,rank=1,options={}) {
    const profile=provider.maxRank?provider:normalizeProviderProfile(provider,options);
    const definition=typeof definitionOrId==="string"?Enchantments.get(definitionOrId):clone(definitionOrId);
    if (!definition) return Object.freeze({quoted:false,reason:"unknown_enchantment"});
    const service=normalizeId(options.serviceId || "enchant");
    const properties=[
      ...asArray(options.properties),
      ...(service==="bind"?["bind"]:[]),
      ...(service==="curse"?["curse"]:[]),
    ];
    const gate=providerCanService(profile,service,{
      rank,
      definition,
      enchantmentId:definition.id,
      recipeProvided:options.recipeProvided===true,
    });
    if (!gate.allowed) return Object.freeze({quoted:false,...gate});

    const application=options.gem
      ? Engine.validateGemAnchorApplication(item,options.gem,definition,rank,{...options,properties})
      : Engine.validateApplication(item,definition,rank,{...options,properties});
    if (!application.allowed) return Object.freeze({quoted:false,reason:application.reason || "invalid_enchantment_application",application});

    const labor=laborQuote(item,definition,rank,profile,options);
    const materials=materialQuote(definition,profile,{...options,properties});
    if (!materials.resolved) return Object.freeze({quoted:false,reason:materials.reason,labor,materials});

    const duration=serviceDuration(profile,rank,definition,options);
    const reliability=effectiveReliability(profile,definition,item,options);
    const threshold=Engine.ritualThresholdPreview(item,definition,rank,{...options,properties,gem:options.gem || null});
    const total=roundAhn(labor.laborAhn+materials.providerMaterialsAhn);

    return Object.freeze({
      quoted:true,
      service,
      currency:"AHN",
      definitionId:definition.id,
      rank:Number(rank),
      properties:Object.freeze(properties.map(normalizeId).filter(Boolean)),
      gem:options.gem?Object.freeze(clone(options.gem)):null,
      labor,
      materials,
      duration,
      reliability,
      threshold,
      totalAhn:total,
      normalShopRetailMarkupApplied:false,
    });
  }

  function quoteStrengthenService(provider={},item={},definitionId,targetRank,options={}) {
    const profile=provider.maxRank?provider:normalizeProviderProfile(provider,options);
    const definition=Enchantments.get(definitionId);
    if (!definition) return Object.freeze({quoted:false,reason:"unknown_enchantment"});
    const current=currentInstalledRef(item,definition.id);
    if (!current) return Object.freeze({quoted:false,reason:"enchantment_not_installed"});
    const gate=providerCanService(profile,"strengthen",{
      rank:targetRank,
      definition,
      enchantmentId:definition.id,
      recipeProvided:options.recipeProvided===true,
    });
    if (!gate.allowed) return Object.freeze({quoted:false,...gate});
    const strengthening=Engine.validateStrengthening(item,definition.id,targetRank,options);
    if (!strengthening.allowed) return Object.freeze({quoted:false,reason:strengthening.reason,strengthening});

    const labor=laborQuote(item,definition,targetRank,profile,options);
    const materials=materialQuote(definition,profile,{
      ...options,
      properties:current.properties,
      gem:current.source==="gem"
        ? {definitionId:Engine.gemAnchors(item).find((a)=>a.anchorId===current.anchorId)?.gemDefinitionId,
           instanceId:Engine.gemAnchors(item).find((a)=>a.anchorId===current.anchorId)?.gemInstanceId,
           quality:Engine.gemAnchors(item).find((a)=>a.anchorId===current.anchorId)?.gemQuality}
        : null,
    });
    if (!materials.resolved) return Object.freeze({quoted:false,reason:materials.reason,labor,materials});
    const duration=serviceDuration(profile,targetRank,definition,options);
    const reliability=effectiveReliability(profile,definition,item,options);

    return Object.freeze({
      quoted:true,
      service:"strengthen",
      currency:"AHN",
      definitionId:definition.id,
      currentRank:Number(current.rank),
      targetRank:Number(targetRank),
      labor,
      materials,
      duration,
      reliability,
      totalAhn:roundAhn(labor.laborAhn+materials.providerMaterialsAhn),
      normalShopRetailMarkupApplied:false,
    });
  }

  function quoteMagicalRepair(provider={},item={},options={}) {
    const profile=provider.maxRank?provider:normalizeProviderProfile(provider,options);
    const gate=providerCanService(profile,"magical_repair",{});
    if (!gate.allowed) return Object.freeze({quoted:false,...gate});
    const state=Magic.magicalDurabilityState(item);
    if (state.max==null) return Object.freeze({quoted:false,reason:"item_has_no_magical_durability"});
    const missing=Math.max(0,state.max-state.current);
    const perPoint=[
      options.magicalRepairAhnPerPoint,
      profile.magicalRepairAhnPerPoint,
    ].find((value)=>Number.isFinite(Number(value)) && Number(value)>=0);
    if (missing>0 && perPoint==null) return Object.freeze({
      quoted:false,
      reason:"magical_repair_price_unresolved",
      missing,
      state,
    });
    const rawLabor=missing*numberOr(perPoint,0);
    const labor=roundAhn(rawLabor*profile.priceModifier*profile.workshopPriceMultiplier);
    const fixedMaterial=roundAhn(numberOr(options.providerMaterialsAhn,0)*profile.materialPriceModifier);
    return Object.freeze({
      quoted:true,
      service:"magical_repair",
      currency:"AHN",
      state,
      restorePoints:missing,
      perPointAhn:perPoint==null?0:roundAhn(perPoint),
      laborAhn:labor,
      providerMaterialsAhn:fixedMaterial,
      totalAhn:roundAhn(labor+fixedMaterial),
      normalShopRetailMarkupApplied:false,
    });
  }

  function quoteFixedService(provider={},serviceId,options={}) {
    const profile=provider.maxRank?provider:normalizeProviderProfile(provider,options);
    const service=normalizeId(serviceId);
    const gate=providerCanService(profile,service,options);
    if (!gate.allowed) return Object.freeze({quoted:false,...gate});
    const base=profile.servicePriceAhn?.[service] ?? options.basePriceAhn;
    if (!Number.isFinite(Number(base))) return Object.freeze({quoted:false,reason:"service_price_unresolved",service});
    return Object.freeze({
      quoted:true,
      service,
      currency:"AHN",
      laborAhn:roundAhn(Number(base)*profile.priceModifier*profile.workshopPriceMultiplier),
      providerMaterialsAhn:0,
      totalAhn:roundAhn(Number(base)*profile.priceModifier*profile.workshopPriceMultiplier),
      normalShopRetailMarkupApplied:false,
    });
  }




  function safeEffectPreview(definitionOrId,rank) {
    const definition=typeof definitionOrId==="string"?Enchantments.get(definitionOrId):definitionOrId;
    const rankData=Enchantments.resolveRank(definition,rank);
    return Object.freeze(asArray(rankData?.effects).map((effect)=>{
      const type=normalizeId(effect.type);
      const value=Number(effect.value);
      if (type==="damage_percent") return `Damage +${Number.isFinite(value)?value:0}%${effect.damageType?` (${String(effect.damageType)})`:""}`;
      if (type==="secondary_damage_percent") return `Secondary Damage +${Number.isFinite(value)?value:0}%`;
      if (type==="magic_hit") return "Magic Hit";
      if (type==="resistance_percent") return `Resistance +${Number.isFinite(value)?value:0}%`;
      if (type==="status_resistance_percent") return `Status Resistance +${Number.isFinite(value)?value:0}%`;
      if (type==="max_hp_percent") return `Max HP +${Number.isFinite(value)?value:0}%`;
      if (type==="max_sp_percent") return `Max SP +${Number.isFinite(value)?value:0}%`;
      if (type==="speed_percent") return `Speed +${Number.isFinite(value)?value:0}%`;
      if (type==="initiative_flat") return `Initiative +${Number.isFinite(value)?value:0}`;
      if (type==="spell_grant") return "Grants an Item-bound Spell";
      if (type==="passive_flag") return "Passive magical property";
      return "Magical property";
    }));
  }

  function playerServicePreview(viewer={},provider={},item={},quote={},options={}) {
    if (!quote?.quoted) return Object.freeze({available:false,reason:"invalid_quote"});
    const knowledge=knowledgeRuntime();
    const compendium=compendiumRuntime();
    const definition=quote.definitionId?Enchantments.get(quote.definitionId):null;
    const rank=Number(quote.rank ?? quote.targetRank ?? 0) || 0;
    const passive=knowledge?.passiveArcana ? knowledge.passiveArcana(viewer) : 0;
    const thresholdValue=Number(quote.threshold?.finalThreshold ?? quote.threshold?.threshold ?? NaN);
    const recipeKnown=Boolean(definition && compendium?.knowsRecipe?.(viewer,definition.id,rank));
    const itemKnowledge=knowledge?.knowledgeOf ? knowledge.knowledgeOf(viewer,item) : {};
    const basicDifficultyVisible=passive>=10 || recipeKnown;
    const arcanaDeepVisible=itemKnowledge?.effectsKnown===true || (Number.isFinite(thresholdValue) && passive>=thresholdValue);
    const recipeDetailVisible=recipeKnown || arcanaDeepVisible;
    const runes=(label)=>knowledge?.arcaneRunes
      ? knowledge.arcaneRunes(label,`service:${quote.service}:${definition?.id || "general"}:${rank || 0}`)
      : "ᚠᚢᚦᚨᚱᚲ";

    let difficulty=null;
    if (Number.isFinite(thresholdValue)) {
      difficulty=recipeDetailVisible
        ? Object.freeze({known:true,label:knowledge?.difficultyLabel?.(thresholdValue) || "Arcane",threshold:thresholdValue,text:`${knowledge?.difficultyLabel?.(thresholdValue) || "Arcane"} · TH ${thresholdValue}`})
        : basicDifficultyVisible
          ? Object.freeze({known:false,label:knowledge?.difficultyLabel?.(thresholdValue) || "Arcane",threshold:null,text:knowledge?.difficultyLabel?.(thresholdValue) || "Arcane"})
          : Object.freeze({known:false,label:null,threshold:null,text:runes("Service difficulty")});
    }

    const probability=quote.reliability?.resolved===true ? Number(quote.reliability.probability) : null;
    const probabilityView=probability==null
      ? null
      : arcanaDeepVisible
        ? Object.freeze({known:true,value:probability,percent:Math.round(probability*100),text:`${Math.round(probability*100)}%`})
        : Object.freeze({known:false,value:null,percent:null,text:runes("Controlled result probability")});

    const materials=recipeDetailVisible
      ? Object.freeze(asArray(quote.materials?.allocations).map((entry)=>Object.freeze({
          label:String(entry.materialLabel || (entry.suppliedBy==="provider"?"Provider material":"Player material")),
          quantity:Number(entry.quantity)||0,
          suppliedBy:entry.suppliedBy==="provider"?"Provider":"Player",
        })))
      : Object.freeze([{label:runes("Ritual materials"),quantity:null,suppliedBy:null}]);

    const effects=definition && recipeDetailVisible
      ? safeEffectPreview(definition,rank)
      : definition
        ? Object.freeze([runes("Enchantment effects")])
        : Object.freeze([]);

    let projectedMagicalDurability=null;
    if (arcanaDeepVisible && definition && ["enchant","bind","curse","mount_gem"].includes(normalizeId(quote.service))) {
      const refs=Engine.appliedEnchantments(item);
      const candidate={
        definitionId:definition.id,
        rank,
        source:quote.gem?"gem":"direct",
        properties:quote.properties || [],
        anchorId:quote.gem?"preview_anchor":null,
      };
      projectedMagicalDurability=Engine.inferredMagicalDurabilityMax(item,[...refs,candidate]);
    }

    return Object.freeze({
      available:true,
      serviceLabel:SERVICE_LABELS[quote.service] || String(quote.service || "Service"),
      enchantmentName:definition?.name || null,
      rank:recipeDetailVisible ? rank || null : null,
      rankText:rank ? (recipeDetailVisible ? String(["","I","II","III"][rank] || rank) : runes("Rank")) : null,
      priceAhn:Number(quote.totalAhn)||0,
      duration:quote.duration?.resolved ? quote.duration : null,
      difficulty,
      controlledResult:probabilityView,
      materials,
      effects,
      projectedMagicalDurability,
      recipeKnown,
      arcanaDeepVisible,
      arcanaPassive:passive,
      internalIdsExposed:false,
    });
  }

  function rollD20(options={}) {
    if (Number.isFinite(Number(options.roll))) return clamp(Math.trunc(Number(options.roll)),1,20);
    if (typeof options.rollD20==="function") return clamp(Math.trunc(Number(options.rollD20()))||1,1,20);
    return 1+Math.floor(Math.random()*20);
  }

  function controlBandFromMargin(margin) {
    const value=Number(margin);
    if (value>=0) return "controlled";
    if (value>=-3) return "minor_deviation";
    if (value>=-7) return "major_deviation";
    return "arcane_backlash";
  }

  function outcomePoolForBand(options={},band="") {
    const pools=options.outcomePools || options.outcomes || {};
    if (Array.isArray(pools)) {
      return pools.filter((entry)=> {
        const bands=asArray(entry?.bands || entry?.band).map(normalizeId);
        return !bands.length || bands.includes(normalizeId(band));
      });
    }
    return asArray(pools?.[band] || pools?.[normalizeId(band)]);
  }

  function selectPlayerDeviationOutcome(options={},band="",roll=0) {
    const pool=outcomePoolForBand(options,band);
    if (!pool.length) return null;
    return weightedOutcome(pool,roll);
  }

  function applyPlayerDeviation(item={},definitionId,outcome={},options={}) {
    const kind=normalizeId(outcome?.kind || outcome?.outcome || "");
    if (!kind) return Object.freeze({ applied:false, reason:"authored_deviation_outcome_required", item:clone(item) });

    if (["anchor_broken","anchor_depleted","anchor_unstable","accidental_bind","accidental_curse"].includes(kind)) {
      const anchorId=String(options.anchorId || outcome.anchorId || "");
      if (anchorId) {
        const result=Engine.applyGemArcaneOutcome(item,anchorId,kind,{
          allowAccidentalBind:kind==="accidental_bind",
          allowAccidentalCurse:kind==="accidental_curse",
        });
        return Object.freeze({ applied:result.changed===true, kind, result, item:result.item || clone(item) });
      }
      if (kind==="accidental_bind" || kind==="accidental_curse") {
        const property=kind==="accidental_bind"?"bind":"curse";
        const result=Engine.addEnchantmentProperty(item,definitionId,property);
        return Object.freeze({ applied:result.changed===true, kind, result, item:result.item || clone(item) });
      }
      return Object.freeze({ applied:false, kind, reason:"gem_anchor_required_for_outcome", item:clone(item) });
    }

    if (kind==="magical_durability_damage") {
      const target=clone(item);
      const amount=Math.max(0,numberOr(outcome.amount ?? options.magicalDurabilityDamage,0));
      if (amount<=0) return Object.freeze({ applied:false, kind, reason:"magical_durability_damage_unresolved", item:target });
      const result=Magic.spendMagicalDurability(target,amount,{normalWear:false,specialUse:true,allowPartial:true});
      return Object.freeze({ applied:result.spent===true, kind, result, item:Object.freeze(target) });
    }

    if (kind==="alternate_enchantment") {
      const alternateId=normalizeId(outcome.alternateEnchantmentId || outcome.enchantmentId || "");
      if (!alternateId) return Object.freeze({ applied:false, kind, reason:"alternate_enchantment_unresolved", item:clone(item) });
      const rank=Math.max(1,Math.trunc(numberOr(outcome.rank ?? options.rank,1)));
      const properties=asArray(outcome.properties || options.properties);
      const result=options.gem
        ? Engine.mountGemAnchor(item,options.gem,alternateId,rank,{...options,properties})
        : Engine.applyEnchantment(item,alternateId,rank,{...options,properties});
      return Object.freeze({ applied:Boolean(result.applied||result.mounted), kind, result, item:result.item || clone(item) });
    }

    if (kind==="unchanged_existing" || kind==="abstract_only") {
      return Object.freeze({ applied:true, kind, item:Object.freeze(clone(item)), abstract:true });
    }

    return Object.freeze({ applied:false, kind, reason:"unsupported_authored_deviation_outcome", item:clone(item) });
  }

  function playerAttemptThreshold(item={},definitionOrId,rank=1,options={}) {
    return Engine.ritualThresholdPreview(item,definitionOrId,rank,{
      ...options,
      gem:options.gem || null,
      properties:options.properties,
    });
  }

  function resolvePlayerControlCheck(item={},definitionOrId,rank=1,options={}) {
    const threshold=playerAttemptThreshold(item,definitionOrId,rank,options);
    if (!threshold.valid) return Object.freeze({ resolved:false, reason:threshold.reason || "invalid_attempt", threshold });
    const die=rollD20(options);
    const modifier=numberOr(options.arcanaModifier,0);
    const total=die+modifier;
    const margin=total-Number(threshold.finalThreshold);
    const band=controlBandFromMargin(margin);
    return Object.freeze({
      resolved:true,
      die,
      modifier,
      total,
      threshold:Number(threshold.finalThreshold),
      thresholdDetail:threshold,
      margin,
      band,
      controlled:band==="controlled",
    });
  }

  function protectedAnchorForDefinition(item={},definitionId="") {
    const ref=Engine.appliedEnchantments(item).find((entry)=>normalizeId(entry.definitionId)===normalizeId(definitionId));
    if (!ref || ref.source!=="gem") return null;
    const anchor=Engine.gemAnchors(item).find((entry)=>entry.anchorId===ref.anchorId);
    if (!anchor) return null;
    return {
      ref,
      anchor,
      gem:{
        definitionId:anchor.gemDefinitionId,
        instanceId:anchor.gemInstanceId,
        quality:anchor.gemQuality,
      },
    };
  }

  function consumePlayerAttemptMaterials(definitionOrId,options={}) {
    const materials=asArray(options.materials || options.playerMaterials);
    if (!materials.length) return Object.freeze({ consumed:true, skipped:true, reason:"no_authored_materials_supplied" });
    return Engine.consumeRecipeMaterials(definitionOrId,materials,{
      properties:options.properties,
      accidental:false,
      gem:options.gem,
      anchorGemInstanceId:options.gem?.instanceId || options.anchorGemInstanceId,
    });
  }

  function attemptPlayerEnchant(item={},definitionOrId,rank=1,options={}) {
    const definition=typeof definitionOrId==="string"?Enchantments.get(definitionOrId):clone(definitionOrId);
    if (!definition) return Object.freeze({ attempted:false, reason:"unknown_enchantment" });
    const validation=options.gem
      ? Engine.validateGemAnchorApplication(item,options.gem,definition,rank,options)
      : Engine.validateApplication(item,definition,rank,options);
    if (!validation.allowed) return Object.freeze({ attempted:false, reason:validation.reason || "invalid_enchantment_application", validation });

    const check=resolvePlayerControlCheck(item,definition,rank,options);
    if (!check.resolved) return Object.freeze({ attempted:false, reason:check.reason, check });
    const materials=consumePlayerAttemptMaterials(definition,options);
    if (!materials.consumed) return Object.freeze({ attempted:false, reason:materials.reason || "material_consumption_failed", check, materials });

    if (check.controlled) {
      const result=options.gem
        ? Engine.mountGemAnchor(item,options.gem,definition,rank,options)
        : Engine.applyEnchantment(item,definition,rank,options);
      return Object.freeze({
        attempted:true,
        controlled:true,
        band:check.band,
        check,
        materials,
        result,
        item:result.item || clone(item),
      });
    }

    const deviationRoll=Number.isFinite(Number(options.deviationRoll))?clamp(Number(options.deviationRoll),0,0.999999999):Math.random();
    const outcome=selectPlayerDeviationOutcome(options,check.band,deviationRoll);
    if (!outcome) {
      return Object.freeze({
        attempted:true,
        controlled:false,
        band:check.band,
        check,
        materials,
        resolved:false,
        reason:"authored_deviation_outcome_required",
        item:Object.freeze(clone(item)),
      });
    }
    const deviation=applyPlayerDeviation(item,definition.id,outcome,{...options,rank});
    return Object.freeze({
      attempted:true,
      controlled:false,
      band:check.band,
      check,
      materials,
      outcome,
      deviation,
      resolved:deviation.applied===true,
      item:deviation.item || clone(item),
    });
  }

  function attemptPlayerStrengthen(item={},definitionId,targetRank,options={}) {
    const definition=Enchantments.get(definitionId);
    if (!definition) return Object.freeze({ attempted:false, reason:"unknown_enchantment" });
    const strengthening=Engine.validateStrengthening(item,definition.id,targetRank,options);
    if (!strengthening.allowed) return Object.freeze({ attempted:false, reason:strengthening.reason, strengthening });

    const anchorInfo=protectedAnchorForDefinition(item,definition.id);
    const properties=strengthening.current.properties;
    const checkOptions={
      ...options,
      properties,
      gem:anchorInfo?.gem || null,
      anchorId:anchorInfo?.anchor?.anchorId || options.anchorId,
      anchorGemInstanceId:anchorInfo?.anchor?.gemInstanceId || options.anchorGemInstanceId,
    };
    const check=resolvePlayerControlCheck(item,definition,targetRank,checkOptions);
    if (!check.resolved) return Object.freeze({ attempted:false, reason:check.reason, check });
    const materials=consumePlayerAttemptMaterials(definition,checkOptions);
    if (!materials.consumed) return Object.freeze({ attempted:false, reason:materials.reason || "material_consumption_failed", check, materials });

    if (check.controlled) {
      const result=Engine.strengthenEnchantment(item,definition.id,targetRank,options);
      return Object.freeze({
        attempted:true,
        controlled:true,
        band:check.band,
        check,
        materials,
        result,
        item:result.item || clone(item),
      });
    }

    const deviationRoll=Number.isFinite(Number(options.deviationRoll))?clamp(Number(options.deviationRoll),0,0.999999999):Math.random();
    const outcome=selectPlayerDeviationOutcome(options,check.band,deviationRoll);
    if (!outcome) {
      return Object.freeze({
        attempted:true,
        controlled:false,
        band:check.band,
        check,
        materials,
        resolved:false,
        reason:"authored_deviation_outcome_required",
        item:Object.freeze(clone(item)),
      });
    }
    const deviation=applyPlayerDeviation(item,definition.id,outcome,{...checkOptions,rank:targetRank});
    return Object.freeze({
      attempted:true,
      controlled:false,
      band:check.band,
      check,
      materials,
      outcome,
      deviation,
      resolved:deviation.applied===true,
      item:deviation.item || clone(item),
    });
  }

  function quoteGemProcedure(provider={},item={},anchorId,procedure="safe_extract",options={}) {
    const profile=provider.maxRank?provider:normalizeProviderProfile(provider,options);
    const mode=normalizeId(procedure || "safe_extract");
    const service=mode==="rewrite" || mode==="item_side_remove" ? "remove_rewrite" : "extract_gem";
    const gate=providerCanService(profile,service,{});
    if (!gate.allowed) return Object.freeze({quoted:false,...gate});

    const link=Engine.gemAnchorLink(item,anchorId);
    if (!link.found) return Object.freeze({quoted:false,reason:link.reason || "gem_anchor_not_found"});
    const bound=link.reference.properties.includes("bind");

    if ((mode==="safe_extract" || mode==="item_side_remove" || mode==="rewrite") && !bound) {
      const qualityAfter=normalizeId(options.gemQualityAfter || options.qualityAfter || "");
      if (!qualityAfter) {
        return Object.freeze({
          quoted:false,
          reason:"gem_quality_downgrade_unresolved",
          requiresAuthoredGemQualityAfter:true,
          anchor:link.anchor,
        });
      }
    }

    const fixed=quoteFixedService(profile,service,options);
    if (!fixed.quoted) return fixed;

    return Object.freeze({
      ...fixed,
      anchorId:String(anchorId),
      procedure:mode,
      bound,
      destructive:bound || mode==="destroy_anchor",
      destroysItem:bound,
      destroysGem:!bound && mode==="destroy_anchor",
      gemQualityAfter:normalizeId(options.gemQualityAfter || options.qualityAfter || "") || null,
      nextDefinitionId:normalizeId(options.nextDefinitionId || options.enchantmentId || "") || null,
      rank:Number(options.rank || link.reference.rank),
    });
  }


  function quoteAdjustment(options={}) {
    const multiplier = Number.isFinite(Number(options.servicePriceMultiplier))
      ? Math.max(0,Number(options.servicePriceMultiplier))
      : 1;
    const discount = clamp(numberOr(options.discountPercent,0),0,100);
    const surcharge = Math.max(0,numberOr(options.surchargePercent,0));
    return Object.freeze({
      multiplier,
      discountPercent:discount,
      surchargePercent:surcharge,
      effectiveMultiplier:Math.max(0,multiplier*(1-discount/100)*(1+surcharge/100)),
    });
  }

  function adjustedQuoteTotal(totalAhn,options={}) {
    const adjustment=quoteAdjustment(options);
    return Object.freeze({
      adjustment,
      totalAhn:roundAhn(Math.max(0,numberOr(totalAhn,0))*adjustment.effectiveMultiplier),
    });
  }

  function walletBalance(target={},options={}) {
    if (options.freeService===true) return Object.freeze({resolved:true,field:null,balance:Infinity});
    const fields=[options.currencyField,"ahn","balanceAhn","moneyAhn","dinero","money"].filter(Boolean);
    for(const field of fields){
      if (Number.isFinite(Number(target?.[field]))) {
        return Object.freeze({resolved:true,field:String(field),balance:Math.max(0,Number(target[field]))});
      }
    }
    return Object.freeze({resolved:false,field:null,balance:0});
  }

  function stableTransactionId(item={},quote={},options={}) {
    if (options.transactionId) return String(options.transactionId);
    const stamp=Number.isFinite(Number(options.startedAt))?Number(options.startedAt):Date.now();
    const itemId=String(item.instanceId || item.id || "item");
    const rank=quote.rank ?? quote.targetRank ?? "x";
    return `enchanter:${stamp}:${normalizeId(quote.service || "service")}:${itemId}:${normalizeId(quote.definitionId || "general")}:${rank}`;
  }

  function transactionStore(owner={},create=false) {
    if (owner.enchanterTransactions && typeof owner.enchanterTransactions==="object" && !Array.isArray(owner.enchanterTransactions)) {
      return owner.enchanterTransactions;
    }
    if (!create) return {};
    owner.enchanterTransactions={};
    return owner.enchanterTransactions;
  }

  function previewServiceResult(item={},quote={},options={}) {
    if (!quote?.quoted) return Object.freeze({previewed:false,reason:"invalid_quote"});
    const target=clone(item);
    const execution=executeControlledResult(target,quote,{
      ...options,
      applicationId:options.applicationId || "preview",
      appliedBy:options.appliedBy || "preview",
      appliedAt:options.appliedAt || 0,
      provenance:{...(options.provenance||{}),preview:true},
    });
    if (!execution.executed) return Object.freeze({previewed:false,reason:execution.reason || execution.result?.reason || "preview_failed",execution});
    const resultingItem=clone(execution.item || execution.result?.item || target);
    return Object.freeze({previewed:true,item:Object.freeze(resultingItem),execution});
  }

  function applyObjectSnapshot(target={},snapshot={}) {
    if (!target || typeof target!=="object") return false;
    Object.keys(target).forEach((key)=>delete target[key]);
    Object.assign(target,clone(snapshot));
    return true;
  }

  function commitMaterialSnapshots(originals=[],snapshots=[]) {
    for(let index=0;index<originals.length;index+=1){
      const original=originals[index];
      const snapshot=snapshots[index];
      if (!original || !snapshot || typeof original!=="object") continue;
      applyObjectSnapshot(original,snapshot);
    }
  }

  function commitServiceTransaction(owner={},item={},quote={},options={}) {
    if (!owner || typeof owner!=="object") return Object.freeze({committed:false,reason:"missing_transaction_owner"});
    if (!item || typeof item!=="object") return Object.freeze({committed:false,reason:"missing_item"});
    if (!quote?.quoted) return Object.freeze({committed:false,reason:"invalid_quote"});

    const transactionId=stableTransactionId(item,quote,options);
    if (transactionStore(owner)[transactionId]) {
      return Object.freeze({committed:false,reason:"duplicate_transaction",transactionId});
    }

    const freeService=options.freeService===true || options.dmFreeService===true;
    const wallet=walletBalance(owner,{...options,freeService});
    if (!wallet.resolved) return Object.freeze({committed:false,reason:"currency_balance_unresolved",transactionId});

    const adjustment=adjustedQuoteTotal(quote.totalAhn,options);
    const chargeAhn=freeService?0:adjustment.totalAhn;
    if (wallet.balance<chargeAhn) {
      return Object.freeze({committed:false,reason:"insufficient_ahn",requiredAhn:chargeAhn,availableAhn:wallet.balance,transactionId});
    }

    const playerMaterials=asArray(options.playerMaterials);
    const providerMaterials=asArray(options.providerMaterials);
    const playerCopies=playerMaterials.map(clone);
    const providerCopies=providerMaterials.map(clone);
    let materialConsumption=Object.freeze({consumed:true,skipped:true,reason:"no_ritual_consumption"});
    if (quote.definitionId && (playerCopies.length || providerCopies.length)) {
      materialConsumption=Engine.consumeRecipeMaterials(
        quote.definitionId,
        [...playerCopies,...providerCopies],
        {
          properties:quote.properties,
          gem:quote.gem,
          anchorGemInstanceId:quote.gem?.instanceId,
        }
      );
      if (!materialConsumption.consumed) {
        return Object.freeze({committed:false,reason:materialConsumption.reason || "material_consumption_failed",transactionId,materialConsumption});
      }
    } else if (quote.materials?.plan?.valid===false) {
      return Object.freeze({committed:false,reason:"required_materials_missing",transactionId});
    }

    const applicationId=String(options.applicationId || transactionId);
    const actorId=String(options.appliedBy || options.actorId || owner.id || owner.playerId || owner.npcId || (freeService?"dm":"unknown"));
    const execution=executeControlledResult(clone(item),quote,{
      ...options,
      viewer:options.viewer || owner,
      applicationId,
      appliedBy:actorId,
      appliedAt:Number.isFinite(Number(options.startedAt))?Number(options.startedAt):Date.now(),
      provenance:{
        ...(options.provenance||{}),
        transactionId,
        service:quote.service,
        providerId:options.providerId || quote.providerId || null,
        encounterId:options.encounterId || null,
        locationId:options.locationId || null,
        freeService,
      },
    });
    if (!execution.executed) {
      return Object.freeze({
        committed:false,
        reason:execution.reason || execution.result?.reason || "service_execution_failed",
        transactionId,
        execution,
      });
    }

    const resultingItem=clone(execution.item || execution.result?.item || item);
    if (!freeService && wallet.field) owner[wallet.field]=Math.max(0,wallet.balance-chargeAhn);
    commitMaterialSnapshots(playerMaterials,playerCopies);
    commitMaterialSnapshots(providerMaterials,providerCopies);
    applyObjectSnapshot(item,resultingItem);

    const receipt=Object.freeze({
      transactionId,
      committed:true,
      service:quote.service,
      itemInstanceId:String(item.instanceId || item.id || ""),
      definitionId:quote.definitionId || null,
      rank:quote.rank ?? quote.targetRank ?? null,
      chargedAhn:chargeAhn,
      freeService,
      appliedBy:actorId,
      timestamp:Number.isFinite(Number(options.startedAt))?Number(options.startedAt):Date.now(),
      adjustment:adjustment.adjustment,
    });
    transactionStore(owner,true)[transactionId]=clone(receipt);
    return Object.freeze({
      ...receipt,
      item:Object.freeze(clone(item)),
      materialConsumption,
      execution,
    });
  }

  function beginService(provider={},item={},quote={},options={}) {
    if (!quote?.quoted) return Object.freeze({started:false,reason:"invalid_quote"});
    const durationHours=Number.isFinite(Number(options.durationHours))
      ? Number(options.durationHours)
      : (quote.duration?.resolved?Number(quote.duration.hours):null);
    if (!Number.isFinite(durationHours) || durationHours<=0) {
      return Object.freeze({started:false,reason:"delivery_time_unresolved",duration:quote.duration||null});
    }

    if (quote.definitionId && (asArray(options.playerMaterials).length || asArray(options.providerMaterials).length)) {
      const allMaterials=[...asArray(options.playerMaterials),...asArray(options.providerMaterials)];
      const consumption=Engine.consumeRecipeMaterials(quote.definitionId,allMaterials,{
        properties:quote.properties,
        gem:quote.gem,
        anchorGemInstanceId:quote.gem?.instanceId,
      });
      if (!consumption.consumed) return Object.freeze({started:false,reason:consumption.reason||"material_consumption_failed",consumption});
    }

    const startedAt=Number.isFinite(Number(options.startedAt))?Number(options.startedAt):Date.now();
    const readyAt=startedAt+Math.round(durationHours*60*60*1000);
    const job=Object.freeze({
      jobId:String(options.jobId || `enchanter_${startedAt}_${normalizeId(quote.service)}`),
      status:"in_service",
      providerId:String((provider.id || provider.providerId || "")??""),
      itemInstanceId:String(item?.instanceId || item?.id || ""),
      service:quote.service,
      definitionId:quote.definitionId || null,
      rank:quote.rank ?? quote.targetRank ?? null,
      startedAt,
      readyAt,
      durationHours,
      totalAhn:numberOr(quote.totalAhn,0),
      quote:Object.freeze(clone(quote)),
    });
    return Object.freeze({started:true,job});
  }

  function serviceReady(job={},now=Date.now()) {
    if (!job || normalizeId(job.status)!=="in_service") return false;
    return Number.isFinite(Number(job.readyAt)) && Number(now)>=Number(job.readyAt);
  }

  function executeControlledResult(item={},quote={},options={}) {
    if (!quote?.quoted) return Object.freeze({executed:false,reason:"invalid_quote"});
    if (quote.service==="enchant" || quote.service==="bind" || quote.service==="curse" || quote.service==="mount_gem") {
      const properties=quote.properties || [];
      const result=quote.gem
        ? Engine.mountGemAnchor(item,quote.gem,quote.definitionId,quote.rank,{...options,properties})
        : Engine.applyEnchantment(item,quote.definitionId,quote.rank,{...options,properties});
      return Object.freeze({executed:Boolean(result.mounted||result.applied),result});
    }
    if (quote.service==="strengthen") {
      const result=Engine.strengthenEnchantment(item,quote.definitionId,quote.targetRank,options);
      return Object.freeze({executed:result.strengthened===true,result});
    }
    if (quote.service==="magical_repair") {
      const target=clone(item);
      const result=Magic.restoreMagicalDurability(target,quote.restorePoints,{full:true});
      return Object.freeze({executed:result.restored===true || quote.restorePoints===0,result,item:Object.freeze(target)});
    }
    if (quote.service==="identify") {
      const viewer=options.viewer || options.owner || null;
      const knowledge=knowledgeRuntime();
      if(!viewer || !knowledge?.identifyItem) return Object.freeze({executed:false,reason:"knowledge_runtime_or_viewer_unavailable"});
      const result=knowledge.identifyItem(viewer,item,{revealDurability:options.revealDurability===true});
      return Object.freeze({executed:result.identified===true,result,item:Object.freeze(clone(item))});
    }
    if (quote.service==="curse_analysis") {
      const viewer=options.viewer || options.owner || null;
      const knowledge=knowledgeRuntime();
      if(!viewer || !knowledge?.identifyCurse) return Object.freeze({executed:false,reason:"knowledge_runtime_or_viewer_unavailable"});
      const result=knowledge.identifyCurse(viewer,item,{source:"enchanter_service"});
      return Object.freeze({executed:result.identified===true,result,item:Object.freeze(clone(item))});
    }
    if (quote.service==="remove_curse") {
      if(item?.magic?.relic?.inseparableDrawback===true || item?.relic?.inseparableDrawback===true) {
        return Object.freeze({executed:false,reason:"relic_drawback_inseparable"});
      }
      const curseRef=Engine.appliedEnchantments(item).find((ref)=>asArray(ref.properties).map(normalizeId).includes("curse"));
      if(!curseRef) return Object.freeze({executed:false,reason:"removable_curse_not_found"});
      if(asArray(curseRef.properties).map(normalizeId).includes("bind")) return Object.freeze({executed:false,reason:"bound_curse_not_removable"});
      const result=Engine.removeEnchantmentProperty(item,curseRef.definitionId,"curse",{
        anchorId:curseRef.anchorId,
        appliedBy:options.appliedBy,
        appliedAt:options.appliedAt,
        provenance:options.provenance,
      });
      if(result.changed && options.viewer) Magic.removeCurse(options.viewer,item);
      return Object.freeze({executed:result.changed===true,result,item:result.item || Object.freeze(clone(item))});
    }
    if (quote.service==="remove_rewrite") {
      const procedure=normalizeId(quote.procedure || options.procedure || "direct_remove");
      if (procedure==="direct_remove") {
        const result=Engine.removeEnchantment(item,quote.definitionId || options.definitionId);
        return Object.freeze({executed:result.removed===true,result});
      }
      if (procedure==="item_side_remove" || procedure==="safe_extract") {
        const result=Engine.itemSideRemoveGemEnchantment(item,quote.anchorId || options.anchorId,{
          ...options,
          gemQualityAfter:quote.gemQualityAfter || options.gemQualityAfter,
          confirmDestruction:options.confirmDestruction===true,
        });
        return Object.freeze({executed:result.removed===true || result.catastrophic===true,result});
      }
      if (procedure==="rewrite") {
        const result=Engine.rewriteGemAnchoredEnchantment(
          item,
          quote.anchorId || options.anchorId,
          quote.nextDefinitionId || options.nextDefinitionId,
          {
            ...options,
            rank:quote.rank || options.rank,
            gemQualityAfter:quote.gemQualityAfter || options.gemQualityAfter,
          }
        );
        return Object.freeze({executed:result.rewritten===true,result});
      }
    }
    if (quote.service==="extract_gem") {
      const procedure=normalizeId(quote.procedure || options.procedure || "safe_extract");
      const common={
        ...options,
        gemQualityAfter:quote.gemQualityAfter || options.gemQualityAfter,
        confirmDestruction:options.confirmDestruction===true,
      };
      const result=procedure==="destroy_anchor"
        ? Engine.anchorSideDestroyGemEnchantment(item,quote.anchorId || options.anchorId,common)
        : Engine.itemSideRemoveGemEnchantment(item,quote.anchorId || options.anchorId,common);
      return Object.freeze({executed:result.removed===true || result.catastrophic===true,result});
    }
    return Object.freeze({executed:false,reason:"service_execution_not_implemented"});
  }

  const API=Object.freeze({
    VERSION,
    MAX_REPRODUCIBLE_RANK,
    SERVICE_IDS,
    SERVICE_LABELS,
    DURATION_BANDS,
    normalizeProviderProfile,
    providerKnows,
    providerSpecialtyMatches,
    effectiveReliability,
    providerCanService,
    resolveNpcOutcome,
    durationBand,
    serviceDuration,
    itemEnchantmentBaseValueAhn,
    laborQuote,
    materialUnitValueAhn,
    materialQuote,
    quoteEnchantService,
    quoteStrengthenService,
    quoteMagicalRepair,
    quoteFixedService,
    rollD20,
    controlBandFromMargin,
    outcomePoolForBand,
    selectPlayerDeviationOutcome,
    applyPlayerDeviation,
    playerAttemptThreshold,
    resolvePlayerControlCheck,
    attemptPlayerEnchant,
    attemptPlayerStrengthen,
    safeEffectPreview,
    playerServicePreview,
    quoteAdjustment,
    adjustedQuoteTotal,
    walletBalance,
    stableTransactionId,
    previewServiceResult,
    commitServiceTransaction,
    quoteGemProcedure,
    beginService,
    serviceReady,
    executeControlledResult,
  });

  global.LuminousItemEnchanterServiceRuntime=API;
  if (typeof module!=="undefined" && module.exports) module.exports=API;
})(typeof window!=="undefined"?window:globalThis);
