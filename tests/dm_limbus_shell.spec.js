const { test, expect } = require("@playwright/test");
const fs = require("node:fs");
const path = require("node:path");

const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");
const actorCss = read("css/actor-studio.css");
const shellCss = read("css/dm-limbus-shell.css");
const shellFixesCss = read("css/dm-limbus-shell-fixes.css");
const dmHtml = read("pantalla_dm.html");

const tabs = [
  "tab-tiempo",
  "tab-clima",
  "tab-turnos",
  "tab-combate",
  "dashboard-actores",
  "dashboard-jugadores",
  "tab-comms",
  "tab-banco",
  "tab-forja",
  "tab-loot",
  "tab-keywords",
  "tab-acceso",
];

test("DM shell loads through the existing actor studio stylesheet entrypoint", () => {
  expect(actorCss.trimStart().startsWith('@import url("dm-limbus-shell.css");')).toBeTruthy();
  expect(actorCss).toContain('@import url("dm-limbus-shell-fixes.css");');
  expect(dmHtml).toContain('<link rel="stylesheet" href="css/actor-studio.css" />');
});

test("DM control deck keeps every existing data-tab contract while giving it a module code", () => {
  for (const tab of tabs) {
    expect(dmHtml).toContain(`data-tab="${tab}"`);
    expect(shellCss).toContain(`data-tab="${tab}"`);
  }
  expect(dmHtml).toContain('id="btn-modo-director"');
  expect(shellCss).toContain(".btn-modo-director");
});

test("visible module order follows the 01-12 taxonomy regardless of legacy DOM order", () => {
  tabs.forEach((tab, index) => {
    const order = index + 1;
    expect(shellFixesCss).toContain(`.dm-tab-btn[data-tab="${tab}"] { order: ${order}; }`);
  });
  expect(shellFixesCss).toContain(".btn-modo-director { order: 13; }");
});

test("shell is scoped to the DM navigation and does not replace tab visibility logic", () => {
  expect(shellCss).toContain("body:has(.dm-tabs-nav)");
  expect(shellCss).toContain(".dm-tabs-content > .dm-tab-pane");
  expect(shellCss).not.toMatch(/\.dm-tab-pane\s*\{[^}]*display\s*:\s*none/is);
  expect(shellCss).not.toContain("data-tab =");
});

test("active, live-session and mobile states have dedicated visual treatment", () => {
  expect(shellCss).toContain(".dm-tab-btn.active");
  expect(shellCss).toContain("DIRECTOR / DEPLOY");
  expect(shellCss).toContain("@media (max-width: 640px)");
  expect(shellCss).toContain("overflow-x: auto");
  expect(shellCss).toContain("scroll-snap-type: x proximity");
});

test("mobile cyber forms stay inside clipped director panels", () => {
  expect(shellFixesCss).toContain("@media (max-width: 768px)");
  expect(shellFixesCss).toContain(".panel-cyber .form-cyber");
  expect(shellFixesCss).toContain("box-sizing: border-box !important");
  expect(shellFixesCss).toContain("min-width: 0 !important");
  expect(shellFixesCss).toContain("max-width: 100% !important");
});

test("generic DM panels are reframed without erasing semantic state colors inside modules", () => {
  expect(shellCss).toContain(".dm-tabs-content > .dm-tab-pane > .panel-cyber");
  expect(shellCss).toContain("DIRECTOR MODULE");
  expect(shellCss).toContain("Tame generic cyan glow without touching semantic state colors inside modules");
  expect(shellCss).not.toMatch(/#rol-turns-container[^}]*color\s*:/i);
});

test("reduced motion users do not get the panel entrance animation", () => {
  expect(shellCss).toContain("@media (prefers-reduced-motion: reduce)");
  expect(shellCss).toContain("animation: none");
});
