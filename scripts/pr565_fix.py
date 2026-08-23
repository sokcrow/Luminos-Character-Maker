from pathlib import Path
import re


def sub_once(path, pattern, replacement, label, flags=0):
    p = Path(path)
    text = p.read_text()
    new, count = re.subn(pattern, replacement, text, count=1, flags=flags)
    if count != 1:
        raise SystemExit(f"{label}: expected 1 match in {path}, found {count}")
    p.write_text(new)


def replace_once(path, old, new, label):
    p = Path(path)
    text = p.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected 1 match in {path}, found {count}")
    p.write_text(text.replace(old, new, 1))


def append_once(path, marker, block):
    p = Path(path)
    text = p.read_text()
    if marker in text:
        return
    p.write_text(text.rstrip() + "\n\n" + block.strip() + "\n")


catalog = "js/racial-trait-catalog.js"
sub_once(
    catalog,
    r"    pack_tactics: \{.*?\n    \},\n\n    keen_hearing:",
    '''    pack_tactics: {
      schemaVersion: 1,
      id: "pack_tactics",
      name: "Pack Tactics",
      description: "When the current target is also Targeted by an Ally, gain +1 Final Power for this attack.",
      source: sharedSource,
      contexts: ["combat"],
      activation: { type: "passive", actionCost: "none" },
      effects: [],
      rules: [{
        type: "modifier",
        trigger: "passive",
        target: "self",
        channel: "final_power",
        mode: "add",
        value: 1,
        conditions: [{ path: "targetedByAlly", operator: "truthy" }],
      }],
    },

    keen_hearing:''',
    "Pack Tactics universal final_power",
    re.S,
)
replace_once(
    catalog,
    'rules: [{ type: "modifier", trigger: "before_attack", target: "self", path: "skill.finalPower", mode: "add", value: 1, conditions: [{ path: "target.speed", operator: "lt", valueFormula: "MaxSpeed" }] }],',
    'rules: [{ type: "modifier", trigger: "passive", target: "self", channel: "final_power", mode: "add", value: 1, conditions: [{ path: "target.speed", operator: "lt", valueFormula: "MaxSpeed" }] }],',
    "Centaur Charge universal final_power",
)
text = Path(catalog).read_text()
count = text.count('formula: "floor(Level / 10)"')
if count != 3:
    raise SystemExit(f"Aasimar damage floor: expected 3 formulas, found {count}")
text = text.replace('formula: "floor(Level / 10)"', 'formula: "max(1, floor(Level / 10))"')
text = text.replace('Once per Turn adds Level/10 Radiant Fixed Damage.', 'Once per Turn adds at least 1 Fixed Damage based on Level/10.')
text = text.replace('Once per Turn adds Level/10 Radiant Fixed Damage; aura damage is exposed for encounter resolution.', 'Once per Turn adds at least 1 Fixed Damage based on Level/10; aura damage is exposed for encounter resolution.')
text = text.replace('Once per Turn adds Level/10 Necrotic Fixed Damage; activation exposes the Frightened check request.', 'Once per Turn adds at least 1 Fixed Damage based on Level/10; activation exposes the Frightened check request.')
Path(catalog).write_text(text)
replace_once(catalog, 'formula: "max(0, ConstitutionMod)"', 'formula: "max(1, ConstitutionMod)"', "Relentless Strength minimum")
replace_once(catalog, 'formula: "2 * max(0, ConstitutionMod)"', 'formula: "2 * max(1, ConstitutionMod)"', "Relentless Strength Dragon Form minimum")
replace_once(
    catalog,
    'rules: [{ type: "modifier", trigger: "before_attack", target: "self", path: "skill.clashPower", mode: "add", value: 2, conditions: [{ path: "target.speed", operator: "lt", valueFormula: "MaxSpeed" }] }],',
    'rules: [{ type: "modifier", trigger: "passive", target: "self", channel: "clash_power", mode: "add", value: 2, conditions: [{ path: "target.speed", operator: "lt", valueFormula: "MaxSpeed" }] }],',
    "Skilled Hunter universal clash_power",
)
replace_once(
    catalog,
    'formula: "floor(DamageDealt * (Level / 4) / 100)"',
    'formula: "max(1, floor(DamageDealt * (Level / 4) / 100))"',
    "Sacred Breath minimum positive bonus",
)
replace_once(
    catalog,
    'rules: [{ type: "modifier", trigger: "before_attack", target: "self", path: "skill.clashPower", mode: "add", value: 2, conditions: [{ path: "self.took_damage_last_turn", operator: "falsy" }] }],',
    'rules: [{ type: "modifier", trigger: "passive", target: "self", channel: "clash_power", mode: "add", value: 2, conditions: [{ path: "self.took_damage_last_turn", operator: "falsy" }] }],',
    "Moonfae Lunge universal clash_power",
)

