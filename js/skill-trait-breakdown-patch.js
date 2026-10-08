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
  const CHECK_POWER_PATHS = Object.freeze(["check.abilitypower", "check.checkpower", "check.power"]);
  const FINAL_POWER_PATHS = Object.freeze(["check.finalpower"]);
  const state = {
    db: null,
    definitions: {},
    grants: {},
    playerId: "",
    player: null,
    playerRef: null,
    playerListener: null,
    definitionsBound: false,
    grantsBound: false,
    resolvedBridgeBound: false,
  };

  const normalizeId = (value) => String(value ?? "").trim().toLowerCase().replace(/\s+/g, "_");
  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
  const numberOr = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const integerOr = (value, fallback = 0) => Number.isFinite(Number.parseInt(value, 10)) ? Number.parseInt(value, 10) : fallback;
  const formatSigned = (value) => numberOr(value, 0) >= 0 ? `+${numberOr(value, 0)}` : String(numberOr(value, 0));

  function channelPaths(channel) {
    return normalizeId(channel) === "final_power" ? FINAL_POWER_PATHS : CHECK_POWER_PATHS;
  }

  function relevantCheckTrait(engine, trait = {}, channel = "check_power") {
    if (!engine?.normalizeTrait) return null;
    const normalized = engine.normalizeTrait(trait);
    const paths = new Set(channelPaths(channel));
    const relevantOperation = (operation) => normalizeId(operation?.type) === "modify" && paths.has(normalizeId(operation?.path));
    normalized.effects = (normalized.effects || [])
      .map((effect) => ({ ...effect, operations: (effect.operations || []).filter(relevantOperation) }))
      .filter((effect) => ["passive", "before_check"].includes(normalizeId(effect.trigger)) && effect.operations.length);
    normalized.rules = (normalized.rules || []).filter((rule) =>
      normalizeId(rule?.type) === "modifier" &&
      ["passive", "before_check"].includes(normalizeId(rule?.trigger)) &&
      paths.has(normalizeId(rule?.path))
    );
    normalized.resolutions = [];
    return normalized.effects.length || normalized.rules.length ? normalized : null;
  }

  function checkPowerValue(check = {}) {
    return numberOr(check?.abilityPower, 0) + numberOr(check?.checkPower, 0) + numberOr(check?.power, 0);
  }

  function finalPowerValue(check = {}) {
    return numberOr(check?.finalPower, 0);
  }

  function channelValue(check = {}, channel = "check_power") {
    return normalizeId(channel) === "final_power" ? finalPowerValue(check) : checkPowerValue(check);
  }

  function channelContributions(engine, traits = [], character = {}, check = {}, channel = "check_power") {
    if (!engine?.dispatchTrait || !engine?.createState) return [];
    const runtime = {
      context: "theatre",
      character: clone(global.LuminousCheckTraitBonusRuntime?.canonicalCharacter?.(character, traits) || character) || {},
      self: clone(global.LuminousCheckTraitBonusRuntime?.canonicalCharacter?.(character, traits) || character) || {},
      check: { abilityPower: 0, checkPower: 0, power: 0, finalPower: 0, ...(clone(check) || {}) },
    };
    const traitState = engine.createState();
    const contributions = [];

    (traits || []).forEach((trait) => {
      const preview = relevantCheckTrait(engine, trait, channel);
      if (!preview) return;
      const before = channelValue(runtime.check, channel);
      try {
        engine.dispatchTrait(preview, "passive", runtime, traitState);
        engine.dispatchTrait(preview, "before_check", runtime, traitState);
      } catch (_) {
        return;
      }
      const after = channelValue(runtime.check, channel);
      const amount = after - before;
      if (!amount) return;
      contributions.push({
        traitId: normalizeId(trait?.id || trait?.name),
        name: String(trait?.name || trait?.id || "Trait"),
        amount,
        channel: normalizeId(channel) === "final_power" ? "final_power" : "check_power",
      });
    });
    return contributions;
  }

  function traitCheckContribution(engine, trait = {}, character = {}, check = {}) {
    return channelContributions(engine, [trait], character, check, "check_power")[0]?.amount || 0;
  }

  function checkPowerContributions(engine, traits = [], character = {}, check = {}) {
    return channelContributions(engine, traits, character, check, "check_power");
  }

  function finalPowerContributions(engine, traits = [], character = {}, check = {}) {
    return channelContributions(engine, traits, character, check, "final_power");
  }

  function skillTraitContributions(engine, traits = [], character = {}, check = {}) {
    return checkPowerContributions(engine, traits, character, check);
  }

  function tooltip(skill, ability, breakdown) {
    const lines = [`${skill.name} Check total: ${formatSigned(breakdown.total)}`];
    if (breakdown.abilityMod) lines.push(`${formatSigned(breakdown.abilityMod)} ${ability.code} Mod`);
    if (breakdown.proficiency) lines.push(`${formatSigned(breakdown.proficiency)} Proficiency`);
    breakdown.contributions.forEach((entry) => lines.push(`${formatSigned(entry.amount)} ${entry.name}`));
    if (breakdown.finalPowerContributions?.length) {
      lines.push("Final Power · incluido en el total, aplicado una sola vez");
      breakdown.finalPowerContributions.forEach((entry) => lines.push(`${formatSigned(entry.amount)} ${entry.name}`));
    }
    return lines.join("\n");
  }

  function playerCheckPower(check = {}, data = global.datosJugador || {}) {
    const engine = global.LuminousTraitEngine;
    const runtime = global.LuminousPlayerTraitRuntime;
    if (!engine || !runtime?.getTraits) return { contributions: [], total: 0 };
    const character = runtime.getCharacter?.() || data;
    const contributions = checkPowerContributions(engine, runtime.getTraits(), character, check);
    return { contributions, total: contributions.reduce((sum, entry) => sum + entry.amount, 0) };
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
    const traits = runtime.getTraits();
    const check = { kind: "skill", abilityId: ability.id, skillId: skill.id };
    const resolver = global.LuminousCheckTraitBonusRuntime;
    const contributions = checkPowerContributions(engine, traits, character, check);
    const finalPower = finalPowerContributions(engine, traits, character, check);
    const resolved = resolver?.previewCheck?.(engine, traits, character, check);
    const declaredFinal = finalPower.reduce((sum, entry) => sum + entry.amount, 0);
    const resolvedFinal = resolved ? numberOr(resolved.check.finalPower, 0) : declaredFinal;
    const extraFinal = resolvedFinal - declaredFinal;
    if (extraFinal) {
      const special = (resolved?.specialContributions || []).filter((entry) => entry.channel === "final_power");
      const known = special.reduce((sum, entry) => sum + entry.amount, 0);
      finalPower.push(...special);
      if (extraFinal !== known) finalPower.push({ name: "Otros Traits", amount: extraFinal - known });
    }
    const specialsCheck = (resolved?.specialContributions || []).filter((entry) => entry.channel === "check_power");
    contributions.push(...specialsCheck);
    const traitBonus = resolved ? checkPowerValue(resolved.check) : contributions.reduce((sum, entry) => sum + entry.amount, 0);
    const finalBonus = resolvedFinal;
    // The displayed Skill total is the effective Check result, including
    // Final Power; coin rolls apply it once, never once per UI refresh.
    return { base, abilityMod, proficiency, contributions, finalPowerContributions: finalPower,
      traitBonus, finalBonus, total: base + traitBonus + finalBonus };
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
    ["raceId", "raceSubtypeId", "backgroundId", "lineageId"].forEach((key) => {
      if (Object.prototype.hasOwnProperty.call(build, key)) resolved[key] = build[key];
    });
    if (Object.prototype.hasOwnProperty.call(build, "calculatedAtLevel")) resolved.level = build.calculatedAtLevel;
    if (Array.isArray(build.lineages)) resolved.lineages = build.lineages;
    return resolved;
  }

  function mergedDefinitions() {
    const core = global.LuminousTraitCatalogCore?.allDefinitions?.() || {};
    const racial = global.LuminousRacialTraitCatalog?.allDefinitions?.() || {};
    return { ...core, ...racial, ...(state.definitions || {}) };
  }

  function mergedGrants() {
    return [...(global.LuminousTraitCatalogCore?.allGrants?.() || []), ...Object.values(state.grants || {})];
  }

  function resolvedDmTraits(character = state.player || {}) {
    const engine = global.LuminousTraitEngine;
    if (!engine?.resolveTraitGrants) return [];
    const definitions = mergedDefinitions();
    const normalized = normalizeCharacter(character);
    const granted = engine.resolveTraitGrants(normalized, mergedGrants(), definitions);
    const racial = global.LuminousRacialTraitCatalog?.resolveTraitGrants?.(normalized, definitions) || [];
    const selected = global.LuminousClassMilestones?.resolveSelectedGeneralTraits?.(character, definitions) || [];
    const byId = new Map();
    [...granted, ...racial, ...selected].forEach((trait) => {
      const id = normalizeId(trait?.id || trait?.name);
      if (id && !byId.has(id)) byId.set(id, trait);
    });
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
    player.level = level;
    player.stats = { ...(player.stats || {}), ...stats };
    player.classes = classes;
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
        const check = { kind: "skill", abilityId: ability.id, skillId: skill.id };
        const contributions = checkPowerContributions(engine, traits, character, check);
        const finalPower = finalPowerContributions(engine, traits, character, check);
        const preview = global.LuminousCheckTraitBonusRuntime?.previewCheck?.(engine, traits, character, check);
        const declaredFinal = finalPower.reduce((sum, entry) => sum + entry.amount, 0);
        const effectiveFinal = preview ? numberOr(preview.check.finalPower, 0) : declaredFinal;
        const specials = preview?.specialContributions || [];
        finalPower.push(...specials.filter((entry) => entry.channel === "final_power"));
        contributions.push(...specials.filter((entry) => entry.channel === "check_power"));
        const otherFinal = effectiveFinal - declaredFinal - specials.filter((entry) => entry.channel === "final_power").reduce((sum, item) => sum + item.amount, 0);
        if (otherFinal) finalPower.push({ name: "Otros Traits", amount: otherFinal });
        const checkBonus = preview ? checkPowerValue(preview.check) : contributions.reduce((sum, entry) => sum + entry.amount, 0);
        const total = abilityMod + proficiency + checkBonus + effectiveFinal;
        const node = doc.querySelector(`[data-skill-total="${skill.id}"]`);
        if (!node) return;
        const value = formatSigned(total);
        if (node.textContent !== value) { node.textContent = value; changed = true; }
        const text = tooltip(skill, ability, { total, abilityMod, proficiency, contributions, finalPowerContributions: finalPower });
        node.title = text;
        node.closest?.(".dm-player-dnd-skill")?.setAttribute?.("title", text);
        node.dataset.traitSkillBreakdown = "true";
      });
    });
    return changed;
  }

  function findPlayerRollTarget(check = {}) {
    if (!doc) return null;
    const panel = doc.querySelector("#stats-modal .player-ability-console");
    if (!panel) return null;
    const kind = normalizeId(check.kind);
    if (kind === "skill" && check.skillId) return panel.querySelector(`.dnd-skill[data-skill-id="${normalizeId(check.skillId)}"]`);
    if (kind === "save") return panel.querySelector('[data-dnd-roll="save"]');
    if (kind === "ability") return panel.querySelector('[data-dnd-roll="ability"]');
    return null;
  }

  function installResolvedCheckBridge() {
    if (!doc || state.resolvedBridgeBound) return Boolean(doc);
    state.resolvedBridgeBound = true;
    global.addEventListener?.("luminous:theatre-traits-applied", (event) => {
      const check = event?.detail?.check || {};
      const target = findPlayerRollTarget(check);
      if (!target) return;
      target.dataset.resolvedCheckPower = String(checkPowerValue(check));
      // Final Power is applied by the shared Coin completion bridge on DM
      // requests; do not add it to the base roll on this path.
    });
    return true;
  }

  function playerRollDescriptor(target, panel, stats) {
    const kind = normalizeId(target?.dataset?.dndRoll);
    const abilityId = normalizeId(panel?.dataset?.activeStat);
    const ability = (stats?.ABILITIES || []).find((entry) => normalizeId(entry?.id) === abilityId) || stats?.ABILITIES?.[0];
    if (!ability || !kind) return null;
    if (kind === "skill") {
      const skillId = normalizeId(target?.dataset?.skillId);
      const skill = (ability.skills || []).find((entry) => normalizeId(entry.id) === skillId);
      if (!skill) return null;
      return { kind, ability, skill, check: { kind, abilityId: ability.id, skillId: skill.id }, label: skill.name };
    }
    if (kind === "save") return { kind, ability, skill: null, check: { kind, abilityId: ability.id }, label: `${ability.name} Saving Throw` };
    if (kind === "ability") return { kind, ability, skill: null, check: { kind, abilityId: ability.id }, label: ability.name };
    return null;
  }

  function rawRollBase(descriptor, data, stats) {
    if (!descriptor || !stats) return 0;
    if (descriptor.kind === "skill") return numberOr(stats.skillValue?.(descriptor.skill, descriptor.ability, data), 0);
    const math = stats.abilityRollMath?.(descriptor.ability, data) || {};
    if (descriptor.kind === "save") return numberOr(math.modifier, 0) + numberOr(math.proficiencyValue, 0);
    return numberOr(math.base, numberOr(math.modifier, 0));
  }

  function installPlayerRollBridge() {
    if (!doc) return false;
    const panel = doc.querySelector("#stats-modal .player-ability-console");
    const stats = global.LuminousPlayerStats;
    if (!panel || !stats?.triggerCoinRoll) return false;
    if (panel.dataset.checkPowerRollBridge === "true") return true;
    panel.dataset.checkPowerRollBridge = "true";
    panel.addEventListener("click", (event) => {
      const target = event.target?.closest?.(".player-dnd-roll");
      if (!target || !panel.contains(target)) return;
      const descriptor = playerRollDescriptor(target, panel, stats);
      if (!descriptor) return;

      const data = global.datosJugador || global.LuminousPlayerTraitRuntime?.getCharacter?.() || {};
      const hasResolved = Object.prototype.hasOwnProperty.call(target.dataset, "resolvedCheckPower");
      const resolvedPower = hasResolved ? numberOr(target.dataset.resolvedCheckPower, 0) : null;
      if (hasResolved) delete target.dataset.resolvedCheckPower;
      const resolver = global.LuminousCheckTraitBonusRuntime;
      const engine = global.LuminousTraitEngine;
      const traits = global.LuminousPlayerTraitRuntime?.getTraits?.() || [];
      const character = global.LuminousPlayerTraitRuntime?.getCharacter?.() || data;
      const preview = !hasResolved ? resolver?.previewCheck?.(engine, traits, character, descriptor.check) : null;
      const previewPower = hasResolved ? resolvedPower
        : preview ? checkPowerValue(preview.check) + finalPowerValue(preview.check)
          : playerCheckPower(descriptor.check, data).total;
      if (!previewPower) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      stats.triggerCoinRoll(descriptor.ability, descriptor.label, rawRollBase(descriptor, data, stats) + previewPower);
    }, true);
    return true;
  }

  function bindPlayer() {
    if (!doc || !state.db) return false;
    const nextId = String(doc.getElementById("dm-player-dnd-select")?.value || "").trim();
    if (nextId === state.playerId && state.playerRef) return true;
    if (state.playerRef && state.playerListener) state.playerRef.off("value", state.playerListener);
    state.playerId = nextId;
    state.player = null;
    state.playerRef = null;
    state.playerListener = null;
    if (!nextId) return false;
    state.playerRef = state.db.ref(`${PLAYER_ROOT}/${nextId}`);
    state.playerListener = (snapshot) => { state.player = snapshot.val() || null; };
    state.playerRef.on("value", state.playerListener);
    return true;
  }

  function bindFirebase() {
    if (!doc || !global.firebase?.database || !global.firebase?.apps?.length) return false;
    if (!state.db) state.db = global.firebase.database();
    if (!state.definitionsBound) {
      state.definitionsBound = true;
      state.db.ref(DEFINITIONS_ROOT).on("value", (snapshot) => { state.definitions = snapshot.val() || {}; });
    }
    if (!state.grantsBound) {
      state.grantsBound = true;
      state.db.ref(GRANTS_ROOT).on("value", (snapshot) => { state.grants = snapshot.val() || {}; });
    }
    bindPlayer();
    return true;
  }

  function tick() {
    bindFirebase();
    bindPlayer();
    installResolvedCheckBridge();
    installPlayerRollBridge();
    syncPlayerSkillPreviews();
    syncDmSkillPreviews();
  }

  function boot() {
    tick();
    ["luminous:player-data", "luminous:traits-refreshed", "luminous:class-runtime-loaded", "luminous:class-runtimes-ready"]
      .forEach((name) => global.addEventListener?.(name, tick));
    global.addEventListener?.("luminous:theatre-rolls-ready", tick);
    global.addEventListener?.("load", tick, { once: true });
  }

  const api = Object.freeze({
    CHECK_POWER_PATHS,
    FINAL_POWER_PATHS,
    relevantCheckTrait,
    checkPowerValue,
    finalPowerValue,
    traitCheckContribution,
    checkPowerContributions,
    finalPowerContributions,
    skillTraitContributions,
    playerCheckPower,
    playerSkillBreakdown,
    syncPlayerSkillPreviews,
    syncDmSkillPreviews,
    installResolvedCheckBridge,
    installPlayerRollBridge,
    rawRollBase,
    tick,
  });

  global.LuminousSkillTraitBreakdownPatch = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (doc) {
    if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", boot, { once: true });
    else boot();
  }
})(typeof window !== "undefined" ? window : globalThis);
