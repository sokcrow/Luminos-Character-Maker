import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// DM-offline player requests remain in RTDB and never award loot locally.
const writes = [];
const currentUser = {uid: "uid_hunter"};
globalThis.firebase = {auth: () => ({currentUser})};
const realTimeout = globalThis.setTimeout;
globalThis.setTimeout = (fn, ms, ...args) => realTimeout(fn, ms === 6000 ? 0 : ms, ...args);
const db = {
  ref(path) {
    return {
      once: async () => ({val: () => path === "campaña/loot_claims/corpse_1"
        ? {uid: currentUser.uid, playerId: "hunter", expiresAt: Date.now() + 60000}
        : null}),
      set: async value => {writes.push({path,value});},
      on() {}, off() {},
    };
  },
};

await import("../js/loot-live-postcombat-runtime.js");
const runtime = globalThis.LuminousLootLivePostCombatRuntime;
const result = await runtime.requestAction({
  db, playerId: "hunter", lootInstanceId: "corpse_1",
  actionId: "search", checkResult: {heads: 2},
});
assert.equal(result.queued, true, "DM-free submission must return pending, not a fake reward");
assert.equal(writes.length, 1);
assert.equal(writes[0].value.status, "pending");
assert.equal(writes[0].value.uid, currentUser.uid);
assert.equal(writes[0].value.checkHeads, 2);
assert.ok(writes[0].path.startsWith("campaña/loot_requests/hunter/"));
assert.equal("delivered" in result, false, "never claim successful loot delivery without authority");

const player = readFileSync(new URL("../js/player-postcombat-loot.js", import.meta.url), "utf8");
const css = readFileSync(new URL("../css/postcombat-loot-corpse.css", import.meta.url), "utf8");
assert.match(player, /LuminousItemIconRegistry/, "resolve icons using the existing registry");
assert.ok(player.includes("fallback/generic_item.png"), "missing art gets a real generic item icon");
assert.ok(player.includes("data-loot-detail"), "touch opens the full name");
assert.ok(player.includes("pendingRequests"), "queue state visible in the corpse HUD");
assert.ok(css.includes("@media(max-width:700px)"), "mobile design is explicitly supported");
assert.ok(css.includes("grid-template-rows:auto minmax(0,1fr) auto"), "corpse strip / body / inventory fit phone height");
console.log("Loot mobile icon HUD and persistent offline-DM queue smoke passed.");
