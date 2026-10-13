(function (global) {
  "use strict";
  if (global.LuminousCurseCatalog) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousCurseCatalog;
    return;
  }

  // Vocabulary and executable adapters are intentionally closed. Declaring a
  // future family does NOT make its effects executable without its own bridge.
  const VERSION = 1;
  const FAMILIES = Object.freeze(["item", "affliction", "binding", "ritual", "pact"]);
  const TARGET_KINDS = Object.freeze(["item", "creature", "place", "lineage", "entity"]);
  const OPERATIONS = Object.freeze(["remove", "suppress", "break", "transfer", "seal"]);
  const STATES = Object.freeze(["active", "suppressed", "sealed", "resolved"]);
  const TRIGGERS = Object.freeze(["passive"]);
  const EFFECTS = Object.freeze(["equipment_lock"]);
  const EFFECT_TARGETS = Object.freeze({equipment_lock:Object.freeze(["item"])});
  // Unknown policy fields are rejected, not silently interpreted as live mechanics.
  const DEFINITION_KEYS = Object.freeze([
    "id","name","description","family","targetKinds","trigger","adverseEffect",
    "maxIntensity","stacking","priority","sourceDependency","allowedResolutions",
  ]);
  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
  const isObject = (value) => value != null && typeof value === "object" && !Array.isArray(value);
  const unsafeKey = (key) => ["__proto__", "prototype", "constructor", "script", "javascript", "eval", "code", "function_body", "handler_function"].includes(String(key).toLowerCase());
  function containsExecutablePayload(value, seen = new Set()) {
    if (typeof value === "function" || typeof value === "symbol" || typeof value === "bigint") return true;
    if (!value || typeof value !== "object") return false;
    if (seen.has(value)) return true; // cyclic references cannot be persisted
    seen.add(value);
    try {
      return Object.entries(value).some(([key, child]) => unsafeKey(key) || containsExecutablePayload(child,seen));
    } finally { seen.delete(value); }
  }

  const PUBLISHED = Object.freeze([
    Object.freeze({
      id:"cursed_binding",
      name:"Atadura maldita",
      description:"Una vez equipado, este objeto no puede retirarse mientras la atadura esté activa.",
      family:"binding",
      targetKinds:Object.freeze(["item"]),
      trigger:"passive",
      adverseEffect:"equipment_lock",
      maxIntensity:1,
      stacking:"intensify",
      priority:0,
      sourceDependency:"persistent",
      allowedResolutions:Object.freeze(["suppress","seal","break","transfer"]),
    }),
  ]);

  function validateDefinition(definition) {
    const errors = [];
    if (!isObject(definition) || containsExecutablePayload(definition)) return Object.freeze({valid:false,errors:Object.freeze(["invalid_or_executable_definition"])});
    if (Object.keys(definition).some(key => !DEFINITION_KEYS.includes(key))) errors.push("unsupported_definition_field");
    if (!/^[a-z][a-z0-9_]{2,79}$/.test(String(definition.id || ""))) errors.push("invalid_definition_id");
    if (typeof definition.name !== "string" || !definition.name.trim() || definition.name.length > 120) errors.push("invalid_name");
    if (typeof definition.description !== "string" || !definition.description.trim() || definition.description.length > 1000) errors.push("invalid_description");
    if (!FAMILIES.includes(definition.family)) errors.push("unknown_curse_family");
    if (!Array.isArray(definition.targetKinds) || !definition.targetKinds.length ||
        new Set(definition.targetKinds).size !== definition.targetKinds.length ||
        definition.targetKinds.some(kind => !TARGET_KINDS.includes(kind))) errors.push("invalid_target_kinds");
    if (!TRIGGERS.includes(definition.trigger)) errors.push("unimplemented_curse_trigger");
    if (!EFFECTS.includes(definition.adverseEffect)) errors.push("unimplemented_adverse_effect");
    if (Array.isArray(definition.targetKinds) && definition.targetKinds.some(kind => !EFFECT_TARGETS[definition.adverseEffect]?.includes(kind))) {
      errors.push("curse_effect_target_not_executable");
    }
    if (!Number.isInteger(definition.maxIntensity) || definition.maxIntensity < 1 || definition.maxIntensity > 99) errors.push("invalid_max_intensity");
    if (definition.stacking !== "intensify" && definition.stacking !== "non_stackable") errors.push("invalid_stacking");
    if (!Number.isInteger(definition.priority) || Math.abs(definition.priority) > 1000) errors.push("invalid_priority");
    if (definition.sourceDependency !== "persistent") errors.push("unsupported_source_dependency");
    if (!Array.isArray(definition.allowedResolutions) || new Set(definition.allowedResolutions).size !== definition.allowedResolutions.length ||
        definition.allowedResolutions.some(op => !OPERATIONS.includes(op))) errors.push("invalid_resolutions");
    return Object.freeze({valid:!errors.length,errors:Object.freeze(errors)});
  }

  for (const def of PUBLISHED) {
    const gate = validateDefinition(def);
    if (!gate.valid) throw new Error("Invalid published Curse: "+def.id+" ("+gate.errors.join(",")+")");
  }
  const byId = new Map(PUBLISHED.map(def => [def.id, def]));
  const api = Object.freeze({
    VERSION,version:VERSION,FAMILIES,TARGET_KINDS,OPERATIONS,STATES,TRIGGERS,EFFECTS,
    validateDefinition,containsExecutablePayload,
    list(targetKind) {
      return PUBLISHED.filter(def => !targetKind || def.targetKinds.includes(targetKind)).map(clone);
    },
    get(id) { return clone(byId.get(String(id || "")) || null); },
  });
  global.LuminousCurseCatalog = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
