import {test, expect} from '@playwright/test';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

const root = process.cwd(), base = 'http://127.0.0.1:4173';
const project = 'demo-combat-results', ns = project+'-default-rtdb';
let server;
async function admin(p, method='GET', data) {
  const response = await fetch(`http://127.0.0.1:9100/${p}.json?ns=${ns}`, {
    method, headers:{Authorization:'Bearer owner','Content-Type':'application/json'},
    ...(data === undefined ? {} : {body:JSON.stringify(data)}),
  });
  expect(response.ok, await response.clone().text()).toBe(true);
  return response.json();
}
async function account(name) {
  const email = name+Date.now()+'@example.test', password = 'temporary-password';
  const response = await fetch('http://127.0.0.1:9199/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake', {
    method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({email,password,returnSecureToken:true}),
  });
  const user = await response.json();
  expect(user.localId).toBeTruthy();
  return {email,password,uid:user.localId};
}
async function client(browser, user, playerId) {
  const context = await browser.newContext({viewport:{width:390,height:844}});
  const page = await context.newPage();
  page.on('pageerror',error=>console.log('LOOT_QA_PAGE_ERROR',playerId || 'dm',error.message));
  page.on('console',message=>{if(message.type()==='error')console.log('LOOT_QA_CONSOLE',playerId || 'dm',message.text());});
  console.log('LOOT_QA_CLIENT_BEGIN',playerId || 'dm');
  await context.route('**/*', route => route.request().url().startsWith(base) || /127\.0\.0\.1:9/.test(route.request().url())
    ? route.continue() : route.abort());
  await page.goto(base+'/loot-test');
  await page.evaluate(async ({user,playerId,project,ns}) => {
    firebase.initializeApp({apiKey:'fake', projectId:project, databaseURL:`http://127.0.0.1:9100/?ns=${ns}`});
    firebase.auth().useEmulator('http://127.0.0.1:9199', {disableWarnings:true});
    firebase.database().useEmulator('127.0.0.1',9100);
    await firebase.auth().signInWithEmailAndPassword(user.email,user.password);
    if (playerId) localStorage.setItem('playerId',playerId);
  }, {user,playerId,project,ns});
  await page.addScriptTag({url:base+'/js/loot-live-postcombat-runtime.js'});
  await page.evaluate(()=>LuminousLootLivePostCombatRuntime.ensureDependencies());
  if (playerId) {
    await page.addScriptTag({url:base+'/js/player-postcombat-loot.js'});
    await page.waitForFunction(()=>LuminousPlayerPostCombatLoot.state.db);
    await page.evaluate(()=>LuminousPlayerPostCombatLoot.refreshEncounters());
  }
  console.log('LOOT_QA_CLIENT_READY',playerId || 'dm');
  return {page,context};
}
async function openLoot(page) {
  if (!await page.locator('#postcombat-loot-modal').isVisible()) {
    await page.locator('#btn-postcombat-loot').click();
  }
  await expect(page.locator('#postcombat-loot-modal')).toBeVisible();
}

test.beforeAll(async () => {
  server = http.createServer((req,res) => {
    const pathname = new URL(req.url,base).pathname;
    if (pathname === '/loot-test') {
      res.setHeader('Content-Type','text/html; charset=utf-8');
      res.end('<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body style="margin:0;background:#17100e"><nav><button id="btn-global-inventory">Inventario</button></nav>'+['app','auth','database'].map(name=>`<script src="/node_modules/firebase/firebase-${name}.js"></script>`).join('')+'</body></html>');
      return;
    }
    const file = path.resolve(root,'.'+decodeURIComponent(pathname));
    if (!file.startsWith(root+path.sep)) {res.writeHead(403).end();return;}
    fs.readFile(file,(error,body)=>{
      if (error) {res.writeHead(404).end();return;}
      res.setHeader('Content-Type',({'.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.woff':'font/woff','.woff2':'font/woff2'})[path.extname(file)] || 'application/octet-stream');
      res.end(body);
    });
  });
  await new Promise(resolve=>server.listen(4173,'127.0.0.1',resolve));
});
test.afterAll(async()=>new Promise(resolve=>server.close(resolve)));

