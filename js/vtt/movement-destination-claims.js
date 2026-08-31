(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) {
    root.LuminousVttMovementDestinationClaims = api;
    api.install(root);
  }
})(typeof window !== 'undefined' ? window : globalThis, function (root) {
  'use strict';

  const CLAIM_ROOT = 'campaña/estado_mundo/vttMovementClaims';
  const DEFAULT_ARBITRATION_MS = 120;
  const DEFAULT_LEASE_MS = 3000;
  const DEFAULT_POST_COMMIT_HOLD_MS = 650;
  const clean = (value) => String(value ?? '').trim();
  const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));

  function firebaseKey(value, fallback = 'key') {
    return clean(value).replace(/[.#$\[\]\/]/g, '_') || fallback;
  }

  function authorityFor(token = {}, isDm = false) {
    const explicit = clean(token.pendingMovementAuthority || token.controlSource || token.controllerType).toLowerCase();
    if (explicit === 'goap' || explicit === 'ai') return 'goap';
    if (explicit === 'dm' || explicit === 'gm') return 'dm';
    if (explicit === 'player' || explicit === 'human') return 'player';
    return isDm ? 'dm' : 'player';
  }

  function cellForClaim(claim = {}, mapData = {}) {
    const to = claim.to || {};
    const size = Math.max(1, finite(mapData.grid?.size, 70));
    const cols = Math.max(1, Math.trunc(finite(mapData.grid?.cols, 1)));
    const rows = Math.max(1, Math.trunc(finite(mapData.grid?.rows, 1)));
    const col = Number.isFinite(Number(to.col)) ? Math.trunc(Number(to.col)) : Math.floor(finite(to.x) / size);
    const row = Number.isFinite(Number(to.row)) ? Math.trunc(Number(to.row)) : Math.floor(finite(to.y) / size);
    if (col < 0 || row < 0 || col >= cols || row >= rows) return null;
    return { col, row, zLayer: Math.trunc(finite(to.zLayer ?? to.z, 0)) };
  }

  function claimPath(mapId, cell) {
    return `${CLAIM_ROOT}/${firebaseKey(mapId, 'default')}/${firebaseKey(cell.zLayer, '0')}/${cell.col}_${cell.row}`;
  }

  function sameClaim(a, b) {
    return Boolean(a?.claimId && b?.claimId && String(a.claimId) === String(b.claimId));
  }

  function claimExpired(claim, nowMs) {
    return !claim || finite(claim.expiresAtMs, 0) <= nowMs;
  }

  function winnerBetween(current, candidate, nowMs, rules) {
    if (!current || claimExpired(current, nowMs)) return candidate;
    if (sameClaim(current, candidate) || String(current.tokenId || '') === String(candidate.tokenId || '')) return candidate;
    if (current.locked === true || current.committed === true) return current;
    const resolver = rules?.resolveSpaceClaim;
    if (typeof resolver !== 'function') return current;
    return resolver([current, candidate]) || current;
  }

  function restoreFromClaim(token, claim = {}) {
    const from = claim.from || {};
    if (Number.isFinite(Number(from.x))) token.x = Number(from.x);
    if (Number.isFinite(Number(from.y))) token.y = Number(from.y);
    const zLayer = Number.isFinite(Number(from.zLayer)) ? Number(from.zLayer) : Number(token.zLayer || 0);
    token.zLayer = zLayer;
    token.z = [zLayer];
    if (Number.isFinite(Number(from.elevationFt))) token.elevationFt = Number(from.elevationFt);
    if (from.gridPosition) token.gridPosition = clone(from.gridPosition);

    const refund = Math.max(0, finite(claim.movementCostFt, 0));
    if (refund > 0 && Number.isFinite(Number(token.movementRemainingFt))) {
      const state = token.movementState || {};
      const speed = Math.max(0, finite(state.speedFt, 0));
      const capacity = speed * (state.dashed ? 2 : 1);
      const next = capacity > 0 ? Math.min(capacity, Number(token.movementRemainingFt) + refund) : Number(token.movementRemainingFt) + refund;
      token.movementRemainingFt = next;
      state.remainingFt = next;
      token.movementState = state;
    }
    if (Array.isArray(token.movementTurnHistory) && token.movementTurnHistory.length) token.movementTurnHistory.pop();
    delete token.pendingMovementClaim;
    return token;
  }

  function install(host = root) {
    const base = host?.LuminousVttTokenState;
    if (!base || base.__destinationClaimPatch) return base || null;
    const createBridgeBase = base.createBridge;

    function createBridge(options = {}) {
      const bridge = createBridgeBase(options);
      const mapData = options.mapData || {};
      const firebase = options.firebase || base.hostFirebase?.(host) || host?.firebase;
      const db = options.db || firebase?.database?.() || null;
      const mapId = String(bridge.mapId || mapData.id || mapData.mapId || 'default');
      const isDm = Boolean(options.isDm ?? bridge.isDm);
      const arbitrationMs = Math.max(0, finite(options.movementClaimArbitrationMs, DEFAULT_ARBITRATION_MS));
      const leaseMs = Math.max(arbitrationMs + 250, finite(options.movementClaimLeaseMs, DEFAULT_LEASE_MS));
      const postCommitHoldMs = Math.max(0, finite(options.movementClaimPostCommitHoldMs, DEFAULT_POST_COMMIT_HOLD_MS));
      const now = typeof options.movementClaimNow === 'function' ? options.movementClaimNow : () => Date.now();
      const sleep = typeof options.movementClaimSleep === 'function'
        ? options.movementClaimSleep
        : (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      const schedule = typeof options.movementClaimSchedule === 'function'
        ? options.movementClaimSchedule
        : (fn, ms) => setTimeout(fn, ms);
      const reservations = new Map();

      function rulesRuntime() { return host?.LuminousVttMovementRules || null; }
      function tokenKey(token = {}) { return clean(token.id || token.canonicalPlayerKey || token.playerId || bridge.identity?.playerId); }

      function candidateFor(token, pending, cell) {
        const timestamp = Math.max(0, Math.trunc(now()));
        const rtt = Number.isFinite(Number(pending.rttMs ?? token.networkRttMs ?? token.rttMs)) ? Number(pending.rttMs ?? token.networkRttMs ?? token.rttMs) : null;
        return {
          schemaVersion: 1,
          claimId: `${firebaseKey(token.id || bridge.identity?.playerId || 'token')}:${timestamp.toString(36)}:${Math.random().toString(36).slice(2, 8)}`,
          tokenId: clean(token.id) || null,
          playerId: clean(token.playerId || token.canonicalPlayerKey || bridge.identity?.playerId) || null,
          authority: authorityFor(token, isDm),
          rttMs: rtt,
          receivedAtMs: timestamp,
          expiresAtMs: timestamp + leaseMs,
          locked: false,
          committed: false,
          cell,
          localId: clean(pending.localId) || null,
          from: clone(pending.from || null),
          to: clone(pending.to || null),
          movementCostFt: Math.max(0, finite(pending.movementCostFt, 0)),
          movementType: clean(pending.movementType || 'normal') || 'normal',
        };
      }

      async function transact(ref, updater) {
        if (!ref?.transaction) throw new Error('MOVEMENT_CLAIM_TRANSACTION_UNAVAILABLE');
        return ref.transaction(updater, undefined, false);
      }

      async function readClaim(ref) {
        if (!ref?.once) throw new Error('MOVEMENT_CLAIM_READ_UNAVAILABLE');
        const snapshot = await ref.once('value');
        return snapshot?.val?.() || null;
      }

      async function acquireClaim(token, pending) {
        if (!db) throw new Error('MOVEMENT_CLAIM_DB_UNAVAILABLE');
        const cell = cellForClaim(pending, mapData);
        if (!cell) throw new Error('OUT_OF_BOUNDS');
        const ref = db.ref(claimPath(mapId, cell));
        const candidate = candidateFor(token, pending, cell);
        const first = await transact(ref, (current) => {
          const winner = winnerBetween(current, candidate, now(), rulesRuntime());
          return sameClaim(winner, candidate) ? candidate : undefined;
        });
        if (!first?.committed) return { valid: false, reason: 'MOVEMENT_DESTINATION_CLAIM_LOST', ref, candidate, occupant: first?.snapshot?.val?.() || null };

        if (arbitrationMs > 0) await sleep(arbitrationMs);
        const observed = await readClaim(ref);
        if (!sameClaim(observed, candidate)) return { valid: false, reason: 'MOVEMENT_DESTINATION_CLAIM_LOST', ref, candidate, occupant: observed };

        const locked = await transact(ref, (current) => {
          if (!sameClaim(current, candidate) || current?.committed === true) return undefined;
          return { ...current, locked: true, lockedAtMs: Math.max(0, Math.trunc(now())), expiresAtMs: Math.max(finite(current.expiresAtMs, 0), now() + leaseMs) };
        });
        if (!locked?.committed) return { valid: false, reason: 'MOVEMENT_DESTINATION_CLAIM_LOST', ref, candidate, occupant: locked?.snapshot?.val?.() || null };
        return { valid: true, ref, candidate: { ...candidate, locked: true } };
      }

      async function markCommitted(reservation) {
        if (!reservation?.ref || !reservation?.candidate) return false;
        const result = await transact(reservation.ref, (current) => {
          if (!sameClaim(current, reservation.candidate)) return undefined;
          return { ...current, locked: true, committed: true, committedAtMs: Math.max(0, Math.trunc(now())), expiresAtMs: Math.max(finite(current.expiresAtMs, 0), now() + postCommitHoldMs + 500) };
        });
        return Boolean(result?.committed);
      }

      async function releaseClaim(reservation) {
        if (!reservation?.ref || !reservation?.candidate) return false;
        try {
          const result = await transact(reservation.ref, (current) => sameClaim(current, reservation.candidate) ? null : undefined);
          return Boolean(result?.committed);
        } catch (_) {
          return false;
        }
      }

      function rollback(token, pending, reason = 'MOVEMENT_DESTINATION_CLAIM_LOST') {
        restoreFromClaim(token, pending);
        mapData.movement ||= {};
        mapData.movement.lastClaimLoss = { tokenId: token?.id || null, reason, atMs: Math.max(0, Math.trunc(now())) };
        options.onTokensChanged?.({ scope: 'movement-claim', tokenId: token?.id || null, reason, reverted: true });
      }

      async function reserveMovementDestinationClaim(token, pending = token?.pendingMovementClaim) {
        if (!pending) return { valid: true, skipped: true };
        const key = tokenKey(token);
        if (!key) return { valid: false, reason: 'MOVEMENT_CLAIM_TOKEN_KEY_REQUIRED' };
        const existing = reservations.get(key);
        if (existing && clean(existing.localId) === clean(pending.localId)) return { valid: true, reused: true, reservation: existing };
        if (existing) {
          await releaseClaim(existing).catch(() => false);
          reservations.delete(key);
        }
        const reservation = await acquireClaim(token, pending);
        if (!reservation.valid) return reservation;
        reservation.localId = clean(pending.localId) || null;
        reservations.set(key, reservation);
        return { valid: true, reservation };
      }

      async function cancelMovementDestinationClaim(token, optionsValue = {}) {
        const key = tokenKey(token);
        const reservation = key ? reservations.get(key) : null;
        if (reservation) {
          reservations.delete(key);
          await releaseClaim(reservation);
        }
        if (optionsValue.rollback === true && token?.pendingMovementClaim) rollback(token, token.pendingMovementClaim, optionsValue.reason || 'MOVEMENT_DESTINATION_CLAIM_CANCELLED');
        else if (token) delete token.pendingMovementClaim;
        return { valid: true, released: Boolean(reservation) };
      }

      async function saveWithClaim(token, saveCanonical) {
        const pending = token?.pendingMovementClaim;
        if (!pending) return saveCanonical();
        const key = tokenKey(token);
        let reservation = key ? reservations.get(key) : null;
        if (!reservation || clean(reservation.localId) !== clean(pending.localId)) {
          const reserved = await reserveMovementDestinationClaim(token, pending);
          if (!reserved.valid) {
            rollback(token, pending, reserved.reason);
            const error = new Error(reserved.reason || 'MOVEMENT_DESTINATION_CLAIM_LOST');
            error.claim = reserved.occupant || null;
            throw error;
          }
          reservation = reserved.reservation;
        }
        try {
          const result = await saveCanonical();
          const committed = await markCommitted(reservation);
          if (!committed) throw new Error('MOVEMENT_DESTINATION_CLAIM_COMMIT_LOST');
          if (key) reservations.delete(key);
          delete token.pendingMovementClaim;
          schedule(() => { void releaseClaim(reservation); }, postCommitHoldMs);
          return { ...result, destinationClaim: { valid: true, cell: reservation.candidate.cell, authority: reservation.candidate.authority } };
        } catch (error) {
          if (key) reservations.delete(key);
          await releaseClaim(reservation);
          rollback(token, pending, error?.message || 'MOVEMENT_CANONICAL_SAVE_FAILED');
          throw error;
        }
      }

      async function saveToken(token) {
        return saveWithClaim(token, () => bridge.saveToken(token));
      }

      async function createWorldToken(token) {
        const saver = typeof bridge.createWorldToken === 'function' ? () => bridge.createWorldToken(token) : () => bridge.saveToken(token);
        return saveWithClaim(token, saver);
      }

      function stop() {
        for (const reservation of reservations.values()) void releaseClaim(reservation);
        reservations.clear();
        return bridge.stop?.();
      }

      return Object.freeze({
        ...bridge,
        stop,
        saveToken,
        createWorldToken,
        acquireMovementDestinationClaim: acquireClaim,
        reserveMovementDestinationClaim,
        cancelMovementDestinationClaim,
        releaseMovementDestinationClaim: releaseClaim,
        movementDestinationReservationCount: () => reservations.size,
      });
    }

    const patched = Object.freeze({
      ...base,
      __destinationClaimPatch: true,
      CLAIM_ROOT,
      DEFAULT_ARBITRATION_MS,
      DEFAULT_LEASE_MS,
      DEFAULT_POST_COMMIT_HOLD_MS,
      authorityFor,
      cellForClaim,
      winnerBetween,
      restoreFromClaim,
      createBridge,
    });
    host.LuminousVttTokenState = patched;
    return patched;
  }

  return Object.freeze({
    CLAIM_ROOT,
    DEFAULT_ARBITRATION_MS,
    DEFAULT_LEASE_MS,
    DEFAULT_POST_COMMIT_HOLD_MS,
    firebaseKey,
    authorityFor,
    cellForClaim,
    winnerBetween,
    restoreFromClaim,
    install,
  });
});
