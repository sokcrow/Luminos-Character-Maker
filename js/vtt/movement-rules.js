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
    if (state === 'open' || state === 'broken' || door.open === true) return { valid: true, continueMovement: true, actionRequired: false, noise: 'normal' };
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

  function orientation(a, b, c) {
    const value = ((finite(b.y) - finite(a.y)) * (finite(c.x) - finite(b.x))) - ((finite(b.x) - finite(a.x)) * (finite(c.y) - finite(b.y)));
    if (Math.abs(value) < 1e-9) return 0;
    return value > 0 ? 1 : 2;
  }

  function onSegment(a, b, c) {
    return finite(b.x) <= Math.max(finite(a.x), finite(c.x)) + 1e-9
      && finite(b.x) + 1e-9 >= Math.min(finite(a.x), finite(c.x))
      && finite(b.y) <= Math.max(finite(a.y), finite(c.y)) + 1e-9
      && finite(b.y) + 1e-9 >= Math.min(finite(a.y), finite(c.y));
  }

  function segmentsIntersect(a, b, c, d) {
    const o1 = orientation(a, b, c);
    const o2 = orientation(a, b, d);
    const o3 = orientation(c, d, a);
    const o4 = orientation(c, d, b);
    if (o1 !== o2 && o3 !== o4) return true;
    if (o1 === 0 && onSegment(a, c, b)) return true;
    if (o2 === 0 && onSegment(a, d, b)) return true;
    if (o3 === 0 && onSegment(c, a, d)) return true;
    if (o4 === 0 && onSegment(c, b, d)) return true;
    return false;
  }

  function segmentIntersectionPoint(a = {}, b = {}, c = {}, d = {}) {
    const x1 = finite(a.x); const y1 = finite(a.y);
    const x2 = finite(b.x); const y2 = finite(b.y);
    const x3 = finite(c.x); const y3 = finite(c.y);
    const x4 = finite(d.x); const y4 = finite(d.y);
    const denominator = ((x1 - x2) * (y3 - y4)) - ((y1 - y2) * (x3 - x4));
    if (Math.abs(denominator) < 1e-9) return null;
    const t = (((x1 - x3) * (y3 - y4)) - ((y1 - y3) * (x3 - x4))) / denominator;
    const u = -((((x1 - x2) * (y1 - y3)) - ((y1 - y2) * (x1 - x3))) / denominator);
    if (t < -1e-9 || t > 1 + 1e-9 || u < -1e-9 || u > 1 + 1e-9) return null;
    return { x: x1 + (t * (x2 - x1)), y: y1 + (t * (y2 - y1)) };
  }

  function topologyElementLayer(element = {}, zLayer = 0) {
    const layers = Array.isArray(element.z) ? element.z.map(Number) : [Number(element.z ?? 0)];
    return layers.includes(Number(zLayer));
  }

  function doorSegment(door = {}, grid = {}) {
    const size = Math.max(1, finite(grid.size, 70));
    return {
      a: { x: finite(door.from?.col) * size, y: finite(door.from?.row) * size },
      b: { x: finite(door.to?.col) * size, y: finite(door.to?.row) * size },
    };
  }

  function doorCrossings(path = [], mapData = {}, zLayer = 0) {
    const points = Array.isArray(path) ? path : [];
    if (points.length < 2) return [];
    const doors = (Array.isArray(mapData.topology) ? mapData.topology : []).filter((element) => clean(element?.type) === 'door' && topologyElementLayer(element, zLayer));
    const results = [];
    for (let pathIndex = 0; pathIndex < points.length - 1; pathIndex += 1) {
      const from = points[pathIndex];
      const to = points[pathIndex + 1];
      for (const door of doors) {
        const segment = doorSegment(door, mapData.grid || {});
        if (!segmentsIntersect(from, to, segment.a, segment.b)) continue;
        if (results.some((entry) => String(entry.door?.id || '') === String(door.id || '') && entry.pathIndex === pathIndex)) continue;
        const point = segmentIntersectionPoint(from, to, segment.a, segment.b)
          || { x: (finite(from.x) + finite(to.x)) / 2, y: (finite(from.y) + finite(to.y)) / 2 };
        results.push({ door, pathIndex, from, to, point, state: clean(door.state || 'closed') || 'closed' });
      }
    }
    return results;
  }

  function mapWithPassableDoors(mapData = {}, predicate = () => true) {
    return {
      ...mapData,
      topology: (Array.isArray(mapData.topology) ? mapData.topology : []).map((element) => {
        if (clean(element?.type) !== 'door' || !predicate(element)) return element;
        return { ...element, state: 'open' };
      }),
    };
  }

  function truncateBeforeDoor(path = [], crossing = null) {
    if (!crossing || !Array.isArray(path) || !path.length) return Array.isArray(path) ? [...path] : [];
    const stopIndex = Math.max(0, Math.min(path.length - 1, Math.trunc(finite(crossing.pathIndex, 0))));
    return path.slice(0, stopIndex + 1);
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
    segmentsIntersect,
    segmentIntersectionPoint,
    doorSegment,
    doorCrossings,
    mapWithPassableDoors,
    truncateBeforeDoor,
    snapshotTurnStart,
    rememberVisibility,
    zoneShouldPersist,
  });
});
