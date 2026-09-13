import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('js/combat-v073-dm-setup.js', 'utf8');

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

console.log('combat v0.7.3 DM asset/skill editor smoke: ok');
