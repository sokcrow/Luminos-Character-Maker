(function (global) {
  "use strict";

  if (global.LuminousPlayerSignatureSkillCatalog) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousPlayerSignatureSkillCatalog;
    return;
  }

  const VERSION = "0.7.4-angelo-signature-1";
  const RANDOM_STATUS_POOL = Object.freeze(["burn", "rupture", "sinking", "tremor", "bleed"]);

  const coin = (index) => Object.freeze({ index, type: "normal", status: "active", effects: Object.freeze([]) });

  const DEFINITIONS = Object.freeze({
    angelo_steps_to_perfection: Object.freeze({
      id: "angelo_steps_to_perfection",
      name: "Pasos para la Perfección",
      type: "Attack",
      tier: 1,
      basePower: 2,
      coinPower: 3,
      coinAmount: 3,
      coinType: "positive",
      attackWeight: 1,
      skillRange: 1,
      targetingType: "Focused Attack",
      sourceType: "player_signature_skill",
      sourceId: "angelo_steps_to_perfection",
      isItemSkill: false,
      isDefense: false,
      isClashable: true,
      isUnclashable: false,
      effects: Object.freeze([]),
      coins: Object.freeze([coin(0), coin(1), coin(2)]),
      schemaVersion: 2,
      metadata: Object.freeze({
        ownerCharacterId: "angelo_v",
        signatureSkill: true,
        rawMaxPower: 11,
        randomStatusPool: RANDOM_STATUS_POOL,
        randomStatusDisplay: Object.freeze({ burn: "Quemadura", rupture: "Ruptura", sinking: "Colapso", tremor: "Temblor", bleed: "Sangrado" }),
        mechanics: Object.freeze({
          clashPower: Object.freeze({ bleedPotencyAtLeast: 6, bonus: 1 }),
          coin1Heads: Object.freeze({ randomStatusCount: 2 }),
          coin3OnHit: Object.freeze({ bleedPotency: 2 }),
        }),
      }),
    }),

    angelo_blood_art: Object.freeze({
      id: "angelo_blood_art",
      name: "Arte Sanguíneo",
      type: "Attack",
      tier: 2,
      basePower: 8,
      coinPower: 8,
      coinAmount: 1,
      coinType: "positive",
      attackWeight: 1,
      skillRange: 1,
      targetingType: "Focused Attack",
      sourceType: "player_signature_skill",
      sourceId: "angelo_blood_art",
      isItemSkill: false,
      isDefense: false,
      isClashable: true,
      isUnclashable: false,
      effects: Object.freeze([]),
      coins: Object.freeze([coin(0)]),
      schemaVersion: 2,
      metadata: Object.freeze({
        ownerCharacterId: "angelo_v",
        signatureSkill: true,
        rawMaxPower: 16,
        randomStatusPool: RANDOM_STATUS_POOL,
        randomStatusDisplay: Object.freeze({ burn: "Quemadura", rupture: "Ruptura", sinking: "Colapso", tremor: "Temblor", bleed: "Sangrado" }),
        mechanics: Object.freeze({
          clashPower: Object.freeze({
            bleedPotencyStep: 3, bleedPotencyMaxBonus: 2,
            bleedCountStep: 3, bleedCountMaxBonus: 2,
          }),
          reuse: Object.freeze({
            baseChance: 0.40,
            chancePerNegativeStatusType: 0.20,
            negativeStatusTypeCap: 2,
            maxReuses: 2,
          }),
          onHit: Object.freeze({ bleedCount: 1, randomStatusCount: 3 }),
        }),
      }),
    }),

    angelo_my_masterpiece: Object.freeze({
      id: "angelo_my_masterpiece",
      name: "Mi Obra Maestra",
      type: "Attack",
      tier: 3,
      basePower: 3,
      coinPower: 4,
      coinAmount: 4,
      coinType: "positive",
      attackWeight: 1,
      skillRange: 1,
      targetingType: "Focused Attack",
      sourceType: "player_signature_skill",
      sourceId: "angelo_my_masterpiece",
      isItemSkill: false,
      isDefense: false,
      isClashable: true,
      isUnclashable: false,
      effects: Object.freeze([]),
      coins: Object.freeze([coin(0), coin(1), coin(2), coin(3)]),
      schemaVersion: 2,
      metadata: Object.freeze({
        ownerCharacterId: "angelo_v",
        signatureSkill: true,
        rawMaxPower: 19,
        randomStatusPool: RANDOM_STATUS_POOL,
        randomStatusDisplay: Object.freeze({ burn: "Quemadura", rupture: "Ruptura", sinking: "Colapso", tremor: "Temblor", bleed: "Sangrado" }),
        mechanics: Object.freeze({
          clashPower: Object.freeze({
            bleedPotencyStep: 3, bleedPotencyMaxBonus: 2,
            bleedCountStep: 3, bleedCountMaxBonus: 2,
          }),
          coin2And3OnHit: Object.freeze({
            bleedPotency: 1,
            ifNegativeStatusTypesAtLeast: 3,
            bonusBleedCount: 2,
            randomStatusCount: 3,
          }),
          coin4Damage: Object.freeze({
            damagePercentPerNegativeStatusType: 25,
            maxNegativeStatusTypes: 5,
            maxDamagePercent: 125,
          }),
        }),
      }),
    }),
  });

  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
  const normalizeId = (value) => String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");

  function get(id) {
    const key = normalizeId(id);
    return DEFINITIONS[key] ? clone(DEFINITIONS[key]) : null;
  }

  function list() { return Object.values(DEFINITIONS).map(clone); }

  const api = Object.freeze({
    version: VERSION,
    RANDOM_STATUS_POOL,
    DEFINITIONS,
    get,
    list,
  });

  global.LuminousPlayerSignatureSkillCatalog = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
