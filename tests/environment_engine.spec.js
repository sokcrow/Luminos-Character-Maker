const { test, expect } = require("@playwright/test");
const fs = require("node:fs");
const path = require("node:path");
const Environment = require("../js/environment-engine.js");
const TraitEngine = require("../js/trait-engine.js");

function traitConditionEnv(environment) {
  return {
    runtime: { environment },
    variables: {},
    state: TraitEngine.createState(),
    trait: { id: "environment_test" },
  };
}

test.describe("Environment context resolver", () => {
  test("clear and overcast weather expose different sunlight states without generic penalties", () => {
    const clear = Environment.resolveEnvironment({ weatherId: "soleado", encounterType: "outdoor", isDay: true });
    const overcast = Environment.resolveEnvironment({ weatherId: "nublado", encounterType: "outdoor", isDay: true });
    expect(clear.state).toEqual({ light: "bright", sunlight: "direct", visibility: "clear" });
    expect(overcast.state).toEqual({ light: "bright", sunlight: "diffuse", visibility: "clear" });
    expect(clear.effectIds).toEqual([]);
    expect(overcast.effectIds).toEqual([]);
  });

  test("night is natural Darkness with no sunlight", () => {
    const environment = Environment.resolveEnvironment({ weatherId: "soleado", encounterType: "outdoor", isDay: false });
    expect(environment.state.light).toBe("darkness");
    expect(environment.state.sunlight).toBe("none");
    expect(environment.stateOrigins.light).toBe("natural");
    expect(Environment.hasOrigin(environment, "natural")).toBe(true);
  });

  test("storm composes severe context instead of adding a blanket modifier", () => {
    const environment = Environment.resolveEnvironment({ weatherId: "tormenta", encounterType: "outdoor", isDay: true });
    expect(environment.state.visibility).toBe("obscured");
    expect(Environment.hasEffect(environment, "storm")).toBe(true);
    expect(Environment.hasEffect(environment, "heavy_rain")).toBe(true);
    expect(Environment.hasEffect(environment, "rain")).toBe(true);
    expect(Environment.hasEffect(environment, "strong_wind")).toBe(true);
    expect(environment.effects.every((effect) => effect.origin === "natural")).toBe(true);
  });

  test("covered encounters block precipitation and reduce direct sunlight to diffuse", () => {
    const environment = Environment.resolveEnvironment({ weatherId: "lluvia", encounterType: "covered", isDay: true });
    expect(environment.state.sunlight).toBe("diffuse");
    expect(Environment.hasEffect(environment, "rain")).toBe(false);
  });

  test("indoors blocks exterior weather and natural sunlight", () => {
    const environment = Environment.resolveEnvironment({ weatherId: "tormenta", encounterType: "indoor", isDay: true });
    expect(environment.state.sunlight).toBe("none");
    expect(environment.state.visibility).toBe("clear");
    expect(Environment.hasCategory(environment, "weather")).toBe(false);
    expect(Environment.hasEffect(environment, "storm")).toBe(false);
  });

  test("water context expands In Water and Submerged relationships", () => {
    const near = Environment.resolveEnvironment({ water: { nearby: true } });
    const swimming = Environment.resolveEnvironment({ water: { immersion: "in_water" } });
    const submerged = Environment.resolveEnvironment({ water: { immersion: "submerged" } });
    expect(Environment.hasEffect(near, "near_water")).toBe(true);
    expect(Environment.hasEffect(near, "in_water")).toBe(false);
    expect(Environment.hasEffect(swimming, "near_water")).toBe(true);
    expect(Environment.hasEffect(swimming, "in_water")).toBe(true);
    expect(Environment.hasEffect(swimming, "submerged")).toBe(false);
    expect(Environment.hasEffect(submerged, "near_water")).toBe(true);
    expect(Environment.hasEffect(submerged, "in_water")).toBe(true);
    expect(Environment.hasEffect(submerged, "submerged")).toBe(true);
  });

  test("Retreat - Sink normalizes to the canonical Submerged environment effect", () => {
    expect(Environment.canonicalEffectId("Retreat - Sink")).toBe("submerged");
    expect(Environment.canonicalEffectId("Sink")).toBe("submerged");
    expect(Environment.canonicalEffectId("Submerged")).toBe("submerged");
  });

  test("Natural, Artificial, and Magical remain origin tags instead of status effects", () => {
    const natural = Environment.resolveEnvironment({ effects: [{ id: "difficult_terrain", origin: "natural" }] });
    const artificial = Environment.resolveEnvironment({
      encounterType: "indoor",
      effects: [{ id: "difficult_terrain", origin: "artificial" }],
    });
    const magical = Environment.resolveEnvironment({
      encounterType: "indoor",
      state: { light: "darkness" },
      stateOrigins: { light: "magical" },
    });
    expect(Environment.hasOrigin(natural, "natural")).toBe(true);
    expect(Environment.hasOrigin(artificial, "artificial")).toBe(true);
    expect(Environment.hasOrigin(magical, "magical")).toBe(true);
    expect(Environment.hasState(magical, "light", "darkness")).toBe(true);
  });

  test("overlapping copies of one effect preserve every valid origin", () => {
    const environment = Environment.resolveEnvironment({
      weatherId: "lluvia",
      encounterType: "outdoor",
      isDay: true,
      effects: [
        { id: "rain", origin: "magical" },
        { id: "rain", origin: "artificial" },
      ],
    });
    const rain = environment.effects.find((effect) => effect.id === "rain");
    expect(rain.origin).toBe("artificial");
    expect(rain.origins).toEqual(["artificial", "magical", "natural"]);
    expect(Environment.hasOrigin(environment, "natural")).toBe(true);
    expect(Environment.hasOrigin(environment, "magical")).toBe(true);
    expect(Environment.hasOrigin(environment, "artificial")).toBe(true);
  });

  test("existing Trait Engine path conditions can consume Environment without a new trigger type", () => {
    const environment = Environment.resolveEnvironment({
      weatherId: "nublado",
      encounterType: "outdoor",
      isDay: true,
      water: { nearby: true, origin: "natural" },
    });
    const env = traitConditionEnv(environment);
    expect(TraitEngine.conditionMatches({
      path: "environment.state.sunlight", operator: "eq", value: "diffuse",
    }, env)).toBe(true);
    expect(TraitEngine.conditionMatches({
      path: "environment.effectIds", operator: "contains", value: "near_water",
    }, env)).toBe(true);
    expect(TraitEngine.conditionMatches({
      path: "environment.origins", operator: "contains", value: "natural",
    }, env)).toBe(true);
  });

  test("production Trait runtime resolves the active Weather snapshot automatically", () => {
    const previousWeather = global.LuminousWeatherEngine;
    const previousTrait = global.LuminousTraitEngine;
    const previousRuntime = global.LuminousEnvironmentRuntime;
    const runtimeModule = require.resolve("../js/environment-runtime.js");

    try {
      global.LuminousWeatherEngine = {
        getState: () => ({ actual: { tipo: "lluvia" } }),
        getCalendar: () => ({ timestamp: "2026-08-25T12:00:00Z" }),
      };
      global.LuminousTraitEngine = TraitEngine;
      delete global.LuminousEnvironmentRuntime;
      delete require.cache[runtimeModule];
      require("../js/environment-runtime.js");

      const state = TraitEngine.createState();
      const runtime = { context: "combat", character: {}, self: {} };
      const trait = {
        schemaVersion: 1,
        id: "rain_listener",
        name: "Rain Listener",
        contexts: ["combat"],
        activation: { type: "passive", actionCost: "none" },
        effects: [{
          id: "rain_listener_effect",
          contexts: ["combat"],
          trigger: "passive",
          conditions: [{ path: "environment.effectIds", operator: "contains", value: "rain" }],
          operations: [{ type: "set_flag", flagId: "rain_seen" }],
        }],
        rules: [],
      };

      global.LuminousTraitEngine.dispatchTrait(trait, "passive", runtime, state);
      expect(runtime.environment?.effectIds).toContain("rain");
      expect(state.flags.rain_seen).toBe(true);
    } finally {
      if (previousWeather === undefined) delete global.LuminousWeatherEngine;
      else global.LuminousWeatherEngine = previousWeather;
      if (previousTrait === undefined) delete global.LuminousTraitEngine;
      else global.LuminousTraitEngine = previousTrait;
      if (previousRuntime === undefined) delete global.LuminousEnvironmentRuntime;
      else global.LuminousEnvironmentRuntime = previousRuntime;
      delete require.cache[runtimeModule];
    }
  });

  test("production entry paths bootstrap the Environment runtime", () => {
    const root = path.resolve(__dirname, "..");
    const weatherReader = fs.readFileSync(path.join(root, "js/weather-readonly-engine.js"), "utf8");
    const actionEconomy = fs.readFileSync(path.join(root, "js/universal-action-economy.js"), "utf8");
    expect(weatherReader).toContain("js/environment-engine.js");
    expect(weatherReader).toContain("js/environment-runtime.js");
    expect(actionEconomy).toContain("js/weather-readonly-engine.js");
  });

  test("dense fog can explicitly escalate visibility to Heavily Obscured", () => {
    const environment = Environment.resolveEnvironment({
      effects: [{ id: "dense_fog", origin: "magical", scope: "zone" }],
    });
    expect(environment.state.visibility).toBe("heavily_obscured");
    expect(Environment.hasEffect(environment, "fog")).toBe(true);
    expect(Environment.hasOrigin(environment, "magical")).toBe(true);
  });
});
