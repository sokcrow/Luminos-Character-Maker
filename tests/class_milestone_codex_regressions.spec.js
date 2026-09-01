const { test, expect } = require("@playwright/test");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const milestones = require("../js/class-milestone-engine.js");
const traitEngine = require("../js/trait-engine.js");
const integration = require("../js/class-milestone-trait-integration.js");
const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");

test("proxy player switches emit change and load milestone integration assets", () => {
  class FakeEvent {
    constructor(type, options = {}) {
      this.type = type;
      this.bubbles = Boolean(options.bubbles);
    }
  }

  const listeners = {};
  const appended = [];
  const select = {
    value: "player-a",
    events: [],
    dispatchEvent(event) {
      this.events.push(event.type);
      return true;
    },
  };
  const button = {
    getAttribute(name) {
      return name === "data-id" ? "player-b" : null;
    },
  };
  const document = {
    getElementById(id) {
      return id === "dm-player-dnd-select" ? select : null;
    },
    createElement(tagName) {
      return {
        tagName,
        addEventListener() {},
        dataset: {},
      };
    },
    addEventListener(type, handler) {
      listeners[type] = handler;
    },
    head: {
      appendChild(node) {
        appended.push(node);
      },
    },
  };
  const window = { document, Event: FakeEvent };
  window.window = window;

  vm.runInNewContext(read("js/dm-player-dnd-studio-hotfix.js"), { window, console });

  expect(appended).toEqual(expect.arrayContaining([
    expect.objectContaining({
      id: "class-milestone-trait-integration-script",
      src: "js/class-milestone-trait-integration.js",
    }),
  ]));

  select.value = "player-a";
  expect(select.events).toEqual([]);

  listeners.click({
    target: {
      closest(selector) {
        return selector === "#grid-jugadores .btn-open-modal" ? button : null;
      },
    },
  });

  expect(select.value).toBe("player-b");
  expect(select.events).toEqual(["change"]);

  select.value = "player-a";
  expect(select.events).toEqual(["change"]);
});

test("runtime trait resolution includes General Traits selected by milestones", () => {
  const grantedTrait = {
    id: "danger_senses",
    name: "Danger Senses",
    source: { type: "class", id: "barbarian" },
    contexts: ["theatre"],
    activation: { type: "passive", actionCost: "none" },
    effects: [],
  };
  const generalTrait = {
    id: "iron_will",
    name: "Iron Will",
    source: { type: "general", id: "general" },
    contexts: ["any"],
    activation: { type: "passive", actionCost: "none" },
    effects: [],
  };
  const library = {
    resolveForCharacter() { return [grantedTrait]; },
    getDefinitions() { return { iron_will: generalTrait }; },
  };
  const character = {
    characterBuild: {
      classMilestones: {
        barbarian: {
          20: { type: "trait", traitId: "iron_will" },
        },
      },
    },
  };

  const wrapped = integration.wrapLibrary(library, milestones, traitEngine);
  const traits = wrapped.resolveForCharacter(character);
  expect(traits.map((trait) => trait.id).sort()).toEqual(["danger_senses", "iron_will"]);
  expect(traits.find((trait) => trait.id === "iron_will")?.source?.type).toBe("general");
});

test("milestone trait integration deduplicates a trait already resolved by Grants", () => {
  const generalTrait = {
    id: "iron_will",
    name: "Iron Will",
    source: { type: "general", id: "general" },
    contexts: ["any"],
    activation: { type: "passive", actionCost: "none" },
    effects: [],
  };
  const library = {
    resolveForCharacter() { return [generalTrait]; },
    getDefinitions() { return { iron_will: generalTrait }; },
  };
  const character = {
    characterBuild: {
      classMilestones: {
        fighter: { 20: { type: "trait", traitId: "iron_will" } },
      },
    },
  };

  const wrapped = integration.wrapLibrary(library, milestones, traitEngine);
  expect(wrapped.resolveForCharacter(character).map((trait) => trait.id)).toEqual(["iron_will"]);
});
