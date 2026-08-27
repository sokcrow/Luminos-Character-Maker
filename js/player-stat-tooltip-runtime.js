(function (global) {
  "use strict";

  if (global.LuminousPlayerStatTooltipRuntime) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousPlayerStatTooltipRuntime;
    return;
  }

  const doc = global.document || null;
  const ABILITY_KEYS = Object.freeze({ str: "fuerza", dex: "destreza", con: "constitucion", int: "inteligencia", wis: "sabiduria", cha: "carisma" });
  const PROFICIENCY_MULTIPLIERS = Object.freeze({ none: 0, half: 0.5, proficient: 1, expertise: 2 });
  const SOURCE_ORDER = Object.freeze([
    Object.freeze({ key: "baseModifier", label: "Mod" }),
    Object.freeze({ key: "proficiency", label: "Proficiency" }),
    Object.freeze({ key: "racial", label: "Racial" }),
    Object.freeze({ key: "background", label: "Background" }),
    Object.freeze({ key: "traits", label: "Traits" }),
  ]);

  const numberOr = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const integerOr = (value, fallback = 0) => Number.isFinite(Number.parseInt(value, 10)) ? Number.parseInt(value, 10) : fallback;
  const normalizeId = (value) => String(value ?? "").trim().toLowerCase().replace(/\s+/g, "_");
  const abilityModifier = (score) => Math.floor((numberOr(score, 10) - 10) / 2);
  const formatSigned = (value) => numberOr(value, 0) >= 0 ? `+${numberOr(value, 0)}` : String(numberOr(value, 0));

  function ensureMilestoneTraitModifierPatch() {
    if (!doc || global.LuminousMilestoneTraitModifierPatch) return global.LuminousMilestoneTraitModifierPatch || null;
    let script = doc.getElementById("milestone-trait-modifier-patch-script");
    if (script) return script;
    script = doc.createElement("script");
    script.id = "milestone-trait-modifier-patch-script";
    script.src = "js/milestone-trait-modifier-patch.js";
    script.async = false;
    script.dataset.ui = "milestone-trait-modifier-patch";
    doc.head?.appendChild(script);
    return script;
  }

  function normalizeAbility(ability = {}) {
    const id = normalizeId(ability.id || ability.code);
    const key = ability.key || ABILITY_KEYS[id] || id;
    return { ...ability, id, key };
  }

  function mapAbilityValue(map, ability) {
    if (!map || typeof map !== "object") return 0;
    const normalized = normalizeAbility(ability);
    return numberOr(map?.[normalized.id] ?? map?.[normalized.key], 0);
  }

  function proficiencyBonus(level) {
    return Math.ceil(Math.max(0, numberOr(level, 0)) / 20);
  }

  function proficiencyContribution(level, state) {
    const multiplier = PROFICIENCY_MULTIPLIERS[normalizeId(state)] ?? 0;
    return Math.floor(proficiencyBonus(level) * multiplier);
  }

  function modifierContributions({ baseScore = 10, racialScoreBonus = 0, backgroundScoreBonus = 0, traitsScoreBonus = 0, proficiency = 0 } = {}) {
    const startScore = numberOr(baseScore, 10);
    const racialScore = numberOr(racialScoreBonus, 0);
    const backgroundScore = numberOr(backgroundScoreBonus, 0);
    const traitsScore = numberOr(traitsScoreBonus, 0);

    const baseModifier = abilityModifier(startScore);
    const afterRacial = startScore + racialScore;
    const racial = abilityModifier(afterRacial) - baseModifier;
    const afterBackground = afterRacial + backgroundScore;
    const background = abilityModifier(afterBackground) - abilityModifier(afterRacial);
    const afterTraits = afterBackground + traitsScore;
    const traits = abilityModifier(afterTraits) - abilityModifier(afterBackground);

    return {
      score: afterTraits,
      baseScore: startScore,
      baseModifier,
      proficiency: numberOr(proficiency, 0),
      racial,
      background,
      traits,
      total: abilityModifier(afterTraits) + numberOr(proficiency, 0),
    };
  }

  function buildModifierTooltip(parts = {}) {
    const values = Object.fromEntries(SOURCE_ORDER.map(({ key }) => [key, numberOr(parts?.[key], 0)]));
    const total = SOURCE_ORDER.reduce((sum, { key }) => sum + values[key], 0);
    const lines = [`Mod actual: ${total === 0 ? "0" : formatSigned(total)}`];
    SOURCE_ORDER.forEach(({ key, label }) => {
      const value = values[key];
      if (value === 0) return;
      lines.push(`${formatSigned(value)} ${label}`);
    });
    return lines.join("\n");
  }

  function optionalScoreBonus(data, source, ability) {
    const breakdown = data?.characterBuild?.breakdown || {};
    const map = breakdown?.[`${source}StatBonuses`] || data?.[`${source}StatBonuses`] || null;
    return mapAbilityValue(map, ability);
  }

  function reconciledPlayerScores(ability, data, actualScore) {
    const racialRuntime = global.LuminousRacialStatRuntime;
    const normalized = normalizeAbility(ability);
    const runtimeBase = racialRuntime?.baseStats?.(data)?.[normalized.key];
    const hasModernBase = Boolean(racialRuntime?.hasBaseStats?.(data));
    const hasStoredRacialBreakdown = Boolean(racialRuntime?.hasStoredRacialBreakdown?.(data));
    const storedRacialBonuses = data?.characterBuild?.breakdown?.racialStatBonuses;
    let racialScoreBonus = mapAbilityValue(
      (!hasModernBase && hasStoredRacialBreakdown ? storedRacialBonuses : null) || racialRuntime?.resolveBonuses?.(data) || storedRacialBonuses,
      normalized,
    );
    const actual = numberOr(actualScore, 10);
    let baseScore = hasModernBase && Number.isFinite(Number(runtimeBase))
      ? Number(runtimeBase)
      : (!hasModernBase && hasStoredRacialBreakdown ? actual - racialScoreBonus : (Number.isFinite(Number(runtimeBase)) ? Number(runtimeBase) : actual));
    let backgroundScoreBonus = optionalScoreBonus(data, "background", normalized);
    let traitsScoreBonus = optionalScoreBonus(data, "trait", normalized) || optionalScoreBonus(data, "traits", normalized);

    if (baseScore + racialScoreBonus + backgroundScoreBonus + traitsScoreBonus !== actual) {
      if (baseScore + racialScoreBonus + backgroundScoreBonus === actual) {
        traitsScoreBonus = 0;
      } else if (baseScore + racialScoreBonus === actual) {
        backgroundScoreBonus = 0;
        traitsScoreBonus = 0;
      } else {
        baseScore = actual;
        racialScoreBonus = 0;
        backgroundScoreBonus = 0;
        traitsScoreBonus = 0;
      }
    }

    return { baseScore, racialScoreBonus, backgroundScoreBonus, traitsScoreBonus };
  }

  function playerAbilityBreakdown(ability, data = global.datosJugador || {}) {
    const playerStats = global.LuminousPlayerStats;
    const racialRuntime = global.LuminousRacialStatRuntime;
    const normalized = normalizeAbility(ability);
    const math = playerStats?.abilityRollMath?.(normalized, data);
    const actualScore = numberOr(math?.score ?? playerStats?.abilityScore?.(normalized, data) ?? racialRuntime?.abilityScore?.(normalized.id, data), 10);
    const sources = reconciledPlayerScores(normalized, data, actualScore);
    const proficiency = numberOr(math?.proficiencyValue, 0);
    return modifierContributions({ ...sources, proficiency });
  }

  function playerAbilityTooltip(ability, data = global.datosJugador || {}) {
    return buildModifierTooltip(playerAbilityBreakdown(ability, data));
  }

  function selectedPlayerAbility(panel, playerStats) {
    const activeId = normalizeId(panel?.dataset?.activeStat || "str");
    return (playerStats?.ABILITIES || []).find((entry) => normalizeId(entry?.id) === activeId) || playerStats?.ABILITIES?.[0] || null;
  }

  function setTooltip(node, text) {
    if (!node || !text) return false;
    if (node.title !== text) node.title = text;
    node.dataset.modifierBreakdownTooltip = "true";
    return true;
  }

  function syncPlayerTooltip() {
    if (!doc) return false;
    const playerStats = global.LuminousPlayerStats;
    const panel = doc.querySelector("#stats-modal .player-ability-console");
    if (!playerStats || !panel) return false;
    const ability = selectedPlayerAbility(panel, playerStats);
    if (!ability) return false;
    const tooltip = playerAbilityTooltip(ability, global.datosJugador || {});
    const main = panel.querySelector(".player-stat-main");
    setTooltip(main, tooltip);
    setTooltip(panel.querySelector("[data-stat-score]"), tooltip);
    setTooltip(panel.querySelector("[data-stat-modifier]"), tooltip);
    setTooltip(panel.querySelector(".player-stat-save"), tooltip);
    setTooltip(panel.querySelector("[data-stat-save]"), tooltip);
    return true;
  }

  function dmLevel(studio) {
    const xp = Math.max(0, integerOr(doc?.getElementById("dm-player-dnd-xp")?.value, 0));
    return studio?.levelDataFromXp?.(xp)?.level || 1;
  }

  function dmAbilityBreakdown(ability, studio) {
    const normalized = normalizeAbility(ability);
    const baseStats = studio?.baseStatsFromForm?.() || {};
    const baseScore = numberOr(baseStats?.[normalized.key], 10);
    const racialScoreBonus = mapAbilityValue(studio?.resolveRacialStatBonuses?.(studio?.racialStatInput?.()) || {}, normalized);
    const state = doc?.getElementById(`dm-player-prof-${normalized.id}`)?.value || "none";
    const level = dmLevel(studio);
    const proficiency = studio?.proficiencyContribution
      ? numberOr(studio.proficiencyContribution(level, state), 0)
      : proficiencyContribution(level, state);
    return modifierContributions({ baseScore, racialScoreBonus, proficiency });
  }

  function syncDmTooltips() {
    if (!doc) return false;
    const studio = global.LuminousDmPlayerDndStudio;
    if (!studio?.ABILITIES || !doc.getElementById("dashboard-jugadores")) return false;
    studio.ABILITIES.forEach((ability) => {
      const tooltip = buildModifierTooltip(dmAbilityBreakdown(ability, studio));
      const input = doc.getElementById(`dm-player-stat-${ability.id}`);
      const select = doc.getElementById(`dm-player-prof-${ability.id}`);
      const label = input?.closest?.(".dm-player-dnd-ability");
      setTooltip(label, tooltip);
      setTooltip(input, tooltip);
      setTooltip(select, tooltip);
    });
    return true;
  }

  function sync() {
    const player = syncPlayerTooltip();
    const dm = syncDmTooltips();
    return player || dm;
  }

  function boot() {
    ensureMilestoneTraitModifierPatch();
    sync();
    global.setInterval?.(sync, 500);
  }

  const api = Object.freeze({
    SOURCE_ORDER,
    abilityModifier,
    proficiencyBonus,
    proficiencyContribution,
    modifierContributions,
    buildModifierTooltip,
    playerAbilityBreakdown,
    playerAbilityTooltip,
    dmAbilityBreakdown,
    syncPlayerTooltip,
    syncDmTooltips,
    sync,
    ensureMilestoneTraitModifierPatch,
  });

  global.LuminousPlayerStatTooltipRuntime = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;

  if (doc) {
    if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", boot, { once: true });
    else boot();
  }
})(typeof window !== "undefined" ? window : globalThis);
