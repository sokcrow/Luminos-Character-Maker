(function (global) {
  "use strict";

  const engine = global.LuminousTraitEngine || (typeof require !== "undefined" ? require("./trait-engine.js") : null);
  if (!engine) return;

  const CATEGORY_ORDER = Object.freeze(["all", "racial", "class", "archetype", "background", "general", "other"]);
  const CATEGORY_LABELS = Object.freeze({
    all: "All",
    racial: "Racial",
    class: "Class",
    archetype: "Archetype",
    background: "Background",
    general: "General",
    other: "Other",
  });

  function resolveHost(host) {
    if (!host) return null;
    if (typeof host === "string") return global.document?.querySelector(host) || null;
    return host;
  }

  function createElement(tag, className, text) {
    const node = global.document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = String(text);
    return node;
  }

  function normalizeId(value) {
    return String(value ?? "").trim().toLowerCase().replace(/\s+/g, "_");
  }

  function titleCaseId(value) {
    return String(value ?? "")
      .trim()
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  function sourceCategory(trait = {}) {
    const source = trait?.source || {};
    const type = normalizeId(source.type || trait.sourceType || trait.category || trait.traitCategory);
    if (["race", "racial", "subrace", "lineage", "ancestry"].includes(type)) return "racial";
    if (["class"].includes(type)) return "class";
    if (["archetype", "subclass", "class_archetype"].includes(type)) return "archetype";
    if (["background", "origin"].includes(type)) return "background";
    if (["general", "general_trait", "feat"].includes(type)) return "general";
    return "other";
  }

  function sourceMeta(trait = {}) {
    const source = trait?.source || {};
    const category = sourceCategory(trait);
    let rawName = "";
    let parentName = "";

    if (category === "racial") {
      rawName = source.raceName || source.subraceName || source.lineageName || source.name || source.raceId || source.subraceId || source.lineageId || source.id;
    } else if (category === "class") {
      rawName = source.className || source.name || source.classId || source.id;
    } else if (category === "archetype") {
      rawName = source.archetypeName || source.subclassName || source.name || source.archetypeId || source.subclassId || source.id;
      parentName = source.className || source.parentClassName || source.classId || source.parentClass || source.parentClassId || "";
    } else if (category === "background") {
      rawName = source.backgroundName || source.name || source.backgroundId || source.id;
    } else if (category === "general") {
      rawName = source.name || source.id;
    } else {
      rawName = source.name || source.id || trait.sourceName || "";
    }

    const sourceName = titleCaseId(rawName);
    const parent = titleCaseId(parentName);
    const level = [
      source.requiredLevel,
      source.requiredClassLevel,
      source.unlockLevel,
      source.milestoneLevel,
      trait.requiredLevel,
      trait.requiredClassLevel,
    ].map((value) => Number(value)).find((value) => Number.isFinite(value) && value > 0) || null;

    let detail = CATEGORY_LABELS[category].toUpperCase();
    if (sourceName) detail += ` • ${sourceName.toUpperCase()}`;
    if (category === "archetype" && parent) detail += ` · ${parent.toUpperCase()}`;
    if (level != null) detail += ` LV.${level}`;

    return { category, label: CATEGORY_LABELS[category], sourceName, parentName: parent, level, detail };
  }

  function useLabel(action) {
    if (action.maximum == null) return "";
    return `${action.remaining}/${action.maximum}`;
  }

  function reasonLabel(action) {
    return (action.reasons || []).join(" ") || "Unavailable";
  }

  function activationLabel(trait = {}) {
    const type = normalizeId(trait?.activation?.type || "passive");
    if (type === "automatic") return "AUTO";
    if (type === "manual") return "MANUAL";
    if (type === "choice") return "CHOICE";
    if (type === "prompt") return "PROMPT";
    return "PASSIVE";
  }

  function contextLabels(trait = {}) {
    const contexts = Array.isArray(trait.contexts) ? trait.contexts : trait.contexts ? [trait.contexts] : [];
    return [...new Set(contexts.map(normalizeId).filter(Boolean))]
      .filter((context) => context !== "any")
      .map((context) => context === "theatre" ? "THEATRE" : context === "combat" ? "COMBAT" : context.toUpperCase());
  }

  function filterTraits(traits = [], filter = "all") {
    const normalizedFilter = CATEGORY_ORDER.includes(normalizeId(filter)) ? normalizeId(filter) : "all";
    const list = Array.isArray(traits) ? traits : [];
    if (normalizedFilter === "all") return list;
    return list.filter((trait) => sourceCategory(trait) === normalizedFilter);
  }

  function ensureStyles() {
    const doc = global.document;
    if (!doc || doc.getElementById("player-trait-tabs-stylesheet")) return;
    const link = doc.createElement("link");
    link.id = "player-trait-tabs-stylesheet";
    link.rel = "stylesheet";
    link.href = "css/player-trait-tabs.css";
    link.dataset.ui = "player-trait-tabs";
    doc.head?.appendChild(link);
  }

  class TraitPlayerTray {
    constructor(options = {}) {
      this.host = resolveHost(options.host);
      this.getTraits = typeof options.getTraits === "function" ? options.getTraits : () => options.traits || [];
      this.getRuntime = typeof options.getRuntime === "function" ? options.getRuntime : () => options.runtime || {};
      this.state = options.state || engine.createState();
      this.onActivated = typeof options.onActivated === "function" ? options.onActivated : () => {};
      this.onBlocked = typeof options.onBlocked === "function" ? options.onBlocked : () => {};
      this.resolveChoice = typeof options.resolveChoice === "function" ? options.resolveChoice : null;
      this.resolveInputs = typeof options.resolveInputs === "function" ? options.resolveInputs : null;
      this.title = options.title || "TRAITS";
      this.expanded = options.expanded !== false;
      this.filter = "all";
      this.root = null;
      this.statsConsole = null;
      ensureStyles();
      if (this.host && global.document) this.mount();
    }

    mount() {
      if (!this.host || this.root) return this.root;
      this.setupStatsTabs();
      this.root = createElement("section", "luminous-trait-tray player-traits-catalog");
      this.root.setAttribute("aria-label", "Character Traits");
      this.host.appendChild(this.root);
      this.render();
      return this.root;
    }

    normalizedTraits() {
      const seen = new Set();
      return (this.getTraits() || [])
        .map((trait) => engine.normalizeTrait(trait))
        .filter((trait) => {
          const id = normalizeId(trait?.id || trait?.name);
          if (!id || seen.has(id)) return false;
          seen.add(id);
          return true;
        })
        .sort((a, b) => {
          const ca = CATEGORY_ORDER.indexOf(sourceCategory(a));
          const cb = CATEGORY_ORDER.indexOf(sourceCategory(b));
          if (ca !== cb) return ca - cb;
          return String(a.name || "").localeCompare(String(b.name || ""));
        });
    }

    actions() {
      return engine.listAvailableTraitActions(this.getTraits() || [], this.getRuntime() || {}, this.state);
    }

    actionMap() {
      return new Map(this.actions().map((action) => [normalizeId(action.traitId), action]));
    }

    async activate(action) {
      const trait = (this.getTraits() || []).map(engine.normalizeTrait).find((entry) => entry.id === action.traitId);
      if (!trait) return null;
      if (!action.available) {
        this.onBlocked(action);
        return { available: false, reasons: action.reasons || [] };
      }

      const runtime = Object.assign({}, this.getRuntime() || {});
      if (action.activationType === engine.ACTIVATION_TYPES.CHOICE && this.resolveChoice) {
        const choice = await this.resolveChoice({ action, trait, runtime, state: this.state });
        if (choice == null) return { available: false, cancelled: true, reasons: ["Choice cancelled."] };
        runtime.choice = choice;
      }
      if (action.inputs?.length && this.resolveInputs) {
        const inputs = await this.resolveInputs({ action, trait, runtime, state: this.state });
        if (inputs == null) return { available: false, cancelled: true, reasons: ["Input cancelled."] };
        runtime.inputs = inputs;
      }

      const result = engine.activateTrait(trait, runtime, this.state);
      if (result.available) this.onActivated(result);
      else this.onBlocked(result);
      this.render();
      return result;
    }

    setStatsView(view) {
      const consoleRoot = this.statsConsole || global.document?.querySelector("#stats-modal .player-ability-console");
      if (!consoleRoot) return false;
      const nextView = view === "traits" ? "traits" : "stats";
      consoleRoot.dataset.playerStatsView = nextView;

      const abilityBar = consoleRoot.querySelector(":scope .player-ability-bar");
      const statContent = consoleRoot.querySelector(":scope .player-stat-content");
      if (abilityBar) abilityBar.hidden = nextView === "traits";
      if (statContent) statContent.hidden = nextView === "traits";
      if (this.host) this.host.hidden = nextView !== "traits";

      consoleRoot.querySelectorAll("[data-player-stats-view]").forEach((button) => {
        const active = button.dataset.playerStatsView === nextView;
        button.classList.toggle("active", active);
        button.classList.toggle("is-active", active);
        button.setAttribute("aria-selected", active ? "true" : "false");
        button.tabIndex = active ? 0 : -1;
      });
      return true;
    }

    setupStatsTabs() {
      const doc = global.document;
      if (!doc || !this.host) return false;
      const consoleRoot = doc.querySelector("#stats-modal .player-ability-console");
      const infoPanel = consoleRoot?.querySelector(".player-stats-information-panel");
      const tabline = infoPanel?.querySelector(".player-stats-tabline");
      if (!consoleRoot || !infoPanel || !tabline) return false;
      this.statsConsole = consoleRoot;

      let tabs = tabline.querySelector(".player-stats-view-tabs");
      if (!tabs) {
        tabline.querySelector(":scope > .player-stats-tab")?.remove();
        tabs = createElement("div", "player-stats-view-tabs");
        tabs.setAttribute("role", "tablist");
        tabs.setAttribute("aria-label", "Character information view");
        [
          ["stats", "Stats"],
          ["traits", "Traits"],
        ].forEach(([view, label], index) => {
          const button = createElement("button", `player-stats-tab player-stats-view-tab${index === 0 ? " active is-active" : ""}`, label);
          button.type = "button";
          button.dataset.playerStatsView = view;
          button.setAttribute("role", "tab");
          button.setAttribute("aria-selected", index === 0 ? "true" : "false");
          button.tabIndex = index === 0 ? 0 : -1;
          button.addEventListener("click", () => this.setStatsView(view));
          button.addEventListener("keydown", (event) => {
            if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
            event.preventDefault();
            const targetView = event.key === "ArrowLeft" || event.key === "Home" ? "stats" : "traits";
            this.setStatsView(targetView);
            tabs.querySelector(`[data-player-stats-view="${targetView}"]`)?.focus();
          });
          tabs.appendChild(button);
        });
        tabline.prepend(tabs);
      }

      if (this.host.parentElement !== infoPanel) infoPanel.appendChild(this.host);
      this.host.classList.add("player-traits-panel");
      const current = consoleRoot.dataset.playerStatsView === "traits" ? "traits" : "stats";
      this.setStatsView(current);
      return true;
    }

    renderFilterBar(container, traits) {
      const counts = Object.fromEntries(CATEGORY_ORDER.map((category) => [category, 0]));
      counts.all = traits.length;
      traits.forEach((trait) => { counts[sourceCategory(trait)] += 1; });
      if (this.filter !== "all" && !counts[this.filter]) this.filter = "all";

      CATEGORY_ORDER.forEach((category) => {
        const button = createElement("button", `player-trait-filter${this.filter === category ? " is-active" : ""}`);
        button.type = "button";
        button.dataset.traitFilter = category;
        button.disabled = category !== "all" && counts[category] === 0;
        button.setAttribute("aria-pressed", this.filter === category ? "true" : "false");
        button.append(
          createElement("span", "player-trait-filter__label", CATEGORY_LABELS[category]),
          createElement("b", "player-trait-filter__count", counts[category]),
        );
        button.addEventListener("click", () => {
          this.filter = category;
          this.render();
        });
        container.appendChild(button);
      });
    }

    renderTraitCard(trait, action) {
      const meta = sourceMeta(trait);
      const card = createElement("article", "player-trait-card");
      card.dataset.traitId = trait.id;
      card.dataset.traitCategory = meta.category;

      const header = createElement("div", "player-trait-card__header");
      const source = createElement("span", `player-trait-source player-trait-source--${meta.category}`, meta.detail);
      const activation = createElement("span", "player-trait-activation", activationLabel(trait));
      header.append(source, activation);

      const name = createElement("h3", "player-trait-card__name", trait.name || trait.id || "Unnamed Trait");
      const description = createElement("p", "player-trait-card__description", trait.description || "No description available.");
      const metaRow = createElement("div", "player-trait-card__meta");
      contextLabels(trait).forEach((context) => metaRow.appendChild(createElement("span", "player-trait-context", context)));
      if (meta.level != null) metaRow.appendChild(createElement("span", "player-trait-context", `LEVEL ${meta.level}`));

      const footer = createElement("div", "player-trait-card__footer");
      if (action) {
        const button = createElement("button", `luminous-trait-tray__action player-trait-use${action.available ? "" : " is-disabled"}`);
        button.type = "button";
        button.disabled = !action.available;
        const cost = String(action.actionCost || "special").replaceAll("_", " ").toUpperCase();
        button.textContent = action.available ? `USE · ${cost}` : "UNAVAILABLE";
        button.title = action.available ? `${action.name} · ${cost}` : reasonLabel(action);
        button.addEventListener("click", () => this.activate(action));
        footer.appendChild(button);
        const uses = useLabel(action);
        if (uses) footer.appendChild(createElement("b", "luminous-trait-tray__uses", uses));
        if (!action.available) footer.appendChild(createElement("small", "luminous-trait-tray__reason", reasonLabel(action)));
      } else {
        const passiveCopy = activationLabel(trait) === "PASSIVE"
          ? "Always applied when its conditions are met."
          : activationLabel(trait) === "AUTO"
            ? "Activates automatically when its trigger is met."
            : "No manual action is currently available.";
        footer.appendChild(createElement("small", "player-trait-card__passive", passiveCopy));
      }

      card.append(header, name, description);
      if (metaRow.childElementCount) card.appendChild(metaRow);
      card.appendChild(footer);
      return card;
    }

    render() {
      if (!this.root) return;
      this.setupStatsTabs();
      this.root.replaceChildren();

      const traits = this.normalizedTraits();
      const actions = this.actionMap();
      const header = createElement("header", "player-traits-catalog__header");
      const titleWrap = createElement("div", "player-traits-catalog__title");
      titleWrap.append(
        createElement("h2", "", this.title),
        createElement("p", "", "Racial, Class, Archetype, Background and General Traits assigned to this character."),
      );
      const total = createElement("div", "player-traits-catalog__total");
      total.append(createElement("strong", "", traits.length), createElement("span", "", "TOTAL"));
      header.append(titleWrap, total);

      const filters = createElement("nav", "player-trait-filters");
      filters.setAttribute("aria-label", "Filter Traits by source");
      this.renderFilterBar(filters, traits);

      const list = createElement("div", "luminous-trait-tray__list player-trait-card-list");
      const visible = filterTraits(traits, this.filter);
      if (!visible.length) {
        list.appendChild(createElement("div", "luminous-trait-tray__empty player-traits-empty", traits.length ? "NO TRAITS IN THIS CATEGORY" : "NO TRAITS ASSIGNED"));
      } else {
        visible.forEach((trait) => list.appendChild(this.renderTraitCard(trait, actions.get(normalizeId(trait.id)))));
      }

      this.root.append(header, filters, list);
    }

    refresh() { this.render(); }
  }

  function mount(options) {
    return new TraitPlayerTray(options);
  }

  ensureStyles();
  const api = Object.freeze({
    TraitPlayerTray,
    mount,
    sourceCategory,
    sourceMeta,
    filterTraits,
    CATEGORY_ORDER,
    CATEGORY_LABELS,
  });
  global.LuminousTraitPlayerTray = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
