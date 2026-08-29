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
        this.dragGuard = null;
        this.manualPanListener = null;

        this.onMouseDown = this.onMouseDown.bind(this);
        this.onMouseMove = this.onMouseMove.bind(this);
        this.onMouseUp = this.onMouseUp.bind(this);
        this.onWheel = this.onWheel.bind(this);
        this.setupEventListeners();
    }

    setupEventListeners() {
        this.canvas.addEventListener('mousedown', this.onMouseDown);
        window.addEventListener('mousemove', this.onMouseMove);
        window.addEventListener('mouseup', this.onMouseUp);
        this.canvas.addEventListener('wheel', this.onWheel, { passive: false });
    }

    destroy() {
        this.canvas.removeEventListener('mousedown', this.onMouseDown);
        window.removeEventListener('mousemove', this.onMouseMove);
        window.removeEventListener('mouseup', this.onMouseUp);
        this.canvas.removeEventListener('wheel', this.onWheel);
        this.dragGuard = null;
        this.manualPanListener = null;
        this.isDragging = false;
    }

    setDragGuard(guard) {
        this.dragGuard = typeof guard === 'function' ? guard : null;
    }

    setManualPanListener(listener) {
        this.manualPanListener = typeof listener === 'function' ? listener : null;
    }

    onMouseDown(e) {
        if (e.button === 0 && this.dragGuard && !this.dragGuard(e)) return;
        if (e.button === 0 || e.button === 1 || e.button === 2) {
            this.isDragging = true;
            this.lastMouseX = e.clientX;
            this.lastMouseY = e.clientY;
        }
    }

    onMouseMove(e) {
        if (!this.isDragging) return;

        const dx = e.clientX - this.lastMouseX;
        const dy = e.clientY - this.lastMouseY;
        if (!dx && !dy) return;

        this.x += dx / this.zoom;
        this.y += dy / this.zoom;

        this.lastMouseX = e.clientX;
        this.lastMouseY = e.clientY;
        this.manualPanListener?.({ dx, dy, x: this.x, y: this.y, zoom: this.zoom });
    }

    onMouseUp() {
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

        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const worldX = (mouseX / previousZoom) - this.x;
        const worldY = (mouseY / previousZoom) - this.y;

        this.x = (mouseX / this.zoom) - worldX;
        this.y = (mouseY / this.zoom) - worldY;
    }

    centerOnWorldPoint(point = {}) {
        const worldX = Number(point.x);
        const worldY = Number(point.y);
        if (!Number.isFinite(worldX) || !Number.isFinite(worldY)) return false;
        this.x = (this.canvas.width / (2 * this.zoom)) - worldX;
        this.y = (this.canvas.height / (2 * this.zoom)) - worldY;
        return true;
    }

    worldToScreen(worldX, worldY) {
        return {
            x: (Number(worldX) + this.x) * this.zoom,
            y: (Number(worldY) + this.y) * this.zoom,
        };
    }

    applyTransform(ctx) {
        ctx.translate(this.canvas.width / 2, this.canvas.height / 2);
        ctx.scale(this.zoom, this.zoom);
        ctx.translate(-this.canvas.width / 2, -this.canvas.height / 2);

        ctx.translate(this.x + this.canvas.width / (2 * this.zoom) - this.canvas.width / 2,
                      this.y + this.canvas.height / (2 * this.zoom) - this.canvas.height / 2);
    }

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
