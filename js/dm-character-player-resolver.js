(function (global) {
  "use strict";

  const doc = global.document;
  if (!doc) return;

  const ROOTS = ["campaña/base_datos_npcs", "campaña/actores"];

  function normalizedName(value) {
    return String(value || "").trim().toLowerCase();
  }

  function playerDisplayName(playerId, playerData) {
    return String(
      playerData?.characterName ||
      playerData?.character_name ||
      playerData?.nombre ||
      playerId ||
      "",
    ).trim();
  }

  function normalizeActorForLegacyEditor(actorData) {
    const actor = actorData && typeof actorData === "object" ? { ...actorData } : {};
    if (!Array.isArray(actor.etiquetas)) {
      if (typeof actor.etiquetas === "string") {
        actor.etiquetas = actor.etiquetas.split(",").map((tag) => tag.trim()).filter(Boolean);
      } else if (actor.etiquetas && typeof actor.etiquetas === "object") {
        actor.etiquetas = Object.values(actor.etiquetas).map((tag) => String(tag || "").trim()).filter(Boolean);
      } else {
        actor.etiquetas = [];
      }
    }

    if (actor.expresiones && typeof actor.expresiones === "object") {
      actor.expresiones = Object.fromEntries(
        Object.entries(actor.expresiones)
          .map(([name, value]) => [
            name,
            typeof value === "string"
              ? value
              : value?.sprite || value?.url || value?.imagen || value?.image || "",
          ])
          .filter(([, url]) => Boolean(url)),
      );
    }

    return actor;
  }

  function firebaseDb() {
    if (!global.firebase?.database) return null;
    try {
      return global.firebase.database();
    } catch (_) {
      return null;
    }
  }

  async function fetchActorById(db, actorId) {
    if (!db || !actorId || actorId === "ninguno") return null;
    for (const root of ROOTS) {
      const snap = await db.ref(`${root}/${actorId}`).once("value");
      if (snap.exists()) {
        return { actorId, root, actor: normalizeActorForLegacyEditor(snap.val()) };
      }
    }
    return null;
  }

  async function findPlayerRecord(db, displayName) {
    const snap = await db.ref("campaña/jugadores").once("value");
    const players = snap.val() || {};
    const wanted = normalizedName(displayName);

    for (const [playerId, playerData] of Object.entries(players)) {
      if (normalizedName(playerDisplayName(playerId, playerData)) === wanted) {
        return { playerId, playerData: playerData || {} };
      }
    }
    return null;
  }

  async function findActorLinkedToPlayer(db, playerId, playerData, displayName) {
    const acceptedLinks = new Set(
      [playerId, playerData?.id, displayName]
        .filter(Boolean)
        .map((value) => normalizedName(value)),
    );

    for (const root of ROOTS) {
      const snap = await db.ref(root).once("value");
      const actors = snap.val() || {};
      for (const [actorId, rawActor] of Object.entries(actors)) {
        const actor = normalizeActorForLegacyEditor(rawActor);
        const link = normalizedName(actor.vinculo_jugador);
        if (link && acceptedLinks.has(link)) {
          return { actorId, root, actor };
        }
      }
    }
    return null;
  }

  async function resolvePlayerActorFromCard(card) {
    const db = firebaseDb();
    if (!db || !card) return null;

    const displayName = String(
      card.querySelector("h5 span")?.textContent ||
      card.querySelector("h5")?.childNodes?.[0]?.textContent ||
      "",
    ).trim();

    const playerRecord = await findPlayerRecord(db, displayName);
    if (!playerRecord) return null;

    const { playerId, playerData } = playerRecord;
    const selectedActorId = card.querySelector("select")?.value || "";
    const candidates = [selectedActorId, playerData.actorId]
      .filter((value, index, values) => value && value !== "ninguno" && values.indexOf(value) === index);

    for (const actorId of candidates) {
      const direct = await fetchActorById(db, actorId);
      if (direct) return { ...direct, playerId, playerData, displayName };
    }

    const linked = await findActorLinkedToPlayer(db, playerId, playerData, displayName);
    return linked ? { ...linked, playerId, playerData, displayName } : null;
  }

  async function openResolvedPlayerActor(button) {
    const card = button?.closest("#grid-personajes-jugadores .cyber-card");
    if (!card) return false;

    const originalText = button.textContent;
    button.disabled = true;
    button.textContent = "RESOLVIENDO ACTOR...";

    try {
      const resolved = await resolvePlayerActorFromCard(card);
      if (!resolved) {
        global.alert?.("No se encontró una fuente de actor válida para este jugador. Revisa su Vínculo de Almas o crea un perfil de escena.");
        return false;
      }

      const loader = global.loadActorIntoFormInternal;
      if (typeof loader !== "function") {
        global.alert?.("Actor Studio todavía no está disponible. Recarga la Pantalla de DM e inténtalo de nuevo.");
        return false;
      }

      loader(resolved.actorId, resolved.actor);
      return true;
    } catch (error) {
      console.error("[DM Character Resolver] No se pudo resolver el actor del jugador.", error);
      global.alert?.("No se pudo cargar el actor del jugador. Revisa la consola del navegador para el detalle.");
      return false;
    } finally {
      button.disabled = false;
      button.textContent = originalText;
    }
  }

  function bindPlayerEditResolver() {
    if (doc.documentElement.dataset.dmPlayerResolverBound === "true") return;
    doc.documentElement.dataset.dmPlayerResolverBound = "true";

    doc.addEventListener("click", (event) => {
      const button = event.target?.closest?.("#grid-personajes-jugadores .btn-action");
      if (!button) return;
      if (!/editar/i.test(button.textContent || "")) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      openResolvedPlayerActor(button);
    }, true);
  }

  function boot() {
    if (!doc.getElementById("dashboard-actores")) return;
    bindPlayerEditResolver();
  }

  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();

  global.LuminousDmCharacterPlayerResolver = Object.freeze({
    fetchActorById,
    findPlayerRecord,
    findActorLinkedToPlayer,
    resolvePlayerActorFromCard,
    openResolvedPlayerActor,
  });
})(window);
