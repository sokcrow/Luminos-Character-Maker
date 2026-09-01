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

    const STATES = Object.freeze({ OPEN: 'open', CLOSED: 'closed', LOCKED: 'locked', BROKEN: 'broken' });
    const OPEN_STATES = Object.freeze({ OPEN: 'open', CLOSED: 'closed' });
    const LOCK_STATES = Object.freeze({ LOCKED: 'locked', UNLOCKED: 'unlocked' });
    const CONDITIONS = Object.freeze({ NORMAL: 'normal', JAMMED: 'jammed', BROKEN: 'broken', DESTROYED: 'destroyed' });
    const STRUCTURAL_PROFILES = Object.freeze({ NORMAL: 'normal', THICK: 'thick', REINFORCED: 'reinforced' });
    const INTERACTION_SIDES = Object.freeze({ LEFT: 'left', RIGHT: 'right', BOTH: 'both' });

    const DEFAULT_THRESHOLDS = Object.freeze({
        [TYPES.DOOR]: Object.freeze({ lockpick: 15, break: 15 }),
        [TYPES.WINDOW]: Object.freeze({ lockpick: 12, break: 10 }),
        [TYPES.CURTAIN_WINDOW]: Object.freeze({ lockpick: 12, break: 10 }),
    });
    const DEFAULT_HARDNESS = Object.freeze({
        [TYPES.DOOR]: 1,
        [TYPES.WINDOW]: 0,
        [TYPES.CURTAIN_WINDOW]: 0,
    });

    const numberOr = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
    const clampInteger = (value, fallback = 0, max = Infinity) => Math.max(0, Math.min(max, Math.trunc(numberOr(value, fallback))));
    const clampNumber = (value, min, max, fallback = min) => Math.max(min, Math.min(max, numberOr(value, fallback)));
    const oneOf = (value, allowed, fallback) => allowed.includes(String(value || '').toLowerCase()) ? String(value).toLowerCase() : fallback;

    function elementLayers(element = {}) {
        if (Array.isArray(element.z)) return element.z.map(Number);
        if (Number.isFinite(Number(element.z))) return [Number(element.z)];
        return [0];
    }

    function elementOnLayer(element, zLayer) { return elementLayers(element).includes(Number(zLayer)); }

    function defaultThresholds(type) {
        const values = DEFAULT_THRESHOLDS[type] || {};
        return { lockpick: clampInteger(values.lockpick, 0), break: clampInteger(values.break, 0) };
    }

    function normalizeVertex(vertex = {}) {
        return { col: Math.max(0, Math.trunc(numberOr(vertex.col, 0))), row: Math.max(0, Math.trunc(numberOr(vertex.row, 0))) };
    }

    function legacyAxes(element = {}, type) {
        const legacy = oneOf(element.state, Object.values(STATES), STATES.CLOSED);
        let openState = oneOf(element.openState, Object.values(OPEN_STATES), null);
        let lockState = oneOf(element.lockState, Object.values(LOCK_STATES), null);
        let condition = oneOf(element.condition, Object.values(CONDITIONS), null);
        if (!openState) openState = legacy === STATES.OPEN || legacy === STATES.BROKEN ? OPEN_STATES.OPEN : OPEN_STATES.CLOSED;
        if (!lockState) lockState = legacy === STATES.LOCKED ? LOCK_STATES.LOCKED : LOCK_STATES.UNLOCKED;
        if (!condition) condition = legacy === STATES.BROKEN ? CONDITIONS.BROKEN : CONDITIONS.NORMAL;
        if (condition === CONDITIONS.BROKEN || condition === CONDITIONS.DESTROYED) lockState = LOCK_STATES.UNLOCKED;
        if (condition === CONDITIONS.DESTROYED) openState = OPEN_STATES.OPEN;
        if (type === TYPES.WALL) return { openState: null, lockState: null, condition: null };
        return { openState, lockState, condition };
    }

    function legacyStateFor(element = {}) {
        if (element.type === TYPES.WALL) return null;
        if (element.condition === CONDITIONS.DESTROYED) return STATES.BROKEN;
        if (element.openState === OPEN_STATES.OPEN && element.condition === CONDITIONS.BROKEN) return STATES.BROKEN;
        if (element.openState === OPEN_STATES.OPEN) return STATES.OPEN;
        if (element.lockState === LOCK_STATES.LOCKED) return STATES.LOCKED;
        return STATES.CLOSED;
    }

    function strengthThreshold(element = {}) { return 15 + clampInteger(element.structural?.hardness ?? element.hardness, 0, 10); }

    function structuralStats(element = {}) {
        const structural = element.structural || {};
        const hardness = clampInteger(structural.hardness ?? element.hardness, 0, 10);
        const damaged = clampInteger(structural.damaged ?? element.damaged, 0, 20);
        const profile = oneOf(structural.profile ?? element.structuralProfile, Object.values(STRUCTURAL_PROFILES), STRUCTURAL_PROFILES.NORMAL);
        const hp = clampInteger(structural.hp ?? element.hp, 1, 1);
        const baseShield = 500 * hardness;
        const currentMaxShield = Math.max(0, Math.round(baseShield * (1 - (damaged * 0.05))));
        return { hp, hardness, damaged, profile, baseShield, currentMaxShield, strengthThreshold: 15 + hardness };
    }

    function normalizeStructural(element = {}, type, axes) {
        const raw = element.structural || {};
        let hardnessSource = raw.hardness ?? element.hardness;
        if (hardnessSource == null && element.thresholds?.break != null) hardnessSource = Math.max(0, Number(element.thresholds.break) - 15);
        if (hardnessSource == null) hardnessSource = DEFAULT_HARDNESS[type] ?? 0;
        const hardness = clampInteger(hardnessSource, 0, 10);
        const damaged = clampInteger(raw.damaged ?? element.damaged, 0, 20);
        const profile = oneOf(raw.profile ?? element.structuralProfile, Object.values(STRUCTURAL_PROFILES), STRUCTURAL_PROFILES.NORMAL);
        const hp = axes.condition === CONDITIONS.DESTROYED ? 0 : clampInteger(raw.hp ?? element.hp, 1, 1);
        const currentMaxShield = Math.max(0, Math.round((500 * hardness) * (1 - (damaged * 0.05))));
        const turnDamage = Math.max(0, numberOr(raw.turnDamage, 0));
        const rawRemaining = raw.shieldRemaining;
        const shieldRemaining = rawRemaining != null && Number.isFinite(Number(rawRemaining)) ? clampNumber(rawRemaining, 0, currentMaxShield, currentMaxShield) : null;
        return {
            hp,
            hardness,
            damaged,
            profile,
            turnKey: raw.turnKey == null ? null : String(raw.turnKey),
            turnDamage,
            shieldRemaining,
        };
    }

    function normalizeInteraction(element = {}) {
        const raw = element.interaction || {};
        const interiorSide = oneOf(raw.interiorSide, [INTERACTION_SIDES.LEFT, INTERACTION_SIDES.RIGHT], INTERACTION_SIDES.LEFT);
        const lockSide = oneOf(raw.lockSide, [INTERACTION_SIDES.LEFT, INTERACTION_SIDES.RIGHT, INTERACTION_SIDES.BOTH, 'interior', 'exterior'], 'interior');
        return {
            ...raw,
            rangeFt: clampNumber(raw.rangeFt, 0.5, 30, 5),
            interiorSide,
            lockSide,
            keyId: String(raw.keyId || '').trim() || null,
        };
    }

    function normalizeElement(element = {}) {
        const type = Object.values(TYPES).includes(element.type) ? element.type : TYPES.WALL;
        const defaults = defaultThresholds(type);
        const axes = legacyAxes(element, type);
        const structural = type === TYPES.WALL ? undefined : normalizeStructural(element, type, axes);
        if (structural?.hp === 0) axes.condition = CONDITIONS.DESTROYED;
        if (axes.condition === CONDITIONS.DESTROYED) axes.openState = OPEN_STATES.OPEN;
        if (axes.condition === CONDITIONS.BROKEN || axes.condition === CONDITIONS.DESTROYED) axes.lockState = LOCK_STATES.UNLOCKED;
        const normalized = {
            ...element,
            id: String(element.id || ''),
            type,
            from: normalizeVertex(element.from),
            to: normalizeVertex(element.to),
            z: elementLayers(element),
            openState: axes.openState,
            lockState: axes.lockState,
            condition: axes.condition,
            thicknessFt: type === TYPES.WALL ? Math.max(0.1, numberOr(element.thicknessFt, 0.5)) : Math.max(0, numberOr(element.thicknessFt, 0)),
            thresholds: type === TYPES.WALL ? undefined : {
                lockpick: clampInteger(element.thresholds?.lockpick, defaults.lockpick),
                break: 15 + structural.hardness,
            },
            structural,
            interaction: type === TYPES.WALL ? undefined : normalizeInteraction(element),
            traversable: type === TYPES.WINDOW || type === TYPES.CURTAIN_WINDOW ? element.traversable !== false : true,
            curtainState: type === TYPES.CURTAIN_WINDOW
                ? oneOf(element.curtainState, Object.values(OPEN_STATES), (element.state === STATES.OPEN || element.state === STATES.BROKEN) ? OPEN_STATES.OPEN : OPEN_STATES.CLOSED)
                : undefined,
        };
        normalized.state = legacyStateFor(normalized);
        return normalized;
    }

    function vertexToPoint(vertex, grid = {}) {
        const size = Math.max(1, numberOr(grid.size, 70));
        return { x: numberOr(vertex?.col) * size, y: numberOr(vertex?.row) * size };
    }

    function thicknessPx(element, grid = {}) {
        const normalized = normalizeElement(element);
        const size = Math.max(1, numberOr(grid.size, 70));
        const feetPerCell = Math.max(0.001, numberOr(grid.distancePerCell, 5));
        return (normalized.thicknessFt / feetPerCell) * size;
    }

    function segment(element, grid = {}) {
        const normalized = normalizeElement(element);
        const a = vertexToPoint(normalized.from, grid);
        const b = vertexToPoint(normalized.to, grid);
        return {
            id: normalized.id, type: normalized.type, state: normalized.state,
            x1: a.x, y1: a.y, x2: b.x, y2: b.y, z: normalized.z,
            thicknessFt: normalized.thicknessFt, thicknessPx: thicknessPx(normalized, grid), element: normalized,
        };
    }

    function effectiveFlags(element = {}) {
        const normalized = normalizeElement(element);
        if (normalized.type === TYPES.WALL) return { blocksMovement: true, blocksVision: true };
        if (normalized.condition === CONDITIONS.DESTROYED) return { blocksMovement: false, blocksVision: false };
        const closed = normalized.openState === OPEN_STATES.CLOSED;
        if (normalized.type === TYPES.DOOR) return { blocksMovement: closed, blocksVision: closed };
        if (normalized.type === TYPES.WINDOW) return { blocksMovement: closed || !normalized.traversable, blocksVision: false };
        if (normalized.type === TYPES.CURTAIN_WINDOW) {
            return { blocksMovement: closed || !normalized.traversable, blocksVision: normalized.curtainState === OPEN_STATES.CLOSED };
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
        const px = numberOr(point?.x); const py = numberOr(point?.y);
        const ax = numberOr(a?.x); const ay = numberOr(a?.y);
        const bx = numberOr(b?.x); const by = numberOr(b?.y);
        const abx = bx - ax; const aby = by - ay; const lengthSq = (abx * abx) + (aby * aby);
        if (lengthSq === 0) return Math.hypot(px - ax, py - ay);
        const t = Math.max(0, Math.min(1, (((px - ax) * abx) + ((py - ay) * aby)) / lengthSq));
        return Math.hypot(px - (ax + (abx * t)), py - (ay + (aby * t)));
    }

    function hitTest(elements, point, grid, zLayer, tolerancePx) {
        const size = Math.max(1, numberOr(grid?.size, 70));
        const tolerance = Math.max(4, numberOr(tolerancePx, size * 0.16));
        let best = null; let bestDistance = Infinity;
        for (const raw of Array.isArray(elements) ? elements : []) {
            const element = normalizeElement(raw);
            if (!elementOnLayer(element, zLayer)) continue;
            const line = segment(element, grid);
            const distance = pointToSegmentDistance(point, { x: line.x1, y: line.y1 }, { x: line.x2, y: line.y2 });
            const effectiveTolerance = Math.max(tolerance, line.thicknessPx / 2);
            if (distance <= effectiveTolerance && distance < bestDistance) { best = raw; bestDistance = distance; }
        }
        return best;
    }

    function snapPointToVertex(point, grid = {}) {
        const size = Math.max(1, numberOr(grid.size, 70));
        const cols = Math.max(1, Math.trunc(numberOr(grid.cols, 1)));
        const rows = Math.max(1, Math.trunc(numberOr(grid.rows, 1)));
        return { col: Math.max(0, Math.min(cols, Math.round(numberOr(point?.x) / size))), row: Math.max(0, Math.min(rows, Math.round(numberOr(point?.y) / size))) };
    }

    function axisAlignedVertex(from, candidate) {
        const start = normalizeVertex(from); const target = normalizeVertex(candidate);
        const deltaCol = Math.abs(target.col - start.col); const deltaRow = Math.abs(target.row - start.row);
        return deltaCol >= deltaRow ? { col: target.col, row: start.row } : { col: start.col, row: target.row };
    }

    function sameVertex(a, b) { return Number(a?.col) === Number(b?.col) && Number(a?.row) === Number(b?.row); }

    function canApplyAction(element = {}, action) {
        const e = normalizeElement(element);
        if (e.type === TYPES.WALL) return { valid: false, reason: 'NOT_INTERACTIVE' };
        if (e.condition === CONDITIONS.DESTROYED) return { valid: false, reason: 'DESTROYED' };
        if (action === 'open') {
            if (e.openState === OPEN_STATES.OPEN) return { valid: false, reason: 'ALREADY_OPEN' };
            if (e.lockState === LOCK_STATES.LOCKED) return { valid: false, reason: 'LOCKED' };
            if (e.condition === CONDITIONS.JAMMED) return { valid: false, reason: 'JAMMED' };
            return { valid: true, reason: null };
        }
        if (action === 'close') return e.openState === OPEN_STATES.OPEN ? { valid: true, reason: null } : { valid: false, reason: 'ALREADY_CLOSED' };
        if (action === 'lock') {
            if (e.condition !== CONDITIONS.NORMAL) return { valid: false, reason: 'LOCK_BROKEN' };
            if (e.openState !== OPEN_STATES.CLOSED) return { valid: false, reason: 'MUST_CLOSE_FIRST' };
            return e.lockState === LOCK_STATES.UNLOCKED ? { valid: true, reason: null } : { valid: false, reason: 'ALREADY_LOCKED' };
        }
        if (action === 'unlock') return e.lockState === LOCK_STATES.LOCKED ? { valid: true, reason: null } : { valid: false, reason: 'ALREADY_UNLOCKED' };
        if (action === 'force') return e.openState === OPEN_STATES.CLOSED ? { valid: true, reason: null } : { valid: false, reason: 'ALREADY_OPEN' };
        if (action === 'break') return { valid: true, reason: null };
        if (action === 'open_curtain') return e.type === TYPES.CURTAIN_WINDOW && e.curtainState === OPEN_STATES.CLOSED ? { valid: true, reason: null } : { valid: false, reason: 'CURTAIN_ALREADY_OPEN' };
        if (action === 'close_curtain') return e.type === TYPES.CURTAIN_WINDOW && e.curtainState === OPEN_STATES.OPEN ? { valid: true, reason: null } : { valid: false, reason: 'CURTAIN_ALREADY_CLOSED' };
        return { valid: false, reason: 'UNKNOWN_ACTION' };
    }

    function directActions(element = {}) {
        const e = normalizeElement(element);
        if (e.type === TYPES.WALL || e.condition === CONDITIONS.DESTROYED) return [];
        const actions = [];
        for (const action of ['open', 'close', 'lock', 'unlock']) if (canApplyAction(e, action).valid) actions.push(action);
        return actions;
    }

    function checkDescriptor(element = {}, method) {
        const e = normalizeElement(element);
        if (e.type === TYPES.WALL || e.condition === CONDITIONS.DESTROYED) return null;
        if (method === 'lockpick') {
            if (e.lockState !== LOCK_STATES.LOCKED || e.condition !== CONDITIONS.NORMAL) return null;
            return { method, action: 'unlock', threshold: e.thresholds.lockpick, requiredItem: 'lockpick', rollSpec: { kind: 'skill', abilityId: 'dex', skillId: 'sleight_of_hand', label: 'Sleight of Hand' } };
        }
        if ((method === 'strength' || method === 'athletics') && e.openState === OPEN_STATES.CLOSED) {
            return {
                method, action: 'force', threshold: strengthThreshold(e), requiredItem: null,
                rollSpec: method === 'athletics'
                    ? { kind: 'skill', abilityId: 'str', skillId: 'athletics', label: 'Athletics' }
                    : { kind: 'ability', abilityId: 'str', skillId: null, label: 'STRENGTH' },
            };
        }
        return null;
    }

    function damageMultiplier(element = {}, damageType = '') {
        const e = normalizeElement(element);
        if (e.structural.profile === STRUCTURAL_PROFILES.REINFORCED) return 0.75;
        if (e.structural.profile === STRUCTURAL_PROFILES.NORMAL && String(damageType).toLowerCase() === 'blunt') return 1.5;
        return 1;
    }

    function closeStructuralTurn(element = {}, turnKey = null) {
        const e = normalizeElement(element);
        if (e.type === TYPES.WALL || e.condition === CONDITIONS.DESTROYED) return e;
        const stats = structuralStats(e);
        const sameTurn = turnKey == null || e.structural.turnKey == null || String(e.structural.turnKey) === String(turnKey);
        let damaged = stats.damaged;
        if (sameTurn && stats.currentMaxShield > 0 && e.structural.turnDamage >= stats.currentMaxShield * 0.5) damaged = Math.min(20, damaged + 1);
        return normalizeElement({ ...e, structural: { ...e.structural, damaged, turnKey: null, turnDamage: 0, shieldRemaining: null } });
    }

    function applyStructuralDamage(element = {}, damage = 0, options = {}) {
        let e = normalizeElement(element);
        if (e.type === TYPES.WALL) return { valid: false, reason: 'NOT_STRUCTURAL_TARGET', element: e, damage: 0 };
        if (e.condition === CONDITIONS.DESTROYED) return { valid: false, reason: 'DESTROYED', element: e, damage: 0 };
        const incoming = Math.max(0, numberOr(damage, 0));
        const effectiveDamage = Math.max(0, incoming * damageMultiplier(e, options.damageType));
        if (effectiveDamage <= 0) return { valid: false, reason: 'NO_DAMAGE', element: e, damage: 0 };

        const stats = structuralStats(e);
        const turnKey = options.turnKey == null ? `hit:${Date.now()}` : String(options.turnKey);
        const startsTurn = e.structural.turnKey == null || String(e.structural.turnKey) !== turnKey;
        const shieldStart = startsTurn || e.structural.shieldRemaining == null ? stats.currentMaxShield : e.structural.shieldRemaining;
        const turnDamage = (startsTurn ? 0 : e.structural.turnDamage) + effectiveDamage;
        const shieldRemaining = Math.max(0, shieldStart - effectiveDamage);
        const destroyed = stats.currentMaxShield <= 0 || shieldRemaining <= 0;
        e = normalizeElement({
            ...e,
            openState: destroyed ? OPEN_STATES.OPEN : e.openState,
            lockState: destroyed ? LOCK_STATES.UNLOCKED : e.lockState,
            condition: destroyed ? CONDITIONS.DESTROYED : e.condition,
            structural: {
                ...e.structural,
                hp: destroyed ? 0 : 1,
                turnKey,
                turnDamage,
                shieldRemaining,
            },
        });
        if (!destroyed && options.endTurn === true) e = closeStructuralTurn(e, turnKey);
        return { valid: true, reason: null, element: e, damage: effectiveDamage, destroyed };
    }

    function applyAction(element = {}, action) {
        const e = normalizeElement(element);
        const allowed = canApplyAction(e, action);
        if (!allowed.valid) return { valid: false, reason: allowed.reason, element: e };
        if (action === 'open') return { valid: true, reason: null, element: normalizeElement({ ...e, openState: OPEN_STATES.OPEN }) };
        if (action === 'close') return { valid: true, reason: null, element: normalizeElement({ ...e, openState: OPEN_STATES.CLOSED }) };
        if (action === 'lock') return { valid: true, reason: null, element: normalizeElement({ ...e, lockState: LOCK_STATES.LOCKED }) };
        if (action === 'unlock') return { valid: true, reason: null, element: normalizeElement({ ...e, lockState: LOCK_STATES.UNLOCKED }) };
        if (action === 'open_curtain') return { valid: true, reason: null, element: normalizeElement({ ...e, curtainState: OPEN_STATES.OPEN }) };
        if (action === 'close_curtain') return { valid: true, reason: null, element: normalizeElement({ ...e, curtainState: OPEN_STATES.CLOSED }) };
        if (action === 'force') {
            if (e.condition === CONDITIONS.JAMMED) {
                return { valid: true, reason: null, element: normalizeElement({ ...e, condition: CONDITIONS.BROKEN, lockState: LOCK_STATES.UNLOCKED, openState: OPEN_STATES.OPEN }) };
            }
            const result = applyStructuralDamage(e, 10, { damageType: 'force', turnKey: `force:${Date.now()}` });
            return { valid: result.valid, reason: result.reason, element: result.element };
        }
        if (action === 'break') {
            return { valid: true, reason: null, element: normalizeElement({ ...e, condition: CONDITIONS.BROKEN, lockState: LOCK_STATES.UNLOCKED, openState: OPEN_STATES.OPEN }) };
        }
        return { valid: false, reason: 'UNKNOWN_ACTION', element: e };
    }

    function createElement({ id, type, from, to, zLayer = 0, thicknessFt = 0.5 } = {}) {
        const normalizedType = Object.values(TYPES).includes(type) ? type : TYPES.WALL;
        return normalizeElement({
            id: id || `topology_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
            type: normalizedType, from, to, z: [Number(zLayer) || 0],
            state: normalizedType === TYPES.WALL ? null : STATES.CLOSED,
            thicknessFt: normalizedType === TYPES.WALL ? thicknessFt : 0,
            thresholds: defaultThresholds(normalizedType),
            structural: normalizedType === TYPES.WALL ? undefined : { hp: 1, hardness: DEFAULT_HARDNESS[normalizedType] ?? 0, damaged: 0, profile: STRUCTURAL_PROFILES.NORMAL },
            interaction: normalizedType === TYPES.WALL ? undefined : { rangeFt: 5, interiorSide: INTERACTION_SIDES.LEFT, lockSide: 'interior', keyId: null },
            curtainState: normalizedType === TYPES.CURTAIN_WINDOW ? OPEN_STATES.CLOSED : undefined,
            traversable: normalizedType === TYPES.WINDOW || normalizedType === TYPES.CURTAIN_WINDOW ? true : undefined,
        });
    }

    return Object.freeze({
        TYPES, STATES, OPEN_STATES, LOCK_STATES, CONDITIONS, STRUCTURAL_PROFILES, INTERACTION_SIDES,
        DEFAULT_THRESHOLDS, DEFAULT_HARDNESS, elementLayers, elementOnLayer, defaultThresholds,
        normalizeElement, legacyStateFor, strengthThreshold, structuralStats, damageMultiplier,
        vertexToPoint, thicknessPx, segment, effectiveFlags, blockingSegments,
        pointToSegmentDistance, hitTest, snapPointToVertex, axisAlignedVertex, sameVertex,
        canApplyAction, directActions, checkDescriptor, applyAction, applyStructuralDamage, closeStructuralTurn, createElement,
    });
});
