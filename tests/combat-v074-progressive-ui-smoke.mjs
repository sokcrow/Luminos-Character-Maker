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

const panel = { classList: classList() };
let body = { hidden: false };
let toggle = {
  textContent: '—',
  dataset: {},
  onclick() {
    body.hidden = !body.hidden;
    this.textContent = body.hidden ? '+' : '—';
  },
};
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

toggle.onclick({ type: 'click' });
assert.equal(ui.state.dmExpanded, true, 'manual DM expansion should be remembered');
assert.equal(body.hidden, false);
assert.equal(panel.classList.contains('dm074-compact'), false);

// Simulate the legacy DM console remounting its innerHTML after Firebase refresh.
body = { hidden: false };
toggle = {
  textContent: '—',
  dataset: {},
  onclick() {
    body.hidden = !body.hidden;
    this.textContent = body.hidden ? '+' : '—';
  },
};
nodes['dm074-body'] = body;
nodes['dm074-collapse'] = toggle;
ui.syncDmPanel();
assert.equal(body.hidden, false, 'DM expansion preference survives console remounts');
assert.equal(toggle.textContent, '—');

skills = [];
ui.syncSkillPlanner();
assert.equal(nodes['bv074-player-skill-planner'].hidden, true);
assert.equal(globalThis.LuminousBattleViewerPlayerSkillPlanner074.state.selectedSkillId, null);
skills = [{ id: 'skill_a', name: 'Skill A' }];
ui.syncSkillPlanner();
assert.equal(nodes['bv074-player-skill-planner'].hidden, false);

const here = path.dirname(fileURLToPath(import.meta.url));
const runtimeSource = fs.readFileSync(path.join(here, '..', 'js', 'battle-viewer-runtime-074.js'), 'utf8');
assert.match(runtimeSource, /battle-viewer-progressive-ui-074\.js/);
assert.match(runtimeSource, /LuminousBattleViewerProgressiveUi074/);

console.log('combat-v074-progressive-ui-smoke: ok');
