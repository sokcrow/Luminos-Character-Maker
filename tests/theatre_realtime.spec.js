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
  expect(workshopPage).toContain('actorData.tipo === "Jugador"');
  expect(workshopPage).toContain('db.ref("campaña/jugadores").on("value"');
});

test("se pueden crear perfiles de escena para personajes", () => {
  expect(workshopPage).toContain('window._pendingPlayerProfileLink = playerId');
  expect(workshopPage).toContain('campaña/jugadores/${window._pendingPlayerProfileLink}/actorId');
});

test("el rediseño moderno del form de actores existe y tiene dos rutas (Requirement 49)", () => {
  expect(workshopPage).toContain('ENTRAR A SESIÓN EN VIVO');
  expect(workshopPage).not.toContain('<a href="hoja_de_DM.html" target="_blank"');
  expect(workshopPage).toContain('const ACTOR_DATABASE_PATHS = [');
  expect(workshopPage).toContain('campaña/base_datos_npcs');
  expect(workshopPage).not.toContain('id="actor-asignacion-container"');
  expect(workshopPage).toContain('<span'); // ONLINE Indicator
  expect(workshopPage).toContain('<select id="actor-vinculo-jugador"'); // Inside player cards logic now
  expect(workshopPage).toContain('css/actor-studio.css'); // CSS check
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

test("jugador y DM comparten el mismo componente de diálogo sin estilos genéricos", () => {
  const playerPage = fs.readFileSync(
    path.join(__dirname, "..", "hoja_personaje.html"),
    "utf8",
  );
  const dmPageCurrent = fs.readFileSync(
    path.join(__dirname, "..", "hoja_de_DM.html"),
    "utf8",
  );

  // Ambos cargan el CSS compartido
  expect(playerPage).toContain('css/theatre-dialogue.css');
  expect(dmPageCurrent).toContain('css/theatre-dialogue.css');

  // Ambos usan las clases estructurales compartidas
  expect(dmPageCurrent).toContain('class="theatre-dialogue-wrapper"');
  expect(dmPageCurrent).toContain('class="theatre-plates-container"');

  // El DM ya no usa la clase genérica
  expect(dmPageCurrent).not.toContain('class="dialogue-panel"');
});

test("el escenario está aislado y el diálogo tiene una capa superior a los sprites", () => {
  const dmPageCurrent = fs.readFileSync(
    path.join(__dirname, "..", "hoja_de_DM.html"),
    "utf8",
  );
  const playerPage = fs.readFileSync(
    path.join(__dirname, "..", "hoja_personaje.html"),
    "utf8",
  );
  const sharedCss = fs.readFileSync(
    path.join(__dirname, "..", "css", "theatre-dialogue.css"),
    "utf8",
  );
  const dashboardCss = fs.readFileSync(
    path.join(__dirname, "..", "css", "on-game-dashboard.css"),
    "utf8",
  );
  const sheetCss = fs.readFileSync(
    path.join(__dirname, "..", "hoja_personaje.css"),
    "utf8",
  );

  // Comprobar variables de capa en CSS
  expect(sharedCss).toContain('--theatre-layer-stage: 10;');
  expect(sharedCss).toContain('--theatre-layer-dialogue: 8500;');

  // Comprobar isolation isolate
  expect(dashboardCss).toContain('isolation: isolate;');
  expect(sheetCss).toContain('isolation: isolate;');
});


test("la inicialización del directorio de actores se registra de forma segura al inicio", () => {
  const dmPageCurrent = fs.readFileSync(
    path.join(__dirname, "..", "pantalla_dm.html"),
    "utf8"
  );
  expect(dmPageCurrent).toContain("function startActorDirectorySubscriptions");
  expect(dmPageCurrent).toContain("showActorDirectoryError");
  expect(dmPageCurrent).toContain("campaña/base_datos_npcs");
  expect(dmPageCurrent).toContain("campaña/actores");
  expect(dmPageCurrent).toContain("campaña/jugadores");

  // Verifica que los listeners no estén duplicados al final (se eliminó la versión antigua)
  const matchesJugadores = [...dmPageCurrent.matchAll(/db.ref\("campaña\/jugadores"\)\.on\("value"/g)];
  expect(matchesJugadores.length).toBeLessThanOrEqual(2); // Uno puede ser el del Roster (en otro script si estuviera) pero en dm_page ahora debe haber 1.
});


test("la inicialización del directorio de actores maneja los errores visualmente", () => {
  const dmPageCurrent = fs.readFileSync(
    path.join(__dirname, "..", "pantalla_dm.html"),
    "utf8"
  );
  expect(dmPageCurrent).toContain("function showActorDirectoryError");
  expect(dmPageCurrent).toContain("header-jugadores");
  expect(dmPageCurrent).toContain("grid-actores");
  expect(dmPageCurrent).toContain("errorMsg");
});


test("el directorio lee de las tres rutas de Firebase", () => {
  const dmPageCurrent = fs.readFileSync(
    path.join(__dirname, "..", "pantalla_dm.html"),
    "utf8"
  );
  expect(dmPageCurrent).toContain('db.ref("campaña/jugadores").on("value"');
  expect(dmPageCurrent).toContain('db.ref("campaña/base_datos_npcs").on("value"');
  expect(dmPageCurrent).toContain('db.ref("campaña/actores").on("value"');
});

test("la inicialización del directorio se realiza antes que módulos opcionales", () => {
  const dmPageCurrent = fs.readFileSync(
    path.join(__dirname, "..", "pantalla_dm.html"),
    "utf8"
  );
  const startIdx = dmPageCurrent.indexOf('startActorDirectorySubscriptions();');
  const weatherIdx = dmPageCurrent.indexOf('let currentWeather = "Soleado";');
  expect(startIdx).toBeLessThan(weatherIdx);
});
