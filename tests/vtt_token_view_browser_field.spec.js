import { test, expect } from '@playwright/test';

const FIELD_URL = process.env.VTT_FIELD_URL || 'http://127.0.0.1:4173/vtt.html';

test('real WebGL2 renderer targets one TokenView without full-scanning each render', async ({ page }) => {
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
            tokens: [agatha, bob],
        };

        let renderer;
        try {
            renderer = createRenderer(canvas, mapData, { backend: RENDERER_BACKENDS.WEBGL_2 });
        } catch (error) {
            return { supported: false, error: String(error?.message || error) };
        }

        const firstAgathaView = renderer.tokenViews.get('agatha');
        for (let frame = 0; frame < 100; frame += 1) renderer.render(null);
        const afterFrames = renderer.diagnostics().tokenViews;

        agatha.x = 500;
        agatha.y = 300;
        canvas.dispatchEvent(new CustomEvent('vtt:scene-dirty', {
            detail: { reason: 'token', tokenId: 'agatha', render: true, vision: true },
        }));
        renderer.render(null);

        const movedAgathaView = renderer.tokenViews.get('agatha');
        const sameIdentityAfterMove = firstAgathaView === movedAgathaView;
        const movedPosition = { x: movedAgathaView?.x, y: movedAgathaView?.y };

        mapData.tokens = [bob];
        canvas.dispatchEvent(new CustomEvent('vtt:scene-dirty', {
            detail: { reason: 'token', tokenId: 'agatha', render: true, vision: true },
        }));
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
            afterFrames,
            beforeDestroy,
            afterDestroy,
        };
    });

    expect(result.supported, result.error || 'WebGL2 unavailable').toBe(true);
    expect(result.backend).toBe('webgl2');
    expect(result.afterFrames).toMatchObject({ fullSyncs: 1, targetedSyncs: 0, active: 2 });
    expect(result.sameIdentityAfterMove).toBe(true);
    expect(result.movedPosition).toEqual({ x: 500, y: 300 });
    expect(result.agathaDestroyedAfterPrune).toBe(true);
    expect(result.bobDestroyedWithRenderer).toBe(true);
    expect(result.firstDestroy).toBe(true);
    expect(result.secondDestroy).toBe(false);
    expect(result.beforeDestroy).toMatchObject({
        created: 2,
        destroyed: 1,
        positionUpdates: 1,
        targetedSyncs: 1,
        fullSyncs: 1,
        active: 1,
    });
    expect(result.afterDestroy).toMatchObject({ created: 2, destroyed: 2, fullSyncs: 1, active: 0 });
});

test('canonical token-state update preserves tokenId through scene-dirty in browser', async ({ page }) => {
    await page.goto(FIELD_URL, { waitUntil: 'domcontentloaded' });

    const result = await page.evaluate(() => {
        const api = window.LuminousVttTokenState;
        const canvas = document.getElementById('vtt-canvas');
        if (!api?.createBridge || !canvas) return { available: false };

        const mapData = {
            id: 'token-state-browser-field',
            tokens: [{ id: 'canonical-goblin', x: 0, y: 0, zLayer: 0 }],
        };
        let dirtyDetail = null;
        const handler = (event) => {
            if (event.detail?.sourceEvent === 'LuminousVttTokenState:onTokensChanged') dirtyDetail = event.detail;
        };
        canvas.addEventListener('vtt:scene-dirty', handler);

        const bridge = api.createBridge({ mapData, isDm: true, root: {}, onTokensChanged() {} });
        bridge.syncSingleWorldRecord('canonical-goblin', {
            tokenId: 'canonical-goblin',
            position: {
                x: 210,
                y: 140,
                zLayer: 0,
                elevationFt: 0,
                gridPosition: { col: 3, row: 2, z: 0 },
            },
        });

        canvas.removeEventListener('vtt:scene-dirty', handler);
        return {
            available: true,
            token: mapData.tokens[0],
            dirtyDetail,
        };
    });

    expect(result.available).toBe(true);
    expect(result.token).toMatchObject({ id: 'canonical-goblin', x: 210, y: 140 });
    expect(result.dirtyDetail).toMatchObject({
        reason: 'token',
        tokenId: 'canonical-goblin',
        sourceEvent: 'LuminousVttTokenState:onTokensChanged',
    });
});
