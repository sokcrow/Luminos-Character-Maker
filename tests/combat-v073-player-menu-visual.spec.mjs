import { test, expect } from '@playwright/test';
import fs from 'node:fs';

const BASE = process.env.DM_VISUAL_BASE_URL || 'http://127.0.0.1:4173';
const PLAYER_UID = 'player-menu-ci-uid';
const DM_UID = 'dm-menu-ci-uid';

const FIREBASE_STUB = `
(()=>{
  const PLAYER_UID='player-menu-ci-uid';
  const DM_UID='dm-menu-ci-uid';
  const apps=[];
  const listeners=new Map();
  const sprite=()=>{
    const svg='<svg xmlns="http://www.w3.org/2000/svg" width="180" height="260" viewBox="0 0 180 260"><rect width="180" height="260" fill="#17120f"/><circle cx="90" cy="55" r="34" fill="#d68b52"/><path d="M42 235c5-80 29-125 48-125s43 45 48 125" fill="#4b2428"/></svg>';
    return 'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);
  };
  const skill={
    id:'ci_player_skill',
    skillId:'ci_player_skill',
    kind:'skill',
    name:'CI Visible Skill',
    description:'Real Battle-viewer Player Skill',
    actionCost:'action',
    economyCost:'action',
    basePower:5,
    coinPower:3,
    coinAmount:1,
    attackWeight:1
  };
  const player={
    uid:PLAYER_UID,
    vinculado_a:PLAYER_UID,
    characterName:'CI PLAYER',
    classes:[{classId:'wizard',levels:10}],
    spellIds:['mage_hand'],
    spellSelections:['mage_hand'],
    inventario_activo:{
      ci_recovery:{
        instanceId:'ci_recovery',
        definitionId:'ci_recovery_patch',
        id:'ci_recovery_patch',
        name:'CI Recovery Patch',
        category:'consumable',
        quantity:2,
        runtime:{actionCost:'action',targetMode:'self',effects:{hpRestore:5}}
      }
    }
  };
  const combatant={
    id:'player:p1',
    combatId:'player:p1',
    name:'CI PLAYER',
    characterName:'CI PLAYER',
    faction:'ally',
    actorCategory:'player',
    category:'player',
    canonicalScope:'player',
    isPlayer:true,
    playerId:'p1',
    ownerPlayerId:'p1',
    canonicalPlayerKey:'p1',
    ownerUid:PLAYER_UID,
    canonicalOwnerUid:PLAYER_UID,
    battleActive:true,
    hp:72,
    maxHp:100,
    sp:10,
    actionSlots:2,
    activeSlots:2,
    skillIds:['ci_player_skill'],
    skillSlotIds:['ci_player_skill'],
    equippedSkillIndex:{ci_player_skill:true},
    classes:[{classId:'wizard',levels:10}],
    spellIds:['mage_hand'],
    spellSelections:['mage_hand'],
    spellSelectionIndex:{mage_hand:true},
    inventario_activo:{
      ci_recovery:{
        instanceId:'ci_recovery',
        definitionId:'ci_recovery_patch',
        id:'ci_recovery_patch',
        name:'CI Recovery Patch',
        category:'consumable',
        quantity:2,
        runtime:{actionCost:'action',targetMode:'self',effects:{hpRestore:5}}
      }
    },
    combatSprite:sprite()
  };
  const players={p1:player};
  const combatants={'player:p1':combatant};

  const clean=path=>String(path??'').split('/').filter(Boolean).join('/');
  const valueFor=path=>{
    const key=clean(path);
    if(key==='campaña/config/dm_uid')return DM_UID;
    if(key==='campaña/jugadores')return players;
    if(key==='campaña/jugadores/p1')return player;
    if(key==='campaña/combate/combatants')return combatants;
    if(key==='campaña/combate/combatants/player:p1')return combatant;
    if(key==='campaña/combate/estado')return {phase:'PRE_COMBAT_PLANNING',round:1};
    if(key==='campaña/base_datos_skills')return {ci_player_skill:skill};
    if(key==='campaña/base_datos_skills/ci_player_skill')return skill;
    if(key==='campaña/combate/libraryManifest/skills')return {};
    if(key==='campaña/combate/libraryManifest/skills/ci_player_skill')return null;
    if(key==='campaña/combate/libraryManifest/units')return {};
    if(key==='campaña/combate/plannedActions')return {};
    if(key==='campaña/combate/readyPlayers')return {};
    return null;
  };
  const snapshot=path=>({
    key:clean(path).split('/').pop()||null,
    val(){return valueFor(path)},
    exists(){return valueFor(path)!=null},
    forEach(callback){
      const value=valueFor(path);
      if(!value||typeof value!=='object'||Array.isArray(value))return false;
      Object.entries(value).forEach(([key,row])=>callback({key,val:()=>row,exists:()=>true}));
      return false;
    }
  });
  const makeRef=(path='')=>({
    key:clean(path).split('/').pop()||null,
    path:clean(path),
    child(next){return makeRef([path,next].filter(Boolean).join('/'))},
    once(){return Promise.resolve(snapshot(path))},
    on(event,callback){queueMicrotask(()=>callback(snapshot(path)));listeners.set(clean(path)+':'+event,callback);return callback},
    off(){},
    set(){return Promise.resolve()},
    update(){return Promise.resolve()},
    remove(){return Promise.resolve()},
    push(){return makeRef([path,'ci'].filter(Boolean).join('/'))}
  });
  const auth={
    currentUser:{uid:PLAYER_UID,email:'player-menu-ci@local.invalid'},
    onAuthStateChanged(callback){queueMicrotask(()=>callback(this.currentUser));return()=>{}},
    signOut(){return Promise.resolve()}
  };
  const db={ref(path=''){return makeRef(path)}};
  function authFn(){return auth}
  function databaseFn(){return db}
  databaseFn.ServerValue={TIMESTAMP:Date.now()};
  window.firebase={
    apps,
    initializeApp(config){if(!apps.length)apps.push({name:'[DEFAULT]',options:config||{}});return apps[0]},
    auth:authFn,
    database:databaseFn
  };
})();
`;

