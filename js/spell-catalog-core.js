(function (global, factory) {
  "use strict";
  const catalog = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = catalog;
  if (global) global.LuminousSpellCatalog = catalog;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  const status = (trigger, id, potency = 0, count = 0, target = "target") => ({
    trigger, target, type: "status", status: id, potency, count, timing: "immediate"
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
