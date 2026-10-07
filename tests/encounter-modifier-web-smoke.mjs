import assert from "node:assert/strict";

await import("../js/status-library.js");
await import("../js/status-engine.js");
await import("../js/environment-engine.js");
await import("../js/encounter-modifier-runtime.js");

const statuses = globalThis.LuminousStatusEngine;
const environment = globalThis.LuminousEnvironmentEngine;
const modifiers = globalThis.LuminousEncounterModifierRuntime;

if (!statuses || !environment || !modifiers) throw new Error("Encounter Modifier runtime dependencies did not initialize.");

const webEnvironment = environment.resolveEnvironment({ effects: [{ id: "web", scope: "zone" }] });
assert.equal(environment.hasEffect(webEnvironment, "web"), true);
assert.ok(webEnvironment.categories.includes("terrain"));

const spider = {
  id: "spider",
  hp: 5,
  traitIds: ["spider_climb", "web_walker"],
  mechanics: { webWalker: { ignoresWebBind: true, detectsUnitsInSameWeb: true } },
  statusEffects: {},
};
const clear = { id: "clear", hp: 10, statusEffects: {} };
const bound = { id: "bound", hp: 10, statusEffects: {} };
statuses.applyStatus(bound, "bind", { mode: "set", count: 2 });

const zone = modifiers.applyWebTurnEnd({ id: "web", mode: "zone" }, [spider, clear, bound]);
assert.equal(zone.applied, true);
assert.equal(statuses.hasStatus(spider, "bind"), false, "Web Walker must ignore Web Bind");
assert.equal(statuses.getStatus(clear, "bind").count, 3, "clear target gains +3 Bind");
assert.equal(statuses.getStatus(bound, "bind").count, 8, "already-bound target gains +6 Bind");

const anchor = { id: "anchor", hp: 10, statusEffects: {}, spaceId: "A2" };
const adjacent = { id: "adjacent", hp: 10, statusEffects: {}, spaceId: "A1" };
const far = { id: "far", hp: 10, statusEffects: {}, spaceId: "B9" };
const single = modifiers.applyWebTurnEnd({
  id: "web",
  mode: "single",
  anchorUnitId: "anchor",
  adjacentUnitIds: ["adjacent"],
}, [anchor, adjacent, far]);
assert.equal(single.results.some((row) => row.unitId === "anchor" && row.applied), true);
assert.equal(single.results.some((row) => row.unitId === "adjacent" && row.applied), true);
assert.equal(single.results.some((row) => row.unitId === "far"), false);
assert.equal(statuses.getStatus(anchor, "bind").count, 3);
assert.equal(statuses.getStatus(adjacent, "bind").count, 3);
assert.equal(statuses.hasStatus(far, "bind"), false);

const webSpider = { ...spider, id: "web_spider", statusEffects: {} };
const prey = { id: "prey", hp: 10, statusEffects: {} };
const outsider = { id: "outsider", hp: 10, statusEffects: {} };
const detection = modifiers.webDetectionForUnit(
  webSpider,
  [{ id: "web", mode: "single", anchorUnitId: "web_spider", adjacentUnitIds: ["prey"] }],
  [webSpider, prey, outsider],
);
assert.deepEqual(detection, ["prey"], "Web Walker detects Units touching the same Web");

assert.equal(modifiers.WEB.bindOnClearTarget, 3);
assert.equal(modifiers.WEB.bindOnBoundTarget, 6);
assert.deepEqual(modifiers.WEB.modes, ["single", "zone"]);

console.log("Encounter Modifier Web runtime smoke: ok");
