export class Camera {
    constructor(canvas) {
        this.canvas = canvas;
        this.x = 0;
        this.y = 0;
        this.zoom = 1;
        this.minZoom = 0.1;
        this.maxZoom = 5;

        this.isDragging = false;
        this.lastMouseX = 0;
        this.lastMouseY = 0;

        this.setupEventListeners();
    }

    setupEventListeners() {
        this.canvas.addEventListener('mousedown', this.onMouseDown.bind(this));
        window.addEventListener('mousemove', this.onMouseMove.bind(this));
        window.addEventListener('mouseup', this.onMouseUp.bind(this));
        this.canvas.addEventListener('wheel', this.onWheel.bind(this), { passive: false });
    }

    onMouseDown(e) {
        if (e.button === 0 || e.button === 1 || e.button === 2) { // Allow dragging with left, middle, or right click for now
            this.isDragging = true;
            this.lastMouseX = e.clientX;
            this.lastMouseY = e.clientY;
        }
    }

    onMouseMove(e) {
        if (!this.isDragging) return;

        const dx = e.clientX - this.lastMouseX;
        const dy = e.clientY - this.lastMouseY;

        this.x += dx / this.zoom;
        this.y += dy / this.zoom;

        this.lastMouseX = e.clientX;
        this.lastMouseY = e.clientY;
    }

    onMouseUp(e) {
        this.isDragging = false;
    }

    onWheel(e) {
        e.preventDefault();

        const zoomFactor = 1.1;
        const previousZoom = this.zoom;

        if (e.deltaY < 0) {
            this.zoom *= zoomFactor;
        } else {
            this.zoom /= zoomFactor;
        }

        this.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoom));

        // Adjust camera position to zoom towards the mouse cursor
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        // Convert mouse position to world coordinates before zoom
        const worldX = (mouseX / previousZoom) - this.x;
        const worldY = (mouseY / previousZoom) - this.y;

        // Calculate new camera position so the world coordinate under the mouse stays the same
        this.x = (mouseX / this.zoom) - worldX;
        this.y = (mouseY / this.zoom) - worldY;
    }

    applyTransform(ctx) {
        ctx.translate(this.canvas.width / 2, this.canvas.height / 2);
        ctx.scale(this.zoom, this.zoom);
        ctx.translate(-this.canvas.width / 2, -this.canvas.height / 2);

        // Apply camera offset based on screen center
        ctx.translate(this.x + this.canvas.width / (2 * this.zoom) - this.canvas.width / 2,
                      this.y + this.canvas.height / (2 * this.zoom) - this.canvas.height / 2);
    }

    // Easier alternative for applyTransform depending on how we render
    applyTransformSimple(ctx) {
        ctx.scale(this.zoom, this.zoom);
        ctx.translate(this.x, this.y);
    }

    screenToWorld(screenX, screenY) {
        return {
            x: (screenX / this.zoom) - this.x,
            y: (screenY / this.zoom) - this.y
        };
    }
}
