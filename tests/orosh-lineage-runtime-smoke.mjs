import assert from "node:assert/strict";

const character = {
  id: "player-orosh",
  name: "Orosh Tester",
  classes: [{ classId: "sorcerer", levels: 40, archetypeId: "orosh_lineage" }],
  archetypes: [{ id: "orosh_lineage", classId: "sorcerer" }],
  spellcastingState: {
    slotsByClass: {
      sorcerer: {
        levels: {
          1: { maximum: 4, spent: 0 },
          2: { maximum: 3, spent: 0 },
          3: { maximum: 3, spent: 0 },
          4: { maximum: 3, spent: 0 },
          5: { maximum: 3, spent: 0 },
        },
      },
    },
  },
};

const combatUnit = {
  id: "combat-unit-77",
  combatId: "combat-unit-77",
  name: "Orosh Tester",
  hp: 100,
  maxHp: 100,
  sp: 0,
};

globalThis.LuminousPlayerTraitRuntime = {
  getCharacter() { return character; },
};

globalThis.LuminousArchetypeEngine = {
  isSelected(input, archetypeId, classId) {
    return archetypeId === "orosh_lineage"
      && classId === "sorcerer"
      && (input?.archetypes || []).some((entry) => entry.id === "orosh_lineage");
  },
  getClassLevel(input, classId) {
    return input?.classes?.find((entry) => entry.classId === classId)?.levels || 0;
  },
};

globalThis.LuminousTraitEngine = {
  resolveTheatreCheck(input = {}) {
    return {
      check: { difficulty: 0, abilityPower: 0, finalPower: 0, ...(input.check || {}) },
      state: input.state || {},
      outcomes: [],
    };
  },
  dispatchTrait(trait, trigger, runtime = {}, traitState = {}) {
    return { trait, trigger, runtime, state: traitState, outcomes: [] };
  },
};

const statusApplyLog = [];
globalThis.LuminousStatusEngine = {
  applyStatus(unit, statusId, input = {}) {
    if (!unit.statusEffects || typeof unit.statusEffects !== "object") unit.statusEffects = {};
    const id = String(statusId).toLowerCase();
    const existing = unit.statusEffects[id] || { id, count: 0, potency: 0 };
    const mode = input.mode || "gain";
    const next = {
      id,
      count: mode === "set" ? Number(input.count ?? 1) : Number(existing.count || 0) + Number(input.count ?? 1),
      potency: mode === "set" ? Number(input.potency ?? 0) : Number(existing.potency || 0) + Number(input.potency ?? 0),
      duration: input.duration || existing.duration || "until_removed",
      sourceTraitId: input.sourceTraitId || null,
      sourceUnitId: input.sourceUnitId || null,
      data: { ...(existing.data || {}), ...(input.data || {}) },
    };
    unit.statusEffects[id] = next;
    statusApplyLog.push({ unit, statusId: id, input: { ...input }, result: { ...next } });
    return next;
  },
};

globalThis.LuminousConditionRuntime = {
  canTarget(unit, target, skill = {}, options = {}) {
    if (target?.statusEffects?.invisible && options.ignoreInvisible !== true) {
      return { allowed: false, reason: "invisible_weight_3_or_less", weight: skill.attackWeight || 1 };
    }
    if (["normal_darkness", "magical_darkness", "visual_camouflage"].includes(options.obscurement) && !options[`ignore${options.obscurement}`]) {
      return { allowed: false, reason: options.obscurement };
    }
    return { allowed: true, reason: null };
  },
};

