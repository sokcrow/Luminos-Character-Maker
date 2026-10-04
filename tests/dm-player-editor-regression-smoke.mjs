import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const dmHtml = fs.readFileSync(path.join(here, "..", "pantalla_dm.html"), "utf8");

const permanentControlIds = [
  "dm-player-xp",
  "dm-hp-max",
  "dm-hp-actual",
  "dm-hp-base",
  "dm-coef",
  "dm-def-lvl",
  "dm-off-lvl",
  "dm-sp",
  "dm-action-slots",
  "dm-stagger",
  "dm-combat-actor-id",
  "dm-combat-splash-url",
  "dm-combat-resistances-grid",
];

for (const id of permanentControlIds) {
  assert.match(
    dmHtml,
    new RegExp(`id=["']${id}["']`),
    `DM player editor regression: missing permanent control #${id}`,
  );
}

const resistanceTypes = [
  "Cortante",
  "Perforante",
  "Contundente",
  "Fuego",
  "Frío",
  "Relámpago",
  "Ácido",
  "Veneno",
  "Necrótico",
  "Radiante",
  "Fuerza",
  "Psíquico",
  "Trueno",
];

assert.match(
  dmHtml,
  /const\s+DM_PLAYER_RESISTANCE_TYPES\s*=\s*Object\.freeze\(\[/,
  "DM player editor regression: canonical resistance contract was removed",
);

for (const resistance of resistanceTypes) {
  assert.ok(
    dmHtml.includes(`"${resistance}"`),
    `DM player editor regression: missing resistance ${resistance}`,
  );
}

const runtimeContracts = [
  ["splash load", /playerData\.splash_art\s*\|\|\s*""/],
  ["splash save", /campaña\/jugadores\/\$\{activePlayerIdForModal\}\/splash_art/],
  ["resistance load", /playerData\.resistencias\s*\|\|\s*\{\}/],
  ["resistance save", /campaña\/jugadores\/\$\{activePlayerIdForModal\}\/resistencias/],
  ["actor selector population", /actorData\.tipo\s*!==\s*"Jugador"/],
  ["player actor link save", /campaña\/jugadores\/\$\{activePlayerIdForModal\}\/actorId/],
  ["actor reciprocal link", /vinculo_jugador/],
  ["actor database path preservation", /getActorDatabasePath\(/],
  ["active combat mirror", /campaña\/combate\/combatants\/\$\{combatantKey\}\/hp/],
];

for (const [name, pattern] of runtimeContracts) {
  assert.match(
    dmHtml,
    pattern,
    `DM player editor regression: missing runtime contract for ${name}`,
  );
}

assert.match(
  dmHtml,
  /CONTRATO PERMANENTE DEL EDITOR DM: no retirar estos controles/,
  "DM player editor regression: permanent editor contract marker was removed",
);

console.log(
  "DM player editor regression smoke passed: core stats, Soul Link, Splash Art and all 13 resistances are protected.",
);
