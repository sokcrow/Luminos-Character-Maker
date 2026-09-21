const assert=require("node:assert/strict");
const path=require("node:path");
const {pathToFileURL}=require("node:url");

(async()=>{
  const load=async(file)=>import(pathToFileURL(path.resolve(__dirname,"../js",file)).href);
  for(const key of [
    "LuminousItemQualityEngine","LuminousChemicalRawCatalog","LuminousChemicalProcessedCatalog",
    "LuminousChemistryRecipeCatalog","LuminousChemistryCraftingEngine","LuminousCraftComponentCatalog",
    "LuminousVenomSecretionCatalog","LuminousArmorUpgradeCatalog"
  ]) delete globalThis[key];

  await load("item-quality-engine.js");
  await load("item-catalog-chemical-raw.js");
  await load("item-catalog-chemical-processed.js");
  await load("item-chemistry-recipe-catalog.js");
  await load("item-chemistry-crafting-engine.js");
  await load("item-catalog-craft-components.js");
  await load("item-catalog-venom-secretion.js");
  await load("item-catalog-armor-upgrades.js");

  const raw=globalThis.LuminousChemicalRawCatalog;
  const processed=globalThis.LuminousChemicalProcessedCatalog;
  const recipes=globalThis.LuminousChemistryRecipeCatalog;
  const engine=globalThis.LuminousChemistryCraftingEngine;
  const craft=globalThis.LuminousCraftComponentCatalog;
  const beast=globalThis.LuminousVenomSecretionCatalog;
  const armor=globalThis.LuminousArmorUpgradeCatalog;

  assert.equal(raw.VERSION,1);
  assert.equal(raw.ITEMS.length,33);
  assert.equal(raw.validateCatalog().valid,true);

  assert.equal(processed.ITEMS.length,13);
  assert.equal(processed.validateCatalog().valid,true);

  assert.equal(Object.keys(recipes.RECIPES).length,18);
  assert.equal(recipes.validateCatalog().valid,true);
  assert.equal(engine.validateEngine().valid,true);

  assert.equal(raw.list({iconFamily:"industrial_solvent"}).length,2);
  assert.equal(raw.get("conductive_paste_feedstock").tags.includes("conductive_material"),true);
  assert.equal(raw.get("dielectric_feedstock").tags.includes("insulator"),true);
  assert.equal(raw.get("cryogenic_reagent").iconFamily,"cryogenic_reagent");

  const polymer=engine.craftProcessed("polymer_compound",[
    {...raw.get("rigid_polymer_feedstock"),quantity:1},
    {...raw.get("general_process_catalyst"),quantity:1}
  ],{checkTotal:22});
  assert.equal(polymer.crafted,true);
  assert.equal(polymer.output.quality,"standard");
  assert.equal(polymer.output.tags.includes("advanced_material"),true);

  const pigment=engine.craftProcessed("pigment_compound",[
    {...raw.get("industrial_pigment_base"),quantity:1},
    {...raw.get("general_industrial_solvent"),quantity:1}
  ],{checkTotal:22});
  assert.equal(pigment.crafted,true);

  const coating=engine.craftProduct("industrial_coating",[
    {...polymer.output,quantity:1},
    {...pigment.output,quantity:1}
  ],{checkTotal:26});
  assert.equal(coating.crafted,true);
  assert.equal(coating.output.iconFamily,"industrial_coating");
  assert.equal(coating.output.integrationStatus,"active_component");
  assert.equal(coating.output.runtimeEffectImplemented,false);

  const acid={...beast.get("acid_secretion"),quantity:1};
  const corrosive=engine.craftProcessed("corrosive_solution",[
    acid,
    {...raw.get("general_industrial_solvent"),quantity:1},
    {...raw.get("general_chemical_stabilizer"),quantity:1}
  ],{checkTotal:22});
  assert.equal(corrosive.crafted,true);
  assert.equal(corrosive.output.iconFamily,"corrosive_solution");

  const advancedRequirement=JSON.stringify(craft.get("augment_grade_component").inputRequirements);
  assert.match(advancedRequirement,/advanced_material/);
  assert.equal(processed.get("stabilized_compound").tags.includes("advanced_material"),true);

  const electricalRequirement=JSON.stringify(craft.get("electrical_component").inputRequirements);
  assert.match(electricalRequirement,/conductive_material/);
  assert.match(electricalRequirement,/insulator/);

  const cryogenic=engine.craftProcessed("cryogenic_solution",[
    {...raw.get("cryogenic_reagent"),quantity:1},
    {...raw.get("general_industrial_solvent"),quantity:1},
    {...raw.get("general_chemical_stabilizer"),quantity:1}
  ],{checkTotal:22});
  assert.equal(cryogenic.crafted,true);
  assert.equal(cryogenic.output.iconFamily,"cryogenic_solution");
  assert.equal(cryogenic.output.tags.includes("cold_payload"),true);

  const coatingRecipe=armor.get("anti_corrosion_coating").recipe;
  assert.equal(coatingRecipe.baseThreshold,22);
  assert.equal(coatingRecipe.requiredToolType,"chemical_tools");
  assert.equal(coatingRecipe.inputRequirements[0].anyIds[0],"industrial_coating");

  assert.equal(engine.thresholdFor(processed.getProcess("cleaning_compound"),{improvised:true}),21);
  assert.equal(engine.thresholdFor(processed.getProcess("reactive_compound"),{advanced:true}),28);

  assert.equal(recipes.get("maintenance_kit").integrationStatus,"prepared");
  assert.equal(recipes.get("environmental_kit").integrationStatus,"prepared");
  assert.equal(recipes.get("industrial_sealant").integrationStatus,"active_component");

  console.log("Chemistry crafting smoke: OK (33 raw, 13 processed, 18 products, craft/armor/throwable hooks)");
})().catch((error)=>{console.error(error);process.exitCode=1;});
