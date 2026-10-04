import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const css = fs.readFileSync(path.join(root, "hoja_personaje.css"), "utf8");
const html = fs.readFileSync(path.join(root, "hoja_personaje.html"), "utf8");
const hudRule = css.match(/\.hud-container\s*\{(?<body>[\s\S]*?)\}/)?.groups?.body || "";

assert.ok(hudRule, "the player combat HUD base rule must exist");
assert.match(hudRule, /background:\s*transparent\s*;/, "the HUD positioning box must stay transparent");
assert.match(hudRule, /box-shadow:\s*none\s*;/, "the HUD must not render a rectangular shadow");
assert.doesNotMatch(hudRule, /background:\s*#[0-9a-f]{3,8}\s*;/i, "an opaque HUD panel must not return");
assert.match(
  html,
  /hoja_personaje\.css\?v=20261004-hud-transparency/,
  "the player sheet should invalidate cached copies of the broken HUD CSS",
);

console.log("player-combat-hud-transparency-smoke: ok");
