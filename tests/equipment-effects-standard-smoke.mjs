import assert from "node:assert/strict";

globalThis.window = globalThis;
await import("../js/item-equipment-effects-runtime.js");
await import("../js/loot-check-runtime.js");
await import("../js/combat-analyze-check-contract.js");
await import("../js/combat-analyze-runtime.js");

const effects = globalThis.LuminousEquipmentEffects;
const checks = globalThis.LuminousLootCheckRuntime;
const analyze = globalThis.LuminousCombatAnalyzeRuntime;
assert.ok(effects && checks && analyze);

const calipsys = {
  id: "test_calipsys", hp: 100, maxHp: 100,
  equipment: {
    armor: { instanceId: "armor_c", runtime: { equipmentEffects: [
      { type: "sin_resistance", sin: "gloom", multiplier: 0.75 },
      { type: "sp_loss_reduction", value: 3 },
    ] } },
  },
};
assert.equal(effects.resolveSinResistance(calipsys, "gloom", 1), 0.75);
assert.equal(effects.resolveSinResistance(calipsys, "wrath", 1), 1);
assert.equal(effects.mitigateSpLoss(calipsys, 2), 0);
assert.equal(effects.mitigateSpLoss(calipsys, 8), 5);
assert.equal(effects.mitigateSpLoss(calipsys, 8, { voluntary: true }), 8);
calipsys.equipment.armor.broken = true;
assert.equal(effects.mitigateSpLoss(calipsys, 8), 8);
assert.equal(effects.resolveSinResistance(calipsys, "gloom", 1), 1);

const jeske = {
  id: "test_jeske", hp: 112, maxHp: 200,
  stats: { wis: 14 }, proficiencyBonus: 2, skillProficiency: { perception: "proficient" },
  sp: 0, battleActive: true,
  augmentations: [{
    instanceId: "eye_1", installed: true, equipped: true,
    runtime: { equipmentEffects: [
      { type: "skill_check_bonus", skill: "perception", value: 1 },
      { type: "check_threshold_reduction", check: "analyze", value: 2 },
    ] },
  }],
  equipment: { armor: { instanceId: "armor_j", runtime: { equipmentEffects: [
    { type: "heal_hp_percent", trigger: "on_turn_start", value: 5 },
    { type: "grant_skill", skillId: "shield_bash" },
  ] } } },
};
const perception = checks.skillMath(jeske, "perception");
assert.equal(perception.base, 5, "Wis 14 + prof 2 + eye 1");
assert.equal(perception.equipmentBonus, 1);
assert.equal(effects.checkThresholdAdjustment(jeske, "analyze"), -2);
assert.equal(effects.checkThresholdAdjustment(jeske, "harvest"), 0);
const uninstalledEye = { instanceId: "eye_not_installed", runtime: { equipmentEffects: [
  { type: "skill_check_bonus", skill: "perception", value: 99 },
] } };
jeske.augmentations.push(uninstalledEye);
assert.equal(effects.skillCheckBonus(jeske, "perception"), 1, "Uninstalled augments cannot grant stats");
uninstalledEye.installed = true;
assert.equal(effects.skillCheckBonus(jeske, "perception"), 100, "Installed augments activate");
jeske.augmentations.pop();
assert.equal(checks.createLootCheckDefinition(jeske, "analyze", {
  threshold: 16,
  thresholdModifier: effects.checkThresholdAdjustment(jeske, "analyze"),
}).threshold, 14);
assert.deepEqual(effects.grantedSkillIds(jeske), ["shield_bash"]);
const noAuthority = effects.applyTurnStart(jeske, { round: 3, encounterId: "enc_1" });
assert.equal(noAuthority.applied, false);
assert.equal(jeske.hp, 112);
const first = effects.applyTurnStart(jeske, { authoritative: true, round: 3, encounterId: "enc_1" });
assert.equal(first.healed, 10);
assert.equal(jeske.hp, 122);
assert.equal(effects.applyTurnStart(jeske, { authoritative: true, round: 3, encounterId: "enc_1" }).healed, 0);
assert.equal(effects.applyTurnStart(jeske, { authoritative: true, round: 4, encounterId: "enc_1" }).healed, 10);
jeske.hp = 198;
assert.equal(effects.applyTurnStart(jeske, { authoritative: true, round: 5, encounterId: "enc_1" }).healed, 2);
assert.equal(jeske.hp, 200);
jeske.hp = 0;
assert.equal(effects.applyTurnStart(jeske, { authoritative: true, round: 6, encounterId: "enc_1" }).healed, undefined);
jeske.hp = 140;
jeske.equipment.armor = null;
assert.equal(effects.applyTurnStart(jeske, { authoritative: true, round: 7, encounterId: "enc_1" }).healed, 0);
assert.deepEqual(effects.grantedSkillIds(jeske), []);
assert.equal(effects.skillCheckBonus(jeske, "perception"), 1, "Eye is independent of armor");
jeske.augmentations[0].installed = false;
assert.equal(effects.skillCheckBonus(jeske, "perception"), 0);
assert.equal(effects.checkThresholdAdjustment(jeske, "analyze"), 0);

console.log("Standard equipment effects: Sin/SP, Augment/Analyze, Turn Start, granted Skills OK");
