const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

(async () => {
  delete globalThis.LuminousWeaponComponentCatalog;
  delete globalThis.LuminousFirearmComponentCatalog;
  delete globalThis.LuminousFirearmCompositionEngine;

  await import(pathToFileURL(path.resolve(__dirname, "../js/item-catalog-weapon-components.js")).href);
  await import(pathToFileURL(path.resolve(__dirname, "../js/item-catalog-firearm-components.js")).href);
  await import(pathToFileURL(path.resolve(__dirname, "../js/item-firearm-composition-engine.js")).href);

  const Engine = globalThis.LuminousFirearmCompositionEngine;
  assert.ok(Engine);

  assert.deepEqual(Engine.referenceBuild("pistol").properties, ["ammunition"]);
  assert.deepEqual(Engine.referenceBuild("revolver").properties, ["ammunition"]);
  assert.deepEqual(Engine.referenceBuild("smg").properties.sort(), ["ammunition","versatile"].sort());
  assert.deepEqual(Engine.referenceBuild("rifle").properties.sort(), ["ammunition","two_handed"].sort());
  assert.deepEqual(Engine.referenceBuild("shotgun").properties.sort(), ["ammunition","two_handed"].sort());

  for (const id of ["pistol","revolver","smg","rifle","shotgun"]) {
    const build = Engine.referenceBuild(id);
    assert.equal(build.properties.includes("special"), false, `${id} should not use Special as a catch-all property`);
  }

  console.log("Firearm universal properties smoke: OK");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
