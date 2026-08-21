const { test, expect } = require("@playwright/test");
const fs = require("node:fs");
const path = require("node:path");

const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");
const rolls = read("js/theatre-roll-visualizer.js");
const css = read("css/theatre-roll-visualizer.css");
const instanceControl = read("js/instance-control.js");

test("reutiliza las imágenes reales del Coin Engine", () => {
  expect(rolls).toContain('const HEAD_SRC_MARKER = "yshLPnQ"');
  expect(rolls).toContain('const TAIL_SRC_MARKER = "XDx0ICt"');
  expect(rolls).toContain('const HEAD_SRC = "https://imgur.com/yshLPnQ.png"');
  expect(rolls).toContain('const TAIL_SRC = "https://imgur.com/XDx0ICt.png"');
  expect(rolls).toContain('#coin-toss-coins-container img');
  expect(rolls).toContain('img.className = "theatre-check-coin-image"');
  expect(css).toContain('.theatre-check-coin-image');
  expect(css).toContain('width:60px');
  expect(css).toContain('height:60px');
  expect(css).not.toContain('.theatre-roll-coin[data-side="head"]');
});

test("el HUD completo solo se renderiza en el cliente que está tirando", () => {
  expect(rolls).toContain('function createLocalHud(check)');
  expect(rolls).toContain('function shouldSuppressRemoteForLocalRoller(roll)');
  expect(rolls).toContain('roll?.rollerClientId && roll.rollerClientId === CLIENT_ID');
  expect(rolls).toContain('presentation: "result-only"');
  expect(rolls).toContain('buildRemoteResultCard');
  expect(css).toContain('Full HUD: only rendered locally');
  expect(css).toContain('Remote viewers never receive the full HUD');
});

test("los demás clientes reciben solo nombre total y outcome", () => {
  expect(rolls).toContain('theatre-roll-result-name');
  expect(rolls).toContain('theatre-roll-result-total');
  expect(rolls).toContain('theatre-roll-result-outcome');
  expect(rolls).not.toContain('card.appendChild(buildCoinRow');
  expect(css).toContain('.theatre-roll-result-card');
});

test("threshold aplica neutral ventaja y desventaja", () => {
  expect(rolls).toContain('ADVANTAGE: "advantage"');
  expect(rolls).toContain('DISADVANTAGE: "disadvantage"');
  expect(rolls).toContain('normalized.thresholdRaw - normalized.modifierValue');
  expect(rolls).toContain('normalized.thresholdRaw + normalized.modifierValue');
  expect(rolls).toContain('Number(total) >= threshold');
});

test("X igual a cero elimina el tip y fuerza neutral", () => {
  expect(rolls).toContain('modifierValue > 0 ? normalizeModifier(source.modifierType) : MODIFIER.NEUTRAL');
  expect(rolls).toContain('tipText: modifierValue > 0 ?');
  expect(rolls).toContain('if (normalized.modifierValue > 0 && normalized.tipText)');
});

test("threshold oculto muestra interrogantes solo en HUD local", () => {
  expect(rolls).toContain('normalized.hiddenThreshold ? "??"');
  expect(rolls).toContain('hiddenThreshold: check.hiddenThreshold');
});

test("colores del threshold son neutro amarillo y rojo", () => {
  expect(css).toContain('--neutral:#e1ddd5');
  expect(css).toContain('--advantage:#e7c34d');
  expect(css).toContain('--disadvantage:#d74a40');
  expect(css).toContain('.theatre-check-threshold.advantage .theatre-check-block-value');
  expect(css).toContain('.theatre-check-threshold.disadvantage .theatre-check-block-value');
});

test("no agrega skill o iconos de skill al HUD local", () => {
  expect(rolls).not.toContain('theatre-check-skill');
  expect(rolls).not.toContain('theatre-check-roll-label');
  expect(css).not.toContain('.theatre-check-skill');
});

test("no toca diálogo sprites foco ni crea un segundo motor", () => {
  expect(rolls).not.toContain('dialogo_activo');
  expect(rolls).not.toContain('actores_visibles');
  expect(rolls).not.toContain('active_actor');
  expect(rolls).not.toContain('publishIntervention');
  expect(rolls).not.toContain('currentTotal += 4');
});

test("mantiene API para armar el siguiente check y publicar resultados", () => {
  expect(rolls).toContain('function armCheck(options)');
  expect(rolls).toContain('armCheck,');
  expect(rolls).toContain('publishRoll,');
  expect(rolls).toContain('effectiveThreshold,');
  expect(rolls).toContain('checkOutcome,');
});

test("instance-control sigue cargando los assets", () => {
  expect(instanceControl).toContain('theatre-roll-visualizer.css');
  expect(instanceControl).toContain('theatre-roll-visualizer.js');
});
