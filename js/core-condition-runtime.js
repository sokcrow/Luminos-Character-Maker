(function (global) {
  "use strict";

  if (global.LuminousConditionRuntime?.version === "0.7.3") {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousConditionRuntime;
    return;
  }

  const PATCH_INTERVAL_MS = 250;
  const normalizeId = (value) => String(value ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  const numberOr = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
  const statusEngine = () => global.LuminousStatusEngine || null;
  const elemental = () => global.LuminousElementalStatusRuntime || null;
  const exhaustion = () => global.LuminousExhaustionEngine || null;

  const ICONS = Object.freeze({
    blinded: "https://imgur.com/ZFpviIn.png",
    charmed: "https://imgur.com/3KhkLcm.png",
    deafened: "https://imgur.com/QwqqQd2.png",
    frightened: "https://imgur.com/cKs7hB0.png",
    grappling: "https://imgur.com/FiKy3ea.png",
    grappled: "https://imgur.com/FiKy3ea.png",
    restrained: "https://imgur.com/YjsjaQX.png",
    incapacitated: "https://limbuscompany.wiki.gg/images/Immobilized.png?50bc49=&format=original",
    invisible: "https://imgur.com/Vn90820.png",
    paralyzed: "https://imgur.com/BqchBbA.png",
    petrified: "https://imgur.com/TqLvGlK.png",
    prone: "https://imgur.com/OAQzop8.png",
    sleep: "https://imgur.com/CWT37Mq.png",
    exhaustion: "https://imgur.com/vO8CczE.png",
    confusion: "https://imgur.com/eadmX77.png",
  });

  const DEFINITIONS = Object.freeze({
    blinded: Object.freeze({ name: "Blinded", type: "negative", mode: "zero", icon: ICONS.blinded, rules: [], description: "Analyse Checks automatically fail. Affected Perception Checks gain +99 Threshold. -5 Clash Power. Ally healing/support targeting requires Perception Threshold 18. Repeat the stored removal Save at Turn End." }),
    charmed: Object.freeze({ name: "Charmed", type: "negative", mode: "single", icon: ICONS.charmed, rules: [], description: "Can't target or damage the Charmer. The Charmer gains +5 Final Power on Charisma Checks against this Unit. Non-Magic Charmed loses 1 Count at Turn End; Magic lasts while the source maintains Concentration." }),
    deafened: Object.freeze({ name: "Deafened", type: "negative", mode: "zero", icon: ICONS.deafened, rules: [], description: "Reserved for the 0.7.4 mechanics pass." }),
    frightened: Object.freeze({ name: "Frightened", type: "negative", mode: "single", defaultCount: 5, icon: ICONS.frightened, rules: [], description: "Can't target the source. -2 Clash Power. At Turn End lose 5 SP and 1 Count. At 0 Count execute the source outcome: Retreat or Escape. Calm uses CHA against the stored Threshold." }),
    grappling: Object.freeze({ name: "Grappling", type: "neutral", mode: "zero", icon: ICONS.grappling, rules: [], description: "Maintaining a Grapple with the linked Unit. The Grapple Action is reserved automatically while the hold remains." }),
    grappled: Object.freeze({ name: "Grappled", type: "negative", mode: "zero", icon: ICONS.grappled, rules: [], description: "Held by the linked Grappler. Uses the dedicated Grapple action-economy rules; this is not Restrained." }),
    restrained: Object.freeze({ name: "Restrained", type: "negative", mode: "single", icon: ICONS.restrained, rules: [], description: "Speed is set to 1. -1 Clash Power and -2 Evasion Power per Count. DEX Saves gain +1 Threshold every 2 Count. Only Liberate removes this effect." }),
    incapacitated: Object.freeze({ name: "Incapacitated", type: "negative", mode: "zero", icon: ICONS.incapacitated, rules: [], description: "Can't use Actions, Quick Actions, Reactions, or Universal Actions. Remains until its source removal trigger." }),
    invisible: Object.freeze({ name: "Invisible", type: "positive", mode: "zero", icon: ICONS.invisible, rules: [], description: "Undetected Units can't target this Unit with ATK Weight 3 or lower. Gain +5 Final Power and +5 Defense Power. Each Round observers first make Arcana to notice a hidden presence; Find then uses Perception to locate it. Removal depends on the source." }),
    paralyzed: Object.freeze({ name: "Paralyzed", type: "negative", mode: "zero", icon: ICONS.paralyzed, rules: [], description: "Action Slots are blocked. Speed is 1. Automatically fail STR/DEX Saves. Take +10% Damage. Attackers with Poise automatically Crit without consuming Poise. Normal repeats its stored Save at Turn End; Ephemeral uses Count; Magic lasts by Concentration." }),
    petrified: Object.freeze({ name: "Petrified", type: "negative", mode: "zero", icon: ICONS.petrified, rules: [], description: "Speed is 1 and Actions/Quick Actions/Reactions are blocked. At Turn Start gain 5 Protection. Immune to Poison and Poison damage. Applied/removed only by Magic or Items." }),
    prone: Object.freeze({ name: "Prone", type: "negative", mode: "zero", icon: ICONS.prone, rules: [], description: "Speed is locked to 1 for this Turn. -15 Evasion Power and -15 Counter Power. Attack Skills targeting this Unit gain +2 Final Power. Remove at Turn Start after locking Speed." }),
    sleep: Object.freeze({ name: "Sleep", type: "negative", mode: "zero", icon: ICONS.sleep, rules: [], description: "Speed is 1. SP resets to 0. Take triple SP Damage and +15% Damage from the next Attack. Automatically fail STR/DEX Checks. Immediately lose all Spell Concentration. Taking Damage removes Sleep. Magic lasts by Concentration; Ephemeral uses Count." }),
    confusion: Object.freeze({ name: "Confusion", type: "negative", mode: "zero", icon: ICONS.confusion, rules: [], description: "Can't use Quick Actions or Reactions. At Turn Start: 60% no Actions and Speed 1; 20% Skills/Actions become Indiscriminate with random targets; 20% no extra effect. At Turn End repeat the stored WIS Save; pass removes it." }),
  });

  const FIXED_SPEED = Object.freeze(["grappled", "paralyzed", "petrified", "prone", "restrained", "sleep"]);
  const concentrationState = new Map();

  function emit(name, detail) {
    try { if (typeof global.dispatchEvent === "function" && typeof global.CustomEvent === "function") global.dispatchEvent(new global.CustomEvent(name, { detail })); } catch (_) {}
    return detail;
  }

  function installRegistry() {
    if (!global.STATUS_REGISTRY || typeof global.STATUS_REGISTRY !== "object") global.STATUS_REGISTRY = {};
    Object.entries(DEFINITIONS).forEach(([id, definition]) => { global.STATUS_REGISTRY[id] = { id, ...clone(definition) }; });
    return global.STATUS_REGISTRY;
  }
  function getDefinition(id) { const key = normalizeId(id); return DEFINITIONS[key] ? { id: key, ...clone(DEFINITIONS[key]) } : null; }

  function unitIds(unit = {}) {
    return [unit.combatId, unit.combat_id, unit.id, unit.unitId, unit.unit_id, unit.characterId, unit.character_id, unit.playerId, unit.player_id, unit.actorId, unit.actor_id, unit.uid, unit.vinculo_jugador]
      .filter((v) => v != null && String(v).trim()).map((v) => String(v).trim());
  }
  function primaryUnitId(unit = {}) { return unitIds(unit)[0] || normalizeId(unit.characterName || unit.character_name || unit.nombre || unit.name) || null; }
  function sameUnit(a, b) {
    if (!a || !b) return false;
    if (a === b) return true;
    const ids = new Set(unitIds(a));
    if (unitIds(b).some((id) => ids.has(id))) return true;
    return normalizeId(a.name || a.characterName) && normalizeId(a.name || a.characterName) === normalizeId(b.name || b.characterName);
  }

  function has(unit, id) { return Boolean(statusEngine()?.hasStatus?.(unit, id) || unit?.statusEffects?.[normalizeId(id)]); }
  function status(unit, id) { return statusEngine()?.getStatus?.(unit, id) || clone(unit?.statusEffects?.[normalizeId(id)] || null); }
  function statusSourceMatches(entry, source) {
    if (!entry || !source) return false;
    const id = String(entry.sourceUnitId || entry.data?.sourceUnitId || "").trim();
    return Boolean(id && unitIds(source).includes(id));
  }

  function normalizeSourceType(input = {}) { return normalizeId(input.sourceType || input.source_type || input.data?.sourceType || input.data?.source_type || "normal"); }
  function normalizeRemovalMode(input = {}) { return normalizeId(input.removalMode || input.removal_mode || input.data?.removalMode || input.data?.removal_mode || input.durationMode || input.duration_mode || "trigger"); }

  function immunityLists(unit = {}) {
    return {
      all: new Set((unit.conditionImmunities || unit.condition_immunities || []).map(normalizeId)),
      source: Array.isArray(unit.conditionSourceImmunities || unit.condition_source_immunities) ? (unit.conditionSourceImmunities || unit.condition_source_immunities) : [],
      sources: new Set((unit.sourceImmunities || unit.source_immunities || []).map(normalizeId)),
    };
  }
  function canApplyStatus(unit, statusId, input = {}) {
    const id = normalizeId(statusId);
    const sourceType = normalizeSourceType(input);
    const immunities = immunityLists(unit);
    if (immunities.all.has(id)) return { allowed: false, reason: "condition_immunity", statusId: id, sourceType };
    if (sourceType && immunities.sources.has(sourceType)) return { allowed: false, reason: "condition_source_immunity", statusId: id, sourceType };
    const pairBlocked = immunities.source.some((entry) => normalizeId(entry?.condition || entry?.status || entry?.id) === id && normalizeId(entry?.source || entry?.sourceType || entry?.source_type) === sourceType);
    if (pairBlocked) return { allowed: false, reason: "condition_source_pair_immunity", statusId: id, sourceType };
    if (id === "petrified" && !["magic", "item"].includes(sourceType)) return { allowed: false, reason: "petrified_requires_magic_or_item", statusId: id, sourceType };
    if (id === "poison" && has(unit, "petrified")) return { allowed: false, reason: "petrified_poison_immunity", statusId: id, sourceType };
    return { allowed: true, reason: null, statusId: id, sourceType };
  }

  function applyCondition(unit, statusId, input = {}) {
    const id = normalizeId(statusId);
    const gate = canApplyStatus(unit, id, input);
    if (!gate.allowed) { emit("luminous:condition-immune", { unit, statusId: id, input, gate }); return null; }
    const data = {
      ...(input.data || {}),
      sourceType: normalizeSourceType(input),
      removalMode: normalizeRemovalMode(input),
      saveAbility: normalizeId(input.saveAbility || input.data?.saveAbility || ""),
      saveThreshold: Number.isFinite(Number(input.saveThreshold ?? input.threshold ?? input.data?.saveThreshold)) ? Number(input.saveThreshold ?? input.threshold ?? input.data?.saveThreshold) : null,
      concentrationId: input.concentrationId || input.data?.concentrationId || null,
      removeTrigger: input.removeTrigger || input.data?.removeTrigger || null,
      frightenedOutcome: normalizeId(input.frightenedOutcome || input.data?.frightenedOutcome || (numberOr(input.count, 5) >= 10 ? "escape" : "retreat")),
    };
    const entry = statusEngine()?.applyStatus?.(unit, id, { ...input, data, sourceUnitId: input.sourceUnitId || data.sourceUnitId || null });
    if (id === "sleep" && entry) {
      writeSp(unit, 0);
      loseConcentration(unit, { reason: "sleep" });
      if (entry.data) entry.data.nextAttackBonusAvailable = true;
    }
    return entry;
  }

  function readSp(unit = {}) {
    const value = [unit.sp, unit.currentSp, unit.currentSP, unit.sp_actual, unit.combatStats?.sp_actual].find((v) => Number.isFinite(Number(v)));
    return value == null ? 0 : Number(value);
  }
  function writeSp(unit, value) {
    const next = Math.max(-45, Math.min(45, Math.floor(numberOr(value, 0))));
    if (Object.prototype.hasOwnProperty.call(unit, "sp")) unit.sp = next;
    else if (Object.prototype.hasOwnProperty.call(unit, "currentSp")) unit.currentSp = next;
    else unit.sp = next;
    return next;
  }

  function actionAvailability(unit, cost, options = {}) {
    const id = normalizeId(cost);
    const blockedAll = has(unit, "incapacitated") || has(unit, "paralyzed") || has(unit, "petrified");
    if (blockedAll && (options.universalAction === true || ["action", "quick_action", "reaction"].includes(id))) return { available: false, reason: `${has(unit, "incapacitated") ? "incapacitated" : has(unit, "paralyzed") ? "paralyzed" : "petrified"}_${id}` };
    const confusion = status(unit, "confusion");
    if (confusion && ["quick_action", "reaction"].includes(id)) return { available: false, reason: `confusion_${id}` };
    if (confusion?.data?.turnMode === "locked" && id === "action") return { available: false, reason: "confusion_locked_action" };
    if (id === "action" && has(unit, "grappled") && !global.LuminousTeamActionEconomy) return { available: false, reason: "grappled_action_reserved" };
    return { available: true, reason: null };
  }
  function canUseUniversalAction(unit, options = {}) { return actionAvailability(unit, options.cost || "action", { ...options, universalAction: true }); }

  function skillFamily(skill = {}) { return normalizeId(skill.skillFamily || skill.skill_family || skill.type || "attack"); }
  function isHarmfulSkill(skill = {}) { return skill.harmful === true || skill.isHarmful === true || skill.dealsDamage === true || ["attack", "normal", "melee", "ranged", "damage", "harmful"].includes(skillFamily(skill)); }
  function attackWeight(skill = {}) { return Math.max(1, Math.floor(numberOr(skill.attackWeight ?? skill.attack_weight ?? skill.weight, 1))); }

  function observerKey(unit) { return primaryUnitId(unit) || String(unit?.name || "unknown"); }
  function invisibilityDetection(entry) {
    if (!entry?.data) return {};
    if (!entry.data.detectedBy || typeof entry.data.detectedBy !== "object") entry.data.detectedBy = {};
    return entry.data.detectedBy;
  }
  function hasLocatedInvisible(observer, invisibleUnit) {
    const entry = status(invisibleUnit, "invisible");
    return Boolean(entry?.data?.detectedBy?.[observerKey(observer)]?.located);
  }
  function hasNoticedInvisible(observer, invisibleUnit) {
    const entry = status(invisibleUnit, "invisible");
    return Boolean(entry?.data?.detectedBy?.[observerKey(observer)]?.noticed);
  }
  function markInvisibleNotice(observer, invisibleUnit, noticed = true) {
    const raw = invisibleUnit?.statusEffects?.invisible;
    if (!raw) return false;
    if (!raw.data) raw.data = {};
    if (!raw.data.detectedBy) raw.data.detectedBy = {};
    const key = observerKey(observer);
    raw.data.detectedBy[key] = { ...(raw.data.detectedBy[key] || {}), noticed: Boolean(noticed) };
    return true;
  }
  function markInvisibleLocated(observer, invisibleUnit, located = true) {
    const raw = invisibleUnit?.statusEffects?.invisible;
    if (!raw) return false;
    if (!raw.data) raw.data = {};
    if (!raw.data.detectedBy) raw.data.detectedBy = {};
    const key = observerKey(observer);
    raw.data.detectedBy[key] = { ...(raw.data.detectedBy[key] || {}), noticed: true, located: Boolean(located) };
    return true;
  }

  function canTarget(unit, target, skill = {}, options = {}) {
    if (!unit || !target) return { allowed: true, reason: null };
    const charmed = status(unit, "charmed");
    if (charmed && statusSourceMatches(charmed, target)) return { allowed: false, reason: "charmed_source_untargetable" };
    const frightened = status(unit, "frightened");
    if (frightened && statusSourceMatches(frightened, target)) return { allowed: false, reason: "frightened_source_untargetable" };
    if (has(target, "invisible") && attackWeight(skill) <= 3 && options.ignoreInvisible !== true && !hasLocatedInvisible(unit, target)) return { allowed: false, reason: "invisible_not_located" };
    return { allowed: true, reason: null };
  }

  function checkKind(check = {}) { return normalizeId(check.kind || check.checkType || check.type || (check.skillId ? "skill" : "ability")); }
  function checkAbility(check = {}) { return normalizeId(check.abilityId || check.ability || check.stat || ""); }
  function automaticCheckFailure(unit, check = {}) {
    const kind = checkKind(check); const ability = checkAbility(check); const skill = normalizeId(check.skillId || check.skill || "");
    if (has(unit, "blinded") && skill === "analyse") return { failed: true, reason: "blinded_analyse" };
    if (has(unit, "paralyzed") && ["save", "saving_throw", "savingthrow"].includes(kind) && ["str", "dex"].includes(ability)) return { failed: true, reason: "paralyzed_auto_fail_save" };
    if (has(unit, "sleep") && ["ability", "ability_check", "skill", "skill_check", "check"].includes(kind) && ["str", "dex"].includes(ability)) return { failed: true, reason: "sleep_auto_fail_check" };
    return { failed: false, reason: null };
  }

  function thresholdModifier(unit, check = {}, options = {}) {
    let value = exhaustion()?.thresholdModifier?.(unit, check) || 0;
    const kind = checkKind(check); const skill = normalizeId(check.skillId || check.skill || ""); const ability = checkAbility(check);
    if (has(unit, "blinded") && skill === "perception") value += 99;
    value += elemental()?.poisonCheckThresholdPenalty?.(unit) || 0;
    if (has(unit, "restrained") && ["save", "saving_throw", "savingthrow"].includes(kind) && ability === "dex") value += Math.floor(numberOr(status(unit, "restrained")?.count, 0) / 2);
    return value;
  }
  function checkFinalPowerModifier(unit, check = {}, options = {}) {
    let value = 0;
    const target = options.target || check.target || null;
    const targetCharmed = target ? status(target, "charmed") : null;
    if (targetCharmed && statusSourceMatches(targetCharmed, unit) && checkAbility(check) === "cha") value += 5;
    return value;
  }
  function applyCheckThreshold(unit, check = {}, options = {}) {
    const modifier = thresholdModifier(unit, check, options);
    if (modifier) {
      if (Number.isFinite(Number(check.difficulty))) check.difficulty = Number(check.difficulty) + modifier;
      else if (Number.isFinite(Number(check.thresholdRaw))) check.thresholdRaw = Number(check.thresholdRaw) + modifier;
      else if (Number.isFinite(Number(check.threshold))) check.threshold = Number(check.threshold) + modifier;
      else check.conditionThresholdModifier = numberOr(check.conditionThresholdModifier, 0) + modifier;
    }
    return { check, modifier, finalPowerModifier: checkFinalPowerModifier(unit, check, options), automaticFailure: automaticCheckFailure(unit, check) };
  }

  function emptyModifiers() { return { final_power: 0, defense_power: 0, clash_power: 0, counter_power: 0, evade_power: 0, min_speed: 0, max_speed: 0, speed: 0, damage_taken_percent: 0, sp_damage_taken_multiplier: 1 }; }
  function contextualModifiers(options = {}) {
    const unit = options.unit || options.character || {}; const target = options.target || null; const out = emptyModifiers();
    if (has(unit, "blinded")) out.clash_power -= 5;
    if (has(unit, "frightened")) out.clash_power -= 2;
    const restrained = numberOr(status(unit, "restrained")?.count, 0);
    if (restrained > 0) { out.clash_power -= restrained; out.evade_power -= restrained * 2; }
    if (has(unit, "prone")) { out.evade_power -= 15; out.counter_power -= 15; }
    if (has(unit, "invisible")) { out.final_power += 5; out.defense_power += 5; }
    if (has(unit, "paralyzed")) out.damage_taken_percent += 10;
    if (has(unit, "sleep")) out.sp_damage_taken_multiplier *= 3;
    if (target && has(target, "prone") && isHarmfulSkill(options.skill || {})) out.final_power += 2;
    out.clash_power -= elemental()?.poisonClashPenalty?.(unit) || 0;
    const fatigue = exhaustion()?.combatModifiers?.(unit) || {};
    out.clash_power += numberOr(fatigue.clash_power, 0); out.max_speed += numberOr(fatigue.max_speed, 0);
    return out;
  }
  function fixedSpeedFor(unit) {
    if (Number(unit?.conditionSpeedLockThisTurn) === 1) return 1;
    return FIXED_SPEED.some((id) => has(unit, id)) ? 1 : (exhaustion()?.fixedSpeed?.(unit) ?? null);
  }

  function concentrationKey(unit) { return primaryUnitId(unit) || String(unit?.name || "unknown"); }
  function startConcentration(unit, options = {}) {
    const key = concentrationKey(unit); const id = String(options.concentrationId || `concentration_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);
    concentrationState.set(key, { id, sourceUnitId: primaryUnitId(unit), damageThisRound: 0, active: true, source: options.source || null });
    unit.concentration = { id, active: true, source: options.source || null };
    return unit.concentration;
  }
  function getConcentration(unit) { return concentrationState.get(concentrationKey(unit)) || (unit?.concentration?.active ? unit.concentration : null); }
  function recordConcentrationDamage(unit, damage) {
    const state = getConcentration(unit); if (!state?.active) return 0;
    state.damageThisRound = numberOr(state.damageThisRound, 0) + Math.max(0, numberOr(damage, 0));
    concentrationState.set(concentrationKey(unit), state); return state.damageThisRound;
  }
  function concentrationThreshold(unit) { const state = getConcentration(unit); return state?.active ? 8 + Math.floor(Math.max(0, numberOr(state.damageThisRound, 0)) * 0.15) : null; }
  function linkedMagicEntries(units, concentration) {
    const id = concentration?.id; const sourceId = concentration?.sourceUnitId;
    const found = [];
    (units || []).forEach((unit) => Object.entries(unit?.statusEffects || {}).forEach(([statusId, entry]) => {
      if (!entry || typeof entry !== "object") return;
      const data = entry.data || {};
      if (normalizeId(data.sourceType) !== "magic") return;
      if (normalizeId(data.removalMode) !== "concentration") return;
      if ((id && data.concentrationId === id) || (sourceId && String(entry.sourceUnitId || data.sourceUnitId || "") === String(sourceId))) found.push({ unit, statusId, entry });
    }));
    return found;
  }
  function loseConcentration(unit, options = {}) {
    const state = getConcentration(unit); if (!state?.active) return { lost: false, removed: [] };
    state.active = false; concentrationState.set(concentrationKey(unit), state);
    if (unit.concentration) unit.concentration.active = false;
    const units = options.units || Object.values(global.combatData || {});
    const removed = [];
    linkedMagicEntries(units, state).forEach(({ unit: target, statusId }) => {
      const result = statusEngine()?.removeStatus?.(target, statusId, { from: "concentration", ignoreProtection: true });
      if (result?.removed !== false) removed.push({ unit: target, statusId });
    });
    emit("luminous:concentration-lost", { unit, state, removed, reason: options.reason || "failed_check" });
    return { lost: true, state, removed };
  }
  function resetConcentrationRoundDamage(unit) { const state = getConcentration(unit); if (!state) return 0; const previous = numberOr(state.damageThisRound, 0); state.damageThisRound = 0; concentrationState.set(concentrationKey(unit), state); return previous; }

  function storedSaveRequest(unit, statusId, entry) {
    const data = entry?.data || {}; const threshold = Number(data.saveThreshold);
    if (!Number.isFinite(threshold)) return null;
    return { type: "save_check", statusId, unit, sourceUnitId: entry.sourceUnitId || data.sourceUnitId || null, check: { kind: "save", abilityId: normalizeId(data.saveAbility || "wis"), threshold, source: statusId } };
  }

  function retreatOrEscape(unit, mode, reason) {
    const kind = normalizeId(mode || "retreat");
    unit.actionQueue = [];
    if (kind === "escape") { unit.lifeState = "escaped"; unit.escaped = true; unit.removed = true; unit.noEncounterXp = true; }
    else { unit.lifeState = "retreated"; unit.isRetreated = true; unit.isBackup = true; }
    emit(kind === "escape" ? "luminous:condition-escape" : "luminous:condition-retreat", { unit, reason });
    return kind;
  }

  function turnStart(unit, options = {}) {
    const out = [];
    unit.conditionSpeedLockThisTurn = null;
    if (has(unit, "petrified")) {
      const applied = statusEngine()?.applyStatus?.(unit, "protection", { mode: "gain", count: 5, data: { sourceCondition: "petrified" } });
      out.push({ type: "gain_status", statusId: "protection", count: 5, status: applied });
    }
    if (has(unit, "prone")) {
      unit.conditionSpeedLockThisTurn = 1;
      const removed = statusEngine()?.removeStatus?.(unit, "prone", { from: "self", ignoreProtection: true });
      out.push({ type: "prone_speed_lock", speed: 1, removed: Boolean(removed?.removed) });
    }
    const confusion = unit?.statusEffects?.confusion;
    if (confusion) {
      if (!confusion.data) confusion.data = {};
      const roll = Math.max(0, Math.min(0.999999, Number((options.random || Math.random)())));
      confusion.data.turnMode = roll < 0.60 ? "locked" : roll < 0.80 ? "indiscriminate" : "none";
      if (confusion.data.turnMode === "locked") unit.conditionSpeedLockThisTurn = 1;
      out.push({ type: "confusion_turn_mode", mode: confusion.data.turnMode, roll });
    }
    if (has(unit, "invisible")) {
      const entry = status(unit, "invisible");
      const threshold = Number(entry?.data?.detectionThreshold ?? entry?.data?.stealthThreshold ?? entry?.data?.saveThreshold);
      (options.units || options.combatants || []).filter((observer) => observer && !sameUnit(observer, unit)).forEach((observer) => {
        out.push({ type: "invisible_arcana_notice", statusId: "invisible", invisibleUnit: unit, observer, check: { kind: "skill", abilityId: "int", skillId: "arcana", threshold }, threshold });
      });
    }
    return out;
  }

  function turnEnd(unit, options = {}) {
    const out = []; const resolveCheck = typeof options.resolveCheck === "function" ? options.resolveCheck : null;
    for (const id of ["blinded", "paralyzed", "confusion"]) {
      const entry = status(unit, id); if (!entry) continue;
      const mode = normalizeId(entry.data?.removalMode || "save");
      if (mode === "concentration" || mode === "ephemeral" || mode === "trigger") continue;
      const request = storedSaveRequest(unit, id, entry); if (!request) continue;
      const result = resolveCheck ? resolveCheck(request) : null; request.result = result;
      if (result?.passed === true || result === true) statusEngine()?.removeStatus?.(unit, id, { from: "self", ignoreProtection: true });
      else if (!resolveCheck) emit("luminous:condition-check-requested", request);
      out.push(request);
    }

    const charmed = unit?.statusEffects?.charmed;
    if (charmed && normalizeId(charmed.data?.removalMode) !== "concentration") {
      charmed.count = Math.max(0, numberOr(charmed.count, 1) - 1);
      if (charmed.count <= 0) statusEngine()?.removeStatus?.(unit, "charmed", { from: "duration", ignoreProtection: true });
      out.push({ type: "count_decay", statusId: "charmed", count: Math.max(0, numberOr(charmed.count, 0)) });
    }
    const frightened = unit?.statusEffects?.frightened;
    if (frightened) {
      writeSp(unit, Math.max(0, readSp(unit) - 5));
      frightened.count = Math.max(0, numberOr(frightened.count, 5) - 1);
      out.push({ type: "frightened_decay", count: frightened.count, sp: readSp(unit) });
      if (frightened.count <= 0) {
        const outcome = normalizeId(frightened.data?.frightenedOutcome || "retreat");
        retreatOrEscape(unit, outcome, "frightened_count_0");
        statusEngine()?.removeStatus?.(unit, "frightened", { from: "self", ignoreProtection: true });
        out.push({ type: outcome, statusId: "frightened" });
      }
    }
    const sleep = unit?.statusEffects?.sleep;
    if (sleep && normalizeId(sleep.data?.removalMode) === "ephemeral") {
      sleep.count = Math.max(0, numberOr(sleep.count, 1) - 1);
      if (sleep.count <= 0) statusEngine()?.removeStatus?.(unit, "sleep", { from: "duration", ignoreProtection: true });
      out.push({ type: "count_decay", statusId: "sleep", count: Math.max(0, numberOr(sleep.count, 0)) });
    }

    const concentration = getConcentration(unit);
    if (concentration?.active) {
      const damage = numberOr(concentration.damageThisRound, 0);
      if (damage > 0) {
        const request = { type: "concentration_save", unit, check: { kind: "save", abilityId: "con", threshold: 8 + Math.floor(damage * 0.15), source: "concentration" }, damageThisRound: damage };
        const result = resolveCheck ? resolveCheck(request) : null; request.result = result;
        if (result?.passed === false || result === false) loseConcentration(unit, { units: options.units || options.combatants, reason: "failed_con_save" });
        else if (!resolveCheck) emit("luminous:condition-check-requested", request);
        out.push(request);
      }
      resetConcentrationRoundDamage(unit);
    }
    return out;
  }

  function damageTakenMultiplier(unit) { return has(unit, "paralyzed") ? 1.10 : 1; }
  function sleepNextAttackMultiplier(unit) {
    const entry = unit?.statusEffects?.sleep;
    return entry?.data?.nextAttackBonusAvailable ? 1.15 : 1;
  }
  function consumeSleepAttackBonus(unit) { const entry = unit?.statusEffects?.sleep; if (entry?.data) entry.data.nextAttackBonusAvailable = false; }
  function shouldAutoCrit(attacker, defender) { return has(defender, "paralyzed") && numberOr(attacker?.statusEffects?.poise?.count ?? attacker?.statusEffects?.poise, 0) > 0; }
  function autoCritConsumesPoise(attacker, defender) { return !shouldAutoCrit(attacker, defender); }
  function onDamageTaken(unit, amount, options = {}) {
    const damage = Math.max(0, numberOr(amount, 0));
    if (damage > 0) recordConcentrationDamage(unit, damage);
    if (damage > 0 && has(unit, "sleep")) statusEngine()?.removeStatus?.(unit, "sleep", { from: "damage", ignoreProtection: true });
    return damage;
  }

  function liberateThreshold(restrainedUnit, method, options = {}) {
    const count = Math.max(0, numberOr(status(restrainedUnit, "restrained")?.count, 0));
    const id = normalizeId(method);
    const base = ["sleight_of_hand", "sleight", "sleightofhand"].includes(id) ? 12 : 14;
    return Math.max(0, base + count + (options.self ? 4 : 0) - (options.inCombat === false ? 4 : 0));
  }
  function buildLiberateRequest(actor, target, method, options = {}) {
    const id = normalizeId(method); const self = sameUnit(actor, target);
    const skillId = ["sleight_of_hand", "sleight", "sleightofhand"].includes(id) ? "sleight_of_hand" : (id === "athletics" ? "athletics" : null);
    const abilityId = skillId === "sleight_of_hand" ? "dex" : "str";
    return { type: "liberate_check", actor, target, method: id, threshold: liberateThreshold(target, id, { self, inCombat: options.inCombat !== false }), check: { kind: skillId ? "skill" : "ability", abilityId, skillId, threshold: liberateThreshold(target, id, { self, inCombat: options.inCombat !== false }) } };
  }
  function buildCalmRequest(actor, target) {
    const entry = status(target, "frightened"); const threshold = Number(entry?.data?.saveThreshold);
    return { type: "calm_check", actor, target, threshold, check: { kind: "ability", abilityId: "cha", threshold } };
  }
  function buildFindRequest(actor, target) {
    const entry = status(target, "invisible"); const threshold = Number(entry?.data?.findThreshold ?? entry?.data?.stealthThreshold ?? entry?.data?.detectionThreshold);
    return { type: "find_check", actor, target, threshold, check: { kind: "skill", abilityId: "wis", skillId: "perception", threshold } };
  }
  function buildWakeUpAction(actor, target) { return { type: "wake_up", actor, target, resolvesAt: "turn_end" }; }

  function contextualActions(actor, units = [], options = {}) {
    const allies = (units || []).filter((u) => u && !sameUnit(u, actor) && normalizeId(u.faction || u.side || u.team) === normalizeId(actor?.faction || actor?.side || actor?.team));
    const actions = [];
    const frightened = allies.filter((u) => has(u, "frightened")); if (frightened.length) actions.push({ id: "calm", name: "Calm", iconSource: "help", targets: frightened });
    const sleeping = allies.filter((u) => has(u, "sleep")); if (sleeping.length) actions.push({ id: "wake_up", name: "Wake Up", iconSource: "help", targets: sleeping, resolvesAt: "turn_end" });
    const restrained = [actor, ...allies].filter((u) => has(u, "restrained")); if (restrained.length) actions.push({ id: "liberate", name: "Liberate", iconSource: "help", targets: restrained });
    const invisibles = (units || []).filter((u) => u && has(u, "invisible") && hasNoticedInvisible(actor, u) && !hasLocatedInvisible(actor, u)); if (invisibles.length) actions.push({ id: "find", name: "Find", iconSource: "analyse", economy: "free_action", targets: invisibles });
    return actions;
  }

  function encounterForOptions(options = {}) {
    return options.encounter || options.combatEncounter || global.LuminousCombatEncounter || global.currentCombatEncounter || null;
  }
  function reserveGrappleSlot(unit, options = {}) {
    const economy = global.LuminousTeamActionEconomy;
    const encounter = encounterForOptions(options);
    if (!economy?.lockUnitSlots || !encounter || !unit) return { reserved: false, reason: "team_economy_unavailable" };
    const result = economy.lockUnitSlots(encounter, unit, 1, "grapple");
    return { reserved: Boolean(result?.locked), result, encounter };
  }
  function releaseGrappleSlot(unit, options = {}) {
    const economy = global.LuminousTeamActionEconomy;
    const encounter = encounterForOptions(options);
    if (!economy?.unlockUnitSlots || !encounter || !unit) return false;
    return economy.unlockUnitSlots(encounter, unit, 1);
  }

  function breakGrapple(unit, options = {}) {
    const linked = status(unit, "grappling") || status(unit, "grappled"); if (!linked) return [];
    const grappleId = linked.data?.grappleId; const units = options.units || options.combatants || Object.values(global.combatData || {}); const removed = [];
    (units || []).forEach((candidate) => ["grappling", "grappled"].forEach((id) => {
      const entry = status(candidate, id); if (!entry || (grappleId && entry.data?.grappleId !== grappleId)) return;
      const result = statusEngine()?.removeStatus?.(candidate, id, { from: "self", ignoreProtection: true });
      if (result?.removed !== false) {
        releaseGrappleSlot(candidate, options);
        removed.push({ candidate, id });
      }
    }));
    emit("luminous:grapple-broken", { unit, grappleId, removed }); return removed;
  }
  function grapple(unitA, unitB, options = {}) {
    if (!unitA || !unitB || sameUnit(unitA, unitB)) return { applied: false, reason: "invalid_units" };
    const request = { type: "grapple_clash", initiator: unitA, rival: unitB, initiatorCheck: { kind: "skill", abilityId: "str", skillId: "athletics", coinAmount: 5, coinPower: 4 }, rivalChecks: [{ kind: "skill", abilityId: "str", skillId: "athletics", coinAmount: 5, coinPower: 4 }, { kind: "skill", abilityId: "dex", skillId: "acrobatics", coinAmount: 5, coinPower: 4 }] };
    const result = typeof options.resolveOpposedCheck === "function" ? options.resolveOpposedCheck(request) : null;
    if (!result) return { applied: false, pending: true, request };
    const attackerWon = result.attackerWon === true || result.passed === true || numberOr(result.unitATotal, -Infinity) > numberOr(result.unitBTotal, Infinity);
    if (!attackerWon) return { applied: false, resisted: true, request, result };
    const grappleId = `grapple_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`; const aId = primaryUnitId(unitA); const bId = primaryUnitId(unitB);
    const aReservation = reserveGrappleSlot(unitA, options);
    const bReservation = reserveGrappleSlot(unitB, options);
    const a = applyCondition(unitA, "grappling", { mode: "set", sourceUnitId: aId, data: { grappleId, partnerUnitId: bId, role: "grappler", reservedAction: "grapple", slotReserved: aReservation.reserved } });
    const b = applyCondition(unitB, "grappled", { mode: "set", sourceUnitId: aId, data: { grappleId, partnerUnitId: aId, role: "held", reservedAction: "break_free", slotReserved: bReservation.reserved } });
    emit("luminous:grapple-applied", { unitA, unitB, grappleId, reservations: { grappler: aReservation, held: bReservation } });
    return { applied: true, grappleId, unitA: a, unitB: b, request, result, reservations: { grappler: aReservation, held: bReservation } };
  }

  function installModifierBridge() {
    const source = global.LuminousUniversalModifiers;
    if (!source || source.__luminousConditions073) return Boolean(source);
    const wrapped = { ...source, __luminousConditions073: true };
    if (typeof source.resolveCharacterSnapshot === "function") {
      wrapped.resolveCharacterSnapshot = function (options = {}) {
        const base = source.resolveCharacterSnapshot.call(source, options); const extra = contextualModifiers(options);
        const modifiers = { ...(base?.modifiers || {}) };
        Object.entries(extra).forEach(([k, v]) => { if (typeof v === "number") modifiers[k] = numberOr(modifiers[k], k === "sp_damage_taken_multiplier" ? 1 : 0) + (k === "sp_damage_taken_multiplier" ? v - 1 : v); });
        return { ...base, modifiers };
      };
    }
    global.LuminousUniversalModifiers = Object.freeze(wrapped); return true;
  }

  function install() { installRegistry(); installModifierBridge(); return true; }

  const api = Object.freeze({
    version: "0.7.3", ICONS, DEFINITIONS, FIXED_SPEED,
    installRegistry, getDefinition, canApplyStatus, applyCondition, hasStatus: has, getStatus: status, sameUnit, statusSourceMatches,
    actionAvailability, canUseUniversalAction, canTarget, automaticCheckFailure, thresholdModifier, checkFinalPowerModifier, applyCheckThreshold,
    contextualModifiers, fixedSpeedFor, damageTakenMultiplier, sleepNextAttackMultiplier, consumeSleepAttackBonus, shouldAutoCrit, autoCritConsumesPoise, onDamageTaken,
    startConcentration, getConcentration, recordConcentrationDamage, concentrationThreshold, loseConcentration, resetConcentrationRoundDamage,
    hasNoticedInvisible, hasLocatedInvisible, markInvisibleNotice, markInvisibleLocated,
    turnStart, turnEnd, liberateThreshold, buildLiberateRequest, buildCalmRequest, buildFindRequest, buildWakeUpAction, contextualActions,
    encounterForOptions, reserveGrappleSlot, releaseGrappleSlot, breakGrapple, grapple, installModifierBridge, install,
  });

  global.LuminousConditionRuntime = api;
  install();
  const timer = typeof global.setInterval === "function" ? global.setInterval(install, PATCH_INTERVAL_MS) : null;
  timer?.unref?.();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
