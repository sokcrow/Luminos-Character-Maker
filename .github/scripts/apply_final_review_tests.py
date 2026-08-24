from pathlib import Path
p=Path('tests/universal_action_economy.spec.js')
t=p.read_text(encoding='utf-8')
old='''test("CombatEngine executes a serialized shared Trait Action without player-local memory", () => {
  global.LuminousTraitEngine = traitEngine;
  const unit = { id: "actor", hp: 10, maxHp: 20 };
  const trait = { id: "shared_heal", name: "Shared Heal", contexts: ["combat"], activation: { type: "manual", actionCost: "action" }, effects: [{ id: "heal", contexts: ["combat"], trigger: "on_use", conditions: [], operations: [{ type: "heal_hp", path: "self.hp", maxPath: "self.maxHp", value: 5 }] }], rules: [] };
  const plannedAction = { kind: "trait", traitId: trait.id, targetId: null, data: { trait } };
  const result = CombatEngine.resolveActionSlot(unit, 0, { phase: "combat", combatData: { actor: unit }, plannedAction });
  expect(result.handled).toBeTruthy();
  expect(result.result.available).toBeTruthy();
  expect(unit.hp).toBe(15);
  delete global.LuminousTraitEngine;
});'''
new='''test("CombatEngine rejects serialized shared Traits that are not trusted grants", () => {
  global.LuminousTraitEngine = traitEngine;
  const unit = { id: "actor", hp: 10, maxHp: 20 };
  const trait = { id: "shared_heal", name: "Shared Heal", contexts: ["combat"], activation: { type: "manual", actionCost: "action" }, effects: [{ id: "heal", contexts: ["combat"], trigger: "on_use", conditions: [], operations: [{ type: "heal_hp", path: "self.hp", maxPath: "self.maxHp", value: 5 }] }], rules: [] };
  const plannedAction = { kind: "trait", traitId: trait.id, targetId: null, data: { trait } };
  const result = CombatEngine.resolveActionSlot(unit, 0, { phase: "combat", combatData: { actor: unit }, plannedAction });
  expect(result.handled).toBeTruthy();
  expect(result.result.available).toBeFalsy();
  expect(unit.hp).toBe(10);
  delete global.LuminousTraitEngine;
});'''
if old in t: t=t.replace(old,new,1)
append=r'''

test("normal Skill reservations and Trait Actions cannot occupy the same Action Slot", () => {
  const unit = { id: "slot-owner", actionSlots: 2 };
  economy.beginPlanning(unit);
  const result = economy.scheduleAction(unit, { kind: "trait", traitId: "x" }, { phase: "planning", reservedSlotIndexes: [0] });
  expect(result.scheduled).toBeTruthy();
  expect(result.slotIndex).toBe(1);
  const one = { id: "one", actionSlots: 1 };
  economy.beginPlanning(one);
  const blocked = economy.scheduleAction(one, { kind: "trait", traitId: "x" }, { phase: "planning", reservedSlotIndexes: [0] });
  expect(blocked.scheduled).toBeFalsy();
  expect(blocked.reason).toBe("no_free_action_slot");
});

test("shared Trait execution ignores serialized definitions and authorizes canonical racial grants", () => {
  global.LuminousTraitEngine = traitEngine;
  global.LuminousRacialTraitCatalog = racialCatalog;
  const unit = { id: "aasimar", raceId: "aasimar", level: 20, hp: 5, maxHp: 30, dndStats: { CON: 10 } };
  const malicious = { id: "aasimar_healing_hands", contexts: ["combat"], activation: { type: "manual", actionCost: "action" }, effects: [{ id: "evil", contexts: ["combat"], trigger: "on_use", conditions: [], operations: [{ type: "heal_hp", path: "self.hp", maxPath: "self.maxHp", value: 999 }] }], rules: [] };
  const result = CombatEngine.resolveActionSlot(unit, 0, { phase: "combat", combatData: { aasimar: unit }, plannedAction: { kind: "trait", traitId: "aasimar_healing_hands", data: { trait: malicious } } });
  expect(result.handled).toBeTruthy();
  expect(result.result.available).toBeTruthy();
  expect(unit.hp).toBe(15);
  const intruder = { id: "kobold", raceId: "kobold", level: 20, hp: 5, maxHp: 30, dndStats: { CON: 10 } };
  const denied = CombatEngine.resolveActionSlot(intruder, 0, { phase: "combat", combatData: { kobold: intruder }, plannedAction: { kind: "trait", traitId: "aasimar_healing_hands", data: { trait: malicious } } });
  expect(denied.handled).toBeTruthy();
  expect(denied.result.available).toBeFalsy();
  expect(intruder.hp).toBe(5);
  delete global.LuminousRacialTraitCatalog;
  delete global.LuminousTraitEngine;
});

test("shared runtime sends identifiers only and Battle viewer protects Trait-reserved slots", () => {
  const runtime = fs.readFileSync(path.join(__dirname, "..", "js", "player-trait-runtime.js"), "utf8");
  const viewer = fs.readFileSync(path.join(__dirname, "..", "Battle-viewer.html"), "utf8");
  expect(runtime).toContain("schedulerUid");
  expect(runtime).not.toContain("data: { ...(local.data || {}), trait }");
  expect(runtime).toContain("reservedSlotIndexes: combatReservedActionSlotIndexes(self)");
  expect(viewer).toContain("function isTraitActionSlotReserved(slotId)");
  expect(viewer).toContain("if (isTraitActionSlotReserved(slot.id))");
  expect(viewer).toContain("if (!attackerId || isTraitActionSlotReserved(attackerId))");
  expect(viewer).toContain("firebase-auth.js");
  expect(viewer).toContain("js/trait-catalog-core.js");
});

test("DM-managed effect renderer uses text nodes for player-controlled fields", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "js", "dm-managed-effect-engine.js"), "utf8");
  expect(source).toContain("function appendTextLine");
  expect(source).toContain("line.textContent");
  expect(source).not.toContain("card.innerHTML");
  expect(source).not.toContain("insertAdjacentHTML");
});
'''
if 'normal Skill reservations and Trait Actions cannot occupy the same Action Slot' not in t: t+=append
p.write_text(t,encoding='utf-8')
print('final review tests applied')