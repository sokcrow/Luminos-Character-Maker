(function (global) {
  "use strict";
  if (global.LuminousArmorUpgradeEngine) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousArmorUpgradeEngine;
    return;
  }
  function safeRequire(path) { if (typeof require !== "function") return null; try { return require(path); } catch (_) { return null; } }
  const Catalog = global.LuminousArmorUpgradeCatalog || safeRequire("./item-catalog-armor-upgrades.js");
  if (!Catalog) throw new Error("LuminousArmorUpgradeCatalog is required before LuminousArmorUpgradeEngine.");
  function clone(v){return v==null?v:JSON.parse(JSON.stringify(v));}
  function apply(component, upgradeIds=[]) {
    if (!component?.valid) return Object.freeze({ valid:false, reason:"invalid_component" });
    const ids=(upgradeIds||[]).map(Catalog.normalizeId).filter(Boolean);
    if (new Set(ids).size !== ids.length) return Object.freeze({ valid:false, reason:"duplicate_upgrade" });
    if (ids.length > Number(component.upgradeCapacity||0)) return Object.freeze({ valid:false, reason:"upgrade_capacity_exceeded", capacity:Number(component.upgradeCapacity||0), requested:ids.length });
    const out=clone(component); out.installedUpgrades=[];
    out.physicalAffinity={...out.physicalAffinity}; out.elementalWear={...out.elementalWear}; out.armorSpeedDelta={...(out.armorSpeedDelta||{min:0,max:0})};
    for (const id of ids) {
      const u=Catalog.get(id);
      if (!u) return Object.freeze({ valid:false, reason:"unknown_upgrade", upgradeId:id });
      if (!u.allowedComponents.includes(out.componentId)) return Object.freeze({ valid:false, reason:"incompatible_upgrade", upgradeId:id, componentId:out.componentId });
      const e=u.effects||{};
      if (e.affinityDelta) for (const [k,v] of Object.entries(e.affinityDelta)) out.physicalAffinity[k]=Number(out.physicalAffinity[k]||0)+Number(v||0);
      if (e.durabilityMultiplier != null) out.durability*=Number(e.durabilityMultiplier);
      if (e.weightMultiplier != null) out.weightScore*=Number(e.weightMultiplier);
      if (e.elementalWearMultiplier) for (const [k,v] of Object.entries(e.elementalWearMultiplier)) out.elementalWear[k]=Number(out.elementalWear[k]||1)*Number(v||1);
      if (e.armorSpeedDelta) { out.armorSpeedDelta.min+=Number(e.armorSpeedDelta.min||0); out.armorSpeedDelta.max+=Number(e.armorSpeedDelta.max||0); }
      if (e.repairCostMultiplier != null) out.repairCostMultiplier*=Number(e.repairCostMultiplier);
      if (e.noiseDelta != null) out.noiseDelta+=Number(e.noiseDelta);
      if (e.equipActionStep != null) out.equipActionStep=Number(out.equipActionStep||0)+Number(e.equipActionStep);
      out.installedUpgrades.push(id);
    }
    out.installedUpgrades=Object.freeze(out.installedUpgrades.slice());
    out.valid=true;
    return Object.freeze(out);
  }
  const API=Object.freeze({VERSION:1,apply});
  global.LuminousArmorUpgradeEngine=API;
  if(typeof module!=="undefined"&&module.exports)module.exports=API;
})(typeof globalThis!=="undefined"?globalThis:window);
