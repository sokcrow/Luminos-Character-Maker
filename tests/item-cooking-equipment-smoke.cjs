const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

(async () => {
  delete globalThis.LuminousCookingEquipmentEngine;
  await import(pathToFileURL(path.resolve(__dirname, "../js/item-cooking-equipment-engine.js")).href);
  const eq=globalThis.LuminousCookingEquipmentEngine;
  assert.ok(eq);
  assert.equal(eq.VERSION,1);
  assert.ok(eq.STATIONS.oven);
  assert.ok(eq.STATIONS.smoker);
  assert.equal(eq.canonicalStationId("stove"),"cooktop");

  const unit={
    inventario_activo:{
      cooks:{definitionId:"cooks_utensils",quantity:1},
      brewers:{definitionId:"brewers_supplies",quantity:1},
    },
    toolProficiencies:{cooks_utensils:3},
  };

  const bake=eq.evaluate({method:"bake"},unit,{stationId:"oven"});
  assert.equal(bake.hasRequiredTool,true);
  assert.equal(bake.hasRequiredStation,true);
  assert.equal(bake.improperEquipmentCount,0);
  assert.equal(bake.hasCooksUtensils,true);
  assert.equal(bake.proficient,true);
  assert.equal(bake.proficiency,3);

  const badBake=eq.evaluate({method:"bake"},unit,{stationId:"cooktop"});
  assert.equal(badBake.hasRequiredStation,false);
  assert.equal(badBake.improperEquipmentCount,1);
  assert.deepEqual(badBake.missingStationIds,["oven"]);

  const ferment=eq.evaluate({method:"ferment"},unit,{stationId:"fermentation_station"});
  assert.equal(ferment.hasRequiredTool,true);
  assert.equal(ferment.hasRequiredStation,true);
  assert.equal(ferment.improperEquipmentCount,0);

  const noBrewer=eq.evaluate({method:"ferment"},{inventario_activo:{cooks:{definitionId:"cooks_utensils",quantity:1}}},{stationId:"fermentation_station"});
  assert.equal(noBrewer.hasRequiredTool,false);
  assert.equal(noBrewer.improperEquipmentCount,1);
  assert.deepEqual(noBrewer.missingToolIds,["brewers_supplies"]);

  console.log("Cooking Equipment V1 smoke: OK (tools, stations, aliases and mismatch penalties)");
})().catch((error)=>{ console.error(error); process.exitCode=1; });
