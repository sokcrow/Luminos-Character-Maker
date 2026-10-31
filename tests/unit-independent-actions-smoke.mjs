import assert from "node:assert/strict";
import fs from "node:fs";
import "../js/status-library.js";
import "../js/status-engine.js";
import "../js/trait-engine.js";
import "../js/combat-event-runtime.js";
import "../js/trait-catalog-core.js";
import "../js/universal-action-economy.js";
import "../js/combat-action-schema.js";
import "../js/combat-action-adapters.js";
import "../js/unit-independent-actions.js";
import "../js/individual-goap-combat-ai.js";
import "../js/unit-ai-kit-adapter.js";

const units = [];
globalThis.LuminousCombatLiveAdapter073 = { state: { round: 1, players: {} } };
globalThis.LuminousCombat073 = { combatants: () => Object.fromEntries(units.map(unit => [unit.id, unit])) };
const controller = globalThis.LuminousUnitIndependentActions;
const player = {
  id: "player:pc", hp: 32, maxHp: 50, controlled: "player", battleActive: true,
  faction: "ally", classes: [{ classId: "barbarian", levels: 1 }],
};
const enemy = {
  id: "enemy:npc", hp: 35, maxHp: 60, controlled: "ai", battleActive: true,
  faction: "enemy", classes: [{ classId: "barbarian", levels: 1 }],
};
units.push(player, enemy);
const rage = controller.ownedTraits(player).find(row => row.id === "rage");
assert.ok(rage, "Canonical Class grants must resolve for every Unit");
assert.equal(controller.costOf(rage), "quick_action");
const unhandled = { id: "unhandled_quick", name: "Unimplemented", contexts: ["combat"],
  activation: { type: "manual", actionCost: "quick_action" }, effects: [] };
assert.equal(controller.execute(player, { sourceType: "trait", definition: unhandled },
  { round: 1, phase: "planning", units }).used, false, "Unavailable runtime must fail closed");
assert.equal(player.quickActionRemaining ?? 1, 1, "Failed Quick action must not spend budget");

const quick = controller.execute(player, { sourceType: "trait", definition: rage },
  { round: 1, phase: "planning", units });
assert.equal(quick.used, true);
assert.equal(player.statusEffects.rage.count, 1, "Quick Trait must affect the real live Unit");
assert.equal(player.quickActionRemaining, 0);
assert.equal(controller.execute(player, { sourceType: "trait", definition: rage },
  { round: 1, phase: "planning", units }).used, false, "One Quick Action per Unit / round");

const free = { id: "free_signal", name: "Free Signal", contexts: ["combat"],
  activation: { type: "manual", actionCost: "none" }, maxUsesPerTurn: 1,
  effects: [{ trigger: "on_use", operations: [{ type: "apply_status", statusId: "signal", count: 1 }] }] };
assert.equal(controller.execute(player, { sourceType: "trait", definition: free },
  { round: 1, phase: "planning", units }).used, true);
assert.equal(player.statusEffects.signal.count, 1);
assert.equal(player.quickActionRemaining, 0, "Free Actions do not spend Quick or Action Slots");
assert.equal(controller.execute(player, { sourceType: "trait", definition: free },
  { round: 1, phase: "planning", units }).used, false, "Free actions must not loop endlessly");

const ai = controller.runAiTurn(enemy, { round: 1, units });
assert.ok(ai.used.some(row => row.sourceId === "rage"), "GOAP Unit can independently decide to use Rage");
assert.equal(enemy.quickActionRemaining, 0);
assert.equal(enemy.statusEffects.rage.count, 1);
assert.equal(controller.runAiTurn(enemy, { round: 1, units }).used.length, 0,
  "AI must not repeat independent actions across its Action Slots");

const fresh = { id: "new_quick", name: "New Quick", contexts: ["combat"],
  activation: { type: "manual", actionCost: "quick_action" },
  effects: [{ trigger: "on_use", operations: [{ type: "apply_status", statusId: "boost" }] }] };
assert.equal(controller.execute(player, { sourceType: "trait", definition: fresh },
  { round: 2, phase: "planning", units }).used, true, "Quick budget resets next round");

const goapUnit = { id: "enemy:goap", hp: 20, maxHp: 20, controlled: "ai", faction: "enemy",
  battleActive: true, actionSlots: 1,
  combatSkills: [{ id: "slash", name: "Slash", kind: "skill", basePower: 4, coinPower: 1, coinAmount: 1 }],
  traits: [free, { id: "speed_quick", name: "Speed Quick", contexts: ["combat"],
    activation: { type: "manual", actionCost: "quick_action" },
    effects: [{ trigger: "on_use", operations: [{ type: "apply_status", statusId: "speed" }] }] }],
};
const plan = globalThis.LuminousUnitAiKitAdapter.planUnitTurn({ actor: goapUnit,
  slotIds: ["enemy:goap_slot_0"], targetIds: ["player:pc"] });
assert.ok(plan.independentSources.some(row => row.definition.id === "speed_quick"));
assert.ok(plan.independentSources.some(row => row.definition.id === "free_signal"));
assert.ok(!plan.actions.some(row => ["speed_quick", "free_signal"].includes(row.source?.id)),
  "GOAP must not put Quick or Free actions into Action Slots");
const onlyIndependent = globalThis.LuminousUnitAiKitAdapter.planUnitTurn({
  actor: { ...goapUnit, combatSkills: [] }, slotIds: ["enemy:goap_slot_0"], targetIds: ["player:pc"],
});
assert.equal(onlyIndependent.actions.length, 0, "Units with only Quick/Free do not invent Action Slots");

const schema = globalThis.LuminousCombatAction;
const action = globalThis.LuminousCombatActionAdapters.compileTraitToCombatAction(player, rage, {
  actorId: player.id, cost: "quick_action",
  selectedAt: schema.PHASES.PLANNING_PHASE_PLAYER, executesAt: schema.PHASES.COMBAT_PHASE,
});
assert.equal(schema.validateCombatAction(action).valid, true,
  "Combat phase supports independent Quick actions");

const authority = fs.readFileSync("js/combat-v073-authority.js", "utf8");
const menu = fs.readFileSync("js/combat-v073-economy-menu.js", "utf8");
assert.ok(fs.readFileSync("combat/source/combat-v073-live.html","utf8").includes("runAiPhase") && authority.includes("ai_independent"),
  "Real Combat queue must support AI with and without regular Action Slots");
assert.ok(authority.includes("combatIndependentActionState"),
  "Independent budget and trait state must persist in canonical checkpoints");
assert.ok(menu.includes('data-economy="free_action"') && menu.includes("LuminousUnitIndependentActions"),
  "Player mobile/desktop menu must expose the same resolver and Free Actions");
console.log("Universal Unit Quick/Free actions contract: ok");


// Slot Traits must activate through the same transaction as Quick/Free Traits.
const slotTrait = { ...free, id: "slot_signal", activation: { type: "manual", actionCost: "action" } };
const quickBeforeSlotTrait = enemy.quickActionRemaining;
assert.equal(controller.execute(enemy, { sourceType: "trait", definition: slotTrait, cost: "action" },
  { slotAction: true, round: 1, phase: "combat", units, target: enemy, silent: true }).used, true);
assert.equal(enemy.statusEffects.signal.count, 1);
assert.equal(enemy.quickActionRemaining, quickBeforeSlotTrait);
assert.equal(controller.execute(enemy, { sourceType: "trait", definition: slotTrait, cost: "action" },
  { round: 1, phase: "combat", units }).used, false, "ordinary independent requests cannot bypass Action Slots");
