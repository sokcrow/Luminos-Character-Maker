const assert = require('assert');

function freshRuntime() {
  delete global.LuminousRacialSkillRuntime;
  delete require.cache[require.resolve('../js/racial-skill-runtime.js')];
  return require('../js/racial-skill-runtime.js');
}

function unit(raceId, subtypeId, options = {}) {
  return {
    id: options.id || raceId,
    level: options.level ?? 1,
    stats: {
      fuerza: options.str ?? 10,
      destreza: options.dex ?? 10,
      constitucion: options.con ?? 10,
    },
    characterBuild: {
      raceId,
      ...(subtypeId ? { raceSubtypeId: subtypeId } : {}),
      ...(options.sin ? { naturalWeaponSin: options.sin } : {}),
    },
    ...(options.npc ? { isPlayer: false, faction: 'enemy' } : { isPlayer: true, playerId: 'player-1' }),
  };
}

(function run() {
  const runtime = freshRuntime();

  assert.deepStrictEqual(runtime.SIN_TYPES, ['Wrath', 'Lust', 'Sloth', 'Gluttony', 'Gloom', 'Pride', 'Envy']);
  assert.strictEqual(runtime.statusAmount(unit('lanae', null, { level: 1 })), 1);
  assert.strictEqual(runtime.statusAmount(unit('lanae', null, { level: 9 })), 1);
  assert.strictEqual(runtime.statusAmount(unit('lanae', null, { level: 10 })), 2);
  assert.strictEqual(runtime.statusAmount(unit('lanae', null, { level: 20 })), 4);

  const lizalin = runtime.buildNaturalWeaponSkill(unit('lizalin', null, { level: 20, str: 16, sin: 'Wrath' }));
  assert.strictEqual(lizalin.coinAmount, 1);
  assert.strictEqual(lizalin.coinType, 'standard');
  assert.strictEqual(lizalin.attackType, 'Pierce');
  assert.strictEqual(lizalin.sinAffinity, 'Wrath');
  assert.strictEqual(lizalin.affinity, 'Wrath');
  assert.strictEqual(lizalin.damageType, 'Pierce');
  assert.strictEqual(lizalin.basePower, 5); // PB 1 + STR 3 + floor(20/20) 1
  assert.strictEqual(lizalin.coinPower, 19); // 15 + STR 3 + 1
  assert.strictEqual(lizalin.racialStatusOnHit.statusId, 'ruptured');

  const felinae = runtime.buildNaturalWeaponSkill(unit('felinae', 'ordinary', { level: 1, str: 12, dex: 18, sin: 'Pride' }));
  assert.strictEqual(felinae.statUsed, 'DEX');
  assert.strictEqual(felinae.coinPower, 19); // 15 + DEX 4
  assert.strictEqual(felinae.racialStatusOnHit.statusId, 'bleed');

  const felinaeLarge = runtime.buildNaturalWeaponSkill(unit('felinae', 'large', { level: 1, str: 12, dex: 18, sin: 'Pride' }));
  assert.strictEqual(felinaeLarge.coinPower, 23); // 19 + DEX 4
  assert.strictEqual(felinaeLarge.racialPowerFormula.coinPower, '19 + StatMod + floor(Level / 20)');

  const lupae = runtime.buildNaturalWeaponSkill(unit('lupae', null, { str: 14, sin: 'Gloom' }));
  assert.strictEqual(lupae.attackType, 'Pierce');
  assert.strictEqual(lupae.racialStatusOnHit.statusId, 'ruptured');

  const centaur = runtime.buildNaturalWeaponSkill(unit('centaur', null, { str: 14, sin: 'Sloth' }));
  assert.strictEqual(centaur.attackType, 'Blunt');
  assert.strictEqual(centaur.racialStatusOnHit.statusId, 'tremor');

  const lanae = runtime.buildNaturalWeaponSkill(unit('lanae', null, { str: 14, sin: 'Envy' }));
  assert.strictEqual(lanae.attackType, 'Blunt');
  assert.strictEqual(lanae.racialStatusOnHit.statusId, 'tremor');

  const warforged = runtime.buildNaturalWeaponSkill(unit('warforged', 'juggernaut', { str: 16, sin: 'Wrath' }));
  assert.strictEqual(warforged.racialSkillKind, 'body_weapon');
  assert.strictEqual(warforged.bodyWeapon, 'iron_fists');
  assert.strictEqual(warforged.racialStatusOnHit.statusId, 'tremor');
  assert.strictEqual(runtime.buildNaturalWeaponSkill(unit('warforged', 'envoy', { sin: 'Wrath' })), null);
  const noSinPc = runtime.buildNaturalWeaponSkill(unit('lanae', null, {}));
  assert.strictEqual(noSinPc.requiresSinSelection, true);
  assert.strictEqual(noSinPc.sinAffinity, null);

  const expectedBreaths = {
    red: ['fire', 'Wrath', 'burn'],
    black: ['acid', 'Gluttony', 'corrosion'],
    green: ['poison', 'Gluttony', 'poison'],
    white: ['cold', 'Gloom', 'chill'],
    blue: ['lightning', 'Envy', 'shock'],
    gold: ['radiant', 'Pride', 'radiance'],
    brass: ['fire', 'Wrath', 'burn'],
    copper: ['acid', 'Gluttony', 'corrosion'],
    bronze: ['lightning', 'Envy', 'shock'],
    silver: ['cold', 'Gloom', 'chill'],
  };
  for (const [subtype, [element, sin, status]] of Object.entries(expectedBreaths)) {
    const breath = runtime.buildBreathWeaponSkill(unit('half_dragon', subtype, { level: 20, con: 16 }));
    assert.ok(breath, subtype);
    assert.strictEqual(breath.coinAmount, 1, subtype);
    assert.strictEqual(breath.coinType, 'unbreakable', subtype);
    assert.strictEqual(breath.statUsed, 'CON', subtype);
    assert.strictEqual(breath.breathElement, element, subtype);
    assert.strictEqual(breath.sinAffinity, sin, subtype);
    assert.strictEqual(breath.racialStatusOnHit.statusId, status, subtype);
    assert.strictEqual(breath.basePower, 5, subtype);
    assert.strictEqual(breath.coinPower, 19, subtype);
  }

  // Gold is always Radiance in this racial skill; never Burn.
  const gold = runtime.buildBreathWeaponSkill(unit('half_dragon', 'gold', { con: 16 }));
  assert.strictEqual(gold.damageType, 'radiant');
  assert.strictEqual(gold.sinAffinity, 'Pride');
  assert.strictEqual(gold.racialStatusOnHit.statusId, 'radiance');

  // General Breath infrastructure still covers all agreed mappings.
  assert.strictEqual(runtime.ELEMENTS.necrotic.statusId, 'decay');
  assert.strictEqual(runtime.ELEMENTS.psychic.statusId, 'sinking');
  assert.strictEqual(runtime.ELEMENTS.thunder.statusId, 'tremor');
  assert.strictEqual(runtime.ELEMENTS.force.statusId, 'force');

  // PC choice is persistent and never rerolled at Encounter Start.
  const pc = unit('felinae', 'ordinary', { sin: 'Lust' });
  runtime.prepareEncounter([pc], { rng: () => 0.99, engine: null });
  assert.strictEqual(pc.attack_tier_1_sequence[0].sinAffinity, 'Lust');
  assert.strictEqual(pc.__racialSkillEncounterSin, undefined);

  // NPC rolls exactly on Encounter Start, then keeps that Sin until the next start.
  const npc = unit('lupae', null, { npc: true });
  runtime.prepareEncounter([npc], { rng: () => 0.0, engine: null });
  assert.strictEqual(npc.__racialSkillEncounterSin, 'Wrath');
  assert.strictEqual(npc.attack_tier_1_sequence[0].sinAffinity, 'Wrath');
  runtime.refreshRacialSkills(npc, null);
  assert.strictEqual(npc.attack_tier_1_sequence[0].sinAffinity, 'Wrath');
  runtime.prepareEncounter([npc], { rng: () => 0.999, engine: null });
  assert.strictEqual(npc.__racialSkillEncounterSin, 'Envy');
  assert.strictEqual(npc.attack_tier_1_sequence[0].sinAffinity, 'Envy');

  // Racial On Hit uses the canonical Status Engine; double statuses receive Potency, single statuses Count.
  const applied = [];
  global.LuminousStatusEngine = {
    applyStatus(target, statusId, input) {
      applied.push({ target, statusId, input });
      return { id: statusId, ...input };
    },
  };
  const target = { id: 'target' };
  runtime.applyRacialOnHit({ attacker: unit('felinae', 'ordinary', { level: 15, sin: 'Wrath' }), skill: runtime.buildNaturalWeaponSkill(unit('felinae', 'ordinary', { level: 15, sin: 'Wrath' })) }, [target]);
  assert.strictEqual(applied[0].statusId, 'bleed');
  assert.strictEqual(applied[0].input.potency, 3);

  const coldAttacker = unit('half_dragon', 'white', { level: 15, con: 14 });
  runtime.applyRacialOnHit({ attacker: coldAttacker, skill: runtime.buildBreathWeaponSkill(coldAttacker) }, [target]);
  assert.strictEqual(applied[1].statusId, 'chill');
  assert.strictEqual(applied[1].input.count, 3);

  // Combat bridge attaches before the engine initializer, rerolls NPC Sin at Encounter Start, and applies On Hit Statuses.
  const bridgeNpc = unit('centaur', null, { npc: true, level: 10, str: 14 });
  let initializeSawSkill = false;
  let encounterCalls = 0;
  let eventCalls = 0;
  global.CombatEngine = {
    createSkill(config) { return { ...config, coins: [{ type: config.coinType, status: 'active', effects: [] }] }; },
    initializeUnitData(received) { initializeSawSkill = received.attack_tier_1_sequence?.some(skill => skill.racialSkillKey === 'centaur_hooves'); },
    triggerEncounterStart() { encounterCalls += 1; },
    triggerEvent() { eventCalls += 1; },
  };
  runtime.installCombatBridge();
  global.CombatEngine.initializeUnitData(bridgeNpc);
  assert.strictEqual(initializeSawSkill, true);
  const oldRandom = Math.random;
  Math.random = () => 0;
  global.CombatEngine.triggerEncounterStart([bridgeNpc]);
  Math.random = oldRandom;
  assert.strictEqual(encounterCalls, 1);
  assert.strictEqual(bridgeNpc.__racialSkillEncounterSin, 'Wrath');
  const beforeBridgeHit = applied.length;
  global.CombatEngine.triggerEvent('[On Hit]', { attacker: bridgeNpc, skill: bridgeNpc.attack_tier_1_sequence[0], targetsHit: [target] }, [target]);
  assert.strictEqual(eventCalls, 1);
  assert.strictEqual(applied.length, beforeBridgeHit + 1);
  assert.strictEqual(applied.at(-1).statusId, 'tremor');
  assert.strictEqual(applied.at(-1).input.potency, 2);

  // Re-attaching never duplicates the racial skill.
  const repeated = unit('lanae', null, { sin: 'Wrath' });
  runtime.attachRacialSkills(repeated, null);
  runtime.attachRacialSkills(repeated, null);
  assert.strictEqual(repeated.attack_tier_1_sequence.length, 1);

  console.log('racial_skill_runtime.spec.js: all assertions passed');
})();
