(function (global) {
  "use strict";
  if (global.LuminousCheckTraitBonusRuntime) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousCheckTraitBonusRuntime;
    return;
  }

  const numberOr = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const normalizeId = (value) => String(value ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  const baseId = (trait) => normalizeId(trait?.baseTraitId || String(trait?.id || "").split("__")[0]);
  const hasTrait = (traits, id) => (traits || []).some((trait) => baseId(trait) === id);
  const abilityId = (value) => ({
    strength: "str", fuerza: "str", str: "str", dexterity: "dex", destreza: "dex", dex: "dex",
    constitution: "con", constitucion: "con", con: "con", intelligence: "int", inteligencia: "int", int: "int",
    wisdom: "wis", sabiduria: "wis", wis: "wis", charisma: "cha", carisma: "cha", cha: "cha",
  })[normalizeId(value)] || normalizeId(value);
  const proficiencyState = (character, id, kind = "skill") => {
    const field = kind === "save" ? character?.abilityProficiency : character?.skillProficiency;
    const stored = kind === "save" ? character?.dndAbilities?.[id] : character?.dndSkills?.[id];
    return normalizeId(field?.[id] || stored?.proficiency || stored?.proficiencyState || "none");
  };
  const proficiencyBonus = (character) =>
    global.LuminousProficiencyRuntime?.proficiencyBonus?.(character?.level) ??
    Math.max(1, Math.ceil(numberOr(character?.level, 1) / 20));
  const score = (character, id) => {
    const key = { str: "fuerza", dex: "destreza", con: "constitucion", int: "inteligencia", wis: "sabiduria", cha: "carisma" }[id];
    const derived = global.LuminousDerivedStats?.resolveAbility?.(character, id);
    return Number(derived?.score ?? character?.stats?.[key] ?? character?.stats?.[id] ?? 10);
  };
  const modifier = (character, id) => Math.floor((score(character, id) - 10) / 2);
  const contribution = (before, after, name, results) => {
    const amount = numberOr(after?.finalPower) - numberOr(before?.finalPower);
    if (amount) results.push({ traitId: name, name, amount, channel: "final_power" });
  };

  // These are conditional class/archetype mechanics authored in mechanics rather than
  // in the generic Trait Engine's effects/rules; apply to Check Final Power exactly once.
  function applyClassCheckBonuses(checkInput = {}, character = {}, traits = []) {
    const check = { ...checkInput };
    if (check.__classCheckBonusesApplied) return { check, contributions: [] };
    const contributions = [];
    const kind = normalizeId(check.kind || check.checkKind || check.type);
    const stat = abilityId(check.abilityId || check.statId || check.ability);
    const skill = normalizeId(check.skillId || check.skill || check.actionId);
    const apply = (id, title, fn) => {
      if (!hasTrait(traits, id)) return;
      const previous = { ...check };
      const adjusted = fn(check, character);
      if (adjusted && adjusted !== check) Object.assign(check, adjusted);
      contribution(previous, check, title, contributions);
    };

    apply("remarkable_athlete", "Remarkable Athlete", (current, actor) => {
      if (!["str", "dex", "con"].includes(stat)) return current;
      return global.LuminousChampionArchetypeRuntime?.applyRemarkableAthleteCheck?.(current, actor)
        || { ...current, finalPower: numberOr(current.finalPower) + 1 };
    });
    apply("royal_envoy", "Royal Envoy", (current, actor) => {
      if (skill !== "persuasion") return current;
      const runtime = global.LuminousBanneretArchetypeRuntime;
      if (runtime?.applyRoyalEnvoyCheck) return runtime.applyRoyalEnvoyCheck(current, actor);
      const state = proficiencyState(actor, "persuasion");
      const newMultiplier = state === "expertise" ? 2 : state === "proficient" ? 2 : 1;
      const oldMultiplier = state === "expertise" ? 2 : state === "proficient" ? 1 : state === "half" ? 0.5 : 0;
      return { ...current, finalPower: numberOr(current.finalPower) + Math.floor(proficiencyBonus(actor) * (newMultiplier - oldMultiplier)) };
    });
    apply("elegant_courtier", "Elegant Courtier", (current, actor) => {
      const runtime = global.LuminousSamuraiArchetypeRuntime;
      if (runtime?.applyElegantCourtierCheck) return runtime.applyElegantCourtierCheck(current, actor);
      let bonus = skill === "persuasion" ? modifier(actor, "wis") : 0;
      if (kind === "save") {
        const wisProficient = ["proficient", "expertise"].includes(proficiencyState(actor, "wis", "save"));
        const choice = normalizeId(actor?.traitChoices?.elegant_courtier_save);
        const chosen = wisProficient ? choice : "wis";
        if (chosen && stat === chosen && !["proficient", "expertise"].includes(proficiencyState(actor, chosen, "save"))) bonus += proficiencyBonus(actor);
      }
      return { ...current, finalPower: numberOr(current.finalPower) + bonus };
    });
    apply("bladesong", "Bladesong", (current, actor) => {
      if (skill !== "acrobatics") return current;
      return global.LuminousBladesingerArchetypeRuntime?.applyAcrobaticsBonus?.(current, actor) || current;
    });

    // Training in War and Song grants Performance Proficiency on acquisition.
    // A fresh player record can have the Trait before its stored proficiency
    // has been synchronized, so calculate the missing step from the Trait.
    if (skill === "performance" && hasTrait(traits, "training_in_war_and_song")) {
      const state = proficiencyState(character, "performance");
      const oldMultiplier = state === "expertise" ? 2 : state === "proficient" ? 1 : state === "half" ? 0.5 : 0;
      const bonus = Math.floor(proficiencyBonus(character) * (1 - Math.min(1, oldMultiplier)));
      if (bonus) {
        check.checkPower = numberOr(check.checkPower) + bonus;
        contributions.push({ traitId: "training_in_war_and_song", name: "Training in War and Song", amount: bonus, channel: "check_power" });
      }
    }

    // Rogue's class wrapper sets finalPowerBonus, not finalPower. The Coin Check
    // completion runtime only consumes finalPower, so normalize that channel.
    if (hasTrait(traits, "reliable_talent") && !global.LuminousTraitEngine?.__rogueClassRuntimeWrapped) {
      const state = proficiencyState(character, skill, "skill");
      if (kind === "skill" && ["proficient", "expertise"].includes(state)) {
        check.finalPower = numberOr(check.finalPower) + 3;
        contributions.push({ traitId: "reliable_talent", name: "Reliable Talent", amount: 3, channel: "final_power" });
      }
    }
    const extra = numberOr(check.finalPowerBonus);
    if (extra && !check.__finalPowerBonusFolded) {
      check.finalPower = numberOr(check.finalPower) + extra;
      contributions.push({ traitId: "legacy_final_power_bonus", name: "Bonos de Final Power", amount: extra, channel: "final_power" });
      check.__finalPowerBonusFolded = true;
    }
    check.__classCheckBonusesApplied = true;
    return { check, contributions };
  }

  function canonicalCharacter(character = {}, traits = []) {
    const derived = global.LuminousDerivedStats?.resolveCharacterStats?.(character, { traits });
    if (!derived?.effectiveStats) return character;
    return { ...character, stats: { ...character.stats, ...derived.effectiveStats } };
  }

  function resolveCheck(engine, traits = [], character = {}, check = {}) {
    const resolvedCharacter = canonicalCharacter(character, traits);
    const resolved = engine?.resolveTheatreCheck?.({
      character: resolvedCharacter, traits, check: { ...check },
      state: engine?.createState?.(),
    }) || { check: { ...check }, outcomes: [] };
    const special = applyClassCheckBonuses(resolved.check || check, resolvedCharacter, traits);
    return { check: special.check, outcomes: resolved.outcomes || [], specialContributions: special.contributions };
  }

  // Never call resolveTheatreCheck merely to draw a Skill: the real engine may
  // consume once-per-rest resources (e.g. Orosh Fragmented Blessing). Only
  // declarative pure previews and deterministic passive class bonuses belong here.
  function previewCheck(engine, traits = [], character = {}, checkInput = {}) {
    const actor = canonicalCharacter(character, traits);
    const check = { abilityPower: 0, checkPower: 0, power: 0, finalPower: 0, ...checkInput };
    const bridge = global.LuminousSkillTraitBreakdownPatch;
    const checkContributions = bridge?.checkPowerContributions?.(engine, traits, actor, checkInput) || [];
    const finalContributions = bridge?.finalPowerContributions?.(engine, traits, actor, checkInput) || [];
    check.checkPower = checkContributions.reduce((sum, entry) => sum + numberOr(entry.amount), 0);
    check.finalPower = finalContributions.reduce((sum, entry) => sum + numberOr(entry.amount), 0);
    const specials = applyClassCheckBonuses(check, actor, traits);
    const adjusted = specials.check;
    const contributions = [...specials.contributions];
    const id = normalizeId(checkInput.skillId || checkInput.skill);
    const kind = normalizeId(checkInput.kind);
    const prof = proficiencyState(actor, kind === "skill" ? id : abilityId(checkInput.abilityId), kind === "skill" ? "skill" : "save");
    if (hasTrait(traits, "reliable_talent") && kind === "skill" && ["proficient", "expertise"].includes(prof)) {
      adjusted.finalPower += 3;
      contributions.push({ traitId: "reliable_talent", name: "Reliable Talent", amount: 3, channel: "final_power" });
    }
    if (hasTrait(traits, "jack_of_all_trades") && prof === "none") {
      const amount = Math.max(0, Math.floor(proficiencyBonus(actor) / 2));
      if (amount) {
        adjusted.finalPower += amount;
        contributions.push({ traitId: "jack_of_all_trades", name: "Jack of All Trades", amount, channel: "final_power" });
      }
    }
    return { check: adjusted, checkContributions, finalContributions, specialContributions: contributions };
  }

  const api = Object.freeze({
    baseId, hasTrait, abilityId, canonicalCharacter, applyClassCheckBonuses, previewCheck, resolveCheck,
  });
  global.LuminousCheckTraitBonusRuntime = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
