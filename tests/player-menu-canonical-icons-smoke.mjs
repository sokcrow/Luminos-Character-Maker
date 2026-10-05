import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..");

const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const exists = (p) => fs.existsSync(path.join(root, p));

for (const asset of [
  "Assets/Images/Buttons/Inventory.png",
  "Assets/Images/Buttons/Skills.png",
  "Assets/Images/Buttons/Spells.png",
  "Assets/Images/Buttons/Vitals.png",
  "Assets/Images/Buttons/Stats.png",
  "Assets/Images/Buttons/Progression.png",
  "Assets/Images/Buttons/Apego.png",
  "Assets/Images/Buttons/Terminal.png",
  "Assets/Images/Buttons/Theatre.png",
  "Assets/Images/Buttons/History.png",
]) assert.equal(exists(asset), true, `missing canonical asset: ${asset}`);

const sheet = read("hoja_personaje.html");
assert.match(sheet, /btn-global-inventory[\s\S]{0,500}Assets\/Images\/Buttons\/Inventory\.png/);
assert.match(sheet, /act_hud_skills[\s\S]{0,500}data-player-skills-menu-icon[\s\S]{0,300}Assets\/Images\/Buttons\/Skills\.png/);

const canonicalMenuButtons = [
  ['id="btn-toggle-hud"', "Vitals.png"],
  ['name="act_hud_stats"', "Stats.png"],
  ['name="act_hud_perks"', "Progression.png"],
  ['name="act_hud_apego"', "Apego.png"],
  ['id="btn-toggle-phone"', "Terminal.png"],
  ['id="btn-abrir-escritura"', "Theatre.png"],
  ['id="btn-toggle-theatre-log-player"', "History.png"],
];

for (const [needle, asset] of canonicalMenuButtons) {
  const markerIndex = sheet.indexOf(needle);
  assert.notEqual(markerIndex, -1, `missing menu button marker: ${needle}`);
  const buttonStart = sheet.lastIndexOf("<button", markerIndex);
  const buttonEnd = sheet.indexOf("</button>", markerIndex);
  assert.notEqual(buttonStart, -1, `missing opening button for: ${needle}`);
  assert.notEqual(buttonEnd, -1, `missing closing button for: ${needle}`);
  const buttonBlock = sheet.slice(buttonStart, buttonEnd + "</button>".length);
  assert.equal(buttonBlock.includes(`Assets/Images/Buttons/${asset}`), true, `missing canonical icon ${asset} for ${needle}`);
  assert.equal(/<svg\b/i.test(buttonBlock), false, `legacy inline SVG remains in ${needle}`);
}


const playerSkills = read("js/player-skills-hud.js");
assert.match(playerSkills, /Assets\/Images\/Buttons\/Skills\.png/);
assert.match(playerSkills, /Assets\/Images\/Buttons\/Spells\.png/);

const skillPlanner = read("js/battle-viewer-player-skill-planner-074.js");
const spellPlanner = read("js/battle-viewer-player-spell-planner-074.js");
assert.match(skillPlanner, /const ICON_SRC = "Assets\/Images\/Buttons\/Skills\.png"/);
assert.match(spellPlanner, /const ICON_SRC = "Assets\/Images\/Buttons\/Spells\.png"/);

const viewer = read("Battle-viewer.html");
assert.match(viewer, /SkillAttack\.png\?97118e=&format=original","Assets\/Images\/Buttons\/Skills\.png"/);
assert.match(viewer, /imgur\.com\/DJ5lKid\.png","Assets\/Images\/Buttons\/Spells\.png"/);
assert.match(viewer, /imgur\.com\/LA2meL7\.png","Assets\/Images\/Buttons\/Inventory\.png"/);
assert.match(viewer, /COMBAT_MENU_ICON_SOURCE_MISSING/);

const forest = read("game-engine/lab/game/forest-0.3.3.1.html");
assert.match(forest, /data-player-menu-action="inventory"[\s\S]{0,300}\.\.\/\.\.\/\.\.\/Assets\/Images\/Buttons\/Inventory\.png/);

console.log("player-menu-canonical-icons-smoke: ok");
