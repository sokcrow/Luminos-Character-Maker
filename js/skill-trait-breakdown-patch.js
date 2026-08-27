(function (global) {
  "use strict";
  if (global.LuminousSkillTraitBreakdownPatch) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousSkillTraitBreakdownPatch;
    return;
  }

  const doc = global.document || null;
  const PLAYER_ROOT = "campaña/jugadores";
  const DEFINITIONS_ROOT = "campaña/config/traits/definitions";
  const GRANTS_ROOT = "campaña/config/traits/grants";
  const state = { db: null, definitions: {}, grants: {}, playerId: "", player: null, playerRef: null, playerListener: null, definitionsBound: false, grantsBound: false };
  const normalizeId = (value) => String(value ?? "").trim().toLowerCase().replace(/\s+/g, "_");
  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
  const numberOr = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const integerOr = (value, fallback = 0) => Number.isFinite(Number.parseInt(value, 10)) ? Number.parseInt(value, 10) : fallback;
  const formatSigned = (value) => numberOr(value, 0) >= 0 ? `+${numberOr(value, 0)}` : String(numberOr(value, 0));

  function relevantCheckTrait(engine, trait = {}) {
    if (!engine?.normalizeTrait) return null;
    const normalized = engine.normalizeTrait(trait);
    const relevantOperation = (operation) => normalizeId(operation?.type) === "modify" && normalizeId(operation?.path) === "check.finalpower";
    normalized.effects = (normalized.effects || []).map((effect) => ({ ...effect, operations: (effect.operations || []).filter(relevantOperation) }))
      .filter((effect) => ["passive", "before_check"].includes(normalizeId(effect.trigger)) && effect.operations.length);
    normalized.rules = (normalized.rules || []).filter((rule) => normalizeId(rule?.type) === "modifier" && ["passive", "before_check"].includes(normalizeId(rule?.trigger)) && normalizeId(rule?.path) === "check.finalpower");
    normalized.resolutions = [];
    return normalized.effects.length || normalized.rules.length ? normalized : null;
  }

  function traitCheckContribution(engine, trait = {}, character = {}, check = {}) {
    const preview = relevantCheckTrait(engine, trait);
    if (!preview || !engine?.dispatchTrait || !engine?.createState) return 0;
    const runtime = { context: "theatre", character: clone(character) || {}, self: clone(character) || {}, check: { abilityPower: 0, finalPower: 0, ...(clone(check) || {}) } };
    const traitState = engine.createState();
    try {
      engine.dispatchTrait(preview, "passive", runtime, traitState);
      engine.dispatchTrait(preview, "before_check", runtime, traitState);
      return numberOr(runtime.check?.finalPower, 0);
    } catch (_) { return 0; }
  }

  function skillTraitContributions(engine, traits = [], character = {}, check = {}) {
    return (traits || []).map((trait) => {
      const amount = traitCheckContribution(engine, trait, character, check);
      return amount ? { traitId: normalizeId(trait?.id || trait?.name), name: String(trait?.name || trait?.id || "Trait"), amount } : null;
    }).filter(Boolean);
  }

  function tooltip(skill, ability, breakdown) {
    const lines = [`${skill.name}: ${formatSigned(breakdown.total)}`];
    if (breakdown.abilityMod) lines.push(`${formatSigned(breakdown.abilityMod)} ${ability.code} Mod`);
    if (breakdown.proficiency) lines.push(`${formatSigned(breakdown.proficiency)} Proficiency`);
    breakdown.contributions.forEach((entry) => lines.push(`${formatSigned(entry.amount)} ${entry.name}`));
    return lines.join("\n");
  }

  function playerSkillBreakdown(skill, ability, data = global.datosJugador || {}) {
    const stats = global.LuminousPlayerStats;
    const engine = global.LuminousTraitEngine;
    const runtime = global.LuminousPlayerTraitRuntime;
    if (!stats || !engine || !runtime?.getTraits) return null;
    const level = Math.max(1, integerOr(data?.level ?? data?.characterBuild?.calculatedAtLevel, 1));
    const abilityMod = stats.abilityModifier(stats.abilityScore(ability, data));
    const proficiency = stats.proficiencyContribution(level, stats.skillProficiencyState(skill, data));
    const base = stats.skillValue(skill, ability, data);
    const character = runtime.getCharacter?.() || data;
    const contributions = skillTraitContributions(engine, runtime.getTraits(), character, { kind: "skill", abilityId: ability.id, skillId: skill.id });
    const traitBonus = contributions.reduce((sum, entry) => sum + entry.amount, 0);
    return { base, abilityMod, proficiency, contributions, traitBonus, total: base + traitBonus };
  }

  function syncPlayerSkillPreviews() {
    if (!doc) return false;
    const panel = doc.querySelector("#stats-modal .player-ability-console");
    const stats = global.LuminousPlayerStats;
    if (!panel || !stats?.ABILITIES) return false;
    const data = global.datosJugador || global.LuminousPlayerTraitRuntime?.getCharacter?.() || {};
    let changed = false;
    panel.querySelectorAll(".dnd-skill[data-skill-id]").forEach((row) => {
      const skillId = normalizeId(row.dataset.skillId);
      const ability = stats.ABILITIES.find((entry) => (entry.skills || []).some((skill) => normalizeId(skill.id) === skillId));
      const skill = ability?.skills?.find((entry) => normalizeId(entry.id) === skillId);
      if (!ability || !skill) return;
      const breakdown = playerSkillBreakdown(skill, ability, data);
      if (!breakdown) return;
      const node = row.querySelector(".dnd-skill-value");
      const value = formatSigned(breakdown.total);
      if (node && node.textContent !== value) { node.textContent = value; changed = true; }
      row.title = tooltip(skill, ability, breakdown);
      row.dataset.traitSkillBreakdown = "true";
    });
    return changed;
  }

  function normalizeCharacter(character = {}) {
    const build = character?.characterBuild && typeof character.characterBuild === "object" ? character.characterBuild : {};
    const resolved = { ...(character || {}) };
    if (Array.isArray(build.classes)) resolved.classes = build.classes;
    ["raceId", "raceSubtypeId", "backgroundId", "lineageId"].forEach((key) => { if (Object.prototype.hasOwnProperty.call(build, key)) resolved[key] = build[key]; });
    if (Object.prototype.hasOwnProperty.call(build, "calculatedAtLevel")) resolved.level = build.calculatedAtLevel;
    if (Array.isArray(build.lineages)) resolved.lineages = build.lineages;
    return resolved;
  }
  function mergedDefinitions() {
    const core = global.LuminousTraitCatalogCore?.allDefinitions?.() || {};
    const racial = global.LuminousRacialTraitCatalog?.allDefinitions?.() || {};
    return { ...core, ...racial, ...(state.definitions || {}) };
  }
  function mergedGrants() { return [...(global.LuminousTraitCatalogCore?.allGrants?.() || []), ...Object.values(state.grants || {})]; }
  function resolvedDmTraits(character = state.player || {}) {
    const engine = global.LuminousTraitEngine;
    if (!engine?.resolveTraitGrants) return [];
    const definitions = mergedDefinitions();
    const normalized = normalizeCharacter(character);
    const granted = engine.resolveTraitGrants(normalized, mergedGrants(), definitions);
    const racial = global.LuminousRacialTraitCatalog?.resolveTraitGrants?.(normalized, definitions) || [];
    const selected = global.LuminousClassMilestones?.resolveSelectedGeneralTraits?.(character, definitions) || [];
    const byId = new Map();
    [...granted, ...racial, ...selected].forEach((trait) => { const id = normalizeId(trait?.id || trait?.name); if (id && !byId.has(id)) byId.set(id, trait); });
    return [...byId.values()];
  }
  function dmPreviewCharacter() {
    const studio = global.LuminousDmPlayerDndStudio;
    const player = clone(state.player || {}) || {};
    if (!studio || !doc) return player;
    const xp = integerOr(doc.getElementById("dm-player-dnd-xp")?.value, player.xp || 0);
    const level = studio.levelDataFromXp?.(xp)?.level || player.level || 1;
    const stats = studio.resolveEffectiveStats?.() || player.stats || {};
    const classes = studio.collectClassChoices?.() || player?.characterBuild?.classes || [];
    player.level = level; player.stats = { ...(player.stats || {}), ...stats }; player.classes = classes;
    player.characterBuild = { ...(player.characterBuild || {}), classes, calculatedAtLevel: level };
    return player;
  }
  function syncDmSkillPreviews() {
    if (!doc) return false;
    const studio = global.LuminousDmPlayerDndStudio;
    const engine = global.LuminousTraitEngine;
    if (!studio?.ABILITIES || !engine || !state.playerId || !state.player) return false;
    const character = dmPreviewCharacter();
    const level = Math.max(1, integerOr(character.level, 1));
    const traits = resolvedDmTraits(character);
    const effectiveStats = studio.resolveEffectiveStats?.() || character.stats || {};
    let changed = false;
    studio.ABILITIES.forEach((ability) => {
      const abilityMod = Math.floor((integerOr(effectiveStats?.[ability.key], 10) - 10) / 2);
      (ability.skills || []).forEach((skill) => {
        const proficiency = studio.proficiencyContribution?.(level, doc.getElementById(`dm-player-skill-${skill.id}`)?.value || "none") || 0;
        const contributions = skillTraitContributions(engine, traits, character, { kind: "skill", abilityId: ability.id, skillId: skill.id });
        const total = abilityMod + proficiency + contributions.reduce((sum, entry) => sum + entry.amount, 0);
        const node = doc.querySelector(`[data-skill-total="${skill.id}"]`);
        if (!node) return;
        const value = formatSigned(total); if (node.textContent !== value) { node.textContent = value; changed = true; }
        const text = tooltip(skill, ability, { total, abilityMod, proficiency, contributions });
        node.title = text; node.closest?.(".dm-player-dnd-skill")?.setAttribute?.("title", text); node.dataset.traitSkillBreakdown = "true";
      });
    });
    return changed;
  }

  function bindPlayer() {
    if (!doc || !state.db) return false;
    const nextId = String(doc.getElementById("dm-player-dnd-select")?.value || "").trim();
    if (nextId === state.playerId && state.playerRef) return true;
    if (state.playerRef && state.playerListener) state.playerRef.off("value", state.playerListener);
    state.playerId = nextId; state.player = null; state.playerRef = null; state.playerListener = null;
    if (!nextId) return false;
    state.playerRef = state.db.ref(`${PLAYER_ROOT}/${nextId}`);
    state.playerListener = (snapshot) => { state.player = snapshot.val() || null; };
    state.playerRef.on("value", state.playerListener);
    return true;
  }
  function bindFirebase() {
    if (!doc || !global.firebase?.database || !global.firebase?.apps?.length) return false;
    if (!state.db) state.db = global.firebase.database();
    if (!state.definitionsBound) { state.definitionsBound = true; state.db.ref(DEFINITIONS_ROOT).on("value", (snapshot) => { state.definitions = snapshot.val() || {}; }); }
    if (!state.grantsBound) { state.grantsBound = true; state.db.ref(GRANTS_ROOT).on("value", (snapshot) => { state.grants = snapshot.val() || {}; }); }
    bindPlayer(); return true;
  }
  function tick() { bindFirebase(); bindPlayer(); syncPlayerSkillPreviews(); syncDmSkillPreviews(); }
  function boot() { tick(); global.setInterval?.(tick, 400); }

  const api = Object.freeze({ relevantCheckTrait, traitCheckContribution, skillTraitContributions, playerSkillBreakdown, syncPlayerSkillPreviews, syncDmSkillPreviews, tick });
  global.LuminousSkillTraitBreakdownPatch = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (doc) { if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", boot, { once: true }); else boot(); }
})(typeof window !== "undefined" ? window : globalThis);
