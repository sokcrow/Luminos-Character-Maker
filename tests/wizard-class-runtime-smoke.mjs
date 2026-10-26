import assert from "node:assert/strict";

for (const key of [
  "LuminousTraitEngine",
  "LuminousTraitCatalogCore",
  "LuminousSpellcastingRuntime",
  "LuminousCasterSpellcastingTraitsRuntime",
  "LuminousContentRegistry",
  "LuminousContentRegistryBootstrap",
  "LuminousSpellCatalog",
  "LuminousRoleSpellCatalog",
  "LuminousWizardClassRuntime",
]) delete globalThis[key];

await import("../js/trait-engine.js");
await import("../js/trait-catalog-core.js");
await import("../js/content-registry.js");
await import("../js/content-registry-bootstrap.js");
await import("../js/spellcasting-runtime.js");
await import("../js/spellcasting-basic-rules-runtime.js");
await import("../js/caster-spellcasting-traits-runtime.js");
await import("../js/spell-catalog-core.js");
await import("../js/role-spell-catalog-core.js");
await import("../js/wizard-class-runtime.js");

const runtime = globalThis.LuminousWizardClassRuntime;
const spellcasting = globalThis.LuminousSpellcastingRuntime;
const engine = globalThis.LuminousTraitEngine;
const catalog = globalThis.LuminousTraitCatalogCore;

assert.ok(runtime, "Wizard class runtime should install");
assert.equal(runtime.CLASS_ID, "wizard");
for (const [level, traitId] of [[1, "spellbook"], [1, "ritual_casting_wizard"], [1, "arcane_recovery"], [90, "spell_mastery"], [100, "signature_spells"]]) {
  assert.ok(catalog.allGrants().some((grant) => grant.sourceId === "wizard" && grant.atLevel === level && grant.traitId === traitId), `${traitId} should be granted at Wizard ${level}`);
}
assert.ok(catalog.allGrants().some((grant) => grant.sourceId === "wizard" && grant.traitId === "spellcasting_ability_wizard"));

const spellsById = {
  mage_hand: { id: "mage_hand", level: 0, cantrip: true, classIds: ["wizard"] },
  fire_bolt: { id: "fire_bolt", level: 0, cantrip: true, classIds: ["wizard"] },
  minor_illusion: { id: "minor_illusion", level: 0, cantrip: true, classIds: ["wizard"] },
  shield: { id: "shield", level: 1, classIds: ["wizard"] },
  magic_missile: { id: "magic_missile", level: 1, classIds: ["wizard"] },
  detect_magic: { id: "detect_magic", level: 1, ritual: true, classIds: ["wizard"], castingTimeSeconds: 6 },
  misty_step: { id: "misty_step", level: 2, classIds: ["wizard"] },
  scorching_ray: { id: "scorching_ray", level: 2, classIds: ["wizard"] },
  fireball: { id: "fireball", level: 3, classIds: ["wizard"] },
  counterspell: { id: "counterspell", level: 3, classIds: ["wizard"] },
};
const makeWizard = (level, intelligence = 18) => ({ id: `wizard_${level}`, stats: { int: intelligence }, classes: [{ id: "wizard", level }] });

