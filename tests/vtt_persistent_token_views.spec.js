import { test, expect } from '@playwright/test';
import { installPersistentTokenViews } from '../js/vtt/render/persistent-token-views.js';

function fakeWebGLRenderer(tokens = []) {
    return {
        backend: 'webgl2',
        destroyed: false,
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

test('WebGL2 render syncs persistent views without recreating moved tokens', () => {
    const agatha = { id: 'agatha', x: 100, y: 100, zLayer: 0 };
    const renderer = installPersistentTokenViews(fakeWebGLRenderer([agatha]));

    renderer.render();
    const first = renderer.tokenViews.get('agatha');
    agatha.x = 500;
    agatha.y = 300;
    renderer.render();

    expect(renderer.tokenViews.get('agatha')).toBe(first);
    expect(first.x).toBe(500);
    expect(first.y).toBe(300);
    expect(renderer.tokenViews.diagnostics()).toEqual({
        created: 1,
        destroyed: 0,
        positionUpdates: 1,
        active: 1,
    });
});

test('WebGL2 render prunes a token that leaves mapData', () => {
    const renderer = installPersistentTokenViews(fakeWebGLRenderer([
        { id: 'agatha' },
        { id: 'goblin' },
    ]));

    renderer.render();
    const goblin = renderer.tokenViews.get('goblin');
    renderer.mapData.tokens = [{ id: 'agatha' }];
    renderer.render();

    expect(goblin.destroyed).toBe(true);
    expect(renderer.tokenViews.get('goblin')).toBeUndefined();
    expect(renderer.tokenViews.diagnostics().active).toBe(1);
});

test('renderer destroy clears all persistent views exactly once', () => {
    const renderer = installPersistentTokenViews(fakeWebGLRenderer([
        { id: 'agatha' },
        { id: 'bob' },
    ]));

    renderer.render();
    expect(renderer.destroy()).toBe(true);
    expect(renderer.destroy()).toBe(false);

    expect(renderer.tokenViews.diagnostics()).toEqual({
        created: 2,
        destroyed: 2,
        positionUpdates: 0,
        active: 0,
    });
    expect(renderer.destroyCalls).toBe(1);
});

test('renderer diagnostics expose TokenView lifecycle counters', () => {
    const renderer = installPersistentTokenViews(fakeWebGLRenderer([{ id: 'agatha' }]));
    renderer.drawTokens(0);

    expect(renderer.drawTokenCalls).toBe(1);
    expect(renderer.diagnostics()).toMatchObject({
        backend: 'webgl2',
        tokenViews: {
            created: 1,
            destroyed: 0,
            active: 1,
        },
    });
});

test('Canvas2D renderer is not modified by the WebGL2 TokenView installer', () => {
    const renderer = { backend: 'canvas2d' };
    expect(installPersistentTokenViews(renderer)).toBe(renderer);
    expect(renderer.tokenViews).toBeUndefined();
});
