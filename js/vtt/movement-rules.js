(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.LuminousVttMovementRules = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  const SIZE_ORDER = Object.freeze(['tiny', 'small', 'medium', 'large', 'huge', 'gargantuan']);
  const AUTHORITY = Object.freeze({ goap: 1, player: 2, dm: 3 });
  const clean = (value) => String(value ?? '').trim().toLowerCase();
  const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

  function sizeRank(token = {}) {
    const raw = clean(token.size || token.sizeCategory || token.actorSize || token.actor?.size || 'medium');
    const index = SIZE_ORDER.indexOf(raw);
    return index >= 0 ? index : SIZE_ORDER.indexOf('medium');
  }

  function relationBetween(a = {}, b = {}, resolver = null) {
    if (typeof resolver === 'function') {
      const resolved = clean(resolver(a, b));
      if (['ally', 'enemy', 'neutral'].includes(resolved)) return resolved;
    }
    if (a === b || (a.id != null && b.id != null && String(a.id) === String(b.id))) return 'self';
    const explicit = clean(a.relations?.[b.id] || b.relations?.[a.id]);
    if (['ally', 'friendly', 'friend'].includes(explicit)) return 'ally';
    if (['enemy', 'hostile', 'foe'].includes(explicit)) return 'enemy';
    for (const key of ['teamId', 'partyId', 'factionId']) {
      const left = String(a?.[key] ?? '').trim();
      const right = String(b?.[key] ?? '').trim();
      if (left && right) return left === right ? 'ally' : 'enemy';
    }
    const leftDisposition = clean(a.disposition || a.attitude);
    const rightDisposition = clean(b.disposition || b.attitude);
    if (['ally', 'friendly'].includes(leftDisposition) && ['ally', 'friendly'].includes(rightDisposition)) return 'ally';
    if (leftDisposition === 'hostile' || rightDisposition === 'hostile') return 'enemy';
    return 'neutral';
  }

  function canTraverseOccupiedSpace(mover = {}, occupant = {}, options = {}) {
    const relation = relationBetween(mover, occupant, options.relationResolver);
    if (relation === 'self') return { valid: true, relation, reason: null };
    if (relation === 'ally') return { valid: true, relation, reason: null };
    const sizeDifference = sizeRank(occupant) - sizeRank(mover);
    if (sizeDifference >= 2) return { valid: true, relation, reason: null, sizeDifference };
    return { valid: false, relation, reason: relation === 'enemy' ? 'HOSTILE_TOKEN_BLOCKS_PATH' : 'TOKEN_BLOCKS_PATH', sizeDifference };
  }

  function canEndInOccupiedSpace(mover = {}, occupant = {}) {
    if (!occupant || mover === occupant || (mover.id != null && occupant.id != null && String(mover.id) === String(occupant.id))) {
      return { valid: true, reason: null };
    }
    return { valid: false, reason: 'OCCUPIED_DESTINATION', token: occupant };
  }

  function authorityRank(value) {
    const key = clean(value?.authority || value?.sourceType || value?.type || value);
    if (key === 'dm' || key === 'gm') return AUTHORITY.dm;
    if (key === 'player' || key === 'human') return AUTHORITY.player;
    return AUTHORITY.goap;
  }

  function compareSpaceClaims(left = {}, right = {}) {
    const authorityDelta = authorityRank(right) - authorityRank(left);
    if (authorityDelta) return authorityDelta;
    const leftRtt = Math.max(0, finite(left.rttMs ?? left.latencyMs, Infinity));
    const rightRtt = Math.max(0, finite(right.rttMs ?? right.latencyMs, Infinity));
    if (leftRtt !== rightRtt) return leftRtt - rightRtt;
    const leftReceived = Math.max(0, finite(left.receivedAtMs ?? left.receivedAt, Infinity));
    const rightReceived = Math.max(0, finite(right.receivedAtMs ?? right.receivedAt, Infinity));
    if (leftReceived !== rightReceived) return leftReceived - rightReceived;
    return String(left.tokenId || left.id || '').localeCompare(String(right.tokenId || right.id || ''));
  }

  function resolveSpaceClaim(claims = []) {
    const valid = (Array.isArray(claims) ? claims : []).filter(Boolean);
    if (!valid.length) return null;
    return [...valid].sort(compareSpaceClaims)[0];
  }

  function doorTraversal({ mode = 'walk', door = {}, remainingFt = Infinity, dashActive = false } = {}) {
    const state = clean(door.state || door.doorState || (door.open ? 'open' : 'closed')) || 'closed';
    const locked = Boolean(door.locked || state === 'locked');
    if (state === 'open' || door.open === true) return { valid: true, continueMovement: true, actionRequired: false, noise: 'normal' };
    if (locked) return { valid: false, continueMovement: false, actionRequired: true, reason: 'DOOR_LOCKED', noise: 'none' };
    const running = dashActive || clean(mode) === 'dash' || clean(mode) === 'run';
    if (running) {
      return {
        valid: true,
        continueMovement: Number.isFinite(Number(remainingFt)) ? Number(remainingFt) > 0 : true,
        actionRequired: false,
        opensDoor: true,
        burstOpen: true,
        noise: 'high',
        soundEvent: 'DASH_DOOR_BURST',
      };
    }
    return { valid: false, continueMovement: false, actionRequired: true, opensDoor: false, reason: 'DOOR_ACTION_REQUIRED', noise: 'none' };
  }

  function snapshotTurnStart(token = {}) {
    return {
      x: finite(token.x),
      y: finite(token.y),
      zLayer: finite(token.zLayer ?? token.gridPosition?.z ?? token.z?.[0]),
      elevationFt: finite(token.elevationFt),
      gridPosition: token.gridPosition ? { ...token.gridPosition } : null,
    };
  }

  function rememberVisibility({ visibleNow = false, remembered = false, intelligenceAllowsMemory = false, minimapUnlocked = false } = {}) {
    if (visibleNow) return { layer: 'VISIBLE_NOW', liveActors: true, minimap: Boolean(minimapUnlocked) };
    if (remembered && intelligenceAllowsMemory) return { layer: 'REMEMBERED', liveActors: false, minimap: Boolean(minimapUnlocked) };
    return { layer: 'UNKNOWN', liveActors: false, minimap: Boolean(minimapUnlocked) };
  }

  function zoneShouldPersist({ playerCount = 0, dmSaved = false } = {}) {
    return Math.max(0, Math.trunc(finite(playerCount))) > 0 || Boolean(dmSaved);
  }

  return Object.freeze({
    SIZE_ORDER,
    AUTHORITY,
    sizeRank,
    relationBetween,
    canTraverseOccupiedSpace,
    canEndInOccupiedSpace,
    authorityRank,
    compareSpaceClaims,
    resolveSpaceClaim,
    doorTraversal,
    snapshotTurnStart,
    rememberVisibility,
    zoneShouldPersist,
  });
});
