const { test, expect } = require("@playwright/test");
const fs = require("node:fs");
const path = require("node:path");

const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");
const terminalCss = read("css/player-terminal.css");
const playerHtml = read("hoja_personaje.html");
const utilsSource = read("js/utils.js");
const { ensurePlayerTerminalStyles } = require("../js/utils.js");

const appActions = [
  "profile",
  "mail",
  "banco",
  "contratos",
  "codex",
  "mapa",
  "notas",
  "parts",
  "settings",
];

test("Personal Terminal conserva los nueve módulos funcionales existentes", () => {
  for (const action of appActions) {
    expect(playerHtml).toContain(`name=\"act_tab_${action}\"`);
    expect(terminalCss).toContain(`.sheet-app-btn[name=\"act_tab_${action}\"]`);
  }
});

test("los emojis de home quedan reemplazados visualmente por iconografía vectorial propia", () => {
  expect(terminalCss).toMatch(/\.sheet-app-icon\s*\{[\s\S]*?font-size:\s*0\s*!important/);
  expect(terminalCss).toContain("--terminal-icon: url(\"data:image/svg+xml");
  expect(terminalCss).toContain("mask: var(--terminal-icon) center / contain no-repeat");
});

test("el terminal elimina el mínimo desktop y ocupa el viewport móvil real", () => {
  expect(terminalCss).toContain("min-width: 0 !important;");
  expect(terminalCss).toContain("@media (max-width: 700px)");
  expect(terminalCss).toContain("width: 100dvw !important;");
  expect(terminalCss).toContain("height: 100dvh !important;");
  expect(terminalCss).toContain("env(safe-area-inset-top)");
  expect(terminalCss).toContain("grid-template-columns: repeat(2, minmax(0, 1fr)) !important;");
});

test("el lenguaje visual incluye shell, statusbar, módulos y reduced motion", () => {
  expect(terminalCss).toContain("PERSONAL TERMINAL // CITY NETWORK // AUTHORIZED NODE");
  expect(terminalCss).toContain("LUM-NET / LOCAL LINK");
  expect(terminalCss).toContain("NODE DASHBOARD / AVAILABLE MODULES");
  expect(terminalCss).toContain("SYSTEM MODULE / AUTHORIZED SESSION");
  expect(terminalCss).toContain("@media (prefers-reduced-motion: reduce)");
});

test("utils carga player-terminal.css una sola vez y solo en la hoja del jugador", () => {
  expect(utilsSource).toContain("function ensurePlayerTerminalStyles");
  expect(utilsSource).toContain("css/player-terminal.css");

  const appended = [];
  const elements = new Map();
  const documentMock = {
    querySelector(selector) {
      return selector === ".sheet-phone-wrapper" ? {} : null;
    },
    getElementById(id) {
      return elements.get(id) || null;
    },
    createElement(tag) {
      return { tagName: tag.toUpperCase(), dataset: {} };
    },
    head: {
      appendChild(node) {
        appended.push(node);
        elements.set(node.id, node);
      },
    },
  };

  const first = ensurePlayerTerminalStyles(documentMock);
  const second = ensurePlayerTerminalStyles(documentMock);

  expect(first).toBe(second);
  expect(appended).toHaveLength(1);
  expect(first.id).toBe("player-terminal-stylesheet");
  expect(first.rel).toBe("stylesheet");
  expect(first.href).toBe("css/player-terminal.css");
});

test("utils no inyecta estilos en documentos sin phone wrapper", () => {
  const documentMock = {
    querySelector() { return null; },
  };
  expect(ensurePlayerTerminalStyles(documentMock)).toBeNull();
});
