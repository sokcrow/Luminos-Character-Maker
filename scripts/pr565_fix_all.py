from pathlib import Path
import re


def replace_once(path, old, new, label):
    p = Path(path)
    text = p.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected 1 match in {path}, found {count}")
    p.write_text(text.replace(old, new, 1))


def insert_before(path, marker, block, label):
    p = Path(path)
    text = p.read_text()
    if block.strip() in text:
        return
    count = text.count(marker)
    if count != 1:
        raise SystemExit(f"{label}: expected 1 marker in {path}, found {count}")
    p.write_text(text.replace(marker, block + marker, 1))

# -----------------------------------------------------------------------------
# 1. Trait tray: universal runtime preparation + resolved activation callback.
# -----------------------------------------------------------------------------
tray = "js/trait-player-tray.js"
replace_once(
    tray,
    '      this.resolveInputs = typeof options.resolveInputs === "function" ? options.resolveInputs : null;\n',
    '      this.resolveInputs = typeof options.resolveInputs === "function" ? options.resolveInputs : null;\n      this.prepareRuntime = typeof options.prepareRuntime === "function" ? options.prepareRuntime : null;\n',
    "tray prepareRuntime option",
)
replace_once(
    tray,
    '      const runtime = Object.assign({}, this.getRuntime() || {});\n',
    '      let runtime = Object.assign({}, this.getRuntime() || {});\n      if (this.prepareRuntime) {\n        const prepared = await this.prepareRuntime({ action, trait, runtime, state: this.state });\n        if (prepared?.available === false || prepared?.blocked) {\n          const blocked = { available: false, reasons: prepared.reasons || [prepared.reason || "Trait target is unavailable."] };\n          this.onBlocked(blocked);\n          this.render();\n          return blocked;\n        }\n        runtime = Object.assign(runtime, prepared?.runtime || prepared || {});\n      }\n',
    "tray prepare activation runtime",
)
replace_once(
    tray,
    '        this.onActivated(result);\n',
    '        this.onActivated(result, { action, trait, runtime });\n',
    "tray activation metadata",
)

# -----------------------------------------------------------------------------
# 2. Universal Modifier Engine: Rabbit Form disables equipment virtually and
#    item/equipment Skills use the same universal availability contract.
# -----------------------------------------------------------------------------
um = "js/universal-modifier-engine.js"
replace_once(
    um,
    '  function resolveEquipment(unit = {}) {\n    const equipment = unit.equipment && typeof unit.equipment === "object" ? unit.equipment : {};\n',
    '  function resolveEquipment(unit = {}) {\n    const equipmentDisabled = hasStatus(unit, "moonfae_rabbit_form");\n    if (equipmentDisabled) {\n      return {\n        armor: { itemId: null, category: "none" },\n        armorEquipped: false,\n        armorCategory: "none",\n        shield: null,\n        mainHand: null,\n        offHand: null,\n        equipmentInactive: true,\n        disabledByStatus: "moonfae_rabbit_form",\n      };\n    }\n    const equipment = unit.equipment && typeof unit.equipment === "object" ? unit.equipment : {};\n',
    "Rabbit equipment virtualization",
)
replace_once(
    um,
    '  function canUseSkill(unit, skillInput) {\n    const skill = normalizeSkill(skillInput);\n    if (!skill || skill.skillFamily !== "attack" || skill.attackMode !== "ranged") return { usable: true, reason: null };\n',
    '  function canUseSkill(unit, skillInput) {\n    const skill = normalizeSkill(skillInput);\n    if (!skill) return { usable: true, reason: null };\n    if (hasStatus(unit, "moonfae_rabbit_form") && (skill.isItemSkill || skill.requiresEquipment || skill.equipmentId || skill.equipment_id)) {\n      return { usable: false, reason: "equipment_inactive", restriction: "equipment" };\n    }\n    if (skill.skillFamily !== "attack" || skill.attackMode !== "ranged") return { usable: true, reason: null };\n',
    "Rabbit item skill restriction",
)

