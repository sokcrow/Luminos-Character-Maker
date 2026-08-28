import './memory-engine.js';

const base = window.LuminousVttMemoryEngine;
if (base && !base.__memoryDefaultsPatched) {
  function legacyWalls(mapData = {}) {
    const size = Math.max(1, Number(mapData.grid?.size) || 70);
    return (Array.isArray(mapData.walls) ? mapData.walls : []).map((wall, index) => ({
      id: wall.id || `legacy_wall_${index}`,
      type: 'wall',
      from: { col: Math.round((Number(wall.x1) || 0) / size), row: Math.round((Number(wall.y1) || 0) / size) },
      to: { col: Math.round((Number(wall.x2) || 0) / size), row: Math.round((Number(wall.y2) || 0) / size) },
      z: Array.isArray(wall.z) ? wall.z.map(Number) : [Number(wall.z) || 0],
      thicknessFt: Number(wall.thicknessFt) || 0.5,
      memoryLegacyWall: true,
    }));
  }

  function observeDungeon(options = {}) {
    const mapData = options.mapData || {};
    const topology = [
      ...(Array.isArray(options.topology) ? options.topology : []),
      ...legacyWalls(mapData),
    ];
    return base.observeDungeon({ ...options, topology });
  }

  function revealLayer(memory, mapData = {}, zLayer = 0, now = Date.now()) {
    const record = base.revealLayer(memory, mapData, zLayer, now);
    const prior = record.profileSnapshot || {};
    const rank = Math.max(2, Number(prior.rank) || 0);
    record.profileSnapshot = {
      ...prior,
      intelligence: prior.intelligence ?? null,
      rank,
      tags: Array.isArray(prior.tags) ? prior.tags : base.mapTags(mapData),
      capabilities: { ...base.capabilitiesForRank(rank, mapData), ...(prior.capabilities || {}) },
      dmGrantedLayerMemory: true,
    };
    return record;
  }

  window.LuminousVttMemoryEngine = Object.freeze({
    ...base,
    __memoryDefaultsPatched: true,
    legacyWalls,
    observeDungeon,
    revealLayer,
  });
}
