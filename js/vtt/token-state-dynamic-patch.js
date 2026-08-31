(function (root) {
  'use strict';
  const base = root?.LuminousVttTokenState;
  if (!base || base.__dynamicWorldTokenPatch) return;

  const clean = (value) => String(value ?? '').trim();
  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));

  function tokenSnapshot(token = {}) {
    const tokenImage = clean(token.icono || token.icono_jugador || token.iconUrl || token.icon_url || token.tokenImage || token.image || token.portrait) || null;
    const snapshot = {
      id: clean(token.id),
      name: clean(token.name || token.label || token.id),
      actorId: clean(token.actorId) || null,
      actorRef: clone(token.actorRef || null),
      actorCategory: clean(token.actorCategory || token.category || 'npc') || 'npc',
      icono: tokenImage,
      tokenImage,
      portrait: clean(token.portrait) || null,
      color: token.color || '#ffffff',
      backgroundColor: token.backgroundColor || '#20242a',
      iconColor: token.iconColor || '#ffffff',
      icon: token.icon || 'person',
      radius: Number(token.radius) || null,
      size: token.size || null,
      draggable: token.draggable !== false,
      speedFt: Number(token.speedFt ?? token.speed?.walk ?? token.speed?.walking) || null,
      movement: clone(token.movement || null),
      senses: clone(token.senses || null),
      dynamicActorToken: true,
    };
    Object.keys(snapshot).forEach((key) => snapshot[key] == null && delete snapshot[key]);
    return snapshot;
  }

  function worldRecord(token, bridge, firebase) {
    return {
      schemaVersion: 2,
      tokenId: clean(token.id),
      token: tokenSnapshot(token),
      position: base.positionFromToken(token),
      updatedByUid: bridge.identity?.uid || base.DM_UID,
      updatedAt: firebase?.database?.ServerValue?.TIMESTAMP || Date.now(),
    };
  }

  const createBridgeBase = base.createBridge;
  function createBridge(options = {}) {
    const bridge = createBridgeBase(options);
    const mapData = options.mapData;
    const isDm = Boolean(options.isDm);
    const firebase = base.hostFirebase(root);
    const db = firebase?.database?.() || null;
    const worldPath = `${base.WORLD_ROOT}/${bridge.mapId}`;
    let extraStarted = false;
    let handler = null;

    function playerActorIds() {
      const ids = new Set();
      for (const token of mapData.tokens || []) {
        const isPlayer = token?.canonicalScope === 'player' || Boolean(token?.canonicalPlayerKey) || ['current_player', 'player'].includes(token?.characterLink?.mode);
        if (!isPlayer) continue;
        const id = clean(token.actorId || token.characterLink?.actorId || token.actorRef?.id);
        if (id) ids.add(id);
      }
      return ids;
    }

    function applyDynamicRecords(raw = {}) {
      const records = raw || {};
      const keep = new Set();
      const assignedActors = playerActorIds();
      Object.entries(records).forEach(([key, record]) => {
        if (!record?.position || !record?.token) return;
        const recordActorId = clean(record.token.actorId || record.token.actorRef?.id);
        if (recordActorId && assignedActors.has(recordActorId)) return;
        const tokenId = clean(record.tokenId || record.token.id || key);
        if (!tokenId) return;
        keep.add(tokenId);
        let token = (mapData.tokens || []).find((entry) => clean(entry.id) === tokenId);
        if (!token) {
          token = { ...clone(record.token), id: tokenId };
          mapData.tokens ||= [];
          mapData.tokens.push(token);
        } else if (token.dynamicActorToken || token.actorRef) {
          Object.assign(token, clone(record.token), { id: tokenId });
        }
        token.canonicalScope = 'world';
        token.canonicalTokenKey = base.firebaseKey(tokenId);
        token.dynamicActorToken = true;
        base.applyPosition(token, record.position);
      });
      mapData.tokens = (mapData.tokens || []).filter((token) => {
        if (!token?.dynamicActorToken || token.canonicalScope !== 'world') return true;
        const actorId = clean(token.actorId || token.actorRef?.id);
        if (actorId && assignedActors.has(actorId)) return false;
        return keep.has(clean(token.id));
      });
      options.onTokensChanged?.({ scope: 'world-dynamic', tokens: mapData.tokens });
    }

    function start() {
      const result = bridge.start();
      if (extraStarted || !db) return result;
      extraStarted = true;
      handler = (snapshot) => applyDynamicRecords(snapshot.val() || {});
      db.ref(worldPath).on('value', handler);
      return result;
    }

    function stop() {
      if (db && handler) db.ref(worldPath).off('value', handler);
      handler = null;
      extraStarted = false;
      bridge.stop();
    }

    async function saveToken(token) {
      const playerScope = token?.canonicalScope === 'player' || base.isCurrentPlayerTemplate(token) || Boolean(token?.canonicalPlayerKey);
      if (playerScope || !token?.dynamicActorToken) return bridge.saveToken(token);
      const actorId = clean(token.actorId || token.actorRef?.id);
      if (actorId && playerActorIds().has(actorId)) throw new Error('PLAYER_ACTOR_WORLD_DUPLICATE');
      if (!isDm) throw new Error('DM_REQUIRED');
      const key = base.firebaseKey(token.id);
      const record = worldRecord(token, bridge, firebase);
      if (db) await db.ref(worldPath).child(key).set(record);
      return { valid: true, scope: 'world', key, record, offline: !db };
    }

    async function createWorldToken(token) {
      if (!isDm) throw new Error('DM_REQUIRED');
      if (!clean(token?.id)) throw new Error('TOKEN_ID_REQUIRED');
      const actorId = clean(token.actorId || token.actorRef?.id);
      if (actorId && playerActorIds().has(actorId)) return { valid: false, reason: 'PLAYER_ACTOR_ALREADY_PRESENT' };
      token.dynamicActorToken = true;
      token.canonicalScope = 'world';
      token.canonicalTokenKey = base.firebaseKey(token.id);
      const existing = (mapData.tokens || []).find((entry) => clean(entry.id) === clean(token.id));
      if (!existing) {
        mapData.tokens ||= [];
        mapData.tokens.push(token);
      }
      return saveToken(token);
    }

    async function deleteWorldToken(tokenId) {
      if (!isDm) throw new Error('DM_REQUIRED');
      const id = clean(tokenId);
      if (!id) throw new Error('TOKEN_ID_REQUIRED');
      mapData.tokens = (mapData.tokens || []).filter((token) => clean(token.id) !== id);
      if (db) await db.ref(worldPath).child(base.firebaseKey(id)).remove();
      options.onTokensChanged?.({ scope: 'world-dynamic', tokens: mapData.tokens });
      return true;
    }

    return Object.freeze({ ...bridge, start, stop, saveToken, createWorldToken, deleteWorldToken, applyDynamicRecords, tokenSnapshot, playerActorIds });
  }

  root.LuminousVttTokenState = Object.freeze({ ...base, __dynamicWorldTokenPatch: true, tokenSnapshot, createBridge });
})(typeof window !== 'undefined' ? window : globalThis);
