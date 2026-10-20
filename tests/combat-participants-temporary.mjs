import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
await import('../js/combat-participants.js');const api=globalThis.LuminousCombatParticipants;
const units={};for(let i=1;i<=7;i++)units['player:p'+i]={id:'player:p'+i,name:'P'+i,isPlayer:true,canonicalPlayerKey:'p'+i,canonicalOwnerUid:'uid'+i,battleActive:true};
Object.assign(units['player:p2'],{deploymentState:'reserve'});Object.assign(units['player:p3'],{removed:true});Object.assign(units['player:p4'],{escaped:true});Object.assign(units['player:p5'],{defeated:true});Object.assign(units['player:p6'],{dead:true});delete units['player:p7'].battleActive;
units.kobold={id:'kobold',battleActive:true,faction:'enemy'};
assert.deepEqual(api.playerIds(units),['p1']);assert.equal(api.progress(units,{p1:{ready:true,round:1}},1).ready,1);assert.equal(api.progress(units,{p1:{ready:true,round:2}},1).ready,0);
for(let i=2;i<=8;i++)assert.equal(api.playerInstance('combate',units,{uid:'uid'+i,playerId:'p'+i}),'teatro');assert.equal(api.playerInstance('combate',units,{uid:'uid1',playerId:'p1'}),'combate');
const s={round:1,combatants:units,role:'dm'},w={Math,console,LuminousCombatParticipants:api,LuminousCombatLiveAdapter073:{state:s},LuminousCombat073:{combatants:()=>units},addEventListener(){},setTimeout(){}};w.window=w;vm.runInNewContext(fs.readFileSync('js/combat-v073-authority.js','utf8'),w);
assert.equal(w.LuminousCombatAuthority073.allReadySnapshot({p1:{ready:true,round:1}}),true);assert.equal(w.LuminousCombatAuthority073.readyComplete({p1:{ready:true,round:1,plannedSlots:0}},{},1).complete,true);
units['player:p2']={...units['player:p2'],deploymentState:'field',isBackup:false};assert.deepEqual(api.playerIds(units),['p1','p2']);assert.equal(w.LuminousCombatAuthority073.allReadySnapshot({p1:{ready:true,round:1}}),false);assert.equal(api.playerInstance('combate',units,{uid:'uid2',playerId:'p2'}),'combate');delete units['player:p2'];assert.equal(w.LuminousCombatAuthority073.allReadySnapshot({p1:{ready:true,round:1}}),true);
for(const file of ['hoja_personaje.html','hoja_de_DM.html']){const html=fs.readFileSync(file,'utf8');assert.ok(html.indexOf('js/combat-participants.js')<html.indexOf('js/instance-control.js'));}
console.log('Participants: solo READY, reserve/removed/escaped/dead/unmarked exclusions, theatre routing, late admission and removal PASS');
