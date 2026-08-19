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

test("Stats usa STR DEX CON INT WIS CHA y elimina el bloque CUERPO MENTE ALMA", () => {
  for (const code of ["STR", "DEX", "CON", "INT", "WIS", "CHA"]) expect(statsUi).toContain(`code: "${code}"`);
  expect(statsUi).toContain('class="player-ability-bar"');
  expect(statsUi).toContain("function removeLegacyStats(statsContainer)");
  expect(statsUi).toContain('statsContainer.querySelectorAll(":scope > .sheet-attributes-grid, :scope > .player-secondary-stats")');
  expect(statsUi).toContain("node.remove()");
  expect(statsUi).not.toContain("HABILIDADES / ATRIBUTOS SECUNDARIOS");
  expect(statsCss).toContain("grid-template-columns:repeat(6,minmax(0,1fr))");
});

test("Proficiency es ceil(Level / 20) y se muestra junto a Level", () => {
  expect(statsUi).toContain("Math.ceil(numericLevel / 20)");
  expect(dmDnd).toContain("Math.ceil(Math.max(0, numberOr(level, 0)) / 20)");
  expect(statsUi).toContain("ceil(Level / 20)");
  expect(statsUi).toContain("data-player-level");
  expect(statsUi).toContain("data-player-proficiency");
  expect(dmDnd).toContain('id="dm-player-dnd-level"');
  expect(dmDnd).toContain('id="dm-player-dnd-prof"');
});

test("Abilities soporta Not Half Proficient y Expertise con las reglas acordadas", () => {
  expect(statsUi).toContain('none: Object.freeze({ label: "Not Proficient", multiplier: 0 })');
  expect(statsUi).toContain('half: Object.freeze({ label: "Half Proficient", multiplier: 0.5 })');
  expect(statsUi).toContain('proficient: Object.freeze({ label: "Proficient", multiplier: 1 })');
  expect(statsUi).toContain('expertise: Object.freeze({ label: "Expertise", multiplier: 2 })');
  expect(statsUi).toContain("Math.floor(proficiencyBonus(level) * definition.multiplier)");
  expect(statsCss).toContain('[data-prof-state="half"]');
  expect(statsCss).toContain('[data-prof-state="proficient"]');
  expect(statsCss).toContain('[data-prof-state="expertise"]');
  expect(statsCss).toContain("box-shadow:");
});

test("la tirada conserva el Coin Engine y suma Proficiency al MOD antes de las monedas", () => {
  expect(statsUi).toContain('class="sheet-roll-skill-btn player-ability-roll"');
  expect(statsUi).toContain("rollButton.name = `act_roll_skill_${ability.key}`");
  expect(statsUi).toContain("base: modifier + proficiencyValue");
  expect(statsUi).toContain("MOD + PROF + (4 × CARAS)");
  expect(statsUi).toContain('doc.getElementById("roll-total-score")');
  expect(statsUi).toContain("raw + rollAdjustment.bonus");
  expect(playerEngine).toContain('["fuerza", "destreza", "constitucion", "inteligencia", "sabiduria", "carisma"]');
  expect(playerEngine).toContain("baseVal = Math.floor((rawVal - 10) / 2);");
  expect(playerEngine).toContain("let probHeads = 50 + sp;");
  expect(playerEngine).toContain("const totalCoins = 5;");
  expect(playerEngine).toContain("currentTotal += 4;");
});

test("Stats muestra art asignada por DM y Offensive / Defensive Level", () => {
  expect(statsUi).toContain("data-player-sheet-art");
  expect(statsUi).toContain("Asignada por el DM en Gestión de Jugadores");
  expect(statsUi).toContain("OFFENSIVE LEVEL");
  expect(statsUi).toContain("DEFENSIVE LEVEL");
  expect(statsUi).toContain("SWORD_ICON");
  expect(statsUi).toContain("SHIELD_ICON");
  expect(statsUi).toContain("level + classModifier + dmModifier + itemModifier");
});

test("Gestión de Jugadores es el lugar que edita scores proficiency art y modificadores DM", () => {
  expect(dmPage).toContain('data-tab="dashboard-jugadores"');
  expect(dmPage).toContain('id="dashboard-jugadores"');
  expect(dmPage).toContain("Gestión de Jugadores");
  expect(dmDnd).toContain('const PLAYERS_ROOT = "campaña/jugadores"');
  expect(dmDnd).toContain('field("dashboard-jugadores")');
  expect(dmDnd).toContain('field("grid-jugadores")');
  for (const id of ["str", "dex", "con", "int", "wis", "cha"]) {
    expect(dmDnd).toContain(`dm-player-stat-${id}`);
    expect(dmDnd).toContain(`dm-player-prof-${id}`);
  }
  expect(dmDnd).toContain("updates[`stats/${ability.key}`]");
  expect(dmDnd).toContain("updates[`abilityProficiency/${ability.id}`]");
  expect(dmDnd).toContain("updates.sheetArt");
  expect(dmDnd).toContain('updates["combatLevels/offensive/dmModifier"]');
  expect(dmDnd).toContain('updates["combatLevels/defensive/dmModifier"]');
});

test("Clase e Items quedan como fuentes separadas y Resistencias reservadas para Equipamiento", () => {
  expect(dmDnd).toContain("classModifier");
  expect(dmDnd).toContain("itemModifier");
  expect(dmDnd).toContain("equipmentModifiers");
  expect(dmDnd).toContain("classModifiers");
  expect(dmDnd).toContain("RESISTENCIAS:");
  expect(dmDnd).toContain("reservadas para Equipamiento");
});

test("utils carga los dos módulos solo en sus superficies correspondientes", () => {
  expect(utils).toContain("function ensurePlayerStatsAbilityBarAssets");
  expect(utils).toContain("css/player-stats-ability-bar.css");
  expect(utils).toContain("js/player-stats-ability-bar.js");
  expect(utils).toContain("function ensureDmPlayerDndStudioAssets");
  expect(utils).toContain("#dashboard-jugadores");
  expect(utils).toContain("css/dm-player-dnd-studio.css");
  expect(utils).toContain("js/dm-player-dnd-studio.js");
  expect(dmDndCss).toContain("#dm-player-dnd-studio");
});

test("la barra soporta teclado y layouts móviles", () => {
  expect(statsUi).toContain('event.key === "ArrowRight"');
  expect(statsUi).toContain('event.key === "ArrowLeft"');
  expect(statsUi).toContain('event.key === "Home"');
  expect(statsUi).toContain('event.key === "End"');
  expect(statsCss).toContain("@media (max-width:800px)");
  expect(statsCss).toContain("grid-template-columns:repeat(3,minmax(0,1fr))");
});
