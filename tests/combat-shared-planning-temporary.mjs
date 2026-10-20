import assert from 'node:assert/strict';
import fs from 'node:fs';import vm from 'node:vm';
const rows=[{id:'s1',skillId:'s1',kind:'skill',tier:1,name:'One'},{id:'s2',skillId:'s2',kind:'skill',tier:2,name:'Two'},{id:'s3',skillId:'s3',kind:'skill',tier:3,name:'Three'}];
function client(saved){
 const unit={id:'u',controlled:'player',actionSlots:2,...saved};let round=1;
 const w={LuminousCombat073:{kit:()=>({actions:rows}),combatants:()=>({u:unit}),uiState:()=>({round})},LuminousCombatLiveAdapter073:{state:{encounterId:'enc',round:1}},addEventListener(){}};w.window=w;
 const context=vm.createContext(w);for(const f of ['js/deckEngine.js','js/combat-v073-deck.js'])vm.runInContext(fs.readFileSync(f,'utf8'),context);
 return {w,unit,api:w.LuminousCombatSlotDeck073,setRound:n=>round=n};
}
const a=client(),b=client();
assert.deepEqual(JSON.parse(JSON.stringify(a.api.hand('u',0))),JSON.parse(JSON.stringify(b.api.hand('u',0))));
assert.equal(a.unit.combatDeck.definition.cardCount,6);
assert.deepEqual([1,2,3].map(n=>a.unit.combatDeck.definition.cards.filter(c=>c.tier===n).length),[3,2,1]);
const hand=JSON.parse(JSON.stringify(a.api.hand('u',0))),other=JSON.parse(JSON.stringify(a.api.hand('u',1)));
a.api.mark({ownerId:'u',localIndex:0,plan:{drawId:hand[1].drawId}});
const saved=a.api.compact(a.unit.combatDeck);assert.equal(JSON.stringify(saved).includes('"skill":'),false);
const reloaded=client({combatDeck:JSON.parse(JSON.stringify(saved))});assert.deepEqual(JSON.parse(JSON.stringify(reloaded.api.hand('u',0))),hand);
a.setRound(2);a.api.syncAll(2);reloaded.setRound(2);reloaded.api.syncAll(2);
assert.deepEqual(JSON.parse(JSON.stringify(a.api.hand('u',0))),JSON.parse(JSON.stringify(reloaded.api.hand('u',0))));
assert.ok(!a.api.hand('u',0).some(c=>hand.some(old=>old.drawId===c.drawId)));
assert.equal(a.api.hand('u',1)[0].drawId,other[1].drawId);
const card=a.api.hand('u',0)[0];assert.equal(a.api.validatePlans({p:{0:{kind:'skill',unitId:'u',skillId:card.skillId,sourceSlotIndex:0,drawId:card.drawId}}}),true);
assert.throws(()=>a.api.validatePlans({p:{0:{kind:'skill',unitId:'u',skillId:card.skillId,sourceSlotIndex:0,drawId:'not-in-hand'}}}),/no est/);
const before=JSON.stringify(a.unit.combatDeck);a.api.syncAll(2);assert.equal(JSON.stringify(a.unit.combatDeck),before);
console.log('Slot deck: copy weights, two-card private hands, reload, execution, rotation, validation and idempotence OK');
