import assert from "node:assert/strict";
import { createTriangulatedHeightField } from "../src/world/TerrainHeightField.js";

const eps=1e-9;
const near=(a,b,msg)=>assert.ok(Math.abs(a-b)<eps,`${msg}: expected ${b}, got ${a}`);

const even=createTriangulatedHeightField({
  x0:0,x1:10,z0:0,z1:10,segmentsX:1,segmentsZ:1,
  heights:[0,10,20,40]
});
near(even.heightAt(2,8),20,"even ACD triangle interpolation");
near(even.heightAt(8,2),14,"even ADB triangle interpolation");
near(even.heightAt(0,0),0,"vertex a");
near(even.heightAt(10,10),40,"vertex d");
assert.equal(even.sampleAt(2,8).triangle,"acd");
assert.equal(even.sampleAt(8,2).triangle,"adb");

const mixed=createTriangulatedHeightField({
  x0:0,x1:20,z0:0,z1:10,segmentsX:2,segmentsZ:1,
  heights:[0,10,30,20,40,80]
});
assert.equal(mixed.sampleAt(12,2).triangle,"acb");
assert.equal(mixed.sampleAt(18,8).triangle,"bcd");

const ramp=createTriangulatedHeightField({
  x0:0,x1:10,z0:0,z1:10,segmentsX:1,segmentsZ:1,
  heights:[0,10,0,10]
});
const slope=ramp.slopeAt(7,3);
near(slope.hx,1,"slope hx");
near(slope.hz,0,"slope hz");
near(slope.angleDeg,45,"slope angle");

assert.equal(ramp.heightAt(-.01,5),null);
assert.equal(ramp.slopeAt(5,10.01),null);
assert.throws(()=>createTriangulatedHeightField({segmentsX:1,segmentsZ:1,heights:[0,1,2]}),/expected 4 heights/);

console.log("terrain height field smoke: ok");
