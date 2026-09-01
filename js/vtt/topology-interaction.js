(function (root, factory) {
    const topology = root?.LuminousVttTopology || (typeof require !== 'undefined' ? require('./topology.js') : null);
    const api = factory(topology);
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (root) root.LuminousVttTopologyInteraction = api;
})(typeof window !== 'undefined' ? window : globalThis, function (topology) {
    'use strict';

    const ACTION_ICONS = Object.freeze({
        open: '↗', close: '↙', lock: '⌾', unlock: '⌁', pick_lock: '⌘', force: '✦', attack: '⚔', inspect: '◉',
        open_curtain: '◐', close_curtain: '◑', next_page: '›', prev_page: '‹',
    });
    const TYPE_LABELS = Object.freeze({ door: 'PUERTA', window: 'VENTANA', curtain_window: 'VENTANA CON CORTINA' });
    const REASONS = Object.freeze({
        OUT_OF_RANGE: 'Debes estar a 5 ft o menos.',
        LINE_BLOCKED: 'No tienes acceso físico hasta ese punto.',
        LOCKED: 'Está cerrada con seguro.',
        JAMMED: 'Está atascada. Requiere una prueba de Fuerza.',
        ALREADY_OPEN: 'Ya está abierta.',
        ALREADY_CLOSED: 'Ya está cerrada.',
        ALREADY_LOCKED: 'Ya tiene el seguro puesto.',
        ALREADY_UNLOCKED: 'El seguro ya está quitado.',
        MUST_CLOSE_FIRST: 'Debes cerrarla antes de poner el seguro.',
        WRONG_LOCK_SIDE: 'El seguro no se manipula desde este lado.',
        KEY_REQUIRED: 'Necesitas la llave correcta.',
        LOCK_BROKEN: 'El mecanismo de seguro está roto.',
        DESTROYED: 'La estructura fue destruida.',
        NO_LOCKPICK: 'Necesitas una Ganzúa.',
        CURTAIN_INTERIOR_ONLY: 'La cortina sólo se manipula desde el interior.',
        CURTAIN_ALREADY_OPEN: 'La cortina ya está abierta.',
        CURTAIN_ALREADY_CLOSED: 'La cortina ya está cerrada.',
        BLOCKED_BY_OCCUPANT: 'Algo impide cerrarla.',
    });

    const numberOr = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
    const layerOf = (token = {}) => Number(token.zLayer ?? (Array.isArray(token.z) ? token.z[0] : token.z) ?? 0) || 0;

    function tokenRadiusPx(token = {}, grid = {}) {
        const direct = numberOr(token.radius, NaN);
        if (Number.isFinite(direct) && direct > 0) return direct;
        const size = Math.max(1, numberOr(grid.size, 70));
        const tokenSize = Math.max(0.25, numberOr(token.size ?? token.scale, 1));
        return (size * tokenSize) / 2;
    }

    function distanceToElementFt(token = {}, element = {}, grid = {}) {
        if (!topology) return Infinity;
        const line = topology.segment(element, grid);
        const centerDistancePx = topology.pointToSegmentDistance(
            { x: numberOr(token.x), y: numberOr(token.y) },
            { x: line.x1, y: line.y1 }, { x: line.x2, y: line.y2 },
        );
        const surfaceDistancePx = Math.max(0, centerDistancePx - tokenRadiusPx(token, grid));
        const feetPerCell = Math.max(0.001, numberOr(grid.distancePerCell, 5));
        const size = Math.max(1, numberOr(grid.size, 70));
        return (surfaceDistancePx / size) * feetPerCell;
    }

    function sideOfElement(token = {}, element = {}, grid = {}) {
        const line = topology.segment(element, grid);
        const dx = line.x2 - line.x1;
        const dy = line.y2 - line.y1;
        const cross = (dx * (numberOr(token.y) - line.y1)) - (dy * (numberOr(token.x) - line.x1));
        return cross >= 0 ? 'left' : 'right';
    }

    function midpoint(element = {}, grid = {}) {
        const line = topology.segment(element, grid);
        return { x: (line.x1 + line.x2) / 2, y: (line.y1 + line.y2) / 2 };
    }

    function orientation(a, b, c) {
        const value = ((b.y - a.y) * (c.x - b.x)) - ((b.x - a.x) * (c.y - b.y));
        if (Math.abs(value) < 1e-8) return 0;
        return value > 0 ? 1 : 2;
    }

    function onSegment(a, b, c) {
        return b.x <= Math.max(a.x, c.x) + 1e-8 && b.x + 1e-8 >= Math.min(a.x, c.x)
            && b.y <= Math.max(a.y, c.y) + 1e-8 && b.y + 1e-8 >= Math.min(a.y, c.y);
    }

    function segmentsIntersect(p1, q1, p2, q2) {
        const o1 = orientation(p1, q1, p2); const o2 = orientation(p1, q1, q2);
        const o3 = orientation(p2, q2, p1); const o4 = orientation(p2, q2, q1);
        if (o1 !== o2 && o3 !== o4) return true;
        if (o1 === 0 && onSegment(p1, p2, q1)) return true;
        if (o2 === 0 && onSegment(p1, q2, q1)) return true;
        if (o3 === 0 && onSegment(p2, p1, q2)) return true;
        if (o4 === 0 && onSegment(p2, q1, q2)) return true;
        return false;
    }

    function lineOfInteractionClear(token = {}, element = {}, mapData = {}) {
        if (!topology) return false;
        const grid = mapData.grid || {};
        const start = { x: numberOr(token.x), y: numberOr(token.y) };
        const end = midpoint(element, grid);
        const zLayer = layerOf(token);
        for (const raw of mapData.topology || []) {
            if (!raw || String(raw.id) === String(element.id)) continue;
            const other = topology.normalizeElement(raw);
            if (!topology.elementOnLayer(other, zLayer) || !topology.effectiveFlags(other).blocksMovement) continue;
            const line = topology.segment(other, grid);
            if (segmentsIntersect(start, end, { x: line.x1, y: line.y1 }, { x: line.x2, y: line.y2 })) return false;
        }
        return true;
    }

    function isInteriorSide(element, side) {
        return String(element.interaction?.interiorSide || 'left') === String(side);
    }

    function canUseLockFromSide(element, side, hasKey) {
        const lockSide = element.interaction?.lockSide || 'interior';
        const interior = isInteriorSide(element, side);
        if (lockSide === 'both') return true;
        if (lockSide === 'left' || lockSide === 'right') return lockSide === side;
        if (lockSide === 'interior') return interior || Boolean(hasKey);
        if (lockSide === 'exterior') return !interior || Boolean(hasKey);
        return Boolean(hasKey);
    }

    function factsFor(rawElement = {}, actorToken = {}, mapData = {}, extras = {}) {
        const element = topology.normalizeElement(rawElement);
        const distanceFt = distanceToElementFt(actorToken, element, mapData.grid || {});
        const side = sideOfElement(actorToken, element, mapData.grid || {});
        const rangeFt = numberOr(element.interaction?.rangeFt, 5);
        const withinRange = distanceFt <= rangeFt + 1e-6;
        const lineClear = withinRange ? lineOfInteractionClear(actorToken, element, mapData) : false;
        return Object.freeze({
            element, actorToken, distanceFt, rangeFt, withinRange, lineClear, side,
            isInterior: isInteriorSide(element, side),
            hasKey: Boolean(extras.hasKey), hasLockpick: Boolean(extras.hasLockpick),
            blockedByOccupant: Boolean(extras.blockedByOccupant),
        });
    }

    function physicalGate(facts) {
        if (!facts.withinRange) return REASONS.OUT_OF_RANGE;
        if (!facts.lineClear) return REASONS.LINE_BLOCKED;
        return null;
    }

    function action(id, label, description, enabled, reason, tone = 'default') {
        return Object.freeze({ id, label, icon: ACTION_ICONS[id] || '•', description, enabled: Boolean(enabled), reason: enabled ? '' : (reason || 'No disponible.'), tone });
    }

    function actionsFor(rawElement = {}, facts = {}) {
        const e = topology.normalizeElement(rawElement);
        const gate = physicalGate(facts);
        const destroyed = e.condition === topology.CONDITIONS.DESTROYED;
        const broken = e.condition === topology.CONDITIONS.BROKEN;
        const jammed = e.condition === topology.CONDITIONS.JAMMED;
        const open = e.openState === topology.OPEN_STATES.OPEN;
        const locked = e.lockState === topology.LOCK_STATES.LOCKED;
        const lockSideOkay = canUseLockFromSide(e, facts.side, facts.hasKey);
        const list = [];

        let openReason = gate || (destroyed ? REASONS.DESTROYED : open ? REASONS.ALREADY_OPEN : locked ? REASONS.LOCKED : jammed ? REASONS.JAMMED : '');
        list.push(action('open', 'ABRIR', 'Abre el paso y actualiza topología, visión y movimiento.', !openReason, openReason));

        let closeReason = gate || (destroyed ? REASONS.DESTROYED : !open ? REASONS.ALREADY_CLOSED : facts.blockedByOccupant ? REASONS.BLOCKED_BY_OCCUPANT : '');
        list.push(action('close', 'CERRAR', 'Cierra físicamente la abertura.', !closeReason, closeReason));

        let lockReason = gate || (destroyed ? REASONS.DESTROYED : broken ? REASONS.LOCK_BROKEN : open ? REASONS.MUST_CLOSE_FIRST : locked ? REASONS.ALREADY_LOCKED : !lockSideOkay ? REASONS.WRONG_LOCK_SIDE : '');
        list.push(action('lock', 'PONER SEGURO', 'Bloquea la abertura desde el mecanismo disponible.', !lockReason, lockReason));

        let unlockReason = gate || (destroyed ? REASONS.DESTROYED : !locked ? REASONS.ALREADY_UNLOCKED : !lockSideOkay ? (e.interaction?.keyId ? REASONS.KEY_REQUIRED : REASONS.WRONG_LOCK_SIDE) : '');
        list.push(action('unlock', 'QUITAR SEGURO', 'Libera el mecanismo sin abrir automáticamente.', !unlockReason, unlockReason));

        if (locked) {
            const lockpickReason = gate || (!facts.hasLockpick ? REASONS.NO_LOCKPICK : broken ? REASONS.LOCK_BROKEN : '');
            list.push(action('pick_lock', 'JUEGO DE MANOS', 'Intenta manipular el seguro con una Ganzúa.', !lockpickReason, lockpickReason));
        }

        const forceReason = gate || (destroyed ? REASONS.DESTROYED : open ? REASONS.ALREADY_OPEN : '');
        list.push(action('force', 'FORZAR', `Prueba de Fuerza · DC ${topology.strengthThreshold(e)} · éxito: +10 daño estructural.`, !forceReason, forceReason, 'force'));

        const attackReason = gate || (destroyed ? REASONS.DESTROYED : '');
        list.push(action('attack', 'ATACAR', 'Envía la estructura como objetivo al sistema de combate.', !attackReason, attackReason, 'danger'));

        list.push(action('inspect', 'INSPECCIONAR', 'Muestra estado físico, Dureza y daño acumulado.', !gate, gate));

        if (e.type === topology.TYPES.CURTAIN_WINDOW) {
            const curtainSideReason = !facts.isInterior ? REASONS.CURTAIN_INTERIOR_ONLY : '';
            const openCurtainReason = gate || curtainSideReason || (e.curtainState === topology.OPEN_STATES.OPEN ? REASONS.CURTAIN_ALREADY_OPEN : '');
            const closeCurtainReason = gate || curtainSideReason || (e.curtainState === topology.OPEN_STATES.CLOSED ? REASONS.CURTAIN_ALREADY_CLOSED : '');
            list.push(action('open_curtain', 'ABRIR CORTINA', 'Retira el bloqueo visual de la cortina.', !openCurtainReason, openCurtainReason));
            list.push(action('close_curtain', 'CERRAR CORTINA', 'Cierra la cortina y bloquea visión.', !closeCurtainReason, closeCurtainReason));
        }
        return list;
    }

    function stateLabel(rawElement = {}) {
        const e = topology.normalizeElement(rawElement);
        if (e.condition === topology.CONDITIONS.DESTROYED) return 'DESTRUIDA';
        const pieces = [e.openState === 'open' ? 'ABIERTA' : 'CERRADA'];
        if (e.lockState === 'locked') pieces.push('SEGURO');
        if (e.condition === 'jammed') pieces.push('ATASCADA');
        if (e.condition === 'broken') pieces.push('ROTA');
        return pieces.join(' · ');
    }

    function inspectText(rawElement = {}) {
        const e = topology.normalizeElement(rawElement);
        const stats = topology.structuralStats(e);
        return `${TYPE_LABELS[e.type] || 'OBJETO'} · ${stateLabel(e)} · DUREZA ${stats.hardness} · DAMAGED ${stats.damaged}/20 · SHIELD ${stats.currentMaxShield}`;
    }

    function goapFacts(rawElement = {}, facts = {}) {
        const e = topology.normalizeElement(rawElement);
        const flags = topology.effectiveFlags(e);
        const stats = topology.structuralStats(e);
        return Object.freeze({
            elementId: e.id, type: e.type, isOpen: e.openState === 'open', isLocked: e.lockState === 'locked',
            isJammed: e.condition === 'jammed', isBroken: e.condition === 'broken', isDestroyed: e.condition === 'destroyed',
            hardness: stats.hardness, damaged: stats.damaged, shield: stats.currentMaxShield, strengthThreshold: stats.strengthThreshold,
            canTraverse: !flags.blocksMovement, distanceFt: numberOr(facts.distanceFt, Infinity), withinRange: Boolean(facts.withinRange),
            interactionSide: facts.side || null, isInterior: Boolean(facts.isInterior),
        });
    }

    return Object.freeze({
        ACTION_ICONS, TYPE_LABELS, REASONS, tokenRadiusPx, distanceToElementFt, sideOfElement, midpoint,
        segmentsIntersect, lineOfInteractionClear, isInteriorSide, canUseLockFromSide, factsFor, actionsFor,
        stateLabel, inspectText, goapFacts,
    });
});
