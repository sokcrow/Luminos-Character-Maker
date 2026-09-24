const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

(async () => {
  delete globalThis.LuminousRetailFoodCatalog;
  await import(pathToFileURL(path.resolve(__dirname, '../js/item-catalog-retail-food.js')).href);

  const retail = globalThis.LuminousRetailFoodCatalog;
  assert.ok(retail);
  assert.equal(retail.VERSION, 1);
  assert.equal(retail.CATALOG_ID, 'retail_food');
  assert.equal(retail.FAMILY, 'food');
  assert.equal(retail.list().length, 12);
  assert.equal(retail.PRICE_MULTIPLIER, 1.25);
  assert.equal(retail.EFFECT_MULTIPLIER, 0.50);
  assert.equal(retail.AVAILABILITY_MULTIPLIER, 2.00);

  const butter = retail.get('butter_cookie_retail_pack');
  assert.equal(butter.bakeryRecipeId, 'butter_cookie');
  assert.equal(butter.hasRecipe, false);
  assert.equal(butter.craftable, false);
  assert.equal(butter.retailPack, true);
  assert.equal(butter.retailKind, 'cookie_pack');
  assert.equal(butter.iconFamily, 'butter_cookie_retail_pack');
  assert.equal(butter.iconStatus, 'dedicated');
  assert.equal(butter.priceAhn, 9000);

  const shortbread = retail.get('shortbread_cookie_retail_pack');
  assert.equal(shortbread.iconFamily, 'food_snack');
  assert.equal(shortbread.iconStatus, 'family_fallback');
  assert.equal(shortbread.priceAhn, 8500);

  assert.equal(retail.list({ iconStatus:'dedicated' }).length, 11);
  assert.equal(retail.list({ iconStatus:'family_fallback' }).length, 1);

  const coffee = retail.createPack('coffee_cookie_retail_pack', { quantity:2 });
  assert.equal(coffee.unitValueAhn, 12000);
  assert.equal(coffee.totalValueAhn, 24000);
  assert.equal(coffee.quantity, 2);
  assert.equal(coffee.culinarySystem, 'retail_food_v1');

  console.log('Retail food catalog smoke: OK (12 retail cookie packs)');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
