(function (global) {
  "use strict";

  if (global.LuminousItemHarvestIntegrityEngine) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousItemHarvestIntegrityEngine;
    return;
  }

  const VERSION = 1;

  const PHYSICAL_DAMAGE_ALIASES = Object.freeze({
    slash: "slashing",
    slashing: "slashing",
    cortante: "slashing",
    pierce: "piercing",
    piercing: "piercing",
    perforante: "piercing",
    blunt: "bludgeoning",
    bludgeoning: "bludgeoning",
    contundente: "bludgeoning",
  });

  const MAGIC_SOURCE_KINDS = Object.freeze(new Set(["spell", "magic", "magical", "arcane"]));
  const STATUS_SOURCE_KINDS = Object.freeze(new Set(["status", "dot", "damage_over_time", "condition"]));
  const FIXED_SOURCE_KINDS = Object.freeze(new Set(["fixed", "fixed_damage", "direct", "directo"]));
  const PHYSICAL_SOURCE_KINDS = Object.freeze(new Set(["attack", "skill", "weapon", "melee", "ranged", "physical"]));

  const STATUS_EXPOSURES = Object.freeze({
    burn: Object.freeze(["burn", "heat"]),
    chill: Object.freeze(["cold"]),
    frozen: Object.freeze(["frozen", "cold"]),
    shock: Object.freeze(["electrical"]),
    corrosion: Object.freeze(["acid"]),
    poison: Object.freeze(["toxin", "contamination"]),
    decay: Object.freeze(["necrotic", "mana_corruption"]),
    radiance: Object.freeze(["radiant", "mana_corruption"]),
    bleed: Object.freeze(["blood_loss"]),
    rupture: Object.freeze([]),
    sinking: Object.freeze([]),
    tremor: Object.freeze([]),
    tremor_burst: Object.freeze([]),
  });

  const RESOURCE_PROFILES = Object.freeze({
    meat: Object.freeze({
      id: "meat",
      directHitSensitive: true,
      primaryPhysical: Object.freeze([]),
      secondaryPhysical: Object.freeze(["slashing", "piercing", "bludgeoning"]),
      exposureChannels: Object.freeze(["burn", "heat", "acid", "cold", "frozen", "electrical", "necrotic", "mana_corruption"]),
    }),
    hide_pelt: Object.freeze({
      id: "hide_pelt",
      directHitSensitive: true,
      primaryPhysical: Object.freeze(["slashing"]),
      secondaryPhysical: Object.freeze(["piercing"]),
      exposureChannels: Object.freeze(["burn", "heat", "acid", "cold", "frozen", "mana_corruption"]),
    }),
    hard_parts: Object.freeze({
      id: "hard_parts",
      directHitSensitive: false,
      primaryPhysical: Object.freeze(["bludgeoning"]),
      secondaryPhysical: Object.freeze([]),
      exposureChannels: Object.freeze(["acid", "frozen", "cold", "mana_corruption"]),
    }),
    organ_gland: Object.freeze({
      id: "organ_gland",
      directHitSensitive: false,
      primaryPhysical: Object.freeze(["piercing"]),
      secondaryPhysical: Object.freeze(["bludgeoning"]),
      exposureChannels: Object.freeze(["burn", "heat", "acid", "cold", "frozen", "electrical", "necrotic", "mana_corruption"]),
    }),
    blood_ichor: Object.freeze({
      id: "blood_ichor",
      directHitSensitive: false,
      primaryPhysical: Object.freeze([]),
      secondaryPhysical: Object.freeze(["slashing", "piercing"]),
      exposureChannels: Object.freeze(["blood_loss", "burn", "heat", "acid", "mana_corruption"]),
    }),
    venom_secretion: Object.freeze({
      id: "venom_secretion",
      directHitSensitive: false,
      primaryPhysical: Object.freeze(["piercing"]),
      secondaryPhysical: Object.freeze([]),
      exposureChannels: Object.freeze(["burn", "heat", "acid", "mana_corruption"]),
    }),
  });

  function normalizeId(value) {
    return String(value ?? "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
  }

  function numberOr(value, fallback = 0) {
    return Number.isFinite(Number(value)) ? Number(value) : fallback;
  }

  function canonicalPhysicalDamageType(value) {
    return PHYSICAL_DAMAGE_ALIASES[normalizeId(value)] || null;
  }

  function sourceKind(event = {}) {
    return normalizeId(
      event.sourceType ??
      event.sourceKind ??
      event.kind ??
      event.source?.type ??
      event.source?.kind ??
      ""
    );
  }

  function damageAmount(event = {}) {
    return Math.max(0, numberOr(
      event.damageDealt ??
      event.hpDamage ??
      event.actualDamage ??
      event.damage ??
      event.amount,
      0
    ));
  }

  function isMagicEvent(event = {}) {
    const kind = sourceKind(event);
    return event.isSpell === true ||
      event.isMagic === true ||
      event.canonicalSpell === true ||
      event.source?.type === "spell" ||
      MAGIC_SOURCE_KINDS.has(kind);
  }

  function isStatusEvent(event = {}) {
    const kind = sourceKind(event);
    return event.statusTick === true ||
      event.isStatusDamage === true ||
      STATUS_SOURCE_KINDS.has(kind);
  }

  function isFixedDamageEvent(event = {}) {
    const kind = sourceKind(event);
    const mode = normalizeId(event.damageMode ?? event.damage_mode);
    const damageType = normalizeId(event.damageType ?? event.tipoDano ?? event.tipo_dano);
    return event.isFixedDamage === true ||
      mode === "fixed" ||
      mode === "fixed_damage" ||
      FIXED_SOURCE_KINDS.has(kind) ||
      damageType === "directo";
  }

  function explicitPhysicalTrauma(event = {}) {
    const explicit = event.harvestTrauma ?? event.physicalTrauma ?? event.harvestPhysicalDamageType;
    return canonicalPhysicalDamageType(explicit);
  }

  function isDirectHitEvent(event = {}) {
    if (event.isDirectHit === false) return false;
    if (isStatusEvent(event) || isFixedDamageEvent(event)) return false;
    return damageAmount(event) > 0;
  }

  function physicalTraumaType(event = {}) {
    const explicit = explicitPhysicalTrauma(event);
    if (explicit) return explicit;
    if (isMagicEvent(event) || isStatusEvent(event) || isFixedDamageEvent(event)) return null;
    const kind = sourceKind(event);
    if (kind && !PHYSICAL_SOURCE_KINDS.has(kind)) return null;
    if (!kind && event.physical !== true && event.isPhysical !== true) return null;
    return canonicalPhysicalDamageType(event.damageType ?? event.dmgType ?? event.attackType ?? event.tipo_dano);
  }

  function statusIdsFromEvent(event = {}) {
    const ids = [];
    const push = (value) => {
      const id = normalizeId(value?.status ?? value?.statusId ?? value?.id ?? value);
      if (id) ids.push(id);
    };
    push(event.status);
    push(event.statusId);
    (Array.isArray(event.statuses) ? event.statuses : []).forEach(push);
    (Array.isArray(event.appliedStatuses) ? event.appliedStatuses : []).forEach(push);
    (Array.isArray(event.effects) ? event.effects : [])
      .filter((effect) => normalizeId(effect?.type) === "status")
      .forEach(push);
    return Array.from(new Set(ids));
  }

  function createDamageRecord(seed = {}) {
    return {
      totalDirectHits: Math.max(0, Math.trunc(numberOr(seed.totalDirectHits, 0))),
      totalDirectDamage: Math.max(0, numberOr(seed.totalDirectDamage, 0)),
      physical: {
        slashing: { hits: 0, damage: 0 },
        piercing: { hits: 0, damage: 0 },
        bludgeoning: { hits: 0, damage: 0 },
      },
      magic: {
        hits: 0,
        damage: 0,
        manaCorruption: 0,
        sinAffinities: {},
      },
      statusExposure: {},
      exposure: {},
    };
  }

  function addCounter(map, key, amount) {
    if (!key || !(amount > 0)) return;
    map[key] = numberOr(map[key], 0) + amount;
  }

  function recordStatusExposure(record, statusId, amount = 1) {
    const id = normalizeId(statusId);
    if (!id) return;
    const resolvedAmount = Math.max(1, numberOr(amount, 1));
    addCounter(record.statusExposure, id, resolvedAmount);
    for (const channel of STATUS_EXPOSURES[id] || []) {
      addCounter(record.exposure, channel, resolvedAmount);
    }
  }

  function recordEvent(record, event = {}) {
    const output = record || createDamageRecord();
    const amount = damageAmount(event);
    const directHit = isDirectHitEvent(event);
    const magic = isMagicEvent(event);
    const physicalType = physicalTraumaType(event);

    if (directHit) {
      output.totalDirectHits += 1;
      output.totalDirectDamage += amount;
    }

    if (physicalType && amount > 0) {
      output.physical[physicalType].hits += 1;
      output.physical[physicalType].damage += amount;
    }

    const affinity = normalizeId(event.sinAffinity ?? event.affinity ?? event.sin ?? event.pecado);
    if (affinity && amount > 0) addCounter(output.magic.sinAffinities, affinity, amount);

    if (magic && amount > 0) {
      output.magic.hits += directHit ? 1 : 0;
      output.magic.damage += amount;
      output.magic.manaCorruption += amount;
      addCounter(output.exposure, "mana_corruption", amount);
    }

    const statusAmount = Math.max(1, amount || numberOr(event.potency, 0) || numberOr(event.count, 0) || 1);
    for (const statusId of statusIdsFromEvent(event)) {
      recordStatusExposure(output, statusId, statusAmount);
    }

    return output;
  }

  function recordEvents(events = [], seed = null) {
    const record = seed || createDamageRecord();
    for (const event of Array.isArray(events) ? events : []) recordEvent(record, event);
    return record;
  }

  function getResourceProfile(family) {
    return RESOURCE_PROFILES[normalizeId(family)] || null;
  }

  function harvestCondition(record, family) {
    const profile = getResourceProfile(family);
    if (!profile) return null;
    const source = record || createDamageRecord();
    const physical = {};
    for (const type of [...profile.primaryPhysical, ...profile.secondaryPhysical]) {
      physical[type] = {
        hits: numberOr(source.physical?.[type]?.hits, 0),
        damage: numberOr(source.physical?.[type]?.damage, 0),
        primary: profile.primaryPhysical.includes(type),
      };
    }
    const exposures = {};
    for (const channel of profile.exposureChannels) {
      exposures[channel] = numberOr(source.exposure?.[channel], 0);
    }
    return {
      family: profile.id,
      directHitSensitive: profile.directHitSensitive,
      totalDirectHits: numberOr(source.totalDirectHits, 0),
      totalDirectDamage: numberOr(source.totalDirectDamage, 0),
      physical,
      magicHits: numberOr(source.magic?.hits, 0),
      manaCorruption: numberOr(source.exposure?.mana_corruption, source.magic?.manaCorruption || 0),
      exposures,
    };
  }

  function explainEvent(event = {}) {
    return Object.freeze({
      sourceKind: sourceKind(event) || null,
      directHit: isDirectHitEvent(event),
      magic: isMagicEvent(event),
      status: isStatusEvent(event),
      fixed: isFixedDamageEvent(event),
      physicalTraumaType: physicalTraumaType(event),
      damage: damageAmount(event),
      statuses: Object.freeze(statusIdsFromEvent(event)),
    });
  }

  const API = Object.freeze({
    VERSION,
    PHYSICAL_DAMAGE_ALIASES,
    STATUS_EXPOSURES,
    RESOURCE_PROFILES,
    normalizeId,
    canonicalPhysicalDamageType,
    sourceKind,
    damageAmount,
    isMagicEvent,
    isStatusEvent,
    isFixedDamageEvent,
    isDirectHitEvent,
    physicalTraumaType,
    statusIdsFromEvent,
    createDamageRecord,
    recordStatusExposure,
    recordEvent,
    recordEvents,
    getResourceProfile,
    harvestCondition,
    explainEvent,
  });

  global.LuminousItemHarvestIntegrityEngine = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof globalThis !== "undefined" ? globalThis : window);
