import { test, expect } from '@playwright/test';
import { TokenViewRegistry } from '../js/vtt/render/token-view-registry.js';
import { installTransientTokenPreview } from '../js/vtt/render/transient-token-preview.js';

function canvasRenderer(token) {
    const drawSnapshots = [];
    return {
        backend: 'canvas2d',
        mapData: { tokens: [token] },
        drawSnapshots,
        drawTokens() {
            const current = this.mapData.tokens[0];
            drawSnapshots.push({
                token: current,
                x: current.x,
                y: current.y,
                zLayer: current.zLayer,
                transientPreview: current.transientPreview === true,
            });
        },
        diagnostics() { return { backend: this.backend }; },
        destroy() { return true; },
    };
}

test('Canvas2D draws a transient token preview without mutating canonical token state', () => {
    const token = { id: 'agatha', x: 70, y: 140, zLayer: 0, gridPosition: { col: 1, row: 2, z: 0 } };
    const renderer = installTransientTokenPreview(canvasRenderer(token));
    const originalTokens = renderer.mapData.tokens;

    expect(renderer.previewToken('agatha', { x: 420, y: 350, zLayer: 0 })).toBe(true);
    renderer.drawTokens(0);

    expect(renderer.drawSnapshots[0]).toMatchObject({ x: 420, y: 350, zLayer: 0, transientPreview: true });
    expect(renderer.drawSnapshots[0].token).not.toBe(token);
    expect(renderer.mapData.tokens).toBe(originalTokens);
    expect(renderer.mapData.tokens[0]).toBe(token);
    expect(token).toMatchObject({ x: 70, y: 140, zLayer: 0 });

    expect(renderer.clearTokenPreview('agatha')).toBe(true);
    renderer.drawTokens(0);
    expect(renderer.drawSnapshots[1]).toMatchObject({ x: 70, y: 140, transientPreview: false });
    expect(renderer.diagnostics().transientTokenPreview).toEqual({ updates: 1, clears: 1, cacheMisses: 1, active: 0 });
});

test('WebGL2 TokenView keeps canonical and render positions separate during drag preview', () => {
    const token = { id: 'agatha', x: 10, y: 20, zLayer: 0 };
    const registry = new TokenViewRegistry();
    registry.sync([token]);
    const originalView = registry.get('agatha');
    const renderer = installTransientTokenPreview({
        backend: 'webgl2',
        mapData: { tokens: [token] },
        tokenViews: registry,
        diagnostics() { return { backend: this.backend }; },
        destroy() { return true; },
    });

    for (let index = 1; index <= 1000; index += 1) {
        renderer.previewToken('agatha', { x: index, y: index * 2, zLayer: 0 });
    }

    const view = registry.get('agatha');
    expect(view).toBe(originalView);
    expect(view.x).toBe(10);
    expect(view.y).toBe(20);
    expect(view.renderX).toBe(1000);
    expect(view.renderY).toBe(2000);
    expect(token).toMatchObject({ x: 10, y: 20 });
    expect(registry.diagnostics()).toMatchObject({ created: 1, destroyed: 0, positionUpdates: 0, fullSyncs: 1, active: 1 });

    expect(renderer.clearTokenPreview('agatha')).toBe(true);
    expect(view.hasPreview).toBe(false);
    expect(view.renderX).toBe(10);
    expect(view.renderY).toBe(20);
    expect(renderer.diagnostics().transientTokenPreview).toEqual({ updates: 1000, clears: 1, cacheMisses: 0, active: 0 });
});

test('duplicate preview coordinates do not create redundant renderer updates', () => {
    const token = { id: 'agatha', x: 0, y: 0, zLayer: 0 };
    const renderer = installTransientTokenPreview(canvasRenderer(token));

    expect(renderer.previewToken('agatha', { x: 100, y: 200, zLayer: 0 })).toBe(true);
    for (let index = 0; index < 1000; index += 1) {
        expect(renderer.previewToken('agatha', { x: 100, y: 200, zLayer: 0 })).toBe(false);
    }

    expect(renderer.diagnostics().transientTokenPreview).toEqual({ updates: 1, clears: 0, cacheMisses: 1, active: 1 });
});
