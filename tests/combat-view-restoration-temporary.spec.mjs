import {test,expect} from '@playwright/test';
import fs from 'node:fs';
const source=fs.readFileSync('tests/combat-v073-player-menu-visual.spec.mjs','utf8');
let stub=source.slice(source.indexOf('const FIREBASE_STUB = `')+'const FIREBASE_STUB = `'.length,source.indexOf('\n`;'));
stub=stub.replace('const players={p1:player};',`player.skillIds=['ci_player_skill'];player.skillSlotIds=['ci_player_skill'];player.equippedSkillIndex={ci_player_skill:true};
const players={p1:player};`);
stub=stub.replace("const combatants={'player:p1':combatant};",`combatant.actionSlots=1;combatant.activeSlots=1;combatant.hp=100;combatant.sp=0;
const enemy={...combatant,id:'enemy:e1',combatId:'enemy:e1',name:'GUARDIAN',characterName:'GUARDIAN',faction:'enemy',actorCategory:'npc',category:'enemy',canonicalScope:'unit',isPlayer:false,playerId:null,ownerPlayerId:null,canonicalPlayerKey:null,ownerUid:null,canonicalOwnerUid:null,classes:[],spellIds:[],spellSelections:[],inventario_activo:{}};
const combatants={'player:p1':combatant,'enemy:e1':enemy};`);
const sizes=[[320,568],[390,844],[844,390],[1365,768]];
for(const [width,height] of sizes){
  test(`view and Clash at ${width}x${height}`,async({browser})=>{
    const context=await browser.newContext({viewport:{width,height},hasTouch:width<1000,isMobile:width<1000,reducedMotion:'no-preference'});
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.route('**/*',async route=>{
      const url=route.request().url();
      if(url.startsWith('http://127.0.0.1:4173/'))return route.continue();
      if(/firebase-app\.js/.test(url))return route.fulfill({contentType:'application/javascript',body:stub});
      if(/firebase-(auth|database)\.js/.test(url))return route.fulfill({contentType:'application/javascript',body:'/* local fixture */'});
      return route.abort();
    });
    fs.mkdirSync('artifacts/view-restoration',{recursive:true});
    try{
      await page.goto('http://127.0.0.1:4173/Battle-viewer.html');
      await page.waitForFunction(()=>window.LuminousCombat073?.combatants()?.['enemy:e1']&&window.LuminousCombatEconomyMenu073?.state.installed,{},{timeout:30000});
      await page.waitForFunction(()=>window.LuminousCombatEconomyMenu073?.liveActions('skill')?.some(s=>s.id==='ci_player_skill'));
      // Skip the intro delay through the existing initialization entry point.
      await page.evaluate(()=>window.LuminousCombat073.initialize({playIntro:false}));
      await page.waitForTimeout(1000);
      expect(await page.locator('#combat-own-status,#combat-action-readout').count()).toBe(0);
      await page.screenshot({path:`artifacts/view-restoration/${width}-root.png`});
      await page.locator('.command[data-menu=view]').click();
      await expect(page.locator('#game-container')).toHaveClass(/view-mode/);
      await page.screenshot({path:`artifacts/view-restoration/${width}-view.png`});
      await page.locator('#view-return').click();
      await expect(page.locator('#game-container')).not.toHaveClass(/view-mode/);
      await page.waitForTimeout(600);
      if(width>=1000){await page.keyboard.press('v');await expect(page.locator('#game-container')).toHaveClass(/view-mode/);await page.keyboard.press('Escape');await page.waitForTimeout(600);}
      await page.evaluate(()=>{
        const units=window.LuminousCombat073.combatants();
        units['player:p1'].speed=9;units['enemy:e1'].speed=1;
        const action=window.LuminousCombatEconomyMenu073.liveActions('skill')[0];
        units['enemy:e1'].autoPlans=[{type:'granted',data:{...action,name:'Guardian Strike',basePower:3,coinPower:1,coinAmount:2},targetId:'player:p1',targetSlotIndex:0,sourceSlotIndex:0}];
        window.renderAllPlannedSlots();window.renderTargetArrows();
      });
      await page.locator('.command[data-menu=skills]').click();
      await page.locator('#category-body .skill-option').filter({hasText:'CI Visible Skill'}).first().click();
      await page.locator('#action-confirm').click();
      if(width<1000)await page.locator('#combat-target-list button').filter({hasText:'GUARDIAN'}).first().click();
      else await page.locator('[data-owner-id="enemy:e1"].action-slot-wrapper').first().click();
      await expect(page.locator('#clash-forecast-confirm')).toBeVisible();
      const geometry=await page.locator('#clash-forecast .clash-forecast-skill-hud').evaluateAll(nodes=>nodes.map(n=>{const r=n.getBoundingClientRect(),s=n.closest('.clash-forecast-side').getBoundingClientRect();return{display:getComputedStyle(n).display,x:r.x,right:r.right,width:r.width,sideX:s.x,sideRight:s.right};}));
      for(const r of geometry){expect(r.display).not.toBe('none');expect(r.x).toBeGreaterThanOrEqual(-1);expect(r.right).toBeLessThanOrEqual(width+1);if(width<1000){expect(r.x).toBeGreaterThanOrEqual(r.sideX-1);expect(r.right).toBeLessThanOrEqual(r.sideRight+1);}}
      const button=await page.locator('#clash-forecast-confirm').boundingBox();expect(button.y+button.height).toBeLessThanOrEqual(height);expect(button.height).toBeGreaterThanOrEqual(width<1000?44:34);
      await page.screenshot({path:`artifacts/view-restoration/${width}-forecast.png`});
      await page.locator('#clash-forecast-confirm').click();
      await expect(page.locator('#clash-forecast-confirm')).toHaveCount(0);
      expect(await page.evaluate(()=>window.LuminousCombat073.plans()[0]?.clashConfirmed)).toBe(true);
      await page.waitForTimeout(700);await page.locator('#ready').click();
      expect(await page.evaluate(()=>window.LuminousCombat073.uiState().ready)).toBe(true);
      // Replay presentation cues using the real ribbons/coin animation, without
      // letting a Player run the authority or touching a production database.
      await page.evaluate(async()=>{
        const runtime=window.LuminousCombat073,enemy=runtime.combatants()['enemy:e1'];
        const a={ownerId:'player:p1',localIndex:0,plan:runtime.plans()[0]},b={ownerId:'enemy:e1',localIndex:0,plan:enemy.autoPlans[0]};
        window.__viewQA={a,b};
        window.LuminousCombatStepRuntime.beginPlayback(1);
        await window.LuminousCombatStepRuntime.present('clashStart',[a,b,2,2]);
        await window.LuminousCombatStepRuntime.present('powerStart',[a,2,5]);
        await window.LuminousCombatStepRuntime.present('powerStart',[b,2,3]);
        window.showClashCount(a,b,1);
        await window.LuminousCombatStepRuntime.present('powerCoin',[a,{index:0,side:'head',src:window.LuminousCoinEngine.HEAD_SRC},8,2]);
      });
      await page.waitForTimeout(200);
      const ribbons=page.locator('.clash-float-hud.open:not(.clash-forecast-skill-hud)');await expect(ribbons).toHaveCount(2);
      const live=await ribbons.evaluateAll(nodes=>nodes.map(n=>{const r=n.getBoundingClientRect();return{display:getComputedStyle(n).display,visible:getComputedStyle(n).visibility,x:r.x,y:r.y,right:r.right,bottom:r.bottom,parent:n.parentElement.id,power:n.querySelector('.clash-float-power').textContent};}));
      for(const r of live){expect(r.display).not.toBe('none');expect(r.visible).toBe('visible');if(width<1000){expect(r.parent).toBe('combat-mobile-clash-layer');expect(r.x).toBeGreaterThanOrEqual(0);expect(r.right).toBeLessThanOrEqual(width);expect(r.y).toBeGreaterThanOrEqual(0);expect(r.bottom).toBeLessThanOrEqual(height);}}
      expect(live.some(r=>r.power==='8')).toBe(true);
      await page.screenshot({path:`artifacts/view-restoration/${width}-clash.png`});
      // Rotating while a Clash is live must not duplicate or lose the nodes.
      if(width<1000){await page.setViewportSize({width:height,height:width});await page.waitForTimeout(600);await expect(ribbons).toHaveCount(2);expect(await page.locator('#battlefield').evaluate(n=>n.classList.contains('camera-focus'))).toBe(false);await page.screenshot({path:`artifacts/view-restoration/${width}-rotated.png`});}
      await page.evaluate(()=>{const {a,b}=window.__viewQA;window.closeFloatingClashHud(a);window.closeFloatingClashHud(b);window.LuminousCombatStepRuntime.finishPlayback(2);});
      await expect(ribbons).toHaveCount(0);
      expect(errors).toEqual([]);
      console.log(JSON.stringify({width,height,geometry,live,errors}));
    }catch(error){await page.screenshot({path:`artifacts/view-restoration/${width}-failure.png`});console.log(await page.evaluate(()=>({state:window.LuminousCombat073?.uiState(),status:document.getElementById('status')?.textContent,category:document.getElementById('category-body')?.textContent})));throw error;}
    finally{await context.close();}
  });
}
