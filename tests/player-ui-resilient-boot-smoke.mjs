import fs from "node:fs";
import assert from "node:assert/strict";

const js = fs.readFileSync("hoja_personaje.js", "utf8");

assert.match(
  js,
  /try\s*\{\s*renderCharacterSheet\(window\.datosJugador\);\s*\}\s*catch/s,
  "Character rendering must not be able to abort the player boot sequence",
);
assert.match(
  js,
  /window\.hideLoadingOverlay\(\);\s*try\s*\{\s*initializeCharacterSheet\(\);/s,
  "Core UI initialization must still run after hydration even if optional rendering fails",
);
assert.ok(
  js.includes('luminous:player-ui-init-error'),
  "Core initialization failures should emit a diagnostic event instead of killing the whole boot",
);

console.log("Player resilient boot regression checks passed.");
