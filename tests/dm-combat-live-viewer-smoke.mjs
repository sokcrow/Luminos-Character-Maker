import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read=file=>fs.readFileSync(file,'utf8');
const dmPanel=read('pantalla_dm.html');
const utils=read('js/utils.js');
const bridge=read('js/dm-combat-live-viewer.js');
const dmConsole=read('js/battle-viewer-dm-console-074.js');
const battleBootstrap=read('Battle-viewer.html');
const combatEntry=read('combate.html');

assert.ok(dmPanel.includes('id="tab-combate"'),'actual pantalla_dm Combat pane must exist');
assert.ok(dmPanel.includes('<script src="js/utils.js?v=20261104-single-player-xp-recovery-1"></script>'),'actual pantalla_dm must load the bootstrap that installs Combat assets');
assert.ok(battleBootstrap.includes("asset+'?v=20261104-single-player-xp-recovery-1'"),'packed Battle must refresh DM console, XP, session and loot together');
assert.ok(combatEntry.includes('js/combat-entry.js?v=20261104-single-player-xp-recovery-1'),'standalone Combat entry must refresh recovery UI');
assert.ok(dmPanel.includes('js/combat-session-lifecycle.js?v=20261104-single-player-xp-recovery-1'),'DM page must not reuse previous session lifecycle');
assert.ok(utils.includes("'js/dm-combat-live-viewer.js?v=20261104-single-player-xp-recovery-1'"),'real DM bootstrap must load the live Battle bridge');
assert.ok(bridge.includes("getElementById?.('tab-combate')"),'bridge must mount into the exact Combat tab shown to the DM');
assert.ok(bridge.includes('src="about:blank"'),'DM Battle iframe must not initialize its renderer while the Combat tab is hidden');
assert.ok(bridge.includes("BATTLE_SRC='Battle-viewer.html?v=20261104-single-player-xp-recovery-1'"),'visible DM Combat tab must load the same canonical Battle Viewer as Players');
assert.ok(bridge.includes('visibleSpriteCount'),'DM readiness must inspect actual visible sprite evidence, not only role/render state');
assert.ok(bridge.includes('visualEvidence'),'DM bridge must expose an explicit visual-evidence gate');
assert.ok(bridge.includes("visualMode==='dom-base-webgl-vfx'"),'DM bridge must require the DOM-base/WebGL-VFX composition mode');
assert.ok(bridge.includes("surface?.ready&&surface?.role==='dm'"),'DM bridge must require canonical DM role before reporting observer readiness');
assert.ok(!bridge.includes('surfaceActive!==false)}'),'renderer activity alone must never be enough to declare the DM Battle visible');
assert.ok(bridge.includes('dm-combat-end-encounter'),'normal DM Combat UI must expose a visible END ENCOUNTER control');
assert.ok(bridge.includes('dm-combat-end-modal'),'END ENCOUNTER must open a production confirmation modal');
assert.ok(bridge.includes('dm-combat-end-feedback'),'failed close must expose the cause and next action on the DM screen');
assert.ok(bridge.includes('max-height:calc(100dvh - 24px)'),'closing modal must scroll inside the viewport on short mobile screens');
assert.ok(bridge.includes('flex-wrap:wrap'),'DM status and buttons must wrap on narrow screens');
assert.ok(bridge.includes('VICTORY')&&bridge.includes('DEFEAT'),'Encounter modal must expose explicit Victory and Defeat choices');
assert.ok(bridge.includes("api.finishEncounter(normalized,{confirm:false})"),'production DM control must invoke the canonical Encounter lifecycle instead of duplicating it');
assert.ok(dmConsole.includes('debugConsoleEnabled()'),'technical DM console must be guarded behind an explicit debug opt-in');
assert.ok(dmConsole.includes('if (debugConsoleEnabled()) mount();'),'DM TEST CONSOLE must not mount during a normal session');

class FakeClassList {
  constructor(...names){this.values=new Set(names.filter(Boolean));}
  add(...names){names.forEach(name=>this.values.add(name));}
  remove(...names){names.forEach(name=>this.values.delete(name));}
  contains(name){return this.values.has(name);}
  toggle(name,force){if(force===undefined){if(this.values.has(name)){this.values.delete(name);return false}this.values.add(name);return true}if(force)this.values.add(name);else this.values.delete(name);return force;}
}

