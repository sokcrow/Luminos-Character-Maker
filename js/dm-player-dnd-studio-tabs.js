(function (global) {
  "use strict";

  const doc = global.document;
  if (!doc || global.LuminousDmPlayerDndStudioTabs) return;

  const STORAGE_KEY = "luminous.dmPlayerStudio.activeTab";
  const TAB_SPECS = Object.freeze([
    { id: "progression", label: "EXPERIENCIA" },
    { id: "build", label: "CLASE / BUILD" },
    { id: "stats", label: "STATS / SKILLS" },
    { id: "combat", label: "COMBATE" },
    { id: "loadout", label: "LOADOUT" },
  ]);

  const state = { mounted: false, observer: null };

  function directChildren(editor) {
    return Array.from(editor?.children || []);
  }

  function headingKey(node) {
    if (!node?.classList?.contains("dm-player-dnd-section-title")) return "";
    const text = String(node.textContent || "").trim().toUpperCase();
    if (text.includes("CHARACTER BUILD")) return "build";
    if (text.includes("ABILITY SCORES")) return "stats";
    if (text.includes("OFFENSIVE / DEFENSIVE")) return "combat";
    return "";
  }

  function classifyInitialNode(node, current) {
    const key = headingKey(node);
    if (key) return key;
    if (!current && node?.classList?.contains("dm-player-dnd-progression")) return "progression";
    if (!current) return "progression";
    return current;
  }

  function createPanel(id) {
    const panel = doc.createElement("section");
    panel.className = "dm-player-dnd-tab-panel";
    panel.dataset.dmStudioPanel = id;
    panel.hidden = id !== "progression";
    return panel;
  }

  function activeTabId(root) {
    const saved = String(global.localStorage?.getItem?.(STORAGE_KEY) || "").trim();
    if (TAB_SPECS.some((entry) => entry.id === saved)) return saved;
    const active = root?.querySelector?.("[data-dm-studio-tab].is-active")?.dataset?.dmStudioTab;
    return active || "progression";
  }

  function activate(root, tabId) {
    const id = TAB_SPECS.some((entry) => entry.id === tabId) ? tabId : "progression";
    root.querySelectorAll("[data-dm-studio-tab]").forEach((button) => {
      const active = button.dataset.dmStudioTab === id;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-selected", active ? "true" : "false");
      button.tabIndex = active ? 0 : -1;
    });
    root.querySelectorAll("[data-dm-studio-panel]").forEach((panel) => {
      panel.hidden = panel.dataset.dmStudioPanel !== id;
    });
    try { global.localStorage?.setItem?.(STORAGE_KEY, id); } catch (_) {}
    global.dispatchEvent?.(new CustomEvent("luminous:dm-player-studio-tab", { detail: { tabId: id } }));
  }

  function mount() {
    if (state.mounted) return true;
    const editor = doc.getElementById("dm-player-dnd-editor");
    if (!editor || editor.dataset.dmStudioTabbed === "true") {
      if (editor?.dataset.dmStudioTabbed === "true") state.mounted = true;
      return Boolean(editor);
    }

    const original = directChildren(editor);
    if (!original.length) return false;

    const shell = doc.createElement("div");
    shell.className = "dm-player-dnd-tabs-shell";

    const nav = doc.createElement("div");
    nav.className = "dm-player-dnd-tabs";
    nav.setAttribute("role", "tablist");
    nav.setAttribute("aria-label", "Secciones del editor de jugador");

    const panels = Object.fromEntries(TAB_SPECS.map((entry) => [entry.id, createPanel(entry.id)]));
    TAB_SPECS.forEach((entry) => {
      const button = doc.createElement("button");
      button.type = "button";
      button.className = "dm-player-dnd-tab";
      button.dataset.dmStudioTab = entry.id;
      button.setAttribute("role", "tab");
      button.textContent = entry.label;
      button.addEventListener("click", () => activate(shell, entry.id));
      nav.appendChild(button);
    });

    let current = "";
    let saveActions = null;
    original.forEach((node) => {
      if (node?.classList?.contains("dm-player-dnd-actions")) {
        saveActions = node;
        return;
      }
      const next = classifyInitialNode(node, current);
      if (headingKey(node)) current = headingKey(node);
      else if (!current) current = next;
      (panels[next] || panels.progression).appendChild(node);
    });

    const loadoutHost = doc.createElement("div");
    loadoutHost.id = "dm-player-loadout-host";
    loadoutHost.className = "dm-player-loadout-host";
    panels.loadout.appendChild(loadoutHost);

    const body = doc.createElement("div");
    body.className = "dm-player-dnd-tab-body";
    TAB_SPECS.forEach((entry) => body.appendChild(panels[entry.id]));

    editor.replaceChildren(nav, body);
    if (saveActions) {
      saveActions.classList.add("dm-player-dnd-sticky-actions");
      editor.appendChild(saveActions);
    }

    editor.dataset.dmStudioTabbed = "true";
    shell.append(nav, body);
    // editor already owns nav/body; shell is only the activation scope alias.
    // Use the editor itself for querying after composition.
    const active = activeTabId(editor);
    activate(editor, active);
    state.mounted = true;
    global.dispatchEvent?.(new CustomEvent("luminous:dm-player-studio-tabs-ready"));
    return true;
  }

  function boot() {
    if (mount()) return;
    state.observer = new MutationObserver(() => {
      if (mount()) {
        state.observer?.disconnect();
        state.observer = null;
      }
    });
    state.observer.observe(doc.documentElement, { childList: true, subtree: true });
  }

  global.LuminousDmPlayerDndStudioTabs = Object.freeze({
    version: "0.1.0",
    TAB_SPECS,
    mount,
    activate(tabId) {
      const editor = doc.getElementById("dm-player-dnd-editor");
      if (!editor) return false;
      activate(editor, tabId);
      return true;
    },
  });

  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})(typeof window !== "undefined" ? window : globalThis);
