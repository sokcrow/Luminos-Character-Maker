from pathlib import Path

ROOT = Path('.')


def read(path):
    return (ROOT / path).read_text(encoding='utf-8')


def write(path, text):
    (ROOT / path).write_text(text, encoding='utf-8')


def replace_once(path, old, new):
    text = read(path)
    if new in text:
        return False
    count = text.count(old)
    if count != 1:
        raise AssertionError(f'{path}: expected one match, found {count}: {old[:120]!r}')
    write(path, text.replace(old, new, 1))
    return True


def append_once(path, marker, block):
    text = read(path)
    if marker in text:
        return False
    if not text.endswith('\n'):
        text += '\n'
    write(path, text + '\n' + block.strip() + '\n')
    return True


# ---------------------------------------------------------------------------
# Universal modifier channels / defense taxonomy
# ---------------------------------------------------------------------------
replace_once(
    'js/universal-modifier-engine.js',
    '    "defense_power",\n    "clash_power",',
    '    "defense_power",\n    "counter_power",\n    "evade_power",\n    "guard_power",\n    "clash_power",'
)
replace_once(
    'js/universal-modifier-engine.js',
    '    basepower: "base_power",\n    coinpower: "coin_power",',
    '    basepower: "base_power",\n    defensepower: "defense_power",\n    counterpower: "counter_power",\n    evadepower: "evade_power",\n    guardpower: "guard_power",\n    coinpower: "coin_power",'
)
replace_once(
    'js/universal-modifier-engine.js',
    '''    skill.skillFamily = family;\n    skill.skill_family = family;\n    if (family === "attack") {''',
    '''    skill.skillFamily = family;\n    skill.skill_family = family;\n    if (family === "defense") {\n      const rawSubtype = normalizeId(skill.defenseSubtype || skill.defense_subtype || type);\n      const subtypeMap = {\n        guard: "Guard",\n        clashableguard: "ClashableGuard",\n        clashable_guard: "ClashableGuard",\n        evade: "Evade",\n        counter: "Counter",\n        clashablecounter: "ClashableCounter",\n        clashable_counter: "ClashableCounter",\n      };\n      const canonicalSubtype = subtypeMap[rawSubtype] || subtypeMap[type] || null;\n      if (canonicalSubtype) {\n        skill.defenseSubtype = canonicalSubtype;\n        skill.defense_subtype = normalizeId(canonicalSubtype);\n      }\n      skill.isDefense = true;\n    }\n    if (family === "attack") {'''
)
replace_once(
    'js/universal-modifier-engine.js',
    '''  function hasStatus(unit, statusId, traitState = {}) {\n    if (statusEngine?.hasStatus?.(unit, statusId)) return true;\n    return Boolean(traitState?.statuses?.[normalizeId(statusId)]);\n  }''',
    '''  function defensePowerChannelForSkill(skillInput = {}) {\n    const skill = normalizeSkill(skillInput || {});\n    const subtype = normalizeId(skill?.defenseSubtype || skill?.defense_subtype || skill?.type);\n    if (["counter", "clashablecounter", "clashable_counter"].includes(subtype)) return "counter_power";\n    if (subtype === "evade") return "evade_power";\n    if (["guard", "clashableguard", "clashable_guard"].includes(subtype)) return "guard_power";\n    return null;\n  }\n\n  function hasStatus(unit, statusId, traitState = {}) {\n    if (statusEngine?.hasStatus?.(unit, statusId)) return true;\n    return Boolean(traitState?.statuses?.[normalizeId(statusId)]);\n  }'''
)
replace_once(
    'js/universal-modifier-engine.js',
    '''    resolveEquipment,\n    normalizeSkill,\n    resolveTraitModifiers,''',
    '''    resolveEquipment,\n    normalizeSkill,\n    defensePowerChannelForSkill,\n    resolveTraitModifiers,'''
)

