(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.LuminousVttRuntimeLifecycle = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  const requestFrame = (callback) => (
    globalThis.requestAnimationFrame
      ? globalThis.requestAnimationFrame(callback)
      : globalThis.setTimeout?.(() => callback(Date.now()), 16)
  );

  const cancelFrame = (frameId) => {
    if (frameId == null) return;
    if (globalThis.cancelAnimationFrame) globalThis.cancelAnimationFrame(frameId);
    else globalThis.clearTimeout?.(frameId);
  };

  function hardenEngineRuntime(engine, { log = console, isDisposed = () => false } = {}) {
    if (!engine || engine.__lifecycleHardened) return engine || null;

    const wasRunning = Boolean(engine.isRunning);
    const originalTokenMouseMove = engine.handleTokenMouseMove;
    engine.isRunning = false;
    engine.frameId = null;
    engine.destroyed = false;
    engine.__lifecycleHardened = true;

    let handoffFrameId = null;
    let pointerFrameId = null;
    let pendingPointerMove = null;

    const inputPerformanceStats = {
      pointerMovesReceived: 0,
      pointerMovesProcessed: 0,
      pointerMovesCoalesced: 0,
    };

    engine.getInputPerformanceStats = () => ({
      ...inputPerformanceStats,
      pointerMovePending: pointerFrameId != null,
    });

    if (typeof originalTokenMouseMove === 'function') {
      try { globalThis.removeEventListener?.('mousemove', originalTokenMouseMove); } catch (_) {}

      engine.handleTokenMouseMove = function frameCoalescedTokenMouseMove(event) {
        if (engine.destroyed || isDisposed()) return;
        inputPerformanceStats.pointerMovesReceived += 1;
        if (pendingPointerMove != null) inputPerformanceStats.pointerMovesCoalesced += 1;
        pendingPointerMove = event;
        if (pointerFrameId != null) return;

        pointerFrameId = requestFrame(() => {
          pointerFrameId = null;
          const next = pendingPointerMove;
          pendingPointerMove = null;
          if (!next || engine.destroyed || isDisposed()) return;
          inputPerformanceStats.pointerMovesProcessed += 1;
          originalTokenMouseMove(next);
        });
      };

      globalThis.addEventListener?.('mousemove', engine.handleTokenMouseMove);
    }

    engine.start = function startLifecycleHardenedEngine() {
      if (engine.destroyed || isDisposed() || engine.isRunning || engine.frameId != null) return false;
      engine.isRunning = true;
      engine.frameId = requestFrame(engine.loop);
      return true;
    };

    engine.stop = function stopLifecycleHardenedEngine() {
      engine.cancelTokenMotion?.();
      engine.isRunning = false;

      if (handoffFrameId != null) {
        cancelFrame(handoffFrameId);
        handoffFrameId = null;
      }
      if (engine.frameId != null) {
        cancelFrame(engine.frameId);
        engine.frameId = null;
      }
      if (pointerFrameId != null) {
        cancelFrame(pointerFrameId);
        pointerFrameId = null;
      }
      pendingPointerMove = null;

      engine.tokenDrag = null;
      if (engine.canvas?.style) engine.canvas.style.cursor = 'default';
      return true;
    };

    engine.loop = function lifecycleHardenedLoop() {
      engine.frameId = null;
      if (!engine.isRunning || engine.destroyed || isDisposed()) return;

      const renderData = engine.calculateVision();
      if (!engine.isExporting) {
        engine.renderer.render(engine.camera, engine.activeZ, renderData, engine.isExporting);
      }

      if (engine.isRunning && !engine.destroyed && !isDisposed()) {
        engine.frameId = requestFrame(engine.loop);
      }
    };

    engine.destroy = function destroyLifecycleHardenedEngine() {
      if (engine.destroyed) return false;
      engine.destroyed = true;
      engine.stop();

      try { globalThis.removeEventListener?.('resize', engine.handleResize); } catch (_) {}
      try { engine.canvas?.removeEventListener?.('mousedown', engine.handleTokenMouseDown); } catch (_) {}
      try { globalThis.removeEventListener?.('mousemove', engine.handleTokenMouseMove); } catch (_) {}
      try { globalThis.removeEventListener?.('mouseup', engine.handleTokenMouseUp); } catch (_) {}
      try { engine.camera?.destroy?.(); }
      catch (error) { log?.warn?.('VTT camera destroy failed.', error); }

      engine.tokenDrag = null;
      engine.tokenControlResolver = null;
      engine.tokenMoveResolver = null;
      engine.movementInteractionResolver = null;
      engine.tokenMotion = null;
      return true;
    };

    // main.js can schedule the legacy bound RAF before LuminousVttRuntime is published.
    // Keep isRunning=false until that old callback drains, then restart with the owned RAF loop.
    if (wasRunning && !isDisposed()) {
      handoffFrameId = requestFrame(() => {
        handoffFrameId = null;
        if (!engine.destroyed && !isDisposed()) engine.start();
      });
    }

    return engine;
  }

  function createLifecycle({ log = console } = {}) {
    let disposed = false;
    let reason = '';
    let attachTimer = null;

    const isDisposed = () => disposed;
    const getReason = () => reason;

    function attachEngineHardening() {
      let attempts = 0;
      const tryAttach = () => {
        attachTimer = null;
        if (disposed) return;

        const runtime = globalThis.LuminousVttRuntime;
        if (runtime?.engine) {
          hardenEngineRuntime(runtime.engine, { log, isDisposed });
          return;
        }

        attempts += 1;
        if (attempts < 80) attachTimer = globalThis.setTimeout?.(tryAttach, 25) ?? null;
      };
      queueMicrotask(tryAttach);
    }

    function dispose(nextReason = 'runtime-disposed') {
      if (disposed) return false;
      disposed = true;
      reason = String(nextReason || 'runtime-disposed');

      if (attachTimer != null) {
        globalThis.clearTimeout?.(attachTimer);
        attachTimer = null;
      }

      try { globalThis.LuminousVttPerformanceGuard?.stop?.(); }
      catch (error) { log?.warn?.('VTT performance guard teardown failed.', error); }

      try { globalThis.LuminousVttRuntime?.engine?.destroy?.(); }
      catch (error) { log?.warn?.('VTT engine teardown failed.', error); }

      return true;
    }

    async function run(label, load, start) {
      const taskLabel = String(label || 'runtime');
      if (disposed) return { status: 'skipped', label: taskLabel, reason };

      let module;
      try {
        module = await (typeof load === 'function' ? load() : load);
      } catch (error) {
        if (!disposed) throw error;
        return { status: 'skipped', label: taskLabel, reason, error };
      }

      if (disposed) return { status: 'skipped', label: taskLabel, reason };

      let runtime;
      try {
        runtime = await start(module);
      } catch (error) {
        if (!disposed) throw error;
        return { status: 'disposed', label: taskLabel, reason, error };
      }

      if (disposed) {
        try {
          runtime?.stop?.();
        } catch (error) {
          log?.warn?.(`VTT lifecycle late-stop failed for ${taskLabel}.`, error);
        }
        return { status: 'disposed', label: taskLabel, reason };
      }

      return { status: 'started', label: taskLabel, runtime };
    }

    attachEngineHardening();
    return Object.freeze({ dispose, getReason, isDisposed, run });
  }

  return Object.freeze({ createLifecycle, hardenEngineRuntime });
});
