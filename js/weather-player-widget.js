(function (global) {
  "use strict";

  if (global.LuminousWeatherPlayerWidget) return;

  const ICON_SPRITE = "Assets/Images/Weather/weather-icons.svg";
  let engine = null;
  let widget = null;
  let currentState = null;
  let unsubscribe = null;

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function iconSvg(weatherId, className) {
    const def = engine.getDefinition(weatherId) || { icon: "sun" };
    return `<svg class="${className || "player-weather-icon"}" viewBox="0 0 64 64" aria-hidden="true"><use href="${ICON_SPRITE}#${def.icon}"></use></svg>`;
  }

  function formatWorldClock() {
    const cal = engine.getCalendar() || {};
    if (!cal.timestamp) return { time: "--:--", date: "RED CLIMÁTICA" };
    const d = new Date(cal.timestamp);
    if (Number.isNaN(d.getTime())) return { time: "--:--", date: "RED CLIMÁTICA" };
    const time = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    const date = `DÍA ${d.getDate()} · MES ${d.getMonth() + 1} · ${d.getFullYear()}`;
    return { time, date };
  }

  function precipitationText(type, intensity) {
    if (["lluvia", "llovizna", "tormenta", "granizo", "nieve", "nevada"].includes(type)) {
      if (intensity >= 75) return "PRECIPITACIÓN INTENSA";
      if (intensity >= 45) return "PRECIPITACIÓN MODERADA";
      return "PRECIPITACIÓN LIGERA";
    }
    if (type === "niebla") return "NIEBLA EN SUPERFICIE";
    return "SIN PRECIPITACIÓN";
  }

  function playerForecastText(probability) {
    const p = Number(probability) || 0;
    if (p >= 55) return "ALTA";
    if (p >= 30) return "MEDIA";
    return "BAJA";
  }

  function render() {
    if (!widget || !currentState) return;
    const actual = currentState.actual;
    const def = engine.getDefinition(actual.tipo) || {};
    const clock = formatWorldClock();
    const forecast = Array.isArray(currentState.pronostico) ? currentState.pronostico.slice(0, 3) : [];

    widget.innerHTML = `
      <div class="player-weather-live" data-weather="${escapeHtml(actual.tipo)}">
        <div class="player-weather-live__top">
          <div class="player-weather-clock">
            <strong>${escapeHtml(clock.time)}</strong>
            <span>${escapeHtml(clock.date)}</span>
          </div>
          <span class="player-weather-network">WEATHER//NET <i></i></span>
        </div>

        <div class="player-weather-current">
          <div class="player-weather-current__icon">${iconSvg(actual.tipo, "player-weather-current__svg")}</div>
          <div class="player-weather-current__main">
            <span>${escapeHtml(engine.displaySeason(currentState.estacion).toUpperCase())}</span>
            <h3>${escapeHtml(def.label || actual.tipo)}</h3>
            <p>${escapeHtml(precipitationText(actual.tipo, actual.intensidad))}</p>
          </div>
          <strong class="player-weather-temperature">${Math.round(actual.temperatura)}<small>°C</small></strong>
        </div>

        <div class="player-weather-metrics">
          <div><span>HUMEDAD</span><strong>${Math.round(actual.humedad)}%</strong></div>
          <div><span>VIENTO</span><strong>${Math.round(actual.viento)}<small> km/h</small></strong></div>
          <div><span>VISIBILIDAD</span><strong>${Math.round(actual.visibilidad)}%</strong></div>
          <div><span>INTENSIDAD</span><strong>${Math.round(actual.intensidad)}%</strong></div>
        </div>

        <div class="player-weather-forecast-live">
          <div class="player-weather-forecast-live__title">
            <span>PRONÓSTICO // PRÓXIMAS HORAS</span>
            <small>Estimación de red</small>
          </div>
          <div class="player-weather-forecast-live__grid">
            ${forecast.length ? forecast.map((entry, index) => {
              const forecastDef = engine.getDefinition(entry.tipo) || {};
              const hour = Math.max(1, Math.round((Number(entry.etaMin) || ((index + 1) * 180)) / 60));
              return `<div class="player-weather-forecast-item">
                <span>+${hour}H</span>
                ${iconSvg(entry.tipo, "player-weather-forecast-icon")}
                <strong>${escapeHtml(forecastDef.label || entry.tipo)}</strong>
                <small>PROB. ${playerForecastText(entry.probabilidad)}</small>
              </div>`;
            }).join("") : `<div class="player-weather-forecast-empty">SIN DATOS DE PRONÓSTICO</div>`}
          </div>
        </div>
      </div>`;
  }

  function mount() {
    widget = document.querySelector(".sheet-weather-widget");
    if (!widget || widget.dataset.weatherPlayerMounted === "true") return false;
    widget.dataset.weatherPlayerMounted = "true";
    widget.classList.add("sheet-weather-widget--live");
    unsubscribe = engine.onChange((next) => {
      currentState = next;
      render();
    });
    return true;
  }

  function boot() {
    engine = global.LuminousWeatherEngine;
    if (!engine) {
      global.setTimeout(boot, 60);
      return;
    }
    if (!mount()) global.setTimeout(boot, 250);
  }

  global.LuminousWeatherPlayerWidget = Object.freeze({
    mount: () => { engine = global.LuminousWeatherEngine; return engine ? mount() : false; },
    render,
    destroy: () => { unsubscribe?.(); unsubscribe = null; }
  });

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})(window);
