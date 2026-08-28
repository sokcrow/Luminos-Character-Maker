(function (root) {
  'use strict';
  function hostWindow() {
    try { if (root.parent && root.parent !== root && root.parent.document) return root.parent; } catch (_) {}
    return root;
  }
  function start() {
    const host = hostWindow();
    const runtime = root.LuminousVttRuntime;
    const racial = root.LuminousRacialSenseRuntime;
    const lighting = root.LuminousVttLightingEngine;
    const db = host?.firebase?.database?.();
    const mapData = runtime?.engine?.mapData;
    if (!db || !mapData || !racial?.resolveCharacterSenses) return null;
    const ref = db.ref('campaña/jugadores');
    let records = {};
    const apply = () => {
      for (const token of mapData.tokens || []) {
        const playerId = String(token.canonicalPlayerKey || token.playerId || '').trim();
        if (!playerId || !records[playerId]) continue;
        if (!Number.isFinite(Number(token.visionConeDeg))) token.visionConeDeg = lighting?.DEFAULT_VISION_CONE_DEG || 120;
        if (!Number.isFinite(Number(token.facingDeg))) token.facingDeg = 0;
        token.senses = racial.resolveCharacterSenses(records[playerId]);
        token.characterVision = {
          raceId: token.senses.raceId,
          raceSubtypeId: token.senses.raceSubtypeId,
          darkvisionFt: token.senses.darkvisionFt,
          source: token.senses.source,
        };
      }
    };
    const handler = (snapshot) => { records = snapshot.val() || {}; apply(); setTimeout(apply, 0); };
    ref.on('value', handler);
    const timer = setInterval(apply, 1000);
    return () => { ref.off('value', handler); clearInterval(timer); };
  }
  const boot = () => {
    const stop = start();
    if (stop) root.addEventListener('beforeunload', stop, { once: true });
  };
  if (root.document?.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', () => setTimeout(boot, 0), { once: true });
  else setTimeout(boot, 0);
})(typeof window !== 'undefined' ? window : globalThis);