test('shared corpse discovery, chosen collection and hidden theft work on phone, tablet and desktop', async ({browser},info) => {
  test.setTimeout(120000);
  const [dm,p1,p2] = await Promise.all(['dm','player1','player2'].map(account));
  const actor = user => ({uid:user.uid,scores:{int:30,dex:30},proficiencyBonus:6,
    proficiencies:{skills:{investigation:'expertise',sleight_of_hand:'expertise'}},
    inventario_activo:{},inventario_stash:{},inventoryRules:{activeSlotLimit:20,stashSlotLimit:80},ahn:0,finance:{currentBalance:0}});
  await admin('campaña','PUT',{config:{dm_uid:dm.uid},jugadores:{p1:actor(p1),p2:actor(p2)},
    combate:{estado:{phase:'ENDED',result:'victory',encounterId:'shared-belongings'}},estado_mundo:{instancia_activa:'teatro'}});
  const clients = [];
  try {
    const director = await client(browser,dm); clients.push(director);
    const lootId = await director.page.evaluate(async()=>{
      const live = LuminousLootLivePostCombatRuntime, db = firebase.database();
      await live.installAuthority({db,uid:firebase.auth().currentUser.uid});
      const unit = LuminousKoboldUnitCatalog.get('kobold_dagger');
      Object.assign(unit,{id:'enemy:kobold',combatId:'enemy:kobold',libraryUnitId:'kobold_dagger',hp:0,maxHp:10,defeated:true,
        npcBelongings:{version:1,canCarry:true},carriedCurrency:{currencyId:'ahn',amount:50},
        inventario_activo:{patch:LuminousItemInventoryRuntime.createItemInstance(LuminousHpHealingCatalog.get('hp_generic_pocket_recovery_patch'),{instanceId:'patch',quantity:2})}});
      await db.ref('campaña/combate/defeated/enemy-kobold').set(unit);
      await db.ref('campaña/base_datos_unidades/kobold_dagger').set(unit);
      const result = await live.finalizeEncounterLoot({db,encounterId:'shared-belongings',result:'victory',participants:{p1:true,p2:true}});
      return result.finalized[0].lootInstanceId;
    });
    console.log('LOOT_QA_CORPSE_READY',lootId);
    const one = await client(browser,p1,'p1'); clients.push(one);
    const two = await client(browser,p2,'p2'); clients.push(two);
    const errors=[];
    for (const c of clients) c.page.on('pageerror',e=>errors.push(e.message));
    await openLoot(one.page);
    await expect(one.page.locator('[data-loot-action="search"]')).toBeEnabled();
    await openLoot(two.page);
    for (const c of [one,two]) {
      await c.page.locator('[data-loot-tab="results"]').click();
      await expect(c.page.locator('.loot-belonging.unknown')).toHaveCount(3);
      await expect(c.page.locator('[data-loot-collect]')).toHaveCount(0);
      expect(await c.page.locator('.loot-belongings-grid').innerText()).not.toContain('Dagger');
    }
    await one.page.locator('[data-loot-tab="actions"]').click();
    console.log('LOOT_QA_SEARCH');
    await one.page.locator('[data-loot-action="search"]').click();
    for (const c of [one,two]) {
      await expect(c.page.locator('.loot-belonging.known')).toHaveCount(3,{timeout:20000});
      await expect(c.page.locator('.loot-belonging.unknown')).toHaveCount(0);
    }
    expect(await admin('campaña/jugadores/p1/ahn')).toBe(0);
    expect(await admin(`campaña/loot_postcombat/${lootId}/currency/remaining`)).toBe(50);
    expect(Object.keys(await admin('campaña/jugadores/p1/inventario_activo') || {})).toHaveLength(0);

    for (const viewport of [{width:360,height:800},{width:390,height:844},{width:844,height:390},
      {width:768,height:1024},{width:1280,height:720},{width:1920,height:1080}]) {
      await one.page.setViewportSize(viewport);
      for (const tab of ['actions','results','inventory','space']) {
        await one.page.locator(`[data-loot-tab="${tab}"]`).click();
        await expect(one.page.locator(`#loot-panel-${tab}`)).toBeVisible();
      }
      await one.page.locator('[data-loot-tab="results"]').click();
      const bounds = await one.page.locator('[data-loot-collect]').evaluateAll(buttons=>buttons.map(button=>{
        button.scrollIntoView({block:'nearest'});
        const r=button.getBoundingClientRect(); return {width:r.width,height:r.height,left:r.left,right:r.right};
      }));
      for (const b of bounds) {expect(b.width).toBeGreaterThanOrEqual(44);expect(b.height).toBeGreaterThanOrEqual(44);expect(b.left).toBeGreaterThanOrEqual(0);expect(b.right).toBeLessThanOrEqual(viewport.width);}
      const noteWidth = await one.page.locator('.loot-result-card.selected .loot-recovered-grid > .loot-corpse-note').evaluate(note=>({
        note:note.getBoundingClientRect().width,grid:note.parentElement.getBoundingClientRect().width}));
      expect(noteWidth.note).toBeGreaterThan(noteWidth.grid * 0.9);
      await expect.poll(()=>one.page.locator('[data-corpse-sprite]').evaluateAll(images=>images.filter(img=>img.complete && !img.naturalWidth).length)).toBe(0);
      expect(await one.page.evaluate(()=>document.documentElement.scrollWidth > innerWidth)).toBe(false);
      await one.page.screenshot({path:info.outputPath(`corpse-${viewport.width}x${viewport.height}.png`)});
    }

    await one.page.waitForFunction(()=>!LuminousPlayerPostCombatLoot.state.busy);
    const dagger = (await admin(`campaña/loot_postcombat/${lootId}/carried`)).find(entry=>entry.definitionId==='dagger');
    await one.page.locator(`[data-target-item="${dagger.instanceId}"]`).click();
    await expect.poll(async()=>Object.values(await admin('campaña/jugadores/p1/inventario_activo')||{}).filter(i=>i.definitionId==='dagger').length).toBe(1);
    for (const c of [one,two]) await expect(c.page.locator('.loot-belonging.known')).toHaveCount(2);
    await one.page.waitForFunction(()=>!LuminousPlayerPostCombatLoot.state.busy);
    // Simulate a saved v2 corpse after a partial successful Search: the dagger
    // has gone, both remaining entries lack reveal flags, and Search is spent.
    const legacy = await admin(`campaña/loot_postcombat/${lootId}`);
    legacy.runtimeVersion = 2;
    delete legacy.belongingsRevealed;
    for (const entry of legacy.carried) delete entry.revealed;
    delete legacy.currency.revealed;
    const oldAttempts = structuredClone(legacy.attempts);
    const oldReceipts = await admin('campaña/jugadores/p1/lootRecoveryReceipts');
    await admin(`campaña/loot_postcombat/${lootId}`,'PUT',legacy);
    for (const c of [one,two]) {
      await c.page.evaluate(()=>LuminousPlayerPostCombatLoot.refreshEncounters());
      await expect(c.page.locator('.loot-belonging.known')).toHaveCount(2);
      await expect(c.page.locator('[data-loot-action="search"]')).toHaveCount(0);
      await expect(c.page.locator('.loot-corpse.selected')).toContainText('Pertenencias reveladas para todos');
    }
    expect(await admin(`campaña/loot_postcombat/${lootId}/runtimeVersion`)).toBe(2);
    await one.page.locator('[data-loot-tab="actions"]').click();
    await one.page.locator('[data-corpse-release]').click();
    await expect.poll(()=>admin(`campaña/loot_claims/${lootId}`)).toBe(null);
    await two.page.locator('[data-loot-tab="actions"]').click();
    await two.page.evaluate(()=>LuminousPlayerPostCombatLoot.close());
    await openLoot(two.page);
    await expect(two.page.locator('[data-corpse-release]')).toBeVisible();
    await two.page.locator('[data-loot-tab="results"]').click();
    await two.page.locator('[data-target-currency]').click();
    await expect.poll(()=>admin('campaña/jugadores/p2/ahn')).toBe(50);
    expect(await admin(`campaña/loot_postcombat/${lootId}/runtimeVersion`)).toBe(3);
    expect((await admin(`campaña/loot_postcombat/${lootId}/attempts`)).slice(0,oldAttempts.length)).toEqual(oldAttempts);
    expect(await admin('campaña/jugadores/p1/lootRecoveryReceipts')).toEqual(oldReceipts);
    for (const c of [one,two]) await expect(c.page.locator('.loot-belonging.known')).toHaveCount(1);
    expect((await admin(`campaña/loot_postcombat/${lootId}/carried`)).find(entry=>entry.definitionId==='hp_generic_pocket_recovery_patch').remaining).toBe(2);
    await two.page.locator('[data-loot-tab="actions"]').click();
    await two.page.waitForFunction(()=>!LuminousPlayerPostCombatLoot.state.busy);
    await two.page.locator('[data-loot-action="pickpocket"]').click();
    await expect.poll(async()=>(await admin(`campaña/loot_postcombat/${lootId}/carried`)).find(entry=>entry.definitionId==='hp_generic_pocket_recovery_patch').remaining).toBe(1);
    await two.page.locator('[data-loot-tab="results"]').click();
    await expect(two.page.locator('.loot-belonging.known')).toHaveCount(1);
    await two.page.reload();
    await two.page.evaluate(async ({user,project,ns})=>{
      firebase.initializeApp({apiKey:'fake',projectId:project,databaseURL:`http://127.0.0.1:9100/?ns=${ns}`});
      firebase.auth().useEmulator('http://127.0.0.1:9199',{disableWarnings:true});firebase.database().useEmulator('127.0.0.1',9100);
      await firebase.auth().signInWithEmailAndPassword(user.email,user.password);
    },{user:p2,project,ns});
    await two.page.addScriptTag({url:base+'/js/loot-live-postcombat-runtime.js'});
    await two.page.addScriptTag({url:base+'/js/player-postcombat-loot.js'});
    await expect(two.page.locator('#btn-postcombat-loot')).toBeVisible({timeout:20000});
    await openLoot(two.page);
    await two.page.locator('[data-loot-tab="results"]').click();
    await expect(two.page.locator('.loot-belonging.known')).toHaveCount(1);
    expect(await admin('campaña/jugadores/p2/ahn')).toBe(50);
    expect(errors).toEqual([]);
  } finally {await Promise.allSettled(clients.map(c=>c.context.close()));}
});
