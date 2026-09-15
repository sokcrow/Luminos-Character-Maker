const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

(async () => {
  delete globalThis.LuminousItemQualityEngine;
  delete globalThis.LuminousToolCatalog;

  globalThis.LuminousItemQualityEngine = Object.freeze({
    applyValue(baseValue, quality) {
      const multipliers = { ruined: 0.25, poor: 0.5, standard: 1, fine: 1.5, exceptional: 2 };
      return Math.round(Number(baseValue || 0) * (multipliers[String(quality || 'standard').toLowerCase()] || 1));
    },
  });

  await import(pathToFileURL(path.resolve(__dirname, '../js/item-catalog-tools.js')).href);
  const catalog = globalThis.LuminousToolCatalog;

  assert.ok(catalog);
  assert.equal(catalog.VERSION, 1);
  assert.equal(catalog.FAMILY, 'tools');
  assert.equal(catalog.IMPROVISED_THRESHOLD_PENALTY, 3);
  assert.equal(catalog.TOOL_BASE_POWER_STATUS, 'deferred_tuning');
  assert.equal(catalog.RECIPE_COMPONENT_QUANTITIES_STATUS, 'deferred_until_component_catalog');
  assert.equal(catalog.ITEMS.length, 32);
  assert.equal(new Set(catalog.ITEMS.map((entry) => entry.id)).size, 32);

  const iconCounts = Object.fromEntries(
    ['tool', 'repair_kit', 'harvest_kit', 'cooking_tools', 'smithing_tools', 'fabrication_tools',
     'textile_tools', 'medical_tools', 'technical_tools', 'lapidary_tools', 'chemical_tools']
      .map((icon) => [icon, catalog.list({ iconFamily: icon }).length])
  );
  assert.deepEqual(iconCounts, {
    tool: 6,
    repair_kit: 1,
    harvest_kit: 2,
    cooking_tools: 2,
    smithing_tools: 1,
    fabrication_tools: 5,
    textile_tools: 4,
    medical_tools: 2,
    technical_tools: 4,
    lapidary_tools: 2,
    chemical_tools: 3,
  });

  assert.equal(catalog.get('calligraphers_supplies').standardValueAhn, 8000);
  assert.equal(catalog.get('harvesting_tools').standardValueAhn, 25000);
  assert.equal(catalog.get('smiths_tools').standardValueAhn, 35000);
  assert.equal(catalog.get('surgical_tools').standardValueAhn, 60000);
  assert.equal(catalog.get('diagnostic_tools').standardValueAhn, 65000);
  assert.equal(catalog.get('repair_kit').standardValueAhn, 30000);
  assert.equal(catalog.unitValueForQuality('smiths_tools', 'fine'), 52500);
  assert.equal(catalog.unitValueForQuality('smiths_tools', 'exceptional'), 70000);

  for (const item of catalog.ITEMS) {
    assert.equal(item.itemType, 'tool');
    assert.equal(item.reusable, true);
    assert.equal(item.consumedOnUse, false);
    assert.equal(item.baseToolPower, null);
    assert.equal(item.baseToolPowerStatus, 'deferred_tuning');
    assert.ok(item.recipe);
    assert.equal(item.recipe.outputItemId, item.id);
    assert.equal(item.recipe.outputQuantity, 1);
    assert.equal(item.recipe.requiredToolConsumed, false);
    assert.equal(item.recipe.improvisationAllowed, true);
    assert.equal(item.recipe.improvisedThresholdDelta, 3);
    assert.equal(item.recipe.outputQuality, 'craft_check');
    assert.equal(item.recipe.componentQuantitiesStatus, 'deferred_until_component_catalog');
    assert.ok(item.recipe.inputs.length >= 2);
    for (const input of item.recipe.inputs) {
      assert.equal(input.kind, 'component_requirement');
      assert.equal(input.quantity, null);
      assert.equal(input.quantityStatus, 'deferred_until_component_catalog');
      assert.ok(input.tags.length >= 1);
    }
  }

  assert.equal(catalog.getRecipe('harvesting_tools').requiredToolType, 'smithing_tools');
  assert.equal(catalog.getRecipe('smiths_tools').requiredToolType, 'smithing_tools');
  assert.equal(catalog.getRecipe('poisoners_kit').requiredToolType, 'chemical_tools');

  const normal = catalog.resolveToolCheck({ baseThreshold: 18, skillPower: 4, toolBasePower: 2, hasToolProficiency: true, proficiencyPower: 3, hasRequiredTool: true });
  assert.equal(normal.allowed, true);
  assert.equal(normal.improvised, false);
  assert.equal(normal.threshold, 18);
  assert.equal(normal.totalPower, 9);

  const improvised = catalog.resolveToolCheck({ baseThreshold: 18, skillPower: 4, toolBasePower: 2, hasToolProficiency: true, proficiencyPower: 3, hasRequiredTool: false, canImprovise: true });
  assert.equal(improvised.allowed, true);
  assert.equal(improvised.improvised, true);
  assert.equal(improvised.threshold, 21);
  assert.equal(improvised.thresholdDelta, 3);
  assert.equal(improvised.toolBasePower, 0);
  assert.equal(improvised.totalPower, 7);

  const noProficiency = catalog.resolveToolCheck({ baseThreshold: 18, skillPower: 4, toolBasePower: 2, hasToolProficiency: false, proficiencyPower: 99, hasRequiredTool: true });
  assert.equal(noProficiency.proficiencyPower, 0);
  assert.equal(noProficiency.totalPower, 6);

  const blocked = catalog.resolveToolCheck({ baseThreshold: 18, skillPower: 4, hasRequiredTool: false, canImprovise: false });
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.totalPower, null);

  console.log('Tool catalog smoke: OK (32 reusable tools + recipes + proficiency/improvisation contract)');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
