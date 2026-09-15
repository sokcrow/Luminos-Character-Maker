import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read=file=>fs.readFileSync(file,'utf8');
const dmPanel=read('pantalla_dm.html');
const utils=read('js/utils.js');
const bridge=read('js/dm-combat-live-viewer.js');

assert.ok(dmPanel.includes('id="tab-combate"'),'actual pantalla_dm Combat pane must exist');
assert.ok(dmPanel.includes('<script src="js/utils.js"></script>'),'actual pantalla_dm must load the bootstrap that installs Combat assets');
assert.ok(utils.includes("'js/dm-combat-live-viewer.js'"),'real DM bootstrap must load the live Battle bridge');
assert.ok(utils.includes("'dm-combat-live-viewer-script'"),'live Battle bridge must use a stable script id');
assert.ok(bridge.includes("getElementById?.('tab-combate')"),'bridge must mount into the exact Combat tab shown to the DM');
assert.ok(bridge.includes('src="Battle-viewer.html"'),'DM Combat tab must use the same canonical Battle Viewer as Players');
assert.ok(bridge.includes('loading="eager"'),'DM Battle must not wait on lazy iframe visibility');
assert.ok(bridge.includes('LuminousCombatDmObserver073?.enforceDmView?.()'),'mounted DM Battle must reassert observer visibility');
assert.ok(bridge.includes('LuminousWebGL2Renderer?.requestRender?.()'),'mounted DM Battle must explicitly redraw the demand renderer');

class FakeElement {
  constructor(tag='div',id=''){
    this.tagName=tag.toUpperCase();this.id=id;this.dataset={};this.style={};this.children=[];this.listeners={};this.attributes={};this.firstChild=null;this._innerHTML='';this.contentWindow=null;
  }
  set innerHTML(value){
    this._innerHTML=String(value);
    for(const [,tag,id] of this._innerHTML.matchAll(/<(iframe|span|button)[^>]*id="([^"]+)"[^>]*>/g)){
      const node=new FakeElement(tag,id);
      const src=this._innerHTML.match(new RegExp(`<${tag}[^>]*id="${id}"[^>]*src="([^"]+)"`))?.[1];
      if(src)node.attributes.src=src;
      elements.set(id,node);
      this.children.push(node);
    }
  }
  get innerHTML(){return this._innerHTML}
  insertBefore(node){this.children.unshift(node);this.firstChild=this.children[0]||null;}
  appendChild(node){this.children.push(node);if(!this.firstChild)this.firstChild=node;}
  addEventListener(type,handler){(this.listeners[type]||=[]).push(handler);}
  dispatch(type){for(const handler of this.listeners[type]||[])handler({type,target:this});}
  getAttribute(name){return this.attributes[name]??null;}
  getBoundingClientRect(){return {width:1200,height:800};}
}

const elements=new Map();
const host=new FakeElement('div','tab-combate');elements.set(host.id,host);
const tabButton=new FakeElement('button','combat-tab-button');tabButton.dataset.tab='tab-combate';
let enabledCalls=0,enforceCalls=0,renderCalls=0,resizeCalls=0;
const child={
  LuminousWebGL2Renderer:{setEnabled(value){if(value)enabledCalls+=1;},requestRender(){renderCalls+=1;}},
  LuminousCombatDmObserver073:{enforceDmView(){enforceCalls+=1;}},
  LuminousCombatLiveAdapter073:{state:{role:'dm'}},
  document:{getElementById(){return null;}},
  Event:class{constructor(type){this.type=type;}},
  dispatchEvent(event){if(event.type==='resize')resizeCalls+=1;},
};
const document={
  readyState:'complete',
  getElementById(id){return elements.get(id)||null;},
  querySelector(selector){return selector==='[data-tab="tab-combate"]'?tabButton:null;},
  createElement(tag){const node=new FakeElement(tag);if(tag==='iframe')node.contentWindow=child;return node;},
  addEventListener(){},
};
class FakeMutationObserver{constructor(handler){this.handler=handler;}observe(){}disconnect(){}}
const timers=[];
const window={
  document,
  MutationObserver:FakeMutationObserver,
  getComputedStyle(){return {display:'block',visibility:'visible'};},
  setTimeout(fn){timers.push(fn);return timers.length;},
  clearTimeout(){},
  addEventListener(){},
  console,
};
window.window=window;
vm.runInNewContext(bridge,{window,console},{filename:'dm-combat-live-viewer.js'});

assert.equal(host.children[0]?.id,'dm-combat-live-battle','live Battle panel must be inserted before legacy Combat tools');
const panel=elements.get('dm-combat-live-battle')||host.children[0];
assert.match(panel.innerHTML,/Battle-viewer\.html/,'runtime mount must point at canonical Battle Viewer');
const frame=elements.get('dm-combat-live-frame');
assert.ok(frame,'runtime mount must create the live Battle iframe');
frame.contentWindow=child;
frame.dispatch('load');
while(timers.length)timers.shift()();
assert.ok(enabledCalls>0,'DM runtime must keep renderer enabled');
assert.ok(enforceCalls>0,'DM runtime must invoke observer visibility enforcement');
assert.ok(renderCalls>0,'DM runtime must request an actual frame redraw');
assert.ok(resizeCalls>0,'DM runtime must notify Battle Viewer that its surface became visible');

console.log('DM pantalla real canonical Battle Viewer mount smoke: ok');
