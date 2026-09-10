(function (global, factory) {
  "use strict";
  const catalog = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = catalog;
  if (global) {
    global.LuminousSpellCatalog = catalog;
    try { global.LuminousContentRegistryBootstrap?.registerGenericCatalog?.("spell", catalog, "spell-catalog"); } catch (_) {}
    if (typeof require === "function") {
      try { require("./spell-batch-pierre-runtime.js"); } catch (_) {}
    }
    if (global.document) {
      const load = (id, src) => {
        if (global.document.getElementById(id)) return;
        const script = global.document.createElement("script");
        script.id = id; script.src = src; script.async = false;
        global.document.head?.appendChild(script);
      };
      if (!global.LuminousRoleSpellCatalog) load("role-spell-catalog-core-script", "js/role-spell-catalog-core.js");
      if (!global.LuminousPierreSpellBatchRuntime) load("spell-batch-pierre-runtime-script", "js/spell-batch-pierre-runtime.js");
    }
  }
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  const status = (trigger, id, potency = 0, count = 0, target = "target", extra = {}) => ({
    trigger, target, type: "status", status: id, potency, count, timing: "immediate", ...extra
  });

  return Object.freeze({
    fire_bolt: Object.freeze({
      id: "fire_bolt", name: "Fire Bolt", nombre: "Descarga de Fuego",
      level: 0, spellLevel: 0, cantrip: true,
      classIds: ["artificer", "sorcerer", "wizard"],
      sinAffinity: "wrath", damageType: "perforante",
      targetingType: "focused_attack", attackWeight: 1, atkWeight: 1,
      basePower: 5, coinPower: 8, coinAmount: 1, coins: 1,
      mechanics: {
        levelCoinPower: { every: 20, amount: 1 },
        onHitStatusFromSpellMod: { status: "burn", potencyDivisor: 2, minimum: 1 }
      },
      effects: []
    }),

    poison_spray: Object.freeze({
      id: "poison_spray", name: "Poison Spray", nombre: "Rociada Venenosa",
      level: 0, spellLevel: 0, cantrip: true,
      classIds: ["artificer", "druid", "sorcerer", "warlock", "wizard"],
      sinAffinity: "gluttony", damageType: "perforante",
      targetingType: "focused_attack", attackWeight: 1, atkWeight: 1,
      basePower: 4, coinPower: 10, coinAmount: 1, coins: 1,
      mechanics: {
        levelCoinPower: { every: 20, amount: 1 },
        onHitStatusFromSpellMod: { status: "poison", potencyDivisor: 2, minimum: 1, doubleIfTargetHasStatus: "poison" }
      },
      effects: []
    }),

    mind_sliver: Object.freeze({
      id: "mind_sliver", name: "Mind Sliver", nombre: "Fragmento mental",
      level: 0, spellLevel: 0, cantrip: true,
      classIds: ["sorcerer", "warlock", "wizard"],
      school: "enchantment", contexts: ["combat"],
      sinAffinity: "lust", damageType: "perforante",
      targetingType: "focused_attack", attackWeight: 1, atkWeight: 1,
      basePower: 4, coinPower: 5, coinAmount: 1, coins: 1,
      mechanics: {
        levelCoinPower: { every: 20, amount: 1 },
        onHitStatus: { status: "mind_sliver", count: 1, maxCount: 3 },
        saveFinalPowerPenalty: -2,
        loseCountOnTurnEnd: 1,
        loseCountOnSaveEnd: 1
      },
      effects: []
    }),

    chill_touch: Object.freeze({
      id: "chill_touch", name: "Chill Touch", nombre: "Toque helado",
      level: 0, spellLevel: 0, cantrip: true,
      classIds: ["sorcerer", "warlock", "wizard"],
      school: "necromancy", contexts: ["combat"],
      sinAffinity: "gloom", damageType: "perforante",
      targetingType: "focused_attack", attackWeight: 1, atkWeight: 1,
      basePower: 4, coinPower: 7, coinAmount: 1, coins: 1,
      mechanics: {
        levelCoinPower: { every: 20, amount: 1 },
        onHitStatusFromSpellMod: { status: "decay", countDivisor: 2, minimum: 1, element: "necrotic" }
      },
      effects: []
    }),

    charm_person: Object.freeze({
      id: "charm_person", name: "Charm Person", nombre: "Hechizar Persona",
      level: 1, spellLevel: 1, cantrip: false,
      classIds: ["bard", "druid", "sorcerer", "warlock", "wizard"],
      sinAffinity: "lust", damageType: null,
      targetingType: "multi", targetType: "multi", attackWeight: 1, atkWeight: 1,
      isUnclashable: true,
      save: { abilityId: "wis", onSuccess: "negates" },
      concentration: false,
      mechanics: {
        onFailedSave: status("on_failed_save", "charmed", 0, 10),
        breakCharmOnDamageFromCasterOrAlly: true
      },
      upcast: { atkWeightPerLevel: 1 },
      effects: []
    }),

    chromatic_orb: Object.freeze({
      id: "chromatic_orb", name: "Chromatic Orb", nombre: "Orbe Cromático",
      level: 1, spellLevel: 1, cantrip: false,
      classIds: ["sorcerer", "wizard"],
      sinAffinity: "sinless", damageType: "perforante",
      targetingType: "focused_attack", attackWeight: 1, atkWeight: 1,
      basePower: 5, coinPower: 10, coinAmount: 1, coins: 1,
      mechanics: {
        requiresChoice: {
          key: "element",
          values: ["acid", "cold", "fire", "lightning", "poison", "thunder"]
        },
        elementalStatus: {
          acid: { status: "corrosion", count: 1 },
          cold: { status: "chill", count: 1 },
          fire: { status: "burn", potency: 1 },
          lightning: { status: "shock", count: 1 },
          poison: { status: "poison", potency: 1 },
          thunder: { status: "tremor", potency: 1 }
        },
        onCritJump: { differentTarget: true, noRepeatTarget: true, maxJumpsFromSlotLevel: true }
      },
      upcast: { coinPowerPerLevel: 1 },
      effects: []
    }),

    absorb_elements: Object.freeze({
      id: "absorb_elements", name: "Absorb Elements", nombre: "Absorber Elementos",
      level: 1, spellLevel: 1, cantrip: false,
      classIds: ["artificer", "druid", "ranger", "sorcerer", "wizard"],
      school: "abjuration", contexts: ["combat"],
      sinAffinity: "sinless", damageType: null,
      targetType: "self", targetingType: "self", attackWeight: 1, atkWeight: 1,
      isUnclashable: true, castingTime: "reaction",
      mechanics: {
        trigger: "incoming_elemental_damage",
        supportedElements: ["acid", "cold", "fire", "lightning", "thunder"],
        requiresChoice: { key: "element", values: ["acid", "cold", "fire", "lightning", "thunder"] },
        triggeringHitMultiplier: 0.5,
        gainElementalAbsorptionFromSlotLevel: true,
        elementalAbsorptionExpires: "next_turn_end",
        onMeleeHit: { consume: "elemental_absorption", applyPotencyAndCountEqualToStoredCount: true }
      },
      effects: []
    }),

    shield: Object.freeze({
      id: "shield", name: "Shield", nombre: "Escudo",
      level: 1, spellLevel: 1, cantrip: false,
      classIds: ["sorcerer", "wizard"],
      school: "abjuration", contexts: ["combat"],
      sinAffinity: "sinless", damageType: null,
      targetType: "self", targetingType: "self", attackWeight: 1, atkWeight: 1,
      isUnclashable: true, castingTime: "reaction",
      mechanics: {
        trigger: "targeted_by_attack",
        timing: "before_getting_hit",
        shieldPerSlotLevel: 20,
        ephemeral: true,
        expires: "turn_end"
      },
      effects: []
    }),

    thunderwave: Object.freeze({
      id: "thunderwave", name: "Thunderwave", nombre: "Ola atronadora",
      level: 1, spellLevel: 1, cantrip: false,
      classIds: ["bard", "druid", "sorcerer", "wizard"],
      school: "evocation", contexts: ["combat"],
      sinAffinity: "wrath", damageType: "contundente",
      targetingType: "aoe", attackWeight: 4, atkWeight: 4,
      basePower: 5, coinPower: 7, coinAmount: 1, coinType: "unbreakable",
      coins: [{ type: "unbreakable", status: "active" }],
      mechanics: {
        onHitStatusFromSlot: { status: "tremor", base: 2, potencyPerSlot: 1, countPerSlot: 1 },
        onHitWithoutCracking: { repeatOnHitStatus: true, tremorBurst: true }
      },
      upcast: { atkWeightPerLevel: 1, finalPowerPerLevel: 1 },
      effects: []
    }),

    dissonant_whispers: Object.freeze({
      id: "dissonant_whispers", name: "Dissonant Whispers", nombre: "Susurros disonantes",
      level: 1, spellLevel: 1, cantrip: false,
      classIds: ["bard", "sorcerer"],
      school: "enchantment", contexts: ["combat"],
      sinAffinity: "lust", damageType: "perforante",
      targetingType: "focused_attack", attackWeight: 1, atkWeight: 1,
      basePower: 5, coinPower: 9, coinAmount: 1, coinType: "unbreakable",
      coins: [{ type: "unbreakable", status: "active" }],
      mechanics: {
        onHitStatusFromSlot: { status: "sinking", base: 4, potencyPerSlot: 1, countPerSlot: 1 },
        onHitWithoutCracking: { ifTargetSpBelow: -10, forceRetreatAtTurnEnd: true }
      },
      upcast: { finalPowerPerLevel: 1 },
      effects: []
    }),

    expeditious_retreat: Object.freeze({
      id: "expeditious_retreat", name: "Expeditious Retreat", nombre: "Retirada Expeditiva",
      level: 1, spellLevel: 1, cantrip: false,
      classIds: ["artificer", "sorcerer", "warlock", "wizard"],
      sinAffinity: "gloom", damageType: null,
      targetType: "self", targetingType: "self", attackWeight: 1, atkWeight: 1,
      isUnclashable: true, concentration: true, castingTime: "quick_action",
      mechanics: {
        onUse: status("on_use", "haste", 0, 3, "self"),
        whileConcentratingTurnStart: status("turn_start", "haste", 0, 3, "self")
      },
      effects: []
    }),

    animal_friendship: Object.freeze({
      id: "animal_friendship", name: "Animal Friendship", nombre: "Encantar animal",
      level: 1, spellLevel: 1, cantrip: false,
      classIds: ["bard", "druid", "ranger", "sorcerer"],
      school: "enchantment", contexts: ["combat", "theater"],
      sinAffinity: "lust", damageType: null,
      targetingType: "multi", targetType: "multi", attackWeight: 1, atkWeight: 1,
      isUnclashable: true, save: { abilityId: "wis", onSuccess: "negates" },
      concentration: false,
      mechanics: {
        targetRequirement: { creatureType: "beast", intelligenceMaxExclusive: 4, mustSeeAndHearCaster: true },
        onFailedSave: status("on_failed_save", "charmed", 0, 99),
        charmedCannotAggressCasterOrAllies: true,
        passTurnWhenNoValidNonAggressiveAction: true,
        breakCharmOnDamageFromCasterOrAlly: true,
        theaterDuration: "24_hours"
      },
      upcast: { atkWeightPerLevel: 1 },
      effects: []
    }),

    crown_of_madness: Object.freeze({
      id: "crown_of_madness", name: "Crown of Madness", nombre: "Corona de la locura",
      level: 2, spellLevel: 2, cantrip: false,
      classIds: ["bard", "sorcerer", "warlock", "wizard"],
      school: "enchantment", contexts: ["combat"],
      sinAffinity: "lust", damageType: null,
      targetingType: "focused_attack", targetType: "single", attackWeight: 1, atkWeight: 1,
      isUnclashable: true, save: { abilityId: "wis", onSuccess: "negates" },
      concentration: true,
      mechanics: {
        targetRequirement: { creatureType: "humanoid" },
        onFailedSave: status("on_failed_save", "crown_of_madness", 0, 10),
        sealAllButOneActionSlot: true,
        remainingSlotAction: "attack_assist_last_target_attacked_by_caster",
        repeatSaveAtTurnEnd: { abilityId: "wis" },
        loseCountAtTurnEnd: 1
      },
      effects: []
    }),

    suggestion: Object.freeze({
      id: "suggestion", name: "Suggestion", nombre: "Sugestión",
      level: 2, spellLevel: 2, cantrip: false,
      classIds: ["bard", "sorcerer", "warlock", "wizard"],
      school: "enchantment", contexts: ["combat", "theater"],
      sinAffinity: "lust", damageType: null,
      targetingType: "focused_attack", targetType: "single", attackWeight: 1, atkWeight: 1,
      isUnclashable: true, save: { abilityId: "wis", onSuccess: "negates" },
      concentration: true,
      mechanics: {
        requiresChoice: { key: "command", values: ["attack", "assist", "defend", "retreat", "do_nothing"] },
        onFailedSave: status("on_failed_save", "suggestion", 0, 1),
        commands: {
          attack: { action: "attack", cannotTargetAffectedUnitAlly: true },
          assist: { action: "assist", checksOnly: true },
          defend: { action: "guard", slots: 1 },
          retreat: { action: "retreat", slots: 1 },
          do_nothing: { action: "lock_slot", slots: 1 }
        }
      },
      effects: []
    }),

    scorching_ray: Object.freeze({
      id: "scorching_ray", name: "Scorching Ray", nombre: "Rayo Abrasador",
      level: 2, spellLevel: 2, cantrip: false,
      classIds: ["sorcerer", "wizard"],
      sinAffinity: "wrath", damageType: "perforante",
      targetingType: "focused_volley", attackWeight: 1, atkWeight: 1,
      basePower: 4, coinPower: 4, coinAmount: 3, coins: 3,
      mechanics: {
        onHitStatus: { status: "burn", potency: 1, perCoin: true }
      },
      upcast: { coinsPerLevel: 1 },
      effects: []
    })
  });
});
