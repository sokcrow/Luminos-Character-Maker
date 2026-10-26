import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

for (const key of ['document', 'MutationObserver', 'LuminousBattleViewerProgressiveUi074', 'LuminousBattleViewerPlayerSkillPlanner074']) delete globalThis[key];

await import('../js/battle-viewer-progressive-ui-074.js');
const ui = globalThis.LuminousBattleViewerProgressiveUi074;
assert.equal(ui?.version, '0.7.4');
assert.equal(ui.state.dmExpanded, false, 'DM tools should default to compact mode');

let skills = [];
globalThis.LuminousBattleViewerPlayerSkillPlanner074 = {
  state: { selectedSkillId: 'stale_skill' },
  currentOwnerContext() {
    return { ok: true, playerId: 'player_a', combatant: { ok: true }, unit: { id: 'player:player_a' } };
  },
  equippedSkillsFor() { return skills; },
};
assert.equal(ui.shouldShowSkillPlanner(), false, '0 equipped Skills must not reserve Player Skill UI space');
skills = [{ id: 'skill_a', name: 'Skill A' }];
assert.equal(ui.shouldShowSkillPlanner(), true, 'equipped Skills should make the Player Skill UI actionable');

function classList() {
  const values = new Set();
  return {
    toggle(name, enabled) { enabled ? values.add(name) : values.delete(name); },
    contains(name) { return values.has(name); },
  };
}

function trackedBody(initialHidden = false) {
  let hidden = Boolean(initialHidden);
  let writes = 0;
  return {
    get hidden() { return hidden; },
    set hidden(value) { hidden = Boolean(value); writes += 1; },
    get hiddenWrites() { return writes; },
  };
}

function trackedToggle(bodyRef, initialText = '—') {
  let text = initialText;
  let writes = 0;
  return {
    dataset: {},
    get textContent() { return text; },
    set textContent(value) { text = String(value); writes += 1; },
    get textWrites() { return writes; },
    onclick() {
      bodyRef.hidden = !bodyRef.hidden;
      this.textContent = bodyRef.hidden ? '+' : '—';
    },
  };
}

const panel = { classList: classList() };
let body = trackedBody(false);
let toggle = trackedToggle(body);
const nodes = {
  'dm-dashboard': panel,
  'dm074-body': body,
  'dm074-collapse': toggle,
  'bv074-player-skill-planner': { hidden: false },
};
globalThis.document = { getElementById(id) { return nodes[id] || null; } };

ui.state.dmExpanded = false;
assert.equal(ui.syncDmPanel(), true);
assert.equal(body.hidden, true);
assert.equal(panel.classList.contains('dm074-compact'), true);
assert.equal(toggle.textContent, '+');
assert.equal(body.hiddenWrites, 1);
assert.equal(toggle.textWrites, 1);

// Regression: repeated synchronization must be idempotent. Redundant writes to
// `hidden` or textContent can feed the browser MutationObserver back into sync.
ui.syncDmPanel();
assert.equal(body.hiddenWrites, 1, 'sync must not rewrite hidden when state already matches');
assert.equal(toggle.textWrites, 1, 'sync must not rewrite toggle text when state already matches');

toggle.onclick({ type: 'click' });
assert.equal(ui.state.dmExpanded, true, 'manual DM expansion should be remembered');
assert.equal(body.hidden, false);
assert.equal(panel.classList.contains('dm074-compact'), false);

// Simulate the legacy DM console remounting its innerHTML after Firebase refresh.
body = trackedBody(false);
toggle = trackedToggle(body);
nodes['dm074-body'] = body;
nodes['dm074-collapse'] = toggle;
ui.syncDmPanel();
assert.equal(body.hidden, false, 'DM expansion preference survives console remounts');
assert.equal(toggle.textContent, '—');
assert.equal(body.hiddenWrites, 0, 'matching expanded state must not rewrite hidden after remount');
assert.equal(toggle.textWrites, 0, 'matching expanded label must not rewrite text after remount');

skills = [];
ui.syncSkillPlanner();
assert.equal(nodes['bv074-player-skill-planner'].hidden, true);
assert.equal(globalThis.LuminousBattleViewerPlayerSkillPlanner074.state.selectedSkillId, null);
skills = [{ id: 'skill_a', name: 'Skill A' }];
ui.syncSkillPlanner();
assert.equal(nodes['bv074-player-skill-planner'].hidden, false);

const here = path.dirname(fileURLToPath(import.meta.url));
const runtimeSource = fs.readFileSync(path.join(here, '..', 'js', 'battle-viewer-runtime-074.js'), 'utf8');
const progressiveSource = fs.readFileSync(path.join(here, '..', 'js', 'battle-viewer-progressive-ui-074.js'), 'utf8');
assert.match(runtimeSource, /battle-viewer-progressive-ui-074\.js/);
assert.match(runtimeSource, /LuminousBattleViewerProgressiveUi074/);
assert.doesNotMatch(progressiveSource, /attributeFilter\s*:\s*\[\s*["']hidden["']\s*\]/, 'progressive UI must not observe the hidden attribute it owns');
assert.match(progressiveSource, /childList\s*:\s*true/);

console.log('combat-v074-progressive-ui-smoke: ok');