const lv50 = makeWizard(50, 18);
assert.equal(runtime.wizardProgressionLevel(lv50), 10);
assert.equal(runtime.preparedSpellLimit(lv50), 14);
assert.equal(runtime.arcaneRecoveryLimit(lv50), 5);
assert.equal(runtime.freeSpellbookAllowance(lv50), 24);
assert.equal(runtime.setWizardCantrips(lv50, ["mage_hand", "fire_bolt", "minor_illusion"], { spellsById }).success, true);
for (const id of ["shield", "magic_missile", "detect_magic", "misty_step", "scorching_ray", "fireball", "counterspell"]) {
  assert.equal(runtime.addSpellToSpellbook(lv50, id, { spellsById, free: id !== "counterspell" }).success, true);
}
assert.equal(runtime.setPreparedSpells(lv50, ["shield", "magic_missile", "misty_step", "fireball"], { spellsById }).success, true);
assert.deepEqual(runtime.spellIdsForCombat(lv50).sort(), ["fire_bolt", "fireball", "mage_hand", "magic_missile", "minor_illusion", "misty_step", "shield"].sort());
assert.equal(runtime.canRitualCast(lv50, spellsById.detect_magic, { spellsById }).available, true);
const ritualCast = runtime.castWizardSpell(lv50, spellsById.detect_magic, { ritual: true, spellsById });
assert.equal(ritualCast.success, true);
assert.equal(ritualCast.resource.type, "ritual");
assert.equal(ritualCast.resource.spent, 0);
assert.equal(ritualCast.spell.castingTimeSeconds, 606);

const lv100 = makeWizard(100, 20);
spellcasting.spellSlotPool(lv100, "wizard");
spellcasting.spendSpellSlot(lv100, "wizard", 5);
spellcasting.spendSpellSlot(lv100, "wizard", 5);
runtime.handleRestCompleted({ detail: { type: "short_rest", character: lv100 } });
const recovered = runtime.recoverArcaneSlots(lv100, [5, 5]);
assert.equal(recovered.success, true);
assert.equal(recovered.limit, 10);
assert.equal(recovered.recoveredLevels, 10);
assert.equal(spellcasting.spellSlotPool(lv100, "wizard").levels[5].spent, 0);
assert.equal(runtime.recoverArcaneSlots(lv100, [1]).success, false);
runtime.handleRestCompleted({ detail: { type: "long_rest", character: lv100 } });
assert.equal(runtime.ensureWizardState(lv100).arcaneRecovery.used, false);

for (const id of ["shield", "magic_missile", "detect_magic", "misty_step", "scorching_ray", "fireball", "counterspell"]) {
  assert.equal(runtime.addSpellToSpellbook(lv100, id, { spellsById, free: false }).success, true);
}
assert.equal(runtime.setPreparedSpells(lv100, ["shield", "misty_step"], { spellsById }).success, true);
assert.equal(runtime.setSpellMastery(lv100, "shield", "misty_step", { spellsById }).success, true);
assert.deepEqual(runtime.freeCastMode(lv100, spellsById.shield, 1), { type: "spell_mastery", spellId: "shield", slotLevel: 1 });
const masteryCast = runtime.castWizardSpell(lv100, spellsById.shield, { spellsById });
assert.equal(masteryCast.success, true);
assert.equal(masteryCast.resource.type, "spell_mastery");
assert.equal(runtime.castWizardSpell(lv100, spellsById.shield, { spellsById, slotLevel: 2 }).resource.type, "slot");

assert.equal(runtime.setSignatureSpells(lv100, ["fireball", "counterspell"], { spellsById }).success, true);
assert.equal(runtime.isPrepared(lv100, "fireball"), true);
assert.equal(runtime.signatureFreeCastAvailable(lv100, "fireball", 3), true);
assert.equal(runtime.consumeFreeCast(lv100, "signature_spells", "fireball", 3).success, true);
assert.equal(runtime.signatureFreeCastAvailable(lv100, "fireball", 3), false);
runtime.handleRestCompleted({ detail: { type: "short_rest", character: lv100 } });
assert.equal(runtime.signatureFreeCastAvailable(lv100, "fireball", 3), true);

const traits = engine.resolveTraitGrants(lv100, catalog.allGrants(), catalog.allDefinitions());
for (const id of ["spellcasting_ability_wizard", "spellbook", "ritual_casting_wizard", "arcane_recovery", "spell_mastery", "signature_spells"]) {
  assert.ok(traits.some((trait) => trait.id === id), `${id} should resolve on a Level 100 Wizard`);
}
assert.equal(catalog.validateAll(engine).valid, true);
console.log("Wizard class runtime smoke passed.");
