import { test, expect } from '@playwright/test';
import { installPersistentTokenViews } from '../js/vtt/render/persistent-token-views.js';
import { installRemoteTokenInterpolation } from '../js/vtt/render/remote-token-interpolation.js';
import { installTransientTokenPreview } from '../js/vtt/render/transient-token-preview.js';

class FakeCanvas {
    constructor() { this.listeners = new Map(); }
    addEventListener(type, handler) {
        if (!this.listeners.has(type)) this.listeners.set(type, new Set());
        this.listeners.get(type).add(handler);
    }
    removeEventListener(type, handler) { this.listeners.get(type)?.delete(handler); }
    dispatch(type, detail = {}) {
        const event = { type, detail, target: this };
        for (const handler of [...(this.listeners.get(type) || [])]) handler(event);
    }
}

function fakeScheduler() {
    let current = 0;
    let nextId = 0;
    const frames = new Map();
    const timers = new Map();
    return {
        now: () => current,
        raf(fn) { const id = ++nextId; frames.set(id, fn); return id; },
        caf(id) { frames.delete(id); },
        setTimeoutFn(fn, ms) { const id = ++nextId; timers.set(id, { at: current + ms, fn }); return id; },
        clearTimeoutFn(id) { timers.delete(id); },
        frame(ms = 16) {
            current += ms;
            const callbacks = [...frames.values()];
            frames.clear();
            for (const callback of callbacks) callback(current);
            for (const [id, timer] of [...timers.entries()]) {
                if (timer.at > current) continue;
                timers.delete(id);
                timer.fn();
            }
        },
        advance(ms) {
            current += ms;
            for (const [id, timer] of [...timers.entries()]) {
                if (timer.at > current) continue;
                timers.delete(id);
                timer.fn();
            }
        },
    };
}

function setup() {
    const token = {
        id: 'agatha', x: 0, y: 20, zLayer: 0, z: [0],
        gridPosition: { col: 0, row: 0, z: 0 },
    };
    const canvas = new FakeCanvas();
    const scheduler = fakeScheduler();
    const renderer = {
        backend: 'webgl2',
        destroyed: false,
        canvas,
        mapData: { tokens: [token], grid: { size: 70 } },
        layers: new Map([['tokens', { dirty: false, visible: true }]]),
        diagnostics() { return { backend: this.backend }; },
        destroy() { if (this.destroyed) return false; this.destroyed = true; return true; },
    };
    installPersistentTokenViews(renderer);
    installTransientTokenPreview(renderer);
    installRemoteTokenInterpolation(renderer, {
        now: scheduler.now,
        raf: scheduler.raf,
        caf: scheduler.caf,
        setTimeoutFn: scheduler.setTimeoutFn,
        clearTimeoutFn: scheduler.clearTimeoutFn,
        defaultDurationMs: 100,
        minDurationMs: 60,
        maxDurationMs: 160,
        canonicalHoldMs: 500,
    });
    return { token, canvas, scheduler, renderer, view: renderer.tokenViews.get('agatha') };
}

function remote(canvas, token, detail) {
    // movement-realtime currently mutates the token before dispatching its remote
    // semantic preview; Step 7 must undo that canonical mutation synchronously.
    if (Number.isFinite(Number(detail.x))) token.x = Number(detail.x);
    if (Number.isFinite(Number(detail.y))) token.y = Number(detail.y);
    if (Number.isFinite(Number(detail.z))) {
        token.zLayer = Number(detail.z);
        token.z = [Number(detail.z)];
    }
    canvas.dispatch('vtt:token-preview-moved', { remote: true, tokenId: token.id, ...detail });
}

