import { test, expect } from '@playwright/test';

const FIELD_URL = process.env.VTT_FIELD_URL || 'http://127.0.0.1:4173/vtt.html';

test('real WebGL2 token layer draws persistent TokenViews and follows transient preview', async ({ page }) => {
    await page.goto(FIELD_URL, { waitUntil: 'domcontentloaded' });

    const result = await page.evaluate(async () => {
        const [{ createRenderer }, { RENDERER_BACKENDS }] = await Promise.all([
            import('/js/vtt/render/renderer-factory.js'),
            import('/js/vtt/render/renderer-backend.js'),
        ]);

        const canvas = document.createElement('canvas');
        canvas.width = 320;
        canvas.height = 180;
        canvas.style.width = '320px';
        canvas.style.height = '180px';
        document.body.appendChild(canvas);

        const agatha = {
            id: 'agatha', x: 90, y: 80, zLayer: 0,
            icon: 'person', backgroundColor: '#20242a', color: '#ffcc00', iconColor: '#ffffff',
        };
        const upper = { id: 'upper', x: 140, y: 100, zLayer: 1 };
        const mapData = { grid: { cols: 4, rows: 4, size: 70 }, tokens: [agatha, upper] };

        let renderer;
        try {
            renderer = createRenderer(canvas, mapData, { backend: RENDERER_BACKENDS.WEBGL_2 });
        } catch (error) {
            canvas.remove();
            return { supported: false, error: String(error?.message || error) };
        }

        const view = renderer.tokenViews.get('agatha');
        const visual = view.resources.get('webgl2-token-visual')?.resource || null;
        renderer.render(null, 0, null, false);
        const first = renderer.diagnostics().tokenGpu;

        renderer.previewToken('agatha', { x: 170, y: 125, zLayer: 0 });
        renderer.render(null, 0, null, false);
        const preview = {
            canonical: { x: agatha.x, y: agatha.y },
            render: { x: view.renderX, y: view.renderY },
            sameVisual: visual === view.resources.get('webgl2-token-visual')?.resource,
            diagnostics: renderer.diagnostics().tokenGpu,
        };

        renderer.clearTokenPreview('agatha');
        agatha.color = '#00ff88';
        canvas.dispatchEvent(new CustomEvent('vtt:scene-dirty', {
            detail: { reason: 'token', tokenId: 'agatha', render: true, vision: false },
        }));
        renderer.render(null, 0, null, false);
        const material = renderer.diagnostics().tokenGpu;

        mapData.tokens = [upper];
        canvas.dispatchEvent(new CustomEvent('vtt:scene-dirty', {
            detail: { reason: 'token', tokenId: 'agatha', render: true, vision: false },
        }));
        const afterPrune = renderer.diagnostics().tokenGpu;
        const prunedDestroyed = view.destroyed === true;

        renderer.destroy();
        const afterDestroy = renderer.diagnostics().tokenGpu;
        canvas.remove();

        return {
            supported: true,
            backend: renderer.backend,
            first,
            preview,
            material,
            afterPrune,
            afterDestroy,
            prunedDestroyed,
        };
    });

    expect(result.supported, result.error || 'WebGL2 unavailable').toBe(true);
    expect(result.backend).toBe('webgl2');
    expect(result.first).toMatchObject({
        frames: 1,
        drawCalls: 1,
        visibleLastFrame: 1,
        resourcesCreated: 2,
        activeResources: 2,
    });
    expect(result.preview.canonical).toEqual({ x: 90, y: 80 });
    expect(result.preview.render).toEqual({ x: 170, y: 125 });
    expect(result.preview.sameVisual).toBe(true);
    expect(result.preview.diagnostics.drawCalls).toBe(2);
    expect(result.material.materialUpdates).toBeGreaterThanOrEqual(1);
    expect(result.prunedDestroyed).toBe(true);
    expect(result.afterPrune).toMatchObject({ resourcesReleased: 1, activeResources: 1 });
    expect(result.afterDestroy).toMatchObject({ resourcesReleased: 2, activeResources: 0 });
});
