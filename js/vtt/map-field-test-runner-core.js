(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.LuminousVttMapFieldTestRunner = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  const LIMITS = Object.freeze({
    maxPlayers: 8,
    maxActiveChunks: 8,
    maxLiveCells: 12800,
    maxActiveZones: 8,
    liveChunkCells: 1600,
    chunkSizeCells: 40,
    expectedPovDeg: 120,
  });

  const COVERAGE_KEYS = Object.freeze([
    'movementPreview',
    'movementCommit',
    'chunkStreaming',
    'regionalLocal',
    'zLayer',
    'viewAs',
    'fogDiscovery',
    'persistence',
    'reconnect',
    'globalMap',
    'firebaseRules',
  ]);

  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
  const clean = (value) => String(value ?? '').trim();
  const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

  function playerScope(token = {}) {
    return token.canonicalScope === 'player'
      || Boolean(clean(token.canonicalPlayerKey || token.playerId || token.characterLink?.playerId))
      || ['player', 'current_player'].includes(clean(token.characterLink?.mode).toLowerCase());
  }

  function actorIdentity(token = {}) {
    return clean(token.actorId || token.characterLink?.actorId || token.actorRef?.id) || null;
  }

  function duplicatePlayerActorIds(tokens = []) {
    const groups = new Map();
    for (const token of Array.isArray(tokens) ? tokens : []) {
      const actorId = actorIdentity(token);
      if (!actorId) continue;
      const group = groups.get(actorId) || { player: 0, world: 0, tokenIds: [] };
      if (playerScope(token)) group.player += 1;
      else group.world += 1;
      group.tokenIds.push(clean(token.id));
      groups.set(actorId, group);
    }
    return [...groups.entries()]
      .filter(([, group]) => group.player > 0 && group.world > 0)
      .map(([actorId, group]) => Object.freeze({ actorId, playerTokens: group.player, worldTokens: group.world, tokenIds: Object.freeze(group.tokenIds.filter(Boolean)) }));
  }

  function isPermissionDenied(error) {
    const text = clean(error?.code || error?.message || error).toLowerCase();
    return text.includes('permission_denied') || text.includes('permission denied') || text.includes('access denied');
  }

  function blankCounters() {
    return {
      previews: 0,
      commits: 0,
      commitsWhilePointerDown: 0,
      completedPreviewDrags: 0,
      zTransitions: 0,
      chunkLoads: 0,
      chunkTransitions: 0,
      regionalLocalTransitions: 0,
      canonicalSyncs: 0,
      observerChanges: 0,
      discoveryUpdates: 0,
      discoveryWrites: 0,
      simulationLifecycles: 0,
      zonePersists: 0,
      deltaRecords: 0,
      permissionDenied: 0,
      errors: 0,
    };
  }

  function blankCoverage() {
    return Object.fromEntries(COVERAGE_KEYS.map((key) => [key, false]));
  }

  function createTracker({ now = () => Date.now() } = {}) {
    let active = false;
    let startedAt = null;
    let stoppedAt = null;
    let pointerDown = false;
    let counters = blankCounters();
    let coverage = blankCoverage();
    let lastObserver = null;
    let lastPermissionError = null;
    const pendingPreviewTokens = new Set();

    function reset() {
      active = false;
      startedAt = null;
      stoppedAt = null;
      pointerDown = false;
      counters = blankCounters();
      coverage = blankCoverage();
      lastObserver = null;
      lastPermissionError = null;
      pendingPreviewTokens.clear();
      return snapshot();
    }

    function start() {
      reset();
      active = true;
      startedAt = now();
      return snapshot();
    }

    function stop() {
      if (active) stoppedAt = now();
      active = false;
      pointerDown = false;
      return snapshot();
    }

    function markCoverage(key, value = true) {
      if (Object.prototype.hasOwnProperty.call(coverage, key)) coverage[key] = Boolean(value);
      return snapshot();
    }

    function record(name, detail = {}) {
      if (!active) return snapshot();
      const tokenId = clean(detail.tokenId);
      switch (name) {
        case 'field:pointer-down': pointerDown = true; break;
        case 'field:pointer-up': pointerDown = false; break;
        case 'vtt:token-preview-moved':
          counters.previews += 1;
          coverage.movementPreview = true;
          if (tokenId) pendingPreviewTokens.add(tokenId);
          break;
        case 'vtt:token-moved':
          counters.commits += 1;
          coverage.movementCommit = true;
          if (pointerDown) counters.commitsWhilePointerDown += 1;
          if (tokenId && pendingPreviewTokens.has(tokenId)) {
            counters.completedPreviewDrags += 1;
            pendingPreviewTokens.delete(tokenId);
          }
          break;
        case 'vtt:token-z-transition':
          counters.zTransitions += 1;
          if (detail.complete !== false) coverage.zLayer = true;
          break;
        case 'vtt:procedural-chunk-loaded':
          counters.chunkLoads += 1;
          coverage.chunkStreaming = true;
          break;
        case 'vtt:procedural-chunk-transition':
          counters.chunkTransitions += 1;
          coverage.chunkStreaming = true;
          break;
        case 'vtt:regional-local-transition-applied':
          counters.regionalLocalTransitions += 1;
          coverage.regionalLocal = true;
          break;
        case 'vtt:canonical-tokens-synced': counters.canonicalSyncs += 1; break;
        case 'vtt:dm-observer-changed':
          counters.observerChanges += 1;
          lastObserver = clone(detail);
          if (clean(detail.mode).toLowerCase() === 'view_as') coverage.viewAs = true;
          break;
        case 'vtt:player-discovery-updated':
          counters.discoveryUpdates += 1;
          coverage.fogDiscovery = true;
          if (detail.changed === true) counters.discoveryWrites += 1;
          break;
        case 'vtt:map-simulation-lifecycle': counters.simulationLifecycles += 1; break;
        case 'vtt:map-simulation-zone-persisted':
          counters.zonePersists += 1;
          coverage.persistence = true;
          break;
        case 'vtt:map-simulation-delta-recorded': counters.deltaRecords += 1; break;
        case 'field:permission-error':
          counters.permissionDenied += 1;
          counters.errors += 1;
          lastPermissionError = clean(detail.message || detail.code || 'PERMISSION_DENIED');
          break;
        case 'field:error': counters.errors += 1; break;
        default: break;
      }
      return snapshot();
    }

    function reportError(error) {
      if (!active) return snapshot();
      return record(isPermissionDenied(error) ? 'field:permission-error' : 'field:error', {
        code: clean(error?.code),
        message: clean(error?.message || error),
      });
    }

    function snapshot() {
      return Object.freeze({
        active,
        startedAt,
        stoppedAt,
        pointerDown,
        counters: Object.freeze({ ...counters }),
        coverage: Object.freeze({ ...coverage }),
        pendingPreviewTokens: Object.freeze([...pendingPreviewTokens]),
        lastObserver: clone(lastObserver),
        lastPermissionError,
      });
    }

    return Object.freeze({ start, stop, reset, record, reportError, markCoverage, snapshot, isActive: () => active });
  }

  function status(id, state, value, limit, message) {
    return Object.freeze({ id, state, value, limit, message });
  }

  function evaluate(raw = {}) {
    const grid = raw.grid || {};
    const world = raw.worldStreaming || {};
    const sim = raw.mapSimulation || {};
    const counters = raw.counters || {};
    const coverage = raw.coverage || {};
    const tokens = Array.isArray(raw.tokens) ? raw.tokens : [];
    const duplicates = duplicatePlayerActorIds(tokens);
    const cols = finite(grid.cols, 0), rows = finite(grid.rows, 0);
    const activeChunks = finite(world.activeChunks, -1), liveCells = finite(world.liveCells, -1);
    const activeZones = finite(sim.activeZones, -1);
    const players = tokens.filter(playerScope).length;
    const checks = [];

    checks.push(cols > 0 && rows > 0
      ? status('live-grid', cols <= LIMITS.chunkSizeCells && rows <= LIMITS.chunkSizeCells ? 'pass' : 'fail', `${cols}x${rows}`, '40x40', 'La escena viva debe materializar solo un chunk.')
      : status('live-grid', 'warn', 'unknown', '40x40', 'Grid vivo no disponible.'));

    checks.push(activeChunks >= 0
      ? status('active-chunks', activeChunks <= LIMITS.maxActiveChunks ? 'pass' : 'fail', activeChunks, LIMITS.maxActiveChunks, 'WorldStreaming debe permanecer dentro del presupuesto de 8 chunks activos.')
      : status('active-chunks', 'warn', 'unknown', LIMITS.maxActiveChunks, 'WorldStreaming aún no reporta métricas.'));

    checks.push(liveCells >= 0
      ? status('live-cells', liveCells <= LIMITS.maxLiveCells ? 'pass' : 'fail', liveCells, LIMITS.maxLiveCells, '8 jugadores separados no deben superar 12,800 celdas vivas.')
      : status('live-cells', 'warn', 'unknown', LIMITS.maxLiveCells, 'No hay métrica de celdas vivas.'));

    checks.push(activeZones >= 0
      ? status('active-zones', activeZones <= LIMITS.maxActiveZones ? 'pass' : 'fail', activeZones, LIMITS.maxActiveZones, 'Simulation Bubbles debe permanecer acotado.')
      : status('active-zones', 'warn', 'unknown', LIMITS.maxActiveZones, 'Map Simulation aún no reporta zonas.'));

    checks.push(status('duplicate-player-actors', duplicates.length === 0 ? 'pass' : 'fail', duplicates.length, 0, 'Un Actor asignado a jugador no puede reaparecer como world/NPC token.'));
    checks.push(status('permission-denied', finite(counters.permissionDenied, 0) === 0 ? 'pass' : 'fail', finite(counters.permissionDenied, 0), 0, 'No debe aparecer PERMISSION_DENIED durante el field test.'));
    checks.push(status('commit-during-drag', finite(counters.commitsWhilePointerDown, 0) === 0 ? 'pass' : 'fail', finite(counters.commitsWhilePointerDown, 0), 0, 'La persistencia de movimiento debe ocurrir después del pointer-up.'));

    if (coverage.viewAs) {
      const cone = finite(raw.viewAsConeDeg, 0);
      checks.push(status('view-as-cone', Math.abs(cone - LIMITS.expectedPovDeg) < 0.01 ? 'pass' : 'fail', cone, LIMITS.expectedPovDeg, 'View As debe usar el POV canónico de 120°.'));
    } else checks.push(status('view-as-cone', 'warn', 'not exercised', LIMITS.expectedPovDeg, 'Todavía no se probó View As.'));

    checks.push(players === LIMITS.maxPlayers
      ? status('eight-player-load', 'pass', players, LIMITS.maxPlayers, 'Carga de 8 jugadores presente.')
      : status('eight-player-load', players > LIMITS.maxPlayers ? 'fail' : 'warn', players, LIMITS.maxPlayers, 'La prueba de stress final requiere 8 jugadores.'));

    const coverageDone = COVERAGE_KEYS.filter((key) => coverage[key] === true).length;
    const failures = checks.filter((check) => check.state === 'fail');
    const warnings = checks.filter((check) => check.state === 'warn');
    const overall = failures.length ? 'fail' : warnings.length || coverageDone < COVERAGE_KEYS.length ? 'warn' : 'pass';

    return Object.freeze({
      overall,
      checks: Object.freeze(checks),
      duplicatePlayerActors: Object.freeze(duplicates),
      coverage: Object.freeze({ done: coverageDone, total: COVERAGE_KEYS.length, values: Object.freeze({ ...coverage }) }),
      counters: Object.freeze({ ...counters }),
    });
  }

  return Object.freeze({ LIMITS, COVERAGE_KEYS, playerScope, actorIdentity, duplicatePlayerActorIds, isPermissionDenied, createTracker, evaluate });
});