import { Camera } from './camera.js';
import { Renderer } from './renderer.js';
import { getIntersection } from './math.js';

export class Engine {
    constructor(canvas, mapData) {
        this.canvas = canvas;
        this.mapData = mapData;
        this.camera = new Camera(canvas);
        this.renderer = new Renderer(canvas, mapData);
        this.activeZ = 0;
        this.isRunning = false;
        this.legacyVisionRadius = 400;
        this.isExporting = false;
        this.tokenDrag = null;
        this.tokenControlResolver = null;
        this.tokenMoveResolver = null;
        this.movementInteractionResolver = null;
        this.tokenMotion = null;
        this.handleResize = this.handleResize.bind(this);
        this.handleTokenMouseDown = this.handleTokenMouseDown.bind(this);
        this.handleTokenMouseMove = this.handleTokenMouseMove.bind(this);
        this.handleTokenMouseUp = this.handleTokenMouseUp.bind(this);
        this.loop = this.loop.bind(this);
        this.camera.setDragGuard((event) => !this.tokenAtEvent(event));
        this.init();
    }

    get tokenRules() { return globalThis.LuminousVttTokenInteraction || null; }
    get topologyRules() { return globalThis.LuminousVttTopology || null; }
    get racialSenseRules() { return globalThis.LuminousRacialSenseRuntime || null; }
    get spatialVisionRules() { return globalThis.LuminousVttSpatialVision || null; }
    get verticalMovementRules() { return globalThis.LuminousVttVerticalMovement || null; }
    setTokenControlResolver(resolver) { this.tokenControlResolver = typeof resolver === 'function' ? resolver : null; }
    setTokenMoveResolver(resolver) { this.tokenMoveResolver = typeof resolver === 'function' ? resolver : null; }
    setMovementInteractionResolver(resolver) { this.movementInteractionResolver = typeof resolver === 'function' ? resolver : null; }

    emitSemanticEvent(type, detail = {}, dirty = null) {
        this.canvas.dispatchEvent(new CustomEvent(type, { detail }));
        if (!dirty) return;
        globalThis.LuminousVttSceneDirty?.emit?.(this.canvas, {
            ...dirty,
            sourceEvent: type,
            tokenId: detail?.tokenId ?? dirty.tokenId ?? null,
            meta: detail,
        });
    }

    init() {
        window.addEventListener('resize', this.handleResize);
        this.canvas.addEventListener('mousedown', this.handleTokenMouseDown);
        window.addEventListener('mousemove', this.handleTokenMouseMove);
        window.addEventListener('mouseup', this.handleTokenMouseUp);
        this.handleResize();
        this.centerCamera();
    }

    eventWorldPoint(event) {
        return this.camera.eventToWorld(event);
    }

    tokenAtEvent(event) {
        const rules = this.tokenRules;
        if (!rules) return null;
        return rules.findDraggableToken(this.mapData.tokens, this.eventWorldPoint(event), this.mapData.grid, this.activeZ, this.tokenControlResolver);
    }

    viewerToken() {
        return (this.mapData.tokens || []).find((token) => token.viewer === true)
            || (this.mapData.tokens || []).find((token) => token.draggable !== false)
            || this.mapData.tokens?.[0] || null;
    }

    handleTokenMouseDown(event) {
        if (event.button !== 0 || this.tokenMotion) return;
        const token = this.tokenAtEvent(event);
        if (!token) return;
        const worldPoint = this.eventWorldPoint(event);
        this.tokenDrag = {
            token,
            originX: token.x,
            originY: token.y,
            originZ: Number(token.zLayer ?? token.gridPosition?.z ?? token.z?.[0] ?? 0),
            originElevationFt: Number(token.elevationFt ?? 0),
            grabOffsetX: worldPoint.x - token.x,
            grabOffsetY: worldPoint.y - token.y,
        };
        this.canvas.style.cursor = 'grabbing';
        event.preventDefault();
    }

