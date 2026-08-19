(function (global) {
  "use strict";

  const doc = global.document;
  if (!doc) return;

  function normalizeTags(value) {
    if (Array.isArray(value)) {
      return value.map((tag) => String(tag || "").trim()).filter(Boolean);
    }
    if (typeof value === "string") {
      return value.split(",").map((tag) => tag.trim()).filter(Boolean);
    }
    if (value && typeof value === "object") {
      return Object.values(value)
        .flatMap((entry) => normalizeTags(entry))
        .filter(Boolean);
    }
    return [];
  }

  function expressionUrl(value) {
    if (typeof value === "string") return value;
    if (!value || typeof value !== "object") return "";
    return value.sprite || value.url || value.imagen || value.image || "";
  }

  function normalizeExpressions(value) {
    if (!value || typeof value !== "object") return {};
    return Object.fromEntries(
      Object.entries(value)
        .map(([name, entry]) => [name, expressionUrl(entry)])
        .filter(([, url]) => Boolean(url)),
    );
  }

  function normalizeActorForEditor(actorData) {
    const source = actorData && typeof actorData === "object" ? actorData : {};
    return {
      ...source,
      etiquetas: normalizeTags(source.etiquetas),
      expresiones: normalizeExpressions(source.expresiones),
    };
  }

  function ensureEditContext(actorId, actorData) {
    const wrapper = doc.querySelector("#dashboard-actores .actor-studio-wrapper");
    const form = wrapper?.querySelector(".actor-studio-form");
    if (!wrapper || !form) return;

    const actorName = String(
      actorData?.nombre || doc.getElementById("actor-nombre")?.value || actorId || "Actor",
    ).trim();

    wrapper.classList.add("dm-character-editor-active");
    wrapper.dataset.editingActorId = String(actorId || "");

    let context = form.querySelector(".dm-character-edit-context");
    if (!context) {
      context = doc.createElement("div");
      context.className = "dm-character-edit-context";
      const state = doc.getElementById("actor-studio-state");
      if (state?.parentNode) state.parentNode.insertBefore(context, state.nextSibling);
      else form.prepend(context);
    }
    context.textContent = `EDITANDO FUENTE · ${actorName}${actorId ? ` · ${actorId}` : ""}`;

    const title = form.querySelector("h4");
    if (title) title.textContent = "Actor Studio · Editar personaje";

    const stateBanner = doc.getElementById("actor-studio-state");
    if (stateBanner) {
      stateBanner.className = "actor-studio-state state-editing";
      stateBanner.textContent = "EDITANDO";
    }

    const save = doc.getElementById("btn-crear-actor");
    if (save) save.textContent = "GUARDAR CAMBIOS";

    const cancel = doc.getElementById("btn-cancelar-actor");
    if (cancel) cancel.style.display = "block";

    wrapper.scrollIntoView({ behavior: "smooth", block: "start" });
    global.setTimeout(() => {
      doc.getElementById("actor-nombre")?.focus({ preventScroll: true });
    }, 260);
  }

  function clearEditContext() {
    const wrapper = doc.querySelector("#dashboard-actores .actor-studio-wrapper");
    wrapper?.classList.remove("dm-character-editor-active");
    if (wrapper) delete wrapper.dataset.editingActorId;
    wrapper?.querySelector(".dm-character-edit-context")?.remove();

    const title = wrapper?.querySelector(".actor-studio-form h4");
    if (title && !/^Crear Perfil de Escena/i.test(title.textContent || "")) {
      title.textContent = "Actor Studio";
    }
  }

  function populateSafeFallback(actorData) {
    const actor = normalizeActorForEditor(actorData);
    const set = (id, value) => {
      const input = doc.getElementById(id);
      if (input) input.value = value == null ? "" : String(value);
    };

    set("actor-nombre", actor.nombre || "");
    set("actor-titulo", actor.titulo || "");
    set("actor-color-nombre", actor.color_nombre || "#ffffff");
    set("actor-color-titulo", actor.color_titulo || "#c49a00");
    set("actor-escala", actor.escala ?? 1);
    set("actor-icono", actor.icono || "");
    set("actor-sprite", actor.sprite || "");
    set("actor-tipo", actor.tipo || "NPC");
    set("actor-faccion", actor.faccion || "");
    set("actor-vinculo-jugador", actor.vinculo_jugador || "");
    set("actor-etiquetas", actor.etiquetas.join(", "));
    set("actor-sprite-combate", actor.sprite_combate || "");
    set("actor-hp", actor.combat_stats?.hp ?? "");
    set("actor-sp", actor.combat_stats?.sp ?? "");
    set("actor-vel", actor.combat_stats?.velocidad ?? "");
    set("actor-atk", actor.combat_stats?.atk ?? "");
    set("actor-ac", actor.combat_stats?.ac ?? "");

    const combat = doc.getElementById("actor-combatiente");
    if (combat) combat.checked = Boolean(actor.es_combatiente);

    global.togglePlayerLink?.();
    global.toggleCombatProperties?.();
    global.updateActorPreview?.();
  }

  function installEditorWrapper() {
    const original = global.loadActorIntoFormInternal;
    if (typeof original !== "function") return false;
    if (original.__dmCharacterEditorWrapped) return true;

    function wrappedLoadActorIntoForm(actorId, actorData) {
      const normalized = normalizeActorForEditor(actorData);
      try {
        original.call(this, actorId, normalized);
      } catch (error) {
        console.error("[DM Character Editor] Error cargando actor legacy; aplicando fallback seguro.", error);
        populateSafeFallback(normalized);
      } finally {
        ensureEditContext(actorId, normalized);
      }
    }

    wrappedLoadActorIntoForm.__dmCharacterEditorWrapped = true;
    wrappedLoadActorIntoForm.__original = original;
    global.loadActorIntoFormInternal = wrappedLoadActorIntoForm;
    return true;
  }

  function bindEditorReset() {
    const cancel = doc.getElementById("btn-cancelar-actor");
    if (cancel && cancel.dataset.dmEditorResetBound !== "true") {
      cancel.dataset.dmEditorResetBound = "true";
      cancel.addEventListener("click", () => global.setTimeout(clearEditContext, 0));
    }

    const save = doc.getElementById("btn-crear-actor");
    if (save && save.dataset.dmEditorResetBound !== "true") {
      save.dataset.dmEditorResetBound = "true";
      save.addEventListener("click", () => {
        global.setTimeout(() => {
          const state = doc.getElementById("actor-studio-state")?.textContent || "";
          if (!/EDITANDO/i.test(state)) clearEditContext();
        }, 0);
      });
    }
  }

  function installStateFallback() {
    const banner = doc.getElementById("actor-studio-state");
    if (!banner || banner.dataset.dmEditorObserverBound === "true") return;
    banner.dataset.dmEditorObserverBound = "true";

    new MutationObserver(() => {
      if (/EDITANDO/i.test(banner.textContent || "")) {
        ensureEditContext(
          doc.querySelector("#dashboard-actores .actor-studio-wrapper")?.dataset.editingActorId || "",
          { nombre: doc.getElementById("actor-nombre")?.value || "Actor" },
        );
      } else if (/BORRADOR/i.test(banner.textContent || "")) {
        clearEditContext();
      }
    }).observe(banner, { childList: true, characterData: true, subtree: true });
  }

  function boot() {
    if (!doc.getElementById("dashboard-actores")) return;

    bindEditorReset();
    installStateFallback();

    let attempts = 0;
    const timer = global.setInterval(() => {
      attempts += 1;
      if (installEditorWrapper() || attempts >= 80) global.clearInterval(timer);
    }, 50);
  }

  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();

  global.LuminousDmCharacterEditorUx = Object.freeze({
    normalizeTags,
    normalizeExpressions,
    normalizeActorForEditor,
    ensureEditContext,
    clearEditContext,
    installEditorWrapper,
  });
})(window);
