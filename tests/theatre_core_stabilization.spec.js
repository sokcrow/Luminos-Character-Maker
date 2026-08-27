const { test, expect } = require("@playwright/test");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const engineSource = read("js/theatre-engine.js");
const sceneTime = require("../js/scene-time-engine.js");
const interventionUx = require("../js/theatre-intervention-ux.js");
const checkCoordinatorSource = read("js/theatre-check-coordinator.js");
const sceneTimeRuntimeSource = read("js/scene-time-runtime.js");

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

const ACTOR = {
  actorId: "so-live",
  identityId: "so",
  nombre: "So",
  titulo: "Fixer",
  sprite: "https://example.test/so.png",
};

const SCENE = {
  actores_visibles: [ACTOR.actorId],
  actores: { [ACTOR.actorId]: ACTOR },
  locacion: "Backstreets 23",
  fondo: "https://example.test/backstreets.jpg",
};

test.describe("Theatre Core stabilization gate #595", () => {
  test("the same actor resolves deterministically for DM, self, known, unknown and late joiner", () => {
    const { theatre } = loadEngine(SCENE);
    const dialogData = {
      actorId: ACTOR.actorId,
      nombre: ACTOR.nombre,
      titulo: ACTOR.titulo,
      tipo_dialogo: "dialogo",
      mostrar_identidad: true,
    };

    const matrix = [
      {
        label: "dm",
        input: { isDm: true },
        expected: { visible: true, known: true, name: "So", title: "Fixer" },
      },
      {
        label: "self",
        input: { isOwnActor: true, ownActor: { actorId: "so", nombre: "So", titulo: "Fixer" } },
        expected: { visible: true, known: true, name: "So", title: "Fixer" },
      },
      {
        label: "known viewer",
        input: { known: true },
        expected: { visible: true, known: true, name: "So", title: "Fixer" },
      },
      {
        label: "unknown viewer",
        input: { known: false },
        expected: { visible: true, known: false, name: "???", title: "???" },
      },
      {
        label: "late joiner without reveal",
        input: { known: false },
        expected: { visible: true, known: false, name: "???", title: "???" },
      },
    ];

    for (const entry of matrix) {
      const result = theatre.resolveIdentityPresentation({
        dialogData,
        actor: ACTOR,
        ...entry.input,
      });
      expect(result, entry.label).toMatchObject(entry.expected);
    }
  });

  test("ACTUAR identity follows viewer knowledge instead of message type", () => {
    const matrix = [
      [{ isDm: true }, "So"],
      [{ isOwnActor: true }, "So"],
      [{ known: true }, "So"],
      [{ known: false }, "???"],
    ];

    for (const [viewer, expected] of matrix) {
      expect(sceneTime.visibleActionIdentity({
        actorId: ACTOR.actorId,
        canonicalName: ACTOR.nombre,
        ...viewer,
      })).toBe(expected);
    }

    const normalized = interventionUx.normalizeInterventionMessage({
      actorId: ACTOR.actorId,
      nombre: ACTOR.nombre,
      tipo_dialogo: "actuar",
      mensaje: "se acerca a la puerta",
    }, ACTOR);
    expect(normalized.tipo_dialogo).toBe("actuar");
    expect(normalized.mostrar_identidad).toBe(false);
    expect(interventionUx.logPresentation(normalized).showNameplate).toBe(false);
  });

  test("message modes keep their presentation contract without mutating actor identity", () => {
    expect(interventionUx.logPresentation({ tipo_dialogo: "dialogo" }).showNameplate).toBe(true);
    for (const type of ["actuar", "pensamiento", "narracion", "sistema"]) {
      expect(interventionUx.logPresentation({ tipo_dialogo: type }).showNameplate, type).toBe(false);
    }

    const { theatre } = loadEngine(SCENE);
    for (const type of ["pensamiento", "narracion"]) {
      expect(theatre.resolveIdentityPresentation({
        dialogData: {
          actorId: ACTOR.actorId,
          nombre: ACTOR.nombre,
          tipo_dialogo: type,
          mostrar_identidad: false,
        },
        actor: ACTOR,
        isDm: true,
      })).toEqual({ visible: false, known: false, name: "", title: "" });
    }
  });

  test("self sprite visibility is local and reconstructs identically after reload", () => {
    const sharedStorage = new Map();
    const ownerOptions = {
      viewerKey: "jugadora-so",
      assignedActor: { actorId: "so", identityId: "so", nombre: "So" },
      storage: sharedStorage,
    };

    const first = loadEngine(SCENE, ownerOptions).theatre;
    expect(first.getRenderIds(SCENE)).toEqual([]);
    first.setShowOwnActor(true, ACTOR.actorId, "jugadora-so");
    expect(first.getRenderIds(SCENE)).toEqual([ACTOR.actorId]);

    const reloaded = loadEngine(SCENE, ownerOptions).theatre;
    expect(reloaded.getRenderIds(SCENE)).toEqual([ACTOR.actorId]);

    const otherViewer = loadEngine(SCENE, {
      viewerKey: "jugador-p2",
      assignedActor: { actorId: "p2", identityId: "p2", nombre: "P2" },
      storage: new Map(),
    }).theatre;
    expect(otherViewer.getRenderIds(SCENE)).toEqual([ACTOR.actorId]);

    const dm = loadEngine(SCENE, { dm: true }).theatre;
    expect(dm.getRenderIds(SCENE)).toEqual([ACTOR.actorId]);
  });

  test("scene changes and expression reveals preserve the established Theatre ownership boundaries", () => {
    expect(engineSource).toContain("async function revealPreparedExpression");
    expect(engineSource).toContain("await revealPreparedExpression(message.actorId, message.expression, message.sprite)");
    expect(engineSource).toContain("async function changeScene");
    expect(engineSource).toContain('transition_phase: "out"');
    expect(engineSource).toContain('transition_phase: "in"');
    expect(engineSource).toContain("scene_cut_at");

    const clearStart = engineSource.indexOf("async function clearScene()");
    const clearEnd = engineSource.indexOf("function wait", clearStart);
    const clearBody = engineSource.slice(clearStart, clearEnd);
    expect(clearBody).toContain("actores_visibles");
    expect(clearBody).toContain("active_actor");
    expect(clearBody).not.toContain("/actores`");
    expect(clearBody).not.toContain("conocimiento_identidad");
  });

  test("Scene Time and Theatre checks share the existing coordinator path and one world clock", () => {
    expect(checkCoordinatorSource).toContain('const REQUEST_ROOT = "theatre_check_requests"');
    expect(sceneTimeRuntimeSource).toMatch(/db\.ref\(['"]theatre_check_requests['"]\)\.push\(\)/);
    expect(sceneTimeRuntimeSource).not.toContain("Math.random() * 20");

    const base = {
      timestamp: "2026-08-27T12:00:00.000Z",
      año: 2026,
      mes: 8,
      dia: 27,
      hora: 12,
      minuto: 0,
      segundo: 0,
    };
    let state = base;
    for (let round = 1; round <= 10; round += 1) {
      state = sceneTime.applyEventToCalendar(state, {
        eventId: `theatre_gate_round_${round}`,
        type: "combat_round",
      }, "default").calendar;
    }
    expect(sceneTime.calendarWorldMs(state) - sceneTime.calendarWorldMs(base)).toBe(60_000);
  });

  test("reconnect contract remains Firebase-state based instead of reconstructing a private scene", () => {
    expect(engineSource).toContain('sceneRef.on("value", sceneListener)');
    expect(engineSource).toContain('dialogueRef.on("value", dialogueListener)');
    expect(engineSource).toContain("[paths.dialogue]: activePayload");
    expect(engineSource).toContain("Persistent by contract: completion never clears the active dialogue");
    expect(engineSource).toContain('const IDENTITY_KNOWLEDGE_ROOT = "campaña/teatro/conocimiento_identidad"');
  });
});
