(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.LuminousActorLibrary = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
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
    const raw = clean(data.actorCategory || data.category || data.tipo || data.type || data.role || data.kind || data.faction || data.faccion).toLowerCase();
    if (['enemy', 'enemigo', 'hostile', 'boss', 'monster', 'monstruo'].some((term) => raw.includes(term))) return raw.includes('boss') ? 'boss' : 'enemy';
    if (data.hostile === true || data.enemy === true || data.isEnemy === true) return 'enemy';
    if (['ally', 'aliado', 'friendly'].some((term) => raw.includes(term))) return 'ally';
    if (['object', 'objeto', 'vehicle', 'vehiculo', 'vehículo'].some((term) => raw.includes(term))) return raw.includes('vehicle') || raw.includes('veh') ? 'vehicle' : 'object';
    return 'npc';
  }

  function imageFor(data = {}) { return clean(data?.icono || ''); }
  function unitImageFor(data = {}) { return clean(data?.icono || data?.visual?.spriteUrl || data?.sprite || data?.image || ''); }

  function actorIdentity(scope, id, data = {}) {
    if (scope === 'players') return clean(data.actorId || data.vinculo_jugador || data.actor?.id || data.actorRef?.id) || null;
    return clean(data.actorId || data.id || id) || null;
  }

  function assignedActorRecord(player = {}, actors = {}) {
    const actorId = actorIdentity('players', player?.playerId || player?.id || '', player);
    if (!actorId) return null;
    if (actors && typeof actors === 'object' && actors[actorId]) return actors[actorId];
    for (const [id, data] of Object.entries(actors || {})) {
      if (clean(actorIdentity('actors', id, data || {})) === actorId) return data || null;
    }
    return null;
  }

  function skillSlotIdsFor(scope, data = {}) {
    if (scope !== 'units') return [];
    const raw = data.action_slots ?? data.skillSlotIds ?? data.skillIds ?? data.skill_ids ?? data.mechanics?.skills ?? [];
    if (Array.isArray(raw)) return raw.map(clean).filter(Boolean);
    if (raw && typeof raw === 'object') {
      return Object.entries(raw)
        .map(([key, value]) => ({ index: Number(key), value: clean(value) }))
        .filter((row) => Number.isInteger(row.index) && row.index >= 0 && row.value)
        .sort((a, b) => a.index - b.index)
        .map((row) => row.value);
    }
    return [];
  }

  function skillIdsFor(scope, data = {}) { return [...new Set(skillSlotIdsFor(scope, data))]; }

  function normalizeActor(scope, id, data = {}) {
    const linkedActorId = actorIdentity(scope, id, data);
    const actorId = linkedActorId || clean(data.id || data.uid || id) || safeKey(id);
    const category = categoryFor(scope, data);
    const name = displayName(data, actorId);
    const tokenImage = scope === 'units' ? unitImageFor(data) : imageFor(data);
    const skillSlotIds = skillSlotIdsFor(scope, data);
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
      skillSlotIds,
      skillIds: [...new Set(skillSlotIds)],
      raw: clone(data),
    };
  }

  function normalizePlayerActor(id, player = {}, actors = {}) {
    const linkedActorId = actorIdentity('players', id, player || {});
    const assignedActor = assignedActorRecord({ ...player, id }, actors);
    const actorImage = assignedActor ? imageFor(assignedActor) : '';
    const source = {
      ...(assignedActor || {}),
      ...(player || {}),
      actorId: linkedActorId || undefined,
      playerId: clean(player?.playerId || player?.id || id),
      uid: player?.uid,
      icono: actorImage,
    };
    delete source.icono_jugador;
    delete source.iconUrl;
    delete source.icon_url;
    return normalizeActor('players', id, source);
  }

  function mergeCollections({ players = {}, actors = {}, npcs = {}, units = {} } = {}) {
    const result = [];
    const assignedActorIds = new Set();
    Object.entries(players || {}).map(([id, data]) => normalizePlayerActor(id, data || {}, actors || {})).forEach((actor) => {
      result.push(actor);
      if (actor.linkedActorId) assignedActorIds.add(clean(actor.linkedActorId));
    });
    const seenPersistent = new Set();
    const addPersistent = (scope, id, data) => {
      const actor = normalizeActor(scope, id, data || {});
      const identity = clean(actor.actorId || actor.sourceId);
      if (identity && assignedActorIds.has(identity)) return;
      if (identity && seenPersistent.has(identity)) return;
      if (identity) seenPersistent.add(identity);
      result.push(actor);
    };
    Object.entries(actors || {}).forEach(([id, data]) => addPersistent('actors', id, data));
    Object.entries(npcs || {}).forEach(([id, data]) => addPersistent('npcs', id, data));
    Object.entries(units || {}).forEach(([id, data]) => addPersistent('units', id, data));
    return result.sort((a, b) => a.name.localeCompare(b.name));
  }

  return Object.freeze({ clean, safeKey, displayName, categoryFor, imageFor, unitImageFor, skillSlotIdsFor, skillIdsFor, actorIdentity, assignedActorRecord, normalizeActor, normalizePlayerActor, mergeCollections });
});