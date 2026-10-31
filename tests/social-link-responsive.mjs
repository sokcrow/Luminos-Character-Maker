// Run with Playwright + Chromium installed: node tests/social-link-responsive.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';
const source = path => fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');
const browser = await chromium.launch({headless:true});
try {
  for (const [width,height] of [[360,800],[390,844],[844,390],[768,1024],[1280,720],[1920,1080]]) {
    const page = await browser.newPage({viewport:{width,height}});
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.setContent('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body style="margin:0;background:#101014"><div id="dashboard-actores"></div><button name="act_hud_vinculos">Consultar vínculos</button>');
    await page.addScriptTag({content:`(() => {
      const data={campaña:{jugadores:{alice:{uid:'qa-user',nombre:'Alice'},bob:{uid:'qa-bob',nombre:'Bob'}},base_datos_npcs:{},actores:{}}};
      const listeners=[];const copy=v=>v==null?v:JSON.parse(JSON.stringify(v));
      const get=path=>path.split('/').filter(Boolean).reduce((o,k)=>o?.[k],data);
      const snap=path=>({val:()=>copy(get(path))||null});
      const db={ref(path=''){return {on:(e,cb)=>{listeners.push({path,cb});cb(snap(path));},off:(e,cb)=>{const i=listeners.findIndex(row=>row.path===path&&row.cb===cb);if(i>=0)listeners.splice(i,1);},once:async()=>snap(path),update:async updates=>{for(const [key,value] of Object.entries(updates)){const parts=(path?path+'/'+key:key).split('/');let o=data;for(const p of parts.slice(0,-1))o=o[p]||={};if(value==null)delete o[parts.at(-1)];else o[parts.at(-1)]=copy(value);}for(const row of [...listeners])row.cb(snap(row.path));}}}};
      const database=()=>db;database.ServerValue={TIMESTAMP:100};
      window.firebase={database,apps:[{}],auth:()=>({currentUser:{uid:'qa-user'},onAuthStateChanged:cb=>{cb({uid:'qa-user'});return()=>{};}})};
    })();`});
    for(const path of ['css/character-manager-studio.css','css/character-manager-social.css','css/social-link-hud.css'])await page.addStyleTag({content:source(path)});
    for(const path of ['js/social-link-core.js','js/character-manager-engine.js','js/bond-engine.js','js/character-manager-studio.js','js/character-manager-social-studio.js'])await page.addScriptTag({content:source(path)});
    await page.locator('#character-manager-name').fill('Hopkins');
    await page.getByRole('button',{name:'Asignación',exact:true}).click();
    await page.getByLabel('Social Link',{exact:true}).check();
    await page.getByLabel('Alice',{exact:true}).check();
    await page.getByLabel('Tipo de vínculo').selectOption('combatant');
    await page.getByRole('button',{name:'Guardar actor',exact:true}).click();
    await page.locator('#character-manager-feedback').filter({hasText:'SINCRONIZADO'}).waitFor();
    const progress=page.locator('.cm-social-progress');await progress.locator('summary').click();
    await page.getByLabel('Rango (0–10)',{exact:true}).fill('5');
    await page.getByLabel('Afinidad hacia el siguiente rango',{exact:true}).fill('24');
    await page.getByLabel('Historia compartida · visible para este jugador',{exact:true}).fill('Una historia publicada.');
    await page.getByLabel('Beneficios publicados · uno por línea',{exact:true}).fill('Cobertura — Condiciones publicadas por el DM.');
    await page.getByRole('button',{name:'Guardar progreso',exact:true}).click();
    await page.getByText('Progreso publicado para este jugador.',{exact:true}).waitFor();
    for(const path of ['js/social-link-hud.js','js/player-hud-navigation.js'])await page.addScriptTag({content:source(path)});
    await page.evaluate(()=>window.dispatchEvent(new CustomEvent('luminous:player-data',{detail:{playerId:'alice',data:{uid:'qa-user'}}})));
    await page.getByRole('button',{name:'Consultar vínculos',exact:true}).click();
    await page.locator('#vinculos-modal[aria-hidden="false"]').waitFor();
    assert.equal(await page.locator('.sl-person').count(),1);
    assert.match(await page.locator('.sl-detail').innerText(),/Hopkins/);
    assert.match(await page.locator('.sl-detail').innerText(),/24 \/ 50/);
    await page.getByRole('tab',{name:'Beneficios',exact:true}).click();
    await page.locator('.sl-benefit summary').click();
    assert.equal(await page.getByText('Condiciones publicadas por el DM.',{exact:true}).isVisible(),true);
    const geometry=await page.locator('#vinculos-modal .sl-window').evaluate(el=>{const r=el.getBoundingClientRect();return {left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:innerWidth,height:innerHeight,overflow:[...el.querySelectorAll('.sl-detail,.sl-panel')].some(n=>n.scrollWidth>n.clientWidth+1)};});
    assert.ok(geometry.left>=0&&geometry.top>=0&&geometry.right<=geometry.width+1&&geometry.bottom<=geometry.height+1,JSON.stringify({width,height,geometry}));
    assert.equal(geometry.overflow,false,'Detail panels cannot overflow horizontally');
    await page.getByRole('button',{name:'Cerrar vínculos',exact:true}).press('Escape');
    assert.equal(await page.locator('#vinculos-modal').getAttribute('aria-hidden'),'true');
    await page.evaluate(()=>window.dispatchEvent(new CustomEvent('luminous:player-data',{detail:{playerId:'bob',data:{uid:'qa-user'}}})));
    await page.getByRole('button',{name:'Consultar vínculos',exact:true}).click();
    assert.equal(await page.locator('.sl-person').count(),0,'A player without a published link sees an empty roster');
    assert.equal(errors.length,0,errors.join('\n'));
    await page.close();console.log('Social Link HUD + DM editor:',width+'x'+height,'OK');
  }
} finally {await browser.close();}
