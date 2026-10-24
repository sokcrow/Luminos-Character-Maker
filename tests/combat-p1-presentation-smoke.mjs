import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';

const read = relative => fs.readFileSync(path.join(process.cwd(),relative),'utf8');
const result = read('js/combat-encounter-lifecycle.js');
const dmCss = read('css/on-game-dashboard.css');
const stageCss = read('css/combat-v073-stage.css');
const cameraControls = read('js/combat-v073-camera-controls.js');
const hudCss = read('css/combat-v073-hud-motion.css');
const dm = read('hoja_de_DM.html');
const boot = read('Battle-viewer.html');

assert.match(result, /background:radial-gradient\(ellipse at center,transparent/, 'result seal keeps the last battlefield frame visible');
assert.match(result, /mix-blend-mode:screen/, 'opaque black pixels in seal art must blend instead of painting over the field');
assert.doesNotMatch(result, /if \(transition === "blackout"\) beginBlackout\(\)/, 'old results must not blackout the field');
assert.match(dmCss, /#modulo-combate #combat-grid\s*\{[\s\S]*?min-height:0/, 'battlefield stays inside the flexible viewport');
assert.match(dmCss, /#modulo-combate #combat-log-and-controls\s*\{[\s\S]*?max-height:min\(34dvh/, 'DM controls stay inside the visible viewport');
assert.match(dmCss, /grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/, 'phone controls stay visible as two columns');
for(const id of ['btn-trigger-combat','btn-end-combat-victory','btn-end-combat-defeat','btn-end-combat-cancel']) {
  assert.match(dm, new RegExp('id="'+id+'"'), 'the existing real DM action must survive: '+id);
}
assert.match(hudCss, /#c073-dm-setup\[open\][\s\S]*?max-height:min\(72dvh/, 'unit deployment remains accessible on phones');
assert.match(stageCss, /#game-container\.camera-manual \.combat-stage-layer\s*\{\s*transition:none!important/, 'manual gestures must not lag the map');
assert.match(cameraControls,/LuminousCombatStage073\?\.camera\(\{x:next\.x,y:next\.y,scale:nextScale\}\)/, 'wheel/pinch camera must update the stage');
for(const name of ['css/combat-v073-stage.css','css/combat-v073-hud-motion.css','js/combat-v073-stage.js','js/combat-encounter-lifecycle.js']) {
  assert.ok(boot.includes(name),'packed Combat must load '+name);
}
assert.match(boot, /p1Version='20261024-creature-space-1'/, 'stage script and CSS need fresh browser URLs');

function classList() {
  const values=new Set();
  return {
    add(...classes){classes.forEach(value=>values.add(value));},
    contains(value){return values.has(value);},
    toggle(value,force) {
      const next=force===undefined?!values.has(value):Boolean(force);
      if(next)values.add(value);else values.delete(value);
      return next;
    }
  };
}
const layers=[];
const nodes=new Map();
const host={classList:classList(),appendChild(){}};
const field={dataset:{cameraMode:'manual'}};
const background={
  children:[],
  replaceChildren(){this.children=[];},
  appendChild(node){this.children.push(node);if(node.className?.includes('combat-stage-layer'))layers.push(node);}
};
nodes.set('game-container',host);
nodes.set('battlefield',field);
nodes.set('webgl2-dom-background',background);
nodes.set('combat-stage-unit',{});
nodes.set('combat-stage-done',{});
const document={
  getElementById(id){return nodes.get(id)||null;},
  createElement(tag){return {tag,className:'',dataset:{},style:{},innerHTML:'',setAttribute(){}};},
  querySelectorAll(selector){return selector==='.combat-stage-layer'?layers:[];},
  addEventListener(){}
};
const context={
  document,console,setTimeout,clearTimeout,
  addEventListener(){},
  LuminousCombatLiveAdapter073:{state:{role:'dm'}},
  LuminousCombat073:{combatants(){return{}}},
};
context.window=context;
vm.runInNewContext(read('js/combat-v073-stage.js'),context,{filename:'combat-v073-stage.js'});
assert.equal(layers.length,3,'scene provides horizon, architecture and ground');
layers.push({dataset:{depth:'1.04'},style:{}}); // foreground image layer
context.LuminousCombatStage073.camera({x:-112,y:-42,scale:2});
assert.deepEqual(layers.map(layer=>layer.style.transform),Array(4).fill('translate(-112px,-42px) scale(2)'),'all illustrated layers share exactly the unit-field camera matrix');
assert.equal(host.classList.contains('camera-manual'),true,'pinch/wheel mode cannot smear the scene');
field.dataset.cameraMode='full';
context.LuminousCombatStage073.camera({x:0,y:0,scale:1});
assert.deepEqual(layers.map(layer=>layer.style.transform),Array(4).fill('translate(0px,0px) scale(1)'));
assert.equal(host.classList.contains('camera-manual'),false);
console.log('P1 visual contract passed: transparent result, visible phone DM controls, synchronized ground and foreground camera.');