test('remote snapshots animate render position while canonical token stays untouched', () => {
    const { token, canvas, scheduler, renderer, view } = setup();
    const identity = view;

    remote(canvas, token, { sequence: 1, x: 100, y: 20, z: 0 });
    expect(token.x).toBe(0);
    expect(view.renderX).toBe(0);

    scheduler.frame(50);
    expect(view.renderX).toBeGreaterThan(0);
    expect(view.renderX).toBeLessThan(100);
    expect(token.x).toBe(0);

    scheduler.frame(50);
    expect(view.renderX).toBeCloseTo(100, 5);
    expect(renderer.tokenViews.get('agatha')).toBe(identity);
    expect(renderer.diagnostics().remoteTokenInterpolation).toMatchObject({
        acceptedSnapshots: 1,
        completedTransitions: 1,
        activeTracks: 1,
    });
});

test('new remote snapshots retarget from current render position instead of snapping', () => {
    const { token, canvas, scheduler, renderer, view } = setup();
    remote(canvas, token, { sequence: 1, x: 100, y: 20, z: 0 });
    scheduler.frame(50);
    const firstMidpoint = view.renderX;

    remote(canvas, token, { sequence: 2, x: 200, y: 20, z: 0 });
    expect(token.x).toBe(0);
    expect(view.renderX).toBe(firstMidpoint);

    scheduler.frame(30);
    expect(view.renderX).toBeGreaterThan(firstMidpoint);
    expect(view.renderX).toBeLessThan(200);
    scheduler.frame(40);
    expect(view.renderX).toBeCloseTo(200, 5);
    expect(renderer.diagnostics().remoteTokenInterpolation.retargets).toBe(2);
});

test('out-of-order remote sequence is visually ignored and cannot overwrite canonical state', () => {
    const { token, canvas, scheduler, renderer, view } = setup();
    remote(canvas, token, { sequence: 5, x: 150, y: 20, z: 0 });
    scheduler.frame(100);
    expect(view.renderX).toBeCloseTo(150, 5);

    remote(canvas, token, { sequence: 4, x: 60, y: 20, z: 0 });
    expect(token.x).toBe(0);
    expect(view.renderX).toBeCloseTo(150, 5);
    expect(renderer.diagnostics().remoteTokenInterpolation).toMatchObject({
        acceptedSnapshots: 1,
        droppedOutOfOrder: 1,
    });
});

test('committed preview holds until canonical sync then releases without a backward frame', () => {
    const { token, canvas, scheduler, renderer, view } = setup();
    remote(canvas, token, { sequence: 7, x: 120, y: 40, z: 0 });
    scheduler.frame(100);
    expect(view.renderX).toBeCloseTo(120, 5);
    expect(token.x).toBe(0);

    remote(canvas, token, { sequence: 7, x: 120, y: 40, z: 0, committed: true, cleared: true });
    expect(token.x).toBe(0);
    expect(view.renderX).toBeCloseTo(120, 5);
    expect(renderer.diagnostics().remoteTokenInterpolation.awaitingCanonical).toBe(1);

    token.x = 120;
    token.y = 40;
    canvas.dispatch('vtt:canonical-tokens-synced', { scope: 'players' });

    expect(view.x).toBe(120);
    expect(view.renderX).toBe(120);
    expect(view.hasPreview).toBe(false);
    expect(renderer.diagnostics().remoteTokenInterpolation).toMatchObject({
        canonicalReleases: 1,
        activeTracks: 0,
    });
});

test('recent local movement suppresses its own realtime echo', () => {
    const { token, canvas, renderer, view } = setup();
    token.x = 80;
    renderer.syncTokenView('agatha');
    canvas.dispatch('vtt:token-preview-moved', { tokenId: 'agatha', x: 80, y: 20, z: 0, traversing: true });

    remote(canvas, token, { sequence: 1, x: 80, y: 20, z: 0 });

    expect(token.x).toBe(80);
    expect(view.hasPreview).toBe(false);
    expect(renderer.diagnostics().remoteTokenInterpolation).toMatchObject({
        selfEchoesIgnored: 1,
        acceptedSnapshots: 0,
        activeTracks: 0,
    });
});
