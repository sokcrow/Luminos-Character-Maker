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
    expect(await admin(`campaña/loot_postcombat/${lootId}/runtimeVersion`)).toBe(4);
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

test('anatomy variants and History Compendium work across phone, tablet and desktop', async ({browser},info) => {
  test.setTimeout(180000);
  const [dm,user] = await Promise.all(['anatomy-dm','anatomy-player'].map(account));
  await admin('campaña','PUT',{config:{dm_uid:dm.uid},jugadores:{scholar:{uid:user.uid,scores:{int:30,wis:30,str:30},
    proficiencyBonus:6,skillProficiency:{arcana:'proficient',medicine:'proficient',survival:'proficient',athletics:'proficient',religion:'proficient',history:'proficient'}}},
    combate:{estado:{phase:'ENDED',result:'victory',encounterId:'anatomy'}},estado_mundo:{instancia_activa:'teatro'}});
  const director = await client(browser,dm), player = await client(browser,user,'scholar');
  const errors=[];player.page.on('pageerror',error=>errors.push(error.message));
  try {
    const variants = [
      {id:'organic',name:'Biológico',kind:'organic',material:'flesh',type:'beast',study:'autopsy',skill:'survival'},
      {id:'construct',name:'Constructo',kind:'construct',material:'metal',type:'construct',study:'dismantle',skill:'arcana'},
      {id:'rock',name:'Rocoso',kind:'mineral',material:'stone',type:'elemental',study:'arcane_autopsy',skill:'athletics'},
      {id:'fey',name:'Feérico',kind:'organic',material:'flesh',type:'fey',study:'arcane_autopsy',skill:'survival'},
      {id:'celestial',name:'Celestial',kind:'organic',material:'flesh',type:'celestial',study:'divine_autopsy',skill:'survival'},
    ];
    await director.page.evaluate(async variants=>{
      const db=firebase.database(), index={};
      await LuminousLootLivePostCombatRuntime.installAuthority({db,uid:firebase.auth().currentUser.uid});
      for (const row of variants) {
        const unit={id:row.id,name:row.name,creatureType:row.type,basicDescription:`Descripción pública de ${row.name}.`,
          bodyProfile:{kind:row.kind,materials:[row.material],sizeClass:'medium',resources:[]},secret:'SECRET_DO_NOT_REVEAL'};
        const locked={lootInstanceId:row.id,sourceUnitId:row.id,corpseId:row.id,sourceUnitInstanceId:row.id,encounterId:'anatomy',
          generation:1,sourceDigest:'anatomy-fixture',
          locked:true,creatureType:row.type,carried:[],equipment:{items:[]},currency:{amount:0},
          harvest:{bodyKind:row.kind,materials:[row.material],resources:[
            {id:'bulk',integrityFamily:'hard_cover_structural',sourceMaterial:row.material,capacity:2},
            {id:'delicate',integrityFamily:row.material==='flesh'?'organ_internal':'hard_cover_modular',sourceMaterial:row.material,capacity:1},
          ]}};
        await db.ref(`campaña/base_datos_unidades/${row.id}`).set(unit);
        await db.ref(`campaña/loot_instances/${row.id}`).set(locked);
        await db.ref(`campaña/loot_postcombat/${row.id}`).set(LuminousLootPostCombatRuntime.createInteractionState(locked));
        index[row.id]={lootInstanceId:row.id,sourceUnitId:row.id,name:row.name};
      }
      await db.ref('campaña/loot_encounters/anatomy').set({meta:{open:true,result:'victory',participants:{scholar:true},corpseCount:variants.length},corpses:index});
    },variants);
    await player.page.evaluate(()=>LuminousPlayerPostCombatLoot.refreshEncounters());
    await openLoot(player.page);
    for (const row of variants) {
      await player.page.locator('#postcombat-loot-corpse-picker').selectOption(row.id);
      await expect(player.page.locator(`.loot-corpse.selected [data-loot-action="${row.study}"]`)).toBeEnabled();
      const skill = await player.page.evaluate(id=>{
        const ui=LuminousPlayerPostCombatLoot.state, corpse=ui.corpses.find(row=>row.loot.lootInstanceId===id);
        return LuminousLootPostCombatRuntime.checkDefinition({},'harvest',{state:corpse.interaction,lootInstance:corpse.loot}).skill;
      },row.id);
      expect(skill).toBe(row.skill);
      const before = await admin(`campaña/loot_postcombat/${row.id}/harvest`);
      await player.page.locator(`.loot-corpse.selected [data-loot-action="${row.study}"]`).click();
      await expect.poll(async()=>Object.values(await admin(`campaña/jugadores/scholar/compendium/units/${row.id}/facts`)||{}).some(fact=>fact.id==='biology.body_kind')).toBe(true);
      expect(await admin(`campaña/loot_postcombat/${row.id}/harvest`)).toEqual(before);
      await player.page.waitForFunction(()=>!LuminousPlayerPostCombatLoot.state.busy);
    }
    await player.page.evaluate(()=>LuminousPlayerPostCombatLoot.close());
    await player.page.addScriptTag({url:base+'/js/creature-compendium-ui.js'});
    await player.page.locator('#btn-creature-compendium').click();
    await expect(player.page.locator('#creature-book-select')).toBeVisible();
    await player.page.locator('#creature-book-select').selectOption('fey');
    await expect(player.page.locator('.creature-description')).toContainText('aún no descubierta');
    await player.page.locator('[data-creature-history]').click();
    await expect(player.page.locator('.creature-description')).toContainText('Descripción pública de Feérico.');
    expect(await player.page.locator('#creature-compendium').innerText()).not.toContain('SECRET_DO_NOT_REVEAL');
    // The same reading and recall control remains available during Planning.
    await player.page.evaluate(()=>{window.LuminousCombat073={uiState:()=>({running:false}),combatants:()=>({celestial:{libraryUnitId:'celestial',faction:'enemy',name:'Celestial'}})};});
    await player.page.locator('#creature-book-select').selectOption('celestial');
    await player.page.locator('[data-creature-history]').click();
    await expect(player.page.locator('.creature-description')).toContainText('Descripción pública de Celestial.');
    for (const viewport of [{width:360,height:800},{width:390,height:844},{width:844,height:390},
      {width:768,height:1024},{width:1280,height:720},{width:1920,height:1080}]) {
      await player.page.setViewportSize(viewport);
      await player.page.locator('#creature-book-select').selectOption('organic');
      const button=player.page.locator('[data-creature-history]');await button.scrollIntoViewIfNeeded();
      const bounds=await button.boundingBox();expect(bounds.width).toBeGreaterThanOrEqual(44);expect(bounds.height).toBeGreaterThanOrEqual(44);
      expect(bounds.x).toBeGreaterThanOrEqual(0);expect(bounds.x+bounds.width).toBeLessThanOrEqual(viewport.width);
      expect(await player.page.locator('.creature-book').evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
      await player.page.screenshot({path:info.outputPath(`compendium-${viewport.width}x${viewport.height}.png`)});
      await player.page.keyboard.press('Escape');await expect(player.page.locator('#creature-compendium')).toBeHidden();
      await player.page.locator('#btn-creature-compendium').click();await expect(player.page.locator('#creature-book-select')).toBeVisible();
      await player.page.evaluate(()=>LuminousCreatureCompendium.close());
      await openLoot(player.page);
      await player.page.locator('[data-loot-tab="actions"]').click();
      await player.page.locator('#postcombat-loot-corpse-picker').selectOption('construct');
      const recover=player.page.locator('.loot-corpse.selected [data-loot-action="extract"]');await recover.scrollIntoViewIfNeeded();
      const recoveryBounds=await recover.boundingBox();expect(recoveryBounds.width).toBeGreaterThanOrEqual(44);expect(recoveryBounds.height).toBeGreaterThanOrEqual(44);
      expect(await player.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
      await player.page.screenshot({path:info.outputPath(`anatomy-${viewport.width}x${viewport.height}.png`)});
      await player.page.evaluate(()=>LuminousPlayerPostCombatLoot.close());
      await player.page.locator('#btn-creature-compendium').click();await expect(player.page.locator('#creature-book-select')).toBeVisible();
    }
    // Reopening reads the persisted description, without another History roll.
    await player.page.locator('#creature-book-select').selectOption('fey');
    await expect(player.page.locator('.creature-description')).toContainText('Descripción pública de Feérico.');
    await expect(player.page.locator('[data-creature-history]')).toBeDisabled();
    expect(errors).toEqual([]);
  } finally {await player.context.close();await director.context.close();}
});

test('outer Compendium uses the active iframe namespace, first roster and execution gate', async ({browser}) => {
  test.setTimeout(60000);
  const [dm,user]=await Promise.all(['scoped-compendium-dm','scoped-compendium-player'].map(account));
  const actor={uid:user.uid,scores:{int:30},proficiencyBonus:6,skillProficiency:{history:'proficient'}};
  await admin('campaña','PUT',{config:{dm_uid:dm.uid},jugadores:{storyHero:actor},
    encuentros:{'compendium-room':{hostUid:dm.uid,members:{[dm.uid]:true,[user.uid]:true},state:{campaña:{
      config:{dm_uid:dm.uid},jugadores:{isolatedHero:actor},
      combate:{estado:{phase:'PRE_COMBAT_PLANNING',encounterId:'isolated-compendium'}},
      base_datos_unidades:{first:{id:'first',name:'Primera criatura',basicDescription:'Descripción del encuentro aislado.'},
        second:{id:'second',name:'Segunda criatura',basicDescription:'Otra descripción aislada.'}},
    }}}}});
  const player=await client(browser,user,'storyHero');
  try {
    await player.page.addScriptTag({url:base+'/js/creature-compendium-ui.js'});
    await player.page.evaluate(base=>{
      const iframe=document.createElement('iframe');iframe.id='mirror-view';iframe.src=base+'/loot-test?encounter=compendium-room';
      iframe.style.display='none';document.body.appendChild(iframe);
    },base);
    await player.page.waitForFunction(()=>{
      const sdk=document.getElementById('mirror-view')?.contentWindow?.firebase;
      return sdk?.auth && sdk?.database;
    });
    const viewer=player.page.frames().find(frame=>frame.url().includes('encounter=compendium-room'));
    await viewer.evaluate(async ({user,project,ns})=>{
      firebase.initializeApp({apiKey:'fake',projectId:project,databaseURL:`http://127.0.0.1:9100/?ns=${ns}`});
      firebase.auth().useEmulator('http://127.0.0.1:9199',{disableWarnings:true});firebase.database().useEmulator('127.0.0.1',9100);
      await firebase.auth().signInWithEmailAndPassword(user.email,user.password);
    },{user,project,ns});
    await viewer.addScriptTag({url:base+'/js/combat-context.js'});
    await viewer.evaluate(()=>{
      window.__running=false;
      window.LuminousCombatLiveAdapter073={state:{db:firebase.database(),playerId:'isolatedHero',uid:firebase.auth().currentUser.uid,user:firebase.auth().currentUser}};
      window.LuminousCombat073={uiState:()=>({running:window.__running}),combatants:()=>({
        first:{libraryUnitId:'first',faction:'enemy',name:'Primera criatura'},second:{libraryUnitId:'second',faction:'enemy',name:'Segunda criatura'},
      })};
    });
    await player.page.locator('#btn-creature-compendium').click();
    await expect(player.page.locator('#creature-book-select option')).toHaveCount(2);
    expect(await player.page.evaluate(()=>LuminousCreatureCompendium.state.playerId)).toBe('isolatedHero');
    expect(await player.page.evaluate(()=>LuminousCreatureCompendium.state.db===document.getElementById('mirror-view').contentWindow.LuminousCombatLiveAdapter073.state.db)).toBe(true);
    await player.page.locator('#creature-book-select').selectOption('first');
    await player.page.locator('[data-creature-history]').click();
    await expect(player.page.locator('.creature-description')).toContainText('Descripción del encuentro aislado.');
    const saved=await admin('campaña/encuentros/compendium-room/state/campaña/jugadores/isolatedHero/compendium');
    expect(Object.values(saved.units.first.facts).some(fact=>fact.id==='lore.basic_description')).toBe(true);
    expect(await admin('campaña/jugadores/storyHero/compendium')).toBe(null);
    expect(await admin('campaña/jugadores/isolatedHero')).toBe(null);
    await player.page.locator('#creature-book-select').selectOption('second');
    for(const frameId of ['mirror-view','combat-entry-view']) {
      await player.page.evaluate(frameId=>{(document.getElementById('mirror-view')||document.getElementById('combat-entry-view')).id=frameId;},frameId);
      await viewer.evaluate(()=>{window.__running=true;});
      // A button rendered during Planning must also be guarded at click time.
      await player.page.evaluate(()=>LuminousCreatureCompendium.recall());
      expect(await admin('campaña/encuentros/compendium-room/state/campaña/jugadores/isolatedHero/compendium')).toEqual(saved);
      await player.page.evaluate(()=>LuminousCreatureCompendium.close());
      await player.page.locator('#btn-creature-compendium').click();
      await expect(player.page.locator('[data-creature-history]')).toBeDisabled();
      await viewer.evaluate(()=>{window.__running=false;});
      await player.page.evaluate(()=>LuminousCreatureCompendium.close());
      await player.page.locator('#btn-creature-compendium').click();
      await expect(player.page.locator('[data-creature-history]')).toBeEnabled();
    }
  } finally {await player.context.close();}
});
