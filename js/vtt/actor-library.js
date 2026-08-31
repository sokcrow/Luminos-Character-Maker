(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.LuminousVttActorLibrary = api;
})(typeof window !== 'undefined' ? window : globalThis, function (browserRoot) {
  'use strict';
  const clean = (value) => String(value ?? '').trim();
  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
  const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const safeKey = (value, fallback = 'actor') => clean(value).replace(/[.#$\[\]\/]/g, '_') || fallback;

  function displayName(data = {}, fallback = 'Actor') {
    return clean(data.characterName || data.character_name || data.nombre || data.name || data.displayName || data.label || fallback) || fallback;
  }

  function categoryFor(scope, data = {}) {
    if (scope === 'players') return 'player';
    const raw = clean(data.actorCategory || data.category || data.tipo || data.type || data.role || data.kind).toLowerCase();
    if (['enemy', 'enemigo', 'hostile', 'boss', 'monster', 'monstruo'].some((term) => raw.includes(term))) return raw.includes('boss') ? 'boss' : 'enemy';
    if (data.hostile === true || data.enemy === true || data.isEnemy === true) return 'enemy';
    if (['ally', 'aliado', 'friendly'].some((term) => raw.includes(term))) return 'ally';
    if (['object', 'objeto', 'vehicle', 'vehiculo', 'vehículo'].some((term) => raw.includes(term))) return raw.includes('vehicle') || raw.includes('veh') ? 'vehicle' : 'object';
    return 'npc';
  }

  function imageFor(data = {}) {
    return clean(
      data.icono || data.icono_jugador || data.iconUrl || data.icon_url
      || data.tokenImage || data.token_image || data.tokenUrl || data.token_url
      || data.portrait || data.portraitUrl || data.imagen || data.image,
    ) || '';
  }

  function actorIdentity(scope, id, data = {}) {
    if (scope === 'players') return clean(data.actorId || data.vinculo_jugador || data.actor?.id || data.actorRef?.id) || null;
    return clean(data.actorId || data.id || id) || null;
  }

  function normalizeActor(scope, id, data = {}) {
    const linkedActorId = actorIdentity(scope, id, data);
    const actorId = linkedActorId || clean(data.id || data.uid || id) || safeKey(id);
    const category = categoryFor(scope, data);
    const name = displayName(data, actorId);
    const tokenImage = imageFor(data);
    return {
      key: `${scope}:${safeKey(id || actorId)}`,
      scope,
      sourceId: clean(id || actorId),
      actorId,
      linkedActorId,
      playerId: scope === 'players' ? clean(data.playerId || data.id || id) : null,
      ownerUid: scope === 'players' ? clean(data.uid) || null : null,
      name,
      category,
      portrait: tokenImage,
      tokenImage,
      icono: tokenImage,
      color: data.color || data.tokenColor || (category === 'enemy' || category === 'boss' ? '#ff5c5c' : category === 'player' ? '#00ffcc' : '#f2f2f2'),
      backgroundColor: data.backgroundColor || '#20242a',
      iconColor: data.iconColor || '#ffffff',
      size: clean(data.size || data.tamaño || data.tamano) || null,
      radius: Number(data.radius) || null,
      speedFt: finite(data.speedFt ?? data.speed?.walk ?? data.speed?.walking ?? data.velocidad, 30),
      movement: clone(data.movement || data.movimiento || null),
      senses: clone(data.senses || data.sentidos || null),
      raw: clone(data),
    };
  }

  function mergeCollections({ players = {}, actors = {}, npcs = {} } = {}) {
    const result = [];
    const assignedActorIds = new Set();
    const playerEntries = Object.entries(players || {}).map(([id, data]) => normalizeActor('players', id, data || {}));
    playerEntries.forEach((actor) => {
      result.push(actor);
      if (actor.linkedActorId) assignedActorIds.add(clean(actor.linkedActorId));
    });

    const seenPersistent = new Set();
    const addPersistent = (scope, id, data) => {
      const actor = normalizeActor(scope, id, data || {});
      const identity = clean(actor.actorId || actor.sourceId);
      // A Theatre actor assigned to a player is represented by the player token only.
      if (identity && assignedActorIds.has(identity)) return;
      // Same persistent actor can exist in legacy + principal databases during migration.
      if (identity && seenPersistent.has(identity)) return;
      if (identity) seenPersistent.add(identity);
      result.push(actor);
    };
    Object.entries(actors || {}).forEach(([id, data]) => addPersistent('actors', id, data));
    Object.entries(npcs || {}).forEach(([id, data]) => addPersistent('npcs', id, data));
    return result.sort((a, b) => a.name.localeCompare(b.name));
  }

  function snap(point, mapData = {}) {
    const interaction = browserRoot?.LuminousVttTokenInteraction;
    if (interaction?.snapPointToGrid) return interaction.snapPointToGrid(point, mapData.grid || {});
    const size = Math.max(1, finite(mapData.grid?.size, 70));
    const col = Math.max(0, Math.min(Math.max(1, finite(mapData.grid?.cols, 1)) - 1, Math.floor(finite(point?.x) / size)));
    const row = Math.max(0, Math.min(Math.max(1, finite(mapData.grid?.rows, 1)) - 1, Math.floor(finite(point?.y) / size)));
    return { x: (col + .5) * size, y: (row + .5) * size, col, row };
  }

  function sizeRadius(actor = {}, mapData = {}) {
    const cell = Math.max(1, finite(mapData.grid?.size, 70));
    if (Number(actor.radius) > 0) return Number(actor.radius);
    const size = clean(actor.size).toLowerCase();
    if (size === 'large' || size === 'grande') return cell * 0.82;
    if (size === 'huge' || size === 'enorme') return cell * 1.28;
    if (size === 'gargantuan' || size === 'gargantuesco') return cell * 1.75;
    if (size === 'tiny' || size === 'diminuto') return cell * 0.25;
    return cell * 0.4;
  }

  function tokenId(actor) { return `${actor.category || 'npc'}:${safeKey(actor.actorId || actor.sourceId)}:${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`; }

  function tokenFromActor(actor, point, mapData = {}, zLayer = 0) {
    if (!actor) throw new Error('ACTOR_REQUIRED');
    const position = snap(point, mapData);
    const z = finite(zLayer, 0);
    const player = actor.category === 'player';
    return {
      id: player ? `player:${safeKey(actor.playerId || actor.sourceId || actor.actorId)}` : tokenId(actor),
      name: actor.name,
      actorId: actor.actorId,
      actorRef: { scope: actor.scope, id: actor.sourceId },
      actorCategory: actor.category,
      playerId: player ? actor.playerId : null,
      ownerUid: player ? actor.ownerUid : null,
      canonicalScope: player ? 'player' : 'world',
      canonicalPlayerKey: player ? (actor.playerId || actor.sourceId) : undefined,
      canonicalOwnerUid: player ? actor.ownerUid : undefined,
      characterLink: player ? { mode: 'player', uid: actor.ownerUid || null, playerId: actor.playerId || actor.sourceId, actorId: actor.actorId } : { mode: 'actor', actorId: actor.actorId },
      dynamicActorToken: !player,
      x: position.x,
      y: position.y,
      zLayer: z,
      z: [z],
      elevationFt: finite(mapData.zLevels?.[String(z)]?.elevationFt, z * finite(mapData.defaultZStepFt, 15)),
      gridPosition: { col: position.col, row: position.row, z },
      radius: sizeRadius(actor, mapData),
      color: actor.color,
      backgroundColor: actor.backgroundColor,
      iconColor: actor.iconColor,
      icon: 'person',
      icono: actor.icono || actor.tokenImage || null,
      tokenImage: actor.tokenImage || null,
      portrait: actor.portrait || null,
      size: actor.size || null,
      speedFt: actor.speedFt || 30,
      movement: clone(actor.movement),
      senses: clone(actor.senses),
      draggable: true,
    };
  }

  return Object.freeze({ clean, safeKey, displayName, categoryFor, imageFor, actorIdentity, normalizeActor, mergeCollections, snap, sizeRadius, tokenId, tokenFromActor });
});
