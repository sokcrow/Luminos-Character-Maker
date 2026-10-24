import assert from 'node:assert/strict';
import fs from 'node:fs';
const rules=JSON.parse(fs.readFileSync('database.rules.json','utf8')).rules;
const scoped=rules.campaña.encuentros.$encounterId.state.campaña.combate;
const data={campaña:{config:{dm_uid:'global-dm'},jugadores:{hero:{uid:'wrong-global-owner'}},combate:{estado:{encounterId:'wrong-global-encounter'}},encuentros:{room:{hostUid:'host',members:{host:true,player:true},state:{campaña:{config:{dm_uid:'host'},jugadores:{hero:{uid:'player'}},combate:{estado:{phase:'PRE_COMBAT_PLANNING',encounterId:'isolated'},combatants:{'player:hero':{canonicalPlayerKey:'hero',canonicalOwnerUid:'player',isPlayer:true}}}}}}}}};
const payload={schemaVersion:1,playerId:'hero',schedulerUid:'player',unitId:'player:hero',sourceId:'rage',sourceType:'trait',cost:'quick_action',round:1,encounterId:'isolated',targetId:'player:hero',createdAt:1};
function snapshot(value){return {val:()=>value??null,exists:()=>value!=null,child:path=>snapshot(path.split('/').reduce((v,key)=>v?.[key],value)),isString:()=>typeof value==='string',isNumber:()=>typeof value==='number',isBoolean:()=>typeof value==='boolean'};}
function evaluate(expression,uid,body=payload,old=null){return new Function('auth','root','data','newData','$encounterId','$playerId',`return (${expression});`)({uid},snapshot(data),snapshot(old),snapshot(body),'room','hero');}
const rule=scoped.independentIntents.$playerId.$intentId;
assert.equal(evaluate(rule['.write'],'player'),true);assert.equal(evaluate(rule['.validate'],'player'),true,'A member whose campaign-global data conflicts still validates in the isolated encounter');
for(const uid of ['global-dm','outsider','e9JwFZrtk6g8UMqq2Hf9EHVY7Ay1']){
  assert.equal(evaluate(rule['.write'],uid),false,'A nonmember cannot submit using campaign/global admin authority');
  assert.equal(evaluate(scoped.independentIntents['.write'],uid),false);
  assert.equal(evaluate(scoped.independentReceipts['.write'],uid),false);
}
assert.equal(evaluate(scoped.independentReceipts['.write'],'host'),true);
assert.equal(evaluate(scoped.independentReceipts['.write'],'player'),false);
assert.equal(evaluate(rule['.write'],'player',payload,payload),false,'Intents remain immutable');
assert.equal(evaluate(rule['.validate'],'player',{...payload,encounterId:'wrong-global-encounter'}),false);
function expressions(row){return Object.values(row).flatMap(value=>typeof value==='string'?[value]:typeof value==='object'?expressions(value):[]);}
assert.ok(expressions({intents:scoped.independentIntents,receipts:scoped.independentReceipts}).every(value=>!value.includes("root.child('campaña')")),'No campaign-global dependency can return in isolated rules');
console.log('Independent isolated rules: scoped ownership/encounter, membership, host receipts, global-DM denial, immutable intents and foreign-encounter denial passed.');
