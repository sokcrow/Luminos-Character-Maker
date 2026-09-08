(function (global) {
  "use strict";

  const DEFINITION = Object.freeze({
    id: "rupture",
    name: "Rupture",
    type: "negative",
    mode: "double",
    icon: null,
    rules: Object.freeze([
      Object.freeze({
        trigger: "getting_hit",
        cond_input: 1,
        cond_type: "potency",
        operation: "sub",
        aff_input: 1,
        affectation: "hp",
        decay: "sub_count_1",
      }),
    ]),
    description: "When hit by an attack, take fixed damage equal to Potency, then lose 1 Count.",
  });

  function install() {
    if (!global.STATUS_REGISTRY || typeof global.STATUS_REGISTRY !== "object") global.STATUS_REGISTRY = {};
    const previous = global.STATUS_REGISTRY.rupture && typeof global.STATUS_REGISTRY.rupture === "object"
      ? global.STATUS_REGISTRY.rupture
      : {};
    global.STATUS_REGISTRY.rupture = {
      ...previous,
      ...DEFINITION,
      rules: Array.from(DEFINITION.rules, (rule) => ({ ...rule })),
    };
    return global.STATUS_REGISTRY.rupture;
  }

  const api = Object.freeze({ version: "1.0.0", DEFINITION, install });
  global.LuminousRuptureStatusRuntime = api;
  install();

  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
