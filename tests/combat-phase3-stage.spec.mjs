import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { seedPhase0, readEmulator } from './fixtures/combat-phase0-fixture.mjs';
import { openSession, ARTIFACTS } from './fixtures/combat-online-browser.mjs';

for (const mobile of [false, true]) test(`layered stage: real DM placement and Player reload (mobile=${mobile})`, async ({browser}) => {
  const fixture=await seedPhase0(), sessions=[];
  fs.mkdirSync(ARTIFACTS,{recursive:true});
  try {
    const player=await openSession(browser,fixture.users.a,8,{compatibility:false,hasTouch:mobile});sessions.push(player);
    const dm=await openSession(browser,fixture.users.dm,8,{compatibility:false,hasTouch:mobile});sessions.push(dm);
    for(const session of sessions) await session.page.waitForFunction(()=>window.LuminousCombatAuthority073?.state.authorityRef && window.LuminousCombatStage073?.state.mounted && !document.getElementById('game-container').classList.contains('intro-running'));
    await expect(player.page.locator('#combat-stage-placement')).toHaveCount(0);
    if(mobile) { await dm.page.setViewportSize({width:390,height:844}); await player.page.setViewportSize({width:390,height:844}); }
    await dm.page.locator('#c073-dm-setup > summary').click();
    await dm.page.locator('#combat-stage-placement').click();
    await expect(dm.page.locator('#combat-stage-tools')).toBeVisible();
    await dm.page.locator('#combat-stage-unit').selectOption('player:a');
    const rect=await dm.page.locator('#battlefield').boundingBox();
    // Browser click events use integer CSS pixels. Assert the exact canonical
    // point represented by that pixel, not an unrepresentable fractional pixel.
    const ground=[Math.round(rect.x+rect.width*.50),Math.round(rect.y+rect.height*.70)];
    const expected={x:Math.round((ground[0]-rect.x)/rect.width*10000)/100,
      y:Math.round((1-(ground[1]-rect.y)/rect.height)*10000)/100};
    if(mobile)await dm.page.touchscreen.tap(...ground);
    else await dm.page.mouse.click(...ground);
    await expect.poll(async()=> (await readEmulator('campaña/combate/combatants/player:a'))?.x).toBe(expected.x);
    await expect.poll(async()=> (await readEmulator('campaña/combate/combatants/player:a'))?.y).toBe(expected.y);
    await expect.poll(()=>player.page.evaluate(()=>window.LuminousCombat073.combatants()['player:a'].x)).toBe(expected.x);
    await dm.page.locator('#combat-stage-done').click();
    await expect(dm.page.locator('#combat-stage-tools')).toBeHidden();
    await player.page.reload({waitUntil:'domcontentloaded'});
    await player.page.waitForFunction(expected=>{const unit=window.LuminousCombat073?.combatants?.()['player:a'];return unit?.x===expected.x && unit?.y===expected.y && !document.getElementById('game-container').classList.contains('intro-running');},expected);
    // Existing VIEW verb reveals the field; no injected alternate gameplay UI.
    await player.page.keyboard.press('v');
    await player.page.waitForTimeout(650);
    const scene=await player.page.evaluate(()=>({
      layers:[...document.querySelectorAll('.combat-stage-layer')].map(el=>({class:el.className,image:getComputedStyle(el).backgroundImage,transform:getComputedStyle(el).transform})),
      placement:window.LuminousCombat073.combatants()['player:a'],
      tokens:['player:a','player:b'].map(id=>({id,depth:document.getElementById(`token-${id}`).style.getPropertyValue('--scene-depth-scale'),order:getComputedStyle(document.getElementById(`token-${id}`)).zIndex})),
      canvases:document.querySelectorAll('#webgl2-combat-canvas').length
    }));
    expect(scene.layers).toHaveLength(4);expect(scene.canvases).toBe(1);
    expect(scene.layers.every(layer=>layer.image.includes('/assets/combat-stage/'))).toBe(true);
    expect(Number(scene.tokens[0].depth)).toBeGreaterThan(Number(scene.tokens[1].depth));
    expect(Number(scene.tokens[0].order)).toBeGreaterThan(Number(scene.tokens[1].order));
    for(const file of ['horizon','architecture','ground','foreground']) {
      expect(await player.page.evaluate(async file=>{const image=new Image();image.src=`assets/combat-stage/${file}.svg`;await image.decode();return image.naturalWidth>0;},file)).toBe(true);
    }
    await player.page.screenshot({path:`${ARTIFACTS}/phase3-${mobile?'portrait':'desktop'}.png`});
    // Same local scenery and DOM hit targets survive explicit GPU fallback.
    await player.page.evaluate(()=>window.LuminousWebGL2Renderer?.setEnabled(false));
    await expect(player.page.locator('#webgl2-dom-background')).toHaveCSS('opacity','1');
    await player.page.screenshot({path:`${ARTIFACTS}/phase3-${mobile?'portrait':'desktop'}-fallback.png`});
    if(mobile) {
      await player.page.setViewportSize({width:844,height:390});
      await player.page.waitForTimeout(650);
      await player.page.keyboard.press('v'); // resize keeps normal menu camera; VIEW restores full field.
      await player.page.waitForTimeout(650);
      await player.page.screenshot({path:`${ARTIFACTS}/phase3-landscape.png`});
    }
    fs.writeFileSync(`${ARTIFACTS}/phase3-${mobile?'portrait':'desktop'}.json`,JSON.stringify(scene,null,2));
    for(const session of sessions) {expect(session.errors).toEqual([]);expect(session.forbidden).toEqual([]);}
  } finally {for(const session of sessions)await session.context.close();}
});