async function installFirebase(page) {
  await page.route(/https:\/\/www\.gstatic\.com\/firebasejs\/8\.10\.1\/firebase-(app|auth|database)\.js/, async route => {
    const url = route.request().url();
    await route.fulfill({
      status: 200,
      contentType: 'application/javascript; charset=utf-8',
      body: url.includes('firebase-app.js') ? FIREBASE_STUB : '/* firebase supplied by player menu CI */'
    });
  });
}

async function goRoot(page) {
  await page.evaluate(() => {
    try { (0, eval)("goRoot()"); } catch (_) {}
  });
  await page.waitForTimeout(100);
}

async function clickRootMenu(page, menu) {
  const result = await page.evaluate((wanted) => {
    const normalize = value => String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    const label = wanted === 'global' ? 'actions' : wanted;
    const iconToken = wanted === 'skills' ? 'skills.png'
      : wanted === 'spells' ? 'spells.png'
      : wanted === 'items' ? 'inventory.png'
      : '';
    const candidates = [...document.querySelectorAll('.command-ring button,.command-option,.menu-option,button')];
    const node = candidates.find(button => {
      const data = button.dataset || {};
      const direct = normalize(data.menu || data.category || data.action || data.command || data.key || button.id || button.getAttribute('aria-label') || button.getAttribute('title'));
      const text = normalize(button.textContent);
      const img = button.querySelector?.('img');
      const src = String(img?.getAttribute?.('src') || img?.src || '').toLowerCase();
      return direct === wanted || direct === label || text === wanted || text === label || text.includes(label) || (iconToken && src.includes(iconToken));
    });
    const ring = document.querySelector('.command-ring');
    const ringRect = ring?.getBoundingClientRect?.();
    const ringStyle = ring ? getComputedStyle(ring) : null;
    const diagnostics = candidates.map(button => {
      const rect = button.getBoundingClientRect();
      const style = getComputedStyle(button);
      return {
        text:String(button.textContent||'').trim(),
        id:button.id||'',
        data:{...(button.dataset||{})},
        img:String(button.querySelector?.('img')?.getAttribute?.('src')||''),
        rect:{x:rect.x,y:rect.y,width:rect.width,height:rect.height},
        display:style.display,
        visibility:style.visibility,
        opacity:style.opacity,
        transform:style.transform
      };
    });
    const ringInfo = ring ? {
      rect:ringRect?{x:ringRect.x,y:ringRect.y,width:ringRect.width,height:ringRect.height}:null,
      position:ringStyle.position,
      left:ringStyle.left,
      top:ringStyle.top,
      right:ringStyle.right,
      bottom:ringStyle.bottom,
      width:ringStyle.width,
      height:ringStyle.height,
      transform:ringStyle.transform,
      transformOrigin:ringStyle.transformOrigin,
      overflow:ringStyle.overflow
    } : null;
    if (!node) return {found:false,buttons:diagnostics,ring:ringInfo};
    const rect = node.getBoundingClientRect();
    const style = getComputedStyle(node);
    const visible = rect.width > 0 && rect.height > 0 && rect.x + rect.width > 0 && rect.y + rect.height > 0 && rect.x < innerWidth && rect.y < innerHeight && style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || 1) > 0;
    if (visible) node.click();
    return {found:true,visible,rect:{x:rect.x,y:rect.y,width:rect.width,height:rect.height},text:String(node.textContent||'').trim(),buttons:diagnostics,ring:ringInfo};
  }, menu);
  expect(result.found, JSON.stringify(result.buttons || [])).toBe(true);
  expect(result.visible, JSON.stringify(result)).toBe(true);
  await page.waitForFunction((wanted) => {
    try { return String((0, eval)('activeMenu') || '') === wanted; } catch (_) { return false; }
  }, menu, { timeout: 5000 });
}