# ---------------------------------------------------------------------------
# CombatEngine consumes the universal Defense Power hierarchy directly.
# ---------------------------------------------------------------------------
replace_once(
    'js/combatEngine.js',
    '''        if (defenseTypes.includes(skill.type)) {\n            skill.isDefense = true;\n            skill.isClashable = (skill.type === 'ClashableGuard' || skill.type === 'ClashableCounter');''',
    '''        if (defenseTypes.includes(skill.type)) {\n            skill.isDefense = true;\n            skill.defenseSubtype = skill.type;\n            skill.isClashable = (skill.type === 'ClashableGuard' || skill.type === 'ClashableCounter');'''
)
replace_once(
    'js/combatEngine.js',
    '''            base_power: 0,\n            defense_power: 0,\n            clash_power: 0,''',
    '''            base_power: 0,\n            defense_power: 0,\n            counter_power: 0,\n            evade_power: 0,\n            guard_power: 0,\n            clash_power: 0,'''
)
replace_once(
    'js/combatEngine.js',
    '''                    } else if (actualAffectation === 'damage_dealt_multiplier' || actualAffectation === 'damage_taken_multiplier' || actualAffectation === 'healing_multiplier' || actualAffectation === 'speed' || actualAffectation === 'resource' || actualAffectation === 'defensive_level' || actualAffectation === 'offensive_level' || actualAffectation === 'clash_power' || actualAffectation === 'coin_power' || actualAffectation === 'base_power' || actualAffectation === 'final_power' || actualAffectation === 'defense_power') {''',
    '''                    } else if (actualAffectation === 'damage_dealt_multiplier' || actualAffectation === 'damage_taken_multiplier' || actualAffectation === 'healing_multiplier' || actualAffectation === 'speed' || actualAffectation === 'resource' || actualAffectation === 'defensive_level' || actualAffectation === 'offensive_level' || actualAffectation === 'clash_power' || actualAffectation === 'coin_power' || actualAffectation === 'base_power' || actualAffectation === 'final_power' || actualAffectation === 'defense_power' || actualAffectation === 'counter_power' || actualAffectation === 'evade_power' || actualAffectation === 'guard_power') {'''
)
replace_once(
    'js/combatEngine.js',
    '''        if (skill.isDefense) {\n            finalActualBasePower += (passiveMods.defense_power || 0);\n            if (skill.defenseSubtype === 'ClashableGuard' || skill.defenseSubtype === 'ClashableCounter') {\n                 finalActualBasePower += (passiveMods.clash_power || 0);\n            }\n        } else {''',
    '''        if (skill.isDefense) {\n            const defenseSubtype = skill.defenseSubtype || skill.type || '';\n            finalActualBasePower += (passiveMods.defense_power || 0);\n            if (defenseSubtype === 'Counter' || defenseSubtype === 'ClashableCounter') {\n                finalActualBasePower += (passiveMods.counter_power || 0);\n            } else if (defenseSubtype === 'Evade') {\n                finalActualBasePower += (passiveMods.evade_power || 0);\n            } else if (defenseSubtype === 'Guard' || defenseSubtype === 'ClashableGuard') {\n                finalActualBasePower += (passiveMods.guard_power || 0);\n            }\n            if (defenseSubtype === 'ClashableGuard' || defenseSubtype === 'ClashableCounter') {\n                 finalActualBasePower += (passiveMods.clash_power || 0);\n            }\n        } else {'''
)

# ---------------------------------------------------------------------------
# Racial Traits use the new canonical defense subchannels.
# ---------------------------------------------------------------------------
replace_once(
    'js/racial-trait-catalog.js',
    'goblin_nimble_escape: passiveModifier("goblin_nimble_escape", "Nimble Escape", "goblin", "final_power", 1, { description: "Evade Skills gain +1 Final Power.", conditions: [{ path: "skill.type", operator: "eq", value: "evade" }] }),',
    'goblin_nimble_escape: passiveModifier("goblin_nimble_escape", "Nimble Escape", "goblin", "evade_power", 1, { description: "Evade Skills gain +1 Evade Power.", conditions: [{ path: "skill.type", operator: "eq", value: "evade" }] }),'
)
replace_once(
    'js/racial-trait-catalog.js',
    'description: "Toggle Fairy Form: Tiny size, +2 Min/+2 Max Speed, +2 Evade Final Power, and take 50% more Damage.",',
    'description: "Toggle Fairy Form: Tiny size, +2 Min/+2 Max Speed, +2 Evade Power, and take 50% more Damage.",'
)
replace_once(
    'js/racial-trait-catalog.js',
    '{ type: "modifier", trigger: "passive", target: "self", channel: "final_power", mode: "add", value: 2, whileStatus: "fairy_form", conditions: [{ path: "skill.type", operator: "eq", value: "evade" }] },',
    '{ type: "modifier", trigger: "passive", target: "self", channel: "evade_power", mode: "add", value: 2, whileStatus: "fairy_form", conditions: [{ path: "skill.type", operator: "eq", value: "evade" }] },'
)
replace_once(
    'js/racial-trait-catalog.js',
    'description: "Gain floor(Proficiency / 2) Max Speed and Proficiency Final Power on Evade Skills.",',
    'description: "Gain floor(Proficiency / 2) Max Speed and Proficiency Evade Power on Evade Skills.",'
)
replace_once(
    'js/racial-trait-catalog.js',
    '{ type: "modifier", trigger: "passive", target: "self", channel: "final_power", mode: "add", formula: "Proficiency", conditions: [{ path: "skill.type", operator: "eq", value: "evade" }] },',
    '{ type: "modifier", trigger: "passive", target: "self", channel: "evade_power", mode: "add", formula: "Proficiency", conditions: [{ path: "skill.type", operator: "eq", value: "evade" }] },'
)
replace_once(
    'js/racial-trait-catalog.js',
    'moonfae_agile_escape: passiveModifier("moonfae_agile_escape", "Agile Escape", "moonfae", "final_power", 2, { description: "Evade Skills gain +2 Final Power.", conditions: [{ path: "skill.type", operator: "eq", value: "evade" }] }),',
    'moonfae_agile_escape: passiveModifier("moonfae_agile_escape", "Agile Escape", "moonfae", "evade_power", 2, { description: "Evade Skills gain +2 Evade Power.", conditions: [{ path: "skill.type", operator: "eq", value: "evade" }] }),'
)
replace_once(
    'js/racial-trait-catalog.js',
    '''yuan_ti_cold_fury: passiveModifier("yuan_ti_cold_fury", "Cold Fury", "yuan_ti_pureblood", "final_power", 4, {\n      description: "Counter Skills gain +4 Final Power.",''',
    '''yuan_ti_cold_fury: passiveModifier("yuan_ti_cold_fury", "Cold Fury", "yuan_ti_pureblood", "counter_power", 4, {\n      description: "Counter Skills gain +4 Counter Power.",'''
)
replace_once(
    'js/racial-trait-catalog.js',
    '{ path: "target.frightened", operator: "truthy" }',
    '{ path: "target.statusEffects.frightened", operator: "truthy" }'
)
replace_once(
    'js/racial-trait-catalog.js',
    'formula: "floor(TargetMaxHP * 5 / 100)"',
    'formula: "max(1, floor(TargetMaxHP * 5 / 100))"'
)

