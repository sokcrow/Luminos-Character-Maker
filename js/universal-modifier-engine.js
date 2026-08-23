(function (global) {
  "use strict";

  const traitEngine = global.LuminousTraitEngine || (typeof require === "function" ? require("./trait-engine.js") : null);
  const statusEngine = global.LuminousStatusEngine || (typeof require === "function" ? require("./status-engine.js") : null);

  const CHANNELS = Object.freeze([
    "damage_dealt_multiplier",
    "damage_taken_multiplier",
    "healing_multiplier",
    "final_power",
    "base_power",
    "defense_power",
    "clash_power",
    "offensive_level",
    "defensive_level",
    "speed",
    "min_speed",
    "max_speed",
    "resource",
    "coin_power",
    "crit_damage_multiplier",
  ]);

  const PATH_CHANNEL_ALIASES = Object.freeze({
    defensivelevel: "defensive_level",
    offensivelevel: "offensive_level",
    minspeed: "min_speed",
    maxspeed: "max_speed",
    finalpower: "final_power",
    basepower: "base_power",
    coinpower: "coin_power",
    critdamagepercent: "crit_damage_multiplier",
    damagedealtpercent: "damage_dealt_multiplier",
    damagetakenpercent: "damage_taken_multiplier",
  });

  const normalizeId = (value) => String(value ?? "").trim().toLowerCase().replace(/\s+/g, "_");
  const numberOr = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));

  function getPath(root, path) {
    let current = root;
    for (const key of String(path || "").split(".").filter(Boolean)) {
      if (current == null) return undefined;
      current = current[key];
    }
    return current;
  }

  function emptyModifiers() {
    return Object.fromEntries(CHANNELS.map((key) => [key, 0]));
  }

  function mergeModifiers(...sources) {
    const output = emptyModifiers();
    sources.forEach((source) => {
      Object.entries(source || {}).forEach(([key, value]) => {
        if (Object.prototype.hasOwnProperty.call(output, key)) output[key] += numberOr(value, 0);
      });
    });
    return output;
  }

  function resolveEquipment(unit = {}) {
    const equipment = unit.equipment && typeof unit.equipment === "object" ? unit.equipment : {};
    const armor = equipment.armor && typeof equipment.armor === "object" ? equipment.armor : {};
    const legacyType = normalizeId(unit.armorType || unit.armor_type || "none");
    const category = normalizeId(armor.category || armor.type || legacyType || "none") || "none";
    const armorEquipped = Boolean(
      armor.itemId || armor.id ||
      (category && !["none", "unarmored", "no_armor", "sin_armadura"].includes(category))
    );
    return {
      armor: {
        itemId: armor.itemId || armor.id || null,
        category: armorEquipped ? category : "none",
      },
      armorEquipped,
      armorCategory: armorEquipped ? category : "none",
      shield: equipment.shield || null,
      mainHand: equipment.mainHand || equipment.main_hand || null,
      offHand: equipment.offHand || equipment.off_hand || null,
    };
  }

  function normalizeSkill(skill = {}) {
    if (!skill || typeof skill !== "object") return skill;
    const type = normalizeId(skill.type || "normal");
    const defenseTypes = new Set(["guard", "evade", "counter", "clashableguard", "clashablecounter", "clashable_guard", "clashable_counter"]);
    let family = normalizeId(skill.skillFamily || skill.skill_family);
    if (!family) {
      if (type === "spell") family = "spell";
      else if (["roll", "save", "check"].includes(type)) family = "roll";
      else if (skill.isDefense || defenseTypes.has(type)) family = "defense";
      else family = "attack";
    }

    let attackMode = normalizeId(skill.attackMode || skill.attack_mode);
    if (family === "attack" && !attackMode) {
      if (skill.isRanged === true || normalizeId(skill.rangeType) === "ranged") attackMode = "ranged";
      else if (Number.isFinite(Number(skill.skillRange)) && Number(skill.skillRange) > 1) attackMode = "ranged";
      else attackMode = "melee";
    }

    skill.skillFamily = family;
    skill.skill_family = family;
    if (family === "attack") {
      skill.attackMode = attackMode || "melee";
      skill.attack_mode = skill.attackMode;
      skill.isMelee = skill.attackMode === "melee";
      skill.isRanged = skill.attackMode === "ranged";
    }

    const ammo = skill.ammo && typeof skill.ammo === "object" ? skill.ammo : {};
    if (family === "attack" && skill.attackMode === "ranged") {
      skill.ammo = {
        resourceId: normalizeId(ammo.resourceId || ammo.resource_id || skill.ammoType || skill.ammo_type || "ammo"),
        cost: Math.max(0, Math.trunc(numberOr(ammo.cost ?? skill.ammoCost ?? skill.ammo_cost, 1))),
      };
    }
    return skill;
  }

  function hasStatus(unit, statusId, traitState = {}) {
    if (statusEngine?.hasStatus?.(unit, statusId)) return true;
    return Boolean(traitState?.statuses?.[normalizeId(statusId)]);
  }

  function conditionMatches(condition, runtime) {
    if (!condition || typeof condition !== "object") return Boolean(condition);
    if (Array.isArray(condition.all)) return condition.all.every((entry) => conditionMatches(entry, runtime));
    if (Array.isArray(condition.any)) return condition.any.some((entry) => conditionMatches(entry, runtime));
    if (condition.not) return !conditionMatches(condition.not, runtime);
    const left = condition.path ? getPath(runtime, condition.path) : condition.left;
    const right = condition.value;
    const operator = normalizeId(condition.operator || "eq");
    if (["eq", "equals"].includes(operator)) return left === right;
    if (["ne", "not_equals"].includes(operator)) return left !== right;
    if (operator === "truthy") return Boolean(left);
    if (operator === "falsy") return !left;
    if (operator === "gt") return Number(left) > Number(right);
    if (operator === "gte") return Number(left) >= Number(right);
    if (operator === "lt") return Number(left) < Number(right);
    if (operator === "lte") return Number(left) <= Number(right);
    if (operator === "between") return Number(left) >= Number(right) && Number(left) <= Number(condition.max);
    if (operator === "in") return Array.isArray(right) && right.includes(left);
    if (operator === "not_in") return Array.isArray(right) && !right.includes(left);
    return false;
  }

  function channelForRule(rule = {}) {
    const explicit = normalizeId(rule.channel);
    if (CHANNELS.includes(explicit)) return explicit;
    const path = String(rule.path || "").split(".").at(-1) || "";
    const compact = normalizeId(path).replace(/_/g, "");
    return PATH_CHANNEL_ALIASES[compact] || (CHANNELS.includes(normalizeId(path)) ? normalizeId(path) : null);
  }

  function valueForRule(rule, character, runtime, trait) {
    if (rule.formula != null && traitEngine?.evaluateFormula && traitEngine?.buildVariables) {
      return traitEngine.evaluateFormula(rule.formula, traitEngine.buildVariables(character || {}, runtime || {}, trait || {}));
    }
    return numberOr(rule.value, 0);
  }

  function normalizeChannelAmount(channel, rule, amount) {
    const unit = normalizeId(rule.unit || rule.valueUnit || rule.value_unit);
    if (unit === "percent") {
      if (["damage_dealt_multiplier", "crit_damage_multiplier"].includes(channel)) return amount / 10;
      if (channel === "damage_taken_multiplier") return -amount / 10;
    }
    if (unit === "percent_reduction" && channel === "damage_taken_multiplier") return amount / 10;
    if (unit === "percent_increase" && channel === "damage_taken_multiplier") return -amount / 10;
    return amount;
  }

  function traitContextsMatch(trait, context) {
    const contexts = Array.isArray(trait?.contexts) ? trait.contexts.map(normalizeId) : [normalizeId(trait?.contexts || "any")];
    const current = normalizeId(context || "any");
    return contexts.includes("any") || contexts.includes(current);
  }

  function resolveTraitModifiers(options = {}) {
    const unit = options.unit || options.character || {};
    const character = options.character || unit;
    const skill = normalizeSkill(options.skill || null);
    const equipment = options.equipment || resolveEquipment(unit);
    const traitState = options.traitState || {};
    const context = normalizeId(options.context || "combat");
    const runtime = { context, character, self: unit, skill, equipment };
    const output = emptyModifiers();

    (options.traits || []).forEach((trait) => {
      if (!traitContextsMatch(trait, context)) return;
      (trait.rules || []).forEach((rule) => {
        if (normalizeId(rule.type) !== "modifier" || normalizeId(rule.trigger || "passive") !== "passive") return;
        if (rule.whileStatus && !hasStatus(unit, rule.whileStatus, traitState)) return;
        if (!(rule.conditions || []).every((condition) => conditionMatches(condition, runtime))) return;
        const channel = channelForRule(rule);
        if (!channel) return;
        const amount = normalizeChannelAmount(channel, rule, valueForRule(rule, character, runtime, trait));
        const mode = normalizeId(rule.mode || "add");
        if (mode === "set" || mode === "override") output[channel] = amount;
        else if (mode === "multiply") output[channel] = output[channel] === 0 ? amount : output[channel] * amount;
        else output[channel] += amount;
      });
    });
    return output;
  }

  function resolveStatusModifiers(options = {}) {
    const unit = options.unit || {};
    const skill = normalizeSkill(options.skill || null);
    const output = emptyModifiers();
    const store = unit.statusEffects && typeof unit.statusEffects === "object" ? unit.statusEffects : {};
    Object.entries(store).forEach(([statusId, raw]) => {
      const definition = statusEngine?.getDefinition?.(statusId) || global.STATUS_REGISTRY?.[statusId];
      if (!definition?.rules) return;
      const instance = typeof raw === "object" ? raw : { count: numberOr(raw, 1), potency: 0 };
      definition.rules.forEach((rule) => {
        if (normalizeId(rule.trigger) !== "passive") return;
        if (skill && definition.damage_type_tag) {
          const damageType = skill.damageType || skill.attackType || skill.type;
          if (damageType !== definition.damage_type_tag) return;
        }
        if (skill && definition.sin_affinity_tag) {
          const affinity = skill.affinity || skill.sinAffinity;
          if (affinity !== definition.sin_affinity_tag) return;
        }
        const base = normalizeId(rule.cond_type) === "potency" ? numberOr(instance.potency, 1) : numberOr(instance.count, 1);
        const factor = Math.floor(base / Math.max(1, numberOr(rule.cond_input, 1)));
        const value = factor * numberOr(rule.aff_input, 1);
        const channel = normalizeId(rule.affectation);
        if (!CHANNELS.includes(channel)) return;
        const operation = normalizeId(rule.operation || "add");
        if (operation === "add") output[channel] += value;
        else if (operation === "sub") output[channel] -= value;
        else if (operation === "set") output[channel] = value;
        else if (operation === "mult") output[channel] = output[channel] === 0 ? value : output[channel] * value;
      });
    });
    return output;
  }

  function resolveStats(options = {}) {
    const character = options.character || options.unit || {};
    const unit = options.unit || character;
    const traitState = options.traitState || {};
    const equipment = options.equipment || resolveEquipment(unit);
    const stats = { ...(character.stats || unit.stats || {}) };
    const statCaps = { ...(character.statCaps || unit.statCaps || {}) };
    const runtime = { context: options.context || "any", character, self: unit, equipment };

    (options.traits || []).forEach((trait) => {
      (trait.rules || []).forEach((rule) => {
        if (normalizeId(rule.type) !== "stat" || normalizeId(rule.trigger || "passive") !== "passive") return;
        if (rule.whileStatus && !hasStatus(unit, rule.whileStatus, traitState)) return;
        if (!(rule.conditions || []).every((condition) => conditionMatches(condition, runtime))) return;
        const id = normalizeId(rule.statId);
        const aliases = id === "strength" ? ["fuerza", "strength"] : id === "constitution" ? ["constitucion", "constitution"] : [id];
        const key = aliases.find((entry) => Object.prototype.hasOwnProperty.call(stats, entry)) || aliases[0];
        const max = Number.isFinite(Number(rule.max)) ? Number(rule.max) : Number.POSITIVE_INFINITY;
        const amount = valueForRule(rule, character, runtime, trait);
        stats[key] = Math.min(max, numberOr(stats[key], 10) + amount);
        if (Number.isFinite(max)) statCaps[id] = max;
      });
    });
    return { stats, statCaps };
  }

  function baseCombatValue(unit, names, fallback) {
    for (const name of names) {
      const value = getPath(unit, name);
      if (Number.isFinite(Number(value))) return Number(value);
    }
    return fallback;
  }

  function resolveCharacterSnapshot(options = {}) {
    const unit = options.unit || options.character || {};
    const character = options.character || unit;
    const equipment = resolveEquipment(unit);
    const traitModifiers = resolveTraitModifiers({ ...options, unit, character, equipment });
    const statusModifiers = resolveStatusModifiers({ ...options, unit });
    const modifiers = mergeModifiers(traitModifiers, statusModifiers);
    const resolvedStats = resolveStats({ ...options, unit, character, equipment });
    const level = Math.max(1, numberOr(character.level ?? character.characterBuild?.calculatedAtLevel, 1));
    const baseOff = baseCombatValue(character, ["combatStats.offensiveLevel", "combatStats.off_level", "offensiveLevel", "offensive_level"], level);
    const baseDef = baseCombatValue(character, ["combatStats.defensiveLevel", "combatStats.def_level", "defensiveLevel", "defensive_level"], level);
    const baseMinSpeed = baseCombatValue(character, ["combatStats.minSpeed", "combatStats.min_speed", "minSpeed", "min_speed"], 0);
    const baseMaxSpeed = baseCombatValue(character, ["combatStats.maxSpeed", "combatStats.max_speed", "maxSpeed", "max_speed"], baseMinSpeed);
    return {
      equipment,
      stats: resolvedStats.stats,
      statCaps: resolvedStats.statCaps,
      modifiers,
      traitModifiers,
      statusModifiers,
      offensiveLevel: baseOff + modifiers.offensive_level,
      defensiveLevel: baseDef + modifiers.defensive_level,
      minSpeed: baseMinSpeed + modifiers.min_speed + modifiers.speed,
      maxSpeed: baseMaxSpeed + modifiers.max_speed + modifiers.speed,
      critDamagePercent: modifiers.crit_damage_multiplier * 10,
    };
  }

  function canUseSkill(unit, skillInput) {
    const skill = normalizeSkill(skillInput);
    if (!skill || skill.skillFamily !== "attack" || skill.attackMode !== "ranged") return { usable: true, reason: null };
    const ammo = skill.ammo || { resourceId: "ammo", cost: 1 };
    const resources = unit?.resources || unit?.combatResources || unit?.ammo || {};
    const available = typeof resources === "number" ? resources : numberOr(resources?.[ammo.resourceId]?.value ?? resources?.[ammo.resourceId], 0);
    return { usable: available >= ammo.cost, reason: available >= ammo.cost ? null : "insufficient_ammo", ammo, available };
  }

  const api = Object.freeze({
    CHANNELS,
    emptyModifiers,
    mergeModifiers,
    resolveEquipment,
    normalizeSkill,
    resolveTraitModifiers,
    resolveStatusModifiers,
    resolveStats,
    resolveCharacterSnapshot,
    canUseSkill,
  });

  global.LuminousUniversalModifiers = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
