import assert from 'node:assert/strict';

const nativeSetTimeout = globalThis.setTimeout;
const nativeDocument = globalThis.document;
const queued = [];
let nextTimerId = 1;

globalThis.document = undefined;
globalThis.setTimeout = (callback, delay = 0) => {
  const id = nextTimerId++;
  queued.push({ id, callback, delay });
  return id;
};

await import('../js/combat-v073-economy-review-fixes.js');

const review = globalThis.LuminousCombatEconomyReviewFixes073;
assert.ok(review, 'economy review fixes must initialize under Node');
assert.equal(review.state.installed, false);
assert.equal(review.state.installAttempts, 0, 'Node import without a DOM must not spend retry attempts');
assert.equal(review.state.installRetry, null, 'Node import without a DOM must not leave a referenced timeout');
assert.equal(queued.length, 0, 'Node import without a DOM must not schedule retry timers');

globalThis.document = {};
review.install();
assert.equal(review.state.installAttempts, 1, 'browser retry should begin when a DOM exists');
assert.equal(queued.length, 1, 'browser retry should schedule one timer at a time');

let callbacksRun = 0;
while (queued.length) {
  const task = queued.shift();
  task.callback();
  callbacksRun += 1;
  assert.ok(callbacksRun <= 30, 'install retry loop must be bounded');
}

assert.equal(review.state.installed, false, 'missing EconomyMenu must remain uninstalled');
assert.equal(review.state.installAttempts, 24, 'retry budget must stop at the configured maximum');
assert.equal(review.state.installRetry, null, 'exhausted retry budget must leave no pending timer');
assert.equal(queued.length, 0, 'exhausted retry budget must stop scheduling work');

globalThis.setTimeout = nativeSetTimeout;
if (nativeDocument === undefined) delete globalThis.document;
else globalThis.document = nativeDocument;

console.log('combat v0.7.3 economy review bounded install retry smoke: ok');