# ---------------------------------------------------------------------------
# Status catalog: Defense Power common channel + three universal subvariants.
# Frightened gets a real power penalty and its duration is source-controlled.
# ---------------------------------------------------------------------------
replace_once(
    'js/statusManager.js',
    '''    'defense_power_up': {\n        name: 'Defense Power Up', type: 'positive', mode: 'single', icon: 'https://imgur.com/AkiiCza.png',\n        trigger: 'on_round_end', rules: [{trigger: 'passive', cond_input: 1, cond_type: 'count', operation: 'add', aff_input: 1, affectation: 'base_power', decay: 'total_loss'}],\n        description: "Defense skills gain Final Power by the effect's Count for one turn."\n    },''',
    '''    'defense_power_up': {\n        name: 'Defense Power Up', type: 'positive', mode: 'single', icon: 'https://imgur.com/AkiiCza.png',\n        trigger: 'on_round_end', rules: [{trigger: 'passive', cond_input: 1, cond_type: 'count', operation: 'add', aff_input: 1, affectation: 'defense_power', decay: 'total_loss'}],\n        description: "Guard, Evade, and Counter Skills gain Defense Power by the effect's Count for one turn."\n    },\n    'counter_power_up': {\n        name: 'Counter Power Up', type: 'positive', mode: 'single',\n        trigger: 'on_round_end', rules: [{trigger: 'passive', cond_input: 1, cond_type: 'count', operation: 'add', aff_input: 1, affectation: 'counter_power', decay: 'total_loss'}],\n        description: "Counter Skills gain Counter Power by the effect's Count for one turn."\n    },\n    'evade_power_up': {\n        name: 'Evade Power Up', type: 'positive', mode: 'single',\n        trigger: 'on_round_end', rules: [{trigger: 'passive', cond_input: 1, cond_type: 'count', operation: 'add', aff_input: 1, affectation: 'evade_power', decay: 'total_loss'}],\n        description: "Evade Skills gain Evade Power by the effect's Count for one turn."\n    },\n    'guard_power_up': {\n        name: 'Guard Power Up', type: 'positive', mode: 'single',\n        trigger: 'on_round_end', rules: [{trigger: 'passive', cond_input: 1, cond_type: 'count', operation: 'add', aff_input: 1, affectation: 'guard_power', decay: 'total_loss'}],\n        description: "Guard Skills gain Guard Power by the effect's Count for one turn."\n    },'''
)
replace_once(
    'js/statusManager.js',
    '''    'defense_power_down': {\n        name: 'Defense Power Down', type: 'negative', mode: 'single', icon: 'https://imgur.com/MGdXCaC.png',\n        rules: [{trigger: 'passive', cond_input: 1, cond_type: 'count', operation: 'sub', aff_input: 1, affectation: 'base_power', decay: 'none'}, {trigger: 'on_round_end', cond_input: 1, cond_type: 'count', operation: 'add', aff_input: 0, affectation: '', decay: 'total_loss'}],\n        description: "Defense skills lose Final Power by the effect's Count for one turn."\n    },''',
    '''    'defense_power_down': {\n        name: 'Defense Power Down', type: 'negative', mode: 'single', icon: 'https://imgur.com/MGdXCaC.png',\n        rules: [{trigger: 'passive', cond_input: 1, cond_type: 'count', operation: 'sub', aff_input: 1, affectation: 'defense_power', decay: 'none'}, {trigger: 'on_round_end', cond_input: 1, cond_type: 'count', operation: 'add', aff_input: 0, affectation: '', decay: 'total_loss'}],\n        description: "Guard, Evade, and Counter Skills lose Defense Power by the effect's Count for one turn."\n    },\n    'counter_power_down': {\n        name: 'Counter Power Down', type: 'negative', mode: 'single',\n        rules: [{trigger: 'passive', cond_input: 1, cond_type: 'count', operation: 'sub', aff_input: 1, affectation: 'counter_power', decay: 'none'}, {trigger: 'on_round_end', cond_input: 1, cond_type: 'count', operation: 'add', aff_input: 0, affectation: '', decay: 'total_loss'}],\n        description: "Counter Skills lose Counter Power by the effect's Count for one turn."\n    },\n    'evade_power_down': {\n        name: 'Evade Power Down', type: 'negative', mode: 'single',\n        rules: [{trigger: 'passive', cond_input: 1, cond_type: 'count', operation: 'sub', aff_input: 1, affectation: 'evade_power', decay: 'none'}, {trigger: 'on_round_end', cond_input: 1, cond_type: 'count', operation: 'add', aff_input: 0, affectation: '', decay: 'total_loss'}],\n        description: "Evade Skills lose Evade Power by the effect's Count for one turn."\n    },\n    'guard_power_down': {\n        name: 'Guard Power Down', type: 'negative', mode: 'single',\n        rules: [{trigger: 'passive', cond_input: 1, cond_type: 'count', operation: 'sub', aff_input: 1, affectation: 'guard_power', decay: 'none'}, {trigger: 'on_round_end', cond_input: 1, cond_type: 'count', operation: 'add', aff_input: 0, affectation: '', decay: 'total_loss'}],\n        description: "Guard Skills lose Guard Power by the effect's Count for one turn."\n    },'''
)
replace_once(
    'js/statusManager.js',
    '''    'immobilized': {\n        name: 'Immobilized', type: 'negative', mode: 'zero',''',
    '''    'frightened': {\n        name: 'Frightened', type: 'negative', mode: 'single',\n        rules: [\n            {trigger: 'passive', cond_input: 1, cond_type: 'count', operation: 'sub', aff_input: 1, affectation: 'final_power', decay: 'none'},\n            {trigger: 'passive', cond_input: 1, cond_type: 'count', operation: 'sub', aff_input: 1, affectation: 'defense_power', decay: 'none'}\n        ],\n        description: "While active, Attack Skills lose Final Power and Defense Skills lose Defense Power by the effect's Count. Source effects control its duration."\n    },\n    'immobilized': {\n        name: 'Immobilized', type: 'negative', mode: 'zero','''
)

