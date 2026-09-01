export const WEBGL2_LAYER_ORDER = Object.freeze([
    'terrain',
    'grid',
    'structures',
    'objects',
    'tokens',
    'effects',
    'lighting',
    'fog',
    'debug',
]);

export class WebGL2Renderer {
    constructor(canvas, mapData) {
        this.canvas = canvas;
        this.mapData = mapData;
        this.backend = 'webgl2';
        this.visibleBounds = null;
        this.destroyed = false;
        this.layers = new Map(WEBGL2_LAYER_ORDER.map((name, index) => [name, {
            name,
            order: index,
            visible: true,
            dirty: true,
        }]));

        this.gl = canvas.getContext('webgl2', {
            alpha: false,
            antialias: true,
            depth: false,
            stencil: true,
            powerPreference: 'high-performance',
        });
        if (!this.gl) throw new Error('WebGL2 context unavailable for VTT canvas.');

        this.configureContext();
        this.resize();
    }

    configureContext() {
        const gl = this.gl;
        gl.disable(gl.DEPTH_TEST);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.clearColor(0.035, 0.04, 0.05, 1);
    }

    setVisibleBounds(bounds) {
        this.visibleBounds = bounds || null;
    }

    markLayerDirty(name) {
        const layer = this.layers.get(name);
        if (layer) layer.dirty = true;
    }

    markAllLayersDirty() {
        for (const layer of this.layers.values()) layer.dirty = true;
    }

    setLayerVisible(name, visible) {
        const layer = this.layers.get(name);
        if (!layer) return false;
        layer.visible = Boolean(visible);
        layer.dirty = true;
        return true;
    }

    resize() {
        if (this.destroyed || !this.gl) return;
        this.gl.viewport(0, 0, this.gl.drawingBufferWidth, this.gl.drawingBufferHeight);
    }

    render(_camera, _activeZ, _renderData, _isExporting = false) {
        if (this.destroyed || !this.gl) return;
        this.resize();
        this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.STENCIL_BUFFER_BIT);

        // Rama 1 only establishes the GPU scene boundary. Concrete layers are
        // migrated independently so the existing simulation remains untouched.
        for (const layer of this.layers.values()) layer.dirty = false;
    }

    diagnostics() {
        if (!this.gl) return { backend: this.backend, available: false, destroyed: this.destroyed };
        return {
            backend: this.backend,
            available: true,
            destroyed: this.destroyed,
            version: this.gl.getParameter(this.gl.VERSION),
            renderer: this.gl.getParameter(this.gl.RENDERER),
            drawingBuffer: {
                width: this.gl.drawingBufferWidth,
                height: this.gl.drawingBufferHeight,
            },
            layers: [...this.layers.values()].map((layer) => ({ ...layer })),
        };
    }

    destroy() {
        if (this.destroyed) return;
        this.destroyed = true;
        this.layers.clear();
        this.visibleBounds = null;
        this.gl = null;
    }
}
