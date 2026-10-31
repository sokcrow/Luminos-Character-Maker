(function (global) {
  "use strict";
  const ROOT = "campaña/estado_mundo/vinculos";
  const PUBLIC_ROOT = "campaña/estado_mundo/vinculos_publicados";
  const THRESHOLDS = Object.freeze([10,15,20,30,40,50,65,80,100,125]);
  const text = value => String(value ?? "").trim();
  function safeKey(value) {
    const id = text(value);
    if (!id || /[.#$\[\]\/\u0000-\u001f\u007f]/.test(id)) throw new Error("Identificador de personaje no válido.");
    return id;
  }
  function lines(value) {
    const list = Array.isArray(value) ? value : typeof value === "string" ? value.split("\n") : [];
    return list.map(text).filter(Boolean).slice(0,50);
  }
  function normalizeLink(value = {}) {
    const players = {};
    Object.entries(value.players || {}).forEach(([id, enabled]) => { if (enabled === true) players[safeKey(id)] = true; });
    return { enabled: value.enabled === true, combatant: value.combatant === true,
      description: text(value.description).slice(0,4000), players };
  }
  function normalizeProgress(value = {}) {
    const level = Number(value.nivel ?? value.level ?? 0), points = Number(value.puntos ?? value.affinity ?? 0);
    return { conocido: Boolean(value.conocido ?? value.known ?? false),
      nivel: Number.isFinite(level) ? Math.max(0,Math.min(10,Math.round(level))) : 0,
      puntos: Number.isFinite(points) ? Math.trunc(points) : 0,
      estado: text(value.estado || value.state || "neutral").toLowerCase(),
      notas: text(value.notas ?? value.notes), historia: text(value.historia).slice(0,8000),
      recuerdos: lines(value.recuerdos), beneficios: lines(value.beneficios) };
  }
  function portrait(value) {
    const url = text(value);
    if (!url || /^(https?:\/\/|data:image\/(png|jpeg|webp);base64,)/i.test(url)) return url;
    if (!/^[a-z][a-z0-9+.-]*:/i.test(url) && !url.startsWith("//")) return url;
    return "";
  }
  function publicProfile(actorId, actor, link) {
    return { actorId: safeKey(actorId), name: text(actor.nombre || actor.name), title: text(actor.titulo),
      portrait: portrait(actor.sprite || actor.icono), description: link.description,
      combatant: link.combatant, enabled: true };
  }
  // Called inside the actor save: actor + visibility + identity unlock commit in one RTDB update.
  function publicationUpdates(actorId, previousActor, nextActor, players = {}) {
    const id = safeKey(actorId), before = normalizeLink(previousActor?.socialLink), after = normalizeLink(nextActor?.socialLink);
    if ((nextActor?.tipo === "Jugador" || nextActor?.vinculo_jugador) && after.enabled) {
      throw new Error("Social Link se configura en NPCs. Desvincula primero el personaje de jugador.");
    }
    const updates = {};
    const recipients = new Set([...Object.keys(before.players), ...Object.keys(after.players)]);
    for (const playerId of recipients) {
      if (after.enabled && after.players[playerId] && Object.prototype.hasOwnProperty.call(players,playerId)) {
        updates[`${PUBLIC_ROOT}/${playerId}/${id}`] = publicProfile(id, nextActor, after);
        if (!before.enabled || !before.players[playerId]) {
          updates[`${ROOT}/${playerId}/${id}/conocido`] = true;
          updates[`campaña/teatro/conocimiento_identidad/${playerId}/${id}/known`] = true;
          updates[`campaña/teatro/conocimiento_identidad/${playerId}/${id}/conocida`] = true;
        }
      } else updates[`${PUBLIC_ROOT}/${playerId}/${id}`] = null;
    }
    for (const playerId of Object.keys(after.players)) {
      if (!Object.prototype.hasOwnProperty.call(players,playerId)) throw new Error("Uno de los jugadores seleccionados ya no está disponible.");
    }
    return updates;
  }
  function playerView(profile, progress) {
    if (profile?.enabled !== true || !text(profile.name)) return null;
    const bond = normalizeProgress(progress);
    // DM notes are deliberately absent from the player view model.
    return { name:text(profile.name), title:text(profile.title), portrait:portrait(profile.portrait),
      description:text(profile.description), combatant:profile.combatant === true,
      rank:bond.nivel, affinity:bond.puntos, threshold:THRESHOLDS[bond.nivel] ?? null,
      story:bond.historia, memories:bond.recuerdos, benefits:bond.beneficios };
  }
  const api = Object.freeze({ROOT,PUBLIC_ROOT,THRESHOLDS,safeKey,lines,normalizeLink,normalizeProgress,publicationUpdates,playerView});
  global.LuminousSocialLinkCore = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
