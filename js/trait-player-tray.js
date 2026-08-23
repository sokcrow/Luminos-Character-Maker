(function (global) {
  "use strict";

  const engine = global.LuminousTraitEngine || (typeof require !== "undefined" ? require("./trait-engine.js") : null);
  if (!engine) return;

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

  function useLabel(action) {
    if (action.maximum == null) return "";
    return `${action.remaining}/${action.maximum}`;
  }

  function reasonLabel(action) {
    return (action.reasons || []).join(" ") || "Unavailable";
  }

  function ensureStatusStore(unit) {
    if (!unit || typeof unit !== "object") return null;
    if (!unit.statusEffects || Array.isArray(unit.statusEffects) || typeof unit.statusEffects !== "object") unit.statusEffects = {};
    return unit.statusEffects;
  }

  function applyOutcomeStatus(unit, outcome) {
    if (!unit || !outcome) return;
    const statusEngine = global.LuminousStatusEngine;
    const statusId = engine.normalizeId(outcome.statusId || outcome.status?.id);
    if (!statusId) return;

    if (["apply_status", "rule_status"].includes(engine.normalizeId(outcome.type)) && ["", "gain", "apply", "inflict"].includes(engine.normalizeId(outcome.action || ""))) {
      if (statusEngine?.applyStatus) statusEngine.applyStatus(unit, statusId, { ...(outcome.status || {}), mode: "set" });
      else {
        const store = ensureStatusStore(unit);
        if (store) store[statusId] = { id: statusId, count: 1, potency: 0, ...(outcome.status || {}) };
      }
      return;
    }

    if (["remove_status", "rule_status"].includes(engine.normalizeId(outcome.type)) && (engine.normalizeId(outcome.action || "remove") === "remove") && outcome.protected !== true && outcome.removed !== false) {
      if (statusEngine?.removeStatus) statusEngine.removeStatus(unit, statusId, { from: "self", ignoreProtection: true });
      else {
        const store = ensureStatusStore(unit);
        if (store) delete store[statusId];
      }
    }
  }

  function syncActivationStatuses(result, runtime = {}) {
    if (!result || typeof result !== "object") return result;
    const self = runtime.self || runtime.character || result.runtime?.self || result.runtime?.character || null;
    const target = runtime.target || runtime.defender || result.runtime?.target || result.runtime?.defender || null;

    const visit = (outcome) => {
      if (!outcome || typeof outcome !== "object") return;
      const unit = engine.normalizeId(outcome.target) === "target" ? target : self;
      applyOutcomeStatus(unit, outcome);
      (outcome.outcomes || []).forEach(visit);
    };
    (result.outcomes || []).forEach(visit);
    return result;
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
      this.root = null;
      if (this.host && global.document) this.mount();
    }

    mount() {
      if (!this.host || this.root) return this.root;
      this.root = createElement("section", "luminous-trait-tray");
      this.root.dataset.expanded = this.expanded ? "true" : "false";
      this.host.appendChild(this.root);
      this.render();
      return this.root;
    }

    actions() {
      return engine.listAvailableTraitActions(this.getTraits() || [], this.getRuntime() || {}, this.state);
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
      if (result.available) {
        syncActivationStatuses(result, runtime);
        this.onActivated(result);
      } else this.onBlocked(result);
      this.render();
      return result;
    }

    render() {
      if (!this.root) return;
      this.root.replaceChildren();
      const header = createElement("button", "luminous-trait-tray__toggle", this.title);
      header.type = "button";
      header.setAttribute("aria-expanded", this.expanded ? "true" : "false");
      header.addEventListener("click", () => {
        this.expanded = !this.expanded;
        this.root.dataset.expanded = this.expanded ? "true" : "false";
        this.render();
      });
      this.root.appendChild(header);
      if (!this.expanded) return;

      const list = createElement("div", "luminous-trait-tray__list");
      const actions = this.actions();
      if (!actions.length) {
        list.appendChild(createElement("div", "luminous-trait-tray__empty", "NO ACTIVE TRAIT ACTIONS"));
        this.root.appendChild(list);
        return;
      }

      actions.forEach((action) => {
        const row = createElement("div", `luminous-trait-tray__row${action.available ? "" : " is-disabled"}`);
        const button = createElement("button", "luminous-trait-tray__action");
        button.type = "button";
        button.disabled = !action.available;
        button.title = action.available ? `${action.name} · ${action.actionCost}` : reasonLabel(action);

        const copy = createElement("span", "luminous-trait-tray__copy");
        copy.append(
          createElement("strong", "luminous-trait-tray__name", action.name),
          createElement("small", "luminous-trait-tray__cost", action.actionCost.replaceAll("_", " ").toUpperCase()),
        );
        button.appendChild(copy);
        const uses = useLabel(action);
        if (uses) button.appendChild(createElement("b", "luminous-trait-tray__uses", uses));
        button.addEventListener("click", () => this.activate(action));
        row.appendChild(button);
        if (!action.available) row.appendChild(createElement("small", "luminous-trait-tray__reason", reasonLabel(action)));
        list.appendChild(row);
      });
      this.root.appendChild(list);
    }

    refresh() { this.render(); }
  }

  function mount(options) {
    return new TraitPlayerTray(options);
  }

  const api = Object.freeze({ TraitPlayerTray, mount, syncActivationStatuses });
  global.LuminousTraitPlayerTray = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