# ---------------------------------------------------------------------------
# Status Engine understands explicit turn-duration statuses.
# ---------------------------------------------------------------------------
replace_once(
    'js/status-engine.js',
    '''  function normalizeInstance(statusId, input = {}, existing = null) {\n    const id = normalizeId(statusId);\n    const definition = getDefinition(id);\n    const count = Math.max(0, numberOr(input.count, existing?.count ?? 1));\n    const potency = numberOr(input.potency, existing?.potency ?? 0);\n    return {\n      id,\n      name: input.name || existing?.name || definition.name || id,\n      count,\n      potency,\n      duration: normalizeId(input.duration || existing?.duration || "until_removed"),\n      sourceTraitId: input.sourceTraitId || existing?.sourceTraitId || null,\n      sourceUnitId: input.sourceUnitId || existing?.sourceUnitId || null,\n      data: { ...(existing?.data || {}), ...(input.data || {}) },\n    };\n  }''',
    '''  function normalizeInstance(statusId, input = {}, existing = null) {\n    const id = normalizeId(statusId);\n    const definition = getDefinition(id);\n    const count = Math.max(0, numberOr(input.count, existing?.count ?? 1));\n    const potency = numberOr(input.potency, existing?.potency ?? 0);\n    const duration = normalizeId(input.duration || existing?.duration || "until_removed");\n    const data = { ...(existing?.data || {}), ...(input.data || {}) };\n    if (["this_turn", "next_turn_end"].includes(duration) && !Number.isFinite(Number(data.durationTurnsRemaining))) {\n      data.durationTurnsRemaining = 1;\n    }\n    return {\n      id,\n      name: input.name || existing?.name || definition.name || id,\n      count,\n      potency,\n      duration,\n      sourceTraitId: input.sourceTraitId || existing?.sourceTraitId || null,\n      sourceUnitId: input.sourceUnitId || existing?.sourceUnitId || null,\n      data,\n    };\n  }'''
)
replace_once(
    'js/status-engine.js',
    '''  function listStatuses(unit) {\n    const store = ensureStore(unit) || {};\n    return Object.entries(store).map(([id, instance]) => ({\n      ...getDefinition(id),\n      instance: typeof instance === "object" ? clone(instance) : { id, count: numberOr(instance, 1), potency: 0 },\n    }));\n  }''',
    '''  function advanceDurations(unit, trigger = "turn_end") {\n    const phase = normalizeId(trigger);\n    if (!["turn_end", "round_end", "[round_end]"].includes(phase)) return [];\n    const store = ensureStore(unit) || {};\n    const expired = [];\n    Object.entries({ ...store }).forEach(([statusId, raw]) => {\n      if (!raw || typeof raw !== "object") return;\n      const duration = normalizeId(raw.duration || "until_removed");\n      if (!["this_turn", "next_turn_end"].includes(duration)) return;\n      if (!raw.data || typeof raw.data !== "object") raw.data = {};\n      const remaining = Math.max(1, Math.trunc(numberOr(raw.data.durationTurnsRemaining, 1))) - 1;\n      raw.data.durationTurnsRemaining = remaining;\n      if (remaining <= 0) {\n        removeStatus(unit, statusId, { from: "duration", ignoreProtection: true });\n        expired.push(normalizeId(statusId));\n      }\n    });\n    return expired;\n  }\n\n  function listStatuses(unit) {\n    const store = ensureStore(unit) || {};\n    return Object.entries(store).map(([id, instance]) => ({\n      ...getDefinition(id),\n      instance: typeof instance === "object" ? clone(instance) : { id, count: numberOr(instance, 1), potency: 0 },\n    }));\n  }'''
)
replace_once(
    'js/status-engine.js',
    '''    protectStatus,\n    syncTraitState,\n    listStatuses,''',
    '''    protectStatus,\n    syncTraitState,\n    advanceDurations,\n    listStatuses,'''
)

