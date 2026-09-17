const assert = require('node:assert/strict');
const path = require('node:path');
const Runtime = require(path.resolve(__dirname, '../js/item-firearm-runtime.js'));

const cadence = Runtime.resolveCadence({cadenceModes:['single','rapid','burst','full'],reliability:3}, 'burst');
assert.equal(cadence.valid, true);
assert.equal(cadence.ammoPerCoin, 3);
assert.equal(cadence.powerPenalty, -2);
const ballistics = Runtime.resolveCoinBallistics(83, cadence, [0,10,5]);
assert.equal(ballistics.damagePool, 100);
assert.deepEqual(ballistics.baseBulletDamage, [34,33,33]);
assert.equal(ballistics.ammoSpent, 3);
assert.equal(ballistics.coinEffectsResolveOnce, true);
assert.equal(ballistics.onHitEffectsResolveOnce, true);

assert.deepEqual(Runtime.applyControl(2,3), {incomingLoss:3,absorbed:2,remainingLoss:1,remainingControl:0});
assert.equal(Runtime.rangeRelation('faster',4,6,[6,3]), 'optimal');
assert.equal(Runtime.rangeRelation('slower',4,6,[6,3]), 'inefficient');
assert.equal(Runtime.rangeRelation('fastest',4,6,[6,6,3]), 'optimal');
assert.equal(Runtime.rangeRelation('slowest',4,3,[6,3,3]), 'optimal');
assert.equal(Runtime.rangeDamagePercent('faster',4,6,[6,3],10).damagePercent, 10);

const reload = Runtime.resolveReloadPlan({capacity:12,loadedAmmo:4,reload:{economy:'action',mode:'full',amount:'capacity'}},5);
assert.equal(reload.valid,true);
assert.equal(reload.amount,5);
assert.equal(reload.requiresActiveInventory,true);
assert.equal(Runtime.validateAmmoStatus('radiance').valid,false);

console.log('Firearm runtime smoke: OK');
