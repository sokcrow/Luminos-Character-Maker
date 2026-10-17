import assert from 'node:assert/strict';
import { harness, unit, entry } from './fixtures/combat-phase1-harness.mjs';
const status = (id, count, potency = 0) => ({ id, name: id, count, potency });
const cases = [
  ['cumulative positive Coins', {}, {}, {}],
  ['negative Coins', {}, {}, { coinPower: -3, basePower: 14 }],
  ['Bleed and Paralysis', { statusEffects: { bleed: status('bleed', 3, 4), paralysis: status('paralysis', 2) } }, {}, {}],
  ['critical, Poise and On Crit', { baseCritChance: 65, statusEffects: { poise: status('poise', 3, 3) } }, {},
    { effects: [{ trigger: '[On Crit]', type: 'status', status: 'fragile', count: 1 }] }],
  ['existing Rupture before inflicted Rupture', {}, { statusEffects: { rupture: status('rupture', 2, 3) } },
    { effects: [{ trigger: '[On Hit]', type: 'status', status: 'rupture', count: 1, potency: 2 }] }],
  ['per-Coin effects and pending status', {}, {}, { coins: [
    { effects: [{ trigger: '[On Hit]', type: 'status', status: 'fragile', count: 2 }] },
    { effects: [{ trigger: '[Heads Hit]', target: 'self', type: 'status', status: 'paralysis', count: 1 }] },
    { effects: [{ trigger: '[On Hit]', type: 'status', status: 'burn', potency: 3, count: 1, timing: 'next_turn' }] }] }],
  ['target defeated cancels later Coins', {}, { hp: 6 }, {}],
  ['healing multiplier', {}, { hp: 30, statusEffects: { hp_healing_up: status('hp_healing_up', 2) } }, { spellEffect: 'heal_hp' }],
  ['Stagger changes later damage', {}, { staggerThresholds: [95, 75, 50] }, {}],
  ['Unbreakable metadata compatibility', {}, {}, { coins: [{ type: 'unbreakable' }, {}, {}] }],
];
let count = 0;
for (const [label, a, b, skill] of cases) {
  for (const seed of [1, 42, 98765]) {
    const results = [];
    for (const mode of ['legacy', 'animated', 'silent']) {
      const h = harness({ old: mode === 'legacy', enabled: mode !== 'silent', seed, units: { a: unit('a', a), b: unit('b', b) } });
      const e = entry('a', 'b', skill);
      const total = await h.sandbox.resolveRemainingCoinHits(e, 'b', 3, { heal: skill.spellEffect === 'heal_hp' });
      results.push({ mode, total, state: h.snapshot(), trace: h.trace, randoms: h.randoms, cursor: h.cursor(), events: JSON.parse(JSON.stringify(h.steps.events())) });
      if (mode === 'silent') assert.equal(h.frames(), 0);
      if (mode === 'animated') assert.ok(h.frames() > 0);
    }
    for (const result of results.slice(1)) {
      for (const key of ['total','state','trace','randoms','cursor']) assert.deepEqual(result[key], results[0][key], `${label}/${seed}/${result.mode}/${key}`);
    }
    assert.deepEqual(results[1].events, results[2].events, `${label}: identical event order/results without animations`);
    count++;
  }
}
for (const mode of ['legacy', 'animated', 'silent']) {
  const h = harness({ old: mode === 'legacy', enabled: mode !== 'silent', units: { a: unit('a'), b: unit('b') }, seed: 81 });
  const a = entry('a','b',{ basePower: 8, coinAmount: 3 }), b = entry('b','a',{ basePower: 3, coinAmount: 2 });
  const result = await h.sandbox.resolveSkillClash(a,b);
  const row = { winner: result.winner.ownerId, remaining: result.remaining, clashCount: result.clashCount,
    state: h.snapshot(), trace: h.trace, randoms: h.randoms, cursor: h.cursor() };
  if (mode === 'legacy') globalThis.clashReference = row; else assert.deepEqual(row, globalThis.clashReference, `${mode}: asymmetric Clash order and effects`);
}
// Guard does not consume Bleed/Paralysis; Evade does consume Paralysis, including ties.
for (const kind of ['guard', 'evade']) {
  let reference;
  for (const mode of ['legacy','animated','silent']) {
    const h = harness({ old: mode === 'legacy', enabled: mode !== 'silent', values: [0.01], units: {
      a: unit('a'), b: unit('b', { statusEffects: { bleed: status('bleed', 2, 3), paralysis: status('paralysis', 1) } }) } });
    const defense = entry('b','a',{ basePower: 5, coinPower: 4, coinAmount: 1, defenseType: kind });
    h.data.b.reactiveDefense = { turn: 1, evade: { active: true, entry: defense } };
    const result = kind === 'guard' ? await h.sandbox.resolveGuardAction(defense) : await h.sandbox.resolveEvadeAgainstCoin('b',5,entry('a','b'));
    const row = JSON.parse(JSON.stringify({ result, state: h.snapshot(), trace: h.trace, randoms: h.randoms }));
    if (!reference) reference = row; else assert.deepEqual(row, reference, `${kind}/${mode}`);
    assert.equal(h.data.b.hp,100);
  }
}
// No HUD must still commit HP/SP and all crossed thresholds synchronously.
{
  const h = harness({ units: { a: unit('a',{staggerThresholds:[80,60,40]}) } });
  h.sandbox.setCombatantHP('a',30);
  assert.deepEqual(Array.from(h.data.a.triggeredStaggerThresholds),[0,1,2]);
  assert.equal(h.data.a.staggerStage,3);
  assert.equal(h.sandbox.setCombatantSP('a',12),true); assert.equal(h.data.a.sp,12);
}
console.log(`Phase 1: ${count} legacy/on/off hit cases, asymmetric Clash, Guard/Evade and headless Stagger passed`);
// Real recursive Counter can defeat the owner and cancel the next incoming Coin.
{
  let reference;
  for(const mode of ['legacy','animated','silent']){
    const h=harness({old:mode==='legacy',enabled:mode!=='silent',values:[0.1,0.1],units:{a:unit('a',{hp:6}),b:unit('b')}});
    const counter=entry('b','a',{basePower:20,coinAmount:1,defenseType:'counter'});
    h.data.b.reactiveDefense={turn:1,counters:[{active:true,consumed:false,entry:counter}]};
    await h.sandbox.resolveRemainingCoinHits(entry('a','b'),'b',3);
    const row={state:h.snapshot(),trace:h.trace,randoms:h.randoms};
    if(!reference)reference=row;else assert.deepEqual(row,reference,`recursive Counter/${mode}`);
    assert.equal(h.data.a.hp,0);assert.equal(h.randoms.length,2);
    if(mode!=='legacy')assert.ok(h.steps.events().some(e=>e.type==='ActionCancelled'&&e.reason==='owner_unavailable'));
  }
}
// Save-only spells use the canonical five-Coin save and failed-save status helper.
{
  let reference;
  for(const mode of ['legacy','animated','silent']){
    const h=harness({old:mode==='legacy',enabled:mode!=='silent',values:[.9,.9,.9,.9,.9],units:{a:unit('a'),b:unit('b')}});
    const e=entry('a','b',{save:{ability:'wisdom',threshold:13},failedSaveEffects:[{type:'status',status:'paralyzed',count:1}]});
    const result=await h.sandbox.resolveSaveOnlySpell(e);
    const row=JSON.parse(JSON.stringify({result,state:h.snapshot(),randoms:h.randoms}));
    if(!reference)reference=row;else assert.deepEqual(row,reference,`save-only/${mode}`);
    assert.equal(h.randoms.length,5);
  }
}
console.log('Phase 1: recursive Counter cancellation and canonical save-only spell passed');
