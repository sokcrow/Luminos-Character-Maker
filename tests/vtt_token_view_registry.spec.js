import { test, expect } from '@playwright/test';
import { TokenViewRegistry } from '../js/vtt/render/token-view-registry.js';

const expectedStats = (overrides = {}) => ({
    created: 0,
    destroyed: 0,
    positionUpdates: 0,
    targetedSyncs: 0,
    fullSyncs: 0,
    active: 0,
    ...overrides,
});

test('ensure preserves one TokenView identity per token id', () => {
    const registry = new TokenViewRegistry();
    const agatha = { id: 'agatha', x: 100, y: 100, zLayer: 0 };

    const first = registry.ensure(agatha);
    const second = registry.ensure(agatha);

    expect(second).toBe(first);
    expect(first.id).toBe(agatha.id);
    expect(registry.diagnostics()).toEqual(expectedStats({ created: 1, active: 1 }));
});

test('1000 targeted position changes update one TokenView without recreation', () => {
    const registry = new TokenViewRegistry();
    const agatha = { id: 'agatha', x: 0, y: 0, zLayer: 0 };
    const original = registry.ensure(agatha);

    for (let index = 1; index <= 1000; index += 1) {
        agatha.x = index;
        agatha.y = index * 2;
        const current = registry.syncToken(agatha);
        expect(current).toBe(original);
    }

    expect(original.x).toBe(1000);
    expect(original.y).toBe(2000);
    expect(registry.diagnostics()).toEqual(expectedStats({
        created: 1,
        positionUpdates: 1000,
        targetedSyncs: 1000,
        active: 1,
    }));
});

test('identical targeted payloads do not create position work', () => {
    const registry = new TokenViewRegistry();
    const agatha = { id: 'agatha', x: 100, y: 200, zLayer: 0 };
    registry.ensure(agatha);

    for (let index = 0; index < 1000; index += 1) registry.syncToken(agatha);

    expect(registry.diagnostics()).toEqual(expectedStats({
        created: 1,
        targetedSyncs: 1000,
        active: 1,
    }));
});

test('50 tokens stay at exactly 50 persistent views during repeated full batch syncs', () => {
    const registry = new TokenViewRegistry();
    const tokens = Array.from({ length: 50 }, (_, index) => ({
        id: `token-${index + 1}`,
        x: index,
        y: index,
        zLayer: 0,
    }));

    registry.sync(tokens);
    const originalViews = new Map(tokens.map((token) => [token.id, registry.get(token.id)]));

    for (let step = 1; step <= 100; step += 1) {
        registry.sync(tokens.map((token, index) => ({
            ...token,
            x: index + step,
            y: index + (step * 2),
        })));
    }

    expect(registry.size).toBe(50);
    expect(registry.diagnostics()).toMatchObject({ created: 50, destroyed: 0, fullSyncs: 101 });
    for (const token of tokens) expect(registry.get(token.id)).toBe(originalViews.get(token.id));
});

test('remove destroys exactly once and double remove is safe', () => {
    const registry = new TokenViewRegistry();
    registry.sync([{ id: 'agatha' }, { id: 'bob' }, { id: 'goblin' }]);
    const goblin = registry.get('goblin');

    expect(registry.remove('goblin')).toBe(true);
    expect(registry.remove('goblin')).toBe(false);
    expect(goblin.destroyed).toBe(true);
    expect(registry.get('goblin')).toBeUndefined();
    expect(registry.diagnostics()).toEqual(expectedStats({
        created: 3,
        destroyed: 1,
        fullSyncs: 1,
        active: 2,
    }));
});

test('sync prunes tokens that leave the map without touching surviving identities', () => {
    const registry = new TokenViewRegistry();
    registry.sync([{ id: 'agatha' }, { id: 'bob' }, { id: 'goblin' }]);
    const agatha = registry.get('agatha');
    const bob = registry.get('bob');

    registry.sync([{ id: 'agatha', x: 10 }, { id: 'bob', x: 20 }]);

    expect(registry.size).toBe(2);
    expect(registry.get('agatha')).toBe(agatha);
    expect(registry.get('bob')).toBe(bob);
    expect(registry.get('goblin')).toBeUndefined();
    expect(registry.diagnostics()).toMatchObject({ destroyed: 1, fullSyncs: 2 });
});

test('clear releases all views and a later map load starts clean', () => {
    const registry = new TokenViewRegistry();
    const tokens = Array.from({ length: 50 }, (_, index) => ({ id: `token-${index}`, x: index, y: index }));

    registry.sync(tokens);
    expect(registry.clear()).toBe(0);
    expect(registry.diagnostics()).toEqual(expectedStats({
        created: 50,
        destroyed: 50,
        fullSyncs: 1,
    }));

    registry.sync(tokens);
    expect(registry.size).toBe(50);
    expect(registry.diagnostics()).toEqual(expectedStats({
        created: 100,
        destroyed: 50,
        fullSyncs: 2,
        active: 50,
    }));
});

test('attached GPU-style resources are disposed once when the view is removed', () => {
    const registry = new TokenViewRegistry();
    let disposed = 0;
    const view = registry.ensure({ id: 'agatha' });
    view.attachResource('texture', { name: 'fake-texture' }, () => { disposed += 1; });

    registry.remove('agatha');
    registry.remove('agatha');

    expect(disposed).toBe(1);
});
