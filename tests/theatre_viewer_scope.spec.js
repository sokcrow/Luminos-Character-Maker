const { test, expect } = require("@playwright/test");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const engineSource = fs.readFileSync(
  path.join(__dirname, "..", "js", "theatre-engine.js"),
  "utf8",
);
const playerSource = fs.readFileSync(
  path.join(__dirname, "..", "hoja_personaje.js"),
  "utf8",
);
const modernIdentitySource = fs.readFileSync(
  path.join(__dirname, "..", "js", "theatre-modern-identity-hotfix.js"),
  "utf8",
);

function loadEngine(scene = {}, options = {}) {
  const writes = [];
  const storage = options.storage || new Map();

  const makeRef = (refPath = "") => ({
    key: "test-message",
    on(event, callback) {
      if (event === "value" && refPath === "campaña/estado_mundo/escena_actual") {
        callback({ val: () => scene });
      }
    },
    off() {},
    limitToLast() { return this; },
    once: async () => ({
      val: () => refPath === "campaña/estado_mundo/escena_actual" ? scene : {},
    }),
    push() { return makeRef(`${refPath}/test-message`); },
    set: async (value) => { writes.push(["set", refPath, value]); },
    update: async (value) => { writes.push(["update", refPath, value]); },
    remove: async () => { writes.push(["remove", refPath]); },
    transaction: async (callback) => callback(null),
  });

  const db = { ref: (refPath) => makeRef(refPath) };
  const database = () => db;
  database.ServerValue = { TIMESTAMP: 1234 };
  const auth = () => ({ currentUser: null, onAuthStateChanged() {} });

  const document = {
    baseURI: "https://example.test/hoja_personaje.html",
    body: {
      dataset: {},
      classList: { contains: (name) => options.dm === true && name === "on-game-dashboard" },
    },
    addEventListener() {},
    getElementById() { return null; },
    querySelector() { return null; },
    querySelectorAll() { return []; },
  };

  const window = {
    document,
    firebase: { database, auth },
    localStorage: {
      getItem: (key) => storage.has(key) ? storage.get(key) : null,
      setItem: (key, value) => storage.set(key, String(value)),
    },
    location: { href: "https://example.test/hoja_personaje.html" },
    CSS: { supports: () => true },
    playerId: options.viewerKey || null,
    datosJugador: options.playerData || null,
    getAssignedTheatreActor: () => options.assignedActor || null,
    addEventListener() {},
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
  };
  window.window = window;
  window.globalThis = window;

  vm.runInNewContext(engineSource, {
    window,
    document,
    URL,
    console,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
  });

  return { theatre: window.LuminousTheatreState, writes, storage };
}

test("la identidad canónica ignora ??? para el DM y para el actor propio", () => {
  const { theatre } = loadEngine();
  const message = {
    actorId: "so-live",
    nombre: "???",
    titulo: "???",
    tipo_dialogo: "dialogo",
    mostrar_identidad: true,
  };
  const sceneActor = {
    actorId: "so-live",
    identityId: "so",
    nombre: "So",
    titulo: "Fixer",
  };

  const dm = theatre.resolveIdentityPresentation({
    dialogData: message,
    actor: sceneActor,
    isDm: true,
    override: { nombre: "???", titulo: "???" },
  });
  expect(dm).toMatchObject({ visible: true, known: true, name: "So", title: "Fixer" });

  const owner = theatre.resolveIdentityPresentation({
    dialogData: message,
    actor: { ...sceneActor, nombre: "???", titulo: "???" },
    ownActor: { actorId: "so", nombre: "So", titulo: "Fixer" },
    isOwnActor: true,
    override: { nombre: "???", titulo: "???" },
  });
  expect(owner).toMatchObject({ visible: true, known: true, name: "So", title: "Fixer" });
});

test("solo el espectador desconocido recibe ???", () => {
  const { theatre } = loadEngine();
  const input = {
    dialogData: {
      actorId: "so-live",
      nombre: "So",
      titulo: "Fixer",
      tipo_dialogo: "dialogo",
      mostrar_identidad: true,
    },
    actor: { nombre: "So", titulo: "Fixer" },
  };

  expect(theatre.resolveIdentityPresentation({ ...input, known: false }))
    .toMatchObject({ visible: true, known: false, name: "???", title: "???" });
  expect(theatre.resolveIdentityPresentation({ ...input, known: true }))
    .toMatchObject({ visible: true, known: true, name: "So", title: "Fixer" });
});

