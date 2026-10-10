const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

(async () => {
  delete globalThis.LuminousWeaponPropertyRuntime;
  await import(pathToFileURL(path.resolve(__dirname, "../js/weapon-property-runtime.js")).href);
  const runtime = globalThis.LuminousWeaponPropertyRuntime;

  assert.ok(runtime);
  assert.equal(runtime.VERSION, 1);
  assert.equal(runtime.PROPERTY_IDS.includes("special"), false);

  const dagger = { properties:["light","finesse","thrown"], handMode:"one_handed" };
  assert.deepEqual(runtime.resolveWeaponProperties(dagger).sort(), ["finesse","light","thrown"].sort());

  const neutralizedDagger = { properties:["light","finesse","thrown"], weightClass:"neutral", handMode:"one_handed" };
  assert.deepEqual(runtime.resolveWeaponProperties(neutralizedDagger).sort(), ["finesse","thrown"].sort());

  const materialHeavyLongsword = { properties:["versatile"], weightClass:"heavy", handMode:"versatile" };
  assert.equal(runtime.hasProperty(materialHeavyLongsword, "heavy"), true);

  const propertyRemoval = {
    properties:["light","finesse"],
    components:[{ upgrades:[{ id:"custom_balance", removeProperties:["light"] }] }],
  };
  assert.deepEqual(runtime.resolveWeaponProperties(propertyRemoval), ["finesse"]);

  const greatsword = { properties:["heavy"], handMode:"two_handed" };
  assert.equal(runtime.hasProperty(greatsword, "two_handed"), true);
  assert.equal(runtime.equipmentCompatibility(greatsword, { shield:{id:"shield"} }).valid, false);

  const finesseSkill = runtime.applyFinesse({ coinAmount:1, scalingStat:"Fuerza" }, dagger);
  assert.equal(finesseSkill.scalingStat, "Destreza");
  const twoCoinSkill = runtime.applyFinesse({ coinAmount:2, scalingStat:"Fuerza" }, dagger);
  assert.equal(twoCoinSkill.scalingStat, "Fuerza");

  const heavy = runtime.resolvePowerModifiers({
    weapon: greatsword,
    wielder:{ level:20, size:"small" },
    target:{ level:10, size:"medium" },
  });
  assert.equal(heavy.clashPower, 1);
  assert.equal(heavy.power, -2);

  const reach = runtime.resolvePowerModifiers({
    weapon:{ properties:["reach"] },
    wielder:{ speed:6 },
    target:{ speed:3 },
    melee:true,
  });
  assert.equal(reach.clashPower, 1);

  const versatile = runtime.resolvePowerModifiers({
    weapon:{ properties:["versatile"] },
    wielder:{ level:1 },
    target:{ level:1 },
    handsUsed:2,
  });
  assert.equal(versatile.finalPower, 1);

  assert.equal(runtime.lightCoinDamagePercent({
    mainHand:{properties:["light"]},
    offHand:{properties:["light"]},
    coinIndex:1,
  }), 0);
  assert.equal(runtime.lightCoinDamagePercent({
    mainHand:{properties:["light"]},
    offHand:{properties:["light"]},
    coinIndex:2,
  }), 5);

  assert.deepEqual(runtime.resolveWeaponProficiency({proficient:true,proficiencyBonus:2}), {
    proficiencyBonus:2, damageBonusPercent:4, offensiveLevelBonus:1,
  });
  assert.deepEqual(runtime.resolveWeaponProficiency({proficient:true,proficiencyBonus:4}), {
    proficiencyBonus:4, damageBonusPercent:8, offensiveLevelBonus:2,
  });
  assert.deepEqual(runtime.resolveWeaponProficiency({proficient:true,proficiencyBonus:6}), {
    proficiencyBonus:6, damageBonusPercent:12, offensiveLevelBonus:3,
  });
  assert.equal(runtime.resolveWeaponProficiency({proficient:false,proficiencyBonus:6}).damageBonusPercent,0);
  assert.equal(runtime.resolveWeaponProficiency({proficient:false,proficiencyBonus:6}).offensiveLevelBonus,0);
  const trainedStrike = runtime.resolvePowerModifiers({
    weapon:dagger, wielder:{level:41}, target:{level:41}, proficient:true,
  });
  assert.equal(trainedStrike.damageBonusPercent,8);
  assert.equal(trainedStrike.offensiveLevelBonus,2);

  assert.equal(runtime.canBenefitFromAdditionalAttack({properties:["loading"]}), false);
  assert.equal(runtime.canBenefitFromAdditionalAttack({properties:["loading"]}, {ignoreLoading:true}), true);

  console.log("Weapon property runtime smoke: OK");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
