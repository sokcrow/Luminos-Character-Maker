import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

await import('../js/trait-engine.js');
await import('../js/character-build-rules.js');
await import('../js/player-progression-tree-core.js');

const core = globalThis.LuminousPlayerProgressionTreeCore;
const traitEngine = globalThis.LuminousTraitEngine;
assert.ok(core);
assert.ok(traitEngine);

const definitions = {
  bard_base_preview: {
    id: 'bard_base_preview',
    name: 'Base Preview',
    description: 'Base class preview.',
    source: { type: 'class', id: 'bard', classId: 'bard' },
    mechanics: { powerFormula: 'ClassLevel / 10' },
  },
  college_preview: {
    id: 'college_preview',
    name: 'College Preview',
    description: 'Archetype preview.',
    source: { type: 'archetype', archetypeId: 'college_test', classId: 'bard' },
    mechanics: { bonusFormula: 'ClassLevel / 5 + CharismaMod' },
  },
};

const character = {
  level: 40,
  stats: { carisma: 18 },
  characterBuild: {
    classes: [{ classId: 'bard', levels: 40 }],
    archetypes: [],
  },
};

const options = {
  definitions,
  traitGrants: [
    { sourceType: 'class', sourceId: 'bard', atLevel: 20, traitId: 'bard_base_preview' },
  ],
  archetypes: {
    college_test: {
      id: 'college_test',
      name: 'College Test',
      classId: 'bard',
      unlockLevel: 15,
      traitLevels: [15, 35],
    },
    college_other: {
      id: 'college_other',
      name: 'College Other',
      classId: 'bard',
      unlockLevel: 15,
      traitLevels: [15, 35],
    },
  },
  archetypeGrants: [
    {
      sourceType: 'archetype',
      sourceId: 'college_test',
      archetypeId: 'college_test',
      classId: 'bard',
      atLevel: 35,
      traitId: 'college_preview',
    },
  ],
  classDefinitions: [{ id: 'bard', name: 'Bard' }],
  traitEngine,
};

const model = core.buildProgressionModel(character, options);
assert.equal(model.classes.length, 1);
assert.equal(model.classes[0].classId, 'bard');
assert.equal(model.classes[0].classLevel, 40);
assert.equal(model.classes[0].commonNodes[0].level, 20);
assert.equal(model.classes[0].commonNodes[0].status, 'earned');
assert.equal(model.classes[0].branches.length, 2);
assert.equal(model.classes[0].branches.every((branch) => branch.status === 'available'), true);

// Formula previews are snapshots of the node level, never the Player's current Class Level.
const preview = model.classes[0].branches.find((branch) => branch.id === 'college_test').nodes[0].items[0].formulas[0];
assert.equal(preview.variables.ClassLevel, 35);
assert.equal(preview.variables.Level, 35);
assert.equal(preview.value, 11); // (35 / 5) + CHA mod 4

const selectedCharacter = structuredClone(character);
selectedCharacter.characterBuild.archetypes = [
  { classId: 'bard', archetypeId: 'college_test', selectedAtClassLevel: 15 },
];
const selected = core.buildProgressionModel(selectedCharacter, options);
const chosenBranch = selected.classes[0].branches.find((branch) => branch.id === 'college_test');
const lockedBranch = selected.classes[0].branches.find((branch) => branch.id === 'college_other');
assert.equal(chosenBranch.status, 'selected');
assert.equal(chosenBranch.nodes[0].status, 'earned');
assert.equal(lockedBranch.status, 'locked');

// Class level allocation is safe for a Player building from zero.
const classDefinitions = globalThis.LuminousCharacterBuildRules.CLASSES;
const freshCharacter = { level: 12, characterBuild: { classes: [] } };
const freshSummary = core.classAllocationSummary(freshCharacter);
assert.equal(freshSummary.earnedLevel, 12);
assert.equal(freshSummary.allocatedLevel, 0);
assert.equal(freshSummary.pendingLevels, 12);

const freshAllocation = core.validateClassAllocation(
  freshCharacter,
  [{ classId: 'monk', levels: 8 }, { classId: 'rogue', levels: 4 }],
  classDefinitions,
  { requireAll: true },
);
assert.equal(freshAllocation.valid, true);
assert.equal(freshAllocation.pendingAfter, 0);
assert.deepEqual(freshAllocation.classes, [
  { classId: 'monk', levels: 8 },
  { classId: 'rogue', levels: 4 },
]);

const partialAllocation = core.validateClassAllocation(
  freshCharacter,
  [{ classId: 'monk', levels: 8 }],
  classDefinitions,
  { requireAll: true },
);
assert.equal(partialAllocation.valid, false);
assert.match(partialAllocation.errors.join(' '), /4 pendientes/);