engine = "js/trait-engine.js"
replace_once(
    engine,
    'const level = Math.max(0, int(runtime.Level ?? runtime.level ?? character.level));',
    'const level = Math.max(0, int(runtime.Level ?? runtime.level ?? character.level ?? character.characterBuild?.calculatedAtLevel));',
    "Trait Engine stored build level",
)
sub_once(
    engine,
    r'''    if \(\["eq", "equals"\]\.includes\(op\)\) return left === right; if \(\["ne", "not_equals"\]\.includes\(op\)\) return left !== right;\n    if \(op === "gt"\).*?if \(op === "between"\) return Number\(left\) >= Number\(right\) && Number\(left\) <= Number\(c\.max\);''',
    '''    const equal = (a, b) => typeof a === "string" && typeof b === "string" ? normalizeId(a) === normalizeId(b) : a === b;
    const contains = (container, value) => Array.isArray(container)
      ? container.some((entry) => equal(entry, value))
      : (typeof container === "string" && typeof value === "string" ? normalizeId(container).includes(normalizeId(value)) : String(container ?? "").includes(String(value ?? "")));
    if (["eq", "equals"].includes(op)) return equal(left, right); if (["ne", "not_equals"].includes(op)) return !equal(left, right);
    if (op === "gt") return Number(left) > Number(right); if (op === "gte") return Number(left) >= Number(right); if (op === "lt") return Number(left) < Number(right); if (op === "lte") return Number(left) <= Number(right);
    if (op === "truthy") return Boolean(left); if (op === "falsy") return !left; if (op === "contains") return contains(left, right); if (op === "not_contains") return !contains(left, right);
    if (op === "in") return Array.isArray(right) && right.some((entry) => equal(left, entry)); if (op === "not_in") return Array.isArray(right) && !right.some((entry) => equal(left, entry)); if (op === "between") return Number(left) >= Number(right) && Number(left) <= Number(c.max);''',
    "Trait Engine normalized enum comparisons",
    re.S,
)

universal = "js/universal-modifier-engine.js"
sub_once(
    universal,
    r"  function conditionMatches\(condition, runtime\) \{.*?\n  \}\n\n  function channelForRule",
    '''  function conditionMatches(condition, runtime, character = runtime?.character || {}, trait = {}) {
    if (!condition || typeof condition !== "object") return Boolean(condition);
    if (Array.isArray(condition.all)) return condition.all.every((entry) => conditionMatches(entry, runtime, character, trait));
    if (Array.isArray(condition.any)) return condition.any.some((entry) => conditionMatches(entry, runtime, character, trait));
    if (condition.not) return !conditionMatches(condition.not, runtime, character, trait);
    const left = condition.path ? getPath(runtime, condition.path) : condition.left;
    const right = condition.valueFormula != null && traitEngine?.evaluateFormula && traitEngine?.buildVariables
      ? traitEngine.evaluateFormula(condition.valueFormula, traitEngine.buildVariables(character || {}, runtime || {}, trait || {}))
      : condition.value;
    const operator = normalizeId(condition.operator || "eq");
    const equal = (a, b) => typeof a === "string" && typeof b === "string" ? normalizeId(a) === normalizeId(b) : a === b;
    const contains = (container, value) => Array.isArray(container)
      ? container.some((entry) => equal(entry, value))
      : (typeof container === "string" && typeof value === "string" ? normalizeId(container).includes(normalizeId(value)) : String(container ?? "").includes(String(value ?? "")));
    if (["eq", "equals"].includes(operator)) return equal(left, right);
    if (["ne", "not_equals"].includes(operator)) return !equal(left, right);
    if (operator === "truthy") return Boolean(left);
    if (operator === "falsy") return !left;
    if (operator === "gt") return Number(left) > Number(right);
    if (operator === "gte") return Number(left) >= Number(right);
    if (operator === "lt") return Number(left) < Number(right);
    if (operator === "lte") return Number(left) <= Number(right);
    if (operator === "between") return Number(left) >= Number(right) && Number(left) <= Number(condition.max);
    if (operator === "contains") return contains(left, right);
    if (operator === "not_contains") return !contains(left, right);
    if (operator === "in") return Array.isArray(right) && right.some((entry) => equal(left, entry));
    if (operator === "not_in") return Array.isArray(right) && !right.some((entry) => equal(left, entry));
    return false;
  }

  function channelForRule''',
    "Universal normalized conditions",
    re.S,
)
replace_once(
    universal,
    'const runtime = { context, character, self: unit, skill, equipment };',
    'const runtime = { context, character, self: unit, skill, equipment, target: options.target || null, targetedByAlly: Boolean(options.targetedByAlly), variables: options.variables || {} };',
    "Universal target context",
)
replace_once(
    universal,
    'if (!(rule.conditions || []).every((condition) => conditionMatches(condition, runtime))) return;',
    'if (!(rule.conditions || []).every((condition) => conditionMatches(condition, runtime, character, trait))) return;',
    "Universal valueFormula context",
)

