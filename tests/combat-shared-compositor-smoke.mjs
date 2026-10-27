import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const viewer=fs.readFileSync('Battle-viewer.html','utf8'),source=fs.readFileSync('combat/source/combat-v073-live.html','utf8');
const start=viewer.indexOf('    const webglStateNeedle='),tail='.replace(webglApiNeedle,webglApiPatch);',end=viewer.indexOf(tail,start)+tail.length;
const patch=vm.createContext({});vm.runInContext('let html='+JSON.stringify(source)+';\n'+viewer.slice(start,end)+'\nglobalThis.patched=html;',patch);
const html=patch.patched;assert.ok(html.includes('const domSpriteMode=true;'));assert.ok(html.includes('const bg=null;'));
const particlesCode=html.slice(html.indexOf('  function burst('),html.indexOf('  // Route future Clash contact flashes'));
const frameCode=html.slice(html.indexOf('let rafId=0,dirty=true'),html.indexOf('  function handleCameraTransition('));
assert.ok(particlesCode.includes('life:310'),'Original particle duration remains');
let now=0,running=true,clears=0,rays=0,arrows=0,serial=0;
const frames=new Map();const c=vm.createContext({console,Math,WeakMap,Map,Set,
 performance:{now:()=>now},document:{hidden:false},host:{classList:{contains:k=>k==='round-running'&&running}},
 particles:[],enabled:true,lastFrame:0,lowPowerDevice:false,
 requestAnimationFrame:fn=>{frames.set(++serial,fn);return serial},cancelAnimationFrame:id=>frames.delete(id),
 resize(){},gl:{COLOR_BUFFER_BIT:1,clearColor(){},clear(){clears++}},
 renderBackground(){throw Error('Base scene must remain in DOM')},renderSprites(){throw Error('Do not duplicate DOM sprites in WebGL')},
 renderIntentArrows(){if(!running)arrows++},renderOverlayBatch:at=>{c.renderIntentArrows();c.renderParticles(at)},circle(){},lineSegment(){rays++},
});c.window=c;
vm.runInContext(particlesCode+'\n'+frameCode,c);
function tick(at){now=at;const pending=[...frames];frames.clear();for(const [,fn]of pending)fn(at)}
c.ensureFrame(450);tick(0);assert.equal(frames.size,0,'An empty VFX canvas is idle during combat even after a DOM pose request');assert.equal(clears,1);
c.burst(40,80,{kind:'clash'});for(let at=16;at<400;at+=16)tick(at);
assert.ok(rays>0,'Clash particle rays still render');assert.equal(c.particles.length,0,'Particles finish at the original lifetime');assert.equal(frames.size,0,'Final clear stops the GPU loop after the VFX');
const before=clears;tick(500);assert.equal(clears,before,'No empty continuous canvas redraws between Coins');
running=false;now=600;c.ensureFrame(180);for(let at=600;at<850;at+=16)tick(at);assert.ok(arrows>1,'Planning arrows remain animated when requested');assert.equal(frames.size,0,'Planning settles back to idle');
c.ensureFrame(100);c.document.hidden=true;c.syncSurfaceActive();assert.equal(frames.size,0,'Hidden surface cancels rendering');
console.log('Shared compositor: actual bootstrap patch applied; DOM base for all roles, complete 310ms VFX, animated planning arrows, idle canvas between Coins and hidden-surface cancellation pass.');
