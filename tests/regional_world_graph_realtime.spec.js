const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

test.describe('Regional World Graph Realtime/Performance guards', () => {
  test('graph core and runtime are pure of Firebase and polling', () => {
    const core = read('js/regional-world-graph-core.js');
    const runtime = read('js/regional-world-graph-runtime.js');
    for (const source of [core, runtime]) {
      expect(source).not.toContain('firebase.database');
      expect(source).not.toContain('.ref(');
      expect(source).not.toContain('setInterval(');
      expect(source).not.toContain('setTimeout(');
    }
    expect(core).toContain('Travel.segmentDurationSeconds');
    expect(runtime).toContain('Scheduler.startActivity(command)');
  });

  test('graph planning submits one scheduler activity rather than per-hex writes', () => {
    const runtime = read('js/regional-world-graph-runtime.js');
    const calls = runtime.match(/Scheduler\.startActivity\(command\)/g) || [];
    expect(calls).toHaveLength(1);
    expect(runtime).not.toMatch(/for\s*\([^)]*route[^)]*\)[\s\S]{0,200}(set|update|push)\(/);
    expect(runtime).not.toContain('worldPosition');
  });

  test('scheduler validates graph-v1 requests without adding a graph Firebase listener', () => {
    const scheduler = read('js/world-time-scheduler-runtime.js');
    expect(scheduler).toContain('LuminousRegionalWorldGraphCore');
    expect(scheduler).toContain('graphCore.validateScheduledCommand');
    expect(scheduler).toContain('requesterIsDm');
    expect(scheduler).toContain('routing?.accessMode === "bypass"');
    expect(scheduler).not.toContain('regional_world_graph_requests');
    expect(scheduler).not.toMatch(/db\.ref\([^\n]*graph[^\n]*\)\.on\(/i);
  });

  test('loader installs graph core before scheduler runtime and graph runtime after travel runtime', () => {
    const loader = read('js/scene-time-engine.js');
    const travelCore = loader.indexOf("'regional-travel-core'");
    const graphCore = loader.indexOf("'regional-world-graph-core'");
    const schedulerRuntime = loader.indexOf("'world-time-scheduler-runtime'");
    const travelRuntime = loader.indexOf("'regional-travel-runtime'");
    const graphRuntime = loader.indexOf("'regional-world-graph-runtime'");
    expect(travelCore).toBeGreaterThan(-1);
    expect(graphCore).toBeGreaterThan(travelCore);
    expect(schedulerRuntime).toBeGreaterThan(graphCore);
    expect(travelRuntime).toBeGreaterThan(schedulerRuntime);
    expect(graphRuntime).toBeGreaterThan(travelRuntime);
  });

  test('arrival remains one multipath update and carries graph entry metadata', () => {
    const travelRuntime = read('js/regional-travel-runtime.js');
    const updateCalls = travelRuntime.match(/db\.ref\(\)\.update\(updates\)/g) || [];
    expect(updateCalls).toHaveLength(1);
    expect(travelRuntime).toContain('regionalEntrySide');
    expect(travelRuntime).toContain('regionalGraphId');
    expect(travelRuntime).toContain('regionalGraphRevision');
    expect(travelRuntime).toContain('regionalGraphFingerprint');
    expect(travelRuntime).not.toMatch(/for\s*\([^)]*route[^)]*\)/);
  });

  test('legacy direct regional travel remains available for compatibility', () => {
    const travelRuntime = read('js/regional-travel-runtime.js');
    expect(travelRuntime).toContain('function startTravel(input = {})');
    expect(travelRuntime).toContain('Core.createTravelPlan(input)');
    expect(travelRuntime).toContain('Scheduler.startActivity(command)');
  });
});
