const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

(async () => {
  delete globalThis.LuminousCookingRecipeCatalog;
  delete globalThis.LuminousCookingV2Engine;

  await import(pathToFileURL(path.resolve(__dirname, "../js/item-cooking-recipe-catalog.js")).href);
  await import(pathToFileURL(path.resolve(__dirname, "../js/item-cooking-v2-engine.js")).href);

  const catalog = globalThis.LuminousCookingRecipeCatalog;
  const v2 = globalThis.LuminousCookingV2Engine;
  assert.ok(catalog);
  assert.ok(v2);
  assert.equal(v2.VERSION, 2);
  assert.equal(v2.SP_MIN, -45);
  assert.equal(v2.SP_MAX, 45);

  const compiled = v2.compiledFunctions();
  assert.equal(compiled.rows.length, catalog.RECIPES.length);

  const skillCounts = v2.SKILL_TARGETS.map((id) => compiled.coverage.skills[id] || 0);
  const saveCounts = v2.SAVE_TARGETS.map((id) => compiled.coverage.saves[id] || 0);
  const focusCounts = Object.keys(v2.FOCUS).map((id) => compiled.coverage.focus[id] || 0);

  assert.equal(skillCounts.every((count) => count > 0), true, "every Skill needs food coverage");
  assert.equal(saveCounts.every((count) => count > 0), true, "every Save needs food coverage");
  assert.equal(focusCounts.every((count) => count > 0), true, "every Meal Focus needs recipes");
  assert.ok(Math.max(...skillCounts) - Math.min(...skillCounts) <= 5, "Skill coverage should stay balanced");
  assert.ok(Math.max(...saveCounts) - Math.min(...saveCounts) <= 5, "Save coverage should stay balanced");
  assert.ok(Math.max(...focusCounts) - Math.min(...focusCounts) <= 5, "Meal Focus coverage should stay balanced");

  assert.equal(v2.durationHoursForCook({}, {}, {}), 8);
  assert.equal(v2.durationHoursForCook({ proficiencyBonus:2 }, {}, {}), 12);
  assert.equal(v2.durationHoursForCook({ proficiencyBonus:6 }, {}, {}), 20);
  assert.equal(v2.durationHoursForCook({ proficiencyBonus:9 }, {}, {}), 20);

  for (const step of v2.MAX_HP_STEPS) {
    assert.equal(v2.MAX_HP_STEPS.includes(v2.nearestMaxHpStep(step)), true);
  }

  const burger = catalog.get("burger");
  assert.ok(burger);
  const burgerFn = v2.get(burger);
  assert.ok(burgerFn);
  assert.equal(burgerFn.adoption, "adapt");
  assert.ok(burgerFn.mealFocus);
  assert.equal(burgerFn.effects5.length, 3);
  assert.equal(new Set(burgerFn.effects5.map((effect) => effect.target)).size, 3);

  const oneStar = v2.resolvePreparedFunction(burger, 1, { proficiencyBonus:3 });
  const fiveStar = v2.resolvePreparedFunction(burger, 5, { proficiencyBonus:3 });
  assert.equal(oneStar.durationHours, 14);
  assert.equal(oneStar.effects.length, 0);
  assert.equal(fiveStar.effects.length, 3);
  assert.ok(v2.MAX_HP_STEPS.includes(oneStar.maxHpBonus));
  assert.ok(v2.MAX_HP_STEPS.includes(fiveStar.maxHpBonus));
  assert.ok(fiveStar.spRecovery >= oneStar.spRecovery);

  const legacyUnit = {};
  assert.equal(v2.knowsRecipe(legacyUnit, burger), true, "no knowledge store keeps legacy compatibility");
  const learningUnit = { cookingKnowledge:{} };
  assert.equal(v2.knowsRecipe(learningUnit, burger), false);
  assert.equal(v2.grantRecipeKnowledge(learningUnit, burger).granted, true);
  assert.equal(v2.knowsRecipe(learningUnit, burger), true);

  const party = [{ cookingKnowledge:{} }, learningUnit];
  const catering = v2.canCaterParty(burger, party);
  assert.equal(catering.allowed, true);
  assert.equal(catering.knowledgeableMemberIndex, 1);

  console.log("Cooking V2 function smoke: OK (balanced Skills/Saves, duration, knowledge, catering and fixed SP bounds)");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
