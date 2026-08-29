(function (global) {
  "use strict";

  if (global.LuminousWorkshopRuntime) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousWorkshopRuntime;
    return;
  }

  function safeRequire(path) {
    if (typeof require !== "function") return null;
    try { return require(path); } catch (_) { return null; }
  }

  const itemRuntime = () => global.LuminousItemInventoryRuntime || safeRequire("./item-inventory-runtime.js");
  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
  const normalizeId = (value) => String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  const intOr = (value, fallback = 0) => Number.isFinite(Number(value)) ? Math.trunc(Number(value)) : fallback;
  const numberOr = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const asArray = (value) => value == null ? [] : (Array.isArray(value) ? value : [value]);

  const workshops = new Map();
  const SCHEMA_VERSION = 1;
  const REPUTATIONS = ["unknown", "local", "established", "prestigious", "elite", "legendary"];

  const DEFAULT_TIER_PROFILES = {
    1: { productTierMin: 1, productTierMax: 2, knownModuleCount: 2, signatureTechnologySlots: 0, productLineChance: 0.02, signatureModelChance: 0.00, quality: [45, 45, 10, 0, 0] },
    2: { productTierMin: 1, productTierMax: 3, knownModuleCount: 3, signatureTechnologySlots: 0, productLineChance: 0.05, signatureModelChance: 0.01, quality: [30, 50, 18, 2, 0] },
    3: { productTierMin: 1, productTierMax: 4, knownModuleCount: 4, signatureTechnologySlots: 1, productLineChance: 0.10, signatureModelChance: 0.02, quality: [15, 50, 30, 5, 0] },
    4: { productTierMin: 1, productTierMax: 5, knownModuleCount: 5, signatureTechnologySlots: 1, productLineChance: 0.16, signatureModelChance: 0.04, quality: [8, 35, 45, 12, 0] },
    5: { productTierMin: 2, productTierMax: 6, knownModuleCount: 6, signatureTechnologySlots: 1, productLineChance: 0.25, signatureModelChance: 0.08, quality: [2, 18, 45, 30, 5] },
    6: { productTierMin: 2, productTierMax: 7, knownModuleCount: 7, signatureTechnologySlots: 2, productLineChance: 0.35, signatureModelChance: 0.12, quality: [1, 10, 40, 40, 9] },
    7: { productTierMin: 3, productTierMax: 8, knownModuleCount: 8, signatureTechnologySlots: 2, productLineChance: 0.45, signatureModelChance: 0.18, quality: [0, 5, 30, 45, 20] },
    8: { productTierMin: 3, productTierMax: 9, knownModuleCount: 9, signatureTechnologySlots: 2, productLineChance: 0.55, signatureModelChance: 0.25, quality: [0, 2, 23, 50, 25] },
    9: { productTierMin: 4, productTierMax: 10, knownModuleCount: 10, signatureTechnologySlots: 3, productLineChance: 0.65, signatureModelChance: 0.35, quality: [0, 0, 15, 50, 35] },
    10: { productTierMin: 4, productTierMax: 10, knownModuleCount: 12, signatureTechnologySlots: 3, productLineChance: 0.75, signatureModelChance: 0.45, quality: [0, 0, 5, 45, 50] },
  };

  const REPUTATION_MULTIPLIERS = {
    unknown: { price: 0.85, demand: 0.60, productLine: 0.70, signatureModel: 0.75 },
    local: { price: 0.95, demand: 0.80, productLine: 0.85, signatureModel: 0.90 },
    established: { price: 1.05, demand: 1.00, productLine: 1.00, signatureModel: 1.00 },
    prestigious: { price: 1.20, demand: 1.20, productLine: 1.15, signatureModel: 1.15 },
    elite: { price: 1.40, demand: 1.50, productLine: 1.30, signatureModel: 1.30 },
    legendary: { price: 1.75, demand: 2.00, productLine: 1.50, signatureModel: 1.50 },
  };

  function emit(name, detail) {
    try {
      if (typeof global.dispatchEvent === "function" && typeof global.CustomEvent === "function") {
        global.dispatchEvent(new global.CustomEvent(name, { detail }));
      }
    } catch (_) {}
    return detail;
  }

  function hashSeed(value) {
    const text = String(value ?? "");
    let hash = 2166136261;
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function seededRandom(seed) {
    let state = hashSeed(seed) || 0x6d2b79f5;
    return function random() {
      state += 0x6d2b79f5;
      let value = state;
      value = Math.imul(value ^ (value >>> 15), value | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
  }

  function weightedPick(items, random, weightOf = (entry) => entry?.weight ?? 1) {
    const candidates = asArray(items).filter(Boolean);
    if (!candidates.length) return null;
    const weights = candidates.map((entry) => Math.max(0, numberOr(weightOf(entry), 1)));
    const total = weights.reduce((sum, weight) => sum + weight, 0);
    if (total <= 0) return candidates[Math.floor(random() * candidates.length)];
    let roll = random() * total;
    for (let index = 0; index < candidates.length; index += 1) {
      roll -= weights[index];
      if (roll <= 0) return candidates[index];
    }
    return candidates[candidates.length - 1];
  }

  function sampleUnique(items, count, random) {
    const pool = [...new Set(asArray(items).filter(Boolean))];
    const output = [];
    while (pool.length && output.length < count) {
      output.push(pool.splice(Math.floor(random() * pool.length), 1)[0]);
    }
    return output;
  }

  function normalizedWorkshopName(value) {
    return String(value ?? "").trim().replace(/\s+Workshop$/i, "").replace(/\s+/g, " ");
  }

  function validateWorkshopName(name, options = {}) {
    const raw = String(name ?? "").trim();
    if (!raw) return { valid: false, reason: "empty_name" };
    if (/\bworkshop\b/i.test(raw)) return { valid: false, reason: "raw_name_contains_workshop" };
    const tokens = raw.toLowerCase().split(/\s+/).filter(Boolean);
    if (tokens.some((token, index) => index > 0 && token === tokens[index - 1])) return { valid: false, reason: "duplicate_token" };
    const normalized = normalizeId(raw);
    const reserved = new Set(asArray(options.reservedNames).map(normalizeId));
    const existing = new Set([
      ...asArray(options.existingNames).map(normalizeId),
      ...[...workshops.values()].map((entry) => normalizeId(entry.workshopName)),
    ]);
    if (reserved.has(normalized)) return { valid: false, reason: "reserved_name" };
    if (existing.has(normalized)) return { valid: false, reason: "duplicate_world_name" };
    return { valid: true, workshopName: raw };
  }

  function affinityMatches(entry, specialization) {
    if (!specialization || !entry?.specializationAffinity) return true;
    const affinities = String(entry.specializationAffinity).split(/[|,]/).map(normalizeId).filter(Boolean);
    return !affinities.length || affinities.includes("any") || affinities.includes("general") || affinities.some((affinity) => normalizeId(specialization).includes(affinity) || affinity.includes(normalizeId(specialization)));
  }

  function generateWorkshopName(options = {}) {
    const random = options.random || seededRandom(options.seed || "workshop_name");
    const pools = asArray(options.namePools).filter((entry) => entry && entry.token);
    if (!pools.length) return { generated: false, reason: "missing_name_pool" };
    const specialization = options.primarySpecialization || null;
    const thematic = random() < numberOr(options.thematicChance, 0.30);
    const filtered = thematic ? pools.filter((entry) => affinityMatches(entry, specialization)) : pools;
    const candidates = filtered.length ? filtered : pools;
    const singles = candidates.filter((entry) => normalizeId(entry.tokenRole) === "single");
    const adjectives = candidates.filter((entry) => normalizeId(entry.tokenRole) === "adjective");
    const nouns = candidates.filter((entry) => normalizeId(entry.tokenRole) === "noun");

    for (let attempt = 0; attempt < 50; attempt += 1) {
      let raw;
      if (singles.length && (random() < 0.55 || !adjectives.length || !nouns.length)) {
        raw = weightedPick(singles, random)?.token;
      } else {
        const adjective = weightedPick(adjectives, random)?.token;
        const noun = weightedPick(nouns, random)?.token;
        raw = adjective && noun ? `${adjective} ${noun}` : null;
      }
      raw = normalizedWorkshopName(raw);
      const validation = validateWorkshopName(raw, options);
      if (validation.valid) return { generated: true, workshopName: validation.workshopName, attempts: attempt + 1 };
    }
    return { generated: false, reason: "name_generation_exhausted" };
  }

  function tierProfile(tier, options = {}) {
    const value = clamp(intOr(tier, 1), 1, 10);
    const source = options.tierProfiles || DEFAULT_TIER_PROFILES;
    return clone(source[value] || source[String(value)] || DEFAULT_TIER_PROFILES[value]);
  }

  function rollQualityTier(profile, random) {
    const weights = asArray(profile?.quality || profile?.qualityWeights || [0, 0, 100, 0, 0]);
    const entries = [1, 2, 3, 4, 5].map((tier, index) => ({ tier, weight: Math.max(0, numberOr(weights[index], 0)) }));
    return weightedPick(entries, random, (entry) => entry.weight)?.tier || 3;
  }

  function normalizeSpecialization(entry) {
    if (typeof entry === "string") return { id: entry, familyIds: [] };
    return { ...clone(entry), id: entry?.id || entry?.specializationId || entry?.familyId || null, familyIds: clone(entry?.familyIds || entry?.knownItemFamilies || []) };
  }

  function moduleId(entry) {
    return String(typeof entry === "string" ? entry : (entry?.moduleId || entry?.definitionId || entry?.canonicalId || entry?.id || "")).trim();
  }

  function moduleCompatibleWithSpecialization(module, specialization) {
    const requirements = asArray(module?.specializations || module?.compatibleSpecializations || module?.specializationIds).map(normalizeId).filter(Boolean);
    if (!requirements.length) return true;
    return requirements.includes(normalizeId(specialization));
  }

  function createWorkshopInstance(options = {}) {
    const worldSeed = String(options.worldSeed || "world");
    const regionId = String(options.regionId || "region");
    const workshopId = String(options.workshopId || `workshop:${normalizeId(regionId)}:${hashSeed(`${worldSeed}:${regionId}:${options.index || 0}`).toString(36)}`);
    const seed = String(options.seed || `${worldSeed}:${regionId}:${workshopId}`);
    const random = seededRandom(seed);
    const tier = clamp(intOr(options.workshopTier, 1), 1, 10);
    const profile = tierProfile(tier, options);
    const specializationDefs = asArray(options.specializations).map(normalizeSpecialization).filter((entry) => entry.id);
    const primary = options.primarySpecialization || weightedPick(specializationDefs, random)?.id || "general";
    const secondaryCount = Math.max(0, intOr(options.secondarySpecializationCount, tier >= 7 ? 2 : tier >= 4 ? 1 : 0));
    const secondary = options.secondarySpecializations || sampleUnique(specializationDefs.map((entry) => entry.id).filter((id) => id !== primary), secondaryCount, random);
    const primaryDef = specializationDefs.find((entry) => entry.id === primary);
    const secondaryDefs = secondary.map((id) => specializationDefs.find((entry) => entry.id === id)).filter(Boolean);
    const knownFamilies = [...new Set([
      ...asArray(options.knownItemFamilies),
      ...asArray(primaryDef?.familyIds),
      ...secondaryDefs.flatMap((entry) => asArray(entry.familyIds)),
    ].filter(Boolean))];

    const modulePool = asArray(options.modules).filter((entry) => moduleId(entry) && moduleCompatibleWithSpecialization(entry, primary));
    const knownModuleIds = options.knownModuleIds || sampleUnique(modulePool.map(moduleId), Math.max(0, intOr(profile.knownModuleCount, 0)), random);
    const signatureCount = Math.min(knownModuleIds.length, Math.max(0, intOr(options.signatureModuleCount, tier >= 8 ? 2 : tier >= 4 ? 1 : 0)));
    const signatureModuleIds = options.signatureModuleIds || sampleUnique(knownModuleIds, signatureCount, random);
    const technologyPool = asArray(options.technologies).map((entry) => typeof entry === "string" ? entry : (entry?.technologyId || entry?.id)).filter(Boolean);
    const signatureTechnologyIds = options.signatureTechnologyIds || sampleUnique(technologyPool, Math.max(0, intOr(profile.signatureTechnologySlots, 0)), random);

    let workshopName = normalizedWorkshopName(options.workshopName);
    if (!workshopName) {
      const generated = generateWorkshopName({
        seed: `${seed}:name`, namePools: options.namePools, primarySpecialization: primary,
        reservedNames: options.reservedNames, existingNames: options.existingNames,
      });
      if (!generated.generated) return { created: false, reason: generated.reason };
      workshopName = generated.workshopName;
    }
    const validation = validateWorkshopName(workshopName, { reservedNames: options.reservedNames, existingNames: options.existingNames });
    if (!validation.valid) return { created: false, reason: validation.reason };

    const workshop = {
      schemaVersion: SCHEMA_VERSION,
      workshopId,
      workshopName,
      regionId,
      districtId: options.districtId || null,
      workshopTier: tier,
      reputation: REPUTATIONS.includes(normalizeId(options.reputation)) ? normalizeId(options.reputation) : (tier >= 9 ? "elite" : tier >= 7 ? "prestigious" : tier >= 4 ? "established" : "local"),
      wealthClass: options.wealthClass || null,
      primarySpecialization: primary,
      secondarySpecializations: clone(secondary),
      technologyThemes: clone(options.technologyThemes || []),
      knownModuleIds: clone(knownModuleIds),
      signatureModuleIds: clone(signatureModuleIds),
      signatureTechnologyIds: clone(signatureTechnologyIds),
      knownItemFamilies: clone(knownFamilies),
      preferredItemFamilies: clone(options.preferredItemFamilies || (knownFamilies.length ? [knownFamilies[0]] : [])),
      qualityProfile: clone(options.qualityProfile || profile.quality),
      pricingProfileId: options.pricingProfileId || `workshop_tier_${tier}`,
      namingProfileId: options.namingProfileId || "procedural_default",
      productLines: clone(options.productLines || []),
      stockGenerationSeed: String(options.stockGenerationSeed || `${seed}:stock`),
      namingSeed: String(options.namingSeed || `${seed}:name`),
      createdAt: options.createdAt || null,
    };

    workshops.set(workshopId, clone(workshop));
    emit("luminous:workshop-created", { workshop: clone(workshop) });
    return { created: true, workshop };
  }

  function registerWorkshop(workshop) {
    if (!workshop?.workshopId) return { registered: false, reason: "missing_workshop_id" };
    const normalized = clone(workshop);
    normalized.workshopName = normalizedWorkshopName(normalized.workshopName);
    const validation = validateWorkshopName(normalized.workshopName, { existingNames: [...workshops.values()].filter((entry) => entry.workshopId !== normalized.workshopId).map((entry) => entry.workshopName) });
    if (!validation.valid) return { registered: false, reason: validation.reason };
    workshops.set(normalized.workshopId, normalized);
    return { registered: true, workshop: clone(normalized) };
  }

  function getWorkshop(workshopId) {
    const found = workshops.get(String(workshopId));
    return found ? clone(found) : null;
  }

  function listWorkshops() {
    return [...workshops.values()].map(clone);
  }

  function clearWorkshops() {
    workshops.clear();
  }

  function productLineName(options, random) {
    const pool = asArray(options.productLineNamePool || options.modelNamePool).filter(Boolean);
    if (!pool.length) return null;
    const picked = weightedPick(pool.map((entry) => typeof entry === "string" ? { token: entry, weight: 1 } : entry), random);
    return picked?.token || picked?.name || null;
  }

  function createProductLine(workshop, options = {}) {
    if (!workshop?.workshopId) return { created: false, reason: "missing_workshop" };
    const profile = tierProfile(workshop.workshopTier, options);
    const rep = REPUTATION_MULTIPLIERS[workshop.reputation] || REPUTATION_MULTIPLIERS.established;
    const random = options.random || seededRandom(options.seed || `${workshop.namingSeed}:line:${asArray(workshop.productLines).length}`);
    const chance = clamp(numberOr(profile.productLineChance, 0) * numberOr(rep.productLine, 1), 0, 1);
    if (options.force !== true && random() > chance) return { created: false, reason: "product_line_roll_failed", chance };
    const name = options.productLineName || productLineName(options, random);
    if (!name) return { created: false, reason: "missing_product_line_name_pool" };
    const familyIds = clone(options.compatibleItemFamilies || workshop.preferredItemFamilies || workshop.knownItemFamilies || []);
    const line = {
      productLineId: options.productLineId || `${workshop.workshopId}:line:${normalizeId(name)}`,
      manufacturerWorkshopId: workshop.workshopId,
      productLineName: String(name),
      compatibleItemFamilies: familyIds,
      technologyProfile: clone(options.technologyProfile || []),
      moduleBiasIds: clone(options.moduleBiasIds || workshop.signatureModuleIds || []),
      qualityBias: clamp(intOr(options.qualityBias, 0), -1, 1),
    };
    if (!Array.isArray(workshop.productLines)) workshop.productLines = [];
    if (!workshop.productLines.some((entry) => entry.productLineId === line.productLineId)) workshop.productLines.push(line);
    workshops.set(workshop.workshopId, clone(workshop));
    return { created: true, productLine: clone(line) };
  }

  function definitionFamilyIds(definition = {}) {
    return [...new Set(asArray(definition.familyIds || definition.productFamilies || definition.familyId || definition.productFamily).filter(Boolean))];
  }

  function definitionTier(definition = {}) {
    return clamp(intOr(definition.tier ?? definition.tierNumber ?? definition.tierRomanValue, 1), 1, 10);
  }

  function compatibleDefinitions(workshop, catalog, options = {}) {
    const profile = tierProfile(workshop.workshopTier, options);
    const knownFamilies = new Set(asArray(workshop.knownItemFamilies).map(String));
    const definitions = Array.isArray(catalog) ? catalog : Object.values(catalog || {});
    return definitions.filter((entry) => {
      const definition = entry?.definition || entry;
      const tier = definitionTier(definition);
      if (tier < profile.productTierMin || tier > profile.productTierMax) return false;
      const families = definitionFamilyIds(definition);
      if (!knownFamilies.size || !families.length) return true;
      return families.some((family) => knownFamilies.has(String(family)));
    });
  }

  function generateProduct(workshopInput, options = {}) {
    const workshop = typeof workshopInput === "string" ? getWorkshop(workshopInput) : clone(workshopInput);
    if (!workshop) return { generated: false, reason: "workshop_not_found" };
    const index = Math.max(0, intOr(options.index, 0));
    const cycleId = String(options.restockCycleId ?? "initial");
    const seed = String(options.seed || `${workshop.stockGenerationSeed}:${cycleId}:${index}`);
    const random = seededRandom(seed);
    const catalog = options.itemCatalog || options.catalog || [];
    const candidates = compatibleDefinitions(workshop, catalog, options);
    if (!candidates.length) return { generated: false, reason: "no_compatible_item_definitions" };
    const entry = weightedPick(candidates, random, (candidate) => candidate?.weight ?? candidate?.definition?.workshopWeight ?? 1);
    const definition = clone(entry?.definition || entry);
    const profile = tierProfile(workshop.workshopTier, options);
    let qualityTier = rollQualityTier({ quality: workshop.qualityProfile || profile.quality }, random);

    const matchingLines = asArray(workshop.productLines).filter((line) => {
      const families = definitionFamilyIds(definition);
      const allowed = new Set(asArray(line.compatibleItemFamilies).map(String));
      return !allowed.size || !families.length || families.some((family) => allowed.has(String(family)));
    });
    const productLine = options.productLine || (matchingLines.length ? matchingLines[Math.floor(random() * matchingLines.length)] : null);
    if (productLine) qualityTier = clamp(qualityTier + intOr(productLine.qualityBias, 0), 1, 5);

    const capacity = Math.max(0, intOr(definition.moduleCapacity ?? definition.runtime?.moduleCapacity ?? definition.max_upgrade_slots_capacity, 0));
    const modulePool = asArray(workshop.knownModuleIds);
    const signatureBias = asArray(productLine?.moduleBiasIds || workshop.signatureModuleIds);
    const desiredModules = Math.min(capacity, Math.max(0, intOr(options.moduleCount, capacity > 0 ? Math.floor(random() * (Math.min(capacity, 2) + 1)) : 0)));
    const installedModuleIds = sampleUnique([...signatureBias, ...modulePool], desiredModules, random);
    const serial = options.productSerial || `${normalizeId(workshop.workshopId)}-${normalizeId(cycleId)}-${String(index + 1).padStart(4, "0")}`;
    const instanceId = options.instanceId || `item_${hashSeed(`${seed}:${serial}`).toString(36)}_${normalizeId(serial)}`;

    const instance = itemRuntime()?.createItemInstance?.(definition, {
      instanceId,
      qualityTier,
      manufacturerId: workshop.workshopId,
      productLineId: productLine?.productLineId || null,
      productSerial: serial,
      installedModuleIds,
      signatureTechnologyIds: clone(workshop.signatureTechnologyIds || []),
      currentOwnerId: options.currentOwnerId || null,
    });
    if (!instance) return { generated: false, reason: "item_inventory_runtime_unavailable" };
    if (productLine?.productLineName) instance.productLineName = productLine.productLineName;
    const resolved = itemRuntime()?.resolveItem?.(instance, { ...options, workshops: api, catalog: options.itemCatalog || options.catalog });
    const result = { generated: true, workshopId: workshop.workshopId, seed, definition, instance, resolved };
    emit("luminous:workshop-product-generated", result);
    return result;
  }

  function restockWorkshop(workshopInput, options = {}) {
    const workshop = typeof workshopInput === "string" ? getWorkshop(workshopInput) : clone(workshopInput);
    if (!workshop) return { restocked: false, reason: "workshop_not_found" };
    const cycleId = String(options.restockCycleId ?? options.cycleId ?? "initial");
    const count = Math.max(0, intOr(options.count, 5));
    const products = [];
    for (let index = 0; index < count; index += 1) {
      const generated = generateProduct(workshop, { ...options, restockCycleId: cycleId, index });
      if (generated.generated) products.push(generated);
    }
    return { restocked: true, workshopId: workshop.workshopId, restockCycleId: cycleId, products };
  }

  function priceMultiplier(workshop) {
    const rep = REPUTATION_MULTIPLIERS[normalizeId(workshop?.reputation)] || REPUTATION_MULTIPLIERS.established;
    const tier = clamp(intOr(workshop?.workshopTier, 1), 1, 10);
    const tierMultiplier = 1 + Math.max(0, tier - 1) * 0.06;
    return tierMultiplier * rep.price;
  }

  function calculateWorkshopPrice(workshop, item, options = {}) {
    const basePrice = Math.max(0, numberOr(options.basePrice ?? item?.basePrice ?? item?.price ?? item?.precio, 0));
    const quality = clamp(intOr(item?.qualityTier ?? item?.quality, 1), 1, 5);
    const qualityMultipliers = options.qualityMultipliers || { 1: 0.80, 2: 1.00, 3: 1.25, 4: 1.60, 5: 2.10 };
    const moduleValue = Math.max(0, numberOr(options.moduleValue, 0));
    const signatureValue = Math.max(0, numberOr(options.signatureTechnologyValue, 0));
    const marketPressure = Math.max(0, numberOr(options.marketPressure, 1));
    return Math.round(((basePrice * numberOr(qualityMultipliers[quality], 1) * priceMultiplier(workshop)) + moduleValue + signatureValue) * marketPressure);
  }

  function serializeWorkshop(workshop) {
    return clone(workshop);
  }

  const api = Object.freeze({
    version: 1,
    schemaVersion: SCHEMA_VERSION,
    DEFAULT_TIER_PROFILES: clone(DEFAULT_TIER_PROFILES),
    REPUTATION_MULTIPLIERS: clone(REPUTATION_MULTIPLIERS),
    hashSeed,
    seededRandom,
    weightedPick,
    sampleUnique,
    normalizedWorkshopName,
    validateWorkshopName,
    generateWorkshopName,
    tierProfile,
    rollQualityTier,
    createWorkshopInstance,
    registerWorkshop,
    getWorkshop,
    listWorkshops,
    clearWorkshops,
    createProductLine,
    compatibleDefinitions,
    generateProduct,
    restockWorkshop,
    priceMultiplier,
    calculateWorkshopPrice,
    serializeWorkshop,
  });

  global.LuminousWorkshopRuntime = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