# ---------------------------------------------------------------------------
# Production standardization: real Check Bonus, Rabbit baked item removal,
# and explicit status-duration advancement.
# ---------------------------------------------------------------------------
replace_once(
    'js/trait-standardization-runtime.js',
    '''  function completedCheckDetail(check = {}, result = {}) {\n    const total = numberOr(result.total, 0);\n    const rolls = global.LuminousTheatreRolls;\n    const outcome = rolls?.checkOutcome ? rolls.checkOutcome(total, check) : (Number.isFinite(Number(check.difficulty ?? check.thresholdRaw ?? check.threshold)) ? (total >= Number(check.difficulty ?? check.thresholdRaw ?? check.threshold) ? "passed" : "failed") : null);\n    return {\n      check: { ...(check || {}), total, result: total, finalPower: numberOr(check.finalPower, 0), passed: outcome === "passed", failed: outcome === "failed", outcome },\n      total,\n      outcome,\n      target: check.target || check.targetUnit || null,\n      rawResult: result,\n    };\n  }\n\n  function emitCompletedCheck(check = {}, result = {}) {\n    const detail = completedCheckDetail(check, result);''',
    '''  function applyCheckFinalPower(result = {}, options = {}, check = {}) {\n    if (!result || typeof result !== "object") return result;\n    if (result.checkFinalPowerApplied === true) return result;\n    const baseRollTotal = numberOr(result.total, 0);\n    const bonus = numberOr(check.finalPower, 0);\n    const next = { ...(result || {}), baseRollTotal, total: baseRollTotal + bonus, checkFinalPower: bonus, checkFinalPowerApplied: true };\n    if (options?.totalNode) {\n      const wroteSafely = global.LuminousPlayerStats?.setRollTotalWithoutAdjustment?.(next.total, options.totalNode);\n      if (!wroteSafely) options.totalNode.textContent = String(next.total);\n    }\n    return next;\n  }\n\n  function completedCheckDetail(check = {}, result = {}) {\n    const total = numberOr(result.total, 0);\n    const finalPower = numberOr(check.finalPower, 0);\n    const baseRollTotal = Number.isFinite(Number(result.baseRollTotal)) ? Number(result.baseRollTotal) : total - finalPower;\n    const rolls = global.LuminousTheatreRolls;\n    const outcome = rolls?.checkOutcome ? rolls.checkOutcome(total, check) : (Number.isFinite(Number(check.difficulty ?? check.thresholdRaw ?? check.threshold)) ? (total >= Number(check.difficulty ?? check.thresholdRaw ?? check.threshold) ? "passed" : "failed") : null);\n    return {\n      check: { ...(check || {}), total, result: total, finalPower, passed: outcome === "passed", failed: outcome === "failed", outcome },\n      total,\n      baseRollTotal,\n      outcome,\n      target: check.target || check.targetUnit || null,\n      rawResult: result,\n    };\n  }\n\n  function emitCompletedCheck(check = {}, result = {}) {\n    const adjusted = applyCheckFinalPower(result, {}, check);\n    const detail = completedCheckDetail(check, adjusted);'''
)
replace_once(
    'js/trait-standardization-runtime.js',
    '''  function precomputedLevel(unit, kind) {\n    const combat = unit?.combatStats || {};\n    const values = kind === "offensive"\n      ? [combat.offensiveLevel, combat.off_level, unit?.offensiveLevel, unit?.offensive_level]\n      : [combat.defensiveLevel, combat.def_level, unit?.defensiveLevel, unit?.defensive_level];\n    const found = values.find((value) => Number.isFinite(Number(value)));\n    return found == null ? null : Number(found);\n  }''',
    '''  function equipmentLevelModifier(unit, kind) {\n    const currentCharacter = isCurrentPlayerUnit(unit) ? global.LuminousPlayerTraitRuntime?.getCharacter?.() || null : null;\n    const sources = [unit, currentCharacter].filter(Boolean);\n    for (const source of sources) {\n      const fromBreakdown = source?.combatLevels?.[kind]?.itemModifier;\n      if (Number.isFinite(Number(fromBreakdown))) return Number(fromBreakdown);\n      const field = kind === "offensive" ? "offensiveLevel" : "defensiveLevel";\n      const fromEquipment = source?.equipmentModifiers?.[field];\n      if (Number.isFinite(Number(fromEquipment))) return Number(fromEquipment);\n    }\n    return 0;\n  }\n\n  function precomputedLevel(unit, kind) {\n    const combat = unit?.combatStats || {};\n    const values = kind === "offensive"\n      ? [combat.offensiveLevel, combat.off_level, unit?.offensiveLevel, unit?.offensive_level]\n      : [combat.defensiveLevel, combat.def_level, unit?.defensiveLevel, unit?.defensive_level];\n    const found = values.find((value) => Number.isFinite(Number(value)));\n    if (found == null) return null;\n    const equipmentInactive = Boolean(global.LuminousUniversalModifiers?.resolveEquipment?.(unit)?.equipmentInactive);\n    return Number(found) - (equipmentInactive ? equipmentLevelModifier(unit, kind) : 0);\n  }'''
)
replace_once(
    'js/trait-standardization-runtime.js',
    '''    if (originalTriggerPhase) engine.triggerPhase = function (phaseTag, allUnits, ...rest) {\n      const result = originalTriggerPhase.call(this, phaseTag, allUnits, ...rest);\n      if (phaseTag === "[Round End]") (allUnits || []).forEach(advanceDamageHistory);\n      return result;\n    };''',
    '''    if (originalTriggerPhase) engine.triggerPhase = function (phaseTag, allUnits, ...rest) {\n      const result = originalTriggerPhase.call(this, phaseTag, allUnits, ...rest);\n      if (phaseTag === "[Round End]") (allUnits || []).forEach((unit) => {\n        advanceDamageHistory(unit);\n        statusEngine?.advanceDurations?.(unit, "turn_end");\n      });\n      return result;\n    };'''
)
replace_once(
    'js/trait-standardization-runtime.js',
    '''          const finalResult = check ? applyCheckRetosses(rawResult, options, check) : rawResult;\n          if (check) emitCompletedCheck(check, finalResult);''',
    '''          const retossedResult = check ? applyCheckRetosses(rawResult, options, check) : rawResult;\n          const finalResult = check ? applyCheckFinalPower(retossedResult, options, check) : retossedResult;\n          if (check) emitCompletedCheck(check, finalResult);'''
)
replace_once(
    'js/trait-standardization-runtime.js',
    '''      const finalResult = applyCheckRetosses(snapshot, { container, totalNode: snapshot.totalNode }, check);\n      emitCompletedCheck(check, finalResult);''',
    '''      const retossedResult = applyCheckRetosses(snapshot, { container, totalNode: snapshot.totalNode }, check);\n      const finalResult = applyCheckFinalPower(retossedResult, { container, totalNode: snapshot.totalNode }, check);\n      emitCompletedCheck(check, finalResult);'''
)
replace_once(
    'js/trait-standardization-runtime.js',
    '''    resolveTraitRuntimeResolutions,\n    completedCheckDetail,\n    emitCompletedCheck,''',
    '''    resolveTraitRuntimeResolutions,\n    applyCheckFinalPower,\n    completedCheckDetail,\n    emitCompletedCheck,\n    equipmentLevelModifier,\n    precomputedLevel,'''
)