test("narración y pensamiento ocultan las placas incluso para el DM", () => {
  const { theatre } = loadEngine();
  for (const tipo_dialogo of ["narracion", "pensamiento"]) {
    expect(theatre.resolveIdentityPresentation({
      dialogData: {
        actorId: "so-live",
        nombre: "So",
        tipo_dialogo,
        mostrar_identidad: false,
      },
      actor: { nombre: "So" },
      isDm: true,
    })).toEqual({ visible: false, known: false, name: "", title: "" });
  }
});

test("asignaciones múltiples reconocen arrays, mapas y objetos numéricos", () => {
  const { theatre } = loadEngine();
  expect(theatre.normalizeAssignedActorIds(["so", "don"])).toEqual(["so", "don"]);
  expect(theatre.normalizeAssignedActorIds({ so: true, don: false, faust: 1 }))
    .toEqual(["so", "faust"]);
  expect(theatre.normalizeAssignedActorIds({ 0: "so", 1: "don" }))
    .toEqual(["so", "don"]);
  expect(theatre.normalizeAssignedActorIds({ actorId: "so" })).toEqual(["so"]);
});

test("mostrar u ocultar el sprite propio usa preferencias separadas por jugador y actor", () => {
  const { theatre, writes, storage } = loadEngine();
  const soKey = theatre.getSelfVisibilityStorageKey("jugadora-so", "so");
  const otherViewerKey = theatre.getSelfVisibilityStorageKey("jugador-p2", "so");
  const otherActorKey = theatre.getSelfVisibilityStorageKey("jugadora-so", "don");

  expect(new Set([soKey, otherViewerKey, otherActorKey]).size).toBe(3);

  theatre.setShowOwnActor(true, "so", "jugadora-so");
  expect(theatre.getShowOwnActor("so", "jugadora-so")).toBe(true);
  expect(theatre.getShowOwnActor("so", "jugador-p2")).toBe(false);
  expect(storage.get(soKey)).toBe("true");
  expect(writes).toEqual([]);
});

test("ocultar el sprite propio filtra solo la vista del dueño", () => {
  const scene = {
    actores_visibles: ["so-live"],
    actores: {
      "so-live": {
        identityId: "so",
        nombre: "So",
        sprite: "https://example.test/so.png",
      },
    },
  };

  const owner = loadEngine(scene, {
    viewerKey: "jugadora-so",
    assignedActor: { actorId: "so", identityId: "so", nombre: "So" },
  }).theatre;
  expect(owner.getRenderIds(scene)).toEqual([]);
  owner.setShowOwnActor(true, "so-live", "jugadora-so");
  expect(owner.getRenderIds(scene)).toEqual(["so-live"]);

  const otherPlayer = loadEngine(scene, {
    viewerKey: "jugador-p2",
    assignedActor: { actorId: "p2", identityId: "p2", nombre: "P2" },
  }).theatre;
  expect(otherPlayer.getRenderIds(scene)).toEqual(["so-live"]);

  const dm = loadEngine(scene, { dm: true }).theatre;
  expect(dm.getRenderIds(scene)).toEqual(["so-live"]);
});

test("el compositor conserva identidad canónica y nunca publica ??? como nombre real", () => {
  expect(playerSource).toContain("resolveCanonicalIdentityText(");
  expect(modernIdentitySource).toContain("resolveCanonicalIdentityText(");
  expect(playerSource).not.toMatch(/nombre:\s*actorAssigned\.nombre\s*\|\|/);
});

test("la publicación repara payloads antiguos enmascarados antes del estado activo y el log", async () => {
  const { theatre } = loadEngine({
    actores: {
      "so-live": { identityId: "so", nombre: "So", titulo: "Fixer" },
    },
  });

  const result = await theatre.publishIntervention("message-1", {
    actorId: "so-live",
    nombre: "???",
    titulo: "???",
    mensaje: "Hola",
    tipo_dialogo: "dialogo",
    mostrar_identidad: true,
  });

  expect(result.payload.nombre).toBe("So");
  expect(result.payload.titulo).toBe("Fixer");
});

test("la carga o selección tardía del actor vuelve a resolver identidad y preferencia local", () => {
  const cacheListener = engineSource.slice(
    engineSource.indexOf('global.addEventListener("actoresCacheUpdated"'),
    engineSource.indexOf('document.addEventListener("click"'),
  );
  expect(cacheListener).toContain("syncSelfVisibilityControl();");
  expect(cacheListener).toContain("renderScene(currentScene);");
  expect(cacheListener).toContain('event.target?.id !== "player-actor-select"');
});
