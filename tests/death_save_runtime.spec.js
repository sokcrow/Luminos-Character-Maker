const { test, expect } = require("@playwright/test");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const runtimeSource = fs.readFileSync(path.join(__dirname, "..", "js", "death-save-runtime.js"), "utf8");
const statusSource = fs.readFileSync(path.join(__dirname, "..", "js", "status-engine.js"), "utf8");

function createSandbox({ combatEngine = null, random = () => 0.25 } = {}) {
  const events = [];
  const math = Object.create(Math);
  math.random = random;
  const sandbox = {
    console,
    Math: math,
    Date,
    JSON,
    Object,
    Array,
    Set,
    WeakMap,
    Number,
    String,
    Boolean,
    RegExp,
    CustomEvent: class CustomEvent {
      constructor(type, init = {}) { this.type = type; this.detail = init.detail; }
    },
    dispatchEvent(event) { events.push(event); return true; },
    setInterval() { return 0; },
    clearInterval() {},
    CombatEngine: combatEngine,
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(runtimeSource, sandbox, { filename: "death-save-runtime.js" });
  return { sandbox, runtime: sandbox.LuminousDeathSaveRuntime, events };
}

const player = (extra = {}) => ({ id: "pc", isPlayer: true, hp: 100, maxHp: 100, sp: 0, ...extra });
const enemy = (extra = {}) => ({ id: "enemy", isPlayer: false, hp: 100, maxHp: 100, ...extra });

test("Death Save contract is the existing flat 5-Coin check", () => {
  const { runtime } = createSandbox();
  expect(runtime.DEATH_SAVE_CHECK).toMatchObject({ coinAmount: 5, coinPower: 4, basePower: 0, threshold: 10, flat: true, statModifiers: false });
  expect(runtime.SINNER_TRAIT.id).toBe("sinner");
});

test("Players and Captains use Downed; ordinary enemies die at 0 HP", () => {
  const { runtime } = createSandbox();
  const pc = player();
  runtime.enterDowned(pc, { sourceKind: "skill" });
  expect(runtime.isDowned(pc)).toBe(true);
  expect(pc.deathSaves).toEqual({ successes: 0, failures: 0 });

  const captain = enemy({ isCaptain: true });
  runtime.enterDowned(captain, { sourceKind: "skill" });
  expect(runtime.isDowned(captain)).toBe(true);

  const minion = enemy();
  const result = runtime.enterDowned(minion, { sourceKind: "skill" });
  expect(result.died).toBe(true);
  expect(runtime.isDead(minion)).toBe(true);
  expect(minion.lifeState).toBe("dead");
});

test("Status damage that causes Downed starts with exactly one Failure", () => {
  const { runtime } = createSandbox();
  const pc = player();
  runtime.enterDowned(pc, { sourceKind: "status" });
  expect(pc.deathSaves.failures).toBe(1);
  expect(pc.deathSaves.successes).toBe(0);
});

test("each damaging Status trigger while Downed causes one Failure and the third is immediate Death", () => {
  const { runtime } = createSandbox();
  const pc = player();
  runtime.enterDowned(pc, { sourceKind: "skill" });
  runtime.addFailure(pc, { reason: "burn_trigger" });
  runtime.addFailure(pc, { reason: "bleed_check" });
  const third = runtime.addFailure(pc, { reason: "burn_trigger" });
  expect(third.death.died).toBe(true);
  expect(runtime.isDead(pc)).toBe(true);
  expect(pc.hp).toBe(0);
});

test("external Heal stabilizes at 0-2 Failures, self/passive healing is zero", () => {
  const { runtime } = createSandbox();
  const pc = player();
  runtime.enterDowned(pc);
  runtime.addFailure(pc);
  runtime.addFailure(pc);

  const regen = runtime.heal(pc, 20, { source: "regen" });
  expect(regen.applied).toBe(0);
  expect(regen.negated).toBe(true);
  expect(pc.hp).toBe(0);
  expect(pc.deathSaves.failures).toBe(2);

  const spell = runtime.heal(pc, 17, { source: "spell" });
  expect(spell.stabilized).toBe(true);
  expect(pc.hp).toBe(17);
  expect(runtime.isDowned(pc)).toBe(false);
  expect(pc.deathSaves).toEqual({ successes: 0, failures: 0 });
});

test("Dead character records are preserved; normal Heal cannot revive but explicit Revival can", () => {
  const { runtime } = createSandbox();
  const pc = player();
  runtime.enterDowned(pc);
  runtime.addFailure(pc);
  runtime.addFailure(pc);
  runtime.addFailure(pc);

  expect(runtime.isDead(pc)).toBe(true);
  expect(pc.deleted).toBe(false);
  expect(runtime.heal(pc, 30, { source: "spell" }).reason).toBe("dead_requires_revival");

  const revived = runtime.heal(pc, 30, { source: "revival", revive: true });
  expect(revived.revived).toBe(true);
  expect(runtime.isDead(pc)).toBe(false);
  expect(pc.hp).toBe(30);
});

test("Sinner changes actual Death to Sinner Death without bypassing Player Death Saves", () => {
  const { runtime } = createSandbox();
  const sinner = player({ traits: [{ id: "sinner" }] });
  runtime.enterDowned(sinner);
  expect(runtime.isDowned(sinner)).toBe(true);
  runtime.addFailure(sinner);
  runtime.addFailure(sinner);
  const result = runtime.addFailure(sinner);
  expect(result.death.deathType).toBe("sinner");
  expect(sinner.sinnerDeath).toBe(true);
  expect(sinner.deleted).toBe(false);
});

test("3 Successes immediately restore 5% Max HP and arm Retreat", () => {
  const { runtime } = createSandbox();
  const pc = player({ maxHp: 201 });
  runtime.enterDowned(pc);
  runtime.addSuccess(pc);
  runtime.addSuccess(pc);
  const result = runtime.addSuccess(pc);
  expect(result.stabilized.resolved).toBe(true);
  expect(pc.hp).toBe(11);
  expect(pc.retreat.pending).toBe(true);
  expect(runtime.isDowned(pc)).toBe(false);
  expect(pc.deathSaves).toEqual({ successes: 0, failures: 0 });
});

test("Retreat snapshots HP/SP, clears normal statuses and clamps negative SP to 0 on return", () => {
  const { runtime } = createSandbox();
  const pc = player({ hp: 5, sp: -20, statusEffects: {
    burn: { id: "burn", count: 2 },
    story_mark: { id: "story_mark", count: 1, data: { persistsThroughRetreat: true } },
  }});
  runtime.grantRetreat(pc);
  const retreated = runtime.resolveRetreat(pc);
  expect(retreated.retreated).toBe(true);
  expect(runtime.isRetreated(pc)).toBe(true);
  const returned = runtime.returnFromRetreat(pc);
  expect(returned.returned).toBe(true);
  expect(pc.hp).toBe(5);
  expect(pc.sp).toBe(0);
  expect(pc.statusEffects.burn).toBeUndefined();
  expect(pc.statusEffects.story_mark).toBeTruthy();
});

test("patched CombatEngine gives only one Failure per multi-hit Skill against an already Downed target", () => {
  const eventTags = [];
  const engine = {
    initializeUnitData() {},
    applyDamage(unit, damage) { unit.hp = Math.max(0, unit.hp - damage); return { hp: unit.hp }; },
    processStatusEffects() {},
    triggerPhase() {},
    triggerEvent(tag) { eventTags.push(tag); },
    calculateAoETargets(skill, primary) { return [primary]; },
    resolveUnilateralWithCounter(attacker, skill, defender) {
      const context = { attacker, defender, skill };
      for (let i = 0; i < 4; i += 1) {
        this.applyDamage(defender, 5, "directo", false, skill);
        this.triggerEvent("[On Hit]", context, [defender]);
      }
      this.triggerEvent("[Attack End]", context, [defender]);
      return {};
    },
  };
  const { runtime } = createSandbox({ combatEngine: engine });
  const pc = player();
  runtime.enterDowned(pc);
  engine.resolveUnilateralWithCounter(enemy(), { id: "multi", type: "Normal" }, pc, null, {});
  expect(pc.deathSaves.failures).toBe(1);
  expect(eventTags.filter((tag) => tag === "[On Kill]")).toHaveLength(0);
});

test("patched Status damage produces one Failure per trigger and passive/status self-heal cannot stand a Downed unit", () => {
  const engine = {
    initializeUnitData() {},
    applyDamage(unit, damage) { unit.hp = Math.max(0, unit.hp - damage); return { hp: unit.hp }; },
    processStatusEffects(unit, trigger) { if (trigger === "regen") unit.hp += 12; },
    triggerPhase() {},
    triggerEvent() {},
    calculateAoETargets(skill, primary) { return [primary]; },
    resolveUnilateralWithCounter() { return {}; },
  };
  const { runtime } = createSandbox({ combatEngine: engine });
  const pc = player();
  runtime.enterDowned(pc);
  engine.applyDamage(pc, 50, "efecto_estado");
  expect(pc.deathSaves.failures).toBe(1);
  engine.processStatusEffects(pc, "regen");
  expect(pc.hp).toBe(0);
  expect(runtime.isDowned(pc)).toBe(true);
});

test("Death Save resolves before Round End and a third Success Retreats in the same Turn End", () => {
  const order = [];
  const engine = {
    initializeUnitData() {},
    applyDamage(unit, damage) { unit.hp = Math.max(0, unit.hp - damage); return { hp: unit.hp }; },
    processStatusEffects() {},
    triggerEvent() {},
    calculateAoETargets(skill, primary) { return [primary]; },
    resolveUnilateralWithCounter() { return {}; },
    triggerPhase(tag) { order.push(`original:${tag}`); },
  };
  const { runtime } = createSandbox({ combatEngine: engine, random: () => 0 });
  const pc = player();
  runtime.enterDowned(pc);
  pc.deathSaves.successes = 2;
  engine.triggerPhase("[Round End]", [pc]);
  expect(order).toEqual(["original:[Round End]"]);
  expect(runtime.isRetreated(pc)).toBe(true);
  expect(pc.retreatSnapshot.hp).toBe(5);
});

test("Status Engine bootstraps the Death Save runtime in the real Battle Viewer load chain", () => {
  expect(statusSource).toContain('script.id = "death-save-runtime-script"');
  expect(statusSource).toContain('script.src = "js/death-save-runtime.js"');
});
