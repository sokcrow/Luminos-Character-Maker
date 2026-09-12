import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const battle = read("Battle-viewer.html");
const theatre = read("hoja_personaje.html");
const statusEngine = read("js/status-engine.js");
const bootstrap = read("js/player-archetype-runtime.js");
const playerTraits = read("js/player-trait-runtime.js");
const rogueCombat = read("js/rogue-combat-runtime.js");
const fighter = read("js/fighter-class-runtime.js");

// Both player entrypoints enter through the same Status/runtime bootstrap chain.
assert.match(battle, /<script src=["']js\/status-engine\.js["']><\/script>/);
assert.match(theatre, /<script src=["']js\/status-engine\.js["']><\/script>/);
assert.match(statusEngine, /js\/player-archetype-runtime\.js/);

// Shared player bootstrap must guarantee visible class Statuses and the Trait lifecycle bridge.
for (const runtimePath of [
  "js/status-library.js",
  "js/class-status-semantics.js",
  "js/fighter-class-runtime.js",
  "js/player-trait-runtime.js",
  "js/rogue-class-runtime.js",
  "js/rogue-theatre-runtime.js",
  "js/spellcasting-runtime.js",
  "js/sorcerer-class-runtime.js",
  "js/rogue-combat-runtime.js",
]) {
  assert.ok(bootstrap.includes(runtimePath), `Shared player bootstrap must wire ${runtimePath}`);
}

// Sorcerer captures its Spellcasting dependency at module load, so Spellcasting must load first.
assert.ok(
  bootstrap.indexOf("js/spellcasting-runtime.js") < bootstrap.indexOf("js/sorcerer-class-runtime.js"),
  "Spellcasting runtime must load before Sorcerer class runtime",
);

// Rogue Combat is Battle-only: do not inject its CombatEngine wrapper until CombatEngine exists.
assert.match(bootstrap, /function ensureBattleOnlyRuntimes\(\)/);
assert.match(bootstrap, /if \(!global\.CombatEngine\) return false;/);
assert.match(bootstrap, /watchBattleOnlyRuntimes\(\)/);
assert.match(rogueCombat, /function installEngine\(engine = global\.CombatEngine\)/);
assert.match(rogueCombat, /__rogueClassCombatWrapped/);

// The Player Trait runtime is the lifecycle bridge for both Theatre checks and Battle events.
assert.match(playerTraits, /function installTheatreBridge\(\)/);
assert.match(playerTraits, /function installCombatBridge\(\)/);
assert.match(playerTraits, /dispatchCombatEvent\("encounter_start"/);
assert.match(playerTraits, /dispatchCombatEvent\("turn_start"/);
assert.match(playerTraits, /installLifecycleBridges\(\)/);

// Fighter Second Wind consumes those real Battle lifecycle events.
assert.match(fighter, /normalized === "encounter_start"/);
assert.match(fighter, /normalized === "turn_start"/);
assert.match(fighter, /fighter_second_wind_encounter_start/);
assert.match(fighter, /fighter_second_wind_turn_heal/);

console.log("Player runtime wiring smoke passed: Theatre/Battle share class Status + Trait bridges; Fighter, Rogue Combat, and Sorcerer are reachable in browser runtime.");
