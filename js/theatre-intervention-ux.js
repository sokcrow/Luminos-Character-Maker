(function (global) {
  "use strict";

  if (typeof module !== "undefined" && module.exports) {
    const core = require("./theatre-intervention-ux-core.js");
    require("./scene-time-engine.js");
    module.exports = core;
    return;
  }

  function ensure(id, src, onload) {
    let script = document.getElementById(id);
    if (script) {
      if (onload && !script.dataset.loaded) script.addEventListener("load", onload, { once: true });
      return script;
    }
    script = document.createElement("script");
    script.id = id;
    script.src = src;
    script.async = false;
    if (onload) {
      script.addEventListener("load", () => {
        script.dataset.loaded = "true";
        onload();
      }, { once: true });
    }
    document.head?.appendChild(script);
    return script;
  }

  const loadSceneTime = () => ensure(
    "scene-time-v1-runtime-script",
    "js/scene-time-engine.js",
  );

  if (global.LuminousTheatreInterventionUx) loadSceneTime();
  else ensure(
    "theatre-intervention-ux-core-runtime-script",
    "js/theatre-intervention-ux-core.js",
    loadSceneTime,
  );
})(typeof window !== "undefined" ? window : globalThis);
