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
assert.ok(bridge.includes('visibleSpriteCount'),'DM readiness must inspect actual visible sprite evidence, not only role/render state');
assert.ok(bridge.includes('visualEvidence'),'DM bridge must expose an explicit visual-evidence gate');
assert.ok(bridge.includes("visualMode==='dom-base-webgl-vfx'"),'DM bridge must require the DOM-base/WebGL-VFX composition mode');
assert.ok(bridge.includes("surface?.ready&&surface?.role==='dm'"),'DM bridge must require canonical DM role before reporting observer readiness');
assert.ok(!bridge.includes('surfaceActive!==false)}'),'renderer activity alone must never be enough to declare the DM Battle visible');

class FakeClassList {
  constructor(...names){this.values=new Set(names.filter(Boolean));}
  add(...names){names.forEach(name=>this.values.add(name));}
  remove(...names){names.forEach(name=>this.values.delete(name));}
  contains(name){return this.values.has(name);}
  toggle(name,force){if(force===undefined){if(this.values.has(name)){this.values.delete(name);return false}this.values.add(name);return true}if(force)this.values.add(name);else this.values.delete(name);return force;}
}

class FakeElement {
  constructor(tag='div',id=''){
    this.tagName=tag.toUpperCase();this.id=id;this.dataset={};this.style={};this.children=[];this.listeners={};this.attributes={};this.firstChild=null;this._innerHTML='';this.contentWindow=null;this._src='';this._hidden=false;this.textContent='';this.classList=new FakeClassList();this.rect={width:1200,height:800};
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
  getBoundingClientRect(){return this._hidden?{width:0,height:0}:this.rect;}
  querySelectorAll(selector){
    if(selector==='.sprite-img')return this._sprites||[];
    if(selector==='.sprite-img.webgl2-texture-backed')return (this._sprites||[]).filter(node=>node.classList.contains('webgl2-texture-backed'));
    return [];
  }
  querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
}

const elements=new Map();
const host=new FakeElement('div','tab-combate');host._hidden=true;elements.set(host.id,host);
const tabButton=new FakeElement('button','combat-tab-button');tabButton.dataset.tab='tab-combate';
let enabledCalls=0,enforceCalls=0,renderCalls=0,resizeCalls=0;
const game=new FakeElement('div','game-container');game.dataset.viewerRole='dm';game.classList.add('webgl2-background-ready');
const field=new FakeElement('div','battlefield');
const sprite=new FakeElement('img','sprite-enemy-1');sprite.rect={width:160,height:220};sprite.classList.add('sprite-img','webgl2-texture-backed');game._sprites=[sprite];
const child={
  LuminousWebGL2Renderer:{setEnabled(value){if(value)enabledCalls+=1;},requestRender(){renderCalls+=1;},surfaceActive(){return true;}},
  LuminousCombatDmObserver073:{
    enforceDmView(){enforceCalls+=1;this.ensureVisualSurface();},
    ensureVisualSurface(){game.classList.remove('player-blinded','webgl2-background-ready');sprite.classList.remove('webgl2-texture-backed');game.dataset.dmVisualMode='dom-base-webgl-vfx';return true;}
  },
  LuminousCombatLiveAdapter073:{state:{role:'dm'}},
  LuminousCombat073:{combatants(){return {enemy1:{id:'enemy1'}};},render(){renderCalls+=1;}},
  document:{getElementById(id){if(id==='game-container')return game;if(id==='battlefield')return field;return null;}},
  getComputedStyle(node){return {display:'block',visibility:'visible',opacity:node===sprite&&node.classList.contains('webgl2-texture-backed')?'0':'1'};},
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
  getComputedStyle(node){return {display:node?._hidden?'none':'block',visibility:'visible',opacity:'1'};},
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
assert.ok(enabledCalls>0,'visible DM runtime must keep renderer enabled for VFX');
assert.ok(enforceCalls>0,'visible DM runtime must invoke observer visibility enforcement');
assert.ok(renderCalls>0,'visible DM runtime must request a real redraw');
assert.ok(resizeCalls>0,'visible DM runtime must notify Battle Viewer after the tab becomes measurable');

// Reproduce the field report: renderer says active and dimensions are valid, but the
// WebGL ownership classes hide the DOM base/sprite, leaving an effectively black HUD.
game.classList.add('webgl2-background-ready');
sprite.classList.add('webgl2-texture-backed');
delete game.dataset.dmVisualMode;
let surface=window.LuminousDmCombatLiveViewer.childSurface();
assert.equal(surface.surfaceActive,true,'regression setup must look healthy to the old renderer-only check');
assert.equal(surface.ready,false,'active renderer + measurable DOM must still fail when no visible Battle evidence exists');
assert.equal(surface.visibleSpriteCount,0,'texture-backed hidden sprite must not count as visual evidence');

assert.equal(window.LuminousDmCombatLiveViewer.nudgeBattle({allowFallback:true}),true,'DM recovery must convert an active-but-black surface into a visible Battle');
surface=window.LuminousDmCombatLiveViewer.childSurface();
assert.equal(surface.visualMode,'dom-base-webgl-vfx');
assert.equal(surface.visibleSpriteCount,1,'DM recovery must leave deployed combatants visibly composited in DOM');
assert.equal(surface.ready,true,'visual evidence, not renderer activity, must gate readiness');
assert.match(elements.get('dm-combat-live-status').textContent,/DOM BASE \+ WEBGL VFX/,'status must state the visual composition that is actually visible');

child.LuminousCombatLiveAdapter073.state.role='player';
assert.equal(window.LuminousDmCombatLiveViewer.nudgeBattle(),false,'a measurable non-DM surface must not be reported as DM observer ready');
assert.match(elements.get('dm-combat-live-status').textContent,/ROL PLAYER/,'status must retain the actual role instead of claiming DM observer readiness');

console.log('DM pantalla real visual-evidence Battle surface smoke: ok');
