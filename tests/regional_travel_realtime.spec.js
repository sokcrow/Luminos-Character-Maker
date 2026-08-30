const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const ROOT = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');

const core = read('js/regional-travel-core.js');
const runtime = read('js/regional-travel-runtime.js');
const schedulerRuntime = read('js/world-time-scheduler-runtime.js');
const loader = read('js/scene-time-engine.js');

test.describe('Regional Travel Realtime contract', () => {
  test('modules parse cleanly', () => {
    execFileSync(process.execPath, ['--check', path.join(ROOT, 'js/regional-travel-core.js')]);
    execFileSync(process.execPath, ['--check', path.join(ROOT, 'js/regional-travel-runtime.js')]);
    execFileSync(process.execPath, ['--check', path.join(ROOT, 'js/world-time-scheduler-runtime.js')]);
  });

  test('loader installs travel core before scheduler runtime and travel runtime after it', () => {
    const coreAt = loader.indexOf("'regional-travel-core'");
    const schedulerAt = loader.indexOf("'world-time-scheduler-runtime'");
    const runtimeAt = loader.indexOf("'regional-travel-runtime'");
    expect(coreAt).toBeGreaterThan(-1);
    expect(schedulerAt).toBeGreaterThan(coreAt);
    expect(runtimeAt).toBeGreaterThan(schedulerAt);
  });

  test('travel runtime delegates time ownership to the existing scheduler', () => {
    expect(runtime).toContain('Scheduler.startActivity(command)');
    expect(runtime).toContain('Scheduler.cancelActivity(groupId)');
    expect(runtime).not.toContain('campaña/calendario');
    expect(runtime).not.toContain('.transaction(');
  });

  test('travel adds no timer polling or per-second loops', () => {
    expect(runtime).not.toContain('setInterval(');
    expect(runtime).not.toContain('setTimeout(');
    expect(runtime).not.toContain('.on("value"');
    expect(runtime).not.toContain(".on('value'");
    expect(core).not.toContain('setInterval(');
  });

  test('scheduler publishes a local snapshot instead of Regional Travel opening another Firebase scheduler listener', () => {
    expect(schedulerRuntime).toContain('luminous:world-scheduler-updated');
    expect(runtime).toContain('addEventListener?.("luminous:world-scheduler-updated"');
    expect(runtime).not.toContain('world_scheduler`).on');
  });

  test('DM scheduler revalidates regional duration and route before accepting request', () => {
    expect(schedulerRuntime).toContain('specializedRequestValid(request)');
    expect(schedulerRuntime).toContain('travelCore.validateScheduledCommand(request).valid === true');
    expect(schedulerRuntime.indexOf('if (!specializedRequestValid(request)) return false;')).toBeGreaterThan(-1);
  });

  test('arrival application is DM-only, idempotent, and one multi-path write', () => {
    expect(runtime).toContain('if (!isDm() || group?.status !== "completed") return false;');
    expect(runtime).toContain('travelArrivalId === arrivalId');
    expect(runtime).toContain('await db.ref().update(updates);');
    expect(runtime).not.toContain('.set(worldPosition)');
    expect(runtime).not.toContain('.push(');
  });

  test('arrival only updates player world positions and does not walk local chunks', () => {
    expect(runtime).toContain('`${PLAYER_ROOT}/${playerId}/worldPosition`');
    expect(runtime).not.toContain('LuminousVttWorldStreaming');
    expect(runtime).not.toContain('procedural-chunk-loaded');
    expect(runtime).not.toContain('vtt:token-moved');
  });

  test('arrival exposes one local event for map/router integration without extra Realtime writes', () => {
    expect(runtime).toContain('luminous:regional-travel-arrival');
    expect(runtime).toContain('new CustomEvent');
  });

  test('core caps route and members for Realtime payload safety', () => {
    expect(core).toContain('maxRouteHexes: 256');
    expect(core).toContain('maxMembers: 8');
    expect(core).toContain('route.length > CONFIG.maxRouteHexes');
  });

  test('existing scheduler join command contract remains intact', () => {
    expect(schedulerRuntime).toContain('type: "join_groups"');
  });
});