let spellcastingPersistCalls = 0;
let freeSpellcastingCalls = 0;
globalThis.LuminousSpellcastingRuntime = {
  readCurrentSp(unit = {}) { return Number(unit.sp ?? unit.currentSp ?? 0); },
  writeCurrentSp(unit = {}, value) {
    unit.sp = Math.max(-45, Math.min(45, Number(value || 0)));
    return unit.sp;
  },
  ensureSpellcastingState(unit = {}) {
    if (!unit.spellcastingState) unit.spellcastingState = character.spellcastingState;
    return unit.spellcastingState;
  },
  spellSlotPool(unit = {}, classId, level) {
    const state = this.ensureSpellcastingState(unit);
    if (!state.slotsByClass[classId]) state.slotsByClass[classId] = { levels: {} };
    if (!state.slotsByClass[classId].levels[level]) state.slotsByClass[classId].levels[level] = { maximum: 0, spent: 0 };
    return state.slotsByClass[classId].levels[level];
  },
  persistSpellcastingState() { spellcastingPersistCalls += 1; },
  resolveSpellSave() { return { abilityId: "wis", dc: 12 }; },
  castSpell(unit, spell) {
    freeSpellcastingCalls += 1;
    return { success: true, spell, resource: spell.cantrip ? { type: "cantrip", spent: 0 } : { type: "slot", spent: 1 } };
  },
};

let paidSorcererCasts = 0;
globalThis.LuminousSorcererClassRuntime = {
  castSorcererSpell(unit, spell) {
    paidSorcererCasts += 1;
    return { success: true, spell, paid: true };
  },
};

let lastAoEWeight = null;
globalThis.CombatEngine = {
  calculateFinalPower() { return 10; },
  calculateCoinDamage() { return 100; },
  calculateAoETargets(skill, primaryTarget) {
    lastAoEWeight = skill.attackWeight ?? skill.atkWeight ?? skill.weight ?? 1;
    return primaryTarget ? [primaryTarget] : [];
  },
  triggerEvent(tag, context = {}) {
    if (tag === "[Test Status]") {
      globalThis.LuminousStatusEngine.applyStatus(context.currentTarget, "burn", { mode: "gain", count: 1, potency: 2 });
    }
    if (tag === "[Spellcasting SP Loss]") {
      const before = globalThis.LuminousSpellcastingRuntime.readCurrentSp(context.attacker);
      globalThis.LuminousSpellcastingRuntime.writeCurrentSp(context.attacker, before - 10);
    }
    return { tag, context };
  },
  processStatusEffects(unit, triggerKey) {
    if (triggerKey === "lose_sp_10") unit.sp = Number(unit.sp || 0) - 10;
    return unit;
  },
};

await import("../js/orosh-lineage-runtime.js");
const runtime = globalThis.LuminousOroshLineageRuntime;
assert.ok(runtime, "Orosh runtime should expose an API");
assert.equal(runtime.isSelected(character), true, "Orosh should be detected");
assert.equal(runtime.isSelected(combatUnit), true, "Linked combat unit should resolve the player's Orosh build");
assert.equal(runtime.getLevel(character), 40, "Sorcerer class level should resolve");
assert.equal(runtime.getLevel(combatUnit), 40, "Linked combat unit should share the player class level");

const fragmentSelection = runtime.selectFragment(character, "Pride");
assert.equal(fragmentSelection.selected, true);
assert.equal(fragmentSelection.fragment, "pride");

const illegalReselection = runtime.selectFragment(character, "Wrath");
assert.equal(illegalReselection.selected, false, "Fragment cannot be reselected before Long Rest");
assert.equal(illegalReselection.reason, "fragment_locked_until_long_rest");
assert.equal(runtime.getState(character).selectedFragment, "pride", "Locked reselection must preserve the original Fragment");
assert.equal(runtime.getState(combatUnit), runtime.getState(character), "Theatre character and Combat unit must share one Orosh state record");

const fragmentedTrait = { id: "orosh_lineage_fragmented_blessing" };
const firstPersuasion = globalThis.LuminousTraitEngine.resolveTheatreCheck({
  character,
  traits: [fragmentedTrait],
  check: { skillId: "Persuasion", finalPower: 5 },
});
assert.equal(firstPersuasion.check.finalPower, 7, "Fragmented Blessing should add +2 Final Power");

const secondPersuasion = globalThis.LuminousTraitEngine.resolveTheatreCheck({
  character,
  traits: [fragmentedTrait],
  check: { skillId: "Persuasion", finalPower: 5 },
});
assert.equal(secondPersuasion.check.finalPower, 5, "Fragmented Blessing check bonus should only apply once before reset");

