const { test, expect } = require("@playwright/test");
const fs = require("node:fs");
const path = require("node:path");

const dmPage = fs.readFileSync(
  path.join(__dirname, "..", "hoja_de_DM.html"),
  "utf8"
);
const dashboardScript = fs.readFileSync(
  path.join(__dirname, "..", "js", "on-game-dashboard.js"),
  "utf8"
);
const instanceControl = fs.readFileSync(
  path.join(__dirname, "..", "js", "instance-control.js"),
  "utf8"
);
const workshopPage = fs.readFileSync(
  path.join(__dirname, "..", "pantalla_dm.html"),
  "utf8"
);

test("el centro de mando mantiene una suscripción a la escena del Teatro", () => {
  expect(dashboardScript).toContain('database.ref(`${paths().scene}/actores`).on("value"');
  expect(dmPage).toContain('id="theatre-stage"');
});

test("el centro de mando muestra el estado de conexión en tiempo real", () => {
  expect(dashboardScript).toContain('database.ref(".info/connected").on("value"');
  expect(dmPage).toContain('id="connection-status"');
});

test("un control opcional de recetas no interrumpe la inicialización del Teatro", () => {
  expect(workshopPage).toContain(
    'document.getElementById("btn-crear-receta")?.addEventListener'
  );
  expect(workshopPage).not.toContain(
    'document.getElementById("btn-crear-receta").addEventListener'
  );
});

test("la instancia conmuta módulos y activa la planeación de combate", () => {
  expect(instanceControl).toContain(
    "function applyDashboardInstance(instance, doc)"
  );
  expect(instanceControl).toContain(
    'updates["campaña/combate/estado"] = "PRE_COMBAT_PLANNING"'
  );
  expect(dmPage).toContain('id="modulo-combate"');
});

test("el taller abre el centro de mando y ya no contiene la vista de ejecución", () => {
  expect(workshopPage).toContain(
    "window.open('hoja_de_DM.html', 'DirectorDashboard', 'width=1920,height=1080')"
  );
  expect(workshopPage).not.toContain('id="theatre-view-dm"');
});

test("los jugadores reciben un apagón reactivo desde Firebase", () => {
  const playerPage = fs.readFileSync(
    path.join(__dirname, "..", "hoja_personaje.html"),
    "utf8"
  );
  expect(playerPage).toContain('id="player-instance-blackout"');
  expect(instanceControl).toContain('combatView.src = "Battle-viewer.html"');
  expect(instanceControl).toContain(
    'combatView.style.display = combatActive ? "block" : "none"'
  );
});

test("el grid de personajes jugadores existe y se separa de los NPCs", () => {
  expect(workshopPage).toContain('id="grid-personajes-jugadores"');
  expect(workshopPage).toContain('actorData.tipo === "Jugador"');
  expect(workshopPage).toContain('db.ref("campaña/jugadores").on("value"');
});

test("se pueden crear perfiles de escena para personajes", () => {
  expect(workshopPage).toContain("window._pendingPlayerProfileLink = playerId");
  expect(workshopPage).toContain(
    "campaña/jugadores/${window._pendingPlayerProfileLink}/actorId"
  );
});

test("el rediseño moderno del form de actores existe y tiene dos rutas (Requirement 49)", () => {
  expect(workshopPage).toContain("ENTRAR A SESIÓN EN VIVO");
  expect(workshopPage).not.toContain(
    '<a href="hoja_de_DM.html" target="_blank"'
  );
  expect(workshopPage).toContain("const ACTOR_DATABASE_PATHS = [");
  expect(workshopPage).toContain("campaña/base_datos_npcs");
  expect(workshopPage).not.toContain('id="actor-asignacion-container"');
  expect(workshopPage).toContain("<span"); // ONLINE Indicator
  expect(workshopPage).toContain('<select id="actor-vinculo-jugador"'); // Inside player cards logic now
  expect(workshopPage).toContain("css/actor-studio.css"); // CSS check
});

