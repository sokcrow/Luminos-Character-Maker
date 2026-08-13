const { test, expect } = require("@playwright/test");
const fs = require("node:fs");
const path = require("node:path");

const dmPage = fs.readFileSync(
  path.join(__dirname, "..", "hoja_de_DM.html"),
  "utf8",
);
const dashboardScript = fs.readFileSync(
  path.join(__dirname, "..", "js", "on-game-dashboard.js"),
  "utf8",
);
const instanceControl = fs.readFileSync(
  path.join(__dirname, "..", "js", "instance-control.js"),
  "utf8",
);
const workshopPage = fs.readFileSync(
  path.join(__dirname, "..", "pantalla_dm.html"),
  "utf8",
);

test("el centro de mando mantiene una suscripción a la escena del Teatro", () => {
  expect(dashboardScript).toContain('const SCENE_ROOT = "campaña/estado_mundo/escena_actual";');
  expect(dmPage).toContain('id="theatre-stage"');
});

test("el centro de mando muestra el estado de conexión en tiempo real", () => {
  expect(dashboardScript).toContain('db.ref(".info/connected").on("value"');
  expect(dmPage).toContain('id="connection-status"');
});

test("un control opcional de recetas no interrumpe la inicialización del Teatro", () => {
  expect(workshopPage).toContain(
    'document.getElementById("btn-crear-receta")?.addEventListener',
  );
  expect(workshopPage).not.toContain(
    'document.getElementById("btn-crear-receta").addEventListener',
  );
});

test("la instancia conmuta módulos y activa la planeación de combate", () => {
  expect(instanceControl).toContain("function applyDashboardInstance(instance, doc)");
  expect(instanceControl).toContain('updates["campaña/combate/estado"] = "PRE_COMBAT_PLANNING"');
  expect(dmPage).toContain('id="modulo-combate"');
});

test("el taller abre el centro de mando y ya no contiene la vista de ejecución", () => {
  expect(workshopPage).toContain("window.open('hoja_de_DM.html', 'DirectorDashboard', 'width=1920,height=1080')");
  expect(workshopPage).not.toContain('id="theatre-view-dm"');
});

test("los jugadores reciben un apagón reactivo desde Firebase", () => {
  const playerPage = fs.readFileSync(
    path.join(__dirname, "..", "hoja_personaje.html"),
    "utf8",
  );
  expect(playerPage).toContain('id="player-instance-blackout"');
  expect(instanceControl).toContain('combatView.src = "Battle-viewer.html"');
  expect(instanceControl).toContain('combatView.style.display = combatActive ? "block" : "none"');
});
