import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.join(here, "..", "hoja_personaje.html"), "utf8");
const js = fs.readFileSync(path.join(here, "..", "hoja_personaje.js"), "utf8");

assert.match(html, /role="progressbar"/);
assert.match(html, /aria-valuenow="0"/);
assert.match(html, /id="system-loading-progress-text">0%/);
assert.match(html, /id="system-loading-retry"/);
assert.match(html, /id="system-loading-background"/);
assert.match(html, /id="system-loading-tip-category"/);
assert.match(html, /id="system-loading-tip-text"/);
assert.match(html, /id="system-loading-segments"/);
assert.doesNotMatch(html, /loadingAnim/);
assert.doesNotMatch(html, /animation:\s*loading/i);

for (const progress of [20, 45, 70, 90, 100]) {
  assert.match(js, new RegExp(`progress:\\s*${progress}\\b`));
}

assert.match(js, /PLAYER_LOADING_SCENES/);
assert.match(js, /loading-combat-clash\.webp/);
assert.match(js, /loading-workshop-crafting\.webp/);
assert.match(js, /loading-lizalin-biodistrict\.webp/);
assert.match(js, /loading-yuanti-obscurum\.webp/);
assert.match(js, /loading-lanae-mountain\.webp/);
assert.match(js, /loading-city-backstreets\.webp/);
assert.match(js, /loading-abnormality-containment\.webp/);
assert.match(js, /loading-interdistrict-transit\.webp/);
assert.match(js, /function syncLoadingSegments/);
assert.match(js, /for \(let index = 0; index < 20; index \+= 1\)/);
assert.match(js, /Math\.floor\(normalizedProgress \/ 5\)/);
assert.match(js, /async function finishLoadingPresentation/);
assert.match(js, /progress:\s*95\b/);
assert.match(js, /5000 \+ Math\.floor\(Math\.random\(\) \* 5001\)/);
assert.match(js, /const finalSteps = \[96, 97, 98, 99, 100\]/);
assert.match(js, /await finishLoadingPresentation\(\)/);
assert.match(js, /window\.updateLoadingState/);
assert.match(js, /window\.showLoadingError/);
assert.match(js, /window\.hideLoadingOverlay/);
assert.doesNotMatch(js, /updateBootLog/);
assert.doesNotMatch(js, /boot-status-log/);
assert.doesNotMatch(js, /\[EJECUTANDO\]/);

console.log("player-loading-progress smoke: ok");
