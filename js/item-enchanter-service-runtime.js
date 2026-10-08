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
  if (!Enchantments || !Engine || !Magic) {
    throw new Error("Enchantment Catalog, Enchantment Engine and Magic Runtime are required before Enchanter Service Runtime.");
  }

  const VERSION = 1;
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
    beginService,
    serviceReady,
    executeControlledResult,
  });

  global.LuminousItemEnchanterServiceRuntime=API;
  if (typeof module!=="undefined" && module.exports) module.exports=API;
})(typeof window!=="undefined"?window:globalThis);