# -----------------------------------------------------------------------------
# 3. Universal standardization runtime: live target selection, range, generic
#    declarative resolution of check->status and area damage, completed checks.
# -----------------------------------------------------------------------------
std = "js/trait-standardization-runtime.js"
resolver_block = r'''
  function uniqueCombatUnits(values = []) {
    const seen = new Set();
    return (values || []).filter((unit) => {
      if (!unit || typeof unit !== "object") return false;
      const key = combatUnitKey(unit);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function liveCombatUnits(runtime = {}) {
    const explicit = Array.isArray(runtime.units) ? runtime.units : [];
    const combatData = viewerCombatData() || {};
    return uniqueCombatUnits([...explicit, ...registeredCombatUnits(), ...Object.values(combatData).filter(Boolean)]);
  }

  function isAliveUnit(unit) {
    if (!unit || typeof unit !== "object") return false;
    if (!Number.isFinite(Number(unit.hp))) return true;
    return Number(unit.hp) > 0;
  }

  function sameFaction(a, b) {
    const fa = factionId(a);
    const fb = factionId(b);
    if (fa && fb) return fa === fb;
    return a === b;
  }

  function unitDistanceFeet(a, b) {
    const pa = a?.grid_pos || a?.gridPos;
    const pb = b?.grid_pos || b?.gridPos;
    if (!pa || !pb || !Number.isFinite(Number(pa.x)) || !Number.isFinite(Number(pa.y)) || !Number.isFinite(Number(pb.x)) || !Number.isFinite(Number(pb.y))) return null;
    return (Math.abs(Number(pa.x) - Number(pb.x)) + Math.abs(Number(pa.y) - Number(pb.y))) * 5;
  }

  function canSeeSource(unit) {
    if (!unit) return false;
    if (unit.canSeeSource === false || unit.canSee === false || unit.blinded === true) return false;
    if (global.LuminousStatusEngine?.hasStatus?.(unit, "blinded")) return false;
    return true;
  }

  function resolveTraitTargets(actor, targetSpec, runtime = {}) {
    const spec = normalizeId(targetSpec || "self");
    const units = liveCombatUnits(runtime).filter(isAliveUnit);
    const selected = runtime.target || runtime.defender || null;
    const allies = units.filter((unit) => unit !== actor && sameFaction(unit, actor));
    const enemies = units.filter((unit) => unit !== actor && !sameFaction(unit, actor));
    if (spec === "self") return actor ? [actor] : [];
    if (["self_or_ally", "ally"].includes(spec)) {
      if (selected && (selected === actor || sameFaction(selected, actor))) return [selected];
      return spec === "self_or_ally" && actor ? [actor] : allies.slice(0, 1);
    }
    if (["enemy", "selected_enemy"].includes(spec)) {
      if (selected && !sameFaction(selected, actor)) return [selected];
      return enemies.slice(0, 1);
    }
    if (spec === "random_enemy") {
      if (!enemies.length) return [];
      return [enemies[Math.floor(Math.random() * enemies.length)]];
    }
    if (spec === "all_enemies") return enemies;
    if (["all_other_creatures", "other_creatures"].includes(spec)) return units.filter((unit) => unit !== actor);
    if (["self_and_all_creatures", "all_creatures"].includes(spec)) return spec === "all_creatures" ? units : uniqueCombatUnits([actor, ...units]);
    if (selected) return [selected];
    return [];
  }

  function resolveTraitTarget(actor, targetSpec, runtime = {}) {
    return resolveTraitTargets(actor, targetSpec, runtime)[0] || null;
  }

  function skillCheckBonus(unit, skillId) {
    const id = normalizeId(skillId);
    const direct = unit?.dndSkills?.[id]?.value ?? unit?.skills?.[id]?.value ?? unit?.skillValues?.[id];
    if (Number.isFinite(Number(direct))) return Number(direct);
    const abilityBySkill = { deception: "cha", persuasion: "cha", intimidation: "cha", performance: "cha", insight: "wis", perception: "wis", survival: "wis", athletics: "str", acrobatics: "dex", stealth: "dex" };
    const ability = abilityBySkill[id] || "";
    const statAliases = ability === "cha" ? ["carisma", "charisma"] : ability === "wis" ? ["sabiduria", "wisdom"] : ability === "str" ? ["fuerza", "strength"] : ability === "dex" ? ["destreza", "dexterity"] : [ability];
    const stats = unit?.stats || {};
    const key = statAliases.find((entry) => Object.prototype.hasOwnProperty.call(stats, entry));
    const modifier = Math.floor((numberOr(key ? stats[key] : 10, 10) - 10) / 2);
    const level = Math.max(0, numberOr(unit?.level ?? unit?.characterBuild?.calculatedAtLevel, 0));
    const proficiency = numberOr(unit?.proficiency, Math.ceil(level / 20));
    const rawState = normalizeId(unit?.skillProficiency?.[id] ?? unit?.dndSkills?.[id]?.proficiency ?? "none");
    const multiplier = rawState === "expertise" ? 2 : rawState === "proficient" ? 1 : rawState === "half" ? 0.5 : 0;
    return modifier + Math.floor(proficiency * multiplier);
  }

  function traitFormulaValue(formula, actor, runtime, trait) {
    const engine = global.LuminousTraitEngine;
    if (formula == null) return 0;
    if (!engine?.evaluateFormula || !engine?.buildVariables) return numberOr(formula, 0);
    const character = isCurrentPlayerUnit(actor) ? global.LuminousPlayerTraitRuntime?.getCharacter?.() || actor : actor;
    return engine.evaluateFormula(formula, engine.buildVariables(character || actor || {}, { ...(runtime || {}), self: actor, character }, trait || {}));
  }

  function resolutionTargets(actor, resolution, runtime) {
    let targets = resolveTraitTargets(actor, resolution.targets || resolution.target || "self", runtime);
    if (Number.isFinite(Number(resolution.rangeFeet))) {
      const range = Number(resolution.rangeFeet);
      targets = targets.filter((target) => {
        if (target === actor) return true;
        const distance = unitDistanceFeet(actor, target);
        return distance == null || distance <= range;
      });
    }
    if (resolution.requireCanSeeSource) targets = targets.filter((target) => target === actor || canSeeSource(target));
    return targets;
  }

  function resolveTraitRuntimeResolutions(traits = [], trigger, runtime = {}, result = null) {
    const actor = runtime.self || runtime.character || null;
    if (!actor) return [];
    const statusEngine = global.LuminousStatusEngine;
    const outcomes = [];
    (traits || []).forEach((trait) => {
      (trait?.resolutions || []).forEach((resolution) => {
        if (normalizeId(resolution.trigger || "on_use") !== normalizeId(trigger)) return;
        if (resolution.whileStatus && !statusEngine?.hasStatus?.(actor, resolution.whileStatus)) return;
        const targets = resolutionTargets(actor, resolution, runtime);
        if (!targets.length) return;
        const type = normalizeId(resolution.type);
        if (type === "check_status") {
          const check = resolution.check || {};
          const thresholdFormula = check.thresholdFormula;
          let threshold = thresholdFormula != null ? traitFormulaValue(thresholdFormula, actor, runtime, trait) : numberOr(check.thresholdBase, 0);
          if (check.sourceSkillId) threshold += skillCheckBonus(actor, check.sourceSkillId);
          const resolved = targets.map((target) => {
            const checkResult = resolveCombatCheck(target, { abilityId: check.abilityId || "", threshold });
            let status = null;
            if (!checkResult.passed && resolution.onFail?.statusId) {
              status = statusEngine?.applyStatus?.(target, resolution.onFail.statusId, {
                count: Math.max(1, numberOr(resolution.onFail.count, 1)),
                potency: numberOr(resolution.onFail.potency, 0),
                duration: resolution.onFail.duration || "this_turn",
                sourceTraitId: trait.id,
                sourceUnitId: actor.id || null,
                mode: "set",
              });
            }
            return { target, check: checkResult, status };
          });
          outcomes.push({ type: "runtime_resolution", resolutionId: resolution.id || null, traitId: trait.id, resolutionType: type, resolved });
        } else if (type === "area_damage") {
          const amount = Math.max(1, Math.floor(traitFormulaValue(resolution.amountFormula ?? resolution.amount ?? 1, actor, runtime, trait)));
          const resolved = targets.map((target) => {
            const before = numberOr(target?.hp, 0);
            if (global.CombatEngine?.applyDamage) {
              global.CombatEngine.applyDamage(target, amount, resolution.damageType || "Fixed", false, { id: resolution.id || trait.id, type: "Trait", sourceTraitId: trait.id, tags: ["fixed_damage"] });
            }
            return { target, amount, before, after: numberOr(target?.hp, before) };
          });
          outcomes.push({ type: "runtime_resolution", resolutionId: resolution.id || null, traitId: trait.id, resolutionType: type, amount, resolved });
        }
      });
    });
    if (result?.outcomes && outcomes.length) result.outcomes.push(...outcomes);
    return outcomes;
  }

  function completedCheckDetail(check = {}, result = {}) {
    const total = numberOr(result.total, 0);
    const rolls = global.LuminousTheatreRolls;
    const outcome = rolls?.checkOutcome ? rolls.checkOutcome(total, check) : (Number.isFinite(Number(check.difficulty ?? check.thresholdRaw ?? check.threshold)) ? (total >= Number(check.difficulty ?? check.thresholdRaw ?? check.threshold) ? "passed" : "failed") : null);
    return {
      check: { ...(check || {}), total, result: total, finalPower: numberOr(check.finalPower, 0), passed: outcome === "passed", failed: outcome === "failed", outcome },
      total,
      outcome,
      target: check.target || check.targetUnit || null,
      rawResult: result,
    };
  }

  function emitCompletedCheck(check = {}, result = {}) {
    const detail = completedCheckDetail(check, result);
    if (typeof global.CustomEvent === "function") global.dispatchEvent(new global.CustomEvent("luminous:theatre-check-completed", { detail }));
    return detail;
  }

'''
insert_before(std, '  function precomputedLevel(unit, kind) {\n', resolver_block, "universal resolution helpers")