async function assertCategoryVisible(page, expectedText, artifactName) {
  const body = page.locator('#category-body');
  await expect(body).toBeVisible({ timeout: 5000 });
  await expect(body).toContainText(expectedText, { timeout: 5000 });
  const box = await body.boundingBox();
  expect(box).not.toBeNull();
  const viewportHeight = await page.evaluate(() => window.innerHeight);
  expect(box.y).toBeLessThan(viewportHeight);
  expect(box.y + Math.min(box.height, 30)).toBeGreaterThan(0);
  fs.mkdirSync('artifacts/player-menu-visual', { recursive: true });
  await page.screenshot({ path: `artifacts/player-menu-visual/${artifactName}.png`, animations: 'disabled' });
}

test.use({ viewport: { width: 673, height: 258 }, colorScheme: 'dark' });

test('real Battle-viewer Player can open Actions, Skills, Spells and Items at embedded viewport', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(String(error?.stack || error?.message || error)));
  await installFirebase(page);
  await page.goto(`${BASE}/Battle-viewer.html`, { waitUntil: 'domcontentloaded' });

  await page.waitForFunction(() => {
    const adapter = window.LuminousCombatLiveAdapter073;
    const menu = window.LuminousCombatEconomyMenu073;
    const unit = window.LuminousCombat073?.combatants?.()?.['player:p1'];
    return adapter?.state?.role === 'player'
      && adapter?.state?.playerId === 'p1'
      && menu?.state?.installed === true
      && unit?.controlled === 'player';
  }, null, { timeout: 30000 });

  await page.waitForFunction(() => window.LuminousCombatEconomyMenu073?.liveActions?.('skill')?.some(row => row.id === 'ci_player_skill'), null, { timeout: 15000 });
  await page.waitForFunction(() => window.LuminousCombatEconomyMenu073?.spellRowsForPlayer?.().some(row => row.spellId === 'mage_hand'), null, { timeout: 15000 });
  await page.waitForFunction(() => window.LuminousCombatEconomyMenu073?.itemRowsForPlayer?.().some(row => row.name === 'CI Recovery Patch'), null, { timeout: 15000 });

  await goRoot(page);
  await clickRootMenu(page, 'global');
  await page.waitForFunction(() => document.querySelectorAll('#category-body .clean-row').length > 0, null, { timeout: 5000 });
  await assertCategoryVisible(page, 'Analyse', 'actions');

  await goRoot(page);
  await clickRootMenu(page, 'skills');
  await assertCategoryVisible(page, 'CI Visible Skill', 'skills');

  await goRoot(page);
  await clickRootMenu(page, 'spells');
  await assertCategoryVisible(page, 'Mage Hand', 'spells');

  await goRoot(page);
  await clickRootMenu(page, 'items');
  await assertCategoryVisible(page, 'CI Recovery Patch', 'items');

  expect(pageErrors, pageErrors.join('\n')).toEqual([]);
});


