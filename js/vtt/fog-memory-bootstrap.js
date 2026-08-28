import './memory-engine.js';
import './memory-state.js';
import './memory-renderer.js';

const ready = (fn) => {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => queueMicrotask(fn), { once: true });
  else queueMicrotask(fn);
};

ready(() => {
  const runtime = window.LuminousVttRuntime;
  const memory = window.LuminousVttMemoryEngine;
  const stateApi = window.LuminousVttMemoryState;
  const memoryRenderer = window.LuminousVttMemoryRenderer;
  if (!runtime?.engine || !runtime?.pov || !runtime?.lighting || !memory || !stateApi || !memoryRenderer) {
    console.error('Fog Memory: required VTT runtimes are unavailable.');
    return;
  }

  const { engine, bridge } = runtime;
  const renderer = engine.renderer;
  const camera = engine.camera;
  const mapData = engine.mapData;
  const host = memory.hostWindow(window);
  const stateBridge = stateApi.createBridge({ mapData, isDm: bridge.isDm, onChanged: handleRemoteChanged });
  const ui = memoryRenderer.ensureUi({ isDm: bridge.isDm });
  let localMemory = null;
  let localPlayerId = '';
  let localProfile = null;
  let dirty = false;
  let saveTimer = null;
  let lastProfileAt = 0;
  let visibilityCache = { at: 0, zLayer: null, lookUp: false, signature: '', cells: new Set() };
  let lastObservedSignature = '';

  function previewToken() {
    const previewId = mapData.lighting?.dmPreviewTokenId;
    if (!previewId) return null;
    return (mapData.tokens || []).find((token) => String(token.id) === String(previewId)) || null;
  }

  function playerIdForToken(token) {
    if (!token) return '';
    return String(token.canonicalPlayerKey || token.playerId || token.ownerPlayerId || '').trim();
  }

  function activePlayerId() {
    if (!bridge.isDm) return stateBridge.identity.playerId || '';
    return playerIdForToken(previewToken());
  }

  function currentRecord() {
    const id = activePlayerId();
    if (!id) return memory.emptyMemory();
    if (id !== localPlayerId) {
      localPlayerId = id;
      localMemory = stateBridge.memoryFor(id);
      dirty = false;
    }
    if (!localMemory) localMemory = stateBridge.memoryFor(id);
    return localMemory;
  }

  function currentCharacter() {
    const id = activePlayerId();
    if (!id) return {};
    if (bridge.isDm) return stateBridge.playerData(id) || {};
    return host?.datosJugador || stateBridge.playerData(id) || {};
  }

  function currentTraits() {
    if (bridge.isDm) return [];
    try {
      const resolved = host?.LuminousPlayerTraitRuntime?.getTraits?.();
      if (Array.isArray(resolved)) return resolved;
    } catch (_) {}
    const character = currentCharacter();
    return Array.isArray(character.resolvedTraits) ? character.resolvedTraits : Array.isArray(character.traits) ? character.traits : [];
  }

  function profileFromSnapshot(record, override) {
    const snapshot = record?.profileSnapshot;
    if (!snapshot) {
      const rank = Number.isFinite(Number(override?.rank)) ? Number(override.rank) : 0;
      return { intelligence: null, baseRank: rank, rank, tags: memory.mapTags(mapData), capabilities: memory.capabilitiesForRank(rank, mapData), appliedTraits: [], source: override ? 'dm_override' : 'unknown' };
    }
    const rank = Number.isFinite(Number(override?.rank)) ? Number(override.rank) : Number(snapshot.rank || 0);
    return {
      intelligence: snapshot.intelligence,
      baseRank: Number(snapshot.rank || 0),
      rank,
      tags: Array.isArray(snapshot.tags) ? snapshot.tags : memory.mapTags(mapData),
      capabilities: { ...memory.capabilitiesForRank(rank, mapData), ...(snapshot.capabilities || {}), ...(override?.capabilities || {}) },
      appliedTraits: [],
      source: override ? 'dm_override' : 'snapshot',
    };
  }

  function currentProfile(force = false) {
    const now = Date.now();
    if (!force && localProfile && now - lastProfileAt < 500) return localProfile;
    const playerId = activePlayerId();
    const override = playerId ? stateBridge.overrideFor(playerId) : null;
    if (bridge.isDm) localProfile = profileFromSnapshot(currentRecord(), override);
    else localProfile = memory.resolveProfile({ character: currentCharacter(), traits: currentTraits(), mapData, override, root: window });
    lastProfileAt = now;
    return localProfile;
  }

  function handleRemoteChanged(event) {
    const id = activePlayerId();
    if (event?.type === 'override') { localProfile = null; lastProfileAt = 0; }
    if (event?.type === 'memory' || event?.type === 'players') {
      if (!dirty && id) localMemory = stateBridge.memoryFor(id);
    }
  }

  function controlledViewers() {
    return runtime.pov.controlledViewers?.() || runtime.lighting.controlledViewers?.() || [];
  }

  function viewerSignature(viewers, zLayer, lookUp) {
    const scene = mapData.lighting?.scene || {};
    return JSON.stringify({
      zLayer,
      lookUp,
      viewers: viewers.map((viewer) => [viewer.id, viewer.x, viewer.y, viewer.zLayer, viewer.elevationFt, viewer.lookDeg, viewer.visionConeDeg, viewer.senses?.darkvisionFt]),
      topology: (mapData.topology || []).map((element) => [element.id, element.state]),
      walls: (mapData.walls || []).length,
      scene: [scene.sources, scene.interiors, scene.roofs].map((list) => JSON.stringify(list || [])),
      env: mapData.lighting?.environment?.state || null,
    });
  }

  function pointAtCell(col, row, zLayer) {
    const size = Math.max(1, Number(mapData.grid?.size) || 70);
    const elevationFt = runtime.lighting.engine.elevationForLayer(mapData, zLayer);
    return { x: (col + .5) * size, y: (row + .5) * size, zLayer, elevationFt };
  }

  function visibleCells(viewers, zLayer, lookUp) {
    const now = Date.now();
    const signature = viewerSignature(viewers, zLayer, lookUp);
    if (visibilityCache.signature === signature && now - visibilityCache.at < 100) return visibilityCache.cells;
    const cells = new Set();
    const cols = Math.max(1, Math.trunc(Number(mapData.grid?.cols) || 1));
    const rows = Math.max(1, Math.trunc(Number(mapData.grid?.rows) || 1));
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const point = pointAtCell(col, row, zLayer);
        let visible = false;
        for (const viewer of viewers) {
          const perception = lookUp
            ? runtime.pov.lookUpPerceptionAtPoint?.(viewer, point)
            : runtime.lighting.perceptionAtPoint?.(viewer, point);
          if (perception?.visible) { visible = true; break; }
        }
        if (visible) cells.add(memory.cellKey(col, row));
      }
    }
    visibilityCache = { at: now, zLayer, lookUp, signature, cells };
    return cells;
  }

  function scheduleSave() {
    if (bridge.isDm || !activePlayerId() || !dirty) return;
    if (saveTimer != null) window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(async () => {
      saveTimer = null;
      if (!dirty || !localMemory) return;
      const snapshot = memory.normalizeMemory(localMemory);
      try {
        await stateBridge.saveMemory(activePlayerId(), snapshot);
        dirty = false;
      } catch (error) {
        console.error('Fog Memory persistence failed:', error);
      }
    }, 450);
  }

  function observe(viewers, viewZ, cells) {
    if (bridge.isDm || !activePlayerId()) return;
    const profile = currentProfile();
    if (profile.rank <= 0) return;
    const signature = JSON.stringify({ z: viewZ, cells: [...cells].sort(), route: viewers.map((v) => [v.id, v.x, v.y, v.zLayer]) });
    if (signature === lastObservedSignature) return;
    lastObservedSignature = signature;
    const result = memory.observeDungeon({
      memory: currentRecord(),
      profile,
      mapData,
      zLayer: viewZ,
      visibleCells: cells,
      routeTokens: viewers,
      topology: mapData.topology || [],
      now: Date.now(),
    });
    if (!result.changed) return;
    localMemory = result.memory;
    dirty = true;
    scheduleSave();
  }

  function applyLearnedFact(fact, options = {}) {
    const id = activePlayerId();
    if (!id) return false;
    const profile = currentProfile(true);
    const result = memory.learnFact(currentRecord(), fact, profile, Date.now(), options);
    if (!result.changed) return false;
    localMemory = result.memory;
    dirty = true;
    if (bridge.isDm) stateBridge.saveMemory(id, localMemory).then(() => { dirty = false; }).catch((error) => console.error('DM memory write failed:', error));
    else scheduleSave();
    return true;
  }

  function renderMemory(activeZ) {
    const viewers = controlledViewers();
    if (!viewers.length) return;
    const requestedLookUp = runtime.pov.controller?.lookUpHeld?.() || false;
    const viewZ = runtime.pov.controller?.viewLayer?.(activeZ) ?? activeZ;
    const lookUp = requestedLookUp && Number(viewZ) !== Number(activeZ);
    const cells = visibleCells(viewers, viewZ, lookUp);
    const profile = currentProfile();
    const record = currentRecord();
    observe(viewers, viewZ, cells);
    memoryRenderer.drawRememberedOverlay(renderer.ctx, { record, profile, zLayer: viewZ, visibleCells: cells, mapData, camera });
    if (ui?.button) ui.button.hidden = !bridge.isDm && !profile.capabilities?.minimap;
    if (ui?.panel && !ui.panel.hidden) memoryRenderer.drawMinimap({ record, profile, zLayer: viewZ, mapData, token: viewers[0] });
  }

  const previousRender = renderer.render.bind(renderer);
  renderer.render = function fogMemoryRender(activeCamera, activeZ, renderData, isExporting = false) {
    previousRender(activeCamera, activeZ, renderData, isExporting);
    if (isExporting) return;
    if (bridge.isDm && !mapData.lighting?.dmPreviewTokenId) return;
    renderMemory(activeZ);
  };

  function onLearn(event) {
    if (!event?.detail) return;
    applyLearnedFact(event.detail);
  }
  window.addEventListener('vtt:memory-learn', onLearn);

  function bindDmAdmin() {
    if (!bridge.isDm || !ui?.panel) return;
    const select = document.getElementById('vtt-memory-rank-override');
    const reveal = document.getElementById('vtt-memory-reveal-layer');
    const clear = document.getElementById('vtt-memory-clear');
    select?.addEventListener('change', async () => {
      const id = activePlayerId();
      if (!id) return runtime.controller?.notify?.('Selecciona VIEW AS TOKEN de un jugador.', 'error');
      const value = select.value;
      await stateBridge.saveOverride(id, value === 'auto' ? null : { rank: Number(value) });
      localProfile = null; lastProfileAt = 0;
    });
    reveal?.addEventListener('click', async () => {
      const id = activePlayerId();
      if (!id) return runtime.controller?.notify?.('Selecciona VIEW AS TOKEN de un jugador.', 'error');
      const activeZ = engine.activeZ;
      const viewZ = runtime.pov.controller?.viewLayer?.(activeZ) ?? activeZ;
      localMemory = memory.revealLayer(currentRecord(), mapData, viewZ);
      await stateBridge.saveMemory(id, localMemory);
      runtime.controller?.notify?.(`Memoria Z${viewZ} revelada.`, 'success');
    });
    clear?.addEventListener('click', async () => {
      const id = activePlayerId();
      if (!id) return runtime.controller?.notify?.('Selecciona VIEW AS TOKEN de un jugador.', 'error');
      localMemory = memory.emptyMemory();
      await stateBridge.clearMemory(id);
      runtime.controller?.notify?.('Memoria del mapa borrada.', 'success');
    });
  }

  stateBridge.start();
  bindDmAdmin();

  const previousRuntime = window.LuminousVttRuntime;
  window.LuminousVttRuntime = Object.freeze({
    ...previousRuntime,
    memory: Object.freeze({
      engine: memory,
      stateBridge,
      profile: () => currentProfile(true),
      record: () => memory.normalizeMemory(currentRecord()),
      learnFact: (fact, options) => applyLearnedFact(fact, options),
      rememberKeyDoorRelation: (keyId, elementId) => applyLearnedFact({ kind: 'key_opens', keyId, elementId }),
      rememberWorldPlace: (place) => applyLearnedFact({ kind: 'world_place', ...place }),
      rememberTerritory: (territory) => applyLearnedFact({ kind: 'territory', ...territory }),
    }),
  });

  window.addEventListener('beforeunload', () => {
    window.removeEventListener('vtt:memory-learn', onLearn);
    if (saveTimer != null) window.clearTimeout(saveTimer);
    if (dirty && localMemory && activePlayerId() && !bridge.isDm) stateBridge.saveMemory(activePlayerId(), localMemory).catch(() => {});
    stateBridge.stop();
    renderer.render = previousRender;
  }, { once: true });
});
