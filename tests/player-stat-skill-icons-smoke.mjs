import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const assets = path.join(root, "Assets", "Icons", "skills");
const expectedByAbility = {
  str: ["athletics"],
  dex: ["acrobatics", "sleight_of_hand", "stealth"],
  con: [],
  int: ["arcana", "history", "investigation", "nature", "religion"],
  wis: ["animal_handling", "insight", "medicine", "perception", "survival"],
  cha: ["deception", "intimidation", "performance", "persuasion"],
};
const ids = Object.values(expectedByAbility).flat();
assert.equal(ids.length, 18, "18 Skill icons are expected");
const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
for (const id of ids) {
  const file = path.join(assets, id + ".png");
  assert.ok(fs.existsSync(file), "Missing icon " + id);
  const data = fs.readFileSync(file);
  assert.ok(data.subarray(0, 8).equals(pngSignature), "Invalid PNG signature for " + id);
  assert.ok(data.readUInt32BE(16) >= 32 && data.readUInt32BE(20) >= 32,
    "Icon dimensions must be usable for " + id);
}
assert.deepEqual(fs.readdirSync(assets).filter(x => x.endsWith(".png")).sort(),
  ids.map(id => id + ".png").sort(), "Only the 18 requested icons should be in this directory");

const runtime = fs.readFileSync(path.join(root, "js/player-stats-ability-bar.js"), "utf8");
const css = fs.readFileSync(path.join(root, "css/player-stats-ability-bar.css"), "utf8");
const hook = "  global.LuminousPlayerStats = Object.freeze({";
assert.ok(runtime.includes(hook), "Public Stats API must remain present");
assert.match(runtime, /data-player-skill-list/);
assert.match(runtime, /src="Assets\/Icons\/skills\/\$\{skill\.id\}\.png"/);
assert.match(runtime, /player-stat-skill-icon/);
assert.match(runtime, /triggerCoinRoll\(ability, skill\.name, skillValue\(skill, ability, data\)\)/);
assert.match(css, /\.player-stat-skill-icon\[hidden\]/);
assert.match(css, /\.dnd-skill:not\(\.dnd-skill--empty\)/);

const generated = [];
const document = {
  readyState: "loading",
  addEventListener() {},
  getElementById() { return null; },
  createElement(tag) {
    const element = {
      tag, dataset: {}, attributes: {}, children: [], type: "",
      setAttribute(k, v) { this.attributes[k] = v; },
      addEventListener(event, cb) { this.events ||= {}; this.events[event] = cb; },
      querySelector(selector) {
        if (selector !== ".player-stat-skill-icon") return null;
        const image = {
          hidden: false,
          addEventListener(event, cb) { this.events ||= {}; this.events[event] = cb; },
        };
        this.icon = image;
        return image;
      },
      appendChild(child) { this.children.push(child); },
    };
    generated.push(element);
    return element;
  },
};
const window = { document };
vm.runInNewContext(runtime.replace(hook, "  global.__renderSkillsForTest = renderSkills;\n" + hook),
  { window }, { timeout: 2000 });
const api = window.LuminousPlayerStats;
assert.ok(api, "Stats runtime must initialize without changing its public API");
for (const ability of api.ABILITIES) {
  assert.deepEqual(Array.from(ability.skills, skill => skill.id), expectedByAbility[ability.id],
    "Canonical Skill associations changed for " + ability.id);
}
const data = { level: 20, stats: { fuerza: 14, destreza: 12, inteligencia: 16, sabiduria: 10, carisma: 18 },
  skillProficiency: { athletics: "proficient", stealth: "expertise" } };
const list = {
  children: [],
  replaceChildren() { this.children = []; },
  appendChild(child) { this.children.push(child); },
};
const panel = { querySelector(selector) {
  assert.equal(selector, "[data-player-skill-list]");
  return list;
}};
for (const ability of api.ABILITIES) {
  window.__renderSkillsForTest(panel, ability, data);
  if (ability.id === "con") {
    assert.equal(list.children.length, 1);
    assert.match(list.children[0].innerHTML, /No associated skills/);
    continue;
  }
  assert.equal(list.children.length, expectedByAbility[ability.id].length);
  list.children.forEach((row, index) => {
    const id = expectedByAbility[ability.id][index];
    assert.equal(row.type, "button");
    assert.equal(row.dataset.dndRoll, "skill", "Coin Engine delegated roll must remain attached");
    assert.equal(row.dataset.skillId, id);
    assert.match(row.innerHTML, new RegExp('Assets/Icons/skills/' + id + '\\.png'));
    assert.match(row.innerHTML, /skill-proficiency/);
    assert.match(row.innerHTML, /dnd-skill-value/);
    assert.ok(row.title.includes("Coin Engine"));
    assert.equal(typeof row.icon.events.error, "function");
    row.icon.events.error();
    assert.equal(row.icon.hidden, true, "Broken image should not hide roll button");
  });
}
console.log("player-stat-skill-icons-smoke: ok (18 PNGs, canonical ability associations and Coin Engine rows)");
