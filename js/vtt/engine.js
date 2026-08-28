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
        this.baseVisionRadius = 400;
        this.isExporting = false;
        this.tokenDrag = null;

        this.handleResize = this.handleResize.bind(this);
        this.handleTokenMouseDown = this.handleTokenMouseDown.bind(this);
        this.handleTokenMouseMove = this.handleTokenMouseMove.bind(this);
        this.handleTokenMouseUp = this.handleTokenMouseUp.bind(this);
        this.loop = this.loop.bind(this);

        this.camera.setDragGuard((event) => !this.tokenAtEvent(event));
        this.init();
    }

    get tokenRules() {
        return globalThis.LuminousVttTokenInteraction || null;
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
        const rect = this.canvas.getBoundingClientRect();
        return this.camera.screenToWorld(event.clientX - rect.left, event.clientY - rect.top);
    }

    tokenAtEvent(event) {
        const rules = this.tokenRules;
        if (!rules) return null;
        return rules.findDraggableToken(
            this.mapData.tokens,
            this.eventWorldPoint(event),
            this.mapData.grid,
            this.activeZ,
        );
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
        this.tokenDrag.token.x = worldPoint.x - this.tokenDrag.grabOffsetX;
        this.tokenDrag.token.y = worldPoint.y - this.tokenDrag.grabOffsetY;
        this.canvas.style.cursor = 'grabbing';
    }

    handleTokenMouseUp(event) {
        if (!this.tokenDrag || event.button !== 0) return;

        const drag = this.tokenDrag;
        const token = drag.token;
        const worldPoint = this.eventWorldPoint(event);
        const requestedPoint = {
            x: worldPoint.x - drag.grabOffsetX,
            y: worldPoint.y - drag.grabOffsetY,
        };
        const rules = this.tokenRules;
        const result = rules?.resolveDrop?.(
            token,
            { x: drag.originX, y: drag.originY },
            requestedPoint,
            this.mapData,
        ) || { valid: false, reason: 'TOKEN_RULES_UNAVAILABLE' };

        if (result.valid) {
            token.x = result.x;
            token.y = result.y;
            token.gridPosition = { col: result.col, row: result.row, z: token.z?.[0] ?? 0 };
            this.canvas.dispatchEvent(new CustomEvent('vtt:token-moved', {
                detail: {
                    tokenId: token.id,
                    from: { x: drag.originX, y: drag.originY },
                    to: { x: token.x, y: token.y, ...token.gridPosition },
                },
            }));
        } else {
            token.x = drag.originX;
            token.y = drag.originY;
        }

        this.tokenDrag = null;
        this.canvas.style.cursor = this.tokenAtEvent(event) ? 'grab' : 'default';
    }

    centerCamera() {
        const { cols, rows, size } = this.mapData.grid;
        const mapWidth = cols * size;
        const mapHeight = rows * size;

        this.camera.x = (this.canvas.width / 2) - (mapWidth / 2);
        this.camera.y = (this.canvas.height / 2) - (mapHeight / 2);
    }

    handleResize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    start() {
        if (!this.isRunning) {
            this.isRunning = true;
            requestAnimationFrame(this.loop);
        }
    }

    stop() {
        this.isRunning = false;
    }

    loop() {
        if (!this.isRunning) return;

        const renderData = this.calculateVision();

        if (!this.isExporting) {
            this.renderer.render(this.camera, this.activeZ, renderData, this.isExporting);
        }

        requestAnimationFrame(this.loop);
    }

    calculateVision() {
        const player = this.mapData.tokens[0];
        if (!player) return null;

        const isLookingAway = this.activeZ !== player.z[0];
        const currentVisionRadius = isLookingAway ? (this.baseVisionRadius * 0.5) : this.baseVisionRadius;
        const visionWalls = this.mapData.walls.filter(w => w.z.includes(this.activeZ) && w.blocksVision);

        const points = [];
        for (const wall of visionWalls) {
            points.push({x: wall.x1, y: wall.y1});
            points.push({x: wall.x2, y: wall.y2});
        }

        const margin = currentVisionRadius + 10;
        points.push({x: player.x - margin, y: player.y - margin});
        points.push({x: player.x + margin, y: player.y - margin});
        points.push({x: player.x + margin, y: player.y + margin});
        points.push({x: player.x - margin, y: player.y + margin});

        const bounds = [
            { a: {x: player.x - margin, y: player.y - margin}, b: {x: player.x + margin, y: player.y - margin} },
            { a: {x: player.x + margin, y: player.y - margin}, b: {x: player.x + margin, y: player.y + margin} },
            { a: {x: player.x + margin, y: player.y + margin}, b: {x: player.x - margin, y: player.y + margin} },
            { a: {x: player.x - margin, y: player.y + margin}, b: {x: player.x - margin, y: player.y - margin} }
        ];

        let angles = [];
        for (const pt of points) {
            const angle = Math.atan2(pt.y - player.y, pt.x - player.x);
            angles.push(angle - 0.00001);
            angles.push(angle);
            angles.push(angle + 0.00001);
        }

        angles = [...new Set(angles)].sort((a, b) => a - b);

        const fovPolygon = [];
        const center = { x: player.x, y: player.y };

        for (const angle of angles) {
            const dx = Math.cos(angle);
            const dy = Math.sin(angle);
            const rayLength = margin * 2;

            const ray = {
                a: center,
                b: { x: center.x + dx * rayLength, y: center.y + dy * rayLength }
            };

            let closestIntersect = null;
            let minT = Infinity;

            for (const wall of visionWalls) {
                const segment = { a: {x: wall.x1, y: wall.y1}, b: {x: wall.x2, y: wall.y2} };
                const intersect = getIntersection(ray, segment);
                if (intersect && intersect.param < minT) {
                    minT = intersect.param;
                    closestIntersect = intersect;
                }
            }

            for (const bound of bounds) {
                const intersect = getIntersection(ray, bound);
                if (intersect && intersect.param < minT) {
                    minT = intersect.param;
                    closestIntersect = intersect;
                }
            }

            if (closestIntersect) fovPolygon.push(closestIntersect);
        }

        return {
            fovPolygon,
            visionRadius: currentVisionRadius,
            tokenPos: center,
            isLookingAway
        };
    }

    setZLayer(z) {
        this.activeZ = z;
    }

    exportUVTemplate() {
        this.isExporting = true;

        const prevZoom = this.camera.zoom;
        const prevX = this.camera.x;
        const prevY = this.camera.y;

        this.camera.zoom = 1;
        this.camera.x = 0;
        this.camera.y = 0;

        const prevWidth = this.canvas.width;
        const prevHeight = this.canvas.height;
        this.canvas.width = this.mapData.grid.cols * this.mapData.grid.size;
        this.canvas.height = this.mapData.grid.rows * this.mapData.grid.size;

        this.renderer.render(this.camera, this.activeZ, null, this.isExporting);

        const dataURL = this.canvas.toDataURL('image/png');
        const filename = `Plantilla_Z${this.activeZ}_${this.canvas.width}x${this.canvas.height}_Grid70px.png`;

        const link = document.createElement('a');
        link.href = dataURL;
        link.download = filename;

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        this.camera.zoom = prevZoom;
        this.camera.x = prevX;
        this.camera.y = prevY;

        this.canvas.width = prevWidth;
        this.canvas.height = prevHeight;

        this.isExporting = false;

        const renderData = this.calculateVision();
        this.renderer.render(this.camera, this.activeZ, renderData, this.isExporting);
    }
}
