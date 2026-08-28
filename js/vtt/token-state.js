(function (root, factory) {
    const api = factory(root);
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (root) root.LuminousVttTokenState = api;
})(typeof window !== 'undefined' ? window : globalThis, function (browserRoot) {
    'use strict';

    const ROOT = 'vtt_token_state';
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
        if (!clean(owner.uid)) throw new Error('PLAYER_UID_REQUIRED');
        return {
            schemaVersion: 1,
            ownerUid: clean(owner.uid),
            playerId: clean(owner.playerId) || null,
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

    function playerTokenFromRecord(template, uid, record = {}, currentUid = '') {
        const token = clone(template || {});
        const ownerUid = clean(record.ownerUid || uid);
        token.id = `player:${firebaseKey(ownerUid, 'unknown')}`;
        token.baseTokenId = clean(record.baseTokenId || template?.id || 'player');
        token.ownerUid = ownerUid;
        token.playerId = clean(record.playerId) || null;
        token.actorId = clean(record.actorId) || null;
        token.characterLink = { mode: 'uid', uid: ownerUid, playerId: token.playerId, actorId: token.actorId };
        token.canonicalScope = 'player';
        token.canonicalOwnerUid = ownerUid;
        token.viewer = Boolean(ownerUid && ownerUid === clean(currentUid));
        token.draggable = template?.draggable !== false;
        applyPosition(token, record.position || {});
        return token;
    }

    function createBridge({ mapData, isDm = false, onTokensChanged, notify, root = browserRoot } = {}) {
        if (!mapData) throw new Error('MAP_DATA_REQUIRED');
        const firebase = hostFirebase(root);
        const db = firebase?.database?.() || null;
        const mapId = firebaseKey(mapData.id || mapData.mapId || 'default', 'default');
        const current = identity(root);
        const subscriptions = [];
        const template = clone((mapData.tokens || []).find(isCurrentPlayerTemplate) || null);
        const fixedTokenIds = new Set((mapData.tokens || []).filter((token) => !isCurrentPlayerTemplate(token)).map((token) => clean(token.id)).filter(Boolean));
        let started = false;
        let seedingPlayers = false;
        let seedingWorld = false;

        const emitNotice = (message, mode = 'info') => {
            if (typeof notify === 'function') notify(message, mode);
        };

        const rootRef = () => db?.ref(`${ROOT}/${mapId}`);
        const playersRef = () => rootRef()?.child('players');
        const worldRef = () => rootRef()?.child('tokens');

        function subscribe(ref, event, handler) {
            if (!ref?.on) return;
            ref.on(event, handler);
            subscriptions.push(() => ref.off(event, handler));
        }

        function localViewerToken() {
            return (mapData.tokens || []).find((token) => token.viewer === true)
                || (mapData.tokens || []).find(isCurrentPlayerTemplate)
                || null;
        }

        function syncPlayerRecords(rawRecord = {}) {
            const records = rawRecord || {};
            const keepIds = new Set();
            const ownUid = clean(current.uid);
            const ownTemplate = !isDm ? (mapData.tokens || []).find(isCurrentPlayerTemplate) : null;

            if (isDm && template) {
                mapData.tokens = (mapData.tokens || []).filter((token) => !isCurrentPlayerTemplate(token));
            }

            Object.entries(records).forEach(([uid, record]) => {
                if (!record || !record.position) return;
                const ownerUid = clean(record.ownerUid || uid);
                if (!ownerUid) return;

                if (!isDm && ownerUid === ownUid && ownTemplate) {
                    ownTemplate.ownerUid = ownerUid;
                    ownTemplate.playerId = clean(record.playerId) || ownTemplate.playerId || null;
                    ownTemplate.actorId = clean(record.actorId) || ownTemplate.actorId || null;
                    ownTemplate.canonicalScope = 'player';
                    ownTemplate.canonicalOwnerUid = ownerUid;
                    ownTemplate.viewer = true;
                    applyPosition(ownTemplate, record.position);
                    keepIds.add(clean(ownTemplate.id));
                    return;
                }

                const id = `player:${firebaseKey(ownerUid, 'unknown')}`;
                keepIds.add(id);
                let token = (mapData.tokens || []).find((entry) => clean(entry.id) === id);
                if (!token) {
                    token = playerTokenFromRecord(template || ownTemplate || {}, ownerUid, record, ownUid);
                    mapData.tokens ||= [];
                    mapData.tokens.push(token);
                } else {
                    token.ownerUid = ownerUid;
                    token.playerId = clean(record.playerId) || token.playerId || null;
                    token.actorId = clean(record.actorId) || token.actorId || null;
                    token.canonicalScope = 'player';
                    token.canonicalOwnerUid = ownerUid;
                    token.viewer = Boolean(!isDm && ownerUid === ownUid);
                    applyPosition(token, record.position);
                }
            });

            mapData.tokens = (mapData.tokens || []).filter((token) => {
                if (fixedTokenIds.has(clean(token.id))) return true;
                if (!isDm && isCurrentPlayerTemplate(token)) return true;
                if (token.canonicalScope === 'player') return keepIds.has(clean(token.id));
                return true;
            });

            if (typeof onTokensChanged === 'function') onTokensChanged({ scope: 'players', tokens: mapData.tokens });
        }

        function syncWorldRecords(rawRecord = {}) {
            const records = rawRecord || {};
            Object.entries(records).forEach(([key, record]) => {
                if (!record?.position) return;
                const tokenId = clean(record.tokenId || key);
                const token = (mapData.tokens || []).find((entry) => clean(entry.id) === tokenId);
                if (!token) return;
                token.canonicalScope = 'world';
                token.canonicalTokenKey = firebaseKey(tokenId);
                applyPosition(token, record.position);
            });
            if (typeof onTokensChanged === 'function') onTokensChanged({ scope: 'world', tokens: mapData.tokens });
        }

        async function seedOwnPlayerIfNeeded() {
            if (seedingPlayers || isDm || !db || !current.uid || !template) return;
            seedingPlayers = true;
            try {
                const ref = playersRef().child(current.uid);
                const snapshot = await ref.once('value');
                const exists = typeof snapshot.exists === 'function' ? snapshot.exists() : snapshot.val() != null;
                if (exists) return;
                const liveToken = localViewerToken() || template;
                const record = playerRecordFromToken(liveToken, current);
                record.updatedByUid = current.uid;
                record.updatedAt = firebase.database.ServerValue.TIMESTAMP;
                await ref.set(record);
            } finally {
                seedingPlayers = false;
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

            const playerScope = token.canonicalScope === 'player' || isCurrentPlayerTemplate(token) || Boolean(token.canonicalOwnerUid);
            if (playerScope) {
                const ownerUid = clean(token.canonicalOwnerUid || token.ownerUid || (isCurrentPlayerTemplate(token) ? current.uid : ''));
                if (!ownerUid) throw new Error('PLAYER_UID_REQUIRED');
                if (!isDm && ownerUid !== current.uid) throw new Error('PLAYER_TOKEN_OWNERSHIP_REQUIRED');
                const owner = {
                    uid: ownerUid,
                    playerId: token.playerId || (ownerUid === current.uid ? current.playerId : ''),
                    actorId: token.actorId || (ownerUid === current.uid ? current.actorId : ''),
                };
                const record = playerRecordFromToken(token, owner);
                record.updatedByUid = current.uid || DM_UID;
                record.updatedAt = firebase.database.ServerValue.TIMESTAMP;
                await playersRef().child(ownerUid).set(record);
                return { valid: true, scope: 'player', key: ownerUid, record };
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

            subscribe(playersRef(), 'value', (snapshot) => syncPlayerRecords(snapshot.val() || {}));
            subscribe(worldRef(), 'value', (snapshot) => syncWorldRecords(snapshot.val() || {}));
            seedOwnPlayerIfNeeded().catch((error) => console.error('VTT player token seed failed:', error));
            seedWorldIfNeeded().catch((error) => console.error('VTT world token seed failed:', error));
            return true;
        }

        function stop() {
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
            syncWorldRecords,
            notify: emitNotice,
        });
    }

    return Object.freeze({
        ROOT,
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
        createBridge,
    });
});
