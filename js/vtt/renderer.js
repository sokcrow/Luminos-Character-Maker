export class Renderer {
    constructor(canvas, mapData) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.mapData = mapData;
    }

    clear(isExporting) {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        if (!isExporting) {
            this.ctx.fillStyle = '#000'; // Absolute black (Fog of war) outside vision
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }
    }

    drawGrid(isExporting = false) {
        const { cols, rows, size } = this.mapData.grid;
        const width = cols * size;
        const height = rows * size;

        this.ctx.strokeStyle = isExporting ? 'rgba(0, 0, 0, 0.2)' : 'rgba(255, 255, 255, 0.2)';
        this.ctx.lineWidth = 1;

        this.ctx.beginPath();
        // Vertical lines
        for (let x = 0; x <= cols; x++) {
            this.ctx.moveTo(x * size, 0);
            this.ctx.lineTo(x * size, height);
        }
        // Horizontal lines
        for (let y = 0; y <= rows; y++) {
            this.ctx.moveTo(0, y * size);
            this.ctx.lineTo(width, y * size);
        }
        this.ctx.stroke();
    }

    drawWalls(zLayer, isOnionSkin = false) {
        if (!this.mapData.walls) return;

        this.ctx.save();

        if (isOnionSkin) {
            this.ctx.strokeStyle = '#666666'; // Desaturated gray
            this.ctx.globalAlpha = 0.3;
        } else {
            this.ctx.strokeStyle = '#ff0000'; // Active layer
            this.ctx.globalAlpha = 1.0;
        }

        this.ctx.lineWidth = 3;
        this.ctx.lineCap = 'round';

        this.ctx.beginPath();
        for (const wall of this.mapData.walls) {
            // Only draw walls that exist on this Z layer
            if (wall.z.includes(zLayer)) {
                this.ctx.moveTo(wall.x1, wall.y1);
                this.ctx.lineTo(wall.x2, wall.y2);
            }
        }
        this.ctx.stroke();

        this.ctx.restore();
    }

    drawTokens(zLayer) {
        if (!this.mapData.tokens) return;

        for (const token of this.mapData.tokens) {
            if (token.z.includes(zLayer)) {
                this.ctx.fillStyle = token.color || '#fff';
                this.ctx.beginPath();
                this.ctx.arc(token.x, token.y, token.radius || (this.mapData.grid.size * 0.4), 0, Math.PI * 2);
                this.ctx.fill();

                // Add a border
                this.ctx.strokeStyle = '#000';
                this.ctx.lineWidth = 2;
                this.ctx.stroke();
            }
        }
    }

    render(camera, activeZ, renderData, isExporting = false) {
        this.clear(isExporting);

        if (isExporting) {
            this.ctx.save();
            camera.applyTransformSimple(this.ctx);
            this.drawGrid(true);
            this.drawWalls(activeZ, false);
            this.ctx.restore();
            return;
        }

        if (!renderData) return;

        const { fovPolygon, visionRadius, tokenPos, isLookingAway } = renderData;

        this.ctx.save();

        // Apply camera transformations
        camera.applyTransformSimple(this.ctx);

        // 1. Create clipping mask for vision
        if (fovPolygon && fovPolygon.length > 0) {
            // First clip: topological raycasting FOV polygon
            this.ctx.beginPath();
            this.ctx.moveTo(fovPolygon[0].x, fovPolygon[0].y);
            for (let i = 1; i < fovPolygon.length; i++) {
                this.ctx.lineTo(fovPolygon[i].x, fovPolygon[i].y);
            }
            this.ctx.closePath();
            this.ctx.clip(); // Standard non-zero winding rule

            // Second clip: The maximum circular vision radius limit
            this.ctx.beginPath();
            this.ctx.arc(tokenPos.x, tokenPos.y, visionRadius, 0, Math.PI * 2, false);
            this.ctx.clip();
        }

        // Fill revealed area with floor color
        this.ctx.fillStyle = '#111';
        const cameraRectSize = 10000;
        this.ctx.fillRect(
            tokenPos.x - cameraRectSize/2,
            tokenPos.y - cameraRectSize/2,
            cameraRectSize,
            cameraRectSize
        );

        // Draw grid
        this.drawGrid();

        // Draw onion skin for lower layer (Z-1) if applicable
        if (activeZ > 0) {
            this.drawWalls(activeZ - 1, true); // true = isOnionSkin
        }

        // Draw active walls
        this.drawWalls(activeZ, false);

        // Draw tokens
        this.drawTokens(activeZ);

        // Apply effort vignette if looking at a different layer
        if (isLookingAway) {
            const gradient = this.ctx.createRadialGradient(
                tokenPos.x, tokenPos.y, visionRadius * 0.5,
                tokenPos.x, tokenPos.y, visionRadius
            );
            gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
            gradient.addColorStop(1, 'rgba(0, 0, 0, 0.8)');

            this.ctx.fillStyle = gradient;
            this.ctx.beginPath();
            this.ctx.arc(tokenPos.x, tokenPos.y, visionRadius, 0, Math.PI * 2);
            this.ctx.fill();
        }

        this.ctx.restore();

        // Since we constrained the render by clip mask, draw the player token regardless
        // if they are on a different Z layer so we always see where we are.
        if (isLookingAway) {
            this.ctx.save();
            camera.applyTransformSimple(this.ctx);
            // Draw physical layer token with some transparency to indicate they aren't on this floor
            this.ctx.globalAlpha = 0.5;
            this.drawTokens(this.mapData.tokens[0].z[0]);
            this.ctx.restore();
        }
    }
}