const failedRefill = runtime.selectFragment(character, "Pride");
assert.equal(failedRefill.selected, false, "Reselecting the same Fragment must not refill the once-per-rest check bonus");
assert.equal(runtime.getState(character).fragmentCheckBonusUsed, true, "Failed reselection must not refund the Fragment check bonus");

const emotionalTrait = { id: "orosh_lineage_emotional_echo" };
const emotionalRead = globalThis.LuminousTraitEngine.resolveTheatreCheck({
  character,
  traits: [emotionalTrait],
  target: { id: "human-target", raceId: "humano" },
  check: { skillId: "Insight", intent: "detect_lie", finalPower: 4 },
});
assert.equal(emotionalRead.check.finalPower, 6, "Emotional Echo should add +2 to an explicit emotional Insight check");

const yuanTiRead = globalThis.LuminousTraitEngine.resolveTheatreCheck({
  character,
  traits: [emotionalTrait],
  target: { id: "yuan-ti-target", raceId: "yuanti_pura_sangre" },
  check: { skillId: "Insight", intent: "detect_lie", finalPower: 4 },
});
assert.equal(yuanTiRead.check.finalPower, 4, "Emotional Echo should not apply against Yuan-ti");

const prideSkill = { type: "Attack", sinAffinity: "Pride", basePower: 4, coinPower: 4, attackWeight: 1 };
assert.equal(globalThis.CombatEngine.calculateFinalPower(prideSkill, 1, combatUnit), 12, "Level 40 Pride skill should receive +2 Final Power");
assert.equal(globalThis.CombatEngine.calculateCoinDamage(combatUnit, {}, prideSkill), 120, "Level 40 Pride skill should receive +20% Damage");

const unrelatedSkill = { type: "Attack", sinAffinity: "Wrath", basePower: 4, coinPower: 4, attackWeight: 1 };
assert.equal(globalThis.CombatEngine.calculateFinalPower(unrelatedSkill, 1, combatUnit), 10, "Other Sins should not receive Fragmented Blessing power");
assert.equal(globalThis.CombatEngine.calculateCoinDamage(combatUnit, {}, unrelatedSkill), 100, "Other Sins should not receive Fragmented Blessing damage");

const mentalSpellA = { type: "Spell", tags: ["emotion"], attackWeight: 1 };
globalThis.CombatEngine.calculateAoETargets(mentalSpellA, { id: "target-a" }, [], combatUnit);
assert.equal(lastAoEWeight, 2, "Primordial Bond should add +1 ATK Weight to the first eligible spell");

const mentalSpellB = { type: "Spell", tags: ["mind"], attackWeight: 1 };
globalThis.CombatEngine.calculateAoETargets(mentalSpellB, { id: "target-b" }, [], combatUnit);
assert.equal(lastAoEWeight, 1, "Primordial Bond should only apply once per turn");

globalThis.LuminousTraitEngine.dispatchTrait(
  { id: "orosh_lineage_primordial_bond" },
  "turn_start",
  { character: combatUnit, self: combatUnit },
  {},
);
const mentalSpellC = { type: "Spell", tags: ["mind"], attackWeight: 1 };
globalThis.CombatEngine.calculateAoETargets(mentalSpellC, { id: "target-c" }, [], combatUnit);
assert.equal(lastAoEWeight, 2, "Primordial Bond should reset at Turn Start");

await import("../js/orosh-lineage-complete-runtime.js");
const complete = globalThis.LuminousOroshLineageCompleteRuntime;
assert.ok(complete, "Complete Orosh runtime should expose an API");

