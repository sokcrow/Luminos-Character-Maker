import { test, expect } from '@playwright/test';

const FIELD_URL = process.env.VTT_FIELD_URL || 'http://127.0.0.1:4173/vtt.html';

test('real WebGL2 token layer keeps orientation render-side and materializes only visible TokenViews', async ({ page }) => {
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
            id: 'agatha', x: 90, y: 80, zLayer: 0, facingDeg: 90,
            icon: 'person', backgroundColor: '#20242a', color: '#ffcc00', iconColor: '#ffffff',
        };
        const upper = { id: 'upper', x: 140, y: 100, zLayer: 1 };
        const offscreen = { id: 'offscreen', x: 5000, y: 5000, zLayer: 0 };
        const mapData = { grid: { cols: 80, rows: 80, size: 70 }, tokens: [agatha, upper, offscreen] };

        let renderer;
        try {
            renderer = createRenderer(canvas, mapData, { backend: RENDERER_BACKENDS.WEBGL_2 });
        } catch (error) {
            canvas.remove();
            return { supported: false, error: String(error?.message || error) };
        }

        const view = renderer.tokenViews.get('agatha');
        const initialResources = {
            agatha: view.resources.has('webgl2-token-visual'),
            upper: renderer.tokenViews.get('upper').resources.has('webgl2-token-visual'),
            offscreen: renderer.tokenViews.get('offscreen').resources.has('webgl2-token-visual'),
        };

        // Use the production render entrypoint so world/camera transforms are
        // synchronized before viewport culling runs.
        renderer.render(null, 0, null, false);
        const visual = view.resources.get('webgl2-token-visual')?.resource || null;
        const first = renderer.diagnostics().tokenGpu;
        const afterFirstResources = {
            agatha: view.resources.has('webgl2-token-visual'),
            upper: renderer.tokenViews.get('upper').resources.has('webgl2-token-visual'),
            offscreen: renderer.tokenViews.get('offscreen').resources.has('webgl2-token-visual'),
        };

        renderer.previewToken('agatha', { x: 170, y: 80, zLayer: 0 });
        renderer.render(null, 0, null, false);
        const preview = {
            canonical: { x: agatha.x, y: agatha.y, facingDeg: agatha.facingDeg },
            render: { x: view.renderX, y: view.renderY, facingDeg: view.renderFacingDeg },
            motionState: view.motionState,
            sameVisual: visual === view.resources.get('webgl2-token-visual')?.resource,
            diagnostics: renderer.diagnostics().tokenGpu,
        };

        renderer.clearTokenPreview('agatha');
        const afterClear = { facingDeg: view.renderFacingDeg, motionState: view.motionState };
        agatha.color = '#00ff88';
        canvas.dispatchEvent(new CustomEvent('vtt:scene-dirty', {
            detail: { reason: 'token', tokenId: 'agatha', render: true, vision: false },
        }));
        renderer.render(null, 0, null, false);
        const material = renderer.diagnostics().tokenGpu;

        mapData.tokens = [upper, offscreen];
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
            initialResources,
            afterFirstResources,
            first,
            preview,
            afterClear,
            material,
            afterPrune,
            afterDestroy,
            prunedDestroyed,
        };
    });

    expect(result.supported, result.error || 'WebGL2 unavailable').toBe(true);
    expect(result.backend).toBe('webgl2');
    expect(result.initialResources).toEqual({ agatha: false, upper: false, offscreen: false });
    expect(result.afterFirstResources).toEqual({ agatha: true, upper: false, offscreen: false });
    expect(result.first).toMatchObject({
        frames: 1,
        drawCalls: 1,
        visibleLastFrame: 1,
        candidatesLastFrame: 2,
        culledLastFrame: 1,
        lazySkippedLastFrame: 1,
        resourcesCreated: 1,
        activeResources: 1,
        facingIndicatorsLastFrame: 1,
    });
    expect(result.preview.canonical).toEqual({ x: 90, y: 80, facingDeg: 90 });
    expect(result.preview.render).toEqual({ x: 170, y: 80, facingDeg: 0 });
    expect(result.preview.motionState).toBe('moving');
    expect(result.preview.sameVisual).toBe(true);
    expect(result.preview.diagnostics).toMatchObject({ drawCalls: 2, movingLastFrame: 1 });
    expect(result.afterClear).toEqual({ facingDeg: 90, motionState: 'idle' });
    expect(result.material.materialUpdates).toBeGreaterThanOrEqual(1);
    expect(result.prunedDestroyed).toBe(true);
    expect(result.afterPrune).toMatchObject({ resourcesReleased: 1, activeResources: 0 });
    expect(result.afterDestroy).toMatchObject({ resourcesReleased: 1, activeResources: 0 });
});
