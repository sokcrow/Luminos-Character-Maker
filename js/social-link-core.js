(function (global) {
  "use strict";
  const ROOT = "campaña/estado_mundo/vinculos";
  const PUBLIC_ROOT = "campaña/estado_mundo/vinculos_publicados";
  const THRESHOLDS = Object.freeze([10,15,20,30,40,50,65,80,100,125]);
  const text = value => String(value ?? "").trim();
  // Identidades estables: el nombre visible y el futuro icono no dependen de los números del Tarot.
  const ARCANA = Object.freeze([
    Object.freeze({id:"fool",name:"El Loco"}),
    Object.freeze({id:"magician",name:"El Mago"}),
    Object.freeze({id:"priestess",name:"La Sacerdotisa"}),
    Object.freeze({id:"empress",name:"La Emperatriz"}),
    Object.freeze({id:"emperor",name:"El Emperador"}),
    Object.freeze({id:"hierophant",name:"El Hierofante"}),
    Object.freeze({id:"lovers",name:"Los Enamorados"}),
    Object.freeze({id:"chariot",name:"El Carro"}),
    Object.freeze({id:"justice",name:"La Justicia"}),
    Object.freeze({id:"hermit",name:"El Ermitaño"}),
    Object.freeze({id:"fortune",name:"La Rueda de la Fortuna"}),
    Object.freeze({id:"strength",name:"La Fuerza"}),
    Object.freeze({id:"hanged",name:"El Colgado"}),
    Object.freeze({id:"death",name:"La Muerte"}),
    Object.freeze({id:"temperance",name:"La Templanza"}),
    Object.freeze({id:"devil",name:"El Diablo"}),
    Object.freeze({id:"tower",name:"La Torre"}),
    Object.freeze({id:"star",name:"La Estrella"}),
    Object.freeze({id:"moon",name:"La Luna"}),
    Object.freeze({id:"sun",name:"El Sol"}),
    Object.freeze({id:"judgement",name:"El Juicio"}),
    Object.freeze({id:"world",name:"El Mundo"}),
    Object.freeze({id:"jester",name:"El Bufón"}),
    Object.freeze({id:"councillor",name:"El Consejero"}),
    Object.freeze({id:"apostle",name:"El Apóstol"}),
    Object.freeze({id:"hunger",name:"El Hambre"}),
    Object.freeze({id:"aeon",name:"El Eón"}),
    Object.freeze({id:"universe",name:"El Universo"}),
    Object.freeze({id:"faith",name:"La Fe"}),
    Object.freeze({id:"hope",name:"La Esperanza"}),
  ]);
  const getArcana = id => ARCANA.find(entry => entry.id === text(id)) || null;

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
      arcana: getArcana(value.arcana ?? value.arcanaId)?.id || "",
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
  function publicProgress(value = {}) {
    const bond = normalizeProgress(value);
    return {nivel:bond.nivel,puntos:bond.puntos,historia:bond.historia,recuerdos:bond.recuerdos,beneficios:bond.beneficios};
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
      combatant: link.combatant, arcana: link.arcana, enabled: true };
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
        for (const [key,value] of Object.entries(publicProfile(id,nextActor,after))) {
          updates[`${PUBLIC_ROOT}/${playerId}/${id}/${key}`] = value;
        }
        if (!before.enabled || !before.players[playerId]) {
          updates[`${ROOT}/${playerId}/${id}/conocido`] = true;
          updates[`campaña/teatro/conocimiento_identidad/${playerId}/${id}/known`] = true;
          updates[`campaña/teatro/conocimiento_identidad/${playerId}/${id}/conocida`] = true;
        }
      } else updates[`${PUBLIC_ROOT}/${playerId}/${id}`] = null;
    }
    for (const playerId of Object.keys(after.players)) {
      // Stale saved recipients must not prevent withdrawal or NPC cleanup.
      // A newly selected unknown player still indicates an invalid assignment.
      if (after.enabled && !before.players[playerId] && !Object.prototype.hasOwnProperty.call(players,playerId)) {
        throw new Error("Uno de los jugadores seleccionados ya no está disponible.");
      }
    }
    return updates;
  }
  function playerView(profile, progress = profile?.progress || {}) {
    if (profile?.enabled !== true || !text(profile.name)) return null;
    const bond = normalizeProgress(progress);
    // DM notes are deliberately absent from the player view model.
    return { name:text(profile.name), title:text(profile.title), portrait:portrait(profile.portrait),
      description:text(profile.description), combatant:profile.combatant === true,
      arcana:getArcana(profile.arcana)?.name || "",
      rank:bond.nivel, affinity:bond.puntos, threshold:THRESHOLDS[bond.nivel] ?? null,
      story:bond.historia, memories:bond.recuerdos, benefits:bond.beneficios };
  }
  const api = Object.freeze({ROOT,PUBLIC_ROOT,THRESHOLDS,ARCANA,getArcana,safeKey,lines,normalizeLink,normalizeProgress,publicProgress,publicationUpdates,playerView});
  global.LuminousSocialLinkCore = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
