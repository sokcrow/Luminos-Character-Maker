const { test, expect } = require("@playwright/test");
const fs = require("node:fs");
const path = require("node:path");

const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");
const terminalVisibility = read("js/player-terminal-visibility.js");
const terminalOverlay = read("css/player-terminal-overlay.css");
const socialStudio = read("js/character-manager-social-studio.js");
const bondEngine = read("js/bond-engine.js");
const languageUx = read("js/character-manager-language-ux.js");
const domainCss = read("css/character-manager-domain-ux.css");
const utils = read("js/utils.js");

test("el terminal del jugador inicia cerrado y es una herramienta flotante secundaria", () => {
  expect(terminalVisibility).toContain('wrapper.classList.add("phone-hidden")');
  expect(terminalVisibility).toContain('aria-expanded');
  expect(terminalVisibility).toContain('player-terminal-visibility-ready');
  expect(terminalOverlay).toContain('position: fixed !important');
  expect(terminalOverlay).toContain('.sheet-phone-wrapper.phone-hidden');
  expect(terminalOverlay).toContain('pointer-events: none !important');
  expect(utils).toContain('ensurePlayerTerminalVisibility');
  expect(utils).toContain('js/player-terminal-visibility.js');
  expect(utils).toContain('css/player-terminal-overlay.css');
});

test("solo el contexto DM monta la administración de vínculos", () => {
  expect(socialStudio).toContain('doc?.getElementById("dashboard-actores")');
  expect(socialStudio).toContain('SOLO DM');
  expect(socialStudio).toContain('character-manager-bond-player');
  expect(socialStudio).toContain('character-manager-add-bond');
  expect(socialStudio).toContain('bonds.setBond');
  expect(socialStudio).toContain('bonds.clearBond');
  expect(bondEngine).toContain('campaña/estado_mundo/vinculos');
  expect(domainCss).toContain('.cm-bond-admin-bar');
});

test("Vínculos no crea una fila editable para cada jugador automáticamente", () => {
  expect(socialStudio).toContain('const existing = activeBonds(actorId)');
  expect(socialStudio).toContain('Object.entries(existing)');
  expect(socialStudio).toContain('SIN VÍNCULOS REGISTRADOS');
  expect(socialStudio).toContain('SELECCIONAR JUGADOR');
});

test("Idiomas elimina el switch ambiguo de lenguas normales", () => {
  expect(languageUx).toContain('toggle.hidden = true');
  expect(languageUx).toContain('DOMINIO');
  expect(languageUx).toContain('HABLA');
  expect(languageUx).toContain('DECODIFICA');
  expect(languageUx).toContain('languageId === "common"');
  expect(languageUx).toContain('range.value = "100"');
  expect(domainCss).toContain('.cm-distortion-toggle[hidden]');
  expect(utils).toContain('js/character-manager-language-ux.js');
});

test("el control especial solo explica decodificación para idiomas de distorsión", () => {
  expect(languageUx).toContain('definition?.distortion === true');
  expect(languageUx).toContain('entiende este idioma especial aunque su capacidad para hablarlo sea 0');
  expect(languageUx).toContain('HABLA controla si puede usar el idioma');
  expect(languageUx).toContain('DECODIFICA controla si puede entender su forma especial');
});