replace_once(
    std,
    '    const result = { passed: total >= threshold, total, threshold, abilityId: ability, coins, heads };\n',
    '    const result = { ...(request || {}), passed: total >= threshold, failed: total < threshold, total, threshold, abilityId: ability, coins, heads };\n    if (request.dispatchAfterCheck && isCurrentPlayerUnit(unit)) {\n      global.LuminousPlayerTraitRuntime?.dispatch?.("after_check", { context: "combat", self: unit, target: request.target || null, check: result });\n    }\n',
    "combat check post event",
)
replace_once(
    std,
    '          const finalResult = check ? applyCheckRetosses(rawResult, options, check) : rawResult;\n          state.activeCheck = null;\n',
    '          const finalResult = check ? applyCheckRetosses(rawResult, options, check) : rawResult;\n          if (check) emitCompletedCheck(check, finalResult);\n          state.activeCheck = null;\n',
    "animated completed check event",
)
replace_once(
    std,
    '      applyCheckRetosses(snapshot, { container, totalNode: snapshot.totalNode }, check);\n      state.activeCheck = null;\n',
    '      const finalResult = applyCheckRetosses(snapshot, { container, totalNode: snapshot.totalNode }, check);\n      emitCompletedCheck(check, finalResult);\n      state.activeCheck = null;\n',
    "legacy completed check event",
)
replace_once(
    std,
    '    advanceDamageHistory,\n  });\n',
    '    advanceDamageHistory,\n    liveCombatUnits,\n    unitDistanceFeet,\n    resolveTraitTargets,\n    resolveTraitTarget,\n    skillCheckBonus,\n    resolveTraitRuntimeResolutions,\n    completedCheckDetail,\n    emitCompletedCheck,\n  });\n',
    "export universal resolution helpers",
)

