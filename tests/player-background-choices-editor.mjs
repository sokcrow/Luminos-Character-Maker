import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

function element(tag = "div") {
  const listeners = {};
  const node = {
    tagName: tag.toLowerCase(), className: "", textContent: "", value: "", children: [],
    hidden: false, disabled: false, dataset: {}, attributes: {},
    classList: { add() {}, remove() {}, toggle() {} },
    addEventListener(name, callback) { (listeners[name] ||= []).push(callback); },
    async fire(name, event = {}) { return Promise.all((listeners[name] || []).map((fn) => fn(event))); },
    append(...children) { this.children.push(...children); },
    appendChild(child) { this.children.push(child); return child; },
    replaceChildren(...children) { this.children = children; },
    setAttribute(name, value) { this.attributes[name] = value; },
    querySelectorAll(selector) {
      const result = [];
      const match = (target) => selector.startsWith(".")
        ? target.className.split(" ").includes(selector.slice(1))
        : target.tagName === selector.toLowerCase();
      const visit = (target) => {
        for (const child of target.children) {
          if (match(child)) result.push(child);
          visit(child);
        }
      };
      visit(this);
      return result;
    },
    querySelector(selector) { return this.querySelectorAll(selector)[0] || null; },
    focus() {},
    get childElementCount() { return this.children.length; },
  };
  return node;
}
function textContent(node) {
  return [node.textContent, ...node.children.flatMap((child) => textContent(child))].filter(Boolean).join(" | ");
}

const document = {
  head: element("head"),
  createElement: element,
  getElementById: () => null,
  querySelector: () => null,
};
const scope = {
  document, console,
  LuminousTraitEngine: {
    createState: () => ({}),
    normalizeTrait: (trait) => trait,
    listAvailableTraitActions: () => [],
  },
};
scope.window = scope;
const context = vm.createContext(scope);
vm.runInContext(fs.readFileSync("js/trait-player-tray.js", "utf8"), context);
vm.runInContext(fs.readFileSync("js/legacy-background-catalog.js", "utf8"), context);
const Tray = scope.LuminousTraitPlayerTray.TraitPlayerTray;

let character = {
  uid: "player-uid",
  characterBuild: { backgroundId: "street_medic" },
  backgroundChoices: {},
};
scope.LuminousBackgroundNarratives = {
  get(id) {
    if (id !== "street_medic") return null;
    return {
      id, name: "Médico callejero", overview: "Historia médica",
      trait: { name: "Patchwork Medicine", description: "+X Power" },
      feature: { name: "Street Clinic Network", description: "Red de clínicas" },
      ideals: [{ id: "ideal_1", label: "Cuidado" }],
      bonds: [{ id: "bond_1", label: "Mi barrio" }],
      flaws: [{ id: "flaw_1", label: "Desconfianza" }],
    };
  },
};
let writes = [];
const saveBackgroundChoices = async (id, payload) => {
  writes.push({ id, payload });
  character = { ...character, backgroundChoices: { ...character.backgroundChoices, ...payload } };
};
const tray = new Tray({
  getRuntime: () => ({ character }),
  getTraits: () => [],
  saveBackgroundChoices,
});
tray.backgroundPanel = element("section");
tray.renderBackground();
assert.match(textContent(tray.backgroundPanel), /COMPLETAR BACKGROUND/);
const editButton = tray.backgroundPanel.querySelector(".player-background-edit-button");
assert.ok(editButton, "Missing edit button inside Background panel");
await editButton.fire("click");
const form = tray.backgroundPanel.querySelector(".player-background-choice-editor");
assert.ok(form, "Missing inline narrative editor");
const fields = form.querySelectorAll("select");
assert.equal(fields.length, 3);
assert.ok(fields[0].children.some((item) => item.value === "ideal_1"), "Catalog ideals must be selectable");
fields[0].value = "ideal_1";
fields[1].value = "__custom__";
await fields[1].fire("change");
assert.ok(!form.querySelectorAll(".player-background-choice-custom")[1].hidden);
form.querySelectorAll(".player-background-choice-custom")[1].value = "La enfermera que me salvó";
form.querySelectorAll(".player-background-personality-input")[0].value = "Empático";
const pending = form;
tray.renderBackground(); // Simulates an unrelated live Firebase / Trait refresh.
assert.equal(tray.backgroundPanel.querySelector(".player-background-choice-editor"), pending,
  "Background editor must survive live refresh without losing typing");
