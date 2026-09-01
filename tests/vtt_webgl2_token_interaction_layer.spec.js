import { test, expect } from '@playwright/test';
import { installPersistentTokenViews } from '../js/vtt/render/persistent-token-views.js';
import { installTokenInteractionViews } from '../js/vtt/render/token-interaction-view.js';
import { installWebGL2TokenInteractionLayer, tokenInteractionStyle } from '../js/vtt/render/webgl2-token-interaction-layer.js';

class FakeCanvas {
    constructor() {
        this.listeners = new Map();
    }
    addEventListener(type, handler) {
        if (!this.listeners.has(type)) this.listeners.set(type, new Set());
        this.listeners.get(type).add(handler);
    }
    removeEventListener(type, handler) {
        this.listeners.get(type)?.delete(handler);
    }
    dispatch(type, detail = {}) {
        for (const handler of this.listeners.get(type) || []) handler({ type, detail, target: this });
    }
}

class FakeGl {
    constructor() {
        this.VERTEX_SHADER = 1;
        this.FRAGMENT_SHADER = 2;
        this.LINK_STATUS = 3;
        this.ARRAY_BUFFER = 4;
        this.STATIC_DRAW = 5;
        this.FLOAT = 6;
        this.TRIANGLE_STRIP = 7;
        this.draws = [];
        this.centers = [];
        this.radii = [];
        this.deletedPrograms = 0;
        this.deletedBuffers = 0;
    }
    createProgram() { return {}; }
    attachShader() {}
    linkProgram() {}
    deleteShader() {}
    getProgramParameter() { return true; }
    getProgramInfoLog() { return ''; }
    deleteProgram() { this.deletedPrograms += 1; }
    createBuffer() { return {}; }
    bindBuffer() {}
    bufferData() {}
    deleteBuffer() { this.deletedBuffers += 1; }
    getAttribLocation() { return 0; }
    getUniformLocation(_program, name) { return name; }
    useProgram() {}
    enableVertexAttribArray() {}
    vertexAttribPointer() {}
    uniformMatrix3fv() {}
    uniform2f(_location, x, y) { this.centers.push({ x, y }); }
    uniform1f(location, value) { if (location === 'u_radius') this.radii.push(value); }
    uniform4fv() {}
    drawArrays(mode, first, count) { this.draws.push({ mode, first, count }); }
}

function install(tokens) {
    const gl = new FakeGl();
    const renderer = {
        backend: 'webgl2',
        destroyed: false,
        contextLost: false,
        gl,
        canvas: new FakeCanvas(),
        mapData: { grid: { size: 70 }, tokens },
        world: { matrix: new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]) },
        logicalViewport: { width: 640, height: 360 },
        layers: new Map([['tokens', { visible: true, dirty: true }]]),
        compileShader() { return {}; },
        worldToScreen(x, y) { return { x, y }; },
        renderCalls: 0,
        render() { this.renderCalls += 1; return this.renderCalls; },
        diagnostics() { return { backend: this.backend }; },
        destroy() {
            if (this.destroyed) return false;
            this.destroyed = true;
            return true;
        },
    };
    installPersistentTokenViews(renderer);
    installTokenInteractionViews(renderer);
    installWebGL2TokenInteractionLayer(renderer);
    return renderer;
}

test('interaction overlay performs zero draw calls when no token is hovered or selected', () => {
    const renderer = install([{ id: 'agatha', x: 100, y: 100, zLayer: 0 }]);
    expect(renderer.drawTokenInteractions(0, { zoom: 1 }, null, false)).toBe(0);
    expect(renderer.diagnostics().tokenInteractionGpu).toMatchObject({ visibleLastFrame: 0, drawCalls: 0 });
});

test('hover and selection draw one GPU ring over the same persistent TokenView', () => {
    const renderer = install([{ id: 'agatha', x: 100, y: 120, zLayer: 0, radius: 30, color: '#6699cc' }]);
    const view = renderer.tokenViews.get('agatha');

    renderer.setTokenHovered('agatha');
    expect(renderer.drawTokenInteractions(0, { zoom: 1 }, null, false)).toBe(1);
    expect(renderer.gl.centers.at(-1)).toEqual({ x: 100, y: 120 });
    expect(tokenInteractionStyle(view).state).toBe('hovered');

    renderer.setTokenSelected('agatha');
    expect(renderer.drawTokenInteractions(0, { zoom: 1 }, null, false)).toBe(1);
    expect(renderer.tokenViews.get('agatha')).toBe(view);
    expect(tokenInteractionStyle(view).state).toBe('selected');
    expect(renderer.diagnostics().tokenInteractionGpu).toMatchObject({ selectedLastFrame: 1, visibleLastFrame: 1 });
});

test('interaction overlay follows transient drag preview coordinates', () => {
    const token = { id: 'agatha', x: 20, y: 30, zLayer: 0, radius: 28 };
    const renderer = install([token]);
    const view = renderer.tokenViews.get('agatha');
    renderer.setTokenSelected('agatha');
    view.setPreviewPosition(300, 220, 0);

    renderer.drawTokenInteractions(0, null, null, false);

    expect(renderer.gl.centers.at(-1)).toEqual({ x: 300, y: 220 });
    expect(token).toMatchObject({ x: 20, y: 30 });
    expect(view).toMatchObject({ x: 20, y: 30, selected: true });
});

test('interaction overlay respects active zLayer and viewport culling', () => {
    const renderer = install([
        { id: 'visible', x: 100, y: 100, zLayer: 0 },
        { id: 'other-floor', x: 120, y: 120, zLayer: 1 },
        { id: 'offscreen', x: 5000, y: 5000, zLayer: 0 },
    ]);
    renderer.setTokenHovered('visible');
    renderer.setTokenSelected('other-floor');
    renderer.setTokenTargeted('offscreen');

    const drawn = renderer.drawTokenInteractions(0, { zoom: 1 }, null, false);

    expect(drawn).toBe(1);
    expect(renderer.diagnostics().tokenInteractionGpu).toMatchObject({ visibleLastFrame: 1, hoveredLastFrame: 1, culledLastFrame: 1 });
});

test('100 hover transitions do not allocate TokenView resources or recreate views', () => {
    const renderer = install([
        { id: 'agatha', x: 100, y: 100, zLayer: 0 },
        { id: 'bob', x: 150, y: 100, zLayer: 0 },
    ]);
    const agatha = renderer.tokenViews.get('agatha');
    const bob = renderer.tokenViews.get('bob');
    const created = renderer.diagnostics().tokenViews.created;

    for (let index = 0; index < 100; index += 1) renderer.setTokenHovered(index % 2 === 0 ? 'agatha' : 'bob');

    expect(renderer.tokenViews.get('agatha')).toBe(agatha);
    expect(renderer.tokenViews.get('bob')).toBe(bob);
    expect(renderer.diagnostics().tokenViews.created).toBe(created);
    expect(agatha.resources.size).toBe(0);
    expect(bob.resources.size).toBe(0);
});
