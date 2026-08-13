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

test("un control opcional de recetas no interrumpe la inicialización del Teatro", () => {
  expect(dmPage).toContain(
    'document.getElementById("btn-crear-receta")?.addEventListener',
  );
  expect(dmPage).not.toContain(
    'document.getElementById("btn-crear-receta").addEventListener',
  );
});

test("la instancia del DM aplica la vista reactiva sin botón intermedio", () => {
  expect(dmPage).toContain("function applyDmInstance(instance)");
  expect(dmPage).toContain("applyDmInstance(selectedInstance)");
  expect(dmPage).toContain("applyDmInstance(val)");
  expect(dmPage).not.toContain('id="btn-modo-director"');
});

test("el teatro del DM conserva un listener persistente para la escena activa", () => {
  expect(dmPage).toContain(
    'db.ref("campaña/teatro/estado_actual").on("value"',
  );
  expect(dmPage).toContain('id="theatre-stage-container"');
});

test("los jugadores reciben un apagón reactivo desde Firebase", () => {
  const playerPage = fs.readFileSync(
    path.join(__dirname, "..", "hoja_personaje.html"),
    "utf8",
  );
  expect(playerPage).toContain('id="player-instance-blackout"');
  expect(playerPage).toContain(
    'document.body.classList.toggle("instance-blackout", blackoutActive)',
  );
  expect(playerPage).toContain(
    'theatreView.style.display = theatreActive ? "flex" : "none"',
  );
});
