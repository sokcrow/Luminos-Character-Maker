(function (global) {
  "use strict";

  const doc = global.document;
  if (!doc?.getElementById("dashboard-actores")) return;
  if (global.LuminousCharacterLanguageUx) return;

  let manager = null;
  let observer = null;
  let retryTimer = null;

  function getManager() {
    manager = manager || global.LuminousCharacterManager || null;
    return manager;
  }

  function definitions() {
    const current = getManager();
    if (!current?.listLanguages) return {};
    return Object.fromEntries(current.listLanguages().map(({ languageId, language }) => [languageId, language || {}]));
  }

  function isDistortion(definition) {
    const type = String(definition?.tipo || definition?.type || "").toLowerCase();
    return definition?.distortion === true || type === "distortion" || type === "distorsion";
  }

  function isCommon(languageId, definition) {
    return languageId === "common" || definition?.universal === true;
  }

  function ensureBadge(nameHost, text, className) {
    if (!nameHost || nameHost.querySelector(`.${className}`)) return;
    const badge = doc.createElement("span");
    badge.className = className;
    badge.textContent = text;
    nameHost.appendChild(badge);
  }

  function decorateRow(row, languageMap) {
    const languageId = row?.dataset?.languageId;
    if (!languageId) return;
    const definition = languageMap[languageId] || {};
    const distortion = isDistortion(definition);
    const common = isCommon(languageId, definition);
    const nameHost = row.querySelector(".cm-language-name");
    const range = row.querySelector(".cm-language-range");
    const percent = row.querySelector(".cm-language-percent");
    const meter = row.querySelector(".cm-language-meter");
    const toggle = row.querySelector(".cm-distortion-toggle");
    const checkbox = toggle?.querySelector("input");
    const label = String(definition?.nombre || definition?.name || languageId);

    row.classList.toggle("cm-language-row--distortion", distortion);
    row.classList.toggle("cm-language-row--common", common);
    row.dataset.languageMeaning = common ? "default" : distortion ? "special" : "standard";

    if (meter && !meter.querySelector(".cm-language-domain-label")) {
      const caption = doc.createElement("span");
      caption.className = "cm-language-domain-label";
      caption.textContent = distortion ? "HABLA" : "DOMINIO";
      meter.prepend(caption);
    } else if (meter?.querySelector(".cm-language-domain-label")) {
      meter.querySelector(".cm-language-domain-label").textContent = distortion ? "HABLA" : "DOMINIO";
    }

    if (range) range.setAttribute("aria-label", distortion ? `Capacidad para hablar ${label}` : `Dominio de ${label}`);
    if (percent) percent.setAttribute("aria-label", distortion ? `Porcentaje para hablar ${label}` : `Porcentaje de dominio de ${label}`);

    if (common) {
      ensureBadge(nameHost, "DEFAULT", "cm-language-badge");
      if (range) {
        range.value = "100";
        range.disabled = true;
      }
      if (percent) {
        percent.value = "100";
        percent.disabled = true;
      }
      if (toggle) toggle.hidden = true;
      if (checkbox) checkbox.checked = false;
      row.title = "Común es el idioma predeterminado y siempre está disponible.";
      return;
    }

    if (!distortion) {
      if (toggle) toggle.hidden = true;
      if (checkbox) checkbox.checked = false;
      row.title = "DOMINIO: 0 no conoce el idioma; 100 lo habla y entiende con fluidez.";
      return;
    }

    if (toggle) {
      toggle.hidden = false;
      toggle.title = "DECODIFICA: entiende este idioma especial aunque su capacidad para hablarlo sea 0.";
      if (!toggle.querySelector(".cm-distortion-copy")) {
        const copy = doc.createElement("b");
        copy.className = "cm-distortion-copy";
        copy.textContent = "DECODIFICA";
        toggle.appendChild(copy);
      }
    }
    if (checkbox) checkbox.setAttribute("aria-label", `Decodifica ${label}`);
    row.title = "HABLA controla si puede usar el idioma. DECODIFICA controla si puede entender su forma especial.";
  }

  function decorate() {
    const host = doc.getElementById("character-manager-languages");
    if (!host || !getManager()) return false;
    const languageMap = definitions();
    host.querySelectorAll(".cm-language-row").forEach((row) => decorateRow(row, languageMap));
    return true;
  }

  function install() {
    if (!getManager()) return false;
    const host = doc.getElementById("character-manager-languages");
    if (!host) return false;
    decorate();
    if (!observer) {
      observer = new MutationObserver(() => decorate());
      observer.observe(host, { childList: true, subtree: true });
    }
    manager.subscribeLanguages?.(() => global.setTimeout(decorate, 0));
    return true;
  }

  function boot() {
    if (install()) return;
    if (retryTimer) return;
    retryTimer = global.setInterval(() => {
      if (install()) {
        global.clearInterval(retryTimer);
        retryTimer = null;
      }
    }, 100);
  }

  boot();
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", boot, { once: true });

  global.LuminousCharacterLanguageUx = Object.freeze({ decorate, isDistortion, isCommon });
})(window);
