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
assert.doesNotMatch(html, /loadingAnim/);
assert.doesNotMatch(html, /animation:\s*loading/i);

for (const progress of [20, 45, 70, 90, 100]) {
  assert.match(js, new RegExp(`progress:\\s*${progress}\\b`));
}

assert.match(js, /window\.updateLoadingState/);
assert.match(js, /window\.showLoadingError/);
assert.match(js, /window\.hideLoadingOverlay/);
assert.doesNotMatch(js, /updateBootLog/);
assert.doesNotMatch(js, /boot-status-log/);
assert.doesNotMatch(js, /\[EJECUTANDO\]/);

console.log("player-loading-progress smoke: ok");
