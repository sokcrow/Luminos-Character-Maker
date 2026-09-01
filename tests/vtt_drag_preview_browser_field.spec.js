import { test, expect } from '@playwright/test';

const FIELD_URL = process.env.VTT_FIELD_URL || 'http://127.0.0.1:4173/vtt.html';

test('real browser drag preview follows pointer without mutating canonical token until drop', async ({ page }) => {
    await page.goto(FIELD_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => Boolean(window.LuminousVttRuntime?.engine?.renderer?.previewToken), null, { timeout: 15000 });
    await page.waitForFunction(() => Boolean(window.LuminousVttZeroWorkDrag?.__v2), null, { timeout: 5000 });

    const prepared = await page.evaluate(() => {
        const engine = window.LuminousVttRuntime.engine;
        const token = engine.mapData.tokens.find((entry) => entry.viewer === true)
            || engine.mapData.tokens.find((entry) => entry.draggable !== false)
            || engine.mapData.tokens[0];
        if (!token) return { supported: false, reason: 'NO_TOKEN' };

        const canonical = {
            x: Number(token.x) || 0,
            y: Number(token.y) || 0,
            zLayer: Number(token.zLayer ?? token.gridPosition?.z ?? token.z?.[0] ?? 0) || 0,
        };
        engine.tokenDrag = {
            token,
            originX: canonical.x,
            originY: canonical.y,
            originZ: canonical.zLayer,
            originElevationFt: Number(token.elevationFt) || 0,
            grabOffsetX: 0,
            grabOffsetY: 0,
        };
        engine.cameraFollowActive = true;
        engine.setTokenMoveResolver?.(async () => ({ valid: false, reason: 'FIELD_PREVIEW_ONLY' }));

        const rect = engine.canvas.getBoundingClientRect();
        const clientX = rect.left + Math.max(120, Math.min(rect.width - 120, rect.width * 0.72));
        const clientY = rect.top + Math.max(120, Math.min(rect.height - 120, rect.height * 0.62));
        window.__dragPreviewField = {
            tokenId: String(token.id),
            canonical,
            clientX,
            clientY,
            baseline: window.LuminousVttZeroWorkDrag.snapshot(),
            previewEventCount: 0,
            lastPreviewEvent: null,
        };
        engine.canvas.addEventListener('vtt:token-drag-preview', (event) => {
            const field = window.__dragPreviewField;
            if (!field || String(event.detail?.tokenId || '') !== field.tokenId) return;
            field.previewEventCount += 1;
            field.lastPreviewEvent = JSON.parse(JSON.stringify(event.detail || {}));
        });
        return { supported: true, tokenId: String(token.id), canonical, clientX, clientY };
    });

    expect(prepared.supported, prepared.reason || 'drag preview setup failed').toBe(true);

    await page.evaluate(({ clientX, clientY }) => {
        for (let index = 1; index <= 120; index += 1) {
            const t = index / 120;
            window.dispatchEvent(new MouseEvent('mousemove', {
                bubbles: true,
                cancelable: true,
                clientX: clientX * t,
                clientY: clientY * t,
                buttons: 1,
            }));
        }
    }, prepared);

    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));

    const during = await page.evaluate(() => {
        const engine = window.LuminousVttRuntime.engine;
        const field = window.__dragPreviewField;
        const token = engine.mapData.tokens.find((entry) => String(entry.id) === field.tokenId);
        const preview = engine.renderer.tokenPreview?.(field.tokenId) || null;
        const metrics = window.LuminousVttZeroWorkDrag.snapshot();
        return {
            canonicalNow: { x: token.x, y: token.y, zLayer: Number(token.zLayer ?? token.gridPosition?.z ?? token.z?.[0] ?? 0) || 0 },
            preview,
            lastPreviewEvent: field.lastPreviewEvent,
            previewEventCount: field.previewEventCount,
            pointerMoves: metrics.pointerMoves - field.baseline.pointerMoves,
            visualPreviewFrames: metrics.visualPreviewFrames - field.baseline.visualPreviewFrames,
            coalescedPointerMoves: metrics.coalescedPointerMoves - field.baseline.coalescedPointerMoves,
            renderRequests: metrics.renderRequests - field.baseline.renderRequests,
            cameraPreviewFrames: metrics.cameraPreviewFrames - field.baseline.cameraPreviewFrames,
            worldPreviewCalls: metrics.worldPreviewCalls - field.baseline.worldPreviewCalls,
            pathfindingCalls: metrics.pathfindingCalls - field.baseline.pathfindingCalls,
        };
    });

    expect(during.canonicalNow).toEqual(prepared.canonical);
    expect(during.preview).toBeTruthy();
    expect(during.lastPreviewEvent).toBeTruthy();
    expect(during.lastPreviewEvent).toMatchObject({ tokenId: prepared.tokenId, transient: true, drag: true });
    expect(during.preview.x).toBeCloseTo(during.lastPreviewEvent.x, 6);
    expect(during.preview.y).toBeCloseTo(during.lastPreviewEvent.y, 6);
    expect(Math.hypot(during.preview.x - prepared.canonical.x, during.preview.y - prepared.canonical.y)).toBeGreaterThan(10);
    expect(during.previewEventCount).toBeGreaterThan(0);
    expect(during.pointerMoves).toBeGreaterThanOrEqual(120);
    expect(during.visualPreviewFrames).toBeGreaterThan(0);
    expect(during.visualPreviewFrames).toBeLessThan(during.pointerMoves);
    expect(during.coalescedPointerMoves).toBeGreaterThan(0);
    expect(during.renderRequests).toBeGreaterThan(0);
    expect(during.cameraPreviewFrames).toBeGreaterThan(0);
    expect(during.worldPreviewCalls).toBe(0);
    expect(during.pathfindingCalls).toBe(0);

    await page.evaluate(({ clientX, clientY }) => {
        window.dispatchEvent(new MouseEvent('mouseup', {
            bubbles: true,
            cancelable: true,
            clientX,
            clientY,
            button: 0,
            buttons: 0,
        }));
    }, prepared);
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));

    const after = await page.evaluate(() => {
        const engine = window.LuminousVttRuntime.engine;
        const field = window.__dragPreviewField;
        const token = engine.mapData.tokens.find((entry) => String(entry.id) === field.tokenId);
        return {
            preview: engine.renderer.tokenPreview?.(field.tokenId) || null,
            canonicalNow: { x: token.x, y: token.y, zLayer: Number(token.zLayer ?? token.gridPosition?.z ?? token.z?.[0] ?? 0) || 0 },
            metrics: window.LuminousVttZeroWorkDrag.snapshot(),
        };
    });

    expect(after.preview).toBeNull();
    expect(after.canonicalNow).toEqual(prepared.canonical);
    expect(after.metrics.previewClears).toBeGreaterThan(0);
});
