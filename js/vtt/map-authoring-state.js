(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.LuminousVttMapAuthoringState = api;
})(typeof window !== 'undefined' ? window : globalThis, function (browserRoot) {
  'use strict';

  const DM_UID = 'e9JwFZrtk6g8UMqq2Hf9EHVY7Ay1';
  const MAPS_ROOT = 'campaña/estado_mundo/vttMaps';
  const ACTIVE_ROOT = 'campaña/estado_mundo/vttMapActive';
  const INSTANCE_ROOT = 'campaña/estado_mundo/instancia_activa';
  const CREATE_ATTEMPT_LIMIT = 1000;
  const clean = (value) => String(value ?? '').trim();
  const creationIntents = new WeakSet();
  const wrappedAuthoringApis = new WeakMap();

  function hostWindow(root = browserRoot) {
    if (!root) return null;
    try { if (root.parent && root.parent !== root && root.parent.document) return root.parent; } catch (_) {}
    return root;
  }

  function hostFirebase(root = browserRoot) {
    const host = hostWindow(root);
    return host?.firebase || root?.firebase || null;
  }

  function withCreationIntent(api, root = browserRoot) {
    if (!api?.createDefinition || api.isCreateDefinitionIntent) return api;
    let wrapped = wrappedAuthoringApis.get(api);
    if (!wrapped) {
      const baseCreateDefinition = api.createDefinition.bind(api);
      wrapped = Object.freeze({
        ...api,
        createDefinition(...args) {
          const definition = baseCreateDefinition(...args);
          if (definition && typeof definition === 'object') creationIntents.add(definition);
          return definition;
        },
        isCreateDefinitionIntent(definition) {
          return Boolean(definition && typeof definition === 'object' && creationIntents.has(definition));
        },
      });
      wrappedAuthoringApis.set(api, wrapped);
    }
    try {
      if (root?.LuminousVttMapAuthoring === api) root.LuminousVttMapAuthoring = wrapped;
    } catch (_) {}
    return wrapped;
  }

  function authoringRuntime(root = browserRoot) {
    let api = root?.LuminousVttMapAuthoring || null;
    if (!api && typeof require !== 'undefined') {
      try { api = require('./map-authoring.js'); } catch (_) {}
    }
    return withCreationIntent(api, root);
  }

  function currentUid(root = browserRoot) {
    try { return clean(hostFirebase(root)?.auth?.().currentUser?.uid); } catch (_) { return ''; }
  }

  function isDm(root = browserRoot) {
    const host = hostWindow(root);
    return currentUid(root) === DM_UID || Boolean(host?.document?.body?.classList?.contains('on-game-dashboard'));
  }

  async function resolveActiveDefinition({ fallback = null, root = browserRoot } = {}) {
    const firebase = hostFirebase(root);
    const db = firebase?.database?.() || null;
    const authoring = authoringRuntime(root);
    if (!db || !authoring) return null;
    try {
      const activeSnapshot = await db.ref(ACTIVE_ROOT).once('value');
      const active = activeSnapshot.val() || {};
      const mapId = clean(typeof active === 'string' ? active : active.mapId);
      if (!mapId) return null;
      const mapSnapshot = await db.ref(`${MAPS_ROOT}/${authoring.firebaseKey(mapId, 'default')}`).once('value');
      const value = mapSnapshot.val();
      return value ? authoring.normalizeDefinition(value, fallback || {}) : null;
    } catch (error) {
      console.warn('VTT active map lookup failed:', error);
      return null;
    }
  }

  function watchActiveMap({ onChanged, root = browserRoot } = {}) {
    const db = hostFirebase(root)?.database?.() || null;
    if (!db?.ref) return () => {};
    const ref = db.ref(ACTIVE_ROOT);
    const handler = (snapshot) => {
      const value = snapshot.val() || {};
      const mapId = clean(typeof value === 'string' ? value : value.mapId);
      if (typeof onChanged === 'function') onChanged(mapId, value);
    };
    ref.on('value', handler);
    return () => ref.off('value', handler);
  }

  function createBridge({ mapData, onMapsChanged, onActiveChanged, root = browserRoot } = {}) {
    const authoring = authoringRuntime(root);
    if (!authoring) throw new Error('MAP_AUTHORING_RUNTIME_REQUIRED');
    const firebase = hostFirebase(root);
    const db = firebase?.database?.() || null;
    const dm = isDm(root);
    const subscriptions = [];
    let maps = {};
    let active = {};
    let started = false;

    const mapsRef = () => db?.ref(MAPS_ROOT);
    const activeRef = () => db?.ref(ACTIVE_ROOT);
    const instanceRef = () => db?.ref(INSTANCE_ROOT);

    function subscribe(ref, handler) {
      if (!ref?.on) return;
      ref.on('value', handler);
      subscriptions.push(() => ref.off('value', handler));
    }

    function list() {
      return Object.values(maps).map((entry) => authoring.normalizeDefinition(entry)).sort((a, b) => a.name.localeCompare(b.name));
    }

    function get(mapId) {
      const key = authoring.firebaseKey(mapId, 'default');
      return maps[key] ? authoring.normalizeDefinition(maps[key]) : null;
    }

    function activeMapId() {
      return clean(typeof active === 'string' ? active : active.mapId);
    }

    function notifyMapsChanged() {
      if (typeof onMapsChanged === 'function') onMapsChanged(list());
    }

    function definitionPayload(definition, { creating = false } = {}) {
      if (!firebase?.database?.ServerValue?.TIMESTAMP) return { ...definition };
      const timestamp = firebase.database.ServerValue.TIMESTAMP;
      const payload = { ...definition, updatedByUid: currentUid(root) || DM_UID, updatedAt: timestamp };
      if (creating || !payload.createdAt) payload.createdAt = timestamp;
      return payload;
    }

    function candidateId(baseId, attempt) {
      return authoring.firebaseKey(attempt <= 1 ? baseId : `${baseId}_${attempt}`, 'map');
    }

    async function reserveRemoteDefinition(definition) {
      const ref = mapsRef()?.child?.(definition.id);
      if (!ref) return true;
      const payload = definitionPayload(definition, { creating: true });
      if (typeof ref.transaction === 'function') {
        const result = await ref.transaction((current) => current == null ? payload : undefined, undefined, false);
        return Boolean(result?.committed);
      }
      if (typeof ref.once === 'function') {
        const snapshot = await ref.once('value');
        if (snapshot?.val?.() != null) return false;
      }
      if (typeof ref.set !== 'function') throw new Error('MAP_CREATE_STORAGE_UNAVAILABLE');
      await ref.set(payload);
      return true;
    }

    async function createDefinition(rawDefinition) {
      if (!dm) throw new Error('DM_REQUIRED');
      const initial = authoring.normalizeDefinition(rawDefinition, mapData || {});
      const baseId = authoring.firebaseKey(initial.id, 'map');

      for (let attempt = 1; attempt <= CREATE_ATTEMPT_LIMIT; attempt++) {
        const id = candidateId(baseId, attempt);
        if (maps[id] !== undefined) continue;
        const definition = authoring.normalizeDefinition({ ...initial, id }, mapData || {});
        const reserved = db ? await reserveRemoteDefinition(definition) : true;
        if (!reserved) continue;
        maps[id] = definition;
        notifyMapsChanged();
        return definition;
      }

      throw new Error('MAP_ID_ALLOCATION_EXHAUSTED');
    }

    async function saveDefinition(rawDefinition) {
      if (!dm) throw new Error('DM_REQUIRED');
      if (authoring.isCreateDefinitionIntent?.(rawDefinition)) return createDefinition(rawDefinition);
      const definition = authoring.normalizeDefinition(rawDefinition, mapData || {});
      const previous = maps[definition.id];
      maps[definition.id] = definition;
      try {
        if (db) await mapsRef().child(definition.id).set(definitionPayload(definition));
      } catch (error) {
        if (previous === undefined) delete maps[definition.id];
        else maps[definition.id] = previous;
        notifyMapsChanged();
        throw error;
      }
      notifyMapsChanged();
      return definition;
    }

    async function deleteDefinition(mapId) {
      if (!dm) throw new Error('DM_REQUIRED');
      const key = authoring.firebaseKey(mapId, 'default');
      const previous = maps[key];
      if (previous === undefined) throw new Error('MAP_NOT_FOUND');
      if (activeMapId() === key) throw new Error('ACTIVE_MAP_CANNOT_BE_DELETED');

      delete maps[key];
      try {
        if (db) {
          const ref = mapsRef()?.child?.(key);
          if (!ref?.remove) throw new Error('MAP_DELETE_STORAGE_UNAVAILABLE');
          await ref.remove();
        }
      } catch (error) {
        maps[key] = previous;
        notifyMapsChanged();
        throw error;
      }

      notifyMapsChanged();
      return true;
    }

    async function activate(mapId) {
      if (!dm) throw new Error('DM_REQUIRED');
      const definition = get(mapId);
      if (!definition) throw new Error('MAP_NOT_FOUND');
      active = { mapId: definition.id };
      if (db) {
        const updates = {};
        updates[ACTIVE_ROOT] = {
          mapId: definition.id,
          activatedByUid: currentUid(root) || DM_UID,
          activatedAt: firebase.database.ServerValue.TIMESTAMP,
        };
        updates[INSTANCE_ROOT] = 'mapa';
        await db.ref().update(updates);
      }
      if (typeof onActiveChanged === 'function') onActiveChanged(definition.id, active);
      return definition;
    }

    async function uploadFloorImage(mapId, zLayer, file) {
      if (!dm) throw new Error('DM_REQUIRED');
      if (!file) throw new Error('FILE_REQUIRED');
      const storage = firebase?.storage?.();
      if (!storage?.ref) throw new Error('FIREBASE_STORAGE_UNAVAILABLE');
      const safeMap = authoring.firebaseKey(mapId, 'default');
      const safeName = clean(file.name || 'floor-image').replace(/[^a-zA-Z0-9._-]+/g, '_');
      const path = `vtt/maps/${safeMap}/floors/z_${Number(zLayer) || 0}/${Date.now()}_${safeName}`;
      const snapshot = await storage.ref(path).put(file);
      const url = await snapshot.ref.getDownloadURL();
      return { url, storagePath: path, fit: 'stretch', opacity: 1 };
    }

    function start() {
      if (started) return true;
      started = true;
      if (!db) return false;
      subscribe(mapsRef(), (snapshot) => {
        maps = snapshot.val() || {};
        notifyMapsChanged();
      });
      subscribe(activeRef(), (snapshot) => {
        active = snapshot.val() || {};
        if (typeof onActiveChanged === 'function') onActiveChanged(activeMapId(), active);
      });
      return true;
    }

    function stop() {
      subscriptions.splice(0).forEach((unsubscribe) => unsubscribe());
      started = false;
    }

    return Object.freeze({
      isDm: dm, start, stop, list, get, activeMapId, createDefinition, saveDefinition, deleteDefinition, activate, uploadFloorImage,
    });
  }

  return Object.freeze({
    DM_UID, MAPS_ROOT, ACTIVE_ROOT, INSTANCE_ROOT, CREATE_ATTEMPT_LIMIT,
    hostWindow, hostFirebase, currentUid, isDm, resolveActiveDefinition, watchActiveMap, createBridge,
  });
});