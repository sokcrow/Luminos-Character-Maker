import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
await import('../js/combat-skill-schema.js');
await import('../js/movement-speed-runtime.js');
await import('../js/unit-loot-profile-contract.js');
await import('../js/skill-catalog-cave-sapphire-spiders.js');
await import('../js/unit-catalog-cave-sapphire-spiders.js');
await import('../js/unit-combat-instantiator.js');
await import('../js/cave-sapphire-spider-runtime.js');

const schema = globalThis.CombatSkillSchema;
const units = globalThis.LuminousCaveSapphireSpiderUnitCatalog;
const skills = globalThis.LuminousCaveSapphireSpiderSkillCatalog;
const loot = globalThis.LuminousUnitLootProfileContract;
const runtime = globalThis.LuminousCaveSapphireSpiderRuntime;
const instantiator = globalThis.LuminousUnitCombatInstantiator;
const spritePath = 'Assets/Images/Units/Cave_Crystal/sapphire_spider.png';
const spriteFile = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', spritePath);
assert.ok(fs.existsSync(spriteFile), 'Unit sprite must be a real file in the repository Units folder');
const rendered = fs.readFileSync(spriteFile);
assert.ok(rendered.length > 20000, 'Sprite must be a full-resolution repository asset');
if (spritePath.endsWith('.png')) assert.equal(rendered.toString('hex', 0, 8), '89504e470d0a1a0a');
else if (spritePath.endsWith('.jpg')) assert.equal(rendered.toString('hex', 0, 2), 'ffd8');
else if (spritePath.endsWith('.webp')) assert.equal(rendered.toString('ascii', 0, 4), 'RIFF');
const payload = skills.firebasePayload(schema);
assert.equal(Object.keys(payload).length, 7);

const spider = units.resolve('sapphire_spider', {level:30});
const spiderling = units.resolve('sapphire_spiderling', {level:30});
assert.equal(spider.size,'large');
assert.equal(spiderling.size,'medium');
assert.equal(spider.maxHp,93);
assert.equal(spiderling.maxHp,66);
assert.deepEqual(spider.speedRange,[1,8]);
assert.deepEqual(spiderling.speedRange,[1,7]);
assert.deepEqual([spider.offensiveLevel,spider.defensiveLevel],[32,28]);
assert.deepEqual([spiderling.offensiveLevel,spiderling.defensiveLevel],[29,29]);
assert.equal(spider.visual.spriteUrl,spiderling.visual.spriteUrl);
assert.equal(spider.visual.spriteUrl, spritePath);
assert.ok(!spider.visual.spriteUrl.startsWith('data:'), 'Unit sprites must point to repository image files');
assert.equal(spider.resolvedSkills.length,4);
assert.equal(spiderling.resolvedSkills.length,3);
assert.ok(!skills.loadout('sapphire_spiderling').some(id=>id.includes('brood_fang')),
  'Spiderling must have only the two approved attacks and Evade');
assert.ok(spider.resolvedSkills.some(x=>x.name==='Hunter\'s Sting'));
assert.equal(spiderling.resolvedSkills.filter(x=>x.isDefense).length,1);
for(const unit of [spider,spiderling]){
  assert.equal(loot.validateUnit(unit).valid,true);
  assert.equal(unit.bodyProfile.kind,'mineral');
  assert.deepEqual(unit.bodyProfile.materials,['stone','crystal']);
  assert.equal(unit.bodyProfile.edible,false);
  assert.equal(unit.lootProfile.harvest.source,'body_profile');
  assert.ok(unit.bodyProfile.resources.every(x=>['hard_parts','hard_cover_modular','hard_cover_structural'].includes(x.integrityFamily)));
  assert.ok(unit.bodyProfile.resources.every(x=>['stone','crystal'].includes(x.sourceMaterial)));
  assert.equal(unit.lootProfile.currency,null);
  const instantiated=instantiator.normalizeDefinition(unit.id,units.get(unit.id),{level:30});
  assert.equal(instantiated.runtimeDiagnostics.catalogResolved,true);
  assert.equal(instantiated.runtimeDiagnostics.missingSprite,false);
  assert.equal(instantiated.maxHp,unit.maxHp);
}

const attacker={id:'actor',libraryUnitId:'sapphire_spider',speed:8,statusEffects:{poise:{potency:7,count:6}}};
const victim={id:'victim',speed:5,statusEffects:{bind:{count:1},restrained:{count:1}}};
assert.equal(runtime.speedDamagePercent(attacker,victim),15);
assert.equal(runtime.speedDamagePercent({...attacker,speed:11},victim),20);
assert.equal(runtime.speedDamagePercent({...attacker,speed:2},victim),0);
assert.equal(runtime.evadeBonus(attacker,{data:{id:'sapphire_spider_faceted_evasion'}}),2);
assert.equal(runtime.criticalDamageBonus(attacker,victim,{id:'sapphire_spider_hunters_sting',currentCoinIndex:2}),.2);
assert.equal(runtime.criticalDamageBonus(attacker,victim,{id:'sapphire_spider_hunters_sting',currentCoinIndex:1}),0);

const juvenile={id:'juvenile',libraryUnitId:'sapphire_spiderling',speed:7,statusEffects:{poise:{potency:10,count:4}}};
assert.equal(runtime.speedDamagePercent(juvenile,{speed:1}),10);
assert.equal(runtime.evadeBonus(juvenile,{data:{id:'sapphire_spiderling_skittering_evasion'}}),2);
const statuses=[];
assert.equal(runtime.hasteOnTurnStart(juvenile,(...args)=>statuses.push(args)),2);
assert.equal(statuses[0][1],'haste');
assert.equal(runtime.hasteOnTurnStart(attacker,(...args)=>statuses.push(args)),2);

const effects=[];
runtime.applyConditionalSkillEffects({
  entry:{ownerId:attacker.id,plan:{data:{id:'sapphire_spider_crystal_thread'}}},targetId:victim.id,
  trigger:'[On Crit]',context:{coinIndex:1},units:{[attacker.id]:attacker,[victim.id]:victim},
  applyStatus:(...args)=>effects.push(args),queueStatus:(...args)=>effects.push(args)
});
assert.equal(effects.length,1);
assert.equal(effects[0][1],'restrained');
assert.equal(effects[0][2].count,3);

const root=path.dirname(fileURLToPath(import.meta.url));
const live=fs.readFileSync(path.join(root,'../combat/source/combat-v073-live.html'),'utf8');
const steps=fs.readFileSync(path.join(root,'../js/combat-v073-steps.js'),'utf8');
const sync=fs.readFileSync(path.join(root,'../js/combat-unit-library-sync.js'),'utf8');
assert.match(live,/LuminousCaveSapphireSpiderRuntime\?\.applyConditionalSkillEffects/);
assert.match(live,/LuminousCaveSapphireSpiderRuntime\?\.hasteOnTurnStart/);
assert.match(live,/LuminousCaveSapphireSpiderRuntime\?\.speedDamagePercent/);
assert.match(steps,/currentCoinIndex: coinIndex/);
assert.match(steps,/caveEvadeBonus/);
assert.match(sync,/spiders\.firebasePayload\(\)/);
console.log('Sapphire Spider + Spiderling catalog, conditional Coins, Speed and mineral Salvage profiles: OK');
