const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const Runner = require('../js/vtt/map-field-test-runner-core.js');

function healthy(overrides = {}) {
  return {
    grid: { cols: 40, rows: 40 },
    worldStreaming: { activeChunks: 8, liveCells: 12800 },
    mapSimulation: { activeZones: 7 },
    tokens: Array.from({ length: 8 }, (_, i) => ({ id: `P${i + 1}`, actorId: `actor_${i + 1}`, canonicalScope: 'player', canonicalPlayerKey: `P${i + 1}` })),
    counters: { permissionDenied: 0, commitsWhilePointerDown: 0 },
    coverage: Object.fromEntries(Runner.COVERAGE_KEYS.map((key) => [key, true])),
    viewAsConeDeg: 120,
    ...overrides,
  };
}

test.describe('Map Field-Test Runner', () => {
  test('healthy 8-player field snapshot passes all hard budgets', () => {
    const result = Runner.evaluate(healthy());
    expect(result.overall).toBe('pass');
    expect(result.checks.every((check) => check.state === 'pass')).toBeTruthy();
    expect(result.coverage.done).toBe(result.coverage.total);
  });
  test('120x120 live grid fails the one-live-chunk invariant', () => {
    const result = Runner.evaluate(healthy({ grid: { cols: 120, rows: 120 } }));
    expect(result.checks.find((c) => c.id === 'live-grid').state).toBe('fail');
  });
  test('streaming and simulation budgets fail above 8 chunks, 12,800 cells, or 8 Zones', () => {
    const result = Runner.evaluate(healthy({ worldStreaming: { activeChunks: 9, liveCells: 14400 }, mapSimulation: { activeZones: 9 } }));
    expect(result.checks.find((c) => c.id === 'active-chunks').state).toBe('fail');
    expect(result.checks.find((c) => c.id === 'live-cells').state).toBe('fail');
    expect(result.checks.find((c) => c.id === 'active-zones').state).toBe('fail');
  });
  test('same Actor as player and world token is detected even with different token ids', () => {
    const tokens = healthy().tokens.concat({ id: 'npc-agatha-old', actorId: 'actor_1', canonicalScope: 'world' });
    const result = Runner.evaluate(healthy({ tokens }));
    expect(result.duplicatePlayerActors).toHaveLength(1);
    expect(result.checks.find((c) => c.id === 'duplicate-player-actors').state).toBe('fail');
  });
  test('same visible name does not dedupe unrelated Actor identities', () => {
    expect(Runner.duplicatePlayerActorIds([{ id:'p1',name:'Agatha',actorId:'actor_agatha',canonicalScope:'player',canonicalPlayerKey:'P1' },{ id:'npc1',name:'Agatha',actorId:'actor_other',canonicalScope:'world' }])).toEqual([]);
  });
  test('preview drag can emit many local previews and only one commit after pointer-up', () => {
    const tracker = Runner.createTracker(); tracker.start(); tracker.record('field:pointer-down');
    for (let i=0;i<25;i+=1) tracker.record('vtt:token-preview-moved',{tokenId:'P1'});
    tracker.record('field:pointer-up'); tracker.record('vtt:token-moved',{tokenId:'P1'});
    const snap=tracker.snapshot(); expect(snap.counters.previews).toBe(25); expect(snap.counters.commits).toBe(1); expect(snap.counters.commitsWhilePointerDown).toBe(0); expect(snap.counters.completedPreviewDrags).toBe(1);
  });
  test('commit while pointer remains down is a hard failure', () => {
    const tracker=Runner.createTracker();tracker.start();tracker.record('field:pointer-down');tracker.record('vtt:token-moved',{tokenId:'P1'});
    expect(Runner.evaluate(healthy({counters:tracker.snapshot().counters})).checks.find((c)=>c.id==='commit-during-drag').state).toBe('fail');
  });
  test('View As must exercise the canonical 120 degree cone', () => {
    const good=Runner.evaluate(healthy({viewAsConeDeg:120}));expect(good.checks.find((c)=>c.id==='view-as-cone').state).toBe('pass');
    const bad=Runner.evaluate(healthy({viewAsConeDeg:90}));expect(bad.checks.find((c)=>c.id==='view-as-cone').state).toBe('fail');
  });
  test('permission denied variants are classified as field failures', () => {
    expect(Runner.isPermissionDenied({code:'PERMISSION_DENIED'})).toBeTruthy();expect(Runner.isPermissionDenied(new Error('access denied'))).toBeTruthy();expect(Runner.isPermissionDenied(new Error('network disconnected'))).toBeFalsy();
    const tracker=Runner.createTracker();tracker.start();tracker.reportError({code:'PERMISSION_DENIED',message:'Permission denied'});expect(Runner.evaluate(healthy({counters:tracker.snapshot().counters})).overall).toBe('fail');
  });
  test('manual fog, reconnect, global map and Firebase rules evidence complete coverage slots', () => {
    const tracker=Runner.createTracker();tracker.start();for(const key of ['fogDiscovery','reconnect','globalMap','firebaseRules'])tracker.markCoverage(key);const coverage=tracker.snapshot().coverage;
    expect(coverage.fogDiscovery&&coverage.reconnect&&coverage.globalMap&&coverage.firebaseRules).toBeTruthy();
  });
  test('runner runtime is DM-only, event-driven and never persists telemetry', () => {
    const runtime=fs.readFileSync(path.join(__dirname,'..','js','vtt','map-field-test-runner-runtime.js'),'utf8');
    expect(runtime).toContain("runtime?.bridge?.isDm");expect(runtime).not.toMatch(/setInterval\s*\(/);expect(runtime).not.toMatch(/setTimeout\s*\(/);expect(runtime).not.toMatch(/requestAnimationFrame\s*\(/);expect(runtime).not.toMatch(/firebase\s*\.\s*database|\.transaction\s*\(|\.push\s*\(|\.update\s*\(|\.set\s*\(/i);expect(runtime).toContain("worldStreaming?.snapshot?.()");expect(runtime).toContain("mapSimulation?.snapshot?.()");expect(runtime).toContain('LuminousVttPerformanceGuard?.snapshot?.()');expect(runtime).toContain("navigator?.clipboard?.writeText");expect(runtime).toContain("on(canvas,'mouseup',markPointerUp,true)");
  });
  test('main starts runner after map simulation and lifecycle disposes it', () => {
    const source=fs.readFileSync(path.join(__dirname,'..','js','vtt','main.js'),'utf8');const simulation=source.indexOf("import('./map-simulation-runtime.js')"),runner=source.indexOf("import('./map-field-test-runner-runtime.js')");expect(simulation).toBeGreaterThanOrEqual(0);expect(runner).toBeGreaterThan(simulation);expect(source).toContain('LuminousVttFieldTestRunnerRuntime?.api?.stop?.()');expect(source).toContain("stopIfDisposed(fieldTestRuntime, 'map-field-test-runner')");
  });
});
