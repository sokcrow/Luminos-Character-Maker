import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const png = fs.readFileSync(path.join(root, "Assets/Icons/milestones/stat-or-trait.png"));
assert.ok(png.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])), "Milestone image must be a real PNG");
assert.ok(png.length > 1000, "Milestone icon must not be empty");

const runtime = fs.readFileSync(path.join(root, "js/player-progression-tree.js"), "utf8");
const injectAt = "  global.LuminousPlayerProgressionTree = api;";
assert.ok(runtime.includes(injectAt), "Progression API hook not found");

function fakeButton() {
  return {
    dataset: {},
    attributes: {},
    setAttribute(name, value) { this.attributes[name] = value; },
    addEventListener() {},
    querySelector(selector) {
      if (selector === ".player-progression-milestone-choice-icon") return this.testIcon || null;
      return null;
    },
    querySelectorAll() { return []; },
  };
}
const sandbox = {
  document: {
    readyState: "loading",
    addEventListener() {},
    createElement() { return fakeButton(); },
  },
};
vm.runInNewContext(runtime.replace(
  injectAt,
  "  global.__makeProgressionNodeForTest = createNode;\n" + injectAt,
), sandbox);
const makeNode = sandbox.__makeProgressionNodeForTest;
assert.equal(typeof makeNode, "function");

const classModel = { classId: "fighter", className: "Fighter" };
function node(level, choiceMilestone, milestoneClaimed = false) {
  return {
    level,
    status: "earned",
    choiceMilestone,
    milestoneClaimed,
    items: choiceMilestone
      ? [{ kind: "milestone_choice", name: "Choose Stats or General Trait" }]
      : [{ kind: "trait", name: "Fighter Trait" }],
  };
}

for (const selected of [false, true]) {
  const button = makeNode(classModel, node(20, true, selected));
  assert.equal(button.dataset.choiceMilestone, "stat-or-trait");
  assert.match(button.innerHTML, /class="player-progression-milestone-choice-icon"/);
  assert.match(button.innerHTML, /Assets\/Icons\/milestones\/stat-or-trait\.png/);
  assert.doesNotMatch(button.innerHTML, /player-progression-class-icon/, "Choice icon overrides class seal");
}

const automatic = makeNode(classModel, node(15, false));
assert.equal(automatic.dataset.choiceMilestone, undefined);
assert.doesNotMatch(automatic.innerHTML, /milestone-choice-icon/, "Automatic trait grants keep existing art");
assert.match(automatic.innerHTML, /Assets\/Icons\/classes\/fighter\.png/);

const branchNode = makeNode(classModel, node(20, true), { id: "battle_master" });
assert.doesNotMatch(branchNode.innerHTML, /milestone-choice-icon/, "Archetype milestones do not use choice icon");

let onIconError = null;
let brokenImage = null;
sandbox.document.createElement = () => {
  const button = fakeButton();
  brokenImage = {
    outerHTML: "",
    addEventListener(event, fn) {
      assert.equal(event, "error");
      onIconError = fn;
    },
  };
  button.testIcon = brokenImage;
  return button;
};
makeNode(classModel, node(20, true));
assert.equal(typeof onIconError, "function", "Missing PNG must fall back to class artwork");
onIconError();
assert.match(brokenImage.outerHTML, /Assets\/Icons\/classes\/fighter\.png/);
const css = fs.readFileSync(path.join(root, "css/player-progression-mystic.css"), "utf8");
assert.match(css, /player-progression-milestone-choice-icon/);

console.log("milestone-choice-icon-smoke: ok");
