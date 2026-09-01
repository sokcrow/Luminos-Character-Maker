const { test, expect } = require('@playwright/test');
const Transition = require('../js/regional-local-transition-core.js');
const Travel = require('../js/regional-travel-core.js');
const Streaming = require('../js/vtt/world-streaming-core.js');

const hex = (q, r = 0, district = 'K') => ({ district, q, r });
const basePosition = (q = 0, r = 0) => ({
  worldId: 'luminous', regionId: 'K', zoneId: `regional_${q}_${r}`,
  chunkCol: 1, chunkRow: 1, x: 1400, y: 1400, zLayer: 0, elevationFt: 0,
  regionalHex: hex(q, r),
});

test.describe('Regional ↔ Local Transition', () => {
  test('all six regional entry sides land inside exactly one edge chunk', () => {
    const expected = {
      west: [0, 1, 0, 20],
      southwest: [0, 2, 10, 39],
      southeast: [2, 2, 29, 39],
      east: [2, 1, 39, 20],
      northeast: [2, 0, 29, 0],
      northwest: [0, 0, 10, 0],
    };
    for (const side of Transition.SIDES) {
      const anchor = Transition.anchorForSide(side);
      expect([anchor.chunkCol, anchor.chunkRow, anchor.cellCol, anchor.cellRow]).toEqual(expected[side]);
      const position = Transition.entryPosition({ worldId: 'luminous', regionalHex: hex(4, -2), entrySide: side });
      expect(position.zoneId).toBe('regional_4_-2');
      expect(position.regionalHex).toEqual(hex(4, -2));
      expect(position.entrySide).toBe(side);
      expect(position.x).toBeGreaterThan(0);
      expect(position.x).toBeLessThan(40 * 70);
      expect(position.y).toBeGreaterThan(0);
      expect(position.y).toBeLessThan(40 * 70);
    }
  });

  test('exit vectors and opposite entry sides round-trip every axial direction', () => {
    const origin = hex(5, -3);
    for (const side of Transition.SIDES) {
      const target = Transition.targetHexForExit(origin, side);
      const back = Transition.targetHexForExit(target, Transition.oppositeSide(side));
      expect(back).toEqual(origin);
      expect(Travel.areAdjacent(origin, target)).toBe(true);
    }
  });

  test('zone boundary resolver maps the six physical exits deterministically', () => {
    const descriptor = { chunkCols: 3, chunkRows: 3 };
    expect(Transition.boundaryExitSide({ descriptor: { ...descriptor, activeChunk: { col: 0, row: 1 } }, exit: { dx: -1, dy: 0 } })).toBe('west');
    expect(Transition.boundaryExitSide({ descriptor: { ...descriptor, activeChunk: { col: 2, row: 1 } }, exit: { dx: 1, dy: 0 } })).toBe('east');
    expect(Transition.boundaryExitSide({ descriptor: { ...descriptor, activeChunk: { col: 0, row: 0 } }, exit: { dx: -1, dy: -1 } })).toBe('northwest');
    expect(Transition.boundaryExitSide({ descriptor: { ...descriptor, activeChunk: { col: 2, row: 0 } }, exit: { dx: 1, dy: -1 } })).toBe('northeast');
    expect(Transition.boundaryExitSide({ descriptor: { ...descriptor, activeChunk: { col: 0, row: 2 } }, exit: { dx: -1, dy: 1 } })).toBe('southwest');
    expect(Transition.boundaryExitSide({ descriptor: { ...descriptor, activeChunk: { col: 2, row: 2 } }, exit: { dx: 1, dy: 1 } })).toBe('southeast');
  });

  test('central north/south boundary uses cursor half to choose the correct hex side', () => {
    const descriptorNorth = { chunkCols: 3, chunkRows: 3, activeChunk: { col: 1, row: 0 } };
    const descriptorSouth = { chunkCols: 3, chunkRows: 3, activeChunk: { col: 1, row: 2 } };
    expect(Transition.boundaryExitSide({ descriptor: descriptorNorth, exit: { dx: 0, dy: -1, width: 2800 }, requestedPoint: { x: 500 } })).toBe('northwest');
    expect(Transition.boundaryExitSide({ descriptor: descriptorNorth, exit: { dx: 0, dy: -1, width: 2800 }, requestedPoint: { x: 2200 } })).toBe('northeast');
    expect(Transition.boundaryExitSide({ descriptor: descriptorSouth, exit: { dx: 0, dy: 1, width: 2800 }, requestedPoint: { x: 500 } })).toBe('southwest');
    expect(Transition.boundaryExitSide({ descriptor: descriptorSouth, exit: { dx: 0, dy: 1, width: 2800 }, requestedPoint: { x: 2200 } })).toBe('southeast');
  });

  test('local exit creates adjacent target hex and enters from the opposite side', () => {
    const plan = Transition.createLocalExitPlan({ worldPosition: basePosition(), exitSide: 'east', transitionId: 'move_1' });
    expect(plan.valid).toBe(true);
    expect(plan.sourceHex).toEqual(hex(0, 0));
    expect(plan.targetHex).toEqual(hex(1, 0));
    expect(plan.targetEntrySide).toBe('west');
    expect(plan.targetPosition.zoneId).toBe('regional_1_0');
    expect(plan.targetPosition.chunkCol).toBe(0);
    expect(plan.targetPosition.chunkRow).toBe(1);
    expect(plan.targetPosition.transitionId).toBe('move_1');
    expect(plan.targetZone.activeChunk).toEqual({ col: 0, row: 1 });
  });

  test('regional zone seed is deterministic and changes with the hex', () => {
    const a = Transition.zoneSeedForHex('luminous', hex(3, 2));
    expect(a).toBe(Transition.zoneSeedForHex('luminous', hex(3, 2)));
    expect(a).not.toBe(Transition.zoneSeedForHex('luminous', hex(4, 2)));
  });

  test('transition preserves graph identity and vertical metadata', () => {
    const source = {
      ...basePosition(), zLayer: 2, elevationFt: 15,
      regionalGraphId: 'k_graph', regionalGraphRevision: 7, regionalGraphFingerprint: 'abc123',
    };
    const plan = Transition.createLocalExitPlan({ worldPosition: source, exitSide: 'northwest', transitionId: 'meta' });
    expect(plan.targetPosition.zLayer).toBe(2);
    expect(plan.targetPosition.elevationFt).toBe(15);
    expect(plan.targetPosition.regionalGraphId).toBe('k_graph');
    expect(plan.targetPosition.regionalGraphRevision).toBe(7);
    expect(plan.targetPosition.regionalGraphFingerprint).toBe('abc123');
  });

  test('eight simultaneous local exits remain eight active chunks, not eight full 3x3 zones', () => {
    const manager = Streaming.createLifecycleManager({ warmTtlMs: 0, maxWarmChunks: 0, maxActiveChunks: 8 });
    const actors = [];
    for (let i = 0; i < 8; i += 1) {
      const plan = Transition.createLocalExitPlan({ worldPosition: basePosition(i * 2, i), exitSide: 'east', transitionId: `t${i}` });
      expect(plan.valid).toBe(true);
      actors.push({ id: `p${i}`, position: plan.targetPosition });
    }
    const result = manager.reconcile(actors, 0);
    expect(result.metrics.activeChunks).toBe(8);
    expect(result.metrics.residentChunks).toBe(8);
    expect(result.metrics.liveCells).toBe(8 * 40 * 40);
  });

  test('ten thousand transition calculations retain no registry or runtime state', () => {
    let checksum = 0;
    for (let i = 0; i < 10000; i += 1) {
      const plan = Transition.createLocalExitPlan({ worldPosition: basePosition(i % 100, Math.floor(i / 100)), exitSide: Transition.SIDES[i % 6], transitionId: `x${i}` });
      expect(plan.valid).toBe(true);
      checksum += plan.targetHex.q + plan.targetHex.r;
    }
    expect(Number.isFinite(checksum)).toBe(true);
    expect(Object.keys(Transition).includes('registry')).toBe(false);
  });
});
