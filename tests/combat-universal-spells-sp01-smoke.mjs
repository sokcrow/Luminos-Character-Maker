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
    "js/combat-v073-economy-menu.js","js/combat-v073-plan-sync.js","js/combat-v073-remote-intents.js","js/combat-v073-authority.js"]){
    runInNewContext(read(path),{window:win,globalThis:win,console,Date,Promise,Math},{filename:path});
  }
  // Small product-DOM fixture: the actual renderSpells() builds accessible
  // candidate buttons. Clicking them must carry the chosen class to READY.
  const element=tag=>{
    const node={tag,children:[],className:"",style:{setProperty(){}},
      classList:{add(){}},setAttribute(){},
      appendChild(child){this.children.push(child);return child;}};
    Object.defineProperty(node,"innerHTML",{get(){return this._html||"";},
      set(value){this._html=value;this.children=[];}});
    return node;
  };
  const body=element("div");
  win.document={createElement:element,getElementById(id){return id==="category-body"?body:null;}};
  let selection=null;
  win.LuminousCombatEconomyMenu073.state.originals.selectAction=chosen=>{selection=chosen;return chosen;};
  return {win,unit,body,selected:()=>selection};
}
for(const classes of [["wizard"],["wizard","sorcerer"]]){
  const {win,unit,body,selected}=spellPlanningFixture(classes),menu=win.LuminousCombatEconomyMenu073;
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
      menu.renderSpells();
      const stack=body.children[0];
      const group=stack.children.find(node=>node.className==="spell-class-choice"&&
        node.children[0].textContent.startsWith(spellId+" · "));
      assert.ok(group,spellId+" class chooser not rendered");
      const buttons=group.children[1].children;
      assert.equal(buttons.length,2);
      for(const [index,classId] of row.__spellClassCandidates.entries()){
        assert.equal(buttons[index].disabled,undefined);
        buttons[index].onclick();
        const choice=selected();
        assert.equal(choice?.data?.classId,classId,"class lost after choosing "+classId);
        const payload=makePayload(choice.data);
        assert.equal(payload.classId,classId);
        assert.equal(authority.validateSpellPlans({fixture:{0:payload}}),true);
      }
    }
  }
  assert.throws(()=>authority.validateSpellPlans({fixture:{0:makePayload({id:"fire_bolt",classId:"rogue"})}}),/SPELL_CLASS_NOT_AVAILABLE/);
}
assert.match(read("js/combat-v073-economy-menu.js"),/__spellClassCandidates/);
assert.match(read("css/combat-v073-spell-availability.css"),/min-height:48px/);
console.log("Combat SP-01: real menu -> selected class -> plan -> authority regressions OK");

// A valid ID must never carry client-authored damage/effects into execution.
{
  const {win,unit}=spellPlanningFixture(["wizard"]);
  const payload=win.LuminousCombatPlanSync073.payloadFor({type:"spells",data:{
    id:"fire_bolt",classId:"wizard",name:"Forged",damage:999999,
    effects:[{type:"instant_kill"}],classIdOverride:"rogue"}},0,unit.id,
    {playerId:"fixture",uid:"test",round:1,players:{fixture:unit}});
  payload.data={damage:999999};
  assert.equal(win.LuminousCombatAuthority073.validateSpellPlans({fixture:{0:payload}}),true);
  assert.equal(payload.actionData.damage,undefined);
  assert.equal(payload.actionData.effects,undefined);
  assert.equal(payload.data,undefined);
  const executed=win.LuminousCombatRemoteIntents073.runtimePlan(payload,0,unit);
  assert.equal(executed.data.classId,"wizard");
  assert.equal(executed.data.id,"fire_bolt");
  assert.equal(executed.data.damage,undefined);
  const invalid=structuredClone(payload);invalid.spellId="invented_spell";
  assert.throws(()=>win.LuminousCombatAuthority073.validateSpellPlans({fixture:{0:invalid}}),/SPELL_NOT_SELECTED/);
  const noActor=structuredClone(payload);noActor.unitId="missing";noActor.scheduledBy="missing";
  assert.throws(()=>win.LuminousCombatAuthority073.validateSpellPlans({fixture:{0:noActor}}),/SPELL_ACTOR_NOT_FOUND/);
  win.LuminousWizardClassRuntime={spellIdsForCombat:()=>["fire_bolt"]};
  for(const empty of [{spellLoadout:{schemaVersion:1}}, {spellIds:[]}]){
    const source={...unit,...empty};
    if(empty.spellIds)delete source.spellLoadout;
    assert.deepEqual([...win.LuminousCombatSpellLoadout074.rawSpellIdsFor(source)],[]);
    assert.equal(win.LuminousCombatSpellLoadout074.resolveSpellForCombatant(source,"fire_bolt").ok,false);
  }
}

