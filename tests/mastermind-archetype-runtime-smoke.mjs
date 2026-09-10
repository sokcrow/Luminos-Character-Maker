import assert from "node:assert/strict";

const g = globalThis;

const normalizeId = (value) => String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
const unitId = (unit = {}) => String(unit.id || unit.unitId || unit.characterId || "");

function rogueLevel(character = {}) {
  const classes = Array.isArray(character.classes) ? character.classes : character.characterBuild?.classes || [];
  const found = classes.find((entry) => normalizeId(entry.id || entry.classId || entry.name) === "rogue");
  return Number(found?.level ?? found?.levels ?? 0);
}

function isMastermind(character = {}) {
  const raw = character.characterBuild?.archetypes || character.archetypes || [];
  return raw.some((entry) => normalizeId(entry.classId) === "rogue" && normalizeId(entry.archetypeId || entry.id) === "mastermind");
}

g.LuminousArchetypeEngine = {
  getClassLevel(character, classId) { return normalizeId(classId) === "rogue" ? rogueLevel(character) : 0; },
  isSelected(character, archetypeId, classId) {
    return normalizeId(archetypeId) === "mastermind" && normalizeId(classId) === "rogue" && isMastermind(character);
  },
  resolveTraitGrants(character, grants = [], definitions = {}, archetypes = {}) {
    if (!isMastermind(character)) return [];
    const level = rogueLevel(character);
    return grants.filter((grant) => level >= Number(grant.atLevel || 0)).map((grant) => ({
      ...clone(definitions[grant.traitId]),
      source: { ...(definitions[grant.traitId]?.source || {}), ...(grant.source || {}) },
    })).filter((trait) => trait.id);
  },
};

g.LuminousRogueClassRuntime = { rogueLevel };

g.LuminousUniversalSpeedRuntime = { effectiveSpeed(unit) { return Number(unit.speed || 0); } };

g.LuminousStatusEngine = {
  ensureStore(unit) {
    if (!unit.statusEffects || typeof unit.statusEffects !== "object" || Array.isArray(unit.statusEffects)) unit.statusEffects = {};
    return unit.statusEffects;
  },
  applyStatus(unit, statusId, input = {}) {
    const store = this.ensureStore(unit);
    const id = normalizeId(statusId);
    const existing = store[id];
    const mode = normalizeId(input.mode || "gain");
    const count = mode === "set" ? Number(input.count || 0) : Number(existing?.count || 0) + Number(input.count ?? 1);
    store[id] = {
      id,
      name: input.name || existing?.name || id,
      count,
      potency: Number(input.potency || 0),
      duration: input.duration || "until_removed",
      sourceTraitId: input.sourceTraitId || existing?.sourceTraitId || null,
      sourceUnitId: input.sourceUnitId || existing?.sourceUnitId || null,
      data: { ...(existing?.data || {}), ...(input.data || {}) },
    };
    return clone(store[id]);
  },
  removeStatus(unit, statusId) {
    const store = this.ensureStore(unit);
    const id = normalizeId(statusId);
    const removed = Boolean(store[id]);
    delete store[id];
    return { removed };
  },
};

g.LuminousArchetypeTraitCatalog = {
  ARCHETYPES: {}, DEFINITIONS: {}, GRANTS: [],
  allArchetypes() { return {}; },
  allDefinitions() { return {}; },
  allGrants() { return []; },
  getDefinition() { return null; },
  resolveTraitGrants() { return []; },
};

g.LuminousTraitCatalogCore = {
  allDefinitions() { return {}; },
  allGrants() { return []; },
  getDefinition() { return null; },
};

g.LuminousTraitEngine = {
  resolveTraitGrants() { return []; },
  normalizeTrait(trait) { return clone(trait); },
};

g.LuminousArchetypeRuntime = { syncArchetypeTraitsForUnit() { return []; } };

