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
]) assert.equal(exists(asset), true, `missing canonical asset: ${asset}`);

const sheet = read("hoja_personaje.html");
assert.match(sheet, /btn-global-inventory[\s\S]{0,500}Assets\/Images\/Buttons\/Inventory\.png/);
assert.match(sheet, /act_hud_skills[\s\S]{0,500}data-player-skills-menu-icon[\s\S]{0,300}Assets\/Images\/Buttons\/Skills\.png/);

const playerSkills = read("js/player-skills-hud.js");
assert.match(playerSkills, /Assets\/Images\/Buttons\/Skills\.png/);
assert.match(playerSkills, /Assets\/Images\/Buttons\/Spells\.png/);

const combatIcons = read("js/combat-player-menu-canonical-icons.js");
assert.match(combatIcons, /inventory:\s*"Assets\/Images\/Buttons\/Inventory\.png"/);
assert.match(combatIcons, /skills:\s*"Assets\/Images\/Buttons\/Skills\.png"/);
assert.match(combatIcons, /spells:\s*"Assets\/Images\/Buttons\/Spells\.png"/);

const skillPlanner = read("js/battle-viewer-player-skill-planner-074.js");
const spellPlanner = read("js/battle-viewer-player-spell-planner-074.js");
assert.match(skillPlanner, /const ICON_SRC = "Assets\/Images\/Buttons\/Skills\.png"/);
assert.match(spellPlanner, /const ICON_SRC = "Assets\/Images\/Buttons\/Spells\.png"/);

const viewer = read("Battle-viewer.html");
assert.match(viewer, /js\/combat-player-menu-canonical-icons\.js/);

const forest = read("game-engine/lab/game/forest-0.3.3.1.html");
assert.match(forest, /data-player-menu-action="inventory"[\s\S]{0,300}\.\.\/\.\.\/\.\.\/Assets\/Images\/Buttons\/Inventory\.png/);

console.log("player-menu-canonical-icons-smoke: ok");
