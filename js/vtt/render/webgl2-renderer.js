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

const VERTEX_SHADER_SOURCE = `#version 300 es
in vec2 a_position;
uniform vec2 u_resolution;
uniform vec2 u_camera;
uniform float u_zoom;
void main() {
    vec2 screen = (a_position + u_camera) * u_zoom;
    vec2 clip = (screen / u_resolution) * 2.0 - 1.0;
    gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
}`;

const FRAGMENT_SHADER_SOURCE = `#version 300 es
precision mediump float;
out vec4 outColor;
void main() {
    outColor = vec4(1.0, 1.0, 1.0, 0.22);
}`;

function createLegacyCanvas2DShim() {
    const noop = () => {};
    return {
        save: noop,
        restore: noop,
        clearRect: noop,
        fillRect: noop,
        strokeRect: noop,
        beginPath: noop,
        closePath: noop,
        moveTo: noop,
        lineTo: noop,
        stroke: noop,
        fill: noop,
        arc: noop,
        translate: noop,
        rotate: noop,
        scale: noop,
        clip: noop,
        drawImage: noop,
        fillText: noop,
        setLineDash: noop,
        measureText: (text) => ({ width: String(text ?? '').length * 6 }),
        globalAlpha: 1,
        fillStyle: '#000000',
        strokeStyle: '#ffffff',
        lineWidth: 1,
        lineCap: 'butt',
        lineJoin: 'miter',
        font: '10px sans-serif',
        textAlign: 'start',
        textBaseline: 'alphabetic',
        filter: 'none',
    };
}

export class WebGL2Renderer {
    constructor(canvas, mapData) {
        this.canvas = canvas;
        this.mapData = mapData;
        this.backend = 'webgl2';
        this.visibleBounds = null;
        this.destroyed = false;
        this.contextLost = false;
        this.gridSignature = '';
        this.gridVertexCount = 0;
        this.layers = new Map(WEBGL2_LAYER_ORDER.map((name, index) => [name, {
            name,
            order: index,
            visible: true,
            dirty: true,
        }]));

        // Migration bridge only. Existing Canvas-only authoring/render patches may
        // probe renderer.ctx or wrap drawTopology/drawTokens while their GPU layers
        // have not been migrated yet. This shim intentionally performs no drawing;
        // it prevents those legacy hooks from crashing the WebGL2 foundation.
        this.ctx = createLegacyCanvas2DShim();
        this.legacyCanvas2DShim = true;

        this.handleContextLost = this.handleContextLost.bind(this);
        this.handleContextRestored = this.handleContextRestored.bind(this);

        this.gl = canvas.getContext('webgl2', {
            alpha: false,
            antialias: true,
            depth: false,
            stencil: true,
            powerPreference: 'high-performance',
        });
        if (!this.gl) throw new Error('WebGL2 context unavailable for VTT canvas.');

        this.canvas.addEventListener('webglcontextlost', this.handleContextLost, false);
        this.canvas.addEventListener('webglcontextrestored', this.handleContextRestored, false);

        this.configureContext();
        this.createGridPipeline();
        this.resize();
    }

