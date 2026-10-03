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
  await import("../js/item-quality-engine.js");
  await import("../js/item-chemistry-recipe-catalog.js");
  await import("../js/item-chemistry-crafting-engine.js");
  await import("../js/item-cooking-recipe-catalog.js");
  await import("../js/item-cooking-engine.js");
  await import("../js/item-cooking-recipe-resolver.js");
  await import("../js/item-cooking-equipment-engine.js");
  await import("../js/item-cooking-runtime.js");
  await import("../js/item-medicine-recipe-catalog.js");
  await import("../js/item-medicine-crafting-engine.js");
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
  assert.equal(
    Object.values(catalog).some((item) => /RecipeCatalog$/i.test(item.__catalogSource || "")),
    false,
    "recipe catalogs must never be published as grantable items"
  );
  assert.equal(
    Object.values(catalog).some((item) => item.runtimeEffectImplemented === false && item.combatContractStatus === "deferred"),
    false,
    "deferred recipe definitions must not leak into the Director item catalog"
  );

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
    { definitionId: "cleaning_compound", quantity: 1, __selectedUnits: 1, productionValueAhn: 120 },
    { definitionId: "chemical_bottle", tags: ["container"], quantity: 1, __selectedUnits: 1, productionValueAhn: 80 }
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
    { definitionId: "dough", tags: ["dough"], processedForm: "dough", quantity: 1, __selectedUnits: 1 }
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
    availableStationIds: ["oven"]
  });
  assert.equal(whiteBreadWithEquipment.valid, true, "baking should resolve with canonical tool and authorized station");
  assert.equal(whiteBreadWithEquipment.recipeTh, 14, "White Bread should use the canonical cooking recipe TH");
  assert.equal(
    contentRegistry.recipeDifficulty(whiteBreadRecipe, whiteBreadWithEquipment),
    whiteBreadWithEquipment.effectiveTh,
    "synthesis difficulty must use the canonical effective cooking TH"
  );

  const cookedBreadOutput = contentRegistry.createRecipeOutput(whiteBreadRecipe, {
    resolution: whiteBreadWithEquipment,
    checkResult: 20,
    createdAt: 123456789
  });
  assert.equal(cookedBreadOutput.category, "food");
  assert.equal(cookedBreadOutput.family, "food");
  assert.equal(cookedBreadOutput.itemType, "consumable");
  assert.equal(
    cookedBreadOutput.hungerSlotsRestored,
    Math.max(0, Math.trunc(Number(whiteBreadRecipe.hungerRestore ?? 1) || 0)),
    "crafted cooking outputs must use the hunger field consumed by FoodRestRuntime"
  );
  assert.equal(
    cookedBreadOutput.hydrationSlotsRestored,
    Math.max(0, Math.trunc(Number(whiteBreadRecipe.hydrationRestore ?? 0) || 0)),
    "crafted cooking outputs must use the hydration field consumed by FoodRestRuntime"
  );
  assert.ok(Number.isFinite(cookedBreadOutput.stars), "canonical cooking output must preserve stars");
  assert.ok(Number.isFinite(cookedBreadOutput.taste), "canonical cooking output must preserve taste");
  assert.ok(Object.prototype.hasOwnProperty.call(cookedBreadOutput, "spRestore"), "canonical cooking output must preserve SP restoration");
  assert.ok(Array.isArray(cookedBreadOutput.culinaryEffects), "canonical cooking output must preserve culinary effects");
  assert.ok(Array.isArray(cookedBreadOutput.provenance), "canonical cooking output must preserve provenance");
  assert.ok(Number.isFinite(cookedBreadOutput.cookingMargin), "canonical cooking output must preserve roll margin");

  const bakeProcessingRecipe = Object.values(unified.recipes)
    .find((recipe) => recipe.recipeKind === "processing" && recipe.id === "bake");
  assert.ok(bakeProcessingRecipe, "canonical bake processing recipe should exist");
  const bakeWithoutEquipment = contentRegistry.resolveRecipe(
    bakeProcessingRecipe,
    doughInputs,
    globalThis,
    {
      enforceEquipment: true,
      toolItems: [],
      unit: {},
      availableStationIds: []
    }
  );
  assert.equal(bakeWithoutEquipment.valid, false, "processing bake must be blocked without canonical equipment");
  assert.equal(bakeWithoutEquipment.reason, "missing_processing_equipment");
  assert.ok(bakeWithoutEquipment.missingToolIds.includes("cooks_utensils"));
  assert.ok(bakeWithoutEquipment.missingStationIds.includes("oven"));

  const bakeWithEquipment = contentRegistry.resolveRecipe(
    bakeProcessingRecipe,
    doughInputs,
    globalThis,
    {
      enforceEquipment: true,
      toolItems: [{ definitionId: "cooks_utensils", quantity: 1 }],
      unit: {},
      availableStationIds: ["oven"]
    }
  );
  assert.equal(bakeWithEquipment.valid, true, "processing bake should resolve with canonical tool and station");
  assert.equal(bakeWithEquipment.equipment.hasRequiredTool, true);
  assert.equal(bakeWithEquipment.equipment.hasRequiredStation, true);

  const noodlesRecipe = Object.values(unified.recipes)
    .find((recipe) => recipe.recipeKind === "processing" && recipe.id === "noodles");
  const noodlesResolution = contentRegistry.resolveRecipe(noodlesRecipe, doughInputs, globalThis);
  assert.equal(noodlesResolution.valid, true, "canonical noodles processing recipe should resolve");
  const noodlesOutput = contentRegistry.createRecipeOutput(noodlesRecipe, {
    resolution: noodlesResolution
  });
  assert.equal(noodlesOutput.family, "processed_food");
  assert.equal(noodlesOutput.processingTemplateId, "noodles");
  assert.ok(Array.isArray(noodlesOutput.processingTags), "processing output must preserve canonical processing tags");
  assert.ok(Array.isArray(noodlesOutput.provenance), "processing output must preserve provenance");
  assert.ok(noodlesOutput.stackPolicy, "processing output must preserve canonical stack policy");
  assert.ok(Object.prototype.hasOwnProperty.call(noodlesOutput, "unitProductionValueAhn"), "processing output must preserve economy metadata");

  const juiceRecipe = Object.values(unified.recipes)
    .find((recipe) => recipe.recipeKind === "processing" && recipe.id === "juice");
  assert.ok(juiceRecipe, "procedural juice processing recipe should exist");
  assert.equal(juiceRecipe.outputId == null, true, "juice should remain a procedural-output template without a fixed output id");
  const juiceInputs = [
    {
      id: "apple",
      definitionId: "apple",
      instanceId: "apple_stack_a",
      name: "Apple",
      tags: ["juice", "juicy", "refreshing", "fruit"],
      quantity: 1,
      __selectedUnits: 1,
      productionValueAhn: 12,
      quality: "fine",
      taste: 1,
      culinaryProperties: [{ target: "strength", sourceInstanceId: "apple_stack_a" }]
    },
    {
      id: "apple",
      definitionId: "apple",
      instanceId: "apple_stack_b",
      name: "Apple",
      tags: ["juice", "juicy", "refreshing", "fruit"],
      quantity: 1,
      __selectedUnits: 1,
      productionValueAhn: 12,
      quality: "fine",
      taste: 3,
      culinaryProperties: [{ target: "agility", sourceInstanceId: "apple_stack_b" }]
    }
  ];
  const juiceResolution = contentRegistry.resolveRecipe(juiceRecipe, juiceInputs, globalThis);
  assert.equal(juiceResolution.valid, true, "procedural processing templates must resolve from runtime input context");

  const strictJuiceResolution = contentRegistry.resolveRecipe(
    juiceRecipe,
    juiceInputs,
    globalThis,
    {
      enforceEquipment: true,
      toolItems: [{ definitionId: "cooks_utensils", quantity: 1 }],
      unit: {},
      availableStationIds: []
    }
  );
  assert.equal(strictJuiceResolution.valid, true, "juice should resolve with its canonical required tool");
  assert.equal(strictJuiceResolution.recipeTh, 10, "juice must carry the concrete processing recipe TH, not the method base TH");
  assert.equal(
    contentRegistry.recipeDifficulty(juiceRecipe, strictJuiceResolution),
    strictJuiceResolution.effectiveTh,
    "player synthesis must check processing against the canonical effective TH"
  );
  assert.notEqual(
    contentRegistry.recipeDifficulty(juiceRecipe, strictJuiceResolution),
    globalThis.LuminousItemProcessingEngine.METHODS.juice.baseTh,
    "two-input juice must not fall back to the method base TH"
  );
  const juiceOutput = contentRegistry.createRecipeOutput(juiceRecipe, {
    resolution: juiceResolution
  });
  assert.ok(juiceOutput, "procedural processing must create a canonical runtime output");
  assert.equal(juiceOutput.processingTemplateId, "juice");
  assert.equal(juiceOutput.processedForm, "juice");
  assert.ok(Array.isArray(juiceOutput.provenance), "procedural processing output must preserve provenance");
  assert.deepEqual(
    [...juiceOutput.sourceInstanceIds].sort(),
    ["apple_stack_a", "apple_stack_b"],
    "processing output must preserve source instance provenance from both stacks"
  );
  assert.deepEqual(
    juiceOutput.culinaryProperties.map((property) => property.target).sort(),
    ["agility", "strength"],
    "processing output must preserve culinary properties from both stacks"
  );
  assert.equal(juiceOutput.provenance.length, 2, "metadata-distinct stacks must not be collapsed into one provenance row");

  const simpleMixRecipe = Object.values(unified.recipes)
    .find((recipe) => recipe.recipeKind === "processing" && recipe.id === "simple_mix");
  assert.ok(simpleMixRecipe, "simple_mix processing recipe should exist");
  const duplicateStacksAreNotDistinct = contentRegistry.resolveRecipe(simpleMixRecipe, juiceInputs, globalThis);
  assert.equal(
    duplicateStacksAreNotDistinct.valid,
    false,
    "two metadata-distinct stacks of the same item must not satisfy all_distinct processing requirements"
  );

  const deferredThrowable = Object.values(unified.recipes)
    .find((recipe) => recipe.recipeKind === "throwable" && recipe.combatContractStatus === "deferred");
  assert.ok(deferredThrowable, "deferred throwable should remain visible in the unified DM registry");
  assert.equal(
    contentRegistry.recipeRuntimeReady(deferredThrowable),
    false,
    "deferred throwables must be excluded from player synthesis matching"
  );

  const craftedOutput = contentRegistry.createRecipeOutput(chemistryMatch.recipe, {
    resolution: chemistryMatch.resolution,
    checkResult: 26
  });
  assert.equal(craftedOutput.definitionId, "industrial_cleaner");
  assert.equal(craftedOutput.recipeId, "industrial_cleaner");
  assert.equal(craftedOutput.crafted, true);
  assert.equal(craftedOutput.quantity, 1);
  assert.equal(craftedOutput.quality, "exceptional");
  assert.equal(craftedOutput.qualityTier, 5, "exceptional canonical quality must map to runtime tier 5");
  assert.equal(contentRegistry.qualityTierFor("ruined"), 1);
  assert.equal(contentRegistry.qualityTierFor("poor"), 2);
  assert.equal(contentRegistry.qualityTierFor("standard"), 3);
  assert.equal(contentRegistry.qualityTierFor("fine"), 4);
  assert.equal(contentRegistry.qualityTierFor("exceptional"), 5);
  assert.equal(craftedOutput.craft.checkTotal, 26);
  assert.equal(craftedOutput.craft.margin, 8);
  assert.ok(craftedOutput.productionValueAhn > 0, "chemistry output must preserve canonical production value");
  assert.ok(Array.isArray(craftedOutput.consumerHooks), "chemistry output must preserve consumer hooks");
  assert.ok(Object.prototype.hasOwnProperty.call(craftedOutput, "integrationStatus"), "chemistry output must preserve integration status");
  assert.ok(Array.isArray(craftedOutput.craft.sourceInputs), "chemistry output must preserve canonical consumed-input provenance");

  const medicineRecipe = Object.values(unified.recipes)
    .find((recipe) => recipe.recipeKind === "medicine" && recipe.id === "medicine_tablet");
  const medicineInputs = [
    { definitionId: "pharmaceutical_powder", quantity: 1, __selectedUnits: 1, productionValueAhn: 90 },
    { definitionId: "tablet_binder", quantity: 1, __selectedUnits: 1, productionValueAhn: 30 }
  ];
  const medicineResolution = contentRegistry.resolveRecipe(medicineRecipe, medicineInputs, globalThis);
  assert.equal(medicineResolution.valid, true, "canonical medicine recipe should resolve");
  const medicineOutput = contentRegistry.createRecipeOutput(medicineRecipe, {
    resolution: medicineResolution,
    checkResult: 22
  });
  assert.equal(medicineOutput.definitionId, "medicine_tablet");
  assert.equal(medicineOutput.quality, "fine");
  assert.equal(medicineOutput.qualityTier, 4, "fine canonical quality must map to runtime tier 4");
  assert.equal(medicineOutput.craft.checkTotal, 22);
  assert.equal(medicineOutput.craft.margin, 4);
  assert.ok(medicineOutput.productionValueAhn > 0, "medicine output must preserve canonical production value");
  assert.ok(Array.isArray(medicineOutput.craft.sourceInputs), "medicine output must preserve canonical consumed-input provenance");

  assert.equal(
    contentRegistry.isSynthesisSlotUnlockTool({ definitionId: "carpenters_tools" }, globalThis),
    true,
    "canonical fabrication tools should unlock extra synthesis slots"
  );
  assert.equal(
    contentRegistry.isSynthesisSlotUnlockTool({ definitionId: "alchemists_supplies" }, globalThis),
    true,
    "canonical chemical tools should unlock extra synthesis slots"
  );
  assert.equal(
    contentRegistry.isSynthesisSlotUnlockTool({ definitionId: "harvesting_tools" }, globalThis),
    false,
    "harvesting-only tools should not unlock general synthesis slots"
  );
  assert.equal(
    contentRegistry.isSynthesisSlotUnlockTool({ definitionId: "calligraphers_supplies" }, globalThis),
    false,
    "generic utility tools should not unlock extra synthesis slots"
  );

  const exceptionalInstance = globalThis.LuminousItemInventoryRuntime.createItemInstance(
    craftedOutput,
    { quantity: 1, qualityTier: craftedOutput.qualityTier }
  );
  assert.equal(
    globalThis.LuminousItemInventoryRuntime.getQualityTier(exceptionalInstance),
    5,
    "inventory runtime must preserve exceptional crafted quality as tier 5"
  );

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
  assert.match(dmPage, /js\/item-cooking-equipment-engine\.js/);
  assert.match(dmPage, /id="dm-cooking-station-controls"/);
  assert.match(dmPage, /campaña\/estado_mundo\/cooking_stations/);
  assert.match(dmPage, /data\.cookingStationId|dataset\.cookingStationId/);
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
  assert.match(playerPage, /id="forja-station-context"/);
  assert.doesNotMatch(playerPage, /id="forja-station-select"/);
  assert.match(playerPage, /js\/item-processing-engine\.js/);
  assert.match(playerPage, /js\/item-cooking-equipment-engine\.js/);
  assert.match(playerPage, /js\/item-quality-engine\.js/);
  assert.match(playerPage, /js\/item-chemistry-recipe-catalog\.js/);
  assert.match(playerPage, /js\/item-chemistry-crafting-engine\.js/);
  assert.match(playerPage, /js\/item-medicine-recipe-catalog\.js/);
  assert.match(playerPage, /js\/item-medicine-crafting-engine\.js/);
  assert.match(playerPage, /js\/item-processing-recipe-data\.js/);
  assert.match(playerPage, /js\/item-throwable-recipe-catalog\.js/);
  assert.match(playerRuntime, /LuminousItemContentRegistry/);
  assert.match(playerRuntime, /tieneHerramientaCanonicaSintesis/);
  assert.match(playerRuntime, /isSynthesisSlotUnlockTool\(item, window\)/);
  assert.doesNotMatch(playerRuntime, /includes\("toolkit"\)/);
  assert.match(playerRuntime, /findMatchingRecipes\(window, items/);
  assert.match(playerRuntime, /enforceTools:\s*true/);
  assert.match(playerRuntime, /enforceEquipment:\s*true/);
  assert.match(playerRuntime, /authoritativeCookingStationIds/);
  assert.match(playerRuntime, /forjaCookingStationsGlobal/);
  assert.match(playerRuntime, /campaña\/estado_mundo\/cooking_stations/);
  assert.doesNotMatch(playerRuntime, /unit\.currentCookingStationId/);
  assert.doesNotMatch(playerRuntime, /unit\.cookingStationId/);
  assert.doesNotMatch(playerRuntime, /unit\.availableCookingStationIds/);
  assert.doesNotMatch(playerRuntime, /unit\.available_cooking_station_ids/);
  assert.doesNotMatch(playerRuntime, /stationSelect\.value/);
  assert.match(playerRuntime, /recipeDifficulty\(recipe, match\?\.resolution\)/);
  assert.match(playerRuntime, /Selecciona explícitamente cuál quieres sintetizar/);
  assert.match(playerRuntime, /createRecipeOutput\(attempt\.receta,\s*\{/);
  assert.match(playerRuntime, /resolution:\s*attempt\.resolution/);
  assert.match(playerRuntime, /checkResult:\s*tirada/);
  assert.match(playerRuntime, /qualityTier:\s*canonicalOutput\.qualityTier/);
  assert.match(playerRuntime, /ejecutarTransaccionForja\(attempt,\s*tirada\s*>=\s*attempt\.dc,\s*tirada\)/);
  assert.match(playerRuntime, /function ejecutarTransaccionForja\(attempt,\s*exito,\s*tirada\)/);
  assert.doesNotMatch(playerRuntime, /campaña\/forja\/recetas/);
  assert.doesNotMatch(playerRuntime, /campaña\/items_globales/);

  console.log("dm-item-catalog-core.spec: ok");
  console.log("dm item page wiring: ok");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
