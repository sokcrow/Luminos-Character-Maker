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

// A preserved draft must not replay prefilled fields if the DM changes them.
let concurrentCharacter = {
  uid: "player-uid",
  characterBuild: { backgroundId: "street_medic" },
  backgroundChoices: {
    backgroundId: "street_medic",
    ideal: "ideal_1",
    bond: "bond_1",
    flaw: "flaw_1",
    personality: ["Prudente"],
  },
};
const editsOnly = [];
const concurrentTray = new Tray({
  getRuntime: () => ({ character: concurrentCharacter }),
  getTraits: () => [],
  async saveBackgroundChoices(id, payload) {
    editsOnly.push({ id, payload });
    concurrentCharacter = { ...concurrentCharacter, backgroundChoices: { ...concurrentCharacter.backgroundChoices, ...payload } };
  },
});
concurrentTray.backgroundPanel = element("section");
concurrentTray.renderBackground();
await concurrentTray.backgroundPanel.querySelector(".player-background-edit-button").fire("click");
const unchangedForm = concurrentTray.backgroundPanel.querySelector(".player-background-choice-editor");
await unchangedForm.fire("submit", { preventDefault() {} });
assert.equal(editsOnly.length, 0, "No edits must not submit stale prefills");
assert.match(textContent(unchangedForm), /Modifica al menos una decisión/);
const savedSelects = unchangedForm.querySelectorAll("select");
assert.equal(savedSelects[0].value, "ideal_1");
assert.equal(savedSelects[1].value, "bond_1");
concurrentCharacter = {
  ...concurrentCharacter,
  backgroundChoices: {
    backgroundId: "street_medic",
    ideal: "ideal_changed_by_dm",
    bond: "bond_1",
    flaw: "flaw_changed_by_dm",
    personality: ["Paciente"],
  },
};
concurrentTray.renderBackground(); // Keep draft while Firebase listener changes saved fields.
assert.equal(concurrentTray.backgroundPanel.querySelector(".player-background-choice-editor"), unchangedForm);
savedSelects[1].value = "__custom__";
unchangedForm.querySelectorAll(".player-background-choice-custom")[1].value = "El amigo del barrio";
await unchangedForm.fire("submit", { preventDefault() {} });
assert.equal(editsOnly.length, 1);
assert.deepEqual(editsOnly[0].payload, { bond: "El amigo del barrio" },
  "Only player-edited bond may be submitted; no stale ideal, flaw or personality");
assert.equal(concurrentCharacter.backgroundChoices.ideal, "ideal_changed_by_dm");
assert.equal(concurrentCharacter.backgroundChoices.flaw, "flaw_changed_by_dm");
assert.deepEqual(concurrentCharacter.backgroundChoices.personality, ["Paciente"]);

// Explicitly clearing a saved field is a change, not a request to resend other fields.
await concurrentTray.backgroundPanel.querySelector(".player-background-edit-button").fire("click");
const clearForm = concurrentTray.backgroundPanel.querySelector(".player-background-choice-editor");
clearForm.querySelectorAll("select")[0].value = "";
clearForm.querySelectorAll(".player-background-personality-input")[0].value = "";
await clearForm.fire("submit", { preventDefault() {} });
assert.deepEqual(editsOnly[1].payload, { ideal: "", personality: [] });
assert.equal(concurrentCharacter.backgroundChoices.ideal, "");

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

// Verify the real Firebase saver: atomic scope replacement and concurrent updates.
const runtime = fs.readFileSync("js/player-trait-runtime.js", "utf8");
const begin = runtime.indexOf("  async function saveBackgroundChoices(");
const end = runtime.indexOf("\n  function mountTray()", begin);
assert.ok(begin >= 0 && end > begin);
const storage = { localStorage: { getItem: () => "p42" } };
const writes = [];
function buildSaver(live) {
  return new Function("state", "getCharacter", "currentAuthUid", "connectFirebase",
    "global", "PLAYER_ID_STORAGE_KEY", "PLAYER_ROOT",
    runtime.slice(begin, end) + "\nreturn saveBackgroundChoices;",
  )(live, () => live.character, () => "uid42", () => true, storage, "playerId", "campaña/jugadores");
}
function createDatabase(initial) {
  let saved = initial;
  return {
    get stored() { return saved; },
    ref(path) {
      assert.equal(path, "campaña/jugadores/p42/backgroundChoices");
      return {
        async transaction(transform, onComplete, applyLocally) {
          assert.equal(applyLocally, false, "Suppress speculative local events while transaction is pending");
          saved = transform(saved);
          writes.push({ path, payload: saved });
          return { committed: true, snapshot: { val: () => saved } };
        },
      };
    },
  };
}

