import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [forest, lab] = await Promise.all([
  readFile(new URL("../lab/game/forest-0.3.3.1.html", import.meta.url), "utf8"),
  readFile(new URL("../lab/main.js", import.meta.url), "utf8")
]);

// The review route opts into a wider far ring without changing the production default.
assert.match(lab, /map=crystalCave&seed=\$\{encodeURIComponent\(caveSeed\)\}&lod=wide/);
assert.match(forest, /const WORLD_LOD_WIDE_TEST=new URLSearchParams\(location\.search\)\.get\('lod'\)==='wide'/);
assert.match(forest, /desktop:Object\.freeze\(\{\.\.\.FOREST_STRESS_PROFILES\.desktop,label:'DESKTOP · LOD WIDE',farFt:260\}\)/);

// Far trees use the authored cheap trunk\/crown subset on every platform.
assert.match(forest, /const compactFarTree=category==='tree'&&state==='far';/);
assert.match(forest, /category==='crystal'\|\|category==='landmark'/);
assert.match(forest, /forestMobileFarKeep/);

// Cave lighting LOD: cheap visual landmarks survive far, actual lights are full-ring only.
assert.match(forest, /const markCaveStream=\(obj,category='detail'\)=>/);
assert.match(forest, /markCaveStream\(shard,'crystal'\)/);
assert.match(forest, /markCaveStream\(aura,'landmark'\)/);
assert.match(forest, /markCaveStream\(glowPatch,'landmark'\)/);
assert.match(forest, /markCaveStream\(light,'light'\)/);
assert.match(forest, /markCaveStream\(lamp,'light'\)/);

// More dressing is rendered with true instancing rather than one Mesh per pebble\/chip.
assert.match(forest, /PR 819 · LOD\/INSTANCING TRIAL/);
assert.match(forest, /new THREE\.InstancedMesh\(/);
assert.match(forest, /caveInstancedDetail='rubble'/);
assert.match(forest, /caveInstancedDetail='crystal-chips'/);
assert.match(forest, /instancedRubble:caveInstancedDetail\.rubble/);
assert.match(forest, /instancedCrystalChips:caveInstancedDetail\.crystalChips/);

console.log("crystal cave LOD runtime smoke: ok");
