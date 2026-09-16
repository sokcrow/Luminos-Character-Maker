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
assert.ok(bridge.includes("getElementById?.('tab-combate')"),'bridge must mount into the exact Combat tab shown to the DM');
assert.ok(bridge.includes('src="about:blank"'),'DM Battle iframe must not initialize its renderer while the Combat tab is hidden');
assert.ok(bridge.includes("BATTLE_SRC='Battle-viewer.html'"),'visible DM Combat tab must load the same canonical Battle Viewer as Players');
assert.ok(bridge.includes('surfaceActive?.()'),'DM bridge must verify the renderer surface instead of trusting role state alone');
assert.ok(bridge.includes('gameRect.width>100')&&bridge.includes('fieldRect.width>100'),'DM bridge must require a measurable game/battlefield before declaring Battle visible');
assert.ok(bridge.includes("surface?.ready&&surface?.role==='dm'"),'DM bridge must require canonical DM role before reporting observer readiness');
assert.ok(bridge.includes("classList?.remove?.('player-blinded','webgl2-background-ready')"),'DM bridge must restore DOM background fallback if WebGL remains inactive');

class FakeElement {
  constructor(tag='div',id=''){
    this.tagName=tag.toUpperCase();this.id=id;this.dataset={};this.style={};this.children=[];this.listeners={};this.attributes={};this.firstChild=null;this._innerHTML='';this.contentWindow=null;this._src='';this._hidden=false;this.textContent='';
  }
  set innerHTML(value){
    this._innerHTML=String(value);
    for(const match of this._innerHTML.matchAll(/<(iframe|span|button)[^>]*id="([^"]+)"[^>]*>/g)){
      const [,tag,id]=match;
      const node=new FakeElement(tag,id);
      const src=match[0].match(/(?:^|\s)src="([^"]+)"/)?.[1];
      if(src){node.attributes.src=src;node._src=src;}
      elements.set(id,node);this.children.push(node);
    }
  }
  get innerHTML(){return this._innerHTML}
  set src(value){this._src=String(value);this.attributes.src=this._src;}
  get src(){return this._src;}
  insertBefore(node){this.children.unshift(node);this.firstChild=this.children[0]||null;}
  appendChild(node){this.children.push(node);if(!this.firstChild)this.firstChild=node;}
  addEventListener(type,handler){(this.listeners[type]||=[]).push(handler);}
  dispatch(type){for(const handler of this.listeners[type]||[])handler({type,target:this});}
  getAttribute(name){return this.attributes[name]??null;}
  getBoundingClientRect(){return {width:this._hidden?0:1200,height:this._hidden?0:800};}
  querySelectorAll(){return [];}
}

const elements=new Map();
const host=new FakeElement('div','tab-combate');host._hidden=true;elements.set(host.id,host);
const tabButton=new FakeElement('button','combat-tab-button');tabButton.dataset.tab='tab-combate';
let enabledCalls=0,enforceCalls=0,renderCalls=0,resizeCalls=0;
const game=new FakeElement('div','game-container');game.dataset.viewerRole='dm';
const field=new FakeElement('div','battlefield');
const child={
  LuminousWebGL2Renderer:{setEnabled(value){if(value)enabledCalls+=1;},requestRender(){renderCalls+=1;},surfaceActive(){return true;}},
  LuminousCombatDmObserver073:{enforceDmView(){enforceCalls+=1;},ensureVisualSurface(){return true;}},
  LuminousCombatLiveAdapter073:{state:{role:'dm'}},
  document:{getElementById(id){if(id==='game-container')return game;if(id==='battlefield')return field;return null;}},
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
  getComputedStyle(node){return {display:node?._hidden?'none':'block',visibility:'visible'};},
  setTimeout(fn){timers.push(fn);return timers.length;},
  clearTimeout(){},
  requestAnimationFrame(fn){fn();return 1;},
  addEventListener(){},
  console,
};
window.window=window;
vm.runInNewContext(bridge,{window,console},{filename:'dm-combat-live-viewer.js'});

assert.equal(host.children[0]?.id,'dm-combat-live-battle','live Battle panel must be inserted before legacy Combat tools');
const frame=elements.get('dm-combat-live-frame');
assert.ok(frame,'runtime mount must create the live Battle iframe');
frame.contentWindow=child;
assert.equal(frame.src,'about:blank','hidden Combat tab must not boot Battle Viewer at zero/hidden dimensions');

host._hidden=false;
tabButton.dispatch('click');
while(timers.length)timers.shift()();
assert.equal(frame.src,'Battle-viewer.html','opening the real Combat tab must boot the canonical Battle Viewer while visible');
frame.dispatch('load');
while(timers.length)timers.shift()();
assert.ok(enabledCalls>0,'visible DM runtime must keep renderer enabled');
assert.ok(enforceCalls>0,'visible DM runtime must invoke observer visibility enforcement');
assert.ok(renderCalls>0,'visible DM runtime must request a real frame redraw');
assert.ok(resizeCalls>0,'visible DM runtime must notify Battle Viewer after the tab becomes measurable');

child.LuminousCombatLiveAdapter073.state.role='player';
assert.equal(window.LuminousDmCombatLiveViewer.nudgeBattle(),false,'a measurable non-DM surface must not be reported as DM observer ready');
assert.match(elements.get('dm-combat-live-status').textContent,/ROL PLAYER/,'status must retain the actual role instead of claiming DM observer readiness');
child.LuminousCombatLiveAdapter073.state.role='dm';
assert.equal(window.LuminousDmCombatLiveViewer.nudgeBattle(),true,'measurable authenticated DM surface must report ready');

console.log('DM pantalla real visible Battle surface smoke: ok');
