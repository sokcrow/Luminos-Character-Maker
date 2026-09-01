import { test, expect } from '@playwright/test';
import '../js/vtt/token-state.js';

const baseApi = globalThis.LuminousVttTokenState;

function position(x, y, zLayer = 0) {
    return {
        x,
        y,
        zLayer,
        elevationFt: 0,
        gridPosition: { col: Math.floor(x / 70), row: Math.floor(y / 70), z: zLayer },
    };
}

test('single canonical world update identifies exactly one token', () => {
    const api = baseApi;
    const goblin = { id: 'goblin', x: 0, y: 0, zLayer: 0 };
    const mapData = { id: 'map', tokens: [goblin] };
    const changes = [];
    const bridge = api.createBridge({ mapData, isDm: true, root: {}, onTokensChanged: (change) => changes.push(change) });

    bridge.syncSingleWorldRecord('goblin', { tokenId: 'goblin', position: position(140, 210) });

    expect(goblin.x).toBe(140);
    expect(goblin.y).toBe(210);
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({
        scope: 'world',
        type: 'token-update',
        source: 'remote',
        tokenId: 'goblin',
        token: goblin,
        changes: { position: true },
    });
});

test('single remote player update creates and then targets the canonical player token', () => {
    const api = baseApi;
    const mapData = { id: 'map', tokens: [] };
    const changes = [];
    const bridge = api.createBridge({ mapData, isDm: true, root: {}, onTokensChanged: (change) => changes.push(change) });

    const token = bridge.syncSinglePlayerRecord('player-one', {
        playerId: 'player-one',
        actorId: 'actor-one',
        position: position(70, 140),
    });

    expect(token.id).toBe('player:player-one');
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({
        scope: 'players',
        type: 'token-update',
        source: 'remote',
        tokenId: 'player:player-one',
        changes: { position: true, created: true },
    });

    changes.length = 0;
    bridge.syncSinglePlayerRecord('player-one', {
        playerId: 'player-one',
        actorId: 'actor-one',
        position: position(210, 280),
    });

    expect(mapData.tokens).toHaveLength(1);
    expect(mapData.tokens[0]).toBe(token);
    expect(changes[0]).toMatchObject({ tokenId: 'player:player-one', changes: { position: true, created: false } });
});

test('single remote player removal identifies the view that must be destroyed', () => {
    const api = baseApi;
    const mapData = { id: 'map', tokens: [] };
    const changes = [];
    const bridge = api.createBridge({ mapData, isDm: true, root: {}, onTokensChanged: (change) => changes.push(change) });

    bridge.syncSinglePlayerRecord('player-one', {
        playerId: 'player-one',
        actorId: 'actor-one',
        position: position(70, 140),
    });
    changes.length = 0;

    expect(bridge.removePlayerRecord('player-one')).toBe(true);
    expect(mapData.tokens).toHaveLength(0);
    expect(changes[0]).toMatchObject({
        scope: 'players',
        type: 'token-remove',
        tokenId: 'player:player-one',
        token: null,
        changes: { removed: true },
    });
});

test('bootstrap records remain an explicit batch fallback', () => {
    const api = baseApi;
    const a = { id: 'a', x: 0, y: 0 };
    const b = { id: 'b', x: 0, y: 0 };
    const mapData = { id: 'map', tokens: [a, b] };
    const changes = [];
    const bridge = api.createBridge({ mapData, isDm: true, root: {}, onTokensChanged: (change) => changes.push(change) });

    bridge.syncWorldRecords({
        a: { tokenId: 'a', position: position(70, 70) },
        b: { tokenId: 'b', position: position(140, 140) },
    });

    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({
        scope: 'world',
        type: 'token-batch',
        source: 'remote',
        tokenId: null,
        changes: { bootstrap: true },
    });
});

test('dynamic world token updates and removals preserve their token id', async () => {
    await import('../js/vtt/token-state-dynamic-patch.js');
    const api = globalThis.LuminousVttTokenState;
    const mapData = { id: 'map', tokens: [] };
    const changes = [];
    const bridge = api.createBridge({ mapData, isDm: true, root: {}, onTokensChanged: (change) => changes.push(change) });

    const wolf = bridge.applyDynamicRecord('wolf', {
        tokenId: 'wolf',
        token: { id: 'wolf', name: 'Wolf', actorId: 'wolf-actor' },
        position: position(210, 140),
    });

    expect(wolf.id).toBe('wolf');
    expect(changes[0]).toMatchObject({
        scope: 'world-dynamic',
        type: 'token-update',
        tokenId: 'wolf',
        changes: { position: true, appearance: true, created: true },
    });

    changes.length = 0;
    expect(bridge.removeDynamicRecord('wolf')).toBe(true);
    expect(changes[0]).toMatchObject({
        scope: 'world-dynamic',
        type: 'token-remove',
        tokenId: 'wolf',
        changes: { removed: true },
    });
});
