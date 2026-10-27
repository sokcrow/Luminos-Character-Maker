import {test,expect} from '@playwright/test';
import fs from 'node:fs';import vm from 'node:vm';
test('Cropped WebGL framebuffer matches original full-canvas VFX pixels',async({page})=>{
 test.setTimeout(120000);
 const source=fs.readFileSync('combat/source/combat-v073-live.html','utf8'),viewer=fs.readFileSync('Battle-viewer.html','utf8');
 const start=viewer.indexOf('    const webglStateNeedle='),tail='.replace(webglApiNeedle,webglApiPatch);',ctx=vm.createContext({});
 vm.runInContext('let html='+JSON.stringify(source)+';\n'+viewer.slice(start,viewer.indexOf(tail,start)+tail.length)+'\nglobalThis.patched=html;',ctx);
 const html=ctx.patched;
 const resize=html.slice(html.indexOf('let overlayViewportBox=null;'),html.indexOf('  function makeTextureFromImage('));
 const draw=html.slice(html.indexOf('  function drawTriangles(points,color){'),html.indexOf('  function lineSegment('));
 const geo=html.slice(html.indexOf('  function lineSegment('),html.indexOf('  function arrowHead('));
 const particles=html.slice(html.indexOf('  function burst('),html.indexOf('  // Route future Clash contact flashes'));
 const vertex=source.match(/const VERT_COLOR=\x60([\s\S]*?)\x60;/)[1],fragment=source.match(/const FRAG_COLOR=\x60([\s\S]*?)\x60;/)[1];
 const results=await page.evaluate(({resize,draw,geo,particles,vertex,fragment})=>{
  const canvas=document.createElement('canvas');document.body.appendChild(canvas);
  const gl=canvas.getContext('webgl2',{alpha:true,antialias:true,premultipliedAlpha:true,depth:false,stencil:false,preserveDrawingBuffer:false,powerPreference:'high-performance'});
  if(!gl)throw Error('WebGL2 unavailable: pixel equivalence not checked');
  function shader(type,src){const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;}
  const program=gl.createProgram();gl.attachShader(program,shader(gl.VERTEX_SHADER,vertex));gl.attachShader(program,shader(gl.FRAGMENT_SHADER,fragment));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));
  const loc={pos:gl.getAttribLocation(program,'a_position'),resolution:gl.getUniformLocation(program,'u_resolution'),color:gl.getUniformLocation(program,'u_color')},buffer=gl.createBuffer(),rows=[];
  let running=false,w=390,h=844;
  const host={get clientWidth(){return w},get clientHeight(){return h},classList:{contains:()=>running}};
  const live=[];
  const make=new Function('gl','canvas','host','particles','window','colorProgram','colorBuffer','colorLoc',
   'let cssW=0,cssH=0,dpr=1,triangleBatch=null;const lowPowerDevice=false,innerWidth=1280,innerHeight=720;'+resize+'\n'+draw+'\n'+geo+'\n'+particles+'\nreturn {resize,renderParticles,box:()=>overlayViewportBox};');
  for(const dims of [[390,844],[669,731],[1280,720]])for(const scale of [1,1.5]){
   [w,h]=dims;const api=make(gl,canvas,host,live,{devicePixelRatio:scale},program,buffer,loc);
   const scenes=[
    [{x:w/2,y:h/2,kind:'clash',range:false,start:0,life:310,seed:123}],
    [{x:8,y:12,kind:'hit',range:true,start:0,life:310,seed:456}],
    [{x:w-8,y:h-8,kind:'clash',range:false,start:0,life:310,seed:789}],
    [{x:w/2,y:h/2,kind:'clash',range:false,start:0,life:310,seed:123},{x:w/2+2,y:h/2+2,kind:'hit',range:true,start:0,life:310,seed:456}],
    [{x:-200,y:-200,kind:'hit',range:true,start:0,life:310,seed:456}],
   ];
   for(const [sceneIndex,scene] of scenes.entries()){
    running=false;live.splice(0,live.length,...structuredClone(scene));api.resize(150);
    gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.disable(gl.DEPTH_TEST);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);api.renderParticles(150);
    const fw=canvas.width,fh=canvas.height,full=new Uint8Array(fw*fh*4);gl.readPixels(0,0,fw,fh,gl.RGBA,gl.UNSIGNED_BYTE,full);
    running=true;live.splice(0,live.length,...structuredClone(scene));api.resize(150);const box={...api.box()};
    gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);api.renderParticles(150);
    const crop=new Uint8Array(canvas.width*canvas.height*4);gl.readPixels(0,0,canvas.width,canvas.height,gl.RGBA,gl.UNSIGNED_BYTE,crop);
    const originY=fh-box.top-box.height;let different=0,maxChannelDelta=0;
    for(let y=0;y<fh;y++)for(let x=0;x<fw;x++)for(let channel=0;channel<4;channel++){
     const inside=x>=box.left&&x<box.left+box.width&&y>=originY&&y<originY+box.height;
     const actual=inside?crop[((y-originY)*box.width+x-box.left)*4+channel]:0;
     const delta=Math.abs(actual-full[(y*fw+x)*4+channel]);if(delta)different++;maxChannelDelta=Math.max(maxChannelDelta,delta);
    }
    let ink=0;for(let n=3;n<full.length;n+=4)if(full[n])ink++;
    rows.push({w,h,scale,sceneIndex,ink,different,maxChannelDelta,fullPixels:fw*fh,cropPixels:box.width*box.height});
    if(gl.getError()!==gl.NO_ERROR)throw Error('Invalid cropped viewport');
   }
  }
  return rows;
 },{resize,draw,geo,particles,vertex,fragment});
 expect(results).toHaveLength(30);
 for(const row of results){expect(row.different,JSON.stringify(row)).toBe(0);if(row.sceneIndex<4)expect(row.ink,'Reference VFX must be visible').toBeGreaterThan(0);}
 expect(results.some(row=>row.cropPixels<row.fullPixels/20)).toBe(true);
 console.log('GPU_PIXEL_EQUIVALENCE',JSON.stringify({cases:results.length,differingChannels:results.reduce((n,row)=>n+row.different,0)}));
});
