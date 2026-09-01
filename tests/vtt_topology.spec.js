const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const topology = require('../js/vtt/topology.js');
const tokenRules = require('../js/vtt/token-interaction.js');
const stateBridge = require('../js/vtt/state-bridge.js');

const grid = { cols: 10, rows: 10, size: 70 };
const verticalEdge = { from: { col: 2, row: 1 }, to: { col: 2, row: 2 }, z: [0] };

const element = (type, state, thresholds) => topology.normalizeElement({
    id: `${type}_${state}`,
    type,
    state,
    thresholds,
    ...verticalEdge,
});

test('legacy threshold defaults remain readable while structural Strength derives from Hardness', () => {
    expect(topology.defaultThresholds('door')).toEqual({ lockpick: 15, break: 15 });
    expect(topology.defaultThresholds('window')).toEqual({ lockpick: 12, break: 10 });
    expect(topology.defaultThresholds('curtain_window')).toEqual({ lockpick: 12, break: 10 });
    expect(topology.strengthThreshold(topology.createElement({ type:'door', from:verticalEdge.from, to:verticalEdge.to }))).toBe(16);
    expect(topology.strengthThreshold(topology.createElement({ type:'window', from:verticalEdge.from, to:verticalEdge.to }))).toBe(15);
});

test('closed topology has the correct movement and vision behavior', () => {
    expect(topology.effectiveFlags(element('door', 'locked'))).toEqual({ blocksMovement: true, blocksVision: true });
    expect(topology.effectiveFlags(element('window', 'locked'))).toEqual({ blocksMovement: true, blocksVision: false });
    expect(topology.effectiveFlags(element('curtain_window', 'closed'))).toEqual({ blocksMovement: true, blocksVision: true });
});

test('legacy open and broken topology remains passable after state-axis migration', () => {
    for (const type of ['door', 'window', 'curtain_window']) {
        expect(topology.effectiveFlags(element(type, 'open'))).toEqual({ blocksMovement: false, blocksVision: false });
        expect(topology.effectiveFlags(element(type, 'broken'))).toEqual({ blocksMovement: false, blocksVision: false });
    }
});

test('locked interactions generate canonical checks and Strength resolves through force', () => {
    const door = element('door', 'locked', { lockpick: 19, break: 21 });
    expect(topology.checkDescriptor(door, 'lockpick')).toMatchObject({
        action: 'unlock',
        threshold: 19,
        requiredItem: 'lockpick',
        rollSpec: { kind: 'skill', abilityId: 'dex', skillId: 'sleight_of_hand' },
    });
    expect(topology.checkDescriptor(door, 'strength')).toMatchObject({
        action: 'force',
        threshold: 21,
        rollSpec: { kind: 'ability', abilityId: 'str', skillId: null },
    });
    expect(topology.checkDescriptor(door, 'athletics')).toMatchObject({
        action: 'force',
        threshold: 21,
        rollSpec: { kind: 'skill', abilityId: 'str', skillId: 'athletics' },
    });
});

test('successful topology actions preserve independent lock/open/condition state', () => {
    const lockedDoor = element('door', 'locked');
    expect(topology.applyAction(lockedDoor, 'unlock')).toMatchObject({
        valid: true,
        element: { state: 'closed', openState: 'closed', lockState: 'unlocked' },
    });
    expect(topology.applyAction(lockedDoor, 'break')).toMatchObject({
        valid: true,
        element: { state: 'broken', condition: 'broken', openState: 'open' },
    });
    expect(topology.applyAction(element('door', 'open'), 'close')).toMatchObject({
        valid: true,
        element: { state: 'closed', openState: 'closed' },
    });
});

test('DM authoring snaps topology to square-grid contours, not diagonals through cells', () => {
    expect(topology.axisAlignedVertex({ col: 2, row: 2 }, { col: 6, row: 4 })).toEqual({ col: 6, row: 2 });
    expect(topology.axisAlignedVertex({ col: 2, row: 2 }, { col: 3, row: 7 })).toEqual({ col: 2, row: 7 });
});

