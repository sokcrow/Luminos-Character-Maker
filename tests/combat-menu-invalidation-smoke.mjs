import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync('js/combat-v073-economy-menu.js','utf8');
const start=source.indexOf('    if (!state.menuObserver &&'),end=source.indexOf('    state.installed = true;',start);
let callback,reads=0,visibility=0,serial=0,unload;
const frames=new Map(),state={menuObserver:null,menuSyncFrame:null};
const c=vm.createContext({state,MutationObserver:class{constructor(fn){callback=fn}observe(){}disconnect(){this.disconnected=true}},
  document:{body:{}},requestAnimationFrame:fn=>{frames.set(++serial,fn);return serial},cancelAnimationFrame:id=>frames.delete(id),
  addEventListener:(type,fn)=>{if(type==='beforeunload')unload=fn},
  syncSpellMenuVisibility:()=>visibility++,syncResponsiveMenuLayout:()=>reads++,
});c.global=c;vm.runInContext(source.slice(start,end),c);
const unrelated={target:{closest:()=>null},addedNodes:[{nodeType:1,matches:()=>false,querySelector:()=>null}],removedNodes:[]};
for(let i=0;i<500;i++)callback([unrelated]);
assert.equal(reads,0);assert.equal(visibility,0);assert.equal(frames.size,0);
const menuChange={...unrelated,target:{closest:()=>({id:'command-ring'})}};
for(let i=0;i<500;i++)callback([menuChange]);
assert.equal(frames.size,1);const [id,fn]=[...frames][0];frames.delete(id);fn();
assert.equal(reads,1);assert.equal(visibility,1);
// Replacing/removing a whole menu must also refresh the commands.
callback([{...unrelated,removedNodes:[{nodeType:1,matches:()=>true}]}]);assert.equal(frames.size,1);
unload();assert.equal(frames.size,0);assert.equal(state.menuObserver.disconnected,true);
console.log('Menu: 500 unrelated Coin/HUD deliveries → 0 scans/layout reads; 500 menu changes → 1 refresh; replacement/removal and teardown pass.');