const invisibleTarget = { id: "hidden-target", statusEffects: { invisible: { count: 1 } } };
assert.equal(globalThis.LuminousConditionRuntime.canTarget(combatUnit, invisibleTarget, { attackWeight: 1 }).allowed, true, "Termosense should bypass visual untargetability");
assert.equal(globalThis.LuminousConditionRuntime.canTarget({ id: "ordinary-unit" }, invisibleTarget, { attackWeight: 1 }).allowed, false, "Non-Orosh Units should remain blocked by visual untargetability");
assert.equal(runtime.canIgnoreTargetingObscurement(combatUnit, "normal_darkness"), true);
assert.equal(runtime.canIgnoreTargetingObscurement(combatUnit, "magical_darkness"), true);
assert.equal(runtime.canIgnoreTargetingObscurement(combatUnit, "visual_camouflage"), true);
assert.equal(runtime.canIgnoreTargetingObscurement(combatUnit, "solid_wall"), false);

const detectSpell = { id: "detect_emotions", name: "Detect Emotions", level: 2, slotLevel: 2, sourceClassId: "sorcerer", type: "Spell", tags: ["emotion"] };
const freeDetect = globalThis.LuminousSorcererClassRuntime.castSorcererSpell(character, detectSpell, {});
assert.equal(freeDetect.success, true);
assert.equal(freeDetect.oroshFreeCast, true, "First Detect Emotions should use the Orosh free cast");
assert.equal(freeDetect.spentSpellSlot, false, "Free Detect Emotions must not spend a Spell Slot");
assert.equal(freeSpellcastingCalls, 1);
assert.equal(paidSorcererCasts, 0, "Free Detect Emotions should bypass paid Sorcerer casting");
const paidDetect = globalThis.LuminousSorcererClassRuntime.castSorcererSpell(character, detectSpell, {});
assert.equal(paidDetect.paid, true, "After the free use, Detect Emotions should fall back to normal casting");
assert.equal(paidSorcererCasts, 1);

complete.persistState(character);
assert.equal(character.archetypeResources.orosh_lineage.detectEmotionsUsed, true);

character.classes[0].levels = 85;
runtime.resetLongRest(character);
runtime.selectFragment(character, "Pride");
assert.equal(runtime.getLevel(combatUnit), 85);

const voiceTrait = { id: "orosh_lineage_voice_of_the_first" };
const wrathTarget = { id: "wrath-target", hp: 100, maxHp: 100, sp: 0 };
globalThis.LuminousTraitEngine.dispatchTrait(voiceTrait, "on_hit", {
  character: combatUnit, self: combatUnit, target: wrathTarget,
  skill: { type: "Attack", sinAffinity: "Wrath" }, damageDealt: 100,
}, {});
assert.equal(complete.stateFor(character).emotionalEchoes.wrath, 1, "Wrath On Hit should acquire its Echo");
assert.equal(globalThis.CombatEngine.calculateCoinDamage(combatUnit, wrathTarget, { type: "Attack", sinAffinity: "Wrath" }), 130, "Wrath Echo should grant +30% Damage");

const envyTarget = { id: "envy-target", hp: 100, maxHp: 100, sp: 0 };
globalThis.LuminousTraitEngine.dispatchTrait(voiceTrait, "on_hit", {
  character: combatUnit, self: combatUnit, target: envyTarget,
  skill: { type: "Attack", sinAffinity: "Envy" }, damageDealt: 20,
}, {});
assert.equal(globalThis.CombatEngine.calculateFinalPower({ type: "Attack", sinAffinity: "Envy" }, 1, combatUnit), 12, "Envy Echo should grant +2 Final Power");

const gloomTarget = { id: "gloom-target", hp: 100, maxHp: 100, sp: 10 };
globalThis.LuminousTraitEngine.dispatchTrait(voiceTrait, "on_hit", {
  character: combatUnit, self: combatUnit, target: gloomTarget,
  skill: { type: "Attack", sinAffinity: "Gloom" }, damageDealt: 20,
}, {});
assert.equal(gloomTarget.sp, 6, "Gloom Echo should deal 4 SP Damage On Hit");

