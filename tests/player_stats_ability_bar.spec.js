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

test("Stats conserva el mock HUD y elimina CUERPO MENTE ALMA del runtime", () => {
  expect(statsUi).toContain('class="player-stats-frame"');
  expect(statsUi).toContain('class="player-stats-character-panel"');
  expect(statsUi).toContain('class="player-stats-information-panel"');
  expect(statsUi).toContain("function removeLegacyStats(statsContainer)");
  expect(statsUi).toContain('statsContainer.querySelectorAll(":scope > .sheet-attributes-grid, :scope > .player-secondary-stats")');
  for (const code of ["STR", "DEX", "CON", "INT", "WIS", "CHA"]) expect(statsUi).toContain(`code: "${code}"`);
  expect(statsCss).toContain("grid-template-columns:minmax(0,1fr) minmax(0,1fr)");
});

test("DM puede editar XP manual y el editor recalcula Level y progreso", () => {
  expect(dmDnd).toContain('id="dm-player-dnd-xp"');
  expect(dmDnd).toContain('typeof global.calculateLevelData === "function"');
  expect(dmDnd).toContain("const result = global.calculateLevelData(numericXp)");
  expect(dmDnd).toContain("xpPercent: xpData.xpPercent");
  expect(dmDnd).toContain("xpMissing: xpData.xpMissing");
  expect(dmDnd).toContain('class="dm-player-xp-track"');
  expect(dmDnd).toContain('id="dm-player-dnd-xp-fill"');
  expect(dmDnd).toContain('fill.style.width = `${xpData.xpPercent}%`');
  expect(dmDndCss).toContain(".dm-player-xp-track i");
  expect(dmDndCss).toContain("transition:width .2s ease");
});

test("Proficiency sigue usando ceil(Level / 20) y cuatro estados", () => {
  expect(statsUi).toContain("Math.ceil(Math.max(0, numberOr(level, 0)) / 20)");
  expect(dmDnd).toContain("Math.ceil(Math.max(0, numberOr(level, 0)) / 20)");
  for (const state of ["none", "half", "proficient", "expertise"]) expect(statsUi).toContain(`${state}: Object.freeze`);
  for (const state of ["half", "proficient", "expertise"]) expect(dmDndCss).toContain(`[data-prof-state="${state}"]`);
  expect(statsUi).toContain("Math.floor(proficiencyBonus(level) * definition.multiplier)");
  expect(dmDnd).toContain("Math.floor(proficiencyBonus(level) * definition.multiplier)");
});

test("Gestión de Jugadores permite editar todas las D&D Skills", () => {
  const skills = [
    "athletics", "acrobatics", "sleight_of_hand", "stealth", "arcana", "history",
    "investigation", "nature", "religion", "animal_handling", "insight", "medicine",
    "perception", "survival", "deception", "intimidation", "performance", "persuasion",
  ];
  for (const skill of skills) {
    expect(dmDnd).toContain(`id: "${skill}"`);
    expect(dmDnd).toContain(`dm-player-skill-\${skill.id}`);
  }
  expect(dmDnd).toContain("updates[`skillProficiency/${skill.id}`]");
  expect(dmDnd).toContain("function updateSkillTotalsFromForm(level)");
  expect(dmDndCss).toContain(".dm-player-dnd-skill-group");
  expect(dmDndCss).toContain(".dm-player-dnd-skill-grid");
});

test("el editor nuevo absorbe el botón legacy Editar Stats de Combate", () => {
  expect(dmPage).toContain("btn-open-modal");
  expect(dmDnd).toContain('grid.querySelectorAll(".btn-open-modal")');
  expect(dmDnd).toContain('button.dataset.dndStudioProxy = "true"');
  expect(dmDnd).toContain('button.textContent = "⚙️ EDITAR JUGADOR / STATS D&D"');
  expect(dmDnd).toContain("event.stopImmediatePropagation()");
  expect(dmDnd).toContain('field("dm-combat-modal")?.style?.setProperty("display", "none")');
  expect(dmDndCss).toContain('#grid-jugadores .btn-open-modal[data-dnd-studio-proxy="true"]');
});

test("el editor unificado conserva los campos de combate del menú antiguo", () => {
  for (const id of [
    "dm-player-hp-base", "dm-player-hp-coef", "dm-player-hp-actual", "dm-player-hp-max",
    "dm-player-sp", "dm-player-action-slots", "dm-player-stagger",
  ]) expect(dmDnd).toContain(`id="${id}"`);
  expect(dmDnd).toContain('"combatStats/hp_base": hpBase');
  expect(dmDnd).toContain('"combatStats/hp_coefficient": hpCoef');
  expect(dmDnd).toContain('"combatStats/hp_actual": hpActual');
  expect(dmDnd).toContain('"combatStats/hp_max": hpMax');
  expect(dmDnd).toContain('"combatStats/sp_actual": spActual');
  expect(dmDnd).toContain('"combatStats/action_slots": actionSlots');
  expect(dmDnd).toContain('"combatStats/stagger_thresholds": staggerThresholds');
});

