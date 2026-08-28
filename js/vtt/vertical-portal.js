(function (root, factory) {
    const api = factory(root);
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (root) root.LuminousVttVerticalPortal = api;
})(typeof window !== 'undefined' ? window : globalThis, function (root) {
    'use strict';

    const TYPES = Object.freeze(['opening', 'balcony_edge', 'stairs']);
    const LABELS = Object.freeze({
        opening: 'HUECO',
        balcony_edge: 'BALCÓN',
        stairs: 'ESCALERA',
    });

    const numberOr = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
    const clampInt = (value, min, max) => Math.max(min, Math.min(max, Math.trunc(numberOr(value, min))));

    function makeId(type = 'opening') {
        const safeType = TYPES.includes(type) ? type : 'opening';
        const random = Math.random().toString(36).slice(2, 8);
        return `vertical_${safeType}_${Date.now().toString(36)}_${random}`;
    }

    function normalizeVertex(vertex = {}, grid = {}) {
        const maxCol = Math.max(0, Math.trunc(numberOr(grid.cols, 0)));
        const maxRow = Math.max(0, Math.trunc(numberOr(grid.rows, 0)));
        return {
            col: clampInt(vertex.col, 0, maxCol),
            row: clampInt(vertex.row, 0, maxRow),
        };
    }

    function normalizeLayers(value, fallbackFrom = 0, fallbackTo = 1) {
        const raw = Array.isArray(value) ? value.slice(0, 2) : [fallbackFrom, fallbackTo];
        const first = Math.trunc(numberOr(raw[0], fallbackFrom));
        let second = Math.trunc(numberOr(raw[1], fallbackTo));
        if (second === first) second = first + 1;
        return [first, second];
    }

    function normalizePortal(portal = {}, mapData = {}) {
        const type = TYPES.includes(portal.type) ? portal.type : 'opening';
        const between = normalizeLayers(portal.between, portal.fromZ ?? 0, portal.toZ ?? 1);
        return {
            schemaVersion: 1,
            id: String(portal.id || makeId(type)),
            type,
            between,
            from: normalizeVertex(portal.from || portal.a, mapData.grid),
            to: normalizeVertex(portal.to || portal.b, mapData.grid),
            state: portal.state === 'closed' ? 'closed' : 'open',
            blocksVision: portal.blocksVision === true,
            blocksLight: portal.blocksLight === true,
            allowsMovement: portal.allowsMovement != null ? Boolean(portal.allowsMovement) : type === 'stairs',
            movementMode: portal.movementMode || (type === 'stairs' ? 'stairs' : null),
        };
    }

    function createPortal({ type = 'opening', from, to, fromZ = 0, toZ = 1, mapData = {} } = {}) {
        return normalizePortal({
            id: makeId(type),
            type,
            from,
            to,
            between: [fromZ, toZ],
            state: 'open',
            blocksVision: false,
            blocksLight: false,
            allowsMovement: type === 'stairs',
            movementMode: type === 'stairs' ? 'stairs' : null,
        }, mapData);
    }

    function portalLayers(portal = {}) {
        const layers = Array.isArray(portal.between) ? portal.between : [portal.fromZ ?? 0, portal.toZ ?? 0];
        return layers.slice(0, 2).map((value) => Math.trunc(numberOr(value, 0)));
    }

    function portalOnLayer(portal = {}, zLayer) {
        return portalLayers(portal).includes(Number(zLayer));
    }

    function otherLayer(portal = {}, zLayer) {
        const layers = portalLayers(portal);
        const current = Number(zLayer);
        if (layers[0] === current) return layers[1];
        if (layers[1] === current) return layers[0];
        return layers[1];
    }

    function vertexToPoint(vertex = {}, mapData = {}) {
        const spatial = root?.LuminousVttSpatialVision;
        if (spatial?.vertexToPoint) return spatial.vertexToPoint(vertex, mapData);
        const size = Math.max(1, numberOr(mapData.grid?.size, 70));
        return { x: numberOr(vertex.col) * size, y: numberOr(vertex.row) * size };
    }

    function segment(portal = {}, mapData = {}) {
        const normalized = normalizePortal(portal, mapData);
        const a = vertexToPoint(normalized.from, mapData);
        const b = vertexToPoint(normalized.to, mapData);
        return { x1: a.x, y1: a.y, x2: b.x, y2: b.y };
    }

    function pointToSegmentDistance(point, a, b) {
        const px = numberOr(point?.x);
        const py = numberOr(point?.y);
        const ax = numberOr(a?.x);
        const ay = numberOr(a?.y);
        const bx = numberOr(b?.x);
        const by = numberOr(b?.y);
        const dx = bx - ax;
        const dy = by - ay;
        if (dx === 0 && dy === 0) return Math.hypot(px - ax, py - ay);
        const t = Math.max(0, Math.min(1, (((px - ax) * dx) + ((py - ay) * dy)) / ((dx * dx) + (dy * dy))));
        return Math.hypot(px - (ax + (t * dx)), py - (ay + (t * dy)));
    }

    function hitTest(portals, point, mapData = {}, zLayer = 0, tolerancePx = null) {
        const tolerance = tolerancePx == null ? Math.max(8, numberOr(mapData.grid?.size, 70) * 0.14) : Math.max(1, numberOr(tolerancePx, 8));
        let best = null;
        let bestDistance = Infinity;
        for (const raw of Array.isArray(portals) ? portals : []) {
            const portal = normalizePortal(raw, mapData);
            if (!portalOnLayer(portal, zLayer)) continue;
            const line = segment(portal, mapData);
            const distance = pointToSegmentDistance(point, { x: line.x1, y: line.y1 }, { x: line.x2, y: line.y2 });
            if (distance <= tolerance && distance < bestDistance) {
                best = portal;
                bestDistance = distance;
            }
        }
        return best;
    }

    function labelFor(portalOrType) {
        const type = typeof portalOrType === 'string' ? portalOrType : portalOrType?.type;
        return LABELS[type] || 'PORTAL Z';
    }

    return Object.freeze({
        TYPES,
        LABELS,
        normalizeVertex,
        normalizePortal,
        createPortal,
        portalLayers,
        portalOnLayer,
        otherLayer,
        vertexToPoint,
        segment,
        pointToSegmentDistance,
        hitTest,
        labelFor,
    });
});
