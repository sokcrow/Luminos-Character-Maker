import { test, expect } from '@playwright/test';
import { installPersistentTokenViews } from '../js/vtt/render/persistent-token-views.js';
import { installWebGL2TokenLayer, tokenVisualDescriptor } from '../js/vtt/render/webgl2-token-layer.js';

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
        this.uniformFloats = [];
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
    uniform1f(location, value) { this.uniformFloats.push({ location, value }); }
    uniform4fv() {}
    drawArrays(mode, first, count) { this.draws.push({ mode, first, count }); }
}

function fakeRenderer(tokens) {
    const gl = new FakeGl();
    const canvas = new FakeCanvas();
    return {
        backend: 'webgl2',
        destroyed: false,
        contextLost: false,
        gl,
        canvas,
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
}

function install(tokens) {
    const renderer = installPersistentTokenViews(fakeRenderer(tokens));
    return installWebGL2TokenLayer(renderer);
}

test('GPU token layer keeps one visual resource per persistent TokenView and creates it lazily', () => {
    const agatha = { id: 'agatha', x: 100, y: 120, zLayer: 0, color: '#ffcc00' };
    const renderer = install([agatha]);
    const view = renderer.tokenViews.get('agatha');

    expect(view.resources.has('webgl2-token-visual')).toBe(false);
    renderer.render(null, 0, null, false);
    const firstResource = view.resources.get('webgl2-token-visual')?.resource;
    expect(firstResource).toBeTruthy();

    agatha.x = 150;
    agatha.y = 170;
    renderer.canvas.dispatch('vtt:scene-dirty', { reason: 'token', tokenId: 'agatha' });
    renderer.render(null, 0, null, false);

    expect(renderer.tokenViews.get('agatha')).toBe(view);
    expect(view.resources.get('webgl2-token-visual')?.resource).toBe(firstResource);
    expect(renderer.gl.centers.at(-1)).toEqual({ x: 150, y: 170 });
    expect(renderer.diagnostics().tokenGpu).toMatchObject({
        frames: 2,
        drawCalls: 2,
        visibleLastFrame: 1,
        resourcesCreated: 1,
        resourcesReleased: 0,
        activeResources: 1,
    });
});

test('drag preview renders at renderX/renderY and derives render-only facing without mutating canonical coordinates', () => {
    const token = { id: 'agatha', x: 10, y: 20, zLayer: 0, facingDeg: 90 };
    const renderer = install([token]);
    const view = renderer.tokenViews.get('agatha');

    view.setPreviewPosition(300, 20, 0);
    renderer.render(null, 0, null, false);

    expect(token).toMatchObject({ x: 10, y: 20, facingDeg: 90 });
    expect(view).toMatchObject({ x: 10, y: 20, facingDeg: 90 });
    expect(view.renderX).toBe(300);
    expect(view.renderY).toBe(20);
    expect(view.renderFacingDeg).toBe(0);
    expect(view.motionState).toBe('moving');
    expect(renderer.gl.centers.at(-1)).toEqual({ x: 300, y: 20 });
    expect(renderer.diagnostics().tokenGpu).toMatchObject({ movingLastFrame: 1, facingIndicatorsLastFrame: 1 });

    view.clearPreviewPosition();
    expect(view.renderFacingDeg).toBe(90);
    expect(view.motionState).toBe('idle');
});

test('canonical movement derives facing when no explicit facing exists but explicit facing always wins', () => {
    const token = { id: 'agatha', x: 10, y: 10, zLayer: 0 };
    const renderer = install([token]);
    const view = renderer.tokenViews.get('agatha');

    token.y = 110;
    renderer.canvas.dispatch('vtt:scene-dirty', { reason: 'token', tokenId: 'agatha' });
    expect(view.facingDeg).toBe(90);
    expect(token.facingDeg).toBeUndefined();

    token.lookState = { yawDeg: 225 };
    renderer.canvas.dispatch('vtt:scene-dirty', { reason: 'token', tokenId: 'agatha' });
    expect(view.facingDeg).toBe(225);
    expect(token.lookState.yawDeg).toBe(225);
});

test('z layer visibility and viewport culling avoid unnecessary GPU draws and resource allocation', () => {
    const renderer = install([
        { id: 'visible', x: 100, y: 100, zLayer: 0 },
        { id: 'other-floor', x: 120, y: 120, zLayer: 1 },
        { id: 'offscreen', x: 5000, y: 5000, zLayer: 0 },
    ]);
    const camera = { zoom: 1 };

    const drawn = renderer.drawTokens(0, camera, null, false);

    expect(drawn).toBe(1);
    expect(renderer.tokenViews.get('visible').resources.has('webgl2-token-visual')).toBe(true);
    expect(renderer.tokenViews.get('other-floor').resources.has('webgl2-token-visual')).toBe(false);
    expect(renderer.tokenViews.get('offscreen').resources.has('webgl2-token-visual')).toBe(false);
    expect(renderer.diagnostics().tokenGpu).toMatchObject({
        visibleLastFrame: 1,
        candidatesLastFrame: 2,
        culledLastFrame: 1,
        lazySkippedLastFrame: 1,
        resourcesCreated: 1,
        resourcesCreatedLastFrame: 1,
        activeResources: 1,
    });
});

test('500-token culling stress materializes only the visible working set and stays stable on repeat frame', () => {
    const tokens = Array.from({ length: 500 }, (_, index) => ({
        id: `token-${index}`,
        x: index < 20 ? 30 + (index * 20) : 5000 + (index * 30),
        y: index < 20 ? 100 : 5000,
        zLayer: 0,
    }));
    const renderer = install(tokens);
    const camera = { zoom: 1 };

    expect(renderer.drawTokens(0, camera, null, false)).toBe(20);
    expect(renderer.diagnostics().tokenGpu).toMatchObject({
        candidatesLastFrame: 500,
        visibleLastFrame: 20,
        culledLastFrame: 480,
        lazySkippedLastFrame: 480,
        resourcesCreated: 20,
        resourcesCreatedLastFrame: 20,
        activeResources: 20,
    });

    expect(renderer.drawTokens(0, camera, null, false)).toBe(20);
    expect(renderer.diagnostics().tokenGpu).toMatchObject({
        resourcesCreated: 20,
        resourcesCreatedLastFrame: 0,
        activeResources: 20,
    });
});

test('material changes update cached visual data without replacing the resource', () => {
    const token = { id: 'agatha', x: 20, y: 20, zLayer: 0, color: '#ffffff' };
    const renderer = install([token]);
    const view = renderer.tokenViews.get('agatha');
    renderer.render(null, 0, null, false);
    const resource = view.resources.get('webgl2-token-visual')?.resource;

    token.color = '#ff0000';
    renderer.canvas.dispatch('vtt:scene-dirty', { reason: 'token', tokenId: 'agatha' });
    expect(view.resources.get('webgl2-token-visual')?.resource).toBe(resource);
    renderer.render(null, 0, null, false);

    expect(view.resources.get('webgl2-token-visual')?.resource).toBe(resource);
    expect(renderer.diagnostics().tokenGpu.materialUpdates).toBe(1);
});

test('removing/destroying TokenViews releases materialized visual resources exactly once', () => {
    const agatha = { id: 'agatha', x: 20, y: 20, zLayer: 0 };
    const bob = { id: 'bob', x: 40, y: 40, zLayer: 0 };
    const renderer = install([agatha, bob]);
    renderer.render(null, 0, null, false);

    renderer.mapData.tokens = [bob];
    renderer.canvas.dispatch('vtt:scene-dirty', { reason: 'token', tokenId: 'agatha' });
    expect(renderer.diagnostics().tokenGpu).toMatchObject({ resourcesCreated: 2, resourcesReleased: 1, activeResources: 1 });

    expect(renderer.destroy()).toBe(true);
    expect(renderer.diagnostics().tokenGpu).toMatchObject({ resourcesCreated: 2, resourcesReleased: 2, activeResources: 0 });
    expect(renderer.gl.deletedPrograms).toBeGreaterThanOrEqual(1);
    expect(renderer.gl.deletedBuffers).toBeGreaterThanOrEqual(1);
});

test('visual descriptor preserves Canvas token styling contract', () => {
    const descriptor = tokenVisualDescriptor({
        token: {
            icon: 'person',
            radius: 35,
            backgroundColor: '#20242a',
            color: '#ffcc00',
            iconColor: '#ffffff',
            verticalMovement: { kind: 'jump' },
        },
    }, { grid: { size: 70 } });

    expect(descriptor).toMatchObject({
        radius: 35,
        icon: 'person',
        personIcon: true,
        verticalAlpha: 0.82,
        backgroundColor: '#20242a',
        borderColor: '#ffcc00',
        iconColor: '#ffffff',
    });
});
