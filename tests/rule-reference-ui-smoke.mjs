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

// Codex fifth review: mixed ability/Skill checks share one suffix; an
// unregistered check condition must not hide the registered Status beside it.
for (const [sentence, expected] of [
  ["On a failed Coin in a Strength or Athletics Check, re-toss the Coin.",
    ["check:str", "skill:athletics"]],
  ["Athletics or Strength Check.", ["skill:athletics", "check:str"]],
  ["Strength or History Checks.", ["check:str", "skill:history"]],
  ["Dexterity, Strength, or Acrobatics Checks.",
    ["check:dex", "check:str", "skill:acrobatics"]],
  ["Checks against Disease or Poison reduce Threshold by 4.", ["status:poison"]],
  ["Checks against Charmed, Disease, or Poison.",
    ["status:charmed", "status:poison"]],
  ["Checks against Charmed or Frightened reduce Threshold by 4.",
    ["status:charmed", "status:frightened"]],
  ["Strength or Athletics practice makes you stronger.", []],
  ["Strength makes Athletics better.", []],
  ["Disease or Poison is a difficult situation.", []],
  ["Fire/Burn damage type.", []],
]) {
  const parts=references.tokenize(sentence);
  assert.deepEqual(parts.filter(x=>x.kind).map(x=>x.kind+":"+x.id),
    expected, "Mixed or ambiguous reference mismatch: "+sentence);
  assert.equal(parts.map(x=>x.text).join(""), sentence, "Original rule text changed");
}

// Codex sixth review: grammar from Bladesinger and Mantle of Whispers.
for (const [sentence, expected] of [
  ["Gain proficiency with Light Armor, Performance, and one One-Handed Melee Weapon type of your choice.",
    ["skill:performance"]],
  ["Gain Expertise in Medicine or Perception.", ["skill:medicine", "skill:perception"]],
  ["Gain proficiency in Simple Weapons, Medium Armor, and Survival.",
    ["skill:survival"]],
  ["Gain +5 Deception Power against Insight Checks.",
    ["skill:deception", "skill:insight"]],
  ["Bladesong ends if you become Incapacitated or use incompatible equipment.",
    ["status:incapacitated"]],
  ["When they became Frightened, they retreated.", ["status:frightened"]],
  ["They become more confident after training.", []],
  ["The Power of Nature.", []],
  ["Fire/Burn damage type.", []],
  ["Perform with Light Armor, Performance can help.", []],
]) {
  const pieces=references.tokenize(sentence);
  assert.deepEqual(pieces.filter(x=>x.kind).map(x=>x.kind+":"+x.id), expected,
    "Rule context should match without treating ordinary prose as a mechanic: "+sentence);
  assert.equal(pieces.map(x=>x.text).join(""), sentence);
}

// Codex seventh review: canonical status immunities and bounded conditioned
// Skill Threshold text remain mechanical even with intervening prose.
for (const [sentence, expected] of [
  ["Persuasion checks reduce Threshold by 4. Magical Sleep immunity is a race property.",
    ["skill:persuasion", "status:sleep"]],
  ["Magical Sleep immunity is a race property.", ["status:sleep"]],
  ["Immunity to Charmed and Frightened.", ["status:charmed", "status:frightened"]],
  ["Resistance to Poison.", ["status:poison"]],
  ["Persuasion against injured or frightened creatures reduces Threshold by 4.",
    ["skill:persuasion"]],
  ["Persuasion against wounded targets lowers DC by 2.", ["skill:persuasion"]],
  ["Stealth against alert guards increases Threshold by 3.", ["skill:stealth"]],
  ["Persuasion against the odds works.", []],
  ["Persuasion against a guard is usually ineffective.", []],
  ["Fire/Burn damage type.", []],
  ["Burn damage type.", []],
  ["The Nature of Illusion is mysterious.", []],
]) {
  const tokens=references.tokenize(sentence);
  assert.deepEqual(tokens.filter(x=>x.kind).map(x=>x.kind+":"+x.id),expected,
    "Conditional Skill/Status immunity reference mismatch: "+sentence);
  assert.equal(tokens.map(x=>x.text).join(""),sentence,
    "Inline rule labels must preserve the source description verbatim");
}

// Codex eighth review: damage sourced from canonical statuses is not a
// damage-type label; a named Skill followed by proficiency/expertise is a rule.
for (const [sentence, expected] of [
  ["Take Half Damage from Burn and Poison. At Turn Start, Recover HP.",
    ["status:burn", "status:poison"]],
  ["Damage from Burn.", ["status:burn"]],
  ["Damage from Burn, Poison, and Rupture.",
    ["status:burn", "status:poison", "status:rupture"]],
  ["Intimidation proficiency is racial metadata.", ["skill:intimidation"]],
  ["Athletics expertise is available.", ["skill:athletics"]],
  ["Gain Intimidation proficiency.", ["skill:intimidation"]],
  ["Damage from Fire/Burn damage type.", []],
  ["Fire/Burn damage type.", []],
  ["Burn and Poison are colorful examples.", []],
  ["The performance of the algorithm is interesting.", []],
]) {
  const parts=references.tokenize(sentence);
  assert.deepEqual(parts.filter(x=>x.kind).map(x=>x.kind+":"+x.id),expected,
    "Status damage source or Skill proficiency suffix mismatch: "+sentence);
  assert.equal(parts.map(x=>x.text).join(""),sentence,
    "Linkification must preserve all original description text");
}

