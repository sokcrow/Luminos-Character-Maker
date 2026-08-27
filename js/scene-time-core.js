(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.LuminousSceneTimeCore = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  const CONFIG = Object.freeze({
    wordsPerSecond: 2.5,
    minSpeechSeconds: 2,
    thoughtSeconds: 1,
    narrationSeconds: 2,
    combatRoundSeconds: 6,
    actionDurations: Object.freeze({ instant: 2, normal: 3, complete: 6 }),
    limits: Object.freeze({ dialogo: 280, actuar: 200, combatDialogo: 100 }),
    processedEventLimit: 250,
  });
  const BLOCKING = new Set(['active', 'resolution_pending', 'check_before_pending']);

  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
  const clean = (value) => typeof value === 'string' ? value.trim() : '';
  const num = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const safeKey = (value) => String(value ?? 'event').trim().replace(/[.#$\[\]\/]/g, '_').replace(/\s+/g, '_').slice(0, 180) || 'event';
  const roomKeyFrom = (value) => safeKey(value || 'default') || 'default';

  function normalizeType(message = {}) {
    const text = clean(message.mensaje || message.message);
    if (/^\/em(?:\s+|$)/i.test(text)) return 'actuar';
    const type = clean(message.tipo_dialogo || message.dialogueType || message.type).toLowerCase();
    return ['dialogo', 'actuar', 'pensamiento', 'narracion', 'sistema', 'ooc'].includes(type) ? type : 'dialogo';
  }
  function messageText(message = {}) { return clean(message.mensaje || message.message).replace(/^\/em(?:\s+|$)/i, '').trim(); }
  function wordCount(text) { const value = clean(text); return value ? value.split(/\s+/).filter(Boolean).length : 0; }
  function speechDurationSeconds(message, config = CONFIG) { return Math.max(config.minSpeechSeconds, Math.ceil(wordCount(messageText(message)) / config.wordsPerSecond)); }
  function explicitSceneSeconds(message = {}) {
    const value = Number(message.sceneTimeSeconds ?? message.scene_time_seconds ?? message.declaredDurationSeconds);
    return Number.isFinite(value) && value >= 0 ? Math.ceil(value) : null;
  }
  function interventionDurationSeconds(message, mode = 'scene', config = CONFIG) {
    const type = normalizeType(message);
    if (type === 'ooc' || type === 'sistema' || mode === 'combat') return 0;
    const explicit = explicitSceneSeconds(message);
    if (type === 'narracion' && explicit !== null) return explicit;
    if (type === 'pensamiento') return config.thoughtSeconds;
    if (type === 'narracion') return config.narrationSeconds;
    if (type === 'dialogo') return speechDurationSeconds(message, config);
    return 0;
  }
  function actionBucket(message = {}) {
    const value = clean(message.actionBucket || message.action_bucket || message.durationBucket || message.duration_bucket).toLowerCase();
    return ['instant', 'normal', 'complete', 'prolonged'].includes(value) ? value : 'normal';
  }
  function actionDurationSeconds(message = {}, config = CONFIG) {
    const explicit = Number(message.actionDurationSeconds ?? message.action_duration_seconds ?? message.sceneTimeActionSeconds ?? message.scene_time_action_seconds);
    if (Number.isFinite(explicit) && explicit > 0) return Math.ceil(explicit);
    const bucket = actionBucket(message);
    return bucket === 'prolonged' ? config.actionDurations.complete : (config.actionDurations[bucket] || config.actionDurations.normal);
  }
  function messageLimit(type, mode = 'scene', config = CONFIG) {
    const normalized = normalizeType({ tipo_dialogo: type });
    if (normalized === 'dialogo' && mode === 'combat') return config.limits.combatDialogo;
    return config.limits[normalized] || null;
  }
  function validateMessageLength(message, mode = 'scene', config = CONFIG) {
    const type = normalizeType(message), limit = messageLimit(type, mode, config), length = messageText(message).length;
    return { valid: !limit || length <= limit, type, limit, length, reason: limit && length > limit ? `MAX_${type.toUpperCase()}_${limit}` : null };
  }

  function canonicalAllowedCheckOption(input) {
    if (!input) return null;
    if (typeof input === 'string') {
      const id = clean(input).toLowerCase();
      if (['str','dex','con','int','wis','cha'].includes(id)) return { kind: 'ability', abilityId: id, skillId: null };
      if (id === 'athletics') return { kind: 'skill', abilityId: 'str', skillId: 'athletics' };
      return null;
    }
    const abilityId = clean(input.abilityId || input.ability).toLowerCase();
    const skillId = clean(input.skillId || input.skill).toLowerCase() || null;
    if (!['str','dex','con','int','wis','cha'].includes(abilityId)) return null;
    return clean(input.kind).toLowerCase() === 'skill' && skillId
      ? { kind: 'skill', abilityId, skillId }
      : { kind: 'ability', abilityId, skillId: null };
  }
  function normalizeCheck(input) {
    if (!input || input.required === false) return { required: false, timing: 'after', allowed: [], dc: null };
    const allowed = (Array.isArray(input.allowed) ? input.allowed : []).map(canonicalAllowedCheckOption).filter(Boolean);
    return {
      required: allowed.length > 0,
      timing: input.timing === 'before' ? 'before' : 'after',
      allowed,
      dc: Number.isFinite(Number(input.dc)) ? Number(input.dc) : null,
    };
  }

  function calendarWorldMs(calendar = {}) {
    if (Number.isFinite(Number(calendar.timestamp))) return Number(calendar.timestamp);
    if (calendar.timestamp) { const parsed = new Date(calendar.timestamp); if (!Number.isNaN(parsed.getTime())) return parsed.getTime(); }
    return Date.UTC(
      Number(calendar.año ?? calendar.anio ?? calendar.year) || 984,
      Math.max(1, Math.min(12, Number(calendar.mes ?? calendar.month) || 1)) - 1,
      Math.max(1, Math.min(31, Number(calendar.dia ?? calendar.day) || 1)),
      Math.max(0, Math.min(23, Number(calendar.hora ?? calendar.hour) || 12)),
      Math.max(0, Math.min(59, Number(calendar.minuto ?? calendar.minute) || 0)),
      Math.max(0, Math.min(59, Number(calendar.segundo ?? calendar.second) || 0)),
    );
  }
  function writeCalendarWorldMs(calendar, worldMs) {
    const next = clone(calendar || {}) || {}, ms = Number.isFinite(Number(worldMs)) ? Number(worldMs) : calendarWorldMs(next), date = new Date(ms);
    next.timestamp = typeof next.timestamp === 'number' ? ms : date.toISOString();
    next.año = next.anio = date.getUTCFullYear();
    next.mes = date.getUTCMonth() + 1; next.dia = date.getUTCDate(); next.hora = date.getUTCHours(); next.minuto = date.getUTCMinutes(); next.segundo = date.getUTCSeconds();
    return next;
  }
  function roomStateFrom(calendar, roomKey) {
    return clone(calendar?.scene_time?.rooms?.[roomKeyFrom(roomKey)]) || { schemaVersion: 1, mode: 'scene', actions: {}, processedEvents: {}, lastEvent: null };
  }
  function assignRoomState(calendar, roomKey, roomState) {
    const next = clone(calendar || {}) || {};
    next.scene_time = next.scene_time && typeof next.scene_time === 'object' ? next.scene_time : {};
    next.scene_time.schemaVersion = 1;
    next.scene_time.rooms = next.scene_time.rooms && typeof next.scene_time.rooms === 'object' ? next.scene_time.rooms : {};
    next.scene_time.rooms[roomKeyFrom(roomKey)] = roomState;
    return next;
  }
  function isActionBlocking(action) { return Boolean(action && BLOCKING.has(action.status)); }
  function createActionInstance(message, worldMs, actionId) {
    const durationSeconds = actionDurationSeconds(message), check = normalizeCheck(message?.check);
    return {
      schemaVersion: 1,
      actionId: safeKey(actionId || message?.actionId || `action_${message?.actorId || 'actor'}_${worldMs}`),
      actorId: clean(message?.actorId),
      description: messageText(message),
      status: check.required && check.timing === 'before' ? 'check_before_pending' : 'active',
      durationSeconds,
      remainingSeconds: durationSeconds,
      consumedSeconds: 0,
      startedAtWorldTs: worldMs,
      check,
      result: null,
    };
  }
  function advanceActions(actions, seconds) {
    const next = clone(actions || {}) || {}, delta = Math.max(0, num(seconds));
    Object.values(next).forEach((action) => {
      if (!action || action.status !== 'active') return;
      const before = Math.max(0, num(action.remainingSeconds)), consumed = Math.min(before, delta);
      action.remainingSeconds = Math.max(0, before - delta); action.consumedSeconds = Math.max(0, num(action.consumedSeconds)) + consumed;
      if (action.remainingSeconds <= 0) action.status = action.check?.required && action.check?.timing !== 'before' ? 'resolution_pending' : 'resolved';
    });
    return next;
  }
  function nextEventDelta(actions) {
    const values = Object.values(actions || {}).filter((a) => a?.status === 'active' && num(a.remainingSeconds) > 0).map((a) => num(a.remainingSeconds));
    return values.length ? Math.min(...values) : 0;
  }
  function pruneProcessedEvents(events, limit = CONFIG.processedEventLimit) {
    const entries = Object.entries(events || {}).sort((a,b) => num(a[1]?.sequence) - num(b[1]?.sequence));
    return Object.fromEntries(entries.slice(Math.max(0, entries.length - limit)));
  }
  function applyActionControl(roomState, event, worldMs) {
    const actorId = clean(event.actorId), action = roomState.actions?.[actorId];
    if (!actorId || !action) return roomState;
    const command = clean(event.command).toLowerCase();
    if (command === 'set_duration') {
      const duration = Math.max(1, Math.ceil(num(event.durationSeconds, action.durationSeconds)));
      const consumed = Math.max(0, num(action.consumedSeconds)); action.durationSeconds = Math.max(duration, consumed); action.remainingSeconds = Math.max(0, action.durationSeconds - consumed);
      if (action.remainingSeconds > 0 && action.status === 'resolved') action.status = 'active';
    } else if (['cancel','interrupt','impossible'].includes(command)) {
      action.status = command === 'cancel' ? 'cancelled' : command === 'interrupt' ? 'interrupted' : 'impossible'; action.endedAtWorldTs = worldMs;
    } else if (command === 'complete') {
      action.consumedSeconds += Math.max(0, num(action.remainingSeconds)); action.remainingSeconds = 0; action.status = action.check?.required ? 'resolution_pending' : 'resolved'; action.endedAtWorldTs = worldMs;
    } else if (command === 'attach_check') {
      action.check = normalizeCheck(event.check); if (action.check.required && action.check.timing === 'before' && action.consumedSeconds <= 0) action.status = 'check_before_pending'; else if (action.check.required && action.remainingSeconds <= 0) action.status = 'resolution_pending';
    } else if (command === 'resolve_check') {
      const success = event.success === true;
      action.result = { success, total: Number.isFinite(Number(event.total)) ? Number(event.total) : null, resolvedAtWorldTs: worldMs };
      if (action.check?.timing === 'before') action.status = success ? 'active' : 'failed'; else action.status = success ? 'resolved' : 'failed';
    } else if (command === 'clear' && !isActionBlocking(action)) delete roomState.actions[actorId];
    return roomState;
  }
  function eventDeltaSeconds(event, roomState) {
    const type = clean(event.type).toLowerCase();
    if (type === 'combat_round') return CONFIG.combatRoundSeconds;
    if (type === 'advance') return Math.max(0, Math.ceil(num(event.seconds)));
    if (type === 'next_event') return nextEventDelta(roomState.actions);
    if (type === 'intervention') return interventionDurationSeconds(event.message || {}, roomState.mode || 'scene');
    return 0;
  }
  function applyEventToCalendar(calendar, event, roomKey) {
    const key = roomKeyFrom(roomKey), eventId = safeKey(event?.eventId || 'event'), original = clone(calendar || {}) || {}, roomState = roomStateFrom(original, key);
    roomState.processedEvents = roomState.processedEvents || {};
    if (roomState.processedEvents[eventId]) return { calendar: original, roomState, applied: false, duplicate: true, deltaSeconds: 0 };
    const worldMs = calendarWorldMs(original), type = clean(event?.type).toLowerCase();
    if (type === 'set_mode') roomState.mode = event.mode === 'combat' ? 'combat' : 'scene';
    if (type === 'intervention' && normalizeType(event.message || {}) === 'actuar') {
      const actorId = clean(event.message?.actorId);
      if (actorId && !isActionBlocking(roomState.actions?.[actorId])) {
        roomState.actions = roomState.actions || {};
        roomState.actions[actorId] = createActionInstance(event.message, worldMs, event.actionId || `action_${eventId}`);
      } else if (actorId) {
        roomState.__eventResult = 'actor_locked';
      }
    }
    if (type === 'action_control') applyActionControl(roomState, event, worldMs);
    const deltaSeconds = eventDeltaSeconds(event, roomState);
    if (deltaSeconds > 0) roomState.actions = advanceActions(roomState.actions, deltaSeconds);
    const nextWorldMs = worldMs + deltaSeconds * 1000;
    const sequence = Math.max(0, ...Object.values(roomState.processedEvents).map((v) => num(v?.sequence))) + 1;
    roomState.processedEvents[eventId] = { sequence, source: clean(event.source) || type, deltaSeconds };
    roomState.processedEvents = pruneProcessedEvents(roomState.processedEvents);
    roomState.lastEvent = { eventId, type, deltaSeconds, worldTs: nextWorldMs };
    const eventResult = roomState.__eventResult || null; delete roomState.__eventResult;
    return { calendar: assignRoomState(writeCalendarWorldMs(original, nextWorldMs), key, roomState), roomState, applied: true, duplicate: false, deltaSeconds, result: eventResult };
  }

  function visibleActionIdentity({ actorId, viewerId, selfActorId, isOwnActor, isDm, known, canonicalName }) {
    if (isDm || isOwnActor === true || (selfActorId && actorId === selfActorId) || known === true) return clean(canonicalName) || '???';
    return '???';
  }
  function replaceActionIdentity(text, name, previousName) {
    const raw = String(text || ''), visible = clean(name) || '???', previous = clean(previousName);
    if (previous && raw.startsWith(`(${previous} `)) return `(${visible} ${raw.slice(previous.length + 2)}`;
    if (/^\(\?\?\?(?:\s|\))/i.test(raw)) return raw.replace(/^\(\?\?\?/, `(${visible}`);
    if (/^\([^\s)]+\s/.test(raw)) return raw.replace(/^\([^\s)]+/, `(${visible}`);
    return raw;
  }

  return Object.freeze({
    CONFIG, clone, clean, safeKey, roomKeyFrom, normalizeType, messageText, wordCount,
    speechDurationSeconds, explicitSceneSeconds, interventionDurationSeconds, actionBucket,
    actionDurationSeconds, messageLimit, validateMessageLength, canonicalAllowedCheckOption,
    normalizeCheck, calendarWorldMs, writeCalendarWorldMs, roomStateFrom, assignRoomState,
    isActionBlocking, createActionInstance, advanceActions, nextEventDelta, pruneProcessedEvents,
    applyActionControl, eventDeltaSeconds, applyEventToCalendar, visibleActionIdentity, replaceActionIdentity,
  });
});
