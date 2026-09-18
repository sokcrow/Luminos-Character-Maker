(function (global) {
  "use strict";

  if (global.LuminousArmorMaterialProfile) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousArmorMaterialProfile;
    return;
  }

  const VERSION = 1;
  const DAMAGE_TYPES = Object.freeze(["slash", "pierce", "blunt"]);
  const ELEMENTS = Object.freeze(["fire", "cold", "lightning", "acid"]);

  function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
  function normalizeId(value) {
    return String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  }
  function freezeProfile(def) {
    return Object.freeze({
      id: normalizeId(def.id),
      name: def.name,
      affinity: Object.freeze({
        slash: Number(def.affinity?.slash || 0),
        pierce: Number(def.affinity?.pierce || 0),
        blunt: Number(def.affinity?.blunt || 0),
      }),
      durability: Number(def.durability || 0),
      weight: Number(def.weight || 1),
      unitValueAhn: Number(def.unitValueAhn || 0),
      elementalWear: Object.freeze({
        fire: Number(def.elementalWear?.fire || 1),
        cold: Number(def.elementalWear?.cold || 1),
        lightning: Number(def.elementalWear?.lightning || 1),
        acid: Number(def.elementalWear?.acid || 1),
      }),
      tags: Object.freeze((def.tags || []).map(normalizeId).filter(Boolean)),
    });
  }

  const ALIASES = Object.freeze({
    hardened_weapon_steel: "hardened_steel",
    armor_steel: "hardened_steel",
    processed_textile: "textile",
    raw_fiber: "textile",
    processed_leather: "leather",
    mammal_hide: "hide",
    fur_pelt: "hide",
    humanoid_hide: "hide",
    avian_hide: "hide",
    reptilian_hide: "hide",
    amphibian_skin: "hide",
    fish_skin: "hide",
    draconic_hide: "hide",
    exotic_hide: "hide",
    scute: "scale",
    draconic_scale: "scale",
    carapace: "shell",
    exoskeleton_plate: "chitin",
    exotic_armor_plate: "chitin",
    structural_wood: "wood",
    structural_stock: "wood",
    wood_stock: "wood",
  });

  const PROFILES = Object.freeze(Object.fromEntries([
    freezeProfile({ id:"textile", name:"Textile", affinity:{slash:0,pierce:-1,blunt:2}, durability:8, weight:0.30, unitValueAhn:6000, elementalWear:{fire:1.50,cold:1.00,lightning:1.00,acid:1.20}, tags:["flexible","fiber"] }),
    freezeProfile({ id:"leather", name:"Leather", affinity:{slash:1,pierce:-1,blunt:1}, durability:10, weight:0.50, unitValueAhn:7000, elementalWear:{fire:1.30,cold:1.00,lightning:1.00,acid:1.35}, tags:["flexible","structural","organic"] }),
    freezeProfile({ id:"hide", name:"Hide", affinity:{slash:1,pierce:0,blunt:2}, durability:14, weight:0.60, unitValueAhn:16000, elementalWear:{fire:1.30,cold:0.90,lightning:1.00,acid:1.30}, tags:["flexible","structural","organic"] }),
    freezeProfile({ id:"wood", name:"Wood", affinity:{slash:1,pierce:-2,blunt:1}, durability:15, weight:0.65, unitValueAhn:8000, elementalWear:{fire:1.60,cold:1.00,lightning:1.05,acid:1.35}, tags:["solid","structural","organic"] }),
    freezeProfile({ id:"bone", name:"Bone", affinity:{slash:1,pierce:0,blunt:-1}, durability:18, weight:0.70, unitValueAhn:12000, elementalWear:{fire:1.10,cold:1.10,lightning:1.00,acid:1.45}, tags:["solid","structural","organic"] }),
    freezeProfile({ id:"horn", name:"Horn", affinity:{slash:1,pierce:1,blunt:-1}, durability:18, weight:0.65, unitValueAhn:14000, elementalWear:{fire:1.10,cold:1.10,lightning:1.00,acid:1.40}, tags:["solid","structural","organic"] }),
    freezeProfile({ id:"chitin", name:"Chitin", affinity:{slash:2,pierce:-1,blunt:1}, durability:20, weight:0.55, unitValueAhn:4500, elementalWear:{fire:1.15,cold:1.10,lightning:1.00,acid:1.50}, tags:["solid","structural","organic","scale_compatible"] }),
    freezeProfile({ id:"scale", name:"Scale", affinity:{slash:2,pierce:1,blunt:-2}, durability:22, weight:0.65, unitValueAhn:3000, elementalWear:{fire:1.05,cold:1.00,lightning:1.00,acid:1.35}, tags:["solid","structural","organic","scale_compatible"] }),
    freezeProfile({ id:"shell", name:"Shell", affinity:{slash:2,pierce:0,blunt:-1}, durability:25, weight:0.80, unitValueAhn:18000, elementalWear:{fire:1.00,cold:1.15,lightning:1.00,acid:1.45}, tags:["solid","structural","organic","scale_compatible"] }),
    freezeProfile({ id:"iron", name:"Iron", affinity:{slash:2,pierce:1,blunt:-2}, durability:25, weight:1.00, unitValueAhn:20000, elementalWear:{fire:1.10,cold:1.00,lightning:1.20,acid:1.50}, tags:["solid","structural","linkable","metal","scale_compatible"] }),
    freezeProfile({ id:"bronze", name:"Bronze", affinity:{slash:2,pierce:1,blunt:-1}, durability:22, weight:1.05, unitValueAhn:38000, elementalWear:{fire:1.05,cold:1.00,lightning:1.15,acid:1.40}, tags:["solid","structural","linkable","metal","scale_compatible"] }),
    freezeProfile({ id:"carbon_steel", name:"Carbon Steel", affinity:{slash:2,pierce:2,blunt:-2}, durability:30, weight:0.95, unitValueAhn:40000, elementalWear:{fire:1.10,cold:1.00,lightning:1.20,acid:1.45}, tags:["solid","structural","linkable","metal","scale_compatible"] }),
    freezeProfile({ id:"high_carbon_steel", name:"High-Carbon Steel", affinity:{slash:3,pierce:2,blunt:-2}, durability:35, weight:0.98, unitValueAhn:55000, elementalWear:{fire:1.10,cold:1.05,lightning:1.20,acid:1.45}, tags:["solid","structural","linkable","metal","scale_compatible"] }),
    freezeProfile({ id:"stainless_steel", name:"Stainless Steel", affinity:{slash:2,pierce:2,blunt:-1}, durability:35, weight:0.98, unitValueAhn:70000, elementalWear:{fire:1.05,cold:1.00,lightning:1.20,acid:1.20}, tags:["solid","structural","linkable","metal","scale_compatible"] }),
    freezeProfile({ id:"hardened_steel", name:"Hardened Steel", affinity:{slash:3,pierce:2,blunt:-3}, durability:42, weight:0.95, unitValueAhn:90000, elementalWear:{fire:1.10,cold:1.00,lightning:1.25,acid:1.50}, tags:["solid","structural","linkable","metal","scale_compatible"] }),
    freezeProfile({ id:"nickel_steel", name:"Nickel Steel", affinity:{slash:2,pierce:3,blunt:-2}, durability:38, weight:1.00, unitValueAhn:100000, elementalWear:{fire:1.05,cold:0.95,lightning:1.20,acid:1.30}, tags:["solid","structural","linkable","metal","scale_compatible"] }),
    freezeProfile({ id:"chrome_steel", name:"Chrome Steel", affinity:{slash:3,pierce:2,blunt:-2}, durability:40, weight:1.00, unitValueAhn:115000, elementalWear:{fire:1.05,cold:1.00,lightning:1.20,acid:1.20}, tags:["solid","structural","linkable","metal","scale_compatible"] }),
    freezeProfile({ id:"titanium", name:"Titanium", affinity:{slash:2,pierce:2,blunt:-1}, durability:45, weight:0.60, unitValueAhn:120000, elementalWear:{fire:1.00,cold:1.00,lightning:1.10,acid:1.20}, tags:["solid","structural","linkable","metal","scale_compatible"] }),
    freezeProfile({ id:"titanium_alloy", name:"Titanium Alloy", affinity:{slash:2,pierce:3,blunt:-2}, durability:53, weight:0.55, unitValueAhn:185000, elementalWear:{fire:1.00,cold:1.00,lightning:1.10,acid:1.15}, tags:["solid","structural","linkable","metal","scale_compatible"] }),
    freezeProfile({ id:"advanced_titanium_alloy", name:"Advanced Titanium Alloy", affinity:{slash:3,pierce:3,blunt:-2}, durability:60, weight:0.50, unitValueAhn:240000, elementalWear:{fire:0.95,cold:0.95,lightning:1.05,acid:1.10}, tags:["solid","structural","linkable","metal","scale_compatible"] }),
    freezeProfile({ id:"tungsten", name:"Tungsten", affinity:{slash:3,pierce:2,blunt:-3}, durability:45, weight:1.45, unitValueAhn:105000, elementalWear:{fire:0.95,cold:1.00,lightning:1.20,acid:1.30}, tags:["solid","structural","linkable","metal","scale_compatible"] }),
    freezeProfile({ id:"tungsten_alloy", name:"Tungsten Alloy", affinity:{slash:3,pierce:3,blunt:-3}, durability:50, weight:1.50, unitValueAhn:170000, elementalWear:{fire:0.95,cold:1.00,lightning:1.20,acid:1.25}, tags:["solid","structural","linkable","metal","scale_compatible"] }),
    freezeProfile({ id:"ceramic", name:"Ceramic", affinity:{slash:2,pierce:2,blunt:-3}, durability:22, weight:0.70, unitValueAhn:30000, elementalWear:{fire:0.75,cold:1.35,lightning:0.85,acid:1.00}, tags:["solid","structural","scale_compatible"] }),
  ].map((entry) => [entry.id, entry])));

  function canonicalId(id) {
    const key = normalizeId(id);
    return ALIASES[key] || key;
  }

  function inferProfile(id, explicit = {}) {
    const key = canonicalId(id);
    if (PROFILES[key]) return PROFILES[key];
    const tags = new Set((explicit.tags || []).map(normalizeId));
    const materialClass = normalizeId(explicit.materialClass);
    const isMetal = tags.has("metal") || materialClass === "alloy" || materialClass === "refined_metal" || /steel|alloy|metal|iron|titan|tungsten|nickel|chrome|cobalt|bronze|brass/.test(key);
    const isFlexible = tags.has("flexible") || /textile|fiber|leather|hide|pelt|skin/.test(key);
    const base = isMetal
      ? { affinity:{slash:2,pierce:1,blunt:-2}, durability:25, weight:1.00, unitValueAhn:0, elementalWear:{fire:1.10,cold:1.00,lightning:1.20,acid:1.45}, tags:["solid","structural","linkable","metal","scale_compatible"] }
      : isFlexible
        ? { affinity:{slash:1,pierce:-1,blunt:1}, durability:10, weight:0.50, unitValueAhn:0, elementalWear:{fire:1.30,cold:1.00,lightning:1.00,acid:1.30}, tags:["flexible","structural"] }
        : { affinity:{slash:1,pierce:0,blunt:-1}, durability:18, weight:0.80, unitValueAhn:0, elementalWear:{fire:1.10,cold:1.00,lightning:1.00,acid:1.25}, tags:["solid","structural"] };
    return freezeProfile({ id:key || "unknown_material", name: explicit.name || String(id || "Unknown Material"), ...base });
  }

  function resolve(material, explicit = {}) {
    const source = typeof material === "object" && material ? material : { materialId: material };
    const inputId = source.materialId || source.id || explicit.materialId || explicit.id;
    const canonical = canonicalId(inputId);
    const base = inferProfile(canonical, { ...source, ...explicit });
    const affinity = { ...base.affinity, ...(source.affinity || explicit.affinity || {}) };
    const elementalWear = { ...base.elementalWear, ...(source.elementalWear || explicit.elementalWear || {}) };
    const tags = source.tags || explicit.tags || base.tags;
    return Object.freeze({
      id: canonical,
      sourceId: normalizeId(inputId),
      name: source.materialName || source.name || explicit.materialName || explicit.name || base.name,
      lineageId: normalizeId(source.lineageId || explicit.lineageId),
      lineageName: source.lineageName || explicit.lineageName || null,
      affinity: Object.freeze({ slash:Number(affinity.slash || 0), pierce:Number(affinity.pierce || 0), blunt:Number(affinity.blunt || 0) }),
      durability: Number(source.durability ?? explicit.durability ?? base.durability),
      weight: Number(source.weight ?? explicit.weight ?? base.weight),
      unitValueAhn: Number(source.unitValueAhn ?? source.standardUnitValueAhn ?? explicit.unitValueAhn ?? base.unitValueAhn),
      elementalWear: Object.freeze({ fire:Number(elementalWear.fire || 1), cold:Number(elementalWear.cold || 1), lightning:Number(elementalWear.lightning || 1), acid:Number(elementalWear.acid || 1) }),
      tags: Object.freeze((tags || []).map(normalizeId).filter(Boolean)),
    });
  }

  function upgradeSlotsForDurability(value) {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return 0;
    if (n >= 35) return 3;
    if (n >= 20) return 2;
    return 1;
  }

  const API = Object.freeze({ VERSION, DAMAGE_TYPES, ELEMENTS, ALIASES, PROFILES, normalizeId, canonicalId, resolve, upgradeSlotsForDurability });
  global.LuminousArmorMaterialProfile = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof globalThis !== "undefined" ? globalThis : window);
