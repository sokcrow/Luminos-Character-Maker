/**
 * Integration smoke: inflate the real Combat v0.7.3 bundle, run the
 * Battle-viewer bootstrap without a browser, and parse its resulting scripts.
 * Run with: node tests/combat-mobile-boot-smoke.mjs
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Script, runInNewContext } from "node:vm";
import { gunzipSync } from "node:zlib";

const load = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const parts = [
  ...["01", "02", "03", "04", "05", "06"].map((n) => `combat/combat-v073-live.bundle.part${n}`),
  ...["r1", "r2", "r3"].map((n) => `combat/repair/combat-v073-live.bundle.part07.${n}`),
  ...["08", "09", "10", "11"].map((n) => `combat/combat-v073-live.bundle.part${n}`),
];
const expectedOriginal = gunzipSync(Buffer.from(parts.map(load).join("").replace(/\s+/g, ""), "base64")).toString("utf8");
assert.match(expectedOriginal, /function playerVisualFocusPoint\(viewW,viewH\)/);

const viewer = load("Battle-viewer.html");
const bootstrapScript = viewer.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(bootstrapScript, "Battle-viewer bootstrap script missing");
new Script(bootstrapScript);

let written = "";
let bootError = "";
let finish;
let fail;
const done = new Promise((resolve, reject) => { finish = resolve; fail = reject; });
const timeout = setTimeout(() => fail(new Error(bootError || "Bootstrap timeout")), 5000);
const window = {
  addEventListener() {},
  parent: null,
};
window.parent = window;
const bootNode = {
  set textContent(value) { bootError = String(value); fail(new Error(bootError)); },
};
const document = {
  getElementById: () => bootNode,
  open() {},
  write(html) { written = html; finish(); },
  close() {},
};
const context = {
  window,
  document,
  Blob,
  Response,
  DecompressionStream,
  Uint8Array,
  atob,
  location: { origin: "http://localhost" },
  console,
  fetch: async (path) => {
    assert.ok(parts.includes(path), "Unknown bundle part: " + path);
    return { ok: true, text: async () => load(path) };
  },
};
try {
  runInNewContext(bootstrapScript, context, { filename: "Battle-viewer.html" });
  await done;
} finally {
  clearTimeout(timeout);
}
assert.equal(window.LuminousCombatBootstrapState.stage, "runtime-write");
assert.ok(written.length > 200000, "Incomplete Combat runtime output");

const scripts = [...written.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)];
assert.ok(scripts.length >= 30, "Missing packed scripts");
for (const [index, item] of scripts.entries()) {
  assert.doesNotThrow(() => new Script(item[1], { filename: `packed-combat-script-${index}.js` }));
}
assert.equal(written.split('id="combat-mobile-runtime-stylesheet"').length - 1, 1, "Mobile CSS link duplicated");
assert.match(written, /overlay\.classList\.remove\('active','show-label','reveal'\)/);
assert.match(written, /await wait\(850\)/);
assert.match(written, /focusSprite\.getBoundingClientRect\(\)/);
assert.match(written, /dataset\.viewerRole==='dm'/);
assert.match(written, /matches\?2\.35:5/);

const economy = load("js/combat-v073-economy-menu.js");
const camera = load("js/combat-v073-camera-controls.js");
const css = load("css/combat-mobile-runtime.css");
new Script(economy);
new Script(camera);
assert.ok(!economy.includes("top:66px!important;"), "Legacy economy CSS still overrides the mobile dock");
assert.match(camera, /f\.style\.touchAction='none'/);
assert.ok(!camera.includes("h.style.touchAction='none'"), "Touch gestures must not disable menu scrolling");
assert.match(css, /#game-container \.category-surface/);

console.log("Combat mobile smoke OK:", scripts.length, "inline scripts parsed, single CSS link, camera and menu guards present.");
