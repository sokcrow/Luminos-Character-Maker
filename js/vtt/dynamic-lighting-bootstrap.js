import '../environment-engine.js';
import './lighting-engine.js';
import './environment-light-bridge.js';
import './lighting-state.js';
import './lighting-controller.js';
import './pov-engine.js';
import './pov-state.js';
import './pov-controller.js';
import './pov-renderer.js';

const ready = (fn) => {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => queueMicrotask(fn), { once: true });
  else queueMicrotask(fn);
};

ready(() => {
  const runtime = window.LuminousVttRuntime;
  if (!runtime?.engine || !runtime?.bridge) {
    console.error('Dynamic Lighting: VTT runtime is unavailable.');
    return;
  }

  const { engine, bridge } = runtime;
  const canvas = engine.canvas;
  const renderer = engine.renderer;
  const camera = engine.camera;
  const mapData = engine.mapData;
  const light = window.LuminousVttLightingEngine;
  const stateApi = window.LuminousVttLightingState;
  const envApi = window.LuminousVttEnvironmentLightBridge;
  const controllerApi = window.LuminousVttLightingController;
  const pov = window.LuminousVttPovEngine;
  const povStateApi = window.LuminousVttPovState;
  const povControllerApi = window.LuminousVttPovController;
  const povRenderer = window.LuminousVttPovRenderer;
  if (!light || !stateApi || !envApi || !controllerApi || !pov || !povStateApi || !povControllerApi || !povRenderer) {
    console.error('Dynamic Lighting: one or more runtimes are unavailable.');
    return;
  }

  mapData.lighting ||= {};
  mapData.lighting.daylightHours ||= { start: 6, end: 18 };
  mapData.lighting.visionSamplingFt ||= 2.5;
  mapData.defaultCeilingHeightFt ||= pov.DEFAULT_CEILING_HEIGHT_FT;
  mapData.tokens?.forEach((token) => {
    if (!Number.isFinite(Number(token.facingDeg))) token.facingDeg = 0;
    if (!Number.isFinite(Number(token.lookDeg))) token.lookDeg = token.facingDeg;
    if (!Number.isFinite(Number(token.eyeHeightFt))) token.eyeHeightFt = pov.DEFAULT_EYE_HEIGHT_FT;
    if (!Number.isFinite(Number(token.visionConeDeg))) token.visionConeDeg = light.DEFAULT_VISION_CONE_DEG;
  });

  const perceptionCache = { key: '', tiles: [] };
  let lightingController = null;
  let povController = null;

  const lightingStateBridge = stateApi.createBridge({
    mapData,
    isDm: bridge.isDm,
    notify: (message, mode) => runtime.controller?.notify?.(message, mode),
    onChanged: () => {
      perceptionCache.key = '';
      lightingController?.handleSceneChanged?.();
      povController?.handleSceneChanged?.();
    },
  });

  const povStateBridge = povStateApi.createBridge({
    mapData,
    isDm: bridge.isDm,
    onChanged: () => { perceptionCache.key = ''; },
  });

  const environmentLightBridge = envApi.createBridge({
    mapData,
    onChanged: () => { perceptionCache.key = ''; },
  });

  function controlledViewers() {
    if (bridge.isDm) {
      const previewId = mapData.lighting?.dmPreviewTokenId;
      if (!previewId) return [];
      const token = (mapData.tokens || []).find((entry) => String(entry.id) === String(previewId));
      if (token) povStateBridge.applyDefaults(token);
      return token ? [token] : [];
    }
    const tokenControl = window.LuminousVttTokenControl;
    const identity = tokenControl?.identity?.() || lightingStateBridge.identity || {};
    const controlled = (mapData.tokens || []).filter((token) => token.viewer === true || tokenControl?.canPlayerControl?.(token, identity));
    controlled.forEach((token) => povStateBridge.applyDefaults(token));
    if (controlled.length) return controlled;
    const fallback = (mapData.tokens || []).find((token) => token.characterLink?.mode === 'current_player');
    if (fallback) povStateBridge.applyDefaults(fallback);
    return fallback ? [fallback] : [];
  }

  lightingController = controllerApi.createController({
    canvas,
    engine,
    mapData,
    bridge: lightingStateBridge,
    isDm: bridge.isDm,
    notify: (message, mode) => runtime.controller?.notify?.(message, mode),
  });

  povController = povControllerApi.createController({
    canvas,
    engine,
    mapData,
    stateBridge: povStateBridge,
    isDm: bridge.isDm,
    getControlledViewers: controlledViewers,
    notify: (message, mode) => runtime.controller?.notify?.(message, mode),
  });

  lightingStateBridge.start();
  povStateBridge.start();
  environmentLightBridge.start();

  const originalRender = renderer.render.bind(renderer);

  function scene() {
    const current = mapData.lighting?.scene || { sources: [], interiors: [], transformers: [], switches: [] };
    current.roofs ||= [];
    return current;
  }

  function environment() { return mapData.lighting?.environment || { state: { light: mapData.ambientLight?.level || 'bright' } }; }

  function mapFingerprint(viewers, viewZ, lookUp, now) {
    const tokens = (mapData.tokens || []).map((token) => [
      token.id,
      Number(token.x) || 0,
      Number(token.y) || 0,
      light.layerOf(token),
      light.elevationFt(token, mapData),
      Number(token.lookDeg ?? token.facingDeg) || 0,
      Number(token.eyeHeightFt) || pov.DEFAULT_EYE_HEIGHT_FT,
    ]);
    const moving = (scene().sources || []).some((source) => source.motion && !light.interpolateMotion(source.motion, now).complete);
    return JSON.stringify({
      z: viewZ,
      lookUp: Boolean(lookUp),
      viewers: viewers.map((viewer) => [
        viewer.id,
        viewer.x,
        viewer.y,
        light.layerOf(viewer),
        light.elevationFt(viewer, mapData),
        viewer.lookDeg ?? viewer.facingDeg,
        viewer.eyeHeightFt,
        viewer.visionConeDeg,
        viewer.senses?.darkvisionFt,
      ]),
      tokens,
      scene: scene(),
      env: environment()?.state,
      motionTick: moving ? Math.floor(now / 50) : 0,
    });
  }

  function bestPerception(viewers, point, now, lookUp) {
    let darkvision = null;
    let dim = null;
    for (const viewer of viewers) {
      const result = pov.perceptionAtPoint(viewer, point, scene(), mapData, environment(), now, { lookUp });
      if (!result?.visible) continue;
      if (!result.monochrome && result.level === 'bright') return result;
      if (!result.monochrome) dim ||= result;
      else darkvision ||= result;
    }
    return dim || darkvision || null;
  }

  function computeTiles(viewers, viewZ, now, lookUp) {
    if (!viewers.length) return [];
    const stepFt = Math.max(1, Number(mapData.lighting?.visionSamplingFt) || 2.5);
    const step = light.feetToPixels(stepFt, mapData);
    const width = (mapData.grid?.cols || 1) * (mapData.grid?.size || 70);
    const height = (mapData.grid?.rows || 1) * (mapData.grid?.size || 70);
    const elevationFt = light.elevationForLayer(mapData, viewZ);
    const tiles = [];
    for (let y = 0; y < height; y += step) {
      for (let x = 0; x < width; x += step) {
        const w = Math.min(step, width - x), h = Math.min(step, height - y);
        const point = { x: x + w / 2, y: y + h / 2, zLayer: viewZ, elevationFt };
        const perception = bestPerception(viewers, point, now, lookUp);
        if (!perception) continue;
        tiles.push({ x, y, w, h, perception });
      }
    }
    return tiles;
  }

  function perceptionTiles(viewers, viewZ, now, lookUp) {
    const key = mapFingerprint(viewers, viewZ, lookUp, now);
    if (key !== perceptionCache.key) {
      perceptionCache.key = key;
      perceptionCache.tiles = computeTiles(viewers, viewZ, now, lookUp);
    }
    return perceptionCache.tiles;
  }

  function withRendererContext(targetCanvas, targetCtx, fn) {
    const prevCanvas = renderer.canvas, prevCtx = renderer.ctx;
    renderer.canvas = targetCanvas; renderer.ctx = targetCtx;
    try { fn(); } finally { renderer.canvas = prevCanvas; renderer.ctx = prevCtx; }
  }

  function drawLightEffects(ctx, activeZ, now, subtle = false) {
    const s = scene();
    const targetElevation = light.elevationForLayer(mapData, activeZ);
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (const raw of s.sources || []) {
      const source = light.sourcePosition(raw, mapData, now);
      if (!light.sourcePowered(source, s).powered) continue;
      const totalFt = Number(source.brightFt || 0) + Number(source.dimAdditionalFt || 0);
      const vertical = Math.abs(Number(source.elevationFt || 0) - targetElevation);
      if (vertical >= totalFt || totalFt <= 0) continue;
      const targetAtSource = { x: source.x, y: source.y, zLayer: activeZ, elevationFt: targetElevation };
      if (!light.canTraverseLayers(source, targetAtSource, s, mapData, 'light')) continue;
      const horizontalFt = Math.sqrt(Math.max(0, totalFt * totalFt - vertical * vertical));
      const radius = light.feetToPixels(horizontalFt, mapData) * light.lightVisualIntensity(source, now);
      if (radius <= 0) continue;
      ctx.save();
      if (source.shape === 'cone') {
        const angle = (Number(source.directionDeg || 0) * Math.PI) / 180;
        const half = ((Number(source.coneDeg || 90) / 2) * Math.PI) / 180;
        ctx.beginPath(); ctx.moveTo(source.x, source.y); ctx.arc(source.x, source.y, radius, angle - half, angle + half); ctx.closePath(); ctx.clip();
      }
      const gradient = ctx.createRadialGradient(source.x, source.y, 0, source.x, source.y, radius);
      const alpha = subtle ? 0.08 : 0.18;
      gradient.addColorStop(0, `${source.color || '#ffd27a'}${Math.round(alpha * 255).toString(16).padStart(2,'0')}`);
      gradient.addColorStop(0.55, `${source.color || '#ffd27a'}${Math.round(alpha * 0.65 * 255).toString(16).padStart(2,'0')}`);
      gradient.addColorStop(1, `${source.color || '#ffd27a'}00`);
      ctx.fillStyle = gradient; ctx.beginPath(); ctx.arc(source.x, source.y, radius, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  function drawBaseScene(targetCanvas, targetCtx, renderZ, now, includeGuides = false, options = {}) {
    withRendererContext(targetCanvas, targetCtx, () => {
      renderer.clear(false);
      targetCtx.save();
      camera.applyTransformSimple(targetCtx);
      targetCtx.fillStyle = '#111';
      targetCtx.fillRect(0, 0, (mapData.grid?.cols || 1) * (mapData.grid?.size || 70), (mapData.grid?.rows || 1) * (mapData.grid?.size || 70));
      renderer.drawGrid();
      renderer.drawWalls(renderZ, false);
      renderer.drawTopology(renderZ, false);
      renderer.drawTokens(renderZ);
      povRenderer.drawIndicators(renderer, renderZ);
      drawLightEffects(targetCtx, renderZ, now, bridge.isDm && !mapData.lighting?.dmPreviewTokenId);
      if (options.lookUp) (options.viewers || []).forEach((viewer) => povRenderer.drawLookUpAnchor(targetCtx, viewer, mapData));
      if (includeGuides) {
        lightingController.renderEditorGuides(targetCtx);
        povController.renderEditorGuides(targetCtx, renderZ);
      }
      targetCtx.restore();
    });
  }

  function renderFullMap(activeZ, now) {
    drawBaseScene(canvas, renderer.ctx, activeZ, now, true);
  }

  function sourceForPerception(perception) {
    if (!perception?.light?.sourceId) return null;
    return (scene().sources || []).find((source) => String(source.id) === String(perception.light.sourceId)) || null;
  }

  function renderTokenVision(activeZ, viewers, now) {
    const requestedLookUp = povController.lookUpHeld();
    const viewZ = povController.viewLayer(activeZ);
    const lookUp = requestedLookUp && Number(viewZ) !== Number(activeZ);
    const offscreen = document.createElement('canvas');
    offscreen.width = canvas.width; offscreen.height = canvas.height;
    const offctx = offscreen.getContext('2d');
    drawBaseScene(offscreen, offctx, viewZ, now, false, { lookUp, viewers });

    renderer.ctx.clearRect(0, 0, canvas.width, canvas.height);
    renderer.ctx.fillStyle = '#000'; renderer.ctx.fillRect(0, 0, canvas.width, canvas.height);
    const tiles = perceptionTiles(viewers, viewZ, now, lookUp);
    povController.setLookUpBlocked(requestedLookUp && (!lookUp || tiles.length === 0));
    const zoom = camera.zoom;
    for (const tile of tiles) {
      const sx = (tile.x + camera.x) * zoom;
      const sy = (tile.y + camera.y) * zoom;
      const sw = tile.w * zoom + 1;
      const sh = tile.h * zoom + 1;
      if (sx + sw < 0 || sy + sh < 0 || sx > canvas.width || sy > canvas.height) continue;
      const mode = tile.perception.mode;
      renderer.ctx.save();
      if (tile.perception.monochrome) renderer.ctx.filter = 'grayscale(1) brightness(.58)';
      else if (mode === 'normal_dim') renderer.ctx.filter = 'brightness(.68) contrast(.92)';
      else if (mode === 'near_dim') renderer.ctx.filter = 'brightness(.45) contrast(.88)';
      else renderer.ctx.filter = 'none';
      renderer.ctx.drawImage(offscreen, sx, sy, sw, sh, sx, sy, sw, sh);
      const source = sourceForPerception(tile.perception);
      if (source && !tile.perception.monochrome) {
        renderer.ctx.globalCompositeOperation = 'screen'; renderer.ctx.globalAlpha = tile.perception.level === 'bright' ? 0.10 : 0.06;
        renderer.ctx.fillStyle = source.color || '#ffd27a'; renderer.ctx.fillRect(sx, sy, sw, sh);
      }
      renderer.ctx.restore();
    }
  }

  renderer.render = function dynamicLightingRender(activeCamera, activeZ, renderData, isExporting = false) {
    if (isExporting) return originalRender(activeCamera, activeZ, renderData, true);
    const now = Date.now();
    const viewers = controlledViewers();
    if (bridge.isDm && !mapData.lighting?.dmPreviewTokenId) renderFullMap(activeZ, now);
    else renderTokenVision(activeZ, viewers, now);
  };
  engine.calculateVision = () => ({ dynamicLighting: true, directionalPov: true });

  const previousRuntime = window.LuminousVttRuntime;
  window.LuminousVttRuntime = Object.freeze({
    ...previousRuntime,
    lighting: Object.freeze({
      engine: light,
      stateBridge: lightingStateBridge,
      environmentBridge: environmentLightBridge,
      controller: lightingController,
      controlledViewers,
      perceptionAtPoint: (viewer, point) => pov.perceptionAtPoint(viewer, point, scene(), mapData, environment()),
    }),
    pov: Object.freeze({
      engine: pov,
      stateBridge: povStateBridge,
      controller: povController,
      controlledViewers,
      lookUpPerceptionAtPoint: (viewer, point) => pov.perceptionAtPoint(viewer, point, scene(), mapData, environment(), Date.now(), { lookUp: true }),
    }),
  });

  window.addEventListener('beforeunload', () => {
    povController.stop();
    lightingController.stop();
    environmentLightBridge.stop();
    povStateBridge.stop();
    lightingStateBridge.stop();
    renderer.render = originalRender;
  }, { once: true });
});
