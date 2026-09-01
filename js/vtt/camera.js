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

    notifyVisualChange(kind, active = false, meta = null) {
        globalThis.LuminousVttSceneDirty?.emit?.(this.canvas, {
            reason: 'camera',
            render: true,
            vision: false,
            active: Boolean(active),
            sourceEvent: `camera:${String(kind || 'change')}`,
            meta: meta && typeof meta === 'object' ? meta : null,
        });
    }

    setDragGuard(guard) {
        this.dragGuard = typeof guard === 'function' ? guard : null;
    }

    setManualPanListener(listener) {
        this.manualPanListener = typeof listener === 'function' ? listener : null;
    }

    setCenterConstraint(constraint) {
        this.centerConstraint = typeof constraint === 'function' ? constraint : null;
        if (this.enforceCenterConstraint()) this.notifyVisualChange('constraint');
    }

    viewportRect() {
        const rect = this.canvas?.getBoundingClientRect?.() || null;
        const rectWidth = Number(rect?.width);
        const rectHeight = Number(rect?.height);
        const clientWidth = Number(this.canvas?.clientWidth);
        const clientHeight = Number(this.canvas?.clientHeight);
        const backingWidth = Number(this.canvas?.width);
        const backingHeight = Number(this.canvas?.height);
        const width = rectWidth > 0 ? rectWidth : clientWidth > 0 ? clientWidth : backingWidth > 0 ? backingWidth : 1;
        const height = rectHeight > 0 ? rectHeight : clientHeight > 0 ? clientHeight : backingHeight > 0 ? backingHeight : 1;
        return {
            left: Number(rect?.left) || 0,
            top: Number(rect?.top) || 0,
            width,
            height,
        };
    }

    viewportSize() {
        const { width, height } = this.viewportRect();
        return { width, height };
    }

    clientToScreen(clientX, clientY) {
        const rect = this.viewportRect();
        return {
            x: Number(clientX) - rect.left,
            y: Number(clientY) - rect.top,
        };
    }

    eventToScreen(event = {}) {
        return this.clientToScreen(event.clientX, event.clientY);
    }

    eventToWorld(event = {}) {
        const point = this.eventToScreen(event);
        return this.screenToWorld(point.x, point.y);
    }

    setZoomBounds(minZoom = 0.1, maxZoom = 5) {
        const min = Number.isFinite(Number(minZoom)) ? Math.max(0.01, Number(minZoom)) : 0.1;
        const max = Number.isFinite(Number(maxZoom)) ? Math.max(min, Number(maxZoom)) : Math.max(min, 5);
        const center = this.centerWorldPoint();
        const previousZoom = this.zoom;
        this.minZoom = min;
        this.maxZoom = max;
        this.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoom));
        this.centerOnWorldPoint(center);
        if (Math.abs(this.zoom - previousZoom) > 1e-12) this.notifyVisualChange('zoom-bounds');
        return { minZoom: this.minZoom, maxZoom: this.maxZoom, zoom: this.zoom };
    }

    centerWorldPoint() {
        const { width, height } = this.viewportSize();
        return {
            x: (width / (2 * this.zoom)) - this.x,
            y: (height / (2 * this.zoom)) - this.y,
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
            const { width, height } = this.viewportSize();
            this.x = (width / (2 * this.zoom)) - constrained.x;
            this.y = (height / (2 * this.zoom)) - constrained.y;
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
        const detail = { dx, dy, x: this.x, y: this.y, zoom: this.zoom, clamped, center: this.centerWorldPoint() };
        this.manualPanListener?.(detail);
        this.notifyVisualChange('pan', true, detail);
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

        const mouse = this.eventToScreen(e);
        const worldX = (mouse.x / previousZoom) - this.x;
        const worldY = (mouse.y / previousZoom) - this.y;

        this.x = (mouse.x / this.zoom) - worldX;
        this.y = (mouse.y / this.zoom) - worldY;
        const clamped = this.enforceCenterConstraint();
        this.notifyVisualChange('zoom', true, { previousZoom, zoom: this.zoom, clamped });
    }

    centerOnWorldPoint(pointOrX = {}, worldY = undefined) {
        const point = typeof pointOrX === 'object' && pointOrX !== null
            ? pointOrX
            : { x: pointOrX, y: worldY };
        const constrained = this.constrainedCenter(point);
        if (!constrained) return false;
        const previousX = this.x;
        const previousY = this.y;
        const { width, height } = this.viewportSize();
        this.x = (width / (2 * this.zoom)) - constrained.x;
        this.y = (height / (2 * this.zoom)) - constrained.y;
        if (Math.abs(this.x - previousX) > 1e-7 || Math.abs(this.y - previousY) > 1e-7) {
            this.notifyVisualChange('center', false, { center: constrained, zoom: this.zoom });
        }
        return true;
    }

    worldToScreen(worldX, worldY) {
        return {
            x: (Number(worldX) + this.x) * this.zoom,
            y: (Number(worldY) + this.y) * this.zoom,
        };
    }

    applyTransform(ctx) {
        const { width, height } = this.viewportSize();
        ctx.translate(width / 2, height / 2);
        ctx.scale(this.zoom, this.zoom);
        ctx.translate(-width / 2, -height / 2);

        ctx.translate(this.x + width / (2 * this.zoom) - width / 2,
                      this.y + height / (2 * this.zoom) - height / 2);
    }

    applyTransformSimple(ctx) {
        ctx.scale(this.zoom, this.zoom);
        ctx.translate(this.x, this.y);
    }

    screenToWorld(screenX, screenY) {
        return {
            x: (Number(screenX) / this.zoom) - this.x,
            y: (Number(screenY) / this.zoom) - this.y,
        };
    }
}
