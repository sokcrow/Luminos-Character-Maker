"use strict";

const assert = require("node:assert/strict");

require("../js/curse-catalog.js");
require("../js/curse-runtime.js");

const Catalog = globalThis.LuminousCurseCatalog;
const Curse = globalThis.LuminousCurseRuntime;
const binding = Catalog.get("cursed_binding");

assert.deepEqual(Catalog.FAMILIES,["item","affliction","binding","ritual","pact"]);
assert.deepEqual(Catalog.TARGET_KINDS,["item","creature","place","lineage","entity"]);
assert.equal(Catalog.list("creature").length,0,"unimplemented targets must not ship as executable curses");
assert.equal(Catalog.list("item").length,1);
assert.equal(Catalog.validateDefinition(binding).valid,true);
assert.equal(Catalog.validateDefinition({...binding,adverseEffect:"hp_drain"}).valid,false,
  "an unimplemented HP drain must never be publishable");
assert.equal(Catalog.validateDefinition({...binding,trigger:"on_hit"}).valid,false);
assert.equal(Catalog.validateDefinition({...binding,targetKinds:["place"]}).valid,false);
assert.equal(Catalog.validateDefinition({...binding,family:"invalid"}).valid,false);
assert.equal(Catalog.validateDefinition({...binding,description:""}).valid,false);
assert.equal(Catalog.validateDefinition({...binding,maxIntensity:0}).valid,false);
assert.equal(Catalog.validateDefinition({...binding,allowedResolutions:["remove","execute_code"]}).valid,false);
assert.equal(Catalog.validateDefinition({...binding,duration:10}).valid,false,
  "duration must stay blocked until explicitly implemented");
assert.equal(Catalog.validateDefinition({...binding,resource:{spCost:1}}).valid,false);
assert.equal(Catalog.validateDefinition({...binding,handler_function:"alert(1)"}).valid,false);
assert.equal(Catalog.validateDefinition({...binding,other:{script:"payload"}}).valid,false);
assert.equal(Catalog.validateDefinition({...binding,other:{run:()=>true}}).valid,false);

const item = {instanceId:"catalog_item",category:"weapon",quantity:1};
const unchanged = JSON.stringify(item);
const can = Curse.canApply(item,"cursed_binding");
assert.equal(can.allowed,true);
assert.equal(Curse.canApply(item,"nonexistent").allowed,false);
assert.equal(Curse.canApply({...item,quantity:3},"cursed_binding").reason,"curse_requires_single_item");
assert.equal(Curse.canApply(item,"cursed_binding",{origin:{script:"evil"}}).allowed,false);
assert.equal(Curse.canApply(item,"cursed_binding",{origin:{source:123}}).allowed,false);

const applied = Curse.applyItem(item,"cursed_binding",{
  instanceId:"curse:catalog:one",
  eventId:"turn:1:action:7",
  origin:{source:"dm_item_editor",createdBy:"test_dm"},
  appliedAt:1700000000000,
});
assert.equal(applied.applied,true);
assert.equal(JSON.stringify(item),unchanged,"apply never mutates caller");
assert.equal(applied.item.curseInstances.length,1);
assert.equal(Curse.validateInstance(applied.item,applied.instance).valid,true);
assert.equal(Curse.canApply(applied.item,"cursed_binding",{eventId:"turn:1:action:7"}).reason,"duplicate_curse_event");
assert.equal(Curse.canApply(applied.item,"cursed_binding").reason,"curse_intensity_limit_reached");
assert.equal(Curse.instances(applied.item).length,1);
const effects = Curse.activeEffects(applied.item);
assert.deepEqual(effects.map(effect=>effect.type),["equipment_lock"]);
assert.equal(effects[0].curseInstanceId,"curse:catalog:one");
assert.equal(Curse.activeEffects(applied.item,"on_hit").length,0);
assert.equal(Curse.activeEffects(applied.item,"passive").length,1);
const beforeRead = JSON.stringify(applied.item);
Curse.hasCurse(applied.item);
Curse.itemUnequipLocked(applied.item);
Curse.instances(applied.item);
Curse.listDefinitions();
Curse.snapshot(applied.item);
assert.equal(JSON.stringify(applied.item),beforeRead,"pure queries never mutate Items");
const leaked = Curse.instances(applied.item);
leaked[0].definition.name="BROKEN";
assert.equal(Catalog.get("cursed_binding").name,"Atadura maldita","catalog results are not mutable source");
assert.equal(Curse.instances(applied.item)[0].definition.name,"Atadura maldita");

const forged = {...item,curseInstances:[{definitionId:"cursed_binding",state:"active"}]};
assert.equal(Curse.hasCurse(forged),false,"malformed items cannot execute cursed effects");
assert.equal(Curse.canApply(forged,"cursed_binding").reason,"invalid_existing_curse_instance");
const wrongTarget = {...item,curseInstances:[{...applied.instance,targetInstanceId:"another_item"}]};
assert.equal(Curse.hasCurse(wrongTarget),false,"an instance cannot jump between Items without transfer");
assert.equal(Curse.canResolve(wrongTarget,applied.instance.instanceId,"seal").allowed,false);
const forgedScript = {...item,curseInstances:[{...applied.instance,origin:{source:"ok",script:"execute"}}]};
assert.equal(Curse.itemUnequipLocked(forgedScript),false,"executable-looking payloads are never effects");

const gate = Curse.canResolve(applied.item,applied.instance.instanceId,"seal");
assert.equal(gate.allowed,true);
assert.equal(gate.nextState,"sealed");
assert.equal(Curse.resolveItem(applied.item,applied.instance.instanceId,"remove").reason,"curse_resolution_not_allowed");
const sealed = Curse.resolveItem(applied.item,applied.instance.instanceId,"seal");
assert.equal(sealed.changed,true);
assert.equal(Curse.itemUnequipLocked(sealed.item),false);
assert.equal(Curse.hasCurse(sealed.item),true);
assert.equal(Curse.resolveItem(sealed.item,applied.instance.instanceId,"seal").reason,"curse_invalid_state_transition");
const activated = Curse.resolveItem(sealed.item,applied.instance.instanceId,"unseal");
assert.equal(Curse.itemUnequipLocked(activated.item),true);
const broken = Curse.resolveItem(activated.item,applied.instance.instanceId,"break");
assert.equal(broken.changed,true);
assert.equal(Curse.hasCurse(broken.item),false);
assert.equal(Curse.instances(broken.item,{includeResolved:true}).length,1);
assert.equal(Curse.canResolve(broken.item,applied.instance.instanceId,"unseal").allowed,false);

const destination={instanceId:"other_item",category:"weapon",quantity:1};
const transfer=Curse.transferItem(applied.item,destination,applied.instance.instanceId);
assert.equal(transfer.transferred,true);
assert.equal(Curse.hasCurse(transfer.source),false);
assert.equal(Curse.itemUnequipLocked(transfer.destination),true);
assert.equal(transfer.destination.curseInstances[0].targetInstanceId,"other_item");
assert.equal(destination.curseInstances,undefined,"transfer must not mutate destination");
assert.equal(Curse.transferItem(applied.item,{...destination,quantity:2},applied.instance.instanceId).reason,"curse_requires_single_item");

console.log("Curse Catalog / safe definitions / instance lifecycle: OK");
