import {test,expect} from '@playwright/test';
import fs from 'node:fs';
const scripts=Object.fromEntries(['combat-results-ui','session-mvp-runtime','session-mvp-ui'].map(name=>[name,fs.readFileSync(new URL('../js/'+name+'.js',import.meta.url),'utf8')]));
const candidates={a:{id:'a',uid:'a-uid',name:'Agatha',level:10},b:{id:'b',uid:'b-uid',name:'Pierre',level:5},c:{id:'c',uid:'c-uid',name:'Lucien',level:5}};
async function mount(page){
 await page.route('http://mvp.test/**',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><button id="background">Theatre</button></body></html>'}));
 await page.goto('http://mvp.test/');
 await page.evaluate(()=>{
  window.data={'campaña/config/dm_uid':'dm','campaña/jugadores':{a:{uid:'a-uid'},b:{uid:'b-uid'}}};
  const listeners=new Map();window.authHandler=null;
  window.push=(path,value)=>{window.data[path]=value;for(const handler of listeners.get(path)||[])handler({val:()=>value});};
  window.firebase={auth:()=>({onAuthStateChanged:fn=>{window.authHandler=fn;queueMicrotask(()=>fn({uid:'dm'}));}}),database:()=>({ref:path=>({once:async()=>({val:()=>window.data[path]??null}),on:(_event,fn)=>{if(!listeners.has(path))listeners.set(path,new Set());listeners.get(path).add(fn);queueMicrotask(()=>fn({val:()=>window.data[path]??null}));},off:(_event,fn)=>listeners.get(path)?.delete(fn)})})};
 });
}
async function accessible(page,dialog){
 await expect(dialog).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 expect(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
 for(const button of await dialog.locator('button:visible').all()){
  const box=await button.boundingBox();expect(box.height).toBeGreaterThanOrEqual(44);
 }
}
for(const [width,height] of [[360,800],[390,844],[844,390],[768,1024],[1280,720],[1920,1080]]){
 test('MVP panels '+width+'x'+height,async({page})=>{
  await page.setViewportSize({width,height});await mount(page);
  await page.addScriptTag({content:scripts['combat-results-ui']});
  const roster=Object.values(candidates).map(c=>({...c,id:'player:'+c.id,kind:'player',portrait:''}));
  await page.evaluate(({roster})=>{push('campaña/combate/estado',{phase:'ENDED',result:'victory',encounterId:'responsive',resultRoster:roster,mvp:roster[0],rewardRows:roster.map(a=>({id:a.id,xp:100}))});push('campaña/estado_mundo/instancia_activa','teatro');},{roster});
  const results=page.locator('#limbus-results-overlay');await expect(results.locator('#limbus-results-confirm')).toBeVisible();await accessible(page,results.locator('.results-board'));
  await results.locator('button').scrollIntoViewIfNeeded();await results.locator('button').click();await expect(results).toBeHidden();
  expect(await page.evaluate(()=>localStorage.getItem('limbus-results:dm:responsive'))).toBe('confirmed');
  await page.evaluate(()=>push('campaña/combate/estado',{phase:'ENDED',result:'defeat',encounterId:'missing-roster'}));
  await expect(results.getByRole('button',{name:'Continuar'})).toBeVisible();await results.getByRole('button',{name:'Continuar'}).click();
  await page.addScriptTag({content:scripts['session-mvp-runtime']});await page.addScriptTag({content:scripts['session-mvp-ui']});
  const dialog=page.locator('#limbus-session-mvp-dialog');
  for(const phase of ['voting','closing','coins','awarding','completed']){
   await page.evaluate(({phase,candidates})=>push('campaña/mvp_sesion/actual',{id:'ui-'+phase,phase,candidates,tiedIds:['a','b','c'],coinRound:2,coinHistory:{round_1:{a:'Heads',b:'Heads',c:'Tails'}},winnerId:'a'}),{phase,candidates});
   await accessible(page,dialog);
   if(phase==='coins')await expect(dialog.getByText('Ronda 1:',{exact:false})).toBeVisible();
   await page.keyboard.press('Escape');await expect(page.locator('#limbus-session-mvp-shade')).toBeHidden();
   if(['voting','closing','coins','awarding'].includes(phase)){await page.locator('#limbus-session-mvp-action').click();await expect(dialog).toBeVisible();}
  }
  await page.evaluate(()=>authHandler(null));await expect(page.locator('#limbus-session-mvp-action')).toBeHidden();
 });
}
