(function (global) {
  "use strict";

  if (global.LuminousSkillForgeG2) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousSkillForgeG2;
    return;
  }

  const VERSION = "0.1.0";
  const SCHEMA_VERSION = 1;
  const SIN_IDS = Object.freeze(["wrath", "lust", "sloth", "gluttony", "gloom", "pride", "envy"]);
  const DAMAGE_TYPES = Object.freeze({ slash: "cortante", pierce: "perforante", blunt: "contundente" });
  const STATUS_IDS = Object.freeze(["burn", "rupture", "sinking", "tremor", "poise", "bleed"]);

  const TIER_RULES = Object.freeze({
    1: Object.freeze({ tier: 1, printedPowerMin: 10, printedPowerMax: 13, mechanicalFloor: 8, maxCoins: 3, effectBudget: 10, potencyCost: 2, countCost: 6, maxPotency: 3, maxCount: 1, styleBudget: 3 }),
    2: Object.freeze({ tier: 2, printedPowerMin: 15, printedPowerMax: 17, mechanicalFloor: 13, maxCoins: 4, effectBudget: 14, potencyCost: 2, countCost: 4, maxPotency: 5, maxCount: 2, styleBudget: 5 }),
    3: Object.freeze({ tier: 3, printedPowerMin: 19, printedPowerMax: 24, mechanicalFloor: 17, maxCoins: 5, effectBudget: 18, potencyCost: 2, countCost: 3, maxPotency: 7, maxCount: 3, styleBudget: 7 }),
  });

  const GENERATION_RULES = Object.freeze({
    1: Object.freeze({ generation: 1, maxCoreStatuses: 1, maxStyles: 1, maxConditions: 0, maxRewards: 1, allowStatusCondition: false, allowScaling: false, allowCustomResource: false, allowTransform: false, allowReuse: false }),
    2: Object.freeze({ generation: 2, maxCoreStatuses: 1, maxStyles: 1, maxConditions: 1, maxRewards: 1, allowStatusCondition: true, allowScaling: false, allowCustomResource: false, allowTransform: false, allowReuse: false }),
  });

  const REWARD_RULES = Object.freeze({
    clash_power: Object.freeze({ label: "Clash Power", unit: 1, baseCost: 1, maxByGeneration: Object.freeze({ 1: 2, 2: 3 }) }),
    final_power: Object.freeze({ label: "Final Power", unit: 1, baseCost: 2, maxByGeneration: Object.freeze({ 1: 1, 2: 2 }) }),
    coin_power: Object.freeze({ label: "Coin Power", unit: 1, baseCost: 2, coinScaled: true, maxByGeneration: Object.freeze({ 1: 1, 2: 1 }) }),
    damage_percent: Object.freeze({ label: "Damage %", unit: 10, baseCost: 2, maxByGeneration: Object.freeze({ 1: 10, 2: 20 }) }),
    sp: Object.freeze({ label: "SP", unit: 5, baseCost: 1, maxByGeneration: Object.freeze({ 1: 5, 2: 10 }) }),
  });

  const STYLE_CATALOG = Object.freeze({
    duelist: Object.freeze({ id: "duelist", label: "Duelist", minGeneration: 1, trigger: "[On Clash Win]", rewardPool: Object.freeze(["clash_power", "final_power"]) }),
    momentum: Object.freeze({ id: "momentum", label: "Momentum", minGeneration: 1, trigger: "[Hit after Clash Win]", rewardPool: Object.freeze(["damage_percent", "final_power"]) }),
    defiant: Object.freeze({ id: "defiant", label: "Defiant", minGeneration: 1, trigger: "[On Clash Lose]", rewardPool: Object.freeze(["clash_power", "sp"]) }),
    precision: Object.freeze({ id: "precision", label: "Precision", minGeneration: 1, trigger: "[Heads Hit]", rewardPool: Object.freeze(["damage_percent", "coin_power"]) }),
    gambler: Object.freeze({ id: "gambler", label: "Gambler", minGeneration: 1, trigger: "[Tails Hit]", rewardPool: Object.freeze(["clash_power", "sp"]) }),
    opportunist: Object.freeze({ id: "opportunist", label: "Opportunist", minGeneration: 1, trigger: "[On Unopposed Attack]", rewardPool: Object.freeze(["final_power", "damage_percent"]) }),
    critical: Object.freeze({ id: "critical", label: "Critical", minGeneration: 1, trigger: "[On Crit]", rewardPool: Object.freeze(["damage_percent", "sp"]) }),
    executioner: Object.freeze({ id: "executioner", label: "Executioner", minGeneration: 1, trigger: "[On Kill]", rewardPool: Object.freeze(["sp", "clash_power"]) }),
    predator: Object.freeze({ id: "predator", label: "Predator", minGeneration: 2, trigger: "[Heads Hit]", rewardPool: Object.freeze(["damage_percent", "final_power"]), defaultCondition: Object.freeze({ target: "target", stat: "hp_percent", operator: "<=", value: 50 }) }),
    mindbreaker: Object.freeze({ id: "mindbreaker", label: "Mindbreaker", minGeneration: 2, trigger: "[On Clash Win]", rewardPool: Object.freeze(["clash_power", "final_power"]), defaultCondition: Object.freeze({ target: "target", stat: "sp_current", operator: "<", value: 0 }) }),
    exploiter_potency: Object.freeze({ id: "exploiter_potency", label: "Exploiter · Potency", minGeneration: 2, trigger: "[Heads Hit]", rewardPool: Object.freeze(["damage_percent", "final_power"]), defaultCondition: Object.freeze({ target: "target", stat: "status_potency", operator: ">=", value: 3, useCoreStatus: true }) }),
    exploiter_count: Object.freeze({ id: "exploiter_count", label: "Exploiter · Count", minGeneration: 2, trigger: "[Tails Hit]", rewardPool: Object.freeze(["clash_power", "final_power"]), defaultCondition: Object.freeze({ target: "target", stat: "status_count", operator: ">=", value: 2, useCoreStatus: true }) }),
  });

  const WEAPON_PROFILES = Object.freeze({
    sword: Object.freeze({ id: "sword", damageFamily: "slash", coinBias: Object.freeze([1, 2, 3]), styleWeights: Object.freeze({ duelist: 35, precision: 30, momentum: 20, executioner: 15 }) }),
    spear: Object.freeze({ id: "spear", damageFamily: "pierce", coinBias: Object.freeze([2, 3]), styleWeights: Object.freeze({ opportunist: 30, predator: 25, momentum: 25, precision: 20 }) }),
    hammer: Object.freeze({ id: "hammer", damageFamily: "blunt", coinBias: Object.freeze([1, 2]), styleWeights: Object.freeze({ defiant: 30, gambler: 25, opportunist: 20, duelist: 15, predator: 10 }) }),
  });

  const STATUS_STYLE_WEIGHTS = Object.freeze({
    burn: Object.freeze({ momentum: 25, precision: 20, predator: 15 }),
    rupture: Object.freeze({ predator: 30, opportunist: 20, duelist: 15 }),
    sinking: Object.freeze({ mindbreaker: 35, defiant: 20, gambler: 15 }),
    tremor: Object.freeze({ defiant: 25, opportunist: 20, duelist: 15 }),
    poise: Object.freeze({ precision: 30, critical: 30, duelist: 20 }),
    bleed: Object.freeze({ predator: 25, executioner: 20, precision: 20 }),
  });

  const CONDITION_DISCOUNTS = Object.freeze({
    hp_percent: Object.freeze([{ test: c => Number(c.value) <= 25, discount: 2 }, { test: c => Number(c.value) <= 50, discount: 1 }]),
    sp_current: Object.freeze([{ test: c => Number(c.value) <= -15, discount: 2 }, { test: c => Number(c.value) < 0, discount: 1 }]),
    status_potency: Object.freeze([{ test: c => Number(c.value) >= 5, discount: 2 }, { test: c => Number(c.value) >= 3, discount: 1 }]),
    status_count: Object.freeze([{ test: c => Number(c.value) >= 3, discount: 2 }, { test: c => Number(c.value) >= 2, discount: 1 }]),
  });

  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
  const numberOr = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const intOr = (value, fallback = 0) => Math.trunc(numberOr(value, fallback));
  const normalizeId = (value) => String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  function seedHash(seed) {
    let h = 2166136261 >>> 0;
    const text = String(seed ?? "luminous");
    for (let i = 0; i < text.length; i += 1) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function seededRng(seed) {
    let a = seedHash(seed) || 1;
    return function rng() {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function pick(list, rng) { return list[Math.floor(rng() * list.length)] ?? list[0]; }
  function weightedPick(weightMap, rng) {
    const rows = Object.entries(weightMap).filter(([, weight]) => Number(weight) > 0);
    if (!rows.length) return null;
    const total = rows.reduce((sum, [, weight]) => sum + Number(weight), 0);
    let roll = rng() * total;
    for (const [id, weight] of rows) { roll -= Number(weight); if (roll <= 0) return id; }
    return rows[rows.length - 1][0];
  }

  function tierRule(tier) { return TIER_RULES[intOr(tier, 1)] || null; }
  function generationRule(generation) { return GENERATION_RULES[intOr(generation, 1)] || null; }
  function maxPower(recipe) { return intOr(recipe?.power?.basePower) + (intOr(recipe?.power?.coinPower) * intOr(recipe?.power?.coinAmount, 1)); }
  function effectCost(recipe) {
    const rules = tierRule(recipe?.tier);
    if (!rules) return Infinity;
    const potency = Math.max(0, intOr(recipe?.core?.potency));
    const count = Math.max(0, intOr(recipe?.core?.count));
    return (potency * rules.potencyCost) + (count * rules.countCost);
  }
  function coinPowerCost(amount, coinAmount) {
    const coins = Math.max(1, intOr(coinAmount, 1));
    return Math.max(0, intOr(amount)) * (2 + Math.floor((coins - 1) / 2));
  }
  function rewardCost(reward, recipe) {
    if (!reward?.kind) return 0;
    const rule = REWARD_RULES[reward.kind];
    if (!rule) return Infinity;
    const amount = Math.max(0, numberOr(reward.amount));
    let cost;
    if (reward.kind === "coin_power") cost = coinPowerCost(amount, recipe?.power?.coinAmount);
    else cost = Math.ceil((amount / rule.unit) * rule.baseCost);
    const condition = recipe?.style?.condition;
    if (condition) {
      const rows = CONDITION_DISCOUNTS[condition.stat] || [];
      const discount = rows.find(row => row.test(condition))?.discount || 0;
      cost = Math.max(1, cost - discount);
    }
    return cost;
  }
  function styleCost(recipe) { return rewardCost(recipe?.style?.reward, recipe); }

  function normalizeCondition(condition, coreStatus) {
    if (!condition) return null;
    const stat = normalizeId(condition.stat || "hp_percent");
    const normalized = {
      target: normalizeId(condition.target || "target") || "target",
      stat,
      operator: ["<", "<=", "=", ">=", ">"].includes(String(condition.operator)) ? String(condition.operator) : "=",
      value: numberOr(condition.value, 0),
    };
    if (stat === "status_potency" || stat === "status_count" || stat === "has_status" || stat === "missing_status") normalized.status = normalizeId(condition.status || coreStatus);
    return normalized;
  }

  function normalizeRecipe(input = {}) {
    const tier = intOr(input.tier, 1);
    const generation = intOr(input.generation, 1);
    const coreStatus = normalizeId(input.core?.status || input.status || "burn");
    const styleId = normalizeId(input.style?.id || input.styleId || "");
    const styleDef = STYLE_CATALOG[styleId] || null;
    const conditionSource = input.style?.condition || styleDef?.defaultCondition || null;
    const damageFamily = normalizeId(input.damageFamily || input.weapon?.damageFamily || input.weaponProfile?.damageFamily || "slash");
    const recipe = {
      schemaVersion: SCHEMA_VERSION,
      id: String(input.id || ""),
      name: String(input.name || ""),
      tier,
      generation,
      weaponProfile: normalizeId(input.weaponProfile?.id || input.weaponProfile || input.weapon?.id || "custom") || "custom",
      damageFamily,
      damageType: DAMAGE_TYPES[damageFamily] || input.damageType || "cortante",
      sinAffinity: normalizeId(input.sinAffinity || input.sin || "wrath"),
      range: Math.max(1, intOr(input.range, 1)),
      attackWeight: Math.max(1, intOr(input.attackWeight, 1)),
      power: {
        basePower: Math.max(0, intOr(input.power?.basePower ?? input.basePower, 4)),
        coinPower: Math.max(0, intOr(input.power?.coinPower ?? input.coinPower, 4)),
        coinAmount: Math.max(1, intOr(input.power?.coinAmount ?? input.coinAmount, 1)),
        coinType: input.power?.coinType || input.coinType || "positive",
      },
      core: {
        status: coreStatus,
        potency: Math.max(0, intOr(input.core?.potency ?? input.potency, 1)),
        count: Math.max(0, intOr(input.core?.count ?? input.count, 0)),
        trigger: "[On Hit]",
        target: coreStatus === "poise" ? "self" : "target",
        coinIndex: Math.max(0, intOr(input.core?.coinIndex, Math.max(0, intOr(input.power?.coinAmount ?? input.coinAmount, 1) - 1))),
      },
      style: styleDef ? {
        id: styleDef.id,
        trigger: styleDef.trigger,
        condition: normalizeCondition(conditionSource, coreStatus),
        reward: input.style?.reward ? { kind: normalizeId(input.style.reward.kind), amount: numberOr(input.style.reward.amount, 0) } : null,
      } : null,
      metadata: { ...(input.metadata || {}) },
    };
    return recipe;
  }

  function validateRecipe(input, options = {}) {
    const recipe = normalizeRecipe(input);
    const errors = [], warnings = [];
    const tier = tierRule(recipe.tier), generation = generationRule(recipe.generation);
    if (!tier) errors.push(`Unsupported Tier ${recipe.tier}.`);
    if (!generation) errors.push(`Only G1-G2 are supported in Skill Forge v1; received G${recipe.generation}.`);
    if (!STATUS_IDS.includes(recipe.core.status)) errors.push(`Unsupported Core Status: ${recipe.core.status || "(empty)"}.`);
    if (!Object.prototype.hasOwnProperty.call(DAMAGE_TYPES, recipe.damageFamily)) errors.push(`Unsupported damage family: ${recipe.damageFamily}.`);
    if (!SIN_IDS.includes(recipe.sinAffinity)) errors.push(`Invalid Sin affinity: ${recipe.sinAffinity}.`);
    if (recipe.range !== 1 && !options.allowRanged) errors.push("G1-G2 campaign Forge is melee-only (Range 1). ");
    if (recipe.attackWeight !== 1 && !options.allowMultiTarget) errors.push("G1-G2 campaign Forge uses Attack Weight 1 only.");

    if (tier) {
      if (recipe.power.coinAmount > tier.maxCoins) errors.push(`Tier ${recipe.tier} allows at most ${tier.maxCoins} Coins.`);
      const printed = maxPower(recipe);
      if (printed > tier.printedPowerMax) errors.push(`Raw Max Power ${printed} exceeds Tier ${recipe.tier} ceiling ${tier.printedPowerMax}.`);
      if (printed < tier.mechanicalFloor) errors.push(`Raw Max Power ${printed} is below Tier ${recipe.tier} mechanical floor ${tier.mechanicalFloor}.`);
      if (printed < tier.printedPowerMin && !recipe.style?.reward) warnings.push(`Raw Max Power ${printed} is below the normal Tier ${recipe.tier} band ${tier.printedPowerMin}-${tier.printedPowerMax} without a Style reward.`);
      if (recipe.core.potency > tier.maxPotency) errors.push(`Tier ${recipe.tier} Potency cap is ${tier.maxPotency}.`);
      if (recipe.core.count > tier.maxCount) errors.push(`Tier ${recipe.tier} Count cap is ${tier.maxCount}.`);
      if (recipe.core.potency <= 0 && recipe.core.count <= 0) errors.push("Core Status must apply Potency and/or Count.");
      const eCost = effectCost(recipe);
      if (eCost > tier.effectBudget) errors.push(`Status cost ${eCost}/${tier.effectBudget} exceeds Tier ${recipe.tier} Effect Budget.`);
      const sCost = styleCost(recipe);
      if (sCost > tier.styleBudget) errors.push(`Style cost ${sCost}/${tier.styleBudget} exceeds Tier ${recipe.tier} Style Budget.`);
    }

    if (generation) {
      if (recipe.style) {
        const style = STYLE_CATALOG[recipe.style.id];
        if (!style) errors.push(`Unknown Combat Style: ${recipe.style.id}.`);
        else {
          if (style.minGeneration > recipe.generation) errors.push(`${style.label} requires G${style.minGeneration}.`);
          if (recipe.style.reward && !style.rewardPool.includes(recipe.style.reward.kind)) errors.push(`${style.label} cannot use reward ${recipe.style.reward.kind}.`);
        }
        if (!recipe.style.reward) errors.push("A Combat Style requires exactly one Reward in G1-G2.");
        if (recipe.style.condition && generation.maxConditions < 1) errors.push(`G${recipe.generation} does not allow Conditions.`);
        if (!recipe.style.condition && style?.minGeneration === 2) errors.push(`${style.label} requires its G2 condition.`);
        if (recipe.style.condition && !generation.allowStatusCondition && String(recipe.style.condition.stat).startsWith("status_")) errors.push(`G${recipe.generation} cannot use Status conditions.`);
      }
      if (!generation.allowReuse && input?.reuse) errors.push(`G${recipe.generation} cannot use Reuse.`);
      if (!generation.allowScaling && input?.scaling) errors.push(`G${recipe.generation} cannot use scaling formulas.`);
      if (!generation.allowCustomResource && input?.customResource) errors.push(`G${recipe.generation} cannot create custom resources.`);
      if (!generation.allowTransform && input?.transform) errors.push(`G${recipe.generation} cannot transform Coins or Skill structure.`);
    }

    if (recipe.style?.reward) {
      const rewardRule = REWARD_RULES[recipe.style.reward.kind];
      if (!rewardRule) errors.push(`Unknown Reward: ${recipe.style.reward.kind}.`);
      else {
        const cap = rewardRule.maxByGeneration[recipe.generation];
        if (cap == null) errors.push(`${rewardRule.label} is unavailable in G${recipe.generation}.`);
        else if (recipe.style.reward.amount > cap) errors.push(`${rewardRule.label} cap in G${recipe.generation} is ${cap}.`);
      }
    }

    if (recipe.style?.condition) {
      const c = recipe.style.condition;
      if (c.target !== "target" && c.target !== "self") errors.push(`Unsupported condition target: ${c.target}.`);
      if (["status_potency", "status_count", "has_status", "missing_status"].includes(c.stat) && !STATUS_IDS.includes(c.status)) errors.push(`Status condition needs a valid status ID; received ${c.status || "(empty)"}.`);
      if (c.stat === "hp_percent" && (c.value <= 0 || c.value >= 100)) warnings.push("HP% condition is very broad/extreme; it may not meaningfully gate the reward.");
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      recipe,
      budget: {
        rawMaxPower: maxPower(recipe),
        normalPowerBand: tier ? [tier.printedPowerMin, tier.printedPowerMax] : null,
        mechanicalFloor: tier?.mechanicalFloor ?? null,
        effect: tier ? { used: effectCost(recipe), max: tier.effectBudget } : null,
        style: tier ? { used: styleCost(recipe), max: tier.styleBudget } : null,
      },
    };
  }

  function forgeEffect(trigger, reward, condition) {
    return {
      trigger,
      tag: trigger,
      target: "self",
      type: "forge_reward",
      forgeReward: clone(reward),
      condition: condition ? clone(condition) : null,
      timing: "immediate",
      is_reuse: false,
      target_ally: false,
    };
  }
  function statusEffect(recipe) {
    return {
      trigger: "[On Hit]",
      tag: "[On Hit]",
      target: recipe.core.target,
      type: "status",
      status: recipe.core.status,
      potency: recipe.core.potency,
      count: recipe.core.count,
      maxCap: 0,
      scaleTarget: null,
      scaleCondition: null,
      is_reuse: false,
      target_ally: false,
      timing: "immediate",
      condition: null,
    };
  }

  function compileRecipe(input, options = {}) {
    const validation = validateRecipe(input, options);
    if (!validation.valid) {
      const error = new Error(`Invalid Skill Forge recipe: ${validation.errors.join(" · ")}`);
      error.validation = validation;
      throw error;
    }
    const recipe = validation.recipe;
    const id = recipe.id || `forge_t${recipe.tier}_g${recipe.generation}_${recipe.damageFamily}_${recipe.core.status}_${normalizeId(recipe.style?.id || "raw")}`;
    const name = recipe.name || `${STYLE_CATALOG[recipe.style?.id]?.label || "Raw"} ${recipe.core.status[0].toUpperCase()}${recipe.core.status.slice(1)} ${recipe.damageFamily[0].toUpperCase()}${recipe.damageFamily.slice(1)}`;
    const coins = Array.from({ length: recipe.power.coinAmount }, (_, index) => ({ index, type: "normal", status: "active", effects: [] }));
    const coreIndex = clamp(recipe.core.coinIndex, 0, coins.length - 1);
    coins[coreIndex].effects.push(statusEffect(recipe));

    const effects = [];
    if (recipe.style?.reward) {
      const effect = forgeEffect(recipe.style.trigger, recipe.style.reward, recipe.style.condition);
      const coinTrigger = ["[Coin Start]", "[On Hit]", "[Heads Hit]", "[Tails Hit]", "[Hit after Clash Win]", "[Hit after Clash Lose]", "[On Crit]", "[Heads]", "[Tails]"].includes(recipe.style.trigger);
      if (coinTrigger) coins[coreIndex].effects.push(effect);
      else effects.push(effect);
    }

    const skill = {
      id,
      name,
      type: "Attack",
      tier: recipe.tier,
      basePower: recipe.power.basePower,
      coinPower: recipe.power.coinPower,
      coinAmount: recipe.power.coinAmount,
      coinType: recipe.power.coinType,
      attackWeight: recipe.attackWeight,
      skillRange: recipe.range,
      damageType: recipe.damageType,
      sinAffinity: recipe.sinAffinity,
      scalingStat: options.scalingStat || "Fuerza",
      targetingType: "Focused Attack",
      aoePattern: "Self",
      skillAmount: 1,
      sourceType: "skill_forge",
      sourceId: id,
      isItemSkill: false,
      isDefense: false,
      defenseSubtype: "",
      isClashable: true,
      isUnclashable: false,
      isIndiscriminate: false,
      isTargetFixed: false,
      requiresUnlock: false,
      effects,
      coins,
      evolutionChain: null,
      schemaVersion: 2,
      metadata: {
        forge: true,
        forgeVersion: VERSION,
        recipeVersion: SCHEMA_VERSION,
        generation: recipe.generation,
        weaponProfile: recipe.weaponProfile,
        damageFamily: recipe.damageFamily,
        statusFamily: recipe.core.status,
        combatStyle: recipe.style?.id || null,
        forgeRecipe: clone(recipe),
        forgeBudget: clone(validation.budget),
      },
    };

    const schema = options.schema || global.CombatSkillSchema;
    if (schema?.validateCombatSkill) {
      const schemaValidation = schema.validateCombatSkill(skill);
      if (!schemaValidation.valid) {
        const error = new Error(`Compiled Skill failed CombatSkillSchema: ${schemaValidation.errors.join(" · ")}`);
        error.validation = schemaValidation;
        throw error;
      }
      return schema.serializeCombatSkill ? schema.serializeCombatSkill({ ...schemaValidation.skill, id }, { includeLegacyAliases: true }) : schemaValidation.skill;
    }
    return skill;
  }

  function combinedStyleWeights(weapon, status, generation, overrides = {}) {
    const out = {};
    const weaponWeights = weapon?.styleWeights || {};
    const statusWeights = STATUS_STYLE_WEIGHTS[status] || {};
    for (const [id, def] of Object.entries(STYLE_CATALOG)) {
      if (def.minGeneration > generation) continue;
      const w = numberOr(weaponWeights[id], 0) + numberOr(statusWeights[id], 0) + numberOr(overrides[id], 0);
      if (w > 0) out[id] = w;
    }
    return out;
  }

  function choosePowerProfile(tier, coinAmount, mechanical, rng) {
    const rules = tierRule(tier);
    const ceiling = rules.printedPowerMax;
    const target = mechanical ? Math.max(rules.mechanicalFloor, rules.printedPowerMin - 1) : Math.floor(rules.printedPowerMin + rng() * (ceiling - rules.printedPowerMin + 1));
    const cpByTier = {
      1: { 1: 6, 2: 4, 3: 3 },
      2: { 1: 8, 2: 5, 3: 4, 4: 3 },
      3: { 1: 10, 2: 7, 3: 5, 4: 4, 5: 3 },
    };
    let coinPower = cpByTier[tier]?.[coinAmount] ?? Math.max(1, Math.floor(ceiling / (coinAmount + 1)));
    let basePower = target - (coinPower * coinAmount);
    while (basePower < 1 && coinPower > 1) { coinPower -= 1; basePower = target - (coinPower * coinAmount); }
    return { basePower: Math.max(1, basePower), coinPower, coinAmount, coinType: "positive" };
  }

  function chooseCorePackage(tier, rng) {
    const rules = tierRule(tier);
    const candidates = [];
    for (let potency = 1; potency <= rules.maxPotency; potency += 1) {
      for (let count = 0; count <= rules.maxCount; count += 1) {
        const cost = (potency * rules.potencyCost) + (count * rules.countCost);
        if (cost <= rules.effectBudget) candidates.push({ potency, count, cost });
      }
    }
    const weighted = candidates.flatMap(row => Array.from({ length: Math.max(1, rules.effectBudget - row.cost + 1) }, () => row));
    return clone(pick(weighted, rng));
  }

  function defaultReward(style, generation, coinAmount, rng) {
    const kind = pick(style.rewardPool, rng);
    const rule = REWARD_RULES[kind];
    const cap = rule.maxByGeneration[generation];
    let amount = rule.unit;
    if (generation >= 2 && rng() > 0.72) amount = Math.min(cap, rule.unit * 2);
    if (kind === "coin_power") amount = 1;
    return { kind, amount: Math.min(amount, cap) };
  }

  function generateRecipe(options = {}) {
    const seed = options.seed ?? `${Date.now()}_${Math.random()}`;
    const rng = options.rng || seededRng(seed);
    const tier = clamp(intOr(options.tier, 1), 1, 3);
    const generation = clamp(intOr(options.generation, 1), 1, 2);
    const status = STATUS_IDS.includes(normalizeId(options.status)) ? normalizeId(options.status) : pick(STATUS_IDS, rng);
    const weapon = options.weapon && typeof options.weapon === "object" ? options.weapon : WEAPON_PROFILES[normalizeId(options.weapon || options.weaponProfile)] || WEAPON_PROFILES.sword;
    const damageFamily = Object.prototype.hasOwnProperty.call(DAMAGE_TYPES, normalizeId(options.damageFamily)) ? normalizeId(options.damageFamily) : weapon.damageFamily;
    const tierRules = tierRule(tier);
    const possibleCoins = (weapon.coinBias || [1, 2, 3]).filter(value => value <= tierRules.maxCoins);
    const coinAmount = intOr(options.coinAmount, pick(possibleCoins.length ? possibleCoins : [1], rng));
    const styleWeights = combinedStyleWeights(weapon, status, generation, options.styleWeights || {});
    const styleId = normalizeId(options.styleId) || weightedPick(styleWeights, rng) || "duelist";
    const style = STYLE_CATALOG[styleId];
    const condition = generation >= 2 && style.defaultCondition ? { ...clone(style.defaultCondition), status: style.defaultCondition.useCoreStatus ? status : style.defaultCondition.status } : null;
    const core = chooseCorePackage(tier, rng);
    const recipe = normalizeRecipe({
      tier,
      generation,
      weaponProfile: weapon.id || "custom",
      damageFamily,
      sinAffinity: SIN_IDS.includes(normalizeId(options.sinAffinity)) ? normalizeId(options.sinAffinity) : pick(SIN_IDS, rng),
      range: 1,
      attackWeight: 1,
      power: choosePowerProfile(tier, coinAmount, true, rng),
      core: { status, potency: core.potency, count: core.count, trigger: "[On Hit]", target: status === "poise" ? "self" : "target", coinIndex: coinAmount - 1 },
      style: { id: styleId, condition, reward: defaultReward(style, generation, coinAmount, rng) },
      metadata: { procedural: true, seed: String(seed) },
    });

    let report = validateRecipe(recipe);
    if (!report.valid && report.errors.some(error => error.includes("Style cost"))) {
      const pool = style.rewardPool.map(kind => ({ kind, amount: REWARD_RULES[kind].unit }));
      const validReward = pool.find(reward => validateRecipe(normalizeRecipe({ ...recipe, style: { ...recipe.style, reward } })).valid);
      if (validReward) recipe.style.reward = validReward;
      report = validateRecipe(recipe);
    }
    if (!report.valid) {
      const error = new Error(`Procedural Forge failed to generate a legal recipe: ${report.errors.join(" · ")}`);
      error.validation = report;
      throw error;
    }
    return { seed: String(seed), recipe: report.recipe, validation: report };
  }

  function generateDeck(options = {}) {
    const size = Math.max(1, intOr(options.size, 4));
    const rootSeed = String(options.seed ?? "deck");
    const recipes = [], ids = new Set();
    for (let index = 0; index < size; index += 1) {
      let attempt = 0, generated;
      do {
        generated = generateRecipe({ ...options, seed: `${rootSeed}:${index}:${attempt}` });
        const fingerprint = JSON.stringify([generated.recipe.damageFamily, generated.recipe.core, generated.recipe.style]);
        if (!ids.has(fingerprint)) { ids.add(fingerprint); break; }
        attempt += 1;
      } while (attempt < 12);
      recipes.push(generated);
    }
    return recipes;
  }

  const api = Object.freeze({
    version: VERSION,
    recipeSchemaVersion: SCHEMA_VERSION,
    SIN_IDS,
    DAMAGE_TYPES,
    STATUS_IDS,
    TIER_RULES,
    GENERATION_RULES,
    REWARD_RULES,
    STYLE_CATALOG,
    WEAPON_PROFILES,
    STATUS_STYLE_WEIGHTS,
    seededRng,
    normalizeRecipe,
    maxPower,
    effectCost,
    rewardCost,
    styleCost,
    validateRecipe,
    compileRecipe,
    generateRecipe,
    generateDeck,
    combinedStyleWeights,
  });

  global.LuminousSkillForgeG2 = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