standard = "js/trait-standardization-runtime.js"
replace_once(standard, 'combatUnits: new Map(),\n    viewerEncounterBound: false,', 'combatUnits: new Map(),\n    modifierTargets: new Map(),\n    viewerEncounterBound: false,', "Scoped target state")
sub_once(
    standard,
    r"(  function isTargetedByAlly\(attacker, target\) \{.*?\n  \}\n)\n  function ensureDamageHistory",
    r'''\1
  function currentAssignedTarget(attacker) {
    if (!attacker) return null;
    const slotTargets = viewerSlotTargets();
    if (!slotTargets) return null;
    const combatData = viewerCombatData() || {};
    const attackerIds = new Set(identityValues(attacker));
    for (const [attackerSlotId, targetSlotId] of Object.entries(slotTargets)) {
      const attackerBaseId = String(attackerSlotId || "").split("_slot_")[0];
      if (!attackerIds.has(attackerBaseId) && combatData?.[attackerBaseId] !== attacker) continue;
      const targetBaseId = String(targetSlotId || "").split("_slot_")[0];
      const direct = combatData?.[targetBaseId];
      if (direct) return direct;
      const registered = registeredCombatUnits().find((unit) => identityValues(unit).includes(targetBaseId));
      if (registered) return registered;
    }
    return null;
  }

  function modifierTarget(unit) {
    if (!unit) return null;
    return state.modifierTargets.get(combatUnitKey(unit)) || currentAssignedTarget(unit) || null;
  }

  function withModifierTargets(pairs, callback) {
    const previous = [];
    (pairs || []).forEach(([unit, target]) => {
      if (!unit) return;
      const key = combatUnitKey(unit);
      previous.push([key, state.modifierTargets.has(key), state.modifierTargets.get(key)]);
      if (target) state.modifierTargets.set(key, target);
      else state.modifierTargets.delete(key);
    });
    try {
      return callback();
    } finally {
      previous.reverse().forEach(([key, hadValue, value]) => {
        if (hadValue) state.modifierTargets.set(key, value);
        else state.modifierTargets.delete(key);
      });
    }
  }

  function ensureDamageHistory''',
    "Target scope helpers",
    re.S,
)
replace_once(standard, 'state.combatUnits.clear();\n        return;', 'state.combatUnits.clear();\n        state.modifierTargets.clear();\n        return;', "Clear target scope")
sub_once(
    standard,
    r'''    if \(originalUnilateral\) engine\.resolveUnilateralWithCounter = function \(unitAttacker, attackSkill, \.\.\.rest\) \{\n      const check = canUseSkillByTraits\(unitAttacker, attackSkill\);\n      if \(!check\.usable\) return blockedSkillResult\(check, \{ attackLogs: \[\{ message: check\.reason, class: "error" \}\], damageTaken: 0 \}\);\n      return originalUnilateral\.call\(this, unitAttacker, attackSkill, \.\.\.rest\);\n    \};''',
    '''    if (originalUnilateral) engine.resolveUnilateralWithCounter = function (unitAttacker, attackSkill, ...rest) {
      const check = canUseSkillByTraits(unitAttacker, attackSkill);
      if (!check.usable) return blockedSkillResult(check, { attackLogs: [{ message: check.reason, class: "error" }], damageTaken: 0 });
      const unitDefender = rest[0] || null;
      return withModifierTargets([[unitAttacker, unitDefender], [unitDefender, unitAttacker]], () =>
        originalUnilateral.call(this, unitAttacker, attackSkill, ...rest)
      );
    };''',
    "Unilateral scoped target",
)
replace_once(
    standard,
    'return originalClash.call(this, unitA, skillA, unitB, skillB, ...rest);',
    'return withModifierTargets([[unitA, unitB], [unitB, unitA]], () => originalClash.call(this, unitA, skillA, unitB, skillB, ...rest));',
    "Clash scoped target",
)
sub_once(
    standard,
    r'''      const traitMods = modifiers\.resolveTraitModifiers\(\{\n        unit,\n        character: isCurrentPlayerUnit\(unit\) \? global\.LuminousPlayerTraitRuntime\?\.getCharacter\?\.\(\) \|\| unit : unit,\n        traits,\n        skill: contextOptions\?\.skill \|\| null,\n        context: "combat",\n      \}\);''',
    '''      const target = contextOptions?.target || modifierTarget(unit);
      const traitMods = modifiers.resolveTraitModifiers({
        unit,
        character: isCurrentPlayerUnit(unit) ? global.LuminousPlayerTraitRuntime?.getCharacter?.() || unit : unit,
        traits,
        skill: contextOptions?.skill || null,
        target,
        targetedByAlly: contextOptions?.targetedByAlly ?? isTargetedByAlly(unit, target),
        context: "combat",
      });''',
    "Passive modifier target propagation",
)

