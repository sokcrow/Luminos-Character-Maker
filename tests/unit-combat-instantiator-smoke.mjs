import assert from 'node:assert/strict';
import fs from 'node:fs';

await import('../js/unit-rank-runtime.js');
await import('../js/universal-ranged-ammo-runtime.js');
await import('../js/creature-type-catalog.js');
await import('../js/goblin-unit-runtime.js');
await import('../js/skill-catalog-goblin-tier1.js');
await import('../js/unit-catalog-goblin.js');
await import('../js/unit-combat-instantiator.js');

const instantiator = globalThis.LuminousUnitCombatInstantiator;
const goblins = globalThis.LuminousGoblinUnitCatalog;
assert.ok(instantiator, 'Unit Combat Instantiator must initialize');
assert.ok(goblins, 'Goblin catalog must initialize');

const goblinDefinition = goblins.get('goblin');
const goblin = instantiator.instantiate('goblin', goblinDefinition, {
  faction: 'enemy', combatId: 'enemy:unit:goblin:smoke', level: 2, rank: 'normal'
});
assert.equal(goblin.libraryUnitId, 'goblin');
assert.equal(goblin.faction, 'enemy');
assert.ok(goblin.maxHp > 1, 'canonical Goblin HP must be resolved before FIELD deployment');
assert.equal(goblin.hp, goblin.maxHp);
assert.ok(goblin.skillIds.length >= 6, 'canonical Goblin must deploy with its Tier 1/2 Skill loadout');
assert.ok(goblin.skillIds.includes('goblin_scimitar_slash'));
assert.ok(goblin.skillIds.includes('goblin_shortbow_shot'));
assert.equal(goblin.runtimeDiagnostics.catalogResolved, true);
assert.deepEqual(goblin.speedRange, [1, 6], 'pending canonical Goblin Speed must use the explicit runtime fallback rather than zero');
assert.equal(goblin.runtimeDiagnostics.speedFallback, true);

const customDefinition = {
  name: 'Field Test Custom Unit',
  isPlayer: false,
  visual: {
    spriteUrl: 'https://example.invalid/custom-unit.png',
    spriteX: 14,
    spriteY: -9,
    scale: 1.35
  },
  action_slots: ['custom_cut', 'custom_guard'],
  mechanics: {
    hp: 37,
    sp: 5,
    speed: '2-4',
    actionSlots: 2,
    stagger: '75%,50%,25%'
  }
};
const custom = instantiator.instantiate('unit_123456', customDefinition, {
  faction: 'enemy', combatId: 'enemy:unit:unit_123456:smoke'
});
assert.equal(custom.maxHp, 37, 'DM Creator mechanics.hp must become FIELD maxHp');
assert.equal(custom.hp, 37);
assert.equal(custom.sp, 5);
assert.deepEqual(custom.speedRange, [2, 4], 'DM Creator mechanics.speed range must become authoritative Speed range');
assert.equal(custom.speedMin, 2);
assert.equal(custom.speedMax, 4);
assert.equal(custom.actionSlots, 2);
assert.deepEqual(custom.skillIds, ['custom_cut', 'custom_guard']);
assert.equal(custom.combatSprite, 'https://example.invalid/custom-unit.png');
assert.equal(custom.spriteX, 14);
assert.equal(custom.spriteY, -9);
assert.equal(custom.scale, 1.35);
assert.equal(custom.runtimeDiagnostics.catalogResolved, false, 'custom Units must not require a hardcoded species catalog');
assert.equal(custom.runtimeDiagnostics.speedFallback, false);

const creatorSource = fs.readFileSync('dm-combat-creator.html', 'utf8');
assert.ok(creatorSource.includes("db.ref('campaña/base_datos_unidades/' + id).set(unitPayload)"), 'DM Combat Creator must keep saving Units into the canonical Unit Library');
assert.ok(creatorSource.includes('visual: currentState.visual'), 'DM Combat Creator must persist authored sprite/transform data');
assert.ok(creatorSource.includes('action_slots: unitActionSlots'), 'DM Combat Creator must persist linked Skill IDs with the Unit');
assert.ok(creatorSource.includes('unitPayload.mechanics = {'), 'DM Combat Creator must persist combat mechanics for custom Units');

const setupSource = fs.readFileSync('js/combat-v073-dm-setup.js', 'utf8');
assert.ok(setupSource.includes("units: 'campaña/base_datos_unidades'"), 'Encounter Setup must read the same canonical Unit Library used by the DM Creator');
assert.ok(setupSource.includes("subscribe(ROOTS.units, 'units')"), 'new Firebase Units must enter the Encounter selector through its realtime Unit subscription');

const syncSource = fs.readFileSync('js/combat-unit-library-sync.js', 'utf8');
assert.ok(syncSource.includes("'js/skill-catalog-goblin-tier1.js'"), 'live Unit Library sync must load Goblin Skill catalog');
assert.ok(syncSource.includes('goblins.firebaseSkillPayload(schema)'), 'live Unit Library sync must materialize Goblin Skills');
assert.ok(syncSource.includes('canonicalUpgradeNeeded'), 'auto-sync must retain canonical-vs-custom discrimination');
assert.match(syncSource, /existing\?\.metadata\?\.canonicalUnit\s*!==\s*true/, 'custom Firebase Units must not be treated as canonical auto-upgrade candidates');
assert.ok(syncSource.includes("'js/unit-combat-instantiator.js'"), 'live Unit Library path must load the universal instantiator');
assert.ok(syncSource.includes("'js/combat-v073-unit-deploy-bridge.js'"), 'live Unit Library path must install the FIELD deployment bridge');

const bridgeSource = fs.readFileSync('js/combat-v073-unit-deploy-bridge.js', 'utf8');
assert.ok(bridgeSource.includes("'#c073-enemy,#c073-ally'"), 'DM ENEMY/ALLY controls must route through the new bridge');
assert.ok(bridgeSource.includes("ref('campaña/combate/combatants').update(updates)"), 'instantiated Units must enter the canonical FIELD roster');
assert.ok(!bridgeSource.includes('combatEngine.js'), 'Unit deployment bridge must not revive legacy CombatEngine');

console.log('Unit Combat Instantiator smoke: OK');
