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

const expectedLoadingScenes = [
  ["loading-combat-clash.png", "https://imgur.com/haWXQhp.png", 18],
  ["loading-workshop-crafting.png", "https://imgur.com/zbr096W.png", 14],
  ["loading-lizalin-biodistrict.png", "https://imgur.com/N2YXVUr.png", 12],
  ["loading-yuanti-obscurum.png", "https://imgur.com/mSzXSqz.png", 12],
  ["loading-lanae-mountain.png", "https://imgur.com/JUUc6Ye.png", 12],
  ["loading-city-backstreets.png", "https://imgur.com/Xt7V809.png", 18],
  ["loading-abnormality-containment.png", "https://imgur.com/AmAaJ7M.png", 14],
];

for (const [filename, source, weight] of expectedLoadingScenes) {
  assert.ok(js.includes(`Assets/Loading/${filename}`), `missing local loading asset: ${filename}`);
  assert.ok(js.includes(source), `missing loading source: ${source}`);
  assert.match(
    js,
    new RegExp(`image: "Assets/Loading/${filename.replace(".", "\\.")}",[\\s\\S]{0,160}?weight: ${weight}\\b`),
  );
}

assert.equal(
  expectedLoadingScenes.reduce((sum, scene) => sum + scene[2], 0),
  100,
  "loading weights must sum to 100",
);
assert.doesNotMatch(js, /loading-interdistrict-transit/);
assert.match(js, /function buildWeightedLoadingQueue/);
assert.match(js, /localProbe\.onerror = tryRemoteSource/);
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