player = "js/player-trait-runtime.js"
sub_once(
    player,
    r"  function getRuntime\(overrides = \{\}\) \{.*?\n  \}\n\n  function emit",
    '''  function getRuntime(overrides = {}) {
    const character = getCharacter();
    const input = overrides || {};
    const context = normalizeId(input.context || inferContext()) || "any";
    const self = Object.prototype.hasOwnProperty.call(input, "self")
      ? input.self
      : (context === "combat" ? currentCombatUnit() : character);
    const level = Number(input.Level ?? input.level ?? character?.level ?? character?.characterBuild?.calculatedAtLevel ?? 0) || 0;
    return { context, character, self, level, ...input };
  }

  function emit''',
    "Live combat Unit runtime",
    re.S,
)
sub_once(
    player,
    r"  function dispatchCombatEvent\(trigger, input = \{\}\) \{.*?\n  \}\n\n  function identityValues",
    '''  function dispatchCombatEvent(trigger, input = {}) {
    const traitEngine = global.LuminousTraitEngine;
    if (!traitEngine?.dispatchCombatEvent) return null;
    if (!state.traitState) state.traitState = traitEngine.createState();
    const runtime = getRuntime({ context: "combat", ...(input || {}) });
    return traitEngine.dispatchCombatEvent(trigger, {
      ...runtime,
      traits: resolveTraits(),
      state: state.traitState,
    });
  }

  function identityValues''',
    "Normalized combat event runtime",
    re.S,
)
sub_once(
    player,
    r"  function currentCombatUnit\(\) \{.*?\n  \}\n\n  function combatRuntimeInput",
    '''  function currentCombatUnit() {
    let data = global.combatData && typeof global.combatData === "object" ? global.combatData : null;
    if (!data) {
      try {
        if (typeof global.eval === "function") data = global.eval("typeof combatData !== 'undefined' ? combatData : null");
      } catch (_) {}
    }
    const source = data && typeof data === "object" ? Object.values(data) : [];
    return currentPlayerUnit(source) || getCharacter();
  }

  function combatRuntimeInput''',
    "CombatData live Unit lookup",
    re.S,
)

