import assert from 'node:assert/strict';

const nativeSetTimeout = globalThis.setTimeout;
const nativeSetInterval = globalThis.setInterval;
const nativeAddEventListener = globalThis.addEventListener;
const nativeDispatchEvent = globalThis.dispatchEvent;
const nativeDocument = globalThis.document;
const nativeMenu = globalThis.LuminousCombatEconomyMenu073;

const queued = [];
const listeners = new Map();
let nextTimerId = 1;

globalThis.document = undefined;
globalThis.setTimeout = (callback, delay = 0) => {
  const id = nextTimerId++;
  queued.push({ id, callback, delay });
  return id;
};
globalThis.setInterval = () => nextTimerId++;
globalThis.addEventListener = (type, handler) => {
  const rows = listeners.get(type) || [];
  rows.push(handler);
  listeners.set(type, rows);
};
globalThis.dispatchEvent = event => {
  for (const handler of listeners.get(event?.type) || []) handler(event);
  return true;
};

await import('../js/combat-v073-economy-review-fixes.js');

const review = globalThis.LuminousCombatEconomyReviewFixes073;
assert.ok(review, 'economy review fixes must initialize under Node');
assert.equal(review.state.installed, false);
assert.equal(review.state.installAttempts, 0, 'Node import without a DOM must not spend retry attempts');
assert.equal(review.state.installRetry, null, 'Node import without a DOM must not leave a referenced timeout');
assert.equal(queued.length, 0, 'Node import without a DOM must not schedule retry timers');
assert.ok(
  (listeners.get('luminous:combat073-economy-menu-ready') || []).length > 0,
  'review fixes must listen for the economy-menu-ready signal'
);

globalThis.document = { addEventListener() {} };
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

// Simulate the real slow-load case: EconomyMenu becomes ready only after the
// bounded polling budget was exhausted. Its ready signal must give ReviewFixes
// one fresh installation opportunity without restoring an infinite poll loop.
globalThis.LuminousCombatEconomyMenu073 = {
  state: {
    installed: true,
    originals: {
      selectAction() {},
      renderCleanList() {},
    },
  },
  renderCleanList() {},
  renderSkills() {},
  selectAction() {},
  traitDefinitionsForPlayer() { return []; },
};

globalThis.dispatchEvent({ type: 'luminous:combat073-economy-menu-ready' });
assert.equal(review.state.installAttempts, 1, 'menu-ready must reset the exhausted retry budget and schedule one fresh attempt');
assert.equal(queued.length, 1, 'menu-ready must schedule exactly one fresh install attempt');

queued.shift().callback();
assert.equal(review.state.installed, true, 'ReviewFixes must install when EconomyMenu becomes ready after retry exhaustion');
assert.equal(review.state.installAttempts, 0, 'successful installation must clear retry accounting');
assert.equal(review.state.installRetry, null, 'successful installation must leave no pending retry timer');
assert.equal(queued.length, 0, 'successful ready-event installation must not restart polling');

globalThis.setTimeout = nativeSetTimeout;
globalThis.setInterval = nativeSetInterval;
if (nativeAddEventListener === undefined) delete globalThis.addEventListener;
else globalThis.addEventListener = nativeAddEventListener;
if (nativeDispatchEvent === undefined) delete globalThis.dispatchEvent;
else globalThis.dispatchEvent = nativeDispatchEvent;
if (nativeDocument === undefined) delete globalThis.document;
else globalThis.document = nativeDocument;
if (nativeMenu === undefined) delete globalThis.LuminousCombatEconomyMenu073;
else globalThis.LuminousCombatEconomyMenu073 = nativeMenu;

console.log('combat v0.7.3 economy review bounded + menu-ready install retry smoke: ok');
