import {test,expect} from '@playwright/test';
const sizes=[[360,800],[390,844],[844,390],[768,1024],[1280,720],[1920,1080]];
for(const [width,height]of sizes){
 test.describe(`${width}x${height}`,()=>{
 test.use({hasTouch:width<=960});
 test(`Game inputs and themed focus ${width}x${height}`,async({page},info)=>{
  await page.setViewportSize({width,height});
  await page.setContent(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:16px;background:#171014;color:#eadbc5;font:16px sans-serif"><button id="action" style="min-height:44px">Acción</button><div style="margin:16px 0"><img id="portrait" width="80" height="80" alt="Retrato" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80'%3E%3Crect width='80' height='80' fill='%23825d3e'/%3E%3C/svg%3E"></div><label>Diálogo<textarea id="message" style="display:block;box-sizing:border-box;width:100%;min-height:80px"></textarea></label><div id="editor" contenteditable="true" style="margin-top:16px;min-height:44px">Notas editables</div><div id="inventory" draggable="true" style="margin-top:16px;min-height:44px">Objeto arrastrable</div><div style="height:1200px"></div></body></html>`);
  await page.addStyleTag({path:'css/game-input-policy.css'});await page.addScriptTag({path:'js/game-input-policy.js'});
  await page.evaluate(()=>{
   window.inputEvents=[];
   document.addEventListener('contextmenu',e=>window.inputEvents.push({target:e.target.id,prevented:e.defaultPrevented}));
   document.addEventListener('pointerdown',e=>{window.pointerWasPrevented=e.defaultPrevented;});
  });
  await page.keyboard.press('Tab');await expect(page.locator('#action')).toBeFocused();
  await expect(page.locator('#action')).toHaveCSS('outline-color','rgb(215, 183, 124)');await expect(page.locator('#action')).toHaveCSS('outline-style','solid');
  await page.screenshot({path:info.outputPath(`keyboard-focus-${width}x${height}.png`)});
  await page.locator('#portrait').click({button:'right'});
  expect(await page.evaluate(()=>window.inputEvents.at(-1))).toEqual({target:'portrait',prevented:true});
  expect(await page.evaluate(()=>window.pointerWasPrevented)).toBe(false);
  if(width<=960){await page.locator('#portrait').tap();expect(await page.evaluate(()=>window.pointerWasPrevented)).toBe(false);}
  await page.locator('#message').fill('Diálogo conservado');
  for(const id of ['message','editor']){
   expect(await page.locator('#'+id).evaluate(el=>{const e=new MouseEvent('contextmenu',{bubbles:true,cancelable:true});el.dispatchEvent(e);return e.defaultPrevented;})).toBe(false);
   await expect(page.locator('#'+id)).toHaveCSS('user-select','text');
  }
  expect(await page.locator('#inventory').evaluate(el=>{const e=new Event('dragstart',{bubbles:true,cancelable:true});el.dispatchEvent(e);return e.defaultPrevented;})).toBe(false);
  expect(await page.locator('#portrait').evaluate(el=>{const e=new Event('dragstart',{bubbles:true,cancelable:true});el.dispatchEvent(e);return e.defaultPrevented;})).toBe(true);
  expect(await page.locator('#portrait').evaluate(el=>{for(const type of ['pointerdown','touchstart','touchmove']){const e=new Event(type,{bubbles:true,cancelable:true});el.dispatchEvent(e);if(e.defaultPrevented)return false;}return true;})).toBe(true);
  await page.mouse.wheel(0,500);await expect.poll(()=>page.evaluate(()=>window.scrollY)).toBeGreaterThan(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
 });
 });
}