# -----------------------------------------------------------------------------
# 4. Player Trait Runtime: preserve completed checks, resolve live targets before
#    activation, run declarative resolutions for on_use/turn events.
# -----------------------------------------------------------------------------
prt = "js/player-trait-runtime.js"
replace_once(
    prt,
    '    theatreArmedCheck: null,\n    combatEngineSource: null,\n',
    '    theatreArmedCheck: null,\n    lastCompletedCheck: null,\n    theatreTarget: null,\n    combatEngineSource: null,\n',
    "player completed check state",
)
replace_once(
    prt,
    '    const level = Number(input.Level ?? input.level ?? character?.level ?? character?.characterBuild?.calculatedAtLevel ?? 0) || 0;\n    return { context, character, self, level, ...input };\n',
    '    const level = Number(input.Level ?? input.level ?? character?.level ?? character?.characterBuild?.calculatedAtLevel ?? 0) || 0;\n    const completed = context === "theatre" ? state.lastCompletedCheck : null;\n    const check = Object.prototype.hasOwnProperty.call(input, "check") ? input.check : completed?.check;\n    const target = Object.prototype.hasOwnProperty.call(input, "target") ? input.target : (completed?.target || state.theatreTarget || null);\n    const standard = global.LuminousTraitStandardizationRuntime;\n    const allies = context === "combat" && standard?.liveCombatUnits ? standard.liveCombatUnits({ self }).filter((unit) => unit !== self && Number(unit?.hp ?? 1) > 0 && String(unit?.faction ?? "") === String(self?.faction ?? "")) : [];\n    return { context, character, self, level, check, target, AliveAllies: input.AliveAllies ?? completed?.AliveAllies ?? allies.length, ...input };\n',
    "player runtime completed check context",
)

