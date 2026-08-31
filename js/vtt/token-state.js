(function (root, factory) {
    const api = factory(root);
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (root) root.LuminousVttTokenState = api;
})(typeof window !== 'undefined' ? window : globalThis, function (browserRoot) {
    'use strict';

    const PLAYER_ROOT = 'campaña/jugadores';
    const WORLD_ROOT = 'campaña/estado_mundo/vttTokens';
    const DM_UID = 'e9JwFZrtk6g8UMqq2Hf9EHVY7Ay1';
    const clean = (value) => String(value ?? '').trim();
    const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));

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

    function identity(root = browserRoot) {
        const host = hostWindow(root);
        const data = host?.datosJugador || {};
        let uid = '';
        try { uid = clean(hostFirebase(root)?.auth?.().currentUser?.uid); } catch (_) {}
        return {
            uid,
            playerId: clean(host?.localStorage?.getItem?.('playerId') || data.playerId || data.id),
            actorId: clean(data.actorId || data.vinculo_jugador),
        };
    }

    function firebaseKey(value, fallback = 'token') {
        return clean(value).replace(/[.#$\[\]\/]/g, '_') || fallback;
    }

    function isCurrentPlayerTemplate(token = {}) {
        return token.characterLink?.mode === 'current_player';
    }

    function tokenLayer(token = {}) {
        if (Number.isFinite(Number(token.zLayer))) return Number(token.zLayer);
        if (Number.isFinite(Number(token.gridPosition?.z))) return Number(token.gridPosition.z);
        if (Array.isArray(token.z) && token.z.length) return Number(token.z[0]) || 0;
        return 0;
    }

    function positionFromToken(token = {}) {
        const zLayer = tokenLayer(token);
        const grid = token.gridPosition || {};
        const position = {
            x: Number(token.x) || 0,
            y: Number(token.y) || 0,
            zLayer,
            elevationFt: Number(token.elevationFt) || 0,
            gridPosition: {
                col: Number.isFinite(Number(grid.col)) ? Number(grid.col) : 0,
                row: Number.isFinite(Number(grid.row)) ? Number(grid.row) : 0,
                z: Number.isFinite(Number(grid.z)) ? Number(grid.z) : zLayer,
            },
        };
        if (token.verticalMovement) position.verticalMovement = clone(token.verticalMovement);
        if (token.lastVerticalTravel) position.lastVerticalTravel = clone(token.lastVerticalTravel);
        return position;
    }

    function applyPosition(token, rawPosition = {}) {
        if (!token || !rawPosition || typeof rawPosition !== 'object') return token;
        const zLayer = Number.isFinite(Number(rawPosition.zLayer)) ? Number(rawPosition.zLayer) : tokenLayer(token);
        if (Number.isFinite(Number(rawPosition.x))) token.x = Number(rawPosition.x);
        if (Number.isFinite(Number(rawPosition.y))) token.y = Number(rawPosition.y);
        token.zLayer = zLayer;
        token.z = [zLayer];
        token.elevationFt = Number.isFinite(Number(rawPosition.elevationFt)) ? Number(rawPosition.elevationFt) : Number(token.elevationFt) || 0;
        const grid = rawPosition.gridPosition || {};
        token.gridPosition = {
            col: Number.isFinite(Number(grid.col)) ? Number(grid.col) : Number(token.gridPosition?.col) || 0,
            row: Number.isFinite(Number(grid.row)) ? Number(grid.row) : Number(token.gridPosition?.row) || 0,
            z: Number.isFinite(Number(grid.z)) ? Number(grid.z) : zLayer,
        };
        if (rawPosition.verticalMovement) token.verticalMovement = clone(rawPosition.verticalMovement);
        else delete token.verticalMovement;
        if (rawPosition.lastVerticalTravel) token.lastVerticalTravel = clone(rawPosition.lastVerticalTravel);
        else delete token.lastVerticalTravel;
        return token;
    }

    function playerRecordFromToken(token, owner = {}) {
        if (!clean(owner.playerId)) throw new Error('PLAYER_ID_REQUIRED');
        return {
            schemaVersion: 1,
            ownerUid: clean(owner.uid) || null,
            playerId: clean(owner.playerId),
            actorId: clean(owner.actorId) || null,
            baseTokenId: clean(token?.baseTokenId || token?.id || 'player'),
            position: positionFromToken(token),
        };
    }

    function worldRecordFromToken(token) {
        if (!clean(token?.id)) throw new Error('TOKEN_ID_REQUIRED');
        return {
            schemaVersion: 1,
            tokenId: clean(token.id),
            position: positionFromToken(token),
        };
    }

    function playerTokenFromRecord(template, playerKey, record = {}, current = {}) {
        const token = clone(template || {});
        const playerId = clean(record.playerId || playerKey);
        const ownerUid = clean(record.ownerUid);
        token.id = `player:${firebaseKey(playerId || ownerUid, 'unknown')}`;
        token.baseTokenId = clean(record.baseTokenId || template?.id || 'player');
        token.ownerUid = ownerUid || null;
        token.playerId = playerId || null;
        token.actorId = clean(record.actorId) || null;
        token.characterLink = { mode: 'player', uid: token.ownerUid, playerId: token.playerId, actorId: token.actorId };
        token.canonicalScope = 'player';
        token.canonicalPlayerKey = clean(playerKey || playerId);
        token.canonicalOwnerUid = ownerUid || null;
        token.viewer = Boolean((ownerUid && ownerUid === clean(current.uid)) || (playerId && playerId === clean(current.playerId)));
        token.draggable = template?.draggable !== false;
        applyPosition(token, record.position || {});
        return token;
    }

    function extractPlayerRecords(rawPlayers = {}, mapId = 'default') {
        const records = {};
        Object.entries(rawPlayers || {}).forEach(([playerKey, playerData]) => {
            const record = playerData?.vttTokenState?.[mapId];
            if (!record?.position) return;
            records[playerKey] = {
                ...record,
                playerId: clean(record.playerId || playerKey),
            };
        });
        return records;
    }

    function createBridge({ mapData, isDm = false, onTokensChanged, notify, root = browserRoot } = {}) {
        if (!mapData) throw new Error('MAP_DATA_REQUIRED');
        const firebase = hostFirebase(root);
        const db = firebase?.database?.() || null;
        const mapId = firebaseKey(mapData.id || mapData.mapId || 'default', 'default');
        const current = identity(root);
        const subscriptions = [];
        const playerStateSubscriptions = new Map();
        const template = clone((mapData.tokens || []).find(isCurrentPlayerTemplate) || null);
        const fixedTokenIds = new Set((mapData.tokens || []).filter((token) => !isCurrentPlayerTemplate(token)).map((token) => clean(token.id)).filter(Boolean));
        let started = false;
        let seedingPlayer = false;
        let seedingWorld = false;

        const emitNotice = (message, mode = 'info') => {
            if (typeof notify === 'function') notify(message, mode);
        };

        const playersRootRef = () => db?.ref(PLAYER_ROOT);
        const playerStateRef = (playerKey) => db?.ref(`${PLAYER_ROOT}/${firebaseKey(playerKey, 'player')}/vttTokenState/${mapId}`);
        const worldRef = () => db?.ref(`${WORLD_ROOT}/${mapId}`);

        function subscribe(ref, event, handler) {
            if (!ref?.on) return () => {};
            ref.on(event, handler);
            const unsubscribe = () => ref.off(event, handler);
            subscriptions.push(unsubscribe);
            return unsubscribe;
        }

        function localViewerToken() {
            return (mapData.tokens || []).find((token) => token.viewer === true)
                || (mapData.tokens || []).find(isCurrentPlayerTemplate)
                || null;
        }

        function isOwnRecord(record = {}, playerKey = '') {
            const uidMatch = clean(record.ownerUid) && clean(record.ownerUid) === clean(current.uid);
            const playerMatch = clean(record.playerId || playerKey) && clean(record.playerId || playerKey) === clean(current.playerId);
            return Boolean(uidMatch || playerMatch);
        }

        function emitPlayerChange() {
            if (typeof onTokensChanged === 'function') onTokensChanged({ scope: 'players', tokens: mapData.tokens });
        }

        function emitWorldChange() {
            if (typeof onTokensChanged === 'function') onTokensChanged({ scope: 'world', tokens: mapData.tokens });
        }

        function removePlayerRecord(playerKey, { emit = true } = {}) {
            const key = clean(playerKey);
            if (!key) return false;
            const ownTemplate = !isDm ? (mapData.tokens || []).find(isCurrentPlayerTemplate) : null;
            const before = (mapData.tokens || []).length;
            mapData.tokens = (mapData.tokens || []).filter((token) => {
                if (token === ownTemplate) return true;
                if (fixedTokenIds.has(clean(token.id))) return true;
                if (token.canonicalScope !== 'player') return true;
                return clean(token.canonicalPlayerKey || token.playerId) !== key;
            });
            if (emit && before !== mapData.tokens.length) emitPlayerChange();
            return before !== mapData.tokens.length;
        }

        function syncSinglePlayerRecord(playerKey, record = null, { emit = true } = {}) {
            const key = clean(playerKey || record?.playerId);
            if (!key || !record?.position) return removePlayerRecord(key, { emit });
            const playerId = clean(record.playerId || key);
            const ownerUid = clean(record.ownerUid);
            const ownTemplate = !isDm ? (mapData.tokens || []).find(isCurrentPlayerTemplate) : null;

            if (!isDm && isOwnRecord(record, key) && ownTemplate) {
                ownTemplate.ownerUid = ownerUid || ownTemplate.ownerUid || null;
                ownTemplate.playerId = playerId || ownTemplate.playerId || current.playerId || null;
                ownTemplate.actorId = clean(record.actorId) || ownTemplate.actorId || null;
                ownTemplate.canonicalScope = 'player';
                ownTemplate.canonicalPlayerKey = key || playerId || current.playerId;
                ownTemplate.canonicalOwnerUid = ownerUid || current.uid || null;
                ownTemplate.viewer = true;
                applyPosition(ownTemplate, record.position);
                mapData.tokens = (mapData.tokens || []).filter((token) => token === ownTemplate || clean(token.canonicalPlayerKey) !== ownTemplate.canonicalPlayerKey);
                if (emit) emitPlayerChange();
                return ownTemplate;
            }

            const id = `player:${firebaseKey(playerId || ownerUid || key, 'unknown')}`;
            let token = (mapData.tokens || []).find((entry) => clean(entry.id) === id || (entry.canonicalScope === 'player' && clean(entry.canonicalPlayerKey) === key));
            if (!token) {
                token = playerTokenFromRecord(template || ownTemplate || {}, key, record, current);
                mapData.tokens ||= [];
                mapData.tokens.push(token);
            } else {
                token.id = id;
                token.ownerUid = ownerUid || null;
                token.playerId = playerId || null;
                token.actorId = clean(record.actorId) || token.actorId || null;
                token.characterLink = { mode: 'player', uid: token.ownerUid, playerId: token.playerId, actorId: token.actorId };
                token.canonicalScope = 'player';
                token.canonicalPlayerKey = key || playerId;
                token.canonicalOwnerUid = ownerUid || null;
                token.viewer = Boolean(!isDm && isOwnRecord(record, key));
                applyPosition(token, record.position);
            }
            if (emit) emitPlayerChange();
            return token;
        }

        function syncPlayerRecords(rawRecord = {}) {
            const records = rawRecord || {};
            const keepKeys = new Set(Object.keys(records).filter((key) => records[key]?.position).map(clean));
            if (isDm && template) mapData.tokens = (mapData.tokens || []).filter((token) => !isCurrentPlayerTemplate(token));
            Object.entries(records).forEach(([playerKey, record]) => syncSinglePlayerRecord(playerKey, record, { emit: false }));
            mapData.tokens = (mapData.tokens || []).filter((token) => {
                if (fixedTokenIds.has(clean(token.id))) return true;
                if (!isDm && isCurrentPlayerTemplate(token)) return true;
                if (token.canonicalScope === 'player') return keepKeys.has(clean(token.canonicalPlayerKey || token.playerId));
                return true;
            });
            emitPlayerChange();
        }

        function syncSingleWorldRecord(worldKey, record = null, { emit = true } = {}) {
            const key = clean(worldKey || record?.tokenId);
            if (!key || !record?.position) return null;
            const tokenId = clean(record.tokenId || key);
            const token = (mapData.tokens || []).find((entry) => clean(entry.id) === tokenId);
            if (!token) return null;
            token.canonicalScope = 'world';
            token.canonicalTokenKey = firebaseKey(tokenId);
            applyPosition(token, record.position);
            if (emit) emitWorldChange();
            return token;
        }

        function syncWorldRecords(rawRecord = {}) {
            Object.entries(rawRecord || {}).forEach(([key, record]) => syncSingleWorldRecord(key, record, { emit: false }));
            emitWorldChange();
        }

        function unwatchPlayerState(playerKey) {
            const key = clean(playerKey);
            const unsubscribe = playerStateSubscriptions.get(key);
            if (!unsubscribe) return false;
            unsubscribe();
            playerStateSubscriptions.delete(key);
            return true;
        }

        function watchPlayerState(playerKey) {
            const key = clean(playerKey);
            if (!db || !key || playerStateSubscriptions.has(key)) return false;
            const ref = playerStateRef(key);
            if (!ref?.on) return false;
            const handler = (snapshot) => syncSinglePlayerRecord(key, snapshot.val() || null);
            ref.on('value', handler);
            playerStateSubscriptions.set(key, () => ref.off('value', handler));
            return true;
        }

        async function seedOwnPlayerIfNeeded() {
            if (seedingPlayer || isDm || !db || !current.playerId || !template) return;
            seedingPlayer = true;
            try {
                const ref = playerStateRef(current.playerId);
                const snapshot = await ref.once('value');
                const exists = typeof snapshot.exists === 'function' ? snapshot.exists() : snapshot.val() != null;
                if (exists) return;
                const record = playerRecordFromToken(localViewerToken() || template, current);
                record.updatedByUid = current.uid || null;
                record.updatedAt = firebase.database.ServerValue.TIMESTAMP;
                await ref.set(record);
            } finally {
                seedingPlayer = false;
            }
        }

        async function seedWorldIfNeeded() {
            if (seedingWorld || !isDm || !db) return;
            seedingWorld = true;
            try {
                const snapshot = await worldRef().once('value');
                const existing = snapshot.val() || {};
                const updates = {};
                for (const token of (mapData.tokens || [])) {
                    if (isCurrentPlayerTemplate(token) || token.canonicalScope === 'player' || !clean(token.id)) continue;
                    const key = firebaseKey(token.id);
                    if (existing[key]) continue;
                    const record = worldRecordFromToken(token);
                    record.updatedByUid = current.uid || DM_UID;
                    record.updatedAt = firebase.database.ServerValue.TIMESTAMP;
                    updates[key] = record;
                }
                if (Object.keys(updates).length) await worldRef().update(updates);
            } finally {
                seedingWorld = false;
            }
        }

        async function saveToken(token) {
            if (!token) throw new Error('TOKEN_REQUIRED');
            if (!db) return { valid: true, offline: true, position: positionFromToken(token) };

            const playerScope = token.canonicalScope === 'player' || isCurrentPlayerTemplate(token) || Boolean(token.canonicalPlayerKey);
            if (playerScope) {
                const playerKey = clean(token.canonicalPlayerKey || token.playerId || (isCurrentPlayerTemplate(token) ? current.playerId : ''));
                if (!playerKey) throw new Error('PLAYER_ID_REQUIRED');
                const ownerUid = clean(token.canonicalOwnerUid || token.ownerUid || (playerKey === current.playerId ? current.uid : ''));
                if (!isDm && playerKey !== current.playerId && ownerUid !== current.uid) throw new Error('PLAYER_TOKEN_OWNERSHIP_REQUIRED');
                const owner = {
                    uid: ownerUid || (playerKey === current.playerId ? current.uid : ''),
                    playerId: playerKey,
                    actorId: token.actorId || (playerKey === current.playerId ? current.actorId : ''),
                };
                const record = playerRecordFromToken(token, owner);
                record.updatedByUid = current.uid || DM_UID;
                record.updatedAt = firebase.database.ServerValue.TIMESTAMP;
                await playerStateRef(playerKey).set(record);
                return { valid: true, scope: 'player', key: playerKey, record };
            }

            if (!isDm) throw new Error('DM_REQUIRED');
            const key = firebaseKey(token.id);
            const record = worldRecordFromToken(token);
            record.updatedByUid = current.uid || DM_UID;
            record.updatedAt = firebase.database.ServerValue.TIMESTAMP;
            await worldRef().child(key).set(record);
            return { valid: true, scope: 'world', key, record };
        }

        function start() {
            if (started) return true;
            started = true;
            if (!db) return false;

            if (isDm && template) mapData.tokens = (mapData.tokens || []).filter((token) => !isCurrentPlayerTemplate(token));
            subscribe(playersRootRef(), 'child_added', (snapshot) => watchPlayerState(snapshot.key));
            subscribe(playersRootRef(), 'child_removed', (snapshot) => {
                unwatchPlayerState(snapshot.key);
                removePlayerRecord(snapshot.key);
            });
            worldRef().once('value')
                .then((snapshot) => syncWorldRecords(snapshot.val() || {}))
                .catch((error) => console.error('VTT world token bootstrap failed:', error));
            subscribe(worldRef(), 'child_changed', (snapshot) => syncSingleWorldRecord(snapshot.key, snapshot.val() || null));
            seedOwnPlayerIfNeeded().catch((error) => console.error('VTT player token seed failed:', error));
            seedWorldIfNeeded().catch((error) => console.error('VTT world token seed failed:', error));
            return true;
        }

        function stop() {
            playerStateSubscriptions.forEach((unsubscribe) => unsubscribe());
            playerStateSubscriptions.clear();
            subscriptions.splice(0).forEach((unsubscribe) => unsubscribe());
            started = false;
        }

        return Object.freeze({
            mapId,
            isDm: Boolean(isDm),
            identity: current,
            start,
            stop,
            saveToken,
            syncPlayerRecords,
            syncSinglePlayerRecord,
            removePlayerRecord,
            watchPlayerState,
            syncWorldRecords,
            syncSingleWorldRecord,
            notify: emitNotice,
        });
    }

    return Object.freeze({
        PLAYER_ROOT,
        WORLD_ROOT,
        DM_UID,
        hostWindow,
        hostFirebase,
        identity,
        firebaseKey,
        isCurrentPlayerTemplate,
        tokenLayer,
        positionFromToken,
        applyPosition,
        playerRecordFromToken,
        worldRecordFromToken,
        playerTokenFromRecord,
        extractPlayerRecords,
        createBridge,
    });
});