// Browser scheduling contracts: existing script load event was already missed;
// delayed globals still settle, failed runtime.ready never reports success.
async function bootstrapFixture(installOk=true,missingSource=null){
  const win={setTimeout,clearTimeout,console:{error(){}},addEventListener(){},
    dispatchEvent(){},CustomEvent:class {}};
  runInNewContext(loader,{window:win,globalThis:win,Date,Promise});
  const api=win.LuminousCombatSpellBootstrap073;
  const globals=["LuminousContentRegistry","LuminousContentRegistryBootstrap",
    "LuminousSpellcastingRuntime","LuminousSpellcastingRuntime","LuminousSpellCatalog",
    "LuminousRoleSpellCatalog","LuminousSpellLoadout","LuminousCombatSpellLoadout074",
    "LuminousCombatAction","LuminousCombatActionAdapters","LuminousBattleViewerActionAdapter073",
    "LuminousBattleViewerSpellAdapter074","LuminousPierreSpellBatchRuntime",
    "LuminousWeaponCantripBatchRuntime","LuminousCantripBatchRuntime","LuminousBattleViewerSpellRuntime074","LuminousCombatSourceExecution"];
  const scripts=[],appended=[];
  const publish=index=>{
    win[globals[index]]={...win[globals[index]]};
    if(index===3)win.LuminousSpellcastingRuntime.__basicRulesV1=true;
    if(index===11)win.LuminousBattleViewerSpellAdapter074.install=()=>{
      win.LuminousBattleViewerActionAdapter073.__spellAdapter074=true;return true;};
    if(index===15){win.LuminousBattleViewerSpellRuntime074.ready=Promise.resolve(installOk);
      win.LuminousBattleViewerCombatHooks073={__spellRuntime074:true};}
  };
  // Catalog is already loading under another loader's ID.
  scripts.push({getAttribute:()=>"js/spell-catalog-core.js?v=other",addEventListener(){},removeEventListener(){}});
  win.document={scripts,getElementById:()=>null,createElement:()=>({addEventListener(name,fn){this[name]=fn;},removeEventListener(){}}),
    head:{appendChild(node){const src=node.src.split("?")[0];appended.push(src);const i=api.MODULES.findIndex(row=>row[1]===src);
      if(src===missingSource)queueMicrotask(()=>node.error());else publish(i);}}};
  // Resolves by readiness polling without relying on another load event.
  setTimeout(()=>publish(4),5);
  const results=await Promise.all([api.boot(),api.boot()]);
  assert.equal(results[0],installOk&&!missingSource);
  assert.equal(api.state.ready,installOk&&!missingSource);
  assert.equal(appended.includes("js/spell-catalog-core.js"),false);
  assert.equal(new Set(appended).size,appended.length);
}
await bootstrapFixture();
await bootstrapFixture(false);
await bootstrapFixture(true,"js/spell-batch-cantrips-runtime.js");
console.log("Combat SP-01: trusted execution payload, empty assignment, delayed/failed bootstrap OK");

// Existing Wizards without DM mirrors retain the resolver's learned/prepared list.
{
  const {win,unit}=spellPlanningFixture(["wizard"]);
  delete unit.spellLoadout;
  win.LuminousWizardClassRuntime={spellIdsForCombat:()=>["fire_bolt","mage_hand"]};
  const rows=win.LuminousCombatEconomyMenu073.spellRowsForPlayer();
  assert.deepEqual(Array.from(rows,row=>row.spellId),["fire_bolt","mage_hand"]);
  assert.ok(rows.every(row=>row.classId==="wizard"));
  unit.spellLoadout={schemaVersion:1};
  assert.equal(win.LuminousCombatEconomyMenu073.spellRowsForPlayer().length,0);
}

