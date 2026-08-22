const { test, expect } = require("@playwright/test");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const milestones = require("../js/class-milestone-engine.js");
const traitEngine = require("../js/trait-engine.js");
const integration = require("../js/class-milestone-trait-integration.js");
const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");

test("programmatic player select changes emit change so milestones rebind", () => {
  class FakeSelect {
    constructor() {
      this.id = "dm-player-dnd-select";
      this._value = "player-a";
      this.events = [];
    }
    dispatchEvent(event) {
      this.events.push(event.type);
      return true;
    }
  }
  Object.defineProperty(FakeSelect.prototype, "value", {
    configurable: true,
    enumerable: true,
    get() { return this._value; },
    set(value) { this._value = String(value); },
  });

  class FakeEvent {
    constructor(type, options = {}) {
      this.type = type;
      this.bubbles = Boolean(options.bubbles);
    }
  }

  const document = {
    getElementById() { return null; },
    createElement() {
      return {
        addEventListener() {},
        dataset: {},
      };
    },
    head: { appendChild() {} },
  };
  const window = { document, HTMLSelectElement: FakeSelect, Event: FakeEvent };
  window.window = window;

  vm.runInNewContext(read("js/dm-player-dnd-studio-hotfix.js"), { window, console });

  const select = new FakeSelect();
  select.value = "player-b";
  expect(select.value).toBe("player-b");
  expect(select.events).toEqual(["change"]);

  select.value = "player-b";
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

test("hotfix loads the milestone trait runtime integration asset", () => {
  const source = read("js/dm-player-dnd-studio-hotfix.js");
  expect(source).toContain("class-milestone-trait-integration-script");
  expect(source).toContain("js/class-milestone-trait-integration.js");
  expect(source).toContain("dm-player-dnd-select");
  expect(source).toContain('new EventCtor("change", { bubbles: true })');
});
