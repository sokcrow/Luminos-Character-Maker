(function (global) {
  "use strict";

  const spellcasting = global.LuminousSpellcastingRuntime
    || (typeof require === "function" ? require("./spellcasting-basic-rules-runtime.js") : null);
  const speedRuntime = global.LuminousUniversalSpeedRuntime
    || (typeof require === "function" ? (() => { try { return require("./universal-speed-runtime.js"); } catch (_) { return null; } })() : null);

  const CLASS_ID = "sorcerer";
  const CLASS_NAME = "Sorcerer";
  const CATALOG_VERSION = 1;
  const STATE_ROOT = "classResources";
  const STATE_KEY = "sorcerer";
  const MAX_CREATED_SLOT_LEVEL = 5;
  const SPELL_SLOT_COST = Object.freeze({ 1: 2, 2: 3, 3: 5, 4: 6, 5: 7 });
  const METAMAGIC_IDS = Object.freeze([
    "careful_spell",
    "distant_spell",
    "empowered_spell",
    "extended_spell",
    "heightened_spell",
    "quickened_spell",
    "subtle_spell",
    "twinned_spell",
    "seeking_spell",
    "transmuted_spell",
  ]);
  const COMBINABLE_METAMAGIC = Object.freeze(new Set(["empowered_spell", "seeking_spell"]));
  const SIN_TYPES = Object.freeze(["wrath", "lust", "sloth", "gluttony", "gloom", "pride", "envy"]);

  const normalizeId = (value) => String(value ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  const intOr = (value, fallback = 0) => Number.isFinite(Number.parseInt(value, 10)) ? Number.parseInt(value, 10) : fallback;
  const numberOr = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));

  function sourceFor() {
    return { type: "class", id: CLASS_ID, classId: CLASS_ID, className: CLASS_NAME };
  }

  function classEntries(character = {}) {
    const build = character?.characterBuild && typeof character.characterBuild === "object" ? character.characterBuild : {};
    return (Array.isArray(character.classes) ? character.classes : (Array.isArray(build.classes) ? build.classes : []))
      .filter((entry) => entry && typeof entry === "object");
  }

  function sorcererClassLevel(character = {}) {
    const entry = classEntries(character).find((item) => normalizeId(item.classId || item.id) === CLASS_ID);
    return Math.max(0, intOr(entry?.classLevel ?? entry?.level ?? entry?.levels ?? entry?.class_level, 0));
  }

  function sorceryPointMaximum(character = {}) {
    const level = sorcererClassLevel(character);
    return level >= 10 ? Math.max(1, Math.floor(level / 5)) : 0;
  }

  function ensureSorcererState(character) {
    if (!character || typeof character !== "object") throw new Error("Sorcerer Runtime requires a character object.");
    if (!character[STATE_ROOT] || typeof character[STATE_ROOT] !== "object" || Array.isArray(character[STATE_ROOT])) character[STATE_ROOT] = {};
    if (!character[STATE_ROOT][STATE_KEY] || typeof character[STATE_ROOT][STATE_KEY] !== "object" || Array.isArray(character[STATE_ROOT][STATE_KEY])) {
      character[STATE_ROOT][STATE_KEY] = {};
    }
    const state = character[STATE_ROOT][STATE_KEY];
    const maximum = sorceryPointMaximum(character);
    if (!state.sorceryPoints || typeof state.sorceryPoints !== "object" || Array.isArray(state.sorceryPoints)) state.sorceryPoints = {};
    state.sorceryPoints.maximum = maximum;
    if (!Number.isFinite(Number(state.sorceryPoints.current))) state.sorceryPoints.current = maximum;
    state.sorceryPoints.current = Math.max(0, Math.min(maximum, intOr(state.sorceryPoints.current, maximum)));
    if (!state.createdSpellSlots || typeof state.createdSpellSlots !== "object" || Array.isArray(state.createdSpellSlots)) state.createdSpellSlots = {};
    for (let level = 1; level <= MAX_CREATED_SLOT_LEVEL; level += 1) {
      const key = String(level);
      state.createdSpellSlots[key] = Math.max(0, intOr(state.createdSpellSlots[key], 0));
    }
    if (!Array.isArray(state.metamagic)) state.metamagic = [];
    state.metamagic = [...new Set(state.metamagic.map(normalizeId).filter((id) => METAMAGIC_IDS.includes(id)))];
    return state;
  }

  function sorceryPointPool(character) {
    const pool = ensureSorcererState(character).sorceryPoints;
    return { current: pool.current, maximum: pool.maximum, available: pool.current };
  }

  function spendSorceryPoints(character, amount) {
    const value = Math.max(0, intOr(amount, 0));
    const state = ensureSorcererState(character);
    if (state.sorceryPoints.current < value) {
      return { success: false, spent: 0, reason: "Not enough Sorcery Points.", pool: sorceryPointPool(character) };
    }
    state.sorceryPoints.current -= value;
    return { success: true, spent: value, pool: sorceryPointPool(character) };
  }

  function recoverSorceryPoints(character, amount) {
    const value = Math.max(0, intOr(amount, 0));
    const state = ensureSorcererState(character);
    const before = state.sorceryPoints.current;
    state.sorceryPoints.current = Math.min(state.sorceryPoints.maximum, before + value);
    return { recovered: state.sorceryPoints.current - before, pool: sorceryPointPool(character) };
  }

  function recoverAllSorceryPoints(character) {
    const state = ensureSorcererState(character);
    const before = state.sorceryPoints.current;
    state.sorceryPoints.current = state.sorceryPoints.maximum;
    return { recovered: state.sorceryPoints.current - before, pool: sorceryPointPool(character) };
  }

  function temporarySpellSlotPool(character) {
    return clone(ensureSorcererState(character).createdSpellSlots);
  }

  function grantTemporarySpellSlot(character, slotLevel, count = 1) {
    const level = Math.max(1, intOr(slotLevel, 1));
    if (level > MAX_CREATED_SLOT_LEVEL) return { success: false, reason: "Font of Magic can create Spell Slots only from 1st to 5th level." };
    const state = ensureSorcererState(character);
    const key = String(level);
    state.createdSpellSlots[key] += Math.max(0, intOr(count, 1));
    return { success: true, slotLevel: level, count: state.createdSpellSlots[key], pool: temporarySpellSlotPool(character) };
  }

  function consumeTemporarySpellSlot(character, slotLevel) {
    const level = Math.max(1, intOr(slotLevel, 1));
    const state = ensureSorcererState(character);
    const key = String(level);
    if (intOr(state.createdSpellSlots[key], 0) <= 0) return { success: false, consumed: 0, slotLevel: level };
    state.createdSpellSlots[key] -= 1;
    return { success: true, consumed: 1, slotLevel: level, pool: temporarySpellSlotPool(character) };
  }

  function clearTemporarySpellSlots(character) {
    const state = ensureSorcererState(character);
    Object.keys(state.createdSpellSlots).forEach((key) => { state.createdSpellSlots[key] = 0; });
    return temporarySpellSlotPool(character);
  }

  function actionEconomyQuickAction(options = {}) {
    const economy = options.actionEconomy || options.runtime?.actionEconomy;
    if (!economy) return { success: true, skipped: true };
    const spend = economy.spendQuickAction || economy.useQuickAction || economy.consumeQuickAction;
    if (typeof spend !== "function") return { success: true, skipped: true };
    const result = spend.call(economy, { source: options.source || "font_of_magic" });
    if (result === false || result?.success === false) return { success: false, reason: result?.reason || "Quick Action is not available." };
    return { success: true, result };
  }

  function createSpellSlot(character, slotLevel, options = {}) {
    const level = Math.max(1, intOr(slotLevel, 1));
    const cost = SPELL_SLOT_COST[level];
    if (!cost) return { success: false, reason: "Font of Magic can create Spell Slots only from 1st to 5th level.", slotLevel: level };
    const points = sorceryPointPool(character);
    if (points.current < cost) return { success: false, reason: "Not enough Sorcery Points.", slotLevel: level, cost, pool: points };
    const quick = actionEconomyQuickAction({ ...options, source: "font_of_magic_create_slot" });
    if (!quick.success) return { success: false, reason: quick.reason, slotLevel: level, cost };
    spendSorceryPoints(character, cost);
    const created = grantTemporarySpellSlot(character, level, 1);
    return { success: true, slotLevel: level, cost, created, sorceryPoints: sorceryPointPool(character) };
  }

  function convertSpellSlotToSorceryPoints(character, slotLevel, options = {}) {
    const level = Math.max(1, intOr(slotLevel, 1));
    if (sorceryPointPool(character).current >= sorceryPointPool(character).maximum) {
      return { success: false, reason: "Sorcery Points are already at maximum.", slotLevel: level };
    }
    const temporary = ensureSorcererState(character).createdSpellSlots[String(level)] > 0;
    let slotResult = null;
    if (temporary) {
      slotResult = consumeTemporarySpellSlot(character, level);
    } else if (spellcasting?.spendSpellSlot) {
      const spent = spellcasting.spendSpellSlot(character, CLASS_ID, level, options.slotTable);
      if (!spent.available || spent.spent !== 1) return { success: false, reason: spent.reason || `No Level ${level} Spell Slot is available.`, slotLevel: level };
      slotResult = spent;
    } else {
      return { success: false, reason: "Spellcasting Runtime is required to convert a Spell Slot.", slotLevel: level };
    }
    const quick = actionEconomyQuickAction({ ...options, source: "font_of_magic_convert_slot" });
    if (!quick.success) {
      if (temporary) grantTemporarySpellSlot(character, level, 1);
      else {
        const entry = character?.spellcastingState?.slotsByClass?.[CLASS_ID]?.levels?.[String(level)];
        if (entry) entry.spent = Math.max(0, intOr(entry.spent, 0) - 1);
      }
      return { success: false, reason: quick.reason, slotLevel: level };
    }
    const recovered = recoverSorceryPoints(character, level);
    return { success: true, slotLevel: level, slot: slotResult, recovered: recovered.recovered, sorceryPoints: recovered.pool };
  }

  function metamagicChoiceCount(character = {}) {
    const level = sorcererClassLevel(character);
    if (level < 15) return 0;
    if (level >= 85) return 4;
    if (level >= 50) return 3;
    return 2;
  }

  function getKnownMetamagics(character) {
    return clone(ensureSorcererState(character).metamagic);
  }

  function setKnownMetamagics(character, ids = []) {
    const limit = metamagicChoiceCount(character);
    const normalized = [...new Set((Array.isArray(ids) ? ids : [ids]).map(normalizeId).filter((id) => METAMAGIC_IDS.includes(id)))];
    if (normalized.length > limit) return { success: false, reason: `Sorcerer Class Level allows only ${limit} Metamagic option(s).`, limit, known: getKnownMetamagics(character) };
    ensureSorcererState(character).metamagic = normalized;
    return { success: true, limit, known: getKnownMetamagics(character) };
  }

  function charismaModifier(character = {}, options = {}) {
    if (Number.isFinite(Number(options.charismaModifier))) return Number(options.charismaModifier);
    const stats = character.stats || character.dndStats || {};
    const score = [stats.cha, stats.charisma, stats.carisma, character.cha, character.charisma, character.carisma]
      .find((value) => Number.isFinite(Number(value)));
    return Math.floor((numberOr(score, 10) - 10) / 2);
  }

  function spellLevel(spell = {}, options = {}) {
    return Math.max(0, intOr(options.slotLevel ?? spell.slotLevel ?? spell.spellLevel ?? spell.level, 0));
  }

  function spellKeywords(spell = {}) {
    const raw = [spell.keyword, spell.keywords, spell.tags].flat().filter(Boolean).map(normalizeId);
    if (spell.isIndiscriminate === true) raw.push("indiscriminate");
    return new Set(raw);
  }

  function targetId(target) {
    return String(target?.id || target?.unitId || target?.characterId || target || "").trim();
  }

  function currentAttackWeight(spell = {}) {
    return Math.max(1, intOr(spell.attackWeight ?? spell.atkWeight ?? spell.atk_weight, 1));
  }

  function effectiveSpeed(unit, options = {}) {
    if (!unit) return 0;
    if (speedRuntime?.effectiveSpeed) return numberOr(speedRuntime.effectiveSpeed(unit, options), 0);
    return numberOr(unit.speed ?? unit.Speed ?? unit.combatStats?.speed, 0);
  }

  function canCombineMetamagics(ids = []) {
    if (ids.length <= 1) return true;
    if (ids.length !== 2) return false;
    return ids.some((id) => COMBINABLE_METAMAGIC.has(id));
  }

  function metamagicCost(id, spell = {}) {
    if (id === "twinned_spell") return Math.max(1, spellLevel(spell));
    return ({
      careful_spell: 1,
      distant_spell: 1,
      empowered_spell: 1,
      extended_spell: 1,
      heightened_spell: 3,
      quickened_spell: 2,
      subtle_spell: 1,
      seeking_spell: 2,
      transmuted_spell: 1,
    })[id] || 0;
  }

  function transformCareful(spell, character, options = {}) {
    if (!spellKeywords(spell).has("indiscriminate")) return { success: false, reason: "Careful Spell requires the [Indiscriminate] keyword." };
    const maxUnits = Math.max(1, charismaModifier(character, options));
    const units = (options.units || options.protectedUnits || []).slice(0, maxUnits);
    const next = clone(spell);
    next.metamagic = { ...(next.metamagic || {}), careful: { autoSaveSuccessUnitIds: units.map(targetId).filter(Boolean), maximumUnits: maxUnits } };
    return { success: true, spell: next };
  }

  function transformDistant(spell, character, options = {}) {
    const next = clone(spell);
    const caster = options.caster || options.self || character;
    const target = options.target || null;
    const slower = target ? effectiveSpeed(target, options) < effectiveSpeed(caster, options) : false;
    const bonus = 1 + (slower ? 2 : 0);
    next.clashPowerBonus = numberOr(next.clashPowerBonus, 0) + bonus;
    next.metamagic = { ...(next.metamagic || {}), distant: { clashPowerBonus: bonus, slowerTargetBonus: slower ? 2 : 0 } };
    return { success: true, spell: next };
  }

  function transformEmpowered(spell, character, options = {}) {
    const next = clone(spell);
    const bonus = Math.max(0, Math.ceil(charismaModifier(character, options) / 2));
    next.finalPowerBonus = numberOr(next.finalPowerBonus, 0) + bonus;
    next.metamagic = { ...(next.metamagic || {}), empowered: { finalPowerBonus: bonus } };
    return { success: true, spell: next };
  }

  function transformExtended(spell) {
    const next = clone(spell);
    const capSeconds = 24 * 60 * 60;
    if (Number.isFinite(Number(next.durationSeconds ?? next.duration_seconds))) {
      const key = Object.prototype.hasOwnProperty.call(next, "durationSeconds") ? "durationSeconds" : "duration_seconds";
      next[key] = Math.min(capSeconds, Math.max(0, Number(next[key])) * 2);
    } else if (Number.isFinite(Number(next.durationRounds ?? next.duration_rounds))) {
      const key = Object.prototype.hasOwnProperty.call(next, "durationRounds") ? "durationRounds" : "duration_rounds";
      next[key] = Math.min(capSeconds / 6, Math.max(0, Number(next[key])) * 2);
    } else if (Number.isFinite(Number(next.duration))) {
      next.duration = Math.min(capSeconds, Math.max(0, Number(next.duration)) * 2);
    }
    next.metamagic = { ...(next.metamagic || {}), extended: { durationMultiplier: 2, maximumDurationSeconds: capSeconds } };
    return { success: true, spell: next };
  }

  function transformHeightened(spell, character, options = {}) {
    const id = targetId(options.target);
    if (!id) return { success: false, reason: "Heightened Spell requires one target affected by the Spell." };
    const next = clone(spell);
    next.metamagic = { ...(next.metamagic || {}), heightened: { targetId: id, thresholdBonus: 5, firstSaveOnly: true } };
    return { success: true, spell: next };
  }

  function transformQuickened(spell) {
    const seconds = spellcasting?.normalizeCastingTimeSeconds ? spellcasting.normalizeCastingTimeSeconds(spell) : intOr(spell.castingTimeSeconds, 6);
    if (seconds !== 6) return { success: false, reason: "Quickened Spell requires a Spell with a Casting Time of one Action." };
    const next = clone(spell);
    next.castingTime = "quick_action";
    next.actionCost = "quick_action";
    next.castingTimeSeconds = 3;
    next.metamagic = { ...(next.metamagic || {}), quickened: true };
    return { success: true, spell: next };
  }

  function transformSubtle(spell) {
    const next = clone(spell);
    next.isUnclashable = true;
    next.isClashable = false;
    next.metamagic = { ...(next.metamagic || {}), subtle: { keyword: "Uncrashable" } };
    return { success: true, spell: next };
  }

  function transformTwinned(spell) {
    const weight = currentAttackWeight(spell);
    const targetType = normalizeId(spell.targetType || spell.target_type || "single");
    const multi = spell.canTargetMultiple === true || spell.multiTarget === true || ["multi", "area", "allies", "enemies"].includes(targetType);
    if (weight !== 1 || targetType === "self" || multi) {
      return { success: false, reason: "Twinned Spell requires ATK Weight 1, cannot be Self, and cannot normally target multiple Units." };
    }
    const next = clone(spell);
    next.attackWeight = weight + 1;
    next.atkWeight = weight + 1;
    next.metamagic = { ...(next.metamagic || {}), twinned: { attackWeightBonus: 1, additionalTargetFaction: "enemy" } };
    return { success: true, spell: next };
  }

  function transformSeeking(spell) {
    const next = clone(spell);
    next.coinType = "unbreakable";
    if (Array.isArray(next.coins)) next.coins = next.coins.map((coin) => ({ ...coin, type: "unbreakable" }));
    next.metamagic = { ...(next.metamagic || {}), seeking: { unbreakableCoins: true } };
    return { success: true, spell: next };
  }

  function rewriteSinFields(value, originalSin, chosenSin) {
    if (Array.isArray(value)) return value.map((item) => rewriteSinFields(item, originalSin, chosenSin));
    if (!value || typeof value !== "object") return value;
    const out = {};
    Object.entries(value).forEach(([key, item]) => {
      const normalizedKey = normalizeId(key);
      if (["sin", "sin_type", "sintype", "sin_affinity", "sinaffinity"].includes(normalizedKey) && (typeof item === "string" || item == null)) {
        const normalizedValue = normalizeId(item);
        out[key] = !originalSin || !normalizedValue || normalizedValue === originalSin ? chosenSin : item;
      } else out[key] = rewriteSinFields(item, originalSin, chosenSin);
    });
    return out;
  }

  function transformTransmuted(spell, character, options = {}) {
    const chosen = normalizeId(options.sinType || options.sin || options.chosenSinType);
    if (!chosen) return { success: false, reason: "Transmuted Spell requires a chosen Sin Type." };
    if (options.strictSinTypes !== false && !SIN_TYPES.includes(chosen)) return { success: false, reason: `Unknown Sin Type: ${chosen}.` };
    const original = normalizeId(spell.sinAffinity || spell.sinType || spell.sin_type || spell.sin);
    let next = rewriteSinFields(clone(spell), original, chosen);
    next.sinAffinity = chosen;
    next.sinType = chosen;
    next.metamagic = { ...(next.metamagic || {}), transmuted: { from: original || null, to: chosen, changesSinBasedInflicts: true } };
    return { success: true, spell: next };
  }

  const TRANSFORMS = Object.freeze({
    careful_spell: transformCareful,
    distant_spell: transformDistant,
    empowered_spell: transformEmpowered,
    extended_spell: transformExtended,
    heightened_spell: transformHeightened,
    quickened_spell: transformQuickened,
    subtle_spell: transformSubtle,
    twinned_spell: transformTwinned,
    seeking_spell: transformSeeking,
    transmuted_spell: transformTransmuted,
  });

  function applyMetamagic(character, spellInput = {}, metamagicIds = [], options = {}) {
    const ids = [...new Set((Array.isArray(metamagicIds) ? metamagicIds : [metamagicIds]).map(normalizeId).filter(Boolean))];
    if (!ids.length) return { success: true, spell: clone(spellInput), cost: 0, applied: [] };
    if (ids.some((id) => !METAMAGIC_IDS.includes(id))) return { success: false, reason: "Unknown Metamagic option." };
    if (!canCombineMetamagics(ids)) return { success: false, reason: "Only one Metamagic can be used on a Spell unless otherwise stated." };
    if (options.ignoreKnown !== true) {
      const known = new Set(getKnownMetamagics(character));
      const unknown = ids.find((id) => !known.has(id));
      if (unknown) return { success: false, reason: `${unknown} is not a known Metamagic option.` };
    }
    let next = clone(spellInput);
    const applied = [];
    let totalCost = 0;
    for (const id of ids) {
      const transformed = TRANSFORMS[id](next, character, options);
      if (!transformed.success) return { success: false, reason: transformed.reason, failedMetamagic: id, spell: clone(spellInput) };
      next = transformed.spell;
      totalCost += metamagicCost(id, next);
      applied.push(id);
    }
    const pool = sorceryPointPool(character);
    if (pool.current < totalCost) return { success: false, reason: "Not enough Sorcery Points.", cost: totalCost, pool, spell: clone(spellInput) };
    const spent = spendSorceryPoints(character, totalCost);
    return { success: true, spell: next, cost: totalCost, applied, sorceryPoints: spent.pool };
  }

  function consumeCreatedSlotForCast(character, spellInput = {}, options = {}) {
    if (!spellcasting?.normalizeSpell) return null;
    const spell = spellcasting.normalizeSpell(spellInput, options);
    const requestedSlotLevel = spell.cantrip ? 0 : Math.max(spell.slotLevel, intOr(options.slotLevel, spell.slotLevel));
    if (spell.cantrip || requestedSlotLevel <= 0 || ensureSorcererState(character).createdSpellSlots[String(requestedSlotLevel)] <= 0) return null;
    consumeTemporarySpellSlot(character, requestedSlotLevel);
    const casting = spellcasting.resolveSpellcasting?.(character, CLASS_ID, options.runtime || {}, options.variables || {}) || null;
    return {
      success: true,
      spell,
      classId: CLASS_ID,
      casting,
      save: spellcasting.resolveSpellSave?.(character, CLASS_ID, spell, options.runtime || {}, options.variables || {}) || null,
      resource: { type: "temporary_slot", spent: 1, slotLevel: requestedSlotLevel, pool: temporarySpellSlotPool(character) },
      upcast: spellcasting.resolveUpcast?.(spell, requestedSlotLevel) || null,
      concentration: spellcasting.startConcentration?.(character, spell, { classId: CLASS_ID, startedAt: options.startedAt }) || null,
      castingAction: spellcasting.buildCastingActionMessage?.(spell, options.actorId || character.actorId || character.id, options) || null,
    };
  }

  function castSorcererSpell(character, spellInput = {}, options = {}) {
    const metamagicIds = options.metamagic || options.metamagicIds || [];
    let spell = clone(spellInput);
    let metamagic = null;
    if ((Array.isArray(metamagicIds) && metamagicIds.length) || (!Array.isArray(metamagicIds) && metamagicIds)) {
      metamagic = applyMetamagic(character, spell, metamagicIds, { ...options, slotLevel: options.slotLevel ?? spellLevel(spell, options) });
      if (!metamagic.success) return { success: false, reason: metamagic.reason, metamagic };
      spell = metamagic.spell;
    }
    const temporary = consumeCreatedSlotForCast(character, spell, { ...options, classId: CLASS_ID });
    if (temporary) return { ...temporary, metamagic };
    if (!spellcasting?.castSpell) return { success: false, reason: "Spellcasting Runtime is not available.", spell, metamagic };
    const cast = spellcasting.castSpell(character, spell, { ...options, classId: CLASS_ID });
    return { ...cast, metamagic };
  }

  function handleRest(character, restType) {
    const type = normalizeId(restType);
    const level = sorcererClassLevel(character);
    if (type === "long_rest") {
      const sorceryPoints = recoverAllSorceryPoints(character);
      const createdSpellSlots = clearTemporarySpellSlots(character);
      return { type, sorceryPoints, createdSpellSlots };
    }
    if (type === "short_rest" && level >= 100) {
      return { type, sorceryPoints: recoverSorceryPoints(character, 4) };
    }
    return { type, sorceryPoints: sorceryPointPool(character) };
  }

  function passiveTrait(id, name, description, mechanics = {}) {
    return {
      schemaVersion: 1,
      id,
      name,
      description,
      source: sourceFor(),
      contexts: ["any"],
      activation: { type: "passive", actionCost: "none" },
      effects: [],
      rules: [],
      mechanics,
    };
  }

  function metamagicTrait(id, name, description, cost, mechanics = {}) {
    return passiveTrait(id, name, description, {
      metamagicOption: true,
      sorceryPointCost: cost,
      ...mechanics,
    });
  }

  const DEFINITIONS = Object.freeze({
    sorcerous_origin: passiveTrait(
      "sorcerous_origin",
      "Sorcerous Origin",
      "Choose one Sorcerous Archetype. You gain its Traits as your Sorcerer Class Level increases.",
      { sorcerousOrigin: true, archetypeChoiceDeferred: true, archetypeTraitLevels: [1, 30, 70, 90] },
    ),
    font_of_magic: passiveTrait(
      "font_of_magic",
      "Font of Magic",
      "Gain Sorcery Points equal to floor(Sorcerer Class Level / 5), minimum 1. Recover all Sorcery Points on Long Rest. As a Quick Action, you can spend Sorcery Points to create a Spell Slot or expend a Spell Slot to recover Sorcery Points equal to its Slot Level. Spell Slot Cost: 1st 2, 2nd 3, 3rd 5, 4th 6, 5th 7 Sorcery Points.",
      { fontOfMagic: true, sorceryPointFormula: "max(1, floor(ClassLevel / 5))", recovery: "long_rest", quickAction: true, spellSlotCost: SPELL_SLOT_COST },
    ),
    metamagic: passiveTrait(
      "metamagic",
      "Metamagic",
      "Choose two Metamagic Traits. Gain one additional Metamagic Trait at Sorcerer Class Levels 50 and 85. When you cast a Spell, you may spend Sorcery Points to apply one of your Metamagic Traits. You can use only one Metamagic on a Spell unless otherwise stated.",
      { metamagic: true, optionTraitIds: METAMAGIC_IDS, choiceSchedule: { 15: 2, 50: 3, 85: 4 } },
    ),
    sorcerous_restoration: passiveTrait(
      "sorcerous_restoration",
      "Sorcerous Restoration",
      "When you finish a Short Rest, recover 4 Sorcery Points.",
      { sorcerousRestoration: true, shortRestRecovery: 4 },
    ),
    careful_spell: metamagicTrait("careful_spell", "Careful Spell", "Cost: 1 Sorcery Point. When a Spell forces creatures to make a Save with the [Indiscriminate] keyword, choose up to your Charisma Modifier, minimum 1. Chosen Units automatically succeed on that Save.", 1, { keyword: "Indiscriminate", autoSaveSuccess: true }),
    distant_spell: metamagicTrait("distant_spell", "Distant Spell", "Cost: 1 Sorcery Point. The next Spell gains +1 Clash Power. If the target is Slower, gain +2 additional Clash Power.", 1, { clashPowerBonus: 1, slowerTargetAdditionalClashPower: 2 }),
    empowered_spell: metamagicTrait("empowered_spell", "Empowered Spell", "Cost: 1 Sorcery Point. The next Spell gains Final Power equal to half your Charisma Modifier, rounded up. Empowered Spell can be used with another Metamagic.", 1, { finalPowerFormula: "ceil(CharismaModifier / 2)", combinable: true }),
    extended_spell: metamagicTrait("extended_spell", "Extended Spell", "Cost: 1 Sorcery Point. Double the Duration of the next Spell, up to a maximum of 24 hours.", 1, { durationMultiplier: 2, maximumDurationSeconds: 86400 }),
    heightened_spell: metamagicTrait("heightened_spell", "Heightened Spell", "Cost: 3 Sorcery Points. Choose one target affected by the Spell. Increase the Threshold of its first Save against the Spell by 5.", 3, { firstSaveOnly: true, thresholdBonus: 5 }),
    quickened_spell: metamagicTrait("quickened_spell", "Quickened Spell", "Cost: 2 Sorcery Points. A Spell with a Casting Time of one Action can be cast as a Quick Action instead.", 2, { actionToQuickAction: true }),
    subtle_spell: metamagicTrait("subtle_spell", "Subtle Spell", "Cost: 1 Sorcery Point. The next Spell becomes [Uncrashable].", 1, { keyword: "Uncrashable", engineFlag: "isUnclashable" }),
    twinned_spell: metamagicTrait("twinned_spell", "Twinned Spell", "Cost: Sorcery Points equal to the Spell Level, minimum 1. When casting a Spell with ATK Weight 1 that is not Self and cannot normally target multiple Units, gain +1 ATK Weight. The additional target is always an Enemy Unit.", "max(1, SpellLevel)", { attackWeightBonus: 1, additionalTargetFaction: "enemy" }),
    seeking_spell: metamagicTrait("seeking_spell", "Seeking Spell", "Cost: 2 Sorcery Points. The next Spell gains [Unbreakable Coins]. Seeking Spell can be used with another Metamagic.", 2, { coinType: "unbreakable", combinable: true }),
    transmuted_spell: metamagicTrait("transmuted_spell", "Transmuted Spell", "Cost: 1 Sorcery Point. Change the Sin Type of the next Spell to another Sin Type. Any Sin-based effects inflicted by the Spell change to the chosen Sin Type.", 1, { changesSinType: true, changesSinBasedInflicts: true, sinTypes: SIN_TYPES }),
  });

  function grant(level, traitId) {
    return {
      id: `core_class_${CLASS_ID}_l${level}_${traitId}`,
      sourceType: "class",
      sourceId: CLASS_ID,
      source: { className: CLASS_NAME, atLevel: level, requiredClassLevel: level },
      atLevel: level,
      traitId,
      grantType: "trait",
      multiclassPolicy: "allowed",
    };
  }

  const GRANTS = Object.freeze([
    grant(1, "sorcerous_origin"),
    grant(10, "font_of_magic"),
    grant(15, "metamagic"),
    grant(100, "sorcerous_restoration"),
  ]);

  function grantIdentity(grantValue = {}) {
    return `${grantValue.sourceType}:${grantValue.sourceId}:${grantValue.traitId}:${grantValue.atLevel}`;
  }

  function catalogIsCurrent(source) {
    if (!source?.__sorcererClassExtended) return false;
    const definitions = source.allDefinitions?.() || source.DEFINITIONS || {};
    const grants = source.allGrants?.() || source.GRANTS || [];
    const identities = grants.map(grantIdentity);
    return METAMAGIC_IDS.every((id) => definitions[id]?.mechanics?.metamagicOption === true)
      && GRANTS.every((item) => identities.includes(grantIdentity(item)));
  }

  function wrapCatalog() {
    const source = global.LuminousTraitCatalogCore || (typeof require === "function" ? require("./trait-catalog-core.js") : null);
    if (!source) return false;
    if (catalogIsCurrent(source)) return true;
    const baseDefinitions = source.allDefinitions?.bind(source) || (() => clone(source.DEFINITIONS || {}));
    const baseGrants = source.allGrants?.bind(source) || (() => clone(source.GRANTS || []));
    const baseGet = source.getDefinition?.bind(source) || (() => null);
    const baseValidate = source.validateAll?.bind(source) || (() => ({ valid: true, errors: [], warnings: [] }));
    const allDefinitions = () => ({ ...baseDefinitions(), ...clone(DEFINITIONS) });
    const allGrants = () => {
      const combined = [...baseGrants(), ...clone(GRANTS)];
      const seen = new Set();
      return combined.filter((item) => {
        const identity = grantIdentity(item);
        if (seen.has(identity)) return false;
        seen.add(identity);
        return true;
      });
    };
    const getDefinition = (id) => clone(DEFINITIONS[normalizeId(id)] || baseGet(id));
    const validateAll = (engine = global.LuminousTraitEngine) => {
      const baseResult = baseValidate(engine);
      const errors = [...(baseResult.errors || [])];
      const warnings = [...(baseResult.warnings || [])];
      Object.entries(DEFINITIONS).forEach(([key, definition]) => {
        if (!engine?.validateTrait) return;
        const validation = engine.validateTrait(definition);
        validation.errors.forEach((message) => errors.push(`${key}: ${message}`));
        validation.warnings.forEach((message) => warnings.push(`${key}: ${message}`));
      });
      return { valid: baseResult.valid !== false && !errors.length, errors, warnings };
    };
    global.LuminousTraitCatalogCore = Object.freeze({
      ...source,
      __sorcererClassExtended: true,
      CATALOG_VERSION: Math.max(CATALOG_VERSION, Number(source.CATALOG_VERSION || 0)),
      DEFINITIONS: Object.freeze(allDefinitions()),
      GRANTS: Object.freeze(allGrants()),
      allDefinitions,
      allGrants,
      getDefinition,
      validateAll,
    });
    return true;
  }

  let restListenerBound = false;
  function handleRestCompleted(event) {
    const detail = event?.detail || {};
    const character = detail.character || global.LuminousPlayerTraitRuntime?.getCharacter?.() || global.datosJugador || null;
    if (!character || sorcererClassLevel(character) <= 0) return null;
    return handleRest(character, detail.type);
  }

  function bindRestIntegration() {
    if (restListenerBound || !global.addEventListener) return false;
    global.addEventListener("luminous:rest-completed", handleRestCompleted);
    restListenerBound = true;
    return true;
  }

  function install() {
    bindRestIntegration();
    return wrapCatalog();
  }

  const api = Object.freeze({
    CLASS_ID,
    CLASS_NAME,
    CATALOG_VERSION,
    SPELL_SLOT_COST,
    METAMAGIC_IDS,
    SIN_TYPES,
    DEFINITIONS,
    GRANTS,
    sorcererClassLevel,
    sorceryPointMaximum,
    ensureSorcererState,
    sorceryPointPool,
    spendSorceryPoints,
    recoverSorceryPoints,
    recoverAllSorceryPoints,
    temporarySpellSlotPool,
    grantTemporarySpellSlot,
    consumeTemporarySpellSlot,
    clearTemporarySpellSlots,
    createSpellSlot,
    convertSpellSlotToSorceryPoints,
    metamagicChoiceCount,
    getKnownMetamagics,
    setKnownMetamagics,
    charismaModifier,
    metamagicCost,
    applyMetamagic,
    castSorcererSpell,
    handleRest,
    grantIdentity,
    wrapCatalog,
    bindRestIntegration,
    install,
  });

  global.LuminousSorcererClassRuntime = api;
  install();
  if (!global.document && typeof queueMicrotask === "function") queueMicrotask(install);
  if (global.document && global.setInterval) {
    const timer = global.setInterval(install, 800);
    timer?.unref?.();
  }
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
