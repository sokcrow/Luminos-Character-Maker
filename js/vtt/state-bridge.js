(function (root, factory) {
    const api = factory(root);
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (root) root.LuminousVttStateBridge = api;
})(typeof window !== 'undefined' ? window : globalThis, function (browserRoot) {
    'use strict';

    const DM_UID = 'e9JwFZrtk6g8UMqq2Hf9EHVY7Ay1';
    const TOPOLOGY_ROOT = 'vtt_topology';
    const ACTION_REQUEST_ROOT = 'vtt_topology_action_requests';
    const CHECK_REQUEST_ROOT = 'theatre_check_requests';
    const CHECK_COMMAND_ROOT = 'theatre_check_commands';
    const CHECK_LIVE_ROOT = 'theatre_check_live';
    const ITEM_ALIASES = Object.freeze({
        lockpick: Object.freeze(['lockpick', 'lockpicks', 'ganzua', 'ganzúa', 'ganzuas', 'ganzúas']),
    });

    const numberOr = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
    const safeString = (value) => String(value ?? '').trim();
    const normalizeText = (value) => safeString(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

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

    function hostDocument(root = browserRoot) {
        return hostWindow(root)?.document || root?.document || null;
    }

    function currentUid(root = browserRoot) {
        try {
            return hostFirebase(root)?.auth?.().currentUser?.uid || null;
        } catch (_) {
            return null;
        }
    }

    function isDmSurface(root = browserRoot) {
        const doc = hostDocument(root);
        return currentUid(root) === DM_UID || Boolean(doc?.body?.classList?.contains('on-game-dashboard'));
    }

    function roomKey(root = browserRoot) {
        const doc = hostDocument(root);
        return safeString(doc?.body?.dataset?.theatreRoomId || 'default').replace(/[.#$\[\]\/]/g, '_') || 'default';
    }

    function playerIdentity(root = browserRoot) {
        const host = hostWindow(root);
        const data = host?.datosJugador || {};
        return {
            uid: currentUid(root),
            playerId: host?.localStorage?.getItem?.('playerId') || data.playerId || data.id || '',
            actorId: data.actorId || data.vinculo_jugador || null,
            name: safeString(data.characterName || data.character_name || data.nombre || data.name || 'PLAYER') || 'PLAYER',
        };
    }

    function itemQuantity(value) {
        if (!value || typeof value !== 'object') return 1;
        const candidates = [value.quantity, value.cantidad, value.count, value.qty, value.amount];
        const numeric = candidates.find((entry) => Number.isFinite(Number(entry)));
        return numeric === undefined ? 1 : Number(numeric);
    }

    function nodeMatchesAliases(node, aliases, depth = 0) {
        if (depth > 5 || node == null) return false;
        if (typeof node === 'string') return aliases.includes(normalizeText(node));
        if (Array.isArray(node)) return node.some((entry) => nodeMatchesAliases(entry, aliases, depth + 1));
        if (typeof node !== 'object') return false;
        if (itemQuantity(node) <= 0) return false;

        const direct = [node.id, node.itemId, node.item_id, node.name, node.nombre, node.tag, node.slug]
            .map(normalizeText)
            .filter(Boolean);
        if (direct.some((value) => aliases.includes(value))) return true;

        return Object.entries(node).some(([key, value]) => {
            if (aliases.includes(normalizeText(key)) && (value === true || numberOr(value, 0) > 0 || typeof value === 'object')) return true;
            return nodeMatchesAliases(value, aliases, depth + 1);
        });
    }

    function inventoryHasItem(player = {}, itemId) {
        const aliases = (ITEM_ALIASES[itemId] || [itemId]).map(normalizeText);
        const roots = [
            player.inventory,
            player.inventario,
            player.items,
            player.itemSlots,
            player.item_slots,
            player.equipment,
            player.equipamiento,
            player.stash,
            player.mochila,
        ].filter((value) => value != null);
        return roots.some((collection) => nodeMatchesAliases(collection, aliases));
    }

    function recordFromElements(elements, topology) {
        const record = {};
        (Array.isArray(elements) ? elements : []).forEach((element) => {
            const normalized = topology.normalizeElement(element);
            if (!normalized.id) return;
            record[normalized.id] = JSON.parse(JSON.stringify(normalized));
        });
        return record;
    }

    function elementsFromRecord(record, topology) {
        return Object.values(record || {})
            .filter(Boolean)
            .map((element) => topology.normalizeElement(element))
            .sort((a, b) => String(a.id).localeCompare(String(b.id)));
    }

    function createBridge({ mapData, onTopologyChanged, notify, root = browserRoot } = {}) {
        if (!mapData) throw new Error('MAP_DATA_REQUIRED');
        const topology = root?.LuminousVttTopology || (typeof require !== 'undefined' ? require('./topology.js') : null);
        if (!topology) throw new Error('TOPOLOGY_RUNTIME_REQUIRED');

        const host = hostWindow(root);
        const firebase = hostFirebase(root);
        const db = firebase?.database?.() || null;
        const mapId = safeString(mapData.id || mapData.mapId || 'default') || 'default';
        const dm = isDmSurface(root);
        const watchedChecks = new Map();
        const issuingChecks = new Set();
        const subscriptions = [];
        let started = false;
        let seedAttempted = false;

        const emitNotice = (message, mode = 'info') => {
            if (typeof notify === 'function') notify(message, mode);
        };

        const replaceTopology = (elements) => {
            mapData.topology = elements;
            if (typeof onTopologyChanged === 'function') onTopologyChanged(elements);
        };

        const elementById = (id) => (mapData.topology || []).find((element) => String(element.id) === String(id)) || null;
        const topologyRef = () => db?.ref(`${TOPOLOGY_ROOT}/${mapId}/elements`);

        async function seedIfNeeded(snapshot) {
            if (seedAttempted) return;
            seedAttempted = true;
            if (!dm || snapshot.exists() || !Array.isArray(mapData.topology) || !mapData.topology.length) return;
            const initialRecord = recordFromElements(mapData.topology, topology);
            await topologyRef().set(initialRecord);
        }

        function subscribe(ref, event, handler) {
            if (!ref?.on) return;
            ref.on(event, handler);
            subscriptions.push(() => ref.off(event, handler));
        }

        async function saveElement(element) {
            const normalized = topology.normalizeElement(element);
            if (!normalized.id) throw new Error('ELEMENT_ID_REQUIRED');
            if (!db) {
                const list = Array.isArray(mapData.topology) ? [...mapData.topology] : [];
                const index = list.findIndex((entry) => String(entry.id) === normalized.id);
                if (index >= 0) list[index] = normalized;
                else list.push(normalized);
                replaceTopology(list);
                return normalized;
            }
            if (!dm) throw new Error('DM_REQUIRED');
            await topologyRef().child(normalized.id).set(JSON.parse(JSON.stringify(normalized)));
            return normalized;
        }

        async function deleteElement(elementId) {
            if (!db) {
                replaceTopology((mapData.topology || []).filter((entry) => String(entry.id) !== String(elementId)));
                return true;
            }
            if (!dm) throw new Error('DM_REQUIRED');
            await topologyRef().child(String(elementId)).remove();
            return true;
        }

        async function applyCanonicalAction(elementId, action) {
            const current = elementById(elementId);
            if (!current) return { valid: false, reason: 'ELEMENT_NOT_FOUND' };
            const result = topology.applyAction(current, action);
            if (!result.valid) return result;
            await saveElement(result.element);
            return result;
        }

        async function requestDirectAction(elementId, action, actorTokenId) {
            if (!db || dm) return applyCanonicalAction(elementId, action);
            const authority = root?.LuminousVttTopologyInteractionAuthorityRuntime?.authority;
            if (!authority?.requestAction) return { valid: false, reason: 'INTERACTION_AUTHORITY_NOT_READY' };
            return authority.requestAction(elementId, action, actorTokenId);
        }

        async function playerData() {
            const identity = playerIdentity(root);
            const local = host?.datosJugador || {};
            if (inventoryHasItem(local, 'lockpick')) return local;
            if (!db || !identity.playerId) return local;
            try {
                const snapshot = await db.ref(`campaña/jugadores/${identity.playerId}`).once('value');
                return snapshot.val() || local;
            } catch (_) {
                return local;
            }
        }

        async function hasItem(itemId) {
            const data = await playerData();
            return inventoryHasItem(data, itemId);
        }

        async function validateTopologyCheckRequest(request = {}) {
            const authority = root?.LuminousVttTopologyInteractionAuthorityRuntime?.authority;
            if (!authority?.validateRequest) return { valid: false, reason: 'INTERACTION_AUTHORITY_NOT_READY' };
            const method = safeString(request.vttContext?.method);
            const action = method === 'lockpick' ? 'pick_lock' : (method === 'strength' || method === 'athletics' ? 'force' : '');
            if (!action) return { valid: false, reason: 'CHECK_NOT_AVAILABLE' };
            return authority.validateRequest({
                requesterUid: request.requesterUid,
                playerId: request.playerId,
                actorId: request.actorId,
                targetKind: 'topology',
                targetId: request.vttContext?.elementId,
                actorTokenId: request.vttContext?.actorTokenId,
                action,
            });
        }

        async function requestTopologyCheck(elementId, method, actorTokenId) {
            const element = elementById(elementId);
            if (!element) throw new Error('ELEMENT_NOT_FOUND');
            const descriptor = topology.checkDescriptor(element, method);
            if (!descriptor) throw new Error('CHECK_NOT_AVAILABLE');
            const safeActorTokenId = safeString(actorTokenId);
            if (!safeActorTokenId) {
                emitNotice('No hay una ficha controlada disponible para interactuar.', 'error');
                return { valid: false, reason: 'ACTOR_TOKEN_REQUIRED' };
            }
            if (descriptor.requiredItem && !(await hasItem(descriptor.requiredItem))) {
                emitNotice('Necesitas una Ganzúa para intentar Juego de Manos.', 'error');
                return { valid: false, reason: 'REQUIRED_ITEM_MISSING' };
            }
            if (!db) {
                emitNotice('El Check requiere una sesión conectada.', 'error');
                return { valid: false, reason: 'FIREBASE_UNAVAILABLE' };
            }
            const identity = playerIdentity(root);
            if (!identity.uid) throw new Error('AUTH_NOT_READY');
            const requestRef = db.ref(CHECK_REQUEST_ROOT).push();
            await requestRef.set({
                schemaVersion: 1,
                requesterUid: identity.uid,
                playerId: identity.playerId || null,
                actorId: identity.actorId || null,
                playerName: identity.name,
                roomKey: roomKey(root),
                status: 'pending',
                rollSpec: descriptor.rollSpec,
                suggestedCheck: {
                    thresholdRaw: descriptor.threshold,
                    hiddenThreshold: true,
                    modifierType: 'neutral',
                    modifierValue: 0,
                    tipText: '',
                },
                vttContext: {
                    mapId,
                    elementId: String(elementId),
                    actorTokenId: safeActorTokenId,
                    method: descriptor.method,
                    action: descriptor.action,
                },
                createdAt: firebase.database.ServerValue.TIMESTAMP,
                clientCreatedAt: Date.now(),
            });
            emitNotice(`${descriptor.rollSpec.label}: solicitud enviada.`, 'pending');
            const handler = (snapshot) => {
                const value = snapshot.val() || {};
                if (value.status === 'approved') emitNotice('Check aprobado. Realiza la tirada.', 'success');
                else if (value.status === 'denied') emitNotice(value.reason ? `El Check fue rechazado: ${value.reason}` : 'El Check fue rechazado.', 'error');
                if (value.status === 'approved' || value.status === 'denied') requestRef.off('value', handler);
            };
            requestRef.on('value', handler);
            return { valid: true, pending: true, requestId: requestRef.key, descriptor };
        }

        async function watchCheckResult(requestId, request) {
            if (!dm || !db || !request?.commandId || watchedChecks.has(requestId)) return;
            const uid = request.requesterUid;
            const liveRef = db.ref(`${CHECK_LIVE_ROOT}/${uid}/${request.commandId}`);
            const handler = async (snapshot) => {
                const live = snapshot.val() || {};
                if (live.status !== 'complete') return;
                liveRef.off('value', handler);
                watchedChecks.delete(requestId);
                const passed = live.outcome === 'passed';
                let applied = false;
                let validationReason = null;
                if (passed) {
                    const validation = await validateTopologyCheckRequest(request);
                    if (validation.valid) {
                        const result = await applyCanonicalAction(request.vttContext.elementId, request.vttContext.action);
                        applied = Boolean(result.valid);
                        validationReason = result.reason || null;
                    } else {
                        validationReason = validation.reason || 'ACTION_DENIED';
                    }
                }
                await db.ref(`${CHECK_REQUEST_ROOT}/${requestId}`).update({
                    vttResolved: passed ? 'passed' : 'failed',
                    vttApplied: applied,
                    vttValidationReason: validationReason,
                    vttResolvedAt: firebase.database.ServerValue.TIMESTAMP,
                });
            };
            watchedChecks.set(requestId, { liveRef, handler });
            liveRef.on('value', handler);
        }

        async function issueTopologyCheck(requestId, request) {
            if (!dm || !db || request.status !== 'pending' || !request.vttContext || request.vttContext.mapId !== mapId) return;
            if (issuingChecks.has(requestId)) return;
            issuingChecks.add(requestId);
            try {
                const freshSnapshot = await db.ref(`${CHECK_REQUEST_ROOT}/${requestId}`).once('value');
                const freshRequest = freshSnapshot.val() || {};
                if (freshRequest.status !== 'pending' || freshRequest.commandId) return;

                const element = elementById(freshRequest.vttContext?.elementId);
                const descriptor = topology.checkDescriptor(element, freshRequest.vttContext?.method);
                const validation = descriptor && freshRequest.requesterUid != null
                    ? await validateTopologyCheckRequest(freshRequest)
                    : { valid: false, reason: descriptor ? 'REQUESTER_UID_REQUIRED' : 'CHECK_NOT_AVAILABLE' };
                if (!descriptor || freshRequest.requesterUid == null || !validation.valid) {
                    await db.ref(`${CHECK_REQUEST_ROOT}/${requestId}`).update({
                        status: 'denied',
                        reason: validation.reason || 'ACTION_DENIED',
                        decidedAt: firebase.database.ServerValue.TIMESTAMP,
                    });
                    return;
                }

                const commandRef = db.ref(`${CHECK_COMMAND_ROOT}/${freshRequest.requesterUid}`).push();
                const command = {
                    schemaVersion: 1,
                    targetUid: freshRequest.requesterUid,
                    targetPlayerId: validation.ownership?.playerId || freshRequest.playerId || null,
                    targetName: freshRequest.playerName || 'PLAYER',
                    roomKey: freshRequest.roomKey || roomKey(root),
                    requestedBy: 'player',
                    requestId,
                    rollSpec: descriptor.rollSpec,
                    check: {
                        thresholdRaw: descriptor.threshold,
                        hiddenThreshold: true,
                        modifierType: 'neutral',
                        modifierValue: 0,
                        tipText: '',
                    },
                    status: 'issued',
                    issuedAt: firebase.database.ServerValue.TIMESTAMP,
                    clientIssuedAt: Date.now(),
                };
                await commandRef.set(command);
                await db.ref(`${CHECK_REQUEST_ROOT}/${requestId}`).update({
                    status: 'approved',
                    commandId: commandRef.key,
                    decidedAt: firebase.database.ServerValue.TIMESTAMP,
                });
                await watchCheckResult(requestId, { ...freshRequest, status: 'approved', commandId: commandRef.key });
            } finally {
                issuingChecks.delete(requestId);
            }
        }

        function processCheckRequests(snapshot) {
            if (!dm || !db) return;
            const all = snapshot.val() || {};
            Object.entries(all).forEach(([requestId, request]) => {
                if (!request?.vttContext || request.vttContext.mapId !== mapId) return;
                if (request.status === 'pending') {
                    issueTopologyCheck(requestId, request).catch((error) => console.error('VTT check issue failed:', error));
                } else if (request.status === 'approved' && request.commandId && !request.vttResolved) {
                    watchCheckResult(requestId, request).catch((error) => console.error('VTT live watch failed:', error));
                }
            });
        }

        function start() {
            if (started) return true;
            started = true;
            if (!db) return false;

            subscribe(topologyRef(), 'value', (snapshot) => {
                seedIfNeeded(snapshot).catch((error) => console.error('VTT topology seed failed:', error));
                replaceTopology(elementsFromRecord(snapshot.val(), topology));
            });

            if (dm) subscribe(db.ref(CHECK_REQUEST_ROOT), 'value', processCheckRequests);
            return true;
        }

        function stop() {
            subscriptions.splice(0).forEach((unsubscribe) => unsubscribe());
            watchedChecks.forEach(({ liveRef, handler }) => liveRef.off('value', handler));
            watchedChecks.clear();
            issuingChecks.clear();
            started = false;
        }

        return Object.freeze({
            mapId,
            isDm: dm,
            start,
            stop,
            saveElement,
            deleteElement,
            requestDirectAction,
            requestTopologyCheck,
            hasItem,
            applyCanonicalAction,
        });
    }

    return Object.freeze({
        DM_UID,
        TOPOLOGY_ROOT,
        ACTION_REQUEST_ROOT,
        CHECK_REQUEST_ROOT,
        CHECK_COMMAND_ROOT,
        CHECK_LIVE_ROOT,
        ITEM_ALIASES,
        hostWindow,
        currentUid,
        isDmSurface,
        roomKey,
        playerIdentity,
        inventoryHasItem,
        recordFromElements,
        elementsFromRecord,
        createBridge,
    });
});