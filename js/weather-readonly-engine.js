(function (global) {
  "use strict";

  function ensureEnvironmentRuntime() {
    if (!global.document) return;

    const loadRuntime = () => {
      if (global.LuminousEnvironmentRuntime || global.document.getElementById("luminous-environment-runtime-script")) return;
      const runtimeScript = global.document.createElement("script");
      runtimeScript.id = "luminous-environment-runtime-script";
      runtimeScript.src = "js/environment-runtime.js";
      runtimeScript.async = false;
      global.document.head?.appendChild(runtimeScript);
    };

    if (global.LuminousEnvironmentEngine) {
      loadRuntime();
      return;
    }

    const existing = global.document.getElementById("luminous-environment-engine-script");
    if (existing) {
      existing.addEventListener("load", loadRuntime, { once: true });
      return;
    }

    const engineScript = global.document.createElement("script");
    engineScript.id = "luminous-environment-engine-script";
    engineScript.src = "js/environment-engine.js";
    engineScript.async = false;
    engineScript.addEventListener("load", loadRuntime, { once: true });
    global.document.head?.appendChild(engineScript);
  }

  if (global.LuminousWeatherEngine) {
    ensureEnvironmentRuntime();
    return;
  }

  const ROOT = "campaña/clima";
  const LEGACY_WORLD_ROOT = "campaña/estado_mundo";
  const LEGACY_FORECAST_PATH = "campaña/worldData/weatherForecast";
  const CALENDAR_ROOT = "campaña/calendario";

  const WEATHER = Object.freeze({
    soleado: { label: "Soleado", icon: "sun", env: { temperatura: 23, humedad: 38, viento: 8, visibilidad: 100, intensidad: 35 } },
    parcialmente_nublado: { label: "Parcialmente Nublado", icon: "partly-cloudy", env: { temperatura: 19, humedad: 55, viento: 11, visibilidad: 94, intensidad: 42 } },
    nublado: { label: "Nublado", icon: "cloudy", env: { temperatura: 16, humedad: 72, viento: 13, visibilidad: 84, intensidad: 50 } },
    llovizna: { label: "Llovizna", icon: "drizzle", env: { temperatura: 14, humedad: 86, viento: 12, visibilidad: 75, intensidad: 40 } },
    lluvia: { label: "Lluvia", icon: "rain", env: { temperatura: 12, humedad: 92, viento: 19, visibilidad: 62, intensidad: 66 } },
    tormenta: { label: "Tormenta", icon: "storm", env: { temperatura: 11, humedad: 96, viento: 38, visibilidad: 42, intensidad: 88 } },
    niebla: { label: "Niebla", icon: "fog", env: { temperatura: 10, humedad: 94, viento: 4, visibilidad: 28, intensidad: 65 } },
    nieve: { label: "Nieve", icon: "snow", env: { temperatura: -2, humedad: 82, viento: 15, visibilidad: 67, intensidad: 58 } },
    nevada: { label: "Nevada", icon: "snow-heavy", env: { temperatura: -6, humedad: 89, viento: 28, visibilidad: 35, intensidad: 84 } },
    granizo: { label: "Granizo", icon: "hail", env: { temperatura: 4, humedad: 85, viento: 32, visibilidad: 48, intensidad: 80 } }
  });

  const LEGACY_TO_ID = Object.freeze({
    Soleado: "soleado",
    Despejado: "soleado",
    "Parcialmente Nublado": "parcialmente_nublado",
    Nublado: "nublado",
    "Húmedo": "nublado",
    Humedo: "nublado",
    Calor: "soleado",
    Llovizna: "llovizna",
    Lluvia: "lluvia",
    Tormenta: "tormenta",
    Niebla: "niebla",
    Nieve: "nieve",
    Nevada: "nevada",
    Granizo: "granizo"
  });

  const listeners = new Set();
  let db = null;
  let state = null;
  let calendar = {};
  let legacyWeather = "soleado";
  let legacyForecast = [];
  let modernExists = false;
  let initialized = false;

  function clone(value) {
    return value ? JSON.parse(JSON.stringify(value)) : value;
  }

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

  function monthFromCalendar() {
    if (calendar?.timestamp) {
      const parsed = new Date(calendar.timestamp);
      if (!Number.isNaN(parsed.getTime())) return parsed.getMonth() + 1;
    }
    return Number(calendar?.mes) || 1;
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

  function normalizeForecast(raw) {
    if (!raw) return [];
    const list = Array.isArray(raw) ? raw : Object.keys(raw).sort().map((key) => raw[key]);
    return list.filter(Boolean).slice(0, 3).map((entry, index) => ({
      tipo: normalizeWeatherId(entry.tipo || entry.clima),
      probabilidad: clamp(entry.probabilidad, 0, 100, 0),
      etaMin: Number(entry.etaMin) || ((index + 1) * 180)
    }));
  }

  function fallbackState() {
    const type = normalizeWeatherId(legacyWeather);
    const env = WEATHER[type]?.env || WEATHER.soleado.env;
    return {
      version: 1,
      modo: "auto",
      estacion: seasonFromMonth(monthFromCalendar()),
      regionActual: "mundo",
      actual: { tipo: type, ...env },
      anterior: null,
      transicion: { activa: false, origen: null, destino: null, progreso: 0 },
      pronostico: normalizeForecast(legacyForecast),
      historial: []
    };
  }

  function normalizeState(raw) {
    const input = raw && typeof raw === "object" ? raw : {};
    const type = normalizeWeatherId(input.actual?.tipo || input.actual || input.clima || legacyWeather);
    const env = WEATHER[type]?.env || WEATHER.soleado.env;
    const actualInput = input.actual && typeof input.actual === "object" ? input.actual : {};
    return {
      ...input,
      version: Number(input.version) || 1,
      modo: input.modo === "manual" ? "manual" : "auto",
      estacion: seasonFromMonth(monthFromCalendar()),
      regionActual: String(input.regionActual || "mundo"),
      actual: {
        tipo: type,
        temperatura: clamp(actualInput.temperatura, -40, 60, env.temperatura),
        humedad: clamp(actualInput.humedad, 0, 100, env.humedad),
        viento: clamp(actualInput.viento, 0, 180, env.viento),
        visibilidad: clamp(actualInput.visibilidad, 0, 100, env.visibilidad),
        intensidad: clamp(actualInput.intensidad, 0, 100, env.intensidad)
      },
      pronostico: normalizeForecast(input.pronostico?.length ? input.pronostico : legacyForecast),
      historial: Array.isArray(input.historial) ? input.historial.slice(-5) : []
    };
  }

  function notify() {
    const snapshot = clone(state);
    listeners.forEach((listener) => {
      try { listener(snapshot); } catch (error) { console.error("Weather listener error:", error); }
    });
    global.dispatchEvent?.(new CustomEvent("luminous-weather-change", { detail: snapshot }));
  }

  function refreshFallback() {
    if (modernExists) return;
    state = fallbackState();
    notify();
  }

  function bind() {
    db.ref(CALENDAR_ROOT).on("value", (snapshot) => {
      calendar = snapshot.val() || {};
      if (modernExists && state) {
        state = normalizeState(state);
        notify();
      } else refreshFallback();
    });

    db.ref(`${LEGACY_WORLD_ROOT}/clima`).on("value", (snapshot) => {
      legacyWeather = normalizeWeatherId(snapshot.val());
      refreshFallback();
    });

    db.ref(LEGACY_FORECAST_PATH).on("value", (snapshot) => {
      legacyForecast = snapshot.val() || [];
      refreshFallback();
    });

    db.ref(ROOT).on("value", (snapshot) => {
      modernExists = snapshot.exists();
      state = modernExists ? normalizeState(snapshot.val()) : fallbackState();
      notify();
    });
  }

  function onChange(listener) {
    if (typeof listener !== "function") return () => {};
    listeners.add(listener);
    if (state) listener(clone(state));
    return () => listeners.delete(listener);
  }

  function getDefinition(weatherId) {
    return clone(WEATHER[normalizeWeatherId(weatherId)] || WEATHER.soleado);
  }

  global.LuminousWeatherEngine = Object.freeze({
    ROOT,
    VERSION: 1,
    readOnly: true,
    onChange,
    getState: () => clone(state),
    getCalendar: () => clone(calendar),
    getDefinition,
    getDefinitions: () => clone(WEATHER),
    normalizeWeatherId,
    seasonFromMonth,
    displaySeason,
    iconHref: (weatherId) => `Assets/Images/Weather/weather-icons.svg#${getDefinition(weatherId).icon}`
  });

  function boot() {
    if (initialized) return;
    if (!global.firebase?.apps?.length || !global.firebase?.database) {
      global.setTimeout(boot, 60);
      return;
    }
    initialized = true;
    db = global.firebase.database();
    bind();
  }

  if (global.document) {
    ensureEnvironmentRuntime();
    boot();
  }
})(window);
