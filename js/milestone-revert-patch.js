(function (global) {
  "use strict";
  if (global.LuminousMilestoneRevertPatch) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousMilestoneRevertPatch;
    return;
  }

  const doc = global.document || null;
  const PLAYER_ROOT = "campaña/jugadores";
  const normalizeId = (value) => String(value ?? "").trim().toLowerCase().replace(/\s+/g, "_");
  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
  const integerOr = (value, fallback = 0) => Number.isFinite(Number.parseInt(value, 10)) ? Number.parseInt(value, 10) : fallback;

  function canonicalStatKey(value) {
    const api = global.LuminousClassMilestones;
    if (api?.canonicalStatKey) return api.canonicalStatKey(value);
    return ({
      str: "fuerza", strength: "fuerza", fuerza: "fuerza",
      dex: "destreza", dexterity: "destreza", destreza: "destreza",
      con: "constitucion", constitution: "constitucion", constitucion: "constitucion",
      int: "inteligencia", intelligence: "inteligencia", inteligencia: "inteligencia",
      wis: "sabiduria", wisdom: "sabiduria", sabiduria: "sabiduria",
      cha: "carisma", charisma: "carisma", carisma: "carisma",
    })[normalizeId(value)] || null;
  }

  function milestoneChoiceAt(player, classId, level) {
    const api = global.LuminousClassMilestones;
    if (api?.mergeMilestoneChoices && api?.choiceAt) {
      try {
        // Read legacy top-level AND canonical claims; fail closed on conflicts.
        return api.choiceAt(api.mergeMilestoneChoices(player), classId, level);
      } catch (_) {
        return null;
      }
    }
    const store = player?.characterBuild?.classMilestones || player?.classMilestones || {};
    const cid = normalizeId(classId), milestoneLevel = integerOr(level, 0);
    return store?.[cid]?.[String(milestoneLevel)] || store?.[`${cid}:${milestoneLevel}`] || null;
  }

  function normalizedChoiceSignature(choice = {}) {
    const type = normalizeId(choice.type || choice.choiceType || choice.mode);
    if (["trait", "general_trait", "generaltrait"].includes(type)) {
      return JSON.stringify({ type: "trait", traitId: normalizeId(choice.traitId || choice.generalTraitId || choice.id), selectedAt: choice.selectedAt ?? null });
    }
    const allocation = {};
    Object.entries(choice.allocation || choice.stats || choice.statAllocation || {})
      .map(([stat, amount]) => [canonicalStatKey(stat), integerOr(amount, 0)])
      .filter(([stat, amount]) => stat && amount > 0)
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([stat, amount]) => { allocation[stat] = amount; });
    return JSON.stringify({ type: ["stats", "stat"].includes(type) ? "stats" : type, allocation, selectedAt: choice.selectedAt ?? null });
  }

  function sameMilestoneChoice(left, right) {
    return Boolean(left && right) && normalizedChoiceSignature(left) === normalizedChoiceSignature(right);
  }

  function milestoneRevertSummary(choice = {}) {
    const type = normalizeId(choice.type || choice.choiceType || choice.mode);
    if (["trait", "general_trait", "generaltrait"].includes(type)) return `Trait General · ${choice.traitId || choice.generalTraitId || choice.id || "Trait"}`;
    const allocation = choice.allocation || choice.stats || choice.statAllocation || {};
    const codes = { fuerza: "STR", destreza: "DEX", constitucion: "CON", inteligencia: "INT", sabiduria: "WIS", carisma: "CHA" };
    return Object.entries(allocation).map(([stat, amount]) => `+${integerOr(amount, 0)} ${codes[canonicalStatKey(stat)] || String(stat).toUpperCase()}`).join(" · ") || "Milestone";
  }

  function removeMilestoneChoice(store, classId, level) {
    const cid = normalizeId(classId), milestoneLevel = integerOr(level, 0);
    if (!store || typeof store !== "object") return;
    if (Array.isArray(store)) {
      for (let index = store.length - 1; index >= 0; index -= 1) {
        const entry = store[index];
        if (normalizeId(entry?.classId) === cid && integerOr(entry?.milestoneLevel ?? entry?.level, 0) === milestoneLevel) store.splice(index, 1);
      }
      return;
    }
    delete store[`${cid}:${milestoneLevel}`];
    if (store[cid] && typeof store[cid] === "object") {
      delete store[cid][String(milestoneLevel)];
      if (!Object.keys(store[cid]).length) delete store[cid];
    }
  }

  function revertMilestoneState(player, classId, level) {
    const current = clone(player);
    if (!current || typeof current !== "object") return { valid: false, error: "El jugador ya no existe." };
    const api = global.LuminousClassMilestones;
    let canonical;
    try {
      canonical = api?.mergeMilestoneChoices
        ? api.mergeMilestoneChoices(current)
        : clone(current?.characterBuild?.classMilestones || current?.classMilestones || {});
    } catch (error) {
      return { valid: false, error: error?.message || "Los Milestones existentes tienen datos incompatibles." };
    }
    const choice = api?.choiceAt?.(canonical, classId, level) || milestoneChoiceAt(current, classId, level);
    if (!choice) return { valid: false, error: "Ese milestone ya no está reclamado." };
    const type = normalizeId(choice.type || choice.choiceType || choice.mode);
    if (["stats", "stat"].includes(type)) {
      const allocation = choice.allocation || choice.stats || choice.statAllocation || {};
      if (!current.stats || typeof current.stats !== "object") return { valid: false, error: "No hay Stats persistidos para revertir este milestone." };
      const entries = Object.entries(allocation);
      if (!entries.length) return { valid: false, error: "El allocation guardado del milestone no es válido." };
      for (const [rawStat, rawAmount] of entries) {
        const stat = canonicalStatKey(rawStat), amount = integerOr(rawAmount, 0);
        if (!stat || amount <= 0) return { valid: false, error: "El allocation guardado del milestone no es válido." };
        const existingKey = Object.keys(current.stats).find((key) => canonicalStatKey(key) === stat) || stat;
        const before = Number(current.stats[existingKey]);
        if (!Number.isFinite(before) || !Number.isInteger(before)) return { valid: false, error: `${stat} no tiene un valor entero persistido.` };
        const after = before - amount;
        if (after < 1) return { valid: false, error: `No se puede revertir ${stat}: el resultado sería menor que 1.` };
        current.stats[existingKey] = after;
        // DM Studio reads baseStats preferentially and recreates stats from
        // that source. Undo the base increase as well or the bonus returns.
        if (current.baseStats && typeof current.baseStats === "object" && !Array.isArray(current.baseStats)) {
          const baseKey = Object.keys(current.baseStats).find((key) => canonicalStatKey(key) === stat);
          const storedBase = baseKey ? current.baseStats[baseKey] : undefined;
          const beforeBase = Number(storedBase);
          if (storedBase == null || String(storedBase).trim() === "" || !Number.isInteger(beforeBase)) {
            return { valid: false, error: `No se puede revertir ${stat}: el Stat base no es válido.` };
          }
          if (beforeBase - amount < 1) {
            return { valid: false, error: `No se puede revertir ${stat}: el Stat base quedaría menor que 1.` };
          }
          current.baseStats[stat] = beforeBase - amount;
          if (baseKey !== stat && baseKey) delete current.baseStats[baseKey];
        }
      }
    } else if (!["trait", "general_trait", "generaltrait"].includes(type)) {
      return { valid: false, error: "El tipo de milestone guardado no es compatible con reversión." };
    }
    current.characterBuild = current.characterBuild && typeof current.characterBuild === "object" ? current.characterBuild : {};
    current.characterBuild.classMilestones = canonical;
    removeMilestoneChoice(current.characterBuild.classMilestones, classId, level);
    // Other legacy claims were preserved in the canonical map; do not leave
    // duplicate shadow entries that would resurrect a reverted reward.
    delete current.classMilestones;
    return { valid: true, player: current, choice: clone(choice), summary: milestoneRevertSummary(choice) };
  }

  function feedback(message, kind = "") {
    const node = doc?.getElementById("dm-player-milestone-feedback");
    if (!node) return;
    node.textContent = message || "";
    node.dataset.kind = kind;
  }

  async function revertMilestone(classId, level, button) {
    if (!global.firebase?.database || !global.firebase?.apps?.length) return false;
    const playerId = String(doc?.getElementById("dm-player-dnd-select")?.value || "").trim();
    if (!playerId) return false;
    const ref = global.firebase.database().ref(`${PLAYER_ROOT}/${playerId}`);
    let snapshot;
    try {
      snapshot = await ref.once("value");
    } catch (_) {
      feedback("ERROR AL LEER EL MILESTONE.", "error");
      return false;
    }
    const confirmedChoice = milestoneChoiceAt(snapshot.val(), classId, level);
    if (!confirmedChoice) {
      feedback("Ese milestone ya no está reclamado.", "error");
      return false;
    }
    const summary = milestoneRevertSummary(confirmedChoice);
    if (global.confirm?.(`Revertir Milestone LV.${level}\n\nSe retirará: ${summary}\nEl milestone volverá a estar disponible.`) === false) return false;

    let abortReason = "No se pudo revertir el milestone.";
    if (button) button.disabled = true;
    feedback("REVIRTIENDO MILESTONE...", "pending");
    try {
      const result = await ref.transaction((current) => {
        const latestChoice = milestoneChoiceAt(current, classId, level);
        if (!sameMilestoneChoice(confirmedChoice, latestChoice)) {
          abortReason = "El milestone cambió mientras se confirmaba. No se revirtió nada; revisa la elección actual.";
          return;
        }
        const reverted = revertMilestoneState(current, classId, level);
        if (!reverted.valid) {
          abortReason = reverted.error;
          return;
        }
        return reverted.player;
      });
      if (!result.committed) {
        feedback(abortReason, "error");
        return false;
      }
      feedback(`MILESTONE REVERTIDO · ${summary}`, "success");
      global.LuminousDmPlayerClassMilestones?.render?.();
      return true;
    } catch (error) {
      console.error("No se pudo revertir Class Milestone:", error);
      feedback("ERROR AL REVERTIR EL MILESTONE.", "error");
      return false;
    } finally {
      if (button) button.disabled = false;
    }
  }

  function ensureStyles() {
    if (!doc || doc.getElementById("milestone-revert-patch-style")) return;
    const style = doc.createElement("style");
    style.id = "milestone-revert-patch-style";
    style.textContent = `.dm-player-milestone-revert{margin-top:8px;padding:7px 10px;border:1px solid rgba(255,120,120,.65);background:rgba(90,15,15,.25);color:#ffd7d7;font-weight:800;letter-spacing:.04em;cursor:pointer}.dm-player-milestone-revert:hover{background:rgba(120,20,20,.38)}.dm-player-milestone-revert:disabled{opacity:.5;cursor:wait}`;
    doc.head?.appendChild(style);
  }

  function enhanceMilestoneRows() {
    if (!doc || !global.firebase?.database || !global.firebase?.apps?.length) return false;
    let enhanced = false;
    doc.querySelectorAll("#dm-player-milestone-list .dm-player-milestone-row.is-complete").forEach((row) => {
      if (row.querySelector(".dm-player-milestone-revert")) return;
      const classId = normalizeId(row.dataset.classId), level = integerOr(row.dataset.milestoneLevel, 0);
      if (!classId || !level) return;
      const button = doc.createElement("button");
      button.type = "button";
      button.className = "dm-player-milestone-revert";
      button.textContent = "REVERTIR MILESTONE";
      button.title = "Retira exactamente la mejora guardada y vuelve a habilitar este milestone.";
      button.addEventListener("click", () => { void revertMilestone(classId, level, button); });
      row.appendChild(button);
      enhanced = true;
    });
    return enhanced;
  }

  function tick() {
    ensureStyles();
    enhanceMilestoneRows();
  }

  function boot() {
    tick();
    ["luminous:player-data", "luminous:traits-refreshed", "luminous:class-runtime-loaded", "luminous:class-runtimes-ready"]
      .forEach((name) => global.addEventListener?.(name, tick));
    if (doc.body) {
      let scheduled = false;
      new MutationObserver(() => {
        if (scheduled) return;
        scheduled = true;
        global.queueMicrotask?.(() => {
          scheduled = false;
          tick();
        });
      }).observe(doc.body, { childList: true, subtree: true });
    }
  }

  const api = Object.freeze({
    canonicalStatKey,
    milestoneChoiceAt,
    normalizedChoiceSignature,
    sameMilestoneChoice,
    milestoneRevertSummary,
    revertMilestoneState,
    enhanceMilestoneRows,
    tick,
  });
  global.LuminousMilestoneRevertPatch = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (doc) {
    if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", boot, { once: true });
    else boot();
  }
})(typeof window !== "undefined" ? window : globalThis);
