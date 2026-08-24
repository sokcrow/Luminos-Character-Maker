from pathlib import Path

p=Path('tests/trait_engine.spec.js')
text=p.read_text(encoding='utf-8')
text += '''\n\ntest("register_dm_effect delegates a structured temporary effect to the runtime", () => {\n  const trait = { id: "dm_effect_test", contexts: ["theatre"], activation: { type: "manual", actionCost: "none" }, effects: [{ id: "register", contexts: ["theatre"], trigger: "on_use", conditions: [], operations: [{ type: "register_dm_effect", effectId: "test", durationHours: 1, check: { abilityId: "cha" }, modifier: { channel: "final_power", value: 4 } }] }], rules: [] };\n  let captured = null;\n  const result = traits.activateTrait(trait, { context: "theatre", character: { id: "p" }, self: { id: "p" }, target: { id: "npc", name: "NPC" }, registerDmEffect: (descriptor) => (captured = descriptor) }, traits.createState());\n  expect(result.available).toBeTruthy();\n  expect(captured.effectId).toBe("test");\n  expect(captured.durationHours).toBe(1);\n  expect(captured.targetId).toBe("npc");\n  expect(captured.modifier.value).toBe(4);\n});\n'''
p.write_text(text,encoding='utf-8')

p=Path('tests/racial_trait_catalog.spec.js')
text=p.read_text(encoding='utf-8')
text += '''\n\ntest("Subtle Influence is a one-hour DM-managed CHA effect", () => {\n  const trait = catalog.getDefinition("yuan_ti_subtle_influence");\n  const op = trait.effects.flatMap((effect) => effect.operations).find((entry) => entry.type === "register_dm_effect");\n  expect(op).toBeTruthy();\n  expect(op.durationHours).toBe(1);\n  expect(op.check.abilityId).toBe("cha");\n  expect(op.modifier.channel).toBe("final_power");\n  expect(op.modifier.value).toBe(4);\n  expect(trait.activation.conditions.some((condition) => condition.path === "target" && condition.operator === "truthy")).toBeTruthy();\n});\n'''
p.write_text(text,encoding='utf-8')

p=Path('tests/universal_action_economy.spec.js')
text=p.read_text(encoding='utf-8')
text=text.replace('const racialCatalog = require("../js/racial-trait-catalog.js");','const racialCatalog = require("../js/racial-trait-catalog.js");\nconst CombatEngine = require("../js/combatEngine.js");\nconst dmEffects = require("../js/dm-managed-effect-engine.js");')
text += '''\n\ntest("CombatEngine executes a serialized shared Trait Action without player-local memory", () => {\n  global.LuminousTraitEngine = traitEngine;\n  const unit = { id: "actor", hp: 10, maxHp: 20 };\n  const trait = { id: "shared_heal", name: "Shared Heal", contexts: ["combat"], activation: { type: "manual", actionCost: "action" }, effects: [{ id: "heal", contexts: ["combat"], trigger: "on_use", conditions: [], operations: [{ type: "heal_hp", path: "self.hp", maxPath: "self.maxHp", value: 5 }] }], rules: [] };\n  const plannedAction = { kind: "trait", traitId: trait.id, targetId: null, data: { trait } };\n  const result = CombatEngine.resolveActionSlot(unit, 0, { phase: "combat", combatData: { actor: unit }, plannedAction });\n  expect(result.handled).toBeTruthy();\n  expect(result.result.available).toBeTruthy();\n  expect(unit.hp).toBe(15);\n  delete global.LuminousTraitEngine;\n});\n\ntest("DM managed effects expose deterministic duration helpers", () => {\n  const effect = { active: true, expiresAt: 3_600_000 };\n  expect(dmEffects.isActive(effect, 0)).toBeTruthy();\n  expect(dmEffects.formatRemaining(effect, 0)).toBe("1h 0m");\n  expect(dmEffects.isActive(effect, 3_600_000)).toBeFalsy();\n});\n'''
p.write_text(text,encoding='utf-8')
print('final tests staged')