test("la biblioteca de escenarios contiene los controles y entra por changeScene", () => {
  expect(dmPage).toContain('id="theatre-scenario-select"');
  expect(dmPage).toContain('id="theatre-scenario-location-filter"');
  expect(dmPage).toContain('id="theatre-scenario-tag-filter"');
  expect(dashboardScript).toContain('database.ref(SCENARIOS_ROOT).on("value"');
  expect(dashboardScript).toContain("await theatre.changeScene");
});

test("el guardado de escenarios procesa sub-etiquetas", () => {
  expect(dashboardScript).toContain("sub_etiquetas: normalizedTags()");
});

test("el teatro permite selectores de hablante y expresiones", () => {
  expect(dmPage).toContain('id="theatre-speaker-select"');
  expect(dmPage).toContain('id="theatre-expression-select"');
  expect(dashboardScript).toContain("actorId: speakerSelect.value");
});

test("el mensaje enviado a la cola contiene datos de actor y colores", () => {
  expect(dashboardScript).toContain("actorId: speaker.actorId");
  expect(dashboardScript).toContain("expression: actorDialogue ? speaker.expression : null");
  expect(dashboardScript).toContain("color_nombre: speaker.color_nombre");
});

test("el motor del teatro utiliza el actorId para iluminar y colorea el diálogo", () => {
  const engineScript = fs.readFileSync(
    path.join(__dirname, "..", "js", "theatre-engine.js"),
    "utf8"
  );
  expect(engineScript).toContain("const activeActorId = dialogData?.actorId || currentScene?.active_actor || null");
  expect(engineScript).toContain(
    "paintIdentityPlate(nameEl, currentDialogue.color_nombre)"
  );
});

test("el color de titulo aplica a la placa de titulo y no al texto (Requisito de teatro)", () => {
  const engineScript = fs.readFileSync(
    path.join(__dirname, "..", "js", "theatre-engine.js"),
    "utf8"
  );

  expect(engineScript).toContain('const plateColor = getSafeCssColor(value, "#4a4a4a");');
  expect(engineScript).toContain('element.style.setProperty("color", "#ffffff", "important");');
  expect(engineScript).toContain('`linear-gradient(90deg, ${plateColor} 0%, ${plateColor} 68%, #17110b 100%)`');
  expect(engineScript).toContain('element.style.setProperty("border-left-color", plateColor, "important");');
  expect(engineScript).not.toContain("titleEl.style.color = dialogData.color_titulo");
  expect(engineScript).not.toContain("nameEl.style.color = dialogData.color_nombre");
});

test("el centro de mando reacciona a los cambios de locación", () => {
  const engineScript = fs.readFileSync(
    path.join(__dirname, "..", "js", "theatre-engine.js"),
    "utf8"
  );
  expect(engineScript).toContain('locacionEl.textContent = currentScene.locacion || "LOCALIZACIÓN DESCONOCIDA"');
  expect(engineScript).toContain('sceneRef.on("value", sceneListener)');
});

test("las reglas de base de datos restringen el acceso a los escenarios", () => {
  const dbRules = fs.readFileSync(
    path.join(__dirname, "..", "database.rules.json"),
    "utf8"
  );
  expect(dbRules).toContain('"escenarios": {');
  expect(dbRules).toContain("auth.uid === 'e9JwFZrtk6g8UMqq2Hf9EHVY7Ay1'");
});

test("jugador y DM comparten el mismo componente de diálogo sin estilos genéricos", () => {
  const playerPage = fs.readFileSync(
    path.join(__dirname, "..", "hoja_personaje.html"),
    "utf8"
  );
  const dmPageCurrent = fs.readFileSync(
    path.join(__dirname, "..", "hoja_de_DM.html"),
    "utf8"
  );

  // Ambos cargan el CSS compartido
  expect(playerPage).toContain("css/theatre-dialogue.css");
  expect(dmPageCurrent).toContain("css/theatre-dialogue.css");

  // Ambos usan las clases estructurales compartidas
  expect(dmPageCurrent).toContain('class="theatre-dialogue-wrapper"');
  expect(dmPageCurrent).toContain('class="theatre-plates-container"');

  // El DM ya no usa la clase genérica
  expect(dmPageCurrent).not.toContain('class="dialogue-panel"');
});

