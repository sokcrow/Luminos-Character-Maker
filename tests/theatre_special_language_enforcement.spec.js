const { test, expect } = require("@playwright/test");
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
});
