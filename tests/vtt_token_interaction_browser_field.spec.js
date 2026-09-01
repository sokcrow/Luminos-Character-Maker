import { test, expect } from '@playwright/test';

const FIELD_URL = process.env.VTT_FIELD_URL || 'http://127.0.0.1:4173/vtt.html';

test('real WebGL2 hover and selection overlay preserves TokenView, texture, and canonical state', async ({ page }) => {
    await page.goto(FIELD_URL, { waitUntil: 'domcontentloaded' });

    const result = await page.evaluate(async () => {
        const [{ createRenderer }, { RENDERER_BACKENDS }] = await Promise.all([
            import('/js/vtt/render/renderer-factory.js'),
            import('/js/vtt/render/renderer-backend.js'),
        ]);
        const icon = `data:image/svg+xml;charset=utf-8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><rect width="96" height="96" fill="#5577cc"/></svg>')}`;
        const canvas = document.createElement('canvas');
        canvas.width = 320;
        canvas.height = 180;
        canvas.style.width = '320px';
        canvas.style.height = '180px';
        document.body.appendChild(canvas);

        const agatha = { id: 'agatha', x: 90, y: 90, zLayer: 0, radius: 28, icono: icon, color: '#88aaff' };
        const mapData = { grid: { cols: 4, rows: 4, size: 70 }, tokens: [agatha] };
        let renderer;
        try {
            renderer = createRenderer(canvas, mapData, { backend: RENDERER_BACKENDS.WEBGL_2 });
        } catch (error) {
            canvas.remove();
            return { supported: false, error: String(error?.message || error) };
        }

        const deadline = performance.now() + 2500;
        while (performance.now() < deadline && renderer.diagnostics().tokenTextures?.readyEntries !== 1) {
            await new Promise((resolve) => setTimeout(resolve, 20));
        }

        const view = renderer.tokenViews.get('agatha');
        const visual = view.resources.get('webgl2-token-visual')?.resource;
        const canonicalBefore = { x: agatha.x, y: agatha.y, zLayer: agatha.zLayer, icono: agatha.icono };

        canvas.dispatchEvent(new CustomEvent('vtt:token-hover-changed', { detail: { tokenId: 'agatha', transient: true } }));
        renderer.render(null, 0, null, false);
        const hover = {
            interaction: { ...view.interaction },
            gpu: renderer.diagnostics().tokenInteractionGpu,
        };

        canvas.dispatchEvent(new CustomEvent('vtt:token-selection-changed', { detail: { tokenId: 'agatha', transient: true } }));
        renderer.render(null, 0, null, false);
        const selected = {
            interaction: { ...view.interaction },
            gpu: renderer.diagnostics().tokenInteractionGpu,
        };

        for (let index = 0; index < 100; index += 1) {
            canvas.dispatchEvent(new CustomEvent('vtt:token-hover-changed', {
                detail: { tokenId: index % 2 === 0 ? null : 'agatha', transient: true },
            }));
        }
        canvas.dispatchEvent(new CustomEvent('vtt:token-hover-changed', { detail: { tokenId: 'agatha', transient: true } }));
        renderer.previewToken('agatha', { x: 180, y: 120, zLayer: 0 });
        renderer.render(null, 0, null, false);

        const afterStress = {
            sameView: renderer.tokenViews.get('agatha') === view,
            sameVisual: view.resources.get('webgl2-token-visual')?.resource === visual,
            canonical: { x: agatha.x, y: agatha.y, zLayer: agatha.zLayer, icono: agatha.icono },
            renderPosition: { x: view.renderX, y: view.renderY },
            tokenViews: renderer.diagnostics().tokenViews,
            textures: renderer.diagnostics().tokenTextures,
            interaction: renderer.diagnostics().tokenInteraction,
            interactionGpu: renderer.diagnostics().tokenInteractionGpu,
        };

        renderer.clearTokenPreview('agatha');
        mapData.tokens = [];
        canvas.dispatchEvent(new CustomEvent('vtt:scene-dirty', { detail: { reason: 'token', tokenId: 'agatha', render: true } }));
        const afterRemove = {
            exists: Boolean(renderer.tokenViews.get('agatha')),
            interaction: renderer.diagnostics().tokenInteraction,
        };

        renderer.destroy();
        canvas.remove();
        return { supported: true, canonicalBefore, hover, selected, afterStress, afterRemove };
    });

    expect(result.supported, result.error || 'WebGL2 unavailable').toBe(true);
    expect(result.hover.interaction).toEqual({ hovered: true, selected: false, targeted: false });
    expect(result.hover.gpu).toMatchObject({ visibleLastFrame: 1, hoveredLastFrame: 1 });
    expect(result.selected.interaction).toEqual({ hovered: true, selected: true, targeted: false });
    expect(result.selected.gpu).toMatchObject({ visibleLastFrame: 1, selectedLastFrame: 1 });
    expect(result.afterStress.sameView).toBe(true);
    expect(result.afterStress.sameVisual).toBe(true);
    expect(result.afterStress.canonical).toEqual(result.canonicalBefore);
    expect(result.afterStress.renderPosition).toEqual({ x: 180, y: 120 });
    expect(result.afterStress.tokenViews.created).toBe(1);
    expect(result.afterStress.textures).toMatchObject({ loads: 1, activeEntries: 1, activeReferences: 1, readyEntries: 1 });
    expect(result.afterStress.interaction).toMatchObject({ hoveredTokenId: 'agatha', selectedTokenId: 'agatha' });
    expect(result.afterRemove.exists).toBe(false);
    expect(result.afterRemove.interaction).toMatchObject({ hoveredTokenId: null, selectedTokenId: null });
});
