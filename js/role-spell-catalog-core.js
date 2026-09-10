(function (global, factory) {
  "use strict";
  const catalog = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = catalog;
  if (global) {
    global.LuminousRoleSpellCatalog = catalog;
    try { global.LuminousContentRegistryBootstrap?.registerGenericCatalog?.("role_spell", catalog, "role-spell-catalog"); } catch (_) {}
  }
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  return Object.freeze({
    message: Object.freeze({
      id: "message", name: "Message", nombre: "Mensaje",
      level: 0, spellLevel: 0, cantrip: true,
      classIds: ["artificer", "bard", "sorcerer", "wizard"],
      school: "transmutation", contexts: ["theater"], castingTime: "action",
      rangeFeet: 120, duration: "1_round",
      theater: Object.freeze({
        type: "private_message", targetCount: 1, targetCanReply: true,
        canPassThroughObjects: true, requiresKnownTargetPositionThroughObjects: true
      })
    }),

    thaumaturgy: Object.freeze({
      id: "thaumaturgy", name: "Thaumaturgy", nombre: "Taumaturgia",
      level: 0, spellLevel: 0, cantrip: true,
      classIds: ["cleric", "sorcerer"],
      school: "transmutation", contexts: ["theater"], castingTime: "action",
      rangeFeet: 30, duration: "1_minute",
      theater: Object.freeze({
        type: "minor_wonder",
        options: Object.freeze([
          "amplify_voice", "alter_flame", "harmless_tremor", "create_sound",
          "open_or_close_door_or_window", "alter_eyes"
        ])
      })
    })
  });
});