test("Offensive y Defensive Level están junto a Level y no dentro de Resistances", () => {
  const resistanceStart = statsUi.indexOf("player-info-resistances");
  const resistanceEnd = statsUi.indexOf("</section>", resistanceStart);
  const resistanceBlock = statsUi.slice(resistanceStart, resistanceEnd);
  expect(resistanceBlock).toContain("EQUIPMENT · PENDING");
  expect(resistanceBlock).not.toContain("data-player-offensive-level");
  expect(resistanceBlock).not.toContain("data-player-defensive-level");
  expect(statsUi).toContain('class="player-level-section"');
  expect(statsUi).toContain('data-combat-level="offensive"');
  expect(statsUi).toContain('data-combat-level="defensive"');
});

test("el header muestra una barra de XP visual además del porcentaje", () => {
  expect(statsUi).toContain('class="player-xp-track" data-player-xp-track');
  expect(statsUi).toContain("data-player-xp-fill");
  expect(statsUi).toContain("data-player-xp-current");
  expect(statsUi).toContain("data-player-xp-progress");
  expect(statsUi).toContain("data-player-xp-missing");
  expect(statsUi).toContain('xpFill.style.width = `${progress}%`');
  expect(statsCss).toContain(".player-xp-track i");
});

test("el icono ofensivo usa una espada reconocible con hoja sólida y guarda", () => {
  expect(statsUi).toContain('const SWORD_ICON = \'<svg');
  expect(statsUi).toContain('fill="currentColor"');
  expect(statsUi).toContain('player-metric-icon--sword');
  expect(statsCss).toContain(".player-metric-icon--sword");
});

test("Stat Saving Throw y cada Skill disparan el mismo Coin Engine", () => {
  expect(statsUi).toContain("function triggerCoinRoll(ability, label, desiredBase)");
  expect(statsUi).toContain('class="player-roll-proxy sheet-skill-row"');
  expect(statsUi).toContain('class="sheet-roll-skill-btn"');
  expect(statsUi).toContain("proxyButton.name = `act_roll_skill_${ability.key}`");
  expect(statsUi).toContain("proxyButton.click()");
  expect(statsUi).toContain('data-dnd-roll="ability"');
  expect(statsUi).toContain('data-dnd-roll="save"');
  expect(statsUi).toContain('row.dataset.dndRoll = "skill"');
  expect(statsUi).toContain("triggerCoinRoll(ability, skill.name, skillValue(skill, ability, data))");
  expect(statsUi).toContain('doc.getElementById("roll-total-score")');
  expect(statsUi).toContain("raw + rollAdjustment.bonus");
});

test("el Coin Engine existente sigue siendo el motor: 5 monedas y +4 por cara", () => {
  expect(playerEngine).toContain('["fuerza", "destreza", "constitucion", "inteligencia", "sabiduria", "carisma"]');
  expect(playerEngine).toContain("baseVal = Math.floor((rawVal - 10) / 2);");
  expect(playerEngine).toContain("const totalCoins = 5;");
  expect(playerEngine).toContain("currentTotal += 4;");
  expect(statsCss).toContain("#coin-toss-panel.coin-toss-modal{z-index:200000!important}");
  expect(statsUi).toContain('coinPanel.classList.add("player-stats-coin-active")');
});

test("Gestión de Jugadores sigue usando campaña/jugadores y no inventa resistencias", () => {
  expect(dmPage).toContain('id="dashboard-jugadores"');
  expect(dmDnd).toContain('const PLAYERS_ROOT = "campaña/jugadores"');
  expect(dmDnd).toContain('field("dashboard-jugadores")');
  expect(dmDnd).toContain("RESISTENCIAS:");
  expect(dmDnd).toContain("permanecen reservadas para Equipamiento");
  expect(statsUi).toContain("EQUIPMENT · PENDING");
});

test("utils mantiene la carga separada de Player HUD y DM Studio", () => {
  expect(utils).toContain("function ensurePlayerStatsAbilityBarAssets");
  expect(utils).toContain("css/player-stats-ability-bar.css");
  expect(utils).toContain("js/player-stats-ability-bar.js");
  expect(utils).toContain("function ensureDmPlayerDndStudioAssets");
  expect(utils).toContain("#dashboard-jugadores");
  expect(utils).toContain("css/dm-player-dnd-studio.css");
  expect(utils).toContain("js/dm-player-dnd-studio.js");
});

test("HUD y editor DM conservan adaptación móvil", () => {
  expect(statsUi).toContain('event.key === "ArrowRight"');
  expect(statsUi).toContain('event.key === "ArrowLeft"');
  expect(statsCss).toContain("@media (max-width:860px)");
  expect(statsCss).toContain("grid-template-columns:repeat(3,minmax(0,1fr))");
  expect(dmDndCss).toContain("@media(max-width:820px)");
  expect(dmDndCss).toContain("@media(max-width:560px)");
});
