import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('js/combat-v073-dm-setup.js', 'utf8');
const combatTab = fs.readFileSync('js/dm-combat-tab-manager.js', 'utf8');
const utils = fs.readFileSync('js/utils.js', 'utf8');
const dmPanel = fs.readFileSync('pantalla_dm.html', 'utf8');

assert.ok(source.includes("skills:'campaña/base_datos_skills'"), 'DM setup must load canonical Skill Library');
assert.ok(source.includes('COMBAT ASSET + SKILL EDITOR'), 'DM setup must expose the Combat Asset + Skill editor');
assert.ok(source.includes('SAVE SPRITE'), 'DM setup must allow saving Combat Sprites');
assert.ok(source.includes('SAVE EQUIPPED SKILLS'), 'DM setup must allow assigning equipped Skills');
assert.ok(source.includes('saveCombatSprite'), 'Combat Sprite persistence API must exist');
assert.ok(source.includes('saveSkills'), 'Skill loadout persistence API must exist');
assert.ok(source.includes("kind==='player'"), 'editor must support Players');
assert.ok(source.includes("kind==='npc'"), 'editor must support NPC Actors');
assert.ok(source.includes("`${ROOTS.units}/${id}`"), 'editor must support Unit Library records');
assert.ok(source.includes('equippedSkillIndex:equipped(cleanIds)'), 'saved Skills must produce canonical equipped Skill provenance');
assert.ok(source.includes('skillSlotIds:cleanIds'), 'saved Skills must preserve canonical slot ids');
assert.ok(source.includes('combatSprite:src'), 'saved Combat Sprite must use canonical combatSprite field');
assert.ok(source.includes("filter(([,u])=>!isPlayerUnit(u))"), 'encounter selector must only deploy real non-player Unit Library entries');
assert.ok(!source.includes('LuminousVttActorLibrary') && !source.includes('CombatEngine'), 'editor must not revive VTT or legacy CombatEngine');

assert.ok(dmPanel.includes('data-tab="tab-combate"'), 'DM panel must keep the existing Combat menu button');
assert.ok(dmPanel.includes('id="tab-combate"'), 'DM panel must expose the existing Combat tab host');
assert.ok(utils.includes('ensureDmCombatTabManagerAssets'), 'utils must attach the Combat Library Manager to the existing DM Combat tab');
assert.ok(utils.includes("'js/dm-combat-tab-manager.js'"), 'DM Combat tab integration script must be loaded from the panel');
assert.ok(combatTab.includes("getElementById('tab-combate')"), 'Combat Library Manager must mount inside the existing DM Combat tab');
assert.ok(combatTab.includes('Combat Library'), 'Combat tab must contain the Combat Library UI');
assert.ok(combatTab.includes('SYNC UNIT LIBRARY'), 'Combat tab must expose canonical Unit Library sync');
assert.ok(combatTab.includes('Combat Sprite Mockup'), 'Combat tab must expose the Combat Sprite mockup');
assert.ok(combatTab.includes('ARRASTRA EL SPRITE'), 'sprite mockup must support direct dragging');
assert.ok(combatTab.includes('dm-combat-tab-sprite-x') && combatTab.includes('dm-combat-tab-sprite-y') && combatTab.includes('dm-combat-tab-sprite-scale'), 'sprite mockup must expose X/Y/Scale controls');
assert.ok(combatTab.includes('SAVE COMBAT SPRITE'), 'Combat tab must persist the edited Combat Sprite');
assert.ok(combatTab.includes("legacyNpcs: 'campaña/base_datos_npcs'"), 'Combat Library must bridge the historical NPC database used by the DM Actor Studio');
assert.ok(combatTab.includes("subscribe(ROOTS.legacyNpcs, 'legacyNpcs')"), 'Combat Library must actually subscribe to historical NPC records');
assert.ok(combatTab.includes('onAuthStateChanged'), 'Firebase library listeners must wait for authentication instead of binding anonymously');
assert.ok(combatTab.includes('ENEMIES · ALL SOURCES'), 'enemy selector must combine canonical Units with hostile Actor/NPC sources');
assert.ok(combatTab.includes('dm-combat-tab-sprite-placeholder'), 'mock battlefield must remain visually useful when a sprite is absent or broken');
assert.ok(combatTab.includes('SPRITE NO\\nCARGA') && combatTab.includes('SIN COMBAT\\nSPRITE'), 'mock battlefield must diagnose missing/broken sprites instead of rendering blank');
assert.ok(combatTab.includes('120 / 120 HP') && combatTab.includes('ffe877'), 'mock battlefield must include visible combat UI context, not an empty stage');
assert.ok(combatTab.includes("updates[`${ROOTS.units}/${id}`]"), 'Unit sync must update canonical Unit records individually');
assert.ok(combatTab.includes("updates[`${ROOTS.skills}/${id}`]"), 'Skill sync must preserve the canonical Skill Library while updating catalog entries');
assert.ok(!combatTab.includes('LuminousVttActorLibrary') && !combatTab.includes('CombatEngine'), 'Combat tab manager must not revive VTT or legacy CombatEngine');

console.log('combat v0.7.3 DM asset/skill editor + authenticated multi-source Combat Library smoke: ok');
