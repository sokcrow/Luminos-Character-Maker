(function (global) {
  "use strict";

  if (global.LuminousItemMagicRuntime) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousItemMagicRuntime;
    return;
  }

  function safeRequire(path) {
    if (typeof require !== "function") return null;
    try { return require(path); } catch (_) { return null; }
  }

  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
  const intOr = (value, fallback = 0) => Number.isFinite(Number(value)) ? Math.trunc(Number(value)) : fallback;
  const normalizeId = (value) => String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  const asArray = (value) => value == null ? [] : (Array.isArray(value) ? value : [value]);
  const VERSION = 3;
  const DEFAULT_ATTUNEMENT_CAPACITY = 3;

  function itemRuntimeFor(method) {
    const candidates = [
      global.LuminousItemInventoryRuntime,
      global.LuminousItemRuntime,
      safeRequire("./item-inventory-runtime.js"),
      safeRequire("./item-runtime-engine.js"),
    ];
    return candidates.find((candidate) => candidate && typeof candidate[method] === "function") || null;
  }

  function spellRuntime() {
    return global.LuminousSpellcastingRuntime || safeRequire("./spellcasting-runtime.js");
  }

  function enchantmentEngine() {
    return global.LuminousItemEnchantmentEngine || safeRequire("./item-enchantment-engine.js");
  }

  function emit(name, detail) {
    try {
      if (typeof global.dispatchEvent === "function" && typeof global.CustomEvent === "function") {
        global.dispatchEvent(new global.CustomEvent(name, { detail }));
      }
    } catch (_) {}
    return detail;
  }

  function runtimeOf(item = {}) {
    return item.runtime && typeof item.runtime === "object" ? item.runtime
      : item.itemRuntime && typeof item.itemRuntime === "object" ? item.itemRuntime
        : item.item_runtime && typeof item.item_runtime === "object" ? item.item_runtime
          : {};
  }

  function instanceIdOf(item = {}) {
    const runtime = itemRuntimeFor("itemId");
    return String(item.instanceId || item.instance_id || runtime?.itemId?.(item) || "").trim();
  }

  function definitionIdOf(item = {}) {
    const runtime = itemRuntimeFor("definitionId");
    return String(item.definitionId || item.definition_id || runtime?.definitionId?.(item) || "").trim();
  }

  function magicProfile(item = {}) {
    const runtime = runtimeOf(item);
    const explicit = runtime.magic || runtime.magicItem || runtime.magic_item || item.magic || item.magicItem || item.magic_item || {};
    return explicit && typeof explicit === "object" ? explicit : {};
  }

  function enchantmentRefs(item = {}) {
    const runtime = runtimeOf(item);
    const profile = magicProfile(item);
    const raw = profile.enchantments || runtime.enchantments || item.enchantments || [];
    return asArray(raw)
      .filter((entry) => entry && typeof entry === "object")
      .map((entry) => clone(entry));
  }

  function highestEnchantmentRank(item = {}) {
    return enchantmentRefs(item).reduce((highest, entry) => {
      const rank = Math.max(0, intOr(entry.rank, 0));
      return Math.max(highest, rank);
    }, 0);
  }

  function boundEnchantmentRefs(item = {}) {
    return enchantmentRefs(item).filter((entry) => {
      const properties = asArray(entry.properties).map(normalizeId);
      return properties.includes("bind") || normalizeId(entry.curseType || entry.curse_type) === "bind";
    });
  }

  function cursedEnchantmentRefs(item = {}) {
    return enchantmentRefs(item).filter((entry) => {
      const properties = asArray(entry.properties).map(normalizeId);
      return properties.includes("curse") || properties.includes("bind") ||
        ["curse","bind"].includes(normalizeId(entry.curseType || entry.curse_type));
    });
  }

  function isBoundItem(item = {}) {
    const profile = magicProfile(item);
    const runtime = runtimeOf(item);
    const explicit = item.bound === true || profile.bound === true || runtime.bound === true ||
      normalizeId(profile.curse?.kind || profile.curse?.type || runtime.curse?.kind || runtime.curse?.type || item.curse?.kind || item.curse?.type) === "bind";
    return explicit || boundEnchantmentRefs(item).length > 0;
  }

  function requiresAttunement(item = {}) {
    const profile = magicProfile(item);
    const runtime = runtimeOf(item);
    if (highestEnchantmentRank(item) >= 2) return true;
    return item.requiresAttunement === true || item.requires_attunement === true ||
      profile.requiresAttunement === true || profile.requires_attunement === true ||
      runtime.requiresAttunement === true || runtime.requires_attunement === true;
  }


  function magicOrigin(item = {}) {
    const profile = magicProfile(item);
    const explicit = normalizeId(profile.origin || profile.magicOrigin || item.magicOrigin || item.magic_origin);
    if (explicit) return explicit;
    if (item.relic === true || item.artifact === true || profile.relic === true || profile.artifact === true) return "relic";
    if (enchantmentRefs(item).length) return "enchantment";
    if (isSpellScroll(item)) return "scroll";
    if (profile.enabled === true || profile.nativeMagic === true || profile.native_magic === true || spellProfiles(item).length) return "native";
    return "mundane";
  }

  function isNativeMagicItem(item = {}) {
    return magicOrigin(item) === "native";
  }

  function magicalDurabilityState(item = {}) {
    const profile = magicProfile(item);
    const raw = profile.magicalDurability || profile.magical_durability || null;
    if (!raw || typeof raw !== "object") {
      return Object.freeze({ current:null, max:null, depleted:false, profile:null, autoManaged:false });
    }
    const max = Math.max(0, Number(raw.max ?? raw.maximum ?? 0) || 0);
    const current = Math.max(0, Math.min(max, Number(raw.current ?? max) || 0));
    return Object.freeze({
      current,
      max,
      depleted:max > 0 && current <= 0,
      profile:normalizeId(raw.profile || "") || null,
      autoManaged:raw.autoManaged === true,
    });
  }

  function ensureMagicObject(item) {
    if (!item || typeof item !== "object") return null;
    if (!item.magic || typeof item.magic !== "object") item.magic = {};
    return item.magic;
  }

  function setMagicalDurability(item, current, max = null, options = {}) {
    const magic = ensureMagicObject(item);
    if (!magic) return { changed:false, reason:"missing_item" };
    const previous = magicalDurabilityState(item);
    const resolvedMax = Math.max(0, Number(max ?? previous.max ?? options.max ?? 0) || 0);
    const resolvedCurrent = Math.max(0, Math.min(resolvedMax, Number(current) || 0));
    magic.magicalDurability = {
      ...(magic.magicalDurability && typeof magic.magicalDurability === "object" ? magic.magicalDurability : {}),
      max:resolvedMax,
      current:resolvedCurrent,
      depleted:resolvedMax > 0 && resolvedCurrent <= 0,
      autoManaged:options.autoManaged ?? magic.magicalDurability?.autoManaged ?? false,
      profile:normalizeId(options.profile || magic.magicalDurability?.profile || "") || null,
    };
    return {
      changed:previous.current !== resolvedCurrent || previous.max !== resolvedMax,
      before:previous,
      after:magicalDurabilityState(item),
    };
  }

  function cursePersistsAtZero(item = {}) {
    if (isBoundItem(item)) return true;
    const explicit = runtimeOf(item).curse || magicProfile(item).curse || item.curse || null;
    return explicit?.ignoreMagicalDepletion === true ||
      explicit?.persistentAtZero === true ||
      explicit?.selfPreserving === true ||
      explicit?.self_preserving === true;
  }

  function magicalPowerActive(item = {}, options = {}) {
    const state = magicalDurabilityState(item);
    if (state.current == null || state.max == null) return true;
    if (state.current > 0) return true;
    if (options.specialUse !== true && cursePersistsAtZero(item)) return true;
    return false;
  }

  function itemBenefitsActive(unit, item, options = {}) {
    if (!item) return Object.freeze({active:false,reason:"missing_item"});
    if (requiresAttunement(item) && !isAttuned(unit || {}, item)) {
      return Object.freeze({active:false,reason:"item_not_attuned"});
    }
    if (!magicalPowerActive(item, options)) {
      return Object.freeze({active:false,reason:"magical_durability_depleted"});
    }
    return Object.freeze({active:true,reason:null});
  }

  function spendMagicalDurability(item, amount, options = {}) {
    if (!item) return { spent:false, reason:"missing_item" };
    const normalWear = options.normalWear !== false && options.specialUse !== true;
    if (normalWear && isBoundItem(item)) {
      return { spent:true, skipped:true, reason:"bound_ignores_normal_magical_wear", state:magicalDurabilityState(item) };
    }
    const state = magicalDurabilityState(item);
    if (state.current == null || state.max == null) return { spent:false, reason:"item_has_no_magical_durability" };
    const multiplier = Math.max(0, Number(options.wearMultiplier ?? 1) || 0);
    const cost = Math.max(0, Number(amount) || 0) * multiplier;
    if (cost <= 0) return { spent:true, amount:0, before:state.current, after:state.current, state };
    if (state.current < cost && options.allowPartial !== true) {
      return { spent:false, reason:"insufficient_magical_durability", cost, state };
    }
    const actual = options.allowPartial === true ? Math.min(state.current, cost) : cost;
    const after = Math.max(0, state.current - actual);
    const changed = setMagicalDurability(item, after, state.max, {
      autoManaged:state.autoManaged,
      profile:state.profile,
    });
    const result = { spent:true, amount:actual, cost, before:state.current, after, depleted:after <= 0, state:changed.after };
    emit("luminous:item-magical-durability-spent", { item, ...result });
    return result;
  }

  function restoreMagicalDurability(item, amount, options = {}) {
    if (!item) return { restored:false, reason:"missing_item" };
    const state = magicalDurabilityState(item);
    if (state.current == null || state.max == null) return { restored:false, reason:"item_has_no_magical_durability" };
    const restore = options.full === true ? state.max : Math.max(0, Number(amount) || 0);
    const after = Math.min(state.max, options.full === true ? state.max : state.current + restore);
    const changed = setMagicalDurability(item, after, state.max, {
      autoManaged:state.autoManaged,
      profile:state.profile,
    });
    const result = { restored:after > state.current, amount:after - state.current, before:state.current, after, state:changed.after };
    if (result.restored) emit("luminous:item-magical-durability-restored", { item, ...result });
    return result;
  }

  function processMagicalRecharge(item, trigger, options = {}) {
    if (!item) return { recharged:false, reason:"missing_item" };
    const profile = magicProfile(item);
    const rule = options.rule || profile.magicalRecharge || profile.magical_recharge || profile.rechargeRule || profile.recharge_rule;
    if (!rule) return { recharged:false, reason:"no_magical_recharge_rule" };
    const wanted = normalizeId(trigger);
    const ruleTrigger = normalizeId(typeof rule === "string" ? rule : rule.trigger);
    if (ruleTrigger && ruleTrigger !== wanted) return { recharged:false, reason:"trigger_mismatch" };
    const state = magicalDurabilityState(item);
    if (state.max == null) return { recharged:false, reason:"item_has_no_magical_durability" };
    let amount = typeof rule === "object" && Number.isFinite(Number(rule.amount)) ? Number(rule.amount) : state.max;
    if (typeof rule === "object" && Number.isFinite(Number(rule.percent))) amount = state.max * Number(rule.percent) / 100;
    if (isBoundItem(item) && typeof rule === "object" && Number.isFinite(Number(rule.boundMultiplier))) {
      amount *= Math.max(0, Number(rule.boundMultiplier));
    }
    const restored = restoreMagicalDurability(item, amount, { full:typeof rule === "object" && rule.full === true });
    return { recharged:restored.restored, trigger:wanted, rule:clone(rule), ...restored };
  }

  function boundEmergencyRecharge(user, item, options = {}) {
    if (!user || !item) return { recharged:false, reason:"missing_user_or_item" };
    if (!isBoundItem(item)) return { recharged:false, reason:"item_not_bound" };
    const state = magicalDurabilityState(item);
    if (state.current == null || state.max == null) return { recharged:false, reason:"item_has_no_magical_durability" };
    if (state.current > 0) return { recharged:false, reason:"bound_emergency_recharge_requires_zero" };
    const profile = magicProfile(item);
    const rule = options.rule || profile.boundRecharge || profile.bound_recharge || profile.curse?.boundRecharge || null;
    if (!rule || typeof rule !== "object") return { recharged:false, reason:"missing_authored_life_recharge_rule" };
    const maxHp = Math.max(0, Number(user.maxHp ?? user.maxHP ?? user.hpMax ?? user.hp ?? 0) || 0);
    let hpCost = Number(rule.hpCost);
    if (!Number.isFinite(hpCost) && Number.isFinite(Number(rule.hpCostPercent))) hpCost = maxHp * Number(rule.hpCostPercent) / 100;
    if (!Number.isFinite(hpCost) || hpCost <= 0) return { recharged:false, reason:"missing_authored_life_cost" };
    hpCost = Math.max(1, Math.ceil(hpCost));
    const hp = Math.max(0, Number(user.hp) || 0);
    if (options.allowLethal !== true && hp <= hpCost) return { recharged:false, reason:"insufficient_life_for_bound_recharge", hpCost, hp };
    if (hp < hpCost) return { recharged:false, reason:"insufficient_life_for_bound_recharge", hpCost, hp };
    user.hp = Math.max(0, hp - hpCost);
    const restored = restoreMagicalDurability(item, state.max, { full:true });
    return { recharged:restored.restored, hpCost, hpBefore:hp, hpAfter:user.hp, ...restored };
  }

  function spellProfiles(item = {}) {
    const runtime = runtimeOf(item);
    const profile = magicProfile(item);
    const raw = profile.spells || profile.itemSpells || runtime.itemSpells || runtime.spells || item.itemSpells || item.spells ||
      (profile.spellId || runtime.spellId || item.spellId ? [{ spellId: profile.spellId || runtime.spellId || item.spellId }] : []);
    return asArray(raw).map((entry) => {
      if (typeof entry === "string") return { spellId: entry, chargeCost: 1 };
      const resource = normalizeId(entry?.resource || entry?.chargeResource || entry?.charge_resource || magicProfile(item).chargeResource || "");
      return {
        ...clone(entry),
        spellId: entry?.spellId || entry?.spell_id || entry?.id || null,
        chargeCost: Math.max(0, intOr(entry?.chargeCost ?? entry?.charge_cost, 1)),
        resource:resource || (entry?.magicalDurabilityCost != null ? "magical_durability" : "charges"),
        magicalDurabilityCost:entry?.magicalDurabilityCost == null ? null : Math.max(0, Number(entry.magicalDurabilityCost) || 0),
        usesWielderSpellSlot:entry?.usesWielderSpellSlot === true || entry?.uses_wielder_spell_slot === true,
        spCost:Math.max(0, Number(entry?.spCost ?? entry?.sp_cost ?? 0) || 0),
      };
    }).filter((entry) => entry.spellId);
  }

  function isMagicItem(item = {}) {
    const profile = magicProfile(item);
    const runtime = runtimeOf(item);
    return Boolean(
      item.isMagicItem === true || item.magic === true || profile.enabled === true ||
      profile.nativeMagic === true || profile.native_magic === true ||
      enchantmentRefs(item).length > 0 ||
      requiresAttunement(item) || spellProfiles(item).length ||
      runtime.curse || runtime.cursed === true || item.cursed === true || isBoundItem(item) ||
      item.relic === true || item.artifact === true || profile.relic === true || profile.artifact === true
    );
  }

  function attunementStore(unit = {}, create = false) {
    const candidates = ["attunedItemInstanceIds", "attunedItems", "itemAttunements"];
    for (const key of candidates) {
      if (Array.isArray(unit[key])) return { key, value: unit[key] };
    }
    if (!create) return { key: "attunedItemInstanceIds", value: [] };
    unit.attunedItemInstanceIds = [];
    return { key: "attunedItemInstanceIds", value: unit.attunedItemInstanceIds };
  }

  function getAttunementCapacity(unit = {}, options = {}) {
    const explicit = options.capacity ?? unit.attunementCapacity ?? unit.itemRules?.attunementCapacity ?? unit.magicItemRules?.attunementCapacity;
    return Math.max(0, intOr(explicit, DEFAULT_ATTUNEMENT_CAPACITY));
  }

  function getAttunedItems(unit = {}) {
    return [...new Set(attunementStore(unit).value.map(String).filter(Boolean))];
  }

  function isAttuned(unit, item) {
    const id = typeof item === "string" ? item : instanceIdOf(item);
    return Boolean(id) && getAttunedItems(unit).includes(String(id));
  }

  function attunementRequirements(item = {}) {
    const profile = magicProfile(item);
    return clone(profile.attunementRequirements || profile.attunement_requirements || item.attunementRequirements || []);
  }

  function canAttune(unit, item, options = {}) {
    if (!unit || !item) return { allowed: false, reason: "missing_unit_or_item" };
    if (!requiresAttunement(item)) return { allowed: false, reason: "item_does_not_require_attunement" };
    const id = instanceIdOf(item);
    if (!id) return { allowed: false, reason: "missing_item_instance_id" };
    if (isAttuned(unit, item)) return { allowed: true, alreadyAttuned: true, capacity: getAttunementCapacity(unit, options) };
    const capacity = getAttunementCapacity(unit, options);
    const current = getAttunedItems(unit).length;
    if (current >= capacity) return { allowed: false, reason: "attunement_capacity_reached", current, capacity };

    const requirements = attunementRequirements(item);
    if (typeof options.checkRequirement === "function") {
      for (const requirement of requirements) {
        const result = options.checkRequirement(unit, requirement, item);
        if (result === false || result?.allowed === false) {
          return { allowed: false, reason: result?.reason || "attunement_requirement_failed", requirement };
        }
      }
    } else if (requirements.length && options.ignoreRequirements !== true) {
      return { allowed: false, reason: "attunement_requirement_resolver_unavailable", requirements };
    }
    return { allowed: true, current, capacity, requirements };
  }

  function attuneItem(unit, item, options = {}) {
    const gate = canAttune(unit, item, options);
    if (!gate.allowed) return { attuned: false, ...gate };
    if (gate.alreadyAttuned) return { attuned: true, alreadyAttuned: true, itemInstanceId: instanceIdOf(item) };
    const store = attunementStore(unit, true).value;
    const id = instanceIdOf(item);
    store.push(id);
    item.attuned = true;
    item.attunedToId = options.attunedToId || unit.id || unit.characterId || unit.playerId || null;
    const result = { attuned: true, itemInstanceId: id, current: store.length, capacity: gate.capacity };
    emit("luminous:item-attuned", { unit, item, ...result });
    return result;
  }

  function unattuneItem(unit, item, options = {}) {
    if (!unit || !item) return { unattuned: false, reason: "missing_unit_or_item" };
    if (typeof item === "object" && isBoundItem(item) && options.force !== true) {
      return { unattuned: false, reason: "bound_attunement_locked", itemInstanceId: instanceIdOf(item) };
    }
    const id = typeof item === "string" ? item : instanceIdOf(item);
    const store = attunementStore(unit, true);
    const before = store.value.length;
    unit[store.key] = store.value.filter((entry) => String(entry) !== String(id));
    if (typeof item === "object") {
      item.attuned = false;
      item.attunedToId = null;
    }
    const result = { unattuned: unit[store.key].length < before, itemInstanceId: id };
    if (result.unattuned) emit("luminous:item-unattuned", { unit, item, ...result });
    return result;
  }

  function findSpellProfile(item, spellRef = null) {
    const list = spellProfiles(item);
    if (!spellRef) return list.length === 1 ? list[0] : null;
    const wanted = normalizeId(typeof spellRef === "object" ? (spellRef.spellId || spellRef.id) : spellRef);
    return list.find((entry) => normalizeId(entry.spellId) === wanted) || null;
  }

  function resolveItemSpellcasting(user, item, spellRef, options = {}) {
    const profile = findSpellProfile(item, spellRef);
    if (!profile) return { resolved: false, reason: "spell_not_granted_by_item" };
    const spells = spellRuntime();
    const classId = profile.classId || profile.class_id || magicProfile(item).classId || options.classId || null;
    const inherited = classId && spells?.resolveSpellcasting
      ? spells.resolveSpellcasting(user || {}, classId, options.runtime || {}, options.variables || {})
      : null;
    const spellAttack = Number.isFinite(Number(profile.spellAttack ?? profile.spell_attack))
      ? Number(profile.spellAttack ?? profile.spell_attack)
      : inherited?.spellAttack ?? null;
    const spellDC = Number.isFinite(Number(profile.spellDC ?? profile.spell_dc))
      ? Number(profile.spellDC ?? profile.spell_dc)
      : inherited?.spellDC ?? null;
    return {
      resolved: true,
      spellId: profile.spellId,
      spellLevel: Math.max(0, intOr(profile.spellLevel ?? profile.spell_level, 0)),
      chargeCost: profile.chargeCost,
      classId,
      abilityId: inherited?.abilityId || profile.abilityId || null,
      spellAttack,
      spellDC,
      profile,
    };
  }

  function enchantmentEffectResolution(user, item, context = {}) {
    const engine = enchantmentEngine();
    if (!engine?.resolveEffectsForAction) return { resolved:false, reason:"enchantment_engine_unavailable", effects:[] };
    const active = itemBenefitsActive(user, item, { specialUse:context.specialUse === true });
    if (!active.active) return { resolved:false, reason:active.reason, effects:[], suppressed:true };
    const result = engine.resolveEffectsForAction(item, {
      trigger:context.trigger,
      selectedChannels:context.selectedChannels || context.channels || {},
      magicActive:true,
    });
    return { ...result, active:true };
  }

  function enchantmentCombatSummary(user, item, context = {}) {
    const resolution = enchantmentEffectResolution(user, item, context);
    const effects = asArray(resolution.effects);
    const damagePercent = effects
      .filter((effect) => normalizeId(effect.type) === "damage_percent")
      .reduce((sum,effect)=>sum + (Number(effect.value) || 0),0);
    const secondaryDamagePercent = effects
      .filter((effect) => normalizeId(effect.type) === "secondary_damage_percent")
      .reduce((sum,effect)=>sum + (Number(effect.value) || 0),0);
    const magicHit = effects.some((effect) => normalizeId(effect.type) === "magic_hit" && effect.value !== false);
    return {
      ...resolution,
      damagePercent,
      secondaryDamagePercent,
      totalDamagePercent:damagePercent + secondaryDamagePercent,
      magicHit,
    };
  }

  function spendResolvedEnchantmentWear(item, resolution, options = {}) {
    if (!item) return { spent:false, reason:"missing_item" };
    const groups = new Map();
    for (const effect of asArray(resolution?.effects)) {
      const sourceId = String(effect.sourceEnchantmentId || "");
      if (!sourceId) continue;
      const properties = asArray(effect.sourceProperties).map(normalizeId);
      const bound = properties.includes("bind");
      if (bound && options.specialUse !== true) continue;
      const baseWear = Math.max(0, Number(effect.sourceMagicalWear ?? effect.magicalWear ?? 0) || 0);
      const multiplier = Math.max(0, Number(effect.materialWearMultiplier ?? 1) || 1);
      const total = baseWear * multiplier;
      const previous = groups.get(sourceId) || 0;
      groups.set(sourceId, Math.max(previous,total));
    }
    const amount = [...groups.values()].reduce((sum,value)=>sum+value,0);
    if (amount <= 0) return { spent:true, amount:0, skipped:true, reason:"no_authored_magical_wear" };
    return spendMagicalDurability(item, amount, { specialUse:options.specialUse === true, normalWear:options.specialUse !== true });
  }

  function nonMagicHitDefenseMultiplier(defender = {}) {
    const value =
      defender.nonMagicHitDamageMultiplier ??
      defender.non_magic_hit_damage_multiplier ??
      defender.defenses?.nonMagicHitDamageMultiplier ??
      defender.magicDefense?.nonMagicHitDamageMultiplier ??
      defender.magicDefense?.non_magic_hit_damage_multiplier;
    if (Number.isFinite(Number(value))) return Math.max(0, Math.min(1, Number(value)));
    const enabled = defender.reduceNonMagicHits === true ||
      defender.reduce_non_magic_hits === true ||
      defender.defenses?.reduceNonMagicHits === true ||
      defender.magicDefense?.reduceNonMagicHits === true;
    return enabled ? 0.5 : null;
  }

  function applyNonMagicHitDefense(damage, defender = {}, context = {}) {
    const original = Math.max(0, Number(damage) || 0);
    if (context.magicHit === true) return { damage:original, original, multiplier:1, bypassed:true, reason:"magic_hit" };
    const delivery = normalizeId(context.delivery || context.deliveryType || context.rangeType || "");
    if (delivery && !["melee","ranged"].includes(delivery)) {
      return { damage:original, original, multiplier:1, bypassed:false, reason:"delivery_not_eligible" };
    }
    const multiplier = nonMagicHitDefenseMultiplier(defender);
    if (multiplier == null) return { damage:original, original, multiplier:1, bypassed:false, reason:"no_non_magic_hit_defense" };
    return {
      damage:Math.max(0, Math.floor(original * multiplier)),
      original,
      multiplier,
      bypassed:false,
      reason:"non_magic_hit_reduction",
    };
  }

  function passiveEnchantmentModifiers(user, item) {
    const resolution = enchantmentEffectResolution(user, item, { trigger:"passive" });
    const modifiers = {};
    for (const effect of asArray(resolution.effects)) {
      const type = normalizeId(effect.type);
      if (!["resistance_percent","status_resistance_percent","max_hp_percent","max_sp_percent","speed_percent","initiative_flat"].includes(type)) continue;
      modifiers[type] = (modifiers[type] || 0) + (Number(effect.value) || 0);
    }
    return { ...resolution, modifiers };
  }

  function chargeState(item, spellProfile = null) {
    const resource = normalizeId(spellProfile?.resource || "");
    if (resource === "magical_durability") return magicalDurabilityState(item);
    const runtime = itemRuntimeFor("getCharges");
    if (runtime) return runtime.getCharges(item);
    const max = item.chargesMax ?? item.maxCharges ?? null;
    const current = item.chargesCurrent ?? item.charges ?? max;
    return { current: current == null ? null : Math.max(0, intOr(current, 0)), max: max == null ? null : Math.max(0, intOr(max, 0)) };
  }

  function canActivateSpellFromItem(user, item, spellRef, options = {}) {
    if (!item) return { allowed: false, reason: "missing_item" };
    const casting = resolveItemSpellcasting(user, item, spellRef, options);
    if (!casting.resolved) return { allowed: false, reason: casting.reason };
    const active = itemBenefitsActive(user || {}, item, { specialUse:true });
    if (!active.active) return { allowed:false, reason:active.reason, casting };
    const profile = casting.profile || {};
    const chargeCost = Math.max(0, intOr(options.chargeCost ?? casting.chargeCost, 0));
    const resource = profile.usesWielderSpellSlot === true ? "wielder_spell_slot" : normalizeId(profile.resource || "charges");
    const magicalDurabilityCost = Math.max(0, Number(options.magicalDurabilityCost ?? profile.magicalDurabilityCost ?? (resource === "magical_durability" ? chargeCost : 0)) || 0);
    if (resource === "magical_durability" && magicalDurabilityCost > 0) {
      const state = magicalDurabilityState(item);
      if (state.current == null) return { allowed:false, reason:"item_has_no_magical_durability", casting, resource, magicalDurabilityCost };
      if (state.current < magicalDurabilityCost) return { allowed:false, reason:"insufficient_magical_durability", casting, resource, magicalDurabilityCost };
    } else if (resource === "charges" && chargeCost > 0) {
      const charges = chargeState(item, profile);
      if (charges.current == null) return { allowed: false, reason: "item_has_no_charges", casting };
      if (Number(charges.current) < chargeCost) return { allowed: false, reason: "insufficient_charges", casting, chargeCost, resource };
    }
    const spCost = Math.max(0, Number(options.spCost ?? profile.spCost ?? 0) || 0);
    if (spCost > 0 && Math.max(0, Number(user?.sp) || 0) < spCost) return { allowed:false, reason:"insufficient_sp", casting, spCost, resource };
    return { allowed: true, casting, chargeCost, magicalDurabilityCost, spCost, resource };
  }

  function executeSpellHook(user, item, casting, options = {}) {
    const executor = options.executeSpell || options.spellExecutor || global.LuminousSpellExecutor?.castSpell;
    const payload = {
      user,
      item,
      spellId: casting.spellId,
      spellLevel: casting.spellLevel,
      spellAttack: casting.spellAttack,
      spellDC: casting.spellDC,
      target: options.target || null,
      context: options.context || {},
      source: "item",
      resourcePayment: options.resourcePayment || casting.profile?.resource || (casting.profile?.usesWielderSpellSlot === true ? "wielder_spell_slot" : "charges"),
      useWielderSpellSlot: casting.profile?.usesWielderSpellSlot === true,
    };
    if (typeof executor !== "function") {
      emit("luminous:item-spell-cast-requested", payload);
      return { executed: false, prepared: true, reason: "spell_executor_unavailable", payload };
    }
    const result = executor(payload);
    if (result === false || result?.executed === false || result?.cast === false) {
      return { executed: false, prepared: true, reason: result?.reason || "spell_execution_failed", result, payload };
    }
    return { executed: true, prepared: true, result, payload };
  }

  function castSpellFromItem(user, item, spellRef, options = {}) {
    const gate = canActivateSpellFromItem(user, item, spellRef, options);
    if (!gate.allowed) return { cast: false, ...gate };
    const execution = executeSpellHook(user, item, gate.casting, options);
    if (!execution.executed) return { cast: false, ...gate, ...execution };

    let charges = null;
    let magicalDurability = null;
    if (gate.resource === "magical_durability" && gate.magicalDurabilityCost > 0) {
      magicalDurability = spendMagicalDurability(item, gate.magicalDurabilityCost, { specialUse:true, normalWear:false });
      if (!magicalDurability?.spent) return { cast:false, reason:magicalDurability?.reason || "magical_durability_spend_failed", execution, magicalDurability };
    } else if (gate.resource === "charges" && gate.chargeCost > 0) {
      const runtime = itemRuntimeFor("spendCharges");
      charges = runtime?.spendCharges?.(item, gate.chargeCost) || null;
      if (!charges?.spent) return { cast: false, reason: charges?.reason || "charge_spend_failed", execution, charges };
    }
    let spSpent = 0;
    if (gate.spCost > 0) {
      user.sp = Math.max(0, Number(user.sp) - gate.spCost);
      spSpent = gate.spCost;
    }
    const result = { cast: true, casting: gate.casting, execution, charges, magicalDurability, spSpent, resource:gate.resource };
    emit("luminous:item-spell-cast", { user, item, ...result });
    return result;
  }

  function isSpellScroll(item = {}) {
    const category = normalizeId(item.category || item.type || item.itemType || "");
    const tags = asArray(item.tags).map(normalizeId);
    return item.isSpellScroll === true || category === "spell_scroll" || tags.includes("spell_scroll") || normalizeId(magicProfile(item).kind) === "spell_scroll";
  }

  function useSpellScroll(user, item, options = {}) {
    if (!isSpellScroll(item)) return { used: false, reason: "item_not_spell_scroll" };
    const spellRef = options.spellId || item.runtimeState?.spellId || item.customData?.spellId || spellProfiles(item)[0]?.spellId;
    const result = castSpellFromItem(user, item, spellRef, { ...options, chargeCost: 0 });
    if (!result.cast) return { used: false, ...result };
    const runtime = itemRuntimeFor("consumeQuantity");
    const consumed = runtime?.consumeQuantity?.(item, 1) || { consumed: false, reason: "quantity_runtime_unavailable" };
    return { used: consumed.consumed === true, consumed, ...result };
  }

  function isCursed(item = {}) {
    const runtime = runtimeOf(item);
    const profile = magicProfile(item);
    return item.cursed === true || runtime.cursed === true || Boolean(runtime.curse || profile.curse || item.curse) ||
      cursedEnchantmentRefs(item).length > 0 || isBoundItem(item);
  }

  function revealCurse(item) {
    if (!item || !isCursed(item)) return { revealed: false, reason: "item_not_cursed" };
    if (!item.runtimeState || typeof item.runtimeState !== "object") item.runtimeState = {};
    item.runtimeState.curseRevealed = true;
    emit("luminous:item-curse-revealed", { item });
    return { revealed: true, itemInstanceId: instanceIdOf(item) };
  }

  function curseProfile(item = {}) {
    const explicit = runtimeOf(item).curse || magicProfile(item).curse || item.curse || null;
    if (explicit) return clone(explicit);
    const boundRefs = boundEnchantmentRefs(item);
    if (boundRefs.length) {
      return {
        kind: "bind",
        source: "enchantment",
        enchantmentDefinitionIds: boundRefs.map((entry) => String(entry.definitionId || entry.enchantmentId || entry.id || "")).filter(Boolean),
        attunementLocked: true,
        unequipLocked: true,
      };
    }
    const curseRefs = cursedEnchantmentRefs(item);
    if (curseRefs.length) {
      return {
        kind: "curse",
        source: "enchantment",
        enchantmentDefinitionIds: curseRefs.map((entry) => String(entry.definitionId || entry.enchantmentId || entry.id || "")).filter(Boolean),
        hiddenDrawback: true,
      };
    }
    return null;
  }

  function applyCurse(user, item, options = {}) {
    if (!user || !item || !isCursed(item)) return { applied: false, reason: "missing_or_uncursed_item" };
    if (!Array.isArray(user.itemCurses)) user.itemCurses = [];
    const sourceItemInstanceId = instanceIdOf(item);
    const existing = user.itemCurses.find((entry) => entry.sourceItemInstanceId === sourceItemInstanceId);
    if (existing) return { applied: true, alreadyApplied: true, curse: clone(existing) };
    const curse = { sourceItemInstanceId, sourceDefinitionId: definitionIdOf(item), profile: curseProfile(item), active: true };
    user.itemCurses.push(curse);
    if (typeof options.onApply === "function") options.onApply(user, item, curse);
    emit("luminous:item-curse-applied", { user, item, curse: clone(curse) });
    return { applied: true, curse };
  }

  function removeCurse(user, itemOrRef, options = {}) {
    if (!user || !Array.isArray(user.itemCurses)) return { removed: false, reason: "no_item_curses" };
    const id = typeof itemOrRef === "string" ? itemOrRef : instanceIdOf(itemOrRef);
    const before = user.itemCurses.length;
    const removedEntries = user.itemCurses.filter((entry) => entry.sourceItemInstanceId === id);
    user.itemCurses = user.itemCurses.filter((entry) => entry.sourceItemInstanceId !== id);
    if (removedEntries.length && typeof options.onRemove === "function") options.onRemove(user, itemOrRef, removedEntries);
    return { removed: user.itemCurses.length < before, removedEntries };
  }

  const api = Object.freeze({
    version: VERSION,
    VERSION,
    DEFAULT_ATTUNEMENT_CAPACITY,
    magicProfile,
    magicOrigin,
    isNativeMagicItem,
    enchantmentRefs,
    highestEnchantmentRank,
    boundEnchantmentRefs,
    cursedEnchantmentRefs,
    isBoundItem,
    isMagicItem,
    requiresAttunement,
    magicalDurabilityState,
    setMagicalDurability,
    cursePersistsAtZero,
    magicalPowerActive,
    itemBenefitsActive,
    spendMagicalDurability,
    restoreMagicalDurability,
    processMagicalRecharge,
    boundEmergencyRecharge,
    getAttunementCapacity,
    getAttunedItems,
    isAttuned,
    attunementRequirements,
    canAttune,
    attuneItem,
    unattuneItem,
    spellProfiles,
    findSpellProfile,
    resolveItemSpellcasting,
    enchantmentEffectResolution,
    enchantmentCombatSummary,
    spendResolvedEnchantmentWear,
    nonMagicHitDefenseMultiplier,
    applyNonMagicHitDefense,
    passiveEnchantmentModifiers,
    chargeState,
    canActivateSpellFromItem,
    castSpellFromItem,
    isSpellScroll,
    useSpellScroll,
    isCursed,
    revealCurse,
    curseProfile,
    applyCurse,
    removeCurse,
  });

  global.LuminousItemMagicRuntime = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