const db = createDatabase({ ideal: "old_ideal" });
const state = {
  playerId: "p42", db, character: {
    uid: "uid42",
    characterBuild: { backgroundId: "street_medic", breakdown: { backgroundHpCoefBonus: 0.14 } },
    backgroundChoices: { ideal: "old_ideal" },
  },
};
const save = buildSaver(state);
await save("street_medic", { bond: "Mi contacto", personality: ["Prudente"] });
assert.equal(writes.at(-1).path, "campaña/jugadores/p42/backgroundChoices");
assert.deepEqual(writes.at(-1).payload, {
  ideal: "old_ideal", bond: "Mi contacto", personality: ["Prudente"], backgroundId: "street_medic",
});
assert.equal(state.character.backgroundChoices.ideal, "old_ideal", "Existing fields must be preserved");
assert.equal(state.character.characterBuild.breakdown.backgroundHpCoefBonus, 0.14, "Mechanical build unchanged");
await assert.rejects(save("different_background", { ideal: "Invalid" }), /Background cambió/);
state.character.uid = "different_uid";
await assert.rejects(save("street_medic", { ideal: "Invalid" }), /verificar tu personaje/);

// Background B's first partial save must never revive Background A's other decisions.
const foreignDb = createDatabase({
  backgroundId: "old_background", ideal: "old_ideal", bond: "old_bond",
  flaw: "old_flaw", personality: ["Old trait"],
});
const fresh = {
  playerId: "p42", db: foreignDb,
  character: {
    uid: "uid42",
    characterBuild: { backgroundId: "street_medic" },
    backgroundChoices: { ...foreignDb.stored },
  },
};
await buildSaver(fresh)("street_medic", { bond: "New bond" });
assert.deepEqual(foreignDb.stored, { backgroundId: "street_medic", bond: "New bond" },
  "Remove all previous Background's omitted fields on the first new-scope save");
assert.deepEqual(fresh.character.backgroundChoices, { backgroundId: "street_medic", bond: "New bond" },
  "The player UI must also remove the previous Background's decisions");

// Atomic transaction must rebase against changes made by the DM during the save.
function deferredBackgroundSave(initialCharacter, stored) {
  let finishWrite;
  let transactionStarted;
  const started = new Promise((resolve) => { transactionStarted = resolve; });
  const live = {
    playerId: "p42", character: initialCharacter,
    db: { ref(path) {
      assert.equal(path, "campaña/jugadores/p42/backgroundChoices");
      return { transaction(transform) {
        transactionStarted();
        return new Promise((resolve) => {
          finishWrite = () => {
            const next = transform(stored);
            resolve({ committed: true, snapshot: { val: () => next } });
          };
        });
      } };
    } },
  };
  return { live, savePending: buildSaver(live), started, complete() { finishWrite(); } };
}

const concurrentSame = deferredBackgroundSave({
  uid: "uid42",
  characterBuild: { backgroundId: "street_medic", classes: ["old_class"] },
  backgroundChoices: { backgroundId: "street_medic", ideal: "old_ideal" },
  stats: { fuerza: 8 },
}, { backgroundId: "street_medic", ideal: "live_ideal" });
const samePending = concurrentSame.savePending("street_medic", { bond: "Mi contacto" });
await concurrentSame.started;
concurrentSame.live.character = {
  uid: "uid42",
  characterBuild: { backgroundId: "street_medic", classes: ["new_class"] },
  backgroundChoices: { backgroundId: "street_medic", ideal: "live_ideal" },
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
  backgroundChoices: { backgroundId: "street_medic", ideal: "old_ideal" },
}, { backgroundId: "street_medic", ideal: "old_ideal" });
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
