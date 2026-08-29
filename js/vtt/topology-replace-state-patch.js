(function (root) {
  'use strict';

  const base = root?.LuminousVttStateBridge;
  if (!base || base.__atomicReplacePatch) return;

  const originalCreateBridge = base.createBridge.bind(base);
  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));

  function hostFirebase(runtimeRoot = root) {
    const host = base.hostWindow?.(runtimeRoot) || runtimeRoot;
    return host?.firebase || runtimeRoot?.firebase || null;
  }

  function createBridge(options = {}) {
    const bridge = originalCreateBridge(options);
    if (bridge?.replaceElement) return bridge;

    const mapData = options.mapData;
    const topology = root?.LuminousVttTopology;
    const firebase = hostFirebase(options.root || root);
    const db = firebase?.database?.() || null;

    async function replaceElement(oldElementId, nextElement) {
      if (!bridge?.isDm) throw new Error('DM_REQUIRED');
      if (!mapData || !topology) throw new Error('TOPOLOGY_REPLACE_DEPENDENCY_REQUIRED');

      const oldId = String(oldElementId || '').trim();
      const normalized = topology.normalizeElement(nextElement);
      const nextId = String(normalized.id || '').trim();
      if (!oldId) throw new Error('OLD_ELEMENT_ID_REQUIRED');
      if (!nextId) throw new Error('ELEMENT_ID_REQUIRED');
      if (!(mapData.topology || []).some((entry) => String(entry?.id || '') === oldId)) {
        throw new Error('ELEMENT_NOT_FOUND');
      }

      if (!db) {
        const next = (Array.isArray(mapData.topology) ? mapData.topology : [])
          .filter((entry) => {
            const id = String(entry?.id || '');
            return id !== oldId && id !== nextId;
          });
        next.push(clone(normalized));
        next.sort((a, b) => String(a.id).localeCompare(String(b.id)));
        mapData.topology = next;
        if (typeof options.onTopologyChanged === 'function') options.onTopologyChanged(next);
        return normalized;
      }

      const updates = { [nextId]: clone(normalized) };
      if (oldId !== nextId) updates[oldId] = null;
      await db.ref(`${base.TOPOLOGY_ROOT}/${bridge.mapId}/elements`).update(updates);
      return normalized;
    }

    return Object.freeze({ ...bridge, replaceElement });
  }

  root.LuminousVttStateBridge = Object.freeze({
    ...base,
    __atomicReplacePatch: true,
    createBridge,
  });
})(typeof window !== 'undefined' ? window : globalThis);
