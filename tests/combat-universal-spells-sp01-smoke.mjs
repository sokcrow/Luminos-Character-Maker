import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {Script,runInNewContext} from "node:vm";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const html=read("Battle-viewer.html");
const loader=read("js/combat-v073-spell-bootstrap.js");
const menu=read("js/combat-v073-economy-menu.js");
const authority=read("js/combat-v073-authority.js");
assert.match(html,/combat-v073-spell-bootstrap\.js/);
assert.match(html,/combat-v073-spell-availability\.css/);
assert.match(loader,/spellcasting-basic-rules-runtime\.js/);
assert.match(loader,/battle-viewer-spell-adapter-074\.js/);
assert.match(loader,/battle-viewer-spell-runtime-074\.js/);
assert.match(loader,/__spellAdapter074/);
assert.match(loader,/__spellRuntime074/);
assert.doesNotMatch(loader,/battle-viewer-runtime-074\.js/);
assert.match(menu,/__spellUnavailableReason/);
assert.match(menu,/button\.disabled=true/);
assert.match(menu,/if\(explicit\)/);
assert.match(authority,/SPELL_PLAN_REJECTED:/);
assert.match(authority,/resolveSpellForCombatant\(unit,spellId/);
assert.match(read("js/combat-v073-live-adapter.js"),/LuminousSpellLoadout\.canonical\(authoritativePlayer\)/);
for(const path of ["js/combat-v073-spell-bootstrap.js","js/combat-v073-economy-menu.js","js/combat-v073-authority.js","js/spell-loadout-core.js","js/combat-v073-live-adapter.js"]){
  assert.doesNotThrow(()=>new Script(read(path),{filename:path}),path);
}
const fake={addEventListener(){},setTimeout(){return 1},clearTimeout(){},console:{error(){}}};
fake.document={head:{appendChild(){}},getElementById(){return null},createElement(){return {addEventListener(){}}}};
runInNewContext(loader,{window:fake,globalThis:fake,Promise,Date});
assert.equal(fake.LuminousCombatSpellBootstrap073.state.ready,false);
assert.ok(fake.LuminousCombatSpellBootstrap073.MODULES.length>=12);

// Load and execute the actual bundle wrapper. The source file alone is NOT
// proof that the decompressed production combat document imports this bridge.
import {gunzipSync} from "node:zlib";
const parts=[
 ...["01","02","03","04","05","06"].map(n=>"combat/combat-v073-live.bundle.part"+n),
 ...["r1","r2","r3"].map(n=>"combat/repair/combat-v073-live.bundle.part07."+n),
 ...["08","09","10","11"].map(n=>"combat/combat-v073-live.bundle.part"+n),
];
const original=gunzipSync(Buffer.from(parts.map(read).join("").replace(/\s+/g,""),"base64")).toString("utf8");
assert.ok(original.includes("window.LuminousCombatLiveMode=true"));
let written="";
let complete;
const writtenPromise=new Promise(resolve=>{complete=resolve});
const browserWindow={addEventListener(){},parent:null};
browserWindow.parent=browserWindow;
const document={
 getElementById(){return {set textContent(value){throw Error(String(value))}}},
 open(){},write(value){written=value;complete()},close(){}
};
const wrapperScript=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(wrapperScript);
runInNewContext(wrapperScript,{
 window:browserWindow,document,Blob,Response,DecompressionStream,Uint8Array,atob,
 location:{origin:"http://localhost"},console,
 fetch:async file=>{assert.ok(parts.includes(file));return {ok:true,text:async()=>read(file)}}
});
await writtenPromise;
assert.ok(written.length>200000);
assert.match(written,/src="js\/combat-v073-spell-bootstrap\.js/);
assert.match(written,/href="css\/combat-v073-spell-availability\.css/);
assert.match(written,/src="js\/combat-v073-plan-sync\.js/);
// A dependency preflight can complete without introducing a second Viewer role runtime.
assert.doesNotMatch(written,/src="js\/battle-viewer-runtime-074\.js/);

console.log("Combat SP-01: real packed Viewer injection + canonical Spell bridge contract OK");


// PR #1044 regressions: actual loadout resolver -> real economy menu row ->
// plan-sync serialization -> authority seal validation (P1/P2).
function spellPlanningFixture(classIds){
  const unit={id:"player:fixture",ownerPlayerId:"fixture",isPlayer:true,controlled:"player",
    classes:classIds.map(classId=>({classId,levels:3})),
    spellLoadout:{schemaVersion:1,spellIds:["fire_bolt","mage_hand"]}};
  const catalog=Object.fromEntries(["fire_bolt","mage_hand"].map(id=>[id,{
    id,name:id,classIds:["wizard","sorcerer"],contexts:["combat"],castingTime:"action",level:0}]));
  const win={Math,console:{error(){}},addEventListener(){},removeEventListener(){},
    setTimeout(){return 1},clearTimeout(){},LuminousSpellCatalog:catalog,
    LuminousContentRegistry:{revision:1,list(){return[]},get(){return null}},
    LuminousContentRegistryBootstrap:{registerAvailableCore(){}},
    LuminousSpellcastingRuntime:{
      getClassSpellcastingAbility(id){return classIds.includes(id)?"intelligence":null},
      getClassSpellcastingProfile(id){return classIds.includes(id)?{spellcastingStartLimbusLevel:1}:null}
    },
    LuminousCombat073:{playerId(){return unit.id},combatants(){return {[unit.id]:unit}}},
    LuminousCombatLiveAdapter073:{state:{playerId:"fixture",uid:"test",role:"player",players:{fixture:unit}}},
    firebase:{database:{ServerValue:{TIMESTAMP:1}}}};
  for(const path of ["js/spell-loadout-core.js","js/combat-spell-loadout-074.js",
    "js/combat-v073-economy-menu.js","js/combat-v073-plan-sync.js","js/combat-v073-authority.js"]){
    runInNewContext(read(path),{window:win,globalThis:win,console,Date,Promise,Math},{filename:path});
  }
  return {win,unit};
}
for(const classes of [["wizard"],["wizard","sorcerer"]]){
  const {win,unit}=spellPlanningFixture(classes),menu=win.LuminousCombatEconomyMenu073;
  const plans=win.LuminousCombatPlanSync073,authority=win.LuminousCombatAuthority073;
  const makePayload=data=>plans.payloadFor({type:"spells",data},0,unit.id,{
    playerId:"fixture",uid:"test",round:1,players:{fixture:unit}});
  for(const spellId of ["fire_bolt","mage_hand"]){
    const row=menu.spellRowsForPlayer().find(entry=>entry.spellId===spellId);
    assert.ok(row,spellId+" missing from canonical menu");
    if(classes.length===1){
      assert.equal(row.classId,"wizard",spellId+" class dropped by menu");
      const payload=makePayload(row);
      assert.equal(payload.classId,"wizard");
      assert.equal(authority.validateSpellPlans({fixture:{0:payload}}),true);
    }else{
      assert.deepEqual([...row.__spellClassCandidates],["wizard","sorcerer"]);
      for(const classId of row.__spellClassCandidates){
        const chosen=win.LuminousCombatSpellLoadout074.resolveSpellForCombatant(unit,spellId,{classId});
        assert.equal(chosen.ok,true);
        const selected={...menu.normalizeSpellForMenu(chosen.spell,spellId),classId:chosen.classId};
        const payload=makePayload(selected);
        assert.equal(payload.classId,classId);
        assert.equal(authority.validateSpellPlans({fixture:{0:payload}}),true);
      }
    }
  }
  assert.throws(()=>authority.validateSpellPlans({fixture:{0:makePayload({id:"fire_bolt",classId:"rogue"})}}),/SPELL_CLASS_NOT_AVAILABLE/);
}
assert.match(menu,/__spellClassCandidates/);
assert.match(read("css/combat-v073-spell-availability.css"),/min-height:48px/);
console.log("Combat SP-01: real menu -> selected class -> plan -> authority regressions OK");
