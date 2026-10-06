import assert from "node:assert/strict";

globalThis.window = globalThis;

globalThis.LuminousUniversalRangedAmmoRuntime = {
  ammoCount(unit, ammoId) {
    return Number(unit?.liveAmmo?.[ammoId] ?? 0);
  },
};

globalThis.LuminousAmmoRuntime = {
  resolveEndOfCombatRecovery(stack = {}) {
    const available = { ...(stack.available || {}) };
    for (const [durability, quantity] of Object.entries(stack.spent || {})) {
      available[durability] = Number(available[durability] || 0) + Number(quantity || 0);
    }
    return { ...stack, available, spent: {} };
  },
};

await import("../js/loot-ammo-reconciliation.js");
const runtime = globalThis.LuminousLootAmmoReconciliation;
assert.ok(runtime);

const npc = { liveAmmo: { arrows: 6 } };
const generated = { category: "ammunition", ammoId: "arrows", quantity: 10 };

const live = runtime.reconcileAmmoEntry(npc, generated);
assert.equal(live.reconciled, true);
assert.equal(live.authoritativeQuantity, 6);
assert.equal(live.entry.quantity, 6);
assert.equal(live.entry.lootReconciliation.generatedQuantity, 10);
assert.equal(live.entry.lootReconciliation.regenerated, false);
assert.equal(live.source, "live_combat_state");

const withRecovery = runtime.reconcileAmmoEntry(npc, generated, { recoveredProjectiles: { arrows: 2 } });
assert.equal(withRecovery.authoritativeQuantity, 8);
assert.equal(withRecovery.remaining, 6);
assert.equal(withRecovery.recovered, 2);
assert.equal(withRecovery.source, "live_combat_state_plus_recovery");

const detailedNpc = {
  liveAmmo: { arrows: 6 },
  combatAmmoStacks: {
    arrows: {
      ammoId: "arrows",
      available: { 5: 6 },
      spent: { 4: 2 },
      destroyed: 2,
    },
  },
};
const detailed = runtime.reconcileAmmoEntry(detailedNpc, generated);
assert.equal(detailed.authoritativeQuantity, 8, "detailed projectile lifecycle must override initial/generated quantity");
assert.equal(detailed.remaining, 6);
assert.equal(detailed.recovered, 2);
assert.deepEqual(detailed.recoveredStack.available, { 4: 2, 5: 6 });
assert.equal(detailed.source, "detailed_ammo_stack");

const mixed = runtime.reconcileCarriedAmmo(npc, [
  { category: "food", definitionId: "ration", quantity: 1 },
  generated,
]);
assert.equal(mixed.reconciled, true);
assert.equal(mixed.entries[0].quantity, 1);
assert.equal(mixed.entries[1].quantity, 6);

delete globalThis.LuminousUniversalRangedAmmoRuntime;
const missing = runtime.reconcileAmmoEntry({}, generated);
assert.equal(missing.reconciled, false);
assert.equal(missing.reason, "authoritative_post_combat_ammo_state_missing");
assert.throws(
  () => runtime.assertAmmoReconciledBeforeLock({}, [generated]),
  /LOOT_AMMO_RECONCILIATION_REQUIRED/,
  "loot lock must refuse ammunition without authoritative post-combat state",
);

console.log("Loot ammunition reconciliation smoke passed.");
