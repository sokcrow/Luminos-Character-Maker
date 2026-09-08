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

function mastermind(level, extra = {}) {
  return {
    id: `mastermind_${level}`,
    name: `Mastermind ${level}`,
    side: "allies",
    speed: 6,
    level,
    stats: { inteligencia: 14, sabiduria: 12, carisma: 16 },
    classes: [{ id: "rogue", level }],
    characterBuild: { archetypes: [{ classId: "rogue", archetypeId: "mastermind" }] },
    statusEffects: {},
    ...extra,
  };
}

g.LuminousArchetypeEngine = {
  getClassLevel(character, classId) { return normalizeId(classId) === "rogue" ? rogueLevel(character) : 0; },
  isSelected(character, archetypeId, classId) {
    return normalizeId(archetypeId) === "mastermind" && normalizeId(classId) === "rogue" && isMastermind(character);
  },
  resolveTraitGrants(character, grants = [], definitions = {}) {
    if (!isMastermind(character)) return [];
    const level = rogueLevel(character);
    return grants.filter((grant) => level >= Number(grant.atLevel || 0)).map((grant) => {
      const definition = clone(definitions[grant.traitId]);
      if (!definition) return null;
      definition.source = { ...(definition.source || {}), ...(grant.source || {}) };
      return definition;
    }).filter(Boolean);
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
  resolveTheatreCheck(input = {}) { return { check: { ...(input.check || {}) }, state: input.state || {}, outcomes: [] }; },
};

g.LuminousArchetypeRuntime = { syncArchetypeTraitsForUnit() { return []; } };

const baseClashes = [];
const baseResolverCalls = [];
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
  resolvePreparedUnopposed(action) { return { resolved: true, type: "unopposed", action: clone(action) }; },
  resolveClashPair(action, opposingAction) {
    baseClashes.push([clone(action), clone(opposingAction)]);
    return { resolved: true, type: "clash", winner: "B", actions: [clone(action), clone(opposingAction)], resolvedActionIds: [action.id, opposingAction.id] };
  },
};

g.datosJugador = mastermind(85);
g.LuminousPlayerTraitRuntime = {
  getCharacter() { return g.datosJugador; },
  getTraits() { return g.LuminousArchetypeTraitCatalog.resolveTraitGrants(g.datosJugador); },
  resolveTheatreCheck(check = {}, runtimeInput = {}) {
    return g.LuminousTraitEngine.resolveTheatreCheck({
      character: g.datosJugador,
      traits: this.getTraits(),
      check: { ...(check || {}) },
      state: {},
      target: runtimeInput.target || null,
      context: "theatre",
    });
  },
};

await import("../js/mastermind-archetype-runtime.js");
await import("../js/mastermind-theatre-runtime.js");

const runtime = g.LuminousMastermindArchetypeRuntime;
const theatre = g.LuminousMastermindTheatreRuntime;
assert.ok(runtime, "Mastermind base runtime should install");
assert.ok(theatre, "Mastermind Theatre runtime should install");

// Trait grant progression is the source of truth for both surfaces.
const expectedByLevel = new Map([
  [14, []],
  [15, ["master_of_intrigue", "master_of_tactics"]],
  [45, ["master_of_intrigue", "master_of_tactics", "insightful_manipulator"]],
  [65, ["master_of_intrigue", "master_of_tactics", "insightful_manipulator", "misdirection"]],
  [85, ["master_of_intrigue", "master_of_tactics", "insightful_manipulator", "misdirection", "soul_of_deceit"]],
]);
for (const [level, expected] of expectedByLevel) {
  const character = mastermind(level);
  const granted = g.LuminousArchetypeTraitCatalog.resolveTraitGrants(character).map((trait) => trait.id).sort();
  assert.deepEqual(granted, [...expected].sort(), `Mastermind level ${level} grant progression`);
}

// Archetype runtime sync places the same granted Traits on the live unit used by Theatre/Combat.
const synced = mastermind(85);
g.LuminousArchetypeRuntime.syncArchetypeTraitsForUnit(synced);
assert.deepEqual(
  synced.traitDefinitions.map((trait) => trait.id).sort(),
  [...expectedByLevel.get(85)].sort(),
  "live unit traitDefinitions should contain all granted Mastermind Traits",
);

