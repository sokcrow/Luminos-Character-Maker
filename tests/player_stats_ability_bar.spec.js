const { test, expect } = require("@playwright/test");
const fs = require("node:fs");
const path = require("node:path");

const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");
const statsUi = read("js/player-stats-ability-bar.js");
const statsCss = read("css/player-stats-ability-bar.css");
const playerEngine = read("hoja_personaje.js");
const utils = read("js/utils.js");
const dmPage = read("pantalla_dm.html");
const dmDnd = read("js/dm-player-dnd-studio.js");
const dmDndCss = read("css/dm-player-dnd-studio.css");

test("Stats adopta el mock HUD de dos paneles sin CUERPO MENTE ALMA", () => {
  expect(statsUi).toContain('class="player-stats-frame"');
  expect(statsUi).toContain('class="player-stats-character-panel"');
  expect(statsUi).toContain('class="player-stats-information-panel"');
  expect(statsUi).toContain('class="player-stat-content"');
  expect(statsUi).toContain('class="player-skill-list"');
  expect(statsCss).toContain("grid-template-columns:minmax(0,1fr) minmax(0,1fr)");
  expect(statsCss).toContain("radial-gradient(ellipse at 50% 12%");
  expect(statsUi).toContain("function removeLegacyStats(statsContainer)");
  expect(statsUi).toContain('statsContainer.querySelectorAll(":scope > .sheet-attributes-grid, :scope > .player-secondary-stats")');
  expect(statsUi).not.toContain("HABILIDADES / ATRIBUTOS SECUNDARIOS");
});

test("la barra conserva STR DEX CON INT WIS CHA con selector activo", () => {
  for (const code of ["STR", "DEX", "CON", "INT", "WIS", "CHA"]) expect(statsUi).toContain(`code: "${code}"`);
  expect(statsUi).toContain('class="player-ability-bar"');
  expect(statsUi).toContain('data-stat="${ability.id}"');
  expect(statsUi).toContain("panel.dataset.activeStat = abilityId");
  expect(statsCss).toContain("grid-template-columns:repeat(6,minmax(0,1fr))");
  expect(statsCss).toContain("rgba(255,172,0,.38)");
});

test("Proficiency sigue siendo ceil(Level / 20) con los cuatro estados", () => {
  expect(statsUi).toContain("Math.ceil(numericLevel / 20)");
  expect(dmDnd).toContain("Math.ceil(Math.max(0, numberOr(level, 0)) / 20)");
  expect(statsUi).toContain('none: Object.freeze({ label: "Not Proficient", multiplier: 0 })');
  expect(statsUi).toContain('half: Object.freeze({ label: "Half Proficient", multiplier: 0.5 })');
  expect(statsUi).toContain('proficient: Object.freeze({ label: "Proficient", multiplier: 1 })');
  expect(statsUi).toContain('expertise: Object.freeze({ label: "Expertise", multiplier: 2 })');
  expect(statsUi).toContain("Math.floor(proficiencyBonus(level) * definition.multiplier)");
  expect(statsCss).toContain('[data-prof-state="half"]');
  expect(statsCss).toContain('[data-prof-state="proficient"]');
  expect(statsCss).toContain('[data-prof-state="expertise"]');
  expect(statsCss).toContain("0 0 0 4px #e3a52a");
});

test("Saving Throw usa MOD más la proficiency del atributo", () => {
  expect(statsUi).toContain("const saveValue = math.modifier + math.proficiencyValue");
  expect(statsUi).toContain("data-stat-save");
  expect(statsUi).toContain("data-stat-save-prof");
  expect(statsUi).toContain("data-stat-save-state");
  expect(statsUi).toContain("data-stat-prof-value");
});

test("el panel usa la lista estándar de skills D&D asociada a cada atributo", () => {
  for (const skill of [
    "Athletics", "Acrobatics", "Sleight of Hand", "Stealth", "Arcana", "History",
    "Investigation", "Nature", "Religion", "Animal Handling", "Insight", "Medicine",
    "Perception", "Survival", "Deception", "Intimidation", "Performance", "Persuasion",
  ]) expect(statsUi).toContain(`name: "${skill}"`);
  expect(statsUi).toContain("function skillProficiencyState(skill, data = playerData())");
  expect(statsUi).toContain("data?.skillProficiency || data?.skillProficiencies || data?.dndSkillProficiency");
  expect(statsUi).toContain("abilityModifier(abilityScore(ability, data)) + proficiencyContribution");
  expect(statsUi).toContain("No associated skills");
});

