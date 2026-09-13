import assert from 'node:assert/strict';
import fs from 'node:fs';

const viewer=fs.readFileSync('Battle-viewer.html','utf8');
const source=fs.readFileSync('js/combat-v073-dm-observer.js','utf8');

assert.ok(viewer.includes('js/combat-v073-dm-observer.js'),'Viewer must load DM observer mode');
assert.ok(source.includes("adapterState()?.role==='dm'"),'DM observer must be gated by canonical DM role');
assert.ok(source.includes("original('full',false)"),'DM camera must force full battlefield framing');
assert.ok(source.includes("game.classList.remove('player-blinded')"),'DM observer must ignore player Blindness blackout');
assert.ok(source.includes("'invisible-hidden','invisible-detected'"),'DM observer must ignore observer-local Invisibility hiding');
assert.ok(source.includes("wrapGlobalFunction('syncBlindnessVisual'"),'Blindness visual sync must be role-aware');
assert.ok(source.includes("wrapGlobalFunction('syncInvisibilityVisuals'"),'Invisibility visual sync must be role-aware');
assert.ok(source.includes('renderer.setEnabled(false)'),'DM observer must disable continuous WebGL rendering to reduce GPU load');
assert.ok(source.includes("global.LuminousCombat073?.camera?.('full',false)"),'DM observer must reassert full arena after hydration/resize');
assert.ok(!source.includes('LuminousVttActorLibrary')&&!source.includes('CombatEngine'),'DM observer must not revive removed legacy systems');

console.log('combat v0.7.3 DM observer smoke: ok');