// Master of Intrigue: fixed proficiencies, stored choices, languages, and 1-minute mimic capability.
const intrigue = mastermind(15);
const choiceResult = theatre.applyMasterOfIntrigueChoices(intrigue, { gamingSet: "dragon_chess", languages: ["elvish", "infernal"] });
assert.equal(choiceResult.applied, true);
assert.equal(intrigue.toolProficiencies.disguise_kit, "proficient");
assert.equal(intrigue.toolProficiencies.forgery_kit, "proficient");
assert.equal(intrigue.toolProficiencies.dragon_chess, "proficient");
assert.equal(intrigue.languages.elvish.porcentaje, 100);
assert.equal(intrigue.languages.infernal.porcentaje, 100);
assert.equal(theatre.canMimicSpeech(intrigue, 0.99), false);
assert.equal(theatre.canMimicSpeech(intrigue, 1), true);
const mimicCheck = g.LuminousTraitEngine.resolveTheatreCheck({
  character: intrigue,
  traits: g.LuminousArchetypeTraitCatalog.resolveTraitGrants(intrigue),
  check: { tags: ["mimic_speech"], observedMinutes: 1 },
  state: {},
});
assert.equal(mimicCheck.check.mastermindMimicSpeech.available, true);
assert.ok(mimicCheck.outcomes.some((entry) => entry.traitId === "master_of_intrigue"));

// Insightful Manipulator: Theatre observation resolves concrete superior/equal/inferior comparisons.
const observer = mastermind(45, { stats: { inteligencia: 14, sabiduria: 12, carisma: 16 } });
const observed = {
  id: "observed_target",
  level: 60,
  stats: { inteligencia: 18, sabiduria: 12, carisma: 10 },
  classes: [{ id: "fighter", level: 60 }],
};
const assessment = theatre.assessCreature(observer, observed, { observedMinutes: 1, fields: ["int", "wis", "cha", "experience"], context: "theatre" });
assert.equal(assessment.available, true);
assert.equal(assessment.results.int.relation, "superior");
assert.equal(assessment.results.wis.relation, "equal");
assert.equal(assessment.results.cha.relation, "inferior");
assert.equal(assessment.results.experience.relation, "superior");
assert.equal(theatre.assessCreature(observer, observed, { observedMinutes: 1, context: "combat" }).available, false);
const assessmentCheck = g.LuminousTraitEngine.resolveTheatreCheck({
  character: observer,
  traits: g.LuminousArchetypeTraitCatalog.resolveTraitGrants(observer),
  check: { tags: ["assess_creature"], observedMinutes: 1, target: observed, assessmentFields: ["int", "cha"] },
  state: {},
});
assert.equal(assessmentCheck.check.mastermindAssessment.available, true);
assert.equal(assessmentCheck.check.mastermindAssessment.results.int.relation, "superior");

// Soul of Deceit: incoming Theatre effects are altered through the live Player Trait bridge.
const soul = mastermind(85);
g.datosJugador = { id: "reader", name: "Reader", level: 20, classes: [{ id: "wizard", level: 20 }] };
const blockedRead = g.LuminousPlayerTraitRuntime.resolveTheatreCheck(
  { tags: ["mind_reading"] },
  { target: soul },
);
assert.equal(blockedRead.check.blocked, true);
assert.equal(blockedRead.check.blockedByTrait, "soul_of_deceit");
assert.ok(blockedRead.outcomes.some((entry) => entry.traitId === "soul_of_deceit" && entry.blocked === true));
theatre.setSoulOfDeceitPreferences(soul, { allowMindReading: true, presentFalseThoughts: true, appearTruthful: true });
const allowedRead = g.LuminousPlayerTraitRuntime.resolveTheatreCheck(
  { tags: ["mind_reading"] },
  { target: soul },
);
assert.equal(allowedRead.check.blocked, undefined);
assert.equal(allowedRead.check.soulOfDeceit.blocked, false);
assert.equal(allowedRead.check.soulOfDeceit.presentFalseThoughts, true);
const truthCheck = g.LuminousPlayerTraitRuntime.resolveTheatreCheck(
  { tags: ["truth_detection"] },
  { target: soul },
);
assert.equal(truthCheck.check.truthDetectionResult, "truthful");

