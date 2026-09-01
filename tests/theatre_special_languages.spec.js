const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");
const special = require("../js/theatre-special-language-access.js");

test.describe("Theatre special language access", () => {
  test("separa HABLA y ENTIENDE sin convertirlos en el mismo permiso", () => {
    expect(special.normalizeSpecialAccess({ habla: false, entiende: true })).toEqual({
      habla: false,
      entiende: true,
      porcentaje: 0,
      comprendido: true,
    });
    expect(special.normalizeSpecialAccess({ habla: true, entiende: false })).toEqual({
      habla: true,
      entiende: false,
      porcentaje: 100,
      comprendido: false,
    });
  });

  test("crea Distortion y Singularidad como idiomas binarios bajo demanda", () => {
    const distortion = special.buildSpecialDefinition({
      name: "Reloj de Dante",
      kind: "distortion",
      unknownText: "Tik... Tok...",
    });
    const singularity = special.buildSpecialDefinition({
      name: "Singularidad W",
      kind: "singularity",
    });

    expect(distortion).toMatchObject({
      nombre: "Reloj de Dante",
      sistema: "special",
      especial: true,
      binario: true,
      subtipo: "distortion",
      distortion: true,
      texto_desconocido: "Tik... Tok...",
    });
    expect(special.specialKind(singularity)).toBe("singularity");
    expect(special.isSpecialDefinition(singularity)).toBe(true);
  });

  test("el Log prioriza icono persistido, actor vivo y luego actor maestro", () => {
    const catalogs = [{ dante: { nombre: "Dante", icono: "dante-master.png" } }];
    expect(special.resolveLogIcon({ icono: "persisted.png" }, {}, catalogs)).toBe("persisted.png");
    expect(special.resolveLogIcon(
      { actorId: "actor_live", nombre: "Dante" },
      { actor_live: { identityId: "dante", icono: "dante-live.png" } },
      catalogs,
    )).toBe("dante-live.png");
    expect(special.resolveLogIcon(
      { actorId: "actor_live", nombre: "Dante" },
      { actor_live: { identityId: "dante" } },
      catalogs,
    )).toBe("dante-master.png");
  });

  test("Reloj de Dante ya no se siembra como idioma global por defecto", () => {
    const source = fs.readFileSync(path.join(__dirname, "..", "js", "language-catalog-engine.js"), "utf8");
    expect(source).not.toContain("dante_clock:");
    expect(source).toContain("theatre-special-language-access.js");
  });
});
