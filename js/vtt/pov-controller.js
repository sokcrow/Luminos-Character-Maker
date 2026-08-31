(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.LuminousVttPovController = api;
})(typeof window !== 'undefined' ? window : globalThis, function (browserRoot) {
  'use strict';

  const clean = (value) => String(value ?? '').trim();
  const num = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

  function uid(prefix) { return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`; }

  function createController({ canvas, engine, mapData, stateBridge, sceneBridge = null, isDm = false, getControlledViewers, notify, root = browserRoot } = {}) {
    if (!canvas || !engine || !mapData || !stateBridge) throw new Error('POV_CONTROLLER_INPUT_REQUIRED');
    const doc = root?.document;
    const pov = root?.LuminousVttPovEngine;
    const visibility = root?.LuminousVttVisibilityMaskCore;
    if (!pov) throw new Error('POV_ENGINE_REQUIRED');
    const LOOK_STEP_DEG = visibility?.DEFAULT_LOOK_STEP_DEG || 2;
    const LOOK_THROTTLE_MS = visibility?.DEFAULT_LOOK_THROTTLE_MS || 50;
    const LOOK_BUTTON_STEP_DEG = 15;
    const listeners = [];
    mapData.pov ||= {};
    if (typeof mapData.pov.lookLocked !== 'boolean') mapData.pov.lookLocked = false;
    if (typeof mapData.pov.lookUpHeld !== 'boolean') mapData.pov.lookUpHeld = false;
    if (!Number.isFinite(Number(mapData.pov.revision))) mapData.pov.revision = 0;
    mapData.pov.lookUpBlocked = false;
    mapData.lighting ||= {};
    mapData.lighting.scene ||= { sources: [], interiors: [], transformers: [], switches: [] };
    mapData.lighting.scene.roofs ||= [];

    let saveTimer = null;
    let lookUpdateTimer = null;
    let pendingLookDeg = null;
    let lastLookAppliedAt = -Infinity;
    let roofToolActive = false;
    let roofDragStart = null;
    let selectedRoofId = null;

    function emit(message, mode = 'info') { if (typeof notify === 'function') notify(message, mode); }
    function scene() { mapData.lighting.scene.roofs ||= []; return mapData.lighting.scene; }
    function editActive() { return Boolean(isDm && mapData.dmEditMode?.active); }
    function activeZ() { return Number(engine.activeZ) || 0; }
    function controlled() { return typeof getControlledViewers === 'function' ? (getControlledViewers() || []) : []; }
    function activeLookToken() { return controlled()[0] || null; }
    function lookLocked() { return Boolean(mapData.pov.lookLocked); }
    function lookUpHeld() { return Boolean(mapData.pov.lookUpHeld); }
    function nowMs() { return root?.performance?.now?.() ?? Date.now(); }
    function normalizeAngle(value) { return visibility?.normalizeAngleDeg?.(value) ?? pov.normalizeAngleDeg?.(value) ?? (((num(value) % 360) + 360) % 360); }
    function quantizeAngle(value) { return visibility?.quantizeAngleDeg?.(value, LOOK_STEP_DEG) ?? normalizeAngle(Math.round(normalizeAngle(value) / LOOK_STEP_DEG) * LOOK_STEP_DEG); }
    function angleChanged(previous, next) {
      if (visibility?.meaningfulAngleChange) return visibility.meaningfulAngleChange(previous, next, LOOK_STEP_DEG);
      let delta = Math.abs(normalizeAngle(next) - normalizeAngle(previous));
      if (delta > 180) delta = 360 - delta;
      return delta >= LOOK_STEP_DEG - 1e-9;
    }

    function eventWorldPoint(event) {
      if (typeof engine.eventWorldPoint === 'function') return engine.eventWorldPoint(event);
      const rect = canvas.getBoundingClientRect();
      return engine.camera?.screenToWorld?.(event.clientX - rect.left, event.clientY - rect.top) || { x: 0, y: 0 };
    }

    function snapVertex(point) {
      const size = Math.max(1, num(mapData.grid?.size, 70));
      const cols = Math.max(1, num(mapData.grid?.cols, 1));
      const rows = Math.max(1, num(mapData.grid?.rows, 1));
      return {
        x: Math.max(0, Math.min(cols * size, Math.round(num(point.x) / size) * size)),
        y: Math.max(0, Math.min(rows * size, Math.round(num(point.y) / size) * size)),
      };
    }

    function injectUi() {
      if (!doc) return;
      if (!doc.getElementById('vtt-pov-runtime-style')) {
        const style = doc.createElement('style');
        style.id = 'vtt-pov-runtime-style';
        style.textContent = `
          .vtt-pov-status{position:fixed;left:50%;bottom:76px;transform:translateX(-50%);z-index:30020;background:#0b0b0b;border:1px solid #aaa;color:#fff;padding:5px 9px;font:700 10px monospace;pointer-events:none;box-shadow:3px 3px 0 #000}
          .vtt-pov-status[data-mode="blocked"]{border-color:#ff6b6b}.vtt-pov-status[data-mode="up"]{border-color:#8bd8ff}.vtt-pov-status[data-mode="locked"]{border-color:#ffe38b}
          .vtt-pov-controls{position:fixed;left:50%;bottom:101px;transform:translateX(-50%);z-index:30021;display:flex;gap:4px;background:rgba(11,11,11,.94);border:1px solid #59636c;padding:4px;box-shadow:3px 3px 0 #000}
          .vtt-pov-controls button{border:1px solid #59636c;background:#11161a;color:#dce3e8;font:700 9px monospace;padding:5px 7px;cursor:pointer}.vtt-pov-controls button:hover{border-color:#d7b151;color:#d7b151}.vtt-pov-controls button:disabled{opacity:.35;cursor:not-allowed}.vtt-pov-controls [data-pov-action="lock"].is-active{border-color:#ffe38b;color:#ffe38b}
          .vtt-pov-roof-panel{position:fixed;right:18px;top:86px;z-index:31500;width:280px;background:#111;border:2px solid #fff;color:#fff;padding:12px;font:12px monospace;box-shadow:6px 6px 0 #000}
          .vtt-pov-roof-panel[hidden]{display:none}.vtt-pov-roof-panel label{display:grid;gap:4px;margin:8px 0}.vtt-pov-roof-panel input{background:#080808;color:#fff;border:1px solid #777;padding:6px}
        `;
        doc.head.appendChild(style);
      }
      if (!doc.getElementById('vtt-pov-status')) {
        const badge = doc.createElement('div');
        badge.id = 'vtt-pov-status';
        badge.className = 'vtt-pov-status';
        doc.body.appendChild(badge);
      }
      if (!doc.getElementById('vtt-pov-controls')) {
        const controls = doc.createElement('nav');
        controls.id = 'vtt-pov-controls';
        controls.className = 'vtt-pov-controls';
        controls.setAttribute('aria-label', 'View direction controls');
        controls.innerHTML = '<button type="button" data-pov-action="left" title="Shift+[">VIEW ◀</button><button type="button" data-pov-action="lock" title="E">VIEW FREE</button><button type="button" data-pov-action="right" title="Shift+]">VIEW ▶</button>';
        controls.addEventListener('click', onPovControlsClick);
        listeners.push(() => controls.removeEventListener('click', onPovControlsClick));
        doc.body.appendChild(controls);
      }
      if (isDm && !doc.getElementById('vtt-pov-roof-editor')) {
        const panel = doc.createElement('aside');
        panel.id = 'vtt-pov-roof-editor';
        panel.className = 'vtt-pov-roof-panel';
        panel.hidden = true;
        doc.body.appendChild(panel);
      }
      installRoofButton();
      updateStatus();
    }

    function installRoofButton() {
      if (!isDm || !doc) return;
      const toolbar = doc.getElementById('vtt-lighting-toolbar');
      if (!toolbar || doc.getElementById('vtt-pov-roof-tool')) return;
      const button = doc.createElement('button');
      button.id = 'vtt-pov-roof-tool';
      button.type = 'button';
      button.className = 'brutalist-button';
      button.textContent = 'ROOF';
      button.addEventListener('click', () => {
        roofToolActive = !roofToolActive;
        button.classList.toggle('is-active', roofToolActive);
        if (!roofToolActive) { roofDragStart = null; closeRoofEditor(); }
      });
      toolbar.appendChild(button);
    }

    function syncControls() {
      const controls = doc?.getElementById('vtt-pov-controls');
      if (!controls) return;
      const hasToken = Boolean(activeLookToken()) && !editActive();
      controls.hidden = Boolean(isDm && !hasToken);
      for (const button of controls.querySelectorAll('button')) button.disabled = !hasToken;
      const lockButton = controls.querySelector('[data-pov-action="lock"]');
      if (lockButton) {
        lockButton.textContent = lookLocked() ? 'VIEW LOCKED' : 'VIEW FREE';
        lockButton.classList.toggle('is-active', lookLocked());
      }
    }

    function updateStatus() {
      const badge = doc?.getElementById('vtt-pov-status');
      if (!badge) return;
      syncControls();
      const currentToken = activeLookToken();
      if (isDm && !currentToken) { badge.hidden = true; return; }
      badge.hidden = false;
      if (lookUpHeld() && mapData.pov.lookUpBlocked) {
        badge.textContent = 'Q · LOOK UP · BLOCKED';
        badge.dataset.mode = 'blocked';
        return;
      }
      if (lookUpHeld()) {
        const target = pov.nextLayer(activeLookToken() || activeZ(), mapData);
        badge.textContent = target == null ? 'Q · LOOK UP · NO FLOOR' : `Q · LOOK UP · Z${target}`;
        badge.dataset.mode = target == null ? 'blocked' : 'up';
        return;
      }
      const token = currentToken;
      const angle = token ? Math.round(normalizeAngle(token.lookDeg ?? token.facingDeg)) : null;
      badge.textContent = token ? `${lookLocked() ? 'E · LOOK LOCKED' : 'E · LOOK FREE'} · ${angle}°` : 'POV · NO VIEWER';
      badge.dataset.mode = lookLocked() ? 'locked' : 'free';
    }

    function scheduleSave(token) {
      if (!token) return;
      if (saveTimer != null) root.clearTimeout?.(saveTimer);
      saveTimer = root.setTimeout?.(() => {
        saveTimer = null;
        stateBridge.saveLook(token).catch((error) => console.error('VTT PoV save failed:', error));
      }, 120) || null;
    }

    function dispatchPovChanged(reason, token) {
      mapData.pov.dirty = true;
      mapData.pov.revision = (Number(mapData.pov.revision) || 0) + 1;
      root?.LuminousVttPerformanceGuard?.invalidate?.();
      const EventCtor = root?.CustomEvent || browserRoot?.CustomEvent || globalThis.CustomEvent;
      if (typeof EventCtor === 'function') {
        canvas.dispatchEvent?.(new EventCtor('vtt:pov-changed', {
          detail: { reason, tokenId: token?.id || null, lookDeg: token?.lookDeg ?? null, revision: mapData.pov.revision },
        }));
      }
    }

    function applyLookDeg(value, { reason = 'look', force = false } = {}) {
      if (editActive()) return false;
      const token = activeLookToken();
      if (!token) return false;
      const next = quantizeAngle(value);
      const previous = Number(token.lookDeg ?? token.facingDeg);
      if (!force && !angleChanged(previous, next)) return false;
      if (Math.abs((visibility?.signedAngleDeltaDeg?.(next, previous)) ?? (next - previous)) < 1e-9) return false;
      token.lookDeg = next;
      lastLookAppliedAt = nowMs();
      scheduleSave(token);
      dispatchPovChanged(reason, token);
      updateStatus();
      return true;
    }

    function flushPendingLook() {
      lookUpdateTimer = null;
      if (pendingLookDeg == null) return false;
      const value = pendingLookDeg;
      pendingLookDeg = null;
      return applyLookDeg(value, { reason: 'mouse-look' });
    }

    function queueLookDeg(value) {
      const next = quantizeAngle(value);
      const token = activeLookToken();
      if (!token || !angleChanged(token.lookDeg ?? token.facingDeg, next)) return false;
      const elapsed = nowMs() - lastLookAppliedAt;
      if (elapsed >= LOOK_THROTTLE_MS && lookUpdateTimer == null) return applyLookDeg(next, { reason: 'mouse-look' });
      pendingLookDeg = next;
      if (lookUpdateTimer == null) {
        const delay = Math.max(0, LOOK_THROTTLE_MS - Math.max(0, elapsed));
        lookUpdateTimer = root.setTimeout?.(flushPendingLook, delay) || null;
      }
      return false;
    }

    function updateLookFromPoint(point) {
      if (lookLocked() || editActive()) return false;
      const token = activeLookToken();
      if (!token) return false;
      return queueLookDeg(pov.angleToPointDeg(token, point));
    }

    function rotateLook(deltaDeg = LOOK_BUTTON_STEP_DEG) {
      if (editActive()) return false;
      const token = activeLookToken();
      if (!token) return false;
      pendingLookDeg = null;
      if (lookUpdateTimer != null) root.clearTimeout?.(lookUpdateTimer);
      lookUpdateTimer = null;
      return applyLookDeg(Number(token.lookDeg ?? token.facingDeg) + Number(deltaDeg || 0), { reason: 'look-step', force: true });
    }

    function onPovControlsClick(event) {
      const action = event.target?.closest?.('[data-pov-action]')?.dataset?.povAction;
      if (action === 'left') rotateLook(-LOOK_BUTTON_STEP_DEG);
      else if (action === 'right') rotateLook(LOOK_BUTTON_STEP_DEG);
      else if (action === 'lock') toggleLookLock();
    }

    function toggleLookLock() {
      mapData.pov.lookLocked = !lookLocked();
      const token = activeLookToken();
      if (token) stateBridge.saveLook(token).catch((error) => console.error('VTT PoV lock save failed:', error));
      updateStatus();
      return lookLocked();
    }

    function setLookUpHeld(value) {
      const next = Boolean(value);
      if (next === mapData.pov.lookUpHeld) return mapData.pov.lookUpHeld;
      mapData.pov.lookUpHeld = next;
      if (!mapData.pov.lookUpHeld) mapData.pov.lookUpBlocked = false;
      dispatchPovChanged(next ? 'look-up-start' : 'look-up-stop', activeLookToken());
      updateStatus();
      return mapData.pov.lookUpHeld;
    }

    function setLookUpBlocked(value) {
      mapData.pov.lookUpBlocked = Boolean(value);
      updateStatus();
    }

    function viewLayer(baseZ = activeZ()) {
      if (!lookUpHeld()) return Number(baseZ) || 0;
      const next = pov.nextLayer(activeLookToken() || baseZ, mapData);
      return next == null ? Number(baseZ) || 0 : next;
    }

    function isTypingTarget(target) {
      const tag = String(target?.tagName || '').toLowerCase();
      return ['input', 'textarea', 'select'].includes(tag) || target?.isContentEditable === true;
    }

    function onPointerMove(event) {
      if (event.buttons) return;
      if (roofToolActive && editActive()) return;
      updateLookFromPoint(eventWorldPoint(event));
    }

    function onKeyDown(event) {
      if (isTypingTarget(event.target) || event.ctrlKey || event.metaKey || event.altKey) return;
      const key = String(event.key || '').toLowerCase();
      if (event.shiftKey && event.code === 'BracketLeft' && !event.repeat) {
        rotateLook(-LOOK_BUTTON_STEP_DEG);
        event.preventDefault();
        return;
      }
      if (event.shiftKey && event.code === 'BracketRight' && !event.repeat) {
        rotateLook(LOOK_BUTTON_STEP_DEG);
        event.preventDefault();
        return;
      }
      if (key === 'e' && !event.repeat) {
        toggleLookLock();
        event.preventDefault();
        return;
      }
      if (key === 'q') {
        if (!event.repeat) setLookUpHeld(true);
        event.preventDefault();
      }
    }

    function onKeyUp(event) {
      if (String(event.key || '').toLowerCase() !== 'q') return;
      setLookUpHeld(false);
      event.preventDefault();
    }

    function onWindowBlur() {
      if (lookUpHeld()) setLookUpHeld(false);
      pendingLookDeg = null;
      if (lookUpdateTimer != null) root.clearTimeout?.(lookUpdateTimer);
      lookUpdateTimer = null;
      roofDragStart = null;
      mapData.pov.roofPreviewPoint = null;
    }

    function roofAtPoint(point) {
      const roofs = scene().roofs || [];
      return roofs.find((roof) => Number(roof.zLayer ?? 0) === activeZ() && pov.pointInRect(point, roof, 1)) || null;
    }

    function placeRoof(from, to) {
      const a = snapVertex(from), b = snapVertex(to);
      if (Math.abs(a.x - b.x) < 1 || Math.abs(a.y - b.y) < 1) return null;
      const zLayer = activeZ();
      const roof = {
        id: uid('roof'),
        label: 'ROOF',
        zLayer,
        x1: Math.min(a.x, b.x), y1: Math.min(a.y, b.y), x2: Math.max(a.x, b.x), y2: Math.max(a.y, b.y),
        elevationFt: pov.elevationForLayer(mapData, zLayer) + num(mapData.defaultCeilingHeightFt, pov.DEFAULT_CEILING_HEIGHT_FT),
        transparent: false,
      };
      scene().roofs.push(roof);
      selectedRoofId = roof.id;
      persistScene();
      openRoofEditor(roof);
      return roof;
    }

    async function persistScene() {
      const bridge = sceneBridge || stateBridge;
      if (typeof bridge?.saveScene !== 'function') {
        console.error('VTT roof persistence failed: scene bridge is unavailable.');
        emit('No se pudo guardar el techo.', 'error');
        return;
      }
      try { await bridge.saveScene(scene()); }
      catch (error) { console.error('VTT roof save failed:', error); emit('No se pudo guardar el techo.', 'error'); }
    }

    function openRoofEditor(roof) {
      if (!isDm || !roof) return;
      selectedRoofId = roof.id;
      const panel = doc?.getElementById('vtt-pov-roof-editor');
      if (!panel) return;
      panel.innerHTML = `<header><strong>ROOF</strong><small>${clean(roof.id)}</small></header>
        <label>LABEL<input data-roof-field="label" value="${clean(roof.label || 'ROOF')}"></label>
        <label>ELEVATION FT<input type="number" step="1" data-roof-field="elevationFt" value="${num(roof.elevationFt)}"></label>
        <label><input type="checkbox" data-roof-field="transparent" ${roof.transparent ? 'checked' : ''}> TRANSPARENT</label>
        <button type="button" class="vtt-danger-button" data-roof-delete>DELETE ROOF</button>`;
      panel.hidden = false;
      panel.addEventListener('change', onRoofEditorChange);
      panel.querySelector('[data-roof-delete]')?.addEventListener('click', () => {
        scene().roofs = (scene().roofs || []).filter((entry) => clean(entry.id) !== clean(selectedRoofId));
        selectedRoofId = null;
        closeRoofEditor();
        persistScene();
      }, { once: true });
    }

    function closeRoofEditor() {
      const panel = doc?.getElementById('vtt-pov-roof-editor');
      if (!panel) return;
      panel.removeEventListener('change', onRoofEditorChange);
      panel.hidden = true;
    }

    function onRoofEditorChange(event) {
      const roof = (scene().roofs || []).find((entry) => clean(entry.id) === clean(selectedRoofId));
      const field = event.target?.dataset?.roofField;
      if (!roof || !field) return;
      if (field === 'transparent') roof.transparent = Boolean(event.target.checked);
      else if (field === 'elevationFt') roof.elevationFt = num(event.target.value, roof.elevationFt);
      else roof[field] = event.target.value;
      persistScene();
    }

    function onRoofMouseDown(event) {
      if (!roofToolActive || !editActive() || event.button !== 0) return;
      const point = eventWorldPoint(event);
      const existing = roofAtPoint(point);
      if (existing) {
        openRoofEditor(existing);
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
      roofDragStart = point;
      event.preventDefault();
      event.stopImmediatePropagation();
    }

    function onRoofMouseUp(event) {
      if (!roofToolActive || !editActive() || !roofDragStart) return;
      const start = roofDragStart;
      roofDragStart = null;
      placeRoof(start, eventWorldPoint(event));
      event.preventDefault();
      event.stopImmediatePropagation();
    }

    function renderEditorGuides(ctx, zLayer = activeZ()) {
      if (!ctx || !editActive()) return;
      ctx.save();
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#ffffff';
      ctx.fillStyle = 'rgba(255,255,255,.08)';
      ctx.setLineDash([8, 6]);
      for (const roof of scene().roofs || []) {
        if (Number(roof.zLayer ?? 0) !== Number(zLayer)) continue;
        const r = pov.normalizeRect(roof);
        ctx.fillRect(r.x1, r.y1, r.x2 - r.x1, r.y2 - r.y1);
        ctx.strokeRect(r.x1, r.y1, r.x2 - r.x1, r.y2 - r.y1);
      }
      if (roofDragStart) {
        const current = mapData.pov.roofPreviewPoint;
        if (current) {
          const a = snapVertex(roofDragStart), b = snapVertex(current);
          ctx.strokeRect(Math.min(a.x,b.x), Math.min(a.y,b.y), Math.abs(a.x-b.x), Math.abs(a.y-b.y));
        }
      }
      ctx.restore();
    }

    function onRoofPreviewMove(event) {
      if (!roofToolActive || !editActive() || !roofDragStart) return;
      mapData.pov.roofPreviewPoint = eventWorldPoint(event);
    }

    function handleSceneChanged() {
      scene().roofs ||= [];
      if (selectedRoofId) {
        const current = scene().roofs.find((entry) => clean(entry.id) === clean(selectedRoofId));
        if (current) openRoofEditor(current); else closeRoofEditor();
      }
    }

    injectUi();
    canvas.addEventListener('mousemove', onPointerMove); listeners.push(() => canvas.removeEventListener('mousemove', onPointerMove));
    canvas.addEventListener('vtt:dm-observer-changed', updateStatus); listeners.push(() => canvas.removeEventListener('vtt:dm-observer-changed', updateStatus));
    canvas.addEventListener('mousemove', onRoofPreviewMove, true); listeners.push(() => canvas.removeEventListener('mousemove', onRoofPreviewMove, true));
    canvas.addEventListener('mousedown', onRoofMouseDown, true); listeners.push(() => canvas.removeEventListener('mousedown', onRoofMouseDown, true));
    root.addEventListener('mouseup', onRoofMouseUp, true); listeners.push(() => root.removeEventListener('mouseup', onRoofMouseUp, true));
    root.addEventListener('keydown', onKeyDown, true); listeners.push(() => root.removeEventListener('keydown', onKeyDown, true));
    root.addEventListener('keyup', onKeyUp, true); listeners.push(() => root.removeEventListener('keyup', onKeyUp, true));
    root.addEventListener('blur', onWindowBlur); listeners.push(() => root.removeEventListener('blur', onWindowBlur));

    function stop() {
      listeners.splice(0).forEach((fn) => fn());
      if (saveTimer != null) root.clearTimeout?.(saveTimer);
      if (lookUpdateTimer != null) root.clearTimeout?.(lookUpdateTimer);
      saveTimer = null;
      lookUpdateTimer = null;
      pendingLookDeg = null;
      setLookUpHeld(false);
      closeRoofEditor();
      doc?.getElementById('vtt-pov-controls')?.remove?.();
    }

    return Object.freeze({
      LOOK_STEP_DEG,
      LOOK_THROTTLE_MS,
      LOOK_BUTTON_STEP_DEG,
      activeLookToken,
      lookLocked,
      lookUpHeld,
      toggleLookLock,
      setLookUpHeld,
      setLookUpBlocked,
      viewLayer,
      updateLookFromPoint,
      applyLookDeg,
      rotateLook,
      renderEditorGuides,
      handleSceneChanged,
      installRoofButton,
      stop,
    });
  }

  return Object.freeze({ createController });
});
