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
    if (!pov) throw new Error('POV_ENGINE_REQUIRED');
    const listeners = [];
    mapData.pov ||= {};
    if (typeof mapData.pov.lookLocked !== 'boolean') mapData.pov.lookLocked = false;
    if (typeof mapData.pov.lookUpHeld !== 'boolean') mapData.pov.lookUpHeld = false;
    mapData.pov.lookUpBlocked = false;
    mapData.lighting ||= {};
    mapData.lighting.scene ||= { sources: [], interiors: [], transformers: [], switches: [] };
    mapData.lighting.scene.roofs ||= [];

    let saveTimer = null;
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
          .vtt-pov-status{position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:30020;background:#0b0b0b;border:1px solid #aaa;color:#fff;padding:6px 10px;font:700 11px monospace;pointer-events:none;box-shadow:3px 3px 0 #000}
          .vtt-pov-status[data-mode="blocked"]{border-color:#ff6b6b}.vtt-pov-status[data-mode="up"]{border-color:#8bd8ff}.vtt-pov-status[data-mode="locked"]{border-color:#ffe38b}
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

    function updateStatus() {
      const badge = doc?.getElementById('vtt-pov-status');
      if (!badge) return;
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
      badge.textContent = lookLocked() ? 'E · LOOK LOCKED' : 'E · LOOK FREE';
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

    function updateLookFromPoint(point) {
      if (lookLocked() || editActive()) return false;
      const token = activeLookToken();
      if (!token) return false;
      token.lookDeg = pov.angleToPointDeg(token, point);
      scheduleSave(token);
      return true;
    }

    function toggleLookLock() {
      mapData.pov.lookLocked = !lookLocked();
      const token = activeLookToken();
      if (token) stateBridge.saveLook(token).catch((error) => console.error('VTT PoV lock save failed:', error));
      updateStatus();
      return lookLocked();
    }

    function setLookUpHeld(value) {
      mapData.pov.lookUpHeld = Boolean(value);
      if (!mapData.pov.lookUpHeld) mapData.pov.lookUpBlocked = false;
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
      if (updateLookFromPoint(eventWorldPoint(event))) mapData.pov.dirty = true;
    }

    function onKeyDown(event) {
      if (isTypingTarget(event.target) || event.ctrlKey || event.metaKey || event.altKey) return;
      const key = String(event.key || '').toLowerCase();
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
    canvas.addEventListener('mousemove', onRoofPreviewMove, true); listeners.push(() => canvas.removeEventListener('mousemove', onRoofPreviewMove, true));
    canvas.addEventListener('mousedown', onRoofMouseDown, true); listeners.push(() => canvas.removeEventListener('mousedown', onRoofMouseDown, true));
    root.addEventListener('mouseup', onRoofMouseUp, true); listeners.push(() => root.removeEventListener('mouseup', onRoofMouseUp, true));
    root.addEventListener('keydown', onKeyDown, true); listeners.push(() => root.removeEventListener('keydown', onKeyDown, true));
    root.addEventListener('keyup', onKeyUp, true); listeners.push(() => root.removeEventListener('keyup', onKeyUp, true));
    root.addEventListener('blur', onWindowBlur); listeners.push(() => root.removeEventListener('blur', onWindowBlur));

    function stop() {
      listeners.splice(0).forEach((fn) => fn());
      if (saveTimer != null) root.clearTimeout?.(saveTimer);
      saveTimer = null;
      setLookUpHeld(false);
      closeRoofEditor();
    }

    return Object.freeze({
      activeLookToken,
      lookLocked,
      lookUpHeld,
      toggleLookLock,
      setLookUpHeld,
      setLookUpBlocked,
      viewLayer,
      updateLookFromPoint,
      renderEditorGuides,
      handleSceneChanged,
      installRoofButton,
      stop,
    });
  }

  return Object.freeze({ createController });
});
