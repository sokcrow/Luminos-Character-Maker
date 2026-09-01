const { test, expect } = require("@playwright/test");
const {
  seasonFromMonth,
  normalizeWeatherId,
  getTransitionBreakdown,
} = require("../js/weather-engine.js");

test.describe("Weather Engine seasonal rules", () => {
  test("maps campaign months to the expected season", () => {
    expect(seasonFromMonth(1)).toBe("invierno");
    expect(seasonFromMonth(4)).toBe("primavera");
    expect(seasonFromMonth(7)).toBe("verano");
    expect(seasonFromMonth(10)).toBe("otono");
    expect(seasonFromMonth(12)).toBe("invierno");
  });

  test("normalizes legacy weather labels", () => {
    expect(normalizeWeatherId("Parcialmente Nublado")).toBe("parcialmente_nublado");
    expect(normalizeWeatherId("Húmedo")).toBe("nublado");
    expect(normalizeWeatherId("Despejado")).toBe("soleado");
  });

  test("winter makes snow more likely than summer under freezing conditions", () => {
    const base = {
      actual: { tipo: "niebla", temperatura: -5, humedad: 92, viento: 5, visibilidad: 30, intensidad: 60 },
      anterior: "nublado",
    };
    const winter = getTransitionBreakdown("niebla", { ...base, estacion: "invierno" });
    const summer = getTransitionBreakdown("niebla", { ...base, estacion: "verano" });
    const winterSnow = winter.find((row) => row.target === "nieve").probability;
    const summerSnow = summer.find((row) => row.target === "nieve").probability;
    expect(winterSnow).toBeGreaterThan(summerSnow);
  });

  test("high humidity increases rain routes", () => {
    const dry = getTransitionBreakdown("nublado", {
      estacion: "primavera",
      actual: { tipo: "nublado", temperatura: 15, humedad: 45, viento: 10, visibilidad: 90, intensidad: 50 },
    });
    const humid = getTransitionBreakdown("nublado", {
      estacion: "primavera",
      actual: { tipo: "nublado", temperatura: 15, humedad: 92, viento: 10, visibilidad: 75, intensidad: 50 },
    });
    const dryRain = dry.find((row) => row.target === "lluvia").probability;
    const humidRain = humid.find((row) => row.target === "lluvia").probability;
    expect(humidRain).toBeGreaterThan(dryRain);
  });
});
