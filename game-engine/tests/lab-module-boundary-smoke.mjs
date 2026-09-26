import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const labIndex = await readFile(new URL("../lab/index.html", import.meta.url), "utf8");
const labHost = await readFile(new URL("../lab/runtime-lab.js", import.meta.url), "utf8");
const visualizerIndex = await readFile(new URL("../visualizer/index.html", import.meta.url), "utf8");
const visualizerHost = await readFile(new URL("../visualizer/main.js", import.meta.url), "utf8");
const visualizerRenderer = await readFile(new URL("../visualizer/ThreeVisualizer.js", import.meta.url), "utf8");

assert.match(labIndex, /runtime-lab\.js/, "Lab index must boot the module-only runtime host");
assert.doesNotMatch(labIndex, /forest-0\.3\.3\.1\.html/, "Lab index must not load the legacy Forest HTML");
assert.doesNotMatch(labIndex, /<iframe\b/i, "Module Lab must not hide engine authority in an iframe");
assert.doesNotMatch(labIndex, /\.\/main\.js/, "Legacy Lab bootstrap must not be the active runtime entrypoint");

assert.match(labHost, /GameRuntime/, "Module Lab must instantiate GameRuntime");
assert.match(labHost, /normalizeProceduralMapSpec/, "Module Lab must use the standardized map spec contract");
assert.match(labHost, /registerProceduralMap/, "Module Lab must register maps through the map module");
assert.match(labHost, /registerUnit/, "Module Lab must register Units through UnitRuntime");
assert.match(labHost, /createHudViewModel/, "Module Lab must consume the standardized HUD model");
assert.match(labHost, /cameraTarget:\s*true/, "Module Lab must exercise CameraSystem targeting");
assert.doesNotMatch(labHost, /LuminousWorldMovementBridge/, "Module Lab must not depend on the legacy world bridge");
assert.doesNotMatch(labHost, /LuminousMapItemBridge|PaperInventory|LuminousShop/, "Module Lab must not depend on legacy Forest UI systems");

assert.match(visualizerIndex, /\.\/main\.js/, "Visualizer must boot its module host");
assert.match(visualizerIndex, /Mundo 3D jugable/, "Visualizer must expose the 3D player viewport as its primary surface");
assert.doesNotMatch(visualizerIndex, /forest-0\.3\.3\.1\.html|<iframe\b/i, "Visualizer must not load legacy Forest content");
assert.match(visualizerHost, /GameRuntime/, "Visualizer must instantiate GameRuntime");
assert.match(visualizerHost, /normalizeProceduralMapSpec/, "Visualizer must consume standardized procedural maps");
assert.match(visualizerHost, /createHudViewModel/, "Visualizer must consume the standardized HUD model");
assert.match(visualizerHost, /registerUnit/, "Visualizer must consume the shared Unit runtime");
assert.match(visualizerHost, /ThreeVisualizer/, "Visualizer host must attach the production 3D renderer");
assert.doesNotMatch(visualizerHost, /LuminousWorldMovementBridge|LuminousMapItemBridge|PaperInventory|LuminousShop/, "Visualizer must stay independent from legacy Forest bridges and UI");

assert.match(visualizerRenderer, /three@0\.160\.0/, "Renderer must load the pinned Three.js module");
assert.match(visualizerRenderer, /runtime\.map\.sampleTerrain/, "Renderer must derive terrain from MapSystem authority");
assert.match(visualizerRenderer, /runtime\.map\.sampleWater/, "Renderer must derive water from MapSystem authority");
assert.match(visualizerRenderer, /runtime\.camera\.attachBridge/, "Renderer must consume CameraSystem through a view adapter");
assert.match(visualizerRenderer, /water_seamless\.png/, "Renderer must consume the repository water texture");
assert.match(visualizerRenderer, /coast_foam_seamless\.png/, "Renderer must consume the repository coast foam texture");
assert.doesNotMatch(visualizerRenderer, /resolveMovement\s*\(|registerUnit\s*\(|createProceduralMap/, "Renderer must not own gameplay or procedural authority");
assert.doesNotMatch(visualizerRenderer, /LuminousWorldMovementBridge|forest-0\.3\.3\.1/, "Renderer must not depend on legacy Forest authority");

console.log("lab-module-boundary-smoke: ok");
