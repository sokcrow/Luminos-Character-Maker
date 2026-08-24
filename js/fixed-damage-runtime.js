(function (global) {
  "use strict";

  if (global.LuminousFixedDamageRuntime) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousFixedDamageRuntime;
    return;
  }

  const PATCH_INTERVAL_MS = 250;
  const normalizeId = (value) => String(value ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  const numberOr = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

  function normalizeDamageMode(value) {
    const id = normalizeId(value);
    return ["fixed", "fixed_damage", "fixeddamage"].includes(id) ? "fixed" : "normal";
  }

  function damageModeForSkill(skill = {}) {
    return normalizeDamageMode(skill.damageMode ?? skill.damage_mode ?? skill.damageModeType ?? skill.damage_mode_type);
  }

  function isFixedDamageSkill(skill = {}) {
    return damageModeForSkill(skill) === "fixed";
  }

  function nonReducingResistance(value) {
    return Math.max(1, numberOr(value, 1));
  }

  function nonReducingDamageTakenModifier(value) {
    return Math.min(0, numberOr(value, 0));
  }

  function fixedDefenderView(defender = {}) {
    return {
      ...defender,
      physRes: nonReducingResistance(defender.physRes),
      sinRes: nonReducingResistance(defender.sinRes),
    };
  }

  function patchCombatEngine() {
    const engine = global.CombatEngine;
    if (!engine || typeof engine.calculateCoinDamage !== "function") return false;
    if (engine.calculateCoinDamage.__luminousFixedDamageRuntime) return true;

    const originalCalculateCoinDamage = engine.calculateCoinDamage;
    function calculateCoinDamageWithFixedMode(attacker, defender, skill, coinFinalPower, isCritical, clashCount, context = null) {
      if (!isFixedDamageSkill(skill) || !defender || typeof defender !== "object") {
        return originalCalculateCoinDamage.call(this, attacker, defender, skill, coinFinalPower, isCritical, clashCount, context);
      }

      const baseEngine = this || engine;
      const defenderView = fixedDefenderView(defender);
      const engineView = Object.create(baseEngine);
      const originalPassiveModifiers = baseEngine.applyPassiveModifiers;
      const originalDefensiveLevel = baseEngine.getDefensiveLevel;
      const originalOffensiveLevel = baseEngine.getOffensiveLevel;

      if (typeof originalPassiveModifiers === "function") {
        engineView.applyPassiveModifiers = function (unit, passiveContext) {
          const actualUnit = unit === defenderView ? defender : unit;
          const modifiers = originalPassiveModifiers.call(this, actualUnit, passiveContext) || {};
          if (unit !== defenderView && actualUnit !== defender) return modifiers;
          return {
            ...modifiers,
            damage_taken_multiplier: nonReducingDamageTakenModifier(modifiers.damage_taken_multiplier),
          };
        };
      }

      if (typeof originalDefensiveLevel === "function" && typeof originalOffensiveLevel === "function") {
        engineView.getDefensiveLevel = function (unit, defensiveContext) {
          const actualUnit = unit === defenderView ? defender : unit;
          const actualContext = defensiveContext === defenderView ? defender : defensiveContext;
          const defensiveLevel = originalDefensiveLevel.call(this, actualUnit, actualContext);
          if (unit !== defenderView && actualUnit !== defender) return defensiveLevel;
          const offensiveLevel = originalOffensiveLevel.call(this, attacker, skill);
          if (!Number.isFinite(Number(defensiveLevel)) || !Number.isFinite(Number(offensiveLevel))) return defensiveLevel;
          return Math.min(Number(defensiveLevel), Number(offensiveLevel));
        };
      }

      return originalCalculateCoinDamage.call(
        engineView,
        attacker,
        defenderView,
        skill,
        coinFinalPower,
        isCritical,
        clashCount,
        context,
      );
    }

    Object.defineProperty(calculateCoinDamageWithFixedMode, "__luminousFixedDamageRuntime", { value: true });
    Object.defineProperty(calculateCoinDamageWithFixedMode, "__luminousFixedDamageOriginal", { value: originalCalculateCoinDamage });
    engine.calculateCoinDamage = calculateCoinDamageWithFixedMode;

    if (typeof engine.createSkill === "function" && !engine.createSkill.__luminousDamageModeRuntime) {
      const originalCreateSkill = engine.createSkill;
      function createSkillWithDamageMode(config = {}) {
        const skill = originalCreateSkill.call(this, config);
        if (!skill || typeof skill !== "object") return skill;
        skill.damageMode = normalizeDamageMode(config.damageMode ?? config.damage_mode);
        return skill;
      }
      Object.defineProperty(createSkillWithDamageMode, "__luminousDamageModeRuntime", { value: true });
      engine.createSkill = createSkillWithDamageMode;
    }
    return true;
  }

  function applyFixedDamage(unit, damage, options = {}) {
    const engine = options.engine || global.CombatEngine;
    const amount = Math.max(0, Math.floor(numberOr(damage, 0)));
    if (!unit || !engine || typeof engine.applyDamage !== "function") {
      return { applied: false, amount: 0, result: null };
    }

    const hpBefore = numberOr(unit.hp, 0);
    const shieldBefore = numberOr(unit.shield, 0);
    const result = engine.applyDamage(
      unit,
      amount,
      options.tipoDano || options.damageKind || "directo",
      Boolean(options.isCritical),
      options.skillUsed ?? null,
    );

    return {
      applied: true,
      amount,
      hpBefore,
      hpAfter: numberOr(unit.hp, hpBefore),
      shieldBefore,
      shieldAfter: numberOr(unit.shield, shieldBefore),
      result,
    };
  }

  function strengthModifier(character = {}) {
    const explicit = character.strengthMod ?? character.str_mod ?? character.strModifier;
    if (Number.isFinite(Number(explicit))) return Number(explicit);
    const stats = character.stats || character.dndStats || {};
    const score = [stats.fuerza, stats.strength, stats.str, character.fuerza, character.strength, character.str]
      .find((value) => Number.isFinite(Number(value)));
    return Math.floor((numberOr(score, 10) - 10) / 2);
  }

  function isStrengthSkill(skill = {}) {
    const stat = normalizeId(
      skill.scaling_stat ?? skill.scalingStat ?? skill.scaling_stat_id ?? skill.abilityId ?? skill.ability ?? skill.stat,
    );
    return ["str", "strength", "fuerza"].includes(stat);
  }

  function fixedPercentCoefficient(formula) {
    const compact = String(formula || "").replace(/\s+/g, "");
    let match = compact.match(/^StrengthMod\*([+-]?\d+(?:\.\d+)?)$/i);
    if (match) return numberOr(match[1], 2);
    match = compact.match(/^([+-]?\d+(?:\.\d+)?)\*StrengthMod$/i);
    return match ? numberOr(match[1], 2) : 2;
  }

  function resolveOnHitFixedDamage(traits = [], trigger, runtime = {}) {
    if (normalizeId(trigger) !== "on_hit" || !isStrengthSkill(runtime.skill)) return null;
    const target = runtime.target || runtime.defender || null;
    const baseDamage = Math.max(0, numberOr(runtime.damageDealt, 0));
    if (!target || baseDamage <= 0) return null;

    const character = runtime.character || runtime.attacker || runtime.self || {};
    const strengthMod = strengthModifier(character);
    let totalFixedDamage = 0;
    const components = [];

    (Array.isArray(traits) ? traits : Object.values(traits || {})).forEach((trait) => {
      const formula = trait?.mechanics?.onHitStrengthFixedDamagePercentFormula;
      if (!formula) return;
      const coefficient = fixedPercentCoefficient(formula);
      const percent = Math.max(0, strengthMod * coefficient);
      const amount = Math.max(0, Math.floor(baseDamage * percent / 100));
      if (amount <= 0) return;
      totalFixedDamage += amount;
      components.push({ traitId: trait.id || null, formula, percent, amount });
    });

    if (totalFixedDamage <= 0) return null;
    const applied = applyFixedDamage(target, totalFixedDamage, { damageKind: "directo", skillUsed: null });
    runtime.fixedDamageDealt = numberOr(runtime.fixedDamageDealt, 0) + totalFixedDamage;
    runtime.fixedDamageMode = "fixed";
    runtime.fixedDamageComponents = [...(runtime.fixedDamageComponents || []), ...components];
    return { ...applied, components };
  }

  function patchTraitStandardizationRuntime() {
    const source = global.LuminousTraitStandardizationRuntime;
    if (!source || typeof source.resolveTraitRuntimeResolutions !== "function") return false;
    if (source.__fixedDamageRuntimeBridge) return true;

    const originalResolve = source.resolveTraitRuntimeResolutions.bind(source);
    const wrapped = Object.freeze({
      ...source,
      __fixedDamageRuntimeBridge: true,
      resolveTraitRuntimeResolutions(traits = [], trigger, runtime = {}, result = null) {
        const resolved = originalResolve(traits, trigger, runtime, result);
        resolveOnHitFixedDamage(traits, trigger, runtime);
        return resolved;
      },
    });
    global.LuminousTraitStandardizationRuntime = wrapped;
    return true;
  }

  function patchAll() {
    return {
      combat: patchCombatEngine(),
      traits: patchTraitStandardizationRuntime(),
    };
  }

  const api = Object.freeze({
    normalizeDamageMode,
    damageModeForSkill,
    isFixedDamageSkill,
    nonReducingResistance,
    nonReducingDamageTakenModifier,
    patchCombatEngine,
    applyFixedDamage,
    strengthModifier,
    isStrengthSkill,
    fixedPercentCoefficient,
    resolveOnHitFixedDamage,
    patchTraitStandardizationRuntime,
    patchAll,
  });

  global.LuminousFixedDamageRuntime = api;
  patchAll();
  const timer = typeof global.setInterval === "function" ? global.setInterval(patchAll, PATCH_INTERVAL_MS) : null;
  timer?.unref?.();

  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
