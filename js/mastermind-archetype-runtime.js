(function (global) {
  "use strict";

  if (global.LuminousMastermindArchetypeRuntime) return;

  const ARCHETYPE_ID = "mastermind";
  const ARCHETYPE_NAME = "Mastermind";
  const CLASS_ID = "rogue";
  const CLASS_NAME = "Rogue";
  const PATCH_INTERVAL_MS = 500;
  const normalizeId = (value) => String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  const numberOr = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const intOr = (value, fallback = 0) => Number.isFinite(Number.parseInt(value, 10)) ? Number.parseInt(value, 10) : fallback;
  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
  const asArray = (value) => value == null ? [] : (Array.isArray(value) ? value : [value]);

  const ARCHETYPE = Object.freeze({
    id: ARCHETYPE_ID,
    name: ARCHETYPE_NAME,
    classId: CLASS_ID,
    className: CLASS_NAME,
    unlockLevel: 15,
    traitLevels: [15, 45, 65, 85],
  });

  const SOURCE = Object.freeze({
    type: "archetype",
    id: ARCHETYPE_ID,
    archetypeId: ARCHETYPE_ID,
    archetypeName: ARCHETYPE_NAME,
    classId: CLASS_ID,
    className: CLASS_NAME,
  });

  const DEFINITIONS = Object.freeze({
    master_of_intrigue: Object.freeze({
      schemaVersion: 1,
      id: "master_of_intrigue",
      name: "Master of Intrigue",
      description: "You gain proficiency with the Disguise Kit, Forgery Kit, and one Gaming Set of your choice. You learn two additional languages. After listening to a creature speak for at least 1 minute, you can mimic its speech patterns, accent, and mannerisms well enough to pass yourself off as a native speaker of the same region or background.",
      source: SOURCE,
      contexts: ["theatre", "any"],
      activation: { type: "passive", actionCost: "none" },
      effects: [], rules: [],
      mechanics: { narrative: true, languageChoices: 2, toolProficiencies: ["disguise_kit", "forgery_kit"], gamingSetChoices: 1, mimicSpeechAfterMinutes: 1 },
    }),
    master_of_tactics: Object.freeze({
      schemaVersion: 1,
      id: "master_of_tactics",
      name: "Master of Tactics",
      description: "You use Help as a Quick Action. Your Help gives +1 additional Final Power; if used on a slower ally, +2 instead; if used on the slowest ally, +3 instead.",
      source: SOURCE,
      contexts: ["combat"],
      activation: { type: "passive", actionCost: "none" },
      effects: [], rules: [],
      mechanics: { helpActionCost: "quick_action", additionalHelpFinalPower: 1, slowerAllyAdditionalHelpFinalPower: 2, slowestAllyAdditionalHelpFinalPower: 3 },
    }),
    insightful_manipulator: Object.freeze({
      schemaVersion: 1,
      id: "insightful_manipulator",
      name: "Insightful Manipulator",
      description: "After observing or interacting with a creature for at least 1 minute outside of combat, you can assess its behavior and capabilities. You may determine whether selected mental or social attributes, or its overall experience, appear superior, equal, or inferior to your own. The DM may also reveal additional details about the creature's personality, habits, or background.",
      source: SOURCE,
      contexts: ["theatre", "any"],
      activation: { type: "passive", actionCost: "none" },
      effects: [], rules: [],
      mechanics: { narrative: true, observationMinutes: 1 },
    }),
    misdirection: Object.freeze({
      schemaVersion: 1,
      id: "misdirection",
      name: "Misdirection",
      description: "When you use Help on an ally, that ally applies 1 Assist Guard. Assist Guard - [Unit Name]: when [Unit Name] is targeted by an Unopposed Attack, redirect the attack and force a Clash using an available Skill you haven't used or selected. Consume 1 Count.",
      source: SOURCE,
      contexts: ["combat"],
      activation: { type: "passive", actionCost: "none" },
      effects: [], rules: [],
      mechanics: { onHelpApplyStatus: "assist_guard_[unit_name]", count: 1, intercepts: "unopposed_attack", consumesCount: 1, iconPending: true },
    }),
    soul_of_deceit: Object.freeze({
      schemaVersion: 1,
      id: "soul_of_deceit",
      name: "Soul of Deceit",
      description: "Your thoughts cannot be read unless you allow it. When a creature attempts to read your mind, you may present false thoughts instead. Effects that attempt to determine whether you are speaking truthfully treat you as truthful if you choose.",
      source: SOURCE,
      contexts: ["theatre", "any"],
      activation: { type: "passive", actionCost: "none" },
      effects: [], rules: [],
      mechanics: { narrative: true, mindReadingRequiresConsent: true, canPresentFalseThoughts: true, mayAppearTruthful: true },
    }),
  });

  const grant = (level, traitId) => Object.freeze({
    sourceType: "archetype",
    sourceId: ARCHETYPE_ID,
    archetypeId: ARCHETYPE_ID,
    classId: CLASS_ID,
    atLevel: level,
    traitId,
    source: { ...SOURCE, atLevel: level, requiredClassLevel: level },
  });

  const GRANTS = Object.freeze([
    grant(15, "master_of_intrigue"),
    grant(15, "master_of_tactics"),
    grant(45, "insightful_manipulator"),
    grant(65, "misdirection"),
    grant(85, "soul_of_deceit"),
  ]);

  function identityValues(entity = {}) {
    return [
      entity.combatId, entity.combat_id, entity.unitId, entity.unit_id,
      entity.id, entity.playerId, entity.player_id, entity.characterId, entity.character_id,
      entity.actorId, entity.actor_id, entity.uid, entity.vinculo_jugador,
    ].filter((value) => value != null && String(value).trim() !== "").map((value) => String(value).trim());
  }

  function entityId(entity = {}) { return identityValues(entity)[0] || ""; }
  function entityName(entity = {}) { return String(entity.characterName || entity.character_name || entity.nombre || entity.name || "Unknown").trim() || "Unknown"; }
  function sameEntity(a, b) {
    if (!a || !b) return false;
    if (a === b) return true;
    const ids = new Set(identityValues(a));
    if (identityValues(b).some((id) => ids.has(id))) return true;
    return normalizeId(entityName(a)) === normalizeId(entityName(b));
  }

  function unitList(context = {}) {
    if (Array.isArray(context.units)) return context.units.filter(Boolean);
    return Object.values(context.combatData || {}).filter(Boolean);
  }

  function unitById(context = {}, id) {
    const wanted = String(id ?? "").trim();
    if (!wanted) return null;
    if (typeof context.getUnit === "function") {
      const direct = context.getUnit(wanted);
      if (direct) return direct;
    }
    return unitList(context).find((unit) => identityValues(unit).includes(wanted)) || null;
  }

  function normalizedCharacter(character = {}) {
    if (Array.isArray(character.classes)) return character;
    if (Array.isArray(character.characterBuild?.classes)) return { ...character, classes: character.characterBuild.classes };
    return character;
  }

  function rogueLevel(character = {}) {
    if (global.LuminousRogueClassRuntime?.rogueLevel) return Math.max(0, intOr(global.LuminousRogueClassRuntime.rogueLevel(character), 0));
    const engine = global.LuminousArchetypeEngine;
    if (engine?.getClassLevel) return Math.max(0, intOr(engine.getClassLevel(normalizedCharacter(character), CLASS_ID), 0));
    const classes = Array.isArray(character.classes) ? character.classes : Array.isArray(character.characterBuild?.classes) ? character.characterBuild.classes : [];
    const found = classes.find((entry) => normalizeId(entry?.classId || entry?.id || entry?.name) === CLASS_ID);
    return Math.max(0, intOr(found?.levels ?? found?.level, 0));
  }

  function selectedMastermind(character = {}) {
    const engine = global.LuminousArchetypeEngine;
    if (engine?.isSelected) return Boolean(engine.isSelected(character, ARCHETYPE_ID, CLASS_ID));
    const raw = character.characterBuild?.archetypes ?? character.archetypes ?? [];
    const list = Array.isArray(raw) ? raw : Object.entries(raw || {}).map(([classId, value]) => typeof value === "string" ? { classId, archetypeId: value } : { classId, ...(value || {}) });
    return list.some((entry) => normalizeId(entry?.classId || entry?.parentClassId) === CLASS_ID && normalizeId(entry?.archetypeId || entry?.subclassId || entry?.id) === ARCHETYPE_ID);
  }

  function hasMastermindLevel(character, level) { return selectedMastermind(character) && rogueLevel(character) >= Number(level || 0); }

  function sameSide(a = {}, b = {}) {
    const sideA = normalizeId(a.side || a.team || a.faction || a.faccion);
    const sideB = normalizeId(b.side || b.team || b.faction || b.faccion);
    if (sideA && sideB) return sideA === sideB;
    return false;
  }

  function combatSpeed(unit = {}) {
    const runtime = global.LuminousUniversalSpeedRuntime;
    if (runtime?.effectiveSpeed) {
      const resolved = Number(runtime.effectiveSpeed(unit));
      if (Number.isFinite(resolved)) return resolved;
    }
    for (const value of [unit.speed, unit.effectiveSpeed, unit.currentSpeed, unit.maxSpeed, unit.max_speed, unit.combatStats?.maxSpeed, unit.combatStats?.max_speed]) {
      if (Number.isFinite(Number(value))) return Number(value);
    }
    return 0;
  }

  function helpAdditionalBonus(mastermind, ally, context = {}) {
    if (!mastermind || !ally) return 1;
    const allies = unitList(context).filter((unit) => !sameEntity(unit, mastermind) && sameSide(unit, mastermind));
    const allySpeed = combatSpeed(ally);
    if (allies.length) {
      const slowest = Math.min(...allies.map(combatSpeed));
      if (allySpeed <= slowest) return 3;
    }
    if (allySpeed < combatSpeed(mastermind)) return 2;
    return 1;
  }

  function actionById(context = {}, id) {
    if (!id) return null;
    if (typeof context.getActionById === "function") {
      const found = context.getActionById(id);
      if (found) return found;
    }
    if (context.actionMap instanceof Map) return context.actionMap.get(id) || null;
    return context.actionMap?.[id] || null;
  }

  function helpTarget(action = {}, context = {}) {
    for (const effect of asArray(action.effects)) {
      if (normalizeId(effect?.type) !== "modify_combat_action") continue;
      const targetAction = actionById(context, effect.targetActionId);
      const unit = targetAction ? unitById(context, targetAction.actorId) : null;
      if (unit) return { ally: unit, targetAction, effect };
    }
    for (const id of [action.targeting?.mainTargetId, ...asArray(action.targeting?.targetIds)]) {
      const unit = unitById(context, id);
      if (unit) return { ally: unit, targetAction: null, effect: null };
    }
    return { ally: null, targetAction: null, effect: null };
  }

  function isHelpAction(action = {}) {
    return normalizeId(action.source?.type || action.source?.kind) === "universal" && normalizeId(action.source?.id) === "help";
  }

  function prepareMastermindHelp(actionInput, mastermind, context = {}) {
    const action = clone(actionInput || {});
    if (!hasMastermindLevel(mastermind, 15) || !isHelpAction(action)) return action;
    if (!action.economy || typeof action.economy !== "object") action.economy = {};
    action.economy.cost = "quick_action";
    const { ally } = helpTarget(action, context);
    const additional = ally ? helpAdditionalBonus(mastermind, ally, context) : 1;
    action.effects = asArray(action.effects).map((effect) => {
      if (normalizeId(effect?.type) !== "modify_combat_action") return clone(effect);
      const next = clone(effect);
      if (!next.modifier || typeof next.modifier !== "object") next.modifier = {};
      next.modifier.amount = numberOr(next.modifier.amount, 1) + additional;
      next.modifier.mastermindAdditional = additional;
      return next;
    });
    action.metadata = { ...(action.metadata || {}), mastermindMasterOfTactics: true, mastermindHelpAdditional: additional };
    return action;
  }

  function assistGuardStatusId(protectedUnit = {}) {
    const key = normalizeId(entityId(protectedUnit) || entityName(protectedUnit) || "unit") || "unit";
    return `assist_guard_${key}`;
  }

  function statusStore(unit = {}) {
    if (global.LuminousStatusEngine?.ensureStore) return global.LuminousStatusEngine.ensureStore(unit);
    if (!unit.statusEffects || typeof unit.statusEffects !== "object" || Array.isArray(unit.statusEffects)) unit.statusEffects = {};
    return unit.statusEffects;
  }

  function applyAssistGuard(guard, protectedUnit, count = 1) {
    if (!guard || !protectedUnit) return null;
    const id = assistGuardStatusId(protectedUnit);
    const input = {
      mode: "gain",
      name: `Assist Guard - ${entityName(protectedUnit)}`,
      count: Math.max(1, intOr(count, 1)),
      potency: 0,
      duration: "until_removed",
      sourceTraitId: "misdirection",
      sourceUnitId: entityId(protectedUnit) || null,
      data: {
        protectedUnitId: entityId(protectedUnit) || null,
        protectedUnitName: entityName(protectedUnit),
        archetypeId: ARCHETYPE_ID,
        dynamicStatus: true,
        iconPending: true,
      },
    };
    if (global.LuminousStatusEngine?.applyStatus) return global.LuminousStatusEngine.applyStatus(guard, id, input);
    const store = statusStore(guard);
    const existing = store[id] || null;
    store[id] = { ...input, id, count: numberOr(existing?.count, 0) + input.count, data: { ...(existing?.data || {}), ...input.data } };
    delete store[id].mode;
    return clone(store[id]);
  }

  function assistGuardEntries(unit = {}) {
    const store = statusStore(unit) || {};
    return Object.entries(store).map(([id, value]) => ({ id: normalizeId(id), status: value })).filter(({ id, status }) =>
      id.startsWith("assist_guard_") && normalizeId(status?.sourceTraitId) === "misdirection" && numberOr(status?.count, 0) > 0,
    );
  }

  function statusProtects(status, protectedUnit) {
    const wantedIds = new Set(identityValues(protectedUnit));
    const storedId = String(status?.data?.protectedUnitId || status?.sourceUnitId || "").trim();
    if (storedId && wantedIds.has(storedId)) return true;
    return normalizeId(status?.data?.protectedUnitName) === normalizeId(entityName(protectedUnit));
  }

  function consumeAssistGuard(guard, statusId) {
    const store = statusStore(guard);
    const current = store?.[normalizeId(statusId)];
    if (!current) return { consumed: false, countAfter: 0 };
    const next = Math.max(0, numberOr(current.count, 0) - 1);
    if (next <= 0) {
      if (global.LuminousStatusEngine?.removeStatus) global.LuminousStatusEngine.removeStatus(guard, statusId, { from: "self", ignoreProtection: true });
      else delete store[normalizeId(statusId)];
    } else if (global.LuminousStatusEngine?.applyStatus) {
      global.LuminousStatusEngine.applyStatus(guard, statusId, { ...current, mode: "set", count: next });
    } else current.count = next;
    return { consumed: true, countAfter: next };
  }

  function actionMapValues(context = {}) {
    if (context.actionMap instanceof Map) return [...context.actionMap.values()];
    return Object.values(context.actionMap || {});
  }

  function skillId(skill = {}) { return String(skill.id || skill.skillId || skill.skill_id || skill.name || "").trim(); }

  function skillsForUnit(unit = {}, context = {}) {
    if (typeof context.getAvailableAssistGuardSkills === "function") {
      const direct = context.getAvailableAssistGuardSkills(unit);
      if (Array.isArray(direct)) return direct.filter(Boolean);
    }
    if (typeof context.getSkillsForUnit === "function") {
      const direct = context.getSkillsForUnit(unit);
      if (Array.isArray(direct)) return direct.filter(Boolean);
    }
    const source = unit.availableSkills || unit.skills || unit.skillDeck || unit.skill_deck || unit.deck || [];
    return Array.isArray(source) ? source.filter(Boolean) : Object.values(source || {}).filter(Boolean);
  }

  function selectedOrUsedSkillIds(unit, context = {}) {
    const id = entityId(unit);
    const ids = new Set();
    actionMapValues(context).forEach((action) => {
      if (String(action?.actorId || "") !== id) return;
      if (normalizeId(action?.source?.type) !== "skill") return;
      if (normalizeId(action?.state) === "cancelled") return;
      const value = skillId(action.source);
      if (value) ids.add(normalizeId(value));
    });
    return ids;
  }

  function assistGuardSkillAvailable(skill, guard, context = {}) {
    if (!skill) return false;
    const id = normalizeId(skillId(skill));
    if (!id) return false;
    if (skill.used === true || skill.isUsed === true || skill.selected === true || skill.isSelected === true || skill.disabled === true || skill.available === false || skill.__mastermindAssistGuardUsed === true) return false;
    if (Number.isFinite(Number(skill.usesRemaining)) && Number(skill.usesRemaining) <= 0) return false;
    if (Number.isFinite(Number(skill.cooldown)) && Number(skill.cooldown) > 0) return false;
    if (selectedOrUsedSkillIds(guard, context).has(id)) return false;
    if (typeof context.isAssistGuardSkillAvailable === "function" && context.isAssistGuardSkillAvailable({ skill, guard, context }) === false) return false;
    return true;
  }

  function chooseAssistGuardSkill(guard, protectedUnit, attacker, incomingAction, context = {}) {
    const candidates = skillsForUnit(guard, context).filter((skill) => assistGuardSkillAvailable(skill, guard, context));
    if (!candidates.length) return null;
    if (typeof context.selectAssistGuardSkill === "function") {
      const selected = context.selectAssistGuardSkill({ guard, protectedUnit, attacker, incomingAction, candidates, context });
      if (selected && typeof selected === "object") return selected;
      const wanted = normalizeId(selected);
      const found = candidates.find((skill) => normalizeId(skillId(skill)) === wanted);
      if (found) return found;
    }
    return candidates[0];
  }

  function findAssistGuard(protectedUnit, attacker, incomingAction, context = {}) {
    const candidates = [];
    for (const guard of unitList(context)) {
      if (sameEntity(guard, protectedUnit) || !sameSide(guard, protectedUnit)) continue;
      for (const entry of assistGuardEntries(guard)) {
        if (!statusProtects(entry.status, protectedUnit)) continue;
        const skill = chooseAssistGuardSkill(guard, protectedUnit, attacker, incomingAction, context);
        if (skill) candidates.push({ guard, statusId: entry.id, status: entry.status, skill });
      }
    }
    if (!candidates.length) return null;
    if (typeof context.selectAssistGuard === "function") {
      const selected = context.selectAssistGuard({ protectedUnit, attacker, incomingAction, candidates, context });
      if (selected && candidates.includes(selected)) return selected;
      const selectedId = String(selected?.guardId || selected || "");
      const found = candidates.find((entry) => entityId(entry.guard) === selectedId);
      if (found) return found;
    }
    return candidates[0];
  }

  function buildAssistGuardAction(guard, attacker, skill, incomingAction = {}) {
    const guardId = entityId(guard);
    const attackerId = entityId(attacker);
    const id = skillId(skill);
    return {
      id: `assist_guard_${guardId}_${normalizeId(id)}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      actorId: guardId,
      source: { type: "skill", id },
      economy: { cost: "action" },
      phase: { selectedAt: incomingAction.phase?.selectedAt || "planning_phase_player", executesAt: incomingAction.phase?.executesAt || "combat_phase" },
      targeting: { allegiance: "enemy", mode: "single", mainTargetId: attackerId, targetIds: [attackerId], attackWeight: Math.max(1, intOr(skill.attackWeight ?? skill.atkWeight ?? skill.attack_weight, 1)) },
      resolution: { type: "clash" },
      resources: clone(skill.resources || []),
      modifiers: clone(skill.modifiers || []),
      effects: [],
      metadata: { sourceDefinition: clone(skill), assistGuard: true, protectedByMisdirection: true },
      state: "planned",
    };
  }

  function redirectedIncomingAction(actionInput, protectedUnit, guard) {
    const action = clone(actionInput || {});
    const protectedId = entityId(protectedUnit);
    const guardId = entityId(guard);
    if (!action.targeting || typeof action.targeting !== "object") action.targeting = {};
    const ids = asArray(action.targeting.targetIds).map(String);
    action.targeting.targetIds = ids.length ? ids.map((id) => id === protectedId ? guardId : id) : [guardId];
    if (!action.targeting.targetIds.includes(guardId)) action.targeting.targetIds.unshift(guardId);
    if (!action.targeting.mainTargetId || String(action.targeting.mainTargetId) === protectedId) action.targeting.mainTargetId = guardId;
    action.resolution = { ...(action.resolution || {}), type: "clash" };
    action.metadata = { ...(action.metadata || {}), assistGuardRedirectedFrom: protectedId, assistGuardRedirectedTo: guardId };
    return action;
  }

  function protectedTargetForAction(action = {}, context = {}) {
    const ids = [action.targeting?.mainTargetId, ...asArray(action.targeting?.targetIds)].filter(Boolean).map(String);
    for (const id of ids) {
      const target = unitById(context, id);
      if (target) return target;
    }
    return null;
  }

  function markAssistGuardSkillUsed(guard, skill, context = {}, action = null) {
    if (typeof context.markAssistGuardSkillUsed === "function") {
      context.markAssistGuardSkillUsed({ guard, skill, action, context });
      return;
    }
    try { skill.__mastermindAssistGuardUsed = true; } catch (_) {}
  }

  function tryAssistGuard(actionInput, context, resolverSource) {
    if (!resolverSource?.resolveClashPair || context?.__mastermindAssistGuardActive) return null;
    const action = clone(actionInput || {});
    const attacker = unitById(context, action.actorId);
    const protectedUnit = protectedTargetForAction(action, context);
    if (!attacker || !protectedUnit || sameSide(attacker, protectedUnit)) return null;
    const found = findAssistGuard(protectedUnit, attacker, action, context);
    if (!found) return null;
    const redirected = redirectedIncomingAction(action, protectedUnit, found.guard);
    const guardAction = buildAssistGuardAction(found.guard, attacker, found.skill, action);
    const clash = resolverSource.resolveClashPair(redirected, guardAction, { ...context, __mastermindAssistGuardActive: true });
    if (!clash?.resolved) return null;
    const consumption = consumeAssistGuard(found.guard, found.statusId);
    markAssistGuardSkillUsed(found.guard, found.skill, context, guardAction);
    return {
      ...clash,
      assistGuard: {
        triggered: true,
        statusId: found.statusId,
        statusName: found.status?.name || `Assist Guard - ${entityName(protectedUnit)}`,
        protectedUnitId: entityId(protectedUnit),
        guardUnitId: entityId(found.guard),
        skillId: skillId(found.skill),
        countAfter: consumption.countAfter,
      },
    };
  }

  function helpApplied(result = {}) {
    const entries = result.resolution?.effects || result.effects || [];
    return asArray(entries).some((entry) => entry?.applied === true && normalizeId(entry?.effect?.type) === "modify_combat_action");
  }

  function maybeApplyMisdirection(mastermind, helpAction, result, context = {}) {
    if (!hasMastermindLevel(mastermind, 65) || !result?.resolved || !helpApplied(result)) return null;
    const { ally } = helpTarget(helpAction, context);
    if (!ally || !sameSide(mastermind, ally)) return null;
    return applyAssistGuard(ally, mastermind, 1);
  }

  function patchArchetypeCatalog() {
    const source = global.LuminousArchetypeTraitCatalog;
    if (!source?.allDefinitions || !source?.allGrants || !source?.allArchetypes) return false;
    if (source.__mastermindArchetypeIntegrated) return true;
    const originalDefinitions = source.allDefinitions.bind(source);
    const originalGrants = source.allGrants.bind(source);
    const originalArchetypes = source.allArchetypes.bind(source);
    const originalGet = typeof source.getDefinition === "function" ? source.getDefinition.bind(source) : null;
    const originalResolve = typeof source.resolveTraitGrants === "function" ? source.resolveTraitGrants.bind(source) : null;
    const wrapped = Object.freeze({
      ...source,
      __mastermindArchetypeIntegrated: true,
      MASTERMIND_ID: ARCHETYPE_ID,
      MASTERMIND_CLASS_ID: CLASS_ID,
      ARCHETYPES: Object.freeze({ ...(source.ARCHETYPES || {}), [ARCHETYPE_ID]: ARCHETYPE }),
      DEFINITIONS: Object.freeze({ ...(source.DEFINITIONS || {}), ...DEFINITIONS }),
      GRANTS: Object.freeze([...(source.GRANTS || []), ...GRANTS]),
      allDefinitions() { return { ...originalDefinitions(), ...DEFINITIONS }; },
      allGrants() { return [...originalGrants(), ...GRANTS.map((entry) => ({ ...entry, source: { ...(entry.source || {}) } }))]; },
      allArchetypes() { return { ...originalArchetypes(), [ARCHETYPE_ID]: { ...ARCHETYPE } }; },
      getDefinition(id) { return DEFINITIONS[normalizeId(id)] || originalGet?.(id) || null; },
      resolveTraitGrants(character = {}, definitions) {
        const base = originalResolve ? originalResolve(character, definitions) || [] : [];
        const engine = global.LuminousArchetypeEngine;
        const extra = engine?.resolveTraitGrants
          ? engine.resolveTraitGrants(character, GRANTS, definitions ? { ...definitions, ...DEFINITIONS } : DEFINITIONS, { [ARCHETYPE_ID]: ARCHETYPE }, global.LuminousTraitEngine) || []
          : [];
        const byId = new Map();
        [...base, ...extra].forEach((trait) => { const id = normalizeId(trait?.id || trait?.name); if (id && !byId.has(id)) byId.set(id, trait); });
        return [...byId.values()];
      },
    });
    global.LuminousArchetypeTraitCatalog = wrapped;
    return true;
  }

  function patchCoreCatalog() {
    const source = global.LuminousTraitCatalogCore;
    if (!source?.allDefinitions || !source?.allGrants || source.__mastermindArchetypeIntegrated) return Boolean(source?.__mastermindArchetypeIntegrated);
    const originalDefinitions = source.allDefinitions.bind(source);
    const originalGrants = source.allGrants.bind(source);
    const originalGet = typeof source.getDefinition === "function" ? source.getDefinition.bind(source) : null;
    global.LuminousTraitCatalogCore = Object.freeze({
      ...source,
      __mastermindArchetypeIntegrated: true,
      allDefinitions() { return { ...originalDefinitions(), ...DEFINITIONS }; },
      allGrants() { return [...originalGrants(), ...GRANTS]; },
      getDefinition(id) { return DEFINITIONS[normalizeId(id)] || originalGet?.(id) || null; },
    });
    return true;
  }

  function patchTraitEngine() {
    const source = global.LuminousTraitEngine;
    if (!source?.resolveTraitGrants || source.__mastermindArchetypeIntegrated) return Boolean(source?.__mastermindArchetypeIntegrated);
    const originalResolve = source.resolveTraitGrants.bind(source);
    global.LuminousTraitEngine = Object.freeze({
      ...source,
      __mastermindArchetypeIntegrated: true,
      resolveTraitGrants(character = {}, grants = [], definitions = {}) {
        const base = originalResolve(character, grants, definitions) || [];
        const engine = global.LuminousArchetypeEngine;
        const extra = engine?.resolveTraitGrants
          ? engine.resolveTraitGrants(character, GRANTS, { ...definitions, ...DEFINITIONS }, { [ARCHETYPE_ID]: ARCHETYPE }, source) || []
          : [];
        const byId = new Map();
        [...base, ...extra].forEach((trait) => { const id = normalizeId(trait?.id || trait?.name); if (id && !byId.has(id)) byId.set(id, trait); });
        return [...byId.values()];
      },
    });
    return true;
  }

  function isMastermindTrait(trait = {}) {
    const source = trait.source || {};
    return ["archetype", "subclass", "class_archetype"].includes(normalizeId(source.type || trait.sourceType)) && normalizeId(source.archetypeId || source.id) === ARCHETYPE_ID;
  }

  function patchArchetypeRuntime() {
    const source = global.LuminousArchetypeRuntime;
    if (!source?.syncArchetypeTraitsForUnit || source.__mastermindArchetypeIntegrated) return Boolean(source?.__mastermindArchetypeIntegrated);
    const originalSync = source.syncArchetypeTraitsForUnit.bind(source);
    global.LuminousArchetypeRuntime = Object.freeze({
      ...source,
      __mastermindArchetypeIntegrated: true,
      syncArchetypeTraitsForUnit(unit = {}) {
        const base = originalSync(unit) || [];
        const engine = global.LuminousArchetypeEngine;
        const granted = engine?.resolveTraitGrants
          ? engine.resolveTraitGrants(unit, GRANTS, DEFINITIONS, { [ARCHETYPE_ID]: ARCHETYPE }, global.LuminousTraitEngine) || []
          : [];
        const existing = Array.isArray(unit.traitDefinitions) ? unit.traitDefinitions : [];
        const byId = new Map();
        [...existing.filter((trait) => !isMastermindTrait(trait)), ...granted].forEach((trait) => {
          const id = normalizeId(trait?.id || trait?.name);
          if (id && !byId.has(id)) byId.set(id, trait);
        });
        unit.traitDefinitions = [...byId.values()];
        return [...base, ...granted];
      },
    });
    return true;
  }

  function patchCombatActionResolver() {
    const source = global.LuminousCombatActionResolver;
    if (!source?.resolveCombatAction || source.__mastermindArchetypeIntegrated) return Boolean(source?.__mastermindArchetypeIntegrated);
    const originalResolve = source.resolveCombatAction.bind(source);
    const originalPrepared = typeof source.resolvePreparedUnopposed === "function" ? source.resolvePreparedUnopposed.bind(source) : null;
    const originalClash = typeof source.resolveClashPair === "function" ? source.resolveClashPair.bind(source) : null;
    const wrapped = Object.freeze({
      ...source,
      __mastermindArchetypeIntegrated: true,
      resolveCombatAction(input = {}, context = {}) {
        const actor = unitById(context, input.actorId);
        let action = actor ? prepareMastermindHelp(input, actor, context) : clone(input);
        const type = normalizeId(action.resolution?.type);
        if (!context.__mastermindAssistGuardActive && (type === "unopposed" || (type === "clash" && !context.opposingAction))) {
          const intercepted = tryAssistGuard(action, context, source);
          if (intercepted) return intercepted;
        }
        const result = originalResolve(action, context);
        if (actor && isHelpAction(action)) {
          const status = maybeApplyMisdirection(actor, action, result, context);
          if (status) result.mastermindMisdirection = { applied: true, status: clone(status), target: helpTarget(action, context).ally ? entityId(helpTarget(action, context).ally) : null };
          result.mastermindMasterOfTactics = { applied: hasMastermindLevel(actor, 15), additionalHelpFinalPower: action.metadata?.mastermindHelpAdditional || 0, economyCost: action.economy?.cost };
        }
        return result;
      },
      resolvePreparedUnopposed(action, actor, targets, context = {}, options = {}) {
        if (!context.__mastermindAssistGuardActive) {
          const target = asArray(targets)[0];
          const preparedAction = clone(action || {});
          if (target) {
            if (!preparedAction.targeting || typeof preparedAction.targeting !== "object") preparedAction.targeting = {};
            preparedAction.targeting.mainTargetId = entityId(target);
            preparedAction.targeting.targetIds = [entityId(target)];
          }
          const intercepted = tryAssistGuard(preparedAction, context, source);
          if (intercepted) return intercepted;
        }
        return originalPrepared ? originalPrepared(action, actor, targets, context, options) : { resolved: false, reason: "prepared_unopposed_resolver_unavailable" };
      },
      resolveClashPair(action, opposingAction, context = {}) {
        const opposingUnit = unitById(context, opposingAction?.actorId);
        const opposingUnavailable = !opposingAction || ["resolved", "cancelled"].includes(normalizeId(opposingAction?.state)) || opposingUnit?.staggered === true || opposingUnit?.isStaggered === true;
        if (!context.__mastermindAssistGuardActive && opposingUnavailable) {
          const intercepted = tryAssistGuard(action, context, source);
          if (intercepted) return intercepted;
        }
        return originalClash ? originalClash(action, opposingAction, context) : { resolved: false, reason: "clash_resolver_unavailable" };
      },
    });
    global.LuminousCombatActionResolver = wrapped;
    return true;
  }

  function install() {
    patchArchetypeCatalog();
    patchCoreCatalog();
    patchTraitEngine();
    patchArchetypeRuntime();
    patchCombatActionResolver();
    return true;
  }

  const api = Object.freeze({
    ARCHETYPE_ID, ARCHETYPE_NAME, CLASS_ID, CLASS_NAME, ARCHETYPE, SOURCE, DEFINITIONS, GRANTS,
    rogueLevel, selectedMastermind, hasMastermindLevel,
    combatSpeed, helpAdditionalBonus, prepareMastermindHelp,
    assistGuardStatusId, applyAssistGuard, assistGuardEntries, consumeAssistGuard,
    skillsForUnit, assistGuardSkillAvailable, chooseAssistGuardSkill, findAssistGuard,
    buildAssistGuardAction, redirectedIncomingAction, tryAssistGuard,
    patchArchetypeCatalog, patchCoreCatalog, patchTraitEngine, patchArchetypeRuntime, patchCombatActionResolver, install,
  });

  global.LuminousMastermindArchetypeRuntime = api;
  install();
  if (global.document && global.setInterval) global.setInterval(install, PATCH_INTERVAL_MS);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
