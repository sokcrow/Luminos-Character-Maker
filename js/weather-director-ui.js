(function (global) {
  "use strict";

  if (global.LuminousWeatherDirectorUI) return;

  const ICON_SPRITE = "Assets/Images/Weather/weather-icons.svg";
  let engine = null;
  let root = null;
  let selectedWeather = null;
  let currentState = null;
  let unsubscribe = null;
  let countdownTimer = null;

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function iconSvg(weatherId, className) {
    const def = engine.getDefinition(weatherId) || { icon: "sun", label: weatherId };
    return `<svg class="${className || "weather-svg-icon"}" viewBox="0 0 64 64" aria-hidden="true"><use href="${ICON_SPRITE}#${def.icon}"></use></svg>`;
  }

  function weatherLabel(weatherId) {
    return engine.getDefinition(weatherId)?.label || weatherId || "—";
  }

  function initialMarkup() {
    return `
      <section id="weather-director" class="weather-director" aria-label="Weather Director">
        <header class="weather-director__header">
          <div>
            <span class="weather-kicker">LUMINOUS // WORLD ENVIRONMENT</span>
            <h2>WEATHER DIRECTOR</h2>
          </div>
          <div class="weather-director__status">
            <div class="weather-season-badge">
              <span class="weather-season-badge__label">ESTACIÓN</span>
              <strong id="weather-director-season">—</strong>
            </div>
            <div class="weather-mode-switch" role="group" aria-label="Modo climático">
              <button type="button" data-weather-mode="auto">AUTO</button>
              <button type="button" data-weather-mode="manual">MANUAL</button>
            </div>
          </div>
        </header>

        <div class="weather-director__grid">
          <section class="weather-graph-card">
            <div class="weather-card-head">
              <div>
                <span class="weather-card-index">01</span>
                <strong>RED DE TRANSICIÓN</strong>
              </div>
              <span id="weather-next-change" class="weather-countdown">SIGUIENTE CAMBIO —</span>
            </div>
            <div id="weather-graph" class="weather-graph">
              <svg id="weather-graph-lines" viewBox="0 0 560 430" preserveAspectRatio="none" aria-hidden="true"></svg>
              <div id="weather-graph-nodes" class="weather-graph__nodes"></div>
            </div>
            <div class="weather-graph-legend">
              <span><i class="weather-dot weather-dot--current"></i> ACTUAL</span>
              <span><i class="weather-dot weather-dot--candidate"></i> POSIBLE</span>
              <span>CLICK EN UN NODO PARA INSPECCIONAR</span>
            </div>
          </section>

          <aside class="weather-inspector-card">
            <div class="weather-card-head">
              <div>
                <span class="weather-card-index">02</span>
                <strong>INSPECTOR ATMOSFÉRICO</strong>
              </div>
              <span id="weather-inspector-prob" class="weather-prob-badge">ACTUAL</span>
            </div>

            <div class="weather-inspector-hero">
              <div id="weather-inspector-icon" class="weather-inspector-icon"></div>
              <div>
                <span id="weather-inspector-state" class="weather-inspector-state">—</span>
                <h3 id="weather-inspector-name">—</h3>
                <p id="weather-inspector-desc">—</p>
              </div>
            </div>

            <div class="weather-metrics">
              <div class="weather-metric"><span>TEMPERATURA</span><strong id="weather-metric-temperature">—</strong><i><b id="weather-bar-temperature"></b></i></div>
              <div class="weather-metric"><span>HUMEDAD</span><strong id="weather-metric-humidity">—</strong><i><b id="weather-bar-humidity"></b></i></div>
              <div class="weather-metric"><span>VIENTO</span><strong id="weather-metric-wind">—</strong><i><b id="weather-bar-wind"></b></i></div>
              <div class="weather-metric"><span>VISIBILIDAD</span><strong id="weather-metric-visibility">—</strong><i><b id="weather-bar-visibility"></b></i></div>
              <div class="weather-metric weather-metric--wide"><span>INTENSIDAD</span><strong id="weather-metric-intensity">—</strong><i><b id="weather-bar-intensity"></b></i></div>
            </div>

            <div id="weather-transition-breakdown" class="weather-transition-breakdown"></div>

            <div class="weather-actions">
              <button id="weather-force-selected" type="button" class="weather-btn weather-btn--primary">FORZAR CLIMA</button>
              <button id="weather-roll-next" type="button" class="weather-btn">TIRAR TRANSICIÓN</button>
            </div>
          </aside>
        </div>

        <div class="weather-director__lower">
          <details class="weather-environment-editor">
            <summary>VARIABLES AMBIENTALES // AJUSTE MANUAL</summary>
            <div class="weather-env-grid">
              <label>TEMP °C <input id="weather-env-temperature" type="range" min="-20" max="45" step="1"><output id="weather-env-temperature-out"></output></label>
              <label>HUMEDAD % <input id="weather-env-humidity" type="range" min="0" max="100" step="1"><output id="weather-env-humidity-out"></output></label>
              <label>VIENTO KM/H <input id="weather-env-wind" type="range" min="0" max="120" step="1"><output id="weather-env-wind-out"></output></label>
              <label>VISIBILIDAD % <input id="weather-env-visibility" type="range" min="0" max="100" step="1"><output id="weather-env-visibility-out"></output></label>
              <label>INTENSIDAD % <input id="weather-env-intensity" type="range" min="0" max="100" step="1"><output id="weather-env-intensity-out"></output></label>
            </div>
            <button id="weather-apply-environment" type="button" class="weather-btn weather-btn--compact">APLICAR VARIABLES</button>
          </details>

          <section class="weather-history-card">
            <div class="weather-card-head"><div><span class="weather-card-index">03</span><strong>HISTORIAL</strong></div></div>
            <div id="weather-history" class="weather-history"></div>
          </section>
        </div>
      </section>`;
  }

  function setMetric(id, barId, text, percent) {
    const value = root.querySelector(`#${id}`);
    const bar = root.querySelector(`#${barId}`);
    if (value) value.textContent = text;
    if (bar) bar.style.width = `${Math.max(0, Math.min(100, Number(percent) || 0))}%`;
  }

  function selectedBreakdown() {
    if (!currentState) return [];
    return engine.getTransitionBreakdown(currentState.actual.tipo, currentState);
  }

  function renderGraph() {
    const svg = root.querySelector("#weather-graph-lines");
    const nodesHost = root.querySelector("#weather-graph-nodes");
    if (!svg || !nodesHost || !currentState) return;

    svg.innerHTML = "";
    nodesHost.innerHTML = "";

    const current = currentState.actual.tipo;
    const transitions = selectedBreakdown().slice(0, 6);
    const center = { x: 280, y: 215 };
    const radiusX = transitions.length <= 4 ? 205 : 220;
    const radiusY = transitions.length <= 4 ? 145 : 160;

    const centerNode = document.createElement("button");
    centerNode.type = "button";
    centerNode.className = "weather-node weather-node--current";
    centerNode.style.left = `${(center.x / 560) * 100}%`;
    centerNode.style.top = `${(center.y / 430) * 100}%`;
    centerNode.dataset.weatherId = current;
    centerNode.innerHTML = `${iconSvg(current, "weather-node__icon")}<span>${escapeHtml(weatherLabel(current))}</span><small>ACTUAL</small>`;
    nodesHost.appendChild(centerNode);

    transitions.forEach((row, index) => {
      const angle = ((Math.PI * 2) / transitions.length) * index - Math.PI / 2;
      const point = {
        x: center.x + Math.cos(angle) * radiusX,
        y: center.y + Math.sin(angle) * radiusY
      };

      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("x1", center.x);
      line.setAttribute("y1", center.y);
      line.setAttribute("x2", point.x);
      line.setAttribute("y2", point.y);
      line.setAttribute("class", "weather-graph-line");
      svg.appendChild(line);

      const midpointX = center.x + ((point.x - center.x) * 0.55);
      const midpointY = center.y + ((point.y - center.y) * 0.55);
      const probability = document.createElementNS("http://www.w3.org/2000/svg", "text");
      probability.setAttribute("x", midpointX);
      probability.setAttribute("y", midpointY);
      probability.setAttribute("class", "weather-graph-probability");
      probability.textContent = `${row.probability.toFixed(0)}%`;
      svg.appendChild(probability);

      const node = document.createElement("button");
      node.type = "button";
      node.className = `weather-node weather-node--candidate${selectedWeather === row.target ? " is-selected" : ""}`;
      node.style.left = `${(point.x / 560) * 100}%`;
      node.style.top = `${(point.y / 430) * 100}%`;
      node.dataset.weatherId = row.target;
      node.innerHTML = `${iconSvg(row.target, "weather-node__icon")}<span>${escapeHtml(weatherLabel(row.target))}</span><small>${row.probability.toFixed(0)}%</small>`;
      nodesHost.appendChild(node);
    });
  }

  function renderBreakdown(weatherId) {
    const host = root.querySelector("#weather-transition-breakdown");
    if (!host || !currentState) return;
    const row = selectedBreakdown().find((item) => item.target === weatherId);
    if (!row || weatherId === currentState.actual.tipo) {
      host.innerHTML = `<div class="weather-breakdown-empty">ESTADO ACTUAL // Selecciona una transición del grafo para ver cómo la estación modifica su probabilidad.</div>`;
      return;
    }

    host.innerHTML = `
      <div class="weather-breakdown-title">CÁLCULO DE TRANSICIÓN</div>
      <div class="weather-breakdown-row"><span>PESO BASE</span><strong>${row.baseWeight.toFixed(1)}</strong></div>
      <div class="weather-breakdown-row"><span>MODIFICADOR FINAL</span><strong>×${row.multiplier.toFixed(2)}</strong></div>
      <div class="weather-breakdown-reasons">${row.reasons.map((reason) => `<span>${escapeHtml(reason)}</span>`).join("")}</div>
      <div class="weather-breakdown-final"><span>PROBABILIDAD</span><strong>${row.probability.toFixed(1)}%</strong></div>`;
  }

  function renderInspector() {
    if (!currentState) return;
    const current = currentState.actual.tipo;
    const inspected = selectedWeather || current;
    const isCurrent = inspected === current;
    const def = engine.getDefinition(inspected) || {};
    const actualEnv = currentState.actual;
    const previewEnv = isCurrent ? actualEnv : { ...def.env, tipo: inspected };
    const transition = selectedBreakdown().find((item) => item.target === inspected);

    root.querySelector("#weather-inspector-icon").innerHTML = iconSvg(inspected, "weather-inspector-icon__svg");
    root.querySelector("#weather-inspector-name").textContent = def.label || inspected;
    root.querySelector("#weather-inspector-desc").textContent = def.description || "";
    root.querySelector("#weather-inspector-state").textContent = isCurrent ? "CONDICIÓN ACTUAL" : "TRANSICIÓN CANDIDATA";
    root.querySelector("#weather-inspector-prob").textContent = isCurrent ? "ACTUAL" : `${(transition?.probability || 0).toFixed(1)}%`;

    setMetric("weather-metric-temperature", "weather-bar-temperature", `${Math.round(previewEnv.temperatura)}°C`, ((previewEnv.temperatura + 20) / 65) * 100);
    setMetric("weather-metric-humidity", "weather-bar-humidity", `${Math.round(previewEnv.humedad)}%`, previewEnv.humedad);
    setMetric("weather-metric-wind", "weather-bar-wind", `${Math.round(previewEnv.viento)} km/h`, (previewEnv.viento / 120) * 100);
    setMetric("weather-metric-visibility", "weather-bar-visibility", `${Math.round(previewEnv.visibilidad)}%`, previewEnv.visibilidad);
    setMetric("weather-metric-intensity", "weather-bar-intensity", `${Math.round(previewEnv.intensidad)}%`, previewEnv.intensidad);

    const forceButton = root.querySelector("#weather-force-selected");
    if (forceButton) {
      forceButton.disabled = isCurrent;
      forceButton.textContent = isCurrent ? "CLIMA ACTIVO" : `FORZAR ${String(def.label || inspected).toUpperCase()}`;
    }

    renderBreakdown(inspected);
  }

  function renderEnvironmentEditor() {
    if (!currentState) return;
    const values = {
      temperature: currentState.actual.temperatura,
      humidity: currentState.actual.humedad,
      wind: currentState.actual.viento,
      visibility: currentState.actual.visibilidad,
      intensity: currentState.actual.intensidad
    };
    Object.entries(values).forEach(([name, value]) => {
      const input = root.querySelector(`#weather-env-${name}`);
      const output = root.querySelector(`#weather-env-${name}-out`);
      if (input && document.activeElement !== input) input.value = value;
      if (output) output.textContent = name === "temperature" ? `${Math.round(value)}°C` : `${Math.round(value)}${name === "wind" ? " km/h" : "%"}`;
    });
  }

  function renderHistory() {
    const host = root.querySelector("#weather-history");
    if (!host || !currentState) return;
    const history = Array.isArray(currentState.historial) ? [...currentState.historial].reverse() : [];
    if (!history.length) {
      host.innerHTML = `<span class="weather-history-empty">Aún no hay transiciones registradas.</span>`;
      return;
    }
    host.innerHTML = history.map((entry) => `
      <div class="weather-history-row">
        ${iconSvg(entry.tipo, "weather-history-icon")}
        <span>${escapeHtml(weatherLabel(entry.tipo))}</span>
        <i></i>
        ${iconSvg(entry.destino, "weather-history-icon")}
        <strong>${escapeHtml(weatherLabel(entry.destino))}</strong>
        <small>${escapeHtml(String(entry.motivo || "auto").toUpperCase())}</small>
      </div>`).join("");
  }

  function worldCountdown() {
    if (!currentState) return "SIGUIENTE CAMBIO —";
    if (currentState.modo === "manual") return "AUTO PAUSADO";
    const calendar = engine.getCalendar() || {};
    let currentTs = 0;
    if (calendar.timestamp) currentTs = new Date(calendar.timestamp).getTime();
    if (!Number.isFinite(currentTs) || !currentTs) currentTs = currentState.ultimoCambioWorldTs || 0;
    const remaining = Math.max(0, Number(currentState.siguienteCambioWorldTs || 0) - currentTs);
    const minutes = Math.ceil(remaining / 60000);
    if (minutes <= 0) return "CAMBIO PENDIENTE";
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `SIGUIENTE CAMBIO ${hours ? `${hours}H ` : ""}${mins}M`;
  }

  function renderStatus() {
    if (!currentState) return;
    root.querySelector("#weather-director-season").textContent = engine.displaySeason(currentState.estacion).toUpperCase();
    root.querySelector("#weather-next-change").textContent = worldCountdown();
    root.querySelectorAll("[data-weather-mode]").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.weatherMode === currentState.modo);
    });
  }

  function renderAll() {
    if (!root || !currentState) return;
    if (!selectedWeather) selectedWeather = currentState.actual.tipo;
    const all = engine.getDefinitions();
    if (!all[selectedWeather]) selectedWeather = currentState.actual.tipo;
    renderStatus();
    renderGraph();
    renderInspector();
    renderEnvironmentEditor();
    renderHistory();
  }

  function bindEvents() {
    root.addEventListener("click", async (event) => {
      const node = event.target.closest("[data-weather-id]");
      if (node) {
        selectedWeather = node.dataset.weatherId;
        renderGraph();
        renderInspector();
        return;
      }

      const mode = event.target.closest("[data-weather-mode]");
      if (mode) {
        await engine.setMode(mode.dataset.weatherMode);
        return;
      }

      if (event.target.closest("#weather-force-selected")) {
        if (selectedWeather && selectedWeather !== currentState?.actual?.tipo) await engine.forceWeather(selectedWeather);
        return;
      }

      if (event.target.closest("#weather-roll-next")) {
        await engine.rollNext("director");
        return;
      }

      if (event.target.closest("#weather-apply-environment")) {
        await engine.updateEnvironment({
          temperatura: Number(root.querySelector("#weather-env-temperature")?.value),
          humedad: Number(root.querySelector("#weather-env-humidity")?.value),
          viento: Number(root.querySelector("#weather-env-wind")?.value),
          visibilidad: Number(root.querySelector("#weather-env-visibility")?.value),
          intensidad: Number(root.querySelector("#weather-env-intensity")?.value)
        });
      }
    });

    root.addEventListener("input", (event) => {
      if (!event.target.matches(".weather-env-grid input[type='range']")) return;
      const output = root.querySelector(`#${event.target.id}-out`);
      if (!output) return;
      const suffix = event.target.id.includes("temperature") ? "°C" : event.target.id.includes("wind") ? " km/h" : "%";
      output.textContent = `${event.target.value}${suffix}`;
    });
  }

  function mount() {
    const legacyTab = document.getElementById("tab-clima");
    if (!legacyTab || legacyTab.dataset.weatherDirectorMounted === "true") return false;
    legacyTab.dataset.weatherDirectorMounted = "true";
    legacyTab.innerHTML = initialMarkup();
    root = legacyTab.querySelector("#weather-director");
    bindEvents();
    unsubscribe = engine.onChange((nextState) => {
      const oldCurrent = currentState?.actual?.tipo;
      currentState = nextState;
      if (!selectedWeather || selectedWeather === oldCurrent) selectedWeather = nextState.actual.tipo;
      renderAll();
    });
    countdownTimer = global.setInterval(renderStatus, 1000);
    return true;
  }

  function boot() {
    engine = global.LuminousWeatherEngine;
    if (!engine) {
      global.setTimeout(boot, 60);
      return;
    }
    global.setTimeout(() => {
      if (!mount()) global.setTimeout(boot, 250);
    }, 650);
  }

  global.LuminousWeatherDirectorUI = Object.freeze({
    mount: () => { engine = global.LuminousWeatherEngine; return engine ? mount() : false; },
    destroy: () => {
      unsubscribe?.();
      if (countdownTimer) global.clearInterval(countdownTimer);
      unsubscribe = null;
      countdownTimer = null;
    }
  });

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})(window);
