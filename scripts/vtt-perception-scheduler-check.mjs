import assert from 'node:assert/strict';
import { PerceptionScheduler } from '../js/vtt/perception-scheduler.js';

const scheduler=new PerceptionScheduler();
let calculations=0;
const compute=()=>({id:++calculations});

assert.equal(scheduler.consumeVision(compute).id,1);
assert.equal(calculations,1);
scheduler.didRender();

scheduler.setAnimationActive(true);
const before=scheduler.snapshot().visionRecomputes;
for(let i=0;i<100;i++){
  scheduler.consumeVision(compute);
  assert.equal(scheduler.shouldRender(),true);
  scheduler.didRender();
}
assert.equal(calculations,1,'100 animation frames with clean vision must not recalculate FOV');
assert.equal(scheduler.snapshot().visionRecomputes,before);

scheduler.setAnimationActive(false);
scheduler.markSceneDirty({reason:'camera',render:true,vision:false,active:true});
scheduler.consumeVision(compute);
assert.equal(calculations,1,'camera-only dirties must not recalculate FOV');
assert.equal(scheduler.snapshot().cameraDirtyEvents,1);
scheduler.didRender();

scheduler.markSceneDirty({reason:'token',render:true,vision:true,active:false});
assert.equal(scheduler.consumeVision(compute).id,2);
assert.equal(calculations,2,'endpoint invalidation must recalculate exactly once');
assert.equal(scheduler.consumeVision(compute).id,2);
assert.equal(calculations,2);

console.log('vtt perception scheduler: ok');
