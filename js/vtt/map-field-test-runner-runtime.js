import './map-field-test-runner-core.js';

const clean = (value) => String(value ?? '').trim();
const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));

function hostWindow() {
  try {
    if (window.parent && window.parent !== window && window.parent.document) return window.parent;
  } catch (_) {}
  return window;
}

function playerToken(token = {}) {
  const Core = globalThis.LuminousVttMapFieldTestRunner;
  return Boolean(Core?.playerScope?.(token));
}

function liveMetrics(runtime, mapData, tracker) {
  const liveRuntime = globalThis.LuminousVttRuntime || runtime;
  const world = liveRuntime?.worldStreaming?.snapshot?.() || {};
  const simulationRaw = liveRuntime?.mapSimulation?.snapshot?.() || {};
  const simulation = simulationRaw.lifecycle || simulationRaw;
  const perf = globalThis.LuminousVttPerformanceGuard?.snapshot?.() || null;
  const track = tracker.snapshot();
  const observer = track.lastObserver || {};
  const target = (mapData.tokens || []).find((token) => clean(token?.id) === clean(observer.targetTokenId));
  const lighting = hostWindow()?.LuminousVttLightingEngine || globalThis.LuminousVttLightingEngine;
  const cone = observer.mode === 'view_as'
    ? Number(lighting?.visionConeDeg?.(target) ?? target?.visionConeDeg ?? target?.vision?.coneDeg ?? 120)
    : null;
  const grid = mapData.grid || {};
  return {
    generatedAt: Date.now(),
    map: {
      id: clean(mapData.id || mapData.mapId || 'default'),
      worldId: clean(mapData.worldId || mapData.world?.id || 'luminous'),
      regionId: clean(mapData.regionId || mapData.region?.id || 'region'),
      zoneId: clean(mapData.procedural?.streaming?.zoneId || mapData.zoneId || mapData.id || mapData.mapId || 'zone'),
    },
    grid: { cols: Number(grid.cols) || 0, rows: Number(grid.rows) || 0, size: Number(grid.size) || 70 },
    tokens: (mapData.tokens || []).map((token) => ({
      id: clean(token?.id),
      actorId: clean(token?.actorId || token?.characterLink?.actorId || token?.actorRef?.id) || null,
      canonicalScope: clean(token?.canonicalScope),
      canonicalPlayerKey: clean(token?.canonicalPlayerKey),
      playerId: clean(token?.playerId || token?.characterLink?.playerId),
      viewer: token?.viewer === true,
    })),
    playerCount: (mapData.tokens || []).filter(playerToken).length,
    worldStreaming: clone(world),
    mapSimulation: clone(simulation),
    performance: clone(perf),
    globalMap: {
      available: Boolean(globalThis.LuminousGlobalMapRuntime),
      open: Boolean(globalThis.LuminousGlobalMapRuntime?.isOpen),
    },
    observer: clone(observer),
    viewAsConeDeg: Number.isFinite(cone) ? cone : null,
    counters: clone(track.counters),
    coverage: clone(track.coverage),
    startedAt: track.startedAt,
    stoppedAt: track.stoppedAt,
    active: track.active,
  };
}

