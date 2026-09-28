const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

(async () => {
  delete globalThis.LuminousItemEconomyStandard;
  await import(pathToFileURL(path.resolve(__dirname, "../js/item-economy-standard.js")).href);

  const economy = globalThis.LuminousItemEconomyStandard;
  assert.ok(economy);
  assert.equal(economy.VERSION, 1);
  assert.equal(economy.CURRENCY, "AHN");
  assert.equal(economy.REFERENCE_MONTHLY_WAGE_AHN, 1000000);

  assert.equal(economy.SALARY_BANDS.length, 12);
  assert.deepEqual(
    economy.SALARY_BANDS.map((entry) => [entry.id, entry.minAhn, entry.maxAhn]),
    [
      ["backstreets_extreme_poverty",100000,300000],
      ["backstreets_very_poor",300000,600000],
      ["backstreets_low",600000,1000000],
      ["backstreets_stable_low",1000000,1500000],
      ["backstreets_middle",1500000,2000000],
      ["backstreets_high",2000000,2800000],
      ["nest_low",2500000,3200000],
      ["nest_middle",3200000,4000000],
      ["nest_upper_middle",4000000,6000000],
      ["nest_high",6000000,10000000],
      ["nest_very_rich",10000000,25000000],
      ["city_elite",25000000,null],
    ]
  );

  assert.equal(economy.QUICK_REFERENCES_AHN.poor_backstreets, 500000);
  assert.equal(economy.QUICK_REFERENCES_AHN.stable_backstreets_worker, 1000000);
  assert.equal(economy.QUICK_REFERENCES_AHN.modest_nest_citizen, 3000000);
  assert.equal(economy.QUICK_REFERENCES_AHN.elite, 25000000);

  assert.deepEqual(
    Object.fromEntries(Object.entries(economy.FOOD_PRICE_BANDS).map(([key, band]) => [key, [band.minAhn, band.maxAhn]])),
    {
      survival:[1000,5000],
      cheap_meal:[5000,12000],
      normal_meal:[12000,30000],
      good_restaurant:[30000,100000],
      luxury_meal:[100000,800000],
    }
  );

  assert.equal(economy.dishLaborValueAhn("snack"), 1000);
  assert.equal(economy.dishLaborValueAhn("simple"), 2000);
  assert.equal(economy.dishLaborValueAhn("standard"), 4000);
  assert.equal(economy.dishLaborValueAhn("complex"), 7000);
  assert.equal(economy.dishLaborValueAhn("elaborate"), 10000);
  assert.equal(economy.dishLaborValueAhn("fine"), 15000);

  assert.equal(economy.dishCreatedProductionValue(18500, 1.15, "standard"), 25280);
  assert.equal(economy.realizedFoodValue(25280, 1), 17700);
  assert.equal(economy.realizedFoodValue(25280, 3), 25280);
  assert.equal(economy.realizedFoodValue(25280, 4), 30340);
  assert.equal(economy.realizedFoodValue(25280, 5), 37920);
  assert.equal(economy.venuePrice(25280, "takeaway_fast_food"), 34130);
  assert.equal(economy.venuePrice(25280, "restaurant_standard"), 44240);
  assert.equal(economy.venuePrice(25280, "restaurant_good"), 50560);

  const affordability = economy.monthlyAffordability(10000, 1000000);
  assert.equal(affordability.monthlyShare, 0.01);
  assert.equal(affordability.purchasesPerMonth, 100);

  assert.equal(economy.foodPriceClass(3000), "survival");
  assert.equal(economy.foodPriceClass(8000), "cheap_meal");
  assert.equal(economy.foodPriceClass(20000), "normal_meal");
  assert.equal(economy.foodPriceClass(60000), "good_restaurant");
  assert.equal(economy.foodPriceClass(300000), "luxury_meal");

  console.log("Item Economy Standard smoke: OK (salary bands, affordability, labor, quality and venue pricing)");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
