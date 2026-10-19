import {test,expect} from '@playwright/test';
import fs from 'node:fs';
import {seedPhase0,readEmulator,writeEmulator} from './fixtures/combat-phase0-fixture.mjs';
import {openSession,ARTIFACTS} from './fixtures/combat-online-browser.mjs';

const deck={tier1:'agatha_ignovus_twosome_time',tier2:'agatha_ignovus_charged_shot',tier3:'agatha_ignovus_honeycomb_fire'};
for(const mobile of [false,true])test(`assigned catalog Skills survive stale Unit and resolve an animated Clash (mobile=${mobile})`,async({browser})=>{
  test.setTimeout(180000);fs.mkdirSync(ARTIFACTS,{recursive:true});
  const fixture=await seedPhase0(),sessions=[];
  const player={...fixture.campaign.jugadores.a,characterBuild:{classes:[{classId:'fighter',levels:1}],skillDeck:deck}};
  delete player.skillIds;delete player.skillSlotIds;delete player.equippedSkillIndex;
  await writeEmulator('campaña/jugadores/a',player);
  await writeEmulator('campaña/combate/combatants/player:b',null);
  // Definitions intentionally exist only in the same bundled catalog as the
  // assignment UI, while both linked Unit and deployed snapshot retain old_strike.
  try{
    const dm=await openSession(browser,fixture.users.dm,8,{compatibility:false});sessions.push(dm);
    await expect.poll(async()=>Object.keys((await readEmulator('campaña/combate/combatants/player:a/equippedSkillIndex'))||{}).sort()).toEqual(Object.values(deck).sort());
    expect(await readEmulator('campaña/base_datos_unidades/unit-a/skillIds')).toEqual(['old_strike']);
    expect(await readEmulator(`campaña/base_datos_skills/${deck.tier1}`)).toBeNull();
    const a=await openSession(browser,fixture.users.a,8,{compatibility:false,hasTouch:mobile});sessions.push(a);
    const page=a.page;
    if(mobile)await page.setViewportSize({width:390,height:844});
    await page.waitForFunction(()=>window.LuminousCombatAudiovisual073?.state.mounted&&!document.getElementById('game-container').classList.contains('intro-running'));
    await expect(page.locator('.command[data-menu="view"]')).toHaveCount(0);
    await page.keyboard.press('v');expect(await page.evaluate(()=>window.LuminousCombat073.uiState().view)).toBe(false);
    await page.waitForFunction(ids=>ids.every(id=>window.LuminousCombatLiveAdapter073.state.skills[id]),Object.values(deck));
    await page.evaluate(()=>{
      window.__clashVisuals=[];
      new MutationObserver(()=>{for(const n of document.querySelectorAll('#combat-av-layer [data-profile]'))window.__clashVisuals.push({profile:n.dataset.profile,marker:n.dataset.marker});}).observe(document.getElementById('combat-av-layer'),{childList:true,subtree:true});
    });
    const click=async loc=>mobile?loc.tap():loc.click();
    await click(page.locator('.command[data-menu="skills"]'));
    const choice=page.locator('#category-body .skill-option:not(.skill-preview)').first();
    await expect(choice).toBeVisible();
    expect(await choice.innerText()).toMatch(/Twosome Time|Charged Shot|Honeycomb Fire/);
    await expect(page.locator('#category-body')).not.toContainText('Golpe sencillo');
    await page.screenshot({path:`${ARTIFACTS}/skills-menu-${mobile?'mobile':'desktop'}.png`});
    await click(choice);await click(page.locator('#action-confirm'));
    if(mobile)await click(page.locator('#combat-target-list button[data-target-owner="enemy:dummy"]').first());
    else await click(page.locator('.action-slot-wrapper.target-valid[data-owner-id="enemy:dummy"]').first());
    await expect(page.locator('#clash-forecast-confirm')).toBeVisible();
    await click(page.locator('#clash-forecast-confirm'));
    const selected=await page.evaluate(()=>window.LuminousCombat073.plans()[0].data.id);
    expect(Object.values(deck)).toContain(selected);
    await click(page.locator('#ready'));
    await page.waitForFunction(()=>document.querySelector('#combat-av-layer [data-profile]'),null,{timeout:60000});
    await page.screenshot({path:`${ARTIFACTS}/skills-clash-${mobile?'mobile':'desktop'}.png`,animations:'allow'});
    await expect.poll(async()=>(await readEmulator('campaña/combate/authority/current'))?.phase,{timeout:90000}).toBe('complete');
    await page.waitForFunction(()=>!window.LuminousCombatAuthority073.state.runningLocal&&window.LuminousCombat073.uiState().round===2);
    const evidence=await page.evaluate(()=>({events:window.LuminousCombatStepRuntime.events(),visuals:window.__clashVisuals,actions:window.LuminousCombatAuthority073.state.localActionSeq,draws:window.__phase2RuleDraws||0}));
    expect(evidence.events.some(e=>/Clash/.test(e.type))).toBe(true);
    expect(evidence.visuals.length).toBeGreaterThan(0);
    expect(evidence.actions).toBe(0);expect(evidence.draws).toBe(0);
    const result=await readEmulator('campaña/combate/authority/current');
    expect(result.checkpoint.combatants['enemy:dummy'].hp).toBeLessThan(150);
    await page.reload();await page.waitForFunction(()=>window.LuminousCombat073?.uiState().round===2);
    await page.waitForFunction(ids=>ids.every(id=>window.LuminousCombatLiveAdapter073.state.skills[id]),Object.values(deck));
    for(const s of sessions){expect(s.errors).toEqual([]);expect(s.forbidden).toEqual([]);}
    fs.writeFileSync(`${ARTIFACTS}/skills-clash-${mobile?'mobile':'desktop'}.json`,JSON.stringify({selected,evidence,result,errors:sessions.map(s=>({errors:s.errors,forbidden:s.forbidden}))},null,2));
  }finally{for(const s of sessions)await s.context.close();}
});
