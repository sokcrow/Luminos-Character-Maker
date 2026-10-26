(function (global) {
  "use strict";

  if (global.LuminousWeatherPlayerWidget) return;

  const ICON_SPRITE = "Assets/Images/Weather/weather-icons.svg";
  let engine = null;
  let widget = null;
  let appPanel = null;
  let currentState = null;
  let unsubscribe = null;
  let appOpen = false;

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function round(value, fallback) {
    const n = Number(value);
    return Number.isFinite(n) ? Math.round(n) : (fallback ?? 0);
  }

  function iconSvg(weatherId, className) {
    const def = engine.getDefinition(weatherId) || { icon: "sun" };
    return `<svg class="${className || "player-weather-icon"}" viewBox="0 0 64 64" aria-hidden="true"><use href="${ICON_SPRITE}#${def.icon}"></use></svg>`;
  }

  function formatWorldClock() {
    const cal = engine.getCalendar() || {};
    if (!cal.timestamp) {
      const day = Number(cal.dia) || 1;
      const month = Number(cal.mes) || 1;
      const year = Number(cal.año || cal.anio) || 984;
      return { time: "--:--", date: `DÍA ${day} · MES ${month} · ${year}` };
    }
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

  function forecastMarkup(forecast) {
    if (!forecast.length) {
      return `<div class="player-weather-app__forecast-empty">SIN DATOS DE PRONÓSTICO</div>`;
    }
    return forecast.map((entry, index) => {
      const def = engine.getDefinition(entry.tipo) || {};
      const hour = Math.max(1, Math.round((Number(entry.etaMin) || ((index + 1) * 180)) / 60));
      return `<div class="player-weather-app__forecast-card">
        <span>+${hour}H</span>
        ${iconSvg(entry.tipo, "player-weather-app__forecast-icon")}
        <strong>${escapeHtml(def.label || entry.tipo)}</strong>
        <small>PROB. ${playerForecastText(entry.probabilidad)}</small>
      </div>`;
    }).join("");
  }

  function renderWidget(actual, def, clock, season) {
    widget.innerHTML = `
      <button type="button" class="player-weather-glance" data-weather-open aria-controls="player-weather-app" aria-haspopup="dialog" aria-label="Abrir Weather Net">
        <span class="player-weather-glance__icon">${iconSvg(actual.tipo, "player-weather-glance__svg")}</span>
        <span class="player-weather-glance__copy">
          <small>WEATHER//NET · ${escapeHtml(clock.time)}</small>
          <strong>${escapeHtml(def.label || actual.tipo)}</strong>
          <span>${escapeHtml(season)} · ${escapeHtml(precipitationText(actual.tipo, actual.intensidad))}</span>
        </span>
        <span class="player-weather-glance__temp">${round(actual.temperatura)}<small>°C</small></span>
        <span class="player-weather-glance__open">ABRIR</span>
      </button>`;
  }

  function renderApp(actual, def, clock, season, forecast) {
    if (!appPanel) return;
    appPanel.innerHTML = `
      <div class="player-weather-app__frame" role="dialog" aria-modal="true" aria-labelledby="player-weather-app-title">
        <header class="player-weather-app__header">
          <button type="button" class="player-weather-app__back" data-weather-close>VOLVER</button>
          <div>
            <small>TERMINAL AMBIENTAL</small>
            <strong id="player-weather-app-title">WEATHER//NET</strong>
          </div>
          <span class="player-weather-app__network">ONLINE <i></i></span>
        </header>

        <div class="player-weather-app__body">
          <section class="player-weather-app__hero" data-weather="${escapeHtml(actual.tipo)}">
            <div class="player-weather-app__hero-icon">${iconSvg(actual.tipo, "player-weather-app__hero-svg")}</div>
            <div class="player-weather-app__hero-copy">
              <small>${escapeHtml(season.toUpperCase())} · ${escapeHtml(clock.date)}</small>
              <h2>${escapeHtml(def.label || actual.tipo)}</h2>
              <p>${escapeHtml(precipitationText(actual.tipo, actual.intensidad))}</p>
            </div>
            <div class="player-weather-app__temperature">${round(actual.temperatura)}<small>°C</small><span>${escapeHtml(clock.time)}</span></div>
          </section>

          <section class="player-weather-app__metrics" aria-label="Condiciones ambientales">
            <div><span>HUMEDAD</span><strong>${round(actual.humedad)}%</strong></div>
            <div><span>VIENTO</span><strong>${round(actual.viento)}<small> km/h</small></strong></div>
            <div><span>VISIBILIDAD</span><strong>${round(actual.visibilidad)}%</strong></div>
            <div><span>INTENSIDAD</span><strong>${round(actual.intensidad)}%</strong></div>
          </section>

          <section class="player-weather-app__forecast">
            <div class="player-weather-app__section-title">
              <span>PRONÓSTICO // PRÓXIMAS HORAS</span>
              <small>Estimación de red</small>
            </div>
            <div class="player-weather-app__forecast-grid">
              ${forecastMarkup(forecast)}
            </div>
          </section>
        </div>
      </div>`;
  }

  function render() {
    if (!widget || !currentState) return;
    const actual = currentState.actual || { tipo: "soleado", temperatura: 0, humedad: 0, viento: 0, visibilidad: 0, intensidad: 0 };
    const def = engine.getDefinition(actual.tipo) || {};
    const clock = formatWorldClock();
    const season = engine.displaySeason(currentState.estacion || "invierno");
    const forecast = Array.isArray(currentState.pronostico) ? currentState.pronostico.slice(0, 3) : [];

    renderWidget(actual, def, clock, season);
    renderApp(actual, def, clock, season, forecast);
  }

  function ensureAppPanel() {
    if (appPanel?.isConnected) return appPanel;
    const screen = widget?.closest?.(".sheet-phone-screen") || document.querySelector(".sheet-phone-screen");
    if (!screen) return null;
    appPanel = document.createElement("section");
    appPanel.id = "player-weather-app";
    appPanel.className = "player-weather-app";
    appPanel.hidden = true;
    appPanel.setAttribute("aria-hidden", "true");
    screen.appendChild(appPanel);
    appPanel.addEventListener("click", (event) => {
      if (event.target.closest("[data-weather-close]")) closeApp();
    });
    return appPanel;
  }

  function openApp() {
    if (!currentState || !ensureAppPanel()) return false;
    render();
    appOpen = true;
    appPanel.hidden = false;
    appPanel.setAttribute("aria-hidden", "false");
    appPanel.classList.add("is-open");
    global.requestAnimationFrame?.(() => appPanel.querySelector("[data-weather-close]")?.focus());
    return true;
  }

  function closeApp() {
    if (!appPanel) return false;
    appOpen = false;
    appPanel.classList.remove("is-open");
    appPanel.setAttribute("aria-hidden", "true");
    appPanel.hidden = true;
    widget?.querySelector?.("[data-weather-open]")?.focus();
    return true;
  }

  function onWidgetClick(event) {
    if (event.target.closest("[data-weather-open]")) openApp();
  }

  function onKeydown(event) {
    if (event.key === "Escape" && appOpen) closeApp();
  }

  function mount() {
    widget = document.querySelector(".sheet-weather-widget");
    if (!widget || widget.dataset.weatherPlayerMounted === "true") return false;
    widget.dataset.weatherPlayerMounted = "true";
    widget.classList.add("sheet-weather-widget--live");
    ensureAppPanel();
    widget.addEventListener("click", onWidgetClick);
    document.addEventListener("keydown", onKeydown);
    unsubscribe = engine.onChange((next) => {
      currentState = next;
      render();
    });
    return true;
  }

  function destroy() {
    unsubscribe?.();
    unsubscribe = null;
    widget?.removeEventListener?.("click", onWidgetClick);
    document.removeEventListener("keydown", onKeydown);
    appPanel?.remove?.();
    appPanel = null;
    appOpen = false;
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
    openApp,
    closeApp,
    destroy
  });

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})(window);
