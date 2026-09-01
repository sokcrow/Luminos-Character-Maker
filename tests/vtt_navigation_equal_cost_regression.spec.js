const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

function freshRequire(relativePath) {
  const file = path.join(__dirname, '..', relativePath);
  delete require.cache[require.resolve(file)];
  return require(file);
}

async function loadPolish() {
  const source = fs.readFileSync(path.join(__dirname, '..', 'js/vtt/movement-navigation-polish.js'), 'utf8');
  const tmp = path.join(os.tmpdir(), `luminous-navigation-equal-cost-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}.mjs`);
  fs.writeFileSync(tmp, source);
  const mod = await import(`${pathToFileURL(tmp).href}?t=${Date.now()}`);
  return { mod, tmp };
}

function createMap() {
  return {
    grid: { cols: 60, rows: 40, size: 70, distancePerCell: 5 },
    movement: { diagonalRule: '5e', blockTokens: false, terrain: {} },
    tokens: [],
  };
}

function installIntegratedPathfinding() {
  global.LuminousVttTokenInteraction = undefined;
  global.LuminousVttPathfinding = freshRequire('js/vtt/pathfinding.js');
  global.LuminousVttMovementEngine = freshRequire('js/vtt/movement-engine.js');
  global.LuminousVttTokenState = null;
  freshRequire('js/vtt/movement-integration-patch.js');
  return global.LuminousVttPathfinding;
}

function directionChanges(cells) {
  let previous = null;
  let turns = 0;
  for (let index = 1; index < cells.length; index += 1) {
    const dx = Math.sign(cells[index].col - cells[index - 1].col);
    const dy = Math.sign(cells[index].row - cells[index - 1].row);
    const direction = `${dx},${dy}`;
    if (previous != null && direction !== previous) turns += 1;
    previous = direction;
  }
  return turns;
}

test('long horizontal and vertical drags use the aligned fast path without zigzag', async () => {
  installIntegratedPathfinding();
  const { mod, tmp } = await loadPolish();
  try {
    const runtime = mod.installStraightPathfinding(global);
    const map = createMap();
    const token = { id: 'player-1', x: 0, y: 0, zLayer: 0 };

    const horizontal = runtime.findPath({
      token,
      start: { col: 42, row: 17 },
      target: { col: 3, row: 17 },
      mapData: map,
      blockTokens: false,
    });
    expect(horizontal.valid).toBe(true);
    expect(horizontal.fastPath).toBe('aligned');
    expect(horizontal.visited).toBe(0);
    expect(horizontal.cells).toHaveLength(40);
    expect(horizontal.cells.every((cell) => cell.row === 17)).toBe(true);
    expect(directionChanges(horizontal.cells)).toBe(0);
    expect(horizontal.costFt).toBe(195);

    const vertical = runtime.findPath({
      token,
      start: { col: 21, row: 34 },
      target: { col: 21, row: 4 },
      mapData: map,
      blockTokens: false,
    });
    expect(vertical.valid).toBe(true);
    expect(vertical.fastPath).toBe('aligned');
    expect(vertical.visited).toBe(0);
    expect(vertical.cells.every((cell) => cell.col === 21)).toBe(true);
    expect(directionChanges(vertical.cells)).toBe(0);
    expect(vertical.costFt).toBe(150);
  } finally {
    fs.unlinkSync(tmp);
  }
});

test('5e equal-cost relaxation replaces zigzag predecessors on long oblique routes', async () => {
  installIntegratedPathfinding();
  const { mod, tmp } = await loadPolish();
  try {
    const runtime = mod.installStraightPathfinding(global);
    const map = createMap();
    const token = { id: 'player-1', x: 0, y: 0, zLayer: 0 };

    const result = runtime.findPath({
      token,
      start: { col: 4, row: 17 },
      target: { col: 44, row: 21 },
      mapData: map,
      blockTokens: false,
    });

    expect(result.valid).toBe(true);
    expect(result.costFt).toBe(200);
    expect(result.cells[0]).toEqual({ col: 4, row: 17 });
    expect(result.cells.at(-1)).toEqual({ col: 44, row: 21 });

    const rows = result.cells.map((cell) => cell.row);
    expect(rows.every((row) => row >= 17 && row <= 21)).toBe(true);
    for (let index = 1; index < rows.length; index += 1) {
      expect(rows[index]).toBeGreaterThanOrEqual(rows[index - 1]);
    }

    const reverse = runtime.findPath({
      token,
      start: { col: 44, row: 21 },
      target: { col: 4, row: 17 },
      mapData: map,
      blockTokens: false,
    });
    expect(reverse.valid).toBe(true);
    const reverseRows = reverse.cells.map((cell) => cell.row);
    for (let index = 1; index < reverseRows.length; index += 1) {
      expect(reverseRows[index]).toBeLessThanOrEqual(reverseRows[index - 1]);
    }
  } finally {
    fs.unlinkSync(tmp);
  }
});

test('an obstacle disables the direct fast path and still produces a legal deterministic detour', async () => {
  installIntegratedPathfinding();
  const { mod, tmp } = await loadPolish();
  try {
    const runtime = mod.installStraightPathfinding(global);
    const map = createMap();
    map.movement.terrain['22_17'] = { blocked: true };
    const token = { id: 'player-1', x: 0, y: 0, zLayer: 0 };
    const options = {
      token,
      start: { col: 4, row: 17 },
      target: { col: 44, row: 17 },
      mapData: map,
      blockTokens: false,
    };

    const first = runtime.findPath(options);
    const second = runtime.findPath(options);
    expect(first.valid).toBe(true);
    expect(first.fastPath).toBeUndefined();
    expect(first.cells.some((cell) => cell.row !== 17)).toBe(true);
    expect(first.cells).toEqual(second.cells);
    expect(first.costFt).toBe(second.costFt);
  } finally {
    fs.unlinkSync(tmp);
  }
});