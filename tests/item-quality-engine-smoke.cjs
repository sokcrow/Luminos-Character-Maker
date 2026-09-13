const assert = require('node:assert/strict');

const quality = require('../js/item-quality-engine.js');

assert.ok(quality);
assert.equal(quality.VERSION, 1);
assert.equal(quality.DEFAULT_THRESHOLD, 18);
assert.deepEqual(quality.QUALITY_ORDER, ['ruined', 'poor', 'standard', 'fine', 'exceptional']);

assert.equal(quality.resolveQuality(10, 18).quality.id, 'ruined');
assert.equal(quality.resolveQuality(11, 18).quality.id, 'poor');
assert.equal(quality.resolveQuality(17, 18).quality.id, 'poor');
assert.equal(quality.resolveQuality(18, 18).quality.id, 'standard');
assert.equal(quality.resolveQuality(21, 18).quality.id, 'standard');
assert.equal(quality.resolveQuality(22, 18).quality.id, 'fine');
assert.equal(quality.resolveQuality(25, 18).quality.id, 'fine');
assert.equal(quality.resolveQuality(26, 18).quality.id, 'exceptional');

assert.equal(quality.craftingThreshold('generic'), 18);
assert.equal(quality.craftingThreshold('workshop'), 22);
assert.equal(quality.craftingThreshold('corp'), 28);
assert.equal(quality.craftingThreshold('corporate'), 28);
assert.equal(quality.craftingThreshold('corp', -3), 25);

assert.equal(quality.resolveCraftQuality({ checkTotal: 22, complexity: 'generic' }).quality.id, 'fine');
assert.equal(quality.resolveCraftQuality({ checkTotal: 22, complexity: 'workshop' }).quality.id, 'standard');
assert.equal(quality.resolveCraftQuality({ checkTotal: 28, complexity: 'corp' }).quality.id, 'standard');
assert.equal(quality.resolveCraftQuality({ checkTotal: 26, complexity: 'corp', thresholdAdjustment: -2 }).quality.id, 'standard');

assert.equal(quality.getQuality('ruined').effectMultiplier, 0.50);
assert.equal(quality.getQuality('poor').effectMultiplier, 0.75);
assert.equal(quality.getQuality('standard').effectMultiplier, 1.00);
assert.equal(quality.getQuality('fine').effectMultiplier, 1.25);
assert.equal(quality.getQuality('exceptional').effectMultiplier, 1.50);

assert.equal(quality.getQuality('ruined').valueMultiplier, 0.25);
assert.equal(quality.getQuality('poor').valueMultiplier, 0.50);
assert.equal(quality.getQuality('standard').valueMultiplier, 1.00);
assert.equal(quality.getQuality('fine').valueMultiplier, 1.50);
assert.equal(quality.getQuality('exceptional').valueMultiplier, 2.00);

assert.equal(quality.applyEffect(20, 'fine'), 25);
assert.equal(quality.applyEffect(20, 'exceptional'), 30);
assert.equal(quality.applyValue(180, 'poor'), 90);
assert.equal(quality.applyValue(180, 'standard'), 180);
assert.equal(quality.applyValue(180, 'fine'), 270);
assert.equal(quality.applyValue(180, 'exceptional'), 360);

console.log('Item quality engine smoke: OK');
