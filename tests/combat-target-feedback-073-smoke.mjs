import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {runInNewContext} from 'node:vm';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const viewer = read('Battle-viewer.html');
const js = read('js/combat-target-feedback-073.js');
const css = read('css/combat-target-feedback-073.css');
const manifest = JSON.parse(read('combat/combat-v073-live.manifest.json'));
const packed = gunzipSync(Buffer.from(manifest.parts.map(part => read(part.file).replace(/\s+/g, '')).join(''), 'base64')).toString('utf8');
const commitNeedle = '  renderTargetArrows();\n  if(isClashIntent(PLAYER_ID,completedIndex,plan)){';
assert.equal(packed.split(commitNeedle).length - 1, 1, 'exactly one real packed successful targeting commit');
// Execute the actual Viewer patch, then the production selection function.
// Checking only the presence of the insertion needle misses rejected plans.
let patched = packed;
runInNewContext(viewer.slice(viewer.indexOf("    stage('patch-target-feedback'"), viewer.indexOf("    stage('patch-renderer'")), {
  stage() {}, html: packed,
  replaceUniqueCombatSource(before, after) {
    assert.equal(patched.split(before).length - 1, 1);
    patched = patched.replace(before, after);
  }
});
const choose = patched.match(/function choosePlayerTarget\(slot\)\{[\s\S]*?\n\}\n/)[0];
for (const scenario of ['valid', 'invalid-slot', 'rejected-help', 'clash']) {
  const events = [], plan = {data:{name:'Skill 1'}}, slot = {dataset:{ownerId:'enemy',slotIndex:'0'}};
  let finalized = false, confirmation = false;
  const ctx = {
    targetingModeActive:true, pendingTargetPlan:plan, pendingTargetSlotIndex:0,
    PLAYER_ID:'hero', plannedActions:[plan],
    combatData:{hero:{id:'hero',faction:'ally'},enemy:{id:'enemy',name:'Kobold',faction:'enemy'}},
    planTargetRule:()=> 'enemy', targetSlotIsValid:()=>scenario!=='invalid-slot',
    captureClashChoiceSnapshot:()=>({}), unitHasStatus:()=>false,
    universalPlanPreview:()=>({ok:scenario!=='rejected-help'}), setStatus(){},
    configureAtkWeightTargets(){}, configurePlayerClashChoice(){}, syncReadyControl(){},
    $:()=>({classList:{remove(){}}}), clearTargetSelectionClasses(){}, renderTargetArrows(){},
    isClashIntent:()=>scenario==='clash', beginClashConfirmation(){confirmation=true;},
    finalizePlannedAction(){finalized=true;},
    CustomEvent:class {constructor(type,options){this.type=type;this.detail=options.detail;}},
    window:{dispatchEvent(event){assert.equal(plan.targetId,'enemy');events.push(event);}}
  };
  runInNewContext(choose+'\nchoosePlayerTarget(slot);', {...ctx,slot});
  const accepted = scenario==='valid'||scenario==='clash';
  assert.equal(events.length,accepted?1:0,scenario+' acknowledgement');
  assert.equal(finalized,scenario==='valid');
  assert.equal(confirmation,scenario==='clash');
  if(accepted){
    assert.equal(events[0].type,'luminous:combat073-target-selected');
    assert.equal(events[0].detail.clashPending,scenario==='clash');
    assert.equal(events[0].detail.targetId,'enemy');
  }
}
assert.match(viewer, /replaceUniqueCombatSource\(/);
assert.match(viewer, /luminous:combat073-target-selected/);
assert.match(viewer, /css\/combat-target-feedback-073\.css/);
assert.match(viewer, /js\/combat-target-feedback-073\.js/);
for (const token of ['520px', '460px', 'prefers-reduced-motion', 'safe-area-inset-top', 'pointer-events: none']) {
  assert.ok(css.includes(token), 'mobile, desktop, reduced motion and click-through: ' + token);
}

const handlers = new Map(), timers = new Map(), nodes = new Map();
let timerId = 0;
function element() {
  const classes = new Set();
  return {
    dataset: {}, hidden: false, textContent: '', currentSrc: '', offsetWidth: 100, attributes: {},
    classList: {
      add(key) { classes.add(key); }, remove(key) { classes.delete(key); },
      contains(key) { return classes.has(key); },
      toggle(key, enabled) { enabled ? classes.add(key) : classes.delete(key); }
    },
    setAttribute(key, value) { this.attributes[key] = value; },
    getAttribute(key) { return this.attributes[key] || ''; },
    removeAttribute(key) { delete this.attributes[key]; }
  };
}
const host = element(), banner = element(), title = element(), name = element(), description = element(), img = element();
banner.querySelector = selector => ({
  '.combat-target-feedback__title': title,
  '.combat-target-feedback__name': name,
  '.combat-target-feedback__detail': description,
  '.combat-target-feedback__sprite': img
})[selector];
nodes.set('game-container', host);
const sprite = element();
sprite.currentSrc = '/Assets/real-combatant.png';
nodes.set('sprite-enemy-1', sprite);
const win = {
  document: {
    body: {appendChild(node) { nodes.set(node.id, node); }},
    getElementById(id) { return nodes.get(id); },
    createElement(tag) { assert.equal(tag, 'aside'); return banner; }
  },
  addEventListener(type, callback) { handlers.set(type, callback); },
  setTimeout(callback, delay) {
    assert.equal(delay, 2600);
    timers.set(++timerId, callback);
    return timerId;
  },
  clearTimeout(id) { timers.delete(id); }
};
runInNewContext(js, {window: win});
const notify = handlers.get('luminous:combat073-target-selected');
assert.equal(typeof notify, 'function');
const base = {targetId:'enemy-1', targetName:'Kobold', enemy:true, actionName:'Skill 1', slotIndex:0, clashPending:false};
notify({detail:{...base,slotIndex:-1}});
assert.equal(nodes.has('combat-target-feedback'),false,'invalid targets never acknowledge');
host.dataset.viewerRole = 'dm';
notify({detail:base});
assert.equal(nodes.has('combat-target-feedback'),false,'DM spectator is not a Player');
delete host.dataset.viewerRole;
host.classList.add('round-running');
notify({detail:base});
assert.equal(nodes.has('combat-target-feedback'),false,'cannot announce targets during execution');
host.classList.remove('round-running');
notify({detail:base});
assert.equal(title.textContent,'ENEMIGO SELECCIONADO');
assert.equal(name.textContent,'Kobold');
assert.equal(description.textContent,'Skill 1 · Slot 1');
assert.equal(img.src,'/Assets/real-combatant.png');
assert.equal(banner.attributes['aria-live'],'polite');
assert.ok(banner.classList.contains('is-visible'));
notify({detail:{...base,enemy:false,targetId:'no-sprite',targetName:'<script>Ally</script>',clashPending:true,slotIndex:1}});
assert.equal(title.textContent,'ALIADO SELECCIONADO');
assert.equal(name.textContent,'<script>Ally</script>', 'safe text-only player labels');
assert.match(description.textContent,/Confirma el Clash/);
assert.equal(img.hidden,true,'no sample art for unknown portraits');
assert.equal(timers.size,1,'rapid target changes replace the existing toast');
[...timers.values()][0]();
assert.equal(banner.classList.contains('is-visible'),false);
console.log('COMBAT_TARGET_FEEDBACK_073_PASS packed targeting, responsive, accessibility, player only, no false positives');
