import { test, expect } from '@playwright/test';
import { installTokenInteractionRuntime } from '../js/vtt/token-interaction-runtime.js';

class FakeCustomEvent {
    constructor(type, options = {}) {
        this.type = type;
        this.detail = options.detail || null;
    }
}

class FakeCanvas {
    constructor() {
        this.events = [];
    }
    dispatchEvent(event) {
        this.events.push(event);
        return true;
    }
}

class FakeHost {
    constructor() {
        this.listeners = new Map();
        this.CustomEvent = FakeCustomEvent;
        this.dirty = [];
        this.LuminousVttSceneDirty = {
            emit: (_canvas, detail) => {
                this.dirty.push(detail);
                return true;
            },
        };
    }
    addEventListener(type, handler) {
        if (!this.listeners.has(type)) this.listeners.set(type, new Set());
        this.listeners.get(type).add(handler);
    }
    removeEventListener(type, handler) {
        this.listeners.get(type)?.delete(handler);
    }
    dispatch(type, event = {}) {
        const payload = { type, ...event };
        for (const handler of this.listeners.get(type) || []) handler(payload);
        return payload;
    }
}

function setup() {
    const host = new FakeHost();
    const canvas = new FakeCanvas();
    const agatha = { id: 'agatha', x: 10, y: 20, zLayer: 0 };
    const bob = { id: 'bob', x: 30, y: 40, zLayer: 0 };
    const engine = {
        canvas,
        tokenDrag: null,
        tokenMotion: null,
        hitTests: 0,
        tokenAtEvent(event) {
            this.hitTests += 1;
            return event.allowed === false ? null : (event.token || null);
        },
    };
    host.LuminousVttRuntime = { engine };
    const runtime = installTokenInteractionRuntime(host);
    return { host, canvas, engine, agatha, bob, runtime };
}

test('mousemove hover delegates hit-testing to Engine.tokenAtEvent and emits transient interaction dirty', () => {
    const { host, canvas, engine, agatha, runtime } = setup();
    const before = JSON.stringify(agatha);

    const event = host.dispatch('mousemove', { target: canvas, token: agatha });

    expect(engine.hitTests).toBe(1);
    expect(runtime.snapshot()).toMatchObject({ hoveredTokenId: 'agatha', hoverChanges: 1 });
    expect(canvas.events.at(-1)).toMatchObject({
        type: 'vtt:token-hover-changed',
        detail: { tokenId: 'agatha', transient: true },
    });
    expect(host.dirty.at(-1)).toMatchObject({ reason: 'interaction', render: true, vision: false, tokenId: 'agatha' });
    expect(JSON.stringify(agatha)).toBe(before);

    // Engine's later cursor handling sees the same event and reuses the cached hit.
    expect(engine.tokenAtEvent(event)).toBe(agatha);
    expect(engine.hitTests).toBe(1);
    expect(runtime.snapshot().reusedHitTests).toBe(1);
});

test('left click selection uses the same permission-aware Engine.tokenAtEvent boundary', () => {
    const { host, canvas, agatha, runtime } = setup();

    host.dispatch('mousedown', { target: canvas, button: 0, token: agatha, allowed: false });
    expect(runtime.snapshot().selectedTokenId).toBeNull();

    host.dispatch('mousedown', { target: canvas, button: 0, token: agatha, allowed: true });
    expect(runtime.snapshot().selectedTokenId).toBe('agatha');

    host.dispatch('mousedown', { target: canvas, button: 0, token: null, allowed: true });
    expect(runtime.snapshot().selectedTokenId).toBeNull();
    expect(runtime.snapshot().selectionChanges).toBe(2);
});

test('raw hover work is suppressed during active token drag', () => {
    const { host, canvas, engine, agatha, bob, runtime } = setup();
    host.dispatch('mousemove', { target: canvas, token: agatha });
    expect(runtime.snapshot().hoveredTokenId).toBe('agatha');
    const hitTestsBefore = engine.hitTests;

    engine.tokenDrag = { token: agatha };
    for (let index = 0; index < 120; index += 1) host.dispatch('mousemove', { target: canvas, token: bob });

    expect(engine.hitTests).toBe(hitTestsBefore);
    expect(runtime.snapshot()).toMatchObject({
        hoveredTokenId: 'agatha',
        ignoredDuringDrag: 120,
    });
});

test('moving outside the VTT canvas clears hover but preserves selection', () => {
    const { host, canvas, agatha, runtime } = setup();
    host.dispatch('mousedown', { target: canvas, button: 0, token: agatha });
    expect(runtime.snapshot()).toMatchObject({ hoveredTokenId: 'agatha', selectedTokenId: 'agatha' });

    host.dispatch('mousemove', { target: {}, token: null });
    expect(runtime.snapshot()).toMatchObject({ hoveredTokenId: null, selectedTokenId: 'agatha' });
});
