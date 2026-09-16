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
assert.ok(!source.includes('renderer.setEnabled(false)'),'DM observer must never turn off the renderer used for VFX/arrows');
assert.ok(source.includes('renderer.setEnabled(true)'),'DM observer must restore WebGL rendering if it was disabled before DM view is established');
assert.ok(source.includes('renderer.requestRender?.(220)'),'DM observer must explicitly invalidate the demand renderer after forcing full-battle view');
assert.ok(source.includes("global.LuminousCombat073?.camera?.('full',false)"),'DM observer must reassert full arena after hydration/resize');
assert.ok(source.includes('function ensureVisualSurface()'),'DM observer must own an explicit visual-surface recovery path');
assert.ok(source.includes("game.style.visibility='visible'")&&source.includes("game.style.opacity='1'"),'DM visual recovery must force the actual HUD surface visible');
assert.ok(source.includes("game.classList.remove('player-blinded','webgl2-background-ready')"),'DM base battlefield must stay on DOM instead of trusting the WebGL background');
assert.ok(source.includes("img.classList.remove('webgl2-texture-backed')"),'DM sprites must stay DOM-visible even when textures are available to WebGL');
assert.ok(source.includes("game.dataset.dmVisualMode='dom-base-webgl-vfx'"),'DM visual mode must explicitly declare DOM base + WebGL VFX composition');
assert.ok(source.includes('function observeVisualSurface()'),'DM observer must watch for renderer classes being reintroduced after hydration/texture load');
assert.ok(source.includes("game.classList.contains('webgl2-background-ready')"),'visual observer must detect when WebGL tries to reclaim the DM background');
assert.ok(source.includes("game.querySelector('.sprite-img.webgl2-texture-backed')"),'visual observer must detect when WebGL tries to reclaim DM sprites');

assert.ok(source.includes("return value==='left'||value==='right'?value:'right'"),'battle sprites must use a deterministic source-facing convention');
assert.ok(source.includes("?'left':'right'"),'Limbus battlefield orientation must make enemies face left and allies face right');
assert.ok(source.includes("classList.toggle('luminous-flip-x',flip)"),'runtime must flip only sprites whose source facing differs from their battlefield side');
assert.ok(source.includes('.sprite-container.luminous-flip-x .sprite-img{transform:scaleX(-1)!important'),'facing override must beat the legacy enemy transform rule');
assert.ok(source.includes("global.addEventListener('luminous:combat073-hydrated'"),'facing and DM visibility must be reasserted after live Firebase hydration');
assert.ok(!source.includes('LuminousVttActorLibrary')&&!source.includes('CombatEngine'),'DM observer must not revive removed legacy systems');

console.log('combat v0.7.3 DM observer + persistent DOM base + Limbus facing smoke: ok');