const baseResolverCalls = [];
const baseClashes = [];
g.LuminousCombatActionResolver = {
  resolveCombatAction(action, context = {}) {
    baseResolverCalls.push(clone(action));
    const effects = (action.effects || []).map((effect) => {
      if (normalizeId(effect.type) !== "modify_combat_action") return { effect, applied: false };
      const targetAction = context.actionMap?.[effect.targetActionId];
      if (!targetAction) return { effect, applied: false, reason: "target_action_missing" };
      targetAction.modifiers ||= [];
      targetAction.modifiers.push({ type: "final_power", source: "help_final_power", amount: Number(effect.modifier?.amount ?? 1), fromActorId: action.actorId });
      return { effect, applied: true };
    });
    return { resolved: true, action: clone(action), resolution: { resolved: true, type: "automatic", effects } };
  },
  resolvePreparedUnopposed(action) { return { resolved: true, type: "unopposed", action: clone(action), basePrepared: true }; },
  resolveClashPair(action, opposingAction) {
    baseClashes.push([clone(action), clone(opposingAction)]);
    return { resolved: true, type: "clash", winner: "B", actions: [clone(action), clone(opposingAction)], resolvedActionIds: [action.id, opposingAction.id] };
  },
};

await import("../js/mastermind-archetype-runtime.js");
const runtime = g.LuminousMastermindArchetypeRuntime;
assert.ok(runtime, "Mastermind archetype runtime should install");

assert.equal(runtime.ARCHETYPE_ID, "mastermind");
assert.equal(runtime.CLASS_ID, "rogue");
assert.equal(g.LuminousArchetypeTraitCatalog.allArchetypes().mastermind.name, "Mastermind");
assert.equal(g.LuminousArchetypeTraitCatalog.getDefinition("master_of_tactics").name, "Master of Tactics");
assert.match(g.LuminousArchetypeTraitCatalog.getDefinition("soul_of_deceit").description, /thoughts cannot be read/i);

const mastermind = {
  id: "mastermind_unit", name: "Moriarty", side: "allies", speed: 6,
  classes: [{ id: "rogue", level: 65 }],
  characterBuild: { archetypes: [{ classId: "rogue", archetypeId: "mastermind" }] },
};
const slowAlly = { id: "slow_ally", name: "Slow Ally", side: "allies", speed: 2, skills: [{ id: "guard_skill", name: "Guard Skill", coinAmount: 1, basePower: 5 }] };
const middleAlly = { id: "middle_ally", name: "Middle Ally", side: "allies", speed: 4, skills: [{ id: "middle_skill", coinAmount: 1 }] };
const fastAlly = { id: "fast_ally", name: "Fast Ally", side: "allies", speed: 8, skills: [{ id: "fast_skill", coinAmount: 1 }] };
const enemy = { id: "enemy_unit", name: "Enemy", side: "enemies", speed: 5, skills: [{ id: "enemy_skill", coinAmount: 1 }] };
const units = [mastermind, slowAlly, middleAlly, fastAlly, enemy];

assert.equal(runtime.helpAdditionalBonus(mastermind, slowAlly, { units }), 3, "slowest ally gets +3 additional");
assert.equal(runtime.helpAdditionalBonus(mastermind, middleAlly, { units }), 2, "slower non-slowest ally gets +2 additional");
assert.equal(runtime.helpAdditionalBonus(mastermind, fastAlly, { units }), 1, "other ally gets +1 additional");

const helpedAction = { id: "slow_action", actorId: slowAlly.id, state: "planned", resolution: { type: "clash" }, modifiers: [] };
const help = {
  id: "help_action",
  actorId: mastermind.id,
  source: { type: "universal", id: "help" },
  economy: { cost: "action" },
  phase: { selectedAt: "planning_phase_player", executesAt: "planning_phase_player" },
  targeting: { allegiance: "ally", mode: "single", mainTargetId: slowAlly.id, targetIds: [slowAlly.id], attackWeight: 1 },
  resolution: { type: "automatic" },
  effects: [{ type: "modify_combat_action", targetActionId: helpedAction.id, modifier: { amount: 1 } }],
  state: "planned",
};
const helpContext = { units, actionMap: { [helpedAction.id]: helpedAction } };
const helpResult = g.LuminousCombatActionResolver.resolveCombatAction(help, helpContext);
assert.equal(helpResult.resolved, true);
assert.equal(helpResult.action.economy.cost, "quick_action", "Master of Tactics turns Help into Quick Action");
assert.equal(helpedAction.modifiers.at(-1).amount, 4, "normal Help +1 plus slowest Mastermind +3");
assert.equal(helpResult.mastermindMasterOfTactics.additionalHelpFinalPower, 3);
assert.equal(helpResult.mastermindMisdirection.applied, true);

