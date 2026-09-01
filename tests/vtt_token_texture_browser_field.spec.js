import { test, expect } from '@playwright/test';

const FIELD_URL = process.env.VTT_FIELD_URL || 'http://127.0.0.1:4173/vtt.html';

test('real WebGL2 token uses assigned Actor texture without recreating TokenView or visual resource', async ({ page }) => {
    await page.goto(FIELD_URL, { waitUntil: 'domcontentloaded' });

    const result = await page.evaluate(async () => {
        const [{ createRenderer }, { RENDERER_BACKENDS }] = await Promise.all([
            import('/js/vtt/render/renderer-factory.js'),
            import('/js/vtt/render/renderer-backend.js'),
        ]);
        const svg = (fill) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="80" height="120"><rect width="80" height="120" fill="${fill}"/></svg>`)}`;
        const firstIcon = svg('#dd3355');
        const secondIcon = svg('#33aadd');
        const canvas = document.createElement('canvas');
        canvas.width = 320;
        canvas.height = 180;
        canvas.style.width = '320px';
        canvas.style.height = '180px';
        document.body.appendChild(canvas);

        const agatha = { id: 'agatha', x: 90, y: 90, zLayer: 0, radius: 28, icono: firstIcon };
        const mapData = { grid: { cols: 4, rows: 4, size: 70 }, tokens: [agatha] };
        let renderer;
        try {
            renderer = createRenderer(canvas, mapData, { backend: RENDERER_BACKENDS.WEBGL_2 });
        } catch (error) {
            canvas.remove();
            return { supported: false, error: String(error?.message || error) };
        }

        const waitReady = async (expectedLoads) => {
            const deadline = performance.now() + 2500;
            while (performance.now() < deadline) {
                const diagnostics = renderer.diagnostics().tokenTextures;
                if (diagnostics.loads >= expectedLoads && diagnostics.readyEntries === 1) return diagnostics;
                await new Promise((resolve) => setTimeout(resolve, 20));
            }
            return renderer.diagnostics().tokenTextures;
        };

        const view = renderer.tokenViews.get('agatha');
        const visual = view.resources.get('webgl2-token-visual')?.resource;
        const firstReady = await waitReady(1);
        renderer.render(null, 0, null, false);

        for (let i = 0; i < 1000; i += 1) renderer.previewToken('agatha', { x: 90 + (i % 80), y: 90 + (i % 40), zLayer: 0 });
        renderer.render(null, 0, null, false);
        const sameAfterPreview = view.resources.get('webgl2-token-visual')?.resource === visual;
        const canonicalAfterPreview = { x: agatha.x, y: agatha.y };

        renderer.clearTokenPreview('agatha');
        agatha.icono = secondIcon;
        canvas.dispatchEvent(new CustomEvent('vtt:scene-dirty', { detail: { reason: 'token', tokenId: 'agatha', render: true, vision: false } }));
        const secondReady = await waitReady(2);
        renderer.render(null, 0, null, false);
        const sameAfterTextureChange = view.resources.get('webgl2-token-visual')?.resource === visual;
        const diagnostics = renderer.diagnostics();

        renderer.destroy();
        canvas.remove();
        return {
            supported: true,
            sameAfterPreview,
            sameAfterTextureChange,
            canonicalAfterPreview,
            firstReady,
            secondReady,
            tokenGpu: diagnostics.tokenGpu,
            tokenTextures: diagnostics.tokenTextures,
        };
    });

    expect(result.supported, result.error || 'WebGL2 unavailable').toBe(true);
    expect(result.sameAfterPreview).toBe(true);
    expect(result.sameAfterTextureChange).toBe(true);
    expect(result.canonicalAfterPreview).toEqual({ x: 90, y: 90 });
    expect(result.firstReady).toMatchObject({ loads: 1, activeEntries: 1, activeReferences: 1, readyEntries: 1 });
    expect(result.secondReady).toMatchObject({ loads: 2, activeEntries: 1, activeReferences: 1, readyEntries: 1 });
    expect(result.tokenTextures).toMatchObject({ loads: 2, activeEntries: 1, activeReferences: 1, readyEntries: 1 });
    expect(result.tokenGpu).toMatchObject({ activeResources: 1 });
    expect(result.tokenGpu.drawCalls).toBeGreaterThanOrEqual(2);
});
