(function (root, factory) {
    const api = factory();
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (root) root.LuminousVttTopology = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
    'use strict';

    const TYPES = Object.freeze({
        WALL: 'wall',
        DOOR: 'door',
        WINDOW: 'window',
        CURTAIN_WINDOW: 'curtain_window',
    });

    const STATES = Object.freeze({
        OPEN: 'open',
        CLOSED: 'closed',
        LOCKED: 'locked',
        BROKEN: 'broken',
    });

    const DEFAULT_THRESHOLDS = Object.freeze({
        [TYPES.DOOR]: Object.freeze({ lockpick: 15, break: 15 }),
        [TYPES.WINDOW]: Object.freeze({ lockpick: 12, break: 10 }),
        [TYPES.CURTAIN_WINDOW]: Object.freeze({ lockpick: 12, break: 10 }),
    });

    const numberOr = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
    const clampInteger = (value, fallback = 0) => Math.max(0, Math.trunc(numberOr(value, fallback)));

    function elementLayers(element = {}) {
        if (Array.isArray(element.z)) return element.z.map(Number);
        if (Number.isFinite(Number(element.z))) return [Number(element.z)];
        return [0];
    }

    function elementOnLayer(element, zLayer) {
        return elementLayers(element).includes(Number(zLayer));
    }

    function defaultThresholds(type) {
        const values = DEFAULT_THRESHOLDS[type] || {};
        return {
            lockpick: clampInteger(values.lockpick, 0),
            break: clampInteger(values.break, 0),
        };
    }

    function normalizeState(type, state) {
        if (type === TYPES.WALL) return null;
        const normalized = String(state || STATES.CLOSED).toLowerCase();
        return Object.values(STATES).includes(normalized) ? normalized : STATES.CLOSED;
    }

    function normalizeVertex(vertex = {}) {
        return {
            col: Math.max(0, Math.trunc(numberOr(vertex.col, 0))),
            row: Math.max(0, Math.trunc(numberOr(vertex.row, 0))),
        };
    }

    function normalizeElement(element = {}) {
        const type = Object.values(TYPES).includes(element.type) ? element.type : TYPES.WALL;
        const defaults = defaultThresholds(type);
        return {
            ...element,
            id: String(element.id || ''),
            type,
            from: normalizeVertex(element.from),
            to: normalizeVertex(element.to),
            z: elementLayers(element),
            state: normalizeState(type, element.state),
            thresholds: type === TYPES.WALL ? undefined : {
                lockpick: clampInteger(element.thresholds?.lockpick, defaults.lockpick),
                break: clampInteger(element.thresholds?.break, defaults.break),
            },
        };
    }

    function vertexToPoint(vertex, grid = {}) {
        const size = Math.max(1, numberOr(grid.size, 70));
        return {
            x: numberOr(vertex?.col) * size,
            y: numberOr(vertex?.row) * size,
        };
    }

    function segment(element, grid = {}) {
        const normalized = normalizeElement(element);
        const a = vertexToPoint(normalized.from, grid);
        const b = vertexToPoint(normalized.to, grid);
        return {
            id: normalized.id,
            type: normalized.type,
            state: normalized.state,
            x1: a.x,
            y1: a.y,
            x2: b.x,
            y2: b.y,
            z: normalized.z,
            element: normalized,
        };
    }

    function effectiveFlags(element = {}) {
        const normalized = normalizeElement(element);
        const { type, state } = normalized;

        if (type === TYPES.WALL) return { blocksMovement: true, blocksVision: true };
        if (state === STATES.OPEN || state === STATES.BROKEN) {
            return { blocksMovement: false, blocksVision: false };
        }
        if (type === TYPES.WINDOW) {
            return { blocksMovement: true, blocksVision: false };
        }
        return { blocksMovement: true, blocksVision: true };
    }

    function blockingSegments(elements, kind, zLayer, grid) {
        const flag = kind === 'vision' ? 'blocksVision' : 'blocksMovement';
        return (Array.isArray(elements) ? elements : [])
            .map(normalizeElement)
            .filter((element) => elementOnLayer(element, zLayer) && effectiveFlags(element)[flag])
            .map((element) => ({ ...segment(element, grid), ...effectiveFlags(element) }));
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
        return Math.hypot(px - (ax + (abx * t)), py - (ay + (aby * t)));
    }

    function hitTest(elements, point, grid, zLayer, tolerancePx) {
        const size = Math.max(1, numberOr(grid?.size, 70));
        const tolerance = Math.max(4, numberOr(tolerancePx, size * 0.16));
        const list = Array.isArray(elements) ? elements : [];
        let best = null;
        let bestDistance = Infinity;

        for (const raw of list) {
            const element = normalizeElement(raw);
            if (!elementOnLayer(element, zLayer)) continue;
            const line = segment(element, grid);
            const distance = pointToSegmentDistance(
                point,
                { x: line.x1, y: line.y1 },
                { x: line.x2, y: line.y2 },
            );
            if (distance <= tolerance && distance < bestDistance) {
                best = raw;
                bestDistance = distance;
            }
        }
        return best;
    }

    function snapPointToVertex(point, grid = {}) {
        const size = Math.max(1, numberOr(grid.size, 70));
        const cols = Math.max(1, Math.trunc(numberOr(grid.cols, 1)));
        const rows = Math.max(1, Math.trunc(numberOr(grid.rows, 1)));
        return {
            col: Math.max(0, Math.min(cols, Math.round(numberOr(point?.x) / size))),
            row: Math.max(0, Math.min(rows, Math.round(numberOr(point?.y) / size))),
        };
    }

    function sameVertex(a, b) {
        return Number(a?.col) === Number(b?.col) && Number(a?.row) === Number(b?.row);
    }

    function directActions(element = {}) {
        const normalized = normalizeElement(element);
        if (normalized.type === TYPES.WALL || normalized.state === STATES.BROKEN) return [];
        if (normalized.state === STATES.OPEN) return ['close'];
        if (normalized.state === STATES.CLOSED) return ['open'];
        return [];
    }

    function checkDescriptor(element = {}, method) {
        const normalized = normalizeElement(element);
        if (normalized.type === TYPES.WALL || normalized.state !== STATES.LOCKED) return null;

        if (method === 'lockpick') {
            return {
                method,
                action: 'unlock',
                threshold: normalized.thresholds.lockpick,
                requiredItem: 'lockpick',
                rollSpec: {
                    kind: 'skill',
                    abilityId: 'dex',
                    skillId: 'sleight_of_hand',
                    label: 'Sleight of Hand',
                },
            };
        }
        if (method === 'strength') {
            return {
                method,
                action: 'break',
                threshold: normalized.thresholds.break,
                requiredItem: null,
                rollSpec: {
                    kind: 'ability',
                    abilityId: 'str',
                    skillId: null,
                    label: 'STRENGTH',
                },
            };
        }
        if (method === 'athletics') {
            return {
                method,
                action: 'break',
                threshold: normalized.thresholds.break,
                requiredItem: null,
                rollSpec: {
                    kind: 'skill',
                    abilityId: 'str',
                    skillId: 'athletics',
                    label: 'Athletics',
                },
            };
        }
        return null;
    }

    function applyAction(element = {}, action) {
        const normalized = normalizeElement(element);
        if (normalized.type === TYPES.WALL) return { valid: false, reason: 'NOT_INTERACTIVE', element: normalized };

        if (action === 'open' && normalized.state === STATES.CLOSED) {
            return { valid: true, reason: null, element: { ...normalized, state: STATES.OPEN } };
        }
        if (action === 'close' && normalized.state === STATES.OPEN) {
            return { valid: true, reason: null, element: { ...normalized, state: STATES.CLOSED } };
        }
        if (action === 'unlock' && normalized.state === STATES.LOCKED) {
            return { valid: true, reason: null, element: { ...normalized, state: STATES.OPEN } };
        }
        if (action === 'break' && normalized.state === STATES.LOCKED) {
            return { valid: true, reason: null, element: { ...normalized, state: STATES.BROKEN } };
        }
        return { valid: false, reason: 'INVALID_STATE_TRANSITION', element: normalized };
    }

    function createElement({ id, type, from, to, zLayer = 0 } = {}) {
        const normalizedType = Object.values(TYPES).includes(type) ? type : TYPES.WALL;
        return normalizeElement({
            id: id || `topology_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
            type: normalizedType,
            from,
            to,
            z: [Number(zLayer) || 0],
            state: normalizedType === TYPES.WALL ? null : STATES.CLOSED,
            thresholds: defaultThresholds(normalizedType),
        });
    }

    return Object.freeze({
        TYPES,
        STATES,
        DEFAULT_THRESHOLDS,
        elementLayers,
        elementOnLayer,
        defaultThresholds,
        normalizeElement,
        vertexToPoint,
        segment,
        effectiveFlags,
        blockingSegments,
        pointToSegmentDistance,
        hitTest,
        snapPointToVertex,
        sameVertex,
        directActions,
        checkDescriptor,
        applyAction,
        createElement,
    });
});
