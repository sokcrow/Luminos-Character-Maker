(function (global) {
  "use strict";

  const VERSION = "0.7.4";
  const STYLE_ID = "battle-viewer-progressive-ui-074-style";
  const DM_PANEL_ID = "dm-dashboard";
  const DM_BODY_ID = "dm074-body";
  const DM_TOGGLE_ID = "dm074-collapse";
  const SKILL_PANEL_ID = "bv074-player-skill-planner";

  const state = {
    installed: false,
    observer: null,
    timer: null,
    syncQueued: false,
    dmExpanded: false,
  };

  function playerSkillPlanner() {
    return global.LuminousBattleViewerPlayerSkillPlanner074 || null;
  }

  function shouldShowSkillPlanner() {
    const planner = playerSkillPlanner();
    if (!planner?.currentOwnerContext || !planner?.equippedSkillsFor) return false;
    const context = planner.currentOwnerContext();
    if (!context?.ok || !context?.combatant?.ok) return false;
    return planner.equippedSkillsFor(context.playerId).length > 0;
  }

  function syncSkillPlanner() {
    const panel = global.document?.getElementById?.(SKILL_PANEL_ID);
    if (!panel) return false;
    const shouldShow = shouldShowSkillPlanner();
    const shouldHide = !shouldShow;
    if (Boolean(panel.hidden) !== shouldHide) panel.hidden = shouldHide;
    if (!shouldShow) {
      const planner = playerSkillPlanner();
      if (planner?.state) planner.state.selectedSkillId = null;
    }
    return shouldShow;
  }

  function syncDmPanel() {
    const doc = global.document;
    const panel = doc?.getElementById?.(DM_PANEL_ID);
    const body = doc?.getElementById?.(DM_BODY_ID);
    const toggle = doc?.getElementById?.(DM_TOGGLE_ID);
    if (!panel || !body || !toggle) return false;

    const shouldHide = !state.dmExpanded;
    const toggleText = state.dmExpanded ? "—" : "+";

    // Important: do not rewrite reflected DOM attributes/text when they already
    // match. The progressive UI is driven by a MutationObserver, so redundant
    // writes can create an observer feedback loop in a real browser.
    if (Boolean(body.hidden) !== shouldHide) body.hidden = shouldHide;
    panel.classList?.toggle?.("dm074-compact", shouldHide);
    if (toggle.textContent !== toggleText) toggle.textContent = toggleText;

    if (toggle.dataset?.progressiveUi074Bound !== "1") {
      if (toggle.dataset) toggle.dataset.progressiveUi074Bound = "1";
      const original = typeof toggle.onclick === "function" ? toggle.onclick : null;
      toggle.onclick = function (event) {
        if (original) original.call(this, event);
        state.dmExpanded = !body.hidden;
        panel.classList?.toggle?.("dm074-compact", !state.dmExpanded);
        const nextText = state.dmExpanded ? "—" : "+";
        if (toggle.textContent !== nextText) toggle.textContent = nextText;
      };
    }
    return true;
  }

  function ensureStyle() {
    const doc = global.document;
    if (!doc?.head || doc.getElementById(STYLE_ID)) return false;
    const style = doc.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      #${DM_PANEL_ID}.dm074.dm074-compact{width:230px;max-height:none}
      #${DM_PANEL_ID}.dm074.dm074-compact .dm074-head{border-bottom:0}
      #${SKILL_PANEL_ID}[hidden]{display:none!important}
    `;
    doc.head.appendChild(style);
    return true;
  }

  function sync() {
    ensureStyle();
    syncDmPanel();
    syncSkillPlanner();
    return true;
  }

  function scheduleSync() {
    if (state.syncQueued) return false;
    state.syncQueued = true;
    const run = () => {
      state.syncQueued = false;
      sync();
    };
    if (typeof global.queueMicrotask === "function") global.queueMicrotask(run);
    else if (typeof global.setTimeout === "function") global.setTimeout(run, 0);
    else run();
    return true;
  }

  function install() {
    if (!global.document?.body) return false;
    if (!state.installed) {
      state.installed = true;
      if (typeof global.MutationObserver === "function") {
        state.observer = new global.MutationObserver(() => scheduleSync());
        // We only need to notice console/planner mounts and remounts. Observing
        // `hidden` was unsafe because syncDmPanel itself owns that attribute.
        state.observer.observe(global.document.body, {
          childList: true,
          subtree: true,
        });
      }
      if (typeof global.setInterval === "function") {
        state.timer = global.setInterval(sync, 500);
        state.timer?.unref?.();
      }
    }
    sync();
    return true;
  }

  function stop() {
    state.observer?.disconnect?.();
    state.observer = null;
    if (state.timer && typeof global.clearInterval === "function") global.clearInterval(state.timer);
    state.timer = null;
    state.syncQueued = false;
    state.installed = false;
  }

  function setDmExpanded(expanded) {
    state.dmExpanded = expanded === true;
    syncDmPanel();
    return state.dmExpanded;
  }

  const api = Object.freeze({
    version: VERSION,
    state,
    shouldShowSkillPlanner,
    syncSkillPlanner,
    syncDmPanel,
    setDmExpanded,
    sync,
    scheduleSync,
    install,
    stop,
  });

  global.LuminousBattleViewerProgressiveUi074 = api;
  if (global.document?.body) install();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
