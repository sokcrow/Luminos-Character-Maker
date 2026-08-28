(function (root, factory) {
    const api = factory(root);
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (root) root.LuminousVttVerticalMovement = api;
})(typeof window !== 'undefined' ? window : globalThis, function (root) {
    'use strict';

    const numberOr = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

    function routeRuntime() {
        if (root?.LuminousVttStairRoute) return root.LuminousVttStairRoute;
        if (typeof require !== 'undefined') {
            try { return require('./stair-route.js'); } catch (_) {}
        }
        return null;
    }

    function tokenLayer(token = {}) {
        if (Number.isFinite(Number(token.zLayer))) return Number(token.zLayer);
        if (Number.isFinite(Number(token.gridPosition?.z))) return Number(token.gridPosition.z);
        if (Array.isArray(token.z) && token.z.length) return Number(token.z[0]) || 0;
        return 0;
    }

    function transitionCandidates(mapData = {}, zLayer) {
        const routes = routeRuntime();
        if (!routes) return [];
        return (Array.isArray(mapData.verticalPortals) ? mapData.verticalPortals : [])
            .filter((portal) => portal?.type === 'stairs' && portal.state !== 'closed' && portal.allowsMovement !== false)
            .map((portal) => ({ portal, route: routes.routeFor(portal, mapData) }))
            .filter(({ route }) => route && routes.routeEntryForLayer(route, zLayer));
    }

    function findTransitionAtPoint(point, mapData = {}, zLayer, tolerancePx = null) {
        const routes = routeRuntime();
        if (!routes) return null;
        const tolerance = tolerancePx == null ? Math.max(12, numberOr(mapData.grid?.size, 70) * 0.55) : Math.max(1, numberOr(tolerancePx));
        let best = null;
        let bestDistance = Infinity;
        for (const candidate of transitionCandidates(mapData, zLayer)) {
            const distance = routes.distanceToEntry(point, candidate.route, zLayer);
            if (distance <= tolerance && distance < bestDistance) {
                best = candidate;
                bestDistance = distance;
            }
        }
        return best ? { ...best, distancePx: bestDistance } : null;
    }

    function gridPositionForPoint(point = {}, zLayer, mapData = {}) {
        const size = Math.max(1, numberOr(mapData.grid?.size, 70));
        const cols = Math.max(1, Math.trunc(numberOr(mapData.grid?.cols, 1)));
        const rows = Math.max(1, Math.trunc(numberOr(mapData.grid?.rows, 1)));
        const col = Math.max(0, Math.min(cols - 1, Math.floor(numberOr(point.x) / size)));
        const row = Math.max(0, Math.min(rows - 1, Math.floor(numberOr(point.y) / size)));
        return { col, row, z: Number(zLayer) || 0 };
    }

    function hasDedicatedClimbSpeed(token = {}) {
        return Number(token.climbSpeedFt) > 0
            || Number(token.movement?.climbFt) > 0
            || token.movementModes?.climb === true;
    }

    function effectiveMultiplier(route, token = {}) {
        if (route?.movementMode === 'climb' && hasDedicatedClimbSpeed(token)) return 1;
        return Math.max(1, numberOr(route?.costMultiplier, 1));
    }

    function availableMovementFt(token = {}) {
        if (Number.isFinite(Number(token.movementRemainingFt))) return Math.max(0, Number(token.movementRemainingFt));
        return Infinity;
    }

    function applyPoint(token, point, sourceLayer, route, progressFt, costSpentFt, mapData) {
        token.x = point.x;
        token.y = point.y;
        token.elevationFt = point.elevationFt;
        token.verticalMovement = {
            routeId: route.id,
            fromZ: Number(sourceLayer),
            toZ: Number(routeRuntime().targetLayer(route, sourceLayer)),
            progressFt,
            totalFt: route.pathLengthFt,
            costSpentFt,
            layout: route.layout,
            movementMode: route.movementMode,
        };
        token.gridPosition = gridPositionForPoint(point, sourceLayer, mapData);
        token.zLayer = Number(sourceLayer);
        token.z = [Number(sourceLayer)];
    }

    function completeTransition(token, route, sourceLayer, mapData, costSpentFt = 0) {
        const routes = routeRuntime();
        const targetZ = routes.targetLayer(route, sourceLayer);
        const ordered = routes.orderedPoints(route, sourceLayer);
        const exit = ordered[ordered.length - 1];
        token.x = exit.x;
        token.y = exit.y;
        token.elevationFt = exit.elevationFt;
        token.zLayer = Number(targetZ);
        token.z = [Number(targetZ)];
        token.gridPosition = gridPositionForPoint(exit, targetZ, mapData);
        token.lastVerticalTravel = {
            routeId: route.id,
            fromZ: Number(sourceLayer),
            toZ: Number(targetZ),
            pathLengthFt: route.pathLengthFt,
            movementMode: route.movementMode,
            costSpentFt,
        };
        delete token.verticalMovement;
        return { valid: true, complete: true, targetZ, route, token, costSpentFt };
    }

    function traverse(token, candidate, mapData = {}) {
        const routes = routeRuntime();
        if (!routes || !candidate?.route) return { valid: false, reason: 'ROUTE_UNAVAILABLE' };
        const route = candidate.route;
        const sourceLayer = tokenLayer(token);
        const targetZ = routes.targetLayer(route, sourceLayer);
        if (targetZ == null) return { valid: false, reason: 'ROUTE_NOT_ON_LAYER' };
        if (route.bidirectional === false && sourceLayer !== route.fromZ) return { valid: false, reason: 'ONE_WAY_ROUTE' };

        const multiplier = effectiveMultiplier(route, token);
        const totalCostFt = route.pathLengthFt * multiplier;
        const availableFt = availableMovementFt(token);
        if (!Number.isFinite(availableFt)) return completeTransition(token, route, sourceLayer, mapData, totalCostFt);

        const spendFt = Math.min(availableFt, totalCostFt);
        token.movementRemainingFt = Math.max(0, availableFt - spendFt);
        const travelFt = spendFt / multiplier;
        if (travelFt + 1e-9 >= route.pathLengthFt) {
            return completeTransition(token, route, sourceLayer, mapData, spendFt);
        }

        const point = routes.pointAtDistance(route, sourceLayer, travelFt, mapData);
        applyPoint(token, point, sourceLayer, route, travelFt, spendFt, mapData);
        return {
            valid: true,
            complete: false,
            route,
            token,
            targetZ,
            progressFt: travelFt,
            remainingRouteFt: route.pathLengthFt - travelFt,
            costSpentFt: spendFt,
        };
    }

    function transitionOnDrop(token, dropPoint, mapData = {}) {
        const zLayer = tokenLayer(token);
        const candidate = findTransitionAtPoint(dropPoint, mapData, zLayer);
        if (!candidate) return { valid: false, reason: 'NO_VERTICAL_TRANSITION' };
        return traverse(token, candidate, mapData);
    }

    return Object.freeze({
        tokenLayer,
        transitionCandidates,
        findTransitionAtPoint,
        gridPositionForPoint,
        hasDedicatedClimbSpeed,
        effectiveMultiplier,
        availableMovementFt,
        completeTransition,
        traverse,
        transitionOnDrop,
    });
});
