import { test, expect } from '@playwright/test';
import { installPersistentTokenViews } from '../js/vtt/render/persistent-token-views.js';

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

function fakeWebGLRenderer(tokens = []) {
    return {
        backend: 'webgl2',
        destroyed: false,
        canvas: new FakeCanvas(),
        mapData: { tokens },
        renderCalls: 0,
        drawTokenCalls: 0,
        destroyCalls: 0,
        render() { this.renderCalls += 1; },
        drawTokens() { this.drawTokenCalls += 1; return 0; },
        diagnostics() { return { backend: this.backend, destroyed: this.destroyed }; },
        destroy() {
            if (this.destroyed) return false;
            this.destroyed = true;
            this.destroyCalls += 1;
            return true;
        },
    };
}

function tokenDirty(renderer, tokenId) {
    renderer.canvas.dispatch('vtt:scene-dirty', { reason: 'token', tokenId });
}

test('renders no longer full-scan tokens and one dirty id updates one persistent view', () => {
    const agatha = { id: 'agatha', x: 100, y: 100, zLayer: 0 };
    const bob = { id: 'bob', x: 20, y: 40, zLayer: 0 };
    const renderer = installPersistentTokenViews(fakeWebGLRenderer([agatha, bob]));
    const first = renderer.tokenViews.get('agatha');

    for (let frame = 0; frame < 100; frame += 1) renderer.render();
    expect(renderer.tokenViews.diagnostics().fullSyncs).toBe(1);

    agatha.x = 500;
    agatha.y = 300;
    tokenDirty(renderer, 'agatha');

    expect(renderer.tokenViews.get('agatha')).toBe(first);
    expect(first.x).toBe(500);
    expect(first.y).toBe(300);
    expect(renderer.tokenViews.diagnostics()).toMatchObject({
        created: 2,
        destroyed: 0,
        positionUpdates: 1,
        targetedSyncs: 1,
        fullSyncs: 1,
        active: 2,
    });
});

test('targeted dirty for a removed token prunes only that view', () => {
    const agatha = { id: 'agatha' };
    const goblin = { id: 'goblin' };
    const renderer = installPersistentTokenViews(fakeWebGLRenderer([agatha, goblin]));
    const goblinView = renderer.tokenViews.get('goblin');

    renderer.mapData.tokens = [agatha];
    tokenDirty(renderer, 'goblin');

    expect(goblinView.destroyed).toBe(true);
    expect(renderer.tokenViews.get('goblin')).toBeUndefined();
    expect(renderer.tokenViews.get('agatha').destroyed).toBe(false);
    expect(renderer.tokenViews.diagnostics()).toMatchObject({ fullSyncs: 1, active: 1 });
});

test('token dirty without id remains a safe full batch fallback', () => {
    const renderer = installPersistentTokenViews(fakeWebGLRenderer([{ id: 'agatha' }]));
    renderer.mapData.tokens.push({ id: 'bob' });

    renderer.canvas.dispatch('vtt:scene-dirty', { reason: 'token', tokenId: null });

    expect(renderer.tokenViews.get('bob')).toBeDefined();
    expect(renderer.tokenViews.diagnostics()).toMatchObject({ created: 2, fullSyncs: 2, active: 2 });
});

test('identical targeted state does not increment position work', () => {
    const agatha = { id: 'agatha', x: 100, y: 100, zLayer: 0 };
    const renderer = installPersistentTokenViews(fakeWebGLRenderer([agatha]));

    for (let update = 0; update < 1000; update += 1) tokenDirty(renderer, 'agatha');

    expect(renderer.tokenViews.diagnostics()).toMatchObject({
        created: 1,
        positionUpdates: 0,
        targetedSyncs: 1000,
        fullSyncs: 1,
        active: 1,
    });
});

test('renderer destroy removes listener and clears all persistent views exactly once', () => {
    const renderer = installPersistentTokenViews(fakeWebGLRenderer([
        { id: 'agatha' },
        { id: 'bob' },
    ]));

    expect(renderer.destroy()).toBe(true);
    expect(renderer.destroy()).toBe(false);

    expect(renderer.tokenViews.diagnostics()).toMatchObject({
        created: 2,
        destroyed: 2,
        positionUpdates: 0,
        fullSyncs: 1,
        active: 0,
    });
    expect(renderer.destroyCalls).toBe(1);
});

test('renderer diagnostics expose incremental TokenView counters', () => {
    const renderer = installPersistentTokenViews(fakeWebGLRenderer([{ id: 'agatha' }]));
    renderer.drawTokens(0);

    expect(renderer.drawTokenCalls).toBe(1);
    expect(renderer.diagnostics()).toMatchObject({
        backend: 'webgl2',
        tokenViews: {
            created: 1,
            destroyed: 0,
            targetedSyncs: 0,
            fullSyncs: 1,
            active: 1,
        },
    });
});

test('Canvas2D renderer is not modified by the WebGL2 TokenView installer', () => {
    const renderer = { backend: 'canvas2d' };
    expect(installPersistentTokenViews(renderer)).toBe(renderer);
    expect(renderer.tokenViews).toBeUndefined();
});
