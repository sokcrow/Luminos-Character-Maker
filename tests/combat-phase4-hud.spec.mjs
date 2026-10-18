import {test,expect} from '@playwright/test';
import fs from 'node:fs';
import {seedPhase0,readEmulator,writeEmulator} from './fixtures/combat-phase0-fixture.mjs';
import {openSession,planAndReady,ARTIFACTS} from './fixtures/combat-online-browser.mjs';
async function inside(page,selector){
  const rows=await page.locator(selector).evaluateAll(nodes=>nodes.map(node=>{const r=node.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height};}));
  const size=page.viewportSize();expect(rows.length).toBeGreaterThan(0);
  for(const r of rows){expect(r.x).toBeGreaterThanOrEqual(-1);expect(r.y).toBeGreaterThanOrEqual(-1);expect(r.x+r.w).toBeLessThanOrEqual(size.width+1);expect(r.y+r.h).toBeLessThanOrEqual(size.height+1);expect(r.h).toBeGreaterThanOrEqual(43);}
}
async function chooseSkill(page,touch){
  const click=async locator=>touch?locator.tap():locator.click();
  await click(page.locator('.command[data-menu="skills"]'));
  await click(page.locator('#category-body .skill-option').first());
  await expect.poll(()=>page.locator('#game-container').evaluate(node=>({x:node.scrollLeft,y:node.scrollTop}))).toEqual({x:0,y:0});
  await inside(page,'#action-confirm');await click(page.locator('#action-confirm'));
  if(touch){const target=page.locator('#combat-target-list button[data-target-owner="enemy:dummy"]').first();await expect(target).toBeVisible();await inside(page,'#combat-target-list button');await target.tap();}
  else await page.locator('.action-slot-wrapper.target-valid[data-owner-id="enemy:dummy"]').first().click();
  const confirm=page.locator('#clash-forecast-confirm');
  if(await confirm.isVisible()){await inside(page,'#clash-forecast-confirm');await click(confirm);}
  await page.waitForFunction(()=>window.LuminousCombat073.plans()[0]?.targetId==='enemy:dummy');
  await click(page.locator('#ready'));
}
for(const reduced of [false,true])test(`integrated product HUD: menus, Coins and same online result (reduced=${reduced})`,async({browser})=>{
  test.setTimeout(180000);fs.mkdirSync(ARTIFACTS,{recursive:true});
  const fixture=await seedPhase0(),sessions=[];
  if(reduced){
    await writeEmulator('campaña/base_datos_skills/Guard',{id:'Guard',skillId:'Guard',name:'Guard',kind:'defense',defenseType:'guard',basePower:15,coinPower:3,coinAmount:1,damageType:'Guard',sinAffinity:'sinless',economyCost:'action'});
    for(const path of ['campaña/jugadores/b','campaña/base_datos_unidades/unit-b','campaña/combate/combatants/player:b']){
      await writeEmulator(`${path}/skillIds`,['old_strike','Guard']);await writeEmulator(`${path}/skillSlotIds`,['old_strike','Guard']);await writeEmulator(`${path}/equippedSkillIndex/Guard`,true);
    }
  }
  try{
    for(const role of ['a','b','dm'])sessions.push({role,...await openSession(browser,fixture.users[role],8,{compatibility:false,hasTouch:!reduced})});
    const a=sessions[0].page,b=sessions[1].page,dm=sessions[2].page;
    for(const{page}of sessions){page.setDefaultTimeout(15000);await page.emulateMedia({reducedMotion:reduced?'reduce':'no-preference'});await page.waitForFunction(()=>window.LuminousCombatAuthority073?.state.authorityRef&&window.LuminousCombatHudMotion073?.state.mounted&&!document.getElementById('game-container').classList.contains('intro-running'));}
    await expect(dm.locator('#c073-dm-setup')).not.toHaveAttribute('open','');
    for(const viewport of reduced?[{width:1365,height:768}]:[{width:390,height:844},{width:844,height:390},{width:390,height:844}]){
      await a.setViewportSize(viewport);await a.waitForTimeout(700);
      await expect(a.locator('#combat-own-name')).toHaveText('Agatha');await inside(a,'.command:visible');
      await a.screenshot({path:`${ARTIFACTS}/phase4-root-${viewport.width}-${reduced?'reduced':'motion'}.png`});
    }
    for(const menu of ['defense','items','spells']){
      const command=a.locator(`.command[data-menu="${menu}"]`);
      if(!await command.isVisible()||await command.isDisabled())continue;
      await command.click();await expect(a.locator('#category-surface')).toBeVisible();await inside(a,'#category-surface');
      if(menu==='defense'){
        await a.locator('#category-body .skill-option').first().click();await expect(a.locator('#action-confirm')).toBeVisible();await inside(a,'#action-confirm');
        await a.screenshot({path:`${ARTIFACTS}/phase4-defense-${reduced?'reduced':'motion'}.png`});await a.keyboard.press('Escape');
      }
      await a.keyboard.press('Escape');await expect(a.locator('.command[data-menu="skills"]')).toBeVisible();
    }
    await a.evaluate(()=>{
      window.__phase4Poses=[];
      new MutationObserver(rows=>{for(const row of rows)if(row.attributeName==='data-combat-pose')window.__phase4Poses.push({id:row.target.id,pose:row.target.dataset.combatPose});}).observe(document.getElementById('battlefield'),{subtree:true,attributes:true,attributeFilter:['data-combat-pose']});
    });
    await chooseSkill(a,!reduced);
    if(reduced){
      await b.locator('.command[data-menu="defense"]').click();await b.locator('#category-body .skill-option').filter({hasText:'Guard'}).first().click();await b.locator('#action-confirm').click();
      await b.waitForFunction(()=>window.LuminousCombat073.plans()[0]?.data?.defenseType==='guard');await b.waitForTimeout(300);await b.locator('#ready').click();
    }else await planAndReady(b);
    await dm.waitForFunction(()=>window.LuminousCombatStepRuntime.events().some(event=>event.type==='CoinRolled'));
    if(!reduced){await expect(a.locator('#combat-action-readout')).toBeVisible({timeout:45000});await a.screenshot({path:`${ARTIFACTS}/phase4-resolution.png`});}
    await expect.poll(async()=> (await readEmulator('campaña/combate/authority/current'))?.phase,{timeout:90000}).toBe('complete');
    const result=await readEmulator('campaña/combate/authority/current');
    for(const page of [a,b])await page.waitForFunction(()=>!window.LuminousCombatAuthority073.state.runningLocal&&window.LuminousCombatAuthority073.state.current.phase==='complete');
    const expected=Object.fromEntries(Object.entries(result.checkpoint.combatants).map(([id,u])=>[id,{hp:u.hp,sp:u.sp}]));
    for(const page of [a,b])await expect.poll(()=>page.evaluate(()=>Object.fromEntries(Object.entries(window.LuminousCombat073.combatants()).map(([id,u])=>[id,{hp:u.hp,sp:u.sp}])))).toEqual(expected);
    await expect(a.locator('#round')).toHaveText('2');await expect(a.locator('#ready')).toBeEnabled();await expect(a.locator('#combat-action-readout')).toBeHidden();
    const evidence=await a.evaluate(()=>({poses:window.__phase4Poses,phase:document.getElementById('combat-phase-label').textContent,events:window.LuminousCombatStepRuntime.events(),actions:window.LuminousCombatAuthority073.state.localActionSeq,draws:window.__phase2RuleDraws||0,vitals:document.getElementById('combat-own-vitals').textContent}));
    expect(evidence.vitals).toContain(`HP ${expected['player:a'].hp} / 100`);expect(evidence.actions).toBe(0);expect(evidence.draws).toBe(0);expect(evidence.events.some(event=>event.type==='DamageApplied')).toBe(true);
    if(reduced)expect(evidence.events.some(event=>event.type==='ShieldApplied')).toBe(true);
    else expect(evidence.poses.some(row=>row.pose==='attack'||row.pose==='hit')).toBe(true);
    await a.screenshot({path:`${ARTIFACTS}/phase4-final-${reduced?'reduced':'motion'}.png`});
    fs.writeFileSync(`${ARTIFACTS}/phase4-${reduced?'reduced':'motion'}.json`,JSON.stringify({result,evidence,errors:sessions.map(s=>({role:s.role,errors:s.errors,forbidden:s.forbidden}))},null,2));
    for(const session of sessions){expect(session.errors).toEqual([]);expect(session.forbidden).toEqual([]);}
  }finally{for(const session of sessions)await session.context.close().catch(()=>{});}
});
