const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

(async () => {
  delete globalThis.LuminousTraitEngine;
  delete globalThis.LuminousTraitCatalogCore;
  delete globalThis.LuminousWeaponPropertyRuntime;
  delete globalThis.LuminousMonkClassRuntime;

  await import(pathToFileURL(path.resolve(__dirname, "../js/trait-engine.js")).href);
  await import(pathToFileURL(path.resolve(__dirname, "../js/trait-catalog-core.js")).href);
  await import(pathToFileURL(path.resolve(__dirname, "../js/weapon-property-runtime.js")).href);
  await import(pathToFileURL(path.resolve(__dirname, "../js/monk-class-runtime.js")).href);

  const monk = globalThis.LuminousMonkClassRuntime;
  const catalog = globalThis.LuminousTraitCatalogCore;
  const engine = globalThis.LuminousTraitEngine;

  assert.ok(monk);
  assert.equal(monk.MONK_GRANTS.length, 2);
  assert.ok(catalog.getDefinition("unarmored_defense"));
  assert.ok(catalog.getDefinition("martial_arts"));

  const validation = catalog.validateAll(engine);
  assert.equal(validation.valid, true, validation.errors.join("\n"));

  assert.equal(monk.isMonkWeapon({ id:"dagger", classification:"simple_melee", properties:["light","finesse"] }), true);
  assert.equal(monk.isMonkWeapon({ id:"greatclub", classification:"simple_melee", properties:["heavy"], handMode:"two_handed" }), false);
  assert.equal(monk.isMonkWeapon({ id:"shortsword", classification:"martial_melee", properties:["light","finesse"] }), true);
  assert.equal(monk.isMonkWeapon({ id:"shortsword", classification:"martial_melee", properties:["heavy"] }), false);

  const eligible = monk.martialArtsEligibleAttack(
    { type:"Attack", skillFamily:"attack", attackMode:"melee", coinAmount:1 },
    { id:"dagger", classification:"simple_melee", properties:["light","finesse"] }
  );
  assert.equal(eligible, true);

  const followUp = monk.martialArtsFollowUp(
    { equipment:{} },
    { type:"Attack", skillFamily:"attack", attackMode:"melee", coinAmount:1 },
    { id:"dagger", classification:"simple_melee", properties:["light","finesse"] },
    { modifiers:{ resolveEquipment:() => ({armorEquipped:false,shield:null}) } }
  );
  assert.equal(followUp.available, true);
  assert.equal(followUp.tier, 1);
  assert.equal(followUp.skillFamily, "unarmed");

  console.log("Monk class runtime smoke: OK (L1)");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