player_helpers = r'''
  function prepareTraitRuntime({ trait, runtime } = {}) {
    const resolved = getRuntime(runtime || {});
    const targetSpec = normalizeId(trait?.activation?.target || "");
    if (resolved.context !== "combat" || !targetSpec) return { runtime: resolved };
    const standard = global.LuminousTraitStandardizationRuntime;
    if (!standard?.resolveTraitTargets) return { runtime: resolved };
    const targets = standard.resolveTraitTargets(resolved.self, targetSpec, resolved);
    if (targets.length) {
      resolved.targets = targets;
      resolved.target = targets[0];
      resolved.defender = resolved.defender || resolved.target;
      return { runtime: resolved };
    }
    if (["random_enemy", "enemy", "selected_enemy", "ally"].includes(targetSpec)) {
      return { available: false, blocked: true, reason: `No live ${targetSpec.replaceAll("_", " ")} target is available.` };
    }
    return { runtime: resolved };
  }

  function recalculateCompletedCheck(result) {
    const check = result?.runtime?.check;
    if (!check?.recalculate || !state.lastCompletedCheck) return null;
    const original = state.lastCompletedCheck.check || {};
    const total = Number(original.total ?? original.result ?? 0) + Number(check.finalPower ?? 0);
    const rolls = global.LuminousTheatreRolls;
    const outcome = rolls?.checkOutcome ? rolls.checkOutcome(total, check) : (Number.isFinite(Number(check.difficulty ?? check.thresholdRaw ?? check.threshold)) ? (total >= Number(check.difficulty ?? check.thresholdRaw ?? check.threshold) ? "passed" : "failed") : null);
    const nextCheck = { ...original, ...check, total, result: total, outcome, passed: outcome === "passed", failed: outcome === "failed", recalculate: 0 };
    state.lastCompletedCheck = { ...state.lastCompletedCheck, check: nextCheck, total, outcome };
    const totalNode = doc.getElementById("roll-total-score");
    if (totalNode) {
      const safe = global.LuminousPlayerStats?.setRollTotalWithoutAdjustment?.(total, totalNode);
      if (!safe) totalNode.textContent = String(total);
    }
    emit("luminous:theatre-check-recalculated", state.lastCompletedCheck);
    return state.lastCompletedCheck;
  }

  function handleTraitActivated(result, meta = {}) {
    const runtime = result?.runtime || meta.runtime || getRuntime();
    global.LuminousTraitStandardizationRuntime?.resolveTraitRuntimeResolutions?.([meta.trait].filter(Boolean), "on_use", runtime, result);
    recalculateCompletedCheck(result);
    emit("luminous:trait-activated", result);
  }

  function recordCompletedTheatreCheck(detail = {}) {
    const check = { ...(detail.check || {}), passed: detail.outcome === "passed" || detail.check?.passed === true, failed: detail.outcome === "failed" || detail.check?.failed === true };
    state.lastCompletedCheck = { ...detail, check, target: detail.target || state.theatreTarget || null };
    dispatch("after_check", { context: "theatre", check, target: state.lastCompletedCheck.target });
    refresh();
    return state.lastCompletedCheck;
  }

  function setTheatreTarget(target) {
    state.theatreTarget = target || null;
    return state.theatreTarget;
  }

'''
insert_before(prt, '  function emit(name, detail) {\n', player_helpers, "player resolution helpers")
replace_once(
    prt,
    '        getRuntime: () => getRuntime(),\n        onActivated: (result) => emit("luminous:trait-activated", result),\n',
    '        getRuntime: () => getRuntime(),\n        prepareRuntime: prepareTraitRuntime,\n        onActivated: handleTraitActivated,\n',
    "mount tray universal preparation",
)
replace_once(
    prt,
    '  function dispatchCombatEvent(trigger, input = {}) {\n    const traitEngine = global.LuminousTraitEngine;\n    if (!traitEngine?.dispatchCombatEvent) return null;\n    if (!state.traitState) state.traitState = traitEngine.createState();\n    return traitEngine.dispatchCombatEvent(trigger, {\n      character: getCharacter(),\n      traits: resolveTraits(),\n      state: state.traitState,\n      ...(input || {}),\n    });\n  }\n',
    '  function dispatchCombatEvent(trigger, input = {}) {\n    const traitEngine = global.LuminousTraitEngine;\n    if (!traitEngine?.dispatchCombatEvent) return null;\n    if (!state.traitState) state.traitState = traitEngine.createState();\n    const runtime = getRuntime({ context: "combat", ...(input || {}) });\n    const traits = resolveTraits();\n    const result = traitEngine.dispatchCombatEvent(trigger, {\n      character: getCharacter(),\n      traits,\n      state: state.traitState,\n      ...runtime,\n    });\n    global.LuminousTraitStandardizationRuntime?.resolveTraitRuntimeResolutions?.(traits, trigger, result?.runtime || runtime, result);\n    return result;\n  }\n',
    "combat runtime resolutions",
)
replace_once(
    prt,
    '  function bootRuntime() {\n    connectFirebase();\n',
    '  function bootRuntime() {\n    global.addEventListener?.("luminous:theatre-check-completed", (event) => recordCompletedTheatreCheck(event?.detail || {}));\n    global.addEventListener?.("luminous:theatre-target-selected", (event) => setTheatreTarget(event?.detail?.target || event?.detail || null));\n    connectFirebase();\n',
    "completed check listeners",
)
replace_once(
    prt,
    '    dispatchCombatEvent,\n    installTheatreBridge,\n',
    '    dispatchCombatEvent,\n    prepareTraitRuntime,\n    recordCompletedTheatreCheck,\n    setTheatreTarget,\n    getLastCompletedCheck: () => state.lastCompletedCheck,\n    installTheatreBridge,\n',
    "export player resolution helpers",
)

