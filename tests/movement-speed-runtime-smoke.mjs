import assert from "node:assert/strict";

await import("../js/movement-speed-runtime.js");

const speed = globalThis.LuminousMovementSpeedRuntime;
if (!speed) throw new Error("Movement Speed runtime did not initialize.");

assert.deepEqual(
  { min: speed.rangeFromFeet(30, "medium").min, max: speed.rangeFromFeet(30, "medium").max },
  { min: 1, max: 6 },
);
assert.deepEqual(
  { min: speed.rangeFromFeet(35, "medium").min, max: speed.rangeFromFeet(35, "medium").max },
  { min: 1, max: 7 },
);
assert.deepEqual(
  { min: speed.rangeFromFeet(40, "medium").min, max: speed.rangeFromFeet(40, "medium").max },
  { min: 1, max: 8 },
);

assert.deepEqual(
  { min: speed.rangeFromFeet(25, "medium").min, max: speed.rangeFromFeet(25, "medium").max },
  { min: 0, max: 5 },
);
assert.deepEqual(
  { min: speed.rangeFromFeet(20, "medium").min, max: speed.rangeFromFeet(20, "medium").max },
  { min: 0, max: 4 },
);
assert.deepEqual(
  { min: speed.rangeFromFeet(10, "medium").min, max: speed.rangeFromFeet(10, "medium").max },
  { min: 0, max: 2 },
);
assert.deepEqual(
  { min: speed.rangeFromFeet(5, "medium").min, max: speed.rangeFromFeet(5, "medium").max },
  { min: 0, max: 2 },
  "Max Speed must never fall below 2 from movement penalties.",
);

assert.equal(speed.rangeFromFeet(30, "tiny").max, 8);
assert.equal(speed.rangeFromFeet(30, "small").max, 8);
assert.equal(speed.rangeFromFeet(30, "large").max, 5);
assert.equal(speed.rangeFromFeet(30, "huge").max, 4);
assert.equal(speed.rangeFromFeet(30, "gargantuan").max, 3);

const owl = {
  size: "tiny",
  flying: true,
  movementFeet: { ground: 5, fly: 60 },
};
assert.equal(speed.rangeForEntity(owl).mode, "fly");
assert.deepEqual(
  { min: speed.rangeForEntity(owl).min, max: speed.rangeForEntity(owl).max },
  { min: 1, max: 14 },
);
owl.flying = false;
assert.equal(speed.rangeForEntity(owl).mode, "ground");
assert.deepEqual(
  { min: speed.rangeForEntity(owl).min, max: speed.rangeForEntity(owl).max },
  { min: 0, max: 3 },
);

const octopus = {
  size: "small",
  movementFeet: { ground: 5, swim: 30 },
  preferredMovementMode: "swim",
  mechanics: { waterBreathing: { onlyUnderwater: true } },
};
assert.equal(speed.rangeForEntity(octopus).mode, "ground");
octopus.encounterTags = ["underwater"];
assert.equal(speed.rangeForEntity(octopus).mode, "swim");
assert.deepEqual(
  { min: speed.rangeForEntity(octopus).min, max: speed.rangeForEntity(octopus).max },
  { min: 1, max: 8 },
);

console.log("movement Speed runtime smoke: ok");
