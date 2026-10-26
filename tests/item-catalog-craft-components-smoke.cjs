const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

(async () => {
  delete globalThis.LuminousItemQualityEngine;
  delete globalThis.LuminousCraftComponentCatalog;

  globalThis.LuminousItemQualityEngine = Object.freeze({
    applyValue(baseValue, quality) {
      const multipliers = { ruined: 0.25, poor: 0.5, standard: 1, fine: 1.5, exceptional: 2 };
      return Math.round(Number(baseValue || 0) * (multipliers[String(quality || 'standard').toLowerCase()] || 1));
    },
  });

  await import(pathToFileURL(path.resolve(__dirname, '../js/item-catalog-craft-components.js')).href);
  const catalog = globalThis.LuminousCraftComponentCatalog;

  assert.ok(catalog);
  assert.equal(catalog.VERSION, 1);
  assert.equal(catalog.FAMILY, 'craft_components');
  assert.equal(catalog.PRICING_MODEL, 'consumed_input_value_x_process_multiplier');
  assert.equal(catalog.RETAIL_MARKUP_INCLUDED, false);
  assert.equal(catalog.IMPROVISED_THRESHOLD_PENALTY, 3);
  assert.equal(catalog.STATION_REQUIREMENTS_STATUS, 'deferred');
  assert.equal(catalog.ITEMS.length, 28);
  assert.equal(new Set(catalog.ITEMS.map((entry) => entry.id)).size, 28);

  const expectedNewIcons = ['structural_stock', 'fasteners_hardware', 'wire_cable', 'glass_component', 'container'];
  for (const iconFamily of expectedNewIcons) assert.ok(catalog.list({ iconFamily }).length >= 1);

  assert.equal(catalog.get('structural_stock').craftBaseMultiplier, 1.20);
  assert.equal(catalog.get('fasteners').id, 'fasteners_hardware');
  assert.equal(catalog.get('wire').id, 'wire_cable');
  assert.equal(catalog.get('mechanical_parts').craftBaseMultiplier, 1.50);
  assert.equal(catalog.get('precision_component').craftBaseMultiplier, 1.65);
  assert.equal(catalog.get('circuitry').craftBaseMultiplier, 1.80);
  assert.equal(catalog.get('augment_grade_component').craftBaseMultiplier, 2.00);
  assert.equal(catalog.get('corp_wing_precision_component').craftBaseMultiplier, 2.20);
  assert.equal(catalog.get('exotic_industrial_component').craftBaseMultiplier, 2.50);

  assert.equal(catalog.craftBaseValue('structural_stock', [40000]), 48000);
  assert.equal(catalog.craftBaseValue('mechanical_parts', [10000]), 15000);
  assert.equal(catalog.craftBaseValue('precision_component', [{ unitValueAhn: 10000, quantity: 2 }]), 33000);
  assert.equal(catalog.craftBaseValue('circuitry', [{ valueAhn: 30000 }]), 54000);
  assert.equal(catalog.craftedValueForQuality('circuitry', [30000], 'fine'), 81000);

  assert.equal(catalog.satisfiesRequirement('processed_textile', 'textile'), true);
  assert.equal(catalog.satisfiesRequirement('processed_leather', 'hide_or_leather'), true);
  assert.equal(catalog.satisfiesRequirement('container', 'container'), true);
  assert.equal(catalog.satisfiesRequirement('glass_component', 'glass_or_optical_material'), true);
  assert.equal(catalog.satisfiesRequirement('optical_component', 'precision_component'), true);
  assert.equal(catalog.satisfiesRequirement('chemical_resistant_container', 'chemical_resistant_container'), true);
  assert.ok(catalog.resolveRequirement('generic_component').length >= 5);
  assert.ok(catalog.resolveRequirement('precision_component').some((entry) => entry.id === 'precision_component'));

  const genericRecipe = catalog.getRecipe('fasteners_hardware');
  assert.equal(genericRecipe.requiredToolType, 'smithing_tools');
  assert.equal(genericRecipe.semanticCheck, 'metalworking');
  assert.equal(genericRecipe.baseThreshold, 18);
  assert.equal(genericRecipe.craftBaseMultiplier, 1.30);
  assert.equal(genericRecipe.requiredToolConsumed, false);
  assert.equal(genericRecipe.improvisationAllowed, true);
  assert.equal(genericRecipe.improvisedThresholdDelta, 3);
  assert.equal(genericRecipe.retailMarkupIncluded, false);
  assert.equal(genericRecipe.outputQuality, 'craft_check');
  assert.equal(genericRecipe.workUnits, null);

  const workshopRecipe = catalog.getRecipe('precision_component');
  assert.equal(workshopRecipe.requiredToolType, 'technical_tools');
  assert.equal(workshopRecipe.baseThreshold, 22);
  assert.equal(workshopRecipe.processTier, 'workshop');

  const corpRecipe = catalog.getRecipe('augment_grade_component');
  assert.equal(corpRecipe.baseThreshold, 28);
  assert.equal(corpRecipe.processTier, 'corp_wing');

  for (const item of catalog.ITEMS) {
    assert.equal(item.itemType, 'component');
    assert.equal(item.processed, true);
    assert.equal(item.rawCraftingReagent, false);
    assert.equal(item.reusableAsRecipeInput, true);
    assert.equal(item.retailMarkupIncluded, false);
    assert.ok(item.craftBaseMultiplier >= 1.20);
    assert.ok(['generic', 'workshop', 'corp_wing'].includes(item.processTier));
    assert.ok([18, 22, 28].includes(item.baseThreshold));
    assert.ok(item.requiredToolType);
    assert.ok(item.semanticCheck);
    assert.ok(item.requirementTags.length >= 1);
    assert.ok(item.inputRequirements.length >= 1);
  }

  console.log('Craft component catalog smoke: OK (28 processed components + dynamic craft-base pricing)');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
