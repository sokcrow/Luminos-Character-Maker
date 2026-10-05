import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.join(here, "..", "pantalla_dm.html"), "utf8");

assert.match(html, /id="system-loading-background"/);
assert.match(html, /id="system-loading-tip-category"/);
assert.match(html, /id="system-loading-tip-text"/);
assert.match(html, /id="system-loading-segments"/);
assert.match(html, /role="progressbar"/);
assert.match(html, /aria-valuenow="0"/);

assert.match(html, /const DM_LOADING_SCENES/);
assert.match(html, /DIRECCIÓN · COMBATE/);
assert.match(html, /DIRECCIÓN · ENCOUNTER/);
assert.doesNotMatch(html, /DIRECCIÓN · RITMO/);

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
  assert.ok(html.includes(`Assets/Loading/${filename}`), `missing DM loading asset: ${filename}`);
  assert.ok(html.includes(source), `missing DM loading source: ${source}`);
  assert.match(
    html,
    new RegExp(`image: "Assets/Loading/${filename.replace(".", "\\.")}",[\\s\\S]{0,160}?weight: ${weight}\\b`),
  );
}

assert.equal(
  expectedLoadingScenes.reduce((sum, scene) => sum + scene[2], 0),
  100,
  "DM loading weights must sum to 100",
);
assert.doesNotMatch(html, /loading-interdistrict-transit/);
assert.match(html, /function buildWeightedDMLoadingQueue/);
assert.match(html, /localProbe\.onerror = tryRemoteSource/);

assert.match(html, /const DM_BOOT_REQUIRED = new Set\(\["players", "npcs", "actors", "calendar"\]\)/);
assert.match(html, /markDMBootReady\("players"\)/);
assert.match(html, /markDMBootReady\("npcs"\)/);
assert.match(html, /markDMBootReady\("actors"\)/);
assert.match(html, /markDMBootReady\("calendar"\)/);

assert.match(html, /async function finishDMLoadingPresentation/);
assert.match(html, /progress:\s*95\b/);
assert.match(html, /5000 \+ Math\.floor\(Math\.random\(\) \* 5001\)/);
assert.match(html, /const finalSteps = \[96, 97, 98, 99, 100\]/);
assert.match(html, /Math\.floor\(normalizedProgress \/ 5\)/);

assert.doesNotMatch(html, /loadingAnim/);
assert.doesNotMatch(html, /animation:\s*loading/i);
assert.doesNotMatch(html, /5000\);\s*\/\/ Failsafe/);
assert.doesNotMatch(html, /let isInitialLoad = true/);

console.log("dm-loading-screen smoke: ok");
