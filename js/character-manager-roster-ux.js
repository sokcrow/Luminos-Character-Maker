(function (root, factory) {
  const api = factory(root || globalThis);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis, function (global) {
  "use strict";

  const STORAGE_KEY = "luminous.characterManager.rosterUx";

  function clean(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  function normalizeTags(value) {
    if (Array.isArray(value)) return value.map((tag) => clean(String(tag || ""))).filter(Boolean);
    if (typeof value === "string") return value.split(",").map((tag) => tag.trim()).filter(Boolean);
    if (value && typeof value === "object") return Object.values(value).map((tag) => clean(String(tag || ""))).filter(Boolean);
    return [];
  }

  function factionLabel(record) {
    const actor = record?.actor || record || {};
    return clean(actor.faccion || actor.alineamiento) || "SIN FACCIÓN";
  }

  function actorSearchText(record, linkedPlayerLabel) {
    const actor = record?.actor || {};
    return [
      actor.nombre,
      record?.actorId,
      actor.titulo,
      actor.faccion,
      actor.alineamiento,
      actor.tipo,
      ...normalizeTags(actor.etiquetas || actor.tags),
      linkedPlayerLabel,
    ]
      .filter(Boolean)
      .join(" ")
      .toLocaleLowerCase();
  }

  const api = Object.freeze({ normalizeTags, factionLabel, actorSearchText });
  const doc = global?.document;
  const manager = global?.LuminousCharacterManager;
  if (!doc || !manager) return api;
  if (global.LuminousCharacterRosterUx) return global.LuminousCharacterRosterUx;
  global.LuminousCharacterRosterUx = api;

  const state = {
    search: "",
    faction: "",
    groupMode: "type",
    collapsed: new Set(),
    rosterObserver: null,
    managerUnsubscribe: null,
    applying: false,
    timer: null,
  };

  function $(id) { return doc.getElementById(id); }

  function readStoredState() {
    try {
      const parsed = JSON.parse(global.localStorage?.getItem(STORAGE_KEY) || "{}");
      state.faction = clean(parsed.faction);
      state.groupMode = ["type", "faction", "tag"].includes(parsed.groupMode) ? parsed.groupMode : "type";
      state.collapsed = new Set(Array.isArray(parsed.collapsed) ? parsed.collapsed.map(String) : []);
    } catch (_) {}
  }

  function persistState() {
    try {
      global.localStorage?.setItem(STORAGE_KEY, JSON.stringify({
        faction: state.faction,
        groupMode: state.groupMode,
        collapsed: Array.from(state.collapsed),
      }));
    } catch (_) {}
  }

  function playerLabel(record) {
    if (!record?.playerId) return "";
    return manager.getPlayer?.(record.playerId)?.label || "";
  }

  function recordMatches(record) {
    const query = clean(state.search).toLocaleLowerCase();
    const faction = factionLabel(record);
    if (state.groupMode === "faction" && state.faction && faction !== state.faction) return false;
    if (!query) return true;
    return actorSearchText(record, playerLabel(record)).includes(query);
  }

  function allFactions() {
    return [...new Set(manager.listActors().map(factionLabel))]
      .sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }));
  }

  function ensureFactionFilter() {
    const heading = doc.querySelector("#character-manager-studio .cm-roster-heading");
    if (!heading) return null;
    let select = $("character-manager-faction-filter");
    if (!select) {
      select = doc.createElement("select");
      select.id = "character-manager-faction-filter";
      select.className = "cm-faction-filter";
      select.setAttribute("aria-label", "Filtrar roster por facción");
      select.title = "Filtrar por facción";
      select.addEventListener("change", () => {
        state.faction = select.value;
        persistState();
        apply();
      });
      const groupMode = $("character-manager-group-mode");
      if (groupMode?.nextSibling) heading.insertBefore(select, groupMode.nextSibling);
      else heading.insertBefore(select, heading.lastElementChild || null);
    }

    const previous = state.faction;
    select.innerHTML = '<option value="">TODAS</option>';
    allFactions().forEach((faction) => {
      const option = doc.createElement("option");
      option.value = faction;
      option.textContent = faction.toUpperCase();
      select.appendChild(option);
    });
    select.value = Array.from(select.options).some((option) => option.value === previous) ? previous : "";
    state.faction = select.value;
    select.hidden = state.groupMode !== "faction";
    return select;
  }

  function replaceSearchInput() {
    if ($("character-manager-search-ux")) return $("character-manager-search-ux");
    const source = $("character-manager-search");
    if (!source) return null;
    const visible = source.cloneNode(false);
    visible.id = "character-manager-search-ux";
    visible.value = source.value || "";
    visible.setAttribute("aria-label", "Buscar por nombre, facción, tipo, etiqueta o jugador");
    visible.placeholder = "Buscar actor, facción o etiqueta";
    source.value = "";
    source.hidden = true;
    source.setAttribute("aria-hidden", "true");
    source.tabIndex = -1;
    source.parentNode?.appendChild(visible);
    state.search = visible.value;
    visible.addEventListener("input", () => {
      state.search = visible.value;
      apply();
    });
    return visible;
  }

  function groupName(section) {
    return clean(section.querySelector(".cm-roster-group-heading span")?.textContent);
  }

  function installGroupToggle(section) {
    const heading = section.querySelector(".cm-roster-group-heading");
    if (!heading || heading.dataset.rosterUxToggle === "true") return;
    heading.dataset.rosterUxToggle = "true";
    heading.setAttribute("role", "button");
    heading.setAttribute("tabindex", "0");

    const toggle = () => {
      if (state.groupMode !== "faction") return;
      const label = groupName(section);
      if (!label) return;
      if (state.collapsed.has(label)) state.collapsed.delete(label);
      else state.collapsed.add(label);
      persistState();
      apply();
    };
    heading.addEventListener("click", (event) => {
      if (event.target?.closest?.("select, input, button")) return;
      toggle();
    });
    heading.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      toggle();
    });
  }

  function decorateSections() {
    const roster = $("character-manager-roster");
    if (!roster) return;
    roster.querySelectorAll(".cm-roster-group").forEach((section) => {
      installGroupToggle(section);
      const label = groupName(section);
      const entries = Array.from(section.querySelectorAll(".cm-roster-entry"));
      const visible = entries.filter((entry) => entry.dataset.rosterUxMatch !== "false");
      const heading = section.querySelector(".cm-roster-group-heading");
      const count = heading?.querySelector("code");
      if (count) count.textContent = visible.length === entries.length
        ? String(entries.length).padStart(2, "0")
        : `${String(visible.length).padStart(2, "0")}/${String(entries.length).padStart(2, "0")}`;

      const factionAllowed = state.groupMode !== "faction" || !state.faction || label === state.faction.toUpperCase() || factionLabel(manager.getActor(entries[0]?.dataset.actorId)).toUpperCase() === state.faction.toUpperCase();
      const hasMatches = visible.length > 0;
      section.hidden = !factionAllowed || !hasMatches;
      const collapsed = state.groupMode === "faction" && state.collapsed.has(label);
      section.dataset.collapsed = collapsed ? "true" : "false";
      if (heading) {
        heading.setAttribute("aria-expanded", collapsed ? "false" : "true");
        heading.classList.toggle("is-collapsed", collapsed);
      }
    });
  }

  function applyEntryFilter() {
    const roster = $("character-manager-roster");
    if (!roster) return;
    roster.querySelectorAll(".cm-roster-entry").forEach((entry) => {
      const record = manager.getActor(entry.dataset.actorId);
      const matches = Boolean(record && recordMatches(record));
      entry.dataset.rosterUxMatch = matches ? "true" : "false";
      entry.hidden = !matches;
    });
  }

  function apply() {
    if (state.applying) return;
    state.applying = true;
    try {
      const mode = $("character-manager-group-mode")?.value;
      if (["type", "faction", "tag"].includes(mode)) state.groupMode = mode;
      bindGroupMode();
      ensureFactionFilter();
      applyEntryFilter();
      decorateSections();
      const count = $("character-manager-count");
      if (count) {
        const visibleCount = Array.from(doc.querySelectorAll("#character-manager-roster .cm-roster-entry"))
          .filter((entry) => entry.dataset.rosterUxMatch !== "false").length;
        count.textContent = String(visibleCount).padStart(2, "0");
      }
    } finally {
      state.applying = false;
    }
  }

  function scheduleApply() {
    global.clearTimeout(state.timer);
    state.timer = global.setTimeout(() => {
      state.timer = null;
      apply();
    }, 0);
  }

  function observeRoster() {
    const roster = $("character-manager-roster");
    if (!roster || state.rosterObserver) return;
    state.rosterObserver = new MutationObserver(() => {
      if (!state.applying) scheduleApply();
    });
    state.rosterObserver.observe(roster, { childList: true });
  }

  function bindGroupMode() {
    const select = $("character-manager-group-mode");
    if (!select || select.dataset.rosterUxBound === "true") return;
    select.dataset.rosterUxBound = "true";
    if (["type", "faction", "tag"].includes(state.groupMode) && select.value !== state.groupMode) {
      select.value = state.groupMode;
      select.dispatchEvent(new global.Event("change", { bubbles: true }));
    }
    select.addEventListener("change", () => {
      state.groupMode = select.value;
      persistState();
      global.setTimeout(apply, 0);
    });
  }

  function install() {
    if (!$("character-manager-studio") || !$("character-manager-roster")) return false;
    replaceSearchInput();
    bindGroupMode();
    ensureFactionFilter();
    observeRoster();
    apply();
    if (!state.managerUnsubscribe) state.managerUnsubscribe = manager.subscribeActors?.(scheduleApply) || null;
    return true;
  }

  readStoredState();
  if (!install()) {
    const retry = global.setInterval(() => {
      if (install()) global.clearInterval(retry);
    }, 100);
  }
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", install, { once: true });

  return api;
});
