(function (global, factory) {
  "use strict";
  const catalog = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = catalog;
  if (global) {
    global.LuminousSpellCatalog = catalog;
    try { global.LuminousContentRegistryBootstrap?.registerGenericCatalog?.("spell", catalog, "spell-catalog"); } catch (_) {}
    if (typeof require === "function") {
      try { require("./spell-batch-pierre-runtime.js"); } catch (_) {}
      try { require("./spell-batch-angelo-runtime.js"); } catch (_) {}
      try { require("./spell-visual-asset-registry.js"); } catch (_) {}
      try { require("./spell-batch-weapon-cantrips-runtime.js"); } catch (_) {}
      try { require("./spell-batch-cantrips-runtime.js"); } catch (_) {}
      try { require("./spell-batch-cantrips-utility-runtime.js"); } catch (_) {}
      try { require("./spell-batch-level1-runtime.js"); } catch (_) {}
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
      if (!global.LuminousAngeloSpellBatchRuntime) load("spell-batch-angelo-runtime-script", "js/spell-batch-angelo-runtime.js");
      if (!global.LuminousSpellVisualAssetRegistry) load("spell-visual-asset-registry-script", "js/spell-visual-asset-registry.js");
      if (!global.LuminousWeaponCantripBatchRuntime) load("spell-batch-weapon-cantrips-runtime-script", "js/spell-batch-weapon-cantrips-runtime.js");
      if (!global.LuminousCantripBatchRuntime) load("spell-batch-cantrips-runtime-script", "js/spell-batch-cantrips-runtime.js");
      if (!global.LuminousCantripUtilityRuntime) load("spell-batch-cantrips-utility-runtime-script", "js/spell-batch-cantrips-utility-runtime.js");
      if (!global.LuminousLevel1SpellBatchRuntime) load("spell-batch-level1-runtime-script", "js/spell-batch-level1-runtime.js");
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
      school: "evocation", contexts: ["combat"],
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
      school: "necromancy", contexts: ["combat"],
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

    vicious_mockery: Object.freeze({
      id: "vicious_mockery", name: "Vicious Mockery", nombre: "Burla Dañina",
      level: 0, spellLevel: 0, cantrip: true,
      classIds: ["bard"],
      school: "enchantment", contexts: ["combat"],
      sinAffinity: "gloom", damageType: "perforante",
      targetingType: "focused_attack", attackWeight: 1, atkWeight: 1,
      basePower: 6, coinPower: 5, coinAmount: 1, coins: 1,
      mechanics: {
        levelCoinPower: { every: 20, amount: 1 },
        onHitLevelStatus: { every: 20, base: 1, status: "sinking", potencyAndCount: true },
        onHitClashPowerDown: 2,
        clashPowerDownExpires: "next_clash_end"
      },
      effects: []
    }),

    booming_blade: Object.freeze({
      id: "booming_blade", name: "Booming Blade", nombre: "Booming Blade",
      description: "Enchant one Melee Attack Skill in a Slot. On Hit, inflict (1, Level/5) Booming next Turn.",
      level: 0, spellLevel: 0, cantrip: true,
      classIds: ["artificer", "sorcerer", "warlock", "wizard"],
      school: "evocation", contexts: ["combat"],
      sinAffinity: "wrath", damageType: null,
      targetType: "action_slot", targetingType: "action_slot", attackWeight: 1, atkWeight: 1,
      isUnclashable: true, castingTime: "quick_action",
      mechanics: {
        slotEnchantment: { id: "booming_blade", requires: { meleeAttackSkill: true } },
        onHitNextTurnStatus: { status: "booming", countFormula: "max(1,floor(Level/5))" }
      },
      effects: []
    }),

    green_flame_blade: Object.freeze({
      id: "green_flame_blade", name: "Green-Flame Blade", nombre: "Green-Flame Blade",
      description: "Enchant one Melee Attack Skill with 1 ATK Weight in a Slot. Gain +1 ATK Weight; secondary target takes (20 + Level/4)% Damage. On Hit, inflict (1 + Level/15) Burn.",
      level: 0, spellLevel: 0, cantrip: true,
      classIds: ["artificer", "sorcerer", "warlock", "wizard"],
      school: "evocation", contexts: ["combat"],
      sinAffinity: "wrath", damageType: null,
      targetType: "action_slot", targetingType: "action_slot", attackWeight: 1, atkWeight: 1,
      isUnclashable: true, castingTime: "quick_action",
      mechanics: {
        slotEnchantment: { id: "green_flame_blade", requires: { meleeAttackSkill: true, attackWeight: 1 } },
        attackWeightBonus: 1,
        secondaryDamagePercentFormula: "20+floor(Level/4)",
        onHitBurnFormula: "1+floor(Level/15)"
      },
      effects: []
    }),

    shillelagh: Object.freeze({
      id: "shillelagh", name: "Shillelagh", nombre: "Shillelagh",
      description: "Gain 10 Shillelagh. Melee Skills deal (1, (Level/15) + (2 × WIS Mod))% Main Damage as Fixed Damage on Hit.",
      level: 0, spellLevel: 0, cantrip: true,
      classIds: ["druid"],
      school: "transmutation", contexts: ["combat"],
      sinAffinity: "gluttony", damageType: null,
      targetType: "self", targetingType: "self", attackWeight: 1, atkWeight: 1,
      isUnclashable: true, castingTime: "quick_action",
      mechanics: {
        weaponCantrip: "shillelagh",
        onUseStatus: { status: "shillelagh", count: 10 },
        fixedDamagePercentFormula: "max(1,floor(Level/15)+(2*WISMod))"
      },
      effects: []
    }),

    true_strike: Object.freeze({
      id: "true_strike", name: "True Strike", nombre: "True Strike",
      description: "Enchant one Melee Attack Skill in a Slot. That Skill deals +(2 + Level/10)% Damage. On Hit, inflict 1 Radiance.",
      level: 0, spellLevel: 0, cantrip: true,
      classIds: ["bard", "sorcerer", "warlock", "wizard"],
      school: "divination", contexts: ["combat"],
      sinAffinity: "pride", damageType: null,
      targetType: "action_slot", targetingType: "action_slot", attackWeight: 1, atkWeight: 1,
      isUnclashable: true, castingTime: "quick_action",
      mechanics: {
        slotEnchantment: { id: "true_strike", requires: { meleeAttackSkill: true } },
        damagePercentFormula: "2+floor(Level/10)",
        onHitStatus: { status: "radiance", count: 1 }
      },
      effects: []
    }),

    minor_illusion: Object.freeze({
      id: "minor_illusion", name: "Minor Illusion", nombre: "Minor Illusion",
      description: "Theater: create a small visual illusion or sound. Combat: grant 10 Illusion to yourself or one Ally that isn't Large.",
      level: 0, spellLevel: 0, cantrip: true,
      classIds: ["bard", "sorcerer", "warlock", "wizard"],
      school: "illusion", contexts: ["combat", "theater"],
      sinAffinity: "gloom", damageType: null,
      targetType: "allies", targetingType: "allies", attackWeight: 1, atkWeight: 1,
      isUnclashable: true, castingTime: "action",
      mechanics: {
        cantripRuntime: "minor_illusion",
        combatStatus: { status: "illusion", count: 10 },
        targetRequirement: { maximumSizeExclusive: "large" }
      },
      effects: []
    }),

    produce_flame: Object.freeze({
      id: "produce_flame", name: "Produce Flame", nombre: "Produce Flame",
      description: "Create Produce Flame as a Background Unit. It disappears when Concentration ends.",
      level: 0, spellLevel: 0, cantrip: true,
      classIds: ["druid"],
      school: "conjuration", contexts: ["combat"],
      sinAffinity: "wrath", damageType: null,
      targetType: "self", targetingType: "self", attackWeight: 1, atkWeight: 1,
      isUnclashable: true, castingTime: "quick_action", concentration: true,
      mechanics: {
        cantripRuntime: "produce_flame",
        entity: { kind: "background_unit", concentrationBound: true },
        entitySkill: {
          id: "produce_flame_flame", name: "Flame", targetingType: "focused_attack",
          attackWeight: 1, atkWeight: 1, basePower: 4, coinPowerFormula: "3+floor(SummonerLevel/15)", coinAmount: 1,
          onHitStatusFormula: { status: "burn", potency: "1+floor(SummonerLevel/15)" }
        }
      },
      effects: []
    }),

    blade_ward: Object.freeze({
      id: "blade_ward", name: "Blade Ward", nombre: "Blade Ward",
      description: "At Combat Start, gain Blade Guard from this Slot.",
      level: 0, spellLevel: 0, cantrip: true,
      classIds: ["bard", "sorcerer", "warlock", "wizard"],
      school: "abjuration", contexts: ["combat"],
      sinAffinity: "sinless", damageType: null,
      targetType: "self", targetingType: "self", attackWeight: 1, atkWeight: 1,
      isUnclashable: true, castingTime: "action",
      mechanics: {
        cantripRuntime: "blade_ward",
        combatStartStatus: { status: "blade_guard", damageReductionPercent: 20, expires: "turn_end" }
      },
      effects: []
    }),

    thorn_whip: Object.freeze({
      id: "thorn_whip", name: "Thorn Whip", nombre: "Thorn Whip",
      description: "On Hit, inflict (1 + Level/15) Bind and Rupture.",
      level: 0, spellLevel: 0, cantrip: true,
      classIds: ["artificer", "druid"],
      school: "transmutation", contexts: ["combat"],
      sinAffinity: "gluttony", damageType: "perforante",
      targetingType: "focused_attack", attackWeight: 1, atkWeight: 1,
      basePower: 5, coinPower: 4, coinAmount: 1, coins: 1,
      mechanics: {
        cantripRuntime: "thorn_whip",
        levelCoinPower: { every: 20, amount: 1 },
        onHitLevelStatuses: [
          { status: "bind", base: 1, every: 15, mode: "count" },
          { status: "rupture", base: 1, every: 15, mode: "potency" }
        ]
      },
      effects: []
    }),

    lightning_lure: Object.freeze({
      id: "lightning_lure", name: "Lightning Lure", nombre: "Lightning Lure",
      description: "On Hit, inflict (1 + Level/15) Bind and Shock.",
      level: 0, spellLevel: 0, cantrip: true,
      classIds: ["artificer", "sorcerer", "warlock", "wizard"],
      school: "evocation", contexts: ["combat"],
      sinAffinity: "wrath", damageType: "contundente",
      targetingType: "focused_attack", attackWeight: 1, atkWeight: 1,
      basePower: 5, coinPower: 5, coinAmount: 1, coins: 1,
      mechanics: {
        cantripRuntime: "lightning_lure",
        levelCoinPower: { every: 20, amount: 1 },
        onHitLevelStatuses: [
          { status: "bind", base: 1, every: 15, mode: "count" },
          { status: "shock", base: 1, every: 15, mode: "potency" }
        ]
      },
      effects: []
    }),

    infestation: Object.freeze({
      id: "infestation", name: "Infestation", nombre: "Infestation",
      description: "Summon Infestation. After the Summoner finishes an Attack Skill, it makes an Unopposed Attack against the same Target.",
      level: 0, spellLevel: 0, cantrip: true,
      classIds: ["druid", "sorcerer", "warlock", "wizard"],
      school: "conjuration", contexts: ["combat"],
      sinAffinity: "gluttony", damageType: null,
      targetType: "self", targetingType: "self", attackWeight: 1, atkWeight: 1,
      isUnclashable: true, castingTime: "action",
      mechanics: {
        cantripRuntime: "infestation",
        summon: { targetable: true, maxHpFormula: "max(10,10*SummonerSpellMod)", onePerSpell: true },
        summonSkill: {
          id: "infestation_swarm", name: "Swarm", resolution: "unopposed",
          attackWeight: 1, atkWeight: 1, basePower: 4, coinPowerFormula: "3+floor(SummonerLevel/20)", coinAmount: 1,
          trigger: "after_summoner_attack_skill",
          onHitStatusFormula: { status: "poison", potency: "1+floor(SummonerLevel/15)" }
        }
      },
      effects: []
    }),

    create_bonfire: Object.freeze({
      id: "create_bonfire", name: "Create Bonfire", nombre: "Create Bonfire",
      description: "Summon Bonfire. On Turn Start, its Burning Presence inflicts 1 Burn to all Enemies.",
      level: 0, spellLevel: 0, cantrip: true,
      classIds: ["artificer", "druid", "sorcerer", "warlock", "wizard"],
      school: "conjuration", contexts: ["combat"],
      sinAffinity: "wrath", damageType: null,
      targetType: "self", targetingType: "self", attackWeight: 1, atkWeight: 1,
      isUnclashable: true, castingTime: "action", concentration: true,
      mechanics: {
        cantripRuntime: "create_bonfire",
        summon: { targetable: true, maxHpFormula: "max(10,10*SummonerSpellMod)", onePerSpell: true, concentrationBound: true },
        aura: { id: "burning_presence", trigger: "turn_start", targets: "all_enemies", status: "burn", potency: 1 }
      },
      effects: []
    }),

    eldritch_blast: Object.freeze({
      id: "eldritch_blast", name: "Eldritch Blast", nombre: "Eldritch Blast",
      description: "Focused Volley: Reuse this Skill (Level/30) Times. Each Reuse may target the same or a different Target.",
      level: 0, spellLevel: 0, cantrip: true,
      classIds: ["warlock"],
      school: "evocation", contexts: ["combat"],
      sinAffinity: "gloom", damageType: "perforante",
      targetingType: "focused_attack", attackWeight: 1, atkWeight: 1,
      basePower: 5, coinPower: 5, coinAmount: 1, coins: 1,
      mechanics: {
        cantripRuntime: "eldritch_blast",
        reuseSkill: { base: 0, every: 30, maximum: 3, targeting: "same_or_different" }
      },
      effects: []
    }),

    acid_splash: Object.freeze({
      id: "acid_splash", name: "Acid Splash", nombre: "Acid Splash",
      description: "On Hit, inflict (1 + Level/15) Corrosion.",
      level: 0, spellLevel: 0, cantrip: true,
      classIds: ["artificer", "sorcerer", "wizard"],
      school: "evocation", contexts: ["combat"],
      sinAffinity: "gluttony", damageType: "perforante",
      targetingType: "area", attackWeight: 3, atkWeight: 3,
      basePower: 4, coinPower: 5, coinAmount: 1, coins: 1,
      mechanics: {
        cantripRuntime: "acid_splash",
        levelCoinPower: { every: 20, amount: 1 },
        onHitLevelStatus: { status: "corrosion", base: 1, every: 15, mode: "count" }
      },
      effects: []
    }),

    ray_of_frost: Object.freeze({
      id: "ray_of_frost", name: "Ray of Frost", nombre: "Ray of Frost",
      description: "On Hit, inflict 2 Bind and (1 + Level/15) Chill.",
      level: 0, spellLevel: 0, cantrip: true,
      classIds: ["artificer", "sorcerer", "wizard"],
      school: "evocation", contexts: ["combat"],
      sinAffinity: "gloom", damageType: "perforante",
      targetingType: "focused_attack", attackWeight: 1, atkWeight: 1,
      basePower: 5, coinPower: 5, coinAmount: 1, coins: 1,
      mechanics: {
        cantripRuntime: "ray_of_frost",
        levelCoinPower: { every: 20, amount: 1 },
        onHitStatus: { status: "bind", count: 2 },
        onHitLevelStatus: { status: "chill", base: 1, every: 15, mode: "count" }
      },
      effects: []
    }),

    frostbite: Object.freeze({
      id: "frostbite", name: "Frostbite", nombre: "Frostbite",
      description: "On Hit, inflict 1 Attack Power Down and (1 + Level/15) Chill.",
      level: 0, spellLevel: 0, cantrip: true,
      classIds: ["druid", "sorcerer", "warlock", "wizard"],
      school: "evocation", contexts: ["combat"],
      sinAffinity: "gloom", damageType: "perforante",
      targetingType: "focused_attack", attackWeight: 1, atkWeight: 1,
      basePower: 5, coinPower: 4, coinAmount: 1, coins: 1,
      mechanics: {
        cantripRuntime: "frostbite",
        levelCoinPower: { every: 20, amount: 1 },
        onHitStatus: { status: "attack_power_down", count: 1 },
        onHitLevelStatus: { status: "chill", base: 1, every: 15, mode: "count" }
      },
      effects: []
    }),

    sacred_flame: Object.freeze({
      id: "sacred_flame", name: "Sacred Flame", nombre: "Sacred Flame",
      description: "On Hit, inflict (1 + Level/15) Radiance.",
      level: 0, spellLevel: 0, cantrip: true,
      classIds: ["cleric"],
      school: "evocation", contexts: ["combat"],
      sinAffinity: "pride", damageType: "perforante",
      targetingType: "focused_attack", attackWeight: 1, atkWeight: 1,
      basePower: 5, coinPower: 5, coinAmount: 1, coins: 1,
      mechanics: {
        cantripRuntime: "sacred_flame",
        levelCoinPower: { every: 20, amount: 1 },
        onHitLevelStatus: { status: "radiance", base: 1, every: 15, mode: "count" }
      },
      effects: []
    }),

    shocking_grasp: Object.freeze({
      id: "shocking_grasp", name: "Shocking Grasp", nombre: "Shocking Grasp",
      description: "Does not trigger Counter. On Hit, inflict (1 + Level/15) Shock.",
      level: 0, spellLevel: 0, cantrip: true,
      classIds: ["artificer", "sorcerer", "wizard"],
      school: "evocation", contexts: ["combat"],
      sinAffinity: "envy", damageType: "contundente",
      targetingType: "focused_attack", attackWeight: 1, atkWeight: 1,
      basePower: 5, coinPower: 5, coinAmount: 1, coins: 1,
      mechanics: {
        cantripRuntime: "shocking_grasp",
        levelCoinPower: { every: 20, amount: 1 },
        suppressCounter: true,
        onHitLevelStatus: { status: "shock", base: 1, every: 15, mode: "count" }
      },
      effects: []
    }),

    toll_the_dead: Object.freeze({
      id: "toll_the_dead", name: "Toll the Dead", nombre: "Toll the Dead",
      description: "Deal +(20 + Level/5)% Damage against Units below their Max HP. On Hit, inflict (1 + Level/15) Decay.",
      level: 0, spellLevel: 0, cantrip: true,
      classIds: ["cleric", "warlock", "wizard"],
      school: "necromancy", contexts: ["combat"],
      sinAffinity: "gloom", damageType: "perforante",
      targetingType: "focused_attack", attackWeight: 1, atkWeight: 1,
      basePower: 5, coinPower: 4, coinAmount: 1, coins: 1,
      mechanics: {
        cantripRuntime: "toll_the_dead",
        levelCoinPower: { every: 20, amount: 1 },
        woundedTargetDamagePercent: { base: 20, every: 5, amount: 1 },
        onHitLevelStatus: { status: "decay", base: 1, every: 15, mode: "count" }
      },
      effects: []
    }),

    word_of_radiance: Object.freeze({
      id: "word_of_radiance", name: "Word of Radiance", nombre: "Word of Radiance",
      description: "On Hit, inflict (1 + Level/15) Radiance.",
      level: 0, spellLevel: 0, cantrip: true,
      classIds: ["cleric"],
      school: "evocation", contexts: ["combat"],
      sinAffinity: "pride", damageType: "perforante",
      targetingType: "area", attackWeight: 3, atkWeight: 3,
      basePower: 4, coinPower: 5, coinAmount: 1, coins: 1,
      mechanics: {
        cantripRuntime: "word_of_radiance",
        levelCoinPower: { every: 20, amount: 1 },
        onHitLevelStatus: { status: "radiance", base: 1, every: 15, mode: "count" }
      },
      effects: []
    }),

    thunderclap: Object.freeze({
      id: "thunderclap", name: "Thunderclap", nombre: "Thunderclap",
      description: "On Hit, inflict (1 + Level/15) Tremor.",
      level: 0, spellLevel: 0, cantrip: true,
      classIds: ["artificer", "bard", "druid", "sorcerer", "warlock", "wizard"],
      school: "evocation", contexts: ["combat"],
      sinAffinity: "wrath", damageType: "contundente",
      targetingType: "area", attackWeight: 3, atkWeight: 3,
      basePower: 4, coinPower: 5, coinAmount: 1, coins: 1,
      mechanics: {
        cantripRuntime: "thunderclap",
        levelCoinPower: { every: 20, amount: 1 },
        onHitLevelStatus: { status: "tremor", base: 1, every: 15, mode: "potency" }
      },
      effects: []
    }),

    sapping_sting: Object.freeze({
      id: "sapping_sting", name: "Sapping Sting", nombre: "Sapping Sting",
      description: "CON Save. On Failed Save, resolve this Skill as Unopposed. On Hit, inflict Prone and (1 + Level/15) Decay.",
      level: 0, spellLevel: 0, cantrip: true,
      classIds: ["wizard"],
      school: "necromancy", contexts: ["combat"],
      sinAffinity: "gloom", damageType: "perforante",
      targetingType: "focused_attack", attackWeight: 1, atkWeight: 1,
      basePower: 5, coinPower: 3, coinAmount: 1, coins: 1,
      isUnclashable: true,
      save: { abilityId: "con", onSuccess: "negates" },
      mechanics: {
        cantripRuntime: "sapping_sting",
        levelCoinPower: { every: 20, amount: 1 },
        saveAttackOnFailure: true,
        onHitStatus: { status: "prone", count: 1 },
        onHitLevelStatus: { status: "decay", base: 1, every: 15, mode: "count" }
      },
      effects: []
    }),

    primal_savagery: Object.freeze({
      id: "primal_savagery", name: "Primal Savagery", nombre: "Primal Savagery",
      description: "On Hit, inflict (1 + Level/15) Corrosion.",
      level: 0, spellLevel: 0, cantrip: true,
      classIds: ["druid"],
      school: "transmutation", contexts: ["combat"],
      sinAffinity: "gluttony", damageType: "perforante",
      targetingType: "focused_attack", attackWeight: 1, atkWeight: 1,
      basePower: 5, coinPower: 6, coinAmount: 1, coins: 1,
      mechanics: {
        cantripRuntime: "primal_savagery",
        levelCoinPower: { every: 20, amount: 1 },
        onHitLevelStatus: { status: "corrosion", base: 1, every: 15, mode: "count" }
      },
      effects: []
    }),

    sword_burst: Object.freeze({
      id: "sword_burst", name: "Sword Burst", nombre: "Sword Burst",
      description: "Gain Sword Burst this Turn. After each Clash, deal 3 Force Fixed Damage to the opposing Unit. Once per Clash.",
      level: 0, spellLevel: 0, cantrip: true,
      classIds: ["artificer", "sorcerer", "warlock", "wizard"],
      school: "conjuration", contexts: ["combat"],
      sinAffinity: "sinless", damageType: null,
      targetType: "self", targetingType: "self", attackWeight: 1, atkWeight: 1,
      isUnclashable: true, castingTime: "quick_action",
      mechanics: {
        cantripRuntime: "sword_burst",
        onUseStatus: { status: "sword_burst", count: 1, expires: "turn_end" },
        afterClashFixedDamage: 3,
        oncePerClash: true
      },
      effects: []
    }),

    dancing_lights: Object.freeze({
      id: "dancing_lights", name: "Dancing Lights", nombre: "Dancing Lights",
      description: "Distribute 4 Dancing Lights among yourself and Allies. Each holder ignores Darkness Disadvantage. One per Unit.",
      level: 0, spellLevel: 0, cantrip: true,
      classIds: ["bard", "sorcerer", "wizard"],
      school: "illusion", contexts: ["combat", "theater"],
      sinAffinity: "pride", damageType: null,
      targetType: "multi", targetingType: "multi", attackWeight: 4, atkWeight: 4,
      isUnclashable: true, castingTime: "action", concentration: true,
      mechanics: {
        cantripRuntime: "dancing_lights",
        lightCount: 4,
        onePerUnit: true,
        darknessDisadvantageOverride: true,
        concentrationBound: true
      },
      effects: []
    }),

    light: Object.freeze({
      id: "light", name: "Light", nombre: "Light",
      description: "Grant Light to one Unit or an Object carried by a Unit. This Unit and its Adjacent Units ignore Darkness Disadvantage.",
      level: 0, spellLevel: 0, cantrip: true,
      classIds: ["artificer", "bard", "cleric", "sorcerer", "wizard"],
      school: "evocation", contexts: ["combat", "theater"],
      sinAffinity: "pride", damageType: null,
      targetType: "allies", targetingType: "allies", attackWeight: 1, atkWeight: 1,
      isUnclashable: true, castingTime: "action",
      mechanics: {
        cantripRuntime: "light",
        status: { id: "light", uniquePerCaster: true },
        adjacentRule: "speed_order",
        darknessDisadvantageOverride: true
      },
      effects: []
    }),

    mending: Object.freeze({
      id: "mending", name: "Mending", nombre: "Mending",
      description: "Touch one Item or Repairable Unit. Item: restore 1 Durability. Repairable Unit: restore 5 HP.",
      level: 0, spellLevel: 0, cantrip: true,
      classIds: ["artificer", "bard", "cleric", "druid", "sorcerer", "wizard"],
      school: "transmutation", contexts: ["combat", "theater"],
      sinAffinity: "gluttony", damageType: null,
      targetType: "special", targetingType: "special", attackWeight: 1, atkWeight: 1,
      isUnclashable: true, castingTime: "1_minute", castingTimeSeconds: 60,
      mechanics: {
        cantripRuntime: "mending",
        itemDurabilityRepair: 1,
        repairableUnitHpRepair: 5,
        cannotRestore: ["quality", "charges", "spent_magic"]
      },
      effects: []
    }),

    druidcraft: Object.freeze({
      id: "druidcraft", name: "Druidcraft", nombre: "Druidcraft",
      description: "Forecast the next 24 hours of Natural Weather, bloom a small plant, create a harmless natural sensory effect, or light/extinguish a Small Nonmagical Fire.",
      level: 0, spellLevel: 0, cantrip: true,
      classIds: ["druid"],
      school: "transmutation", contexts: ["combat", "theater"],
      sinAffinity: "gluttony", damageType: null,
      targetType: "special", targetingType: "special", attackWeight: 1, atkWeight: 1,
      isUnclashable: true, castingTime: "action", rangeFeet: 30,
      mechanics: {
        cantripRuntime: "druidcraft",
        requiresChoice: { key: "druidcraftMode", values: ["forecast", "bloom", "nature_trick", "fire_play"] },
        forecastHours: 24,
        bloom: { smallPlantOnly: true, createsResources: false },
        natureTrick: { harmless: true },
        firePlay: { smallOnly: true, nonmagicalOnly: true }
      },
      effects: []
    }),

    control_flames: Object.freeze({
      id: "control_flames", name: "Control Flames", nombre: "Control Flames",
      description: "Feed or suppress Burn, extinguish or shape a Small Nonmagical Fire, or make its Adjacent Units ignore Darkness Disadvantage.",
      level: 0, spellLevel: 0, cantrip: true,
      classIds: ["druid", "sorcerer", "wizard"],
      school: "transmutation", contexts: ["combat", "theater"],
      sinAffinity: "wrath", damageType: null,
      targetType: "special", targetingType: "special", attackWeight: 1, atkWeight: 1,
      isUnclashable: true, castingTime: "action",
      mechanics: {
        cantripRuntime: "control_flames",
        requiresChoice: { key: "controlFlamesMode", values: ["feed_potency", "feed_count", "suppress_potency", "suppress_count", "extinguish", "control_light", "shape"] },
        burnAmountFormula: "1+floor(Level/30)",
        lightRule: "adjacent_only",
        nonmagicalFireOnly: true
      },
      effects: []
    }),

    gust: Object.freeze({
      id: "gust", name: "Gust", nombre: "Gust",
      description: "Choose Push, Move Object, or Wind Trick. Push: STR Save; on failure inflict (2 + Level/20) Bind.",
      level: 0, spellLevel: 0, cantrip: true,
      classIds: ["druid", "sorcerer", "wizard"],
      school: "transmutation", contexts: ["combat", "theater"],
      sinAffinity: "sloth", damageType: null,
      targetType: "special", targetingType: "special", attackWeight: 1, atkWeight: 1,
      isUnclashable: true, castingTime: "action",
      save: { abilityId: "str", onSuccess: "negates" },
      mechanics: {
        cantripRuntime: "gust",
        requiresChoice: { key: "gustMode", values: ["push", "move_object", "wind_trick"] },
        bindFormula: "2+floor(Level/20)"
      },
      effects: []
    }),

    mold_earth: Object.freeze({
      id: "mold_earth", name: "Mold Earth", nombre: "Mold Earth",
      description: "Excavate loose earth, mark earth or stone, or create Molded Terrain for 1 hour.",
      level: 0, spellLevel: 0, cantrip: true,
      classIds: ["druid", "sorcerer", "wizard"],
      school: "transmutation", contexts: ["combat", "theater"],
      sinAffinity: "sloth", damageType: null,
      targetType: "special", targetingType: "special", attackWeight: 1, atkWeight: 1,
      isUnclashable: true, castingTime: "action",
      mechanics: {
        cantripRuntime: "mold_earth",
        requiresChoice: { key: "moldEarthMode", values: ["excavate", "mark", "difficult_terrain"] },
        terrain: { id: "molded_terrain", durationSeconds: 3600, maxActive: 2, slowestEnemies: 3, status: "bind", amount: 2, noStackSameTurn: true }
      },
      effects: []
    }),

    shape_water: Object.freeze({
      id: "shape_water", name: "Shape Water", nombre: "Shape Water",
      description: "Move or reshape water, or freeze it into Icy Terrain for 1 hour.",
      level: 0, spellLevel: 0, cantrip: true,
      classIds: ["druid", "sorcerer", "wizard"],
      school: "transmutation", contexts: ["combat", "theater"],
      sinAffinity: "gloom", damageType: null,
      targetType: "special", targetingType: "special", attackWeight: 1, atkWeight: 1,
      isUnclashable: true, castingTime: "action",
      mechanics: {
        cantripRuntime: "shape_water",
        requiresChoice: { key: "shapeWaterMode", values: ["flow", "shape", "freeze"] },
        terrain: { id: "icy_terrain", durationSeconds: 3600, maxActive: 2, slowestEnemies: 3, status: "chill", amount: 2, noStackSameTurn: true }
      },
      effects: []
    }),

    friends: Object.freeze({
      id: "friends", name: "Friends", nombre: "Friends",
      description: "One Humanoid makes a WIS Save. On failure, inflict Charmed - Magic while Concentration lasts.",
      level: 0, spellLevel: 0, cantrip: true,
      classIds: ["bard", "sorcerer", "warlock", "wizard"],
      school: "enchantment", contexts: ["combat", "theater"],
      sinAffinity: "lust", damageType: null,
      targetType: "single", targetingType: "single", attackWeight: 1, atkWeight: 1,
      isUnclashable: true, castingTime: "action", concentration: true,
      save: { abilityId: "wis", onSuccess: "negates" },
      mechanics: {
        cantripRuntime: "friends",
        humanoidOnly: true,
        cannotAffectCurrentHostile: true,
        repeatImmunitySeconds: 86400,
        condition: { id: "charmed", removalMode: "concentration" }
      },
      effects: []
    }),

    encode_thoughts: Object.freeze({
      id: "encode_thoughts", name: "Encode Thoughts", nombre: "Encode Thoughts",
      description: "Create one Thought Strand Temporary Item containing a Memory, Idea, or Message. It lasts 8 hours.",
      level: 0, spellLevel: 0, cantrip: true,
      classIds: ["wizard"],
      school: "enchantment", contexts: ["combat", "theater"],
      sinAffinity: "gloom", damageType: null,
      targetType: "self", targetingType: "self", attackWeight: 1, atkWeight: 1,
      isUnclashable: true, castingTime: "action",
      mechanics: {
        cantripRuntime: "encode_thoughts",
        temporaryItem: { id: "thought_strand", durationSeconds: 28800, uniquePerCaster: true, readableBy: ["encode_thoughts", "thought_reading"] }
      },
      effects: []
    }),

    guidance: Object.freeze({
      id: "guidance", name: "Guidance", nombre: "Guidance",
      description: "Choose one willing Unit and one Skill. While Concentration lasts, gain +2 Final Power on Checks using that Skill.",
      level: 0, spellLevel: 0, cantrip: true,
      classIds: ["artificer", "cleric", "druid"],
      school: "divination", contexts: ["combat", "theater"],
      sinAffinity: "pride", damageType: null,
      targetType: "allies", targetingType: "allies", attackWeight: 1, atkWeight: 1,
      isUnclashable: true, castingTime: "action", concentration: true,
      mechanics: {
        cantripRuntime: "guidance",
        requiresChoice: { key: "guidanceSkill", values: ["acrobatics", "animal_handling", "arcana", "athletics", "deception", "history", "insight", "intimidation", "investigation", "medicine", "nature", "perception", "performance", "persuasion", "religion", "sleight_of_hand", "stealth", "survival"] },
        checkFinalPower: 2
      },
      effects: []
    }),

    resistance: Object.freeze({
      id: "resistance", name: "Resistance", nombre: "Resistance",
      description: "Choose one Sin Type or Elemental Status Effect. While Concentration lasts, resist that choice once per Turn.",
      level: 0, spellLevel: 0, cantrip: true,
      classIds: ["artificer", "cleric", "druid"],
      school: "abjuration", contexts: ["combat"],
      sinAffinity: "pride", damageType: null,
      targetType: "allies", targetingType: "allies", attackWeight: 1, atkWeight: 1,
      isUnclashable: true, castingTime: "action", concentration: true,
      mechanics: {
        cantripRuntime: "resistance",
        requiresChoice: { key: "resistanceChoice", values: ["sin_wrath", "sin_lust", "sin_sloth", "sin_gluttony", "sin_gloom", "sin_pride", "sin_envy", "status_burn", "status_chill", "status_shock", "status_corrosion", "status_poison", "status_decay", "status_radiance", "status_sinking", "status_tremor"] },
        sinDamageReductionPercent: 20,
        elementalStatusReduction: 1,
        oncePerTurn: true
      },
      effects: []
    }),

    spare_the_dying: Object.freeze({
      id: "spare_the_dying", name: "Spare the Dying", nombre: "Spare the Dying",
      description: "Choose one Downed Unit. That Unit becomes Stable.",
      level: 0, spellLevel: 0, cantrip: true,
      classIds: ["artificer", "cleric"],
      school: "necromancy", contexts: ["combat"],
      sinAffinity: "pride", damageType: null,
      targetType: "allies", targetingType: "allies", attackWeight: 1, atkWeight: 1,
      isUnclashable: true, castingTime: "action",
      mechanics: { cantripRuntime: "spare_the_dying", deathSaveState: "stable" },
      effects: []
    }),

    message: Object.freeze({
      id: "message", name: "Message", nombre: "Message",
      description: "Send a private Message to one known Unit. Only the target can hear it, and it may immediately send one private Reply.",
      level: 0, spellLevel: 0, cantrip: true,
      classIds: ["artificer", "bard", "sorcerer", "wizard"],
      school: "transmutation", contexts: ["combat", "theater"],
      sinAffinity: "gloom", damageType: null,
      targetType: "single", targetingType: "single", attackWeight: 1, atkWeight: 1,
      isUnclashable: true, castingTime: "action",
      mechanics: { cantripRuntime: "message", privateCommunication: true, allowsImmediateReply: true, blockedByMagicalSilence: true },
      effects: []
    }),

    thaumaturgy: Object.freeze({
      id: "thaumaturgy", name: "Thaumaturgy", nombre: "Thaumaturgy",
      description: "Choose Booming Voice, Altered Eyes, Fire Play, Invisible Hand, Phantom Sound, or Tremors.",
      level: 0, spellLevel: 0, cantrip: true,
      classIds: ["cleric"],
      school: "transmutation", contexts: ["combat", "theater"],
      sinAffinity: "pride", damageType: null,
      targetType: "special", targetingType: "special", attackWeight: 1, atkWeight: 1,
      isUnclashable: true, castingTime: "action",
      mechanics: {
        cantripRuntime: "thaumaturgy",
        requiresChoice: { key: "thaumaturgyMode", values: ["booming_voice", "altered_eyes", "fire_play", "invisible_hand", "phantom_sound", "tremors"] },
        boomingVoice: { skill: "intimidation", finalPower: 2, durationSeconds: 60 },
        maxMaintainedEffects: 3
      },
      effects: []
    }),

    mage_hand: Object.freeze({
      id: "mage_hand", name: "Mage Hand", nombre: "Mage Hand",
      description: "Create a Mage Hand Background Unit for 1 minute. It can manipulate small Objects but cannot Attack or activate Magic Items.",
      level: 0, spellLevel: 0, cantrip: true,
      classIds: ["artificer", "bard", "sorcerer", "warlock", "wizard"],
      school: "conjuration", contexts: ["combat", "theater"],
      sinAffinity: "sloth", damageType: null,
      targetType: "self", targetingType: "self", attackWeight: 1, atkWeight: 1,
      isUnclashable: true, castingTime: "action",
      mechanics: {
        cantripRuntime: "mage_hand",
        entity: { kind: "background_unit", durationSeconds: 60, onePerCaster: true, canAttack: false, canActivateMagicItems: false }
      },
      effects: []
    }),

    prestidigitation: Object.freeze({
      id: "prestidigitation", name: "Prestidigitation", nombre: "Prestidigitation",
      description: "Choose Sensory Trick, Fire Play, Clean or Soil, Minor Sensation, Magic Mark, or Minor Creation.",
      level: 0, spellLevel: 0, cantrip: true,
      classIds: ["artificer", "bard", "sorcerer", "warlock", "wizard"],
      school: "transmutation", contexts: ["combat", "theater"],
      sinAffinity: "gloom", damageType: null,
      targetType: "special", targetingType: "special", attackWeight: 1, atkWeight: 1,
      isUnclashable: true, castingTime: "action",
      mechanics: {
        cantripRuntime: "prestidigitation",
        requiresChoice: { key: "prestidigitationMode", values: ["sensory_trick", "fire_play", "clean_or_soil", "minor_sensation", "magic_mark", "minor_creation"] },
        oneHourModes: ["minor_sensation", "magic_mark"],
        minorCreation: { durationSeconds: 6, handSizedOnly: true, noMonetaryValue: true, cannotDealDamage: true },
        maxMaintainedEffects: 3
      },
      effects: []
    }),

    magic_stone: Object.freeze({
      id: "magic_stone", name: "Magic Stone", nombre: "Magic Stone",
      description: "Create 3 Magic Stones for 1 minute. Each can be Given, Thrown, or used as Sling Ammo. On Hit, deal (2 + Enchanter's Spell Mod) Blunt Damage.",
      level: 0, spellLevel: 0, cantrip: true,
      classIds: ["druid", "warlock"],
      school: "transmutation", contexts: ["combat", "theater"],
      sinAffinity: "sloth", damageType: "contundente",
      targetType: "self", targetingType: "self", attackWeight: 1, atkWeight: 1,
      isUnclashable: true, castingTime: "quick_action",
      mechanics: {
        cantripRuntime: "magic_stone",
        temporaryAmmo: { id: "magic_stone", quantity: 3, durationSeconds: 60, slingAmmo: true, throwable: true },
        damageFormula: "2+EnchanterSpellMod"
      },
      effects: []
    }),

    alarm: Object.freeze({
      id: "alarm", name: "Alarm", nombre: "Alarma",
      description: "Ward a door, window, or compact area for 8 hours. Choose audible or mental alert and creatures that do not trigger it.",
      level: 1, spellLevel: 1, cantrip: false,
      classIds: ["artificer", "ranger", "wizard"],
      school: "abjuration", contexts: ["theater"],
      sinAffinity: "sloth", damageType: null,
      targetType: "area", targetingType: "area", attackWeight: 1, atkWeight: 1,
      castingTime: "1_minute", ritual: true, resolutionType: "automatic",
      mechanics: {
        level1Runtime: "alarm",
        ritual: true,
        durationHours: 8,
        area: "compact_zone",
        modes: ["audible", "mental"],
        designatedCreatureExemptions: true,
        triggersOnEntryOrTouch: true
      },
      effects: [{ type: "level1_alarm" }]
    }),

    armor_of_agathys: Object.freeze({
      id: "armor_of_agathys", name: "Armor of Agathys", nombre: "Armadura de Agathys",
      description: "Quick Action. Gain Encounter Shield equal to 5 × Slot Level. While the spell remains active, a Melee attacker that damages you takes Cold damage equal to 5 × Slot Level.",
      level: 1, spellLevel: 1, cantrip: false,
      classIds: ["warlock"],
      school: "abjuration", contexts: ["combat"],
      sinAffinity: "gloom", damageType: null,
      targetType: "self", targetingType: "self", attackWeight: 1, atkWeight: 1,
      castingTime: "quick_action", resolutionType: "automatic",
      mechanics: {
        level1Runtime: "armor_of_agathys",
        shieldPerSlotLevel: 5,
        retaliationDamagePerSlotLevel: 5,
        retaliationDamageType: "cold",
        shieldDuration: "encounter",
        endsWhenNoShield: true
      },
      effects: [{ type: "level1_armor_of_agathys" }]
    }),

    arms_of_hadar: Object.freeze({
      id: "arms_of_hadar", name: "Arms of Hadar", nombre: "Brazos de Hadar",
      description: "STR Save. On Failed Save, resolve as Unopposed. On Hit, inflict Decay and suppress Reactions until the target's next Turn.",
      level: 1, spellLevel: 1, cantrip: false,
      classIds: ["warlock"],
      school: "conjuration", contexts: ["combat"],
      sinAffinity: "gloom", damageType: "perforante",
      targetType: "area", targetingType: "aoe", attackWeight: 3, atkWeight: 3,
      isIndiscriminate: true, isUnclashable: true,
      basePower: 4, coinPower: 6, coinAmount: 1, coins: 1,
      save: { abilityId: "str", onSuccess: "negates" },
      mechanics: {
        level1Runtime: "arms_of_hadar",
        saveAttackOnFailure: true,
        suppressReactionOnFailedSave: true,
        onHitStatus: { status: "decay", count: 2 }
      },
      upcast: { coinPowerPerLevel: 1 },
      effects: []
    }),

    bane: Object.freeze({
      id: "bane", name: "Bane", nombre: "Perdición",
      description: "CHA Save. Up to 3 targets that fail gain -2 Final Power while you maintain Concentration. Higher Slots add targets.",
      level: 1, spellLevel: 1, cantrip: false,
      classIds: ["bard", "cleric", "warlock"],
      school: "enchantment", contexts: ["combat"],
      sinAffinity: "gloom", damageType: null,
      targetType: "multi", targetingType: "multi", attackWeight: 3, atkWeight: 3,
      isUnclashable: true, concentration: true,
      save: { abilityId: "cha", onSuccess: "negates" },
      mechanics: {
        level1Runtime: "bane",
        onFailedSaveStatus: "bane",
        finalPowerModifier: -2,
        durationTurns: 10
      },
      upcast: { atkWeightPerLevel: 1 },
      effects: []
    }),

    bless: Object.freeze({
      id: "bless", name: "Bless", nombre: "Bendición",
      description: "Up to 3 allies gain +2 Final Power while you maintain Concentration. Higher Slots add targets.",
      level: 1, spellLevel: 1, cantrip: false,
      classIds: ["cleric", "paladin"],
      school: "enchantment", contexts: ["combat"],
      sinAffinity: "pride", damageType: null,
      targetType: "allies", targetingType: "multi", attackWeight: 3, atkWeight: 3,
      isUnclashable: true, concentration: true, resolutionType: "automatic",
      mechanics: {
        level1Runtime: "bless",
        status: "bless",
        finalPowerModifier: 2,
        durationTurns: 10
      },
      upcast: { atkWeightPerLevel: 1 },
      effects: [{ type: "level1_bless" }]
    }),

    burning_hands: Object.freeze({
      id: "burning_hands", name: "Burning Hands", nombre: "Manos Ardientes",
      description: "DEX Save. On Failed Save, resolve as Unopposed. On Hit, inflict 2 Burn.",
      level: 1, spellLevel: 1, cantrip: false,
      classIds: ["sorcerer", "wizard"],
      school: "evocation", contexts: ["combat"],
      sinAffinity: "wrath", damageType: "perforante",
      targetType: "area", targetingType: "aoe", attackWeight: 3, atkWeight: 3,
      isUnclashable: true,
      basePower: 5, coinPower: 7, coinAmount: 1, coins: 1,
      save: { abilityId: "dex", onSuccess: "negates" },
      mechanics: {
        level1Runtime: "burning_hands",
        saveAttackOnFailure: true,
        onHitStatus: { status: "burn", potency: 2 }
      },
      upcast: { coinPowerPerLevel: 1 },
      effects: []
    }),

    create_or_destroy_water: Object.freeze({
      id: "create_or_destroy_water", name: "Create or Destroy Water", nombre: "Crear o Destruir Agua",
      description: "Automatic utility spell. Combat: set Rain or temporarily suppress Fog. Theater: create/destroy water, create rain, or clear fog.",
      level: 1, spellLevel: 1, cantrip: false,
      classIds: ["cleric", "druid"],
      school: "transmutation", contexts: ["combat", "theater"],
      sinAffinity: "sinless", damageType: null,
      targetType: "environment", targetingType: "environment", attackWeight: 1, atkWeight: 1,
      isUnclashable: true, castingTime: "action", concentration: false, ritual: false,
      resolutionType: "automatic",
      mechanics: {
        level1Runtime: "create_or_destroy_water",
        requiresChoice: { key: "mode", values: ["create_water", "destroy_water", "rain", "destroy_fog"] },
        combat: {
          allowedModes: ["rain", "destroy_fog"],
          rain: { encounterModifierId: "rain" },
          destroyFog: {
            suppressEncounterModifiers: { light_fog: 5, heavy_fog: 2 },
            restoreOriginalFogAfterSuppression: true
          }
        },
        theater: {
          allowedModes: ["create_water", "destroy_water", "rain", "destroy_fog"],
          createWater: { gallonsAtSlotLevel1: 10, cleanWater: true, requiresOpenContainer: true },
          destroyWater: { gallonsAtSlotLevel1: 10, requiresOpenContainer: true },
          rain: { createLocalRain: true },
          destroyFog: { temporarilyClearFog: true }
        }
      },
      upcast: {
        gallonsPerLevelAbove1: 10,
        rainAreaIncreasesPerLevel: true,
        destroyFogAreaIncreasesPerLevel: true
      },
      effects: []
    }),

    cure_wounds: Object.freeze({
      id: "cure_wounds", name: "Cure Wounds", nombre: "Curar Heridas",
      description: "Heal (2 × Spell Slot Used) + (2, 2 × Spell Mod)% Max HP.",
      level: 1, spellLevel: 1, cantrip: false,
      classIds: ["bard", "cleric", "druid", "paladin", "ranger"],
      school: "abjuration", contexts: ["combat"],
      sinAffinity: "sinless", damageType: null,
      targetType: "allies", targetingType: "single", attackWeight: 1, atkWeight: 1,
      isUnclashable: true, castingTime: "action", concentration: false, ritual: false,
      resolutionType: "automatic",
      mechanics: {
        level1Runtime: "cure_wounds",
        canTargetSelf: true,
        healing: {
          flatPerSpellSlotUsed: 2,
          maxHpPercent: { minimum: 2, perSpellMod: 2 }
        }
      },
      effects: [{ type: "level1_cure_wounds" }]
    }),

    charm_person: Object.freeze({
      id: "charm_person", name: "Charm Person", nombre: "Hechizar Persona",
      level: 1, spellLevel: 1, cantrip: false,
      classIds: ["bard", "druid", "sorcerer", "warlock", "wizard"],
      school: "enchantment", contexts: ["combat", "theater"],
      sinAffinity: "lust", damageType: null,
      targetingType: "multi", targetType: "multi", attackWeight: 1, atkWeight: 1,
      isUnclashable: true,
      save: { abilityId: "wis", onSuccess: "negates" },
      concentration: false,
      mechanics: {
        targetRequirement: { creatureType: "humanoid", mustSeeCaster: true },
        saveAdvantageWhenFightingCasterOrAllies: true,
        onFailedSave: status("on_failed_save", "charmed", 0, 10),
        breakCharmOnDamageFromCasterOrAlly: true,
        theaterDuration: "1_hour",
        targetKnowsWhenSpellEnds: true
      },
      upcast: { atkWeightPerLevel: 1 },
      effects: []
    }),

    chromatic_orb: Object.freeze({
      id: "chromatic_orb", name: "Chromatic Orb", nombre: "Orbe Cromático",
      level: 1, spellLevel: 1, cantrip: false,
      classIds: ["sorcerer", "wizard"],
      school: "evocation", contexts: ["combat"],
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
      classIds: ["bard"],
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

    silvery_barbs: Object.freeze({
      id: "silvery_barbs", name: "Silvery Barbs", nombre: "Púas Plateadas",
      level: 1, spellLevel: 1, cantrip: false,
      classIds: ["bard", "sorcerer", "wizard"],
      school: "enchantment", contexts: ["combat"],
      sinAffinity: "sinless", damageType: null,
      targetingType: "multi", targetType: "multi", attackWeight: 2, atkWeight: 2,
      isUnclashable: true, castingTime: "reaction",
      mechanics: {
        trigger: "combat_start", distinctTargets: true,
        badTarget: status("on_combat_start", "silvery_barbs_bad", 0, 1),
        goodTarget: status("on_combat_start", "silvery_barbs_good", 0, 1),
        finalPower: { bad: -2, good: 2 },
        consumeOn: ["clash_end", "save_end", "check_end"]
      },
      effects: []
    }),

    expeditious_retreat: Object.freeze({
      id: "expeditious_retreat", name: "Expeditious Retreat", nombre: "Retirada Expeditiva",
      level: 1, spellLevel: 1, cantrip: false,
      classIds: ["artificer", "sorcerer", "warlock", "wizard"],
      school: "transmutation", contexts: ["combat"],
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
      classIds: ["bard", "druid", "ranger"],
      school: "enchantment", contexts: ["combat", "theater"],
      sinAffinity: "lust", damageType: null,
      targetingType: "multi", targetType: "multi", attackWeight: 1, atkWeight: 1,
      isUnclashable: true, save: { abilityId: "wis", onSuccess: "negates" },
      concentration: false,
      mechanics: {
        targetRequirement: { creatureType: "beast", mustSeeCaster: true },
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

    calm_emotions: Object.freeze({
      id: "calm_emotions", name: "Calm Emotions", nombre: "Calmar Emociones",
      level: 2, spellLevel: 2, cantrip: false,
      classIds: ["bard", "cleric"],
      school: "enchantment", contexts: ["combat"],
      sinAffinity: "sinless", damageType: null,
      targetingType: "aoe", targetType: "all_deployed", attackWeight: 0, atkWeight: 0,
      isUnclashable: true, save: { abilityId: "cha", onSuccess: "negates", enemyOnly: true },
      concentration: true,
      mechanics: {
        trigger: "turn_start", targets: "all_deployed", indiscriminate: true,
        allies: { resetSpTo: 0, removeStatuses: ["charmed", "frightened"] },
        enemies: { saveAbility: "cha", onFailure: { resetSpTo: 0, removeStatuses: ["charmed", "frightened"] } },
        duration: "concentration_slot"
      },
      effects: []
    }),

    mirror_image: Object.freeze({
      id: "mirror_image", name: "Mirror Image", nombre: "Imagen Múltiple",
      level: 2, spellLevel: 2, cantrip: false,
      classIds: ["sorcerer", "warlock", "wizard"],
      school: "illusion", contexts: ["combat"],
      sinAffinity: "sinless", damageType: null,
      targetType: "self", targetingType: "self", attackWeight: 1, atkWeight: 1,
      isUnclashable: true, concentration: false,
      mechanics: {
        onUse: status("on_use", "mirror_image", 3, 10, "self", { mode: "set" }),
        beforeGettingHit: { consumePotency: 1, defense: "evade", defensePowerBonus: 50, perHit: true },
        onTurnEnd: { loseCount: 1 },
        onEncounterEnd: { removeStatus: "mirror_image" }
      },
      effects: []
    }),

    hold_person: Object.freeze({
      id: "hold_person", name: "Hold Person", nombre: "Inmovilizar Persona",
      level: 2, spellLevel: 2, cantrip: false,
      classIds: ["bard", "cleric", "druid", "sorcerer", "warlock", "wizard"],
      school: "enchantment", contexts: ["combat"],
      sinAffinity: "sinless", damageType: null,
      targetingType: "multi", targetType: "multi", attackWeight: 1, atkWeight: 1,
      isUnclashable: true, save: { abilityId: "wis", onSuccess: "negates" },
      concentration: true,
      mechanics: {
        targetRequirement: { creatureType: "humanoid" },
        onFailedSave: status("on_failed_save", "paralyzed", 0, 10),
        paralyzedOverride: { lockAllActionSlots: true, speed: 0, cannotUseReactions: true },
        repeatSaveAtTurnEnd: { abilityId: "wis", onSuccess: "remove", onFailureLoseCount: 1 },
        duration: "concentration_slot"
      },
      upcast: { additionalTargetsPerLevel: 1 },
      effects: []
    }),

    hypnotic_pattern: Object.freeze({
      id: "hypnotic_pattern", name: "Hypnotic Pattern", nombre: "Patrón Hipnótico",
      level: 3, spellLevel: 3, cantrip: false,
      classIds: ["bard", "sorcerer", "warlock", "wizard"],
      school: "illusion", contexts: ["combat"],
      sinAffinity: "sinless", damageType: null,
      targetingType: "aoe", targetType: "area", attackWeight: 0, atkWeight: 0,
      isUnclashable: true, save: { abilityId: "wis", onSuccess: "negates" },
      concentration: true,
      mechanics: {
        targetingCoin: { coins: 1, headsChance: "caster_sp_formula", heads: "intended_enemies_only", tails: "indiscriminate_including_allies_and_caster" },
        onFailedSave: status("on_failed_save", "hypnotic_pattern", 0, 10),
        statusMaxCount: 10,
        whileAffected: { lockAllActionSlots: true, speed: 1, cannotUseAnyAction: true },
        whenDamaged: { removeCount: 10 },
        alliedAssistRemoves: true,
        onTurnEnd: { loseCount: 1 },
        duration: "concentration_slot"
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
