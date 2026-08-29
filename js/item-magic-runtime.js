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

  const items = () => global.LuminousItemInventoryRuntime || global.LuminousItemRuntime || safeRequire("./item-inventory-runtime.js") || safeRequire("./item-runtime-engine.js");
  const spells = () => global.LuminousSpellcastingRuntime || safeRequire("./spellcasting-runtime.js");
  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
  const intOr = (value, fallback = 0) => Number.isFinite(Number(value)) ? Math.trunc(Number(value)) : fallback;
  const numberOr = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const normalizeId = (value) => String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  const asArray = (value) => value == null ? [] : (Array.isArray(value) ? value : [value]);

  const DEFAULT_ATTUNEMENT_CAPACITY = 3;

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
    return String(item.instanceId || item.instance_id || items()?.itemId?.(item) || "").trim();
  }

  function definitionIdOf(item = {}) {
    return String(item.definitionId || item.definition_id || items()?.definitionId?.(item) || "").trim();
  }

  function magicProfile(item = {}) {
    const runtime = runtimeOf(item);
    const explicit = runtime.magic || runtime.magicItem || runtime.magic_item || item.magic || item.magicItem || item.magic_item || {};
    return explicit && typeof explicit === "object" ? explicit : {};
  }

  function isMagicItem(item = {}) {
    const profile = magicProfile(item);
    const runtime = runtimeOf(item);
    return Boolean(
      item.isMagicItem === true || item.magic === true || profile.enabled === true ||
      requiresAttunement(item) || spellProfiles(item).length ||
      runtime.curse || runtime.cursed === true || item.cursed === true
    );
  }

  function requiresAttunement(item = {}) {
    const profile = magicProfile(item);
    const runtime = runtimeOf(item);
    return item.requiresAttunement === true || item.requires_attunement === true ||
      profile.requiresAttunement === true || profile.requires_attunement === true ||
      runtime.requiresAttunement === true || runtime.requires_attunement === true;
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

  function unattuneItem(unit, item) {
    if (!unit || !item) return { unattuned: false, reason: "missing_unit_or_item" };
    const id = typeof item === "string" ? item : instanceIdOf(item);
    const store = attunementStore(unit, true).value;
    const before = store.length;
    const next = store.filter((entry) => String(entry) !== String(id));
    unit[attunementStore(unit, true).key] = next;
    if (typeof item === "object") {
      item.attuned = false;
      item.attunedToId = null;
    }
    const result = { unattuned: next.length < before, itemInstanceId: id };
    if (result.unattuned) emit("luminous:item-unattuned", { unit, item, ...result });
    return result;
  }

  function spellProfiles(item = {}) {
    const runtime = runtimeOf(item);
    const profile = magicProfile(item);
    const raw = profile.spells || profile.itemSpells || runtime.itemSpells || runtime.spells || item.itemSpells || item.spells ||
      (profile.spellId || runtime.spellId || item.spellId ? [{ spellId: profile.spellId || runtime.spellId || item.spellId }] : []);
    return asArray(raw).map((entry) => {
      if (typeof entry === "string") return { spellId: entry, chargeCost: 1 };
      return {
        ...clone(entry),
        spellId: entry?.spellId || entry?.spell_id || entry?.id || null,
        chargeCost: Math.max(0, intOr(entry?.chargeCost ?? entry?.charge_cost, 1)),
      };
    }).filter((entry) => entry.spellId);
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
    const spellRuntime = spells();
    const classId = profile.classId || profile.class_id || magicProfile(item).classId || options.classId || null;
    const inherited = classId && spellRuntime?.resolveSpellcasting
      ? spellRuntime.resolveSpellcasting(user || {}, classId, options.runtime || {}, options.variables || {})
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

  function canActivateSpellFromItem(user, item, spellRef, options = {}) {
    if (!item) return { allowed: false, reason: "missing_item" };
    const casting = resolveItemSpellcasting(user, item, spellRef, options);
    if (!casting.resolved) return { allowed: false, reason: casting.reason };
    if (requiresAttunement(item) && !isAttuned(user || {}, item)) return { allowed: false, reason: "item_not_attuned", casting };
    const chargeCost = Math.max(0, intOr(options.chargeCost ?? casting.chargeCost, 0));
    if (chargeCost > 0) {
      const chargeState = items()?.getCharges?.(item) || { current: item.chargesCurrent ?? item.charges ?? null };
      if (chargeState.current == null) return { allowed: false, reason: "item_has_no_charges", casting };
      if (Number(chargeState.current) < chargeCost) return { allowed: false, reason: "insufficient_charges", casting, chargeCost };
    }
    return { allowed: true, casting, chargeCost };
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
    };
    if (typeof executor !== "function") {
      emit("luminous:item-spell-cast-requested", payload);
      return { executed: false, prepared: true, reason: "spell_executor_unavailable", payload };
    }
    const result = executor(payload);
    if (result === false || result?.executed === false || result?.cast === false) return { executed: false, prepared: true, reason: result?.reason || "spell_execution_failed", result, payload };
    return { executed: true, prepared: true, result, payload };
  }

  function castSpellFromItem(user, item, spellRef, options = {}) {
    const gate = canActivateSpellFromItem(user, item, spellRef, options);
    if (!gate.allowed) return { cast: false, ...gate };
    const execution = executeSpellHook(user, item, gate.casting, options);
    if (!execution.executed) return { cast: false, ...gate, ...execution };
    let charges = null;
    if (gate.chargeCost > 0) {
      charges = items()?.spendCharges?.(item, gate.chargeCost);
      if (!charges?.spent) return { cast: false, reason: charges?.reason || "charge_spend_failed", execution, charges };
    }
    const result = { cast: true, casting: gate.casting, execution, charges };
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
    const consumed = items()?.consumeQuantity?.(item, 1);
    return { used: Boolean(consumed?.consumed), consumed, ...result };
  }

  function isCursed(item = {}) {
    const runtime = runtimeOf(item);
    const profile = magicProfile(item);
    return item.cursed === true || runtime.cursed === true || Boolean(runtime.curse || profile.curse || item.curse);
  }

  function revealCurse(item) {
    if (!item || !isCursed(item)) return { revealed: false, reason: "item_not_cursed" };
    if (!item.runtimeState || typeof item.runtimeState !== "object") item.runtimeState = {};
    item.runtimeState.curseRevealed = true;
    emit("luminous:item-curse-revealed", { item });
    return { revealed: true, itemInstanceId: instanceIdOf(item) };
  }

  function curseProfile(item = {}) {
    return clone(runtimeOf(item).curse || magicProfile(item).curse || item.curse || null);
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
    version: 1,
    DEFAULT_ATTUNEMENT_CAPACITY,
    magicProfile,
    isMagicItem,
    requiresAttunement,
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
