const assert = require("node:assert/strict");\nconst fs = require("node:fs");\nconst path = require("node:path");

require("../js/item-icon-registry.js");
require("../js/item-catalog-weapons.js");
require("../js/item-catalog-tools.js");
require("../js/item-catalog-hp-healing.js");
require("../js/item-catalog-ore-ingot-gem.js");
require("../js/item-runtime-engine.js");
require("../js/item-inventory-runtime.js");

const core = require("../js/dm-item-catalog-core.js");

const catalog = core.collectCatalogMap(globalThis, { iconRegistry: globalThis.LuminousItemIconRegistry });

assert.ok(Object.keys(catalog).length > 40, "canonical item catalog should not be empty");

const longsword = catalog.longsword;
assert.ok(longsword, "Longsword should be collected from the weapon catalog");
assert.equal(longsword.nombre, "Longsword");
assert.equal(longsword.category, "weapon");
assert.match(longsword.icono, /Assets\/Icons\/items\/equipment\//);

const firebaseOverlay = core.buildCatalogMap(globalThis, {
  longsword: {
    nombre: "Longsword DM Override",
    price: 1234,
    tier: "II"
  },
  dm_custom_key: {
    nombre: "Llave del Director",
    tipo_categoria: "utility",
    tags: ["quest_item"],
    price: 77
  }
}, { iconRegistry: globalThis.LuminousItemIconRegistry });

assert.equal(firebaseOverlay.longsword.nombre, "Longsword DM Override");
assert.equal(firebaseOverlay.longsword.definitionId, "longsword");
assert.ok(firebaseOverlay.dm_custom_key, "Firebase-only custom items must remain visible");

const granted = core.createGrantPayload(longsword, 3, {
  iconRegistry: globalThis.LuminousItemIconRegistry,
  inventoryRuntime: globalThis.LuminousItemInventoryRuntime
});

assert.equal(granted.definitionId, "longsword");
assert.equal(granted.quantity, 3);
assert.equal(granted.cantidad, 3);
assert.equal(granted.nombre, "Longsword");
assert.ok(granted.instanceId, "grant payload should carry a modern item instance id");
assert.equal(core.sameDefinition(granted, longsword), true);

const patch = core.quantityPatch(granted, 5);
assert.deepEqual(patch, { quantity: 5, cantidad: 5 });

console.log("dm-item-catalog-core.spec: ok");


const dmPage = fs.readFileSync(path.join(__dirname, "..", "pantalla_dm.html"), "utf8");
assert.match(dmPage, /css\/dm-limbus-shell\.css/);
assert.match(dmPage, /css\/dm-item-catalog-v2\.css/);
assert.match(dmPage, /js\/dm-item-catalog-core\.js/);
assert.match(dmPage, /core\.buildCatalogMap\(window, firebaseItems/);
assert.doesNotMatch(dmPage, /<\/script>\\n\s*<script src="js\/item-catalog-/);

console.log("dm item page wiring: ok");
