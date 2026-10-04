import fs from "node:fs";
import assert from "node:assert/strict";

const css = fs.readFileSync("css/theatre-hud.css", "utf8");
const html = fs.readFileSync("hoja_personaje.html", "utf8");

assert.match(
  css,
  /#theatre-view-player\s*>\s*#theatre-stage\s*\{[^}]*gap:\s*1vw\s*!important;/s,
  "Player Theatre must keep the same 1vw sprite gap as the DM stage",
);
assert.ok(
  html.includes("css/theatre-hud.css?v=20261004-player-spacing-1"),
  "Player Theatre spacing CSS must be cache-busted",
);

console.log("Player Theatre sprite spacing smoke: OK");