universal_test = "tests/universal_modifier_engine.spec.js"
replace_once(universal_test, 'const catalog = require("../js/trait-catalog-core.js");', 'const catalog = require("../js/trait-catalog-core.js");\nconst racialCatalog = require("../js/racial-trait-catalog.js");', "Universal test racial import")
append_once(
    universal_test,
    'test("racial combat Traits use universal channels with normalized enums and current target context"',
    '''test("racial combat Traits use universal channels with normalized enums and current target context", () => {
  const unit = { id: "racial_universal", combatStats: { maxSpeed: 6 }, took_damage_last_turn: false };
  const slower = { id: "slow", speed: 3 };
  const faster = { id: "fast", speed: 7 };
  const counter = { type: "Counter", basePower: 0 };
  const normal = { type: "Normal", basePower: 10 };

  expect(modifiers.resolveTraitModifiers({ unit, character: unit, traits: [racialCatalog.getDefinition("yuan_ti_cold_fury")], skill: counter, context: "combat" }).final_power).toBe(4);
  expect(modifiers.resolveTraitModifiers({ unit, character: unit, traits: [racialCatalog.getDefinition("yuan_ti_cold_fury")], skill: normal, context: "combat" }).final_power).toBe(0);

  const pack = racialCatalog.getDefinition("pack_tactics");
  expect(modifiers.resolveTraitModifiers({ unit, character: unit, traits: [pack], skill: normal, target: slower, targetedByAlly: true, context: "combat" }).final_power).toBe(1);
  expect(modifiers.resolveTraitModifiers({ unit, character: unit, traits: [pack], skill: normal, target: faster, targetedByAlly: false, context: "combat" }).final_power).toBe(0);
  expect(normal.finalPower).toBeUndefined();
  expect(normal.final_power).toBeUndefined();

  const hunter = racialCatalog.getDefinition("half_dragon_skilled_hunter");
  expect(modifiers.resolveTraitModifiers({ unit, character: unit, traits: [hunter], skill: normal, target: slower, context: "combat" }).clash_power).toBe(2);
  expect(modifiers.resolveTraitModifiers({ unit, character: unit, traits: [hunter], skill: normal, target: faster, context: "combat" }).clash_power).toBe(0);

  const lunge = racialCatalog.getDefinition("moonfae_lunge");
  expect(modifiers.resolveTraitModifiers({ unit, character: unit, traits: [lunge], skill: normal, target: slower, context: "combat" }).clash_power).toBe(2);
  unit.took_damage_last_turn = true;
  expect(modifiers.resolveTraitModifiers({ unit, character: unit, traits: [lunge], skill: normal, target: slower, context: "combat" }).clash_power).toBe(0);
});''',
)

std_test = "tests/trait_standardization_review_fixes.spec.js"
p = Path(std_test)
text = p.read_text()
pattern = re.compile(r'test\("Pack Tactics computes another ally targeting the same defender from production slotTargets", \(\) => \{.*?\n\}\);\n\n(?=test\("legacy sheet Coin roller)', re.S)
replacement = '''test("Pack Tactics is scoped to the current target and never mutates a reusable Skill", () => {
  const attacker = { id: "kobold", faction: "player", combatStats: { maxSpeed: 6 } };
  const ally = { id: "ally", faction: "player" };
  const targetA = { id: "enemy_a", faction: "enemy", speed: 3 };
  const targetB = { id: "enemy_b", faction: "enemy", speed: 3 };
  const combatData = { kobold: attacker, ally, enemy_a: targetA, enemy_b: targetB };
  const slotTargets = { kobold_slot_0: "enemy_a_slot_0", ally_slot_0: "enemy_a_slot_0" };
  const pack = racialCatalog.getDefinition("pack_tactics");
  const playerRuntime = { getCharacter() { return attacker; }, getTraits() { return [pack]; } };
  const combatEngine = {
    applyPassiveModifiers() { return {}; },
    resolveUnilateralWithCounter(unitAttacker, attackSkill) {
      const passive = this.applyPassiveModifiers(unitAttacker, { skill: attackSkill });
      return { finalPower: (attackSkill.basePower || 0) + (passive.final_power || 0) };
    },
  };
  const { api } = loadStandardizationRuntime({ combatEngine, playerRuntime, combatData, slotTargets, datosJugador: attacker });
  api.installAll();
  const skill = { type: "Normal", basePower: 10 };
  expect(combatEngine.resolveUnilateralWithCounter(attacker, skill, targetA, null).finalPower).toBe(11);
  slotTargets.kobold_slot_0 = "enemy_b_slot_0";
  expect(combatEngine.resolveUnilateralWithCounter(attacker, skill, targetB, null).finalPower).toBe(10);
  slotTargets.kobold_slot_0 = "enemy_a_slot_0";
  expect(combatEngine.resolveUnilateralWithCounter(attacker, skill, targetA, null).finalPower).toBe(11);
  expect(skill.finalPower).toBeUndefined();
  expect(skill.final_power).toBeUndefined();
});

test("production clash resolution receives universal Clash Power from target-scoped racial Traits", () => {
  const attacker = { id: "hunter", faction: "player", combatStats: { maxSpeed: 6 } };
  const target = { id: "enemy", faction: "enemy", speed: 3 };
  const skilled = racialCatalog.getDefinition("half_dragon_skilled_hunter");
  const playerRuntime = { getCharacter() { return attacker; }, getTraits() { return [skilled]; } };
  const combatEngine = {
    applyPassiveModifiers() { return {}; },
    resolveStandardClash(unitA, skillA) {
      return { clashPower: this.applyPassiveModifiers(unitA, { skill: skillA }).clash_power || 0 };
    },
  };
  const { api } = loadStandardizationRuntime({ combatEngine, playerRuntime, datosJugador: attacker });
  api.installAll();
  expect(combatEngine.resolveStandardClash(attacker, { type: "Normal" }, target, { type: "Normal" }).clashPower).toBe(2);
});

'''
text, count = pattern.subn(replacement, text, count=1)
if count != 1:
    raise SystemExit(f"Pack Tactics production regression: expected 1 test block, found {count}")
