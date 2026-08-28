(function (root, factory) {
    const api = factory(root);
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (root) root.LuminousVttVerticalPortalState = api;
})(typeof window !== 'undefined' ? window : globalThis, function (browserRoot) {
    'use strict';

    const ROOT = 'vtt_topology';
    const safeString = (value) => String(value ?? '').trim();

    function hostWindow(root = browserRoot) {
        if (!root) return null;
        try {
            if (root.parent && root.parent !== root && root.parent.document) return root.parent;
        } catch (_) {}
        return root;
    }

    function hostFirebase(root = browserRoot) {
        const host = hostWindow(root);
        return host?.firebase || root?.firebase || null;
    }

    function recordFromPortals(portals, runtime, mapData) {
        const record = {};
        for (const raw of Array.isArray(portals) ? portals : []) {
            const portal = runtime.normalizePortal(raw, mapData);
            if (!portal.id) continue;
            record[portal.id] = JSON.parse(JSON.stringify(portal));
        }
        return record;
    }

    function portalsFromRecord(record, runtime, mapData) {
        return Object.values(record || {})
            .filter(Boolean)
            .map((portal) => runtime.normalizePortal(portal, mapData))
            .sort((a, b) => String(a.id).localeCompare(String(b.id)));
    }

    function createBridge({ mapData, isDm = false, onChanged, notify, root = browserRoot } = {}) {
        if (!mapData) throw new Error('MAP_DATA_REQUIRED');
        const runtime = root?.LuminousVttVerticalPortal || (typeof require !== 'undefined' ? require('./vertical-portal.js') : null);
        if (!runtime) throw new Error('VERTICAL_PORTAL_RUNTIME_REQUIRED');

        const firebase = hostFirebase(root);
        const db = firebase?.database?.() || null;
        const mapId = safeString(mapData.id || mapData.mapId || 'default') || 'default';
        const subscriptions = [];
        let started = false;
        let seedAttempted = false;

        const emitNotice = (message, mode = 'info') => {
            if (typeof notify === 'function') notify(message, mode);
        };

        const replacePortals = (portals) => {
            mapData.verticalPortals = portals;
            if (typeof onChanged === 'function') onChanged(portals);
        };

        const portalsRef = () => db?.ref(`${ROOT}/${mapId}/verticalPortals`);

        async function seedIfNeeded(snapshot) {
            if (seedAttempted) return;
            seedAttempted = true;
            const hasValue = typeof snapshot?.exists === 'function' ? snapshot.exists() : snapshot?.val?.() != null;
            if (!isDm || hasValue || !Array.isArray(mapData.verticalPortals) || !mapData.verticalPortals.length) return;
            await portalsRef().set(recordFromPortals(mapData.verticalPortals, runtime, mapData));
        }

        function subscribe(ref, event, handler) {
            if (!ref?.on) return;
            ref.on(event, handler);
            subscriptions.push(() => ref.off(event, handler));
        }

        async function savePortal(rawPortal) {
            if (!isDm) throw new Error('DM_REQUIRED');
            const portal = runtime.normalizePortal(rawPortal, mapData);
            if (!portal.id) throw new Error('PORTAL_ID_REQUIRED');
            if (!db) {
                const list = Array.isArray(mapData.verticalPortals) ? [...mapData.verticalPortals] : [];
                const index = list.findIndex((entry) => String(entry.id) === String(portal.id));
                if (index >= 0) list[index] = portal;
                else list.push(portal);
                replacePortals(list);
                return portal;
            }
            await portalsRef().child(portal.id).set(JSON.parse(JSON.stringify(portal)));
            return portal;
        }

        async function deletePortal(portalId) {
            if (!isDm) throw new Error('DM_REQUIRED');
            if (!db) {
                replacePortals((mapData.verticalPortals || []).filter((entry) => String(entry.id) !== String(portalId)));
                return true;
            }
            await portalsRef().child(String(portalId)).remove();
            return true;
        }

        function start() {
            if (started) return true;
            started = true;
            if (!db) {
                replacePortals((mapData.verticalPortals || []).map((portal) => runtime.normalizePortal(portal, mapData)));
                return false;
            }
            subscribe(portalsRef(), 'value', (snapshot) => {
                seedIfNeeded(snapshot).catch((error) => console.error('VTT vertical portal seed failed:', error));
                replacePortals(portalsFromRecord(snapshot.val(), runtime, mapData));
            });
            return true;
        }

        function stop() {
            subscriptions.splice(0).forEach((unsubscribe) => unsubscribe());
            started = false;
        }

        return Object.freeze({
            mapId,
            isDm: Boolean(isDm),
            start,
            stop,
            savePortal,
            deletePortal,
            notify: emitNotice,
        });
    }

    return Object.freeze({ ROOT, createBridge });
});
