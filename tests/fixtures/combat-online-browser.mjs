import { expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { emulatorHosts, seedPhase0, readEmulator, PROJECT, NAMESPACE, PASSWORD, sprite } from './combat-phase0-fixture.mjs';

const require = createRequire(import.meta.url);
const BASE = 'http://127.0.0.1:4173';
const sdkDir = path.dirname(require.resolve('firebase/package.json'));
export const ARTIFACTS = 'artifacts/combat-phase0';

export async function openSession(browser, user, seed, { compatibility = true, hasTouch = false } = {}) {
  const hosts = emulatorHosts();
  const context = await browser.newContext({ viewport: { width: 1365, height: 768 }, hasTouch });
  await context.addInitScript(value => { window.LuminousCombatPlaybackCompatibility = value; }, compatibility);
  const errors = [];
  const consoleErrors = [];
  const ruleMismatches = [];
  const forbidden = [];
  const realtime = [];
  await context.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if(url.pathname==='/js/combat-v073-authority.js'&&(url.hostname==='127.0.0.1'||url.hostname==='localhost')){
      let body=fs.readFileSync('js/combat-v073-authority.js','utf8');
      body=body.replace('function makeSeed(round){',`function makeSeed(round){return ${seed};`);
      const needle='const snapshot=snapshotRuntime(),localDigest=checkpointDigest(snapshot,state.current.round);';
      if(!body.includes(needle))throw new Error('Missing checkpoint diagnostic seam');
      body=body.replace(needle,`const snapshot=snapshotRuntime();(global.__phase1Checkpoints??=[]).push({seq:state.localActionSeq,cursor:state.cursor,snapshot:clone(snapshot)});const localDigest=checkpointDigest(snapshot,state.current.round);`);
      if(!compatibility && user.email.startsWith('a-') || !compatibility && user.email.startsWith('b-')) {
        body=body.replace('function randomRaw(){', "function randomRaw(){global.__phase2RuleDraws=(global.__phase2RuleDraws||0)+1;");
      }
      return route.fulfill({status:200,contentType:'application/javascript',body});
    }
    if (url.hostname === '127.0.0.1' || url.hostname === 'localhost') return route.continue();
    const script = url.pathname.match(/\/firebase-(app|auth|database)\.js$/)?.[1];
    if (url.hostname === 'www.gstatic.com' && script) {
      let body = fs.readFileSync(path.join(sdkDir, `firebase-${script}-compat.js`), 'utf8');
      if (script === 'database') body += `\n
        firebase.initializeApp(${JSON.stringify({ apiKey: 'fake', projectId: PROJECT, databaseURL: `https://${NAMESPACE}.firebaseio.com` })});
        firebase.auth().useEmulator(${JSON.stringify(`http://${hosts.auth}`)}, {disableWarnings:true});
        firebase.database().useEmulator(${JSON.stringify(hosts.database.split(':')[0])},${Number(hosts.database.split(':')[1])});
        window.__phase0AuthReady=firebase.auth().signInWithEmailAndPassword(${JSON.stringify(user.email)},${JSON.stringify(PASSWORD)});`;
      return route.fulfill({ status: 200, contentType: 'application/javascript', body });
    }
    if (/(^|\.)(firebaseio\.com|firebaseapp\.com|firebasedatabase\.app)$/.test(url.hostname) || /^(identitytoolkit|securetoken)\.googleapis\.com$/.test(url.hostname)) forbidden.push(url.hostname);
    if (request.resourceType() === 'image') return route.fulfill({ status: 200, contentType: 'image/svg+xml', body: decodeURIComponent(sprite.split(',')[1]) });
    return route.abort();
  });
  await context.addInitScript(()=>{
    window.__phase1Lifecycle=[];let previous='';
    setInterval(()=>{
      const a=window.LuminousCombatAuthority073?.state,s=window.LuminousCombatLiveAdapter073?.state;
      const value={phase:a?.current?.phase,checkpoint:a?.current?.checkpoint?.seq,round:s?.round,
        local:a?.runningLocal,autoStartedRound:a?.autoStartedRound,actions:a?.localActionSeq,
        active:window.LuminousCombatRuntimeHotfix073?.state.active,started:a?.started,visibility:document.visibilityState};
      const signature=JSON.stringify(value);
      if(signature!==previous){previous=signature;window.__phase1Lifecycle.push(value);}
    },100);
  });
  const page = await context.newPage();
  page.on('pageerror', (error) => errors.push(String(error.stack || error)));
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
    if(message.text().includes('deterministic mismatch'))ruleMismatches.push(message.text());
  });
  page.on('websocket', (socket) => {
    const record = (direction, frame) => {
      try {
        const packet = JSON.parse(String(frame.payload));
        const data = packet.d;
        // Record paths and key names only; never record Auth tokens or payload values.
        if (data?.a === 'auth' || data?.a === 'gauth') return;
        realtime.push({ direction, type: packet.t, action: data?.a, request: data?.r,
          path: data?.b?.p, status: data?.b?.s, keys: Object.keys(data?.b?.d || {}).slice(0, 12) });
        if (realtime.length > 100) realtime.shift();
      } catch (_) {}
    };
    socket.on('framesent', (frame) => record('sent', frame));
    socket.on('framereceived', (frame) => record('received', frame));
  });
  await page.goto(`${BASE}/Battle-viewer.html`, { waitUntil: 'domcontentloaded' });
  try {
    await page.waitForFunction(() => window.LuminousCombatLiveAdapter073?.state.firebaseReady && window.LuminousCombat073?.combatants?.()?.['player:a'], null, { timeout: 20000 });
  } catch (error) {
    const diagnostic = await page.evaluate(async () => {
      const adapter = window.LuminousCombatLiveAdapter073;
      const state = adapter?.state || {};
      const direct = await Promise.race([
        state.db.ref(adapter.ROOTS.combatants).once('value').then((snap) => ({ keys: Object.keys(snap.val() || {}), url: snap.ref.toString() }), (error) => ({ error: String(error) })),
        new Promise((resolve) => setTimeout(() => resolve({ error: 'direct-read-timeout' }), 2000)),
      ]);
      return { bootstrap: window.LuminousCombatBootstrapState, status: document.getElementById('status')?.textContent,
        adapterVersion: adapter.version, roots: adapter.ROOTS, subscriptions: state.unsubscribers.length, direct,
        role: state.role, playerId: state.playerId, firebaseReady: state.firebaseReady, runtimeReady: state.runtimeReady,
        players: Object.keys(state.players || {}), combatants: Object.keys(state.combatants || {}),
        field: Object.entries(state.combatants || {}).map(([id, unit]) => ({ id, field: adapter.isFieldCombatant(unit), playerId: unit.canonicalPlayerKey || unit.ownerPlayerId || unit.playerId })),
        runtimeCombatants: Object.keys(window.LuminousCombat073?.combatants?.() || {}),
        database: window.firebase?.app?.().options.databaseURL,
        lifecycleActive: window.LuminousCombatRuntimeHotfix073?.state.active,
      };
    });
    fs.mkdirSync(ARTIFACTS, { recursive: true });
    fs.writeFileSync(`${ARTIFACTS}/boot-diagnostic.json`, JSON.stringify({ ...diagnostic, errors, consoleErrors, forbidden, realtime, canonicalCombatants: Object.keys(await readEmulator('campaña/combate/combatants') || {}) }, null, 2));
    console.error('Combat boot diagnostic:', JSON.stringify(diagnostic));
    await page.screenshot({ path: `${ARTIFACTS}/boot-failure.png` });
    await context.close();
    throw error;
  }
  return { context, page, errors, forbidden, ruleMismatches };
}

export async function saveLiveDeck(page, fixture) {
  for (const file of ['dm-player-loadout-core.js', 'combat-skill-loadout-074.js', 'dm-player-loadout-manager.js']) {
    await page.addScriptTag({ url: `${BASE}/js/${file}` });
  }
  return page.evaluate(async ({ player, units, skills }) => {
    // Only the production manager's existing input host is provided by this
    // harness. Writes use the real DM Auth session and production saveDeck.
    const host = document.createElement('div');
    host.hidden = true;
    for (const [index, value] of ['phase0_cut', 'phase0_thrust', 'phase0_finish'].entries()) {
      const field = document.createElement('input'); field.id = `dm-loadout-tier-${index + 1}`; field.value = value; host.appendChild(field);
    }
    for (const name of ['deck-feedback', 'save-deck']) {
      const node = document.createElement('span'); node.id = `dm-loadout-${name}`; host.appendChild(node);
    }
    document.body.appendChild(host);
    const manager = window.LuminousDmPlayerLoadoutManager;
    Object.assign(manager.state, { db: firebase.database(), playerId: 'a', player, units, skills });
    return manager.saveDeck();
  }, { player: fixture.campaign.jugadores.a, units: fixture.units, skills: fixture.skills });
}

export async function planAndReady(page) {
  await page.waitForFunction(() => window.LuminousCombatEconomyMenu073?.state.installed && !document.getElementById('game-container')?.classList.contains('intro-running'));
  // The game's keyboard shortcut opens its real Skills menu.
  await page.keyboard.press('s');
  const card = page.locator('#category-body .skill-option').first();
  await expect(card).toBeVisible();
  await card.click();
  await page.locator('#action-confirm').click();
  const target = page.locator('.action-slot-wrapper.target-valid[data-owner-id="enemy:dummy"]').first();
  await expect(target).toBeVisible();
  await target.click();
  if (await page.locator('#clash-forecast-confirm').isVisible()) await page.locator('#clash-forecast-confirm').click();
  await page.waitForFunction(() => window.LuminousCombat073.plans()[0]?.targetId === 'enemy:dummy');
  await page.locator('#ready').click();
}
