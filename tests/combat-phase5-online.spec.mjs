import {test,expect} from '@playwright/test';
import fs from 'node:fs';
import {seedPhase0,readEmulator,writeEmulator} from './fixtures/combat-phase0-fixture.mjs';
import {openSession,planAndReady,ARTIFACTS} from './fixtures/combat-online-browser.mjs';
async function options(page,{speed='1',quality='full',sound=true}={}){
  await page.locator('#combat-av-settings summary').click();
  await page.locator('#combat-av-sound').setChecked(sound);
  await page.locator('#combat-av-speed').selectOption(speed);
  await page.locator('#combat-av-quality').selectOption(quality);
  await page.locator('#combat-av-settings summary').click();
}
async function fireBolt(page,touch){
  const click=async locator=>touch?locator.tap():locator.click();
  await click(page.locator('.command[data-menu="spells"]'));
  await click(page.locator('#category-body .skill-option').filter({hasText:'Fire Bolt'}).first());
  await click(page.locator('#action-confirm'));
  if(touch)await click(page.locator('#combat-target-list button[data-target-owner="enemy:dummy"]').first());
  else await click(page.locator('.action-slot-wrapper.target-valid[data-owner-id="enemy:dummy"]').first());
  if(await page.locator('#clash-forecast-confirm').isVisible())await click(page.locator('#clash-forecast-confirm'));
  await page.waitForFunction(()=>window.LuminousCombat073.plans()[0]?.data?.id==='fire_bolt'||window.LuminousCombat073.plans()[0]?.data?.skillId==='fire_bolt');
  await click(page.locator('#ready'));
}
for(const fast of [false,true])test(`phase5 canonical Fire Bolt, effects/audio fallback and same result (fast=${fast})`,async({browser})=>{
  test.setTimeout(180000);fs.mkdirSync(ARTIFACTS,{recursive:true});
  const fixture=await seedPhase0(),sessions=[];
  const build={classes:[{classId:'sorcerer',levels:1}],spellSelections:['fire_bolt']};
  for(const path of ['campaña/jugadores/a','campaña/base_datos_unidades/unit-a','campaña/combate/combatants/player:a']){
    await writeEmulator(`${path}/characterBuild`,build);await writeEmulator(`${path}/spellIds`,['fire_bolt']);await writeEmulator(`${path}/sp`,30);
  }
  try{
    for(const role of ['a','b','dm'])sessions.push({role,...await openSession(browser,fixture.users[role],8,{compatibility:false,hasTouch:!fast})});
    const a=sessions[0].page,b=sessions[1].page,dm=sessions[2].page;
    for(const{page}of sessions){
      page.setDefaultTimeout(20000);await page.waitForFunction(()=>window.LuminousCombatAudiovisual073?.state.mounted&&window.LuminousCombatAuthority073?.state.authorityRef&&!document.getElementById('game-container').classList.contains('intro-running'));
      if(fast)await page.evaluate(()=>{window.AudioContext=class{constructor(){throw Error('TEST_AUDIO_UNAVAILABLE');}};window.webkitAudioContext=window.AudioContext;});
      await options(page,{speed:fast?'2':'1',quality:fast?'off':'full',sound:true});
    }
    if(!fast){await a.setViewportSize({width:390,height:844});await a.waitForTimeout(700);}
    await a.evaluate(()=>{
      window.__phase5Visuals=[];
      new MutationObserver(()=>{const state=window.LuminousCombatAudiovisual073.state;for(const node of document.querySelectorAll('#combat-av-layer [data-profile]'))window.__phase5Visuals.push({profile:node.dataset.profile,marker:node.dataset.marker||'cutin',voices:state.voices.size,unlocked:state.unlocked});}).observe(document.getElementById('combat-av-layer'),{childList:true,subtree:true});
    });
    await fireBolt(a,!fast);await planAndReady(b);
    if(!fast){
      await a.waitForFunction(()=>document.querySelector('#combat-av-layer [data-profile="fire_bolt"][data-marker="impact"]'),null,{timeout:60000});
      await a.evaluate(()=>{for(const node of document.querySelectorAll('#combat-av-layer [data-marker="impact"]'))for(const animation of node.getAnimations())animation.pause();});
      await a.screenshot({path:`${ARTIFACTS}/phase5-mobile-fire-impact.png`});
      await a.evaluate(()=>{for(const node of document.querySelectorAll('#combat-av-layer [data-marker="impact"]'))for(const animation of node.getAnimations())animation.play();});
    }
    await expect.poll(async()=> (await readEmulator('campaña/combate/authority/current'))?.phase,{timeout:90000}).toBe('complete');
    const result=await readEmulator('campaña/combate/authority/current');
    const expected=Object.fromEntries(Object.entries(result.checkpoint.combatants).map(([id,u])=>[id,{hp:u.hp,sp:u.sp}]));
    for(const page of [a,b]){
      await page.waitForFunction(()=>!window.LuminousCombatAuthority073.state.runningLocal&&window.LuminousCombatAuthority073.state.current.phase==='complete');
      await expect.poll(()=>page.evaluate(()=>Object.fromEntries(Object.entries(window.LuminousCombat073.combatants()).map(([id,u])=>[id,{hp:u.hp,sp:u.sp}])))).toEqual(expected);
    }
    const evidence=await a.evaluate(()=>({visuals:window.__phase5Visuals,events:window.LuminousCombatStepRuntime.events(),actions:window.LuminousCombatAuthority073.state.localActionSeq,draws:window.__phase2RuleDraws||0,active:window.LuminousCombatAudiovisual073.state.nodes.size,animations:window.LuminousCombatAudiovisual073.state.animations.size,voices:window.LuminousCombatAudiovisual073.state.voices.size,prefs:window.LuminousCombatAudiovisual073.preferences(),audio:window.LuminousCombatAudiovisual073.state.context?.state||null}));
    expect(evidence.events.some(event=>event.type==='HitResolved')).toBe(true);expect(evidence.actions).toBe(0);expect(evidence.draws).toBe(0);expect(evidence.active).toBe(0);expect(evidence.animations).toBe(0);expect(evidence.voices).toBe(0);
    if(fast){
      const baseline=JSON.parse(fs.readFileSync(`${ARTIFACTS}/phase5-full.json`,'utf8')).result;
      expect(result.resultDigest).toBe(baseline.resultDigest);expect(result.checkpoint.rngCursor).toBe(baseline.checkpoint.rngCursor);expect(result.checkpoint.combatants).toEqual(baseline.checkpoint.combatants);expect(evidence.visuals).toEqual([]);expect(evidence.audio).toBeNull();
    }else{
      expect(evidence.visuals.some(v=>v.profile==='fire_bolt'&&v.marker==='projectile')).toBe(true);expect(evidence.visuals.some(v=>v.profile==='fire_bolt'&&v.marker==='impact')).toBe(true);expect(evidence.visuals.some(v=>v.voices>0&&v.unlocked)).toBe(true);
    }
    await expect(a.locator('#ready')).toBeEnabled();await expect(a.locator('#round')).toHaveText('2');
    await a.screenshot({path:`${ARTIFACTS}/phase5-final-${fast?'fast':'full'}.png`});
    fs.writeFileSync(`${ARTIFACTS}/phase5-${fast?'fast':'full'}.json`,JSON.stringify({result,evidence,errors:sessions.map(s=>({role:s.role,errors:s.errors,forbidden:s.forbidden}))},null,2));
    for(const session of sessions){expect(session.errors).toEqual([]);expect(session.forbidden).toEqual([]);}
  }finally{for(const session of sessions)await session.context.close().catch(()=>{});}
});