// Codex ninth review: Save suffixes propagate to every ability in the
// compound selection, and possession wording links only canonical statuses.
for (const [sentence, expected] of [
  ["choose INT or CHA Save Checks instead", ["save:int", "save:cha"]],
  ["Choose STR, DEX, or WIS Saves.", ["save:str", "save:dex", "save:wis"]],
  ["Strength or Charisma Saving Throw", ["save:str", "save:cha"]],
  ["INT or CHA Checks", ["check:int", "check:cha"]],
  ["if you have Haste, reload your weapon once.", ["status:haste"]],
  ["While having Haste, you can reload the weapon.", ["status:haste"]],
  ["The target has Haste and can react.", ["status:haste"]],
  ["INT or CHA styles are preferred.", []],
  ["If you have increased Haste, try again.", []],
  ["The narrator has Illusion about the scene.", []],
  ["Fire/Burn damage type.", []],
]) {
  const parts=references.tokenize(sentence);
  assert.deepEqual(parts.filter(x=>x.kind).map(x=>x.kind+":"+x.id),expected,
    "Shared Save or status-possession context mismatch: "+sentence);
  assert.equal(parts.map(x=>x.text).join(""),sentence,
    "Original rules text must be preserved");
}

// Codex tenth review: Fragmented Blessing uses a consecutive labeled
// Check mapping after "matching Check." rather than a suffix on each name.
// Exercise the real shipped definition, not an invented paraphrase.
const archetypeSource=fs.readFileSync(path.join(base,"js/archetype-trait-catalog.js"),"utf8");
const fragmentDescription=archetypeSource.match(
  /orosh_lineage_fragmented_blessing:\s*\{[\s\S]*?\bdescription:\s*"([^"]+)"/
)?.[1];
assert.ok(fragmentDescription,"Fragmented Blessing must exist in the archetype catalog");
const fragmentTokens=references.tokenize(fragmentDescription);
assert.deepEqual(fragmentTokens.filter(x=>x.kind).map(x=>x.kind+":"+x.id),[
  "check:str","skill:intimidation",
  "skill:deception","skill:stealth",
  "skill:insight","skill:history",
  "check:cha","skill:persuasion",
  "skill:investigation","skill:perception",
  "skill:arcana","skill:religion",
  "skill:nature","skill:survival",
],"The seven canonical Fragmented Blessing Check mappings must be linked");
assert.equal(fragmentTokens.map(x=>x.text).join(""),fragmentDescription);
for (const [phrase, expected] of [
  ["Wrath — Strength or Intimidation.",[]],
  ["Nature and History are academic subjects.",[]],
  ["One matching Check. Wrath — Strength or Intimidation. Other prose about Nature and History.",
    ["check:str","skill:intimidation"]],
  ["One matching Check. Wrath — Strength or Intimidation. Envy — Deception or Stealth.",
    ["check:str","skill:intimidation","skill:deception","skill:stealth"]],
]) {
  const bits=references.tokenize(phrase);
  assert.deepEqual(bits.filter(x=>x.kind).map(x=>x.kind+":"+x.id),expected,
    "Labeled Checks must not link unrelated narrative text: "+phrase);
  assert.equal(bits.map(x=>x.text).join(""),phrase);
}

// The choice editor is populated after branch details: decorate maneuver
// descriptions only once the synchronous renderManeuvers call has completed.
const maneuverRender=progression.indexOf("renderManeuvers?.(editor,");
const maneuverDecorate=progression.indexOf(
  'global.LuminousRuleReferences?.decorate?.(editor, { mode: "card" });',maneuverRender);
assert.ok(maneuverRender>=0 && maneuverDecorate>maneuverRender &&
  maneuverDecorate-maneuverRender<600,
  "Battle Master descriptions must be decorated after the editor renders");
const maneuverChoices=fs.readFileSync(path.join(base,"js/player-progression-choices.js"),"utf8");
assert.match(maneuverChoices,/make\("small","",maneuver\.description\)/,
  "Maneuver descriptions must be part of the rendered editor");
assert.deepEqual(references.tokenize("Menacing Attack: inflict 2 Frightened.")
  .filter(x=>x.kind).map(x=>x.kind+":"+x.id),["status:frightened"]);

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
