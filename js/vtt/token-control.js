(function (root, factory) {
    const api = factory(root);
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (root) root.LuminousVttTokenControl = api;
})(typeof window !== 'undefined' ? window : globalThis, function (browserRoot) {
    'use strict';

    const clean = (value) => String(value ?? '').trim();

    function hostWindow(root = browserRoot) {
        if (!root) return null;
        try {
            if (root.parent && root.parent !== root && root.parent.document) return root.parent;
        } catch (_) {}
        return root;
    }

    function identity(root = browserRoot) {
        const host = hostWindow(root);
        const data = host?.datosJugador || {};
        return {
            uid: clean(host?.firebase?.auth?.().currentUser?.uid),
            playerId: clean(host?.localStorage?.getItem?.('playerId') || data.playerId || data.id),
            actorId: clean(data.actorId || data.vinculo_jugador),
        };
    }

    function isCurrentPlayerToken(token = {}) {
        return token.characterLink?.mode === 'current_player';
    }

    function canPlayerControl(token = {}, current = {}) {
        if (!token || token.draggable === false) return false;
        const link = token.characterLink || {};
        if (link.mode === 'current_player') return true;
        if (link.uid && clean(link.uid) === clean(current.uid)) return true;
        if (link.playerId && clean(link.playerId) === clean(current.playerId)) return true;
        if (link.actorId && clean(link.actorId) === clean(current.actorId)) return true;
        if (token.ownerUid && clean(token.ownerUid) === clean(current.uid)) return true;
        if (token.playerId && clean(token.playerId) === clean(current.playerId)) return true;
        return false;
    }

    function createResolver({ isDm = false, root = browserRoot } = {}) {
        return (token) => {
            if (!token || token.draggable === false) return false;
            if (isDm) return true;
            return canPlayerControl(token, identity(root));
        };
    }

    return Object.freeze({ hostWindow, identity, isCurrentPlayerToken, canPlayerControl, createResolver });
});