    handleTokenMouseMove(event) {
        if (!this.tokenDrag) {
            this.canvas.style.cursor = this.tokenAtEvent(event) ? 'grab' : 'default';
            return;
        }
        const worldPoint = this.eventWorldPoint(event);
        const token = this.tokenDrag.token;
        const target = { x: worldPoint.x - this.tokenDrag.grabOffsetX, y: worldPoint.y - this.tokenDrag.grabOffsetY };
        this.canvas.style.cursor = 'grabbing';
        if (this.tokenMoveResolver) {
            const detail = { tokenId: token.id, from: { x: this.tokenDrag.originX, y: this.tokenDrag.originY, z: this.tokenDrag.originZ }, target };
            this.emitSemanticEvent('vtt:movement-destination-preview', detail, {
                reason: 'token', render: true, vision: false, active: true,
            });
            return;
        }
        token.x = target.x;
        token.y = target.y;
        const detail = { tokenId: token.id, x: token.x, y: token.y, z: Number(token.zLayer ?? token.gridPosition?.z ?? token.z?.[0] ?? 0) };
        this.emitSemanticEvent('vtt:token-preview-moved', detail, {
            reason: 'token', render: true, vision: true, active: true,
        });
    }

    async animateTokenPath(token, path = [], options = {}) {
        const points = Array.isArray(path) ? path.filter((point) => Number.isFinite(Number(point?.x)) && Number.isFinite(Number(point?.y))) : [];
        if (!token || points.length < 2) return { valid: true, complete: true };
        const movement = this.mapData.movement || {};
        const mode = String(options.actionMode || token.activeActionMovementMode || 'walk').toLowerCase();
        const defaultMs = mode === 'dash' || mode === 'run' ? 55 : 90;
        const msPerCell = Math.max(20, Number(movement.animationMsPerCell) || defaultMs);
        const gridSize = Math.max(1, Number(this.mapData.grid?.size) || 70);
        const doorInteractions = Array.isArray(options.doorInteractions) ? options.doorInteractions : [];
        const raf = globalThis.requestAnimationFrame || ((fn) => setTimeout(() => fn(Date.now()), 16));
        const caf = globalThis.cancelAnimationFrame || clearTimeout;
        const pause = (ms) => new Promise((resolve) => setTimeout(resolve, Math.max(0, Number(ms) || 0)));
        const motion = { cancelled: false, irreversible: false, frameId: null, tokenId: token.id };
        this.tokenMotion = motion;
        const moveSegment = (from, to) => new Promise((resolve) => {
            const distancePx = Math.hypot(Number(to.x) - Number(from.x), Number(to.y) - Number(from.y));
            const durationMs = Math.max(8, msPerCell * (distancePx / gridSize));
            const startAt = globalThis.performance?.now?.() ?? Date.now();
            const step = (nowValue) => {
                if (motion.cancelled) return resolve(false);
                const elapsed = Math.max(0, Number(nowValue) - startAt);
                const t = Math.min(1, elapsed / durationMs);
                token.x = Number(from.x) + ((Number(to.x) - Number(from.x)) * t);
                token.y = Number(from.y) + ((Number(to.y) - Number(from.y)) * t);
                const detail = { tokenId: token.id, x: token.x, y: token.y, z: Number(token.zLayer ?? token.gridPosition?.z ?? token.z?.[0] ?? 0), traversing: true, actionMode: mode };
                this.emitSemanticEvent('vtt:token-preview-moved', detail, {
                    reason: 'token', render: true, vision: true, active: true,
                });
                if (t >= 1) return resolve(true);
                motion.frameId = raf(step);
            };
            motion.frameId = raf(step);
        });
        try {
            token.x = Number(points[0].x);
            token.y = Number(points[0].y);
            for (let index = 1; index < points.length; index += 1) {
                const segmentEnd = points[index];
                let segmentStart = points[index - 1];
                const interactions = doorInteractions
                    .filter((entry) => Number(entry.pathIndex) === index - 1)
                    .sort((left, right) => {
                        const leftDistance = Math.hypot(Number(left.at?.x ?? segmentStart.x) - Number(segmentStart.x), Number(left.at?.y ?? segmentStart.y) - Number(segmentStart.y));
                        const rightDistance = Math.hypot(Number(right.at?.x ?? segmentStart.x) - Number(segmentStart.x), Number(right.at?.y ?? segmentStart.y) - Number(segmentStart.y));
                        return leftDistance - rightDistance;
                    });
                for (const interaction of interactions) {
                    const threshold = Number.isFinite(Number(interaction.at?.x)) && Number.isFinite(Number(interaction.at?.y))
                        ? { x: Number(interaction.at.x), y: Number(interaction.at.y) }
                        : { x: Number(segmentStart.x), y: Number(segmentStart.y) };
                    if (Math.hypot(threshold.x - Number(segmentStart.x), threshold.y - Number(segmentStart.y)) > 0.01) {
                        const reachedThreshold = await moveSegment(segmentStart, threshold);
                        if (!reachedThreshold) return { valid: false, reason: 'MOVEMENT_CANCELLED', complete: false };
                    }
                    if (motion.cancelled) return { valid: false, reason: 'MOVEMENT_CANCELLED', complete: false };
                    let resolvedInteraction = interaction;
                    if (this.movementInteractionResolver) {
                        let resolution = null;
                        try {
                            resolution = await this.movementInteractionResolver({ token, interaction, at: threshold, from: segmentStart, to: segmentEnd, actionMode: mode });
                        } catch (error) {
                            resolution = { valid: false, reason: error?.message || 'MOVEMENT_INTERACTION_FAILED' };
                        }
                        if (resolution === false || resolution?.valid === false) {
                            return { valid: false, reason: resolution?.reason || 'MOVEMENT_INTERACTION_FAILED', complete: false, interaction };
                        }
                        if (resolution?.interaction && typeof resolution.interaction === 'object') {
                            resolvedInteraction = { ...interaction, ...resolution.interaction };
                        }
                        if (resolution?.irreversible === true) motion.irreversible = true;
                    }
                    const interactionDetail = { tokenId: token.id, x: token.x, y: token.y, actionMode: mode, ...resolvedInteraction };
                    this.emitSemanticEvent('vtt:movement-interaction', interactionDetail, {
                        reason: 'topology', render: true, vision: true, active: false,
                    });
                    if (resolvedInteraction.soundEvent) {
                        this.canvas.dispatchEvent(new CustomEvent('vtt:sound-event', {
                            detail: {
                                kind: 'movement',
                                event: resolvedInteraction.soundEvent,
                                sourceTokenId: token.id,
                                doorId: resolvedInteraction.doorId || null,
                                intensity: resolvedInteraction.noise || 'high',
                                x: token.x,
                                y: token.y,
                                z: Number(token.zLayer ?? token.gridPosition?.z ?? token.z?.[0] ?? 0),
                            },
                        }));
                    }
                    if (resolvedInteraction.pauseMs) await pause(resolvedInteraction.pauseMs);
                    if (motion.cancelled) return { valid: false, reason: 'MOVEMENT_CANCELLED', complete: false };
                    segmentStart = threshold;
                }
                const complete = await moveSegment(segmentStart, segmentEnd);
                if (!complete) return { valid: false, reason: 'MOVEMENT_CANCELLED', complete: false };
            }
            return { valid: true, complete: true, irreversible: motion.irreversible };
        } finally {
            if (motion.frameId != null && motion.cancelled) caf(motion.frameId);
            if (this.tokenMotion === motion) this.tokenMotion = null;
        }
    }

