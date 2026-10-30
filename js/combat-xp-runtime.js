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


  // ENCOUNTER VICTORY: only the DM may invoke this through the authenticated
  // encounter-ending flow. Never grant XP from a client-side win animation.
  const PLAYER_ROOT = 'campaña/jugadores';
  const UNIT_ROOT = 'campaña/base_datos_unidades';
  const validFirebaseKey = value => typeof value === 'string'
    && value.length > 0 && !/[.#$\\/\\[\\]]/.test(value);
  const cleanId = value => String(value ?? '').trim();
  const isPlayer = unit => unit?.isPlayer === true
    || String(unit?.actorCategory || unit?.category || unit?.canonicalScope || '').toLowerCase() === 'player';
  const playerIdFor = unit => cleanId(unit?.canonicalPlayerKey || unit?.ownerPlayerId
    || unit?.playerId || unit?.characterLink?.playerId);
  const unitLibraryId = unit => cleanId(unit?.libraryUnitId || unit?.catalogId
    || unit?.sourceUnitId || unit?.templateUnitId || unit?.unitId || unit?.id);
  function isEnemy(unit = {}) {
    if (isPlayer(unit)) return false;
    return ['enemy', 'hostile'].includes(String(unit.faction || unit.side
      || unit.team || unit.actorCategory || unit.unitType || '').trim().toLowerCase());
  }
  function eligibleVictoryPlayers(encounter = {}) {
    const participants = encounter.participants || {};
    const explicit = Object.keys(participants);
    const participantIds = new Set(explicit.filter(id => participants[id] === true
      || (participants[id] && typeof participants[id] === 'object'
        && participants[id].xpEligible !== false && participants[id].eligibleForXp !== false)));
    const units = Object.values({
      ...(encounter.combatants || {}), ...(encounter.defeated || {}),
      ...(encounter.reserves || {}), ...(encounter.departed || {})
    });
    if (!explicit.length) {
      for (const unit of units) if (isPlayer(unit) && playerIdFor(unit)) participantIds.add(playerIdFor(unit));
    }
    // Players who use Escape leave the Encounter and receive no experience.
    for (const unit of Object.values(encounter.departed || {})) {
      if (isPlayer(unit)) participantIds.delete(playerIdFor(unit));
    }
    for (const unit of units) {
      if (!isPlayer(unit)) continue;
      if (unit.xpEligible === false || unit.eligibleForXp === false
        || unit.escaped === true || unit.departed === true
        || ['escape','escaped'].includes(String(unit.departureReason || unit.exitReason || '').toLowerCase())) {
        participantIds.delete(playerIdFor(unit));
      }
    }
    return [...participantIds].filter(validFirebaseKey).sort();
  }
  function eligibleVictoryNpcs(encounter = {}) {
    const mvp = global.LuminousCombatMvpRuntime;
    if (!mvp) return [];
    return mvp.eligibleActors(encounter)
      .filter(actor => actor.kind === 'npc' && actor.persistent && !actor.hostile)
      .map(actor => actor.recordId).filter(validFirebaseKey).sort();
  }
  function npcRecordPath(id) { return 'campaña/base_datos_npcs/' + id; }
  function explicitRewardConfigured(unit = {}) {
    return [unit?.threat?.rating, unit?.experience?.threatRating,
      unit?.threatRating, unit?.challengeRating, unit?.cr,
      unit?.threat?.xp, unit?.experience?.xpValue, unit?.xpValue]
      .some(v => v !== undefined && v !== null && v !== '');
  }
  function canonicalSourceUnit(unit = {}) {
    const id = unitLibraryId(unit);
    for (const api of [global.LuminousGoblinUnitCatalog,
      global.LuminousKoboldUnitCatalog, global.LuminousWolfUnitCatalog,
      global.LuminousBeastCr0UnitCatalog, global.LuminousCaveSapphireSpiderUnitCatalog]) {
      const found = api?.get?.(id);
      if (found) return found;
    }
    return null;
  }
  async function enemyDefinitionsForVictory(db, encounter = {}) {
    const defeated = { ...(encounter.combatants || {}), ...(encounter.defeated || {}) };
    const lookupCache = new Map();
    const enemies = [];
    const missingCr = [];
    for (const [key, unit] of Object.entries(defeated)) {
      if (!unit || !isEnemy(unit)) continue;
      const id = unitLibraryId(unit);
      let definition = canonicalSourceUnit(unit);
      if (id && validFirebaseKey(id)) {
        if (!lookupCache.has(id)) {
          lookupCache.set(id, db.ref(`${UNIT_ROOT}/${id}`).once('value')
            .then(snapshot => snapshot.val() || null));
        }
        const stored = await lookupCache.get(id);
        // Bundled canonical data is authoritative when a previously seeded
        // Firebase Unit lacks the newer CR/XP fields. Existing explicit custom
        // CR/XP fields are still respected.
        if (stored) definition = { ...(definition || {}), ...stored,
          challengeRating: stored.challengeRating ?? definition?.challengeRating,
          xpValue: stored.xpValue ?? definition?.xpValue };
      }
      // Preserve per-instance CR/XP overrides, while inheriting original CR
      // and special CR 0 (0 vs 10 XP) from the authored unit definition.
      const canonical = definition || {};
      const merged = { ...canonical, ...unit,
        challengeRating: unit.challengeRating ?? canonical.challengeRating,
        threat: { ...(canonical.threat || {}), ...(unit.threat || {}) },
        experience: { ...(canonical.experience || {}), ...(unit.experience || {}) } };
      if (unit.xpValue == null && canonical.xpValue != null) merged.xpValue = canonical.xpValue;
      if (!explicitRewardConfigured(merged)
        && normalizeXpPolicy(merged.xpPolicy) === 'normal'
        && isUnitResolved({ ...merged, defeated: unit.defeated === true || Boolean(encounter.defeated?.[key]) })) {
        missingCr.push(id || key);
      }
      enemies.push({ ...merged,
        // A Unit moved to the defeated ledger is defeated even if its last
        // display HP is stale. No duplicate contribution from field/defeated.
        defeated: unit.defeated === true || Boolean(encounter.defeated?.[key]) || merged.defeated === true });
    }
    return { enemies, missingCr: [...new Set(missingCr)] };
  }
  async function awardVictoryXp({ db, encounter } = {}) {
    if (!db?.ref || !encounter || typeof encounter !== 'object') throw Error('ENCOUNTER_XP_CONTEXT_REQUIRED');
    const estado = encounter.estado || {};
    const outcome = String(estado.ending?.result || estado.result || estado.outcome || '').toLowerCase();
    if (outcome !== 'victory' || !['ENDING', 'ENDED'].includes(String(estado.phase || '').toUpperCase()))
      throw Error('ENCOUNTER_XP_VICTORY_REQUIRED');
    const encounterId = cleanId(estado.encounterId);
    if (!validFirebaseKey(encounterId)) throw Error('ENCOUNTER_XP_ID_REQUIRED');
    // Freeze the complete payout before the first actor transaction. A resumed
    // DM must use the same winner, recipients and amounts after a partial payout.
    const planRef = db.ref('campaña/combate/xpPlans/' + encounterId);
    let plan = (await planRef.once('value')).val();
    if (!plan) {
      const participantIds = eligibleVictoryPlayers(encounter);
      const npcIds = eligibleVictoryNpcs(encounter);
      const mvp = global.LuminousCombatMvpRuntime?.selectMvp(encounter) || null;
      const recipients = [
        ...participantIds.map(id => ({ kind: 'player', id, path: PLAYER_ROOT + '/' + id })),
        ...npcIds.map(id => ({ kind: 'npc', id, path: npcRecordPath(id) }))
      ];
      const records = await Promise.all(recipients.map(row => db.ref(row.path).once('value').then(s => s.val())));
      if (records.some(record => !record || typeof record !== 'object'))
        throw Error('ENCOUNTER_XP_PARTICIPANT_NOT_FOUND');
      const { enemies, missingCr } = await enemyDefinitionsForVictory(db, encounter);
      const result = resolveEncounterXp({
        enemies, participants: recipients.map(row => ({ id: row.kind + ':' + row.id })),
        encounterResolved: true,
        fixedEncounterXp: estado.fixedEncounterXp ?? estado.experience?.fixedEncounterXp ?? 0,
        bonusXp: estado.bonusXp ?? estado.experience?.bonusXp ?? 0
      });
      const proposal = {encounterId,participantIds,npcIds,mvp,recipients,result,missingCr};
      const tx = await planRef.transaction(old => old || proposal, undefined, false);
      plan = tx.snapshot.val();
      if (!plan) throw Error('ENCOUNTER_XP_PLAN_REQUIRED');
    }
    const {participantIds,npcIds,mvp,recipients,result,missingCr} = plan;
    const awards = [];
    for (const recipient of recipients) {
      const { id, kind, path } = recipient;
      const ref = db.ref(path);
      const isMvp = Boolean(mvp?.persistent && mvp.kind === kind && mvp.recordId === id);
      const xp = global.LuminousCombatMvpRuntime?.bonus(result.xpPerParticipant, isMvp) ?? result.xpPerParticipant;
      const bonusXp = xp - result.xpPerParticipant;
      // XP + receipt in one transaction. The amount is frozen per encounter.
      const tx = await ref.transaction(current => {
        if (!current || typeof current !== 'object') return;
        if (current.encounterXpAwards?.[encounterId] != null) return;
        return { ...current, xp: Math.max(0, Number(current.xp) || 0) + xp,
          encounterXpAwards: { ...(current.encounterXpAwards || {}),
            [encounterId]: { xp, baseXp: result.xpPerParticipant, mvpBonusXp: bonusXp,
              totalXp: result.totalXp, participantCount: result.participantCount,
              awardedAt: Date.now() } } };
      }, undefined, false);
      const receipt = tx?.snapshot?.val()?.encounterXpAwards?.[encounterId];
      if (receipt == null) throw Error('ENCOUNTER_XP_AWARD_NOT_COMMITTED:' + id);
      if (receipt.xp !== xp || receipt.baseXp !== result.xpPerParticipant
        || receipt.mvpBonusXp !== bonusXp || receipt.totalXp !== result.totalXp
        || receipt.participantCount !== result.participantCount)
        throw Error('ENCOUNTER_XP_RECEIPT_MISMATCH:' + id);
      awards.push({ playerId: kind === 'player' ? id : null, npcId: kind === 'npc' ? id : null,
        kind, id, awarded: Boolean(tx?.committed), xp, baseXp: result.xpPerParticipant, bonusXp });
    }
    return { encounterId, totalXp: result.totalXp, enemyXp: result.enemyXp,
      fixedEncounterXp: result.fixedEncounterXp, bonusXp: result.bonusXp,
      participantCount: result.participantCount, xpPerParticipant: result.xpPerParticipant,
      remainderXp: result.remainderXp, participantIds, npcIds, mvp, missingCr, awards };
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
    eligibleVictoryPlayers,
    eligibleVictoryNpcs,
    enemyDefinitionsForVictory,
    awardVictoryXp,
    applyXpMetadata,
    runSmokeTest
  });

  global.LuminousCombatXpRuntime = api;
})(typeof window !== 'undefined' ? window : globalThis);