await form.fire("submit", { preventDefault() {} });
assert.equal(writes.length, 1);
assert.equal(writes[0].id, "street_medic");
assert.equal(writes[0].payload.ideal, "ideal_1");
assert.equal(writes[0].payload.bond, "La enfermera que me salvó");
assert.ok(!("flaw" in writes[0].payload), "Unfilled fields should remain untouched");
assert.deepEqual(Array.from(writes[0].payload.personality), ["Empático"]);
assert.ok(!tray.backgroundPanel.querySelector(".player-background-choice-editor"), "Successful save exits editor");
const rendered = textContent(tray.backgroundPanel);
assert.match(rendered, /Cuidado/);
assert.match(rendered, /La enfermera que me salvó/);
assert.match(rendered, /Empático/);
assert.match(rendered, /HP COEF|Médico callejero/);

// Legacy psychological values are preloaded in the same editor and can be replaced.
const legacy = new Tray({
  getRuntime: () => ({
    character: { backgroundId: "alta_cuna", psychologicalIdeal: "Respeto", psychologicalVinculo: "Mi familia" },
  }),
  getTraits: () => [],
  saveBackgroundChoices,
});
legacy.backgroundPanel = element("section");
legacy.renderBackground();
assert.match(textContent(legacy.backgroundPanel), /Respeto/);
await legacy.backgroundPanel.querySelector(".player-background-edit-button").fire("click");
const legacyForm = legacy.backgroundPanel.querySelector(".player-background-choice-editor");
assert.equal(legacyForm.querySelectorAll("select")[0].value, "__custom__");
assert.equal(legacyForm.querySelectorAll(".player-background-choice-custom")[0].value, "Respeto");

// No mechanical Background assigned: don't pretend the player can assign a coefficient.
const missing = new Tray({ getRuntime: () => ({ character: {} }), getTraits: () => [], saveBackgroundChoices });
missing.backgroundPanel = element("section");
missing.renderBackground();
assert.match(textContent(missing.backgroundPanel), /Aún no tienes un Background asignado/);
assert.ok(!missing.backgroundPanel.querySelector(".player-background-edit-button"));

// Validate the actual Firebase save function without mounting the entire runtime.
const runtime = fs.readFileSync("js/player-trait-runtime.js", "utf8");
const begin = runtime.indexOf("  async function saveBackgroundChoices(");
const end = runtime.indexOf("\n  function mountTray()", begin);
assert.ok(begin >= 0 && end > begin);
const state = { playerId: "p42", db: { ref(path) {
  return { async update(payload) { writes.push({ path, payload }); } };
} }, character: {
  uid: "uid42",
  characterBuild: { backgroundId: "street_medic", breakdown: { backgroundHpCoefBonus: 0.14 } },
  backgroundChoices: { ideal: "old_ideal" },
} };
const storage = { localStorage: { getItem: () => "p42" } };
const save = new Function("state", "getCharacter", "currentAuthUid", "connectFirebase",
  "global", "PLAYER_ID_STORAGE_KEY", "PLAYER_ROOT",
  runtime.slice(begin, end) + "\nreturn saveBackgroundChoices;",
)(state, () => state.character, () => "uid42", () => true, storage, "playerId", "campaña/jugadores");
await save("street_medic", { bond: "Mi contacto", personality: ["Prudente"] });
assert.equal(writes.at(-1).path, "campaña/jugadores/p42/backgroundChoices");
assert.deepEqual(writes.at(-1).payload, { bond: "Mi contacto", personality: ["Prudente"], backgroundId: "street_medic" });
assert.equal(state.character.backgroundChoices.ideal, "old_ideal", "Existing fields must be preserved");
assert.equal(state.character.characterBuild.breakdown.backgroundHpCoefBonus, 0.14, "Mechanical build unchanged");
await assert.rejects(save("different_background", { ideal: "Invalid" }), /Background cambió/);
state.character.uid = "different_uid";
await assert.rejects(save("street_medic", { ideal: "Invalid" }), /verificar tu personaje/);