    cancelTokenMotion() {
        if (!this.tokenMotion) return false;
        this.tokenMotion.cancelled = true;
        return true;
    }

    async handleTokenMouseUp(event) {
        if (!this.tokenDrag || event.button !== 0) return;
        const drag = this.tokenDrag;
        const token = drag.token;
        const worldPoint = this.eventWorldPoint(event);
        const requestedPoint = { x: worldPoint.x - drag.grabOffsetX, y: worldPoint.y - drag.grabOffsetY };
        this.tokenDrag = null;
        if (this.tokenMoveResolver) {
            let result = null;
            try {
                result = await this.tokenMoveResolver({ token, from: { x: drag.originX, y: drag.originY }, requestedPoint, drag, event });
            } catch (error) {
                result = { valid: false, reason: error?.message || 'MOVEMENT_RESOLVER_FAILED' };
            }
            if (result?.valid) {
                const traversed = await this.animateTokenPath(token, result.path || [], { actionMode: result.actionMode, doorInteractions: result.doorInteractions });
                if (traversed.valid) this.finalizeTokenMove(token, drag, result);
            } else {
                token.x = drag.originX;
                token.y = drag.originY;
                token.zLayer = drag.originZ;
                token.z = [drag.originZ];
                token.elevationFt = drag.originElevationFt;
                this.canvas.dispatchEvent(new CustomEvent('vtt:movement-order-rejected', { detail: { tokenId: token.id, reason: result?.reason || 'NO_PATH', requestedPoint } }));
            }
            this.canvas.style.cursor = this.tokenAtEvent(event) ? 'grab' : 'default';
            return;
        }
        const rules = this.tokenRules;
        const result = rules?.resolveDrop?.(token, { x: drag.originX, y: drag.originY }, requestedPoint, this.mapData) || { valid: false, reason: 'TOKEN_RULES_UNAVAILABLE' };
        if (result.valid) {
            token.x = result.x;
            token.y = result.y;
            this.finalizeTokenMove(token, drag, result);
        } else {
            token.x = drag.originX;
            token.y = drag.originY;
            token.zLayer = drag.originZ;
            token.z = [drag.originZ];
            token.elevationFt = drag.originElevationFt;
            const detail = { tokenId: token.id, x: token.x, y: token.y, z: drag.originZ, reverted: true };
            this.emitSemanticEvent('vtt:token-preview-moved', detail, {
                reason: 'token', render: true, vision: true, active: true,
            });
        }
        this.canvas.style.cursor = this.tokenAtEvent(event) ? 'grab' : 'default';
    }

