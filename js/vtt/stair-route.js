(function (root, factory) {
    const api = factory(root);
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (root) root.LuminousVttStairRoute = api;
})(typeof window !== 'undefined' ? window : globalThis, function (root) {
    'use strict';

    const LAYOUTS = Object.freeze(['straight', 'switchback', 'spiral', 'ladder']);
    const numberOr = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

    function spatialRuntime() {
        if (root?.LuminousVttSpatialVision) return root.LuminousVttSpatialVision;
        if (typeof require !== 'undefined') {
            try { return require('./spatial-vision.js'); } catch (_) {}
        }
        return null;
    }

    function feetPerPixel(mapData = {}) {
        const spatial = spatialRuntime();
        if (spatial?.feetPerPixel) return spatial.feetPerPixel(mapData);
        const size = Math.max(1, numberOr(mapData.grid?.size, 70));
        return Math.max(0.001, numberOr(mapData.grid?.distancePerCell, 5)) / size;
    }

    function vertexPoint(vertex = {}, mapData = {}) {
        const spatial = spatialRuntime();
        if (spatial?.vertexToPoint) return spatial.vertexToPoint(vertex, mapData);
        const size = Math.max(1, numberOr(mapData.grid?.size, 70));
        return { x: numberOr(vertex.col) * size, y: numberOr(vertex.row) * size };
    }

    function elevationForLayer(mapData = {}, zLayer) {
        const spatial = spatialRuntime();
        if (spatial?.elevationForLayer) return spatial.elevationForLayer(mapData, zLayer);
        const record = mapData.zLevels?.[String(zLayer)] || mapData.zLevels?.[zLayer];
        if (record && Number.isFinite(Number(record.elevationFt))) return Number(record.elevationFt);
        return Number(zLayer || 0) * numberOr(mapData.defaultZStepFt, 15);
    }

    function portalLayers(portal = {}) {
        const values = Array.isArray(portal.between) ? portal.between : [portal.fromZ ?? 0, portal.toZ ?? 1];
        return [Number(values[0]) || 0, Number(values[1]) || 0];
    }

    function layoutOf(portal = {}) {
        const value = String(portal.layout || 'straight').toLowerCase();
        return LAYOUTS.includes(value) ? value : 'straight';
    }

    function widthFt(portal = {}) {
        return Math.max(2, numberOr(portal.widthFt, 5));
    }

    function withElevation(point, elevationFt, zLayer = null) {
        return { x: numberOr(point.x), y: numberOr(point.y), elevationFt: numberOr(elevationFt), zLayer };
    }

    function perpendicularUnit(a, b) {
        const dx = numberOr(b.x) - numberOr(a.x);
        const dy = numberOr(b.y) - numberOr(a.y);
        const length = Math.hypot(dx, dy) || 1;
        return { x: -dy / length, y: dx / length };
    }

    function buildStraight(portal, mapData, fromZ, toZ) {
        const a = vertexPoint(portal.from, mapData);
        const b = vertexPoint(portal.to, mapData);
        return [
            withElevation(a, elevationForLayer(mapData, fromZ), fromZ),
            withElevation(b, elevationForLayer(mapData, toZ), toZ),
        ];
    }

    function buildSwitchback(portal, mapData, fromZ, toZ) {
        const a = vertexPoint(portal.from, mapData);
        const landingA = vertexPoint(portal.to, mapData);
        const fpp = feetPerPixel(mapData);
        const offsetPx = widthFt(portal) / Math.max(0.001, fpp);
        const normal = perpendicularUnit(a, landingA);
        const landingB = { x: landingA.x + normal.x * offsetPx, y: landingA.y + normal.y * offsetPx };
        const exit = { x: a.x + normal.x * offsetPx, y: a.y + normal.y * offsetPx };
        const low = elevationForLayer(mapData, fromZ);
        const high = elevationForLayer(mapData, toZ);
        const mid = low + ((high - low) / 2);
        return [
            withElevation(a, low, fromZ),
            withElevation(landingA, mid, null),
            withElevation(landingB, mid, null),
            withElevation(exit, high, toZ),
        ];
    }

    function buildSpiral(portal, mapData, fromZ, toZ) {
        const a = vertexPoint(portal.from, mapData);
        const b = vertexPoint(portal.to, mapData);
        const center = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        const fpp = feetPerPixel(mapData);
        const minRadius = (widthFt(portal) / Math.max(0.001, fpp)) / 2;
        let radius = Math.max(minRadius, Math.hypot(a.x - center.x, a.y - center.y));
        if (radius < 1) radius = Math.max(1, minRadius);
        const startAngle = Math.atan2(a.y - center.y, a.x - center.x);
        const low = elevationForLayer(mapData, fromZ);
        const high = elevationForLayer(mapData, toZ);
        const points = [];
        const steps = 12;
        for (let i = 0; i <= steps; i += 1) {
            const t = i / steps;
            const angle = startAngle + (Math.PI * 2 * t);
            points.push(withElevation({
                x: center.x + Math.cos(angle) * radius,
                y: center.y + Math.sin(angle) * radius,
            }, low + ((high - low) * t), i === 0 ? fromZ : i === steps ? toZ : null));
        }
        return points;
    }

    function buildLadder(portal, mapData, fromZ, toZ) {
        const a = vertexPoint(portal.from, mapData);
        const b = vertexPoint(portal.to, mapData);
        const anchor = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        return [
            withElevation(anchor, elevationForLayer(mapData, fromZ), fromZ),
            withElevation(anchor, elevationForLayer(mapData, toZ), toZ),
        ];
    }

    function pointsFor(portal = {}, mapData = {}) {
        if (portal.type !== 'stairs') return [];
        const [fromZ, toZ] = portalLayers(portal);
        const layout = layoutOf(portal);
        if (layout === 'switchback') return buildSwitchback(portal, mapData, fromZ, toZ);
        if (layout === 'spiral') return buildSpiral(portal, mapData, fromZ, toZ);
        if (layout === 'ladder') return buildLadder(portal, mapData, fromZ, toZ);
        return buildStraight(portal, mapData, fromZ, toZ);
    }

    function segmentLengthFt(a, b, mapData = {}) {
        const horizontal = Math.hypot(numberOr(b.x) - numberOr(a.x), numberOr(b.y) - numberOr(a.y)) * feetPerPixel(mapData);
        const vertical = numberOr(b.elevationFt) - numberOr(a.elevationFt);
        return Math.hypot(horizontal, vertical);
    }

    function pathLengthFt(points, mapData = {}) {
        let total = 0;
        for (let i = 1; i < points.length; i += 1) total += segmentLengthFt(points[i - 1], points[i], mapData);
        return total;
    }

    function routeFor(portal = {}, mapData = {}) {
        if (portal.type !== 'stairs') return null;
        const [fromZ, toZ] = portalLayers(portal);
        const points = pointsFor(portal, mapData);
        const layout = layoutOf(portal);
        return {
            id: String(portal.id || ''),
            portalId: String(portal.id || ''),
            layout,
            widthFt: widthFt(portal),
            fromZ,
            toZ,
            points,
            pathLengthFt: pathLengthFt(points, mapData),
            movementMode: layout === 'ladder' ? 'climb' : 'stairs',
            costMultiplier: layout === 'ladder' ? Math.max(1, numberOr(portal.costMultiplier, 2)) : Math.max(1, numberOr(portal.costMultiplier, 1)),
            bidirectional: portal.bidirectional !== false,
        };
    }

    function routeEntryForLayer(route, zLayer) {
        if (!route?.points?.length) return null;
        if (Number(zLayer) === Number(route.fromZ)) return route.points[0];
        if (Number(zLayer) === Number(route.toZ)) return route.points[route.points.length - 1];
        return null;
    }

    function targetLayer(route, fromLayer) {
        if (!route) return null;
        if (Number(fromLayer) === Number(route.fromZ)) return route.toZ;
        if (Number(fromLayer) === Number(route.toZ)) return route.fromZ;
        return null;
    }

    function orderedPoints(route, fromLayer) {
        if (!route?.points) return [];
        return Number(fromLayer) === Number(route.toZ) ? [...route.points].reverse() : [...route.points];
    }

    function pointAtDistance(route, fromLayer, distanceFt, mapData = {}) {
        const points = orderedPoints(route, fromLayer);
        if (!points.length) return null;
        let remaining = Math.max(0, numberOr(distanceFt));
        for (let i = 1; i < points.length; i += 1) {
            const a = points[i - 1];
            const b = points[i];
            const length = segmentLengthFt(a, b, mapData);
            if (remaining <= length || i === points.length - 1) {
                const t = length <= 0 ? 1 : Math.max(0, Math.min(1, remaining / length));
                return {
                    x: a.x + ((b.x - a.x) * t),
                    y: a.y + ((b.y - a.y) * t),
                    elevationFt: a.elevationFt + ((b.elevationFt - a.elevationFt) * t),
                    segmentIndex: i - 1,
                    segmentProgress: t,
                };
            }
            remaining -= length;
        }
        const last = points[points.length - 1];
        return { ...last, segmentIndex: Math.max(0, points.length - 2), segmentProgress: 1 };
    }

    function distanceToEntry(point, route, zLayer) {
        const entry = routeEntryForLayer(route, zLayer);
        if (!entry) return Infinity;
        return Math.hypot(numberOr(point?.x) - entry.x, numberOr(point?.y) - entry.y);
    }

    return Object.freeze({
        LAYOUTS,
        layoutOf,
        widthFt,
        portalLayers,
        pointsFor,
        segmentLengthFt,
        pathLengthFt,
        routeFor,
        routeEntryForLayer,
        targetLayer,
        orderedPoints,
        pointAtDistance,
        distanceToEntry,
    });
});