# -----------------------------------------------------------------------------
# 5. Racial catalog: replace orphan flags by declarative universal resolutions.
# -----------------------------------------------------------------------------
rc = "js/racial-trait-catalog.js"
replace_once(
    rc,
    '        operations: [\n          { type: "set_flag", flagId: "kobold_cower_resolution_required", value: true },\n          { type: "log", message: "Resolve enemy Check at Threshold 8 + Deception; failures gain 1 Clash Power Down for one Turn." },\n        ],\n      }],\n      rules: [],\n    },\n',
    '        operations: [{ type: "log", message: "Enemies make the configured Check against Threshold 8 + Deception; failures gain 1 Clash Power Down for one Turn." }],\n      }],\n      rules: [],\n      resolutions: [{\n        id: "kobold_cower_enemy_checks",\n        trigger: "on_use",\n        type: "check_status",\n        targets: "all_enemies",\n        check: { thresholdBase: 8, sourceSkillId: "deception" },\n        onFail: { statusId: "clash_power_down", count: 1, duration: "this_turn" },\n      }],\n    },\n',
    "Cower concrete resolution",
)
replace_once(
    rc,
    '      effects: [{ id: "aasimar_scourge_form_start", contexts: ["combat"], trigger: "on_use", conditions: [], operations: [{ type: "apply_status", statusId: "aasimar_scourge_form", count: 6, duration: "until_removed" }, { type: "set_flag", flagId: "aasimar_scourge_aura", value: true }] }],\n',
    '      effects: [{ id: "aasimar_scourge_form_start", contexts: ["combat"], trigger: "on_use", conditions: [], operations: [{ type: "apply_status", statusId: "aasimar_scourge_form", count: 6, duration: "until_removed" }] }],\n',
    "Scourge remove orphan flag",
)
replace_once(
    rc,
    '      ],\n    },\n\n    aasimar_fallen_transformation: {\n',
    '      ],\n      resolutions: [{ id: "aasimar_scourge_aura_damage", trigger: "turn_end", type: "area_damage", targets: "self_and_all_creatures", rangeFeet: 10, whileStatus: "aasimar_scourge_form", amountFormula: "max(1, ceil(Level / 10))" }],\n    },\n\n    aasimar_fallen_transformation: {\n',
    "Scourge area resolution",
)
replace_once(
    rc,
    '      effects: [{ id: "aasimar_fallen_form_start", contexts: ["combat"], trigger: "on_use", conditions: [], operations: [{ type: "apply_status", statusId: "aasimar_fallen_form", count: 6, duration: "until_removed" }, { type: "set_flag", flagId: "aasimar_fallen_fear_check", value: true }] }],\n',
    '      effects: [{ id: "aasimar_fallen_form_start", contexts: ["combat"], trigger: "on_use", conditions: [], operations: [{ type: "apply_status", statusId: "aasimar_fallen_form", count: 6, duration: "until_removed" }] }],\n',
    "Fallen remove orphan flag",
)
replace_once(
    rc,
    '      ],\n    },\n\n    warforged_sentry_rest: {\n',
    '      ],\n      resolutions: [{\n        id: "aasimar_fallen_frightened_check",\n        trigger: "on_use",\n        type: "check_status",\n        targets: "all_other_creatures",\n        rangeFeet: 10,\n        requireCanSeeSource: true,\n        check: { abilityId: "cha", thresholdFormula: "8 + Proficiency + CharismaMod" },\n        onFail: { statusId: "frightened", count: 1, duration: "next_turn_end" },\n      }],\n    },\n\n    warforged_sentry_rest: {\n',
    "Fallen fear resolution",
)

