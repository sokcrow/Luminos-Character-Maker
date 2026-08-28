import './memory-engine.js';
import './memory-state.js';

const baseMemory = window.LuminousVttMemoryEngine;
const baseState = window.LuminousVttMemoryState;

if (baseMemory && baseState && !baseState.__memoryReviewHardened) {
  let latestMemorySnapshot = null;
  let latestMemoryVersion = 0;

  const fingerprint = (value) => JSON.stringify(baseMemory.normalizeMemory(value || {}));

  function trackResult(result) {
    if (result?.changed && result.memory) {
      latestMemorySnapshot = baseMemory.normalizeMemory(result.memory);
      latestMemoryVersion += 1;
    }
    return result;
  }

  function observeDungeon(options = {}) {
    return trackResult(baseMemory.observeDungeon(options));
  }

  function learnFact(memory, fact, profile, now = Date.now(), options = {}) {
    return trackResult(baseMemory.learnFact(memory, fact, profile, now, options));
  }

  const hardenedMemory = Object.freeze({
    ...baseMemory,
    __memoryReviewHardened: true,
    observeDungeon,
    learnFact,
  });
  window.LuminousVttMemoryEngine = hardenedMemory;

  function createBridge(options = {}) {
    const bridge = baseState.createBridge(options);
    const rawOverrideFor = bridge.overrideFor.bind(bridge);
    const rawMemoryFor = bridge.memoryFor.bind(bridge);
    const rawSaveMemory = bridge.saveMemory.bind(bridge);

    function overrideFor(playerId) {
      const value = rawOverrideFor(playerId);
      return value && Object.keys(value).length ? { ...value } : null;
    }

    function memoryFor(playerId) {
      const record = rawMemoryFor(playerId);
      const override = overrideFor(playerId);
      const rankOverridden = Number.isFinite(Number(override?.rank));
      if (!rankOverridden || !record?.profileSnapshot) return record;

      // A lower DM rank must not inherit capabilities captured by a previous,
      // higher-rank snapshot. The bootstrap will still add override capabilities.
      return {
        ...record,
        profileSnapshot: {
          ...record.profileSnapshot,
          capabilities: {},
        },
      };
    }

    async function saveMemory(playerId, rawMemory) {
      if (options.isDm) return rawSaveMemory(playerId, rawMemory);

      let candidate = hardenedMemory.normalizeMemory(rawMemory);
      if (!latestMemorySnapshot || fingerprint(latestMemorySnapshot) !== fingerprint(candidate)) {
        latestMemorySnapshot = candidate;
        latestMemoryVersion += 1;
      }

      let guard = 0;
      while (guard < 12) {
        guard += 1;
        const versionAtWrite = latestMemoryVersion;
        const result = await rawSaveMemory(playerId, candidate);

        // Any observation/learned fact created while Firebase was pending bumps
        // latestMemoryVersion. Flush that newer snapshot before resolving so the
        // bootstrap cannot clear its dirty flag while newer memory is unsaved.
        if (latestMemoryVersion === versionAtWrite) return result;
        candidate = hardenedMemory.normalizeMemory(latestMemorySnapshot);
      }

      throw new Error('MEMORY_SAVE_DID_NOT_STABILIZE');
    }

    return Object.freeze({
      ...bridge,
      overrideFor,
      memoryFor,
      saveMemory,
    });
  }

  window.LuminousVttMemoryState = Object.freeze({
    ...baseState,
    __memoryReviewHardened: true,
    createBridge,
  });
}
