const assert=require("node:assert/strict");
const path=require("node:path");
const {pathToFileURL}=require("node:url");

(async()=>{
  const load=async(file)=>import(pathToFileURL(path.resolve(__dirname,"../js",file)).href);
  for(const key of [
    "LuminousItemIconRegistry","LuminousChemicalRawCatalog","LuminousChemicalProcessedCatalog",
    "LuminousChemistryRecipeCatalog","LuminousMedicinalProcessedCatalog","LuminousThrowableComponentCatalog","LuminousThrowableRecipeCatalog"
  ]) delete globalThis[key];

  await load("item-icon-registry.js");
  await load("item-catalog-chemical-raw.js");
  await load("item-catalog-chemical-processed.js");
  await load("item-chemistry-recipe-catalog.js");
  await load("item-catalog-medicinal-processed.js");
  await load("item-catalog-throwable-components.js");
  await load("item-throwable-recipe-catalog.js");

  const icons=globalThis.LuminousItemIconRegistry;
  const raw=globalThis.LuminousChemicalRawCatalog;
  const processed=globalThis.LuminousChemicalProcessedCatalog;
  const chemistry=globalThis.LuminousChemistryRecipeCatalog;
  const medicinalProcessed=globalThis.LuminousMedicinalProcessedCatalog;
  const components=globalThis.LuminousThrowableComponentCatalog;
  const recipes=globalThis.LuminousThrowableRecipeCatalog;

  assert.equal(icons.VERSION,21);
  assert.equal(raw.ITEMS.length,33);
  assert.equal(processed.ITEMS.length,13);
  assert.equal(components.ITEMS.length,4);
  assert.equal(Object.keys(recipes.RECIPES).length,10);

  assert.equal(raw.validateCatalog().valid,true);
  assert.equal(processed.validateCatalog().valid,true);
  assert.equal(components.validateCatalog().valid,true);
  assert.equal(recipes.validateCatalog().valid,true);

  assert.equal(raw.get("cryogenic_reagent").iconFamily,"cryogenic_reagent");
  assert.equal(processed.get("cryogenic_solution").iconFamily,"cryogenic_solution");
  assert.equal(processed.get("cryogenic_solution").tags.includes("cold_payload"),true);
  assert.equal(processed.get("reactive_compound").tags.includes("combustible_source"),true);

  assert.equal(components.get("grenade_shell").baseThreshold,22);
  assert.equal(components.get("fragmentation_filler").baseThreshold,18);
  assert.equal(components.get("concussive_charge").requiredToolType,"chemical_tools");
  assert.equal(components.get("shock_charge").requiredToolType,"technical_tools");
  assert.equal(components.get("shock_charge").consumerHooks.includes("electronics"),true);
  assert.equal(components.get("shock_charge").consumerHooks.includes("augments"),true);

  for(const id of [
    "fragmentation_throwable","incendiary_throwable","cryogenic_throwable","shock_throwable",
    "concussive_throwable","smoke_throwable","flash_throwable","marking_throwable","corrosive_throwable","toxic_throwable"
  ]){
    const entry=recipes.get(id);
    assert.ok(entry,id);
    assert.equal(entry.family,"throwables");
    assert.equal(entry.itemType,"throwable");
    assert.equal(entry.consumedOnUse,true);
    assert.equal(entry.runtimeEffectImplemented,false);
    assert.equal(entry.combatContractStatus,"deferred");
    assert.equal(icons.has(entry.iconFamily),true);
  }

  assert.equal(recipes.get("fragmentation_throwable").inputRequirements[0].anyIds[0],"grenade_shell");
  assert.equal(recipes.get("cryogenic_throwable").inputRequirements[1].anyIds[0],"cryogenic_solution");
  assert.equal(recipes.get("shock_throwable").inputRequirements[1].anyIds[0],"shock_charge");
  assert.equal(recipes.get("marking_throwable").inputRequirements[1].anyIds[0],"pigment_compound");
  assert.equal(recipes.get("corrosive_throwable").inputRequirements[0].anyIds[0],"corrosive_canister");
  assert.equal(recipes.get("toxic_throwable").inputRequirements[1].anyIds[0],"toxin_extract");
  assert.ok(medicinalProcessed.get("toxin_extract"));

  assert.equal(recipes.EXISTING_PAYLOAD_ITEMS.reactive,"reactive_canister");
  assert.equal(recipes.EXISTING_PAYLOAD_ITEMS.corrosive,"corrosive_canister");
  assert.equal(recipes.EXISTING_PAYLOAD_ITEMS.toxic,"toxic_aerosol");
  assert.equal(recipes.EXISTING_PAYLOAD_ITEMS.containment,"containment_foam");
  assert.ok(chemistry.get("chemical_canister"));
  assert.ok(chemistry.get("reactive_canister"));
  assert.ok(chemistry.get("corrosive_canister"));

  console.log("Throwables V1 recipe smoke: OK (4 components + 10 finished recipes; combat runtime deferred)");
})().catch((error)=>{console.error(error);process.exitCode=1;});
