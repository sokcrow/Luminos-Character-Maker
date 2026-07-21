export class Renderer {
    constructor(canvas, mapData) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.mapData = mapData;
    }

    clear() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.fillStyle = '#111'; // Match CSS background
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    drawGrid() {
        const { cols, rows, size } = this.mapData.grid;
        const width = cols * size;
        const height = rows * size;

        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
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
            this.ctx.strokeStyle = '#aaaaaa'; // Desaturated gray
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

    render(camera, currentZLayer = 0) {
        this.clear();

        this.ctx.save();

        // Apply camera transformations
        camera.applyTransformSimple(this.ctx);

        // Draw grid
        this.drawGrid();

        // Draw onion skin for lower layer (Z-1) if applicable
        if (currentZLayer > 0) {
            this.drawWalls(currentZLayer - 1, true); // true = isOnionSkin
        }

        // Draw active walls
        this.drawWalls(currentZLayer, false);

        // Draw tokens
        this.drawTokens(currentZLayer);

        this.ctx.restore();
    }
}
