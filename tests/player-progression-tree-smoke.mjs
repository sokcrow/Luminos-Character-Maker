import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

await import('../js/trait-engine.js');
await import('../js/character-build-rules.js');
await import('../js/archetype-engine.js');
await import('../js/archetype-trait-catalog.js');
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
const progressionRuntime = fs.readFileSync(path.join(here, '..', 'js', 'player-progression-tree.js'), 'utf8');
const progressionCss = fs.readFileSync(path.join(here, '..', 'css', 'player-progression-tree.css'), 'utf8');
const traitCss = fs.readFileSync(path.join(here, '..', 'css', 'player-trait-tabs.css'), 'utf8');
const statsCss = fs.readFileSync(path.join(here, '..', 'css', 'player-stats-ability-bar.css'), 'utf8');

assert.match(html, /title="Progresión"/);
assert.match(html, /id="player-progression-level-allocation-host"/);
assert.match(html, /id="player-progression-tree-host"/);
// The Player sheet must load choice metadata even when no Archetype is selected.
// Class-runtime-bootstrap alone loads only the active build graph.
const engineScript = html.indexOf('src="js/archetype-engine.js"');
const catalogScript = html.indexOf('src="js/archetype-trait-catalog.js"');
const treeScript = html.indexOf('src="js/player-progression-tree-core.js"');
assert.ok(engineScript > 0 && engineScript < catalogScript && catalogScript < treeScript);
const unselectedBarbarian = core.buildProgressionModel(
  { level:15, characterBuild:{ classes:[{classId:'barbarian',levels:15}], archetypes:[] } },
  { archetypeCatalog:globalThis.LuminousArchetypeTraitCatalog, traitGrants:[], archetypeGrants:[], definitions:{} },
);
assert.equal(
  unselectedBarbarian.classes[0].branches.find(entry=>entry.id==='path_of_the_devil_lineage')?.status,
  'available',
  'Eligible archetypes must appear without having an archetype runtime selected first',
);
// All shipped archetype runtime choices must be visible before selection.
// Metadata registration is independent from loading their combat runtimes.
const choiceCatalog = globalThis.LuminousArchetypeTraitCatalog.allArchetypes();
const expectedChoices = {
  barbarian:['path_of_the_devil_lineage','path_of_the_zealot'],
  bard:['college_of_whispers'],
  fighter:['banneret','battle_master','champion','samurai'],
  ranger:['bilgewater_buccaneer','bilgewater_demolisher'],
  rogue:['mastermind'],
  sorcerer:['orosh_lineage'],
  wizard:['bladesinger'],
};
assert.equal(Object.keys(choiceCatalog).length,12);
for(const [classId,choices] of Object.entries(expectedChoices)) {
  const character = {level:35,characterBuild:{classes:[{classId,levels:35}],archetypes:[]}};
  const available = core.buildProgressionModel(character,{
    archetypeCatalog:globalThis.LuminousArchetypeTraitCatalog,
    traitGrants:[],archetypeGrants:[],definitions:{},
  }).classes[0].branches;
  for(const id of choices) {
    assert.equal(available.find(entry=>entry.id===id)?.status,'available',
      `${classId} should offer ${id} without a preselected archetype`);
  }
}

// Traits are a primary Stats/Desktop surface. Progression must not own or duplicate them.
assert.doesNotMatch(html, /id="player-progression-traits-host"/);
assert.doesNotMatch(html, /player-progression-traits-dossier/);
assert.doesNotMatch(html, /data-progression-trait-/);
assert.match(traitRuntime, /querySelector\("#stats-modal #stats-container"\)/);
assert.match(traitRuntime, /statsContainer\.insertBefore\(host|statsContainer\.appendChild\(host\)/);
assert.doesNotMatch(traitRuntime, /player-progression-traits-host/);
assert.match(tray, /mount\(\) \{[\s\S]*?this\.setupStatsTabs\(\);/);
assert.match(tray, /\["stats", "Stats"\]/);
assert.match(tray, /\["traits", "Traits"\]/);
assert.match(traitCss, /#stats-modal \.player-traits-catalog/);
assert.match(traitCss, /#stats-modal #player-trait-runtime-host/);
assert.doesNotMatch(traitCss, /#perks-modal \.player-traits-catalog/);
// Regression: Stats keeps the responsive collision guard.
assert.match(statsCss, /#stats-modal \.player-stats-engine\{display:none!important\}/);
assert.match(html, /player-progression-tree-core\.js/);
assert.match(html, /player-progression-tree\.js/);
assert.match(html, /player-progression-level-allocation\.js/);
assert.match(html, /character-build-rules\.js/);
assert.doesNotMatch(html, /CREATE PERK/);
assert.match(archetypeRuntime, /getElementById\("player-progression-tree-host"\)/);
assert.match(levelAllocationRuntime, /REVISAR CAMBIOS/);
assert.match(levelAllocationRuntime, /\.transaction\(/);
assert.match(levelAllocationRuntime, /No puedes reducir|validateClassAllocation/);

// The Avance panel is compact when no levels need allocating, but its
// controls and confirmation flow remain available on disclosure.
assert.match(levelAllocationRuntime, /allocationExpanded: null/);
assert.match(levelAllocationRuntime, /data-toggle-allocation aria-controls="player-level-allocation-body"/);
assert.match(levelAllocationRuntime, /state\.allocationExpanded = willExpand/);
assert.match(levelAllocationRuntime, /class="player-level-allocation__body"/);
assert.match(progressionCss, /#player-progression-detail\[hidden\]/);
assert.match(progressionCss, /\.player-level-allocation__body\[hidden\]/);

// Shrink the former 1500px modal and 190px tracks. On mobile, cards are
// presented in a two-column stack instead of forcing sideways traversal.
assert.match(progressionCss, /width:min\(92vw,1080px\)/);
assert.match(progressionRuntime, /player-progression-milestone-list/);
assert.match(progressionCss, /grid-template-columns:repeat\(auto-fit,minmax\(min\(100%,218px\),1fr\)\)!important/);
assert.match(progressionCss, /\.player-progression-archetype-list/);
assert.match(progressionRuntime, /button\.addEventListener\("click", inspect\)/);
assert.match(progressionRuntime, /ELEGIR ARQUETIPO/);
assert.match(progressionRuntime, /state\.selectedKey = card\.dataset\.progressionKey/);
assert.match(progressionRuntime, /await db\.ref\(/);
assert.match(progressionRuntime, /No hay conexión para guardar el arquetipo/);
assert.match(progressionRuntime, /className = "player-progression-choose-error"/);
assert.match(progressionRuntime, /selected\.__inspect\(\)/);
assert.match(progressionRuntime, /preview\.addEventListener\("click", inspect\)/);
assert.match(progressionRuntime, /host\.contains\(state\.detail\)/);
assert.match(progressionRuntime, /mobileLayout\?\.addEventListener\?\.\("change", syncDetailPlacement\)/);
assert.match(progressionRuntime, /state\.root\?\.contains\(anchor\)/);
const noOpGuard = progressionRuntime.indexOf('if (!force && signature === state.signature) return true;');
const rehome = progressionRuntime.indexOf('if (state.detail && host.contains(state.detail)) host.after(state.detail);');
assert.ok(noOpGuard >= 0 && rehome > noOpGuard, 'No-op data refresh must leave inline details in place');
assert.match(html, /Selecciona un nivel o arquetipo para ver sus mejoras/);
assert.doesNotMatch(html, /Recorre la clase con la rueda del mouse/);

console.log('player-progression-tree-smoke: ok');