class FakeElement {
  constructor(tag='div',id=''){
    this.tagName=tag.toUpperCase();this.id=id;this.dataset={};this.style={};this.children=[];this.listeners={};this.attributes={};this.firstChild=null;this._innerHTML='';this.contentWindow=null;this._src='';this._hidden=false;this.textContent='';this.classList=new FakeClassList();this.rect={width:1200,height:800};this.parentElement=null;this.hidden=false;this.complete=true;this.naturalWidth=this.tagName==='IMG'?220:0;this.naturalHeight=this.tagName==='IMG'?280:0;
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
  appendChild(node){this.children.push(node);if(node?.id)elements.set(node.id,node);if(!this.firstChild)this.firstChild=node;}
  addEventListener(type,handler){(this.listeners[type]||=[]).push(handler);}
  dispatch(type){for(const handler of this.listeners[type]||[])handler({type,target:this});}
  getAttribute(name){return this.attributes[name]??null;}
  getBoundingClientRect(){
    if(this._hidden)return {x:0,y:0,left:0,top:0,right:0,bottom:0,width:0,height:0};
    const x=Number(this.rect.x??this.rect.left??0),y=Number(this.rect.y??this.rect.top??0);
    const width=Number(this.rect.width??0),height=Number(this.rect.height??0);
    return {x,y,left:x,top:y,right:x+width,bottom:y+height,width,height};
  }
  querySelectorAll(selector){
    if(selector==='.sprite-img')return this._sprites||[];
    if(selector==='.sprite-img.webgl2-texture-backed')return (this._sprites||[]).filter(node=>node.classList.contains('webgl2-texture-backed'));
    return [];
  }
  querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
}

const elements=new Map();
const body=new FakeElement('body','body');elements.set(body.id,body);
const host=new FakeElement('div','tab-combate');host._hidden=true;elements.set(host.id,host);
const tabButton=new FakeElement('button','combat-tab-button');tabButton.dataset.tab='tab-combate';
let enabledCalls=0,enforceCalls=0,renderCalls=0,resizeCalls=0;
const encounterResults=[];
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
  LuminousBattleViewerDmConsole074:{
    async finishEncounter(result,options){encounterResults.push({result,options});return {result,nextInstance:'teatro'};}
  },
  document:{getElementById(id){if(id==='game-container')return game;if(id==='battlefield')return field;return null;}},
  getComputedStyle(node){return {display:'block',visibility:'visible',opacity:node===sprite&&node.classList.contains('webgl2-texture-backed')?'0':'1'};},
  Event:class{constructor(type){this.type=type;}},
  dispatchEvent(event){if(event.type==='resize')resizeCalls+=1;},
};
const document={
  readyState:'complete',
  body,
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
assert.equal(frame.src,'Battle-viewer.html?v=20261104-single-player-xp-recovery-1','opening the real Combat tab must boot the canonical Battle Viewer while visible');
frame.dispatch('load');
while(timers.length)timers.shift()();

const endEncounterButton=elements.get('dm-combat-end-encounter');
assert.ok(endEncounterButton,'real DM Battle header must render END ENCOUNTER');
endEncounterButton.dispatch('click');
const endModal=elements.get('dm-combat-end-modal');
assert.ok(endModal,'END ENCOUNTER must render a dedicated modal');
assert.equal(endModal.hidden,false,'END ENCOUNTER modal must become visible from the normal DM UI');
assert.equal(endModal.style.display,'flex','END ENCOUNTER modal must use the production overlay');
assert.equal(await window.LuminousDmCombatLiveViewer.finishEncounterFromUi('victory'),true,'Victory choice must resolve through the canonical Encounter lifecycle');
assert.equal(encounterResults.length,1,'production UI must invoke canonical finishEncounter exactly once');
assert.equal(encounterResults[0].result,'victory','production UI must pass the selected Encounter result');
assert.equal(encounterResults[0].options?.confirm,false,'production UI must avoid a second browser confirm after the modal choice');
assert.equal(endModal.hidden,true,'successful Encounter resolution must close the modal');
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

// Actual DM END ENCOUNTER control: if sealing succeeded but Theatre is
// temporarily unreachable, clicking again must navigate without a second payout.
let theatreWrites=0,finishCalls=0;
window.firebase={database:()=>({ref(path){
  if(path==='campaña/combate/estado')return {once:async()=>({val:()=>({phase:'ENDED',active:false,result:'victory'})})};
  if(path==='campaña/estado_mundo/instancia_activa')return {set:async value=>{
    assert.equal(value,'teatro');
    theatreWrites++;
    if(theatreWrites===1)throw Error('NETWORK_UNAVAILABLE');
  }};
  throw Error('Unexpected Firebase path: '+path);
}})};
child.LuminousBattleViewerDmConsole074.finishEncounter=async()=>{
  finishCalls++;
  throw Object.assign(Error('Theatre navigation unavailable'),{encounterEndCommitted:true,encounterEndStage:'theatre'});
};
assert.equal(await window.LuminousDmCombatLiveViewer.finishEncounterFromUi('victory'),false);
assert.equal(finishCalls,1);
assert.equal(theatreWrites,1,'first return attempt failed after results committed');
assert.equal(endModal.hidden,false,'the DM should see the reason without opening developer tools');
const feedback=elements.get('dm-combat-end-feedback');
assert.equal(feedback.hidden,false,'the error explanation must remain visible');
assert.match(elements.get('dm-combat-end-feedback-step').textContent,/Regresar a Teatro/);
assert.match(elements.get('dm-combat-end-feedback-reason').textContent,/conexión/);
assert.match(elements.get('dm-combat-end-feedback-action').textContent,/VOLVER A TEATRO/);
assert.equal(elements.get('dm-combat-end-victory').hidden,true,'do not offer another payout for a finished result');
assert.equal(endEncounterButton.textContent,'VOLVER A TEATRO');
assert.equal(window.LuminousDmCombatLiveViewer.state.returningToTheatre,true);
assert.equal(await window.LuminousDmCombatLiveViewer.openEncounterOrReturn(),true);
assert.equal(theatreWrites,2,'safe retry only writes the Theatre instance');
assert.equal(finishCalls,1,'safe retry must never finish the Encounter twice');
assert.equal(endEncounterButton.textContent,'END ENCOUNTER');
assert.equal(window.LuminousDmCombatLiveViewer.state.returningToTheatre,false);
assert.equal(feedback.hidden,true,'the error disappears after the game returns to Theatre');

child.LuminousBattleViewerDmConsole074.finishEncounter=async()=>{
  throw Object.assign(Error('LOOT_LIVE_DEPENDENCY_FAILED:js/loot-instance-runtime.js'),{encounterEndStage:'loot'});
};
assert.equal(await window.LuminousDmCombatLiveViewer.finishEncounterFromUi('victory'),false);
assert.match(elements.get('dm-combat-end-feedback-step').textContent,/Preparar el botín/);
assert.match(elements.get('dm-combat-end-feedback-reason').textContent,/sistema de botín/);
assert.match(elements.get('dm-combat-end-feedback-action').textContent,/Recarga el visor/);
assert.equal(endModal.hidden,false);

child.LuminousBattleViewerDmConsole074.finishEncounter=async()=>{
  throw Object.assign(Error('ENCOUNTER_XP_PARTICIPANT_NOT_FOUND:secret-player-id'),{encounterEndStage:'experience'});
};
assert.equal(await window.LuminousDmCombatLiveViewer.finishEncounterFromUi('victory'),false);
assert.match(elements.get('dm-combat-end-feedback-step').textContent,/Repartir experiencia/);
assert.match(elements.get('dm-combat-end-feedback-reason').textContent,/ficha de participante/);
assert.ok(!elements.get('dm-combat-end-feedback-reason').textContent.includes('secret-player-id'),'do not leak internal participant identifiers');

child.LuminousBattleViewerDmConsole074.finishEncounter=async()=>{
  throw Object.assign(Error('ENCOUNTER_XP_TRANSACTION_INTERRUPTED'),{encounterEndStage:'experience',encounterXpStage:'payout'});
};
assert.equal(await window.LuminousDmCombatLiveViewer.finishEncounterFromUi('victory'),false);
assert.match(elements.get('dm-combat-end-feedback-reason').textContent,/Otro guardado de la ficha/);
assert.match(elements.get('dm-combat-end-feedback-action').textContent,/Detén las ediciones/);

child.LuminousBattleViewerDmConsole074.finishEncounter=async()=>{
  throw Object.assign(Error('Invalid Firebase data: contains undefined in an enemy record'),{
    encounterEndStage:'experience',encounterXpStage:'plan'});
};
assert.equal(await window.LuminousDmCombatLiveViewer.finishEncounterFromUi('victory'),false);
assert.match(elements.get('dm-combat-end-feedback-reason').textContent,/datos de una criatura/);
assert.match(elements.get('dm-combat-end-feedback-action').textContent,/reanuda VICTORY/);
assert.ok(!elements.get('dm-combat-end-feedback-reason').textContent.includes('Firebase data'),
  'internal serialization details must stay out of player/DM UI');

child.LuminousBattleViewerDmConsole074.finishEncounter=async()=>{
  throw Object.assign(Error('CLIENT_INTERNAL_EXCEPTION'),{encounterEndStage:'experience',encounterXpStage:'plan'});
};
assert.equal(await window.LuminousDmCombatLiveViewer.finishEncounterFromUi('victory'),false);
assert.match(elements.get('dm-combat-end-feedback-reason').textContent,/plan de reparto/);
assert.ok(!elements.get('dm-combat-end-feedback-reason').textContent.includes('CLIENT_INTERNAL_EXCEPTION'));

child.LuminousBattleViewerDmConsole074.finishEncounter=async()=>{
  throw Object.assign(Error('permission_denied'),{code:'PERMISSION_DENIED',encounterEndStage:'result'});
};
assert.equal(await window.LuminousDmCombatLiveViewer.finishEncounterFromUi('victory'),false);
assert.match(elements.get('dm-combat-end-feedback-reason').textContent,/autorización/);
assert.match(elements.get('dm-combat-end-feedback-action').textContent,/cuenta del DM/);

child.LuminousBattleViewerDmConsole074.finishEncounter=async()=>{
  throw Object.assign(Error('PRIVATE_INTERNAL_RUNTIME_REFERENCE_9827'),{encounterEndStage:'claim'});
};
assert.equal(await window.LuminousDmCombatLiveViewer.finishEncounterFromUi('victory'),false);
assert.match(elements.get('dm-combat-end-feedback-step').textContent,/Iniciar el cierre/);
assert.ok(!elements.get('dm-combat-end-feedback-reason').textContent.includes('PRIVATE_INTERNAL'),'unknown internal errors must not become player-facing debug text');

// A failed Victory can leave durable XP/loot receipts. The DM must be
// shown why Defeat cannot be substituted to bypass that partial award.
let unsafeDefeatCalls=0;
window.firebase={database:()=>({ref(path){
  if(path==='campaña/combate/estado')return {once:async()=>({val:()=>({
    phase:'ENDING',active:true,ending:{uid:'dm',result:'victory',failed:true}
  })})};
  throw Error('Unexpected encounter state path: '+path);
}})};
child.LuminousBattleViewerDmConsole074.finishEncounter=async()=>{unsafeDefeatCalls++;return {result:'defeat'};};
assert.equal(await window.LuminousDmCombatLiveViewer.openEncounterOrReturn(),true);
assert.equal(endModal.hidden,false);
assert.equal(elements.get('dm-combat-end-defeat').hidden,true,'Defeat cannot replace a partially paid Victory');
assert.equal(elements.get('dm-combat-end-victory').hidden,false);
assert.match(elements.get('dm-combat-end-feedback-reason').textContent,/victoria anterior/);
assert.match(elements.get('dm-combat-end-feedback-action').textContent,/VICTORY/);
assert.equal(await window.LuminousDmCombatLiveViewer.finishEncounterFromUi('defeat'),false);
assert.equal(unsafeDefeatCalls,0,'UI refuses bypassing durable victory receipts');

child.LuminousBattleViewerDmConsole074.finishEncounter=async()=>{
  throw Object.assign(Error('POST_COMBAT_SANITY_NOT_CONFIRMED'),{encounterEndStage:'sanity'});
};
window.LuminousDmCombatLiveViewer.state.pendingVictory=false;
assert.equal(await window.LuminousDmCombatLiveViewer.finishEncounterFromUi('defeat'),false);
assert.match(elements.get('dm-combat-end-feedback-step').textContent,/Guardar el estado de los personajes/);
assert.match(elements.get('dm-combat-end-feedback-reason').textContent,/cordura final/);

console.log('DM pantalla real visual-evidence Battle surface smoke: ok');
