import './world-object-core.js';
import './world-object-catalog.js';
import './environment-affordance-engine.js';
import './world-object-state.js';
import './world-object-movement-patch.js';
import { attachWorldObjectRenderer } from './world-object-renderer.js';
import { start as startWorldObjectUi } from './world-object-bootstrap.js';

const STYLE_ID = 'vtt-world-object-mainline-style';
const LINK_ID = 'vtt-world-object-stylesheet';

function ensureStyles() {
  if (!document.getElementById(LINK_ID)) {
    const link = document.createElement('link');
    link.id = LINK_ID;
    link.rel = 'stylesheet';
    link.href = 'css/vtt-world-objects.css';
    document.head.appendChild(link);
  }
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    #vtt-object-library{left:auto!important;right:210px!important;top:12px!important;max-height:calc(100vh - 24px)!important;z-index:34500!important}
    #vtt-object-library-toggle.vtt-object-shell-button{position:static!important;inset:auto!important;width:100%;display:grid;grid-template-columns:22px 1fr;align-items:center;gap:7px;text-align:left;box-sizing:border-box}
    #vtt-object-library-toggle .vtt-ui-icon{display:block;flex:0 0 auto}
    .vtt-object-component-fieldset{grid-column:1/-1;border:1px solid #46505a;padding:8px;margin:2px 0 0}.vtt-object-component-fieldset legend{color:#d7b151;font:700 10px monospace;letter-spacing:.08em;padding:0 4px}.vtt-object-component-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px}.vtt-object-component-grid .wide{grid-column:1/-1}.vtt-object-component-grid label{min-width:0}.vtt-object-component-grid input{width:100%;box-sizing:border-box}
    @media(max-width:900px){#vtt-object-library{right:178px!important;max-width:calc(100vw - 196px)!important}}
  `;
  document.head.appendChild(style);
}

function ensureUi() {
  let toggle = document.getElementById('vtt-object-library-toggle');
  if (!toggle) {
    toggle = document.createElement('button');
    toggle.id = 'vtt-object-library-toggle';
    toggle.type = 'button';
    toggle.className = 'brutalist-button vtt-object-toggle';
    toggle.hidden = true;
    toggle.textContent = 'OBJECTS';
    document.getElementById('vtt-ui-container')?.appendChild(toggle) || document.body.appendChild(toggle);
  }

  if (!document.getElementById('vtt-object-library')) {
    const panel = document.createElement('aside');
    panel.id = 'vtt-object-library';
    panel.className = 'vtt-object-library';
    panel.hidden = true;
    panel.setAttribute('aria-label', 'Environment Object Library');
    panel.innerHTML = `
      <header><strong>ENVIRONMENT LIBRARY</strong><small>WORLD OBJECTS</small></header>
      <section class="vtt-object-library-section">
        <input id="vtt-object-search" class="vtt-object-search" type="search" placeholder="SEARCH OBJECT / TAG / CATEGORY">
        <div id="vtt-object-list" class="vtt-object-list"></div>
      </section>
      <section class="vtt-object-library-section">
        <strong>INSTANCE</strong>
        <div id="vtt-object-editor" class="vtt-object-editor"><div class="vtt-object-empty">SELECT AN OBJECT ON THE MAP</div></div>
      </section>
      <section class="vtt-object-library-section">
        <strong>CREATE OBJECT DEFINITION</strong>
        <form id="vtt-object-definition-form" class="vtt-object-definition-form">
          <label class="wide">STABLE ID<input name="id" required placeholder="locker_custom_01"></label>
          <label class="wide">DISPLAY NAME<input name="name" required placeholder="Custom Locker"></label>
          <label>CATEGORY<input name="category" value="custom"></label>
          <label>GLYPH<input name="glyph" value="OBJ"></label>
          <label class="wide">IMAGE PATH / URL<input name="image" placeholder="Assets/Objects/..."></label>
          <label>WIDTH CELLS<input name="width" type="number" min="0.25" step="0.25" value="1"></label>
          <label>HEIGHT CELLS<input name="height" type="number" min="0.25" step="0.25" value="1"></label>
          <label>HEIGHT FT<input name="heightFt" type="number" min="0" step="0.5" value="3"></label>
          <label>WEIGHT KG<input name="weightKg" type="number" min="0" step="1" value="10"></label>
          <label>HP<input name="hp" type="number" min="1" step="1" value="10"></label>
          <label><input name="blocksMovement" type="checkbox" checked> BLOCKS MOVE</label>
          <div class="vtt-object-affordances">
            <label><input name="movable" type="checkbox"> MOVABLE</label>
            <label><input name="pushable" type="checkbox"> PUSHABLE</label>
            <label><input name="breakable" type="checkbox"> BREAKABLE</label>
            <label><input name="climbable" type="checkbox"> CLIMBABLE</label>
            <label><input name="sittable" type="checkbox"> SITTABLE</label>
            <label><input name="hideInside" type="checkbox"> HIDE INSIDE</label>
            <label><input name="cover" type="checkbox"> COVER</label>
            <label><input name="openable" type="checkbox"> OPENABLE</label>
            <label><input name="searchable" type="checkbox"> SEARCHABLE</label>
            <label><input name="lockable" type="checkbox"> LOCKABLE</label>
            <label><input name="usable" type="checkbox"> USABLE</label>
          </div>
          <fieldset class="vtt-object-component-fieldset">
            <legend>WORLD COMPONENTS</legend>
            <div class="vtt-object-component-grid">
              <label class="wide"><input name="componentLight" type="checkbox"> LIGHT EMITTER</label>
              <label>BRIGHT FT<input name="lightBrightFt" type="number" min="0" step="5" value="20"></label>
              <label>DIM +FT<input name="lightDimFt" type="number" min="0" step="5" value="20"></label>
              <label>LIGHT COLOR<input name="lightColor" value="#ffd27a"></label>
              <label>LIGHT CIRCUIT<input name="lightCircuit" placeholder="street"></label>
              <label>ELEVATION +FT<input name="lightElevationOffsetFt" type="number" step="0.5" value="0"></label>
              <label>FLICKER<input name="lightFlicker" type="checkbox"></label>
              <label class="wide"><input name="componentSwitch" type="checkbox"> SWITCH</label>
              <label>SWITCH CIRCUIT<input name="switchCircuit" value="main"></label>
              <label>START STATE<select name="switchState"><option value="on">ON</option><option value="off">OFF</option></select></label>
              <label class="wide"><input name="componentTransformer" type="checkbox"> TRANSFORMER</label>
              <label class="wide">TRANSFORMER CIRCUITS<input name="transformerCircuits" placeholder="street, interior_a"></label>
              <label class="wide"><input name="componentPowerSource" type="checkbox"> POWER SOURCE / GENERATOR</label>
              <label class="wide">POWER CIRCUITS<input name="powerCircuits" placeholder="street"></label>
              <label class="wide"><input name="componentContainer" type="checkbox"> CONTAINER</label>
              <label>CAPACITY<input name="containerCapacity" type="number" min="1" step="1" value="10"></label>
            </div>
          </fieldset>
          <button type="submit" class="wide">SAVE DEFINITION</button>
        </form>
      </section>
    `;
    const contextMenu = document.getElementById('vtt-context-menu');
    if (contextMenu?.parentNode) contextMenu.parentNode.insertBefore(panel, contextMenu);
    else document.body.appendChild(panel);
  }
  return toggle;
}

function decorateAndDockToggle(toggle) {
  if (!toggle) return false;
  const sidebar = document.getElementById('vtt-edit-sidebar');
  if (!sidebar) return false;
  sidebar.appendChild(toggle);
  toggle.classList.add('vtt-object-shell-button');
  toggle.innerHTML = '<svg class="vtt-ui-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9Z"/><path d="m4 7.5 8 4.5 8-4.5M12 12v9"/></svg><span class="vtt-ui-button-label">OBJECTS</span>';
  toggle.setAttribute('aria-label', 'OBJECTS');
  toggle.setAttribute('title', 'OBJECTS');
  return true;
}

function dockWhenReady(toggle) {
  if (decorateAndDockToggle(toggle)) return () => {};
  let attempts = 0;
  const timer = window.setInterval(() => {
    attempts += 1;
    if (decorateAndDockToggle(toggle) || attempts >= 20) window.clearInterval(timer);
  }, 50);
  return () => window.clearInterval(timer);
}

export async function start({ runtime = window.LuminousVttRuntime, mapData = runtime?.engine?.mapData } = {}) {
  if (!runtime?.engine || !mapData) return null;
  if (window.LuminousVttWorldObjectMainline?.api) return window.LuminousVttWorldObjectMainline.api;

  mapData.worldObjects = Array.isArray(mapData.worldObjects) ? mapData.worldObjects : [];
  mapData.worldObjectDefinitions ||= {};
  mapData.worldObjectEditor ||= { selectedId: null };

  ensureStyles();
  const toggle = ensureUi();
  const stopDock = dockWhenReady(toggle);
  const detachRenderer = attachWorldObjectRenderer(runtime.engine, mapData);

  // The canonical VTT runtime is intentionally frozen. The legacy world-object bootstrap
  // receives a mutable facade, then its API is published by replacing the frozen snapshot.
  const facade = { ...runtime };
  const api = await startWorldObjectUi({ runtime: facade, mapData });
  if (!api) {
    stopDock();
    detachRenderer?.();
    return null;
  }

  let stopped = false;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    stopDock();
    api.stop?.();
    detachRenderer?.();
  };
  const publicApi = Object.freeze({ ...api, stop });
  const currentRuntime = window.LuminousVttRuntime || runtime;
  window.LuminousVttRuntime = Object.freeze({ ...currentRuntime, worldObjects: publicApi });

  window.addEventListener('beforeunload', stop, { once: true });
  window.LuminousVttWorldObjectMainline = Object.freeze({ api: publicApi, stop });
  return publicApi;
}