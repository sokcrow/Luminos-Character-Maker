(function (global) {
  "use strict";

  const clone = (value) => JSON.parse(JSON.stringify(value));

  function statusEffect(status, potency = 0, count = 0, extra = {}) {
    return {
      trigger: "[On Hit]",
      target: "target",
      type: "status",
      status,
      potency,
      count,
      maxCap: 0,
      scaleTarget: null,
      scaleCondition: null,
      is_reuse: false,
      target_ally: false,
      timing: "immediate",
      condition: null,
      ...extra,
    };
  }

  function healEffect(amount, extra = {}) {
    return {
      trigger: "[On Hit]",
      target: "self",
      type: "heal",
      amount,
      timing: "immediate",
      condition: null,
      ...extra,
    };
  }

  function coin(index, effects) {
    return { index, type: "normal", status: "active", effects: effects || [] };
  }

  function attack({ id, name, species, basePower, coinPower, damageType, coinEffects = [], metadata = {} }) {
    return {
      id,
      name,
      type: "Attack",
      tier: 1,
      maxCopies: 3,
      basePower,
      coinPower,
      coinAmount: 1,
      coinType: "positive",
      attackWeight: 1,
      skillRange: 1,
      damageType,
      sinAffinity: "sinless",
      scalingStat: "Fuerza",
      statUsed: "",
      skillUsed: "",
      targetingType: "Focused Attack",
      aoePattern: "Self",
      skillAmount: 1,
      sourceType: "skill",
      sourceId: id,
      isItemSkill: false,
      isDefense: false,
      defenseSubtype: "",
      isClashable: true,
      isUnclashable: false,
      isIndiscriminate: false,
      isTargetFixed: false,
      requiresUnlock: false,
      resourceCosts: [],
      effects: [],
      coins: [coin(0, coinEffects.map(clone))],
      evolutionChain: null,
      schemaVersion: 2,
      metadata: {
        canonicalUnitSkill: true,
        species,
        family: "beast_cr0",
        tier: 1,
        combatRange: "melee",
        naturalAttack: true,
        ...metadata,
      },
    };
  }

  const bleed1 = () => statusEffect("bleed", 1, 1);
  const tremor1 = () => statusEffect("tremor", 1, 1);
  const poison1 = () => statusEffect("poison", 1, 1);

  const DEFINITIONS = Object.freeze({
    baboon_bite: Object.freeze(attack({
      id: "baboon_bite", name: "Bite", species: "baboon",
      basePower: 6, coinPower: 5, damageType: "perforante", coinEffects: [bleed1()],
    })),
    badger_bite: Object.freeze(attack({
      id: "badger_bite", name: "Bite", species: "badger",
      basePower: 5, coinPower: 5, damageType: "perforante", coinEffects: [bleed1()],
    })),
    bat_bite: Object.freeze(attack({
      id: "bat_bite", name: "Bite", species: "bat",
      basePower: 5, coinPower: 5, damageType: "perforante",
      coinEffects: [
        bleed1(),
        healEffect(2, { conditionPolicy: "target_had_status_before_hit", conditionStatus: "bleed" }),
      ],
      metadata: { healOnBleedingTarget: 2, healConditionPolicy: "target_had_status_before_hit" },
    })),
    cat_scratch: Object.freeze(attack({
      id: "cat_scratch", name: "Scratch", species: "cat",
      basePower: 5, coinPower: 5, damageType: "cortante",
      coinEffects: [statusEffect("bleed", 2, 1)],
    })),
    crab_claw: Object.freeze(attack({
      id: "crab_claw", name: "Claw", species: "crab",
      basePower: 5, coinPower: 5, damageType: "contundente", coinEffects: [tremor1()],
    })),
    deer_ram: Object.freeze(attack({
      id: "deer_ram", name: "Ram", species: "deer",
      basePower: 6, coinPower: 5, damageType: "contundente", coinEffects: [tremor1()],
    })),
    eagle_talons: Object.freeze(attack({
      id: "eagle_talons", name: "Talons", species: "eagle",
      basePower: 6, coinPower: 5, damageType: "cortante", coinEffects: [bleed1()],
    })),
    frog_bite: Object.freeze(attack({
      id: "frog_bite", name: "Bite", species: "frog",
      basePower: 5, coinPower: 5, damageType: "perforante", coinEffects: [bleed1()],
    })),
    giant_fire_beetle_bite: Object.freeze(attack({
      id: "giant_fire_beetle_bite", name: "Bite", species: "giant_fire_beetle",
      basePower: 5, coinPower: 5, damageType: "fire",
      coinEffects: [
        statusEffect("burn", 1, 0),
        statusEffect("burn", 0, 1, { conditionPolicy: "target_had_status_before_hit", conditionStatus: "burn" }),
      ],
      metadata: { burnCountIfTargetAlreadyBurning: 1, conditionalStatusPolicy: "target_had_status_before_hit" },
    })),
    goat_ram: Object.freeze(attack({
      id: "goat_ram", name: "Ram", species: "goat",
      basePower: 5, coinPower: 5, damageType: "contundente", coinEffects: [tremor1()],
      metadata: { conditionalClashPower: { condition: "target_speed_lower_than_self", bonus: 1 } },
    })),
    hawk_talons: Object.freeze(attack({
      id: "hawk_talons", name: "Talons", species: "hawk",
      basePower: 5, coinPower: 5, damageType: "cortante", coinEffects: [bleed1()],
    })),
    hyena_bite: Object.freeze(attack({
      id: "hyena_bite", name: "Bite", species: "hyena",
      basePower: 6, coinPower: 5, damageType: "perforante", coinEffects: [bleed1()],
    })),
    jackal_bite: Object.freeze(attack({
      id: "jackal_bite", name: "Bite", species: "jackal",
      basePower: 5, coinPower: 5, damageType: "perforante", coinEffects: [bleed1()],
    })),
    lizard_bite: Object.freeze(attack({
      id: "lizard_bite", name: "Bite", species: "lizard",
      basePower: 5, coinPower: 5, damageType: "perforante", coinEffects: [bleed1()],
    })),
    octopus_tentacles: Object.freeze(attack({
      id: "octopus_tentacles", name: "Tentacles", species: "octopus",
      basePower: 5, coinPower: 5, damageType: "contundente", coinEffects: [tremor1()],
    })),
    owl_talons: Object.freeze(attack({
      id: "owl_talons", name: "Talons", species: "owl",
      basePower: 5, coinPower: 5, damageType: "cortante", coinEffects: [bleed1()],
    })),
    piranha_bite: Object.freeze(attack({
      id: "piranha_bite", name: "Bite", species: "piranha",
      basePower: 5, coinPower: 5, damageType: "perforante", coinEffects: [bleed1()],
      metadata: {
        conditionalFlatDamage: { condition: "target_hp_below_max", bonus: 10 },
        conditionalClashPower: { condition: "target_had_bleed_before_hit", bonus: 1 },
      },
    })),
    rat_bite: Object.freeze(attack({
      id: "rat_bite", name: "Bite", species: "rat",
      basePower: 5, coinPower: 5, damageType: "perforante", coinEffects: [bleed1()],
    })),
    raven_beak: Object.freeze(attack({
      id: "raven_beak", name: "Beak", species: "raven",
      basePower: 5, coinPower: 5, damageType: "perforante", coinEffects: [bleed1()],
    })),
    scorpion_sting: Object.freeze(attack({
      id: "scorpion_sting", name: "Sting", species: "scorpion",
      basePower: 5, coinPower: 5, damageType: "perforante",
      coinEffects: [
        poison1(),
        statusEffect("poison", 0, 1, { conditionPolicy: "target_had_status_before_hit", conditionStatus: "poison" }),
      ],
      metadata: { poisonCountIfTargetAlreadyPoisoned: 1, conditionalStatusPolicy: "target_had_status_before_hit" },
    })),
    spider_bite: Object.freeze(attack({
      id: "spider_bite", name: "Bite", species: "spider",
      basePower: 5, coinPower: 5, damageType: "perforante",
      coinEffects: [poison1()],
    })),
    vulture_beak: Object.freeze(attack({
      id: "vulture_beak", name: "Beak", species: "vulture",
      basePower: 5, coinPower: 5, damageType: "perforante",
      coinEffects: [bleed1()],
    })),
    weasel_bite: Object.freeze(attack({
      id: "weasel_bite", name: "Bite", species: "weasel",
      basePower: 5, coinPower: 5, damageType: "perforante",
      coinEffects: [bleed1()],
    })),
  });

  function list() { return Object.values(DEFINITIONS).map(clone); }
  function get(id) {
    const value = DEFINITIONS[String(id || "")];
    return value ? clone(value) : null;
  }
  function finalPower(skillOrId) {
    const skill = typeof skillOrId === "string" ? get(skillOrId) : skillOrId;
    if (!skill) return null;
    return Number(skill.basePower || 0) + Number(skill.coinPower || 0) * Number(skill.coinAmount || 0);
  }
  function firebasePayload(schema = global.CombatSkillSchema) {
    const payload = {};
    list().forEach((skill) => {
      if (schema?.validateCombatSkill && schema?.serializeCombatSkill) {
        const validation = schema.validateCombatSkill(skill);
        if (!validation.valid) throw new Error(`${skill.id}: ${validation.errors.join(" · ")}`);
        payload[skill.id] = schema.serializeCombatSkill({ ...validation.skill, id: skill.id }, { includeLegacyAliases: true });
      } else payload[skill.id] = skill;
    });
    return payload;
  }

  const api = Object.freeze({ version: "1.2.0", DEFINITIONS, list, get, finalPower, firebasePayload });
  global.LuminousBeastCr0SkillCatalog = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
