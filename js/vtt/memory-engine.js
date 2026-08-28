(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.LuminousVttMemoryEngine = api;
})(typeof window !== 'undefined' ? window : globalThis, function (browserRoot) {
  'use strict';

  const SCHEMA_VERSION = 1;
  const DEFAULT_INT_THRESHOLDS = Object.freeze([
    Object.freeze({ min: 0, rank: 0 }),
    Object.freeze({ min: 8, rank: 1 }),
    Object.freeze({ min: 12, rank: 2 }),
    Object.freeze({ min: 16, rank: 3 }),
  ]);
  const DEFAULT_RANK_CAPABILITIES = Object.freeze({
    0: Object.freeze({ route: false, geometry: false, objectState: false, relationships: false, minimap: false, worldPoi: false, territory: false }),
    1: Object.freeze({ route: true, geometry: false, objectState: false, relationships: false, minimap: true, worldPoi: false, territory: false }),
    2: Object.freeze({ route: true, geometry: true, objectState: false, relationships: false, minimap: true, worldPoi: true, territory: false }),
    3: Object.freeze({ route: true, geometry: true, objectState: true, relationships: true, minimap: true, worldPoi: true, territory: true }),
  });

  const num = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const clean = (value) => String(value ?? '').trim();
  const normalizeId = (value) => clean(value).toLowerCase().replace(/\s+/g, '_');
  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
  const clampRank = (value) => Math.max(0, Math.min(3, Math.trunc(num(value, 0))));

  function hostWindow(root = browserRoot) {
    if (!root) return null;
    try { if (root.parent && root.parent !== root && root.parent.document) return root.parent; } catch (_) {}
    return root;
  }

  function intelligenceScore(character = {}, options = {}) {
    const runtime = options.racialRuntime || hostWindow(options.root || browserRoot)?.LuminousRacialStatRuntime || browserRoot?.LuminousRacialStatRuntime;
    try {
      const effective = runtime?.abilityScore?.('int', character);
      if (Number.isFinite(Number(effective))) return Number(effective);
    } catch (_) {}
    const candidates = [
      character?.stats?.inteligencia,
      character?.stats?.intelligence,
      character?.inteligencia,
      character?.intelligence,
      character?.abilities?.int,
      character?.abilities?.intelligence,
    ];
    const found = candidates.find((value) => Number.isFinite(Number(value)));
    return Number.isFinite(Number(found)) ? Number(found) : 10;
  }

  function thresholds(mapData = {}) {
    const configured = mapData?.memoryRules?.intThresholds;
    const source = Array.isArray(configured) && configured.length ? configured : DEFAULT_INT_THRESHOLDS;
    return source
      .map((entry) => ({ min: num(entry?.min, 0), rank: clampRank(entry?.rank) }))
      .sort((a, b) => a.min - b.min);
  }

  function rankForIntelligence(score, mapData = {}) {
    let rank = 0;
    for (const entry of thresholds(mapData)) if (num(score, 10) >= entry.min) rank = entry.rank;
    return clampRank(rank);
  }

  function mapTags(mapData = {}) {
    const raw = [
      ...(Array.isArray(mapData.environmentTags) ? mapData.environmentTags : []),
      ...(Array.isArray(mapData.memoryTags) ? mapData.memoryTags : []),
      mapData.mapType,
      mapData.biome,
      mapData.zoneType,
    ].filter(Boolean).map(normalizeId).filter(Boolean);
    if (!raw.length) raw.push('dungeon');
    return [...new Set(raw)];
  }

  function memorySpec(trait = {}) {
    const source = trait.mapMemory || trait.memory?.map || trait.memoryProfile || null;
    return source && typeof source === 'object' ? source : null;
  }

  function domainMatches(spec = {}, tags = []) {
    const domains = Array.isArray(spec.domains) ? spec.domains.map(normalizeId).filter(Boolean)
      : spec.domain ? [normalizeId(spec.domain)] : [];
    if (!domains.length || domains.includes('any')) return true;
    return domains.some((domain) => tags.includes(domain));
  }

  function mergeCapabilities(base = {}, patch = {}) {
    const result = { ...base };
    Object.entries(patch || {}).forEach(([key, value]) => {
      if (typeof value === 'boolean') result[key] = value;
    });
    return result;
  }

  function capabilitiesForRank(rank, mapData = {}) {
    const configured = mapData?.memoryRules?.rankCapabilities?.[rank] || mapData?.memoryRules?.rankCapabilities?.[String(rank)];
    return mergeCapabilities(DEFAULT_RANK_CAPABILITIES[clampRank(rank)], configured || {});
  }

  function resolveProfile({ character = {}, traits = [], mapData = {}, override = null, root = browserRoot } = {}) {
    const intelligence = intelligenceScore(character, { root });
    const baseRank = rankForIntelligence(intelligence, mapData);
    const tags = mapTags(mapData);
    let rank = baseRank;
    let capabilities = capabilitiesForRank(rank, mapData);
    const appliedTraits = [];

    for (const trait of Array.isArray(traits) ? traits : []) {
      const spec = memorySpec(trait);
      if (!spec || !domainMatches(spec, tags)) continue;
      const before = rank;
      rank = clampRank(rank + num(spec.rankBonus, 0));
      if (Number.isFinite(Number(spec.minimumRank))) rank = Math.max(rank, clampRank(spec.minimumRank));
      capabilities = mergeCapabilities(capabilitiesForRank(rank, mapData), capabilities);
      capabilities = mergeCapabilities(capabilities, spec.capabilities || {});
      appliedTraits.push({ id: normalizeId(trait.id || trait.name), fromRank: before, toRank: rank });
    }

    if (override && typeof override === 'object') {
      if (Number.isFinite(Number(override.rank))) rank = clampRank(override.rank);
      rank = clampRank(rank + num(override.rankBonus, 0));
      capabilities = capabilitiesForRank(rank, mapData);
      capabilities = mergeCapabilities(capabilities, override.capabilities || {});
    } else {
      capabilities = mergeCapabilities(capabilitiesForRank(rank, mapData), capabilities);
    }

    return Object.freeze({
      intelligence,
      baseRank,
      rank,
      tags,
      capabilities: Object.freeze({ ...capabilities }),
      appliedTraits: Object.freeze(appliedTraits),
      source: override && Number.isFinite(Number(override.rank)) ? 'dm_override' : 'intelligence_traits',
    });
  }

  function emptyMemory() {
    return {
      schemaVersion: SCHEMA_VERSION,
      profileSnapshot: null,
      dungeon: { layers: {}, objects: {}, relations: { keys: {} } },
      world: { places: {}, routes: {}, territories: {} },
      updatedAtClient: null,
    };
  }

  function normalizeMemory(raw = {}) {
    const source = raw && typeof raw === 'object' ? clone(raw) : {};
    const base = emptyMemory();
    return {
      ...base,
      ...source,
      schemaVersion: SCHEMA_VERSION,
      dungeon: {
        ...base.dungeon,
        ...(source.dungeon || {}),
        layers: { ...(source.dungeon?.layers || {}) },
        objects: { ...(source.dungeon?.objects || {}) },
        relations: {
          ...base.dungeon.relations,
          ...(source.dungeon?.relations || {}),
          keys: { ...(source.dungeon?.relations?.keys || {}) },
        },
      },
      world: {
        ...base.world,
        ...(source.world || {}),
        places: { ...(source.world?.places || {}) },
        routes: { ...(source.world?.routes || {}) },
        territories: { ...(source.world?.territories || {}) },
      },
    };
  }

  function layerMemory(record, zLayer) {
    const memory = record.dungeon || (record.dungeon = { layers: {}, objects: {}, relations: { keys: {} } });
    memory.layers ||= {};
    const key = String(Number(zLayer) || 0);
    memory.layers[key] ||= { routeCells: {}, rememberedCells: {} };
    memory.layers[key].routeCells ||= {};
    memory.layers[key].rememberedCells ||= {};
    return memory.layers[key];
  }

  function cellCoords(point = {}, mapData = {}) {
    const size = Math.max(1, num(mapData.grid?.size, 70));
    const cols = Math.max(1, Math.trunc(num(mapData.grid?.cols, 1)));
    const rows = Math.max(1, Math.trunc(num(mapData.grid?.rows, 1)));
    return {
      col: Math.max(0, Math.min(cols - 1, Math.floor(num(point.x) / size))),
      row: Math.max(0, Math.min(rows - 1, Math.floor(num(point.y) / size))),
    };
  }

  function cellKey(col, row) { return `${Math.trunc(num(col))}_${Math.trunc(num(row))}`; }
  function cellKeyForPoint(point, mapData) { const c = cellCoords(point, mapData); return cellKey(c.col, c.row); }
  function parseCellKey(key) {
    const [col, row] = clean(key).split('_').map(Number);
    return Number.isFinite(col) && Number.isFinite(row) ? { col, row } : null;
  }

  function topologyRuntime() {
    if (browserRoot?.LuminousVttTopology) return browserRoot.LuminousVttTopology;
    if (typeof require !== 'undefined') {
      try { return require('./topology.js'); } catch (_) {}
    }
    return null;
  }

  function normalizedTopology(raw, mapData = {}) {
    const topology = topologyRuntime();
    const element = topology?.normalizeElement ? topology.normalizeElement(raw) : clone(raw || {});
    if (!element) return null;
    const grid = mapData.grid || {};
    const segment = topology?.segment ? topology.segment(element, grid) : {
      x1: num(element.from?.col) * num(grid.size, 70), y1: num(element.from?.row) * num(grid.size, 70),
      x2: num(element.to?.col) * num(grid.size, 70), y2: num(element.to?.row) * num(grid.size, 70),
    };
    return { element, segment };
  }

  function elementOnLayer(element = {}, zLayer = 0) {
    const topology = topologyRuntime();
    if (topology?.elementOnLayer) return topology.elementOnLayer(element, zLayer);
    const layers = Array.isArray(element.z) ? element.z.map(Number) : [Number(element.z) || 0];
    return layers.includes(Number(zLayer));
  }

  function elementVisible(raw, visibleCells, mapData = {}, zLayer = 0) {
    if (!raw || !elementOnLayer(raw, zLayer)) return false;
    const normalized = normalizedTopology(raw, mapData);
    if (!normalized) return false;
    const { segment } = normalized;
    const points = [
      { x: segment.x1, y: segment.y1 },
      { x: segment.x2, y: segment.y2 },
      { x: (segment.x1 + segment.x2) / 2, y: (segment.y1 + segment.y2) / 2 },
    ];
    const size = Math.max(1, num(mapData.grid?.size, 70));
    const offsets = [[0,0],[size * .08,0],[-size * .08,0],[0,size * .08],[0,-size * .08]];
    return points.some((point) => offsets.some(([dx,dy]) => visibleCells.has(cellKeyForPoint({ x: point.x + dx, y: point.y + dy }, mapData))));
  }

  function visibleState(element = {}) {
    if (element.type === 'wall') return null;
    return element.state === 'locked' ? 'closed' : (element.state || 'closed');
  }

  function snapshotObject(raw, existing = null, profile = {}, mapData = {}, now = Date.now()) {
    const normalized = normalizedTopology(raw, mapData);
    if (!normalized) return existing;
    const element = normalized.element;
    const snapshot = {
      id: clean(element.id),
      type: element.type || 'wall',
      from: clone(element.from),
      to: clone(element.to),
      z: Array.isArray(element.z) ? [...element.z] : [Number(element.z) || 0],
      lastSeenAt: now,
    };
    if (profile.capabilities?.objectState && element.type !== 'wall') snapshot.lastKnownState = visibleState(element);
    if (existing?.lockKnowledge) snapshot.lockKnowledge = existing.lockKnowledge;
    return snapshot;
  }

  function setIfChanged(record, key, value) {
    if (record[key] === value) return false;
    record[key] = value;
    return true;
  }

  function observeDungeon({ memory, profile, mapData = {}, zLayer = 0, visibleCells = new Set(), routeTokens = [], topology = [], now = Date.now() } = {}) {
    const record = normalizeMemory(memory);
    const caps = profile?.capabilities || {};
    let changed = false;

    if (caps.route) {
      for (const token of Array.isArray(routeTokens) ? routeTokens : []) {
        const tokenZ = Number(token.zLayer ?? token.gridPosition?.z ?? token.z?.[0] ?? 0) || 0;
        const layer = layerMemory(record, tokenZ);
        const key = cellKeyForPoint(token, mapData);
        if (!layer.routeCells[key]) { layer.routeCells[key] = now; changed = true; }
      }
    }

    if (caps.geometry) {
      const layer = layerMemory(record, zLayer);
      for (const key of visibleCells || []) {
        if (!layer.rememberedCells[key]) { layer.rememberedCells[key] = now; changed = true; }
      }
      record.dungeon.objects ||= {};
      for (const raw of Array.isArray(topology) ? topology : []) {
        if (!elementVisible(raw, visibleCells, mapData, zLayer)) continue;
        const id = clean(raw.id);
        if (!id) continue;
        const before = JSON.stringify(record.dungeon.objects[id] || null);
        const snapshot = snapshotObject(raw, record.dungeon.objects[id], profile, mapData, now);
        if (JSON.stringify(snapshot) !== before) { record.dungeon.objects[id] = snapshot; changed = true; }
      }
    }

    if (changed) {
      record.profileSnapshot = { intelligence: profile?.intelligence ?? null, rank: profile?.rank ?? 0, tags: [...(profile?.tags || [])], capabilities: { ...(profile?.capabilities || {}) } };
      record.updatedAtClient = now;
    }
    return { memory: record, changed };
  }

  function learnFact(memory, fact = {}, profile = {}, now = Date.now(), options = {}) {
    const record = normalizeMemory(memory);
    const force = options.force === true || fact.force === true;
    const caps = profile?.capabilities || {};
    const kind = normalizeId(fact.kind);
    let changed = false;

    if (kind === 'lock_state' && (force || caps.objectState)) {
      const id = clean(fact.elementId || fact.objectId);
      if (id) {
        record.dungeon.objects[id] ||= { id, type: clean(fact.type || 'door') || 'door' };
        const knowledge = fact.locked === false ? 'unlocked' : 'locked';
        changed = setIfChanged(record.dungeon.objects[id], 'lockKnowledge', knowledge) || changed;
        record.dungeon.objects[id].lastLearnedAt = now;
      }
    } else if (kind === 'key_opens' && (force || caps.relationships)) {
      const keyId = clean(fact.keyId), elementId = clean(fact.elementId || fact.doorId);
      if (keyId && elementId) {
        record.dungeon.relations ||= { keys: {} };
        record.dungeon.relations.keys ||= {};
        record.dungeon.relations.keys[keyId] ||= { opens: [], learnedAt: now };
        const opens = record.dungeon.relations.keys[keyId].opens;
        if (!opens.includes(elementId)) { opens.push(elementId); changed = true; }
        record.dungeon.relations.keys[keyId].learnedAt = now;
      }
    } else if (kind === 'world_place' && (force || caps.worldPoi)) {
      const placeId = clean(fact.placeId || fact.id);
      if (placeId) {
        const prior = record.world.places[placeId] || {};
        const next = {
          ...prior,
          known: true,
          label: clean(fact.label || prior.label),
          location: clone(fact.location || prior.location || null),
          locationPrecision: clean(fact.locationPrecision || prior.locationPrecision || 'approximate'),
          services: { ...(prior.services || {}), ...(fact.services || {}) },
          lastConfirmedAt: now,
        };
        if (JSON.stringify(prior) !== JSON.stringify(next)) { record.world.places[placeId] = next; changed = true; }
      }
    } else if (kind === 'territory' && (force || caps.territory)) {
      const zoneId = clean(fact.zoneId || fact.placeId || fact.id);
      if (zoneId) {
        const prior = record.world.territories[zoneId] || {};
        const next = {
          ...prior,
          controllerId: clean(fact.controllerId || fact.controller || prior.controllerId),
          confidence: clean(fact.confidence || prior.confidence || 'known'),
          lastConfirmedAt: now,
        };
        if (JSON.stringify(prior) !== JSON.stringify(next)) { record.world.territories[zoneId] = next; changed = true; }
      }
    }

    if (changed) record.updatedAtClient = now;
    return { memory: record, changed };
  }

  function revealLayer(memory, mapData = {}, zLayer = 0, now = Date.now()) {
    const record = normalizeMemory(memory);
    const layer = layerMemory(record, zLayer);
    const cols = Math.max(1, Math.trunc(num(mapData.grid?.cols, 1)));
    const rows = Math.max(1, Math.trunc(num(mapData.grid?.rows, 1)));
    for (let row = 0; row < rows; row += 1) for (let col = 0; col < cols; col += 1) layer.rememberedCells[cellKey(col, row)] = now;
    record.updatedAtClient = now;
    return record;
  }

  return Object.freeze({
    SCHEMA_VERSION,
    DEFAULT_INT_THRESHOLDS,
    DEFAULT_RANK_CAPABILITIES,
    hostWindow,
    intelligenceScore,
    thresholds,
    rankForIntelligence,
    mapTags,
    memorySpec,
    domainMatches,
    capabilitiesForRank,
    resolveProfile,
    emptyMemory,
    normalizeMemory,
    layerMemory,
    cellCoords,
    cellKey,
    cellKeyForPoint,
    parseCellKey,
    elementVisible,
    visibleState,
    snapshotObject,
    observeDungeon,
    learnFact,
    revealLayer,
  });
});
