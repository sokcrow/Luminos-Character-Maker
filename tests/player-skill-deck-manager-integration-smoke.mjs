import assert from "node:assert/strict";
import {readFileSync,existsSync} from "node:fs";
const calls=[];
globalThis.document={readyState:"loading",addEventListener:(name,callback)=>calls.push(name)};
await import("../js/skill-deck-rules-v2.js");
await import("../js/player-skill-deck-manager.js");
const hud=globalThis.LuminousPlayerDeckManager;
assert.ok(hud,"The interactive player Skill Deck Manager is registered");
assert.deepEqual(hud.expandDeck({tier1:"attack_a",tier2:"attack_b",tier3:"attack_c"}),
  ["attack_a","attack_a","attack_a","attack_b","attack_b","attack_c"]);
assert.deepEqual(hud.normalizeDeck({t1:"Attack A",tier2:"ATTACK_B",3:"ATTACK-C"}).entries.map(e=>e.skillId),
  ["attack_a","attack_a","attack_a","attack_b","attack_b","attack_c"]);
assert.equal(hud.normalizeDeck({tier1:"attack_a"}).schemaVersion,2);
const skills=[
  {id:"attack_a",name:"Attack I",tier:1,type:"Attack",damageType:"Slash"},
  {id:"attack_b",name:"Attack II",tier:2,type:"Attack",damageType:"Pierce"},
  {id:"attack_c",name:"Attack III",tier:3,type:"Attack",damageType:"Blunt"},
  {id:"defense_iii",name:"Clashable Guard",tier:3,type:"Defense",defenseSubtype:"ClashableGuard"}
];
const deck={tier1:"attack_a",tier2:"attack_b",tier3:"attack_c"};
assert.equal(hud.validateDeck(deck,skills).valid,true);
assert.equal(hud.validateDeck({...deck,tier2:"defense_iii"},skills).valid,false,
  "The offensive Deck cannot equip a Clashable Guard into the attacks");
assert.equal(hud.validateDeck({...deck,tier3:"attack_a"},skills).valid,false,
  "The editor must respect Tier constraints");
assert.equal(hud.selectLinkedPlayer([
  ["pending-character",{status:"pending"}],["approved-character",{status:"approved"}]
]),"approved-character","a pending UID-linked record cannot hide the player's approved sheet");
assert.equal(hud.selectLinkedPlayer([
  ["character-a",{status:"approved"}],["character-b",{status:"approved"}]
],"character-b"),"character-b","sheet playerId resolves multiple approved records");
assert.equal(hud.selectLinkedPlayer([
  ["character-a",{status:"approved"}],["character-b",{status:"approved"}]
]),"","ambiguous selection must not equip to an arbitrary character");
assert.equal(hud.typeFor(skills[3]),"defense");
assert.equal(hud.typeFor(skills[0]),"slash");
assert.equal(hud.artwork(skills[3]),"Assets/Icons/items/equipment/shield.png",
  "Defense without custom art must reuse a project asset");
assert.equal(hud.artwork(skills[0]),"Assets/Icons/items/equipment/weapon_dagger.png");
assert.equal(hud.artwork({...skills[0],cardArtUrl:"https://example.com/skill.webp"}),"https://example.com/skill.webp",
  "Explicit per-Skill art must override repository fallbacks");
assert.equal(hud.artwork({...skills[0],cardArtUrl:"javascript:alert(1)"}).includes("javascript"),false);
assert.deepEqual(hud.frameFor({sheetArtFraming:{x:130,y:-7,zoom:10}}),{x:100,y:0,zoom:2.5});
for(const path of [
  "Assets/Images/Buttons/Skills.png",
  "Assets/Images/Buttons/Player.svg",
  "Assets/Icons/items/equipment/shield.png",
  "Assets/Icons/items/equipment/weapon_dagger.png",
  "Assets/Icons/items/equipment/weapon_spear.png",
  "Assets/Icons/items/equipment/weapon_hammer.png",
  "Assets/Images/Buttons/Spells.png",
  "css/player-skill-deck-manager.css"
]){
  assert.equal(existsSync(new URL("../"+path,import.meta.url)),true,"Project asset missing: "+path);
}
const sheet=readFileSync(new URL("../hoja_personaje.html",import.meta.url),"utf8");
const src=readFileSync(new URL("../js/player-skill-deck-manager.js",import.meta.url),"utf8");
const css=readFileSync(new URL("../css/player-skill-deck-manager.css",import.meta.url),"utf8");
assert.match(sheet,/skill-deck-rules-v2\.js/);
assert.match(sheet,/player-skill-deck-manager\.js/);
assert.match(sheet,/player-skill-deck-manager\.css/);
assert.match(src,/campaña\/jugadores\//);
assert.match(src,/sheetArtFraming/);
assert.match(src,/skillDeckPresets/);
assert.match(src,/skillLoadoutSource:"player_skill_deck_manager"/);
assert.match(src,/data-psdm-slot/);
assert.match(src,/data-psdm-remove/);
assert.match(src,/psdm-budget/);
assert.match(src,/data-psdm-equip/);
assert.match(src,/transaction\(player=>/);
assert.match(css,/max-width:640px/);
assert.match(css,/psdm-library-grid/);
assert.match(css,/psdm-remove/);
assert.match(css,/grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
console.log("Player Skill Deck HUD: canonical loadout + project assets + character splash: OK");
