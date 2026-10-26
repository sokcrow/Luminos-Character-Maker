import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

await import("../js/combat-skill-schema.js");
await import("../js/combat-skill-loadout-074.js");
const schema=globalThis.CombatSkillSchema;
const loadout=globalThis.LuminousCombatSkillLoadout074;
assert.ok(schema&&loadout,"El Forge debe utilizar el esquema de combate y su loadout existentes.");

for(const subtype of ["ClashableGuard","ClashableCounter"]){
  const raw={
    name:"Protección del Director",type:"Defense",defenseSubtype:subtype,
    isDefense:true,isClashable:true,isUnclashable:false,
    tier:1,basePower:5,coinPower:2,coinAmount:2,coinType:"positive",
    attackWeight:1,skillRange:1,
    effects:[{trigger:"[On Clash Win]",type:"status",target:"self",status:"protection",count:1}],
    coins:[{type:"normal",effects:[{trigger:"[On Hit]",type:"status",target:"target",status:"tremor",potency:2,count:1}]},{type:"unbreakable",effects:[]}]
  };
  const checked=schema.validateCombatSkill(raw);
  assert.equal(checked.valid,true,checked.errors.join("; "));
  const serialized=schema.serializeCombatSkill(checked.skill,{includeLegacyAliases:true});
  assert.equal(serialized.defenseSubtype,subtype);
  assert.equal(serialized.defense_subtype,subtype);
  assert.equal(serialized.isClashable,true);
  assert.equal(serialized.coins.length,2);
  assert.equal(serialized.coins[1].type,"unbreakable");
  assert.equal(serialized.coins[0].effects[0].status,"tremor");
}
const character={
  skillDeck:{tier1:"strike_1",tier2:"strike_2",tier3:"strike_3"},
  grantedSkillIds:["director_guard"],
  equippedSkillIndex:{strike_1:true,strike_2:true,strike_3:true}
};
assert.ok(loadout.skillIdsFor(character).includes("director_guard"),
  "Las defensas concedidas deben ser accesibles además del Deck.");
assert.ok(loadout.ownsSkill(character,"director_guard"),
  "La autoridad del Skill Planner debe reconocer la Skill concedida.");
assert.equal(loadout.skillIdsFor(character).filter(id=>id==="director_guard").length,1);
assert.equal(character.skillDeck.tier1,"strike_1","La entrega no debe cambiar las Skills ofensivas.");
const forge=readFileSync(new URL("../dm-skill-creator.html",import.meta.url),"utf8");
const playerUi=readFileSync(new URL("../js/dm-skill-forge-ui.js",import.meta.url),"utf8");
const grants=readFileSync(new URL("../js/dm-skill-forge-grants.js",import.meta.url),"utf8");
const dashboard=readFileSync(new URL("../pantalla_dm.html",import.meta.url),"utf8");
const styles=readFileSync(new URL("../css/dm-skill-forge.css",import.meta.url),"utf8");
assert.match(forge,/dm-skill-forge-ui\.js/);
assert.match(forge,/dm-skill-forge-grants\.js/);
assert.match(forge,/forgeAuth/);
assert.match(dashboard,/href="dm-skill-creator\.html"/);
assert.match(playerUi,/ClashableGuard/);
assert.match(playerUi,/ClashableCounter/);
assert.match(playerUi,/friendlyEffectControls/);
assert.match(grants,/activeCombatantForPlayer/);
assert.match(grants,/resolvePlayerUnit/);
assert.match(grants,/grantedSkillIds/);
assert.match(grants,/isDefense===true/);
assert.match(styles,/@media\(max-width:760px\)/);
console.log("Forja DM: esquema canónico, presets, Coins, estados, biblioteca y entrega al jugador: OK");
