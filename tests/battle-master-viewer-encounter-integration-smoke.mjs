import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const callbacks = new Map();
const pendingScripts = [];
const emitted = [];

const savedPlayer = {
  id: "player_1", name: "Battle Master", classes: [{ id: "fighter", level: 15 }],
  characterBuild: {
    archetypes: [{ classId: "fighter", archetypeId: "battle_master" }],
    maneuvers: { battle_master: ["ambush", "tactical_assessment"] },
  },
};
const combatPlayer = { id: "player_1", name: "Battle Master", faction: "ally", statusEffects: {} };
const ally = { id: "ally", name: "Ally", faction: "ally", statusEffects: {} };
const enemy = { id: "enemy", name: "Enemy", faction: "enemy", statusEffects: {} };
const scripts = new Map();
const document = {
  readyState: "loading",
  getElementById(id) { return scripts.get(id) || null; },
  addEventListener() {},
  createElement(tag) {
    assert.equal(tag, "script");
    const listeners = {};
    return {
      src: "", id: "", async: false,
      addEventListener(event, listener) { listeners[event] = listener; },
      dispatch(event) { listeners[event]?.(); },
    };
  },
  head: { appendChild(script) {
    scripts.set(script.id, script);
    pendingScripts.push(script);
  } },
};
const db = { ref(key) { return { on(event, listener) {
  assert.equal(event, "value");
  callbacks.set(key, listener);
} }; } };
const window = {
  document, firebase: { apps: [{}], database() { return db; } },
  LuminousUniversalModifiers: {},
  LuminousPlayerTraitRuntime: {
    getCharacter() { return savedPlayer; },
    dispatchCombatEvent(trigger, runtime) {
      emitted.push({ trigger, unitId: runtime.self?.id, count: runtime.self?.resources?.superiority ?? 0 });
    },
  },
  combatData: { player_1: combatPlayer, ally, enemy },
  addEventListener() {},
  setInterval() { return 1; }, clearInterval() {},
  console: { error(...args) { throw new Error(args.join(" ")); }, warn(...args) { throw new Error(args.join(" ")); } },
};
window.window = window;
window.globalThis = window;
const context = vm.createContext({ window, globalThis: window, console: window.console });
vm.runInContext(read("js/status-library.js"), context);
vm.runInContext(read("js/status-engine.js"), context);
vm.runInContext(read("js/class-status-semantics.js"), context);
vm.runInContext(read("js/trait-standardization-runtime.js"), context);

await Promise.resolve();
await Promise.resolve();
await Promise.resolve();
const emit = (key, value) => {
  const fn = callbacks.get(key);
  assert.equal(typeof fn, "function", "Missing Firebase listener " + key);
  fn({ val() { return value; } });
};
const emitState = (phase, round = 1) => emit("campaña/combate/estado", { phase, round });
const dispatched = () => emitted.filter((x) => x.trigger === "encounter_start");
const roster = [combatPlayer, ally, enemy];
roster.forEach((unit) => window.LuminousTraitStandardizationRuntime.registerCombatUnit(unit));
emit("campaña/combate/combatants", { player_1: {}, ally: {}, enemy: {} });
emitState("PRE_COMBAT_PLANNING");
assert.equal(dispatched().length, 0);
assert.equal(pendingScripts.length, 0, "No class runtimes loaded during deployment");

emitState("COMBAT_SEALED");
assert.equal(dispatched().length, 0, "Cannot dispatch before Battle Master runtime loads");
assert.equal(pendingScripts.length, 1);
assert.match(pendingScripts[0].src, /fighter-maneuver-catalog\.js$/);
async function loadNextScript() {
  const script = pendingScripts.shift();
  assert.ok(script, "Expected class runtime load");
  vm.runInContext(read(script.src), context);
  script.dispatch("load");
  // Flush the Promise chain loading the next dependency / dispatch.
  for (let i = 0; i < 6; i++) await Promise.resolve();
}
await loadNextScript();
assert.equal(pendingScripts.length, 1);
assert.match(pendingScripts[0].src, /battle-master-archetype-runtime\.js$/);
await loadNextScript();

assert.equal(dispatched().length, 1, "Start dispatch must follow the Battle Master Maneuver startup");
assert.equal(dispatched()[0].count, 10, "Player Traits observe post-Ambush Superiority");
assert.equal(window.LuminousBattleMasterArchetypeRuntime.superiorityCount(combatPlayer), 10);
assert.equal(combatPlayer.resources.superiority, 10);
assert.equal(combatPlayer.statusEffects.superiority?.count, 10);
assert.equal(combatPlayer.statusEffects.haste?.count, 5);
assert.equal(combatPlayer.statusEffects.clash_power_up?.count, 2);
assert.equal(ally.statusEffects.clash_power_up?.count, 1);
assert.equal(enemy.statusEffects.clash_power_up, undefined);
assert.equal(window.LuminousStatusEngine.getDefinition("superiority").icon, "Assets/Icons/status/superiority.png");

emitState("COMBAT_RUNNING");
emitState("PRE_COMBAT_PLANNING", 2);
emitState("COMBAT_SEALED", 2);
emitState("COMBAT_RUNNING", 2);
assert.equal(dispatched().length, 1);
assert.equal(combatPlayer.statusEffects.haste?.count, 5, "Duplicate phase changes must not reapply Haste");
assert.equal(combatPlayer.resources.superiority, 10);
assert.equal(pendingScripts.length, 0, "Runtimes are not reloaded");

console.log("Battle Master Viewer Encounter integration smoke passed: lazy loader, Ambush, Tactical Assessment, status and idempotence.");
