(function (root, factory) {
    const api = factory(root);
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (root) root.LuminousVttTokenInteraction = api;
})(typeof window !== 'undefined' ? window : globalThis, function (root) {
    'use strict';

    const numberOr = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

    function topologyRuntime() {
        if (root?.LuminousVttTopology) return root.LuminousVttTopology;
        if (typeof require !== 'undefined') {
            try { return require('./topology.js'); } catch (_) {}
        }
        return null;
    }

    function tokenRadius(token = {}, grid = {}) {
        const size = Math.max(1, numberOr(grid.size, 70));
        return Math.max(4, numberOr(token.radius, size * 0.4));
    }

    function tokenLayers(token = {}) {
        if (Array.isArray(token.z)) return token.z;
        if (Number.isFinite(Number(token.z))) return [Number(token.z)];
        if (Number.isFinite(Number(token.zLayer))) return [Number(token.zLayer)];
        return [0];
    }

    function tokenOnLayer(token, zLayer) {
        if (token?.verticalMovement) {
            const fromZ = Number(token.verticalMovement.fromZ);
            const toZ = Number(token.verticalMovement.toZ);
            if (Number(zLayer) === fromZ || Number(zLayer) === toZ) return true;
        }
        return tokenLayers(token).includes(Number(zLayer));
    }

    function tokenContainsPoint(token, point, grid) {
        if (!token || !point) return false;
        const radius = tokenRadius(token, grid);
        const dx = numberOr(point.x) - numberOr(token.x);
        const dy = numberOr(point.y) - numberOr(token.y);
        return (dx * dx) + (dy * dy) <= radius * radius;
    }

    function findDraggableToken(tokens, point, grid, zLayer, canControl = null) {
        const list = Array.isArray(tokens) ? tokens : [];
        for (let i = list.length - 1; i >= 0; i -= 1) {
            const token = list[i];
            if (!token || token.draggable === false || !tokenOnLayer(token, zLayer)) continue;
            if (typeof canControl === 'function' && !canControl(token)) continue;
            if (tokenContainsPoint(token, point, grid)) return token;
        }
        return null;
    }

    function gridBounds(grid = {}) {
        const size = Math.max(1, numberOr(grid.size, 70));
        const cols = Math.max(1, Math.floor(numberOr(grid.cols, 1)));
        const rows = Math.max(1, Math.floor(numberOr(grid.rows, 1)));
        return { size, cols, rows, width: cols * size, height: rows * size };
    }

    function snapPointToGrid(point, grid = {}) {
        const { size, cols, rows } = gridBounds(grid);
        const rawCol = Math.floor(numberOr(point?.x) / size);
        const rawRow = Math.floor(numberOr(point?.y) / size);
        const col = Math.max(0, Math.min(cols - 1, rawCol));
        const row = Math.max(0, Math.min(rows - 1, rawRow));
        return { x: (col + 0.5) * size, y: (row + 0.5) * size, col, row };
    }

    function pointToSegmentDistance(point, a, b) {
        const px = numberOr(point?.x);
        const py = numberOr(point?.y);
        const ax = numberOr(a?.x);
        const ay = numberOr(a?.y);
        const bx = numberOr(b?.x);
        const by = numberOr(b?.y);
        const abx = bx - ax;
        const aby = by - ay;
        const lengthSq = (abx * abx) + (aby * aby);
        if (lengthSq === 0) return Math.hypot(px - ax, py - ay);
        const t = Math.max(0, Math.min(1, (((px - ax) * abx) + ((py - ay) * aby)) / lengthSq));
        const closestX = ax + (abx * t);
        const closestY = ay + (aby * t);
        return Math.hypot(px - closestX, py - closestY);
    }

    function movementWalls(mapData = {}, token = {}) {
        const layers = tokenLayers(token);
        const legacy = (Array.isArray(mapData.walls) ? mapData.walls : []).filter((wall) => {
            if (!wall || !wall.blocksMovement) return false;
            const wallLayers = Array.isArray(wall.z) ? wall.z : [numberOr(wall.z, 0)];
            return wallLayers.some((layer) => layers.includes(Number(layer)));
        });
        const topology = topologyRuntime();
        if (!topology || !Array.isArray(mapData.topology)) return legacy;
        const dynamic = [];
        layers.forEach((layer) => dynamic.push(...topology.blockingSegments(mapData.topology, 'movement', layer, mapData.grid)));
        return [...legacy, ...dynamic];
    }

    function canOccupy(token, point, mapData = {}) {
        const grid = mapData.grid || {};
        const { width, height } = gridBounds(grid);
        const radius = tokenRadius(token, grid);
        const x = numberOr(point?.x);
        const y = numberOr(point?.y);
        if (x - radius < 0 || y - radius < 0 || x + radius > width || y + radius > height) return { valid: false, reason: 'OUT_OF_BOUNDS' };

        for (const wall of movementWalls(mapData, token)) {
            const distance = pointToSegmentDistance({ x, y }, { x: wall.x1, y: wall.y1 }, { x: wall.x2, y: wall.y2 });
            const extraThickness = Math.max(0, numberOr(wall.thicknessPx, 0)) / 2;
            if (distance < radius + extraThickness) return { valid: false, reason: 'BLOCKED_BY_WALL', wall };
        }
        return { valid: true, reason: null };
    }

    function isPathClear(token, from, to, mapData = {}) {
        const grid = mapData.grid || {};
        const radius = tokenRadius(token, grid);
        const dx = numberOr(to?.x) - numberOr(from?.x);
        const dy = numberOr(to?.y) - numberOr(from?.y);
        const distance = Math.hypot(dx, dy);
        const sampleStep = Math.max(4, Math.min(radius * 0.5, numberOr(grid.size, 70) * 0.2));
        const steps = Math.max(1, Math.ceil(distance / sampleStep));
        for (let i = 0; i <= steps; i += 1) {
            const t = i / steps;
            const point = { x: numberOr(from?.x) + (dx * t), y: numberOr(from?.y) + (dy * t) };
            const occupancy = canOccupy(token, point, mapData);
            if (!occupancy.valid) return occupancy;
        }
        return { valid: true, reason: null };
    }

    function resolveDrop(token, from, worldPoint, mapData = {}) {
        if (!token || !mapData.grid) return { valid: false, reason: 'INVALID_INPUT' };
        const { width, height } = gridBounds(mapData.grid);
        const requestedX = numberOr(worldPoint?.x, NaN);
        const requestedY = numberOr(worldPoint?.y, NaN);
        if (!Number.isFinite(requestedX) || !Number.isFinite(requestedY)) return { valid: false, reason: 'INVALID_INPUT' };
        if (requestedX < 0 || requestedY < 0 || requestedX >= width || requestedY >= height) return { valid: false, reason: 'OUT_OF_BOUNDS' };
        const snapped = snapPointToGrid({ x: requestedX, y: requestedY }, mapData.grid);
        const destination = canOccupy(token, snapped, mapData);
        if (!destination.valid) return { ...snapped, ...destination };
        const path = isPathClear(token, from, snapped, mapData);
        if (!path.valid) return { ...snapped, ...path };
        return { ...snapped, valid: true, reason: null };
    }

    return Object.freeze({
        tokenRadius, tokenOnLayer, tokenContainsPoint, findDraggableToken, gridBounds, snapPointToGrid,
        pointToSegmentDistance, movementWalls, canOccupy, isPathClear, resolveDrop,
    });
});
