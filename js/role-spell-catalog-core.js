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
    }),

    mage_hand: Object.freeze({
      id: "mage_hand", name: "Mage Hand", nombre: "Mano de Mago",
      level: 0, spellLevel: 0, cantrip: true,
      classIds: ["bard", "sorcerer", "warlock", "wizard"],
      school: "conjuration", contexts: ["theater"], castingTime: "action",
      rangeFeet: 30, duration: "1_minute",
      theater: Object.freeze({
        type: "spectral_hand", target: "spectral_hand",
        canManipulateObject: true, canOpenUnlockedDoorOrContainer: true,
        canMoveUnattendedObject: true, commandMoveFeet: 30, maxCarryLb: 10,
        cannotAttack: true, cannotActivateMagicItems: true
      })
    }),

    prestidigitation: Object.freeze({
      id: "prestidigitation", name: "Prestidigitation", nombre: "Prestidigitación",
      level: 0, spellLevel: 0, cantrip: true,
      classIds: ["artificer", "bard", "sorcerer", "warlock", "wizard"],
      school: "transmutation", contexts: ["theater"], castingTime: "action",
      rangeFeet: 10, duration: "up_to_1_hour",
      theater: Object.freeze({
        type: "minor_magic",
        options: Object.freeze([
          "harmless_sensory_effect", "light_or_extinguish_small_flame", "clean_or_soil_object",
          "chill_warm_or_flavor_nonliving_material", "add_color_mark_or_symbol", "create_small_trinket_or_minor_illusion"
        ]),
        combatPower: false, dealsDamage: false
      })
    }),

    distort_value: Object.freeze({
      id: "distort_value", name: "Distort Value", nombre: "Distorsionar el Valor",
      level: 1, spellLevel: 1, cantrip: false,
      classIds: ["bard", "sorcerer", "warlock", "wizard"],
      school: "illusion", contexts: ["theater"], castingTime: "1_minute",
      targetType: "touch", duration: "8_hours",
      theater: Object.freeze({
        type: "perceived_value", maxObjectSideFeet: 1,
        options: Object.freeze({
          increase: Object.freeze({ multiplier: 2, presentation: "desirable_details" }),
          decrease: Object.freeze({ multiplier: 0.5, presentation: "undesirable_details" })
        }),
        combatPower: false
      })
    }),

    comprehend_languages: Object.freeze({
      id: "comprehend_languages", name: "Comprehend Languages", nombre: "Entender Idiomas",
      level: 1, spellLevel: 1, cantrip: false,
      classIds: ["bard", "sorcerer", "warlock", "wizard"],
      school: "divination", contexts: ["theater"], castingTime: "action", ritual: true,
      targetType: "self", duration: "1_hour",
      theater: Object.freeze({
        type: "temporary_language_access",
        temporaryLanguageAccess: Object.freeze({
          mode: "understand", scope: Object.freeze(["standard", "exotic"]),
          duration: "1_hour", grantsSpeaking: false
        }),
        writtenTextRequiresTouch: true, approximateMinutesPerPage: 1,
        excludesSpecialLanguages: Object.freeze(["distortion", "singularity", "special"])
      })
    }),

    speak_with_animals: Object.freeze({
      id: "speak_with_animals", name: "Speak with Animals", nombre: "Hablar con los Animales",
      level: 1, spellLevel: 1, cantrip: false,
      classIds: ["bard", "druid", "ranger"],
      school: "divination", contexts: ["theater"], castingTime: "action", ritual: true,
      targetType: "self", duration: "10_minutes",
      theater: Object.freeze({
        type: "temporary_communication",
        temporaryCommunication: Object.freeze({
          targetCreatureType: "beast", understandsTarget: true,
          targetUnderstandsCaster: true, duration: "10_minutes"
        }),
        beastKnowledgeWindowHours: 24,
        mayAttemptSmallFavorCheck: true,
        grantsLanguage: false, permanentModification: false
      })
    })
  });
});
