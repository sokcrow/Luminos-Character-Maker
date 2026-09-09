import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

for (const key of ['LuminousBattleViewerDmEncounterRoster074']) delete globalThis[key];
await import('../js/battle-viewer-dm-encounter-roster-074.js');
const roster = globalThis.LuminousBattleViewerDmEncounterRoster074;

assert.equal(roster?.version, '0.7.4');
assert.equal(roster.ROOTS.combatants, 'campaña/combate/combatants');
assert.equal(roster.ROOTS.reserves, 'campaña/combate/reserves');

const combatants = {
  'player:alice': { id: 'player:alice', name: 'Alice', isPlayer: true, category: 'player' },
  ally_guard: { id: 'ally_guard', name: 'Guard', faction: 'ally', category: 'ally' },
  enemy_a: { id: 'enemy_a', name: 'Raider', faction: 'enemy', category: 'enemy' },
  boss_a: { id: 'boss_a', name: 'Warden', faction: 'enemy', category: 'boss', isBoss: true },
};
const reserves = {
  ally_backup: { id: 'ally_backup', name: 'Medic', faction: 'ally', category: 'ally' },
  enemy_backup: { id: 'enemy_backup', name: 'Raider Reinforcement', faction: 'enemy', category: 'enemy' },
  boss_backup: { id: 'boss_backup', name: 'Second Warden', faction: 'enemy', category: 'boss' },
};

const summary = roster.summarizeRoster(combatants, reserves);
assert.equal(summary.allied.field.total, 2, 'Player + allied Unit should count as allied FIELD');
assert.equal(summary.allied.field.players, 1);
assert.equal(summary.allied.field.allies, 1);
assert.equal(summary.allied.backup.total, 1);
assert.equal(summary.enemy.field.total, 2);
assert.equal(summary.enemy.field.enemies, 1);
assert.equal(summary.enemy.field.bosses, 1);
assert.equal(summary.enemy.backup.total, 2);
assert.equal(summary.enemy.backup.enemies, 1);
assert.equal(summary.enemy.backup.bosses, 1);

assert.equal(roster.sideFor({ isPlayer: true }), 'ally', 'Players are allied even without a legacy faction field');
assert.equal(roster.roleFor({ faction: 'enemy', category: 'boss' }), 'boss');
assert.equal(roster.sideFor({ faction: 'enemy', category: 'boss' }), 'enemy');
assert.equal(roster.sideFor({ category: 'npc' }), 'neutral');

const here = path.dirname(fileURLToPath(import.meta.url));
const progressiveSource = fs.readFileSync(path.join(here, '..', 'js', 'battle-viewer-progressive-ui-074.js'), 'utf8');
assert.match(progressiveSource, /battle-viewer-dm-encounter-roster-074\.js/);
assert.match(progressiveSource, /syncEncounterRoster/);

console.log('combat-v074-dm-encounter-roster-smoke: ok');