# -----------------------------------------------------------------------------
# 6. Tests: universal equipment, target/check/status/area resolution, completed
#    check event. Add to existing suites so normal CI owns the contract.
# -----------------------------------------------------------------------------
ume_test = "tests/universal_modifier_engine.spec.js"
ume_block = r'''

test("Rabbit Form virtualizes equipment and blocks item Skills without deleting stored gear", () => {
  const unit = {
    equipment: { armor: { itemId: "plate_1", category: "heavy" }, mainHand: { id: "sword_1" } },
    statusEffects: { moonfae_rabbit_form: { id: "moonfae_rabbit_form", count: 1 } },
  };
  const hidden = modifiers.resolveEquipment(unit);
  expect(hidden).toMatchObject({ armorEquipped: false, armorCategory: "none", mainHand: null, equipmentInactive: true, disabledByStatus: "moonfae_rabbit_form" });
  expect(modifiers.canUseSkill(unit, { type: "Normal", isItemSkill: true })).toMatchObject({ usable: false, reason: "equipment_inactive" });
  expect(unit.equipment.mainHand.id).toBe("sword_1");

  delete unit.statusEffects.moonfae_rabbit_form;
  expect(modifiers.resolveEquipment(unit)).toMatchObject({ armorEquipped: true, armorCategory: "heavy", mainHand: { id: "sword_1" } });
});
'''
Path(ume_test).write_text(Path(ume_test).read_text() + ume_block)