const assistId = runtime.assistGuardStatusId(mastermind);
assert.equal(slowAlly.statusEffects[assistId].count, 1, "Misdirection applies 1 Assist Guard Count");
assert.equal(slowAlly.statusEffects[assistId].name, "Assist Guard - Moriarty");
assert.equal(slowAlly.statusEffects[assistId].data.iconPending, true, "status explicitly remains icon-pending");

const incoming = {
  id: "incoming_unopposed",
  actorId: enemy.id,
  source: { type: "skill", id: "enemy_skill" },
  economy: { cost: "action" },
  phase: { selectedAt: "planning_phase_ai", executesAt: "combat_phase" },
  targeting: { allegiance: "enemy", mode: "single", mainTargetId: mastermind.id, targetIds: [mastermind.id], attackWeight: 1 },
  resolution: { type: "unopposed" },
  resources: [], modifiers: [], effects: [],
  metadata: { sourceDefinition: { id: "enemy_skill", coinAmount: 1, basePower: 5 } },
  state: "planned",
};
const intercept = g.LuminousCombatActionResolver.resolveCombatAction(incoming, { units, actionMap: {} });
assert.equal(intercept.resolved, true);
assert.equal(intercept.type, "clash");
assert.equal(intercept.assistGuard.triggered, true);
assert.equal(intercept.assistGuard.protectedUnitId, mastermind.id);
assert.equal(intercept.assistGuard.guardUnitId, slowAlly.id);
assert.equal(intercept.assistGuard.skillId, "guard_skill");
assert.equal(intercept.assistGuard.countAfter, 0);
assert.equal(slowAlly.statusEffects[assistId], undefined, "Assist Guard consumes 1 Count after interception");
assert.equal(baseClashes.length, 1, "Assist Guard forces a Clash");
assert.equal(baseClashes[0][0].targeting.mainTargetId, slowAlly.id, "incoming attack is redirected to guard");
assert.equal(baseClashes[0][1].actorId, slowAlly.id, "guard provides the opposing Skill");
assert.equal(slowAlly.skills[0].__mastermindAssistGuardUsed, true, "fallback marks intercepted Skill used");

const noGuardDirect = g.LuminousCombatActionResolver.resolveCombatAction({ ...incoming, id: "incoming_no_guard", targeting: { ...incoming.targeting, mainTargetId: middleAlly.id, targetIds: [middleAlly.id] } }, { units, actionMap: {} });
assert.equal(noGuardDirect.resolved, true);
assert.equal(noGuardDirect.assistGuard, undefined, "without matching Assist Guard the attack follows normal resolver");
assert.ok(baseResolverCalls.some((entry) => entry.id === "incoming_no_guard"));

const level15 = {
  id: "level15", name: "Junior", side: "allies", speed: 5,
  classes: [{ id: "rogue", level: 15 }],
  characterBuild: { archetypes: [{ classId: "rogue", archetypeId: "mastermind" }] },
};
const juniorTarget = { id: "junior_target", side: "allies", speed: 3, skills: [] };
const juniorAction = { id: "junior_action", actorId: juniorTarget.id, state: "planned", resolution: { type: "clash" }, modifiers: [] };
const juniorHelp = { ...clone(help), id: "junior_help", actorId: level15.id, effects: [{ type: "modify_combat_action", targetActionId: juniorAction.id, modifier: { amount: 1 } }] };
const juniorResult = g.LuminousCombatActionResolver.resolveCombatAction(juniorHelp, { units: [level15, juniorTarget], actionMap: { [juniorAction.id]: juniorAction } });
assert.equal(juniorResult.action.economy.cost, "quick_action");
assert.equal(juniorResult.mastermindMisdirection, undefined, "Misdirection is not active before Rogue 65");

const traits85 = g.LuminousArchetypeTraitCatalog.resolveTraitGrants({
  id: "level85",
  classes: [{ id: "rogue", level: 85 }],
  characterBuild: { archetypes: [{ classId: "rogue", archetypeId: "mastermind" }] },
});
assert.deepEqual(traits85.map((trait) => trait.id).sort(), ["insightful_manipulator", "master_of_intrigue", "master_of_tactics", "misdirection", "soul_of_deceit"].sort());

console.log("Mastermind archetype Theatre/Combat smoke passed.");
