const { test, expect } = require("@playwright/test");
const fs = require("node:fs");
const path = require("node:path");

const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");
const core = read("js/coin-engine-core.js");
const stats = read("js/npc-stats-engine.js");
const studio = read("js/character-manager-npc-stats.js");
const studioCss = read("css/character-manager-npc-stats.css");
const rolls = read("js/dm-npc-rolls.js");
const rollsCss = read("css/dm-npc-rolls.css");
const takeover = read("js/dm-character-manager-takeover.js");
const liveSync = read("js/character-manager-live-sync.js");

const expectedSkills = [
  "athletics", "acrobatics", "sleight_of_hand", "stealth", "arcana", "history",
  "investigation", "nature", "religion", "animal_handling", "insight", "medicine",
  "perception", "survival", "deception", "intimidation", "performance", "persuasion",
];

test("NPC Stats usa las seis abilities y las mismas proficiency states D&D", () => {
  for (const key of ["fuerza", "destreza", "constitucion", "inteligencia", "sabiduria", "carisma"]) {
    expect(stats).toContain(`key: "${key}"`);
  }
  for (const skill of expectedSkills) expect(stats).toContain(`id: "${skill}"`);
  for (const state of ["none", "half", "proficient", "expertise"]) expect(stats).toContain(`${state}: Object.freeze`);
  expect(stats).toContain("Math.floor((numberOr(score, 10) - 10) / 2)");
  expect(stats).toContain("definition.multiplier");
});

test("perfil NPC no introduce clase trasfondo ni progresión de jugador", () => {
  expect(stats).not.toContain("backgroundId");
  expect(stats).not.toContain("classId");
  expect(stats).not.toContain("xpTable");
  expect(stats).not.toContain("calculateLevelData");
  expect(studio).toContain("Clase y Trasfondo no forman parte del perfil NPC");
});

test("Stats solo se habilita para actor sin jugador y persiste por la capa de dominio", () => {
  expect(stats).toContain("function canDmControl(record)");
  expect(stats).toContain("!record?.playerId");
  expect(stats).toContain("Los Stats NPC solo pueden editarse mientras el actor no tenga jugador asignado");
  expect(studio).toContain("statsApi().canDmControl(record) && !selectedPlayer");
  expect(studio).toContain("tab.hidden = !eligible");
  expect(studio).toContain("statsApi().saveActorProfile");
  expect(studio).not.toContain("firebase.database");
  expect(studio).not.toContain("db.ref(");
});

test("persistencia NPC conserva stats proficiency skills y SP en el actor maestro", () => {
  expect(stats).toContain("`${path}/stats`");
  expect(stats).toContain("`${path}/proficiencyBonus`");
  expect(stats).toContain("`${path}/abilityProficiency`");
  expect(stats).toContain("`${path}/skillProficiency`");
  expect(stats).toContain("`${path}/combat_stats/sp`");
  expect(stats).toContain("record.root");
});

test("Coin Engine compartido conserva exactamente cinco monedas y +4 por Head", () => {
  expect(core).toContain('const HEAD_SRC = "https://imgur.com/yshLPnQ.png"');
  expect(core).toContain('const TAIL_SRC = "https://imgur.com/XDx0ICt.png"');
  expect(core).toContain('const HEAD_SFX = "Assets/Audio/SFX/UI/Coin%20SFX/Coin_Heads.wav"');
  expect(core).toContain('const TAIL_SFX = "Assets/Audio/SFX/UI/Coin%20SFX/Coin_Tails.wav"');
  expect(core).toContain("const DEFAULT_COIN_COUNT = 5");
  expect(core).toContain("const HEAD_BONUS = 4");
  expect(core).toContain("currentTotal += HEAD_BONUS");
  expect(core).toContain("duration: 150");
  expect(core).toContain("iterations: Infinity");
});

test("probabilidad NPC reutiliza 50 + SP con clamp 5 a 95", () => {
  expect(stats).toContain("50 + integerOr(sp, 0)");
  expect(stats).toContain("Math.max(5, Math.min(95");
  expect(core).toContain("function clampHeadsChance(value)");
});

test("la consola DM solo ofrece NPCs presentes en la escena", () => {
  expect(rolls).toContain('`${scenePath}/actores`');
  expect(rolls).toContain("resolveMasterRecord(sceneActorId, sceneActor)");
  expect(rolls).toContain("LuminousNpcStats.canDmControl(record)");
  expect(rolls).not.toContain("campaña/base_datos_npcs");
});

test("tirada NPC usa Coin Engine compartido y publica por TheatreRolls", () => {
  expect(rolls).toContain("LuminousCoinEngine.runAnimatedRoll");
  expect(rolls).toContain("LuminousTheatreRolls.publishRoll");
  expect(rolls).toContain("coinCount: 5");
  expect(rolls).toContain("intervalMs: 600");
  expect(rolls).toContain("auto: true");
  expect(rolls).not.toContain("Math.random");
  expect(rolls).not.toContain("campaña/teatro/tiradas");
  expect(rolls).not.toContain("dm_private/theatre_rolls");
});

test("NPC puede hacer roll normal o Check con Threshold y ocultamiento existentes", () => {
  expect(rolls).toContain("theatre-npc-roll-threshold");
  expect(rolls).toContain("theatre-npc-roll-hidden-threshold");
  expect(rolls).toContain("modifierType");
  expect(rolls).toContain("modifierValue");
  expect(rolls).toContain("LuminousTheatreRolls.effectiveThreshold(check)");
  expect(rolls).toContain("LuminousTheatreRolls.checkOutcome(total, check)");
});

test("el parche no muta diálogo sprites ni foco del Theatre", () => {
  for (const source of [rolls, stats, studio, core]) {
    expect(source).not.toContain("dialogo_activo");
    expect(source).not.toContain("actores_visibles");
    expect(source).not.toContain("active_actor");
    expect(source).not.toContain("publishIntervention");
    expect(source).not.toContain("prepareExpression");
  }
});

test("loaders montan Stats en Gestión de Personajes y consola NPC en ON GAME", () => {
  expect(takeover).toContain("character-manager-npc-stats.css");
  expect(takeover).toContain("js/npc-stats-engine.js");
  expect(takeover).toContain("js/character-manager-npc-stats.js");
  expect(liveSync).toContain("css/dm-npc-rolls.css");
  expect(liveSync).toContain("js/coin-engine-core.js");
  expect(liveSync).toContain("js/npc-stats-engine.js");
  expect(liveSync).toContain("js/dm-npc-rolls.js");
  expect(liveSync).toContain('classList?.contains("on-game-dashboard")');
});

test("UI mantiene lenguaje industrial y no dibuja sustitutos de monedas", () => {
  expect(studioCss).toContain("cm-npc-ability-grid");
  expect(rollsCss).toContain("dm-npc-roll-hud-coins");
  expect(rollsCss).toContain(".coin-toss-item");
  expect(rollsCss).not.toContain("border-radius:50%");
});