p.write_text(text)
append_once(
    std_test,
    'test("player Trait runtime resolves manual combat activations against the live CombatEngine Unit"',
    '''test("player Trait runtime resolves manual combat activations against the live CombatEngine Unit", () => {
  const document = makeDocument();
  const snapshot = { id: "aasimar_live", hp: 2, maxHp: 20, stats: { constitucion: 10 }, characterBuild: { raceId: "aasimar", calculatedAtLevel: 20 } };
  const liveUnit = { id: "aasimar_live", hp: 5, maxHp: 20, stats: { constitucion: 10 } };
  const fakeWindow = eventTarget({
    document,
    LuminousGameContext: "combat",
    LuminousTraitEngine: traitEngine,
    LuminousTraitCatalogCore: { allDefinitions: () => ({}), allGrants: () => [] },
    LuminousRacialTraitCatalog: racialCatalog,
    LuminousClassMilestones: { resolveSelectedGeneralTraits: () => [] },
    LuminousTraitPlayerTray: { mount: () => null },
    LuminousTheatreRolls: null,
    CombatEngine: null,
    datosJugador: snapshot,
    combatData: { aasimar_live: liveUnit },
    firebase: null,
    localStorage: { getItem: () => null },
    CustomEvent: class CustomEvent { constructor(type, init = {}) { this.type = type; this.detail = init.detail; } },
    setInterval() { return 1; },
    setTimeout(handler) { handler(); return 1; },
    console,
  });
  const context = vm.createContext({ window: fakeWindow, document, console, CustomEvent: fakeWindow.CustomEvent, setInterval: fakeWindow.setInterval, setTimeout: fakeWindow.setTimeout });
  vm.runInContext(read("js/player-trait-runtime.js"), context, { filename: "player-trait-runtime.js" });
  const runtime = fakeWindow.LuminousPlayerTraitRuntime.getRuntime();
  expect(runtime.context).toBe("combat");
  expect(runtime.self).toBe(liveUnit);
  expect(runtime.character).toBe(snapshot);
  expect(runtime.level).toBe(20);
  traitEngine.activateTrait(racialCatalog.getDefinition("aasimar_healing_hands"), runtime, traitEngine.createState());
  expect(liveUnit.hp).toBe(15);
  expect(snapshot.hp).toBe(2);
});''',
)

racial_test = "tests/racial_trait_engine_regressions.spec.js"
replace_once(racial_test, 'const tray = require("../js/trait-player-tray.js");', 'const tray = require("../js/trait-player-tray.js");\nconst racialCatalog = require("../js/racial-trait-catalog.js");', "Racial test catalog import")
append_once(
    racial_test,
    'test("stored characterBuild level powers positive racial damage with a minimum of 1"',
    '''test("stored characterBuild level powers positive racial damage with a minimum of 1", () => {
  const character = { characterBuild: { calculatedAtLevel: 20 }, stats: { constitucion: 10 } };
  const sacredDamage = { amount: 1 };
  engine.dispatchCombatEvent("damage_dealt", {
    character,
    self: character,
    target: { type: "Demon" },
    skill: { id: "dragon_breath", tags: ["dragon_breath"] },
    damage: sacredDamage,
    traits: [racialCatalog.getDefinition("half_dragon_gold_breath_conversion")],
  });
  expect(sacredDamage.amount).toBe(2);

  const protectorDamage = { amount: 1 };
  const state = engine.createState({ statuses: { aasimar_protector_form: { id: "aasimar_protector_form", count: 1 } } });
  engine.dispatchCombatEvent("damage_dealt", {
    character,
    self: character,
    damage: protectorDamage,
    traits: [racialCatalog.getDefinition("aasimar_protector_transformation")],
    state,
  });
  expect(protectorDamage.amount).toBe(3);
});''',
)

print("Applied PR565 universal architecture fixes.")
