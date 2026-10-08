import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

await import("../js/trait-family-catalog.js");

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const registry = globalThis.LuminousTraitFamilies;
assert.ok(registry, "Functional Trait family registry must be registered");

const familyIds = [
  "ofensiva", "precision", "defensa", "supervivencia", "movilidad",
  "instinto", "potenciacion", "magia", "recursos", "apoyo",
  "tecnica", "especial", "social",
];
assert.deepEqual(Object.keys(registry.FAMILIES).sort(), [...familyIds].sort());

const pngHeader = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
for (const id of familyIds) {
  const family = registry.resolve({ id: "dummy", family: id });
  assert.equal(family.id, id);
  assert.ok(family.label, id + " label missing");
  assert.equal(family.icon, "Assets/Icons/trait-families/" + id + ".png");
  const img = fs.readFileSync(path.join(root, family.icon));
  assert.ok(img.subarray(0, pngHeader.length).equals(pngHeader), id + " PNG missing/invalid");
}
assert.equal(registry.normalize("Precisión"), "precision");
assert.equal(registry.normalize("Potenciación"), "potenciacion");
assert.equal(registry.normalize("Technique"), "tecnica");
assert.equal(registry.resolve({ family: "Apoyo", name: "Attack" }).id, "apoyo", "Explicit family wins over heuristics");
assert.equal(registry.resolve({ id: "armorless_defense", name: "Armorless Defense" }).id, "defensa");
assert.equal(registry.resolve({ name: "Magic Missile", description: "Cast a spell." }).id, "magia");
assert.equal(registry.resolve({ name: "Blade Fury", description: "Deal extra damage." }).id, "ofensiva");
assert.equal(registry.resolve({ name: "Fleet Steps", mechanics: { movementSpeedBonus: 1 } }).id, "movilidad");
assert.equal(registry.resolve({ name: "Combat Superiority", mechanics: { superiority: { clashWinGain: 3 } } }).id, "recursos");
assert.equal(registry.resolve({ name: "Insight", description: "Better perception." }).id, "instinto");
assert.equal(registry.resolve({ id: "mysterious_feature" }).id, "especial");

const html = fs.readFileSync(path.join(root, "hoja_personaje.html"), "utf8");
const runtime = fs.readFileSync(path.join(root, "js/player-progression-tree.js"), "utf8");
const tray = fs.readFileSync(path.join(root, "js/trait-player-tray.js"), "utf8");
const progressionCss = fs.readFileSync(path.join(root, "css/player-progression-mystic.css"), "utf8");
const traitCss = fs.readFileSync(path.join(root, "css/player-trait-tabs.css"), "utf8");
const familyScript = html.indexOf('src="js/trait-family-catalog.js"');
const progressionScript = html.indexOf('src="js/player-progression-tree.js"');
assert.ok(familyScript >= 0 && familyScript < progressionScript, "Load families before progression");
assert.match(tray, /LuminousTraitFamilies\?\.resolve/);
assert.match(tray, /player-trait-family__icon/);
assert.match(runtime, /nodeFamilyMarkup\(node\)/);
assert.match(runtime, /familyIconMarkup\(familyForItem\(item\)\)/);
assert.match(traitCss, /player-trait-family__icon/);
assert.match(progressionCss, /player-progression-node__families/);

console.log("trait-family-icons-smoke: ok (13 PNGs; registry; UI integration)");
