/* Assigned utility spells use the existing Theatre action/Scene Time pipeline. */
(function (global) {
  'use strict';
  const copy = value => JSON.parse(JSON.stringify(value));
  const clean = value => String(value ?? '').trim();
  const loadout = () => global.LuminousSpellLoadout;
  const runtime = () => global.LuminousSpellcastingRuntime;
  const playerPath = id => `campaña/jugadores/${id}`;
  let deliveryChain = Promise.resolve();
  const state = { busy: false, error: '', playerId: '', player: null };
  const assignedActors = player => global.LuminousTheatreState?.normalizeAssignedActorIds?.(player.actorId ?? player.vinculo_jugador)
    || (Array.isArray(player.actorId) ? player.actorId : [player.actorId || player.vinculo_jugador]).filter(Boolean);

  function spellsFor(player = {}) {
    return (loadout()?.selectedIds(player, 'theater') || []).map(id => loadout().definition(id, 'theater')).filter(Boolean);
  }
  function castingClassesFor(player, spell) {
    const rules = global.LuminousCombatSpellLoadout074;
    return (rules?.castingClassIdsFor(player) || []).filter(id => rules.resolveCastClass(player, spell, id).ok);
  }
  function prepareCast(player, { spellId, actorId, uid, classId = null, description = '' } = {}) {
    if (!uid || clean(player?.uid) !== uid) throw new Error('No se pudo verificar tu personaje.');
    if (!assignedActors(player).map(clean).includes(clean(actorId))) throw new Error('Selecciona un actor asignado a tu personaje.');
    const spell = spellsFor(player).find(row => row.id === loadout().idOf(spellId));
    if (!spell) throw new Error('Este hechizo ya no está asignado para Theater.');
    if (!runtime()?.castSpell) throw new Error('Los hechizos todavía están cargando.');
    const casting = global.LuminousCombatSpellLoadout074?.resolveCastClass(player, spell, classId);
    if (casting?.reason === 'SPELL_CLASS_AMBIGUOUS') throw new Error('Elige la clase con la que lanzarás este hechizo.');
    if (!casting?.ok) throw new Error('Tu personaje no tiene una clase de lanzamiento válida para este hechizo.');
    const character = copy(player);
    const privateMessage = spell.mechanics?.privateCommunication === true;
    const result = runtime().castSpell(character, spell, { classId: casting.classId, actorId,
      // A public casting announcement must never reveal a private Message body.
      message: `Lanza ${spell.nombre || spell.name}${clean(description) && !privateMessage ? `: ${clean(description)}` : '.'}` });
    if (!result.success) throw new Error('No tienes un espacio de conjuro disponible.');
    const message = { ...result.castingAction, actorId, tipo_dialogo: 'actuar',
      nombre: clean(player.characterName || player.nombre || player.name) || 'Jugador',
      icono: player.icono_jugador || player.icono || null, mostrar_identidad: true,
      spellId: spell.id, spellContext: 'theater', spellClassId: casting.classId,
      // Utility effects remain available to the DM with their canonical rules.
      spellEffect: copy(spell.theater || {}), source: 'spellcasting' };
    if (message.mensaje.length > 200) throw new Error('La acción completa debe tener como máximo 200 caracteres.');
    return { character, message, result };
  }

  function flushOutbox(db, playerId, player) {
    deliveryChain = deliveryChain.catch(() => {}).then(async () => {
      for (const [key, entry] of Object.entries(player?.theatreSpellOutbox || {})) {
        if (!(await db.ref(`${playerPath(playerId)}/theatreSpellOutbox/${key}`).once('value')).val()) continue;
        if (!entry?.queuePath?.startsWith('campaña/teatro/') || /[.#$\[\]]/.test(key)) continue;
        const roomKey = global.LuminousSceneTimeCore?.roomKeyFrom(entry.roomId) || clean(entry.roomId || 'default').replace(/[.#$\[\]\/]/g, '_');
        const eventId = `theatre_${roomKey}_${key}`;
        // Durable outbox + one atomic fanout: a failed connection cannot spend
        // the Slot and lose the action, or enqueue the same cast twice on retry.
        await db.ref().update({
          [`${entry.queuePath}/${key}`]: entry.message,
          [`${playerPath(playerId)}/theatreSpellOutbox/${key}`]: null,
          [`campaña/teatro/scene_time_requests/${roomKey}/events/${eventId}`]: {
            schemaVersion: 1, type: 'intervention', source: 'theatre', eventId,
            requesterUid: entry.uid, createdAt: entry.message.createdAt, message: entry.message
          }
        });
      }
    });
    return deliveryChain;
  }

  async function cast({ db, playerId, uid, spellId, actorId, classId = null, description = '', paths, requestId } = {}) {
    if (!db?.ref || !playerId || !uid || !paths?.queue || !paths?.scene) throw new Error('No se pudo conectar con Theater.');
    const scene = (await db.ref(paths.scene).once('value')).val();
    if (scene?.transitioning) throw new Error('Espera a que termine el cambio de escena.');
    const sceneTime = global.LuminousSceneTimeCore;
    if (!sceneTime?.actorReservationBlocked) throw new Error('Las acciones de Theater todavía están cargando.');
    const calendar = (await db.ref('campaña/calendario').once('value')).val() || {};
    const key = requestId || db.ref(paths.queue).push().key;
    if (!key || /[.#$\[\]\/]/.test(key)) throw new Error('No se pudo preparar el lanzamiento.');
    let failure = null;
    const committed = await db.ref(playerPath(playerId)).transaction(current => {
      failure = null;
      if (!current) return; // RTDB may first invoke a transaction with an empty local cache.
      if (clean(current.uid) !== uid) { failure = new Error('No se pudo verificar tu personaje.'); return; }
      if (current.theatreSpellCasts?.[key]) return current;
      try {
        // This check and the Slot spend share the Player transaction. A
        // second tab sees the reservation even if its Scene Time view is stale.
        if (sceneTime.actorReservationBlocked(current, calendar, { actorId, roomId: paths.roomId, requestId: key }) ||
            global.LuminousSceneTime?.blockingActionFor?.(actorId)) throw new Error('Tu actor ya está realizando una acción.');
        const prepared = prepareCast(current, { spellId, actorId, uid, classId, description });
        const next = prepared.character;
        const message = { ...prepared.message, roomId: paths.roomId || 'default', createdAt: global.firebase?.database?.ServerValue?.TIMESTAMP || Date.now() };
        next.theatreSpellOutbox = { ...(next.theatreSpellOutbox || {}), [key]: { message, queuePath: paths.queue, roomId: paths.roomId || 'default', uid } };
        next.theatreSpellCasts = { ...(next.theatreSpellCasts || {}), [key]: true };
        const roomId = sceneTime.roomKeyFrom(paths.roomId);
        const eventId = `theatre_${roomId}_${key}`;
        next.theatreActionReservations = { ...(next.theatreActionReservations || {}),
          [sceneTime.safeKey(actorId)]: { requestId: key, roomId, eventId, actionId: `action_${eventId}` } };
        // Keep pending casts and a bounded history of completed request IDs.
        const old = Object.keys(next.theatreSpellCasts).filter(id => !next.theatreSpellOutbox[id]);
        old.slice(0, Math.max(0, old.length - 32)).forEach(id => delete next.theatreSpellCasts[id]);
        return next;
      } catch (error) { failure = error; return; }
    }, undefined, false);
    if (!committed.committed) throw failure || new Error('No se pudo confirmar el lanzamiento.');
    try { await flushOutbox(db, playerId, committed.snapshot.val()); }
    catch (error) {
      console.error('[Theatre spell delivery]', error);
      return { queued: false, pending: true, key };
    }
    return { queued: true, key };
  }

  function refresh() {
    const doc = global.document, composer = doc?.getElementById('modal-escritura-teatro');
    if (!composer) return;
    let panel = doc.getElementById('theatre-assigned-spells');
    if (!panel) {
      panel = doc.createElement('section'); panel.id = 'theatre-assigned-spells';
      panel.innerHTML = '<label for="theatre-assigned-spell">Hechizos asignados</label><select id="theatre-assigned-spell"></select><p id="theatre-spell-description">Describe el uso del hechizo en la acción para que el DM resuelva su efecto.</p><button type="button" id="theatre-cast-assigned-spell">Lanzar hechizo</button><p id="theatre-spell-feedback" role="status" aria-live="polite"></p>';
      doc.getElementById('input-teatro-modal')?.before(panel);
      panel.querySelector('button').addEventListener('click', send);
      panel.querySelector('select').addEventListener('change', refresh);
      const field = doc.createElement('div'); field.id = 'theatre-spell-class-field';
      field.innerHTML = '<label for="theatre-spell-class">Clase de lanzamiento</label><select id="theatre-spell-class"></select>';
      panel.querySelector('#theatre-spell-description').before(field);
    }
    const player = global.datosJugador || state.player || {};
    const spells = spellsFor(player), select = panel.querySelector('select'), previous = select.value;
    select.replaceChildren();
    for (const spell of spells) {
      const option = doc.createElement('option'); option.value = spell.id;
      option.textContent = `${spell.nombre || spell.name} · ${Number(spell.level) ? `Nivel ${spell.level}` : 'Truco'}`;
      select.appendChild(option);
    }
    if (spells.some(spell => spell.id === previous)) select.value = previous;
    const selected = spells.find(spell => spell.id === select.value);
    const classes = selected ? castingClassesFor(player, selected) : [];
    const classSelect = panel.querySelector('#theatre-spell-class'), previousClass = classSelect.value;
    classSelect.replaceChildren();
    for (const id of classes) {
      const option = doc.createElement('option'); option.value = id;
      const definition = global.LuminousCharacterBuildRules?.CLASSES?.find(row => row.id === id);
      option.textContent = definition?.nombre || definition?.name || id.charAt(0).toUpperCase() + id.slice(1);
      classSelect.appendChild(option);
    }
    if (classes.includes(previousClass)) classSelect.value = previousClass;
    panel.querySelector('#theatre-spell-class-field').hidden = classes.length < 2;
    panel.querySelector('#theatre-spell-description').textContent = selected?.mechanics?.privateCommunication
      ? 'Sólo se anuncia el lanzamiento. Comunica el mensaje a su destinatario en privado; su contenido no se publica aquí.'
      : 'Describe la acción pública del hechizo para que el DM resuelva su efecto.';
    panel.hidden = !spells.length;
    panel.querySelector('button').disabled = state.busy || !spells.length || !classes.length;
    panel.querySelector('#theatre-spell-feedback').textContent = state.error;
  }
  async function send() {
    if (state.busy) return;
    state.busy = true; state.error = ''; refresh();
    try {
      const doc = global.document;
      const result = await cast({ db: global.firebase?.database?.(), playerId: state.playerId || global.currentPlayerId || global.localStorage?.getItem('playerId'),
        uid: global.firebase?.auth?.().currentUser?.uid, spellId: doc.getElementById('theatre-assigned-spell')?.value,
        classId: doc.getElementById('theatre-spell-class')?.value || null,
        actorId: global.getAssignedTheatreActor?.()?.actorId, description: doc.getElementById('input-teatro-modal')?.value,
        paths: global.LuminousTheatreState?.getPaths?.() });
      state.error = result.pending ? 'Lanzamiento guardado. Se enviará al recuperar la conexión.' : 'Hechizo enviado al Theater.';
      if (result.queued) doc.getElementById('input-teatro-modal').value = '';
    } catch (error) { state.error = error.message; }
    finally { state.busy = false; refresh(); }
  }
  global.LuminousTheatreSpells = Object.freeze({ spellsFor, castingClassesFor, prepareCast, cast, flushOutbox, refresh, state });
  if (global.document) {
    global.addEventListener('luminous:player-data', event => {
      state.playerId = event.detail?.playerId || state.playerId;
      state.player = event.detail?.data || global.datosJugador;
      refresh();
      if (state.playerId && state.player?.theatreSpellOutbox) flushOutbox(global.firebase.database(), state.playerId, state.player).catch(console.error);
    });
    global.document.addEventListener('click', event => { if (event.target.closest?.('#btn-abrir-escritura')) refresh(); }, true);
    global.addEventListener('online', () => {
      if (state.playerId) global.firebase.database().ref(playerPath(state.playerId)).once('value')
        .then(snap => flushOutbox(global.firebase.database(), state.playerId, snap.val())).catch(console.error);
    });
    refresh();
  }
})(typeof window === 'undefined' ? globalThis : window);
