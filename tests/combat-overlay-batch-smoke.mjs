import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const source=fs.readFileSync('combat/source/combat-v073-live.html','utf8'),viewer=fs.readFileSync('Battle-viewer.html','utf8');
const start=viewer.indexOf('    const webglStateNeedle='),tail='.replace(webglApiNeedle,webglApiPatch);';
const patch=vm.createContext({});vm.runInContext('let html='+JSON.stringify(source)+';\n'+viewer.slice(start,viewer.indexOf(tail,start)+tail.length)+'\nglobalThis.patched=html;',patch);
const html=patch.patched;
const batch=html.slice(html.indexOf('let triangleBatch=null;'),html.indexOf('  function lineSegment('));
const geometry=html.slice(html.indexOf('  function lineSegment('),html.indexOf('  function arrowHead('));
const particle=html.slice(html.indexOf('  function burst('),html.indexOf('  // Route future Clash contact flashes'));
for(const lowPower of [false,true])for(const range of [false,true])for(const time of [16,150,300,310]){
 const draws=[];let points,color;
 const c=vm.createContext({console,Math,Array,Float32Array,lowPowerDevice:lowPower,particles:[],cssW:1280,cssH:720,
  colorProgram:{},colorBuffer:{},colorLoc:{pos:0,resolution:1,color:2},
  gl:{ARRAY_BUFFER:1,DYNAMIC_DRAW:2,FLOAT:3,TRIANGLES:4,useProgram(){},bindBuffer(){},bufferData(_t,data){points=Array.from(data)},enableVertexAttribArray(){},vertexAttribPointer(){},uniform2f(){},uniform4fv(_l,data){color=Array.from(data)},drawArrays(){draws.push({points:points.slice(),color:color.slice()})}},
  renderIntentArrows:()=>{c.lineSegment({x:0,y:0},{x:10,y:20},1,[.2,.6,1,.9]);c.lineSegment({x:10,y:20},{x:30,y:10},1,[.2,.6,1,.9]);c.lineSegment({x:40,y:10},{x:60,y:20},1,[1,.4,.2,.8]);},
 });c.window=c;
 vm.runInContext(batch+'\n'+geometry+'\n'+particle,c);
 const original=[{x:20,y:40,kind:'clash',range,start:0,life:310,seed:123},{x:22,y:42,kind:'hit',range:!range,start:0,life:310,seed:456}];
 c.particles=structuredClone(original);c.renderIntentArrows();c.renderParticles(time);const reference=structuredClone(draws);draws.length=0;
 c.particles=structuredClone(original);c.renderOverlayBatch(time);const batched=structuredClone(draws);
 function triangles(rows){return rows.flatMap(row=>Array.from({length:row.points.length/6},(_,i)=>({points:row.points.slice(i*6,i*6+6),color:row.color})));}
 assert.deepEqual(triangles(batched),triangles(reference),'Every Float32 vertex, color and primitive order is preserved, including overlapping particles');
 assert.ok(batched.length<reference.length,'Fewer GPU submissions for the same geometry');
 if(time<310)assert.equal(c.particles.length,2);else assert.equal(c.particles.length,0);
}
console.log('Overlay batching: identical Float32 triangles/colors/order for full/low-power, ranged/melee, overlapping hit/clash particles and expiry; fewer draw calls.');