std_test = "tests/trait_standardization_review_fixes.spec.js"
std_block = r'''

test("universal Trait target resolver selects a live random enemy rather than an ephemeral object", () => {
  const actor = { id: "moonfae", faction: "player", hp: 20 };
  const ally = { id: "ally", faction: "player", hp: 20 };
  const enemy = { id: "enemy", faction: "enemy", hp: 20, sp: 10 };
  const { api } = loadStandardizationRuntime({ combatData: { moonfae: actor, ally, enemy }, random: () => 0 });
  expect(api.resolveTraitTarget(actor, "random_enemy", { units: [actor, ally, enemy] })).toBe(enemy);
});

test("Cower resolves enemy Checks and applies canonical Clash Power Down to failures", () => {
  const actor = { id: "kobold", faction: "player", hp: 20, level: 20, stats: { carisma: 10 }, dndSkills: { deception: { value: 2 } } };
  const enemy = { id: "enemy", faction: "enemy", hp: 20, sp: 0, stats: {} };
  const { api } = loadStandardizationRuntime({ combatData: { kobold: actor, enemy }, random: () => 0.99 });
  const outcomes = api.resolveTraitRuntimeResolutions([racialCatalog.getDefinition("kobold_cower_grovel_beg")], "on_use", { context: "combat", self: actor, units: [actor, enemy] });
  expect(outcomes).toHaveLength(1);
  expect(enemy.statusEffects.clash_power_down).toMatchObject({ count: 1, duration: "this_turn" });
});

test("Fallen Aasimar resolves nearby CHA checks and applies Frightened through Status Engine", () => {
  const actor = { id: "aasimar", faction: "player", hp: 20, level: 40, proficiency: 2, stats: { carisma: 16 }, grid_pos: { x: 0, y: 0 } };
  const near = { id: "near", faction: "enemy", hp: 20, sp: 0, stats: { carisma: 10 }, grid_pos: { x: 1, y: 0 } };
  const far = { id: "far", faction: "enemy", hp: 20, sp: 0, stats: { carisma: 10 }, grid_pos: { x: 4, y: 0 } };
  const { api } = loadStandardizationRuntime({ combatData: { aasimar: actor, near, far }, random: () => 0.99 });
  api.resolveTraitRuntimeResolutions([racialCatalog.getDefinition("aasimar_fallen_transformation")], "on_use", { context: "combat", self: actor, units: [actor, near, far] });
  expect(near.statusEffects.frightened).toBeTruthy();
  expect(far.statusEffects).toBeUndefined();
});

test("Scourge aura uses CombatEngine.applyDamage only for self and creatures within 10 ft", () => {
  const actor = { id: "aasimar", faction: "player", hp: 30, level: 40, grid_pos: { x: 0, y: 0 }, statusEffects: { aasimar_scourge_form: { id: "aasimar_scourge_form", count: 1 } } };
  const near = { id: "near", faction: "enemy", hp: 30, grid_pos: { x: 2, y: 0 } };
  const far = { id: "far", faction: "enemy", hp: 30, grid_pos: { x: 3, y: 0 } };
  const combatEngine = { applyDamage(unit, amount) { unit.hp -= amount; }, initializeUnitData() {}, applyPassiveModifiers() { return {}; } };
  const { api } = loadStandardizationRuntime({ combatEngine, combatData: { aasimar: actor, near, far } });
  const outcomes = api.resolveTraitRuntimeResolutions([racialCatalog.getDefinition("aasimar_scourge_transformation")], "turn_end", { context: "combat", self: actor, units: [actor, near, far], level: 40 });
  expect(outcomes[0].amount).toBe(4);
  expect(actor.hp).toBe(26);
  expect(near.hp).toBe(26);
  expect(far.hp).toBe(30);
});

test("completed Check event preserves pass/fail data for after_check consumers", () => {
  const { window, api } = loadStandardizationRuntime();
  let detail = null;
  window.addEventListener("luminous:theatre-check-completed", (event) => { detail = event.detail; });
  api.emitCompletedCheck({ abilityId: "wis", skillId: "medicine", actionId: "stabilize", threshold: 10, target: { id: "downed" } }, { total: 12, coins: [] });
  expect(detail.check).toMatchObject({ abilityId: "wis", skillId: "medicine", actionId: "stabilize", total: 12, passed: true, failed: false });
  expect(detail.target.id).toBe("downed");
});
'''
Path(std_test).write_text(Path(std_test).read_text() + std_block)

print("Applied all remaining PR565 universal Trait integration fixes.")
