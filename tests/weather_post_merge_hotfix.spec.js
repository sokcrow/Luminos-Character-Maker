const { test, expect } = require("@playwright/test");
const {
  repairedPreviousState,
  legacyForecastFromState,
  forecastsEqual,
} = require("../js/weather-post-merge-hotfix.js");

test.describe("Weather post-merge hotfix", () => {
  test("neutralizes the initial anti-bounce when there is no previous weather", () => {
    const state = {
      actual: { tipo: "parcialmente_nublado" },
      anterior: null,
    };

    const repaired = repairedPreviousState(state);
    expect(repaired.anterior).toBe("parcialmente_nublado");
    expect(state.anterior).toBeNull();
  });

  test("builds the three-entry legacy mirror from the modern forecast", () => {
    const state = {
      pronostico: [
        { tipo: "lluvia", probabilidad: 42 },
        { tipo: "nublado", probabilidad: 33 },
        { tipo: "niebla", probabilidad: 25 },
        { tipo: "soleado", probabilidad: 10 },
      ],
    };
    const engine = {
      getDefinition(id) {
        return {
          lluvia: { label: "Lluvia" },
          nublado: { label: "Nublado" },
          niebla: { label: "Niebla" },
          soleado: { label: "Soleado" },
        }[id];
      },
    };

    expect(legacyForecastFromState(state, engine)).toEqual([
      { clima: "Lluvia", probabilidad: 42 },
      { clima: "Nublado", probabilidad: 33 },
      { clima: "Niebla", probabilidad: 25 },
    ]);
  });

  test("detects the seven-entry legacy writer as drift", () => {
    const modernMirror = [
      { clima: "Lluvia", probabilidad: 42 },
      { clima: "Nublado", probabilidad: 33 },
      { clima: "Niebla", probabilidad: 25 },
    ];
    const staleLegacy = [
      ...modernMirror,
      { clima: "Soleado", probabilidad: 10 },
      { clima: "Llovizna", probabilidad: 8 },
      { clima: "Tormenta", probabilidad: 7 },
      { clima: "Granizo", probabilidad: 5 },
    ];

    expect(forecastsEqual(modernMirror, modernMirror)).toBe(true);
    expect(forecastsEqual(staleLegacy, modernMirror)).toBe(false);
  });
});
