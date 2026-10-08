import assert from "node:assert/strict";
import fs from "node:fs";

const load = (path) => new Function(fs.readFileSync(path, "utf8"))();
load("js/trait-engine.js");
load("js/archetype-engine.js");
load("js/archetype-trait-catalog.js");
load("js/rogue-class-runtime.js");

const character = {
  level: 55, classes: [{ id: "rogue", levels: 55 }, { id: "barbarian", levels: 15 }],
  classLevels: { rogue: 55, barbarian: 15 },
  stats: { fuerza: 18, carisma: 16 },
  skillProficiency: { performance: "proficient" },
};
const traits = [
  globalThis.LuminousArchetypeTraitCatalog.getDefinition("devil_lineage_jackpot"),
  globalThis.LuminousRogueClassRuntime.ROGUE_DEFINITIONS.reliable_talent,
];
const ability = { id: "cha", code: "CHA", key: "carisma", skills: [{ id: "performance", name: "Performance" }] };
const target = { dataset: { dndRoll: "skill", skillId: "performance" } };
target.closest = () => target;
const panel = {
  dataset: { activeStat: "cha" },
  contains: (node) => node === target,
  querySelector: (selector) => selector.startsWith(".dnd-skill") ? target : null,
  addEventListener(type, listener, capture) {
    if (type === "click" && capture) this.clickListener = listener;
  },
};
const listeners = new Map();
globalThis.document = {
  readyState: "loading",
  querySelector(selector) { return selector === "#stats-modal .player-ability-console" ? panel : null; },
  addEventListener() {},
};
globalThis.addEventListener = (type, listener) => { listeners.set(type, listener); };
globalThis.datosJugador = character;
let rolls = [];
globalThis.LuminousPlayerStats = {
  ABILITIES: [ability],
  triggerCoinRoll(...args) { rolls.push(args); return true; },
  skillValue() { return 5; },
};
globalThis.LuminousPlayerTraitRuntime = {
  getCharacter() { return character; },
  getTraits() { return traits; },
  resolveTheatreCheck(check) {
    const result = globalThis.LuminousTraitEngine.resolveTheatreCheck({ character, traits, check });
    globalThis.LuminousSkillTraitBreakdownPatch.applySpecialCheckBonuses(traits, character, result.check);
    return result;
  },
};
const armed = [];
globalThis.LuminousTraitStandardizationRuntime = {
  armPlayerCheck(check) { armed.push({ ...check }); return { ...check }; },
};

load("js/skill-trait-breakdown-patch.js");
const patch = globalThis.LuminousSkillTraitBreakdownPatch;
assert.equal(patch.installPlayerRollBridge(), true);
assert.equal(typeof panel.clickListener, "function");

function click() {
  let canceled = 0;
  panel.clickListener({
    target,
    preventDefault() { canceled++; },
    stopPropagation() {},
    stopImmediatePropagation() {},
  });
  assert.equal(canceled, 1);
}
click();
assert.equal(rolls[0][2], 9, "Base +5 and Jackpot +4 before coins; Reliable Talent is post-coin.");
assert.equal(armed[0].checkPower, 4);
assert.equal(armed[0].finalPower, 3);
assert.equal(5 + armed[0].checkPower + armed[0].finalPower, 12);

// A lazy-loaded coin bridge must still include Final Power exactly once.
globalThis.LuminousTraitStandardizationRuntime.armPlayerCheck = () => null;
click();
assert.equal(rolls[1][2], 12, "Without a post-coin bridge, all Trait bonuses affect the roll base once.");

const dmCheck = { kind: "skill", skillId: "performance", abilityId: "cha", checkPower: 4, finalPower: 3 };
const requested = [];
globalThis.LuminousTraitStandardizationRuntime.armPlayerCheck = (check) => { requested.push(check); return check; };
patch.installResolvedCheckBridge();
const dmEvent = listeners.get("luminous:theatre-traits-applied");
dmEvent({ detail: { check: dmCheck } });
click();
assert.equal(rolls[2][2], 9, "DM-authorised Check must use the actual resolved Check Power.");
assert.equal(requested[0].finalPower, 3, "DM Final Power cannot be counted twice in roll base.");

const sheet = fs.readFileSync("pantalla_dm.html", "utf8");
assert.match(sheet, /src="js\/trait-engine\.js"/);
assert.match(sheet, /src="js\/skill-trait-breakdown-patch\.js"/);
assert.ok(sheet.indexOf('src="js/trait-engine.js"') < sheet.indexOf('src="js/skill-trait-breakdown-patch.js"'),
  "The DM must initialize the engine before its preview.");
const standard = fs.readFileSync("js/trait-standardization-runtime.js", "utf8");
assert.match(standard, /function armPlayerCheck\(/);
assert.match(standard, /armPlayerCheck,/);
const ranger = fs.readFileSync("js/ranger-class-runtime.js", "utf8");
assert.match(ranger, /__rangerFavoredEnemyTrackingApplied/);
console.log("Trait manual/DM rolls: Jackpot, Reliable Talent, post-coin, lazy fallback, DM Check and HUD loaded OK.");
