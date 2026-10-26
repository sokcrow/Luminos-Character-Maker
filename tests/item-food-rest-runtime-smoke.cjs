const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

(async () => {
  for(const key of ["LuminousUniversalModifiers","LuminousItemRuntime","LuminousCookingEngine","LuminousFoodRestRuntime"]) delete globalThis[key];
  for(const file of [
    "../js/universal-modifier-engine.js",
    "../js/item-runtime-engine.js",
    "../js/item-cooking-engine.js",
    "../js/item-cooking-v2-engine.js",
    "../js/item-food-rest-runtime.js",
  ]) await import(pathToFileURL(path.resolve(__dirname,file)).href);

  const rest=globalThis.LuminousFoodRestRuntime;
  const mods=globalThis.LuminousUniversalModifiers;
  assert.ok(rest);
  assert.ok(mods);

  const food={
    instanceId:"meal-a",definitionId:"food_prepared_test",recipeId:"test_meal",
    displayName:"Test Meal",family:"food",category:"food",quantity:1,
    hungerSlotsRestored:1,hydrationSlotsRestored:1,spRestore:4,taste:4,stars:4,
    maxHpBonus:20,durationHours:2,
    culinaryEffects:[{target:"survival",power:2,affinity:6,durationHours:2}],
  };
  const plain={
    instanceId:"plain-a",definitionId:"food_cooked_wolf",displayName:"Cooked Wolf Meat",
    family:"food",category:"food",quantity:1,hungerSlotsRestored:1,hydrationSlotsRestored:0,
  };
  const weak={
    instanceId:"weak-a",definitionId:"food_weak",family:"food",category:"food",quantity:1,
    culinaryEffects:[{target:"survival",power:1,affinity:2,durationHours:4}],
  };
  const strong={
    instanceId:"strong-a",definitionId:"food_strong",family:"food",category:"food",quantity:1,
    culinaryEffects:[{target:"survival",power:3,affinity:4,durationHours:1}],
  };
  const unit={
    hp:20,hp_max:100,sp:0,sp_max:45,
    inventario_activo:{"meal-a":food,"plain-a":plain,"weak-a":weak,"strong-a":strong},
    inventario_stash:{},
    culinarySurvival:{hungerSlots:1,hydrationSlots:1,maxHungerSlots:3,maxHydrationSlots:3},
  };

  const now=1000000;
  const short=rest.performRest(unit,"short",{choice:"eat_drink",foodRef:"meal-a",now});
  assert.equal(short.completed,true);
  assert.equal(unit.hp,54,"Max HP food must not heal into the raised cap");
  assert.equal(unit.hp_max,120);
  assert.equal(unit.sp,4);
  assert.equal(unit.culinarySurvival.hungerSlots,2);
  assert.equal(unit.culinarySurvival.hydrationSlots,2);
  assert.equal(unit.inventario_activo["meal-a"],undefined);
  assert.equal(unit.culinaryEffects.length,1);
  assert.equal(unit.culinaryEffects[0].target,"survival");

  const survivalMods=mods.resolveTraitModifiers({unit,skill:{id:"survival",type:"check"}});
  assert.equal(survivalMods.final_power,2);
  const athleticsMods=mods.resolveTraitModifiers({unit,skill:{id:"athletics",type:"check"}});
  assert.equal(athleticsMods.final_power,0);

  const cooldown=rest.performRest(unit,"short",{choice:"activity",now:now+60*60*1000});
  assert.equal(cooldown.completed,false);
  assert.equal(cooldown.reason,"short_rest_cooldown");

  const plainEat=rest.consumeFood(unit,"plain-a",{now:now+90*60*1000});
  assert.equal(plainEat.consumed,true);
  assert.equal(unit.culinaryEffects.length,1,"plain food must not erase active culinary buffs");

  const weakEat=rest.consumeFood(unit,"weak-a",{now:now+100*60*1000});
  assert.equal(weakEat.consumed,true);
  assert.equal(unit.culinaryEffects[0].power,2,"weaker same-target food must not overwrite stronger effect");

  const strongEat=rest.consumeFood(unit,"strong-a",{now:now+110*60*1000});
  assert.equal(strongEat.consumed,true);
  assert.equal(unit.culinaryEffects[0].power,3,"stronger same-target food must replace weaker effect");

  rest.advanceSurvivalTime(unit,2);
  assert.equal(unit.culinaryEffects.length,0);
  assert.equal(unit.hp_max,100,"expired Max HP food must restore the base cap");

  const long=rest.performRest(unit,"long",{choice:"activity",now:now+3*60*60*1000});
  assert.equal(long.completed,true);
  assert.equal(unit.hp,100);
  assert.equal(unit.sp,0);
  assert.equal(unit.culinarySurvival.completedRequiredLongRest,true);

  const listed=rest.listEdibleInventory(unit);
  assert.equal(listed.length,0);

  const spUnit={sp:-20,sp_max:999};
  const recovered=rest.recoverFoodSp(spUnit,5);
  assert.equal(recovered.after,-15);
  rest.recoverFoodSp(spUnit,100);
  assert.equal(spUnit.sp,45,"food SP recovery is clamped to fixed +45, never sp_max");

  const sleepFood={
    instanceId:"sleep-a",definitionId:"food_sleep",recipeId:"sleep_meal",displayName:"Sleep Meal",
    family:"food",category:"food",quantity:1,hungerSlotsRestored:1,spRestore:0,
    maxHpBonus:10,durationHours:12,restTiming:"pre_sleep_long_rest",
    culinaryEffects:[
      {target:"medicine",power:1,durationHours:12},
      {target:"insight",power:1,durationHours:12},
    ],
    sleepSynergy:{type:"secondary_skill_bonus",power:1,durationHours:4},
  };
  const sleeper={
    hp:20,hp_max:100,sp:0,sp_max:45,
    inventario_activo:{"sleep-a":sleepFood},inventario_stash:{},
    culinarySurvival:{hungerSlots:2,hydrationSlots:2,maxHungerSlots:3,maxHydrationSlots:3},
  };
  const slept=rest.performRest(sleeper,"long",{choice:"eat_drink",foodRef:"sleep-a",now:now+24*60*60*1000});
  assert.equal(slept.completed,true);
  assert.equal(sleeper.hp,100,"Long Rest heals only to pre-food base Max HP");
  assert.equal(sleeper.hp_max,110);
  const insightAfterSleep=mods.resolveTraitModifiers({unit:sleeper,skill:{id:"insight",type:"check"}});
  assert.equal(insightAfterSleep.final_power,2,"pre-sleep meal adds temporary +1 to its secondary Skill");

  console.log("Food Rest V2 smoke: OK (Eat/Drink, fixed SP bounds, temporary Max HP, sleep synergy, cooldown and Long Rest)");
})().catch((error)=>{ console.error(error); process.exitCode=1; });
