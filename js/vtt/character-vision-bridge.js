(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.LuminousVttCharacterVisionBridge = api;
})(typeof window !== 'undefined' ? window : globalThis, function (browserRoot) {
  'use strict';

  const clean = (value) => String(value ?? '').trim();

  function hostWindow(root = browserRoot) {
    if (!root) return null;
    try {
      if (root.parent && root.parent !== root && root.parent.document) return root.parent;
    } catch (_) {}
    return root;
  }

  function hostFirebase(root = browserRoot) {
    const host = hostWindow(root);
    return host?.firebase || root?.firebase || null;
  }

  function currentPlayerId(root = browserRoot) {
    const host = hostWindow(root);
    const data = host?.datosJugador || {};
    return clean(host?.localStorage?.getItem?.('playerId') || data.playerId || data.id || '');
  }

  function tokenLink(token = {}, root = browserRoot) {
    const link = token.characterLink || {};
    if (link.mode === 'current_player') {
      return { playerId: currentPlayerId(root) || null, actorId: clean(link.actorId || token.actorId) || null };
    }
    return {
      playerId: clean(link.playerId || token.playerId) || null,
      actorId: clean(link.actorId || token.actorId) || null,
    };
  }

  function resolveBuildCarrier(player, actor) {
    if (player?.characterBuild || player?.build || player?.character_build) return player;
    if (actor?.characterBuild || actor?.build || actor?.character_build) return actor;
    return player || actor || {};
  }

  function createBridge({ mapData, root = browserRoot, onSensesChanged } = {}) {
    if (!mapData) throw new Error('MAP_DATA_REQUIRED');
    const runtime = root?.LuminousRacialSenseRuntime
      || (typeof require !== 'undefined' ? require('../racial-sense-runtime.js') : null);
    if (!runtime) throw new Error('RACIAL_SENSE_RUNTIME_REQUIRED');

    const host = hostWindow(root);
    const firebase = hostFirebase(root);
    const db = firebase?.database?.() || null;
    const subscriptions = [];
    const records = new Map();
    let started = false;

    function emit(token, character) {
      token.senses = runtime.resolveCharacterSenses(character || {});
      token.characterVision = {
        raceId: token.senses.raceId,
        raceSubtypeId: token.senses.raceSubtypeId,
        darkvisionFt: token.senses.darkvisionFt,
        source: token.senses.source,
      };
      if (typeof onSensesChanged === 'function') onSensesChanged(token, token.senses);
      try {
        root?.document?.dispatchEvent?.(new root.CustomEvent('vtt:token-senses-changed', {
          detail: { tokenId: token.id, senses: { ...token.senses } },
        }));
      } catch (_) {}
      return token.senses;
    }

    function localCurrentPlayer() {
      return host?.datosJugador || null;
    }

    function applyRecord(token, record) {
      const carrier = resolveBuildCarrier(record?.player, record?.actor);
      return emit(token, carrier);
    }

    function subscribeValue(path, callback) {
      if (!db || !path) return;
      const ref = db.ref(path);
      const handler = (snapshot) => callback(snapshot.val() || null);
      ref.on('value', handler);
      subscriptions.push(() => ref.off('value', handler));
    }

    function bindActor(token, record, actorId) {
      if (!db || !actorId || record.boundActors?.has(actorId)) return;
      record.boundActors ||= new Set();
      record.boundActors.add(actorId);
      const accept = (actor) => {
        if (actor) record.actor = actor;
        applyRecord(token, record);
      };
      subscribeValue(`campaña/base_datos_npcs/${actorId}`, (actor) => {
        if (actor) accept(actor);
      });
      subscribeValue(`campaña/actores/${actorId}`, (actor) => {
        if (actor && !record.actor) accept(actor);
      });
    }

    function bindToken(token) {
      const link = tokenLink(token, root);
      const record = { player: null, actor: null, boundActors: new Set() };
      records.set(token.id, record);

      if (!db) {
        if (link.playerId && link.playerId === currentPlayerId(root)) record.player = localCurrentPlayer();
        applyRecord(token, record);
        return;
      }

      if (link.playerId) {
        subscribeValue(`campaña/jugadores/${link.playerId}`, (player) => {
          record.player = player;
          const actorId = clean(player?.actorId || link.actorId);
          if (actorId) bindActor(token, record, actorId);
          applyRecord(token, record);
        });
      } else if (link.actorId) {
        bindActor(token, record, link.actorId);
      } else {
        const local = localCurrentPlayer();
        if (local) record.player = local;
        applyRecord(token, record);
      }
    }

    function start() {
      if (started) return true;
      started = true;
      (mapData.tokens || []).forEach(bindToken);
      return true;
    }

    function refreshToken(tokenId, character) {
      const token = (mapData.tokens || []).find((entry) => String(entry.id) === String(tokenId));
      if (!token) return null;
      return emit(token, character);
    }

    function stop() {
      subscriptions.splice(0).forEach((unsubscribe) => unsubscribe());
      records.clear();
      started = false;
    }

    return Object.freeze({ start, stop, refreshToken, tokenLink: (token) => tokenLink(token, root) });
  }

  return Object.freeze({ hostWindow, hostFirebase, currentPlayerId, tokenLink, resolveBuildCarrier, createBridge });
});