// A Firebase write can overlap the DM's live character update.
// Never reinsert the character snapshot taken before the await.
function deferredBackgroundSave(initialCharacter) {
  let finishWrite;
  let updateStarted;
  const started = new Promise((resolve) => { updateStarted = resolve; });
  const live = {
    playerId: "p42",
    character: initialCharacter,
    db: { ref(path) {
      assert.equal(path, "campaña/jugadores/p42/backgroundChoices");
      return { update(payload) {
        updateStarted(payload);
        return new Promise((resolve) => { finishWrite = resolve; });
      } };
    } },
  };
  const savePending = new Function("state", "getCharacter", "currentAuthUid", "connectFirebase",
    "global", "PLAYER_ID_STORAGE_KEY", "PLAYER_ROOT",
    runtime.slice(begin, end) + "\nreturn saveBackgroundChoices;",
  )(live, () => live.character, () => "uid42", () => true, storage, "playerId", "campaña/jugadores");
  return { live, savePending, started, complete() { finishWrite(); } };
}

const concurrentSame = deferredBackgroundSave({
  uid: "uid42",
  characterBuild: { backgroundId: "street_medic", classes: ["old_class"] },
  backgroundChoices: { ideal: "old_ideal" },
  stats: { fuerza: 8 },
});
const samePending = concurrentSame.savePending("street_medic", { bond: "Mi contacto" });
await concurrentSame.started;
concurrentSame.live.character = {
  uid: "uid42",
  characterBuild: { backgroundId: "street_medic", classes: ["new_class"] },
  backgroundChoices: { ideal: "live_ideal" },
  stats: { fuerza: 18 },
  traits: ["new_trait"],
};
concurrentSame.complete();
await samePending;
assert.deepEqual(concurrentSame.live.character.characterBuild.classes, ["new_class"],
  "A concurrent DM class edit must not be replaced by the pre-save snapshot");
assert.equal(concurrentSame.live.character.stats.fuerza, 18);
assert.deepEqual(concurrentSame.live.character.traits, ["new_trait"]);
assert.equal(concurrentSame.live.character.backgroundChoices.ideal, "live_ideal",
  "Keep an unrelated narrative change from the newest listener event");
assert.equal(concurrentSame.live.character.backgroundChoices.bond, "Mi contacto",
  "Merge saved narrative fields into the latest character state");

const concurrentChanged = deferredBackgroundSave({
  uid: "uid42",
  characterBuild: { backgroundId: "street_medic" },
  backgroundChoices: { ideal: "old_ideal" },
});
const changedPending = concurrentChanged.savePending("street_medic", { bond: "Old background bond" });
await concurrentChanged.started;
const newestDmCharacter = {
  uid: "uid42",
  characterBuild: { backgroundId: "guardia", classes: ["fighter"], breakdown: { backgroundHpCoefBonus: 0.2 } },
  backgroundChoices: { backgroundId: "guardia", ideal: "new_background_ideal" },
  traits: ["guardia_trait"],
};
concurrentChanged.live.character = newestDmCharacter;
concurrentChanged.complete();
await changedPending;
assert.equal(concurrentChanged.live.character, newestDmCharacter,
  "Saving an old Background must not overwrite a DM's new Background after the await");
assert.equal(concurrentChanged.live.character.backgroundChoices.ideal, "new_background_ideal");
assert.ok(!("bond" in concurrentChanged.live.character.backgroundChoices),
  "Do not attach stale narrative choices to a newly selected Background");

// Reusing a saved character with a different Background must not expose previous choices.
const switchedCharacter = {
  characterBuild: { backgroundId: "street_medic" },
  backgroundChoices: { backgroundId: "old_background", ideal: "wrong_choice" },
};
const switched = new Tray({ getRuntime: () => ({ character: switchedCharacter }), getTraits: () => [], saveBackgroundChoices });
switched.backgroundPanel = element("section");
switched.renderBackground();
assert.ok(!textContent(switched.backgroundPanel).includes("wrong_choice"), "Old Background decisions must not leak after a DM change");

console.log("PASS: Inline Background editor (canonical, custom, legacy), live-refresh draft preservation, Firebase paths, auth guards and non-mechanical saves.");
