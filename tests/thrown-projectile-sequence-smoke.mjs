import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const runtime = require('../js/thrown-projectile-sequence-runtime.js');
const registry = require('../js/thrown-projectile-sequence-profiles.js');

assert.equal(registry.install(), true);

const fallingRock = runtime.getProfile('winged_kobold_falling_rock');
assert.ok(fallingRock, 'Falling Rock visual profile must be registered');
assert.equal(fallingRock.projectileAsset, 'https://imgur.com/P4J48yc.png');
assert.equal(fallingRock.releaseSprite, 'https://imgur.com/zmA1FPz.png');
assert.equal(fallingRock.postActionSprite, 'https://imgur.com/evsrs1B.png');
assert.equal(fallingRock.returnToOrigin, true);
assert.equal(fallingRock.resumeHover, true);

const savePlan = runtime.buildSequencePlan('save_success', fallingRock);
assert.deepEqual(savePlan.phases, [
  'capture_origin',
  'approach',
  'release',
  'projectile_from_actor',
  'miss_to_ground',
  'roll',
  'vanish',
  'equip_post_action',
  'return_to_origin',
  'resume_hover',
]);

const failPlan = runtime.buildSequencePlan('save_failure', fallingRock);
assert.deepEqual(failPlan.phases, [
  'capture_origin',
  'approach',
  'release',
  'projectile_from_actor',
  'hit_target',
  'bounce_to_ground',
  'roll',
  'vanish',
  'equip_post_action',
  'return_to_origin',
  'resume_hover',
]);

// Proves the approved sequence is not coupled to Rock/Kobold content.
runtime.registerProfile('test_bottle_throw', {
  projectileAsset: 'bottle.png',
  releaseSprite: 'thrower-empty.png',
  postActionSprite: 'thrower-idle.png',
  returnToOrigin: true,
  resumeHover: false,
});
const bottle = runtime.getProfile('test_bottle_throw');
assert.equal(bottle.projectileAsset, 'bottle.png');
const bottleFail = runtime.buildSequencePlan(false, bottle);
assert.ok(bottleFail.phases.includes('hit_target'));
assert.ok(bottleFail.phases.includes('bounce_to_ground'));
assert.ok(bottleFail.phases.includes('roll'));
assert.ok(bottleFail.phases.includes('vanish'));
assert.ok(bottleFail.phases.includes('return_to_origin'));
assert.ok(!bottleFail.phases.includes('resume_hover'));

assert.equal(runtime.saveOutcomeFromResult({ resolution: { results: [{ targetId: 'a', result: { isSuccess: true } }] } }, 'a'), true);
assert.equal(runtime.saveOutcomeFromResult({ resolution: { results: [{ targetId: 'a', result: { isSuccess: false } }] } }, 'a'), false);

const statusBootstrap = readFileSync(new URL('../js/status-engine.js', import.meta.url), 'utf8');
assert.match(statusBootstrap, /thrown-projectile-sequence-runtime\.js/);
assert.match(statusBootstrap, /thrown-projectile-sequence-profiles\.js/);

console.log('Thrown projectile sequence smoke OK');
