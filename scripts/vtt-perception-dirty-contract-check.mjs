import assert from 'node:assert/strict';
import { normalizePerceptionDirty } from '../js/vtt/perception-scheduler-runtime.js';

assert.equal(normalizePerceptionDirty({reason:'camera',render:true,vision:true,active:true}).vision,false,'camera must never invalidate world FOV by itself');
assert.equal(normalizePerceptionDirty({reason:'token',render:true,vision:true,active:true,meta:{rawDrag:true}}).vision,false,'raw drag must be visual only');
assert.equal(normalizePerceptionDirty({reason:'token',render:true,vision:true,active:true,meta:{traversing:true}}).vision,false,'traversal preview must be visual only');
assert.equal(normalizePerceptionDirty({reason:'token',render:true,vision:true,active:true,sourceEvent:'vtt:token-preview-moved'}).vision,false,'token preview event must be visual only');
assert.equal(normalizePerceptionDirty({reason:'token',render:true,vision:true,active:false,sourceEvent:'vtt:token-moved'}).vision,true,'canonical endpoint must invalidate FOV');
assert.equal(normalizePerceptionDirty({reason:'topology',render:true,vision:true,active:false}).vision,true,'topology change must invalidate FOV');
assert.equal(normalizePerceptionDirty({reason:'lighting',render:true,vision:true,active:false}).vision,true,'perception-relevant lighting must invalidate FOV');

console.log('vtt perception dirty contract: ok');
