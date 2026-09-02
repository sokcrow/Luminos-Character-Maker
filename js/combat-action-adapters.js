(function (global) {
  "use strict";

  const schema = global.LuminousCombatAction || (typeof require === "function" ? require("./combat-action-schema.js") : null);
  if (!schema) return;

  const normalizeId = (value) => String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
  const asArray = (value) => value == null ? [] : (Array.isArray(value) ? value : [value]);
  const numberOr = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const intOr = (value, fallback = 0) => Number.isFinite(Number(value)) ? Math.trunc(Number(value)) : fallback;

  function actorIdOf(actor = {}, options = {}) {
    return String(options.actorId ?? actor.id ?? actor.unitId ?? actor.characterId ?? "").trim();
  }

  function planningPhase(options = {}) {
    return options.isAi === true ? schema.PHASES.PLANNING_PHASE_AI : schema.PHASES.PLANNING_PHASE_PLAYER;
  }

  function baseInput(actor, sourceType, sourceId, options = {}) {
    return {
      actorId: actorIdOf(actor, options),
      actionSlotId: options.actionSlotId ?? options.slotId ?? null,
      source: { type: sourceType, id: String(sourceId ?? "") },
      phase: {
        selectedAt: options.selectedAt || planningPhase(options),
        executesAt: options.executesAt || schema.PHASES.COMBAT_PHASE,
      },
      economy: { cost: options.cost || schema.ECONOMY_COSTS.ACTION },
      targeting: options.targeting || {},
      resolution: options.resolution || { type: "automatic" },
      resources: options.resources || [],
      modifiers: options.modifiers || [],
      effects: options.effects || [],
      metadata: options.metadata || {},
    };
  }

  function skillResolution(skill = {}) {
    if (skill.save || skill.savingThrow || skill.saving_throw || skill.saveAbility || skill.save_ability) {
      const raw = skill.save || skill.savingThrow || skill.saving_throw || {};
      return {
        type: "save",
        save: {
          abilityId: normalizeId(raw.abilityId || raw.ability || raw.stat || skill.saveAbility || skill.save_ability),
          dc: numberOr(raw.dc ?? skill.saveDC ?? skill.save_dc, 0),
          onSuccess: normalizeId(raw.onSuccess || raw.on_success || skill.saveOnSuccess || "negates") || "negates",
        },
      };
    }
    if (skill.check || skill.threshold != null) {
      return {
        type: "check",
        check: {
          stat: normalizeId(skill.check?.stat || skill.statUsed || skill.stat_used || skill.scalingStat || skill.scaling_stat),
          skill: normalizeId(skill.check?.skill || skill.skillUsed || skill.skill_used),
          threshold: numberOr(skill.check?.threshold ?? skill.threshold, 0),
        },
      };
    }
    if (skill.contest) return { type: "contest", contest: clone(skill.contest) };
    const isUnclashable = skill.isUnclashable === true || skill.is_unclashable === true;
    const isClashable = skill.isClashable !== false && skill.is_clashable !== false && !isUnclashable;
    return { type: isClashable ? "clash" : "unopposed" };
  }

  function skillTargeting(skill = {}, options = {}) {
    const rawType = normalizeId(skill.targetingType || skill.targeting_type || "focused_attack");
    const indiscriminate = skill.isIndiscriminate === true || skill.is_indiscriminate === true || rawType.includes("indiscriminate");
    const weight = Math.max(1, intOr(skill.attackWeight ?? skill.atkWeight ?? skill.weight, 1));
    let mode = "single";
    if (indiscriminate) mode = "indiscriminate";
    else if (weight > 1 || rawType.includes("aoe") || rawType.includes("area") || rawType.includes("volley")) mode = "aoe";
    return {
      allegiance: options.allegiance || (skill.targetAlly === true || skill.target_ally === true ? "ally" : "enemy"),
      mode,
      mainTargetId: options.mainTargetId ?? options.targetId ?? null,
      targetIds: options.targetIds || [],
      attackWeight: weight,
      indiscriminate,
      criteria: options.criteria || null,
    };
  }

  function compileSkillToCombatAction(actor, rawSkill = {}, options = {}) {
    const skill = global.LuminousCombatSkillSchema?.normalizeCombatSkill
      ? global.LuminousCombatSkillSchema.normalizeCombatSkill(rawSkill)
      : rawSkill;
    const sourceId = skill.id || skill.skillId || options.sourceId || "skill";
    return schema.createCombatAction({
      ...baseInput(actor, "skill", sourceId, options),
      targeting: skillTargeting(skill, options),
      resolution: options.resolution || skillResolution(skill),
      effects: options.effects || clone(skill.effects || []),
      modifiers: options.modifiers || [],
      resources: options.resources || asArray(skill.resourceCosts || skill.resource_costs),
      metadata: {
        ...(options.metadata || {}),
        name: skill.name || skill.nombre || sourceId,
        basePower: numberOr(skill.basePower ?? skill.base_power, 0),
        coinPower: numberOr(skill.coinPower ?? skill.coin_power, 0),
        coinAmount: Math.max(0, intOr(skill.coinAmount ?? skill.coin_count ?? skill.coinCount, 0)),
        coinType: skill.coinType || skill.coin_type || null,
        damageType: skill.damageType || skill.dmgType || skill.attackType || skill.tipo_dano || null,
        sinAffinity: skill.sinAffinity || skill.affinity || skill.sin || skill.pecado || null,
        scalingStat: skill.scalingStat || skill.scaling_stat || null,
        statUsed: skill.statUsed || skill.stat_used || null,
        skillUsed: skill.skillUsed || skill.skill_used || null,
        defenseSubtype: skill.defenseSubtype || skill.defense_subtype || null,
        sourceDefinition: clone(skill),
      },
    });
  }

  function spellTargeting(spell = {}, options = {}) {
    const raw = normalizeId(spell.targetType || spell.target_type || spell.targetingType || spell.targeting_type || "single");
    const attackWeight = Math.max(1, intOr(spell.attackWeight ?? spell.atkWeight ?? spell.atk_weight, 1));
    let mode = "single";
    if (raw === "self") mode = "self";
    else if (["multi", "allies", "enemies"].includes(raw)) mode = "multi";
    else if (["area", "aoe"].includes(raw) || attackWeight > 1) mode = "aoe";
    if (spell.isIndiscriminate === true || spell.is_indiscriminate === true) mode = "indiscriminate";
    let allegiance = options.allegiance || "enemy";
    if (raw === "self") allegiance = "self";
    else if (raw === "allies") allegiance = "ally";
    else if (raw === "enemies") allegiance = "enemy";
    return {
      allegiance,
      mode,
      mainTargetId: options.mainTargetId ?? options.targetId ?? null,
      targetIds: options.targetIds || [],
      attackWeight,
      indiscriminate: mode === "indiscriminate",
    };
  }

  function spellResolution(spell = {}, options = {}) {
    const rawSave = spell.save || spell.savingThrow || spell.saving_throw || {};
    const abilityId = normalizeId(rawSave.abilityId || rawSave.ability || rawSave.stat || spell.saveAbility || spell.save_ability);
    if (abilityId) {
      return {
        type: "save",
        save: {
          abilityId,
          dc: numberOr(options.saveDC ?? rawSave.dc ?? spell.saveDC ?? spell.save_dc, 0),
          onSuccess: normalizeId(rawSave.onSuccess || rawSave.on_success || spell.saveOnSuccess || "negates") || "negates",
        },
      };
    }
    if (spell.check || spell.threshold != null) {
      return {
        type: "check",
        check: {
          stat: normalizeId(spell.check?.stat || spell.statUsed || spell.stat_used),
          skill: normalizeId(spell.check?.skill || spell.skillUsed || spell.skill_used),
          threshold: numberOr(spell.check?.threshold ?? spell.threshold, 0),
        },
      };
    }
    if (spell.isUnclashable === true || spell.is_unclashable === true) return { type: "unopposed" };
    return { type: "clash" };
  }

  function spellResources(spell = {}, options = {}) {
    if (Array.isArray(options.resources)) return options.resources;
    const resources = asArray(spell.resourceCosts || spell.resource_costs);
    const slotLevel = Math.max(0, intOr(options.slotLevel ?? spell.slotLevel ?? spell.level ?? spell.spellLevel, 0));
    const cantrip = spell.cantrip === true || slotLevel === 0;
    if (!cantrip) {
      resources.push({
        owner: "source",
        type: "spell_slot",
        id: String(options.classId || spell.sourceClassId || spell.classId || spell.class_id || ""),
        amount: 1,
        metadata: { slotLevel },
      });
    }
    return resources;
  }

  function compileSpellToCombatAction(actor, spell = {}, options = {}) {
    const sourceId = spell.id || spell.spellId || options.sourceId || "spell";
    return schema.createCombatAction({
      ...baseInput(actor, "spell", sourceId, options),
      targeting: spellTargeting(spell, options),
      resolution: options.resolution || spellResolution(spell, options),
      resources: spellResources(spell, options),
      effects: options.effects || clone(spell.effects || []),
      modifiers: options.modifiers || [],
      metadata: {
        ...(options.metadata || {}),
        name: spell.name || spell.nombre || sourceId,
        slotLevel: Math.max(0, intOr(options.slotLevel ?? spell.slotLevel ?? spell.level ?? spell.spellLevel, 0)),
        cantrip: spell.cantrip === true || Math.max(0, intOr(options.slotLevel ?? spell.slotLevel ?? spell.level ?? spell.spellLevel, 0)) === 0,
        concentration: spell.concentration === true,
        castingTime: spell.castingTime || spell.casting_time || null,
        sourceClassId: options.classId || spell.sourceClassId || spell.classId || spell.class_id || null,
        sourceDefinition: clone(spell),
      },
    });
  }

  function compileTraitToCombatAction(actor, trait = {}, options = {}) {
    const sourceId = trait.id || trait.traitId || options.sourceId || "trait";
    const resources = options.resources || asArray(trait.resourceCosts || trait.resource_costs);
    const maxUses = trait.uses ?? trait.maxUses ?? trait.max_uses;
    if (maxUses != null && !resources.some((resource) => normalizeId(resource.type) === "trait_use")) {
      resources.push({ owner: "source", type: "trait_use", id: String(sourceId), amount: 1 });
    }
    return schema.createCombatAction({
      ...baseInput(actor, "trait", sourceId, options),
      resolution: options.resolution || trait.resolution || { type: "automatic" },
      targeting: options.targeting || trait.targeting || { mode: "self", allegiance: "self" },
      resources,
      effects: options.effects || clone(trait.effects || []),
      metadata: { ...(options.metadata || {}), name: trait.name || trait.nombre || sourceId, sourceDefinition: clone(trait) },
    });
  }

  function compileReactionToCombatAction(actor, source = {}, options = {}) {
    const sourceType = normalizeId(options.sourceType || source.sourceType || source.source_type || "trait");
    const prepared = normalizeId(options.mode || options.reactionMode) === "prepared";
    let action;
    if (sourceType === "skill") action = compileSkillToCombatAction(actor, source, { ...options, cost: "reaction" });
    else if (sourceType === "spell") action = compileSpellToCombatAction(actor, source, { ...options, cost: "reaction" });
    else action = compileTraitToCombatAction(actor, source, { ...options, cost: "reaction" });
    action.economy.cost = schema.ECONOMY_COSTS.REACTION;
    action.phase.selectedAt = prepared ? planningPhase(options) : schema.PHASES.COMBAT_PHASE;
    action.phase.executesAt = schema.PHASES.COMBAT_PHASE;
    action.reaction = {
      mode: prepared ? "prepared" : "adaptive",
      trigger: clone(options.trigger || source.trigger || null),
    };
    return action;
  }

  function compileUniversalAction(actor, actionId, options = {}) {
    const id = normalizeId(actionId);
    const base = baseInput(actor, "universal", id, options);
    if (id === "grapple") {
      return schema.createCombatAction({
        ...base,
        targeting: { allegiance: "enemy", mode: "single", mainTargetId: options.targetId || null, targetIds: options.targetIds || [] },
        resolution: {
          type: "contest",
          contest: {
            attacker: { choices: [{ stat: "strength" }, { skill: "athletics" }] },
            defender: { choices: [{ stat: "dexterity" }, { skill: "acrobatics" }] },
            maintenance: {
              phase: schema.PHASES.ON_TURN_END,
              attacker: { choices: [{ stat: "strength" }, { skill: "athletics" }] },
              defender: { choices: [{ stat: "strength" }, { skill: "athletics" }] },
            },
            tieRule: "defender_wins",
          },
        },
        metadata: { ...(options.metadata || {}), universalRule: "grapple" },
      });
    }
    if (id === "help") {
      return schema.createCombatAction({
        ...base,
        targeting: { allegiance: "ally", mode: "single", mainTargetId: options.targetUnitId || options.targetId || null },
        resolution: { type: "automatic" },
        effects: [{
          type: "modify_combat_action",
          targetActionId: options.targetActionId || null,
          modifier: { source: "help_final_power", type: "final_power", amount: 1 },
        }],
        metadata: { ...(options.metadata || {}), universalRule: "help", targetActionSlotId: options.targetActionSlotId || null, oncePerTurnPerTeam: true },
      });
    }
    if (id === "retreat") {
      return schema.createCombatAction({
        ...base,
        phase: { selectedAt: planningPhase(options), executesAt: schema.PHASES.ON_TURN_END },
        targeting: { allegiance: "self", mode: "self" },
        resolution: { type: "automatic" },
        effects: [{ type: "retreat", inheritActionSlotsCap: 2, healHp: false, healSp: false }],
        metadata: { ...(options.metadata || {}), universalRule: "retreat", cancelableBeforeExecution: true },
      });
    }
    if (id === "escape") {
      return schema.createCombatAction({
        ...base,
        phase: { selectedAt: planningPhase(options), executesAt: schema.PHASES.ON_TURN_END },
        targeting: { allegiance: "self", mode: "self" },
        resolution: { type: "automatic" },
        effects: [{ type: "escape", leavesEncounter: true, deniesXp: true }],
        metadata: { ...(options.metadata || {}), universalRule: "escape", cancelableBeforeExecution: true },
      });
    }
    if (id === "improvise") {
      return schema.createCombatAction({
        ...base,
        targeting: options.targeting || { allegiance: "enemy", mode: "single", mainTargetId: options.targetId || null },
        resolution: options.resolution || { type: "automatic" },
        effects: options.effects || [],
        metadata: { ...(options.metadata || {}), universalRule: "improvise", dmAdjudicated: true, intent: options.intent || null },
      });
    }
    return schema.createCombatAction({ ...base, targeting: options.targeting || {}, resolution: options.resolution || { type: "automatic" } });
  }

  function compileSourceToCombatAction(actor, source = {}, options = {}) {
    const type = normalizeId(options.sourceType || source.sourceType || source.source_type || source.kind || source.type);
    if (type === "skill") return compileSkillToCombatAction(actor, source, options);
    if (type === "spell") return compileSpellToCombatAction(actor, source, options);
    if (type === "trait") return compileTraitToCombatAction(actor, source, options);
    if (type === "reaction") return compileReactionToCombatAction(actor, source, options);
    if (type === "universal" || type === "universal_action") return compileUniversalAction(actor, options.actionId || source.actionId || source.id, options);
    return schema.createCombatAction(baseInput(actor, type || "item", source.id || options.sourceId || "action", options));
  }

  const api = Object.freeze({
    compileSkillToCombatAction,
    compileSpellToCombatAction,
    compileTraitToCombatAction,
    compileReactionToCombatAction,
    compileUniversalAction,
    compileSourceToCombatAction,
  });

  global.LuminousCombatActionAdapters = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
