const { test, expect } = require("@playwright/test");
const fs = require("node:fs");
const path = require("node:path");

const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");
const interventionUx = require("../js/theatre-intervention-ux.js");
const logPolicy = require("../js/theatre-special-language-log-hotfix.js");

const uxSource = read("js/theatre-intervention-ux.js");
const uxCoreSource = read("js/theatre-intervention-ux-core.js");
const policySource = read("js/theatre-language-policy.js");
const cssSource = read("css/theatre-intervention-ux.css");

test("Actuar is explicit and /em normalizes to actuar without a nameplate", () => {
  const explicit = interventionUx.normalizeInterventionMessage({
    actorId: "actor_dante",
    tipo_dialogo: "actuar",
    mensaje: "levanta la mano",
  }, { sprite: "dante-sprite.png", icono: "dante-icon.png" });

  expect(explicit.tipo_dialogo).toBe("actuar");
  expect(explicit.mensaje).toBe("/em levanta la mano");
  expect(explicit.mostrar_identidad).toBe(false);
  expect(explicit.sprite).toBe("dante-sprite.png");
  expect(explicit.icono).toBe("dante-icon.png");

  const legacy = interventionUx.normalizeInterventionMessage({
    tipo_dialogo: "dialogo",
    mensaje: "/em mira el reloj",
  });
  expect(legacy.tipo_dialogo).toBe("actuar");
  expect(legacy.mostrar_identidad).toBe(false);
});

test("Only dialogue is eligible for a nameplate", () => {
  expect(interventionUx.logPresentation({ tipo_dialogo: "dialogo" }).showNameplate).toBe(true);
  expect(interventionUx.logPresentation({ tipo_dialogo: "actuar" }).showNameplate).toBe(false);
  expect(interventionUx.logPresentation({ tipo_dialogo: "pensamiento" }).showNameplate).toBe(false);
  expect(interventionUx.logPresentation({ tipo_dialogo: "narracion" }).showNameplate).toBe(false);
  expect(interventionUx.logPresentation({ tipo_dialogo: "sistema" }).showNameplate).toBe(false);
  const system = interventionUx.normalizeInterventionMessage({ tipo_dialogo: "sistema", actorId: "actor_x", icono: "x.png" });
  expect(system.actorId).toBeNull();
  expect(system.icono).toBeNull();
});

test("thought, narration and system are centered portrait-less rows; acting keeps actor portrait", () => {
  for (const type of ["pensamiento", "narracion", "sistema"]) {
    const presentation = interventionUx.logPresentation({ tipo_dialogo: type });
    expect(presentation.centered).toBe(true);
    expect(presentation.showPortrait).toBe(false);
  }
  const acting = interventionUx.logPresentation({ tipo_dialogo: "actuar" });
  expect(acting.centered).toBe(false);
  expect(acting.showPortrait).toBe(true);
  expect(cssSource).toContain(".dialogue-row.is-centered-log-entry");
  expect(cssSource).toContain(".dialogue-row.is-action");
});

test("Dante log portrait resolves the master actor icon, never the scene sprite", () => {
  const sceneActors = {
    actor_123: {
      nombre: "Dante",
      identityId: "dante",
      sprite: "dante-expression-sprite.png",
      icono: "dante-live-icon.png",
    },
  };
  const modernCatalog = {
    dante: {
      nombre: "Dante",
      icono: "dante-actor-icon.png",
      sprite: "dante-master-sprite.png",
    },
  };
  const message = {
    actorId: "actor_123",
    nombre: "Dante",
    icono: "dante-expression-sprite.png",
    sprite: "dante-expression-sprite.png",
  };

  expect(interventionUx.resolveCanonicalActorIcon(message, sceneActors, [modernCatalog]))
    .toBe("dante-actor-icon.png");
  expect(uxCoreSource).not.toMatch(/return\s+.*sprite.*fallback/i);
});

test("archived sprite contamination is rejected when no canonical icon exists", () => {
  const message = { nombre: "Dante", icono: "same.png", sprite: "same.png" };
  expect(interventionUx.resolveCanonicalActorIcon(message, {}, [])).toBe("");
});

test("log text formats actuar and keeps special-language privacy", () => {
  const rules = {
    isSpecialLanguage: () => true,
    resolveSpecialUnderstanding: () => false,
    unknownTextForDefinition: () => "Tik... Tok...",
  };
  expect(logPolicy.resolveLogMessageText({
    tipo_dialogo: "actuar",
    nombre: "Dante",
    mensaje: "/em señala la puerta",
    idiomaId: "dante_clock",
  }, { dante_clock: {} }, [{}], rules)).toBe("(Dante Tik... Tok...)");
});

test("language policy loads intervention UX for both DM and player contexts", () => {
  expect(policySource).toContain("ensureInterventionUxRuntime");
  expect(policySource).toContain("js/theatre-intervention-ux.js");
  expect(uxSource).toContain("js/theatre-intervention-ux-core.js");
  expect(uxCoreSource).toContain('option.value = "actuar"');
  expect(uxCoreSource).toContain("#btn-send-dialogue, #btn-enviar-teatro-modal");
});