test('desktop Player Items menu does not lock the HUD and can return to other menus', async ({ page }) => {
  await page.setViewportSize({ width: 1365, height: 768 });
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(String(error?.stack || error?.message || error)));
  await installFirebase(page);
  await page.goto(`${BASE}/Battle-viewer.html`, { waitUntil: 'domcontentloaded' });

  await page.waitForFunction(() => {
    const adapter = window.LuminousCombatLiveAdapter073;
    const menu = window.LuminousCombatEconomyMenu073;
    const unit = window.LuminousCombat073?.combatants?.()?.['player:p1'];
    return adapter?.state?.role === 'player'
      && adapter?.state?.playerId === 'p1'
      && menu?.state?.installed === true
      && unit?.controlled === 'player';
  }, null, { timeout: 30000 });

  await page.waitForFunction(() => window.LuminousCombatEconomyMenu073?.itemRowsForPlayer?.().some(row => row.name === 'CI Recovery Patch'), null, { timeout: 15000 });

  await goRoot(page);
  await clickRootMenu(page, 'items');
  await assertCategoryVisible(page, 'CI Recovery Patch', 'items-desktop');

  const heartbeat = await page.evaluate(() => new Promise(resolve => {
    const started = performance.now();
    setTimeout(() => resolve(performance.now() - started), 50);
  }));
  expect(heartbeat).toBeLessThan(1000);

  const back = page.locator('#back,.category-back').first();
  await expect(back).toBeVisible({ timeout: 5000 });
  await back.click({ timeout: 5000 });
  await page.waitForFunction(() => {
    try { return String((0, eval)('activeMenu') || '') === ''; } catch (_) { return false; }
  }, null, { timeout: 5000 });

  // Returning from Items must restore an actually usable root HUD. Use the
  // on-screen ACTIONS command so this regression stays about the Items lock,
  // not the separate radial-left-edge geometry of this synthetic fixture.
  await page.waitForTimeout(650);
  const rootDiagnostics = await page.evaluate(() => {
    const inspect = node => {
      if (!node) return null;
      const rect = node.getBoundingClientRect();
      const style = getComputedStyle(node);
      return {
        rect:{x:rect.x,y:rect.y,width:rect.width,height:rect.height,right:rect.right,bottom:rect.bottom},
        display:style.display,
        visibility:style.visibility,
        opacity:style.opacity,
        pointerEvents:style.pointerEvents,
        transform:style.transform
      };
    };
    const commands = {};
    document.querySelectorAll('.command-ring [data-menu]').forEach(node => {
      commands[node.dataset.menu || node.textContent.trim()] = inspect(node);
    });
    let active = '', nav = '';
    try { active = String((0, eval)('activeMenu') || ''); } catch (_) {}
    try { nav = String((0, eval)('navState') || ''); } catch (_) {}
    return {
      activeMenu:active,
      navState:nav,
      innerWidth,
      innerHeight,
      hostClass:document.getElementById('game-container')?.className || '',
      ring:inspect(document.querySelector('.command-ring')),
      battlefield:inspect(document.getElementById('battlefield')),
      player:inspect(document.getElementById('token-player:p1')),
      surface:inspect(document.getElementById('category-surface')),
      back:inspect(document.getElementById('back')),
      ghosts:document.querySelectorAll('.transition-ghost').length,
      commands
    };
  });
  const globalCommand = rootDiagnostics.commands.global;
  const globalVisible = Boolean(globalCommand
    && globalCommand.rect.width > 0 && globalCommand.rect.height > 0
    && globalCommand.rect.right > 0 && globalCommand.rect.bottom > 0
    && globalCommand.rect.x < rootDiagnostics.innerWidth
    && globalCommand.rect.y < rootDiagnostics.innerHeight
    && globalCommand.visibility !== 'hidden'
    && globalCommand.display !== 'none');
  expect(globalVisible, JSON.stringify(rootDiagnostics)).toBe(true);

  await clickRootMenu(page, 'global');
  await assertCategoryVisible(page, 'Analyse', 'actions-after-items-desktop');

  expect(pageErrors, pageErrors.join('\n')).toEqual([]);
});


