import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { emulatorHosts, seedPhase0, readEmulator, PROJECT, NAMESPACE, PASSWORD, sprite } from './fixtures/combat-phase0-fixture.mjs';

import { openSession, saveLiveDeck, planAndReady, ARTIFACTS } from './fixtures/combat-online-browser.mjs';

for (const [silentPlayer,seed] of [[false,8],[true,8],[false,42]]) test(`authenticated DM and two Players share kit, sealed round and final vitals (silent Player: ${silentPlayer}, seed: ${seed})`, async ({ browser }) => {
  const fixture = await seedPhase0();
  const sessions = [];
  fs.mkdirSync(ARTIFACTS, { recursive: true });
  try {
    // The DM joins last so initial field/Speed authority does not race fixture setup.
    for (const role of ['a', 'b', 'dm']) sessions.push({ role, ...await openSession(browser, fixture.users[role],seed) });
    for(const {page} of sessions){
      await page.waitForFunction(()=>window.LuminousCombatAuthority073?.state.authorityRef&&window.LuminousCombatAuthority073.state.originalStartRound);
      await page.evaluate(()=>firebase.database().ref('campaña/combate/authority/current').once('value').then(()=>true));
    }
    const playerA = sessions.find((s) => s.role === 'a').page;
    const playerB = sessions.find((s) => s.role === 'b').page;
    const dm = sessions.find((s) => s.role === 'dm').page;
    if(silentPlayer)await playerB.evaluate(()=>window.LuminousCombatStepRuntime.setPresentationEnabled(false));
    expect(await saveLiveDeck(dm, fixture)).toBe(true);
    await playerA.waitForFunction(() => window.LuminousCombat073.combatants()['player:a'].skillIds.includes('phase0_cut'));
    await playerB.waitForFunction(() => window.LuminousCombat073.combatants()['player:a'].skillIds.includes('phase0_cut'));
    const denied = await playerA.evaluate(() => firebase.database().ref('campaña/combate/authority/current').set({ phase: 'running', round: 1, seed: 999 }).then(() => 'accepted', (error) => error.code));
    expect(denied).toBe('PERMISSION_DENIED');
    await dm.screenshot({ path: `${ARTIFACTS}/dm-desktop.png` });
    await playerA.screenshot({ path: `${ARTIFACTS}/player-desktop.png` });
    await playerA.setViewportSize({ width: 390, height: 844 });
    await playerA.waitForTimeout(700);
    await playerA.screenshot({ path: `${ARTIFACTS}/player-portrait.png` });
    await playerA.setViewportSize({ width: 844, height: 390 });
    await playerA.waitForTimeout(700);
    await playerA.screenshot({ path: `${ARTIFACTS}/player-landscape.png` });
    await playerA.setViewportSize({ width: 1365, height: 768 });
    await planAndReady(playerA);
    await planAndReady(playerB);
    await dm.waitForFunction(()=>window.LuminousCombatStepRuntime.events().some(e=>e.type==='CoinRolled'));
    await dm.screenshot({path:`${ARTIFACTS}/phase1-${silentPlayer?'mixed':'animated'}-${seed}-coin.png`});
    await dm.waitForFunction(()=>window.LuminousCombatStepRuntime.events().some(e=>e.type==='HitResolved'));
    await dm.screenshot({path:`${ARTIFACTS}/phase1-${silentPlayer?'mixed':'animated'}-${seed}-hit.png`});
    await expect.poll(async () => (await readEmulator('campaña/combate/authority/current'))?.phase, { timeout: 90000 }).toBe('complete');
    const result = await readEmulator('campaña/combate/authority/current');
    fs.writeFileSync(`${ARTIFACTS}/round-diagnostic.json`, JSON.stringify({ result,
      canonicalCombatants: await readEmulator('campaña/combate/combatants'),
      viewers: await Promise.all(sessions.map(async ({ role, page, errors, forbidden }) => ({ role, errors, forbidden,
        ...await page.evaluate(() => ({ status: document.getElementById('status')?.textContent,
          round: document.getElementById('round')?.textContent, plans: window.LuminousCombat073.plans(),
          units: Object.fromEntries(Object.entries(window.LuminousCombat073.combatants()).map(([id, unit]) => [id, { hp: unit.hp, sp: unit.sp }])) })),
      }))),
    }, null, 2));
    fs.copyFileSync(`${ARTIFACTS}/round-diagnostic.json`,`${ARTIFACTS}/round-diagnostic-${silentPlayer?'mixed':'animated'}-${seed}.json`);
    expect(result.checkpoint.seq).toBeGreaterThan(0);
    expect(result.checkpoint.combatants['enemy:dummy'].hp).toBeLessThan(150);
    const expectedVitals = Object.fromEntries(Object.entries(result.checkpoint.combatants).map(([id, unit]) => [id, { hp: unit.hp, sp: unit.sp }]));
    const finalViewers = [];
    for (const { role, page, errors, forbidden, ruleMismatches } of sessions) {
      await page.waitForFunction(() => {
        const state = window.LuminousCombatAuthority073?.state;
        return state?.current.phase === 'complete' && !state.runningLocal && !state.pendingFinalSnapshot;
      });
      await expect.poll(() => page.evaluate(() => Object.fromEntries(Object.entries(window.LuminousCombat073.combatants()).map(([id, unit]) => [id, { hp: unit.hp, sp: unit.sp }]))), { timeout: 10000 }).toEqual(expectedVitals);
      await expect.poll(() => page.locator('#round').textContent(), { timeout: 10000 }).toBe('2');
      finalViewers.push({ role, round: 2, vitals: expectedVitals });
      expect(errors).toEqual([]);

      expect(forbidden).toEqual([]);
    }
    const stepTraces=await Promise.all(sessions.map(async({role,page})=>({role,...await page.evaluate(()=>({
      events:window.LuminousCombatStepRuntime.events(),rngCursor:window.LuminousCombatAuthority073.state.cursor,
      localDigests:[...window.LuminousCombatAuthority073.state.localDigests],
      lifecycle:window.__phase1Lifecycle,localCheckpoints:window.__phase1Checkpoints||[],
      execution:{autoStartedRound:window.LuminousCombatAuthority073.state.autoStartedRound,
        actions:window.LuminousCombatAuthority073.state.localActionSeq,active:window.LuminousCombatRuntimeHotfix073.state.active,
        authorityStarted:window.LuminousCombatAuthority073.state.started,visibility:document.visibilityState},
      presentation:window.LuminousCombatStepRuntime.presentationEnabled()
    }))})));
    fs.writeFileSync(`${ARTIFACTS}/phase1-steps-${silentPlayer?'mixed':'animated'}-${seed}.json`,JSON.stringify(stepTraces,null,2));
    for(const {ruleMismatches} of sessions)expect(ruleMismatches).toEqual([]);
    const dmTrace=stepTraces.find(s=>s.role==='dm');
    for(const trace of stepTraces){
      expect(trace.events).toEqual(dmTrace.events);
      expect(trace.rngCursor).toEqual(dmTrace.rngCursor);
      expect(trace.localDigests).toEqual(dmTrace.localDigests);
    }
    expect(dmTrace.events.some(e=>e.type==='CoinRolled')).toBe(true);
    expect(dmTrace.events.some(e=>e.type==='DamageApplied')).toBe(true);
    expect(dmTrace.events.at(-1).type).toBe('RoundFinished');
    await playerA.reload({ waitUntil: 'domcontentloaded' });
    await playerA.waitForFunction(() => window.LuminousCombat073?.combatants?.()?.['player:a']);
    const reloaded = await playerA.evaluate(() => ({ hp: window.LuminousCombat073.combatants()['player:a'].hp, sp: window.LuminousCombat073.combatants()['player:a'].sp, round: window.LuminousCombatLiveAdapter073.state.round }));
    expect(reloaded.hp).toBe(result.checkpoint.combatants['player:a'].hp);
    expect(reloaded.sp).toBe(result.checkpoint.combatants['player:a'].sp);
    expect(reloaded.round).toBe(2);
    fs.writeFileSync(`${ARTIFACTS}/online-result.json`, JSON.stringify({ project: PROJECT, sessions: 3, round: 1, nextRound: 2, resultDigest: result.resultDigest, checkpointSeq: result.checkpoint.seq, finalViewers, reloaded }, null, 2));
  } finally {
    for (const session of sessions) await session.context.close();
  }
});
