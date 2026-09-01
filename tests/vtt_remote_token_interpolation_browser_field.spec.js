import { test, expect } from '@playwright/test';

const FIELD_URL = process.env.VTT_FIELD_URL || 'http://127.0.0.1:4173/vtt.html';

test('real WebGL2 remote movement interpolates one persistent TokenView without canonical or texture churn', async ({ page }) => {
    await page.goto(FIELD_URL, { waitUntil: 'domcontentloaded' });

    const result = await page.evaluate(async () => {
        const [{ createRenderer }, { RENDERER_BACKENDS }] = await Promise.all([
            import('/js/vtt/render/renderer-factory.js'),
            import('/js/vtt/render/renderer-backend.js'),
        ]);
        const icon = `data:image/svg+xml;charset=utf-8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><rect width="96" height="96" fill="#9955cc"/></svg>')}`;
        const canvas = document.createElement('canvas');
        canvas.width = 420;
        canvas.height = 240;
        canvas.style.width = '420px';
        canvas.style.height = '240px';
        document.body.appendChild(canvas);

        const agatha = {
            id: 'agatha', x: 90, y: 100, zLayer: 0, z: [0], radius: 28,
            gridPosition: { col: 1, row: 1, z: 0 }, icono: icon, color: '#bb88ff',
        };
        const mapData = { grid: { cols: 8, rows: 6, size: 70 }, tokens: [agatha] };
        let renderer;
        try {
            renderer = createRenderer(canvas, mapData, { backend: RENDERER_BACKENDS.WEBGL_2 });
        } catch (error) {
            canvas.remove();
            return { supported: false, error: String(error?.message || error) };
        }

        const view = renderer.tokenViews.get('agatha');
        const lazyBeforeDraw = view.resources.has('webgl2-token-visual');
        renderer.render(null, 0, null, false);

        const textureDeadline = performance.now() + 2500;
        while (performance.now() < textureDeadline && renderer.diagnostics().tokenTextures?.readyEntries !== 1) {
            await new Promise((resolve) => setTimeout(resolve, 20));
        }

        const visual = view.resources.get('webgl2-token-visual')?.resource;
        const canonicalStart = { x: agatha.x, y: agatha.y, zLayer: agatha.zLayer };

        // Emulate movement-realtime's current ordering: incoming preview mutates the
        // token immediately before dispatching the remote semantic event.
        agatha.x = 250;
        agatha.y = 140;
        canvas.dispatchEvent(new CustomEvent('vtt:token-preview-moved', {
            detail: { tokenId: 'agatha', remote: true, sequence: 10, x: 250, y: 140, z: 0, traversing: true },
        }));
        const immediatelyAfterRemote = {
            canonical: { x: agatha.x, y: agatha.y, zLayer: agatha.zLayer },
            renderX: view.renderX,
            renderY: view.renderY,
        };

        const interpolationDeadline = performance.now() + 700;
        while (performance.now() < interpolationDeadline && Math.abs(view.renderX - 250) > 0.5) {
            await new Promise((resolve) => requestAnimationFrame(resolve));
        }
        renderer.render(null, 0, null, false);
        const afterInterpolation = {
            canonical: { x: agatha.x, y: agatha.y, zLayer: agatha.zLayer },
            renderX: view.renderX,
            renderY: view.renderY,
            sameView: renderer.tokenViews.get('agatha') === view,
            sameVisual: view.resources.get('webgl2-token-visual')?.resource === visual,
            diagnostics: renderer.diagnostics(),
        };

        // Older sequence must not pull the rendered token backwards.
        agatha.x = 150;
        agatha.y = 110;
        canvas.dispatchEvent(new CustomEvent('vtt:token-preview-moved', {
            detail: { tokenId: 'agatha', remote: true, sequence: 9, x: 150, y: 110, z: 0, traversing: true },
        }));
        const afterStale = {
            canonical: { x: agatha.x, y: agatha.y, zLayer: agatha.zLayer },
            renderX: view.renderX,
            dropped: renderer.diagnostics().remoteTokenInterpolation?.droppedOutOfOrder,
        };

        // Final committed preview stays visually at the endpoint until canonical
        // token-state reaches the same point, then preview is released cleanly.
        agatha.x = 250;
        agatha.y = 140;
        canvas.dispatchEvent(new CustomEvent('vtt:token-preview-moved', {
            detail: { tokenId: 'agatha', remote: true, sequence: 10, x: 250, y: 140, z: 0, committed: true, cleared: true },
        }));
        const duringCommitHold = {
            canonical: { x: agatha.x, y: agatha.y },
            renderX: view.renderX,
            awaitingCanonical: renderer.diagnostics().remoteTokenInterpolation?.awaitingCanonical,
        };

        agatha.x = 250;
        agatha.y = 140;
        canvas.dispatchEvent(new CustomEvent('vtt:canonical-tokens-synced', { detail: { scope: 'players' } }));
        const afterCanonical = {
            viewX: view.x,
            viewY: view.y,
            renderX: view.renderX,
            renderY: view.renderY,
            hasPreview: view.hasPreview,
            sameView: renderer.tokenViews.get('agatha') === view,
            sameVisual: view.resources.get('webgl2-token-visual')?.resource === visual,
            diagnostics: renderer.diagnostics(),
        };

        renderer.destroy();
        canvas.remove();
        return {
            supported: true,
            lazyBeforeDraw,
            canonicalStart,
            immediatelyAfterRemote,
            afterInterpolation,
            afterStale,
            duringCommitHold,
            afterCanonical,
        };
    });

    expect(result.supported, result.error || 'WebGL2 unavailable').toBe(true);
    expect(result.lazyBeforeDraw).toBe(false);
    expect(result.immediatelyAfterRemote.canonical).toEqual(result.canonicalStart);
    expect(result.immediatelyAfterRemote.renderX).toBe(result.canonicalStart.x);
    expect(result.afterInterpolation.canonical).toEqual(result.canonicalStart);
    expect(result.afterInterpolation.renderX).toBeCloseTo(250, 0);
    expect(result.afterInterpolation.renderY).toBeCloseTo(140, 0);
    expect(result.afterInterpolation.sameView).toBe(true);
    expect(result.afterInterpolation.sameVisual).toBe(true);
    expect(result.afterInterpolation.diagnostics.tokenViews.created).toBe(1);
    expect(result.afterInterpolation.diagnostics.tokenTextures).toMatchObject({ loads: 1, activeEntries: 1, activeReferences: 1, readyEntries: 1 });
    expect(result.afterStale.canonical).toEqual(result.canonicalStart);
    expect(result.afterStale.renderX).toBeCloseTo(250, 0);
    expect(result.afterStale.dropped).toBe(1);
    expect(result.duringCommitHold.canonical).toEqual({ x: 90, y: 100 });
    expect(result.duringCommitHold.renderX).toBeCloseTo(250, 0);
    expect(result.duringCommitHold.awaitingCanonical).toBe(1);
    expect(result.afterCanonical).toMatchObject({
        viewX: 250,
        viewY: 140,
        renderX: 250,
        renderY: 140,
        hasPreview: false,
        sameView: true,
        sameVisual: true,
    });
    expect(result.afterCanonical.diagnostics.remoteTokenInterpolation).toMatchObject({
        acceptedSnapshots: 1,
        droppedOutOfOrder: 1,
        canonicalReleases: 1,
        activeTracks: 0,
    });
});