test('real Player internal Combat buttons advance selection state on physical click', async ({ page }) => {
  await page.setViewportSize({ width: 1365, height: 768 });
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(String(error?.stack || error?.message || error)));
  await installFirebase(page);
  await page.goto(`${BASE}/Battle-viewer.html`, { waitUntil: 'domcontentloaded' });

  await page.waitForFunction(() => {
    const adapter = window.LuminousCombatLiveAdapter073;
    const menu = window.LuminousCombatEconomyMenu073;
    const unit = window.LuminousCombat073?.combatants?.()?.['player:p1'];
    return adapter?.state?.role === 'player'
      && adapter?.state?.playerId === 'p1'
      && menu?.state?.installed === true
      && unit?.controlled === 'player';
  }, null, { timeout: 30000 });

  await page.waitForFunction(() => window.LuminousCombatEconomyMenu073?.liveActions?.('skill')?.some(row => row.id === 'ci_player_skill'), null, { timeout: 15000 });
  await page.waitForFunction(() => window.LuminousCombatEconomyMenu073?.spellRowsForPlayer?.().some(row => row.spellId === 'mage_hand'), null, { timeout: 15000 });
  await page.waitForFunction(() => window.LuminousCombatEconomyMenu073?.itemRowsForPlayer?.().some(row => row.name === 'CI Recovery Patch'), null, { timeout: 15000 });

  const state = async () => page.evaluate(() => {
    let activeMenu = '', navState = '', selected = null;
    try { activeMenu = String((0, eval)('activeMenu') || ''); } catch (_) {}
    try { navState = String((0, eval)('navState') || ''); } catch (_) {}
    try { selected = (0, eval)('selected'); } catch (_) {}
    const body = document.getElementById('category-body');
    const surface = document.getElementById('category-surface');
    const back = document.getElementById('back');
    const inspect = node => {
      if (!node) return null;
      const rect = node.getBoundingClientRect();
      const style = getComputedStyle(node);
      return {
        rect:{x:rect.x,y:rect.y,width:rect.width,height:rect.height},
        display:style.display,
        visibility:style.visibility,
        opacity:style.opacity,
        pointerEvents:style.pointerEvents
      };
    };
    return {
      activeMenu,
      navState,
      selectedType:selected?.type || null,
      selectedName:selected?.data?.name || selected?.data?.id || null,
      bodyText:String(body?.innerText || body?.textContent || '').trim(),
      body:inspect(body),
      surface:inspect(surface),
      back:inspect(back),
      selectorBridge:{
        originalIsReview:window.LuminousCombatEconomyMenu073?.state?.originals?.selectAction === window.LuminousCombatEconomyReviewFixes073?.selectAction,
        originalIsEconomy:window.LuminousCombatEconomyMenu073?.state?.originals?.selectAction === window.LuminousCombatEconomyMenu073?.selectAction,
        originalName:window.LuminousCombatEconomyMenu073?.state?.originals?.selectAction?.name || '',
        lexicalName:(()=>{try{return (0,eval)('selectAction')?.name || ''}catch(_){return ''}})()
      }
    };
  });

  const cases = [
    { menu:'global', selector:'#category-body .clean-row', label:'Analyse' },
    { menu:'skills', selector:'#category-body .skill-option', label:'CI Visible Skill' },
    { menu:'spells', selector:'#category-body .skill-option', label:'Mage Hand' },
    { menu:'items', selector:'#category-body .clean-row', label:'CI Recovery Patch' },
  ];

  for (const entry of cases) {
    await goRoot(page);
    await clickRootMenu(page, entry.menu);
    const row = page.locator(entry.selector).filter({ hasText: entry.label }).first();
    await expect(row).toBeVisible({ timeout: 5000 });
    const before = await state();
    await row.click({ timeout: 5000 });
    await page.waitForTimeout(120);
    const after = await state();
    const physicalAdvanced = after.navState === 'action' || after.selectedName === entry.label || (entry.menu === 'items' && /USE ITEM/.test(after.bodyText));
    let direct = null;
    if (!physicalAdvanced) {
      await row.evaluate(node => {
        if (typeof node.onclick === 'function') {
          node.onclick({
            currentTarget:node,
            target:node,
            preventDefault(){},
            stopPropagation(){},
            stopImmediatePropagation(){}
          });
        }
      });
      await page.waitForTimeout(80);
      direct = await state();
    }
    expect(
      physicalAdvanced,
      JSON.stringify({ entry, before, after, direct, hasOnclick: await row.evaluate(node => typeof node.onclick === 'function') })
    ).toBe(true);
  }

  expect(pageErrors, pageErrors.join('\n')).toEqual([]);
});
