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
        this.centerConstraint = null;
        this.spacePanActive = false;

        this.onMouseDown = this.onMouseDown.bind(this);
        this.onMouseMove = this.onMouseMove.bind(this);
        this.onMouseUp = this.onMouseUp.bind(this);
        this.onWheel = this.onWheel.bind(this);
        this.onKeyDown = this.onKeyDown.bind(this);
        this.onKeyUp = this.onKeyUp.bind(this);
        this.onWindowBlur = this.onWindowBlur.bind(this);
        this.setupEventListeners();
    }

    setupEventListeners() {
        this.canvas.addEventListener('mousedown', this.onMouseDown);
        window.addEventListener('mousemove', this.onMouseMove);
        window.addEventListener('mouseup', this.onMouseUp);
        window.addEventListener('keydown', this.onKeyDown);
        window.addEventListener('keyup', this.onKeyUp);
        window.addEventListener('blur', this.onWindowBlur);
        this.canvas.addEventListener('wheel', this.onWheel, { passive: false });
    }

    destroy() {
        this.canvas.removeEventListener('mousedown', this.onMouseDown);
        window.removeEventListener('mousemove', this.onMouseMove);
        window.removeEventListener('mouseup', this.onMouseUp);
        window.removeEventListener('keydown', this.onKeyDown);
        window.removeEventListener('keyup', this.onKeyUp);
        window.removeEventListener('blur', this.onWindowBlur);
        this.canvas.removeEventListener('wheel', this.onWheel);
        this.dragGuard = null;
        this.manualPanListener = null;
        this.centerConstraint = null;
        this.spacePanActive = false;
        this.isDragging = false;
    }

    setDragGuard(guard) {
        this.dragGuard = typeof guard === 'function' ? guard : null;
    }

    setManualPanListener(listener) {
        this.manualPanListener = typeof listener === 'function' ? listener : null;
    }

    setCenterConstraint(constraint) {
        this.centerConstraint = typeof constraint === 'function' ? constraint : null;
        this.enforceCenterConstraint();
    }

    setZoomBounds(minZoom = 0.1, maxZoom = 5) {
        const min = Number.isFinite(Number(minZoom)) ? Math.max(0.01, Number(minZoom)) : 0.1;
        const max = Number.isFinite(Number(maxZoom)) ? Math.max(min, Number(maxZoom)) : Math.max(min, 5);
        const center = this.centerWorldPoint();
        this.minZoom = min;
        this.maxZoom = max;
        this.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoom));
        this.centerOnWorldPoint(center);
        return { minZoom: this.minZoom, maxZoom: this.maxZoom, zoom: this.zoom };
    }

    centerWorldPoint() {
        return {
            x: (this.canvas.width / (2 * this.zoom)) - this.x,
            y: (this.canvas.height / (2 * this.zoom)) - this.y,
        };
    }

    constrainedCenter(point = {}) {
        const source = { x: Number(point.x), y: Number(point.y) };
        if (!Number.isFinite(source.x) || !Number.isFinite(source.y)) return null;
        if (!this.centerConstraint) return source;
        const constrained = this.centerConstraint({ ...source }, { zoom: this.zoom, camera: this });
        if (!constrained || !Number.isFinite(Number(constrained.x)) || !Number.isFinite(Number(constrained.y))) return source;
        return { x: Number(constrained.x), y: Number(constrained.y) };
    }

    enforceCenterConstraint() {
        const current = this.centerWorldPoint();
        const constrained = this.constrainedCenter(current);
        if (!constrained) return false;
        const changed = Math.abs(constrained.x - current.x) > 1e-7 || Math.abs(constrained.y - current.y) > 1e-7;
        if (changed) {
            this.x = (this.canvas.width / (2 * this.zoom)) - constrained.x;
            this.y = (this.canvas.height / (2 * this.zoom)) - constrained.y;
        }
        return changed;
    }

    isEditableTarget(target) {
        const tag = String(target?.tagName || '').toLowerCase();
        return Boolean(target?.isContentEditable || ['input', 'textarea', 'select', 'button'].includes(tag));
    }

    onKeyDown(e) {
        if (e.code !== 'Space' || this.isEditableTarget(e.target)) return;
        this.spacePanActive = true;
        if (e.target === document.body || e.target === this.canvas) e.preventDefault();
    }

    onKeyUp(e) {
        if (e.code === 'Space') this.spacePanActive = false;
    }

    onWindowBlur() {
        this.spacePanActive = false;
        this.isDragging = false;
    }

    onMouseDown(e) {
        const middlePan = e.button === 1;
        const spaceLeftPan = e.button === 0 && this.spacePanActive;
        if (!middlePan && !spaceLeftPan) return;
        if (this.dragGuard && !this.dragGuard(e, { cameraPan: true, middlePan, spaceLeftPan })) return;
        this.isDragging = true;
        this.lastMouseX = e.clientX;
        this.lastMouseY = e.clientY;
        e.preventDefault?.();
    }

    onMouseMove(e) {
        if (!this.isDragging) return;

        const dx = e.clientX - this.lastMouseX;
        const dy = e.clientY - this.lastMouseY;
        if (!dx && !dy) return;

        this.x += dx / this.zoom;
        this.y += dy / this.zoom;
        const clamped = this.enforceCenterConstraint();

        this.lastMouseX = e.clientX;
        this.lastMouseY = e.clientY;
        this.manualPanListener?.({ dx, dy, x: this.x, y: this.y, zoom: this.zoom, clamped, center: this.centerWorldPoint() });
    }

    onMouseUp() {
        this.isDragging = false;
    }

    onWheel(e) {
        e.preventDefault();

        const zoomFactor = 1.1;
        const previousZoom = this.zoom;
        const proposed = e.deltaY < 0 ? this.zoom * zoomFactor : this.zoom / zoomFactor;
        this.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, proposed));
        if (Math.abs(this.zoom - previousZoom) < 1e-12) return;

        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const worldX = (mouseX / previousZoom) - this.x;
        const worldY = (mouseY / previousZoom) - this.y;

        this.x = (mouseX / this.zoom) - worldX;
        this.y = (mouseY / this.zoom) - worldY;
        this.enforceCenterConstraint();
    }

    centerOnWorldPoint(point = {}) {
        const constrained = this.constrainedCenter(point);
        if (!constrained) return false;
        this.x = (this.canvas.width / (2 * this.zoom)) - constrained.x;
        this.y = (this.canvas.height / (2 * this.zoom)) - constrained.y;
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
            y: (screenY / this.zoom) - this.y,
        };
    }
}
