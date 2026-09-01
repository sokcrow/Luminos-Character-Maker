(function (root, factory) {
    const api = factory(root);
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (root) root.LuminousVttTopologyInteractionAuthority = api;
})(typeof window !== 'undefined' ? window : globalThis, function (browserRoot) {
    'use strict';

    const REQUEST_ROOT = 'vtt_world_object_action_requests';
    const DIRECT_ACTIONS = Object.freeze(['open', 'close', 'lock', 'unlock', 'open_curtain', 'close_curtain']);
    const CHECK_ACTIONS = Object.freeze(['pick_lock', 'force']);
    const VALIDATED_ACTIONS = Object.freeze([...DIRECT_ACTIONS, ...CHECK_ACTIONS]);
    const clean = (value) => String(value ?? '').trim();

    function actorOwnership(token = {}, request = {}) {
        const requesterUid = clean(request.requesterUid);
        const requestedPlayerId = clean(request.playerId);
        const requestedActorId = clean(request.actorId);
        const ownerUid = clean(token.canonicalOwnerUid || token.ownerUid || token.characterLink?.uid);
        const playerId = clean(token.playerId || token.canonicalPlayerKey || token.characterLink?.playerId);
        const actorId = clean(token.actorId || token.characterLink?.actorId);

        if (!requesterUid) return { valid: false, reason: 'REQUESTER_UID_REQUIRED' };
        if (!ownerUid) return { valid: false, reason: 'ACTOR_OWNERSHIP_UNVERIFIED' };
        if (ownerUid !== requesterUid) return { valid: false, reason: 'ACTOR_NOT_OWNED' };
        if (playerId && requestedPlayerId && playerId !== requestedPlayerId) return { valid: false, reason: 'ACTOR_NOT_OWNED' };
        if (actorId && requestedActorId && actorId !== requestedActorId) return { valid: false, reason: 'ACTOR_NOT_OWNED' };

        return {
            valid: true,
            reason: null,
            ownerUid,
            playerId: playerId || null,
            actorId: actorId || null,
        };
    }

    function createAuthority({ mapData, stateBridge, notify, root = browserRoot } = {}) {
        if (!mapData || !stateBridge) throw new Error('TOPOLOGY_INTERACTION_AUTHORITY_REQUIRES_RUNTIME');
        const stateApi = root?.LuminousVttStateBridge;
        const topology = root?.LuminousVttTopology;
        const interactions = root?.LuminousVttTopologyInteraction;
        if (!stateApi || !topology || !interactions) throw new Error('TOPOLOGY_INTERACTION_RUNTIME_REQUIRED');

        const host = stateApi.hostWindow(root);
        const firebase = host?.firebase || root?.firebase || null;
        const db = firebase?.database?.() || null;
        const mapId = clean(stateBridge.mapId || mapData.id || mapData.mapId || 'default') || 'default';
        const isDm = Boolean(stateBridge.isDm);
        const subscriptions = [];
        let started = false;

        const emit = (message, mode = 'info') => { if (typeof notify === 'function') notify(message, mode); };
        const rootRef = () => db?.ref(`${REQUEST_ROOT}/${mapId}`);
        const tokenLayer = (token = {}) => Number(token.zLayer ?? token.gridPosition?.z ?? (Array.isArray(token.z) ? token.z[0] : token.z) ?? 0) || 0;
        const elementById = (id) => (mapData.topology || []).find((entry) => String(entry?.id) === String(id)) || null;
        const tokenById = (id) => (mapData.tokens || []).find((entry) => String(entry?.id) === String(id)) || null;

        function closingBlocked(element) {
            if (element.openState !== 'open') return false;
            const line = topology.segment(element, mapData.grid || {});
            const zLayer = Number(topology.elementLayers(element)[0] || 0);
            return (mapData.tokens || []).some((token) => {
                if (!token || tokenLayer(token) !== zLayer) return false;
                const radius = interactions.tokenRadiusPx(token, mapData.grid || {});
                const distance = topology.pointToSegmentDistance(
                    { x: Number(token.x) || 0, y: Number(token.y) || 0 },
                    { x: line.x1, y: line.y1 }, { x: line.x2, y: line.y2 },
                );
                return distance < Math.max(4, radius * 0.9);
            });
        }

        async function requesterInventory(playerId) {
            const canonicalPlayerId = clean(playerId);
            if (!db || !canonicalPlayerId) return {};
            try {
                const snapshot = await db.ref(`campaña/jugadores/${canonicalPlayerId}`).once('value');
                return snapshot.val() || {};
            } catch (_) { return {}; }
        }

        async function validateRequest(request = {}) {
            if (!VALIDATED_ACTIONS.includes(request.action)) return { valid: false, reason: 'ACTION_NOT_ALLOWED' };
            if (request.targetKind !== 'topology') return { valid: false, reason: 'TARGET_KIND_NOT_SUPPORTED' };
            const element = elementById(request.targetId);
            const actorToken = tokenById(request.actorTokenId);
            if (!element) return { valid: false, reason: 'ELEMENT_NOT_FOUND' };
            if (!actorToken) return { valid: false, reason: 'ACTOR_TOKEN_NOT_FOUND' };

            const ownership = actorOwnership(actorToken, request);
            if (!ownership.valid) return ownership;

            const normalized = topology.normalizeElement(element);
            const inventory = await requesterInventory(ownership.playerId);
            const keyId = normalized.interaction?.keyId;
            const hasKey = keyId ? stateApi.inventoryHasItem(inventory, keyId) : false;
            const facts = interactions.factsFor(normalized, actorToken, mapData, {
                hasKey,
                hasLockpick: stateApi.inventoryHasItem(inventory, 'lockpick'),
                blockedByOccupant: closingBlocked(normalized),
            });
            const candidate = interactions.actionsFor(normalized, facts).find((entry) => entry.id === request.action);
            if (!candidate) return { valid: false, reason: 'ACTION_NOT_AVAILABLE' };
            if (!candidate.enabled) return { valid: false, reason: candidate.reason || 'ACTION_DENIED' };
            return { valid: true, reason: null, element: normalized, facts, ownership };
        }

        async function decide(snapshot) {
            if (!isDm || !db) return;
            const request = snapshot.val() || {};
            if (request.status !== 'pending' || request.targetKind !== 'topology' || clean(request.mapId) !== mapId) return;
            if (!DIRECT_ACTIONS.includes(request.action)) {
                await snapshot.ref.update({
                    status: 'denied',
                    reason: 'ACTION_NOT_ALLOWED',
                    decidedAt: firebase.database.ServerValue.TIMESTAMP,
                });
                return;
            }
            const validation = await validateRequest(request);
            let result = validation;
            if (validation.valid) result = await stateBridge.applyCanonicalAction(request.targetId, request.action);
            await snapshot.ref.update({
                status: result.valid ? 'applied' : 'denied',
                reason: result.reason || null,
                decidedAt: firebase.database.ServerValue.TIMESTAMP,
            });
        }

        async function requestAction(elementId, action, actorTokenId) {
            if (!DIRECT_ACTIONS.includes(action)) return { valid: false, reason: 'ACTION_NOT_ALLOWED' };
            if (!db || isDm) return stateBridge.applyCanonicalAction(elementId, action);
            const identity = stateApi.playerIdentity(root);
            if (!identity.uid) throw new Error('AUTH_NOT_READY');
            const requestRef = rootRef().push();
            const safeActorTokenId = clean(actorTokenId);
            if (!safeActorTokenId) return { valid: false, reason: 'ACTOR_TOKEN_REQUIRED' };
            await requestRef.set({
                schemaVersion: 1,
                requesterUid: identity.uid,
                playerId: identity.playerId || null,
                actorId: identity.actorId || null,
                mapId,
                targetKind: 'topology',
                targetId: String(elementId),
                actorTokenId: safeActorTokenId,
                action,
                status: 'pending',
                clientCreatedAt: Date.now(),
                createdAt: firebase.database.ServerValue.TIMESTAMP,
            });
            emit('Interacción enviada.', 'pending');
            const handler = (nextSnapshot) => {
                const value = nextSnapshot.val() || {};
                if (value.status === 'applied') {
                    emit('Interacción aplicada.', 'success');
                    requestRef.off('value', handler);
                } else if (value.status === 'denied') {
                    emit(value.reason ? `Interacción rechazada: ${value.reason}` : 'Interacción rechazada.', 'error');
                    requestRef.off('value', handler);
                }
            };
            requestRef.on('value', handler);
            return { valid: true, pending: true, requestId: requestRef.key };
        }

        function start() {
            if (started) return true;
            started = true;
            if (!db || !isDm) return Boolean(db);
            const ref = rootRef();
            const handler = (snapshot) => decide(snapshot).catch((error) => console.error('Topology interaction authority failed:', error));
            ref.on('child_added', handler);
            subscriptions.push(() => ref.off('child_added', handler));
            return true;
        }

        function stop() {
            while (subscriptions.length) subscriptions.pop()();
            started = false;
        }

        return Object.freeze({ mapId, isDm, start, stop, requestAction, validateRequest });
    }

    return Object.freeze({ REQUEST_ROOT, DIRECT_ACTIONS, CHECK_ACTIONS, VALIDATED_ACTIONS, actorOwnership, createAuthority });
});