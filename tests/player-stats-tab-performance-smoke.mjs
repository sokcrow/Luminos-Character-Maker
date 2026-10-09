import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

// Isolate the actual Stats runtime in a minimal DOM. The performance contract
// is that changing STR/DEX/etc. updates only the selected ability, never the
// complete character sheet or the global click refresh.
const source = fs.readFileSync("js/player-stats-ability-bar.js", "utf8");
const abilityIds = ["str", "dex", "con", "int", "wis", "cha"];
const domListeners = new Map();
const windowListeners = new Map();
const frames = [];
let derivedCalculations = 0;
let skillPreviews = 0;
let abilityPreviews = 0;
let currentPanel = null;

function element() {
  const attrs = new Map();
  const listeners = new Map();
  const classes = new Set();
  return {
    dataset: {},
    style: { setProperty() {} },
    classList: {
      toggle(name, value) {
        if (value) classes.add(name);
        else classes.delete(name);
      },
      contains(name) { return classes.has(name); },
    },
    innerHTML: "",
    textContent: "",
    children: [],
    setAttribute(key, value) { attrs.set(key, String(value)); },
    getAttribute(key) { return attrs.get(key) || null; },
    addEventListener(type, handler) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(handler);
    },
    click() {
      for (const handler of listeners.get("click") || []) handler({});
      for (const handler of domListeners.get("click") || []) {
        handler({ target: { closest: () => null } });
      }
    },
    focus() {},
    querySelector() { return null; },
    querySelectorAll() { return []; },
    appendChild(child) { this.children.push(child); },
    replaceChildren() { this.children = []; },
    remove() {},
  };
}

const abilityButtons = Object.fromEntries(abilityIds.map((id) => {
  const button = element();
  button.dataset.stat = id;
  const indicator = element();
  button.querySelector = (selector) => selector === ".player-prof-indicator" ? indicator : null;
  return [id, button];
}));
const skillList = element();
const panel = element();
panel.dataset.activeStat = "str";
panel.querySelector = (selector) => {
  if (selector === "[data-player-skill-list]") return skillList;
  const stat = selector.match(/^\\.player-ability\\[data-stat="(\\w+)"\\]$/);
  return stat ? abilityButtons[stat[1]] : null;
};
panel.querySelectorAll = (selector) => selector === ".player-ability" ? Object.values(abilityButtons) : [];

const statsContainer = {
  querySelector: () => currentPanel,
  querySelectorAll: () => [],
  prepend(child) { currentPanel = child; },
};
const modal = element();
const document = {
  readyState: "loading",
  documentElement: { clientWidth: 1920, clientHeight: 1080 },
  head: { appendChild() {} },
  createElement(tag) { return tag === "section" ? panel : element(); },
  getElementById(id) { return id === "stats-modal" ? modal : null; },
  querySelector(selector) {
    if (selector === "#stats-modal #stats-container") return statsContainer;
    if (selector === "#stats-modal .player-ability-console") return currentPanel;
    return null;
  },
  addEventListener(name, handler) {
    if (!domListeners.has(name)) domListeners.set(name, []);
    domListeners.get(name).push(handler);
  },
};

const character = {
  characterName: "Stats Performance Test",
  level: 3,
  stats: { fuerza: 14, destreza: 12, constitucion: 11, inteligencia: 13, sabiduria: 10, carisma: 9 },
};
const window = {
  document,
  datosJugador: character,
  innerWidth: 1920,
  innerHeight: 1080,
  requestAnimationFrame(callback) { frames.push(callback); },
  queueMicrotask(callback) { callback(); },
  addEventListener(name, callback) {
    if (!windowListeners.has(name)) windowListeners.set(name, []);
    windowListeners.get(name).push(callback);
  },
  LuminousRacialStatRuntime: { ensureDependencies() {} },
  LuminousProficiencyRuntime: {
    proficiencyBonus: () => 2,
    abilityModifier: (score) => Math.floor((score - 10) / 2),
    normalizeState: (state) => state || "none",
    contribution: () => 0,
  },
  LuminousDerivedStats: {
    resolveCharacterStats(data) {
      derivedCalculations += 1;
      const keys = ["fuerza", "destreza", "constitucion", "inteligencia", "sabiduria", "carisma"];
      return { abilities: Object.fromEntries(abilityIds.map((id, i) => [id, { score: data.stats[keys[i]] }])) };
    },
  },
  LuminousSkillTraitBreakdownPatch: {
    syncPlayerSkillPreviews() { skillPreviews += 1; },
    syncPlayerAbilityPreviews() { abilityPreviews += 1; },
  },
};

vm.runInNewContext(source, { window, MutationObserver: class {} }, { filename: "player-stats-ability-bar.js" });
for (const callback of domListeners.get("DOMContentLoaded") || []) callback();

assert.equal(derivedCalculations, 1, "Boot must calculate the derived stats exactly once");
assert.equal(skillPreviews, 1);
assert.equal(abilityPreviews, 1);

for (const id of ["dex", "wis", "cha", "str"]) {
  abilityButtons[id].click();
  assert.equal(panel.dataset.activeStat, id, "Tab selection must update immediately");
  assert.equal(abilityButtons[id].getAttribute("aria-selected"), "true");
  assert.equal(derivedCalculations, 1, "Tab switching must reuse the derived stats snapshot");
}
assert.equal(skillPreviews, 5, "Only the visible Skill previews should refresh per selected tab");
assert.equal(abilityPreviews, 5);
abilityButtons.str.click();
assert.equal(skillPreviews, 5, "Clicking the already-active tab should do no extra work");
assert.equal(derivedCalculations, 1);

// Multiple data/trait/class changes in one frame should produce one refresh.
for (const event of ["luminous:player-data", "luminous:traits-refreshed", "luminous:class-runtime-loaded"]) {
  for (const callback of windowListeners.get(event) || []) callback();
}
assert.equal(frames.length, 1, "Data refreshes must be batched into one animation frame");
frames.shift()();
assert.equal(derivedCalculations, 2, "Batched data changes should recompute the character once");

console.log("player-stats-tab-performance-smoke: ok");
