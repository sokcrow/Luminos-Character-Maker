import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const icons = require("../js/item-icon-registry.js");
const healing = require("../js/item-healing-catalog.js");
const runtime = require("../js/item-runtime-engine.js");

assert.equal(icons.version, 1);
assert.equal(icons.list().length, 46, "V1 should expose exactly 46 shared icon families");
assert.equal(icons.get("healing_hp"), "https://imgur.com/GcnX53v.png");
assert.equal(icons.resolveGroup({ category: "weapon", subtype: "rifle" }), "weapon_ranged");
assert.equal(icons.resolveGroup({ category: "weapon", subtype: "sword" }), "weapon_melee");
assert.equal(icons.resolveGroup({ category: "armor", subtype: "light" }), "armor_light");
assert.equal(icons.resolveGroup({ category: "armor", subtype: "heavy" }), "armor_heavy");
assert.equal(icons.resolveIcon({ category: "unknown" }), icons.get("generic_item"));

assert.equal(healing.version, 1);
assert.equal(healing.items.length, 20, "HP Healing V1 should contain twenty items");
assert.equal(new Set(healing.items.map((item) => item.canonicalId)).size, 20, "canonical IDs must be unique");

for (const tier of ["I", "II", "III", "IV", "V"]) {
  const tierItems = healing.listByTier(tier);
  assert.equal(tierItems.length, 4, `Tier ${tier} should contain four purchase roles`);
  assert.deepEqual(new Set(tierItems.map((item) => item.design.role)), new Set(["budget", "standard", "combat", "rescue"]));
  assert.equal(tierItems.filter((item) => item.runtime.actionCost === "quick_action").length, 1, `Tier ${tier} should have one Quick Action option`);
}

for (const item of healing.items) {
  assert.equal(item.category, "consumable");
  assert.equal(item.subtype, "medical");
  assert.equal(item.iconGroup, "healing_hp");
  assert.equal(item.runtime.targetMode, "self_or_target");
  assert.ok(item.runtime.effects.hpRestore > 0);
  assert.ok(item.priceAhn > 0);
  assert.equal(item.valorBase, item.priceAhn);
  assert.equal(item.consumable_details.curacion_hp, item.runtime.effects.hpRestore);
}

assert.deepEqual(
  ["I", "II", "III", "IV", "V"].map((tier) => Math.max(...healing.listByTier(tier).map((item) => item.runtime.effects.hpRestore))),
  [10, 20, 40, 75, 125],
  "Rescue burst should scale across the 10-200 HP character range",
);

const basic = runtime.makeInstance(healing.get("basic_recovery_ampoule_i"), { quantity: 1, instanceId: "test_basic" });
const user = { hp: 2, maxHp: 20 };
const basicUse = runtime.useItem(user, basic, { phase: "other" });
assert.equal(basicUse.used, true);
assert.equal(user.hp, 10);
assert.equal(runtime.quantityOf(basic), 0);

const allyDose = runtime.makeInstance(healing.get("basic_recovery_ampoule_i"), { quantity: 1, instanceId: "test_ally" });
const medic = { hp: 20, maxHp: 20 };
const ally = { hp: 3, maxHp: 20 };
const allyUse = runtime.useItem(medic, allyDose, { phase: "other", target: ally });
assert.equal(allyUse.used, true);
assert.equal(medic.hp, 20, "healing an ally must not heal the user");
assert.equal(ally.hp, 11, "ally targeting should use the same canonical hpRestore effect");

assert.equal(runtime.actionCostFor(healing.get("snapdose_injector_i")), "quick_action");
assert.equal(runtime.actionCostFor(healing.get("field_trauma_pack_i")), "action");

console.log("Item icon + HP healing catalog smoke: OK");
