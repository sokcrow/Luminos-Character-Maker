const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

(async () => {
  const root = path.resolve(__dirname, "..");

  delete globalThis.LuminousBilgewaterBuccaneerArchetypeRuntime;
  delete globalThis.LuminousBilgewaterBuccaneerCombatRuntime;
  delete globalThis.__luminousBilgewaterBuccaneerCombatBridgeState;

  globalThis.STATUS_REGISTRY = {};
  globalThis.SKILL_REGISTRY = {};

  globalThis.LuminousArchetypeEngine = Object.freeze({
    getClassLevel(character, classId) {
      const found = (character.classes || []).find((entry) => entry.classId === classId);
      return Number(found?.level || found?.levels || 0);
    },
    isSelected(character, archetypeId, classId) {
      return (character.archetypes || []).some((entry) => entry.classId === classId && entry.archetypeId === archetypeId);
    },
    resolveTraitGrants() { return []; },
  });

  globalThis.LuminousStatusEngine = {
    getStatus(unit, id) { return unit.statusEffects?.[id] || null; },
    hasStatus(unit, id) { return Boolean(unit.statusEffects?.[id]); },
    applyStatus(unit, id, input = {}) {
      if (!unit.statusEffects) unit.statusEffects = {};
      const current = unit.statusEffects[id] || { id, count: 0, potency: 0, data: {} };
      const mode = input.mode || "gain";
      const count = Number(input.count || 0);
      const potency = Number(input.potency || 0);
      current.count = mode === "set" ? count : Number(current.count || 0) + count;
      current.potency = mode === "set" ? potency : Number(current.potency || 0) + potency;
      current.data = { ...(current.data || {}), ...(input.data || {}) };
      current.sourceUnitId = input.sourceUnitId || current.sourceUnitId || null;
      unit.statusEffects[id] = current;
      return current;
    },
    removeStatus(unit, id) {
      if (!unit.statusEffects?.[id]) return false;
      delete unit.statusEffects[id];
      return true;
    },
  };

  globalThis.LuminousSpellcastingRuntime = Object.freeze({
    resolveSpellcasting() { return { spellDC: 17 }; },
  });

  globalThis.LuminousCombatDeploymentRuntime = Object.freeze({
    sideOf(unit) { return String(unit.faction || "ally").includes("enemy") ? "enemy" : "ally"; },
    isField(unit) { return unit.isBackup !== true && unit.battleActive !== false; },
  });

  await import(pathToFileURL(path.join(root, "js/combat-skill-schema.js")).href);
  await import(pathToFileURL(path.join(root, "js/combat-action-schema.js")).href);
  await import(pathToFileURL(path.join(root, "js/combat-action-adapters.js")).href);
  await import(pathToFileURL(path.join(root, "js/bilgewater-buccaneer-archetype-runtime.js")).href);

  const Runtime = globalThis.LuminousBilgewaterBuccaneerArchetypeRuntime;
  assert.ok(Runtime);
  assert.equal(Runtime.ARCHETYPE_ID, "bilgewater_buccaneer");
  assert.equal(Runtime.ARCHETYPE.regionId, "bilgewater");
  assert.equal(Runtime.ARCHETYPE.familyId, "marksman");
  assert.ok(globalThis.STATUS_REGISTRY.target_mark);

  const ranger = {
    id: "ranger_buccaneer",
    faction: "ally",
    hp: 100,
    shield: 0,
    sp: 50,
    classes: [{ classId: "ranger", level: 90 }],
    archetypes: [{ classId: "ranger", archetypeId: "bilgewater_buccaneer" }],
    equipment: { mainHand: { chassisId: "pistol" } },
    statusEffects: {},
  };

  const pistolSkill = {
    id: "pistol_shot",
    type: "Attack",
    basePower: 6,
    coinPower: 4,
    coinAmount: 1,
    coins: [{ index: 0, type: "normal", status: "active", effects: [] }],
    attackWeight: 1,
    isRanged: true,
    metadata: { weaponChassisId: "pistol" },
    targetingType: "Focused Attack",
    damageType: "perforante",
    isClashable: false,
    isUnclashable: true,
  };

  assert.equal(Runtime.isPistolRangedSkill(pistolSkill), true);
  assert.equal(Runtime.rangerSpellSaveDC(ranger), 17);
  assert.equal(Runtime.powderRainSkill(ranger).attackWeight, 4);
  assert.equal(Runtime.powderRainSkill(ranger).basePower, 3);
  assert.equal(Runtime.powderRainSkill(ranger).coinPower, 3);
  assert.equal(Runtime.broadsideSkill(ranger).coinAmount, 5);
  assert.equal(Runtime.broadsideSkill(ranger).attackWeight, 8);
  assert.equal(globalThis.CombatSkillSchema.validateCombatSkill(Runtime.powderRainSkill(ranger)).valid, true);

  globalThis.LuminousCombatSkillLoadout074 = Object.freeze({
    skillIdsFor() { return ["pistol_shot"]; },
    ownsSkill(_unit, id) { return id === "pistol_shot"; },
    resolveSkillForCombatant(_unit, id) {
      return id === "pistol_shot"
        ? { ok: true, reason: null, skillId: id, skill: pistolSkill }
        : { ok: false, reason: "SKILL_NOT_EQUIPPED", skillId: id, skill: null };
    },
    skillLibrary() { return { pistol_shot: pistolSkill }; },
  });

  globalThis.LuminousCombatActionResolver = Object.freeze({
    resolveCombatAction(input) {
      return { resolved: true, action: input, resolution: { type: input.resolution?.type || "automatic", results: [] } };
    },
  });

  const enemyA = { id: "enemy_a", faction: "enemy", hp: 200, shield: 0, statusEffects: {} };
  const enemyB = { id: "enemy_b", faction: "enemy", hp: 200, shield: 0, statusEffects: {} };
  const activeUnits = [ranger, enemyA, enemyB];

  globalThis.CombatEngine = {
    getAllAliveUnits() { return activeUnits.filter((unit) => Number(unit.hp) > 0); },
    getCoinProbability() { return 100; },
    calculateFinalPower(skill, heads) {
      return Number(skill.basePower || 0) + (heads?.[0] ? Number(skill.coinPower || 0) : 0);
    },
    calculateCoinDamage(_attacker, _defender, _skill, power) { return Number(power || 0); },
    applyDamage(unit, damage) {
      let left = Math.max(0, Number(damage || 0));
      const blocked = Math.min(Number(unit.shield || 0), left);
      unit.shield = Number(unit.shield || 0) - blocked;
      left -= blocked;
      unit.hp = Math.max(0, Number(unit.hp || 0) - left);
      return { hp: unit.hp, shield: unit.shield };
    },
    triggerEvent() { return true; },
    triggerPhase() { return true; },
    resolveUnilateralWithCounter(attacker, skill, defender, _counter, options = {}) {
      const context = { engine: this, attacker, defender, skill, targetsHit: [defender] };
      if (!options.skipUseHooks) {
        this.triggerEvent("[Before Use]", context, [defender]);
        this.triggerEvent("[On Use]", context, [defender]);
      }
      const coin = skill.coins?.[0] || { index: 0, type: "normal", status: "active", effects: [] };
      context.currentCoin = coin;
      const power = this.calculateFinalPower(skill, [true], attacker);
      const damage = this.calculateCoinDamage(attacker, defender, skill, power, false, 0, context);
      this.applyDamage(defender, damage, "directo", false, skill);
      context.damageDealt = damage;
      this.triggerEvent("[On Hit]", context, [defender]);
      return { attackLogs: [{ attackPower: power }], damageTaken: damage };
    },
  };

  await import(pathToFileURL(path.join(root, "js/bilgewater-buccaneer-combat-runtime.js")).href);
  const Combat = globalThis.LuminousBilgewaterBuccaneerCombatRuntime;
  assert.ok(Combat);
  Combat.install();

  const grantedIds = globalThis.LuminousCombatSkillLoadout074.skillIdsFor(ranger);
  assert.ok(grantedIds.includes("buccaneer_ricochet"));
  assert.ok(grantedIds.includes("powder_rain"));
  assert.equal(grantedIds.includes("broadside"), false);

  const ricochetAction = globalThis.LuminousCombatActionAdapters.compileSkillToCombatAction(ranger, Runtime.ricochetSkill(ranger), {});
  assert.equal(ricochetAction.economy.cost, "quick_action");
  assert.equal(ricochetAction.phase.executesAt, "planning_phase_player");
  assert.equal(ricochetAction.resolution.type, "automatic");

  const powderAction = globalThis.LuminousCombatActionAdapters.compileSkillToCombatAction(ranger, Runtime.powderRainSkill(ranger), { targetIds: ["enemy_a", "enemy_b"] });
  assert.equal(powderAction.economy.cost, "quick_action");
  assert.equal(powderAction.resolution.type, "save");
  assert.equal(powderAction.targeting.attackWeight, 4);

  // Target Shift: first Hit against an unmarked target gains +15% and moves the source-aware mark.
  enemyA.hp = 200;
  globalThis.CombatEngine.resolveUnilateralWithCounter(ranger, cloneSkill(pistolSkill), enemyA, null, {});
  assert.equal(enemyA.hp, 189);
  assert.equal(Runtime.hasOwnTargetMark(ranger, enemyA), true);
  assert.equal(ranger.__buccaneerSeaLegsPending, 1);

  // First Hit against the already marked target receives no +15% bonus.
  enemyA.hp = 200;
  globalThis.CombatEngine.resolveUnilateralWithCounter(ranger, cloneSkill(pistolSkill), enemyA, null, {});
  assert.equal(enemyA.hp, 190);

  enemyB.hp = 200;
  globalThis.CombatEngine.resolveUnilateralWithCounter(ranger, cloneSkill(pistolSkill), enemyB, null, {});
  assert.equal(enemyB.hp, 189);
  assert.equal(Runtime.hasOwnTargetMark(ranger, enemyA), false);
  assert.equal(Runtime.hasOwnTargetMark(ranger, enemyB), true);

  // Sea Legs: no previous-turn damage + Target Shift activation reaches the 3 Haste cap.
  ranger.took_damage_last_turn = false;
  const haste = Runtime.applySeaLegsAtTurnStart(ranger);
  assert.equal(haste, 3);
  assert.equal(ranger.statusEffects.haste.count, 3);

  // Ricochet arms as a Quick Action and the next Pistol Skill bounces its first Hit.
  Runtime.armRicochet(ranger);
  Runtime.moveTargetMark(ranger, enemyA);
  enemyA.hp = 200;
  enemyB.hp = 200;
  globalThis.CombatEngine.resolveUnilateralWithCounter(ranger, cloneSkill(pistolSkill), enemyA, null, {});
  assert.equal(ranger.__buccaneerRicochetArmed, false);
  assert.equal(enemyA.hp, 190);
  assert.equal(enemyB.hp, 195);

  // Powder Rain: failed Save takes full 6 and queues 2 Bind/2 Fragile; success takes half.
  enemyA.hp = 200;
  enemyB.hp = 200;
  const powderResult = {
    resolved: true,
    resolution: {
      type: "save",
      results: [
        { targetId: "enemy_a", result: { isSuccess: false } },
        { targetId: "enemy_b", result: { isSuccess: true } },
      ],
    },
  };
  Combat.applyPowderRainResolution(ranger, powderResult, { engine: globalThis.CombatEngine, units: activeUnits });
  assert.equal(enemyA.hp, 194);
  assert.equal(enemyB.hp, 197);
  Runtime.applyPendingPowderRain(enemyA);
  assert.equal(enemyA.statusEffects.bind.count, 2);
  assert.equal(enemyA.statusEffects.fragile.count, 2);

  // Broadside uses five independent Coins. Backup mode is quarter Damage; deployed mode is full Damage.
  enemyA.hp = 500;
  enemyB.hp = 500;
  const backup = Combat.executeBroadside(ranger, activeUnits, 0.25, { engine: globalThis.CombatEngine, random: () => 0 });
  assert.equal(backup.executed, true);
  assert.equal(backup.hits.length, 5);
  const backupDamage = 1000 - enemyA.hp - enemyB.hp;
  assert.equal(backupDamage, 10);

  enemyA.hp = 500;
  enemyB.hp = 500;
  const deployed = Combat.executeBroadside(ranger, activeUnits, 1, { engine: globalThis.CombatEngine, random: () => 0 });
  assert.equal(deployed.executed, true);
  assert.equal(deployed.hits.length, 5);
  const deployedDamage = 1000 - enemyA.hp - enemyB.hp;
  assert.equal(deployedDamage, 45);

  console.log("Bilgewater / Buccaneer runtime smoke: OK");

  function cloneSkill(skill) {
    return JSON.parse(JSON.stringify(skill));
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
