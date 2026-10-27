import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const source=fs.readFileSync('combat/source/combat-v073-live.html','utf8'),viewer=fs.readFileSync('Battle-viewer.html','utf8');
const start=viewer.indexOf('    const webglStateNeedle='),tail='.replace(webglApiNeedle,webglApiPatch);',p=vm.createContext({});
vm.runInContext('let html='+JSON.stringify(source)+';\n'+viewer.slice(start,viewer.indexOf(tail,start)+tail.length)+'\nglobalThis.patched=html;',p);
const html=p.patched,code=html.slice(html.indexOf('let overlayViewportBox=null;'),html.indexOf('  function makeTextureFromImage('));
let running=true,w=669,h=731,writes=0;const calls=[];
const c=vm.createContext({Math,Number,Object,particles:[{x:330,y:350,start:0,life:310}],host:{get clientWidth(){return w},get clientHeight(){return h},classList:{contains:()=>running}},
 window:{devicePixelRatio:1.5},lowPowerDevice:false,cssW:0,cssH:0,dpr:1,innerWidth:1280,innerHeight:720,performance:{now:()=>150},
 canvas:{width:1,height:1,style:new Proxy({},{set(o,k,v){writes++;o[k]=v;return true}})},gl:{viewport:(...v)=>calls.push(v)},
});vm.runInContext(code,c);c.resize(150);const b=c.overlayViewport(w,h,1.5,150);
assert.equal(c.canvas.width,b.width);assert.equal(c.canvas.height,b.height);
for(const [x,y]of [[330,350],[273.1,294.3],[387.8,407.8]]){
 const sx=b.fullW/w,sy=b.fullH/h,globalX=parseFloat(c.canvas.style.left)+(x*sx-b.left)/sx,globalY=parseFloat(c.canvas.style.top)+(y*sy-b.top)/sy;
 assert.ok(Math.abs(globalX-x)<1e-9&&Math.abs(globalY-y)<1e-9,'Same global coordinates and sample density at fractional DPR');
}
const before=writes;c.resize(170);assert.equal(writes,before);assert.equal(calls.length,1,'Stable bounds do not allocate another framebuffer');
c.resize(310);assert.equal(c.canvas.width*c.canvas.height,1,'Expired VFX release the full buffer');running=false;c.resize(310);assert.equal(c.canvas.width,Math.round(w*1.5));assert.equal(c.canvas.height,Math.round(h*1.5),'Planning returns to the full viewport');
running=true;for(const [width,height]of [[390,844],[669,731],[1280,720]])for(const dpr of [1,1.25,1.5]){
 c.particles=[{x:width/2,y:height/2,start:0,life:310}];const box=c.overlayViewport(width,height,dpr,150);const sx=box.fullW/width,sy=box.fullH/height;
 for(let angle=0;angle<Math.PI*2;angle+=.05){const x=width/2+Math.cos(angle)*59,y=height/2+Math.sin(angle)*59;assert.ok(x*sx>=box.left&&x*sx<=box.left+box.width&&y*sy>=box.top&&y*sy<=box.top+box.height,'All original rays fit without clipping');}
}
c.particles=[{x:-200,y:-200,start:0,life:310}];assert.equal(c.overlayViewport(390,844,1,150).width,1,'Offscreen VFX stay offscreen');
console.log('Sparse overlay viewport: unchanged DPR/projection, bounded full rays, stable allocations, exact expiry and full planning viewport pass.');
