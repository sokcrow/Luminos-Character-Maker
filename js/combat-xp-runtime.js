(function (global) {
  'use strict';

  const THREAT_XP_TABLE = Object.freeze({
    '0': 0,
    '0.125': 25,
    '0.25': 50,
    '0.5': 100,
    '1': 200,
    '2': 450,
    '3': 700,
    '4': 1100,
    '5': 1800,
    '6': 2300,
    '7': 2900,
    '8': 3900,
    '9': 5000,
    '10': 5900,
    '11': 7200,
    '12': 8400,
    '13': 10000,
    '14': 11500,
    '15': 13000,
    '16': 15000,
    '17': 18000,
    '18': 20000,
    '19': 22000,
    '20': 25000,
    '21': 33000,
    '22': 41000,
    '23': 50000,
    '24': 62000,
    '25': 75000,
    '26': 90000,
    '27': 105000,
    '28': 120000,
    '29': 135000,
    '30': 155000
  });

  const VALID_XP_POLICIES = Object.freeze(['normal', 'encounter', 'none']);
  const RESOLVED_STATES = new Set(['defeated', 'dead', 'neutralized', 'neutralised', 'captured', 'surrendered']);

  function numberOr(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function parseThreatRating(value) {
    if (typeof value === 'string') {
      const raw = value.trim();
      const fraction = raw.match(/^(\d+)\s*\/\s*(\d+)$/);
      if (fraction) {
        const denominator = Number(fraction[2]);
        return denominator ? Number(fraction[1]) / denominator : 0;
      }
    }
    return Math.max(0, numberOr(value, 0));
  }

  function xpForThreatRating(value) {
    const rating = parseThreatRating(value);
    const key = String(rating);
    return Object.prototype.hasOwnProperty.call(THREAT_XP_TABLE, key) ? THREAT_XP_TABLE[key] : 0;
  }

  function normalizeXpPolicy(value) {
    const policy = String(value || 'normal').trim().toLowerCase();
    return VALID_XP_POLICIES.includes(policy) ? policy : 'normal';
  }

  function readThreatRating(unit = {}) {
    return parseThreatRating(
      unit?.threat?.rating ??
      unit?.experience?.threatRating ??
      unit?.threatRating ??
      unit?.challengeRating ??
      unit?.cr ??
      0
    );
  }

  function readXpOverride(unit = {}) {
    const candidates = [
      unit?.threat?.xp,
      unit?.experience?.xpValue,
      unit?.xpValue
    ];
    const found = candidates.find((value) => value !== undefined && value !== null && value !== '');
    return found === undefined ? null : Math.max(0, numberOr(found, 0));
  }

  function readXpPolicy(unit = {}) {
    return normalizeXpPolicy(
      unit?.xpPolicy ??
      unit?.experience?.xpPolicy ??
      unit?.threat?.xpPolicy ??
      'normal'
    );
  }

  function normalizeUnitXp(unit = {}) {
    const rating = readThreatRating(unit);
    const automaticXp = xpForThreatRating(rating);
    const overrideXp = readXpOverride(unit);
    const overridden = overrideXp !== null;
    const xp = overridden ? overrideXp : automaticXp;
    const xpPolicy = readXpPolicy(unit);

    return {
      threat: {
        rating,
        xp,
        automaticXp,
        overridden
      },
      xpValue: xp,
      xpPolicy
    };
  }

  function unitResolutionState(unit = {}) {
    const explicit = String(
      unit?.resolutionState ?? unit?.combatState ?? unit?.state ?? unit?.status ?? ''
    ).trim().toLowerCase();
    if (RESOLVED_STATES.has(explicit)) return explicit;
    if (unit?.defeated === true || unit?.neutralized === true || unit?.neutralised === true || unit?.captured === true || unit?.surrendered === true) {
      return 'neutralized';
    }
    if (Number.isFinite(Number(unit?.hp)) && Number(unit.hp) <= 0) return 'defeated';
    return 'active';
  }

  function isUnitResolved(unit = {}) {
    return unitResolutionState(unit) !== 'active';
  }

  function enemyXpContribution(unit = {}) {
    const normalized = normalizeUnitXp(unit);
    const resolved = isUnitResolved(unit);
    const counts = resolved && normalized.xpPolicy === 'normal';
    return {
      unit,
      resolved,
      resolutionState: unitResolutionState(unit),
      xpPolicy: normalized.xpPolicy,
      threat: normalized.threat,
      xpValue: normalized.xpValue,
      contributedXp: counts ? normalized.xpValue : 0,
      counts
    };
  }

  function normalizeParticipants(participants = []) {
    return (Array.isArray(participants) ? participants : [])
      .filter(Boolean)
      .filter((participant) => participant.xpEligible !== false && participant.eligibleForXp !== false);
  }

  function resolveEncounterXp(options = {}) {
    const enemies = Array.isArray(options.enemies) ? options.enemies : [];
    const participants = normalizeParticipants(options.participants);
    const encounterResolved = options.encounterResolved !== false;
    const contributions = enemies.map(enemyXpContribution);

    const enemyXp = encounterResolved
      ? contributions.reduce((sum, entry) => sum + entry.contributedXp, 0)
      : 0;

    const fixedEncounterXp = encounterResolved
      ? Math.max(0, numberOr(options.fixedEncounterXp ?? options.encounterXp ?? options.baseEncounterXp, 0))
      : 0;

    const bonusXp = encounterResolved
      ? Math.max(0, numberOr(options.bonusXp, 0))
      : 0;

    const totalXp = enemyXp + fixedEncounterXp + bonusXp;
    const participantCount = participants.length;
    const xpPerParticipant = participantCount > 0 ? Math.floor(totalXp / participantCount) : 0;
    const remainderXp = participantCount > 0 ? totalXp - (xpPerParticipant * participantCount) : totalXp;

    return {
      encounterResolved,
      totalXp,
      enemyXp,
      fixedEncounterXp,
      bonusXp,
      participantCount,
      xpPerParticipant,
      remainderXp,
      participants,
      contributions
    };
  }

  function applyXpMetadata(unit = {}, input = {}) {
    const next = { ...unit };
    const rating = parseThreatRating(input.rating ?? input.threatRating ?? readThreatRating(unit));
    const automaticXp = xpForThreatRating(rating);
    const hasXpOverride = input.xp !== undefined || input.xpValue !== undefined;
    const xp = hasXpOverride
      ? Math.max(0, numberOr(input.xp ?? input.xpValue, automaticXp))
      : (readXpOverride(unit) ?? automaticXp);
    const xpPolicy = normalizeXpPolicy(input.xpPolicy ?? readXpPolicy(unit));

    next.threat = {
      ...(unit.threat && typeof unit.threat === 'object' ? unit.threat : {}),
      rating,
      xp
    };
    next.xpValue = xp;
    next.xpPolicy = xpPolicy;
    return next;
  }

  function runSmokeTest() {
    const enemies = [
      applyXpMetadata({ id: 'a', hp: 0 }, { rating: 1 }),
      applyXpMetadata({ id: 'b', neutralized: true }, { rating: 2 }),
      applyXpMetadata({ id: 'summon', hp: 0 }, { rating: 5, xpPolicy: 'none' }),
      applyXpMetadata({ id: 'boss_part', hp: 0 }, { rating: 3, xpPolicy: 'encounter' })
    ];
    const result = resolveEncounterXp({
      enemies,
      participants: [{ id: 'p1' }, { id: 'p2' }, { id: 'spectator', xpEligible: false }],
      fixedEncounterXp: 700,
      encounterResolved: true
    });
    const checks = {
      fractions: xpForThreatRating('1/2') === 100,
      normalEnemiesCount: result.enemyXp === 650,
      nonePolicyDoesNotCount: result.contributions.find((entry) => entry.unit.id === 'summon')?.contributedXp === 0,
      encounterPolicyDoesNotDoubleCount: result.contributions.find((entry) => entry.unit.id === 'boss_part')?.contributedXp === 0,
      fixedRewardCountsOnce: result.fixedEncounterXp === 700,
      total: result.totalXp === 1350,
      eligibleParticipantsOnly: result.participantCount === 2,
      split: result.xpPerParticipant === 675,
      noKillShotRequirement: result.contributions.find((entry) => entry.unit.id === 'b')?.resolved === true
    };
    return { passed: Object.values(checks).every(Boolean), checks, result };
  }

  const api = Object.freeze({
    VERSION: 1,
    THREAT_XP_TABLE,
    VALID_XP_POLICIES,
    parseThreatRating,
    xpForThreatRating,
    normalizeXpPolicy,
    normalizeUnitXp,
    unitResolutionState,
    isUnitResolved,
    enemyXpContribution,
    normalizeParticipants,
    resolveEncounterXp,
    applyXpMetadata,
    runSmokeTest
  });

  global.LuminousCombatXpRuntime = api;
})(typeof window !== 'undefined' ? window : globalThis);
