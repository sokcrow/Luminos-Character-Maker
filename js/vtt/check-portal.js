(function (root, factory) {
    const api = factory(root);
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (root) root.LuminousVttCheckPortal = api;
})(typeof window !== 'undefined' ? window : globalThis, function (browserRoot) {
    'use strict';

    const PORTAL_ID = 'vtt-check-portal';
    const STYLE_ID = 'vtt-check-portal-style';
    const MOVABLE_SELECTOR = [
        '#theatre-check-command-prompt',
        '#theatre-check-player-notice',
        '.theatre-check-hud',
        '.theatre-roll-result-card',
        '.theatre-check-dm-toast',
        '.dm-npc-roll-hud',
    ].join(',');

    function hostWindow(root = browserRoot) {
        try {
            if (root?.parent && root.parent !== root && root.parent.document) return root.parent;
        } catch (_) {}
        return root;
    }

    function hostDocument(root = browserRoot) {
        return hostWindow(root)?.document || null;
    }

    function isDm(root = browserRoot) {
        return Boolean(hostDocument(root)?.body?.classList?.contains('on-game-dashboard'));
    }

    function mapIsActive(root = browserRoot) {
        const doc = hostDocument(root);
        if (!doc) return false;
        if (isDm(root)) return Boolean(doc.getElementById('modulo-mapa')?.classList?.contains('active-module'));
        return Boolean(doc.body?.classList?.contains('player-instance-map'));
    }

    function theatreRoot(root = browserRoot) {
        const doc = hostDocument(root);
        if (!doc) return null;
        if (isDm(root)) return doc.querySelector('#modulo-teatro .stage-view-wrapper') || doc.getElementById('modulo-teatro');
        return doc.getElementById('theatre-view-player');
    }

    function ensurePortal(root = browserRoot) {
        const doc = hostDocument(root);
        if (!doc?.body) return null;
        let style = doc.getElementById(STYLE_ID);
        if (!style) {
            style = doc.createElement('style');
            style.id = STYLE_ID;
            style.textContent = `
#${PORTAL_ID} { position: fixed; inset: 0; z-index: 40000; pointer-events: none; display: none; }
#${PORTAL_ID}.is-active { display: block; }
#${PORTAL_ID} > * { pointer-events: auto; }
#${PORTAL_ID} .theatre-check-command-prompt,
#${PORTAL_ID} #theatre-check-command-prompt,
#${PORTAL_ID} #theatre-check-player-notice { position: fixed !important; left: 50% !important; top: 50% !important; transform: translate(-50%, -50%) !important; z-index: 40010 !important; }
#${PORTAL_ID} .theatre-check-hud,
#${PORTAL_ID} .theatre-roll-result-card,
#${PORTAL_ID} .dm-npc-roll-hud { z-index: 40020 !important; }
`;
            doc.head?.appendChild(style);
        }
        let portal = doc.getElementById(PORTAL_ID);
        if (!portal) {
            portal = doc.createElement('div');
            portal.id = PORTAL_ID;
            portal.setAttribute('aria-live', 'polite');
            doc.body.appendChild(portal);
        }
        return portal;
    }

    function ensureTheatreFront(root = browserRoot) {
        const doc = hostDocument(root);
        const theatre = theatreRoot(root);
        if (!doc || !theatre) return null;
        let front = theatre.querySelector(':scope > #theatre-check-front-layer');
        if (!front) {
            front = doc.createElement('div');
            front.id = 'theatre-check-front-layer';
            front.className = 'theatre-check-front-layer';
            front.setAttribute('aria-live', 'polite');
            theatre.appendChild(front);
        }
        return front;
    }

    function moveEligibleIntoPortal(root = browserRoot) {
        const doc = hostDocument(root);
        const portal = ensurePortal(root);
        if (!doc || !portal) return;
        portal.classList.toggle('is-active', mapIsActive(root));
        if (!mapIsActive(root)) return;

        Array.from(doc.querySelectorAll(MOVABLE_SELECTOR)).forEach((node) => {
            if (node === portal || portal.contains(node)) return;
            portal.appendChild(node);
        });
    }

    function restorePortal(root = browserRoot) {
        const portal = ensurePortal(root);
        if (!portal || mapIsActive(root)) return;
        const front = ensureTheatreFront(root);
        if (!front) return;
        Array.from(portal.children).forEach((node) => front.appendChild(node));
        portal.classList.remove('is-active');
    }

    function start(root = browserRoot) {
        const doc = hostDocument(root);
        if (!doc?.body || typeof MutationObserver === 'undefined') return null;
        ensurePortal(root);
        const sync = () => {
            if (mapIsActive(root)) moveEligibleIntoPortal(root);
            else restorePortal(root);
        };
        const observer = new MutationObserver(sync);
        observer.observe(doc.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'style', 'aria-hidden'] });
        sync();
        return Object.freeze({ stop: () => observer.disconnect(), sync });
    }

    return Object.freeze({
        PORTAL_ID,
        STYLE_ID,
        MOVABLE_SELECTOR,
        hostWindow,
        hostDocument,
        isDm,
        mapIsActive,
        start,
    });
});
