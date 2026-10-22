import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile, mkdir} from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
const {chromium} = createRequire(import.meta.url)('playwright');
const root = path.resolve(new URL('..', import.meta.url).pathname);
const out = path.join(root, 'test-results/loot-responsive');
await mkdir(out, {recursive:true});
const fixture = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;background:#161312}button{font:inherit}</style><nav><button id="btn-global-inventory">Inventario</button></nav>
<script src="/js/item-inventory-runtime.js"></script><script src="/js/item-icon-registry.js"></script><script>
const icon='Assets/Icons/items/fallback/generic_item.png';
const item={definitionId:'qa_unknown_legacy_item',displayName:'Objeto de prueba con nombre largo',quantity:1,iconUrl:icon};
window.qa={actor:{id:'hunter',activeSlotLimit:64,stashSlotLimit:80,inventario_activo:Object.fromEntries(Array.from({length:52},(_,i)=>['i'+i,{...item,instanceId:'i'+i}]))},requests:{},writes:[],mode:'success',delay:false};
const interaction=id=>({lootInstanceId:id,carried:[{definitionId:item.definitionId,item,discoveredBy:['hunter'],remaining:0}],harvest:{resources:[]},attempts:[{actorId:'hunter',actionId:'search',success:true,total:12,threshold:10},{actorId:'someone_else',actionId:'autopsy',success:true,total:99,threshold:10}],pendingDeliveries:[]});
qa.corpses={c1:interaction('c1'),c2:interaction('c2')};
qa.encounter={meta:{open:true,result:'victory',participants:{hunter:true},corpseCount:2},corpses:{c1:{lootInstanceId:'c1',name:'Cadáver con nombre largo para comprobar lectura'},c2:{lootInstanceId:'c2',name:'Segundo cadáver'}}};
qa.data=p=>p==='campaña/loot_encounters'?{battle:qa.encounter}:p==='campaña/jugadores/hunter'?qa.actor:p.startsWith('campaña/loot_postcombat/')?qa.corpses[p.split('/').pop()]:{};
qa.db={ref:p=>({once:async()=>{if(qa.delay)await new Promise(r=>setTimeout(r,100));return{val:()=>qa.data(p)}},on(){},off(){}})};
window.firebase={auth:()=>({currentUser:{uid:'uid_hunter'}}),database:()=>qa.db};
localStorage.setItem('playerId','hunter');
window.LuminousLootLivePostCombatRuntime={ROOTS:{encounterLoot:'campaña/loot_encounters',postCombat:'campaña/loot_postcombat',lootInstances:'campaña/loot_instances',claims:'campaña/loot_claims',requests:'campaña/loot_requests',combatState:'campaña/combate/estado'},ensureDependencies:async()=>{},playerBalance:()=>100,availableActions:()=>['search','harvest','examine','autopsy'],claimCorpse:async()=>({acquired:true,claim:{expiresAt:Date.now()+60000}}),releaseCorpse:async()=>{},checkPlayerLootAccess:async()=>{},requestAction:async options=>{
 qa.writes.push(options);if(qa.mode==='error')throw Error('No se pudo completar la recuperación.');if(qa.mode==='queued'){qa.requests.r1={lootInstanceId:options.lootInstanceId,actionId:options.actionId,status:'pending'};LuminousPlayerPostCombatLoot.state.requests=qa.requests;return{queued:true};}
 if(options.deliveryId){qa.corpses[options.lootInstanceId].pendingDeliveries=[];return{delivered:true};}
 qa.corpses[options.lootInstanceId].attempts.push({actorId:'hunter',actionId:options.actionId,success:true,total:14,threshold:10});return{committed:true,check:{success:true},materialized:{items:[],currency:{amount:0}}};
}};
window.LuminousLootPostCombatRuntime={eligibleResources:()=>[],lootSkillForAction:()=> 'investigation',lootProficiencyPenalty:()=>0,checkDefinition:()=>({})};
window.LuminousLootCheckRuntime={rollCheck:async()=>{await new Promise(r=>setTimeout(r,100));return{heads:2,total:14}}};
</script><script src="/js/player-postcombat-loot.js"></script>`;
const server = http.createServer(async (req,res)=>{
 try {
  const url = new URL(req.url,'http://localhost');
  if(url.pathname==='/fixture'){res.setHeader('Content-Type','text/html');res.end(fixture);return;}
  const file=path.resolve(root,'.'+decodeURIComponent(url.pathname));
  if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.png':'image/png'})[path.extname(file)]||'text/plain');
  res.end(await readFile(file));
 }catch{res.writeHead(404).end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true});
const origin=`http://127.0.0.1:${server.address().port}`;
const sizes=[[360,800],[390,844],[844,390],[768,1024],[1280,720],[1920,1080]];
try {
 for(const [width,height] of sizes){
  const context=await browser.newContext({viewport:{width,height},hasTouch:width<1000});
  const page=await context.newPage(), errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(origin+'/fixture');
  await page.waitForFunction(()=>document.getElementById('btn-postcombat-loot')?.classList.contains('available'));
  await page.locator('#btn-postcombat-loot').click();
  await page.waitForFunction(()=>document.querySelector('[data-loot-action]:not(:disabled)'));
  const selected=await page.evaluate(()=>LuminousPlayerPostCombatLoot.state.selectedLootId);
  for(const tab of ['actions','results','inventory','space']){
   await page.locator('[data-loot-tab="'+tab+'"]').click();
   assert.equal(await page.locator('[data-loot-panel]:visible').count(),1);
   assert.equal(await page.locator('[data-loot-tab="'+tab+'"]').getAttribute('aria-selected'),'true');
   assert.equal(await page.evaluate(()=>LuminousPlayerPostCombatLoot.state.selectedLootId),selected);
   const bounds=await page.evaluate(()=>{
    const shell=document.querySelector('.loot-shell').getBoundingClientRect();
    const panel=document.querySelector('[data-loot-panel]:not([hidden])');
    return{shell:[shell.left,shell.top,shell.right,shell.bottom],panelHeight:panel.clientHeight,overflow:document.documentElement.scrollWidth>innerWidth,internalOverflow:panel.scrollWidth>panel.clientWidth,
      undersized:[...panel.querySelectorAll('button,select')].filter(n=>n.getClientRects().length).map(n=>n.getBoundingClientRect()).filter(r=>r.width<43||r.height<43).length};
   });
   assert.ok(bounds.shell[0]>=-1&&bounds.shell[1]>=-1&&bounds.shell[2]<=width+1&&bounds.shell[3]<=height+1,JSON.stringify(bounds));
   assert.ok(bounds.panelHeight>100,JSON.stringify(bounds));
   assert.equal(bounds.overflow,false);assert.equal(bounds.internalOverflow,false);assert.equal(bounds.undersized,0);
   await page.screenshot({path:path.join(out,`${width}x${height}-${tab}.png`)});
  }
  // Capacity and all 52 items use the existing inventory runtime, with no display truncation.
  assert.match(await page.locator('#postcombat-loot-capacity').innerText(),/12 espacios libres/);
  assert.match(await page.locator('#postcombat-loot-capacity').innerText(),/80 espacios libres/);
  await page.locator('[data-loot-tab="inventory"]').click();
  assert.equal(await page.locator('#postcombat-loot-inventory button').count(),52);
  await page.locator('#postcombat-loot-inventory button').last().click();
  assert.match(await page.locator('#postcombat-loot-message').innerText(),/Objeto de prueba/);
  await page.waitForFunction(()=>[...document.querySelectorAll('#postcombat-loot-inventory img')].every(img=>img.complete&&img.naturalWidth>0));
  // Refresh does not reset the tab or selected corpse.
  await page.evaluate(()=>LuminousPlayerPostCombatLoot.render());
  assert.equal(await page.locator('[data-loot-tab="inventory"]').getAttribute('aria-selected'),'true');
  await page.locator('[data-loot-tab="results"]').click();
  assert.doesNotMatch(await page.locator('#postcombat-loot-results .selected').innerText(),/Autopsia/);
  await page.locator('[data-loot-tab="actions"]').click();
  await page.locator('[data-corpse-select="c2"]').click();
  await page.waitForFunction(()=>LuminousPlayerPostCombatLoot.state.claim?.lootInstanceId==='c2');
  await page.locator('[data-loot-card="c2"] [data-loot-action="search"]').click();
  await page.waitForFunction(()=>!LuminousPlayerPostCombatLoot.state.busy);
  assert.equal(await page.evaluate(()=>qa.writes.at(-1).lootInstanceId),'c2');
  await page.locator('[data-loot-tab="results"]').click();
  assert.match(await page.locator('#postcombat-loot-results .selected .loot-attempts').innerText(),/14 \/ TH 10/);
  // Keyboard tab navigation and Escape return focus to the entry point.
  await page.locator('[data-loot-tab="actions"]').focus();
  await page.keyboard.press('ArrowRight');
  assert.equal(await page.locator('[data-loot-tab="results"]').getAttribute('aria-selected'),'true');
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#postcombat-loot-modal').getAttribute('aria-hidden'),'true');
  assert.equal(await page.evaluate(()=>document.activeElement.id),'btn-postcombat-loot');
  await page.locator('#btn-postcombat-loot').click();
  await page.waitForFunction(()=>LuminousPlayerPostCombatLoot.state.claim?.lootInstanceId==='c2');
  // Queued, full/zero capacity, pending delivery, empty, denied and error states.
  await page.evaluate(()=>{qa.mode='queued';qa.actor.activeSlotLimit=0;qa.actor.stashSlotLimit=0;});
  await page.locator('[data-loot-card="c2"] [data-loot-action="harvest"]').click();
  await page.waitForFunction(()=>!LuminousPlayerPostCombatLoot.state.busy);
  assert.equal(await page.locator('[data-loot-card="c2"] [data-loot-action="harvest"]').isDisabled(),true);
  await page.locator('[data-loot-tab="space"]').click();
  assert.equal(await page.locator('.loot-space-full').count(),2);
  assert.match(await page.locator('#postcombat-loot-capacity').innerText(),/52 \/ 0 ocupados/);
  await page.evaluate(()=>{qa.mode='success';qa.corpses.c2.pendingDeliveries=[{id:'delivery',actorId:'hunter'}];return LuminousPlayerPostCombatLoot.render();});
  await page.locator('[data-loot-tab="actions"]').click();
  await page.locator('[data-loot-card="c2"] [data-pending-id]').click();
  await page.waitForFunction(()=>!LuminousPlayerPostCombatLoot.state.busy);
  assert.equal(await page.evaluate(()=>qa.writes.at(-1).deliveryId),'delivery');
  await page.evaluate(()=>{qa.mode='error';});
  await page.locator('[data-loot-card="c2"] [data-loot-action="examine"]').click();
  await page.waitForFunction(()=>!LuminousPlayerPostCombatLoot.state.busy);
  assert.match(await page.locator('#postcombat-loot-message').innerText(),/No se pudo completar/);
  await page.evaluate(()=>{qa.actor.inventario_activo={};qa.corpses.c2.carried=[];qa.corpses.c2.attempts=[];return LuminousPlayerPostCombatLoot.render();});
  await page.locator('[data-loot-tab="inventory"]').click();
  assert.match(await page.locator('.loot-inventory-empty').innerText(),/vacío/);
  await page.locator('[data-loot-tab="results"]').click();
  assert.match(await page.locator('#postcombat-loot-results .selected').innerText(),/Todavía no has completado/);
  await page.evaluate(()=>{LuminousPlayerPostCombatLoot.state.claim=null;LuminousPlayerPostCombatLoot.state.claims.c2={playerId:'other',uid:'other',expiresAt:Date.now()+60000};return LuminousPlayerPostCombatLoot.render();});
  await page.locator('[data-loot-tab="actions"]').click();
  for(const button of await page.locator('[data-loot-card="c2"] [data-loot-action]').all())assert.equal(await button.isDisabled(),true);
  assert.deepEqual(errors,[]);
  console.log(`PASS ${width}x${height}: tabs, scroll, capacity, inventory, rolls, queue, permissions, keyboard and states`);
  await context.close();
 }
} finally {await browser.close();await new Promise(r=>server.close(r));}
