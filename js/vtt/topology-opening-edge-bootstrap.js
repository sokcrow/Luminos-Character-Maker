import './topology-opening-edge.js';

const PANEL_ID = 'vtt-opening-edge-actions';
const STYLE_ID = 'vtt-opening-edge-style';

function labelFor(type) {
  return ({ door:'DOOR', window:'WINDOW', curtain_window:'CURTAIN WINDOW' })[type] || String(type || '').toUpperCase();
}

function ensureUi() {
  const editor = document.getElementById('vtt-topology-editor');
  if (!editor) return null;
  let panel = document.getElementById(PANEL_ID);
  if (panel) return panel;

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    #${PANEL_ID}{display:grid;gap:6px;padding:8px 0;border-top:1px solid #3c4147;border-bottom:1px solid #3c4147;margin:6px 0}
    #${PANEL_ID}[hidden]{display:none}
    #${PANEL_ID} small{font:9px monospace;color:#8d9aa2;line-height:1.35}
    #${PANEL_ID} .vtt-opening-actions{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:4px}
    #${PANEL_ID} button{min-width:0;padding:6px 4px;font-size:9px}
    #${PANEL_ID} [data-opening-restore]{grid-column:1/-1}
  `;
  document.head.appendChild(style);

  panel = document.createElement('section');
  panel.id = PANEL_ID;
  panel.hidden = true;
  panel.innerHTML = `
    <small data-opening-status>OPENING EDGE</small>
    <div class="vtt-opening-actions">
      <button type="button" class="brutalist-button" data-opening-type="door">DOOR</button>
      <button type="button" class="brutalist-button" data-opening-type="window">WINDOW</button>
      <button type="button" class="brutalist-button" data-opening-type="curtain_window">CURTAIN</button>
      <button type="button" class="vtt-danger-button" data-opening-restore hidden>RESTORE WALL</button>
    </div>
  `;
  const deleteButton = document.getElementById('vtt-topology-delete');
  editor.insertBefore(panel, deleteButton || null);
  return panel;
}

export function start({ runtime = window.LuminousVttRuntime, mapData = runtime?.engine?.mapData } = {}) {
  if (!runtime?.controller || !runtime?.bridge || !mapData) return null;
  if (window.LuminousVttOpeningEdgeRuntime?.api) return window.LuminousVttOpeningEdgeRuntime.api;

  const controller = runtime.controller;
  const bridge = runtime.bridge;
  const core = window.LuminousVttOpeningEdge;
  const builder = window.LuminousVttWallBuilder;
  if (!core || !builder) throw new Error('OPENING_EDGE_DEPENDENCY_REQUIRED');
  if (typeof bridge.replaceElement !== 'function') throw new Error('ATOMIC_TOPOLOGY_REPLACE_REQUIRED');

  const panel = controller.isDm ? ensureUi() : null;
  const originalRenderEditor = controller.renderEditor.bind(controller);
  let stopped = false;

  function elementById(id) {
    return (mapData.topology || []).find((entry) => String(entry?.id || '') === String(id || '')) || null;
  }

  async function replaceWithOpening(elementOrId, type) {
    const element = typeof elementOrId === 'object' ? elementOrId : elementById(elementOrId);
    if (!element) throw new Error('ELEMENT_NOT_FOUND');
    const plan = core.replacementPlan(element, type);
    const saved = await bridge.replaceElement(plan.oldId, plan.next);
    controller.selectedId = saved.id;
    controller.handleTopologyChanged?.();
    controller.renderEditor?.();
    controller.notify?.(`${labelFor(saved.type)} INSERTED ON WALL EDGE`, 'success');
    return { ...plan, saved };
  }

  async function restoreOpening(elementOrId) {
    const element = typeof elementOrId === 'object' ? elementOrId : elementById(elementOrId);
    if (!element) throw new Error('ELEMENT_NOT_FOUND');
    const wall = core.restoreWall(element);
    const saved = await bridge.replaceElement(String(element.id), wall);
    controller.selectedId = saved.id;
    controller.handleTopologyChanged?.();
    controller.renderEditor?.();
    controller.notify?.('WALL EDGE RESTORED', 'success');
    return saved;
  }

  async function placeOnElement(rawElement, type) {
    if (!controller.isDm || !controller.editActive?.()) throw new Error('DM_EDIT_MODE_REQUIRED');
    if (!rawElement) throw new Error('WALL_EDGE_REQUIRED');
    if (!core.isUnitWall(rawElement) && !core.isOpening(rawElement)) throw new Error('UNIT_WALL_EDGE_REQUIRED');
    return replaceWithOpening(rawElement, type);
  }

  function renderInspector() {
    if (!panel) return;
    const selected = controller.selectedElement?.();
    const isWall = core.isUnitWall(selected);
    const isOpening = core.isOpening(selected) && Boolean(selected?.openingEdge?.sourceWall);
    panel.hidden = !(controller.editActive?.() && (isWall || isOpening));
    if (panel.hidden) return;

    const status = panel.querySelector('[data-opening-status]');
    const restore = panel.querySelector('[data-opening-restore]');
    if (status) {
      status.textContent = isWall
        ? `UNIT WALL · ${String(selected.wallProfileId || selected.wall?.profileId || 'WALL').toUpperCase()} · REPLACE EDGE`
        : `${labelFor(selected.type)} · SOURCE WALL SAVED`;
    }
    if (restore) restore.hidden = !isOpening;
    panel.querySelectorAll('[data-opening-type]').forEach((button) => {
      button.disabled = isOpening && button.dataset.openingType === selected.type;
    });
  }

  controller.renderEditor = function openingEdgeRenderEditor(...args) {
    const result = originalRenderEditor(...args);
    renderInspector();
    return result;
  };

  panel?.querySelectorAll('[data-opening-type]').forEach((button) => {
    button.addEventListener('click', () => {
      const selected = controller.selectedElement?.();
      if (!selected) return;
      void replaceWithOpening(selected, button.dataset.openingType)
        .catch((error) => controller.notify?.(String(error.message || error), 'error'));
    });
  });

  panel?.querySelector('[data-opening-restore]')?.addEventListener('click', () => {
    const selected = controller.selectedElement?.();
    if (!selected) return;
    void restoreOpening(selected)
      .catch((error) => controller.notify?.(String(error.message || error), 'error'));
  });

  renderInspector();

  function stop() {
    if (stopped) return;
    stopped = true;
    controller.renderEditor = originalRenderEditor;
    panel?.remove();
    document.getElementById(STYLE_ID)?.remove();
  }

  const api = Object.freeze({ core, placeOnElement, replaceWithOpening, restoreOpening, renderInspector, stop });
  window.LuminousVttOpeningEdgeRuntime = Object.freeze({ api, stop });
  window.LuminousVttRuntime = Object.freeze({ ...window.LuminousVttRuntime, openingEdges:api });
  return api;
}