    finalizeTokenMove(token, drag, result = {}) {
        const endpoint = (Array.isArray(result.path) && result.path.length ? result.path[result.path.length - 1] : result);
        token.x = Number(endpoint.x);
        token.y = Number(endpoint.y);
        const zLayer = this.spatialVisionRules?.layerOf?.(token) ?? token.z?.[0] ?? drag.originZ ?? 0;
        token.zLayer = Number(zLayer) || 0;
        token.z = [token.zLayer];
        token.gridPosition = {
            col: Number.isFinite(Number(endpoint.col)) ? Number(endpoint.col) : this.tokenRules?.snapPointToGrid?.(token, this.mapData.grid)?.col ?? token.gridPosition?.col ?? 0,
            row: Number.isFinite(Number(endpoint.row)) ? Number(endpoint.row) : this.tokenRules?.snapPointToGrid?.(token, this.mapData.grid)?.row ?? token.gridPosition?.row ?? 0,
            z: token.zLayer,
        };
        const transition = this.verticalMovementRules?.transitionOnDrop?.(token, { x: token.x, y: token.y }, this.mapData) || { valid: false, reason: 'NO_VERTICAL_TRANSITION' };
        if (transition.valid && transition.complete && token.viewer === true) this.setZLayer(transition.targetZ);
        const moveDetail = {
            tokenId: token.id,
            from: { x: drag.originX, y: drag.originY, z: drag.originZ, elevationFt: drag.originElevationFt },
            to: { x: token.x, y: token.y, ...token.gridPosition, elevationFt: token.elevationFt ?? 0, verticalMovement: token.verticalMovement || null },
            path: Array.isArray(result.path) ? result.path : [],
            routeCostFt: result.routeCostFt ?? result.costFt ?? null,
            movementCostFt: result.movementCostFt ?? result.costFt ?? null,
            movementMode: result.movementMode || result.mode || null,
            actionMode: result.actionMode || null,
            transition: transition.valid ? { routeId: transition.route?.id || null, complete: Boolean(transition.complete), targetZ: transition.targetZ, costSpentFt: transition.costSpentFt ?? null } : null,
        };
        this.emitSemanticEvent('vtt:token-moved', moveDetail, {
            reason: 'token', render: true, vision: true, active: false,
        });
        if (result.stopAtDoor) {
            this.canvas.dispatchEvent(new CustomEvent('vtt:movement-stopped-at-door', {
                detail: { tokenId: token.id, x: token.x, y: token.y, z: token.zLayer, ...result.stopAtDoor },
            }));
        }
        if (transition.valid) {
            const transitionDetail = { tokenId: token.id, ...transition };
            this.emitSemanticEvent('vtt:token-z-transition', transitionDetail, {
                reason: 'token', render: true, vision: true, active: false,
            });
        }
    }

