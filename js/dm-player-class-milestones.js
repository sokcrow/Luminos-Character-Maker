(function (global) {
  "use strict";

  const doc = global.document;
  if (!doc || global.LuminousDmPlayerClassMilestones) return;

  const PLAYER_ROOT = "campaña/jugadores";
  const TRAIT_DEFINITIONS_ROOT = "campaña/config/traits/definitions";
  const STAT_OPTIONS = Object.freeze([
    { key: "fuerza", code: "STR", label: "Fuerza" },
    { key: "destreza", code: "DEX", label: "Destreza" },
    { key: "constitucion", code: "CON", label: "Constitución" },
    { key: "inteligencia", code: "INT", label: "Inteligencia" },
    { key: "sabiduria", code: "WIS", label: "Sabiduría" },
    { key: "carisma", code: "CHA", label: "Carisma" },
  ]);

  const state = {
    db: null,
    playerId: null,
    player: null,
    playerRef: null,
    playerListener: null,
    definitions: {},
    definitionsBound: false,
    mounted: false,
  };

  const $ = (id) => doc.getElementById(id);
  const engine = () => global.LuminousClassMilestones || null;
  const buildRules = () => global.LuminousCharacterBuildRules || null;
  const normalizeId = (value) => String(value ?? "").trim().toLowerCase().replace(/\s+/g, "_");

  function element(tag, className, text) {
    const node = doc.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = String(text);
    return node;
  }

  function setFeedback(message, kind = "") {
    const node = $("dm-player-milestone-feedback");
    if (!node) return;
    node.textContent = message || "";
    node.dataset.kind = kind;
  }

  function className(classId) {
    return buildRules()?.getClass?.(classId)?.name || classId;
  }

  function currentFormClasses() {
    const rules = buildRules();
    if (!rules) return [];
    return rules.CLASSES.map((definition) => ({
      classId: definition.id,
      levels: Math.max(0, Number.parseInt($(`dm-player-class-${definition.id}`)?.value, 10) || 0),
    })).filter((entry) => entry.levels > 0);
  }

  function currentFormStats() {
    const stats = {};
    STAT_OPTIONS.forEach((stat) => {
      const value = Number.parseInt($(`dm-player-stat-${stat.code.toLowerCase()}`)?.value, 10);
      if (Number.isFinite(value)) stats[stat.key] = value;
    });
    return stats;
  }

  function currentFormStatRawValues() {
    return Object.fromEntries(STAT_OPTIONS.map((stat) => [stat.key, String($(`dm-player-stat-${stat.code.toLowerCase()}`)?.value ?? "")]));
  }

  function savedClasses(player = state.player) {
    return player?.characterBuild?.classes || player?.classes || player?.classLevels || [];
  }

  function generalTraitDefinitions() {
    const api = engine();
    if (!api) return [];
    const selected = new Set(api.selectedGeneralTraitIds(state.player || {}));
    return Object.entries(state.definitions || {})
      .filter(([, definition]) => api.isGeneralTraitDefinition(definition))
      .map(([id, definition]) => ({ id: normalizeId(definition?.id || id), name: definition?.name || definition?.id || id, definition }))
      .filter((entry) => entry.id && !selected.has(entry.id))
      .sort((a, b) => String(a.name).localeCompare(String(b.name), "es"));
  }

  function choiceLabel(choice) {
    const api = engine();
    if (!api || !choice) return "";
    const normalized = api.normalizeChoice(choice);
    if (normalized.type === "trait") {
      const trait = state.definitions?.[normalized.traitId];
      return `Trait General · ${trait?.name || normalized.traitId}`;
    }
    if (normalized.type === "stats") {
      const parts = Object.entries(normalized.allocation || {}).map(([stat, amount]) => {
        const definition = STAT_OPTIONS.find((entry) => entry.key === stat);
        return `+${amount} ${definition?.code || stat.toUpperCase()}`;
      });
      return parts.join(" · ");
    }
    return "Elección guardada";
  }

  function addStatOptions(select, selected) {
    STAT_OPTIONS.forEach((stat) => {
      const option = element("option", "", `${stat.code} · ${stat.label}`);
      option.value = stat.key;
      option.selected = selected === stat.key;
      select.appendChild(option);
    });
  }

  function createModeSelect(row) {
    const select = element("select", "dm-player-milestone-mode");
    select.setAttribute("aria-label", "Tipo de mejora de milestone");
    [
      ["stats_two", "+2 a un Stat"],
      ["stats_split", "+1 a dos Stats"],
      ["trait", "Trait General"],
    ].forEach(([value, label]) => {
      const option = element("option", "", label);
      option.value = value;
      select.appendChild(option);
    });
    select.addEventListener("change", () => renderChoiceControls(row));
    return select;
  }

  function renderChoiceControls(row) {
    const controls = row.querySelector(".dm-player-milestone-choice-controls");
    const mode = row.querySelector(".dm-player-milestone-mode")?.value || "stats_two";
    if (!controls) return;
    controls.replaceChildren();

    if (mode === "stats_two") {
      const select = element("select", "dm-player-milestone-stat-primary");
      addStatOptions(select);
      controls.appendChild(select);
      return;
    }

    if (mode === "stats_split") {
      const first = element("select", "dm-player-milestone-stat-primary");
      const second = element("select", "dm-player-milestone-stat-secondary");
      addStatOptions(first, "fuerza");
      addStatOptions(second, "destreza");
      controls.append(first, element("span", "dm-player-milestone-plus", "+"), second);
      return;
    }

    const select = element("select", "dm-player-milestone-trait");
    const traits = generalTraitDefinitions();
    if (!traits.length) {
      const option = element("option", "", "— No hay Traits Generales disponibles —");
      option.value = "";
      select.appendChild(option);
      select.disabled = true;
    } else {
      const placeholder = element("option", "", "— Selecciona Trait General —");
      placeholder.value = "";
      select.appendChild(placeholder);
      traits.forEach((trait) => {
        const option = element("option", "", trait.name);
        option.value = trait.id;
        select.appendChild(option);
      });
    }
    controls.appendChild(select);
  }

  function rowChoice(row) {
    const mode = row.querySelector(".dm-player-milestone-mode")?.value;
    if (mode === "trait") return { type: "trait", traitId: row.querySelector(".dm-player-milestone-trait")?.value || "" };
    const first = row.querySelector(".dm-player-milestone-stat-primary")?.value || "";
    if (mode === "stats_split") {
      const second = row.querySelector(".dm-player-milestone-stat-secondary")?.value || "";
      return { type: "stats", allocation: { [first]: 1, [second]: 1 } };
    }
    return { type: "stats", allocation: { [first]: 2 } };
  }

  function isSavedMilestoneEarned(classId, milestoneLevel, player = state.player) {
    return engine()?.earnedMilestones(savedClasses(player)).some((entry) => entry.classId === classId && entry.milestoneLevel === milestoneLevel) || false;
  }

  function createMilestoneRow(milestone) {
    const api = engine();
    const row = element("article", "dm-player-milestone-row");
    row.dataset.classId = milestone.classId;
    row.dataset.milestoneLevel = String(milestone.milestoneLevel);

    const heading = element("div", "dm-player-milestone-row-heading");
    const title = element("strong", "", `${className(milestone.classId)} · LV.${milestone.milestoneLevel}`);
    const saved = isSavedMilestoneEarned(milestone.classId, milestone.milestoneLevel);
    heading.append(title, element("small", saved ? "is-saved" : "is-unsaved", saved ? "NIVEL GUARDADO" : "GUARDA EL BUILD PARA RECLAMAR"));
    row.appendChild(heading);

    const existing = api.choiceAt(state.player?.characterBuild?.classMilestones, milestone.classId, milestone.milestoneLevel);
    if (existing) {
      row.classList.add("is-complete");
      row.appendChild(element("div", "dm-player-milestone-complete", choiceLabel(existing)));
      return row;
    }

    const editor = element("div", "dm-player-milestone-editor");
    const mode = createModeSelect(row);
    const controls = element("div", "dm-player-milestone-choice-controls");
    const apply = element("button", "dm-player-milestone-apply", "APLICAR MILESTONE");
    apply.type = "button";
    apply.disabled = !saved;
    apply.addEventListener("click", () => applyMilestone(row, apply));
    editor.append(mode, controls, apply);
    row.appendChild(editor);
    renderChoiceControls(row);
    return row;
  }

  function render() {
    const list = $("dm-player-milestone-list");
    const api = engine();
    if (!list || !api) return;
    list.replaceChildren();

    if (!state.playerId) {
      list.appendChild(element("p", "dm-player-milestone-empty", "Selecciona un jugador."));
      return;
    }

    const earned = api.earnedMilestones(currentFormClasses());
    if (!earned.length) {
      list.appendChild(element("p", "dm-player-milestone-empty", "Sin milestones disponibles. Se desbloquean por clase en LV.20, 40, 60, 80 y 95."));
      return;
    }

    earned.forEach((milestone) => list.appendChild(createMilestoneRow(milestone)));
  }

  async function applyMilestone(row, button) {
    const api = engine();
    if (!api || !state.db || !state.playerId) return;
    const submittedPlayerId = state.playerId;
    const classId = normalizeId(row.dataset.classId);
    const milestoneLevel = Number.parseInt(row.dataset.milestoneLevel, 10);
    const proposed = rowChoice(row);
    const submittedRawStats = currentFormStatRawValues();
    const submittedSavedStats = api.normalizeStats(state.player?.stats || {});

    if (proposed.type === "trait") {
      const traitId = normalizeId(proposed.traitId);
      const definition = state.definitions?.[traitId];
      if (!definition || !api.isGeneralTraitDefinition(definition)) {
        setFeedback("Ese Trait no pertenece a la categoría General.", "error");
        return;
      }
      if (api.selectedGeneralTraitIds(state.player || {}).includes(traitId)) {
        setFeedback("Ese Trait General ya fue elegido en otro milestone.", "error");
        return;
      }
    } else if (proposed.type === "stats") {
      const formValidation = api.validateChoice(proposed, submittedRawStats);
      if (!formValidation.valid) {
        setFeedback(formValidation.errors.join(" "), "error");
        return;
      }
    }

    button.disabled = true;
    setFeedback("APLICANDO MILESTONE...", "pending");
    const playerRef = state.db.ref(`${PLAYER_ROOT}/${submittedPlayerId}`);
    let abortReason = "No se pudo aplicar el milestone.";
    let resultingStats = null;
    let committedAllocation = null;

    try {
      const result = await playerRef.transaction((current) => {
        if (!current || typeof current !== "object") {
          abortReason = "El jugador ya no existe.";
          return;
        }

        current.characterBuild = current.characterBuild && typeof current.characterBuild === "object" ? current.characterBuild : {};
        const classes = current.characterBuild.classes || current.classes || current.classLevels || [];
        const earned = api.earnedMilestones(classes).some((entry) => entry.classId === classId && entry.milestoneLevel === milestoneLevel);
        if (!earned) {
          abortReason = `Guarda primero ${className(classId)} en nivel ${milestoneLevel} o superior.`;
          return;
        }

        current.characterBuild.classMilestones = current.characterBuild.classMilestones && typeof current.characterBuild.classMilestones === "object"
          ? current.characterBuild.classMilestones
          : {};
        if (api.choiceAt(current.characterBuild.classMilestones, classId, milestoneLevel)) {
          abortReason = "Ese milestone ya fue reclamado.";
          return;
        }

        const validation = api.validateChoice(proposed, current.stats || {});
        if (!validation.valid) {
          abortReason = validation.errors.join(" ");
          return;
        }

        if (validation.choice.type === "trait") {
          const traitId = normalizeId(validation.choice.traitId);
          if (api.selectedGeneralTraitIds(current).includes(traitId)) {
            abortReason = "Ese Trait General ya fue elegido en otro milestone.";
            return;
          }
        }

        if (validation.choice.type === "stats") {
          const applied = api.applyStatAllocation(current.stats || {}, validation.choice.allocation);
          if (!applied.valid) {
            abortReason = applied.errors.join(" ");
            return;
          }
          current.stats = current.stats && typeof current.stats === "object" ? current.stats : {};
          Object.entries(applied.allocation).forEach(([stat]) => { current.stats[stat] = applied.stats[stat]; });
          resultingStats = applied.stats;
          committedAllocation = applied.allocation;
        }

        if (!current.characterBuild.classMilestones[classId] || typeof current.characterBuild.classMilestones[classId] !== "object") {
          current.characterBuild.classMilestones[classId] = {};
        }
        current.characterBuild.classMilestones[classId][String(milestoneLevel)] = {
          classId,
          milestoneLevel,
          ...validation.choice,
          selectedAt: Date.now(),
        };
        return current;
      });

      const samePlayer = state.playerId === submittedPlayerId;
      if (!result.committed) {
        if (samePlayer) {
          setFeedback(abortReason, "error");
          render();
        }
        return;
      }

      let reflectionWarning = "";
      if (resultingStats && committedAllocation && samePlayer) {
        let changedPreview = false;
        Object.entries(committedAllocation).forEach(([statKey, amount]) => {
          const stat = STAT_OPTIONS.find((entry) => entry.key === statKey);
          const input = stat ? $(`dm-player-stat-${stat.code.toLowerCase()}`) : null;
          if (!input) return;

          const submittedValue = Number(submittedRawStats[statKey]);
          const savedValue = Number(submittedSavedStats[statKey]);
          const currentValue = Number(input.value);
          const committedValue = Number(resultingStats[statKey]);
          const changedBeforeSubmit = Number.isFinite(submittedValue) && submittedValue !== savedValue;
          const changedDuringApply = String(input.value) !== submittedRawStats[statKey];
          const alreadyReflectedByFirebase = !changedBeforeSubmit && Number.isFinite(committedValue) && currentValue === committedValue;

          if (alreadyReflectedByFirebase) return;

          if (changedBeforeSubmit) {
            if (changedDuringApply && currentValue !== submittedValue) {
              reflectionWarning = `MILESTONE GUARDADO. ${stat.code} cambió mientras se aplicaba y se conservó tu edición actual; revisa el valor antes de guardar el formulario.`;
              return;
            }
            const mergedValue = submittedValue + Number(amount);
            if (!Number.isFinite(mergedValue) || mergedValue > api.MAX_STAT) {
              reflectionWarning = `MILESTONE GUARDADO. ${stat.code} no se sobrescribió porque la edición local más el milestone supera ${api.MAX_STAT}; revisa el valor antes de guardar el formulario.`;
              return;
            }
            input.value = String(mergedValue);
            changedPreview = true;
            return;
          }

          if (changedDuringApply) {
            reflectionWarning = `MILESTONE GUARDADO. ${stat.code} cambió mientras se aplicaba y se conservó tu edición actual; revisa el valor antes de guardar el formulario.`;
            return;
          }

          if (Number.isFinite(committedValue)) {
            input.value = String(committedValue);
            changedPreview = true;
          }
        });
        if (changedPreview) global.LuminousDmPlayerDndStudio?.updatePreviewFromForm?.();
      }
      if (samePlayer) {
        if (reflectionWarning) setFeedback(reflectionWarning, "warning");
        else setFeedback("MILESTONE APLICADO Y GUARDADO.", "success");
      }
    } catch (error) {
      console.error("No se pudo aplicar Class Milestone:", error);
      if (state.playerId === submittedPlayerId) setFeedback("ERROR AL GUARDAR EL MILESTONE.", "error");
    } finally {
      button.disabled = false;
    }
  }

  function unbindPlayer() {
    if (state.playerRef && state.playerListener) state.playerRef.off("value", state.playerListener);
    state.playerRef = null;
    state.playerListener = null;
    state.player = null;
  }

  function bindPlayer(playerId) {
    const id = String(playerId || "").trim();
    if (id === state.playerId && state.playerRef) return;
    unbindPlayer();
    state.playerId = id || null;
    if (!state.playerId || !state.db) {
      render();
      return;
    }
    state.playerRef = state.db.ref(`${PLAYER_ROOT}/${state.playerId}`);
    state.playerListener = (snapshot) => {
      state.player = snapshot.val() || null;
      render();
    };
    state.playerRef.on("value", state.playerListener);
  }

  function bindDefinitions() {
    if (!state.db || state.definitionsBound) return;
    state.definitionsBound = true;
    state.db.ref(TRAIT_DEFINITIONS_ROOT).on("value", (snapshot) => {
      state.definitions = snapshot.val() || {};
      render();
    });
  }

  function mount() {
    if (state.mounted) return true;
    const anchor = $("dm-player-build-feedback")?.closest?.("section");
    const studio = $("dm-player-dnd-studio");
    if (!anchor || !studio || !engine()) return false;

    const section = element("section", "dm-player-class-milestones");
    section.id = "dm-player-class-milestones";
    const header = element("header", "dm-player-milestone-header");
    const copy = element("div");
    copy.append(element("span", "", "CLASS PROGRESSION / OBLIGATORIO"), element("h5", "", "MILESTONE IMPROVEMENTS · LV.20 / 40 / 60 / 80 / 95"));
    header.appendChild(copy);
    section.append(header, element("p", "dm-player-milestone-rule", "En cada milestone de una clase: +2 a un Stat, +1 a dos Stats diferentes (máximo 20), o 1 Trait General."));
    const list = element("div", "dm-player-milestone-list");
    list.id = "dm-player-milestone-list";
    const feedback = element("div", "dm-player-milestone-feedback");
    feedback.id = "dm-player-milestone-feedback";
    feedback.setAttribute("aria-live", "polite");
    section.append(list, feedback);
    anchor.insertAdjacentElement("afterend", section);

    const playerSelect = $("dm-player-dnd-select");
    playerSelect?.addEventListener("change", () => bindPlayer(playerSelect.value));
    buildRules()?.CLASSES?.forEach((definition) => {
      const input = $(`dm-player-class-${definition.id}`);
      input?.addEventListener("input", render);
      input?.addEventListener("change", render);
    });

    state.mounted = true;
    bindPlayer(playerSelect?.value);
    render();
    return true;
  }

  function connect() {
    if (!global.firebase?.database || !global.firebase?.apps?.length) return false;
    state.db = global.firebase.database();
    bindDefinitions();
    mount();
    return true;
  }

  function boot() {
    if (connect() && mount()) return;
    const retry = global.setInterval(() => {
      if (connect() && mount()) global.clearInterval(retry);
    }, 250);
  }

  global.LuminousDmPlayerClassMilestones = Object.freeze({
    render,
    mount,
    generalTraitDefinitions,
  });

  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})(window);