test("el escenario está aislado y el diálogo tiene una capa superior a los sprites", () => {
  const dmPageCurrent = fs.readFileSync(
    path.join(__dirname, "..", "hoja_de_DM.html"),
    "utf8"
  );
  const playerPage = fs.readFileSync(
    path.join(__dirname, "..", "hoja_personaje.html"),
    "utf8"
  );
  const sharedCss = fs.readFileSync(
    path.join(__dirname, "..", "css", "theatre-dialogue.css"),
    "utf8"
  );
  const dashboardCss = fs.readFileSync(
    path.join(__dirname, "..", "css", "on-game-dashboard.css"),
    "utf8"
  );
  const sheetCss = fs.readFileSync(
    path.join(__dirname, "..", "hoja_personaje.css"),
    "utf8"
  );

  // Comprobar variables de capa en CSS
  expect(sharedCss).toContain("--theatre-layer-stage: 10;");
  expect(sharedCss).toContain("--theatre-layer-dialogue: 8500;");

  // Comprobar isolation isolate
  expect(dashboardCss).toContain("isolation: isolate;");
  expect(sheetCss).toContain("isolation: isolate;");
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

  // Verifica que cada listener del directorio aparezca exactamente una vez (con la firma exacta del directorio)
  const matchesJugadores = [
    ...dmPageCurrent.matchAll(
      /db\.ref\("campaña\/jugadores"\)\.on\("value", \(snapshot\) => \{\s*clearActorDirectoryError/g
    ),
  ];
  expect(matchesJugadores.length).toBe(1);

  const matchesNpcs = [
    ...dmPageCurrent.matchAll(
      /db\.ref\("campaña\/base_datos_npcs"\)\.on\("value", \(snapshot\) => \{\s*clearActorDirectoryError/g
    ),
  ];
  expect(matchesNpcs.length).toBe(1);

  const matchesActores = [
    ...dmPageCurrent.matchAll(
      /db\.ref\("campaña\/actores"\)\.on\("value", \(snapshot\) => \{\s*clearActorDirectoryError/g
    ),
  ];
  expect(matchesActores.length).toBe(1);
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
  expect(dmPageCurrent).toContain(
    'db.ref("campaña/base_datos_npcs").on("value"'
  );
  expect(dmPageCurrent).toContain('db.ref("campaña/actores").on("value"');
});

test("la inicialización del directorio se realiza antes que módulos opcionales", () => {
  const dmPageCurrent = fs.readFileSync(
    path.join(__dirname, "..", "pantalla_dm.html"),
    "utf8"
  );
  const startIdx = dmPageCurrent.indexOf("startActorDirectorySubscriptions();");
  const weatherIdx = dmPageCurrent.indexOf('let currentWeather = "Soleado";');
  expect(startIdx).toBeLessThan(weatherIdx);
});

test("los actores sin color delegan en el fallback gris de las placas", () => {
  const dashboardScript = fs.readFileSync(
    path.join(__dirname, "..", "js", "on-game-dashboard.js"),
    "utf8"
  );
  const controlsScript = fs.readFileSync(
    path.join(__dirname, "..", "js", "theatre-controls.js"),
    "utf8"
  );

  expect(dashboardScript).toContain('option.dataset.colorNombre = actor.color_nombre || "";');
  expect(dashboardScript).toContain('option.dataset.colorTitulo = actor.color_titulo || "";');
  expect(controlsScript).toContain('color_nombre: npcData.color_nombre || ""');
  expect(controlsScript).toContain('color_titulo: npcData.color_titulo || ""');
  expect(dashboardScript).not.toMatch(/color_titulo:.*#aaaaaa/);
  expect(controlsScript).not.toMatch(/color_titulo:.*#aaaaaa/);
});

test("el fallback de color para las identidades es gris y el texto siempre es blanco", () => {
  const engineScript = fs.readFileSync(path.join(__dirname, "..", "js", "theatre-engine.js"), "utf8");
  expect(engineScript).toContain('const plateColor = getSafeCssColor(value, "#4a4a4a");');
  expect(engineScript).toContain('element.style.setProperty("color", "#ffffff", "important");');
  expect(engineScript).toContain('`linear-gradient(90deg, ${plateColor} 0%, ${plateColor} 68%, #17110b 100%)`');
});

test("el narrador y pensamientos no envían identidad ni modifican sprites", () => {
  const dashboardScript = fs.readFileSync(path.join(__dirname, "..", "js", "on-game-dashboard.js"), "utf8");
  const engineScript = fs.readFileSync(path.join(__dirname, "..", "js", "theatre-engine.js"), "utf8");
  expect(dashboardScript).toContain('type = "narracion";');
  expect(dashboardScript).toContain('expression: actorDialogue ? speaker.expression : null');
  expect(dashboardScript).toContain('sprite: actorDialogue ? speaker.sprite : null');
  expect(dashboardScript).toContain('mostrar_identidad: actorDialogue');
  expect(engineScript).toContain('if (type === "pensamiento" || dialogData?.mostrar_identidad === false)');
});

test("el composer del jugador muestra selector solo cuando hay mas de un personaje", () => {
  const playerScript = fs.readFileSync(path.join(__dirname, "..", "hoja_personaje.js"), "utf8");
  const engineScript = fs.readFileSync(path.join(__dirname, "..", "js", "theatre-engine.js"), "utf8");
  expect(engineScript).toContain('actorSelect.id = "player-actor-select"');
  expect(engineScript).toContain('typeSelect.id = "player-tipo-dialogo-select"');
  expect(playerScript).toContain('selectActor.style.display = "none"');
  expect(playerScript).toContain('selectActor.style.display = "block"');
});

test("resizeFontToFit modifica el tamaño directamente reduciendo px", () => {
  const engineScript = fs.readFileSync(path.join(__dirname, "..", "js", "theatre-engine.js"), "utf8");
  expect(engineScript).toContain('textEl.style.fontSize = `${size}px`;');
});

test("el log usa icono universal y no sprite", () => {
  const playerScript = fs.readFileSync(path.join(__dirname, "..", "hoja_personaje.js"), "utf8");
  const engineScript = fs.readFileSync(path.join(__dirname, "..", "js", "theatre-engine.js"), "utf8");
  const renderBlock = playerScript.slice(playerScript.indexOf("function resolveTheatreLogIcon"), playerScript.indexOf("// === ENVÍO AL TEATRO"));
  expect(renderBlock).toContain('return msg.icono || cachedIcon || fallbackIcon;');
  expect(renderBlock).not.toContain("msg.sprite");
  expect(engineScript).toContain('src.includes("via.placeholder.com")');
  expect(engineScript).toContain("data:image/svg+xml");
});

test("sprites en escenario respetan max 5 visibles sin mover al hablante ya visible", () => {
  const engineScript = fs.readFileSync(path.join(__dirname, "..", "js", "theatre-engine.js"), "utf8");
  expect(engineScript).toContain("const maxVisible = getVisibleLimit(scene);");
  expect(engineScript).toContain("if (visibles.includes(actorId)) return visibles;");
  expect(engineScript).toContain("while (visibles.length > maxVisible) visibles.shift();");
  expect(engineScript).toContain('const explicitVisible = normalizeIdList(scene?.actores_visibles).slice(-maxVisible);');
});