    centerCamera() {
        const { cols, rows, size } = this.mapData.grid;
        const mapWidth = cols * size;
        const mapHeight = rows * size;
        this.camera.centerOnWorldPoint(mapWidth / 2, mapHeight / 2);
    }

    handleResize() {
        const centerBefore = this.camera.centerWorldPoint();
        const currentViewport = this.camera.viewportSize();
        const width = Math.max(1, Number(window.innerWidth) || currentViewport.width || 1);
        const height = Math.max(1, Number(window.innerHeight) || currentViewport.height || 1);

        if (this.renderer?.backend === 'webgl2') {
            this.renderer.resize?.(width, height);
        } else {
            this.canvas.width = width;
            this.canvas.height = height;
            this.renderer?.resize?.(width, height);
        }

        this.camera.centerOnWorldPoint(centerBefore);
        globalThis.LuminousVttSceneDirty?.emit?.(this.canvas, {
            reason: 'resize',
            render: true,
            vision: false,
            active: false,
            sourceEvent: 'engine:resize',
            meta: { width, height },
        });
    }

    start() { if (!this.isRunning) { this.isRunning = true; requestAnimationFrame(this.loop); } }
    stop() { this.cancelTokenMotion(); this.isRunning = false; }
    loop() {
        if (!this.isRunning) return;
        const renderData = this.calculateVision();
        if (!this.isExporting) this.renderer.render(this.camera, this.activeZ, renderData, this.isExporting);
        requestAnimationFrame(this.loop);
    }

    visionWallsForLayer(zLayer) {
        const legacy = (this.mapData.walls || []).filter((wall) => wall.z.includes(zLayer) && wall.blocksVision);
        const topology = this.topologyRules;
        if (!topology || !Array.isArray(this.mapData.topology)) return legacy;
        return [...legacy, ...topology.blockingSegments(this.mapData.topology, 'vision', zLayer, this.mapData.grid, this.mapData)];
    }
    ambientLightLevel() { return String(this.mapData.ambientLight?.level || 'bright').toLowerCase(); }
    visionProfile(player) {
        const senseRules = this.racialSenseRules, spatial = this.spatialVisionRules;
        const senses = player.senses || senseRules?.resolveCharacterSenses?.(player) || { darkvisionFt: 0 };
        const ambient = this.ambientLightLevel();
        const crossLayer = (spatial?.layerOf?.(player) ?? player.z?.[0] ?? 0) !== this.activeZ;
        if (ambient === 'darkness') {
            const darkvisionFt = Number(senses.darkvisionFt) || 0;
            if (darkvisionFt <= 0) return { visible: false, radiusPx: 0, monochrome: false, mode: 'none', senses, crossLayer };
            const radiusPx = spatial?.horizontalRadiusPxForRange?.(darkvisionFt, player, this.activeZ, this.mapData) ?? ((darkvisionFt / (this.mapData.grid.distancePerCell || 5)) * this.mapData.grid.size);
            if (radiusPx <= 0) return { visible: false, radiusPx: 0, monochrome: false, mode: 'none', senses, crossLayer };
            return { visible: true, radiusPx, monochrome: true, mode: 'darkvision', senses, crossLayer };
        }
        return { visible: true, radiusPx: this.legacyVisionRadius, monochrome: false, mode: ambient === 'dim' ? 'normal_dim' : 'normal', senses, crossLayer };
    }
    verticalPortalPoints(player) {
        const spatial = this.spatialVisionRules;
        if (!spatial) return [];
        const fromLayer = spatial.layerOf(player);
        if (fromLayer === this.activeZ) return [];
        return (this.mapData.verticalPortals || []).filter((portal) => spatial.portalConnects(portal, fromLayer, this.activeZ) && spatial.portalAllows(portal, 'vision')).flatMap((portal) => [spatial.vertexToPoint(portal.from || portal.a, this.mapData), spatial.vertexToPoint(portal.to || portal.b, this.mapData)]);
    }

