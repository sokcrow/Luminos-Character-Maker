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
});
