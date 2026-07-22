import { Camera } from './camera.js';
import { Renderer } from './renderer.js';
import { getIntersection, pointToSegmentDistance } from './math.js';

export class Engine {
    constructor(canvas, mapData) {
        this.canvas = canvas;
        this.mapData = mapData;

        this.camera = new Camera(canvas);
        this.renderer = new Renderer(canvas, mapData);

        this.activeZ = 0; // The active visual floor (camera view)
        this.isRunning = false;

        this.keys = { w: false, a: false, s: false, d: false };
        this.playerSpeed = 4;
        this.baseVisionRadius = 400;

        this.isExporting = false;

        this.handleResize = this.handleResize.bind(this);
        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.handleKeyUp = this.handleKeyUp.bind(this);
        this.loop = this.loop.bind(this);

        this.init();
    }

    init() {
        window.addEventListener('resize', this.handleResize);
        window.addEventListener('keydown', this.handleKeyDown);
        window.addEventListener('keyup', this.handleKeyUp);

        this.handleResize(); // Initial sizing
        this.centerCamera();
    }

    handleKeyDown(e) {
        const key = e.key.toLowerCase();
        if (this.keys.hasOwnProperty(key)) {
            this.keys[key] = true;
        }
    }

    handleKeyUp(e) {
        const key = e.key.toLowerCase();
        if (this.keys.hasOwnProperty(key)) {
            this.keys[key] = false;
        }
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

        this.update();

        // Raycast and render
        const renderData = this.calculateVision();

        // Ensure we don't render normally if an export is happening synchronously
        if (!this.isExporting) {
            this.renderer.render(this.camera, this.activeZ, renderData, this.isExporting);
        }

        requestAnimationFrame(this.loop);
    }

    update() {
        // Fluid continuous movement
        const player = this.mapData.tokens[0];
        if (!player) return;

        let dx = 0;
        let dy = 0;

        if (this.keys.w) dy -= this.playerSpeed;
        if (this.keys.s) dy += this.playerSpeed;
        if (this.keys.a) dx -= this.playerSpeed;
        if (this.keys.d) dx += this.playerSpeed;

        if (dx !== 0 || dy !== 0) {
            // Normalize diagonal movement
            if (dx !== 0 && dy !== 0) {
                const length = Math.sqrt(dx * dx + dy * dy);
                dx = (dx / length) * this.playerSpeed;
                dy = (dy / length) * this.playerSpeed;
            }

            // Move and collide X
            player.x += dx;
            this.resolveCollisions(player, true);

            // Move and collide Y
            player.y += dy;
            this.resolveCollisions(player, false);
        }
    }

    resolveCollisions(player, isXAxis) {
        const physicalZ = player.z[0];

        for (const wall of this.mapData.walls) {
            if (wall.z.includes(physicalZ) && wall.blocksMovement) {
                const dist = pointToSegmentDistance(
                    {x: player.x, y: player.y},
                    {x: wall.x1, y: wall.y1},
                    {x: wall.x2, y: wall.y2}
                );

                if (dist < player.radius) {
                    // Simple resolution: push back out
                    const overlap = player.radius - dist;

                    // Approximate normal based on line slope
                    const lx = wall.x2 - wall.x1;
                    const ly = wall.y2 - wall.y1;
                    const lLen = Math.sqrt(lx*lx + ly*ly);

                    // Wall normal (perpendicular)
                    let nx = -ly / lLen;
                    let ny = lx / lLen;

                    // Ensure normal points towards player
                    const dot = (player.x - wall.x1) * nx + (player.y - wall.y1) * ny;
                    if (dot < 0) {
                        nx = -nx;
                        ny = -ny;
                    }

                    if (isXAxis) {
                        player.x += nx * overlap;
                    } else {
                        player.y += ny * overlap;
                    }
                }
            }
        }
    }

    calculateVision() {
        const player = this.mapData.tokens[0];
        if (!player) return null;

        const isLookingAway = this.activeZ !== player.z[0];
        const currentVisionRadius = isLookingAway ? (this.baseVisionRadius * 0.5) : this.baseVisionRadius;

        // Filter walls for Raycasting: only those on activeZ that block vision
        const visionWalls = this.mapData.walls.filter(w => w.z.includes(this.activeZ) && w.blocksVision);

        // Collect all unique points (vertices)
        const points = [];
        for (const wall of visionWalls) {
            points.push({x: wall.x1, y: wall.y1});
            points.push({x: wall.x2, y: wall.y2});
        }

        // Add corners of the map bounding box to ensure raycast hits edges if vision is unbounded
        const margin = currentVisionRadius + 10;
        points.push({x: player.x - margin, y: player.y - margin});
        points.push({x: player.x + margin, y: player.y - margin});
        points.push({x: player.x + margin, y: player.y + margin});
        points.push({x: player.x - margin, y: player.y + margin});

        // Enclosing walls for the boundary
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

        // Sort angles
        angles = [...new Set(angles)].sort((a, b) => a - b);

        const fovPolygon = [];
        const center = { x: player.x, y: player.y };

        for (const angle of angles) {
            const dx = Math.cos(angle);
            const dy = Math.sin(angle);

            // Ensure ray is long enough to always hit boundary
            const rayLength = margin * 2;

            const ray = {
                a: center,
                b: { x: center.x + dx * rayLength, y: center.y + dy * rayLength }
            };

            let closestIntersect = null;
            let minT = Infinity;

            // Check vision walls
            for (const wall of visionWalls) {
                const segment = { a: {x: wall.x1, y: wall.y1}, b: {x: wall.x2, y: wall.y2} };
                const intersect = getIntersection(ray, segment);
                if (intersect && intersect.param < minT) {
                    minT = intersect.param;
                    closestIntersect = intersect;
                }
            }

            // Check boundary
            for (const bound of bounds) {
                const intersect = getIntersection(ray, bound);
                if (intersect && intersect.param < minT) {
                    minT = intersect.param;
                    closestIntersect = intersect;
                }
            }

            if (closestIntersect) {
                fovPolygon.push(closestIntersect);
            }
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

        // Save current camera state
        const prevZoom = this.camera.zoom;
        const prevX = this.camera.x;
        const prevY = this.camera.y;

        // Force camera to 1:1 scale at origin for absolute export
        this.camera.zoom = 1;
        this.camera.x = 0;
        this.camera.y = 0;

        // Resize canvas to strictly match the entire grid size
        const prevWidth = this.canvas.width;
        const prevHeight = this.canvas.height;
        this.canvas.width = this.mapData.grid.cols * this.mapData.grid.size;
        this.canvas.height = this.mapData.grid.rows * this.mapData.grid.size;

        // Force synchronous render isolated for export
        this.renderer.render(this.camera, this.activeZ, null, this.isExporting);

        const dataURL = this.canvas.toDataURL('image/png');

        // Dynamic Naming: Plantilla_Z{activeZ}_{canvas.width}x{canvas.height}_Grid70px.png
        const filename = `Plantilla_Z${this.activeZ}_${this.canvas.width}x${this.canvas.height}_Grid70px.png`;

        const link = document.createElement('a');
        link.href = dataURL;
        link.download = filename;

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Restore camera state
        this.camera.zoom = prevZoom;
        this.camera.x = prevX;
        this.camera.y = prevY;

        // Restore canvas size
        this.canvas.width = prevWidth;
        this.canvas.height = prevHeight;

        // Restore cyclical render state
        this.isExporting = false;

        // Force an immediate normal render to avoid flicker
        const renderData = this.calculateVision();
        this.renderer.render(this.camera, this.activeZ, renderData, this.isExporting);
    }
}
