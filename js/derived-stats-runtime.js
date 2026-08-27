(function (global) {
  "use strict";

  if (global.LuminousDerivedStatsRuntime) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousDerivedStatsRuntime;
    return;
  }

  const doc = global.document || null;
  let engine = global.LuminousDerivedStats || (typeof require === "function" ? (() => {
    try { return require("./derived-stats-engine.js"); } catch (_) { return null; }
  })() : null);
  const patched = new WeakSet();
  let loaderStarted = false;

  function ensureEngine() {
    if (global.LuminousDerivedStats) {
      engine = global.LuminousDerivedStats;
      return engine;
    }
    if (engine) return engine;
    if (!doc || loaderStarted) return null;
    loaderStarted = true;
    let script = doc.getElementById("derived-stats-engine-script");
    if (!script) {
      script = doc.createElement("script");
      script.id = "derived-stats-engine-script";
      script.src = "js/derived-stats-engine.js";
      script.async = false;
      script.dataset.engine = "derived-stats-v1";
      doc.head?.appendChild(script);
    }
    script.addEventListener?.("load", () => {
      engine = global.LuminousDerivedStats || engine;
      install();
    }, { once: true });
    return null;
  }

  function characterData(value) {
    if (value && typeof value === "object") return value;
    return global.datosJugador || global.currentPlayerData || {};
  }

  function traitsFor(character, options = {}) {
    if (Array.isArray(options.traits)) return options.traits;
    if (Array.isArray(character?.traitDefinitions)) return character.traitDefinitions;
    if (Array.isArray(character?.traits) && character.traits.every((entry) => entry && typeof entry === "object")) return character.traits;
    try { return global.LuminousPlayerTraitRuntime?.getTraits?.() || []; } catch (_) { return []; }
  }

  function snapshot(character, options = {}) {
    const api = ensureEngine();
    if (!api) return null;
    const data = characterData(character);
    return api.resolveCharacterStats(data, {
      ...options,
      traits: traitsFor(data, options),
      unit: options.unit || data,
    });
  }

  function installPlayerStats() {
    const current = global.LuminousPlayerStats;
    const api = ensureEngine();
    if (!current || !api || patched.has(current)) return false;
    const original = current;
    const wrapped = Object.freeze({
      ...original,
      __derivedStatsV1: true,
      abilityModifier: api.abilityModifier,
      proficiencyBonus: api.proficiencyBonus,
      abilityScore(ability, data) {
        const id = api.abilityId(ability?.id || ability?.key || ability);
        return snapshot(data)?.abilities?.[id]?.score ?? original.abilityScore?.(ability, data) ?? 10;
      },
      abilityRollMath(ability, data) {
        const legacy = original.abilityRollMath?.(ability, data) || {};
        const id = api.abilityId(ability?.id || ability?.key || ability);
        const resolved = snapshot(data);
        const abilitySnapshot = resolved?.abilities?.[id];
        if (!abilitySnapshot) return legacy;
        const proficiency = resolved.proficiency.bonus;
        const proficiencyValue = Number.isFinite(Number(legacy.proficiencyValue)) ? Number(legacy.proficiencyValue) : 0;
        return {
          ...legacy,
          score: abilitySnapshot.score,
          modifier: abilitySnapshot.modifier,
          proficiency,
          proficiencyValue,
          base: abilitySnapshot.modifier + proficiencyValue,
        };
      },
      combatLevelBreakdown(kind, data) {
        const resolved = snapshot(data);
        const value = kind === "defensive" ? resolved?.defensiveLevel : resolved?.offensiveLevel;
        return value ? { ...value } : original.combatLevelBreakdown?.(kind, data);
      },
      currentHp(data) {
        return snapshot(data)?.hp?.current ?? original.currentHp?.(data) ?? 0;
      },
      maxHp(data) {
        return snapshot(data)?.hp?.max ?? original.maxHp?.(data) ?? 0;
      },
    });
    patched.add(current);
    global.LuminousPlayerStats = wrapped;
    return true;
  }

  function dmPreviewCharacter(studio, baseStats, input) {
    const selected = global.document?.getElementById?.("dm-player-dnd-select")?.value || "";
    const stored = studio?.getPlayer?.(selected) || {};
    return {
      ...stored,
      baseStats: { ...(baseStats || {}) },
      characterBuild: {
        ...(stored.characterBuild || {}),
        baseStats: { ...(baseStats || {}) },
        raceId: input?.raceId ?? stored.characterBuild?.raceId,
        raceSubtypeId: input?.raceSubtypeId ?? stored.characterBuild?.raceSubtypeId,
        racialStatChoices: input?.racialStatChoices ?? stored.characterBuild?.racialStatChoices ?? [],
      },
    };
  }

  function installDmStudio() {
    const current = global.LuminousDmPlayerDndStudio;
    const api = ensureEngine();
    if (!current || !api || patched.has(current)) return false;
    const original = current;
    const wrapped = Object.freeze({
      ...original,
      __derivedStatsV1: true,
      abilityModifier: api.abilityModifier,
      proficiencyBonus: api.proficiencyBonus,
      resolveEffectiveStats(baseStats, input) {
        const character = dmPreviewCharacter(original, baseStats || original.baseStatsFromForm?.(), input || original.racialStatInput?.());
        return { ...api.resolveCharacterStats(character).persistentEffectiveStats };
      },
      effectiveAbilityScore(abilityId) {
        const base = original.baseStatsFromForm?.() || {};
        const input = original.racialStatInput?.() || {};
        const character = dmPreviewCharacter(original, base, input);
        return api.resolveAbility(character, abilityId)?.score ?? original.effectiveAbilityScore?.(abilityId) ?? 10;
      },
      combatBreakdown(player, kind, levelOverride) {
        const character = { ...(player || {}) };
        if (levelOverride != null) character.level = levelOverride;
        const resolved = api.resolveCharacterStats(character);
        const value = kind === "defensive" ? resolved.defensiveLevel : resolved.offensiveLevel;
        return { ...value };
      },
    });
    patched.add(current);
    global.LuminousDmPlayerDndStudio = wrapped;
    return true;
  }

  function installNpcStats() {
    const current = global.LuminousNpcStats;
    const api = ensureEngine();
    if (!current || !api || patched.has(current)) return false;
    const original = current;
    const wrapped = Object.freeze({
      ...original,
      __derivedStatsV1: true,
      abilityModifier: api.abilityModifier,
      abilityRollMath(abilityId, npc) {
        const data = npc || {};
        const proficiencyOverride = Number.isFinite(Number(data.proficiencyBonus)) ? Number(data.proficiencyBonus) : undefined;
        const resolved = api.resolveCharacterStats(data, { proficiencyBonusOverride: proficiencyOverride });
        const id = api.abilityId(abilityId);
        const ability = resolved.abilities[id];
        if (!ability) return original.abilityRollMath?.(abilityId, npc);
        const legacy = original.abilityRollMath?.(abilityId, npc) || {};
        return {
          ...legacy,
          score: ability.score,
          modifier: ability.modifier,
          proficiency: resolved.proficiency.bonus,
        };
      },
    });
    patched.add(current);
    global.LuminousNpcStats = wrapped;
    return true;
  }

  function combatSkillScaling(unit, skill) {
    if (!skill) return 0;
    if (skill.scaling_stat && unit?.stats) return Number(unit.stats[skill.scaling_stat]) || 0;
    return Number(skill.offenseModifier ?? skill.defenseModifier ?? 0) || 0;
  }

  function installCombat() {
    const combat = global.CombatEngine;
    const api = ensureEngine();
    if (!combat || !api || patched.has(combat)) return false;
    const originalOff = typeof combat.getOffensiveLevel === "function" ? combat.getOffensiveLevel.bind(combat) : null;
    const originalDef = typeof combat.getDefensiveLevel === "function" ? combat.getDefensiveLevel.bind(combat) : null;

    if (originalOff) {
      combat.getOffensiveLevel = function derivedOffensiveLevel(unit, skill) {
        try {
          const resolved = api.resolveCharacterStats(unit || {}, { unit, skill, traits: traitsFor(unit || {}) });
          const scaling = combatSkillScaling(unit, skill);
          const resonance = Number(skill?.resonance || skill?.resonanceModifier || 0) || 0;
          return Math.max(1, resolved.offensiveLevel.total + scaling + resonance);
        } catch (_) {
          return originalOff(unit, skill);
        }
      };
    }

    if (originalDef) {
      combat.getDefensiveLevel = function derivedDefensiveLevel(unit, skillOrPart) {
        try {
          const resolved = api.resolveCharacterStats(unit || {}, { unit, skill: skillOrPart, traits: traitsFor(unit || {}) });
          const scaling = combatSkillScaling(unit, skillOrPart);
          return Math.max(1, resolved.defensiveLevel.total + scaling);
        } catch (_) {
          return originalDef(unit, skillOrPart);
        }
      };
    }

    Object.defineProperty(combat, "__derivedStatsV1", { value: true, configurable: true });
    patched.add(combat);
    return true;
  }

  function syncVisibleStats() {
    const api = ensureEngine();
    if (!api || !doc) return false;
    const player = global.datosJugador;
    if (player) {
      const resolved = snapshot(player);
      const panel = doc.querySelector?.("#stats-modal .player-ability-console");
      if (panel && resolved) {
        Object.values(resolved.abilities).forEach((ability) => {
          const box = panel.querySelector?.(`[data-stat-id="${ability.id}"]`);
          const score = box?.querySelector?.("[data-stat-score]");
          const mod = box?.querySelector?.("[data-stat-modifier]");
          if (score) score.textContent = String(ability.score);
          if (mod) mod.textContent = ability.modifier >= 0 ? `+${ability.modifier}` : String(ability.modifier);
        });
        const off = panel.querySelector?.('[data-combat-level="offensive"]');
        const def = panel.querySelector?.('[data-combat-level="defensive"]');
        if (off) off.textContent = String(resolved.offensiveLevel.total);
        if (def) def.textContent = String(resolved.defensiveLevel.total);
      }
    }
    return true;
  }

  function install() {
    if (!ensureEngine()) return false;
    const results = [installPlayerStats(), installDmStudio(), installNpcStats(), installCombat()];
    syncVisibleStats();
    return results.some(Boolean) || true;
  }

  const api = Object.freeze({
    ensureEngine,
    snapshot,
    installPlayerStats,
    installDmStudio,
    installNpcStats,
    installCombat,
    syncVisibleStats,
    install,
  });

  global.LuminousDerivedStatsRuntime = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;

  if (doc) {
    install();
    global.setInterval?.(install, 500);
  }
})(typeof window !== "undefined" ? window : globalThis);
