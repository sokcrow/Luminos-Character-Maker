import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

function exercise(root){
  const viewer=fs.readFileSync(path.join(root,'Battle-viewer.html'),'utf8');
  const source=fs.readFileSync(path.join(root,'combat/source/combat-v073-live.html'),'utf8');
  const start=viewer.indexOf('    const webglStateNeedle='),tail='.replace(webglApiNeedle,webglApiPatch);';
  const patch=vm.createContext({});
  vm.runInContext('let html='+JSON.stringify(source)+';\n'+viewer.slice(start,viewer.indexOf(tail,start)+tail.length)+'\nglobalThis.patched=html;',patch);
  const html=patch.patched,subscriptions=[],pending=new Map();
  let calls=0,renders=0,serial=0,now=0,running=true;
  const host={classList:{contains:name=>name==='round-running'&&running}},field={},overlay={},hud={};
  const context=vm.createContext({Math,Map,Set,WeakMap,console,host,field,particles:[],enabled:true,lastFrame:0,
    document:{hidden:false,getElementById:id=>id==='target-intent-overlay'?overlay:null},performance:{now:()=>now},
    requestAnimationFrame:fn=>{pending.set(++serial,fn);return serial},cancelAnimationFrame:id=>pending.delete(id),
    resize(){},gl:{COLOR_BUFFER_BIT:1,clearColor(){},clear(){renders++}},renderOverlayBatch(){},
    MutationObserver:class{constructor(callback){this.callback=callback}observe(target,options){subscriptions.push({target,options,callback:this.callback})}},
  });context.window=context;
  vm.runInContext(html.slice(html.indexOf('let rafId=0,dirty=true'),html.indexOf('  function handleCameraTransition('))+'\n'+
    html.slice(html.indexOf('  const webglMutationObserver='),html.indexOf('  const webglResizeObserver=')),context);
  function tick(){now+=16;const rows=[...pending.values()];pending.clear();rows.forEach(fn=>fn(now))}
  function mutate(target,attributeName='style',type='attributes'){
    const row={target,attributeName,type};
    const matched=subscriptions.filter(s=>(s.target===target||(s.target===host&&s.options.subtree))&&
      (type==='childList'?s.options.childList:s.options.attributes&&s.options.attributeFilter.includes(attributeName)));
    for(const callback of new Set(matched.map(s=>s.callback))){calls++;callback([row])}
  }
  for(let clash=0;clash<3;clash++)for(let coinFrame=0;coinFrame<100;coinFrame++){
    mutate(hud);mutate(hud,'class');mutate(hud,null,'childList');tick();
  }
  const unrelated={callbacks:calls,canvasFrames:renders};
  // Real overlay changes, including removals, and camera/host changes still
  // wake the canvas. Multiple invalidations have at most one pending RAF.
  mutate(overlay,'d');mutate(overlay,'cx');mutate(overlay,null,'childList');mutate(field);mutate(host,'class');
  assert.equal(pending.size,1);tick();assert.ok(renders>unrelated.canvasFrames);
  running=false;mutate(overlay,'d');tick();assert.ok(pending.size<=1);
  return unrelated;
}
const after=exercise(process.cwd());assert.deepEqual(after,{callbacks:0,canvasFrames:0},'HUD/Coins cannot wake the WebGL overlay');
const before=process.argv[2]?exercise(path.resolve(process.argv[2])):null;
if(before){assert.equal(before.callbacks,900);assert.equal(before.canvasFrames,300)}
console.log(JSON.stringify({scenario:'3 Clashes × 100 HUD/Coin frames; deterministic work counts, not FPS',before,after}));
