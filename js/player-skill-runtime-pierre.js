(function (global) {
  "use strict";

  if (global.LuminousPierrePlayerSkillRuntime) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousPierrePlayerSkillRuntime;
    return;
  }

  const VERSION = "0.7.4-pierre-signature-1";
  const IDS = Object.freeze({
    s1: "pierre_sukseong",
    s2: "pierre_mise_en_place",
    s3: "pierre_maridaje",
    s3Evolved: "pierre_maridaje_perfecto",
  });
  const REQUIRED_CHEF_SINS = Object.freeze(["sloth", "pride"]);
  const encounterSinState = new WeakMap();

  const normalizeId = (value) => String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  const numberOr = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));

  function skillId(skill = {}) {
    return normalizeId(skill.id || skill.skillId || skill.sourceId || skill.libraryKey);
  }

  function sinAffinity(skill = {}) {
    return normalizeId(skill.sinAffinity || skill.affinity || skill.sin || skill.pecado || "sinless");
  }

  function currentCoinIndex(context = {}) {
    const coin = context.currentCoin;
    if (Number.isInteger(Number(coin?.index))) return Number(coin.index);
    const coins = context.skill?.coins || [];
    const index = coins.indexOf(coin);
    return index >= 0 ? index : null;
  }

  function statusEntry(unit = {}, id) {
    const key = normalizeId(id);
    const collection = unit.statusEffects || unit.statuses || {};
    if (Array.isArray(collection)) {
      return collection.find((entry) => normalizeId(entry?.id || entry?.status || entry?.name) === key) || null;
    }
    return collection && typeof collection === "object" ? (collection[key] || collection[id] || null) : null;
  }

  function hasStatus(unit, id) {
    const entry = statusEntry(unit, id);
    if (typeof entry === "number") return Number(entry) > 0;
    if (!entry || typeof entry !== "object") return Boolean(entry);
    return numberOr(entry.potency, 0) > 0 || numberOr(entry.count, 0) > 0 || numberOr(entry.value, 0) > 0;
  }

  function applyStatus(unit, id, { potency = 0, count = 0, sourceSkillId = null } = {}) {
    if (!unit) return null;
    const key = normalizeId(id);
    const payload = {
      potency: Math.max(0, numberOr(potency, 0)),
      count: Math.max(0, numberOr(count, 0)),
      mode: "gain",
      data: { sourceSkillId: sourceSkillId || null, sourceCharacterId: "pierre_careme_kikunae" },
    };
    if (typeof global.LuminousStatusEngine?.applyStatus === "function") {
      return global.LuminousStatusEngine.applyStatus(unit, key, payload);
    }
    if (typeof global.LuminousElementalStatusRuntime?.applyStatus === "function") {
      return global.LuminousElementalStatusRuntime.applyStatus(unit, key, payload);
    }
    if (!unit.statusEffects || typeof unit.statusEffects !== "object" || Array.isArray(unit.statusEffects)) unit.statusEffects = {};
    const current = unit.statusEffects[key] || { id: key, potency: 0, count: 0, data: {} };
    current.potency = Math.max(0, numberOr(current.potency, 0) + payload.potency);
    current.count = Math.max(0, numberOr(current.count, 0) + payload.count);
    current.data = { ...(current.data || {}), ...payload.data };
    unit.statusEffects[key] = current;
    return current;
  }

  function isPierreUnit(unit = {}, skill = null) {
    const build = unit?.characterBuild && typeof unit.characterBuild === "object" ? unit.characterBuild : {};
    if (normalizeId(build.signatureSkillCharacterId) === "pierre_careme_kikunae") return true;
    const id = skillId(skill || {});
    return [IDS.s1, IDS.s2, IDS.s3, IDS.s3Evolved].includes(id);
  }

  function stateFor(unit, create = true) {
    if (!unit || (typeof unit !== "object" && typeof unit !== "function")) return null;
    let state = encounterSinState.get(unit);
    if (!state && create) {
      state = { usedSins: new Set() };
      encounterSinState.set(unit, state);
    }
    return state || null;
  }

  function resetEncounter(unit) {
    if (!unit || (typeof unit !== "object" && typeof unit !== "function")) return false;
    encounterSinState.set(unit, { usedSins: new Set() });
    return true;
  }

  function recordUsedSin(unit, skill) {
    if (!isPierreUnit(unit, skill)) return false;
    const sin = sinAffinity(skill);
    if (!sin || sin === "sinless") return false;
    stateFor(unit, true).usedSins.add(sin);
    return true;
  }

  function usedSins(unit) {
    return [...(stateFor(unit, false)?.usedSins || [])];
  }

  function chefPassionReady(unit) {
    const used = stateFor(unit, false)?.usedSins;
    return Boolean(used && REQUIRED_CHEF_SINS.every((sin) => used.has(sin)));
  }

  function evolvedSkillDefinition() {
    const catalog = global.LuminousPlayerSignatureSkillCatalog;
    const evolved = catalog?.get?.(IDS.s3Evolved) || catalog?.DEFINITIONS?.[IDS.s3Evolved] || null;
    return evolved ? clone(evolved) : null;
  }

  function evolveSkillForUnit(unit, skill) {
    if (skillId(skill) !== IDS.s3 || !chefPassionReady(unit)) return skill;
    const evolved = evolvedSkillDefinition();
    if (!evolved) return skill;
    evolved.metadata = {
      ...(evolved.metadata || {}),
      chefPassionEvolution: true,
      evolvedFromSkillId: IDS.s3,
    };
    return evolved;
  }

  function handleSkillTrigger(tag, context = {}) {
    const skill = context.skill || {};
    const id = skillId(skill);
    const attacker = context.attacker || context.unitAttacker || null;
    const target = context.currentTarget || context.defender || null;
    const coinIndex = currentCoinIndex(context);
    const applied = [];

    if (tag === "[Heads]") context.__pierreCurrentCoinHeads = true;
    if (tag === "[Tails]") context.__pierreCurrentCoinHeads = false;

    if (tag === "[On Use]" && attacker && isPierreUnit(attacker, skill)) recordUsedSin(attacker, skill);

    if (id === IDS.s1) {
      if (tag === "[On Hit]" && coinIndex === 0 && target) {
        applyStatus(target, "rupture", { potency: 2, sourceSkillId: id });
        applied.push({ target: "target", status: "rupture", potency: 2 });
      }
      if (tag === "[Heads Hit]" && coinIndex === 1) {
        if (target) {
          applyStatus(target, "rupture", { count: 1, sourceSkillId: id });
          applied.push({ target: "target", status: "rupture", count: 1 });
        }
        if (attacker) {
          applyStatus(attacker, "haste", { count: 1, sourceSkillId: id });
          applied.push({ target: "self", status: "haste", count: 1 });
        }
      }
    }

    if (id === IDS.s2) {
      if (tag === "[Heads Hit]" && coinIndex === 0 && attacker) {
        applyStatus(attacker, "poise", { count: 2, sourceSkillId: id });
        applied.push({ target: "self", status: "poise", count: 2 });
      }
      if (tag === "[On Hit]" && coinIndex === 1 && target) {
        applyStatus(target, "bleed", { potency: 2, sourceSkillId: id });
        applied.push({ target: "target", status: "bleed", potency: 2 });
      }
      if (tag === "[Heads Hit]" && coinIndex === 2 && target) {
        applyStatus(target, "bleed", { count: 1, sourceSkillId: id });
        applied.push({ target: "target", status: "bleed", count: 1 });
      }
      if (tag === "[On Crit]" && coinIndex === 2 && attacker) {
        applyStatus(attacker, "poise", { potency: 1, sourceSkillId: id });
        applied.push({ target: "self", status: "poise", potency: 1 });
      }
    }

    if (id === IDS.s3Evolved && tag === "[On Hit]" && target) {
      if (coinIndex === 2 && hasStatus(target, "bleed")) {
        applyStatus(target, "bleed", { count: 1, sourceSkillId: id });
        applied.push({ target: "target", status: "bleed", count: 1 });
      }
      if (coinIndex === 3 && hasStatus(target, "rupture")) {
        applyStatus(target, "rupture", { count: 1, sourceSkillId: id });
        applied.push({ target: "target", status: "rupture", count: 1 });
      }
    }

    return applied.length ? applied : null;
  }

  function damageMultiplier(skill, defender, context = {}) {
    const id = skillId(skill);
    const coinIndex = currentCoinIndex(context);
    const hasBleed = hasStatus(defender, "bleed");
    const hasRupture = hasStatus(defender, "rupture");
    const heads = context.__pierreCurrentCoinHeads === true;

    if (id === IDS.s3) {
      if (coinIndex === 1 && hasBleed) return 1.10;
      if (coinIndex === 2 && hasRupture) return 1.10;
      if (coinIndex === 3 && hasBleed && hasRupture) return 1.10;
      return 1;
    }

    if (id === IDS.s3Evolved) {
      if (coinIndex === 0 && heads && hasBleed) return 1.10;
      if (coinIndex === 1 && heads && hasRupture) return 1.10;
      if (coinIndex === 4 && hasBleed && hasRupture) return 1.20;
    }
    return 1;
  }

  function install(engine = global.CombatEngine) {
    if (!engine || engine.__pierrePlayerSkillRuntime074) return Boolean(engine);

    const originalTriggerEvent = typeof engine.triggerEvent === "function" ? engine.triggerEvent : null;
    const originalTriggerEncounterStart = typeof engine.triggerEncounterStart === "function" ? engine.triggerEncounterStart : null;
    const originalResolveClash = typeof engine.resolveClash === "function" ? engine.resolveClash : null;
    const originalResolveUnilateral = typeof engine.resolveUnilateralWithCounter === "function" ? engine.resolveUnilateralWithCounter : null;
    const originalCalculateCoinDamage = typeof engine.calculateCoinDamage === "function" ? engine.calculateCoinDamage : null;

    if (originalTriggerEvent) {
      engine.triggerEvent = function (tag, context, targetsHit = []) {
        const result = originalTriggerEvent.call(this, tag, context, targetsHit);
        try { handleSkillTrigger(tag, context || {}); } catch (_) {}
        return result;
      };
    }

    if (originalTriggerEncounterStart) {
      engine.triggerEncounterStart = function (allUnits = []) {
        if (Array.isArray(allUnits)) allUnits.forEach((unit) => {
          if (isPierreUnit(unit)) resetEncounter(unit);
        });
        return originalTriggerEncounterStart.apply(this, arguments);
      };
    }

    if (originalResolveClash) {
      engine.resolveClash = function (unitA, skillA, unitB, skillB) {
        const nextA = evolveSkillForUnit(unitA, skillA);
        const nextB = evolveSkillForUnit(unitB, skillB);
        return originalResolveClash.call(this, unitA, nextA, unitB, nextB);
      };
    }

    if (originalResolveUnilateral) {
      engine.resolveUnilateralWithCounter = function (unitAttacker, attackSkill, unitDefender, counterSkill, options = {}) {
        const evolvedAttack = evolveSkillForUnit(unitAttacker, attackSkill);
        const evolvedCounter = counterSkill ? evolveSkillForUnit(unitDefender, counterSkill) : counterSkill;
        return originalResolveUnilateral.call(this, unitAttacker, evolvedAttack, unitDefender, evolvedCounter, options);
      };
    }

    if (originalCalculateCoinDamage) {
      engine.calculateCoinDamage = function (attacker, defender, skill, coinFinalPower, isCritical, clashCount, context = null) {
        const baseDamage = originalCalculateCoinDamage.call(this, attacker, defender, skill, coinFinalPower, isCritical, clashCount, context);
        const multiplier = damageMultiplier(skill, defender, context || {});
        return Math.max(0, Math.floor(numberOr(baseDamage, 0) * multiplier));
      };
    }

    Object.defineProperty(engine, "__pierrePlayerSkillRuntime074", { value: true, configurable: true });
    return true;
  }

  const api = Object.freeze({
    version: VERSION,
    IDS,
    REQUIRED_CHEF_SINS,
    hasStatus,
    isPierreUnit,
    resetEncounter,
    recordUsedSin,
    usedSins,
    chefPassionReady,
    evolveSkillForUnit,
    handleSkillTrigger,
    damageMultiplier,
    install,
  });

  global.LuminousPierrePlayerSkillRuntime = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;

  install();
})(typeof window !== "undefined" ? window : globalThis);
