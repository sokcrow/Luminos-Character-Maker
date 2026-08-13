const { test, expect } = require("@playwright/test");
const fs = require("node:fs");
const path = require("node:path");

const dmPage = fs.readFileSync(
  path.join(__dirname, "..", "pantalla_dm.html"),
  "utf8",
);

test("el panel DM mantiene una suscripción en tiempo real a la cola del Teatro", () => {
  expect(dmPage).toContain('db.ref("campaña/teatro/cola").on("value"');
  expect(dmPage).toContain('id="dm-theatre-live-badge"');
  expect(dmPage).toContain("updateTheatreLiveBadge(queueItems.length)");
});

test("el panel DM distingue una cola vacía de una desconexión", () => {
  expect(dmPage).toContain('db.ref(".info/connected").on("value"');
  expect(dmPage).toContain('updateTheatreLiveBadge(queueItems.length, false)');
  expect(dmPage).toContain("Sin conexión en tiempo real con el Teatro");
});
