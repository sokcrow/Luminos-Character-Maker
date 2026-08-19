const { test, expect } = require("@playwright/test");
const fs = require("node:fs");
const path = require("node:path");

const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");
const dialogueCss = read("css/theatre-dialogue.css");
const instanceControl = read("js/instance-control.js");

function block(source, start, end) {
  const from = source.indexOf(start);
  expect(from).toBeGreaterThanOrEqual(0);
  const to = end ? source.indexOf(end, from) : source.length;
  return source.slice(from, to < 0 ? source.length : to);
}

test("narración y pensamiento pueden ocultar por completo name/title plates", () => {
  expect(dialogueCss).toContain('.theatre-plates-container[style*="display: none"]');
  expect(dialogueCss).toMatch(/theatre-plates-container\[style\*="display: none"\][\s\S]*?display:\s*none\s*!important/);
});

test("el controlador de localización reutiliza el input y solo escribe locacion", () => {
  const locationControl = block(instanceControl, "function ensureDmLocationControl", "function bindDashboard");
  expect(locationControl).toContain('getElementById("theatre-location-input")');
  expect(locationControl).toContain('button.id = "btn-update-theatre-location"');
  expect(locationControl).toContain('db.ref(`${getTheatreScenePath()}/locacion`).set(locationName)');
  expect(locationControl).not.toContain("changeScene");
  expect(locationControl).not.toContain("/fondo");
  expect(locationControl).not.toContain("dialogue");
});

test("hamburguesa del jugador usa glyphs centrados de tamaño fijo", () => {
  expect(dialogueCss).toContain(".hud-sidebar-right .hud-menu-toggle > svg");
  expect(dialogueCss).toContain("width: 26px !important;");
  expect(dialogueCss).toContain("height: 26px !important;");
  expect(dialogueCss).toContain("aspect-ratio: 1 / 1 !important;");
});

test("hamburguesa del DM evita el heptágono SVG duplicado", () => {
  expect(dialogueCss).toMatch(/\.theatre-dm-menu-toggle > img\s*\{[\s\S]*?display:\s*none\s*!important/);
  expect(dialogueCss).toContain(".theatre-dm-menu-toggle::after");
  expect(dialogueCss).toContain("currentColor 7px 9px");
  expect(dialogueCss).toContain("rotate(90deg)");
});

test("viewport del teatro conserva 16:9 y nunca repite el fondo", () => {
  const playerViewport = block(
    dialogueCss,
    "html body.player-instance-theatre #theatre-view-player {",
    "/* En DM reservamos los 64px"
  );
  expect(playerViewport).toContain("width: min(100vw, 177.7778vh) !important;");
  expect(playerViewport).toContain("height: min(100vh, 56.25vw) !important;");
  expect(playerViewport).toContain("aspect-ratio: 16 / 9 !important;");
  expect(playerViewport).toContain("background-size: cover !important;");
  expect(playerViewport).toContain("background-repeat: no-repeat !important;");

  const dmViewport = block(
    dialogueCss,
    "html body.on-game-dashboard #modulo-teatro.game-module {",
    "@media (max-width: 700px)"
  );
  expect(dmViewport).toContain("width: min(100vw, calc(177.7778vh - 113.7778px)) !important;");
  expect(dmViewport).toContain("height: min(calc(100vh - 64px), 56.25vw) !important;");
  expect(dmViewport).toContain("aspect-ratio: 16 / 9 !important;");
  expect(dmViewport).toContain("inset: 64px 0 0 !important;");
  expect(dmViewport).toContain("background-size: cover !important;");
  expect(dmViewport).toContain("background-repeat: no-repeat !important;");
});