# ---------------------------------------------------------------------------
# Prompt Traits always recalculate the completed Check from the raw roll.
# ---------------------------------------------------------------------------
replace_once(
    'js/player-trait-runtime.js',
    '''  function recalculateCompletedCheck(result) {\n    const check = result?.runtime?.check;\n    if (!check?.recalculate || !state.lastCompletedCheck) return null;\n    const original = state.lastCompletedCheck.check || {};\n    const total = Number(original.total ?? original.result ?? 0) + Number(check.finalPower ?? 0);\n    const rolls = global.LuminousTheatreRolls;\n    const outcome = rolls?.checkOutcome ? rolls.checkOutcome(total, check) : (Number.isFinite(Number(check.difficulty ?? check.thresholdRaw ?? check.threshold)) ? (total >= Number(check.difficulty ?? check.thresholdRaw ?? check.threshold) ? "passed" : "failed") : null);\n    const nextCheck = { ...original, ...check, total, result: total, outcome, passed: outcome === "passed", failed: outcome === "failed", recalculate: 0 };\n    state.lastCompletedCheck = { ...state.lastCompletedCheck, check: nextCheck, total, outcome };''',
    '''  function recalculateCompletedCheck(result) {\n    const check = result?.runtime?.check;\n    if (!check || !state.lastCompletedCheck) return null;\n    const original = state.lastCompletedCheck.check || {};\n    const previousFinalPower = Number(original.finalPower ?? 0) || 0;\n    const previousTotal = Number(original.total ?? original.result ?? state.lastCompletedCheck.total ?? 0) || 0;\n    const baseRollTotal = Number.isFinite(Number(state.lastCompletedCheck.baseRollTotal))\n      ? Number(state.lastCompletedCheck.baseRollTotal)\n      : previousTotal - previousFinalPower;\n    const total = baseRollTotal + (Number(check.finalPower ?? 0) || 0);\n    const rolls = global.LuminousTheatreRolls;\n    const outcome = rolls?.checkOutcome ? rolls.checkOutcome(total, check) : (Number.isFinite(Number(check.difficulty ?? check.thresholdRaw ?? check.threshold)) ? (total >= Number(check.difficulty ?? check.thresholdRaw ?? check.threshold) ? "passed" : "failed") : null);\n    const nextCheck = { ...original, ...check, total, result: total, outcome, passed: outcome === "passed", failed: outcome === "failed", recalculate: 0 };\n    state.lastCompletedCheck = { ...state.lastCompletedCheck, check: nextCheck, total, baseRollTotal, outcome };'''
)

