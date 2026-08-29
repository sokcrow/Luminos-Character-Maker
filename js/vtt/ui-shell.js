(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.LuminousVttUiShell = api;
})(typeof window !== 'undefined' ? window : globalThis, function (browserRoot) {
  'use strict';

  const clean = (value) => String(value ?? '').trim();
  const esc = (value) => clean(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  const ICONS = Object.freeze({
    map: '<path d="M4 6.5 9 4l6 2.5L20 4v13.5L15 20l-6-2.5L4 20V6.5Z"/><path d="M9 4v13.5M15 6.5V20"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
    export: '<path d="M12 3v12"/><path d="m7 8 5-5 5 5"/><path d="M5 21h14a2 2 0 0 0 2-2v-4M3 15v4a2 2 0 0 0 2 2"/>',
    select: '<path d="m4 4 7.5 16 2.1-6.4L20 11.5Z"/>',
    wall: '<path d="M3 5h18v14H3z"/><path d="M3 10h18M3 15h18M8 5v5M16 5v5M6 10v5M14 10v5M10 15v4M18 15v4"/>',
    door: '<path d="M5 21V3h12v18"/><path d="M9 21V7h8"/><circle cx="13.5" cy="14" r=".7"/>',
    window: '<rect x="3" y="4" width="18" height="16" rx="1"/><path d="M12 4v16M3 12h18"/>',
    curtain: '<path d="M4 4h16M6 4v16M18 4v16M6 8c3 1 3 3 0 4 3 1 3 3 0 4M18 8c-3 1-3 3 0 4-3 1-3 3 0 4"/>',
    stairs: '<path d="M3 20h5v-4h4v-4h4V8h5"/>',
    opening: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/>',
    balcony: '<path d="M3 18h18M5 18V8M9 18V8M15 18V8M19 18V8M3 8h18"/>',
    light: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.65 17.65l1.42 1.42M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.65 6.35l1.42-1.42"/>',
    interior: '<path d="M3 21V9l9-6 9 6v12"/><path d="M8 21v-7h8v7"/>',
    transformer: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="m13 6-4 7h4l-2 5 5-8h-4Z"/>',
    switch: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M12 8v8M9 9l3-2 3 2M9 15l3 2 3-2"/>',
    erase: '<path d="m3 15 8-10a2 2 0 0 1 3-.2l6 5a2 2 0 0 1 .2 3L14 20H8Z"/><path d="M11 20h10M7 10l8 7"/>',
    eye: '<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
    folder: '<path d="M3 6h7l2 2h9v11H3Z"/><path d="M3 6V4h7l2 2"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.65 17.65l1.42 1.42M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.65 6.35l1.42-1.42"/>',
    moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z"/>',
  });

  const BUTTON_ICON_MAP = Object.freeze({
    'vtt-map-library-toggle': 'map',
    'vtt-actor-library-toggle': 'users',
    'vtt-dm-edit-toggle': 'edit',
    'btn-export-uv': 'export',
    'vtt-view-as-token': 'eye',
  });

  const TOOL_ICON_MAP = Object.freeze({
    select: 'select',
    wall: 'wall',
    door: 'door',
    window: 'window',
    curtain_window: 'curtain',
    erase: 'erase',
    opening: 'opening',
    balcony_edge: 'balcony',
    stairs: 'stairs',
    light: 'light',
    interior: 'interior',
    transformer: 'transformer',
    switch: 'switch',
  });

  function iconMarkup(name, size = 20) {
    const body = ICONS[name] || ICONS.select;
    return `<svg class="vtt-ui-icon" width="${Number(size) || 20}" height="${Number(size) || 20}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;
  }

  function setButtonContent(button, icon, label) {
    if (!button) return false;
    const text = clean(label || button.textContent || button.getAttribute?.('aria-label') || button.id);
    if (button.dataset?.vttShellLabel === text && button.dataset?.vttShellIcon === icon) return false;
    button.innerHTML = `${iconMarkup(icon)}<span class="vtt-ui-button-label">${esc(text)}</span>`;
    button.dataset.vttShellLabel = text;
    button.dataset.vttShellIcon = icon;
    button.setAttribute?.('aria-label', text);
    button.setAttribute?.('title', text);
    return true;
  }

  function rawButtonLabel(button) {
    const remembered = clean(button?.dataset?.vttShellOriginalLabel);
    if (remembered) return remembered;
    const text = clean(button?.textContent || button?.getAttribute?.('aria-label') || '');
    if (button?.dataset) button.dataset.vttShellOriginalLabel = text;
    return text;
  }

  function knownButtonDescriptor(button) {
    if (!button) return null;
    const byId = BUTTON_ICON_MAP[button.id];
    if (byId) {
      let label = clean(button.textContent);
      if (button.id === 'vtt-view-as-token') label = label || 'VIEW AS TOKEN';
      if (button.id === 'vtt-dm-edit-toggle') label = label || 'EDIT MODE';
      return { icon: byId, label };
    }
    const tool = button.dataset?.vttTool || button.dataset?.vttVerticalTool || button.dataset?.lightTool;
    if (!tool) return null;
    return { icon: TOOL_ICON_MAP[tool] || 'select', label: rawButtonLabel(button) || clean(tool).replace(/_/g, ' ').toUpperCase() };
  }

  function factionFromActor(actor = {}) {
    const raw = actor.raw && typeof actor.raw === 'object' ? actor.raw : actor;
    const candidates = [
      actor.factionId,
      actor.factionName,
      raw.factionId,
      raw.faction_id,
      raw.faction,
      raw.faccion,
      raw.affiliation,
      raw.affiliationId,
      raw.organizationId,
      raw.organization,
      raw.organizacion,
      raw.corporation,
    ];
    for (const candidate of candidates) {
      if (candidate && typeof candidate === 'object') {
        const nested = clean(candidate.id || candidate.name || candidate.nombre || candidate.label);
        if (nested) return nested;
      }
      const value = clean(candidate);
      if (value) return value;
    }
    return '';
  }

  function actorFolder(actor = {}) {
    const category = clean(actor.category || actor.actorCategory || 'npc').toLowerCase();
    if (category === 'player') return { id: 'players', label: 'PLAYERS', rank: 0 };
    const faction = factionFromActor(actor);
    if (faction) return { id: `faction:${faction.toLowerCase()}`, label: faction, rank: 1, faction };
    if (category === 'object' || category === 'vehicle') return { id: 'special', label: 'SPECIAL / OBJECTS', rank: 3 };
    return { id: 'independent', label: 'INDEPENDENT', rank: 2 };
  }

  function groupActors(actors = []) {
    const groups = new Map();
    for (const actor of Array.isArray(actors) ? actors : []) {
      const folder = actorFolder(actor);
      if (!groups.has(folder.id)) groups.set(folder.id, { ...folder, actors: [] });
      groups.get(folder.id).actors.push(actor);
    }
    return [...groups.values()]
      .map((group) => ({ ...group, actors: group.actors.slice().sort((a, b) => clean(a.name).localeCompare(clean(b.name))) }))
      .sort((a, b) => a.rank - b.rank || a.label.localeCompare(b.label));
  }

  function defaultVisionConeDeg(viewer = {}) {
    const configured = Number(viewer.visionConeDeg);
    return Number.isFinite(configured) && configured > 0 ? configured : 120;
  }

  function enforceDmEditorView(runtime, mapData) {
    if (!runtime?.bridge?.isDm || !mapData?.dmEditMode?.active) return false;
    mapData.lighting ||= {};
    if (!mapData.lighting.dmPreviewTokenId) return false;
    mapData.lighting.dmPreviewTokenId = null;
    runtime.lighting?.controller?.clearPreview?.();
    return true;
  }

  function installVerticalGuideBridge(runtime, mapData) {
    const renderer = runtime?.engine?.renderer;
    if (!renderer || renderer.__vttUiVerticalGuideBridge || typeof renderer.drawTokens !== 'function') return () => {};
    const original = renderer.drawTokens.bind(renderer);
    const wrapped = function drawTokensWithEditorGuides(zLayer) {
      const result = original(zLayer);
      if (runtime.bridge?.isDm && mapData?.dmEditMode?.active) renderer.drawVerticalPortalGuides?.(zLayer);
      return result;
    };
    renderer.drawTokens = wrapped;
    renderer.__vttUiVerticalGuideBridge = true;
    return () => {
      if (renderer.drawTokens === wrapped) renderer.drawTokens = original;
      try { delete renderer.__vttUiVerticalGuideBridge; } catch (_) { renderer.__vttUiVerticalGuideBridge = false; }
    };
  }

  function injectStyles(doc) {
    if (!doc || doc.getElementById('vtt-ui-shell-style')) return;
    const style = doc.createElement('style');
    style.id = 'vtt-ui-shell-style';
    style.textContent = `
      .vtt-primary-sidebar{position:fixed;left:12px;top:12px;z-index:36000;width:66px;max-height:calc(100vh - 24px);display:flex;flex-direction:column;gap:7px;padding:7px;background:rgba(7,9,11,.95);border:1px solid #59636c;box-shadow:5px 5px 0 rgba(0,0,0,.58);overflow:auto;pointer-events:auto}
      .vtt-primary-sidebar:empty{display:none}.vtt-primary-sidebar .brutalist-button{position:static!important;inset:auto!important;width:52px;min-height:52px;padding:6px 4px!important;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;font-size:9px;line-height:1.05;box-sizing:border-box;text-align:center;white-space:normal}
      .vtt-ui-icon{display:block;flex:0 0 auto}.vtt-ui-button-label{display:block;max-width:100%;overflow-wrap:anywhere}
      .vtt-edit-sidebar{position:fixed;right:12px;top:12px;bottom:12px;z-index:35000;width:184px;display:none;flex-direction:column;gap:10px;padding:8px;background:rgba(7,9,11,.95);border:1px solid #6b5c2e;box-shadow:-5px 5px 0 rgba(0,0,0,.58);overflow-y:auto;pointer-events:auto}
      body.vtt-dm-edit-active .vtt-edit-sidebar{display:flex}.vtt-edit-sidebar .vtt-toolbar,.vtt-edit-sidebar .vtt-light-toolbar{position:static!important;display:flex!important;flex-direction:column!important;align-items:stretch!important;justify-content:flex-start!important;width:100%!important;max-width:none!important;box-sizing:border-box;margin:0!important;padding:7px!important;gap:5px!important}
      .vtt-edit-sidebar .vtt-toolbar-title{display:block;width:100%;padding:3px 2px 6px;color:#d7b151;border-bottom:1px solid #3c4147;margin:0 0 2px;font-size:9px;letter-spacing:.13em}
      .vtt-edit-sidebar .brutalist-button{width:100%;display:grid;grid-template-columns:22px 1fr;align-items:center;gap:7px;padding:7px 8px!important;text-align:left;box-sizing:border-box}.vtt-edit-sidebar .vtt-ui-button-label{text-align:left}
      .vtt-edit-sidebar .vtt-toolbar-field{display:grid;grid-template-columns:1fr;padding:5px 0 0;margin-top:2px;border-left:0;border-top:1px solid #3c4147}.vtt-edit-sidebar .vtt-toolbar-field select{min-width:0;width:100%;box-sizing:border-box}
      .vtt-map-library-toggle,.vtt-actor-library-toggle,.vtt-view-token{position:static!important;left:auto!important;right:auto!important;top:auto!important;bottom:auto!important}
      .vtt-map-library,.vtt-actor-library{left:90px!important;right:auto!important;top:12px!important;max-height:calc(100vh - 24px)!important;z-index:34500!important}
      .vtt-panel{left:auto!important;right:210px!important;top:12px!important;max-height:calc(100vh - 24px);overflow:auto}.vtt-vertical-panel{left:auto!important;right:540px!important;top:12px!important}
      .vtt-light-panel{right:210px!important;top:12px!important;max-height:calc(100vh - 24px)!important}
      .vtt-lighting-status,.vtt-pov-status{display:flex;align-items:center;gap:6px;padding:7px;border:1px solid #46505a;background:#0b0e11;color:#dce3e8;font:10px monospace;line-height:1.25}.vtt-lighting-status strong,.vtt-pov-status strong{color:#d7b151}
      .vtt-actor-folder{border:1px solid #454b51;margin:7px 0;background:#0d1013}.vtt-actor-folder>summary{display:flex;align-items:center;gap:7px;padding:7px;cursor:pointer;color:#d7b151;font-weight:700;letter-spacing:.05em}.vtt-actor-folder-count{margin-left:auto;color:#8d979f;font-weight:400}.vtt-actor-folder-body{padding:0 6px 6px}.vtt-actor-folder .vtt-actor-card{margin:6px 0}
      .vtt-flicker-advanced{border-top:1px solid #4f555a;margin-top:9px;padding-top:7px}.vtt-flicker-advanced legend{padding:0 5px;color:#d7b151;font-size:10px;letter-spacing:.08em}.vtt-flicker-help{display:block;color:#8f9aa2;font-size:9px;line-height:1.35;margin-top:4px}
      @media (max-width:900px){.vtt-primary-sidebar{left:8px;top:8px}.vtt-edit-sidebar{right:8px;top:8px;bottom:8px;width:154px}.vtt-map-library,.vtt-actor-library{left:82px!important}.vtt-panel,.vtt-light-panel{right:178px!important}.vtt-vertical-panel{right:178px!important;top:50%!important}}
    `;
    doc.head.appendChild(style);
  }

  function ensureShell(doc) {
    if (!doc?.body) return {};
    let primary = doc.getElementById('vtt-primary-sidebar');
    if (!primary) {
      primary = doc.createElement('nav');
      primary.id = 'vtt-primary-sidebar';
      primary.className = 'vtt-primary-sidebar';
      primary.setAttribute('aria-label', 'VTT primary tools');
      doc.body.appendChild(primary);
    }
    let edit = doc.getElementById('vtt-edit-sidebar');
    if (!edit) {
      edit = doc.createElement('aside');
      edit.id = 'vtt-edit-sidebar';
      edit.className = 'vtt-edit-sidebar';
      edit.setAttribute('aria-label', 'DM map editing tools');
      doc.body.appendChild(edit);
    }
    return { primary, edit };
  }

  function moveKnownControls(doc, shell) {
    const primaryIds = ['vtt-map-library-toggle', 'vtt-actor-library-toggle', 'vtt-dm-edit-toggle', 'vtt-view-as-token', 'btn-export-uv'];
    primaryIds.forEach((id) => {
      const node = doc.getElementById(id);
      if (node && node.parentNode !== shell.primary) shell.primary.appendChild(node);
    });
    ['vtt-topology-toolbar', 'vtt-vertical-toolbar', 'vtt-lighting-toolbar'].forEach((id) => {
      const node = doc.getElementById(id);
      if (node && node.parentNode !== shell.edit) shell.edit.appendChild(node);
    });
  }

  function decorateButtons(doc) {
    const candidates = doc.querySelectorAll?.('#vtt-primary-sidebar button, #vtt-edit-sidebar button') || [];
    candidates.forEach((button) => {
      const descriptor = knownButtonDescriptor(button);
      if (!descriptor) return;
      setButtonContent(button, descriptor.icon, descriptor.label);
    });
  }

  function closeOtherPrimaryDrawers(doc, exceptId) {
    const ids = ['vtt-map-library-panel', 'vtt-actor-library-panel'];
    ids.forEach((id) => {
      if (id === exceptId) return;
      const panel = doc.getElementById(id);
      if (panel) panel.hidden = true;
    });
  }

  function wireExclusiveDrawers(doc) {
    const pairs = [
      ['vtt-map-library-toggle', 'vtt-map-library-panel'],
      ['vtt-actor-library-toggle', 'vtt-actor-library-panel'],
    ];
    pairs.forEach(([buttonId, panelId]) => {
      const button = doc.getElementById(buttonId);
      if (!button || button.dataset.vttShellDrawerWired) return;
      button.dataset.vttShellDrawerWired = '1';
      button.addEventListener('click', () => {
        if (!doc.getElementById(panelId)?.hidden) closeOtherPrimaryDrawers(doc, panelId);
      });
    });
  }

  function injectLightingStatus(doc, runtime, mapData) {
    const toolbar = doc.getElementById('vtt-lighting-toolbar');
    if (!toolbar) return null;
    let status = doc.getElementById('vtt-lighting-status');
    if (!status) {
      status = doc.createElement('div');
      status.id = 'vtt-lighting-status';
      status.className = 'vtt-lighting-status';
      toolbar.insertBefore(status, toolbar.children?.[1] || null);
    }
    const environment = mapData?.lighting?.environment || {};
    const level = clean(environment?.state?.light || mapData?.ambientLight?.level || 'bright').toUpperCase();
    const isDay = environment?.isDay !== false;
    const source = clean(environment?.source || 'environment').toUpperCase();
    status.innerHTML = `${iconMarkup(isDay ? 'sun' : 'moon', 17)}<span><strong>${isDay ? 'DAY' : 'NIGHT'} · ${esc(level)}</strong><br>${esc(source)}</span>`;
    return status;
  }

  function injectPovStatus(doc, runtime) {
    const primary = doc.getElementById('vtt-primary-sidebar');
    if (!primary) return null;
    let status = doc.getElementById('vtt-pov-status');
    if (!status) {
      status = doc.createElement('div');
      status.id = 'vtt-pov-status';
      status.className = 'vtt-pov-status';
      primary.appendChild(status);
    }
    const viewer = runtime?.pov?.controlledViewers?.()?.[0] || runtime?.lighting?.controlledViewers?.()?.[0] || {};
    const cone = defaultVisionConeDeg(viewer);
    const preview = runtime?.bridge?.isDm && runtime?.engine?.mapData?.lighting?.dmPreviewTokenId;
    status.innerHTML = `${iconMarkup('eye', 16)}<span><strong>${preview ? 'TOKEN VIEW' : runtime?.bridge?.isDm ? 'DM FULL' : 'POV'}</strong><br>${esc(cone)}° CONE</span>`;
    return status;
  }

  function injectFlickerAdvanced(doc, runtime) {
    const panel = doc.getElementById('vtt-light-editor');
    if (!panel || panel.hidden || panel.querySelector('[data-vtt-flicker-advanced]')) return false;
    const selected = runtime?.lighting?.controller?.getSelected?.();
    if (selected?.kind !== 'source') return false;
    const item = selected.item || {};
    const save = panel.querySelector('[data-light-save]');
    if (!save) return false;
    const fieldset = doc.createElement('fieldset');
    fieldset.className = 'vtt-flicker-advanced';
    fieldset.dataset.vttFlickerAdvanced = '1';
    const amount = Number.isFinite(Number(item.flicker?.amount)) ? Number(item.flicker.amount) : 0.08;
    const speed = Number.isFinite(Number(item.flicker?.speed)) ? Number(item.flicker.speed) : 7;
    fieldset.innerHTML = `<legend>FLICKER</legend><div class="row"><label>AMOUNT<input type="number" min="0" max="0.45" step="0.01" data-field="flicker.amount" value="${amount}"></label><label>SPEED<input type="number" min="0.1" max="30" step="0.1" data-field="flicker.speed" value="${speed}"></label></div><small class="vtt-flicker-help">Visual intensity only. It does not toggle mechanical Bright/Dim/Darkness every frame.</small>`;
    panel.insertBefore(fieldset, save);
    return true;
  }

  function groupActorDom(doc, runtime) {
    const listNode = doc.getElementById('vtt-actor-list');
    const bridge = runtime?.actorLibrary?.libraryBridge;
    if (!listNode || !bridge?.list) return false;
    const directCards = [...listNode.children].filter((node) => node.matches?.('[data-actor-key]'));
    if (!directCards.length && listNode.querySelector('.vtt-actor-folder')) return false;
    const cards = [...listNode.querySelectorAll('[data-actor-key]')];
    if (!cards.length) return false;
    const actors = bridge.list();
    const byKey = new Map(actors.map((actor) => [actor.key, actor]));
    const cardsByFolder = new Map();
    cards.forEach((card) => {
      const actor = byKey.get(card.dataset.actorKey) || {};
      const folder = actorFolder(actor);
      if (!cardsByFolder.has(folder.id)) cardsByFolder.set(folder.id, { ...folder, cards: [] });
      cardsByFolder.get(folder.id).cards.push(card);
    });
    const groups = [...cardsByFolder.values()].sort((a, b) => a.rank - b.rank || a.label.localeCompare(b.label));
    listNode.replaceChildren();
    groups.forEach((group, index) => {
      const details = doc.createElement('details');
      details.className = 'vtt-actor-folder';
      details.open = index < 2;
      const summary = doc.createElement('summary');
      summary.innerHTML = `${iconMarkup('folder', 16)}<span>${esc(group.rank === 1 ? `FACTION · ${group.label}` : group.label)}</span><span class="vtt-actor-folder-count">${group.cards.length}</span>`;
      const body = doc.createElement('div');
      body.className = 'vtt-actor-folder-body';
      group.cards.forEach((card) => body.appendChild(card));
      details.append(summary, body);
      listNode.appendChild(details);
    });
    return true;
  }

  function start({ root = browserRoot } = {}) {
    const doc = root?.document;
    if (!doc?.body || root.__luminousVttUiShellStarted) return null;
    root.__luminousVttUiShellStarted = true;
    injectStyles(doc);
    const shell = ensureShell(doc);
    let runtime = root.LuminousVttRuntime || null;
    let mapData = runtime?.engine?.mapData || null;
    let stopVerticalBridge = () => {};
    let rendererWrapped = false;
    let originalRender = null;
    let actorObserver = null;
    let bodyObserver = null;
    let domObserver = null;
    let interval = null;

    function ensureRuntimeHooks() {
      runtime = root.LuminousVttRuntime || runtime;
      mapData = runtime?.engine?.mapData || mapData;
      if (!runtime?.engine || !mapData) return;
      enforceDmEditorView(runtime, mapData);
      if (!runtime.engine.renderer.__vttUiVerticalGuideBridge) {
        stopVerticalBridge = installVerticalGuideBridge(runtime, mapData);
      }
      if (!rendererWrapped && typeof runtime.engine.renderer.render === 'function') {
        const renderer = runtime.engine.renderer;
        originalRender = renderer.render.bind(renderer);
        const wrapped = function vttUiShellRender(...args) {
          enforceDmEditorView(root.LuminousVttRuntime || runtime, mapData);
          return originalRender(...args);
        };
        renderer.render = wrapped;
        rendererWrapped = true;
      }
    }

    function syncDom() {
      runtime = root.LuminousVttRuntime || runtime;
      mapData = runtime?.engine?.mapData || mapData;
      moveKnownControls(doc, shell);
      decorateButtons(doc);
      wireExclusiveDrawers(doc);
      ensureRuntimeHooks();
      if (runtime?.lighting) {
        injectLightingStatus(doc, runtime, mapData);
        injectPovStatus(doc, runtime);
        injectFlickerAdvanced(doc, runtime);
      }
      if (runtime?.actorLibrary) groupActorDom(doc, runtime);
    }

    const editToggle = doc.getElementById('vtt-dm-edit-toggle');
    editToggle?.addEventListener('click', () => root.setTimeout?.(() => {
      runtime = root.LuminousVttRuntime || runtime;
      mapData = runtime?.engine?.mapData || mapData;
      enforceDmEditorView(runtime, mapData);
      syncDom();
    }, 0));

    if (typeof root.MutationObserver === 'function') {
      bodyObserver = new root.MutationObserver(() => {
        if (doc.body.classList.contains('vtt-dm-edit-active')) enforceDmEditorView(root.LuminousVttRuntime || runtime, mapData);
      });
      bodyObserver.observe(doc.body, { attributes: true, attributeFilter: ['class'] });

      domObserver = new root.MutationObserver(() => root.setTimeout?.(syncDom, 0));
      domObserver.observe(doc.body, { childList: true, subtree: true, characterData: true });

      const listNode = doc.getElementById('vtt-actor-list');
      if (listNode) {
        actorObserver = new root.MutationObserver(() => {
          actorObserver.disconnect();
          try { groupActorDom(doc, root.LuminousVttRuntime || runtime); }
          finally { actorObserver.observe(listNode, { childList: true, subtree: true }); }
        });
        actorObserver.observe(listNode, { childList: true, subtree: true });
      }
    }

    interval = root.setInterval?.(syncDom, 500) || null;
    syncDom();

    function stop() {
      if (interval != null) root.clearInterval?.(interval);
      actorObserver?.disconnect?.();
      bodyObserver?.disconnect?.();
      domObserver?.disconnect?.();
      stopVerticalBridge?.();
      if (rendererWrapped && originalRender && runtime?.engine?.renderer) runtime.engine.renderer.render = originalRender;
      doc.getElementById('vtt-ui-shell-style')?.remove?.();
      doc.getElementById('vtt-primary-sidebar')?.remove?.();
      doc.getElementById('vtt-edit-sidebar')?.remove?.();
      root.__luminousVttUiShellStarted = false;
    }

    root.addEventListener?.('beforeunload', stop, { once: true });
    return Object.freeze({ syncDom, stop });
  }

  function autoStart(root = browserRoot) {
    if (!root?.document) return;
    const run = () => start({ root });
    if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', run, { once: true });
    else run();
  }

  autoStart();
  return Object.freeze({
    ICONS,
    iconMarkup,
    setButtonContent,
    knownButtonDescriptor,
    factionFromActor,
    actorFolder,
    groupActors,
    defaultVisionConeDeg,
    enforceDmEditorView,
    installVerticalGuideBridge,
    start,
    autoStart,
  });
});
