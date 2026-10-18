import {test,expect} from '@playwright/test';
import fs from 'node:fs';
import {seedPhase0,readEmulator,writeEmulator,PASSWORD} from './fixtures/combat-phase0-fixture.mjs';
import {openSession,ARTIFACTS} from './fixtures/combat-online-browser.mjs';
async function login(page,user){
  await expect(page.locator('#combat-entry-login')).toBeVisible();
  await page.locator('#combat-entry-email').fill(user.email);await page.locator('#combat-entry-password').fill(PASSWORD);
  await page.locator('#combat-entry-login button').click();await expect(page.locator('#combat-entry-bar')).toBeVisible();
}
async function viewer(page){
  await expect(page.locator('#combat-entry-view')).toBeVisible();
  const frame=await page.locator('#combat-entry-view').elementHandle().then(node=>node.contentFrame());
  await frame.waitForFunction(()=>window.LuminousCombatLiveAdapter073?.state.firebaseReady&&window.LuminousCombatAuthority073?.state.authorityRef);
  return frame;
}
async function ready(frame,targetId){
  await frame.waitForFunction(()=>window.LuminousCombatEconomyMenu073?.state.installed&&!document.getElementById('game-container')?.classList.contains('intro-running'));
  await frame.locator('.command[data-menu="skills"]').click();await frame.locator('#category-body .skill-option').first().click();
  await frame.locator('#action-confirm').click();
  const list=frame.locator(`#combat-target-list button[data-target-owner="${targetId}"]`).first();
  if(await list.isVisible())await list.click();else await frame.locator(`.action-slot-wrapper.target-valid[data-owner-id="${targetId}"]`).first().click();
  if(await frame.locator('#clash-forecast-confirm').isVisible())await frame.locator('#clash-forecast-confirm').click();
  await frame.locator('#ready').click();
}
async function menu(page){if(!await page.locator('#combat-entry-menu').evaluate(n=>n.open))await page.locator('#combat-entry-menu summary').click();}
test('phase6 packaged entry: real login, create/deploy, two rounds, safe controls, reload and another encounter',async({browser})=>{
  test.setTimeout(300000);fs.mkdirSync(ARTIFACTS,{recursive:true});
  const fixture=await seedPhase0(),sessions=[];
  await writeEmulator('campaña/base_datos_unidades/training-target',fixture.campaign.combate.combatants['enemy:dummy']);
  await writeEmulator('campaña/combate',{estado:{encounterId:'previous',phase:'ENDED',active:false,round:4},authority:{current:{phase:'complete',round:3}},plannedActions:{stale:{0:{}}},readyPlayers:{stale:{ready:true}},playback:{current:{old:true}}});
  try{
    for(const role of ['a','b','dm']){
      const session=await openSession(browser,fixture.users[role],8,{compatibility:false,hasTouch:role==='a',entry:'/combate.html',autoSignIn:false,waitForCombat:false});sessions.push({role,...session});
      await expect(session.page.locator('#combat-entry-view')).toHaveCount(0);
      if(role==='a'){
        await session.page.setViewportSize({width:390,height:844});
        await session.page.locator('#combat-entry-email').fill(fixture.users.a.email);await session.page.locator('#combat-entry-password').fill('incorrect-password');await session.page.locator('#combat-entry-login button').click();
        await expect(session.page.locator('#combat-entry-message')).toContainText('Revisa tu correo');await expect(session.page.locator('#combat-entry-view')).toHaveCount(0);
      }
      await login(session.page,fixture.users[role]);
    }
    const [a,b,dm]=sessions.map(s=>s.page);
    await expect(a.locator('#combat-entry-start')).toBeHidden();await expect(a.locator('#combat-entry-message')).toContainText('finalizado');
    await dm.locator('#combat-entry-open').click();
    await expect.poll(async()=>(await readEmulator('campaña/combate/estado')).encounterId).not.toBe('previous');
    const encounter=(await readEmulator('campaña/combate/estado')).encounterId;expect(encounter).not.toBe('previous');
    for(const key of ['plannedActions','readyPlayers','authority','playback'])expect(await readEmulator(`campaña/combate/${key}`)).toBeNull();
    const dmView=await viewer(dm);await dmView.locator('#c073-dm-setup summary').click();
    for(const id of ['a','b']){await dmView.locator('#c073-player').selectOption(id);await dmView.locator('#c073-add-player').click();await expect.poll(async()=>Boolean(await readEmulator(`campaña/combate/combatants/player:${id}`))).toBe(true);}
    await dmView.locator('#c073-unit').selectOption('training-target');await dmView.locator('#c073-enemy').click();
    await expect.poll(async()=>Object.keys(await readEmulator('campaña/combate/combatants')||{}).length).toBe(3);
    const enemy=Object.keys(await readEmulator('campaña/combate/combatants')).find(id=>id.startsWith('enemy:'));
    const av=await viewer(a),bv=await viewer(b);
    await av.waitForFunction(id=>Boolean(window.LuminousCombat073.combatants()[id]),enemy);
    await bv.waitForFunction(id=>Boolean(window.LuminousCombat073.combatants()[id]),enemy);
    await dmView.locator('#c073-dm-setup summary').click();
    await a.screenshot({path:`${ARTIFACTS}/phase6-entry-player-mobile.png`});await dm.screenshot({path:`${ARTIFACTS}/phase6-entry-dm.png`});
    const rounds=[];
    for(const round of [1,2]){
      if(round===2){
        await menu(dm);await dm.locator('#combat-entry-presentation').selectOption('simple');
        await expect.poll(async()=>(await readEmulator('campaña/combate/estado')).presentation).toBe('simple');
        for(const frame of [av,bv,dmView])await frame.waitForFunction(()=>window.LuminousCombatStepRuntime.presentationEnabled()===false);
      }
      await ready(av,enemy);await ready(bv,enemy);
      await expect.poll(async()=>(await readEmulator('campaña/combate/authority/current'))?.phase,{timeout:45000}).toBe('running');
      await menu(dm);await expect(dm.locator('#combat-entry-end')).toBeDisabled();await expect(dm.locator('#combat-entry-presentation')).toBeDisabled();await dm.locator('#combat-entry-menu summary').click();
      await expect(dmView.locator('#c073-clear')).toBeDisabled();
      expect(await dmView.evaluate(()=>window.LuminousCombatDmSetup073.deployPlayer('a').then(()=>null,error=>error.message))).toContain('termine la ronda');
      const denied=await dm.evaluate(()=>window.LuminousCombatSession.end({db:firebase.database(),uid:firebase.auth().currentUser.uid,result:'victory'}).then(()=>null,error=>error.message));expect(denied).toContain('termine la ronda');
      await expect.poll(async()=>{const row=await readEmulator('campaña/combate/authority/current');return row?.phase==='complete'&&row.round===round;},{timeout:100000}).toBe(true);
      const result=await readEmulator('campaña/combate/authority/current');rounds.push({round,digest:result.resultDigest,cursor:result.checkpoint.rngCursor});
      const expected=Object.fromEntries(Object.entries(result.checkpoint.combatants).map(([id,u])=>[id,{hp:u.hp,sp:u.sp}]));
      for(const frame of [av,bv,dmView]){
        await frame.waitForFunction(()=>!window.LuminousCombatAuthority073.state.runningLocal);
        await expect.poll(()=>frame.evaluate(()=>Object.fromEntries(Object.entries(window.LuminousCombat073.combatants()).map(([id,u])=>[id,{hp:u.hp,sp:u.sp}])))).toEqual(expected);
        await expect(frame.locator('#round')).toHaveText(String(round+1));
      }
      for(const frame of [av,bv])expect(await frame.evaluate(()=>window.LuminousCombatAuthority073.state.localActionSeq)).toBe(0);
    }
    await a.reload({waitUntil:'domcontentloaded'});const reloaded=await viewer(a);await reloaded.waitForFunction(()=>window.LuminousCombatLiveAdapter073.state.round===3);
    await expect(a.locator('#combat-entry-login')).toBeHidden();
    await menu(dm);await dm.locator('#combat-entry-end').click();await dm.locator('#combat-entry-confirm-end').click();
    await expect(a.locator('#combat-entry-message')).toContainText('finalizado');
    await expect.poll(async()=>(await readEmulator('campaña/combate/estado')).result).toBe('victory');
    const vitals=await readEmulator('campaña/jugadores/a/combatStats');
    await dm.locator('#combat-entry-open').click();await expect.poll(async()=>(await readEmulator('campaña/combate/estado')).encounterId).not.toBe(encounter);
    await expect.poll(()=>readEmulator('campaña/combate/combatants')).toBeNull();expect(await readEmulator('campaña/jugadores/a/combatStats')).toEqual(vitals);
    await menu(a);await a.locator('#combat-entry-signout').click();await expect(a.locator('#combat-entry-login')).toBeVisible();await expect(a.locator('#combat-entry-view')).toHaveCount(0);
    fs.writeFileSync(`${ARTIFACTS}/phase6-entry.json`,JSON.stringify({rounds,errors:sessions.map(({role,errors,forbidden})=>({role,errors,forbidden})),entry:'combate.html',packaged:process.env.COMBAT_RELEASE_DIR||null},null,2));
    for(const session of sessions){expect(session.errors).toEqual([]);expect(session.forbidden).toEqual([]);}
  }finally{
    fs.writeFileSync(`${ARTIFACTS}/phase6-last-state.json`,JSON.stringify(await readEmulator('campaña/combate'),null,2));
    for(const session of sessions)await session.context.close().catch(()=>{});
  }
});
