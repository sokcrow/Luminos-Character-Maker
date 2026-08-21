const { test, expect } = require("@playwright/test");
const fs = require("node:fs");
const path = require("node:path");

const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");
const rolls = read("js/theatre-roll-visualizer.js");
const css = read("css/theatre-roll-visualizer.css");
const instanceControl = read("js/instance-control.js");

test("Theatre muestra tiradas sin tocar diálogo ni sprites", () => {
  expect(rolls).toContain('resolveRollPath');
  expect(rolls).toContain('"campaña/teatro/tiradas"');
  expect(rolls).toContain('limitToLast(8)');
  expect(rolls).toContain('ensureLayer()');
  expect(rolls).toContain('stage.appendChild(layer)');
  expect(rolls).not.toContain('dialogo_activo');
  expect(rolls).not.toContain('actores_visibles');
  expect(rolls).not.toContain('active_actor');
});

test("visualizador conserva un único Coin Engine y deriva las caras del total", () => {
  expect(rolls).toContain('doc.getElementById("coin-toss-panel")');
  expect(rolls).toContain('doc.getElementById("roll-total-score")');
  expect(rolls).toContain('doc.getElementById("coin-toss-close-btn")');
  expect(rolls).toContain('const COIN_COUNT = 5');
  expect(rolls).toContain('const COIN_HEAD_BONUS = 4');
  expect(rolls).toContain('const heads = delta / COIN_HEAD_BONUS');
  expect(rolls).not.toContain('Math.random');
});

test("existen los tres modos visuales acordados", () => {
  for (const value of ['PUBLIC: "public"', 'TOTAL: "total"', 'HIDDEN: "hidden"']) {
    expect(rolls).toContain(value);
  }
  expect(rolls).toContain('data-roll-visibility="public"');
  expect(rolls).toContain('data-roll-visibility="total"');
  expect(rolls).toContain('data-roll-visibility="hidden"');
  expect(rolls).toContain('PÚBLICA');
  expect(rolls).toContain('OCULTA');
});

test("oculta permite nada, éxito/fallo o texto del DM", () => {
  expect(rolls).toContain('NONE: "none"');
  expect(rolls).toContain('OUTCOME: "outcome"');
  expect(rolls).toContain('CUSTOM: "custom"');
  expect(rolls).toContain('ÉXITO');
  expect(rolls).toContain('FALLO');
  expect(rolls).toContain('TEXTO DM');
  expect(rolls).toContain('shouldHideFromPlayer');
});

test("DM controla visibilidad desde config DM-only existente", () => {
  expect(rolls).toContain('const CONFIG_PATH = "campaña/config/theatre_rolls"');
  expect(rolls).toContain('function writeConfig(patch)');
  expect(rolls).toContain('if (!isDmView()) return Promise.resolve(false)');
  expect(rolls).toContain('db.ref(CONFIG_PATH).update(patch)');
});

test("instance-control carga el visualizador tanto en jugador como en ON GAME", () => {
  expect(instanceControl).toContain("function ensureTheatreRollVisualizerAssets");
  expect(instanceControl).toContain("css/theatre-roll-visualizer.css");
  expect(instanceControl).toContain("js/theatre-roll-visualizer.js");
  expect(instanceControl).toContain("ensureTheatreRollVisualizerAssets(documentRef)");
});

test("la tarjeta queda sobre sprites y debajo del diálogo", () => {
  expect(css).toContain("z-index:7000");
  expect(css).toContain("pointer-events:none");
  expect(css).toContain(".theatre-roll-coins");
  expect(css).toContain(".theatre-roll-total");
  expect(css).toContain("@media (prefers-reduced-motion:reduce)");
});

test("queda API pública para futuras tiradas enfrentadas", () => {
  expect(rolls).toContain("global.LuminousTheatreRolls = Object.freeze");
  expect(rolls).toContain("publishRoll,");
  expect(rolls).toContain("VISIBILITY,");
});
