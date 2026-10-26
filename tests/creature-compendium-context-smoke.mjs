import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const code=fs.readFileSync(new URL('../js/creature-compendium-ui.js',import.meta.url),'utf8');
function harness(frames={}) {
  let globalReads=0;
  const campaignDb={name:'campaign'}, user={uid:'player-account'};
  const browser={
    document:{getElementById:id=>frames[id]||null,querySelector:()=>null},
    firebase:{database:()=>{globalReads++;return campaignDb;},auth:()=>({currentUser:user})},
    localStorage:{getItem:()=> 'stale-campaign-character'},setInterval:()=>1,
  };
  browser.window=browser;
  vm.runInNewContext(code,browser,{filename:'creature-compendium-ui.js'});
  return {browser,api:browser.LuminousCreatureCompendium,campaignDb,user,globalReads:()=>globalReads};
}
for(const id of ['mirror-view','combat-entry-view']) {
  let running=false;
  const roster={first:{libraryUnitId:'first-encounter-enemy',name:'First enemy',faction:'enemy'}};
  const isolatedDb={name:'isolated'}, viewer={
    LuminousCombat073:{combatants:()=>roster,uiState:()=>({running})},
    LuminousCombatLiveAdapter073:{state:{db:isolatedDb,playerId:'mirror-character',user:{uid:'mirror-user'}}},
  };
  const {browser,api,globalReads}=harness({[id]:{contentWindow:viewer}});
  browser.LuminousPlayerPostCombatLoot={state:{db:{name:'stale-campaign'},playerId:'stale-character'}};
  const context=api.resolveContext();
  assert.equal(context.db,isolatedDb,`${id}: use the viewer's namespace for reads and writes`);
  assert.equal(context.playerId,'mirror-character',`${id}: identity belongs to that namespace`);
  assert.equal(context.runtime.combatants(),roster,`${id}: first encounter roster is available before any prior knowledge`);
  assert.equal(context.user.uid,'mirror-user');
  assert.equal(globalReads(),0,'scoped contexts never open the campaign database');
  assert.equal(api.isRunning(),false);
  running=true;
  assert.equal(api.isRunning(),true,`${id}: recalling is blocked during actual viewer resolution`);
  running=false;
  assert.equal(api.isRunning(),false,'planning resumes without caching the previous execution flag');
  const explicit={name:'explicit'};
  assert.equal(api.resolveContext({db:explicit,playerId:'explicit-character'}).db,explicit);
  assert.equal(api.resolveContext({db:explicit,playerId:'explicit-character'}).playerId,'explicit-character');
  delete viewer.LuminousCombatLiveAdapter073.state.playerId;
  viewer.LuminousCombatLiveAdapter073.state.uid='own-uid';
  viewer.LuminousCombatLiveAdapter073.state.players={other:{uid:'another-user'},own:{vinculado_a:'own-uid'}};
  assert.equal(api.resolveContext().playerId,'own','resolve the account within the isolated roster');
  delete viewer.LuminousCombatLiveAdapter073.state.uid;
  assert.equal(api.resolveContext().playerId,'','never mix an unselected scoped actor with a campaign localStorage ID');
}
{
  const {browser,api,globalReads}=harness(),lootDb={name:'isolated-after-viewer-close'};
  browser.LuminousPlayerPostCombatLoot={state:{db:lootDb,playerId:'loot-character'}};
  assert.equal(api.resolveContext().db,lootDb);
  assert.equal(api.resolveContext().playerId,'loot-character');
  assert.equal(globalReads(),0);
  assert.equal(api.isRunning(),false);
}
{
  const inaccessible={get contentWindow(){throw Error('cross-origin');}};
  const {api,campaignDb}=harness({'mirror-view':inaccessible});
  assert.equal(api.resolveContext().db,campaignDb,'inaccessible frames fall back safely');
  assert.equal(api.resolveContext().playerId,'stale-campaign-character');
  assert.equal(api.isRunning(),false);
}
{
  const {browser,api}=harness(),db={name:'inside-viewer'};
  browser.LuminousCombat073={combatants:()=>({}),uiState:()=>({running:true})};
  browser.LuminousCombatLiveAdapter073={state:{db,playerId:'local-viewer-character'}};
  assert.equal(api.resolveContext().runtime,browser.LuminousCombat073);
  assert.equal(api.resolveContext().db,db);
  assert.equal(api.isRunning(),true);
}
console.log('Compendium: isolated DB/player pairing, outer iframe roster, live execution gate and safe fallback passed.');
