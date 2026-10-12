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
// Codex finding #1: ordinary uses of canonical names must stay ordinary text.
for (const phrase of [
  "Sacred Breath does Fire/Burn damage type.",
  "Gain protection from weather.",
  "The Nature of Illusion is mysterious.",
  "History teaches many lessons.",
  "Performance optimization was successful.",
  "Our natural perception of events is imperfect."
]) {
  assert.equal(references.tokenize(phrase).filter(x => x.kind).length, 0,
    "Ambiguous narrative/damage terms must not become rules: " + phrase);
}
assert.deepEqual(references.tokenize("Inflict 2 Burn and 1 Rupture.")
  .filter(x => x.kind).map(x => x.kind + ":" + x.id),
  ["status:burn", "status:rupture"]);
assert.deepEqual(references.tokenize("Apply Poison and gain 5 Protection.")
  .filter(x => x.kind).map(x => x.kind + ":" + x.id),
  ["status:poison", "status:protection"]);
assert.deepEqual(references.tokenize("Burn")
  .filter(x => x.kind).map(x => x.kind + ":" + x.id), []);
assert.deepEqual(references.tokenize("Burn",{references:[{kind:"status",id:"burn"}]})
  .filter(x => x.kind).map(x => x.kind + ":" + x.id), ["status:burn"]);
assert.deepEqual(references.tokenize("Nature",{references:[{kind:"skill",id:"nature"}]})
  .filter(x => x.kind).map(x => x.kind + ":" + x.id), ["skill:nature"]);

// Codex follow-up P2: catalog text uses inflected status verbs.
for (const [sentence, expected] of [
  ["A trait gains 3 Bind and 3 Clash Power Down.", ["status:bind", "status:clash_power_down"]],
  ["Pass removes Confusion.", ["status:confusion"]],
  ["The target grants 1 Protection and applies 2 Burn.", ["status:protection", "status:burn"]],
  ["Gain 2 Poison then lose 1 Burn.", ["status:poison", "status:burn"]],
]) {
  assert.deepEqual(references.tokenize(sentence).filter(x => x.kind).map(x => x.kind + ":" + x.id),
    expected, "Inflected status rule action not recognized: " + sentence);
  assert.equal(references.tokenize(sentence).map(x => x.text).join(""), sentence);
}
// Codex follow-up P2: proficiency and Threshold are unambiguous Skill contexts.
for (const [sentence, expected] of [
  ["Gain Proficiency in Perception.", ["skill:perception"]],
  ["Gain Expertise in Sleight of Hand.", ["skill:sleight_of_hand"]],
  ["Persuasion Threshold -2; Deception Threshold -2.", ["skill:persuasion", "skill:deception"]],
  ["Proficient in Acrobatics.", ["skill:acrobatics"]],
]) {
  assert.deepEqual(references.tokenize(sentence).filter(x => x.kind).map(x => x.kind + ":" + x.id),
    expected, "Skill proficiency/Threshold not recognized: " + sentence);
  assert.equal(references.tokenize(sentence).map(x => x.text).join(""), sentence);
}
assert.deepEqual(references.tokenize("Nature is an important part of History."),
  [{text:"Nature is an important part of History."}],
  "Contextual matching must still preserve natural-language references.");

// Codex third review: plural Checks and numeric status stacks without verbs.
for (const [sentence, expected] of [
  ["Performance Checks", ["skill:performance"]],
  ["Perception checks", ["skill:perception"]],
  ["Acrobatics Ability Checks", ["skill:acrobatics"]],
  ["Arcana Check", ["skill:arcana"]],
  ["Failed Save: 2 Bind + 2 Fragile", ["status:bind", "status:fragile"]],
  ["Failed Save: 2 Bind + 2 Fragile; Perception checks", ["status:bind", "status:fragile", "skill:perception"]],
]) {
  const parts = references.tokenize(sentence);
  assert.deepEqual(parts.filter(x => x.kind).map(x => x.kind + ":" + x.id), expected,
    "Must recognize plural Skill Checks and numeric status stacks: " + sentence);
  assert.equal(parts.map(x => x.text).join(""), sentence,
    "Linkification must not alter the rule description");
}
assert.deepEqual(references.tokenize("Fire/Burn damage type, Nature of Illusion.")
  .filter(x => x.kind), [], "Do not reintroduce false positives for damage types or narrative terms");

// Codex fourth review: check suffixes and conditions apply to every name in a
// conjunction, but must NOT promote unrelated narrative words into a rule.
for (const [sentence, expected] of [
  ["Gain +2 Final Power on Insight and Perception checks.",
    ["skill:insight", "skill:perception"]],
  ["History and Survival checks related to tunnels reduce Threshold by 4.",
    ["skill:history", "skill:survival"]],
  ["Insight, Perception, and Nature checks.",
    ["skill:insight", "skill:perception", "skill:nature"]],
  ["Checks against Charmed or Frightened reduce Threshold by 4.",
    ["status:charmed", "status:frightened"]],
  ["Saving throws against Charmed, Frightened, or Confusion.",
    ["status:charmed", "status:frightened", "status:confusion"]],
  ["Insight and Perception are useful in the story.", []],
  ["Nature and History are academic subjects.", []],
  ["Fire/Burn damage type and the Nature of Illusion.", []],
  ["Protection from Frightened is not a check condition.", []],
]) {
  const parts = references.tokenize(sentence);
  assert.deepEqual(parts.filter(x => x.kind).map(x => x.kind + ":" + x.id),
    expected, "Compound rules are not correctly linked: " + sentence);
  assert.equal(parts.map(x => x.text).join(""), sentence,
    "Linkification must preserve all original description text");
}

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
assert.doesNotMatch(css,/\.is-tooltip:hover::after/, "Pseudo-tooltips inside scrolling Traits were removed");
assert.match(css,/\.luminous-rule-card\s*\{[^}]*position:fixed/s,
  "Tooltips must render in the document body, outside overflow-hidden ancestors");
assert.match(css,/max-width:760px/);
assert.match(css,/prefers-reduced-motion/);

console.log("rule-reference-ui-smoke: ok (Stats, 18 Skills, canonical statuses, Saves and Spells)");
