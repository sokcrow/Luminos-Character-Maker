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
        const { cols, rows, cellSize } = this.mapData.grid;
        const width = cols * cellSize;
        const height = rows * cellSize;

        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        this.ctx.lineWidth = 1;

        this.ctx.beginPath();
        // Vertical lines
        for (let x = 0; x <= cols; x++) {
            this.ctx.moveTo(x * cellSize, 0);
            this.ctx.lineTo(x * cellSize, height);
        }
        // Horizontal lines
        for (let y = 0; y <= rows; y++) {
            this.ctx.moveTo(0, y * cellSize);
            this.ctx.lineTo(width, y * cellSize);
        }
        this.ctx.stroke();
    }

    drawWalls(zLayer) {
        if (!this.mapData.walls) return;

        this.ctx.strokeStyle = '#ff0000';
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
    }

    render(camera, currentZLayer = 0) {
        this.clear();

        this.ctx.save();

        // Apply camera transformations
        camera.applyTransformSimple(this.ctx);

        // Draw game elements
        this.drawGrid();
        this.drawWalls(currentZLayer);

        // Render tokens, lights, etc. later

        this.ctx.restore();
    }
}