const progressedCharacter = {
  level: 15,
  characterBuild: {
    classes: [
      { classId: 'monk', levels: 10 },
      { classId: 'rogue', levels: 3 },
    ],
  },
};
const cannotReduceCommitted = core.validateClassAllocation(
  progressedCharacter,
  [{ classId: 'monk', levels: 9 }, { classId: 'rogue', levels: 6 }],
  classDefinitions,
  { requireAll: true },
);
assert.equal(cannotReduceCommitted.valid, false);
assert.match(cannotReduceCommitted.errors.join(' '), /No puedes reducir monk de 10 a 9/);

const safeIncrease = core.validateClassAllocation(
  progressedCharacter,
  [{ classId: 'monk', levels: 12 }, { classId: 'rogue', levels: 3 }],
  classDefinitions,
  { requireAll: true },
);
assert.equal(safeIncrease.valid, true);
assert.equal(safeIncrease.allocatedBefore, 13);
assert.equal(safeIncrease.allocatedAfter, 15);

// Preview snapshots do not mutate the saved Player build.
const snapshot = core.snapshotCharacterAtClassLevel(selectedCharacter, 'bard', 35);
assert.equal(snapshot.classes.find((entry) => entry.classId === 'bard').levels, 35);
assert.equal(selectedCharacter.characterBuild.classes[0].levels, 40);
assert.equal(snapshot.level, 35);

const here = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.join(here, '..', 'hoja_personaje.html'), 'utf8');
const traitRuntime = fs.readFileSync(path.join(here, '..', 'js', 'player-trait-runtime.js'), 'utf8');
const tray = fs.readFileSync(path.join(here, '..', 'js', 'trait-player-tray.js'), 'utf8');
const archetypeRuntime = fs.readFileSync(path.join(here, '..', 'js', 'player-archetype-runtime-core.js'), 'utf8');
const levelAllocationRuntime = fs.readFileSync(path.join(here, '..', 'js', 'player-progression-level-allocation.js'), 'utf8');
const progressionUi = fs.readFileSync(path.join(here, '..', 'js', 'player-progression-tree.js'), 'utf8');
const progressionCss = fs.readFileSync(path.join(here, '..', 'css', 'player-progression-tree.css'), 'utf8');
const statsCss = fs.readFileSync(path.join(here, '..', 'css', 'player-stats-ability-bar.css'), 'utf8');

assert.match(html, /title="Progresión"/);
assert.match(html, /data-progression-view-target="traits"/);
assert.match(html, /data-progression-view-target="tree"/);
assert.match(html, /class="player-progression-primary-tab is-active"[\s\S]*data-progression-view-target="traits"/);
assert.match(html, /data-progression-view="tree"[\s\S]*hidden/);
assert.match(html, /id="player-progression-level-allocation-host"/);
assert.match(html, /id="player-progression-tree-host"/);
assert.match(html, /id="player-progression-traits-host"/);
assert.match(html, /player-progression-traits-dossier is-legacy-hud/);
assert.match(html, /data-progression-trait-art/);
assert.match(html, /data-progression-trait-name/);
assert.match(html, /data-progression-trait-xp-progress/);
assert.match(html, /data-progression-trait-prof/);
assert.match(html, /data-progression-trait-off/);
assert.match(html, /data-progression-trait-def/);
assert.match(progressionCss, /Exact visual regression restore: Traits keep the pre-#841 Stats HUD language/);
assert.match(progressionCss, /grid-template-columns:minmax\(0,1fr\) minmax\(0,1fr\)/);
assert.match(progressionCss, /player-progression-traits-tabline/);
assert.match(progressionCss, /player-progression-primary-tab\.is-active/);
assert.match(progressionCss, /player-progression-primary-view\[hidden\]/);
assert.match(progressionUi, /activeView: "traits"/);
assert.match(progressionUi, /setPrimaryView\("traits"\)/);
// Regression: Stats keeps the responsive collision guard that was accidentally moved to #perks-modal by #841.
assert.match(statsCss, /#stats-modal \.player-stats-engine\{display:none!important\}/);
assert.match(html, /player-progression-tree-core\.js/);
assert.match(html, /player-progression-tree\.js/);
assert.match(html, /player-progression-level-allocation\.js/);
assert.match(html, /character-build-rules\.js/);
assert.doesNotMatch(html, /CREATE PERK/);
assert.match(traitRuntime, /getElementById\("player-progression-traits-host"\)/);
assert.match(tray, /if \(this\.host\.closest\?\.\("#stats-modal"\)\) this\.setupStatsTabs\(\)/);
// Regression: rerendering the tray in Progression must not move the host back into Stats.
assert.doesNotMatch(tray, /if \(!this\.root\) return;\s*this\.setupStatsTabs\(\)/);
assert.match(archetypeRuntime, /getElementById\("player-progression-tree-host"\)/);
assert.match(levelAllocationRuntime, /REVISAR CAMBIOS/);
assert.match(levelAllocationRuntime, /\.transaction\(/);
assert.match(levelAllocationRuntime, /No puedes reducir|validateClassAllocation/);

console.log('player-progression-tree-smoke: ok');
