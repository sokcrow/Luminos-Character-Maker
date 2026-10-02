const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

(async () => {
  await import("../js/item-icon-registry.js");
  await import("../js/item-catalog-weapons.js");
  await import("../js/item-catalog-tools.js");
  await import("../js/item-catalog-hp-healing.js");
  await import("../js/item-catalog-ore-ingot-gem.js");
  await import("../js/item-catalog-weapon-components.js");
  await import("../js/item-catalog-firearm-components.js");
  await import("../js/item-catalog-firearm-ammo.js");
  await import("../js/item-catalog-weapon-upgrades.js");
  await import("../js/item-catalog-shield-upgrades.js");
  await import("../js/item-catalog-hard-parts.js");
  await import("../js/item-catalog-scale-shell-chitin.js");
  await import("../js/item-runtime-engine.js");
  await import("../js/item-inventory-runtime.js");
  await import("../js/item-chemistry-recipe-catalog.js");
  await import("../js/item-cooking-recipe-catalog.js");
  await import("../js/item-cooking-recipe-resolver.js");
  await import("../js/item-cooking-equipment-engine.js");
  await import("../js/item-medicine-recipe-catalog.js");
  await import("../js/item-processing-recipe-data.js");
  await import("../js/item-processing-engine.js");
  await import("../js/item-throwable-recipe-catalog.js");
  await import("../js/dm-item-catalog-core.js");
  await import("../js/item-content-registry.js");

  const core = globalThis.LuminousDmItemCatalogCore;
  assert.ok(core, "DM item catalog core should install on globalThis");

  const contentRegistry = globalThis.LuminousItemContentRegistry;
  assert.ok(contentRegistry, "unified item content registry should install on globalThis");

  const catalog = core.collectCatalogMap(globalThis, {
    iconRegistry: globalThis.LuminousItemIconRegistry
  });

  assert.ok(Object.keys(catalog).length > 50, "canonical item catalog should not be empty");

  const longsword = catalog.longsword;
  assert.ok(longsword, "Longsword should be collected from the weapon catalog");
  assert.equal(longsword.nombre, "Longsword");
  assert.equal(longsword.category, "weapon");
  assert.match(longsword.icono, /Assets\/Icons\/items\/equipment\//);

  assert.ok(catalog.hard_bone, "Hard Parts catalog should be discovered");
  assert.ok(catalog.scale, "Scale/Shell/Chitin catalog should be discovered");

  for (const ammoPartId of ["ammo_projectile", "ammo_casing", "ammo_propellant", "ammo_ignition"]) {
    assert.ok(catalog[ammoPartId], `Firearm ammo part ${ammoPartId} should be discovered`);
  }

  const byDefinitionId = (definitionId) => Object.entries(catalog)
    .filter(([, item]) => item.definitionId === definitionId);

  const gripRows = byDefinitionId("grip");
  assert.equal(gripRows.length, 2, "colliding weapon and firearm grip definitions must both survive");
  assert.deepEqual(
    gripRows.map(([, item]) => item.nombre).sort(),
    ["Firearm Grip", "Grip"]
  );
  assert.ok(gripRows.every(([key]) => key !== "grip"), "colliding definitions should use namespaced catalog keys");

  for (const collisionId of ["spiked_face", "power_grip", "secure_grip"]) {
    assert.equal(
      byDefinitionId(collisionId).length,
      2,
      `colliding upgrade definition ${collisionId} must preserve both catalog entries`
    );
  }

  assert.equal(
    core.sameDefinition(
      { definitionId: "longsword", tier: "I" },
      { definitionId: "longsword", tier: "II" }
    ),
    false,
    "same definition with a different tier must not merge"
  );

  assert.equal(
    core.sameDefinition(
      { definitionId: "longsword", tier: "I", manufacturerId: "forge_a" },
      { definitionId: "longsword", tier: "I", manufacturerId: "forge_b" }
    ),
    false,
    "stack-defining runtime variants must remain distinct"
  );

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

  const unified = contentRegistry.build(globalThis, {
    firebaseItems: {
      dm_custom_key: {
        nombre: "Llave del Director",
        tipo_categoria: "utility",
        tags: ["quest_item"],
        price: 77
      }
    },
    firebaseAugmentations: {
      dm_aug_test: {
        nombre: "Aumento de Prueba",
        tipo_categoria: "augmentation",
        price: 500
      }
    },
    iconRegistry: globalThis.LuminousItemIconRegistry
  });
  assert.equal(unified.ready, true);
  assert.ok(unified.counts.items > 50, "unified registry should expose grantable items");
  assert.ok(unified.counts.recipes > 20, "unified registry should expose canonical recipes");
  assert.ok(unified.items.longsword, "canonical items must be available from unified registry");
  assert.ok(unified.items.dm_custom_key, "Firebase custom items must overlay the unified registry");
  assert.ok(
    Object.values(unified.items).some((item) => item.definitionId === "dm_aug_test" && item.category === "augmentation"),
    "Firebase custom augmentations must be folded into the unified grantable item map"
  );
  assert.ok(
    Object.values(unified.recipes).some((recipe) => recipe.recipeKind === "medicine" && recipe.id === "medicine_tablet"),
    "medicine recipes must be discoverable from the unified registry"
  );
  assert.ok(
    Object.values(unified.recipes).some((recipe) => recipe.recipeKind === "throwable" && recipe.id === "smoke_throwable"),
    "throwable recipes must be discoverable from the unified registry"
  );
  assert.ok(
    Object.values(unified.recipes).some((recipe) => recipe.recipeKind === "processing" && recipe.id === "noodles"),
    "processing recipes must be discoverable from the unified registry"
  );

  const chemistryInputs = [
    { definitionId: "cleaning_compound", quantity: 1, __selectedUnits: 1 },
    { definitionId: "chemical_bottle", tags: ["container"], quantity: 1, __selectedUnits: 1 }
  ];
  const chemistryMatches = contentRegistry.findMatchingRecipes(globalThis, chemistryInputs);
  const chemistryMatch = chemistryMatches.find((entry) => entry.recipe.id === "industrial_cleaner");
  assert.ok(chemistryMatch, "canonical chemistry recipes should resolve from selected synthesis items");
  assert.equal(contentRegistry.recipeDifficulty(chemistryMatch.recipe), 18);

  const chemistryWithoutTool = contentRegistry.findMatchingRecipes(globalThis, chemistryInputs, {
    toolItems: [],
    enforceTools: true
  });
  assert.equal(
    chemistryWithoutTool.some((entry) => entry.recipe.id === "industrial_cleaner"),
    false,
    "chemistry recipes must not resolve without their required canonical tool type"
  );

  const chemistryWithTool = contentRegistry.findMatchingRecipes(globalThis, chemistryInputs, {
    toolItems: [{ definitionId: "alchemists_supplies", quantity: 1 }],
    enforceTools: true
  });
  assert.equal(
    chemistryWithTool.some((entry) => entry.recipe.id === "industrial_cleaner"),
    true,
    "a matching chemical tool should unlock the canonical chemistry recipe"
  );

  const doughInputs = [
    { definitionId: "dough", tags: ["dough"], quantity: 1, __selectedUnits: 1 }
  ];
  const whiteBreadRecipe = Object.values(unified.recipes)
    .find((recipe) => recipe.recipeKind === "cooking" && recipe.id === "white_bread");
  assert.ok(whiteBreadRecipe, "White Bread recipe should exist in the unified registry");
  const cookingResolution = contentRegistry.resolveRecipe(whiteBreadRecipe, doughInputs, globalThis);
  assert.equal(cookingResolution.valid, true, "canonical cooking recipes should resolve through the shared registry");

  const ambiguousDough = contentRegistry.findMatchingRecipes(globalThis, doughInputs);
  assert.ok(ambiguousDough.length > 1, "dough should surface multiple compatible canonical recipes");
  assert.equal(
    contentRegistry.findMatchingRecipe(globalThis, doughInputs),
    null,
    "ambiguous synthesis inputs must not silently select a recipe"
  );
  const explicitBread = contentRegistry.findMatchingRecipe(globalThis, doughInputs, {
    recipeKey: whiteBreadRecipe.__catalogKey || whiteBreadRecipe.id
  });
  assert.ok(explicitBread, "an explicit recipe choice should resolve ambiguous ingredients");
  assert.equal(explicitBread.recipe.id, "white_bread");

  const brewBaseRecipe = Object.values(unified.recipes)
    .find((recipe) => recipe.recipeKind === "processing" && recipe.id === "brew_base");
  assert.ok(brewBaseRecipe, "brew_base processing recipe should exist");
  const invalidBrew = contentRegistry.resolveRecipe(brewBaseRecipe, chemistryInputs, globalThis);
  assert.equal(
    invalidBrew.valid,
    false,
    "processing recipes must preserve methodEligible/exclusion semantics from the canonical processing engine"
  );

  const whiteBreadNoEquipment = contentRegistry.resolveRecipe(whiteBreadRecipe, doughInputs, globalThis, {
    enforceEquipment: true,
    toolItems: [],
    unit: {},
    stationId: ""
  });
  assert.equal(whiteBreadNoEquipment.valid, false, "baking must be blocked without canonical cooking equipment");
  assert.equal(whiteBreadNoEquipment.reason, "missing_cooking_equipment");
  assert.ok(whiteBreadNoEquipment.missingToolIds.includes("cooks_utensils"));
  assert.ok(whiteBreadNoEquipment.missingStationIds.includes("oven"));

  const whiteBreadWithEquipment = contentRegistry.resolveRecipe(whiteBreadRecipe, doughInputs, globalThis, {
    enforceEquipment: true,
    toolItems: [{ definitionId: "cooks_utensils", quantity: 1 }],
    unit: {},
    stationId: "oven"
  });
  assert.equal(whiteBreadWithEquipment.valid, true, "baking should resolve with canonical tool and station");

  const craftedOutput = contentRegistry.createRecipeOutput(chemistryMatch.recipe);
  assert.equal(craftedOutput.definitionId, "industrial_cleaner");
  assert.equal(craftedOutput.recipeId, "industrial_cleaner");
  assert.equal(craftedOutput.crafted, true);
  assert.equal(craftedOutput.quantity, 1);

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

  const dmPage = fs.readFileSync(path.join(__dirname, "..", "pantalla_dm.html"), "utf8");
  assert.match(dmPage, /css\/dm-limbus-shell\.css/);
  assert.match(dmPage, /css\/dm-item-catalog-v2\.css/);
  assert.match(dmPage, /js\/dm-item-catalog-core\.js/);
  assert.match(dmPage, /js\/item-content-registry\.js/);
  assert.match(dmPage, /js\/item-cooking-recipe-catalog\.js/);
  assert.match(dmPage, /js\/item-chemistry-recipe-catalog\.js/);
  assert.match(dmPage, /js\/item-medicine-recipe-catalog\.js/);
  assert.match(dmPage, /js\/item-processing-recipe-data\.js/);
  assert.match(dmPage, /js\/item-throwable-recipe-catalog\.js/);
  assert.match(dmPage, /registry\.build\(window/);
  assert.doesNotMatch(dmPage, /<\/script>\\n\s*<script src="js\/item-catalog-/);

  const armorMaterial = dmPage.indexOf('js/item-armor-material-profile.js');
  const armorComponents = dmPage.indexOf('js/item-catalog-armor-components.js');
  const shieldComponents = dmPage.indexOf('js/item-catalog-shield-components.js');
  const weaponComponents = dmPage.indexOf('js/item-catalog-weapon-components.js');
  const firearmComponents = dmPage.indexOf('js/item-catalog-firearm-components.js');
  const rangedComponents = dmPage.indexOf('js/item-catalog-ranged-weapon-components.js');

  assert.ok(armorMaterial >= 0 && armorMaterial < armorComponents, "armor material profile must load before armor components");
  assert.ok(armorMaterial < shieldComponents, "armor material profile must load before shield components");
  assert.ok(weaponComponents >= 0 && weaponComponents < firearmComponents, "weapon components must load before firearm components");
  assert.ok(weaponComponents < rangedComponents, "weapon components must load before ranged components");

  const filterInit = dmPage.indexOf('const searchInputDM = document.getElementById("buscador-items-dm")');
  const localBootstrap = dmPage.indexOf('applyDmContentRegistry("registro canónico local")');
  const firebaseOverlayListener = dmPage.indexOf('db.ref("campaña/base_datos_items").on(');
  assert.ok(filterInit >= 0, "DM item filters must initialize");
  assert.ok(localBootstrap >= 0, "unified canonical content must bootstrap locally");
  assert.ok(filterInit < localBootstrap, "DM item filters must initialize before local content bootstrap");
  assert.ok(firebaseOverlayListener >= 0, "Firebase custom item overlay listener should still exist");
  assert.ok(localBootstrap < firebaseOverlayListener, "unified canonical content must render before waiting on Firebase");
  assert.match(dmPage, /dm-content-registry-counts/);
  assert.doesNotMatch(dmPage, /dm-item-creator\.html/);
  assert.doesNotMatch(dmPage, /campaña\/forja\/recetas/);
  assert.doesNotMatch(dmPage, /toggle-mesa-crafteo/);
  assert.doesNotMatch(dmPage, /lista-recetas-globales/);
  assert.equal(
    fs.existsSync(path.join(__dirname, "..", "dm-item-creator.html")),
    false,
    "legacy standalone item creator should be removed after unifying DM content"
  );

  const playerPage = fs.readFileSync(path.join(__dirname, "..", "hoja_personaje.html"), "utf8");
  const playerRuntime = fs.readFileSync(path.join(__dirname, "..", "hoja_personaje.js"), "utf8");
  assert.match(playerPage, /js\/item-content-registry\.js/);
  assert.match(playerPage, /js\/item-catalog-tools\.js/);
  assert.match(playerPage, /id="forja-recipe-select"/);
  assert.match(playerPage, /id="forja-station-select"/);
  assert.match(playerPage, /js\/item-processing-engine\.js/);
  assert.match(playerPage, /js\/item-cooking-equipment-engine\.js/);
  assert.match(playerPage, /js\/item-chemistry-recipe-catalog\.js/);
  assert.match(playerPage, /js\/item-medicine-recipe-catalog\.js/);
  assert.match(playerPage, /js\/item-processing-recipe-data\.js/);
  assert.match(playerPage, /js\/item-throwable-recipe-catalog\.js/);
  assert.match(playerRuntime, /LuminousItemContentRegistry/);
  assert.match(playerRuntime, /findMatchingRecipes\(window, items/);
  assert.match(playerRuntime, /enforceTools:\s*true/);
  assert.match(playerRuntime, /enforceEquipment:\s*true/);
  assert.match(playerRuntime, /forja-station-select/);
  assert.match(playerRuntime, /Selecciona explícitamente cuál quieres sintetizar/);
  assert.match(playerRuntime, /createRecipeOutput\(attempt\.receta\)/);
  assert.doesNotMatch(playerRuntime, /campaña\/forja\/recetas/);
  assert.doesNotMatch(playerRuntime, /campaña\/items_globales/);

  console.log("dm-item-catalog-core.spec: ok");
  console.log("dm item page wiring: ok");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
