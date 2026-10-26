(function (global) {
  'use strict';
  if (global.LuminousCombatStage073) return;
  const ROOT = 'campaña/combate';
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const finite = (value, fallback) => value != null && Number.isFinite(Number(value)) ? Number(value) : fallback;
  const state = { mounted: false, placing: false, selected: '', busy: false, frame: 0 };
  const adapter = () => global.LuminousCombatLiveAdapter073?.state;
  const unitMap = () => global.LuminousCombat073?.combatants?.() || {};
  const byId = id => global.document?.getElementById(id);
  const isDm = () => adapter()?.role === 'dm';

  // Percentages remain the existing canonical flat-field coordinates. Camera,
  // depth and attack travel never write these coordinates or consume rules RNG.
  function placementPoint(clientX, clientY, rect) {
    return {
      x: Math.round(clamp((clientX - rect.left) / rect.width * 100, 5, 95) * 100) / 100,
      y: Math.round(clamp((1 - (clientY - rect.top) / rect.height) * 100, 12, 52) * 100) / 100
    };
  }
  function depthAt(y, offsetY = 0, height = 900) {
    const ground = clamp(1 - finite(y, 25) / 100 + finite(offsetY, 0) / Math.max(1, height), 0, 1);
    return { scale: .84 + ground * .28, order: 1 + Math.round(ground * 20) };
  }
  function canPlace(combat = {}) {
    const phase = String(typeof combat.estado === 'object' ? combat.estado?.phase : combat.estado || '').toLowerCase();
    return ['setup', 'pre_combat_planning', 'planning'].includes(phase) &&
      !combat.authority?.current && !Object.keys(combat.plannedActions || {}).length &&
      !Object.values(combat.readyPlayers || {}).some(row => row?.ready === true || Number(row?.plannedSlots) > 0 || Object.keys(row?.targetIntents || {}).length);
  }
  function patchPlacement(unit, point) {
    return { ...unit, x: point.x, y: point.y, positionPinned: true,
      stagePlacement: { x: point.x, y: point.y, revision: (finite(unit.stagePlacement?.revision, 0) + 1) } };
  }
  function message(text) { const node = byId('combat-stage-message'); if (node) node.textContent = text; }
  function refreshUnit(unit, fieldHeight) {
    const token = byId(`token-${unit.id}`);
    if (!token) return;
    const depth = depthAt(unit.y, unit.combatOffsetY, fieldHeight ?? byId('battlefield')?.offsetHeight);
    const deployment = global.LuminousCombatDeploymentRuntime;
    const profile = deployment?.sizeProfile(unit) || { spriteScale: 1, spaces: 1, hudScale: 1 };
    const artScale = Math.max(.01, finite(unit.scale, 1));
    const panelTop = Math.min(60, 360 - 240 * artScale * profile.spriteScale * depth.scale - 64 - finite(unit.spriteY, 0));
    const values = { '--scene-depth-scale': String(depth.scale), '--scene-order': String(depth.order),
      '--creature-size-scale': String(profile.spriteScale),
      '--creature-floor-scale': String(profile.hudScale < 1 ? profile.hudScale : Math.sqrt(profile.spaces)),
      '--creature-hud-scale': String(profile.hudScale ?? 1),
      '--creature-panel-top': `${panelTop}px` };
    for (const [key, value] of Object.entries(values)) if (token.style.getPropertyValue(key) !== value) token.style.setProperty(key, value);
    token.classList.toggle('stage-selected', state.placing && unit.id === state.selected);
  }
  function refresh() {
    // Reading offsetHeight can force a layout flush. Read once per roster,
    // not once for each combatant (up to sixteen per render).
    const fieldHeight = byId('battlefield')?.offsetHeight;
    Object.values(unitMap()).forEach(unit=>refreshUnit(unit,fieldHeight));
    const control = byId('combat-stage-placement');
    if (control) {
      control.hidden = !isDm();
      control.disabled = Boolean(global.LuminousCombatAuthority073?.state.current?.phase);
      control.title = 'Disponible antes de planificar la primera ronda.';
    }
    if (state.placing && (!isDm() || global.LuminousCombatAuthority073?.state.current?.id ||
      !['setup', 'pre_combat_planning', 'planning'].includes(String(adapter()?.combatState || '').toLowerCase()))) setPlacing(false);
  }
  function camera({ x = 0, y = 0, scale = 1 } = {}) {
    // This is a 2.5D illustration, not an independent world-coordinate map.
    // Ground, architecture, horizon and foreground must use EXACTLY the same
    // camera matrix as #battlefield; depth-only parallax made the map appear
    // fixed while sprites moved and broke their shared ground coordinates.
    byId('game-container')?.classList.toggle('camera-manual', ['manual', 'touch'].includes(byId('battlefield')?.dataset.cameraMode));
    const matrix = `translate(${x}px,${y}px) scale(${scale})`;
    for (const layer of global.document?.querySelectorAll('.combat-stage-layer') || []) {
      layer.style.transform = matrix;
    }
  }
  function setPlacing(value) {
    state.placing = Boolean(value && isDm()); state.selected = '';
    byId('game-container')?.classList.toggle('stage-placing', state.placing);
    byId('combat-stage-placement')?.setAttribute('aria-pressed', String(state.placing));
    const tools = byId('combat-stage-tools'); if (tools) tools.hidden = !state.placing;
    if (state.placing) {
      global.setCameraFocus?.('full', false);
      const setup = byId('c073-dm-setup'); if (setup) setup.open = false;
      renderRoster(); message('Elige un combatiente y toca su posición en el suelo.');
    }
    refresh();
  }
  function renderRoster() {
    const select = byId('combat-stage-unit'); if (!select) return;
    select.replaceChildren();
    const option = global.document.createElement('option'); option.value = ''; option.textContent = 'Elegir combatiente'; select.appendChild(option);
    for (const unit of Object.values(unitMap()).filter(unit => !unit.isBackup && unit.battleActive !== false)) {
      const option = global.document.createElement('option'); option.value = unit.id; option.textContent = unit.name || 'Combatiente'; select.appendChild(option);
    }
    select.value = state.selected;
  }
  async function place(id, point) {
    if (!isDm() || !state.placing || state.busy || !id) return false;
    const db = adapter()?.db; if (!db?.ref) return false;
    state.busy = true;
    try {
      const ref = db.ref(ROOT);
      // Observe the whole initial encounter while placing. The transaction
      // retries against concurrent READY, target selection, seal or removal;
      // no stale unit snapshot can be restored into a newer encounter.
      let hold;
      try {
        await new Promise((resolve, reject) => { hold = snapshot => resolve(snapshot); ref.on('value', hold, reject); });
        const result = await ref.transaction(combat => {
          if (!combat || !canPlace(combat)) return;
          const unit = combat.combatants?.[id];
          if (!unit || unit.isBackup || unit.battleActive === false) return;
          return { ...combat, combatants: { ...combat.combatants, [id]: patchPlacement(unit, point) } };
        }, undefined, false);
        if (!result.committed) throw new Error('La formación ya no está disponible.');
      } finally { if (hold) ref.off('value', hold); }
      message('Posición guardada. Puedes colocar otro combatiente.');
      return true;
    } catch (error) {
      global.console?.warn('[Combat stage placement]', error?.code || error?.message);
      message('No se pudo colocar. La formación solo se cambia antes de preparar la primera ronda.');
      return false;
    } finally { state.busy = false; refresh(); }
  }
  function onField(event) {
    if (!state.placing || !isDm() || state.busy) return;
    if (event.target.closest?.('#combat-stage-tools, #c073-dm-setup')) return;
    if (!byId('battlefield')?.contains(event.target) && event.target !== byId('game-container')) return;
    const field = byId('battlefield'); if (!field) return;
    const rect = field.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) return;
    // In placement mode the game's planning/menu click handlers must not also run.
    event.preventDefault(); event.stopImmediatePropagation();
    const token = event.target.closest?.('.sprite-container');
    if (token) {
      state.selected = token.id.slice('token-'.length); renderRoster(); refresh();
      message('Toca el suelo para colocar al combatiente seleccionado.'); return;
    }
    if (state.selected) place(state.selected, placementPoint(event.clientX, event.clientY, rect));
  }
  function mount() {
    if (state.mounted || !byId('game-container') || !byId('webgl2-dom-background')) return;
    state.mounted = true;
    const host = byId('game-container'); host.classList.add('layered-stage');
    const background = byId('webgl2-dom-background'); background.replaceChildren();
    for (const [name, depth] of [['horizon', .18], ['architecture', .52], ['ground', 1]]) {
      const layer = global.document.createElement('div'); layer.className = `combat-stage-layer stage-${name}`; layer.dataset.depth = depth; background.appendChild(layer);
    }
    const front = global.document.createElement('div'); front.id = 'combat-stage-foreground'; front.setAttribute('aria-hidden', 'true');
    front.innerHTML = '<div class="combat-stage-layer stage-foreground" data-depth="1.04"></div>'; host.appendChild(front);
    const tools = global.document.createElement('div'); tools.id = 'combat-stage-tools'; tools.hidden = true;
    tools.innerHTML = '<select id="combat-stage-unit" aria-label="Combatiente que colocar"></select><button id="combat-stage-done" type="button">Terminar colocación</button><span id="combat-stage-message" role="status"></span>';
    host.appendChild(tools);
    byId('combat-stage-unit').onchange = event => { state.selected = event.target.value; refresh(); };
    byId('combat-stage-done').onclick = () => setPlacing(false);
    // Capture before legacy menu handlers; supports touch taps and mouse clicks.
    global.document.addEventListener('click', onField, true);
    global.document.addEventListener('keydown', event => {
      if (!state.placing) return;
      if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); setPlacing(false); }
      else if (event.key !== 'Tab' && !event.target.closest?.('#combat-stage-tools, #c073-dm-setup')) event.stopImmediatePropagation();
    }, true);
    global.addEventListener('luminous:combat073-hydrated', refresh);
    global.addEventListener('resize', refresh);
    refresh();
  }
  global.LuminousCombatStage073 = Object.freeze({ version: '0.7.3-stage.1', state, mount, refresh, refreshUnit, camera, setPlacing, place, placementPoint, depthAt, canPlace, patchPlacement });
  mount();
})(window);