# ---------------------------------------------------------------------------
# Regression tests (existing workflow already executes these files).
# ---------------------------------------------------------------------------
replace_once(
    'tests/racial_trait_catalog.spec.js',
    'test("Cold Fury is passive and gives exactly +4 Final Power only to Counter Skills", () => {',
    'test("Cold Fury is passive and gives exactly +4 Counter Power only to Counter Skills", () => {'
)
replace_once(
    'tests/racial_trait_catalog.spec.js',
    '''  expect(counter.modifiers.final_power).toBe(4);\n  expect(attack.modifiers.final_power).toBe(0);''',
    '''  expect(counter.modifiers.counter_power).toBe(4);\n  expect(counter.modifiers.final_power).toBe(0);\n  expect(attack.modifiers.counter_power).toBe(0);'''
)
append_once(
    'tests/racial_trait_catalog.spec.js',
    'Friend of Life restores at least 1 HP',
    '''test("Friend of Life restores at least 1 HP when 5% would round to zero", () => {\n  const trait = catalog.getDefinition("undae_friend_of_life");\n  const target = { hp: 0, maxHp: 10 };\n  engine.dispatchCombatEvent("after_check", {\n    character: { level: 20 },\n    self: {},\n    target,\n    check: { actionId: "stabilize", passed: true },\n    traits: [trait],\n  });\n  expect(target.hp).toBe(1);\n});'''
)
replace_once(
    'tests/universal_modifier_engine.spec.js',
    '''  expect(modifiers.resolveTraitModifiers({ unit, character: unit, traits: [racialCatalog.getDefinition("yuan_ti_cold_fury")], skill: counter, context: "combat" }).final_power).toBe(4);\n  expect(modifiers.resolveTraitModifiers({ unit, character: unit, traits: [racialCatalog.getDefinition("yuan_ti_cold_fury")], skill: normal, context: "combat" }).final_power).toBe(0);''',
    '''  expect(modifiers.resolveTraitModifiers({ unit, character: unit, traits: [racialCatalog.getDefinition("yuan_ti_cold_fury")], skill: counter, context: "combat" }).counter_power).toBe(4);\n  expect(modifiers.resolveTraitModifiers({ unit, character: unit, traits: [racialCatalog.getDefinition("yuan_ti_cold_fury")], skill: normal, context: "combat" }).counter_power).toBe(0);'''
)
append_once(
    'tests/universal_modifier_engine.spec.js',
    'Defense Power hierarchy exposes common and subtype channels',
    '''test("Defense Power hierarchy exposes common Counter, Evade, and Guard subchannels", () => {\n  expect(modifiers.CHANNELS).toEqual(expect.arrayContaining(["defense_power", "counter_power", "evade_power", "guard_power"]));\n  expect(modifiers.defensePowerChannelForSkill({ type: "Counter" })).toBe("counter_power");\n  expect(modifiers.defensePowerChannelForSkill({ type: "ClashableCounter" })).toBe("counter_power");\n  expect(modifiers.defensePowerChannelForSkill({ type: "Evade" })).toBe("evade_power");\n  expect(modifiers.defensePowerChannelForSkill({ type: "Guard" })).toBe("guard_power");\n  expect(modifiers.defensePowerChannelForSkill({ type: "ClashableGuard" })).toBe("guard_power");\n\n  const unit = { level: 40, combatStats: { maxSpeed: 6 } };\n  const cold = racialCatalog.getDefinition("yuan_ti_cold_fury");\n  const nimble = racialCatalog.getDefinition("goblin_nimble_escape");\n  expect(modifiers.resolveTraitModifiers({ unit, character: unit, traits: [cold], skill: { type: "Counter" }, context: "combat" }).counter_power).toBe(4);\n  expect(modifiers.resolveTraitModifiers({ unit, character: unit, traits: [cold], skill: { type: "Evade" }, context: "combat" }).counter_power).toBe(0);\n  expect(modifiers.resolveTraitModifiers({ unit, character: unit, traits: [nimble], skill: { type: "Evade" }, context: "combat" }).evade_power).toBe(1);\n  expect(modifiers.resolveTraitModifiers({ unit, character: unit, traits: [nimble], skill: { type: "Guard" }, context: "combat" }).evade_power).toBe(0);\n});'''
)
append_once(
    'tests/trait_standardization_review_fixes.spec.js',
    'universal Defense Power hierarchy reaches production defensive rolls',
    '''test("universal Defense Power hierarchy reaches production defensive rolls", () => {\n  const unit = { id: "defender", level: 40, statusEffects: {} };\n  const cold = racialCatalog.getDefinition("yuan_ti_cold_fury");\n  const nimble = racialCatalog.getDefinition("goblin_nimble_escape");\n  const playerRuntime = { getCharacter() { return unit; }, getTraits() { return [cold, nimble]; } };\n  const combatEngine = {\n    initializeUnitData() {},\n    applyPassiveModifiers() { return { defense_power: 2 }; },\n    calculateFinalPower(skill, _heads, currentUnit) {\n      const passive = this.applyPassiveModifiers(currentUnit, { skill });\n      const subtype = skill.defenseSubtype || skill.type;\n      let power = passive.defense_power || 0;\n      if (subtype === "Counter" || subtype === "ClashableCounter") power += passive.counter_power || 0;\n      else if (subtype === "Evade") power += passive.evade_power || 0;\n      else if (subtype === "Guard" || subtype === "ClashableGuard") power += passive.guard_power || 0;\n      return power;\n    },\n  };\n  const { api } = loadStandardizationRuntime({ combatEngine, playerRuntime, datosJugador: unit });\n  api.installAll();\n\n  expect(combatEngine.calculateFinalPower({ type: "Counter", isDefense: true }, [], unit)).toBe(6);\n  expect(combatEngine.calculateFinalPower({ type: "Evade", isDefense: true }, [], unit)).toBe(3);\n  expect(combatEngine.calculateFinalPower({ type: "Guard", isDefense: true }, [], unit)).toBe(2);\n});\n\ntest("before_check Final Power is added to the real Coin total exactly once", () => {\n  const { api } = loadStandardizationRuntime();\n  const adjusted = api.applyCheckFinalPower({ total: 10 }, {}, { difficulty: 13, finalPower: 4 });\n  expect(adjusted.total).toBe(14);\n  expect(adjusted.baseRollTotal).toBe(10);\n  expect(api.applyCheckFinalPower(adjusted, {}, { finalPower: 4 }).total).toBe(14);\n  expect(api.completedCheckDetail({ difficulty: 13, finalPower: 4 }, adjusted)).toMatchObject({ total: 14, baseRollTotal: 10, outcome: "passed" });\n});\n\ntest("Rabbit Form removes baked equipment level contributions without deleting equipment", () => {\n  const unit = {\n    combatStats: { offensiveLevel: 50, defensiveLevel: 40 },\n    equipmentModifiers: { offensiveLevel: 3, defensiveLevel: 5 },\n    equipment: { armor: { itemId: "plate", category: "heavy" }, mainHand: { id: "blade" } },\n    statusEffects: { moonfae_rabbit_form: { id: "moonfae_rabbit_form", count: 1 } },\n  };\n  const { api } = loadStandardizationRuntime();\n  expect(api.precomputedLevel(unit, "offensive")).toBe(47);\n  expect(api.precomputedLevel(unit, "defensive")).toBe(35);\n  expect(unit.equipment.mainHand.id).toBe("blade");\n  delete unit.statusEffects.moonfae_rabbit_form;\n  expect(api.precomputedLevel(unit, "offensive")).toBe(50);\n  expect(api.precomputedLevel(unit, "defensive")).toBe(40);\n});\n\ntest("Defense Power statuses and Frightened use canonical universal channels and duration", () => {\n  const sandbox = { window: {} };\n  vm.runInNewContext(read("js/statusManager.js"), sandbox, { filename: "statusManager.js" });\n  const registry = sandbox.window.STATUS_REGISTRY;\n  expect(registry.defense_power_up.rules[0].affectation).toBe("defense_power");\n  expect(registry.counter_power_up.rules[0].affectation).toBe("counter_power");\n  expect(registry.evade_power_up.rules[0].affectation).toBe("evade_power");\n  expect(registry.guard_power_up.rules[0].affectation).toBe("guard_power");\n\n  const previousRegistry = global.STATUS_REGISTRY;\n  global.STATUS_REGISTRY = registry;\n  try {\n    const unit = {};\n    statusEngine.applyStatus(unit, "frightened", { count: 1, duration: "next_turn_end", mode: "set" });\n    expect(modifiers.resolveStatusModifiers({ unit, skill: { type: "Normal" } }).final_power).toBe(-1);\n    expect(modifiers.resolveStatusModifiers({ unit, skill: { type: "Counter" } }).defense_power).toBe(-1);\n    expect(statusEngine.advanceDurations(unit, "turn_end")).toEqual(["frightened"]);\n    expect(statusEngine.hasStatus(unit, "frightened")).toBe(false);\n  } finally {\n    global.STATUS_REGISTRY = previousRegistry;\n  }\n});\n\ntest("prompt Check modifiers recalculate from baseRollTotal instead of requiring a trait-specific flag", () => {\n  const source = read("js/player-trait-runtime.js");\n  expect(source).toContain("const baseRollTotal = Number.isFinite(Number(state.lastCompletedCheck.baseRollTotal))");\n  expect(source).not.toContain("if (!check?.recalculate || !state.lastCompletedCheck) return null;");\n});'''
)

print('Universal defense/review patch applied successfully.')
