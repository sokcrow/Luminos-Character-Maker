(function (global) {
  "use strict";

  if (global.LuminousWeatherEngine) return;

  const ROOT = "campaña/clima";
  const LEGACY_WORLD_ROOT = "campaña/estado_mundo";
  const LEGACY_FORECAST_PATH = "campaña/worldData/weatherForecast";
  const CALENDAR_ROOT = "campaña/calendario";
  const VERSION = 1;
  const AUTO_MIN_MINUTES = 180;
  const AUTO_MAX_MINUTES = 480;

  const WEATHER = Object.freeze({
    soleado: {
      label: "Soleado",
      icon: "sun",
      description: "Cielo abierto y alta iluminación.",
      env: { temperatura: 23, humedad: 38, viento: 8, visibilidad: 100, intensidad: 35 },
      transitions: { parcialmente_nublado: 34, nublado: 8, niebla: 3, tormenta: 2 }
    },
    parcialmente_nublado: {
      label: "Parcialmente Nublado",
      icon: "partly-cloudy",
      description: "Cobertura variable con claros frecuentes.",
      env: { temperatura: 19, humedad: 55, viento: 11, visibilidad: 94, intensidad: 42 },
      transitions: { soleado: 24, nublado: 34, llovizna: 10, niebla: 7, lluvia: 5 }
    },
    nublado: {
      label: "Nublado",
      icon: "cloudy",
      description: "Cobertura densa con luz ambiental reducida.",
      env: { temperatura: 16, humedad: 72, viento: 13, visibilidad: 84, intensidad: 50 },
      transitions: { parcialmente_nublado: 18, llovizna: 25, lluvia: 24, niebla: 15, tormenta: 8 }
    },
    llovizna: {
      label: "Llovizna",
      icon: "drizzle",
      description: "Precipitación ligera y persistente.",
      env: { temperatura: 14, humedad: 86, viento: 12, visibilidad: 75, intensidad: 40 },
      transitions: { nublado: 25, lluvia: 39, niebla: 15, parcialmente_nublado: 8 }
    },
    lluvia: {
      label: "Lluvia",
      icon: "rain",
      description: "Precipitación continua con visibilidad reducida.",
      env: { temperatura: 12, humedad: 92, viento: 19, visibilidad: 62, intensidad: 66 },
      transitions: { llovizna: 24, nublado: 19, tormenta: 27, niebla: 11, granizo: 4 }
    },
    tormenta: {
      label: "Tormenta",
      icon: "storm",
      description: "Lluvia intensa, viento fuerte y actividad eléctrica.",
      env: { temperatura: 11, humedad: 96, viento: 38, visibilidad: 42, intensidad: 88 },
      transitions: { lluvia: 42, nublado: 23, granizo: 10, niebla: 6 }
    },
    niebla: {
      label: "Niebla",
      icon: "fog",
      description: "Suspensión densa que limita la línea de visión.",
      env: { temperatura: 10, humedad: 94, viento: 4, visibilidad: 28, intensidad: 65 },
      transitions: { nublado: 32, parcialmente_nublado: 15, llovizna: 20, lluvia: 8, nieve: 6 }
    },
    nieve: {
      label: "Nieve",
      icon: "snow",
      description: "Nevada ligera con acumulación gradual.",
      env: { temperatura: -2, humedad: 82, viento: 15, visibilidad: 67, intensidad: 58 },
      transitions: { nublado: 22, nevada: 34, niebla: 18, llovizna: 3 }
    },
    nevada: {
      label: "Nevada",
      icon: "snow-heavy",
      description: "Nieve intensa y deterioro rápido de visibilidad.",
      env: { temperatura: -6, humedad: 89, viento: 28, visibilidad: 35, intensidad: 84 },
      transitions: { nieve: 43, nublado: 20, niebla: 17, granizo: 5 }
    },
    granizo: {
      label: "Granizo",
      icon: "hail",
      description: "Precipitación sólida breve y agresiva.",
      env: { temperatura: 4, humedad: 85, viento: 32, visibilidad: 48, intensidad: 80 },
      transitions: { lluvia: 39, tormenta: 24, nublado: 22 }
    }
  });

  const SEASON_MODIFIERS = Object.freeze({
    primavera: {
      soleado: 1.0, parcialmente_nublado: 1.08, nublado: 1.08, llovizna: 1.25,
      lluvia: 1.35, tormenta: 1.22, niebla: 1.10, nieve: 0.08, nevada: 0.03, granizo: 1.05
    },
    verano: {
      soleado: 1.50, parcialmente_nublado: 1.10, nublado: 0.82, llovizna: 0.68,
      lluvia: 0.78, tormenta: 1.30, niebla: 0.52, nieve: 0.01, nevada: 0.01, granizo: 0.82
    },
    otono: {
      soleado: 0.72, parcialmente_nublado: 1.08, nublado: 1.40, llovizna: 1.32,
      lluvia: 1.34, tormenta: 1.10, niebla: 1.52, nieve: 0.22, nevada: 0.08, granizo: 0.82
    },
    invierno: {
      soleado: 0.72, parcialmente_nublado: 0.82, nublado: 1.20, llovizna: 0.76,
      lluvia: 0.72, tormenta: 0.68, niebla: 1.28, nieve: 1.85, nevada: 1.55, granizo: 1.22
    }
  });

  const LEGACY_TO_ID = Object.freeze({
    "Soleado": "soleado",
    "Despejado": "soleado",
    "Parcialmente Nublado": "parcialmente_nublado",
    "Nublado": "nublado",
    "Húmedo": "nublado",
    "Humedo": "nublado",
    "Calor": "soleado",
    "Llovizna": "llovizna",
    "Lluvia": "lluvia",
    "Tormenta": "tormenta",
    "Niebla": "niebla",
    "Nieve": "nieve",
    "Nevada": "nevada",
    "Granizo": "granizo"
  });

  const listeners = new Set();
  let db = null;
  let state = null;
  let calendar = null;
  let initialized = false;
  let currentDayKey = null;
  let writing = false;
  let lastLegacyRepairAt = 0;

  function clamp(value, min, max, fallback) {
    const n = Number(value);
    return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
  }

  function seasonFromMonth(month) {
    const m = Math.max(1, Math.min(12, Number.parseInt(month, 10) || 1));
    if (m >= 3 && m <= 5) return "primavera";
    if (m >= 6 && m <= 8) return "verano";
    if (m >= 9 && m <= 11) return "otono";
    return "invierno";
  }

  function displaySeason(season) {
    return ({ primavera: "Primavera", verano: "Verano", otono: "Otoño", invierno: "Invierno" })[season] || "Invierno";
  }

  function normalizeWeatherId(value) {
    if (!value) return "soleado";
    const direct = String(value).trim();
    if (WEATHER[direct]) return direct;
    if (LEGACY_TO_ID[direct]) return LEGACY_TO_ID[direct];
    const normalized = direct
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
    return WEATHER[normalized] ? normalized : "soleado";
  }

  function iconHref(weatherId) {
    const def = WEATHER[normalizeWeatherId(weatherId)] || WEATHER.soleado;
    return `Assets/Images/Weather/weather-icons.svg#${def.icon}`;
  }

  function calendarInfo(raw) {
    const data = raw && typeof raw === "object" ? raw : {};
    let date = null;
    if (data.timestamp) {
      const parsed = new Date(data.timestamp);
      if (!Number.isNaN(parsed.getTime())) date = parsed;
    }
    const month = date ? date.getMonth() + 1 : Number(data.mes) || 1;
    const day = date ? date.getDate() : Number(data.dia) || 1;
    const year = date ? date.getFullYear() : Number(data.año || data.anio) || 984;
    const worldTs = date ? date.getTime() : Date.UTC(year, month - 1, day, 12, 0, 0);
    return { date, month, day, year, worldTs, dayKey: `${year}-${month}-${day}` };
  }

  function environmentFor(weatherId, existing) {
    const def = WEATHER[normalizeWeatherId(weatherId)] || WEATHER.soleado;
    const base = def.env;
    const current = existing && typeof existing === "object" ? existing : {};
    return {
      temperatura: clamp(current.temperatura, -40, 60, base.temperatura),
      humedad: clamp(current.humedad, 0, 100, base.humedad),
      viento: clamp(current.viento, 0, 180, base.viento),
      visibilidad: clamp(current.visibilidad, 0, 100, base.visibilidad),
      intensidad: clamp(current.intensidad, 0, 100, base.intensidad)
    };
  }

  function targetEnvironment(weatherId, previousEnv) {
    const def = WEATHER[normalizeWeatherId(weatherId)] || WEATHER.soleado;
    const base = def.env;
    const prev = environmentFor(weatherId, previousEnv);
    const blend = (a, b) => Math.round((a * 0.35) + (b * 0.65));
    return {
      temperatura: blend(prev.temperatura, base.temperatura),
      humedad: blend(prev.humedad, base.humedad),
      viento: blend(prev.viento, base.viento),
      visibilidad: blend(prev.visibilidad, base.visibilidad),
      intensidad: blend(prev.intensidad, base.intensidad)
    };
  }

  function getTransitionBreakdown(weatherId, sourceState) {
    const source = normalizeWeatherId(weatherId);
    const def = WEATHER[source] || WEATHER.soleado;
    const snapshot = sourceState || state || {};
    const season = snapshot.estacion || seasonFromMonth(calendarInfo(calendar).month);
    const modifiers = SEASON_MODIFIERS[season] || SEASON_MODIFIERS.invierno;
    const env = environmentFor(source, snapshot.actual || {});
    const previous = normalizeWeatherId(snapshot.anterior || "");
    const rows = [];

    Object.entries(def.transitions || {}).forEach(([target, baseWeight]) => {
      let multiplier = Number(modifiers[target]) || 1;
      const reasons = [`${displaySeason(season)} ×${multiplier.toFixed(2)}`];

      if ((target === "nieve" || target === "nevada") && env.temperatura > 4) {
        multiplier *= 0.04;
        reasons.push("Temperatura alta ×0.04");
      } else if ((target === "nieve" || target === "nevada") && env.temperatura <= 1) {
        multiplier *= 1.35;
        reasons.push("Temperatura ≤1°C ×1.35");
      }

      if ((target === "lluvia" || target === "llovizna" || target === "tormenta") && env.humedad >= 75) {
        multiplier *= 1.18;
        reasons.push("Humedad alta ×1.18");
      }

      if (target === "niebla" && env.humedad >= 80 && env.viento <= 15) {
        multiplier *= 1.30;
        reasons.push("Aire húmedo/calma ×1.30");
      }

      if (target === "tormenta" && env.temperatura >= 18) {
        multiplier *= 1.12;
        reasons.push("Convección cálida ×1.12");
      }

      if (previous && target === previous && Object.keys(def.transitions || {}).length > 1) {
        multiplier *= 0.12;
        reasons.push("Anti-rebote ×0.12");
      }

      const weight = Math.max(0.001, Number(baseWeight) * multiplier);
      rows.push({ target, baseWeight: Number(baseWeight), multiplier, weight, reasons });
    });

    const total = rows.reduce((sum, row) => sum + row.weight, 0) || 1;
    return rows
      .map((row) => ({ ...row, probability: (row.weight / total) * 100 }))
      .sort((a, b) => b.probability - a.probability);
  }

  function getTransitionProbabilities(weatherId, sourceState) {
    return getTransitionBreakdown(weatherId, sourceState).map(({ target, probability }) => ({ target, probability }));
  }

  function buildForecast(sourceState) {
    const result = [];
    let sim = JSON.parse(JSON.stringify(sourceState || state || defaultState()));
    for (let i = 0; i < 3; i += 1) {
      const options = getTransitionBreakdown(sim.actual?.tipo, sim);
      const best = options[0];
      if (!best) break;
      result.push({ tipo: best.target, probabilidad: Math.round(best.probability), etaMin: (i + 1) * 180 });
      sim.anterior = sim.actual?.tipo;
      sim.actual = { ...targetEnvironment(best.target, sim.actual), tipo: best.target };
    }
    return result;
  }

  function randomAutoMinutes() {
    return Math.round(AUTO_MIN_MINUTES + Math.random() * (AUTO_MAX_MINUTES - AUTO_MIN_MINUTES));
  }

  function defaultState(seedWeather) {
    const info = calendarInfo(calendar);
    const type = normalizeWeatherId(seedWeather || "soleado");
    const actual = { tipo: type, ...environmentFor(type) };
    const base = {
      version: VERSION,
      modo: "auto",
      estacion: seasonFromMonth(info.month),
      regionActual: "mundo",
      actual,
      anterior: null,
      transicion: { activa: false, origen: null, destino: null, progreso: 0 },
      pronostico: [],
      siguienteCambioWorldTs: info.worldTs + (randomAutoMinutes() * 60000),
      ultimoCambioWorldTs: info.worldTs,
      historial: []
    };
    base.pronostico = buildForecast(base);
    return base;
  }

  function normalizeHistory(raw) {
    if (!raw) return [];
    const list = Array.isArray(raw) ? raw : Object.keys(raw).sort().map((key) => raw[key]);
    return list.filter(Boolean).slice(-5);
  }

  function normalizeState(raw) {
    const info = calendarInfo(calendar);
    const input = raw && typeof raw === "object" ? raw : {};
    const type = normalizeWeatherId(input.actual?.tipo || input.actual || input.clima || "soleado");
    const normalized = {
      version: VERSION,
      modo: input.modo === "manual" ? "manual" : "auto",
      estacion: ["primavera", "verano", "otono", "invierno"].includes(input.estacion)
        ? input.estacion
        : seasonFromMonth(info.month),
      regionActual: String(input.regionActual || "mundo"),
      actual: { tipo: type, ...environmentFor(type, input.actual) },
      anterior: input.anterior ? normalizeWeatherId(input.anterior) : null,
      transicion: {
        activa: Boolean(input.transicion?.activa),
        origen: input.transicion?.origen ? normalizeWeatherId(input.transicion.origen) : null,
        destino: input.transicion?.destino ? normalizeWeatherId(input.transicion.destino) : null,
        progreso: clamp(input.transicion?.progreso, 0, 100, 0)
      },
      pronostico: Array.isArray(input.pronostico) ? input.pronostico : [],
      siguienteCambioWorldTs: Number(input.siguienteCambioWorldTs) || (info.worldTs + randomAutoMinutes() * 60000),
      ultimoCambioWorldTs: Number(input.ultimoCambioWorldTs) || info.worldTs,
      historial: normalizeHistory(input.historial)
    };
    if (!normalized.pronostico.length) normalized.pronostico = buildForecast(normalized);
    return normalized;
  }

  function clone(value) {
    return value ? JSON.parse(JSON.stringify(value)) : value;
  }

  function notify() {
    const snapshot = clone(state);
    listeners.forEach((listener) => {
      try { listener(snapshot); } catch (error) { console.error("Weather listener error:", error); }
    });
    global.dispatchEvent?.(new CustomEvent("luminous-weather-change", { detail: snapshot }));
  }

  function svgIcon(weatherId, className, title) {
    const id = normalizeWeatherId(weatherId);
    const label = title || WEATHER[id]?.label || id;
    const cls = className ? ` class="${className}"` : "";
    return `<svg${cls} viewBox="0 0 64 64" role="img" aria-label="${String(label).replace(/"/g, "&quot;")}"><use href="${iconHref(id)}"></use></svg>`;
  }

  function legacyForecast(forecast) {
    return (forecast || []).map((entry) => ({
      clima: WEATHER[normalizeWeatherId(entry.tipo)]?.label || "Soleado",
      probabilidad: Number(entry.probabilidad) || 0
    }));
  }

  async function writeState(next, options) {
    if (!db) return false;
    const opts = options || {};
    const normalized = normalizeState(next);
    normalized.pronostico = buildForecast(normalized);
    writing = true;
    try {
      const updates = { [ROOT]: normalized };
      if (opts.mirrorLegacy !== false) {
        updates[`${LEGACY_WORLD_ROOT}/clima`] = WEATHER[normalized.actual.tipo]?.label || "Soleado";
        updates[`${LEGACY_WORLD_ROOT}/clima_previo`] = normalized.anterior ? (WEATHER[normalized.anterior]?.label || null) : null;
        updates[LEGACY_FORECAST_PATH] = legacyForecast(normalized.pronostico);
      }
      await db.ref().update(updates);
      return true;
    } finally {
      global.setTimeout(() => { writing = false; }, 80);
    }
  }

  async function forceWeather(weatherId, overrides) {
    if (!state) return false;
    const type = normalizeWeatherId(weatherId);
    const info = calendarInfo(calendar);
    const previous = state.actual.tipo;
    const env = { ...targetEnvironment(type, state.actual), ...(overrides || {}) };
    const history = [...normalizeHistory(state.historial), {
      tipo: previous,
      destino: type,
      motivo: "manual",
      worldTs: info.worldTs
    }].slice(-5);
    const next = {
      ...state,
      anterior: previous,
      actual: { tipo: type, ...environmentFor(type, env) },
      estacion: seasonFromMonth(info.month),
      transicion: { activa: false, origen: previous, destino: type, progreso: 100 },
      ultimoCambioWorldTs: info.worldTs,
      siguienteCambioWorldTs: info.worldTs + randomAutoMinutes() * 60000,
      historial: history
    };
    return writeState(next);
  }

  function weightedPick(rows) {
    if (!rows.length) return null;
    const roll = Math.random() * 100;
    let sum = 0;
    for (const row of rows) {
      sum += row.probability;
      if (roll <= sum) return row.target;
    }
    return rows[rows.length - 1].target;
  }

  async function rollNext(reason) {
    if (!state) return false;
    const options = getTransitionBreakdown(state.actual.tipo, state);
    const target = weightedPick(options);
    if (!target) return false;
    const info = calendarInfo(calendar);
    const previous = state.actual.tipo;
    const history = [...normalizeHistory(state.historial), {
      tipo: previous,
      destino: target,
      motivo: reason || "auto",
      worldTs: info.worldTs
    }].slice(-5);
    const next = {
      ...state,
      anterior: previous,
      actual: { tipo: target, ...targetEnvironment(target, state.actual) },
      estacion: seasonFromMonth(info.month),
      transicion: { activa: false, origen: previous, destino: target, progreso: 100 },
      ultimoCambioWorldTs: info.worldTs,
      siguienteCambioWorldTs: info.worldTs + randomAutoMinutes() * 60000,
      historial: history
    };
    return writeState(next);
  }

  async function setMode(mode) {
    if (!state) return false;
    return writeState({ ...state, modo: mode === "manual" ? "manual" : "auto" });
  }

  async function updateEnvironment(patch) {
    if (!state) return false;
    const actual = { ...state.actual };
    ["temperatura", "humedad", "viento", "visibilidad", "intensidad"].forEach((key) => {
      if (patch && patch[key] !== undefined) actual[key] = patch[key];
    });
    return writeState({ ...state, actual: { tipo: state.actual.tipo, ...environmentFor(state.actual.tipo, actual) } });
  }

  async function syncSeasonFromCalendar() {
    if (!state) return;
    const info = calendarInfo(calendar);
    const season = seasonFromMonth(info.month);
    if (state.estacion !== season) {
      await writeState({ ...state, estacion: season });
    }
  }

  async function evaluateAuto() {
    if (!state || state.modo !== "auto" || !global.document?.getElementById?.("tab-clima")) return;
    const info = calendarInfo(calendar);
    if (info.worldTs >= Number(state.siguienteCambioWorldTs || 0)) {
      await rollNext("auto");
    }
  }

  async function seed() {
    const [modernSnap, legacySnap, calendarSnap] = await Promise.all([
      db.ref(ROOT).once("value"),
      db.ref(`${LEGACY_WORLD_ROOT}/clima`).once("value"),
      db.ref(CALENDAR_ROOT).once("value")
    ]);
    calendar = calendarSnap.val() || {};
    if (!modernSnap.exists()) {
      const seeded = defaultState(legacySnap.val());
      await writeState(seeded);
    }
  }

  function bindFirebase() {
    db.ref(ROOT).on("value", (snapshot) => {
      state = normalizeState(snapshot.val() || {});
      notify();
    });

    db.ref(CALENDAR_ROOT).on("value", (snapshot) => {
      calendar = snapshot.val() || {};
      const info = calendarInfo(calendar);
      const changedDay = currentDayKey !== null && currentDayKey !== info.dayKey;
      currentDayKey = info.dayKey;
      syncSeasonFromCalendar().then(() => {
        if (changedDay || (state && info.worldTs >= Number(state.siguienteCambioWorldTs || 0))) {
          global.setTimeout(evaluateAuto, 120);
        }
      });
    });

    if (global.document?.getElementById?.("tab-clima")) {
      db.ref(`${LEGACY_WORLD_ROOT}/clima`).on("value", (snapshot) => {
        if (writing || !state) return;
        const legacy = normalizeWeatherId(snapshot.val());
        if (legacy === state.actual.tipo) return;
        const now = Date.now();
        if (now - lastLegacyRepairAt < 200) return;
        lastLegacyRepairAt = now;
        global.setTimeout(() => {
          if (!state || writing) return;
          const label = WEATHER[state.actual.tipo]?.label || "Soleado";
          db.ref(`${LEGACY_WORLD_ROOT}/clima`).set(label).catch(() => {});
        }, 160);
      });
    }
  }

  function onChange(listener) {
    if (typeof listener !== "function") return () => {};
    listeners.add(listener);
    if (state) listener(clone(state));
    return () => listeners.delete(listener);
  }

  function getState() { return clone(state); }
  function getCalendar() { return clone(calendar); }
  function getDefinition(weatherId) { return clone(WEATHER[normalizeWeatherId(weatherId)]); }
  function getDefinitions() { return clone(WEATHER); }
  function getSeasonModifiers() { return clone(SEASON_MODIFIERS); }

  global.LuminousWeatherEngine = Object.freeze({
    ROOT,
    VERSION,
    onChange,
    getState,
    getCalendar,
    getDefinition,
    getDefinitions,
    getSeasonModifiers,
    seasonFromMonth,
    displaySeason,
    normalizeWeatherId,
    getTransitionBreakdown,
    getTransitionProbabilities,
    buildForecast,
    iconHref,
    svgIcon,
    forceWeather,
    rollNext,
    setMode,
    updateEnvironment,
    evaluateAuto
  });

  function boot() {
    if (initialized) return;
    try {
      if (!global.firebase?.apps?.length || !global.firebase?.database) {
        global.setTimeout(boot, 50);
        return;
      }
      db = global.firebase.database();
      initialized = true;
      seed()
        .then(bindFirebase)
        .catch((error) => {
          initialized = false;
          console.error("Weather Engine boot error:", error);
          global.setTimeout(boot, 500);
        });
    } catch (error) {
      global.setTimeout(boot, 100);
    }
  }

  if (global.document) boot();

  if (typeof module !== "undefined" && module.exports) {
    module.exports = {
      WEATHER,
      SEASON_MODIFIERS,
      seasonFromMonth,
      normalizeWeatherId,
      getTransitionBreakdown
    };
  }
})(typeof window !== "undefined" ? window : globalThis);
