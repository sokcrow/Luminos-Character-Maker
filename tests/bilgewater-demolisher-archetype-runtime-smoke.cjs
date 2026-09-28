const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

(async () => {
  const root = path.resolve(__dirname, "..");

  delete globalThis.LuminousBilgewaterDemolisherArchetypeRuntime;
  delete globalThis.LuminousBilgewaterDemolisherCombatRuntime;
  delete globalThis.__luminousBilgewaterMarksmanCombatBridgeState;

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
    hasStatus(unit, id) { return Boolean(unit.statusEffects?.[id]); },
    getStatus(unit, id) { return unit.statusEffects?.[id] || null; },
    applyStatus(unit, id, input = {}) {
      if (!unit.statusEffects) unit.statusEffects = {};
      const existing = unit.statusEffects[id] || { id, count: 0, potency: 0, data: {} };
      const count = Number(input.count ?? 1);
      unit.statusEffects[id] = {
        ...existing,
        ...input,
        id,
        count: input.mode === "set" ? count : Number(existing.count || 0) + count,
        data: { ...(existing.data || {}), ...(input.data || {}) },
      };
      return unit.statusEffects[id];
    },
  };

  globalThis.LuminousSpellcastingRuntime = Object.freeze({
    resolveSpellcasting() { return { spellDC: 17 }; },
  });

  globalThis.LuminousFixedDamageRuntime = {
    applyFixedDamage(target, damage, options = {}) {
      options.engine?.applyDamage?.(target, damage, "directo", false, options.skillUsed || null);
      return { applied: damage };
    },
  };

  await import(pathToFileURL(path.join(root, "js/combat-skill-schema.js")).href);
  await import(pathToFileURL(path.join(root, "js/bilgewater-demolisher-archetype-runtime.js")).href);
  const Runtime = globalThis.LuminousBilgewaterDemolisherArchetypeRuntime;
  assert.ok(Runtime);

  const ranger = {
    id: "ranger_1",
    classes: [{ classId: "ranger", level: 90 }],
    archetypes: [{ classId: "ranger", archetypeId: "bilgewater_demolisher" }],
    equipment: {
      mainHand: {
        chassisId: "shotgun",
        runtimeState: { firearm: { capacity: 5, loadedAmmo: 1 } },
      },
    },
    activeInventory: {
      shells: { family: "firearm_ammunition", quantity: 2 },
    },
    statusEffects: { haste: { id: "haste", count: 2 } },
  };

  const shotgunSkill = { id: "boom", isRanged: true, attackWeight: 1, metadata: { weaponChassisId: "shotgun" } };
  assert.equal(Runtime.isShotgunRangedSkill(shotgunSkill), true);
  const decorated = Runtime.decorateShotgunSkill(ranger, shotgunSkill);
  assert.equal(decorated.attackWeight, 2);
  assert.equal(Runtime.decorateShotgunSkill(ranger, decorated).attackWeight, 2);
  assert.equal(Runtime.rangerSpellSaveDC(ranger), 17);
  assert.equal(Runtime.smokeScreenSkill(ranger).attackWeight, 3);
  assert.equal(globalThis.CombatSkillSchema.validateCombatSkill(Runtime.smokeScreenSkill(ranger)).valid, true);

  const enemy = { id: "enemy_2", statusEffects: {} };
  Runtime.applySmokeScreenFailedSave(ranger, enemy);
  assert.equal(Runtime.smokeScreenDamageMultiplier(ranger, enemy), 1.1);
  Runtime.applyPendingSmokeScreen(enemy);
  assert.equal(enemy.statusEffects.bind.count, 3);
  assert.equal(enemy.statusEffects.clash_power_down.count, 3);

  Runtime.queueTrueGrit(ranger);
  Runtime.queueTrueGrit(ranger);
  const protection = Runtime.applyTrueGritAtTurnStart(ranger);
  assert.equal(protection, 2);
  assert.equal(ranger.statusEffects.protection.count, 2);

  const reload = Runtime.quickdrawReload(ranger);
  assert.equal(reload.reloaded, 1);
  assert.equal(ranger.equipment.mainHand.runtimeState.firearm.loadedAmmo, 2);
  assert.equal(ranger.activeInventory.shells.quantity, 1);

  assert.equal(Runtime.collateralFixedDamage(ranger, false), 18);
  assert.equal(Runtime.collateralFixedDamage(ranger, true), 9);
  assert.equal(Runtime.endOfLineDamage(ranger, 100), 30);
  assert.equal(Runtime.consumeEndOfLine(ranger), true);
  assert.equal(Runtime.endOfLineDamage(ranger, 100), 0);
  Runtime.resetEndOfLine(ranger);

  globalThis.CombatEngine = {
    applyPassiveModifiers() { return {}; },
    calculateCoinDamage() { return 100; },
    applyDamage(unit, damage) {
      let left = damage;
      if (unit.shield > 0) {
        const blocked = Math.min(unit.shield, left);
        unit.shield -= blocked;
        left -= blocked;
      }
      unit.hp = Math.max(0, unit.hp - left);
      return { hp: unit.hp, shield: unit.shield };
    },
    triggerEvent() { return true; },
    triggerPhase() { return true; },
    resolveUnilateralWithCounter(attacker, skill, defender) {
      const damage = this.calculateCoinDamage(attacker, defender, skill, 10, false, 0, {});
      this.applyDamage(defender, damage, "directo", false, skill);
      return { attackLogs: [{ attackPower: 10 }] };
    },
  };

  globalThis.LuminousCombatSkillLoadout074 = Object.freeze({
    skillIdsFor() { return ["boom"]; },
    ownsSkill(_unit, id) { return id === "boom"; },
    resolveSkillForCombatant(_unit, id) {
      return id === "boom"
        ? { ok: true, reason: null, skillId: id, skill: shotgunSkill }
        : { ok: false, reason: "SKILL_NOT_EQUIPPED", skillId: id, skill: null };
    },
    skillLibrary() { return { boom: shotgunSkill }; },
  });

  globalThis.LuminousCombatActionAdapters = Object.freeze({
    compileSkillToCombatAction(actor, skill) {
      return { actorId: actor.id, source: { type: "skill", id: skill.id }, targeting: { attackWeight: skill.attackWeight || 1 }, resolution: { type: "unopposed" }, metadata: { sourceDefinition: skill } };
    },
  });

  globalThis.LuminousCombatActionResolver = Object.freeze({
    resolveCombatAction() { return { resolved: true, resolution: { type: "unopposed", results: [] } }; },
    resolvePreparedUnopposed() { return { resolved: true }; },
  });

  await import(pathToFileURL(path.join(root, "js/bilgewater-demolisher-combat-runtime.js")).href);
  const Combat = globalThis.LuminousBilgewaterDemolisherCombatRuntime;
  assert.ok(Combat);
  Combat.install();

  assert.deepEqual(globalThis.LuminousCombatSkillLoadout074.skillIdsFor(ranger), ["boom", "smoke_screen"]);
  assert.equal(globalThis.LuminousCombatSkillLoadout074.ownsSkill(ranger, "smoke_screen"), true);
  const grantedSmoke = globalThis.LuminousCombatSkillLoadout074.resolveSkillForCombatant(ranger, "smoke_screen");
  assert.equal(grantedSmoke.ok, true);
  assert.equal(grantedSmoke.skill.saveDC, 17);
  assert.equal(globalThis.LuminousCombatSkillLoadout074.skillLibrary().smoke_screen.name, "Smoke Screen");

  const mods = globalThis.CombatEngine.applyPassiveModifiers(ranger, { skill: shotgunSkill });
  assert.equal(mods.damage_dealt_multiplier, 2);
  assert.equal(mods.crit_damage_multiplier, 1);

  const secondary = { id: "secondary", hp: 500, shield: 0, statusEffects: {} };
  globalThis.CombatEngine.resolveUnilateralWithCounter(ranger, shotgunSkill, secondary, null, { isSecondaryTarget: true, attackWeight: 2 });
  assert.equal(secondary.hp, 431);

  const main = { id: "main", hp: 500, shield: 0, statusEffects: {} };
  globalThis.CombatEngine.resolveUnilateralWithCounter(ranger, shotgunSkill, main, null, { isSecondaryTarget: false, attackWeight: 2 });
  assert.equal(main.hp, 352);

  globalThis.CombatEngine.triggerPhase("[Round Start]", [ranger]);
  assert.equal(ranger.__bilgewaterEndOfLineUsed, false);

  console.log("Demolisher / Demolisher runtime smoke: OK");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
