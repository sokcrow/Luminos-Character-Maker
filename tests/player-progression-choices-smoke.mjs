import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

await import('../js/trait-catalog-core.js');
await import('../js/archetype-engine.js');
await import('../js/archetype-trait-catalog.js');
await import('../js/archetype-progression-preview-catalog.js');
await import('../js/player-progression-tree-core.js');
await import('../js/class-milestone-engine.js');
await import('../js/fighter-maneuver-catalog.js');
await import('../js/player-progression-choices.js');

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const previews = globalThis.LuminousArchetypeProgressionPreviews;
const engine = globalThis.LuminousPlayerProgressionTreeCore;
const milestone = globalThis.LuminousClassMilestones;
const choices = globalThis.LuminousPlayerProgressionChoices;
const html = fs.readFileSync(path.join(root, 'hoja_personaje.html'), 'utf8');

assert.ok(previews && engine && milestone && choices, 'Required APIs are loaded');
const scripts = [
  'archetype-trait-catalog.js','archetype-progression-preview-catalog.js',
  'class-milestone-engine.js','fighter-maneuver-catalog.js',
  'player-progression-tree-core.js','player-progression-choices.js','player-progression-tree.js'
];
for (let i = 1; i < scripts.length; i++) {
  assert.ok(html.indexOf('js/' + scripts[i-1]) < html.indexOf('js/' + scripts[i]),
    'Player script order must satisfy progression dependencies: ' + scripts[i]);
}

const runtimeFiles = [
  'battle-master','champion','samurai','banneret','mastermind',
  'bladesinger','path-of-the-zealot','bilgewater-buccaneer','bilgewater-demolisher'
];
let totalGrantCount = 0;
for (const runtime of runtimeFiles) {
  // Evaluate in isolation: previews must match original runtime data without
  // activating unselected player's combat hooks.
  const sandbox = {};
  const source = fs.readFileSync(path.join(root,'js',runtime+'-archetype-runtime.js'),'utf8');
  vm.runInNewContext(source, { window:sandbox }, { timeout:1200 });
  const exported = sandbox[Object.keys(sandbox).find(key=>key.endsWith('ArchetypeRuntime'))];
  assert.ok(exported?.GRANTS?.length,'Runtime grants missing for '+runtime);
  totalGrantCount += exported.GRANTS.length;
  for (const grant of exported.GRANTS) {
    const preview = previews.FEATURES.find(entry=>
      entry.archetypeId === exported.ARCHETYPE_ID &&
      entry.id === grant.traitId && entry.level === grant.atLevel);
    assert.ok(preview,'Missing preview: '+runtime+' '+grant.traitId);
    const def = exported.DEFINITIONS[grant.traitId] ||
      globalThis.LuminousTraitCatalogCore.allDefinitions()[grant.traitId];
    assert.equal(preview.name,def?.name);
    assert.equal(preview.description,def?.description);
  }
}
assert.equal(previews.FEATURES.length,totalGrantCount,'Preview grants must mirror sources');

const classes=['fighter','barbarian','bard','ranger','rogue','wizard','sorcerer'];
const character={level:90,characterBuild:{classes:classes.map(classId=>({classId,levels:90})),archetypes:[]}};
const model=engine.buildProgressionModel(character);
const branches=model.classes.flatMap(entry=>entry.branches);
assert.equal(branches.length,12);
for (const branch of branches) {
  assert.ok(branch.nodes.length,'Empty preview for '+branch.id);
  assert.ok(branch.nodes.every(node=>node.items.length && node.items.every(item=>item.name && item.description)),
    'Preview shows generic/empty text: '+branch.id);
}
assert.equal(globalThis.LuminousArchetypeTraitCatalog.allGrants().length, 24,
  'Display-only previews must not be injected into combat grants');

assert.deepEqual(milestone.milestoneLevelsForClass('monk'),[20,40,60,80,95]);
assert.deepEqual(milestone.milestoneLevelsForClass('fighter'),[20,30,40,60,70,80,95]);
const fighter=model.classes.find(entry=>entry.classId==='fighter');
const options=choices.milestoneNodes(fighter,character).filter(node=>node.choiceMilestone);
assert.deepEqual(options.map(node=>node.level),[20,30,40,60,70,80,95]);

const selected={characterBuild:{
  classes:[{classId:'fighter',levels:15}],
  archetypes:[{classId:'fighter',archetypeId:'battle_master'}],
  maneuvers:{battle_master:['parry']},
}};
assert.equal(choices.maneuverLimit(selected),3);
assert.deepEqual(choices.chosenManeuvers(selected),['parry']);
selected.characterBuild.classes[0].levels=50;
assert.equal(choices.maneuverLimit(selected),4);
selected.characterBuild.classes[0].levels=90;
assert.equal(choices.maneuverLimit(selected),5);
selected.characterBuild.classMilestones={fighter:{20:{type:'trait',traitId:'superior_technique'}}};
assert.equal(choices.maneuverLimit(selected),6);
selected.characterBuild.archetypes=[];
assert.equal(choices.maneuverLimit(selected),0);

const script=fs.readFileSync(path.join(root,'js/player-progression-tree.js'),'utf8');
assert.match(script,/renderMilestone\?\.\(/);
assert.match(script,/renderManeuvers\?\.\(/);
assert.match(script,/player-progression-preview-features/);
assert.match(script,/milestoneNodes\?\.\(/);
assert.match(script,/player-progression-branch-configure/);
console.log('player-progression-choices-smoke: ok ('+totalGrantCount+' documented preview grants; Battle Master and Class Milestones checked)');
