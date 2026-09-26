import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const index = await readFile(new URL("../lab/index.html", import.meta.url), "utf8");
const host = await readFile(new URL("../lab/runtime-lab.js", import.meta.url), "utf8");

assert.match(index, /runtime-lab\.js/, "Lab index must boot the module-only runtime host");
assert.doesNotMatch(index, /forest-0\.3\.3\.1\.html/, "Lab index must not load the legacy Forest HTML");
assert.doesNotMatch(index, /<iframe\b/i, "Module Lab must not hide engine authority in an iframe");
assert.doesNotMatch(index, /\.\/main\.js/, "Legacy Lab bootstrap must not be the active runtime entrypoint");

assert.match(host, /GameRuntime/, "Module Lab must instantiate GameRuntime");
assert.match(host, /registerProceduralMap/, "Module Lab must register maps through the map module");
assert.match(host, /registerUnit/, "Module Lab must register Units through UnitRuntime");
assert.match(host, /cameraTarget:\s*true/, "Module Lab must exercise CameraSystem targeting");
assert.doesNotMatch(host, /LuminousWorldMovementBridge/, "Module Lab must not depend on the legacy world bridge");
assert.doesNotMatch(host, /LuminousMapItemBridge|PaperInventory|LuminousShop/, "Module Lab must not depend on legacy Forest UI systems");

console.log("lab-module-boundary-smoke: ok");