test("el score del mock sigue tirando con el Coin Engine existente", () => {
  expect(statsUi).toContain('class="sheet-roll-skill-btn player-stat-main player-stat-roll"');
  expect(statsUi).toContain("rollButton.name = `act_roll_skill_${ability.key}`");
  expect(statsUi).toContain("dataset.proficiencyContribution");
  expect(statsUi).toContain('doc.getElementById("roll-total-score")');
  expect(statsUi).toContain("raw + rollAdjustment.bonus");
  expect(playerEngine).toContain('["fuerza", "destreza", "constitucion", "inteligencia", "sabiduria", "carisma"]');
  expect(playerEngine).toContain("baseVal = Math.floor((rawVal - 10) / 2);");
  expect(playerEngine).toContain("const totalCoins = 5;");
  expect(playerEngine).toContain("currentTotal += 4;");
});

test("el mock usa art, icono, HP, Level, Proficiency y Offensive/Defensive reales", () => {
  expect(statsUi).toContain("data-player-sheet-art");
  expect(statsUi).toContain("data-player-character-icon");
  expect(statsUi).toContain("data-player-hp-current");
  expect(statsUi).toContain("data-player-hp-max");
  expect(statsUi).toContain("data-player-level");
  expect(statsUi).toContain("data-player-proficiency");
  expect(statsUi).toContain("data-player-offensive-level");
  expect(statsUi).toContain("data-player-defensive-level");
  expect(statsUi).toContain("SWORD_ICON");
  expect(statsUi).toContain("SHIELD_ICON");
  expect(statsUi).toContain("EQUIPMENT · PENDING");
  expect(statsUi).toContain("level + classModifier + dmModifier + itemModifier");
});

test("Gestión de Jugadores sigue editando el modelo D&D que consume el mock", () => {
  expect(dmPage).toContain('data-tab="dashboard-jugadores"');
  expect(dmPage).toContain('id="dashboard-jugadores"');
  expect(dmDnd).toContain('const PLAYERS_ROOT = "campaña/jugadores"');
  expect(dmDnd).toContain('field("dashboard-jugadores")');
  for (const id of ["str", "dex", "con", "int", "wis", "cha"]) {
    expect(dmDnd).toContain(`dm-player-stat-${id}`);
    expect(dmDnd).toContain(`dm-player-prof-${id}`);
  }
  expect(dmDnd).toContain("updates[`stats/${ability.key}`]");
  expect(dmDnd).toContain("updates[`abilityProficiency/${ability.id}`]");
  expect(dmDnd).toContain("updates.sheetArt");
  expect(dmDnd).toContain('updates["combatLevels/offensive/dmModifier"]');
  expect(dmDnd).toContain('updates["combatLevels/defensive/dmModifier"]');
  expect(dmDndCss).toContain("#dm-player-dnd-studio");
});

test("utils carga el mock solo en la hoja de jugador y el editor solo en Gestión de Jugadores", () => {
  expect(utils).toContain("function ensurePlayerStatsAbilityBarAssets");
  expect(utils).toContain("css/player-stats-ability-bar.css");
  expect(utils).toContain("js/player-stats-ability-bar.js");
  expect(utils).toContain("function ensureDmPlayerDndStudioAssets");
  expect(utils).toContain("#dashboard-jugadores");
  expect(utils).toContain("css/dm-player-dnd-studio.css");
  expect(utils).toContain("js/dm-player-dnd-studio.js");
});

test("el mock conserva teclado y una adaptación móvil funcional", () => {
  expect(statsUi).toContain('event.key === "ArrowRight"');
  expect(statsUi).toContain('event.key === "ArrowLeft"');
  expect(statsUi).toContain('event.key === "Home"');
  expect(statsUi).toContain('event.key === "End"');
  expect(statsCss).toContain("@media (max-width:860px)");
  expect(statsCss).toContain("grid-template-columns:repeat(3,minmax(0,1fr))");
  expect(statsCss).toContain("@media (max-width:560px)");
  expect(statsCss).toContain("grid-template-columns:1fr");
});
