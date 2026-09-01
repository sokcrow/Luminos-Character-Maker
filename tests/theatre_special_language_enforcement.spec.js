const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const rules = require("../js/theatre-special-language-enforcement-hotfix.js");
const logRules = require("../js/theatre-special-language-log-hotfix.js");

test.describe("special language hotfix", () => {
  const defs = {
    dante_clock: {
      nombre: "Reloj de Dante",
      sistema: "special",
      especial: true,
      binario: true,
      tipo: "distortion",
      distortion: true,
      texto_desconocido: "Tik... Tok...",
    },
  };

  test("canonical ENTIENDE false wins over an older true flag", () => {
    const profile = {
      idiomas: { dante_clock: { porcentaje: 0, comprendido: false } },
      distortion_languages: { dante_clock: true },
    };
    expect(rules.resolveSpecialUnderstanding([profile], "dante_clock")).toBe(false);
  });

  test("ENTIENDE without HABLA never selects the special language for speaking", () => {
    expect(rules.preferredSpecialLanguage(defs, {
      dante_clock: { porcentaje: 0, comprendido: true },
    })).toBeNull();
    expect(rules.preferredSpecialLanguage(defs, {
      dante_clock: { porcentaje: 100, comprendido: false },
    })).toBe("dante_clock");
  });

  test("So sees the configured unknown text when ENTIENDE is disabled", () => {
    const so = { idiomas: { dante_clock: { porcentaje: 0, comprendido: false } } };
    const message = { nombre: "Dante", mensaje: "Debemos irnos.", idiomaId: "dante_clock" };
    expect(logRules.resolveLogMessageText(message, defs, [so], rules)).toBe("Tik... Tok...");
  });

  test("the player language policy actually loads enforcement and log privacy", () => {
    const source = fs.readFileSync(path.join(__dirname, "..", "js", "theatre-language-policy.js"), "utf8");
    expect(source).toContain("ensurePlayerSpecialLanguageRuntime();");
    expect(source).toContain("js/theatre-special-language-enforcement-hotfix.js");
    expect(source).toContain("js/theatre-special-language-log-hotfix.js");
    expect(source).toContain("ref.__luminousLanguagePushPatched = true");
  });

  test("runtime del jugador bloquea a Dante para So con ENTIENDE apagado", () => {
    const source = fs.readFileSync(
      path.join(__dirname, "..", "js", "theatre-special-language-enforcement-hotfix.js"),
      "utf8",
    );

    const listeners = new Map();
    const textEl = {
      textContent: "Debemos irnos.",
      dataset: {},
      attrs: {},
      setAttribute(name, value) {
        this.attrs[name] = value;
      },
    };

    const snapshot = (value) => ({ val: () => value });
    const db = {
      ref(firebasePath) {
        return {
          on(eventName, callback) {
            if (eventName === "value") listeners.set(firebasePath, callback);
          },
          off() {},
        };
      },
    };

    class MutationObserverMock {
      constructor(callback) {
        this.callback = callback;
      }
      observe() {}
      disconnect() {}
    }

    const auth = () => ({
      currentUser: { uid: "so" },
      onAuthStateChanged() {},
    });

    const context = {
      console,
      document: {
        body: { classList: { contains: () => false } },
        readyState: "complete",
        getElementById(id) {
          return id === "dialogue-text" ? textEl : null;
        },
        addEventListener() {},
      },
      firebase: {
        database: () => db,
        auth,
      },
      MutationObserver: MutationObserverMock,
      LuminousTheatreState: {
        getPaths: () => ({ scene: "runtime/scene", dialogue: "runtime/dialogue" }),
      },
      getAssignedTheatreActor: () => ({ actorId: "so_actor", id: "so_actor" }),
      setTimeout(fn) {
        fn();
        return 1;
      },
      setInterval() {
        return 1;
      },
      clearInterval() {},
      queueMicrotask(fn) {
        fn();
      },
    };
    context.window = context;
    context.globalThis = context;

    vm.createContext(context);
    vm.runInContext(source, context);

    expect(listeners.has("campaña/idiomas")).toBe(true);
    expect(listeners.has("campaña/jugadores")).toBe(true);
    expect(listeners.has("runtime/dialogue")).toBe(true);

    listeners.get("campaña/idiomas")(snapshot(defs));
    listeners.get("campaña/teatro/idiomas")(snapshot({}));
    listeners.get("campaña/jugadores")(snapshot({
      so: {
        uid: "so",
        actorId: "so_actor",
        idiomas: { dante_clock: { porcentaje: 0, comprendido: false } },
        distortion_languages: { dante_clock: true },
      },
    }));

    textEl.textContent = "Debemos irnos.";
    listeners.get("runtime/dialogue")(snapshot({
      actorId: "dante",
      nombre: "Dante",
      mensaje: "Debemos irnos.",
      idiomaId: "dante_clock",
    }));

    expect(textEl.textContent).toBe("Tik... Tok...");
    expect(textEl.dataset.specialLanguage).toBe("dante_clock");
    expect(textEl.dataset.specialLanguageBlocked).toBe("true");
    expect(textEl.attrs["aria-label"]).toBe("Tik... Tok...");
  });

  test("DM recupera HABLA de Dante desde el actor maestro antes de construir el payload", () => {
    const source = fs.readFileSync(
      path.join(__dirname, "..", "js", "theatre-language-policy.js"),
      "utf8",
    );

    const firebaseListeners = new Map();
    const domListeners = new Map();
    const snapshot = (value) => ({ val: () => value });

    function optionNode() {
      return { value: "", textContent: "", dataset: {} };
    }

    const speakerSelect = { id: "theatre-speaker-select", value: "dante_live" };
    const languageSelect = {
      id: "theatre-language-select",
      value: "",
      options: [],
      dataset: {},
      title: "",
      replaceChildren(fragment) {
        this.options = [...fragment.children];
        this.value = "";
      },
      appendChild(option) {
        this.options.push(option);
      },
    };

    const document = {
      body: { classList: { contains: (name) => name === "on-game-dashboard" } },
      readyState: "complete",
      head: { appendChild() {} },
      getElementById(id) {
        if (id === "theatre-speaker-select") return speakerSelect;
        if (id === "theatre-language-select") return languageSelect;
        return null;
      },
      createElement(tag) {
        if (tag === "option") return optionNode();
        return { dataset: {}, addEventListener() {} };
      },
      createDocumentFragment() {
        return {
          children: [],
          appendChild(node) { this.children.push(node); },
        };
      },
      addEventListener(type, callback, options) {
        if (!domListeners.has(type)) domListeners.set(type, []);
        domListeners.get(type).push({ callback, capture: options === true || options?.capture === true });
      },
    };

    const db = {
      ref(firebasePath) {
        return {
          on(eventName, callback) {
            if (eventName === "value") firebaseListeners.set(firebasePath, callback);
          },
          off() {},
        };
      },
    };

    const database = () => db;
    const context = {
      console,
      document,
      firebase: { database },
      LuminousTheatreState: {
        getPaths: () => ({ scene: "runtime/scene", queue: "runtime/queue" }),
      },
      setTimeout() { return 1; },
      setInterval() { return 1; },
      clearInterval() {},
      addEventListener() {},
    };
    context.window = context;
    context.globalThis = context;

    vm.createContext(context);
    vm.runInContext(source, context);

    firebaseListeners.get("campaña/idiomas")(snapshot({ common: { nombre: "Común", universal: true } }));
    firebaseListeners.get("campaña/teatro/idiomas")(snapshot(defs));
    firebaseListeners.get("campaña/base_datos_npcs")(snapshot({
      dante: {
        nombre: "Dante",
        idiomas: { dante_clock: { porcentaje: 100, comprendido: true } },
      },
    }));
    firebaseListeners.get("campaña/actores")(snapshot({}));
    firebaseListeners.get("runtime/scene")(snapshot({
      actores: {
        dante_live: {
          nombre: "Dante",
          identityId: "dante",
          // El actor vivo reproduce el bug real: no carga idiomas al spawn.
        },
      },
    }));

    let languageSeenByDashboard = null;
    document.addEventListener("click", () => {
      languageSeenByDashboard = languageSelect.value || null;
    });

    const event = {
      target: {
        closest(selector) {
          return selector === "#btn-send-dialogue" ? this : null;
        },
      },
    };
    const clickListeners = domListeners.get("click") || [];
    clickListeners.filter((entry) => entry.capture).forEach((entry) => entry.callback(event));
    clickListeners.filter((entry) => !entry.capture).forEach((entry) => entry.callback(event));

    expect(languageSelect.value).toBe("dante_clock");
    expect(languageSeenByDashboard).toBe("dante_clock");
    expect(languageSelect.dataset.autoSpecialLanguage).toBe("dante_clock");
  });

  test("el Theatre Engine bloquea a So cuando el payload sí lleva idiomaId", () => {
    const source = fs.readFileSync(
      path.join(__dirname, "..", "js", "theatre-engine.js"),
      "utf8",
    );

    const firebaseListeners = new Map();
    const snapshot = (value) => ({ val: () => value });

    const db = {
      ref(firebasePath) {
        return {
          key: "test-key",
          on(eventName, callback) {
            if (eventName === "value") firebaseListeners.set(firebasePath, callback);
          },
          off() {},
          once() { return Promise.resolve(snapshot(null)); },
          set() { return Promise.resolve(); },
          update() { return Promise.resolve(); },
          remove() { return Promise.resolve(); },
          transaction() { return Promise.resolve(); },
          push() { return this; },
        };
      },
    };
    const database = () => db;
    database.ServerValue = { TIMESTAMP: 123456 };

    const document = {
      body: { dataset: {}, classList: { contains: () => false } },
      baseURI: "https://local.invalid/",
      readyState: "complete",
      getElementById() { return null; },
      querySelector() { return null; },
      querySelectorAll() { return []; },
      createElement() { return { style: {}, dataset: {}, addEventListener() {}, appendChild() {}, querySelector() { return null; } }; },
      addEventListener() {},
    };

    class MutationObserverMock {
      observe() {}
      disconnect() {}
    }

    const context = {
      console,
      document,
      firebase: {
        database,
        auth: () => ({ currentUser: { uid: "so" }, onAuthStateChanged() {} }),
      },
      MutationObserver: MutationObserverMock,
      Element: function Element() {},
      URL,
      CSS: { supports: () => true },
      localStorage: { getItem: () => null, setItem() {} },
      location: { href: "https://local.invalid/hoja_personaje.html" },
      getAssignedTheatreActor: () => ({ actorId: "so_actor", id: "so_actor" }),
      getComputedStyle: () => ({ fontSize: "24px" }),
      addEventListener() {},
      setTimeout() { return 1; },
      setInterval() { return 1; },
      clearInterval() {},
      Promise,
      Date,
    };
    context.window = context;
    context.globalThis = context;

    vm.createContext(context);
    vm.runInContext(source, context);

    firebaseListeners.get("campaña/idiomas")(snapshot(defs));
    firebaseListeners.get("campaña/teatro/idiomas")(snapshot({}));
    firebaseListeners.get("campaña/jugadores")(snapshot({
      so: {
        uid: "so",
        actorId: "so_actor",
        idiomas: { dante_clock: { porcentaje: 0, comprendido: false } },
      },
    }));

    const engine = context.LuminousTheatreState;
    expect(engine.resolveLanguageText("Debemos irnos.", { idiomaId: null })).toBe("Debemos irnos.");
    expect(engine.resolveLanguageText("Debemos irnos.", { idiomaId: "dante_clock" })).toBe("Tik... Tok...");
  });
});