import { test, expect } from '@playwright/test';
import { installPersistentTokenViews } from '../js/vtt/render/persistent-token-views.js';
import { installTokenInteractionViews } from '../js/vtt/render/token-interaction-view.js';

class FakeCanvas {
    constructor() {
        this.listeners = new Map();
    }
    addEventListener(type, handler) {
        if (!this.listeners.has(type)) this.listeners.set(type, new Set());
        this.listeners.get(type).add(handler);
    }
    removeEventListener(type, handler) {
        this.listeners.get(type)?.delete(handler);
    }
    dispatch(type, detail = {}) {
        for (const handler of this.listeners.get(type) || []) handler({ type, detail, target: this });
    }
}

function createRenderer(tokens) {
    const renderer = {
        backend: 'webgl2',
        destroyed: false,
        canvas: new FakeCanvas(),
        mapData: { tokens },
        diagnostics() { return { backend: this.backend }; },
        destroy() {
            if (this.destroyed) return false;
            this.destroyed = true;
            return true;
        },
    };
    installPersistentTokenViews(renderer);
    installTokenInteractionViews(renderer);
    return renderer;
}

test('hover moves between persistent TokenViews without recreating either view', () => {
    const renderer = createRenderer([
        { id: 'agatha', x: 10, y: 10, zLayer: 0 },
        { id: 'bob', x: 20, y: 20, zLayer: 0 },
    ]);
    const agatha = renderer.tokenViews.get('agatha');
    const bob = renderer.tokenViews.get('bob');

    renderer.canvas.dispatch('vtt:token-hover-changed', { tokenId: 'agatha' });
    expect(agatha.hovered).toBe(true);
    expect(bob.hovered).toBe(false);

    renderer.canvas.dispatch('vtt:token-hover-changed', { tokenId: 'bob', previousTokenId: 'agatha' });
    expect(renderer.tokenViews.get('agatha')).toBe(agatha);
    expect(renderer.tokenViews.get('bob')).toBe(bob);
    expect(agatha.hovered).toBe(false);
    expect(bob.hovered).toBe(true);
    expect(renderer.diagnostics().tokenInteraction).toMatchObject({ hoveredTokenId: 'bob' });
});

test('selection is transient render state and does not mutate canonical token data', () => {
    const token = { id: 'agatha', x: 40, y: 50, zLayer: 0, icono: 'actor.png' };
    const renderer = createRenderer([token]);
    const view = renderer.tokenViews.get('agatha');
    const canonicalBefore = JSON.stringify(token);

    renderer.canvas.dispatch('vtt:token-selection-changed', { tokenId: 'agatha' });
    expect(view.selected).toBe(true);
    expect(JSON.stringify(token)).toBe(canonicalBefore);

    renderer.canvas.dispatch('vtt:token-selection-changed', { tokenId: null, previousTokenId: 'agatha' });
    expect(view.selected).toBe(false);
    expect(JSON.stringify(token)).toBe(canonicalBefore);
});

test('100 hover toggles keep one TokenView and produce no resource churn', () => {
    const token = { id: 'agatha', x: 10, y: 10, zLayer: 0 };
    const renderer = createRenderer([token]);
    const view = renderer.tokenViews.get('agatha');
    const createdBefore = renderer.diagnostics().tokenViews.created;

    for (let index = 0; index < 100; index += 1) {
        renderer.canvas.dispatch('vtt:token-hover-changed', { tokenId: index % 2 === 0 ? 'agatha' : null });
    }

    expect(renderer.tokenViews.get('agatha')).toBe(view);
    expect(renderer.diagnostics().tokenViews.created).toBe(createdBefore);
    expect(view.resources.size).toBe(0);
});

test('hover, selection, and future target state remain independent on one TokenView', () => {
    const renderer = createRenderer([{ id: 'agatha', x: 10, y: 10, zLayer: 0 }]);
    const view = renderer.tokenViews.get('agatha');

    renderer.setTokenHovered('agatha');
    renderer.setTokenSelected('agatha');
    renderer.setTokenTargeted('agatha');
    expect(view.interaction).toEqual({ hovered: true, selected: true, targeted: true });

    renderer.setTokenHovered(null);
    expect(view.interaction).toEqual({ hovered: false, selected: true, targeted: true });
    renderer.clearTokenInteraction();
    expect(view.interaction).toEqual({ hovered: false, selected: false, targeted: false });
});

test('removing a selected token prunes its view and clears tracked interaction ids', () => {
    const token = { id: 'agatha', x: 10, y: 10, zLayer: 0 };
    const renderer = createRenderer([token]);
    renderer.setTokenSelected('agatha');
    expect(renderer.diagnostics().tokenInteraction.selectedTokenId).toBe('agatha');

    renderer.mapData.tokens = [];
    renderer.canvas.dispatch('vtt:scene-dirty', { reason: 'token', tokenId: 'agatha' });

    expect(renderer.tokenViews.get('agatha')).toBeUndefined();
    expect(renderer.diagnostics().tokenInteraction.selectedTokenId).toBeNull();
});
