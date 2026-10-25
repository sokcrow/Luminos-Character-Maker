import assert from 'node:assert/strict';
await import('../js/skill-deck-rules-v2.js');
await import('../js/deckEngine.js');
await import('../js/combat-skill-loadout-074.js');
const rules=globalThis.LuminousSkillDeckRulesV2;
const engine=globalThis.LuminousDeckEngine;
const loadout=globalThis.LuminousCombatSkillLoadout074;
const skills=[
  {id:'slash_a',tier:1,type:'attack'},
  {id:'slash_b',tier:1,type:'attack'},
  {id:'slash_c',tier:1,type:'attack'},
  {id:'slash_d',tier:1,type:'attack'},
  {id:'stab_a',tier:2,type:'attack'},
  {id:'stab_b',tier:2,type:'attack'},
  {id:'finisher',tier:3,type:'attack'},
  {id:'finisher_b',tier:3,type:'attack'},
  {id:'defend',tier:1,type:'defense'}
];
const legacy=rules.normalizeDeck({tier1:'slash_a',tier2:'stab_a',tier3:'finisher'});
assert.equal(rules.points(legacy),10);
assert.equal(legacy.entries.length,6);
assert.equal(rules.validateDeck(legacy,skills).valid,true);
assert.deepEqual(loadout.skillSlotIdsFor({characterBuild:{skillDeck:legacy}}),
  rules.slotIds(legacy),'Combat loadout must preserve intentional copies and order');
assert.deepEqual(loadout.skillSlotIdsFor({characterBuild:{skillDeck:{schemaVersion:2,entries:[]},skillSlotIds:['obsolete']}}),[],
  'An explicitly empty canonical V2 deck must not inherit legacy copies');
const build=(ids)=>({schemaVersion:2,entries:ids.map((id,i)=>{
  const skill=skills.find(s=>s.id===id);
  return {entryId:'copy_'+i,skillId:id,tier:skill.tier};
})});
const balanced=build(['slash_a','slash_b','slash_c','stab_a','stab_b','finisher']);
assert.equal(rules.validateDeck(balanced,skills).valid,true);
assert.equal(rules.validateDeck(build(['slash_a','slash_b','slash_c','stab_a','finisher','finisher_b']),skills).valid,false);
assert.equal(rules.validateDeck(build(['slash_a','slash_a','slash_a','slash_a','stab_a','stab_b']),skills).valid,false);
assert.equal(rules.validateDeck(build(['slash_a']),skills).valid,false);
assert.equal(rules.validateDeck(build(['slash_a']),skills,{requireFull:false}).valid,true);
assert.equal(rules.validateDeck(build(['slash_a','stab_a','finisher']),skills).valid,false);
assert.equal(rules.addCard(build(['slash_a','slash_b','slash_c','stab_a','stab_b']),skills[6],skills).valid,true);
assert.equal(rules.addCard(balanced,skills[7],skills).valid,false);
assert.equal(rules.validateDeck(build(['slash_a','slash_b','slash_c','stab_a','stab_b','defend']),skills).valid,false);
const definition=engine.buildDeckDefinition(skills,{deckEntries:balanced.entries,requireFull:true});
assert.equal(definition.cardCount,6);
assert.equal(definition.pointsUsed,10);
assert.equal(definition.combatReady,true);
assert.equal(definition.cards.filter(c=>c.tier===3).length,1);
assert.deepEqual(definition.cards.map(c=>c.skillId),rules.slotIds(balanced));
assert.throws(()=>engine.buildDeckDefinition(skills,{deckEntries:build(['slash_a','slash_b','slash_c','stab_a','finisher','finisher_b']).entries,requireFull:false}),/deck_v2_tier_iii_limit/);
assert.throws(()=>engine.buildDeckDefinition(skills,{deckEntries:build(['slash_a','slash_a','slash_a','slash_a']).entries,requireFull:false}),/deck_v2_copy_limit/);
const unit={id:'test-player'};
engine.initDeck(unit,skills,{deckEntries:balanced.entries});
engine.onTurnStart(unit,{round:1,slotCount:1,random:()=>0});
assert.equal(engine.getSlotHand(unit,'test-player_slot_0').length,2);
console.log('Skill Deck V2: point budget, unique Tier III, migration, combat copies: OK');
