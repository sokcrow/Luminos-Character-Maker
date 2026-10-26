import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = fs.readFileSync(path.join(root, "js/trait-standardization-runtime.js"), "utf8");
const callbacks = new Map();
const emitted = [];
const player = { id: "player_1", name: "Tester" };
const db = { ref(key) { return { on(event, handler) { assert.equal(event, "value"); callbacks.set(key, handler); } }; } };
const window = {
  document: { getElementById() { return null; }, addEventListener() {}, head: { appendChild() {} }, readyState: "loading" },
  firebase: { apps: [{}], database() { return db; } },
  LuminousStatusEngine: {},
  LuminousUniversalModifiers: {},
  LuminousPlayerTraitRuntime: {
    getCharacter() { return player; },
    dispatchCombatEvent(trigger, runtime) { emitted.push({ trigger, unitId: runtime.self?.id }); },
  },
  addEventListener() {},
  setInterval() { return 1; },
  clearInterval() {},
  console: { error(...args) { throw new Error(args.join(" ")); } },
};
window.window = window;
window.globalThis = window;
vm.runInNewContext(source, window, { filename: "trait-standardization-runtime.js" });
await Promise.resolve();
await Promise.resolve();
await Promise.resolve();

function emitSnapshot(path, value) {
  const listener = callbacks.get(path);
  assert.equal(typeof listener, "function", "Missing Firebase listener: " + path);
  listener({ val() { return value; } });
}

const combatants = "campaña/combate/combatants";
const combatState = "campaña/combate/estado";
const dispatches = () => emitted.filter((row) => row.trigger === "encounter_start");

emitSnapshot(combatants, { player_1: { id: "player_1" } });
window.LuminousTraitStandardizationRuntime.registerCombatUnit(player);
assert.equal(dispatches().length, 0, "Deployment is not Encounter Start");

emitSnapshot(combatState, { phase: "PRE_COMBAT_PLANNING", round: 1 });
assert.equal(dispatches().length, 0, "First round planning is not Encounter Start");

emitSnapshot(combatState, { phase: "COMBAT_SEALED", round: 1 });
assert.deepEqual(dispatches().map((row) => row.unitId), ["player_1"], "First combat phase starts the Encounter");

emitSnapshot(combatState, { phase: "COMBAT_RUNNING", round: 1 });
emitSnapshot(combatState, { phase: "PRE_COMBAT_PLANNING", round: 2 });
emitSnapshot(combatState, { phase: "COMBAT_SEALED", round: 2 });
emitSnapshot(combatState, { phase: "COMBAT_RUNNING", round: 2 });
assert.equal(dispatches().length, 1, "Round transitions must not start another Encounter");

emitSnapshot(combatState, { phase: "SETUP", round: 1 });
emitSnapshot(combatants, {});
emitSnapshot(combatants, { player_1: { id: "player_1" } });
window.LuminousTraitStandardizationRuntime.registerCombatUnit(player);
emitSnapshot(combatState, { phase: "PRE_COMBAT_PLANNING", round: 1 });
assert.equal(dispatches().length, 1, "New deployment must not trigger the effect prematurely");
emitSnapshot(combatState, { phase: "COMBAT_RUNNING", round: 1 });
assert.equal(dispatches().length, 2, "A new Encounter may trigger after reset");

emitSnapshot(combatState, { phase: "SETUP", round: 1 });
emitSnapshot(combatState, { phase: "COMBAT_SEALED", round: 1, eventAuthority: "combat-event-runtime-v1" });
assert.equal(dispatches().length, 2, "Authoritative Combat suppresses the sheet's old phase-trigger activation");
console.log("Encounter Start gating smoke passed.");
