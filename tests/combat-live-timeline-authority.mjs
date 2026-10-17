import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../js/battle-viewer-runtime-073.js', import.meta.url), 'utf8');
const contract = JSON.parse(fs.readFileSync(new URL('../combat/runtime-contract.json', import.meta.url)));
for (const live of [true, false]) {
  const received = [];
  const canonical = async (queue) => { received.push(...queue); return 'canonical'; };
  const alternate = async () => 'alternate';
  const window = { LuminousCombatLiveMode: live, executeCombatTimeline: canonical,
    LuminousBattleViewerTimeline073: { executeCombatTimeline: alternate },
    LuminousBattleViewerActionAdapter073: {}, LuminousCombatActionResolver: {},
    LuminousSkillForgeG2: {}, LuminousSkillForgeRuntimeG2: {},
  };
  vm.runInNewContext(source, { window });
  const api = await window.LuminousBattleViewerRuntime073Ready;
  assert.equal(window.executeCombatTimeline, live ? canonical : alternate);
  assert.equal(api.executeCombatTimeline, live ? canonical : alternate);
  const queue = [{ ownerId: 'player:a' }, { ownerId: 'player:b' }, { ownerId: 'enemy' }];
  assert.equal(await window.executeCombatTimeline(queue), live ? 'canonical' : 'alternate');
  assert.deepEqual(received, live ? queue : []);
  assert.equal(api.authority, live ? contract.timelineAuthority : 'combat-action-runtime');
  await api.install();
  assert.equal(window.executeCombatTimeline, live ? canonical : alternate, 'reinstall must retain the selected executor');
}
console.log('Combat live queue executor is preserved; separate Action runtime still installs outside live mode');
