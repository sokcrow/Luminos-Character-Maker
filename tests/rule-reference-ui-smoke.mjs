import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const base = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
await import("../js/status-library.js");
await import("../js/rule-reference-ui.js");
const references = globalThis.LuminousRuleReferences;
assert.ok(references);

const statCodes = ["str","dex","con","int","wis","cha"];
const pngMagic=Buffer.from([137,80,78,71,13,10,26,10]);
for(const stat of statCodes) {
  const entry=references.resolve("save",stat);
  assert.equal(entry.icon, "Assets/Icons/stats/"+stat+".png");
  assert.match(entry.description,/Threshold/);
  const data=fs.readFileSync(path.join(base,entry.icon));
  assert.ok(data.subarray(0,8).equals(pngMagic));
  assert.equal(references.resolve("check",stat).icon,entry.icon);
}
for(const id of Object.keys(references.SKILLS)) {
  const entry=references.resolve("skill",id);
  assert.equal(entry.icon,"Assets/Icons/skills/"+id+".png");
  assert.ok(entry.description.length>24);
  assert.ok(statCodes.includes(references.SKILL_STATS[id]));
  const data=fs.readFileSync(path.join(base,entry.icon));
  assert.ok(data.subarray(0,8).equals(pngMagic));
}
assert.equal(Object.keys(references.SKILLS).length,18);
const rupture=references.resolve("status","rupture");
assert.equal(rupture.name,"Rupture");
assert.equal(rupture.description,globalThis.LuminousStatusLibrary.get("rupture").description);
assert.equal(rupture.icon,globalThis.LuminousStatusLibrary.get("rupture").icon);
assert.equal(references.resolve("status","nonexistent_status"),null);

const tokens=references.tokenize("On Hit: inflict Rupture, then make a CON Save. Try Athletics or Sleight of Hand.");
const summary=tokens.filter(x=>x.kind).map(x=>x.kind+":"+x.id);
assert.deepEqual(summary,["status:rupture","save:con","skill:athletics","skill:sleight_of_hand"]);
assert.equal(tokens.map(x=>x.text).join(""),
  "On Hit: inflict Rupture, then make a CON Save. Try Athletics or Sleight of Hand.",
  "Linkification must not rewrite the underlying rule text");
const more=references.tokenize("Use WIS Saving Throw and DEX Check, or Percepción.");
assert.deepEqual(more.filter(x=>x.kind).map(x=>x.kind+":"+x.id),
  ["save:wis","check:dex","skill:perception"]);
assert.deepEqual(references.tokenize("An unknown effect stays ordinary text."),[{text:"An unknown effect stays ordinary text."}]);
assert.equal(references.registerSpellEffect({name:"Undefined effect"}),null,
  "No invented Spell descriptions for effects that have no definition");
assert.ok(references.registerSpellEffect({id:"moon_pact",name:"Moon Pact",
  description:"A registered Spell grants a Moon Pact until its source says otherwise.",
  icon:"Assets/Icons/trait-families/magia.png"}));
const effect=references.resolve("spell_effect","moon_pact");
assert.equal(effect.name,"Moon Pact");
assert.match(effect.description,/registered Spell/);
assert.deepEqual(references.tokenize("Moon Pact remains.").filter(x=>x.kind).map(x=>x.kind+":"+x.id),
  ["spell_effect:moon_pact"]);

const html=fs.readFileSync(path.join(base,"hoja_personaje.html"),"utf8");
const stats=fs.readFileSync(path.join(base,"js/trait-player-tray.js"),"utf8");
const progression=fs.readFileSync(path.join(base,"js/player-progression-tree.js"),"utf8");
const skillHud=fs.readFileSync(path.join(base,"js/player-skills-hud.js"),"utf8");
const css=fs.readFileSync(path.join(base,"css/rule-reference-ui.css"),"utf8");
assert.ok(html.indexOf('src="js/rule-reference-ui.js"') < html.indexOf('src="js/player-progression-tree.js"'));
assert.match(stats,/LuminousRuleReferences\?\.decorate\?\.\(description, \{ mode: "tooltip" \}\)/);
assert.match(progression,/LuminousRuleReferences\?\.decorate\?\.\(state\.detail, \{ mode: "card" \}\)/);
assert.match(skillHud,/LuminousRuleReferences\?\.decorate\?\.\(detail, \{ mode: "card" \}\)/);
assert.match(css,/max-width:760px/);
assert.match(css,/prefers-reduced-motion/);

console.log("rule-reference-ui-smoke: ok (Stats, 18 Skills, canonical statuses, Saves and Spells)");
