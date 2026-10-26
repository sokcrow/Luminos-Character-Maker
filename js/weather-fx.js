(function (global) {
  "use strict";

  if (global.LuminousWeatherFX) return;

  let engine = null;
  let currentState = null;
  let unsubscribe = null;
  let observer = null;

  function buildSnow() {
    return Array.from({ length: 32 }, (_, index) => `<i style="--i:${index};--x:${(index * 37) % 100};--d:${6 + (index % 8)};--s:${2 + (index % 5)}"></i>`).join("");
  }

  function ensureLayer(stage) {
    if (!stage || stage.querySelector(":scope > .weather-fx-layer")) return;
    const layer = document.createElement("div");
    layer.className = "weather-fx-layer";
    layer.setAttribute("aria-hidden", "true");
    layer.innerHTML = `
      <div class="weather-fx-darken"></div>
      <div class="weather-fx-fog"></div>
      <div class="weather-fx-rain"></div>
      <div class="weather-fx-snow">${buildSnow()}</div>
      <div class="weather-fx-hail"></div>
      <div class="weather-fx-lightning"></div>
      <div class="weather-fx-heat"></div>`;
    stage.appendChild(layer);
  }

  function findStages() {
    const stages = new Set();
    document.querySelectorAll("#theatre-stage").forEach((stage) => stages.add(stage));
    return [...stages];
  }

  function applyToStage(stage) {
    if (!stage || !currentState) return;
    ensureLayer(stage);
    const layer = stage.querySelector(":scope > .weather-fx-layer");
    if (!layer) return;

    const actual = currentState.actual;
    const type = actual.tipo;
    const intensity = Math.max(0, Math.min(100, Number(actual.intensidad) || 0));
    const wind = Math.max(0, Math.min(120, Number(actual.viento) || 0));
    const humidity = Math.max(0, Math.min(100, Number(actual.humedad) || 0));

    layer.dataset.weather = type;
    layer.dataset.precipitation = ["llovizna", "lluvia", "tormenta", "granizo"].includes(type) ? "rain" : ["nieve", "nevada"].includes(type) ? "snow" : "none";
    layer.dataset.fog = type === "niebla" || (humidity >= 90 && type === "nublado") ? "true" : "false";
    layer.dataset.storm = type === "tormenta" ? "true" : "false";
    layer.dataset.hail = type === "granizo" ? "true" : "false";
    layer.dataset.heat = actual.temperatura >= 30 && ["soleado", "parcialmente_nublado"].includes(type) ? "true" : "false";
    layer.style.setProperty("--weather-intensity", String(intensity / 100));
    layer.style.setProperty("--weather-wind", String(wind / 120));
    layer.style.setProperty("--weather-visibility", String(Math.max(0.15, (Number(actual.visibilidad) || 100) / 100)));
  }

  function render() {
    findStages().forEach(applyToStage);
  }

  function bootObserver() {
    if (observer || !document.body) return;
    observer = new MutationObserver((mutations) => {
      let shouldRender = false;
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (!(node instanceof Element)) continue;
          if (node.id === "theatre-stage" || node.querySelector?.("#theatre-stage")) {
            shouldRender = true;
            break;
          }
        }
        if (shouldRender) break;
      }
      if (shouldRender) render();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function boot() {
    engine = global.LuminousWeatherEngine;
    if (!engine) {
      global.setTimeout(boot, 60);
      return;
    }
    unsubscribe = engine.onChange((next) => {
      currentState = next;
      render();
    });
    bootObserver();
    render();
  }

  global.LuminousWeatherFX = Object.freeze({
    render,
    destroy: () => {
      unsubscribe?.();
      observer?.disconnect?.();
      unsubscribe = null;
      observer = null;
    }
  });

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})(window);
