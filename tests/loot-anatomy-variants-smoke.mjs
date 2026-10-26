import assert from 'node:assert/strict';
globalThis.window = globalThis;
for (const file of ['loot-check-runtime','loot-knowledge-runtime','loot-postcombat-runtime','loot-live-postcombat-runtime']) await import(`../js/${file}.js`);
const checks = globalThis.LuminousLootCheckRuntime, post = globalThis.LuminousLootPostCombatRuntime;
const knowledge = globalThis.LuminousLootKnowledgeRuntime, live = globalThis.LuminousLootLivePostCombatRuntime;
const actor = skill => ({id:'scholar',scores:{int:18,wis:16,str:18},skillProficiency:{[skill]:'proficient'}});
function fixture(kind, material, creatureType='beast') {
  return {lootInstanceId:'corpse',sourceUnitId:'test',corpseId:'corpse',creatureType,
    carried:[],currency:{remaining:0},attempts:[],history:[],pendingDeliveries:[],
    harvest:{bodyKind:kind,materials:[material],resources:[
      {resourceId:'bulk',id:'bulk',integrityFamily:'hard_cover_structural',sourceMaterial:material,remaining:3},
      {resourceId:'delicate',id:'delicate',integrityFamily:material==='flesh'?'organ_internal':'hard_cover_modular',sourceMaterial:material,remaining:2},
    ]}};
}
for (const [kind,material,type,harvestSkill,extractSkill,study] of [
  ['organic','flesh','humanoid','survival','medicine','autopsy'],
  ['construct','metal','construct','arcana','arcana','dismantle'],
  ['mineral','stone','elemental','athletics','arcana','arcane_autopsy'],
  ['construct','stone','construct','athletics','arcana','dismantle'],
  ['organic','flesh','fey','survival','medicine','arcane_autopsy'],
  ['organic','flesh','celestial','survival','medicine','divine_autopsy'],
]) {
  const state = fixture(kind,material,type), options = {state};
  for (const [action,skill,dc] of [['harvest',harvestSkill,10],['extract',extractSkill,12]]) {
    const definition = post.checkDefinition(actor(skill),action,options);
    assert.equal(definition.skill,skill,`${type}/${material}: ${action}`);
    assert.equal(definition.threshold,dc,'actual proficiency waives surcharge');
    assert.equal(post.checkDefinition(actor('investigation'),action,options).threshold,dc+8);
    assert.equal(post.checkDefinition(actor(skill),action,{...options,skill:'investigation'}).skill,skill,'client cannot substitute a recovery skill');
    const outcome = post.performAction(state,actor(skill),action,{rng:()=>0});
    assert.ok(outcome.result.recovery.resources.length);
    assert.equal(outcome.result.check.skill,skill);
  }
  assert.equal(checks.anatomyContext(options).studyAction,study);
  const actions = live.availableActions(state,actor('arcana'));
  assert.ok(actions.includes(study));
  assert.equal(actions.filter(action=>['autopsy','arcane_autopsy','divine_autopsy','dismantle'].includes(action)).length,1);
  const unit = {id:'test',creatureType:type,bodyProfile:{kind,materials:[material],resources:[]},description:'Canonical public description.',scores:{con:30},secret:'hidden'};
  const skill = study === 'autopsy' ? 'medicine' : study === 'divine_autopsy' ? 'religion' : 'arcana';
  const learned = post.performAction(state,actor(skill),study,{unitTruth:unit,rng:()=>0});
  assert.ok(learned.result.knowledge.facts.some(fact=>fact.id==='biology.materials'));
  assert.deepEqual(learned.state.harvest,state.harvest,'studying never consumes body resources');
  assert.equal(learned.result.recovery.resources.length,0);
  const wrong = study === 'autopsy' ? 'dismantle' : 'autopsy';
  assert.throws(()=>post.performAction(state,actor('medicine'),wrong,{unitTruth:unit,rng:()=>0}),/ANATOMY_ACTION_NOT_AVAILABLE/);
  const remembered = post.performAction(state,actor('history'),'history',{unitTruth:unit,rng:()=>0});
  assert.deepEqual(remembered.result.knowledge.facts.map(fact=>fact.id),['lore.basic_description']);
  assert.deepEqual(remembered.result.knowledge.facts[0].value,{name:'Criatura',description:unit.description});
  assert.ok(!JSON.stringify(remembered.result.knowledge.facts).includes('hidden'));
  assert.deepEqual(knowledge.basicDescriptionFacts(unit,{success:false}),[]);
}
// Mixed bodies cannot use one skill roll to collect a different material family.
const mixed = fixture('mixed','flesh');
mixed.harvest.resources.push({id:'metal',resourceId:'metal',sourceMaterial:'metal',integrityFamily:'hard_cover_structural',remaining:2});
const meat = post.performAction(mixed,actor('survival'),'harvest',{rng:()=>0});
assert.equal(meat.state.harvest.resources.find(row=>row.id==='metal').remaining,2);
assert.equal(post.checkDefinition(actor('arcana'),'harvest',{state:mixed,targetResourceId:'metal'}).skill,'arcana');
assert.equal(post.checkDefinition({...actor('arcana'),lootKnowledge:{anatomy:true}},'harvest',{state:fixture('mineral','stone')}).threshold,18,'Medicine knowledge does not waive Athletics');
// Legacy frozen corpses use canonical type as a fallback without regenerating loot.
assert.equal(checks.anatomyContext({state:{harvest:{bodyKind:'organic'}},unitTruth:{creatureType:'fey'}}).studyAction,'arcane_autopsy');
assert.equal(checks.anatomyContext({state:{creatureType:'construct'},unitTruth:{creatureType:'fey'}}).studyAction,'dismantle','new snapshots retain their original type');
console.log('Contextual recovery, finite resources, anatomical studies, History and proficiency passed.');