test('token movement is blocked by closed topology and allowed after opening', () => {
    const token = { id: 'player', x: 105, y: 105, radius: 20, z: [0] };
    const closedDoor = {
        id: 'door',
        type: 'door',
        state: 'closed',
        from: { col: 2, row: 0 },
        to: { col: 2, row: 4 },
        z: [0],
        thresholds: { lockpick: 15, break: 15 },
    };
    const blocked = tokenRules.resolveDrop(token, { x: 105, y: 105 }, { x: 245, y: 105 }, { grid, walls: [], topology: [closedDoor] });
    expect(blocked.valid).toBe(false);
    expect(blocked.reason).toBe('BLOCKED_BY_WALL');

    const open = tokenRules.resolveDrop(token, { x: 105, y: 105 }, { x: 245, y: 105 }, { grid, walls: [], topology: [{ ...closedDoor, state: 'open' }] });
    expect(open.valid).toBe(true);
});

test('Ganzúa requirement recognizes inventory aliases and rejects zero quantity', () => {
    expect(stateBridge.inventoryHasItem({ inventory: [{ nombre: 'Ganzúa', cantidad: 1 }] }, 'lockpick')).toBe(true);
    expect(stateBridge.inventoryHasItem({ items: { lockpick: { quantity: 2 } } }, 'lockpick')).toBe(true);
    expect(stateBridge.inventoryHasItem({ inventario: [{ name: 'Lockpick', quantity: 0 }] }, 'lockpick')).toBe(false);
    expect(stateBridge.inventoryHasItem({ inventory: [{ name: 'Torch', quantity: 1 }] }, 'lockpick')).toBe(false);
});

test('VTT wiring exposes DM topology tools and routes checks through existing coordinator roots', () => {
    const html = read('vtt.html');
    const engine = read('js/vtt/engine.js');
    const controller = read('js/vtt/topology-controller.js');
    const bridge = read('js/vtt/state-bridge.js');
    const portal = read('js/vtt/check-portal.js');

    expect(html).toContain('data-vtt-tool="wall"');
    expect(html).toContain('data-vtt-tool="door"');
    expect(html).toContain('data-vtt-tool="window"');
    expect(html).toContain('data-vtt-tool="curtain_window"');
    expect(controller).toContain('axisAlignedVertex');
    expect(engine).toContain("blockingSegments(this.mapData.topology, 'vision'");
    expect(bridge).toContain("const CHECK_REQUEST_ROOT = 'theatre_check_requests'");
    expect(bridge).toContain("const CHECK_COMMAND_ROOT = 'theatre_check_commands'");
    expect(bridge).toContain("const CHECK_LIVE_ROOT = 'theatre_check_live'");
    expect(bridge).toContain("live.outcome === 'passed'");
    expect(portal).toContain('#theatre-check-command-prompt');
});

test('new and modified VTT JavaScript files pass Node syntax parsing', () => {
    const commonJsCompatible = [
        'js/vtt/topology.js',
        'js/vtt/topology-interaction.js',
        'js/vtt/interaction-radial.js',
        'js/vtt/topology-interaction-authority.js',
        'js/vtt/topology-interaction-authority-bootstrap.js',
        'js/vtt/state-bridge.js',
        'js/vtt/check-portal.js',
        'js/vtt/token-interaction.js',
    ];
    for (const file of commonJsCompatible) execFileSync(process.execPath, ['--check', path.join(__dirname, '..', file)], { stdio: 'pipe' });

    const esModules = [
        'js/vtt/topology-controller.js',
        'js/vtt/engine.js',
        'js/vtt/renderer.js',
        'js/vtt/main.js',
        'js/vtt/mapData.js',
    ];
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'luminous-vtt-syntax-'));
    try {
        for (const file of esModules) {
            const tempFile = path.join(tempDir, `${path.basename(file, '.js')}.mjs`);
            fs.writeFileSync(tempFile, read(file));
            execFileSync(process.execPath, ['--check', tempFile], { stdio: 'pipe' });
        }
    } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
});

test('Firebase rules keep topology canonical as DM-write and player actions request-only', () => {
    const rules = JSON.parse(read('database.rules.json')).rules;
    expect(rules.vtt_topology['.read']).toBe('auth != null');
    expect(rules.vtt_topology.$mapId['.write']).toContain("auth.uid === 'e9JwFZrtk6g8UMqq2Hf9EHVY7Ay1'");
    expect(rules.vtt_topology_action_requests.$mapId.$requestId['.write']).toContain('!data.exists()');
    expect(rules.vtt_topology_action_requests.$mapId.$requestId['.write']).toContain("newData.child('requesterUid').val() === auth.uid");
});
