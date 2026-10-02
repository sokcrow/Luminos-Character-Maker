import assert from "node:assert/strict";

await import("../js/theatre-player-notification-runtime.js");

const notifications = globalThis.LuminousTheatrePlayerNotifications;
assert.ok(notifications, "player notification runtime should load");

const mental = {
  id: "alarm_mental",
  kind: "alarm",
  triggered: true,
  consumedAt: 1234,
  subjectPlayerId: "player_a",
  mode: "mental",
};
assert.equal(notifications.notificationForEffect(mental, "player_a"), "Your Alarm was triggered.");
assert.equal(notifications.notificationForEffect(mental, "player_b"), null);

const audible = {
  ...mental,
  id: "alarm_audible",
  mode: "audible",
  triggerMessage: "Your audible Alarm was triggered.",
};
assert.equal(notifications.notificationForEffect(audible, "player_a"), "Your audible Alarm was triggered.");
assert.equal(notifications.notificationForEffect({ ...mental, triggered: false }, "player_a"), null);

console.log("Theatre player notification smoke: OK");