combatUnit.sp = 0;
const prideTarget = { id: "pride-target", hp: 100, maxHp: 100, sp: 0 };
globalThis.LuminousTraitEngine.dispatchTrait(voiceTrait, "on_hit", {
  character: combatUnit, self: combatUnit, target: prideTarget,
  skill: { type: "Attack", sinAffinity: "Pride" }, damageDealt: 20,
}, {});
globalThis.LuminousTraitEngine.dispatchTrait(voiceTrait, "clash_win", {
  character: combatUnit, self: combatUnit, target: prideTarget,
  skill: { type: "Attack", sinAffinity: "Pride" },
}, {});
assert.equal(combatUnit.sp, 7, "Pride Echo should restore 7 SP On Clash Win");

combatUnit.hp = 50;
const gluttonyTarget = { id: "gluttony-target", hp: 100, maxHp: 100, sp: 0 };
globalThis.LuminousTraitEngine.dispatchTrait(voiceTrait, "on_hit", {
  character: combatUnit, self: combatUnit, target: gluttonyTarget,
  skill: { type: "Attack", sinAffinity: "Gluttony" }, damageDealt: 100,
}, {});
assert.equal(combatUnit.hp, 65, "Gluttony Echo should heal 15% of Damage dealt");

const slothTarget = { id: "sloth-target", hp: 100, maxHp: 100, sp: 0 };
globalThis.LuminousTraitEngine.dispatchTrait(voiceTrait, "on_hit", {
  character: combatUnit, self: combatUnit, target: slothTarget,
  skill: { type: "Attack", sinAffinity: "Sloth" }, damageDealt: 20,
}, {});
assert.equal(slothTarget.statusEffects.bind.count, 2, "Sloth Echo should inflict 2 Bind On Hit");

const lustTarget = { id: "lust-target", hp: 100, maxHp: 100, sp: 0 };
globalThis.LuminousTraitEngine.dispatchTrait(voiceTrait, "on_hit", {
  character: combatUnit, self: combatUnit, target: lustTarget,
  skill: { type: "Attack", sinAffinity: "Lust" }, damageDealt: 20,
}, {});
globalThis.CombatEngine.triggerEvent("[Test Status]", {
  attacker: combatUnit,
  currentTarget: lustTarget,
  target: lustTarget,
  skill: { type: "Attack", sinAffinity: "Lust" },
}, [lustTarget]);
assert.equal(lustTarget.statusEffects.burn.potency, 5, "Lust Echo should add +3 Potency to Skill-inflicted statuses");

for (const sin of complete.VOICE_SINS) complete.stateFor(character).emotionalEchoes[sin] = 0;
const ascensionTrait = { id: "orosh_lineage_ascension_of_the_heiress" };
globalThis.LuminousTraitEngine.dispatchTrait(ascensionTrait, "on_use", { character: combatUnit, self: combatUnit }, {});
assert.equal(complete.stateFor(character).ascension.active, true, "Ascension should activate from Trait on_use");
assert.equal(complete.stateFor(character).ascension.roundsRemaining, 10);
assert.equal(complete.stateFor(character).ascension.available, false, "Ascension should be once per Long Rest");
assert.equal(globalThis.CombatEngine.calculateFinalPower({ type: "Spell", tags: ["mind"] }, 1, combatUnit), 16, "Ascended Spells should gain +6 Final Power");
const save = globalThis.LuminousSpellcastingRuntime.resolveSpellSave(character, "sorcerer", { type: "Spell", tags: ["emotion"] }, {});
assert.equal(save.dc, 16, "Ascension should raise saves against mind/emotion/illusion/psychic Spells by +4 Threshold");

combatUnit.sp = 20;
globalThis.LuminousSpellcastingRuntime.writeCurrentSp(combatUnit, 10);
assert.equal(combatUnit.sp, 15, "Ascension should reduce Spellcasting SP Loss by 5");
combatUnit.sp = 20;
globalThis.CombatEngine.processStatusEffects(combatUnit, "lose_sp_10", { attacker: combatUnit, target: combatUnit });
assert.equal(combatUnit.sp, 15, "Ascension should reduce Combat-engine SP Loss by 5");
combatUnit.sp = 20;
globalThis.CombatEngine.triggerEvent("[Spellcasting SP Loss]", { attacker: combatUnit, target: combatUnit, skill: { type: "Spell", tags: ["mind"] } }, [combatUnit]);
assert.equal(combatUnit.sp, 15, "A Spellcasting SP loss nested inside Combat must receive the -5 mitigation exactly once");

