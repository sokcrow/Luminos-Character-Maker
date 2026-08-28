(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.LuminousVttLightingController = api;
})(typeof window !== 'undefined' ? window : globalThis, function (browserRoot) {
  'use strict';

  const clean = (value) => String(value ?? '').trim();
  const num = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

  function uid(prefix) { return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`; }

  function createController({ canvas, engine, mapData, bridge, isDm = false, notify, root = browserRoot } = {}) {
    if (!canvas || !engine || !mapData || !bridge) throw new Error('LIGHTING_CONTROLLER_INPUT_REQUIRED');
    const doc = root?.document;
    const lighting = root?.LuminousVttLightingEngine;
    const current = bridge.identity || {};
    let tool = 'select';
    let dragStart = null;
    let selected = null;
    let selectingPreview = false;
    let throwSourceId = null;
    const listeners = [];

    function emit(message, mode = 'info') { if (typeof notify === 'function') notify(message, mode); }
    function scene() { return mapData.lighting?.scene || { sources: [], interiors: [], transformers: [], switches: [] }; }
    function editActive() { return Boolean(isDm && mapData.dmEditMode?.active); }
    function worldPoint(event) { return engine.eventWorldPoint(event); }
    function activeZ() { return Number(engine.activeZ) || 0; }
    function elevationForActiveZ() { return lighting?.elevationForLayer?.(mapData, activeZ()) ?? activeZ() * 15; }
    function pxForFt(ft) { return lighting?.feetToPixels?.(ft, mapData) ?? (Number(ft) / 5) * (mapData.grid?.size || 70); }

    function injectUi() {
      if (!doc) return;
      if (!doc.getElementById('vtt-lighting-runtime-style')) {
        const style = doc.createElement('style');
        style.id = 'vtt-lighting-runtime-style';
        style.textContent = `
          .vtt-light-toolbar{display:none;gap:6px;align-items:center;flex-wrap:wrap}
          body.vtt-dm-edit-active .vtt-light-toolbar{display:flex}
          .vtt-light-panel{position:fixed;right:18px;top:86px;z-index:31000;width:min(330px,calc(100vw - 36px));max-height:calc(100vh - 110px);overflow:auto;background:#111;border:2px solid #eee;padding:12px;color:#fff;font:12px monospace;box-shadow:6px 6px 0 #000}
          .vtt-light-panel[hidden]{display:none}.vtt-light-panel label{display:grid;gap:4px;margin:8px 0}.vtt-light-panel input,.vtt-light-panel select{background:#080808;color:#fff;border:1px solid #777;padding:6px}
          .vtt-light-panel .row{display:grid;grid-template-columns:1fr 1fr;gap:8px}.vtt-light-panel button{margin-top:8px}
          .vtt-view-token{position:fixed;right:18px;bottom:18px;z-index:30000}.vtt-view-token.is-active{outline:3px solid #fff}
          .vtt-portable-lights{position:fixed;left:18px;bottom:18px;z-index:30000;display:flex;gap:6px;flex-wrap:wrap;max-width:70vw}.vtt-portable-lights:empty{display:none}
          .vtt-light-chip{display:flex;gap:4px;background:#101010;border:1px solid #777;padding:4px}
        `;
        doc.head.appendChild(style);
      }

      if (isDm && !doc.getElementById('vtt-lighting-toolbar')) {
        const toolbar = doc.createElement('div');
        toolbar.id = 'vtt-lighting-toolbar';
        toolbar.className = 'vtt-toolbar vtt-light-toolbar';
        toolbar.innerHTML = `<span class="vtt-toolbar-title">LIGHTING</span>
          <button type="button" class="brutalist-button" data-light-tool="select">L-SELECT</button>
          <button type="button" class="brutalist-button" data-light-tool="light">LIGHT</button>
          <button type="button" class="brutalist-button" data-light-tool="interior">INTERIOR</button>
          <button type="button" class="brutalist-button" data-light-tool="transformer">TRANSFORMER</button>
          <button type="button" class="brutalist-button" data-light-tool="switch">SWITCH</button>
          <button type="button" class="brutalist-button" data-light-tool="erase">L-ERASE</button>`;
        doc.getElementById('vtt-ui-container')?.appendChild(toolbar);
        toolbar.addEventListener('click', (event) => {
          const button = event.target.closest('[data-light-tool]');
          if (!button) return;
          setTool(button.dataset.lightTool);
        });
      }

      if (isDm && !doc.getElementById('vtt-light-editor')) {
        const panel = doc.createElement('aside');
        panel.id = 'vtt-light-editor';
        panel.className = 'vtt-light-panel';
        panel.hidden = true;
        doc.body.appendChild(panel);
      }

      if (isDm && !doc.getElementById('vtt-view-as-token')) {
        const button = doc.createElement('button');
        button.id = 'vtt-view-as-token';
        button.className = 'brutalist-button vtt-view-token';
        button.textContent = 'VIEW AS TOKEN';
        doc.body.appendChild(button);
        button.addEventListener('click', () => {
          if (mapData.lighting?.dmPreviewTokenId) {
            clearPreview();
            return;
          }
          selectingPreview = !selectingPreview;
          button.classList.toggle('is-active', selectingPreview);
          button.textContent = selectingPreview ? 'CLICK TOKEN…' : 'VIEW AS TOKEN';
        });
      }

      if (!isDm && !doc.getElementById('vtt-portable-lights')) {
        const bar = doc.createElement('div');
        bar.id = 'vtt-portable-lights';
        bar.className = 'vtt-portable-lights';
        doc.body.appendChild(bar);
      }
    }

    function setTool(next) {
      tool = ['select', 'light', 'interior', 'transformer', 'switch', 'erase'].includes(next) ? next : 'select';
      doc?.querySelectorAll?.('[data-light-tool]')?.forEach((button) => button.classList.toggle('is-active', button.dataset.lightTool === tool));
      if (tool !== 'select') closeEditor();
      return tool;
    }

    function clearPreview() {
      mapData.lighting ||= {};
      mapData.lighting.dmPreviewTokenId = null;
      selectingPreview = false;
      const button = doc?.getElementById('vtt-view-as-token');
      if (button) { button.textContent = 'VIEW AS TOKEN'; button.classList.remove('is-active'); }
    }

    function setPreviewToken(token) {
      mapData.lighting ||= {};
      mapData.lighting.dmPreviewTokenId = token?.id || null;
      selectingPreview = false;
      const button = doc?.getElementById('vtt-view-as-token');
      if (button) { button.textContent = token ? `FULL MAP · ${token.id}` : 'VIEW AS TOKEN'; button.classList.toggle('is-active', Boolean(token)); }
    }

    function nearestToken(point, maxPx = (mapData.grid?.size || 70) * 0.55) {
      let best = null, bestDist = Infinity;
      for (const token of mapData.tokens || []) {
        if (Number(lighting?.layerOf?.(token) ?? token.zLayer ?? 0) !== activeZ()) continue;
        const distance = Math.hypot(num(token.x) - point.x, num(token.y) - point.y);
        if (distance <= maxPx && distance < bestDist) { best = token; bestDist = distance; }
      }
      return best;
    }

    function nearestEntity(point, maxPx = (mapData.grid?.size || 70) * 0.45) {
      const candidates = [];
      const add = (kind, list) => (list || []).forEach((item) => {
        if (kind !== 'interior' && Number(item.zLayer ?? 0) !== activeZ()) return;
        if (kind === 'interior') {
          if (Number(item.zLayer ?? 0) !== activeZ()) return;
          const cx = (num(item.x1) + num(item.x2)) / 2, cy = (num(item.y1) + num(item.y2)) / 2;
          const inside = point.x >= Math.min(item.x1, item.x2) && point.x <= Math.max(item.x1, item.x2) && point.y >= Math.min(item.y1, item.y2) && point.y <= Math.max(item.y1, item.y2);
          if (inside) candidates.push({ kind, item, distance: Math.hypot(point.x - cx, point.y - cy) * 0.1 });
          return;
        }
        const position = kind === 'source' ? lighting?.sourcePosition?.(item, mapData) || item : item;
        candidates.push({ kind, item, distance: Math.hypot(point.x - num(position.x), point.y - num(position.y)) });
      });
      const s = scene();
      add('source', s.sources); add('switch', s.switches); add('transformer', s.transformers); add('interior', s.interiors);
      return candidates.filter((candidate) => candidate.distance <= maxPx).sort((a, b) => a.distance - b.distance)[0] || null;
    }

    async function persist() {
      try { await bridge.saveScene(scene()); }
      catch (error) { console.error('VTT lighting save failed:', error); emit('No se pudo guardar la iluminación.', 'error'); }
    }

    function placeSource(point) {
      const source = {
        id: uid('light'), label: 'LIGHT', x: point.x, y: point.y, zLayer: activeZ(), elevationFt: elevationForActiveZ(),
        brightFt: 20, dimAdditionalFt: 20, shape: 'radius', directionDeg: 0, coneDeg: 90,
        enabled: true, functional: true, color: '#ffd27a', flicker: null, circuitId: '', attachedToTokenId: null,
      };
      scene().sources.push(source); selected = { kind: 'source', item: source }; persist(); openEditor(selected);
    }

    function placeTransformer(point) {
      const transformer = { id: uid('transformer'), label: 'TRANSFORMER', x: point.x, y: point.y, zLayer: activeZ(), elevationFt: elevationForActiveZ(), powered: true, damaged: false, circuits: ['main'], repair: null };
      scene().transformers.push(transformer); selected = { kind: 'transformer', item: transformer }; persist(); openEditor(selected);
    }

    function placeSwitch(point) {
      const item = { id: uid('switch'), label: 'SWITCH', x: point.x, y: point.y, zLayer: activeZ(), elevationFt: elevationForActiveZ(), circuitId: 'main', state: 'on', interactable: true, interactionFt: 5 };
      scene().switches.push(item); selected = { kind: 'switch', item }; persist(); openEditor(selected);
    }

    function placeInterior(from, to) {
      if (Math.hypot(to.x - from.x, to.y - from.y) < 8) return;
      const interior = { id: uid('interior'), label: 'INTERIOR', zLayer: activeZ(), x1: Math.min(from.x, to.x), y1: Math.min(from.y, to.y), x2: Math.max(from.x, to.x), y2: Math.max(from.y, to.y), baseLight: 'darkness', exteriorPenetrationFt: 5, roof: { present: true, transparent: false } };
      scene().interiors.push(interior); selected = { kind: 'interior', item: interior }; persist(); openEditor(selected);
    }

    function removeEntity(entity) {
      if (!entity) return;
      const map = { source: 'sources', switch: 'switches', transformer: 'transformers', interior: 'interiors' };
      const key = map[entity.kind];
      if (!key) return;
      scene()[key] = (scene()[key] || []).filter((item) => item !== entity.item && clean(item.id) !== clean(entity.item.id));
      selected = null; closeEditor(); persist();
    }

    function checkbox(value) { return value ? 'checked' : ''; }
    function esc(value) { return String(value ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;'); }

    function openEditor(entity) {
      if (!isDm || !entity) return;
      selected = entity;
      const panel = doc?.getElementById('vtt-light-editor');
      if (!panel) return;
      const item = entity.item;
      let body = `<header><strong>${entity.kind.toUpperCase()}</strong><small>${esc(item.id)}</small></header>`;
      if (entity.kind === 'source') body += `
        <label>LABEL<input data-field="label" value="${esc(item.label || '')}"></label>
        <div class="row"><label>BRIGHT FT<input type="number" min="0" step="1" data-field="brightFt" value="${num(item.brightFt,20)}"></label><label>DIM +FT<input type="number" min="0" step="1" data-field="dimAdditionalFt" value="${num(item.dimAdditionalFt,20)}"></label></div>
        <div class="row"><label>SHAPE<select data-field="shape"><option value="radius" ${item.shape !== 'cone'?'selected':''}>RADIUS</option><option value="cone" ${item.shape === 'cone'?'selected':''}>CONE</option></select></label><label>CONE °<input type="number" min="1" max="360" data-field="coneDeg" value="${num(item.coneDeg,90)}"></label></div>
        <div class="row"><label>DIRECTION °<input type="number" step="15" data-field="directionDeg" value="${num(item.directionDeg,0)}"></label><label>ELEVATION FT<input type="number" step="1" data-field="elevationFt" value="${num(item.elevationFt,0)}"></label></div>
        <label>CIRCUIT<input data-field="circuitId" value="${esc(item.circuitId || '')}" placeholder="none"></label>
        <label>COLOR<input type="color" data-field="color" value="${esc(item.color || '#ffd27a')}"></label>
        <label><input type="checkbox" data-field="enabled" ${checkbox(item.enabled !== false)}> ENABLED</label>
        <label><input type="checkbox" data-field="functional" ${checkbox(item.functional !== false)}> FUNCTIONAL</label>
        <label><input type="checkbox" data-field="flicker.enabled" ${checkbox(item.flicker?.enabled)}> VISUAL FLICKER</label>
        <div class="row"><label>ATTACH TOKEN<input data-field="attachedToTokenId" value="${esc(item.attachedToTokenId || '')}"></label><label>OWNER PLAYER<input data-field="ownerPlayerId" value="${esc(item.ownerPlayerId || '')}"></label></div>
        <label>THROW RANGE FT (optional)<input type="number" min="0" step="1" data-field="throwRangeFt" value="${Number.isFinite(Number(item.throwRangeFt))?Number(item.throwRangeFt):''}"></label>`;
      if (entity.kind === 'interior') body += `
        <label>LABEL<input data-field="label" value="${esc(item.label || '')}"></label>
        <div class="row"><label>BASE LIGHT<select data-field="baseLight"><option value="darkness" ${item.baseLight!=='dim'?'selected':''}>DARKNESS</option><option value="dim" ${item.baseLight==='dim'?'selected':''}>DIM</option></select></label><label>EXTERIOR PENETRATION FT<input type="number" min="0" step="1" data-field="exteriorPenetrationFt" value="${num(item.exteriorPenetrationFt,5)}"></label></div>
        <label><input type="checkbox" data-field="roof.present" ${checkbox(item.roof?.present !== false)}> HAS ROOF / CEILING</label>
        <label><input type="checkbox" data-field="roof.transparent" ${checkbox(item.roof?.transparent)}> TRANSPARENT ROOF</label>`;
      if (entity.kind === 'transformer') body += `
        <label>LABEL<input data-field="label" value="${esc(item.label || '')}"></label>
        <label>CIRCUITS (comma)<input data-field="circuits" value="${esc((item.circuits || []).join(','))}"></label>
        <label><input type="checkbox" data-field="powered" ${checkbox(item.powered !== false)}> POWERED</label><label><input type="checkbox" data-field="damaged" ${checkbox(item.damaged)}> DAMAGED</label>
        <hr><strong>REPAIR CHECK · optional, no defaults</strong>
        <label>REQUIRED ITEM<input data-field="repair.requiredItem" value="${esc(item.repair?.requiredItem || '')}"></label>
        <div class="row"><label>THRESHOLD<input type="number" min="0" data-field="repair.threshold" value="${Number.isFinite(Number(item.repair?.threshold))?Number(item.repair.threshold):''}"></label><label>ABILITY<input data-field="repair.abilityId" value="${esc(item.repair?.rollSpec?.abilityId || '')}" placeholder="int"></label></div>
        <label>SKILL ID (optional)<input data-field="repair.skillId" value="${esc(item.repair?.rollSpec?.skillId || '')}"></label>`;
      if (entity.kind === 'switch') body += `
        <label>LABEL<input data-field="label" value="${esc(item.label || '')}"></label><label>CIRCUIT<input data-field="circuitId" value="${esc(item.circuitId || 'main')}"></label>
        <div class="row"><label>STATE<select data-field="state"><option value="on" ${item.state!=='off'?'selected':''}>ON</option><option value="off" ${item.state==='off'?'selected':''}>OFF</option></select></label><label>REACH FT<input type="number" min="0" step="1" data-field="interactionFt" value="${num(item.interactionFt,5)}"></label></div>
        <label><input type="checkbox" data-field="interactable" ${checkbox(item.interactable !== false)}> INTERACTABLE</label>`;
      body += `<button type="button" class="brutalist-button" data-light-save>SAVE</button> <button type="button" class="vtt-danger-button" data-light-delete>DELETE</button>`;
      panel.innerHTML = body;
      panel.hidden = false;
      panel.querySelector('[data-light-save]')?.addEventListener('click', saveEditor);
      panel.querySelector('[data-light-delete]')?.addEventListener('click', () => removeEntity(selected));
    }

    function fieldValue(panel, name) {
      const input = panel.querySelector(`[data-field="${name}"]`);
      if (!input) return undefined;
      if (input.type === 'checkbox') return input.checked;
      if (input.type === 'number') return input.value === '' ? null : Number(input.value);
      return input.value;
    }

    function saveEditor() {
      const panel = doc?.getElementById('vtt-light-editor');
      if (!panel || !selected) return;
      const item = selected.item;
      panel.querySelectorAll('[data-field]')?.forEach((input) => {
        const path = input.dataset.field;
        let value = input.type === 'checkbox' ? input.checked : input.type === 'number' ? (input.value === '' ? null : Number(input.value)) : input.value;
        if (path === 'circuits') { item.circuits = String(value).split(',').map(clean).filter(Boolean); return; }
        if (path.startsWith('flicker.')) { item.flicker ||= {}; item.flicker[path.split('.')[1]] = value; return; }
        if (path.startsWith('roof.')) { item.roof ||= {}; item.roof[path.split('.')[1]] = value; return; }
        if (path.startsWith('repair.')) {
          item.repair ||= { rollSpec: {} };
          const key = path.split('.')[1];
          if (key === 'abilityId') item.repair.rollSpec.abilityId = clean(value);
          else if (key === 'skillId') item.repair.rollSpec.skillId = clean(value) || null;
          else item.repair[key] = value;
          const ability = clean(item.repair.rollSpec.abilityId);
          const skill = clean(item.repair.rollSpec.skillId);
          if (ability) item.repair.rollSpec = { kind: skill ? 'skill' : 'ability', abilityId: ability, skillId: skill || null, label: skill || ability.toUpperCase() };
          if (!item.repair.requiredItem && !Number.isFinite(Number(item.repair.threshold)) && !ability) item.repair = null;
          return;
        }
        item[path] = value;
      });
      persist(); openEditor(selected);
    }

    function closeEditor() { const panel = doc?.getElementById('vtt-light-editor'); if (panel) panel.hidden = true; selected = null; }

    function onMouseDown(event) {
      if (selectingPreview && isDm) {
        const token = nearestToken(worldPoint(event));
        if (token) { setPreviewToken(token); event.preventDefault(); event.stopImmediatePropagation(); }
        return;
      }
      if (throwSourceId && !isDm) {
        const point = worldPoint(event);
        const target = { x: point.x, y: point.y, zLayer: activeZ(), elevationFt: elevationForActiveZ() };
        bridge.requestSourceThrow(throwSourceId, target).catch((error) => emit(error.message || 'No se pudo lanzar la luz.', 'error'));
        throwSourceId = null; renderPortableBar(); event.preventDefault(); event.stopImmediatePropagation(); return;
      }
      if (!editActive()) return;
      const point = worldPoint(event);
      if (tool === 'interior') { dragStart = point; event.preventDefault(); event.stopImmediatePropagation(); return; }
      if (tool === 'light') placeSource(point);
      else if (tool === 'transformer') placeTransformer(point);
      else if (tool === 'switch') placeSwitch(point);
      else if (tool === 'erase') removeEntity(nearestEntity(point));
      else if (tool === 'select') {
        const entity = nearestEntity(point);
        if (entity) openEditor(entity);
        else closeEditor();
        return;
      } else return;
      event.preventDefault(); event.stopImmediatePropagation();
    }

    function onMouseUp(event) {
      if (!dragStart || !editActive() || tool !== 'interior') return;
      const end = worldPoint(event); placeInterior(dragStart, end); dragStart = null;
      event.preventDefault(); event.stopImmediatePropagation();
    }

    function onDoubleClick(event) {
      if (isDm || editActive()) return;
      const point = worldPoint(event);
      const entity = nearestEntity(point, pxForFt(6));
      if (!entity) return;
      if (entity.kind === 'switch' && entity.item.interactable !== false) {
        bridge.requestSwitchToggle(entity.item.id).catch((error) => emit(error.message || 'No se pudo usar el switch.', 'error'));
      } else if (entity.kind === 'transformer' && entity.item.damaged) {
        bridge.requestTransformerRepair(entity.item.id).catch((error) => emit(error.message || 'No se pudo solicitar la reparación.', 'error'));
      } else return;
      event.preventDefault(); event.stopImmediatePropagation();
    }

    function ownedPortableSources() {
      const viewer = (mapData.tokens || []).find((token) => token.viewer === true) || (mapData.tokens || []).find((token) => token.characterLink?.mode === 'current_player');
      return (scene().sources || []).filter((source) => clean(source.ownerPlayerId) === clean(current.playerId) || (viewer && clean(source.attachedToTokenId) === clean(viewer.id)));
    }

    function renderPortableBar() {
      if (isDm) return;
      const bar = doc?.getElementById('vtt-portable-lights');
      if (!bar) return;
      bar.innerHTML = '';
      for (const source of ownedPortableSources()) {
        const chip = doc.createElement('div'); chip.className = 'vtt-light-chip';
        const label = doc.createElement('span'); label.textContent = source.label || source.id; chip.appendChild(label);
        if (source.attachedToTokenId) {
          const drop = doc.createElement('button'); drop.className = 'brutalist-button'; drop.textContent = 'DROP'; drop.onclick = () => bridge.requestSourceDrop(source.id); chip.appendChild(drop);
          const thr = doc.createElement('button'); thr.className = 'brutalist-button'; thr.textContent = 'THROW'; thr.disabled = !Number.isFinite(Number(source.throwRangeFt)); thr.title = thr.disabled ? 'Esta fuente no tiene throwRangeFt configurado.' : 'Haz clic en el destino.'; thr.onclick = () => { throwSourceId = source.id; renderPortableBar(); emit('Haz clic donde quieres lanzar la fuente.', 'pending'); }; chip.appendChild(thr);
        } else {
          const attach = doc.createElement('button'); attach.className = 'brutalist-button'; attach.textContent = 'PICK UP'; attach.onclick = () => bridge.requestSourceAttach(source.id); chip.appendChild(attach);
        }
        if (throwSourceId === source.id) chip.style.outline = '2px solid white';
        bar.appendChild(chip);
      }
    }

    function renderEditorGuides(ctx) {
      if (!isDm || !editActive() || !ctx) return;
      const s = scene();
      ctx.save();
      ctx.font = 'bold 10px monospace'; ctx.textAlign = 'center';
      for (const interior of s.interiors || []) {
        if (Number(interior.zLayer || 0) !== activeZ()) continue;
        ctx.strokeStyle = '#00e5ff'; ctx.setLineDash([8, 5]); ctx.lineWidth = 2;
        ctx.strokeRect(interior.x1, interior.y1, interior.x2 - interior.x1, interior.y2 - interior.y1);
        ctx.fillStyle = '#00e5ff'; ctx.fillText('INTERIOR', (interior.x1 + interior.x2) / 2, interior.y1 + 12);
      }
      ctx.setLineDash([]);
      const drawPoint = (item, color, label) => { if (Number(item.zLayer || 0) !== activeZ()) return; ctx.fillStyle = color; ctx.beginPath(); ctx.arc(item.x, item.y, 9, 0, Math.PI * 2); ctx.fill(); ctx.fillText(label, item.x, item.y - 14); };
      (s.transformers || []).forEach((item) => drawPoint(item, '#ff3bd5', item.damaged ? 'TRANSFORMER · DAMAGED' : 'TRANSFORMER'));
      (s.switches || []).forEach((item) => drawPoint(item, '#7dff6b', `SWITCH · ${String(item.state || 'on').toUpperCase()}`));
      (s.sources || []).forEach((item) => {
        const p = lighting?.sourcePosition?.(item, mapData) || item;
        if (Number(p.zLayer || 0) !== activeZ()) return;
        ctx.strokeStyle = item.color || '#ffd27a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.x, p.y, 7, 0, Math.PI * 2); ctx.stroke();
      });
      ctx.restore();
    }

    function handleSceneChanged() { renderPortableBar(); if (selected) { const id = selected.item?.id, kind = selected.kind; const map = { source: 'sources', switch: 'switches', transformer: 'transformers', interior: 'interiors' }; const currentItem = (scene()[map[kind]] || []).find((item) => clean(item.id) === clean(id)); if (currentItem) openEditor({ kind, item: currentItem }); else closeEditor(); } }

    injectUi();
    canvas.addEventListener('mousedown', onMouseDown, true); listeners.push(() => canvas.removeEventListener('mousedown', onMouseDown, true));
    root.addEventListener('mouseup', onMouseUp, true); listeners.push(() => root.removeEventListener('mouseup', onMouseUp, true));
    canvas.addEventListener('dblclick', onDoubleClick, true); listeners.push(() => canvas.removeEventListener('dblclick', onDoubleClick, true));
    renderPortableBar(); setTool('select');

    function stop() { listeners.splice(0).forEach((fn) => fn()); closeEditor(); }

    return Object.freeze({ setTool, clearPreview, setPreviewToken, renderEditorGuides, renderPortableBar, handleSceneChanged, stop, getTool: () => tool, getSelected: () => selected });
  }

  return Object.freeze({ createController });
});