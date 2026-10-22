import assert from "node:assert/strict";

// The Player Loot module must not open RTDB listeners before Firebase Auth
// hydrates the session. Opening them early gives permission_denied in production.
const subscriptions = [];
const database = {
  ref(path) {
    return {
      on() { subscriptions.push(path); },
      off() {},
      once: async () => ({val: () => null}),
    };
  },
};
let authListener = null;
let authUnsubscribed = false;
const auth = {
  currentUser: null,
  onAuthStateChanged(listener) {
    authListener = listener;
    return () => { authUnsubscribed = true; authListener = null; };
  },
};
const button = {classList: {toggle() {}}, querySelector: () => ({textContent: ""})};
const modal = {classList: {remove() {}}, setAttribute() {}};
let boot = null;

globalThis.window = globalThis;
globalThis.firebase = {auth: () => auth, database: () => database};
globalThis.localStorage = {getItem: key => key === "playerId" ? "hunter" : null};
globalThis.LuminousLootLivePostCombatRuntime = {
  ROOTS: {
    encounterLoot: "campaña/loot_encounters",
    claims: "campaña/loot_claims",
    requests: "campaña/loot_requests",
    postCombat: "campaña/loot_postcombat",
    combatState: "campaña/combate/estado",
  },
  ensureDependencies: async () => {},
};
globalThis.document = {
  readyState: "loading",
  addEventListener(type, callback) { if (type === "DOMContentLoaded") boot = callback; },
  getElementById(id) {
    if (id === "postcombat-loot-style") return {};
    if (id === "btn-postcombat-loot") return button;
    if (id === "postcombat-loot-modal") return modal;
    return null;
  },
};

await import("../js/player-postcombat-loot.js");
const loot = globalThis.LuminousPlayerPostCombatLoot;
assert.ok(loot && boot);
assert.equal(await loot.install({db: database, playerId: "hunter"}), false, "unauthenticated install must return false");
assert.deepEqual(subscriptions, [], "no RTDB listeners before Auth");

boot();
assert.equal(typeof authListener, "function", "wait for the existing Auth observer");
assert.deepEqual(subscriptions, [], "still no RTDB listeners during login");

auth.currentUser = {uid: "valid-player-uid"};
authListener(auth.currentUser);
await new Promise(resolve => setImmediate(resolve));
assert.equal(authUnsubscribed, true, "stop the bootstrap Auth observer after login");
assert.ok(subscriptions.includes("campaña/loot_encounters"), "player receives encounter loot subscription");
assert.ok(subscriptions.includes("campaña/loot_claims"), "player receives corpse lease subscription");
assert.ok(subscriptions.includes("campaña/loot_postcombat"), "player receives shared corpse state subscription");
assert.ok(subscriptions.includes("campaña/loot_requests/hunter"), "player receives only their queued actions");

console.log("Player loot waits for Auth before opening protected RTDB listeners.");
