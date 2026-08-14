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
  expect(dashboardScript).toContain('SCENE_ROOT + "/actores").on("value"');
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

test("el grid de personajes jugadores existe y se separa de los NPCs", () => {
  expect(workshopPage).toContain('id="grid-personajes-jugadores"');
  expect(workshopPage).toContain('actorData.tipo === "Jugador" || actorData.vinculo_jugador');
  expect(workshopPage).toContain('db.ref("campaña/jugadores").on("value"');
});

test("se pueden crear perfiles de escena para personajes", () => {
  expect(workshopPage).toContain('window._pendingPlayerProfileLink = playerId');
  expect(workshopPage).toContain('campaña/jugadores/${window._pendingPlayerProfileLink}/actorId');
});

test("la biblioteca de escenarios contiene los controles y utiliza update", () => {
  expect(dmPage).toContain('id="theatre-scenario-select"');
  expect(dmPage).toContain('id="theatre-scenario-location-filter"');
  expect(dmPage).toContain('id="theatre-scenario-tag-filter"');
  expect(dashboardScript).toContain('db.ref(SCENARIOS_ROOT).on("value"');
  expect(dashboardScript).toContain('db.ref(SCENE_ROOT).update({');
});

test("el guardado de escenarios procesa sub-etiquetas", () => {
  expect(dashboardScript).toContain('sub_etiquetas: subEtiquetas');
});

test("el teatro permite selectores de hablante y expresiones", () => {
  expect(dmPage).toContain('id="theatre-speaker-select"');
  expect(dmPage).toContain('id="theatre-expression-select"');
  expect(dashboardScript).toContain('speakerData.actorId = speakerSelect.value');
});

test("el mensaje enviado a la cola contiene datos de actor y colores", () => {
  expect(dashboardScript).toContain('actorId: speakerData.actorId');
  expect(dashboardScript).toContain('expression: speakerData.expression');
  expect(dashboardScript).toContain('color_nombre: speakerData.color_nombre');
});

test("el motor del teatro utiliza el actorId para iluminar y colorea el diálogo", () => {
  const engineScript = fs.readFileSync(
    path.join(__dirname, "..", "js", "theatre-engine.js"),
    "utf8",
  );
  expect(engineScript).toContain('const activeActorId = dialogData.actorId');
  expect(engineScript).toContain('nameEl.style.color = dialogData.color_nombre');
});

test("el centro de mando reacciona a los cambios de locación", () => {
  const engineScript = fs.readFileSync(
    path.join(__dirname, "..", "js", "theatre-engine.js"),
    "utf8",
  );
  expect(engineScript).toContain('db.ref(`${THEATRE_ROOT}/locacion`).on("value"');
});

test("las reglas de base de datos restringen el acceso a los escenarios", () => {
  const dbRules = fs.readFileSync(
    path.join(__dirname, "..", "database.rules.json"),
    "utf8",
  );
  expect(dbRules).toContain('"escenarios": {');
  expect(dbRules).toContain('auth.uid === \'e9JwFZrtk6g8UMqq2Hf9EHVY7Ay1\'');
});