export function start({ runtime = globalThis.LuminousVttRuntime, mapData = runtime?.engine?.mapData } = {}) {
  if (!runtime?.engine || !mapData) return null;
  if (!Boolean(runtime?.bridge?.isDm || runtime?.tokenState?.isDm)) return null;
  if (globalThis.LuminousVttFieldTestRunnerRuntime?.api) return globalThis.LuminousVttFieldTestRunnerRuntime.api;

  const Core = globalThis.LuminousVttMapFieldTestRunner;
  if (!Core) throw new Error('MAP_FIELD_TEST_RUNNER_CORE_REQUIRED');
  const canvas = runtime.engine.canvas;
  const host = hostWindow();
  const doc = host?.document || document;
  const tracker = Core.createTracker();
  const cleanup = [];
  let stopped = false;
  let panel = null;
  let statusNode = null;
  let metricsNode = null;
  let coverageNode = null;

  function on(target, name, handler, options) {
    target?.addEventListener?.(name, handler, options);
    cleanup.push(() => target?.removeEventListener?.(name, handler, options));
  }

  function evaluate() {
    const input = liveMetrics(runtime, mapData, tracker);
    const evaluation = Core.evaluate(input);
    return Object.freeze({ input, evaluation });
  }

  function render() {
    if (!panel) return evaluate();
    const { input, evaluation } = evaluate();
    statusNode.textContent = `${evaluation.overall.toUpperCase()} · ${evaluation.coverage.done}/${evaluation.coverage.total}`;
    statusNode.dataset.state = evaluation.overall;
    const world = input.worldStreaming || {};
    const sim = input.mapSimulation || {};
    metricsNode.textContent = [
      `Players ${input.playerCount}/8`,
      `Chunks ${world.activeChunks ?? '—'}/8`,
      `Cells ${world.liveCells ?? '—'}/12800`,
      `Zones ${sim.activeZones ?? '—'}/8`,
      `Preview ${input.counters.previews || 0}`,
      `Commit ${input.counters.commits || 0}`,
      `Denied ${input.counters.permissionDenied || 0}`,
    ].join(' · ');
    coverageNode.innerHTML = Core.COVERAGE_KEYS.map((key) => `<span data-done="${input.coverage[key] === true ? '1' : '0'}">${input.coverage[key] === true ? '✓' : '○'} ${key}</span>`).join('');
    return { input, evaluation };
  }

  function recordEvent(event) {
    tracker.record(event.type, event.detail || {});
    render();
  }

  function markPointerDown() {
    tracker.record('field:pointer-down');
    render();
  }

  function markPointerUp() {
    tracker.record('field:pointer-up');
    render();
  }

  function onError(event) {
    tracker.reportError(event?.error || event?.reason || event?.message || event);
    render();
  }

  function onDocumentClick(event) {
    if (event.target?.closest?.('#vtt-global-map-toggle,[data-global-map-action="open"]')) {
      tracker.markCoverage('globalMap');
      render();
    }
  }

  async function copyReport() {
    const report = reportSnapshot();
    const text = JSON.stringify(report, null, 2);
    if (!host?.navigator?.clipboard?.writeText) throw new Error('CLIPBOARD_UNAVAILABLE');
    await host.navigator.clipboard.writeText(text);
    return text;
  }

  function reportSnapshot() {
    const { input, evaluation } = evaluate();
    return Object.freeze({
      schemaVersion: 1,
      kind: 'luminous-vtt-map-field-test-report',
      generatedAt: input.generatedAt,
      map: input.map,
      input,
      evaluation,
    });
  }

  function action(name) {
    if (name === 'start') tracker.start();
    else if (name === 'stop') tracker.stop();
    else if (name === 'reset') tracker.reset();
    else if (name === 'fog') tracker.markCoverage('fogDiscovery');
    else if (name === 'reconnect') tracker.markCoverage('reconnect');
    else if (name === 'rules') tracker.markCoverage('firebaseRules');
    render();
  }

  function onPanelClick(event) {
    const name = event.target?.closest?.('[data-field-action]')?.dataset?.fieldAction;
    if (!name) return;
    if (name === 'copy') {
      void copyReport().then(() => runtime.controller?.notify?.('Field-test report copiado.', 'info')).catch(() => runtime.controller?.notify?.('No se pudo copiar el reporte.', 'error'));
      return;
    }
    action(name);
  }

  function ensurePanel() {
    if (!doc?.body || panel) return panel;
    const style = doc.createElement('style');
    style.id = 'vtt-map-field-test-runner-style';
    style.textContent = `
      #vtt-map-field-test-runner{position:fixed;right:12px;bottom:230px;z-index:36700;width:310px;background:rgba(7,9,11,.96);border:1px solid #59636c;color:#dce3e8;font:700 9px/1.4 monospace;padding:8px;display:grid;gap:6px;box-shadow:0 8px 30px rgba(0,0,0,.35)}
      #vtt-map-field-test-runner[hidden]{display:none}
      #vtt-map-field-test-runner button{border:1px solid #59636c;background:#11161a;color:#dce3e8;font:700 9px monospace;padding:5px 7px;cursor:pointer}
      #vtt-field-test-status[data-state="pass"]{color:#9dd6a6} #vtt-field-test-status[data-state="warn"]{color:#e2c17a} #vtt-field-test-status[data-state="fail"]{color:#e38d8d}
      #vtt-field-test-coverage{display:grid;grid-template-columns:1fr 1fr;gap:2px 8px;font-weight:500} #vtt-field-test-coverage span[data-done="0"]{opacity:.55}
      #vtt-field-test-metrics{font-weight:500;opacity:.9}
    `;
    doc.head?.appendChild(style);
    cleanup.push(() => style.remove());

    panel = doc.createElement('section');
    panel.id = 'vtt-map-field-test-runner';
    panel.setAttribute('aria-label', 'Map field test runner');
    panel.innerHTML = `
      <strong>MAP FIELD TEST</strong>
      <div id="vtt-field-test-status">WARN · 0/${Core.COVERAGE_KEYS.length}</div>
      <div id="vtt-field-test-metrics"></div>
      <div id="vtt-field-test-coverage"></div>
      <div style="display:flex;gap:4px;flex-wrap:wrap">
        <button type="button" data-field-action="start">START</button>
        <button type="button" data-field-action="stop">STOP</button>
        <button type="button" data-field-action="reset">RESET</button>
        <button type="button" data-field-action="copy">COPY REPORT</button>
      </div>
      <div style="display:flex;gap:4px;flex-wrap:wrap">
        <button type="button" data-field-action="fog">FOG OK</button>
        <button type="button" data-field-action="reconnect">RECONNECT OK</button>
        <button type="button" data-field-action="rules">RULES OK</button>
      </div>
    `;
    statusNode = panel.querySelector('#vtt-field-test-status');
    metricsNode = panel.querySelector('#vtt-field-test-metrics');
    coverageNode = panel.querySelector('#vtt-field-test-coverage');
    panel.addEventListener('click', onPanelClick);
    cleanup.push(() => panel?.removeEventListener?.('click', onPanelClick));
    doc.body.appendChild(panel);
    render();
    return panel;
  }

  const events = [
    'vtt:token-preview-moved',
    'vtt:token-moved',
    'vtt:token-z-transition',
    'vtt:procedural-chunk-loaded',
    'vtt:procedural-chunk-transition',
    'vtt:regional-local-transition-applied',
    'vtt:canonical-tokens-synced',
    'vtt:dm-observer-changed',
    'vtt:player-discovery-updated',
    'vtt:map-simulation-lifecycle',
    'vtt:map-simulation-zone-persisted',
    'vtt:map-simulation-delta-recorded',
  ];
  for (const name of events) on(canvas, name, recordEvent);
  on(canvas, 'mousedown', markPointerDown, true);
  on(canvas, 'mouseup', markPointerUp, true);
  if (host !== window) on(host, 'mouseup', markPointerUp, true);
  on(host, 'error', onError);
  on(host, 'unhandledrejection', onError);
  on(doc, 'click', onDocumentClick, true);

  ensurePanel();

  const api = Object.freeze({
    tracker,
    startTest: () => { tracker.start(); return render(); },
    stopTest: () => { tracker.stop(); return render(); },
    reset: () => { tracker.reset(); return render(); },
    markCoverage: (key, value = true) => { tracker.markCoverage(key, value); return render(); },
    snapshot: reportSnapshot,
    evaluate: () => evaluate().evaluation,
    copyReport,
    render,
    stop() {
      if (stopped) return;
      stopped = true;
      tracker.stop();
      while (cleanup.length) cleanup.pop()?.();
      panel?.remove?.();
      panel = null;
      statusNode = null;
      metricsNode = null;
      coverageNode = null;
    },
  });

  globalThis.LuminousVttFieldTestRunnerRuntime = { api };
  globalThis.LuminousVttRuntime = Object.freeze({ ...globalThis.LuminousVttRuntime, fieldTestRunner: api });
  return api;
}
