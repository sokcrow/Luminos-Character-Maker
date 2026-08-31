(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.LuminousVttRuntimeLifecycle = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  function createLifecycle({ log = console } = {}) {
    let disposed = false;
    let reason = '';

    const isDisposed = () => disposed;
    const getReason = () => reason;

    function dispose(nextReason = 'runtime-disposed') {
      if (disposed) return false;
      disposed = true;
      reason = String(nextReason || 'runtime-disposed');
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

    return Object.freeze({ dispose, getReason, isDisposed, run });
  }

  return Object.freeze({ createLifecycle });
});
