(function (global) {
  "use strict";

  const ABILITIES = Object.freeze([
    Object.freeze({ id: "str", key: "fuerza", code: "STR", name: "STRENGTH", spanish: "Fuerza", skills: Object.freeze([
      Object.freeze({ id: "athletics", name: "Athletics", spanish: "Atletismo" }),
    ]) }),
    Object.freeze({ id: "dex", key: "destreza", code: "DEX", name: "DEXTERITY", spanish: "Destreza", skills: Object.freeze([
      Object.freeze({ id: "acrobatics", name: "Acrobatics", spanish: "Acrobacias" }),
      Object.freeze({ id: "sleight_of_hand", name: "Sleight of Hand", spanish: "Juego de Manos" }),
      Object.freeze({ id: "stealth", name: "Stealth", spanish: "Sigilo" }),
    ]) }),
    Object.freeze({ id: "con", key: "constitucion", code: "CON", name: "CONSTITUTION", spanish: "Constitución", skills: Object.freeze([]) }),
    Object.freeze({ id: "int", key: "inteligencia", code: "INT", name: "INTELLIGENCE", spanish: "Inteligencia", skills: Object.freeze([
      Object.freeze({ id: "arcana", name: "Arcana", spanish: "Arcanos" }),
      Object.freeze({ id: "history", name: "History", spanish: "Historia" }),
      Object.freeze({ id: "investigation", name: "Investigation", spanish: "Investigación" }),
      Object.freeze({ id: "nature", name: "Nature", spanish: "Naturaleza" }),
      Object.freeze({ id: "religion", name: "Religion", spanish: "Religión" }),
    ]) }),
    Object.freeze({ id: "wis", key: "sabiduria", code: "WIS", name: "WISDOM", spanish: "Sabiduría", skills: Object.freeze([
      Object.freeze({ id: "animal_handling", name: "Animal Handling", spanish: "Trato con Animales" }),
      Object.freeze({ id: "insight", name: "Insight", spanish: "Perspicacia" }),
      Object.freeze({ id: "medicine", name: "Medicine", spanish: "Medicina" }),
      Object.freeze({ id: "perception", name: "Perception", spanish: "Percepción" }),
      Object.freeze({ id: "survival", name: "Survival", spanish: "Supervivencia" }),
    ]) }),
    Object.freeze({ id: "cha", key: "carisma", code: "CHA", name: "CHARISMA", spanish: "Carisma", skills: Object.freeze([
      Object.freeze({ id: "deception", name: "Deception", spanish: "Engaño" }),
      Object.freeze({ id: "intimidation", name: "Intimidation", spanish: "Intimidación" }),
      Object.freeze({ id: "performance", name: "Performance", spanish: "Interpretación" }),
      Object.freeze({ id: "persuasion", name: "Persuasion", spanish: "Persuasión" }),
    ]) }),
  ]);

  const PROFICIENCY_STATES = Object.freeze({
    none: Object.freeze({ label: "Not Proficient", multiplier: 0 }),
    half: Object.freeze({ label: "Half Proficient", multiplier: 0.5 }),
    proficient: Object.freeze({ label: "Proficient", multiplier: 1 }),
    expertise: Object.freeze({ label: "Expertise", multiplier: 2 }),
  });

  function manager() {
    const value = global.LuminousCharacterManager;
    if (!value) throw new Error("LuminousCharacterManager no está disponible.");
    return value;
  }

  function database() {
    const db = global.firebase?.database?.();
    if (!db?.ref) throw new Error("Firebase Realtime Database no está disponible.");
    return db;
  }

  function numberOr(value, fallback = 0) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
  }

  function integerOr(value, fallback = 0) {
    const numeric = Number.parseInt(value, 10);
    return Number.isFinite(numeric) ? numeric : fallback;
  }

  function normalizeProficiencyState(value) {
    const normalized = String(value || "none").trim().toLowerCase();
    return Object.prototype.hasOwnProperty.call(PROFICIENCY_STATES, normalized) ? normalized : "none";
  }

  function abilityModifier(score) {
    return Math.floor((numberOr(score, 10) - 10) / 2);
  }

  function proficiencyContribution(proficiencyBonus, state) {
    const definition = PROFICIENCY_STATES[normalizeProficiencyState(state)];
    return Math.floor(Math.max(0, numberOr(proficiencyBonus, 0)) * definition.multiplier);
  }

  function headsChanceFromSp(sp) {
    return Math.max(5, Math.min(95, 50 + integerOr(sp, 0)));
  }

  function normalizeProfile(actor = {}) {
    const statsSource = actor.stats || actor.dndStats || {};
    const abilitySource = actor.abilityProficiency || actor.abilityProficiencies || {};
    const skillSource = actor.skillProficiency || actor.skillProficiencies || actor.dndSkillProficiency || {};
    const stats = {};
    const abilityProficiency = {};
    const skillProficiency = {};

    ABILITIES.forEach((ability) => {
      stats[ability.key] = Math.max(1, Math.min(30, integerOr(statsSource[ability.key], 10)));
      abilityProficiency[ability.id] = normalizeProficiencyState(abilitySource[ability.id] ?? abilitySource[ability.key]);
      ability.skills.forEach((skill) => {
        const nested = actor.dndSkills?.[skill.id];
        skillProficiency[skill.id] = normalizeProficiencyState(
          skillSource[skill.id] ?? nested?.proficiency ?? nested?.proficiencyState,
        );
      });
    });

    const proficiencyBonus = Math.max(0, Math.min(20, integerOr(
      actor.proficiencyBonus ?? actor.dndProficiencyBonus ?? actor.dnd?.proficiencyBonus,
      1,
    )));
    const sp = Math.max(-100, Math.min(100, integerOr(
      actor.combat_stats?.sp ?? actor.combatStats?.sp_actual ?? actor.sp,
      0,
    )));

    return { stats, proficiencyBonus, abilityProficiency, skillProficiency, sp };
  }

  function abilityById(abilityId) {
    return ABILITIES.find((ability) => ability.id === abilityId || ability.key === abilityId) || null;
  }

  function skillById(skillId) {
    for (const ability of ABILITIES) {
      const skill = ability.skills.find((entry) => entry.id === skillId);
      if (skill) return { ability, skill };
    }
    return null;
  }

  function abilityRollMath(profile, abilityId) {
    const normalized = normalizeProfile(profile?.stats ? {
      stats: profile.stats,
      proficiencyBonus: profile.proficiencyBonus,
      abilityProficiency: profile.abilityProficiency,
      skillProficiency: profile.skillProficiency,
      sp: profile.sp,
    } : profile || {});
    const ability = abilityById(abilityId);
    if (!ability) return null;
    const score = normalized.stats[ability.key];
    const modifier = abilityModifier(score);
    const state = normalizeProficiencyState(normalized.abilityProficiency[ability.id]);
    const proficiencyValue = proficiencyContribution(normalized.proficiencyBonus, state);
    return { ability, score, modifier, state, proficiencyValue, base: modifier + proficiencyValue };
  }

  function skillValue(profile, skillId) {
    const normalized = normalizeProfile(profile?.stats ? {
      stats: profile.stats,
      proficiencyBonus: profile.proficiencyBonus,
      abilityProficiency: profile.abilityProficiency,
      skillProficiency: profile.skillProficiency,
      sp: profile.sp,
    } : profile || {});
    const found = skillById(skillId);
    if (!found) return null;
    const state = normalizeProficiencyState(normalized.skillProficiency[found.skill.id]);
    const modifier = abilityModifier(normalized.stats[found.ability.key]);
    const proficiencyValue = proficiencyContribution(normalized.proficiencyBonus, state);
    return {
      ability: found.ability,
      skill: found.skill,
      state,
      modifier,
      proficiencyValue,
      base: modifier + proficiencyValue,
    };
  }

  function canDmControl(record) {
    return Boolean(record?.actorId && record?.actor && !record?.playerId);
  }

  function profileForActor(actorId) {
    const record = manager().getActor(actorId);
    if (!record) return null;
    return { record, profile: normalizeProfile(record.actor) };
  }

  function rollDefinition(actorId, options = {}) {
    const resolved = profileForActor(actorId);
    if (!resolved || !canDmControl(resolved.record)) return null;
    const profile = resolved.profile;
    const kind = String(options.kind || "ability").toLowerCase();
    const ability = abilityById(options.abilityId) || ABILITIES[0];
    let base = 0;
    let label = ability.name;

    if (kind === "skill") {
      const skillMath = skillValue(profile, options.skillId);
      if (!skillMath) return null;
      base = skillMath.base;
      label = skillMath.skill.name;
    } else {
      const math = abilityRollMath(profile, ability.id);
      base = math?.base ?? 0;
      label = kind === "save" ? `${ability.name} Saving Throw` : ability.name;
    }

    return {
      actorId,
      actor: resolved.record.actor,
      record: resolved.record,
      kind,
      ability,
      skillId: kind === "skill" ? options.skillId : null,
      label,
      base,
      sp: profile.sp,
      headsChance: headsChanceFromSp(profile.sp),
      profile,
    };
  }

  async function saveActorProfile(actorId, profile) {
    const record = manager().getActor(actorId);
    if (!record) throw new Error(`Actor no encontrado: ${actorId}`);
    if (!canDmControl(record)) throw new Error("Los Stats NPC solo pueden editarse mientras el actor no tenga jugador asignado.");

    const normalized = normalizeProfile(profile || {});
    const path = `${record.root}/${actorId}`;
    const updates = {
      [`${path}/stats`]: normalized.stats,
      [`${path}/proficiencyBonus`]: normalized.proficiencyBonus,
      [`${path}/abilityProficiency`]: normalized.abilityProficiency,
      [`${path}/skillProficiency`]: normalized.skillProficiency,
      [`${path}/combat_stats/sp`]: normalized.sp,
      [`${path}/dndProfileVersion`]: 1,
    };
    await database().ref().update(updates);
    return normalized;
  }

  global.LuminousNpcStats = Object.freeze({
    ABILITIES,
    PROFICIENCY_STATES,
    normalizeProficiencyState,
    normalizeProfile,
    abilityModifier,
    proficiencyContribution,
    headsChanceFromSp,
    abilityById,
    skillById,
    abilityRollMath,
    skillValue,
    canDmControl,
    profileForActor,
    rollDefinition,
    saveActorProfile,
  });
})(window);
