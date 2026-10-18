import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { seedPhase0, readEmulator, writeEmulator } from './fixtures/combat-phase0-fixture.mjs';
import { openSession, planAndReady, ARTIFACTS } from './fixtures/combat-online-browser.mjs';

for (const recover of [false, true]) test(`DM result playback with two Players: delayed/reloaded=${recover}`, async ({ browser }) => {
  test.setTimeout(180000);
  const fixture = await seedPhase0(), sessions = [];
  await writeEmulator('campaña/base_datos_skills/old_strike/coinAmount',3);
  fs.mkdirSync(ARTIFACTS, { recursive: true });
  try {
    for (const role of ['a', 'b', 'dm']) sessions.push({ role, ...await openSession(browser, fixture.users[role], 8, { compatibility: false }) });
    const a = sessions[0].page, b = sessions[1].page, dm = sessions[2].page;
    // A second authenticated DM tab competes for the same seal transaction.
    sessions.push({ role: 'dm-other', ...await openSession(browser, fixture.users.dm, 8, { compatibility: false }) });
    for (const { page } of sessions) {
      await page.waitForFunction(() => window.LuminousCombatAuthority073?.state.authorityRef && window.LuminousCombatStepRuntime && window.LuminousCombatPlaybackSync);
      await page.evaluate(() => firebase.database().ref('campaña/combate/authority/current').once('value').then(() => true));
    }
    for (const player of [a, b]) await player.evaluate(() => {
      // The real Player runtime must never enter its former rules executor.
      window.LuminousCombatAuthority073.state.originalStartRound = () => { throw new Error('PLAYER_EXECUTED_RULES'); };
    });
    if (recover) await b.evaluate(() => window.LuminousCombatStepRuntime.setPresentationEnabled(false));
    await planAndReady(a); await planAndReady(b);
    await expect.poll(async () => (await readEmulator('campaña/combate/authority/current'))?.phase).toBe('running');
    const sealed = await readEmulator('campaña/combate/authority/current');
    expect(sealed.playback.schemaVersion).toBe(1);
    const dmOwner = await dm.evaluate(id => window.LuminousCombatPlaybackSync.session === id, sealed.playback.session) ? dm : sessions[3].page;
    const dmOther = dmOwner === dm ? sessions[3].page : dm;
    expect(await dmOther.evaluate(() => window.LuminousCombatAuthority073.requestStartRound())).toBe(false);
    await a.waitForFunction(() => window.LuminousCombatAuthority073.state.runningLocal);
    await a.keyboard.press('s');
    await expect(a.locator('#category-surface')).not.toHaveClass(/open/);
    if (recover) {
      // Disconnect during Clash. The DM keeps its authority and commits while
      // the Player reloads into a real checkpoint subscription.
      await dmOwner.waitForFunction(() => window.LuminousCombatStepRuntime.events().some(e => e.type === 'CoinRolled'));
      await a.evaluate(() => firebase.database().goOffline());
      await a.waitForFunction(() => document.getElementById('status').textContent.includes('Reconectando'));
      await a.screenshot({ path: `${ARTIFACTS}/phase2-reconnecting.png` });
      await a.waitForTimeout(350);
      await a.reload({ waitUntil: 'domcontentloaded' });
      await a.waitForFunction(() => window.LuminousCombatLiveAdapter073?.state.hydratedOnce && window.LuminousCombatPlaybackSync?.state.generation);
    }
    await expect.poll(async () => (await readEmulator('campaña/combate/authority/current'))?.phase, { timeout: 90000 }).toBe('complete');
    if(recover){
      await a.waitForFunction(()=>window.LuminousCombatStepRuntime?.events().some(e=>e.type==='HitResolved'),null,{timeout:60000});
      await a.screenshot({path:`${ARTIFACTS}/phase2-mid-skill.png`});
      await a.reload({waitUntil:'domcontentloaded'});
      await a.waitForFunction(()=>window.LuminousCombatLiveAdapter073?.state.hydratedOnce && window.LuminousCombatPlaybackSync?.state.generation);
    }
    const result = await readEmulator('campaña/combate/authority/current');
    const stream = await readEmulator('campaña/combate/playback/current');
    const envelopes = Object.values(stream.batches);
    const batches = envelopes.map(row=>({...JSON.parse(row.payload),seq:row.seq}));
    expect(batches.at(-1).type).toBe('round_complete');
    expect(batches.map(row => row.seq)).toEqual(batches.map((_, i) => i + 1));
    expect(batches.at(-1).digest).toBe(result.resultDigest);
    const expected = Object.fromEntries(Object.entries(result.checkpoint.combatants).map(([id, unit]) => [id, { hp: unit.hp, sp: unit.sp }]));
    for (const player of [a, b]) {
      await player.waitForFunction(() => window.LuminousCombatAuthority073.state.current.phase === 'complete' && !window.LuminousCombatAuthority073.state.runningLocal);
      await expect.poll(() => player.evaluate(() => Object.fromEntries(Object.entries(window.LuminousCombat073.combatants()).map(([id, u]) => [id, { hp: u.hp, sp: u.sp }])))).toEqual(expected);
      await expect(player.locator('#round')).toHaveText('2');
      // Re-delivery is consumed by the actual production subscriber, not a
      // fake resolver. It cannot apply costs or present the same impact twice.
      const before = await player.evaluate(() => ({ state: JSON.stringify(window.LuminousCombatAuthority073.snapshotRuntime()), count: window.LuminousCombatStepRuntime.events().length }));
      await player.evaluate(async rows => {
        const consumer = window.LuminousCombatPlaybackSync.state.consumer;
        if (consumer) for (const row of [...rows].reverse().concat(rows)) await consumer.receive(row);
      }, envelopes);
      expect(await player.evaluate(() => ({ state: JSON.stringify(window.LuminousCombatAuthority073.snapshotRuntime()), count: window.LuminousCombatStepRuntime.events().length }))).toEqual(before);
      expect(await player.evaluate(() => window.LuminousCombatAuthority073.state.localActionSeq)).toBe(0);
      expect(await player.evaluate(() => window.__phase2RuleDraws||0)).toBe(0);
    }
    await a.screenshot({ path: `${ARTIFACTS}/phase2-${recover ? 'recovered' : 'complete'}.png` });
    const evidence = { generation: result.id, batches, result, viewers: await Promise.all(sessions.map(async ({ role, page, errors, forbidden }) => ({ role, errors, forbidden,
      ...await page.evaluate(() => ({ status: document.getElementById('status').textContent,
        vitals: Object.fromEntries(Object.entries(window.LuminousCombat073.combatants()).map(([id, u]) => [id, { hp: u.hp, sp: u.sp }])),
        localActions: window.LuminousCombatAuthority073.state.localActionSeq, cursor: window.LuminousCombatAuthority073.state.cursor,
        playbackCursor: window.LuminousCombatPlaybackSync.state.consumer?.cursor(), events: window.LuminousCombatStepRuntime.events() })) }))) };
    fs.writeFileSync(`${ARTIFACTS}/phase2-${recover ? 'recovered' : 'complete'}.json`, JSON.stringify(evidence, null, 2));
    for (const session of sessions) { expect(session.errors).toEqual([]); expect(session.forbidden).toEqual([]); }
    await a.reload({ waitUntil: 'domcontentloaded' });
    await a.waitForFunction(() => window.LuminousCombatLiveAdapter073?.state.round === 2 && window.LuminousCombat073?.combatants?.()['player:a']);
    await expect.poll(() => a.evaluate(() => window.LuminousCombat073.combatants()['player:a'].hp)).toBe(expected['player:a'].hp);
  } finally { for (const { context } of sessions) await context.close(); }
});