    compileShader(type, source) {
        const gl = this.gl;
        const shader = gl.createShader(type);
        if (!shader) throw new Error('Unable to allocate WebGL2 shader.');
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            const message = gl.getShaderInfoLog(shader) || 'Unknown WebGL2 shader compile error.';
            gl.deleteShader(shader);
            throw new Error(message);
        }
        return shader;
    }

    createGridPipeline() {
        const gl = this.gl;
        if (!gl || this.destroyed || this.contextLost) return;

        const vertexShader = this.compileShader(gl.VERTEX_SHADER, VERTEX_SHADER_SOURCE);
        const fragmentShader = this.compileShader(gl.FRAGMENT_SHADER, FRAGMENT_SHADER_SOURCE);
        const program = gl.createProgram();
        if (!program) {
            gl.deleteShader(vertexShader);
            gl.deleteShader(fragmentShader);
            throw new Error('Unable to allocate WebGL2 grid program.');
        }

        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);
        gl.deleteShader(vertexShader);
        gl.deleteShader(fragmentShader);

        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            const message = gl.getProgramInfoLog(program) || 'Unknown WebGL2 program link error.';
            gl.deleteProgram(program);
            throw new Error(message);
        }

        this.gridProgram = program;
        this.gridBuffer = gl.createBuffer();
        this.gridLocations = {
            position: gl.getAttribLocation(program, 'a_position'),
            resolution: gl.getUniformLocation(program, 'u_resolution'),
            camera: gl.getUniformLocation(program, 'u_camera'),
            zoom: gl.getUniformLocation(program, 'u_zoom'),
        };
        this.gridSignature = '';
        this.gridVertexCount = 0;
    }

    configureContext() {
        const gl = this.gl;
        if (!gl || this.destroyed || this.contextLost) return;
        gl.disable(gl.DEPTH_TEST);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.clearColor(0.035, 0.04, 0.05, 1);
    }

    handleContextLost(event) {
        if (!this.destroyed) event?.preventDefault?.();
        this.contextLost = true;
    }

    handleContextRestored() {
        if (this.destroyed) return;
        this.contextLost = false;
        this.configureContext();
        this.createGridPipeline();
        this.resize();
        this.markAllLayersDirty();
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
        if (this.destroyed || !this.gl || this.contextLost) return;
        this.gl.viewport(0, 0, this.gl.drawingBufferWidth, this.gl.drawingBufferHeight);
    }

    gridVertices() {
        const cols = Math.max(1, Number(this.mapData?.grid?.cols) || 1);
        const rows = Math.max(1, Number(this.mapData?.grid?.rows) || 1);
        const size = Math.max(1, Number(this.mapData?.grid?.size) || 70);
        const width = cols * size;
        const height = rows * size;
        const vertices = [];

        for (let col = 0; col <= cols; col += 1) {
            const x = col * size;
            vertices.push(x, 0, x, height);
        }
        for (let row = 0; row <= rows; row += 1) {
            const y = row * size;
            vertices.push(0, y, width, y);
        }
        return new Float32Array(vertices);
    }

    uploadGridIfNeeded() {
        const gl = this.gl;
        if (!gl || !this.gridBuffer) return;
        const grid = this.mapData?.grid || {};
        const signature = `${Number(grid.cols) || 0}:${Number(grid.rows) || 0}:${Number(grid.size) || 0}`;
        if (signature === this.gridSignature) return;

        const vertices = this.gridVertices();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.gridBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
        this.gridVertexCount = vertices.length / 2;
        this.gridSignature = signature;
        this.markLayerDirty('grid');
    }

    drawGrid(camera) {
        const gl = this.gl;
        const layer = this.layers.get('grid');
        if (!gl || !layer?.visible || !this.gridProgram || !this.gridBuffer) return;

        this.uploadGridIfNeeded();
        gl.useProgram(this.gridProgram);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.gridBuffer);
        gl.enableVertexAttribArray(this.gridLocations.position);
        gl.vertexAttribPointer(this.gridLocations.position, 2, gl.FLOAT, false, 0, 0);

        gl.uniform2f(this.gridLocations.resolution, gl.drawingBufferWidth, gl.drawingBufferHeight);
        gl.uniform2f(this.gridLocations.camera, Number(camera?.x) || 0, Number(camera?.y) || 0);
        gl.uniform1f(this.gridLocations.zoom, Math.max(0.0001, Number(camera?.zoom) || 1));
        gl.drawArrays(gl.LINES, 0, this.gridVertexCount);
        layer.dirty = false;
    }

    topologyStyle(element, preview = false) {
        if (preview) return { stroke: '#ffffff', width: 4, dash: [8, 5], label: '' };
        const state = element?.state;
        const broken = state === 'broken';
        const open = state === 'open';
        const styles = {
            wall: { stroke: '#ff3030', width: 4, label: 'WALL' },
            door: { stroke: '#ffb000', width: 7, label: state === 'locked' ? 'D·LOCK' : 'DOOR' },
            window: { stroke: '#00cfff', width: 6, label: state === 'locked' ? 'W·LOCK' : 'WINDOW' },
            curtain_window: { stroke: '#b784ff', width: 7, label: state === 'locked' ? 'C·LOCK' : 'CURTAIN' },
        };
        const base = styles[element?.type] || styles.wall;
        return { ...base, dash: broken ? [5, 7] : open ? [12, 9] : [] };
    }

    // Legacy extension seams retained only so existing Canvas-oriented bootstraps
    // can initialize during the staged migration. GPU implementations land in
    // their dedicated branches and will replace these no-op methods.
    drawTopology() { return 0; }
    drawTokens() { return 0; }

    render(camera, _activeZ, _renderData, _isExporting = false) {
        if (this.destroyed || !this.gl || this.contextLost) return;
        this.resize();
        this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.STENCIL_BUFFER_BIT);

        // Rama 1 proof-of-life: black GPU surface + camera-aware grid only.
        this.drawGrid(camera);

        for (const [name, layer] of this.layers) {
            if (name !== 'grid') layer.dirty = false;
        }
    }

    diagnostics() {
        if (!this.gl) {
            return {
                backend: this.backend,
                available: false,
                destroyed: this.destroyed,
                contextLost: this.contextLost,
                legacyCanvas2DShim: this.legacyCanvas2DShim,
            };
        }
        return {
            backend: this.backend,
            available: !this.destroyed && !this.contextLost,
            destroyed: this.destroyed,
            contextLost: this.contextLost,
            legacyCanvas2DShim: this.legacyCanvas2DShim,
            version: this.gl.getParameter(this.gl.VERSION),
            renderer: this.gl.getParameter(this.gl.RENDERER),
            drawingBuffer: {
                width: this.gl.drawingBufferWidth,
                height: this.gl.drawingBufferHeight,
            },
            gridVertexCount: this.gridVertexCount,
            layers: [...this.layers.values()].map((layer) => ({ ...layer })),
        };
    }

    destroy() {
        if (this.destroyed) return false;
        this.destroyed = true;

        const gl = this.gl;
        this.canvas?.removeEventListener?.('webglcontextlost', this.handleContextLost, false);
        this.canvas?.removeEventListener?.('webglcontextrestored', this.handleContextRestored, false);

        if (gl && !this.contextLost) {
            if (this.gridBuffer) gl.deleteBuffer(this.gridBuffer);
            if (this.gridProgram) gl.deleteProgram(this.gridProgram);
            const loseContext = gl.getExtension('WEBGL_lose_context');
            loseContext?.loseContext?.();
        }

        this.layers.clear();
        this.visibleBounds = null;
        this.gridBuffer = null;
        this.gridProgram = null;
        this.gridLocations = null;
        this.gridSignature = '';
        this.gridVertexCount = 0;
        this.ctx = null;
        this.legacyCanvas2DShim = false;
        this.gl = null;
        return true;
    }
}