// Combat: Master of Tactics modifies real Help, then Misdirection produces Assist Guard.
g.datosJugador = mastermind(85);
const mastermindUnit = mastermind(65, { id: "mastermind_unit", name: "Moriarty", speed: 6 });
const guard = { id: "guard", name: "Guard", side: "allies", speed: 2, statusEffects: {}, skills: [{ id: "guard_skill", name: "Guard Skill", coinAmount: 1, basePower: 5 }] };
const middle = { id: "middle", name: "Middle", side: "allies", speed: 4, statusEffects: {}, skills: [{ id: "middle_skill", coinAmount: 1 }] };
const enemy = { id: "enemy", name: "Enemy", side: "enemies", speed: 5, statusEffects: {}, skills: [{ id: "enemy_skill", coinAmount: 1 }] };
const units = [mastermindUnit, guard, middle, enemy];
const helpedAction = { id: "guard_action", actorId: guard.id, state: "planned", resolution: { type: "clash" }, modifiers: [] };
const helpAction = {
  id: "mastermind_help",
  actorId: mastermindUnit.id,
  source: { type: "universal", id: "help" },
  economy: { cost: "action" },
  phase: { selectedAt: "planning_phase_player", executesAt: "planning_phase_player" },
  targeting: { allegiance: "ally", mode: "single", mainTargetId: guard.id, targetIds: [guard.id], attackWeight: 1 },
  resolution: { type: "automatic" },
  effects: [{ type: "modify_combat_action", targetActionId: helpedAction.id, modifier: { amount: 1 } }],
  state: "planned",
};
const helpResult = g.LuminousCombatActionResolver.resolveCombatAction(helpAction, { units, actionMap: { [helpedAction.id]: helpedAction } });
assert.equal(helpResult.resolved, true);
assert.equal(helpResult.action.economy.cost, "quick_action", "Master of Tactics must use Quick Action");
assert.equal(helpedAction.modifiers.at(-1).amount, 4, "slowest ally receives base Help + Mastermind +3");
assert.equal(helpResult.mastermindMisdirection.applied, true);
const assistId = runtime.assistGuardStatusId(mastermindUnit);
assert.equal(guard.statusEffects[assistId].count, 1, "Misdirection grants Assist Guard after Help");

// Combat: that status must cross the unopposed resolver and become a forced Clash.
const incoming = {
  id: "incoming_unopposed",
  actorId: enemy.id,
  source: { type: "skill", id: "enemy_skill" },
  economy: { cost: "action" },
  phase: { selectedAt: "planning_phase_ai", executesAt: "combat_phase" },
  targeting: { allegiance: "enemy", mode: "single", mainTargetId: mastermindUnit.id, targetIds: [mastermindUnit.id], attackWeight: 1 },
  resolution: { type: "unopposed" },
  resources: [], modifiers: [], effects: [],
  metadata: { sourceDefinition: { id: "enemy_skill", coinAmount: 1, basePower: 5 } },
  state: "planned",
};
const intercepted = g.LuminousCombatActionResolver.resolveCombatAction(incoming, { units, actionMap: {} });
assert.equal(intercepted.resolved, true);
assert.equal(intercepted.type, "clash");
assert.equal(intercepted.assistGuard.triggered, true);
assert.equal(intercepted.assistGuard.protectedUnitId, mastermindUnit.id);
assert.equal(intercepted.assistGuard.guardUnitId, guard.id);
assert.equal(intercepted.assistGuard.countAfter, 0);
assert.equal(guard.statusEffects[assistId], undefined);
assert.equal(baseClashes.length, 1);

// A non-Mastermind must not receive the subclass grants or effects.
const plainRogue = { id: "plain", side: "allies", speed: 5, classes: [{ id: "rogue", level: 85 }], characterBuild: { archetypes: [] }, statusEffects: {} };
assert.deepEqual(g.LuminousArchetypeTraitCatalog.resolveTraitGrants(plainRogue), []);
assert.equal(theatre.canMimicSpeech(plainRogue, 10), false);

console.log("Mastermind Trait -> Theatre/Combat bridge smoke passed.");