character.spellcastingState.slotsByClass.sorcerer.levels[5].spent = 2;
character.spellcastingState.slotsByClass.sorcerer.levels[4].spent = 1;
const doomed = { id: "doomed", hp: 0, maxHp: 100, sp: 0 };
globalThis.LuminousTraitEngine.dispatchTrait(ascensionTrait, "on_hit", {
  character: combatUnit, self: combatUnit, target: doomed,
  skill: { id: "mind_spell", type: "Spell", tags: ["mind"] }, damageDealt: 20,
}, {});
globalThis.LuminousTraitEngine.dispatchTrait(ascensionTrait, "on_kill", {
  character: combatUnit, self: combatUnit, target: doomed,
  skill: { id: "mind_spell", type: "Spell", tags: ["mind"] },
}, {});
assert.equal(character.spellcastingState.slotsByClass.sorcerer.levels[5].spent, 0);
assert.equal(character.spellcastingState.slotsByClass.sorcerer.levels[4].spent, 0);
assert.equal(complete.stateFor(character).ascension.slotRecoveryUsedThisTurn, true, "Ascension Slot recovery should be once per Turn");
assert.ok(spellcastingPersistCalls > 0, "Recovered Slots should persist through the Spellcasting runtime");

character.spellcastingState.slotsByClass.sorcerer.levels[5].spent = 1;
const doomedTwo = { id: "doomed-two", hp: 0, maxHp: 100, sp: 0 };
complete.markSpellAffected(combatUnit, doomedTwo, { type: "Spell", tags: ["mind"] });
globalThis.LuminousTraitEngine.dispatchTrait(ascensionTrait, "on_kill", { character: combatUnit, self: combatUnit, target: doomedTwo }, {});
assert.equal(character.spellcastingState.slotsByClass.sorcerer.levels[5].spent, 1, "A second kill in the same Turn must not recover Slots");
globalThis.LuminousTraitEngine.dispatchTrait(ascensionTrait, "turn_start", { character: combatUnit, self: combatUnit }, {});
globalThis.LuminousTraitEngine.dispatchTrait(ascensionTrait, "on_kill", { character: combatUnit, self: combatUnit, target: doomedTwo }, {});
assert.equal(character.spellcastingState.slotsByClass.sorcerer.levels[5].spent, 0, "Turn Start should reset Ascension Slot recovery");

for (let i = 0; i < 10; i += 1) {
  globalThis.LuminousTraitEngine.dispatchTrait(ascensionTrait, "turn_end", { character: combatUnit, self: combatUnit }, {});
}
assert.equal(complete.stateFor(character).ascension.active, false, "Ascension should expire after 10 Rounds");
assert.equal(complete.stateFor(character).ascension.roundsRemaining, 0);
assert.equal(complete.activateAscension(combatUnit, { skipEconomy: true }).activated, false, "Ascension cannot be reactivated before Long Rest");

runtime.resetLongRest(character);
assert.equal(runtime.getState(character).selectedFragment, null, "Long Rest should require a new Fragment selection");
assert.equal(runtime.getState(character).fragmentSelectionAvailable, true, "Long Rest should unlock Fragment selection");
assert.equal(runtime.getState(character).fragmentCheckBonusUsed, false, "Long Rest should reset the Fragment check use");
assert.equal(complete.stateFor(character).detectEmotionsUsed, false, "Long Rest should restore free Detect Emotions");
assert.equal(complete.stateFor(character).ascension.available, true, "Long Rest should restore Ascension");

const postRestSelection = runtime.selectFragment(combatUnit, "Wrath");
assert.equal(postRestSelection.selected, true, "Fragment selection should be available again after Long Rest");
assert.equal(runtime.getState(character).selectedFragment, "wrath", "Combat-side selection must update the shared player state");

console.log("Orosh Lineage complete Theatre/Combat runtime smoke passed.");