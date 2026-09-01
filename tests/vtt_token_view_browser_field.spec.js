import { test, expect } from '@playwright/test';

const FIELD_URL = process.env.VTT_FIELD_URL || 'http://127.0.0.1:4173/vtt.html';

test('real WebGL2 renderer preserves TokenView identity and releases it in browser', async ({ page }) => {
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

        const agatha = { id: 'agatha', x: 100, y: 100, zLayer: 0 };
        const bob = { id: 'bob', x: 40, y: 60, zLayer: 0 };
        const mapData = {
            grid: { cols: 4, rows: 4, size: 70 },
            tokens: [agatha],
        };

        let renderer;
        try {
            renderer = createRenderer(canvas, mapData, { backend: RENDERER_BACKENDS.WEBGL_2 });
        } catch (error) {
            return { supported: false, error: String(error?.message || error) };
        }

        renderer.render(null);
        const firstAgathaView = renderer.tokenViews.get('agatha');

        agatha.x = 500;
        agatha.y = 300;
        renderer.render(null);
        const movedAgathaView = renderer.tokenViews.get('agatha');
        const sameIdentityAfterMove = firstAgathaView === movedAgathaView;
        const movedPosition = { x: movedAgathaView?.x, y: movedAgathaView?.y };

        mapData.tokens = [bob];
        renderer.render(null);
        const agathaDestroyedAfterPrune = firstAgathaView?.destroyed === true;
        const bobView = renderer.tokenViews.get('bob');
        const beforeDestroy = renderer.diagnostics().tokenViews;

        const firstDestroy = renderer.destroy();
        const secondDestroy = renderer.destroy();
        const afterDestroy = renderer.diagnostics().tokenViews;

        canvas.remove();
        return {
            supported: true,
            backend: renderer.backend,
            sameIdentityAfterMove,
            movedPosition,
            agathaDestroyedAfterPrune,
            bobDestroyedWithRenderer: bobView?.destroyed === true,
            firstDestroy,
            secondDestroy,
            beforeDestroy,
            afterDestroy,
        };
    });

    expect(result.supported, result.error || 'WebGL2 unavailable').toBe(true);
    expect(result.backend).toBe('webgl2');
    expect(result.sameIdentityAfterMove).toBe(true);
    expect(result.movedPosition).toEqual({ x: 500, y: 300 });
    expect(result.agathaDestroyedAfterPrune).toBe(true);
    expect(result.bobDestroyedWithRenderer).toBe(true);
    expect(result.firstDestroy).toBe(true);
    expect(result.secondDestroy).toBe(false);
    expect(result.beforeDestroy).toMatchObject({ created: 2, destroyed: 1, active: 1 });
    expect(result.afterDestroy).toMatchObject({ created: 2, destroyed: 2, active: 0 });
});
