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

    init() {
        window.addEventListener('resize', this.handleResize);
        this.canvas.addEventListener('mousedown', this.handleTokenMouseDown);
        window.addEventListener('mousemove', this.handleTokenMouseMove);
        window.addEventListener('mouseup', this.handleTokenMouseUp);
        this.handleResize();
        this.centerCamera();
    }

    eventWorldPoint(event) {
        const rect = this.canvas.getBoundingClientRect();
        return this.camera.screenToWorld(event.clientX - rect.left, event.clientY - rect.top);
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
        if (event.button !== 0) return;
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
        token.x = worldPoint.x - this.tokenDrag.grabOffsetX;
        token.y = worldPoint.y - this.tokenDrag.grabOffsetY;
        this.canvas.style.cursor = 'grabbing';
        // LOCAL-ONLY preview. Persistence intentionally listens only to
        // `vtt:token-moved`, which is emitted once after a valid mouseup.
        this.canvas.dispatchEvent(new CustomEvent('vtt:token-preview-moved', {
            detail: { tokenId: token.id, x: token.x, y: token.y, z: Number(token.zLayer ?? token.gridPosition?.z ?? token.z?.[0] ?? 0) },
        }));
    }

    handleTokenMouseUp(event) {
        if (!this.tokenDrag || event.button !== 0) return;
        const drag = this.tokenDrag;
        const token = drag.token;
        const worldPoint = this.eventWorldPoint(event);
        const requestedPoint = { x: worldPoint.x - drag.grabOffsetX, y: worldPoint.y - drag.grabOffsetY };
        const rules = this.tokenRules;
        const result = rules?.resolveDrop?.(token, { x: drag.originX, y: drag.originY }, requestedPoint, this.mapData) || { valid: false, reason: 'TOKEN_RULES_UNAVAILABLE' };

        if (result.valid) {
            token.x = result.x;
            token.y = result.y;
            const zLayer = this.spatialVisionRules?.layerOf?.(token) ?? token.z?.[0] ?? 0;
            token.zLayer = zLayer;
            token.z = [Number(zLayer)];
            token.gridPosition = { col: result.col, row: result.row, z: zLayer };
            const transition = this.verticalMovementRules?.transitionOnDrop?.(token, { x: token.x, y: token.y }, this.mapData) || { valid: false, reason: 'NO_VERTICAL_TRANSITION' };
            if (transition.valid && transition.complete && token.viewer === true) this.setZLayer(transition.targetZ);
            this.canvas.dispatchEvent(new CustomEvent('vtt:token-moved', {
                detail: {
                    tokenId: token.id,
                    from: { x: drag.originX, y: drag.originY, z: drag.originZ, elevationFt: drag.originElevationFt },
                    to: { x: token.x, y: token.y, ...token.gridPosition, elevationFt: token.elevationFt ?? 0, verticalMovement: token.verticalMovement || null },
                    transition: transition.valid ? { routeId: transition.route?.id || null, complete: Boolean(transition.complete), targetZ: transition.targetZ, costSpentFt: transition.costSpentFt ?? null } : null,
                },
            }));
            if (transition.valid) this.canvas.dispatchEvent(new CustomEvent('vtt:token-z-transition', { detail: { tokenId: token.id, ...transition } }));
        } else {
            token.x = drag.originX;
            token.y = drag.originY;
            token.zLayer = drag.originZ;
            token.z = [drag.originZ];
            token.elevationFt = drag.originElevationFt;
            this.canvas.dispatchEvent(new CustomEvent('vtt:token-preview-moved', { detail: { tokenId: token.id, x: token.x, y: token.y, z: drag.originZ, reverted: true } }));
        }
        this.tokenDrag = null;
        this.canvas.style.cursor = this.tokenAtEvent(event) ? 'grab' : 'default';
    }

    centerCamera() {
        const { cols, rows, size } = this.mapData.grid;
        const mapWidth = cols * size, mapHeight = rows * size;
        this.camera.x = (this.canvas.width / 2) - (mapWidth / 2);
        this.camera.y = (this.canvas.height / 2) - (mapHeight / 2);
    }
    handleResize() { this.canvas.width = window.innerWidth; this.canvas.height = window.innerHeight; }
    start() { if (!this.isRunning) { this.isRunning = true; requestAnimationFrame(this.loop); } }
    stop() { this.isRunning = false; }
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
