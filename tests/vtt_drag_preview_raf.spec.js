import { test, expect } from '@playwright/test';
import { installZeroWorkDrag } from '../js/vtt/movement-zero-work-drag.js';

function fakeHost() {
    const listeners = new Map();
    const frames = new Map();
    const dirties = [];
    const canvasEvents = [];
    let frameId = 0;
    const token = { id: 'agatha', x: 70, y: 140, zLayer: 0 };
    const renderer = {
        previewCalls: [],
        clearCalls: [],
        previewToken(tokenId, position) {
            this.previewCalls.push({ tokenId, ...position });
            return true;
        },
        clearTokenPreview(tokenId) {
            this.clearCalls.push(tokenId);
            return true;
        },
    };
    const camera = {
        centers: [],
        centerOnWorldPoint(point) {
            this.centers.push({ ...point });
            return true;
        },
    };
    const canvas = {
        dispatchEvent(event) {
            canvasEvents.push({ type: event.type, detail: event.detail });
            return true;
        },
    };
    const engine = {
        canvas,
        renderer,
        camera,
        cameraFollowActive: true,
        mapData: { grid: { size: 70, distancePerCell: 5 }, movement: { diagonalRule: '5e' } },
        tokenDrag: {
            token,
            originX: token.x,
            originY: token.y,
            originZ: 0,
            grabOffsetX: 0,
            grabOffsetY: 0,
        },
        eventWorldPoint(event) {
            return { x: event.clientX, y: event.clientY };
        },
    };

    class FakeCustomEvent {
        constructor(type, init = {}) {
            this.type = type;
            this.detail = init.detail;
        }
    }

    const host = {
        performance: { now: () => 1 },
        CustomEvent: FakeCustomEvent,
        LuminousVttRuntime: { engine },
        LuminousVttPathfinding: {
            cellFromPoint(point, mapData) {
                const size = Number(mapData?.grid?.size) || 70;
                return { col: Math.floor(Number(point.x) / size), row: Math.floor(Number(point.y) / size) };
            },
        },
        LuminousVttSceneDirty: {
            emit(_canvas, detail) { dirties.push(detail); },
        },
        addEventListener(type, callback) {
            const list = listeners.get(type) || [];
            list.push(callback);
            listeners.set(type, list);
        },
        removeEventListener(type, callback) {
            listeners.set(type, (listeners.get(type) || []).filter((entry) => entry !== callback));
        },
        requestAnimationFrame(callback) {
            const id = ++frameId;
            frames.set(id, callback);
            return id;
        },
        cancelAnimationFrame(id) { frames.delete(id); },
    };

    function emit(type, event = {}) {
        for (const callback of [...(listeners.get(type) || [])]) callback({ type, ...event });
    }

    function flushFrames() {
        const queued = [...frames.entries()];
        frames.clear();
        for (const [, callback] of queued) callback(16);
    }

    return { host, engine, token, renderer, camera, dirties, canvasEvents, emit, flushFrames, frames };
}

test('120 raw mousemoves coalesce to one visual preview frame without canonical movement', () => {
    const fixture = fakeHost();
    const api = installZeroWorkDrag(fixture.host);
    let stopped = 0;

    for (let index = 1; index <= 120; index += 1) {
        fixture.emit('mousemove', {
            clientX: 100 + index,
            clientY: 200 + (index * 2),
            stopImmediatePropagation() { stopped += 1; },
        });
    }

    expect(fixture.token).toMatchObject({ x: 70, y: 140, zLayer: 0 });
    expect(fixture.renderer.previewCalls).toHaveLength(0);
    expect(fixture.frames.size).toBe(1);
    expect(stopped).toBe(120);

    fixture.flushFrames();

    expect(fixture.renderer.previewCalls).toHaveLength(1);
    expect(fixture.renderer.previewCalls[0]).toMatchObject({ tokenId: 'agatha', x: 220, y: 440, zLayer: 0 });
    expect(fixture.camera.centers).toEqual([{ x: 220, y: 440 }]);
    expect(fixture.token).toMatchObject({ x: 70, y: 140, zLayer: 0 });
    expect(fixture.dirties).toHaveLength(1);
    expect(fixture.dirties[0]).toMatchObject({ reason: 'token', render: true, vision: false, active: true, tokenId: 'agatha' });
    expect(fixture.canvasEvents[0]).toMatchObject({ type: 'vtt:token-drag-preview', detail: { tokenId: 'agatha', x: 220, y: 440, transient: true } });

    const metrics = api.snapshot();
    expect(metrics.pointerMoves).toBe(120);
    expect(metrics.blockedLegacyMouseMoves).toBe(120);
    expect(metrics.visualPreviewFrames).toBe(1);
    expect(metrics.coalescedPointerMoves).toBe(119);
    expect(metrics.worldPreviewCalls).toBe(0);
    expect(metrics.pathfindingCalls).toBe(0);
});

test('mouseup clears only transient preview before canonical movement resolution', () => {
    const fixture = fakeHost();
    const api = installZeroWorkDrag(fixture.host);

    fixture.emit('mousemove', { clientX: 350, clientY: 280, stopImmediatePropagation() {} });
    fixture.flushFrames();
    fixture.emit('mouseup', {});

    expect(fixture.renderer.clearCalls).toEqual(['agatha']);
    expect(fixture.token).toMatchObject({ x: 70, y: 140, zLayer: 0 });
    expect(fixture.canvasEvents.at(-1)).toMatchObject({
        type: 'vtt:token-drag-preview-clear',
        detail: { tokenId: 'agatha', cleared: true, transient: true },
    });
    expect(api.snapshot().previewClears).toBe(1);
    expect(api.snapshot().previewTokenId).toBeNull();
});
