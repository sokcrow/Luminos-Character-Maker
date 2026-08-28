const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const tokenRules = require('../js/vtt/token-interaction.js');
const engineSource = read('js/vtt/engine.js');
const rendererSource = read('js/vtt/renderer.js');
const cameraSource = read('js/vtt/camera.js');
const htmlSource = read('vtt.html');

const grid = { cols: 10, rows: 10, size: 70 };

test('square-grid drops snap to the center of a cell', () => {
    expect(tokenRules.snapPointToGrid({ x: 211, y: 211 }, grid)).toEqual({
        x: 245,
        y: 245,
        col: 3,
        row: 3,
    });
});

test('drag lookup only selects draggable tokens on the active layer', () => {
    const tokens = [
        { id: 'floor0', x: 105, y: 105, radius: 28, draggable: true, z: [0] },
        { id: 'locked', x: 175, y: 105, radius: 28, draggable: false, z: [0] },
        { id: 'floor1', x: 245, y: 105, radius: 28, draggable: true, z: [1] },
    ];

    expect(tokenRules.findDraggableToken(tokens, { x: 105, y: 105 }, grid, 0)?.id).toBe('floor0');
    expect(tokenRules.findDraggableToken(tokens, { x: 175, y: 105 }, grid, 0)).toBeNull();
    expect(tokenRules.findDraggableToken(tokens, { x: 245, y: 105 }, grid, 0)).toBeNull();
});

test('drop validation blocks direct dragging through movement walls', () => {
    const token = { id: 'player', x: 105, y: 105, radius: 20, z: [0] };
    const mapData = {
        grid,
        walls: [
            { x1: 140, y1: 0, x2: 140, y2: 350, z: [0], blocksMovement: true, blocksVision: true },
        ],
    };

    const result = tokenRules.resolveDrop(token, { x: 105, y: 105 }, { x: 180, y: 105 }, mapData);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('BLOCKED_BY_WALL');
});

test('drops released outside the map are rejected instead of clamped to an edge cell', () => {
    const token = { id: 'player', x: 105, y: 105, radius: 20, z: [0] };
    const result = tokenRules.resolveDrop(token, { x: 105, y: 105 }, { x: -15, y: 105 }, { grid, walls: [] });

    expect(result).toEqual({ valid: false, reason: 'OUT_OF_BOUNDS' });
});

test('valid drops return canonical grid coordinates', () => {
    const token = { id: 'player', x: 105, y: 105, radius: 20, z: [0] };
    const result = tokenRules.resolveDrop(token, { x: 105, y: 105 }, { x: 225, y: 225 }, { grid, walls: [] });

    expect(result).toMatchObject({ valid: true, x: 245, y: 245, col: 3, row: 3 });
});

test('VTT loads token interaction before the module engine and uses drag instead of WASD movement', () => {
    expect(htmlSource).toContain('<script src="js/vtt/token-interaction.js"></script>');
    expect(engineSource).toContain("this.canvas.addEventListener('mousedown', this.handleTokenMouseDown)");
    expect(engineSource).toContain("new CustomEvent('vtt:token-moved'");
    expect(engineSource).not.toContain('playerSpeed = 4');
    expect(engineSource).not.toContain('this.keys = { w: false');
});

test('camera drag yields to draggable tokens and renderer draws round person tokens', () => {
    expect(cameraSource).toContain('setDragGuard(guard)');
    expect(rendererSource).toContain('drawPersonIcon(token, radius)');
    expect(rendererSource).toContain("(token.icon || 'person') === 'person'");
    expect(rendererSource).toContain('this.ctx.arc(token.x, token.y, radius, 0, Math.PI * 2)');
});
