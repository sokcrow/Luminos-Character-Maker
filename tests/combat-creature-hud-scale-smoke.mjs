import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
await import('../js/combat-deployment-runtime.js');
const deployment=globalThis.LuminousCombatDeploymentRuntime;
const nodes=new Map();
const context={window:null,document:{getElementById:id=>nodes.get(id)||null},LuminousCombatDeploymentRuntime:deployment};context.window=context;
vm.runInNewContext(fs.readFileSync('js/combat-v073-stage.js','utf8'),context);
const stage=context.LuminousCombatStage073;
for(const size of ['tiny','small','medium','large','huge','gargantuan']){
  const properties=new Map();
  nodes.set('token-'+size,{style:{getPropertyValue:key=>properties.get(key),setProperty:(key,value)=>properties.set(key,value)},classList:{toggle(){}}});
  stage.refreshUnit({id:size,size,y:18,scale:1},900);
  const profile=deployment.sizeProfile({size}),hud=['tiny','small','medium'].includes(size)?.75:1;
  assert.equal(Number(properties.get('--creature-hud-scale')),hud);
  assert.equal(Number(properties.get('--creature-size-scale')),profile.spriteScale,'Body sizing remains independent of HUD sizing');
  assert.equal(Number(properties.get('--creature-floor-scale')),hud<1?.75:Math.sqrt(profile.spaces));
}
const css=fs.readFileSync('css/combat-v073-stage.css','utf8');
const scaledRule=css.match(/([^{}]+)\{ scale:var\(--creature-hud-scale,1\); \}/)[1];
for(const selector of ['floating-hp-group','floating-sp-group','status-effect-strip','shield-number','speed-number'])assert.ok(scaledRule.includes(selector));
assert.ok(!/combatant|top-ui-panel|action-slot/.test(scaledRule),'The HUD scale cannot shrink Action Slots, their panel, or their hit targets');
console.log('Creature HUD: Tiny/Small/Medium use 75% information and floor HUD, independent bodies and unchanged Action Slots.');
