(function (global, factory) {
  "use strict";
  const api = factory(global);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (global) global.LuminousPlayerVitalsHud = api;
})(typeof window !== "undefined" ? window : globalThis, function (global) {
  "use strict";

  const VERSION = "1.0.0";
  const HP_PATH_LENGTH = 1000;
  let lastPersistDigest = "";
  const numberOr = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const firstFinite = (...values) => {
    const found = values.find((value) => Number.isFinite(Number(value)));
    return found === undefined ? null : Number(found);
  };

  function resolveVitals(data = {}) {
    const rawHp = firstFinite(
      data?.hp,
      data?.hp_actual,
      data?.combatStats?.hp_actual,
    );
    const rawMax = firstFinite(
      data?.hp_max,
      data?.maxHp,
      data?.combatStats?.hp_max,
    );
    const rawSp = firstFinite(
      data?.sp,
      data?.sp_actual,
      data?.combatStats?.sp_actual,
    );
    const hpActual = rawHp ?? 0;
    const hpMax = Math.max(0, rawMax ?? hpActual);
    return {
      hpActual: Math.max(0, hpMax > 0 ? Math.min(hpActual, hpMax) : hpActual),
      hpMax,
      spActual: rawSp ?? 0,
    };
  }

  function hpRatio(current, max) {
    const safeMax = numberOr(max, 0);
    if (safeMax <= 0) return 0;
    return clamp(numberOr(current, 0) / safeMax, 0, 1);
  }

  function hpDashOffset(current, max, pathLength = HP_PATH_LENGTH) {
    return Math.round((1 - hpRatio(current, max)) * Math.max(1, numberOr(pathLength, HP_PATH_LENGTH)) * 1000) / 1000;
  }

  function spVisual(sp) {
    const value = numberOr(sp, 0);
    if (value < 0) {
      const intensity = clamp(Math.abs(value) / 45, 0, 1);
      return {
        center: intensity >= 0.66 ? "#ff5577" : "#e56b83",
        edge: intensity >= 0.66 ? "#9b173e" : "#8b3b51",
        shadow: `rgba(255, 55, 95, ${(0.25 + intensity * 0.55).toFixed(2)})`,
        wave: `rgba(255, 65, 105, ${(0.15 + intensity * 0.35).toFixed(2)})`,
        maxPositive: false,
        maxNegative: value <= -45,
      };
    }
    const intensity = clamp(value / 45, 0, 1);
    return {
      center: intensity >= 0.66 ? "#44ffff" : "#67dada",
      edge: intensity >= 0.66 ? "#00cccc" : "#267f86",
      shadow: `rgba(0, 255, 255, ${(0.25 + intensity * 0.45).toFixed(2)})`,
      wave: `rgba(0, 255, 255, ${(0.12 + intensity * 0.28).toFixed(2)})`,
      maxPositive: value >= 45,
      maxNegative: false,
    };
  }

  function setText(doc, id, value) {
    const node = doc?.getElementById?.(id);
    if (node && node.textContent !== String(value)) node.textContent = String(value);
    return node;
  }

  function persistencePatch(data = {}) {
    const hp = firstFinite(data?.hp, data?.hp_actual, data?.combatStats?.hp_actual);
    const hpMax = firstFinite(data?.hp_max, data?.maxHp, data?.combatStats?.hp_max);
    const sp = firstFinite(data?.sp, data?.sp_actual, data?.combatStats?.sp_actual);
    const patch = {};
    if (hp != null) {
      patch.hp = hp;
      patch["combatStats/hp_actual"] = hp;
    }
    if (hpMax != null) {
      patch.hp_max = Math.max(0, hpMax);
      patch["combatStats/hp_max"] = Math.max(0, hpMax);
    }
    if (sp != null) {
      patch.sp = sp;
      patch["combatStats/sp_actual"] = sp;
    }
    return patch;
  }

  async function persist(db, playerId, data = {}, options = {}) {
    const id = String(playerId ?? "").trim();
    if (!db?.ref || !id) return { saved: false, reason: "PLAYER_VITALS_PERSISTENCE_UNAVAILABLE" };
    const patch = persistencePatch(data);
    if (!Object.keys(patch).length) return { saved: false, reason: "NO_PLAYER_VITALS" };
    const digest = `${id}:${JSON.stringify(Object.entries(patch).sort(([a], [b]) => a.localeCompare(b)))}`;
    if (!options.force && digest === lastPersistDigest) return { saved: false, reason: "UNCHANGED", patch };
    await db.ref(`campaña/jugadores/${id}`).update(patch);
    lastPersistDigest = digest;
    return { saved: true, patch };
  }

  function sync(data = {}, doc = global.document) {
    if (!doc) return null;
    const vitals = resolveVitals(data);
    const offset = hpDashOffset(vitals.hpActual, vitals.hpMax);

    setText(doc, "hud-hp-actual", vitals.hpActual);
    setText(doc, "hud-hp-max", vitals.hpMax);
    setText(doc, "hud-sp-text", vitals.spActual);

    const hpBar = doc.getElementById?.("hp-bar");
    const hpDelay = doc.getElementById?.("hp-bar-delay");
    [hpBar, hpDelay].forEach((bar) => {
      if (!bar) return;
      const next = String(offset);
      if (bar.style.strokeDashoffset !== next) bar.style.strokeDashoffset = next;
      bar.setAttribute?.("aria-valuenow", String(vitals.hpActual));
      bar.setAttribute?.("aria-valuemax", String(vitals.hpMax));
    });

    const sphere = doc.getElementById?.("hud-sp-sphere");
    if (sphere) {
      const visual = spVisual(vitals.spActual);
      sphere.style.setProperty("--sp-center", visual.center);
      sphere.style.setProperty("--sp-edge", visual.edge);
      sphere.style.setProperty("--sp-shadow", visual.shadow);
      sphere.style.setProperty("--wave-color", visual.wave);
      sphere.classList.toggle("waves-max", visual.maxPositive);
      sphere.classList.toggle("waves-min", visual.maxNegative);
      sphere.dataset.sp = String(vitals.spActual);
      sphere.setAttribute("aria-label", `SP ${vitals.spActual}`);
    }

    const hud = doc.getElementById?.("player-combat-hud");
    if (hud) {
      hud.classList.toggle("dead", vitals.hpMax > 0 && vitals.hpActual <= 0);
      hud.dataset.hpActual = String(vitals.hpActual);
      hud.dataset.hpMax = String(vitals.hpMax);
      hud.dataset.spActual = String(vitals.spActual);
    }

    return { ...vitals, hpRatio: hpRatio(vitals.hpActual, vitals.hpMax), hpDashOffset: offset };
  }

  return Object.freeze({
    VERSION,
    HP_PATH_LENGTH,
    resolveVitals,
    hpRatio,
    hpDashOffset,
    spVisual,
    persistencePatch,
    persist,
    sync,
  });
});