    calculateVision() {
        const player = this.viewerToken();
        if (!player) return null;
        const profile = this.visionProfile(player);
        const center = { x: player.x, y: player.y };
        if (!profile.visible) return { fovPolygon: [], visionRadius: 0, tokenPos: center, visible: false, monochrome: false, perceptionMode: 'none', crossLayer: profile.crossLayer, senses: profile.senses };
        const currentVisionRadius = profile.radiusPx;
        const visionWalls = this.visionWallsForLayer(this.activeZ);
        const points = [];
        for (const wall of visionWalls) { points.push({ x: wall.x1, y: wall.y1 }); points.push({ x: wall.x2, y: wall.y2 }); }
        points.push(...this.verticalPortalPoints(player));
        const margin = currentVisionRadius + 10;
        points.push({ x: player.x - margin, y: player.y - margin }, { x: player.x + margin, y: player.y - margin }, { x: player.x + margin, y: player.y + margin }, { x: player.x - margin, y: player.y + margin });
        const bounds = [
            { a: { x: player.x - margin, y: player.y - margin }, b: { x: player.x + margin, y: player.y - margin } },
            { a: { x: player.x + margin, y: player.y - margin }, b: { x: player.x + margin, y: player.y + margin } },
            { a: { x: player.x + margin, y: player.y + margin }, b: { x: player.x - margin, y: player.y + margin } },
            { a: { x: player.x - margin, y: player.y + margin }, b: { x: player.x - margin, y: player.y - margin } },
        ];
        let angles = [];
        for (const point of points) { const angle = Math.atan2(point.y - player.y, point.x - player.x); angles.push(angle - 0.00001, angle, angle + 0.00001); }
        angles = [...new Set(angles)].sort((a, b) => a - b);
        const fovPolygon = [], spatial = this.spatialVisionRules;
        for (const angle of angles) {
            const dx = Math.cos(angle), dy = Math.sin(angle), rayLength = margin * 2;
            const ray = { a: center, b: { x: center.x + dx * rayLength, y: center.y + dy * rayLength } };
            let closestIntersect = null, minT = Infinity;
            for (const wall of visionWalls) { const intersect = getIntersection(ray, { a: { x: wall.x1, y: wall.y1 }, b: { x: wall.x2, y: wall.y2 } }); if (intersect && intersect.param < minT) { minT = intersect.param; closestIntersect = intersect; } }
            for (const bound of bounds) { const intersect = getIntersection(ray, bound); if (intersect && intersect.param < minT) { minT = intersect.param; closestIntersect = intersect; } }
            if (!closestIntersect) continue;
            if (profile.crossLayer && spatial && !spatial.canTraverseLayers(player, closestIntersect, this.activeZ, this.mapData, 'vision')) continue;
            fovPolygon.push(closestIntersect);
        }
        const visible = !profile.crossLayer || fovPolygon.length >= 3;
        return { fovPolygon, visionRadius: currentVisionRadius, tokenPos: center, visible, monochrome: profile.monochrome, perceptionMode: profile.mode, crossLayer: profile.crossLayer, senses: profile.senses };
    }

    setZLayer(z) { this.activeZ = Number(z) || 0; }
    exportUVTemplate() {
        this.isExporting = true;
        const prevZoom = this.camera.zoom, prevX = this.camera.x, prevY = this.camera.y;
        this.camera.zoom = 1; this.camera.x = 0; this.camera.y = 0;
        const prevWidth = this.canvas.width, prevHeight = this.canvas.height;
        this.canvas.width = this.mapData.grid.cols * this.mapData.grid.size;
        this.canvas.height = this.mapData.grid.rows * this.mapData.grid.size;
        this.renderer.render(this.camera, this.activeZ, null, this.isExporting);
        const dataURL = this.canvas.toDataURL('image/png');
        const filename = `Plantilla_Z${this.activeZ}_${this.canvas.width}x${this.canvas.height}_Grid70px.png`;
        const link = document.createElement('a');
        link.href = dataURL; link.download = filename;
        document.body.appendChild(link); link.click(); document.body.removeChild(link);
        this.camera.zoom = prevZoom; this.camera.x = prevX; this.camera.y = prevY;
        this.canvas.width = prevWidth; this.canvas.height = prevHeight;
        this.isExporting = false;
        this.renderer.render(this.camera, this.activeZ, this.calculateVision(), this.isExporting);
    }
}