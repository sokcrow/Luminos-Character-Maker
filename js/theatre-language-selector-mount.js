(function (global) {
  "use strict";

  if (!global.document?.body?.classList.contains("on-game-dashboard")) return;
  if (global.LuminousTheatreLanguageSelectorMount) return;

  function ensureSelector() {
    let select = document.getElementById("theatre-language-select");
    if (select) return select;

    const speaker = document.getElementById("theatre-speaker-select");
    const expression = document.getElementById("theatre-expression-select");
    const row = speaker?.parentElement || expression?.parentElement;
    if (!row) return null;

    select = document.createElement("select");
    select.id = "theatre-language-select";
    select.setAttribute("aria-label", "Idioma de la intervención");
    select.title = "Idioma";
    select.style.cssText = "flex:1;padding:9px;background:#121820;color:white;border:1px solid #53606d;min-width:130px;";

    if (expression && expression.parentElement === row) row.insertBefore(select, expression);
    else row.appendChild(select);

    global.LuminousTheatreLanguagePolicy?.refresh?.();
    return select;
  }

  const observer = new MutationObserver(() => ensureSelector());
  observer.observe(document.documentElement, { childList: true, subtree: true });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", ensureSelector, { once: true });
  } else {
    ensureSelector();
  }

  global.LuminousTheatreLanguageSelectorMount = Object.freeze({ ensureSelector });
})(window);
