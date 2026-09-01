import { WebGLWorldTransform } from './world-transform.js';

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
uniform mat3 u_world;
void main() {
    vec3 clip = u_world * vec3(a_position, 1.0);
    gl_Position = vec4(clip.xy, 0.0, 1.0);
}`;

const GRID_FRAGMENT_SHADER_SOURCE = `#version 300 es
precision mediump float;
out vec4 outColor;
void main() {
    outColor = vec4(1.0, 1.0, 1.0, 0.22);
}`;

const OVERLAY_FRAGMENT_SHADER_SOURCE = `#version 300 es
precision mediump float;
uniform vec4 u_color;
out vec4 outColor;
void main() {
    outColor = u_color;
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

const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

function rgba(color, alpha = 1) {
    const text = String(color || '#d7b151').trim();
    const short = /^#([0-9a-f]{3})$/i.exec(text);
    const full = /^#([0-9a-f]{6})$/i.exec(text);
    let r = 215;
    let g = 177;
    let b = 81;

    if (short) {
        r = parseInt(short[1][0] + short[1][0], 16);
        g = parseInt(short[1][1] + short[1][1], 16);
        b = parseInt(short[1][2] + short[1][2], 16);
    } else if (full) {
        r = parseInt(full[1].slice(0, 2), 16);
        g = parseInt(full[1].slice(2, 4), 16);
        b = parseInt(full[1].slice(4, 6), 16);
    }

    return new Float32Array([
        r / 255,
        g / 255,
        b / 255,
        Math.max(0, Math.min(1, finite(alpha, 1))),
    ]);
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
        this.world = new WebGLWorldTransform();
        this.logicalViewport = { width: Math.max(1, Number(canvas?.width) || 1), height: Math.max(1, Number(canvas?.height) || 1) };
        this.devicePixelRatio = 1;
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
        this.createObserverOverlayPipeline();
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

    createProgram(fragmentSource) {
        const gl = this.gl;
        const vertexShader = this.compileShader(gl.VERTEX_SHADER, VERTEX_SHADER_SOURCE);
        const fragmentShader = this.compileShader(gl.FRAGMENT_SHADER, fragmentSource);
        const program = gl.createProgram();
        if (!program) {
            gl.deleteShader(vertexShader);
            gl.deleteShader(fragmentShader);
            throw new Error('Unable to allocate WebGL2 program.');
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
        return program;
    }

    createGridPipeline() {
        const gl = this.gl;
        if (!gl || this.destroyed || this.contextLost) return;

        const program = this.createProgram(GRID_FRAGMENT_SHADER_SOURCE);
        this.gridProgram = program;
        this.gridBuffer = gl.createBuffer();
        this.gridLocations = {
            position: gl.getAttribLocation(program, 'a_position'),
            world: gl.getUniformLocation(program, 'u_world'),
        };
        this.gridSignature = '';
        this.gridVertexCount = 0;
    }

    createObserverOverlayPipeline() {
        const gl = this.gl;
        if (!gl || this.destroyed || this.contextLost) return;

        const program = this.createProgram(OVERLAY_FRAGMENT_SHADER_SOURCE);
        this.observerOverlayProgram = program;
        this.observerOverlayBuffer = gl.createBuffer();
        this.observerOverlayLocations = {
            position: gl.getAttribLocation(program, 'a_position'),
            world: gl.getUniformLocation(program, 'u_world'),
            color: gl.getUniformLocation(program, 'u_color'),
        };
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
        this.createObserverOverlayPipeline();
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

    viewportSize(camera = null) {
        const cameraViewport = camera?.viewportSize?.();
        if (finite(cameraViewport?.width) > 0 && finite(cameraViewport?.height) > 0) {
            return { width: finite(cameraViewport.width), height: finite(cameraViewport.height) };
        }
        const rect = this.canvas?.getBoundingClientRect?.();
        const width = finite(rect?.width) || finite(this.canvas?.clientWidth) || finite(this.canvas?.width, 1);
        const height = finite(rect?.height) || finite(this.canvas?.clientHeight) || finite(this.canvas?.height, 1);
        return { width: Math.max(1, width), height: Math.max(1, height) };
    }

    resize(cameraOrWidth = null, requestedHeight = null) {
        if (this.destroyed || !this.gl || this.contextLost) return this.logicalViewport;

        const explicitSize = Number.isFinite(Number(cameraOrWidth)) && Number.isFinite(Number(requestedHeight));
        const camera = explicitSize ? null : cameraOrWidth;
        this.logicalViewport = explicitSize
            ? {
                width: Math.max(1, finite(cameraOrWidth, 1)),
                height: Math.max(1, finite(requestedHeight, 1)),
            }
            : this.viewportSize(camera);

        this.devicePixelRatio = Math.max(1, finite(globalThis.devicePixelRatio, 1));
        const framebufferWidth = Math.max(1, Math.round(this.logicalViewport.width * this.devicePixelRatio));
        const framebufferHeight = Math.max(1, Math.round(this.logicalViewport.height * this.devicePixelRatio));

        // Width/height are framebuffer pixels. CSS dimensions remain logical pixels,
        // so Camera and pointer math are independent from devicePixelRatio.
        if (explicitSize && this.canvas?.style) {
            this.canvas.style.width = `${this.logicalViewport.width}px`;
            this.canvas.style.height = `${this.logicalViewport.height}px`;
        }
        if (this.canvas.width !== framebufferWidth) this.canvas.width = framebufferWidth;
        if (this.canvas.height !== framebufferHeight) this.canvas.height = framebufferHeight;

        this.gl.viewport(0, 0, this.gl.drawingBufferWidth, this.gl.drawingBufferHeight);
        return this.logicalViewport;
    }

    syncWorld(camera) {
        const viewport = this.resize(camera);
        this.world.sync(camera, viewport);
        return this.world;
    }

    worldToScreen(worldX, worldY) {
        return this.world.worldToScreen(worldX, worldY);
    }

    screenToWorld(screenX, screenY) {
        return this.world.screenToWorld(screenX, screenY);
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

    drawGrid() {
        const gl = this.gl;
        const layer = this.layers.get('grid');
        if (!gl || !layer?.visible || !this.gridProgram || !this.gridBuffer) return;

        this.uploadGridIfNeeded();
        gl.useProgram(this.gridProgram);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.gridBuffer);
        gl.enableVertexAttribArray(this.gridLocations.position);
        gl.vertexAttribPointer(this.gridLocations.position, 2, gl.FLOAT, false, 0, 0);
        gl.uniformMatrix3fv(this.gridLocations.world, false, this.world.matrix);
        gl.drawArrays(gl.LINES, 0, this.gridVertexCount);
        layer.dirty = false;
    }

    observerConeVertices(raw = {}) {
        const x = finite(raw.x);
        const y = finite(raw.y);
        const radius = Math.max(0, finite(raw.radius));
        if (!(radius > 0)) return new Float32Array();

        const cone = Math.max(0, Math.min(360, finite(raw.coneDeg, 120)));
        const facing = finite(raw.facingDeg);
        const start = (facing - (cone / 2)) * Math.PI / 180;
        const sweep = cone * Math.PI / 180;
        const segments = Math.max(12, Math.ceil(cone / 6));
        const vertices = [x, y];

        for (let index = 0; index <= segments; index += 1) {
            const angle = start + (sweep * index / segments);
            vertices.push(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius);
        }
        vertices.push(x, y);
        return new Float32Array(vertices);
    }

    drawDmObserverOutlines(outlines = [], camera = null) {
        if (this.destroyed || !this.gl || this.contextLost || !this.observerOverlayProgram || !this.observerOverlayBuffer) return 0;
        if (camera) this.syncWorld(camera);

        const gl = this.gl;
        gl.useProgram(this.observerOverlayProgram);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.observerOverlayBuffer);
        gl.enableVertexAttribArray(this.observerOverlayLocations.position);
        gl.vertexAttribPointer(this.observerOverlayLocations.position, 2, gl.FLOAT, false, 0, 0);
        gl.uniformMatrix3fv(this.observerOverlayLocations.world, false, this.world.matrix);

        let drawn = 0;
        for (const raw of Array.isArray(outlines) ? outlines : []) {
            const vertices = this.observerConeVertices(raw);
            if (vertices.length < 6) continue;
            gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.DYNAMIC_DRAW);
            gl.uniform4fv(this.observerOverlayLocations.color, rgba(raw?.color, raw?.selected ? 0.85 : 0.45));
            gl.drawArrays(gl.LINE_STRIP, 0, vertices.length / 2);
            drawn += 1;
        }
        return drawn;
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
        this.syncWorld(camera);
        this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.STENCIL_BUFFER_BIT);

        // All GPU world layers consume this renderer-owned transform. The grid is
        // the first migrated pipeline; later layers must not read camera directly.
        this.drawGrid();

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
            logicalViewport: { ...this.logicalViewport },
            devicePixelRatio: this.devicePixelRatio,
            world: this.world.snapshot(),
            gridVertexCount: this.gridVertexCount,
            observerOverlayReady: Boolean(this.observerOverlayProgram && this.observerOverlayBuffer),
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
            if (this.observerOverlayBuffer) gl.deleteBuffer(this.observerOverlayBuffer);
            if (this.observerOverlayProgram) gl.deleteProgram(this.observerOverlayProgram);
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
        this.observerOverlayBuffer = null;
        this.observerOverlayProgram = null;
        this.observerOverlayLocations = null;
        this.world = null;
        this.ctx = null;
        this.legacyCanvas2DShim = false;
        this.gl = null;
        return true;
    }
}