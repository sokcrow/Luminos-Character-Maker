const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

(async () => {
  delete globalThis.LuminousWeaponCatalog;
  await import(pathToFileURL(path.resolve(__dirname, "../js/item-catalog-weapons.js")).href);
  const Catalog = globalThis.LuminousWeaponCatalog;

  assert.ok(Catalog);
  assert.equal(Catalog.BASE_WEAPON_PROPERTIES.special, undefined);

  assert.deepEqual(Catalog.get("dagger").properties.sort(), ["finesse","light","thrown"].sort());
  assert.deepEqual(Catalog.get("greatsword").properties.sort(), ["heavy","two_handed"].sort());
  assert.deepEqual(Catalog.get("longsword").properties, ["versatile"]);
  assert.deepEqual(Catalog.get("hand_crossbow").properties.sort(), ["ammunition","light","loading"].sort());
  assert.deepEqual(Catalog.get("net").properties, ["thrown"]);

  assert.ok(Catalog.get("dagger").tags.includes("finesse"));
  assert.ok(Catalog.get("greatsword").tags.includes("heavy"));

  console.log("Weapon property catalog smoke: OK");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
