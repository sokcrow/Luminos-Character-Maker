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
await import('../js/milestone-revert-patch.js');

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const previews = globalThis.LuminousArchetypeProgressionPreviews;
const engine = globalThis.LuminousPlayerProgressionTreeCore;
const milestone = globalThis.LuminousClassMilestones;
const choices = globalThis.LuminousPlayerProgressionChoices;
const revert = globalThis.LuminousMilestoneRevertPatch;
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
assert.equal(globalThis.LuminousArchetypeTraitCatalog.allGrants().length, 23,
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
globalThis.LuminousBattleMasterArchetypeRuntime = { maneuverCapacity:()=>5 };
assert.equal(choices.maneuverLimit(selected),6,
  'Superior Technique from class milestone grants its slot even when BM runtime is loaded');
delete globalThis.LuminousBattleMasterArchetypeRuntime;
selected.characterBuild.archetypes=[];
assert.equal(choices.maneuverLimit(selected),0);

// Model/render/save eligibility must agree for every supported class format,
// including map-valued entries rather than only arrays.
const legacyVariants = [
  {
    label:'characterBuild.classLevels object',
    data:{ characterBuild:{
      classLevels:{ fighter:{levels:40} },
      archetypes:{fighter:{archetypeId:'battle_master'}},
    }},
  },
  {
    label:'top-level classLevels object',
    data:{ classLevels:{fighter:{levels:40}},
      archetypes:{fighter:{archetypeId:'battle_master'}} },
  },
  {
    label:'classesById object',
    data:{ classesById:{fighter:{levels:40}},
      archetypes:{fighter:'battle_master'} },
  },
  {
    label:'characterBuild.classesById object',
    data:{ characterBuild:{
      classesById:{fighter:{levels:40}},
      archetypes:[{classId:'fighter',archetypeId:'battle_master'}],
    }},
  },
  {
    label:'characterBuild.classes object',
    data:{characterBuild:{
      classes:{fighter:{levels:40}},
      archetypes:{fighter:{archetypeId:'battle_master'}},
    }},
  },
  {
    label:'top-level classes object',
    data:{classes:{fighter:{levels:40}},
      archetypes:{fighter:{archetypeId:'battle_master'}}},
  },
  {
    label:'dnd classes map',
    data:{dnd:{classes:{fighter:{levels:40}}},
      archetypes:{fighter:{archetypeId:'battle_master'}}},
  },
];
for (const {label,data} of legacyVariants) {
  const normalized = engine.normalizeClasses(data);
  assert.equal(normalized.find(row=>row.classId==='fighter')?.levels,40,label+' class level');
  assert.equal(engine.selectedArchetypeForClass(data,'fighter')?.archetypeId,'battle_master',label+' selected archetype');
  const fighterModel = engine.buildProgressionModel(data).classes.find(row=>row.classId==='fighter');
  assert.ok(fighterModel,label+' rendered in Avance');
  assert.ok(fighterModel.branches.some(row=>row.id==='battle_master'&&row.status==='selected'),
    label+' picked branch');
  assert.equal(choices.maneuverLimit(data),3,label+' maneuver limit');
  assert.equal(milestone.earnedMilestones(normalized).some(row=>row.classId==='fighter'&&row.milestoneLevel===30),
    true,label+' earned bonus milestone');
}
// Codex P1: migrating array-backed claims must never drop earlier Traits,
// stats claims, timestamps, or unrelated classes.
const legacyClaims=[
  {classId:'fighter',milestoneLevel:20,type:'stats',allocation:{fuerza:2},selectedAt:111,origin:'older-build'},
  {classId:'fighter',level:30,type:'trait',traitId:'general_keen',selectedAt:222,notes:'keep-this-note'},
  {classId:'monk',milestoneLevel:40,type:'trait',traitId:'superior_technique',selectedAt:333},
];
const sourceCopy=structuredClone(legacyClaims);
const mapped=milestone.migrateMilestoneChoices(legacyClaims);
assert.deepEqual(legacyClaims,sourceCopy,'Migration must not modify its input');
assert.ok(!Array.isArray(mapped),'Converted milestones use the supported nested object map');
assert.deepEqual(mapped.fighter["20"],sourceCopy[0],'Old stat claim and metadata retained verbatim');
assert.deepEqual(mapped.fighter["30"],sourceCopy[1],'Old Trait and metadata retained verbatim');
assert.deepEqual(mapped.monk["40"],sourceCopy[2],'Other class choices remain intact');
assert.equal(milestone.choiceAt(mapped,'fighter',20)?.type,'stats');
assert.equal(milestone.choiceAt(mapped,'fighter',30)?.traitId,'general_keen');
assert.deepEqual(milestone.selectedGeneralTraitIds({characterBuild:{classMilestones:mapped}}),
  ['general_keen','superior_technique']);
assert.equal(milestone.migrateMilestoneChoices(mapped),mapped,'Already mapped choices remain unchanged');
assert.deepEqual(milestone.migrateMilestoneChoices([null,...legacyClaims]),mapped,
  'Sparse Firebase-style lists do not discard actual claims');
assert.throws(()=>milestone.migrateMilestoneChoices([...legacyClaims,{type:'stats',allocation:{fuerza:2}}]),
  /datos incompletos/,'Malformed existing claims must block a potentially lossy save');
assert.throws(()=>milestone.migrateMilestoneChoices([...legacyClaims,sourceCopy[0]]),
  /duplicados/,'Conflicting existing claims must not be overwritten');

// Codex P1: top-level claims can coexist with an empty or partial build
// claim store. Both must be migrated BEFORE checking and appending rewards.
const legacyTopLevel = {
  classMilestones:[
    {classId:'fighter',milestoneLevel:20,type:'stats',allocation:{fuerza:2},selectedAt:111,notes:'original-stats'},
    {classId:'fighter',milestoneLevel:30,type:'trait',traitId:'general_keen',selectedAt:222,notes:'original-trait'},
    {classId:'monk',milestoneLevel:40,type:'trait',traitId:'superior_technique',selectedAt:333},
  ],
  characterBuild:{classMilestones:{fighter:{
    40:{classId:'fighter',milestoneLevel:40,type:'stats',allocation:{constitucion:2},selectedAt:444},
  }}},
};
const legacyBefore=structuredClone(legacyTopLevel);
const mergedClaims=milestone.mergeMilestoneChoices(legacyTopLevel);
assert.deepEqual(legacyTopLevel,legacyBefore,'Merge must not alter either original store');
assert.deepEqual(mergedClaims.fighter["20"],legacyBefore.classMilestones[0]);
assert.deepEqual(mergedClaims.fighter["30"],legacyBefore.classMilestones[1]);
assert.deepEqual(mergedClaims.fighter["40"],legacyBefore.characterBuild.classMilestones.fighter["40"]);
assert.deepEqual(mergedClaims.monk["40"],legacyBefore.classMilestones[2]);
assert.equal(milestone.choiceAt(mergedClaims,'fighter',20)?.type,'stats');
assert.equal(milestone.choiceAt(mergedClaims,'fighter',30)?.traitId,'general_keen');
assert.deepEqual(milestone.selectedGeneralTraitIds(legacyTopLevel),['general_keen','superior_technique'],
  'Trait resolution must consider top-level claims even when nested store exists');
assert.deepEqual(milestone.selectedGeneralTraitIds({characterBuild:{classMilestones:mergedClaims}}),
  ['general_keen','superior_technique'],'Both Traits remain available after canonical migration');
assert.deepEqual(milestone.mergeMilestoneChoices({classMilestones:legacyTopLevel.classMilestones}),
  milestone.migrateMilestoneChoices(legacyTopLevel.classMilestones),
  'Top-level-only claims must survive a first canonical write');
assert.deepEqual(milestone.mergeMilestoneChoices({characterBuild:{classMilestones:legacyTopLevel.classMilestones}}),
  milestone.migrateMilestoneChoices(legacyTopLevel.classMilestones),
  'Nested-only claims must still survive');
assert.deepEqual(milestone.mergeMilestoneChoices({classMilestones:mergedClaims,characterBuild:{classMilestones:mergedClaims}}),
  mergedClaims,'Identical copies must not trigger a false conflict');
assert.deepEqual(milestone.mergeMilestoneChoices({classMilestones:{'fighter:20':legacyBefore.classMilestones[0]},
  characterBuild:{classMilestones:{fighter:{30:legacyBefore.classMilestones[1]}}}}),
  {fighter:{"20":legacyBefore.classMilestones[0],"30":legacyBefore.classMilestones[1]}},
  'Flat and nested Milestone keys must merge safely');
assert.throws(()=>milestone.mergeMilestoneChoices({
  classMilestones:legacyTopLevel.classMilestones,
  characterBuild:{classMilestones:{fighter:{20:{type:'stats',allocation:{destreza:2},selectedAt:999}}}},
}),/duplicados incompatibles/,'Conflicting history must abort without rewriting stats');
assert.throws(()=>milestone.mergeMilestoneChoices({
  classMilestones:legacyTopLevel.classMilestones,
  characterBuild:{classMilestones:[{type:'trait',traitId:'general_keen'}]},
}),/datos incompletos/,'Malformed nested history must abort the entire write');

const noSelection={characterBuild:{
  classes:{fighter:{levels:40}},archetypes:{fighter:{archetypeId:'champion'}},
}};
assert.equal(choices.maneuverLimit(noSelection),0,'Other fighter specialization must not unlock maneuvers');


// Codex P1: Stats chosen by the player must update the DM studio's actual
// baseStats source in the SAME transaction as effective stats.
const studioPlayer = {
  stats:{fuerza:14,destreza:12},
  baseStats:{fuerza:12,destreza:11},
  characterBuild:{classes:[{classId:'fighter',levels:40}],classMilestones:{}},
};
const awarded = milestone.applyPlayerStatAllocation(studioPlayer,{fuerza:2});
assert.equal(awarded.valid,true);
assert.equal(awarded.stats.fuerza,16);
assert.equal(awarded.baseStats.fuerza,14);
assert.equal(studioPlayer.stats.fuerza,14,'No mutation before Firebase commit');
assert.equal(studioPlayer.baseStats.fuerza,12,'No mutation of base before commit');
assert.equal(awarded.baseStats.fuerza+2,awarded.stats.fuerza,
  'Unrelated DM edits recomputing Stats from baseStats+racial bonus preserve the milestone');
const legacyAward = milestone.applyPlayerStatAllocation({stats:{fuerza:14}},{fuerza:2});
assert.equal(legacyAward.valid,true);
assert.equal(legacyAward.baseStats,null,'Do not create a fake baseStats source on legacy player');
assert.equal(milestone.applyPlayerStatAllocation(
  {stats:{fuerza:14},baseStats:{fuerza:'invalid'}},{fuerza:2}).valid,false,
  'Corrupt studio stat must abort instead of writing half a reward');

const oldClaim = {
  classId:'fighter',milestoneLevel:20,type:'stats',
  allocation:{fuerza:2},selectedAt:111,notes:'pre-migration claim',
};
const remainingTopClaim = {
  classId:'fighter',milestoneLevel:30,type:'trait',
  traitId:'general_keen',selectedAt:222,
};
const remainingNestedClaim = {
  classId:'fighter',milestoneLevel:40,type:'stats',
  allocation:{destreza:2},selectedAt:333,
};
const doubleStore = {
  stats:{fuerza:16,destreza:14},
  baseStats:{fuerza:14,destreza:13},
  classMilestones:[oldClaim,remainingTopClaim],
  characterBuild:{classMilestones:{fighter:{'40':remainingNestedClaim}}},
};
assert.equal(revert.milestoneChoiceAt(doubleStore,'fighter',20)?.type,'stats');
const revertedLegacy = revert.revertMilestoneState(doubleStore,'fighter',20);
assert.equal(revertedLegacy.valid,true,'DM revert works on top-level legacy claims');
assert.equal(revertedLegacy.player.stats.fuerza,14);
assert.equal(revertedLegacy.player.baseStats.fuerza,12);
assert.equal(revertedLegacy.player.classMilestones,undefined,
  'No top-level shadow claims remain after canonical migration and reversion');
assert.equal(milestone.choiceAt(revertedLegacy.player.characterBuild.classMilestones,'fighter',20),null,
  'Reverted reward stays absent and can be claimed again');
assert.deepEqual(revertedLegacy.player.characterBuild.classMilestones.fighter['30'],remainingTopClaim,
  'Other legacy claims survive reversion');
assert.deepEqual(revertedLegacy.player.characterBuild.classMilestones.fighter['40'],remainingNestedClaim,
  'Existing canonical claims survive reversion');
assert.ok(milestone.selectedGeneralTraitIds(revertedLegacy.player).includes('general_keen'));
assert.equal(doubleStore.stats.fuerza,16,'Revert does not mutate input');
const revertedTrait = revert.revertMilestoneState(revertedLegacy.player,'fighter',30);
assert.equal(revertedTrait.valid,true);
assert.ok(!milestone.selectedGeneralTraitIds(revertedTrait.player).includes('general_keen'),
  'A reverted legacy General Trait does not remain active');
assert.equal(revertedTrait.player.stats.fuerza,14,'Reverting Trait does not modify Stats');
const conflictRevert = revert.revertMilestoneState({
  stats:{fuerza:16},
  classMilestones:{fighter:{20:{...oldClaim,allocation:{fuerza:2}}}},
  characterBuild:{classMilestones:{fighter:{20:{...oldClaim,allocation:{destreza:2}}}}},
},'fighter',20);
assert.equal(conflictRevert.valid,false,'Conflicting duplicate rewards must fail closed');

const script=fs.readFileSync(path.join(root,'js/player-progression-tree.js'),'utf8');
assert.match(script,/renderMilestone\?\.\(/);
assert.match(script,/renderManeuvers\?\.\(/);
assert.match(script,/player-progression-preview-features/);
assert.match(script,/milestoneNodes\?\.\(/);
assert.match(script,/player-progression-branch-configure/);
console.log('player-progression-choices-smoke: ok ('+totalGrantCount+' documented preview grants; Battle Master and Class Milestones checked)');
