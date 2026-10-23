import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = path => fs.readFileSync(path, "utf8");
const writes = [];
const dbRef = {
  on() {}, off() {},
  once: async () => ({ val: () => null }),
  update: async value => { writes.push(value); },
  set: async () => {},
};
const db = { ref: () => dbRef };
const unit = {
  id: "player:p1", canonicalPlayerKey: "p1", canonicalOwnerUid: "owner-uid",
  playerId: "p1", controlled: "remote", faction: "ally",
  hp: 40, maxHp: 50, battleActive: true,
  classes: [{ classId: "barbarian", levels: 1 }],
};
const context = vm.createContext({
  console: { log() {}, warn() {}, error() {} },
  addEventListener() {}, setTimeout() { return 1; }, clearTimeout() {},
  LuminousCombatLiveAdapter073: {
    state: {
      role: "dm", isAuthority: true, round: 1,
      combatState: "PRE_COMBAT_PLANNING",
      user: {}, uid: "dm-uid", db,
      players: { p1: { classes: [{ classId: "barbarian", levels: 1 }] } },
    },
  },
  LuminousCombat073: {
    combatants: () => ({ [unit.id]: unit }),
    kit: () => ({ actions: [] }),
  },
});
context.window = context;
for (const path of [
  "js/trait-engine.js",
  "js/trait-catalog-core.js",
  "js/universal-action-economy.js",
  "js/unit-independent-actions.js",
  "js/combat-v073-remote-intents.js",
]) vm.runInContext(source(path), context, { filename: path });

const controller = context.LuminousUnitIndependentActions;
const remote = context.LuminousCombatRemoteIntents073;
const intent = {
  schemaVersion: 1, playerId: "p1", schedulerUid: "owner-uid",
  unitId: unit.id, round: 1,
  sourceId: "rage", sourceType: "trait", cost: "quick_action",
  targetId: unit.id, createdAt: 1,
};
assert.equal(await remote.processIndependentIntents({ p1: { once: intent } }), true);
assert.equal(unit.quickActionRemaining, 0);
assert.equal(unit.statusEffects?.rage?.count, 1);
assert.equal(writes.length, 1);
assert.equal(writes[0][`campaña/combate/combatants/${unit.id}/quickActionRemaining`], 0);
assert.equal(writes[0]["campaña/combate/independentReceipts/p1/once"].applied, true);
await remote.processIndependentIntents({ p1: { once: intent } });
assert.equal(writes.length, 1, "Authority must never resolve the same Player intent twice");

await remote.processIndependentIntents({
  p1: { unearned: { ...intent, sourceId: "rogue_only_unearned" } },
});
assert.equal(writes.length, 1, "DM must refuse actions not owned by that Unit");

await remote.processIndependentIntents({
  p1: { spoof: { ...intent, schedulerUid: "another-person" } },
});
assert.equal(writes.length, 1, "DM must refuse a different owner's choice");

assert.equal(controller.sourcesFor(unit).some(row => row.definition.id === "rage"), true);
const rules = JSON.parse(source("database.rules.json"));
const combatRules = rules.rules.campaña.combate;
assert.ok(combatRules.independentIntents.$playerId.$intentId[".write"].includes("auth.uid"),
  "Players need a restricted immutable intent path");
assert.ok(combatRules.combatants[".write"].includes("dm_uid"),
  "Players must not receive direct combatant mutation permission");
assert.ok(source("js/combat-v073-authority.js").includes("scheduleIndependentIntents(pending||{})"),
  "DM must flush authenticated independent intents before sealing READY");
assert.ok(source("js/combat-v073-plan-sync.js").includes("await independentChain"),
  "Player READY must not race against independent intent publication");
console.log("DM-authoritative Quick/Free Action intent delivery: ok");
