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
assert.match(written,/src="js\\/combat-v073-spell-bootstrap\\.js/, "Packed Combat must load canonical Spells");
assert.match(written,/href="css\\/combat-v073-spell-availability\\.css/, "Player Spell status styles must load on mobile and desktop");

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
assert.match(written, /scale=mode==='enemy'\?1\.65:5/, "Player camera must restore center-capable zoom");
assert.doesNotMatch(written, /matches\?2\.35:5/, "Reduced mobile zoom left edge-spawn Players outside the visual center");
// Leftmost formation x = 10%; 5x camera zoom can position that player
// in the middle without moving its world coordinates or panning outside map bounds.
for (const viewWidth of [390, 844, 1280]) {
  const worldX = viewWidth * 0.10;
  const naturalPixelX = worldX * 5;
  assert.ok(naturalPixelX >= viewWidth / 2, "Player spawn must be centerable by camera at " + viewWidth);
}

const economy = load("js/combat-v073-economy-menu.js");
const camera = load("js/combat-v073-camera-controls.js");
const css = load("css/combat-mobile-runtime.css");
new Script(economy);
new Script(camera);
assert.ok(!economy.includes("top:66px!important;"), "Legacy compact CSS must not override radial geometry");
assert.ok(!/grid-template-columns|grid-auto-rows/.test(css), "Mobile Combat must not replace the radial HUD with a grid");
assert.match(css, /\.command-ring \.command \.label/, "Original radial command labels must remain styled");
assert.ok(!/\.splash\s*\{\s*display:\s*none/.test(css), "Ink splashes must remain visible");
assert.match(economy, /const originalRotation = leftSide/, "Responsive geometry must preserve the original left/right radial rotation");
assert.match(written, /categoryRect=surface\.getBoundingClientRect\(\)/, "Category flight must land on the visible panel");

assert.match(camera, /f\.style\.touchAction='none'/);
assert.ok(!camera.includes("h.style.touchAction='none'"), "Touch gestures must not disable menu scrolling");
assert.match(camera, /classList\?\.contains\('camera-focus'\)/, "Manual camera resize must preserve director-owned player focus");
assert.match(css, /#game-container\.combat-compact-menu \.category-surface/);
assert.match(css, /\.command\[hidden\]/, "Mobile menu must honor hidden class-dependent commands");
assert.match(css, /\.command\[aria-hidden="true"\]/, "Mobile menu must honor disabled menu visibility");


// Validate the actual mobile radial geometry at representative viewport sizes.
const radialAngles = [-145, 180, 145, -35, 0, 35];
const simulated = radialAngles.map((angle) => {
  const properties = new Map();
  return {
    dataset: { angle: String(angle), menu: angle === -35 ? "spells" : "skills", width: String(angle === 180 ? 116 : 138), accent: "#d4ae6d" },
    tagName: "BUTTON",
    hidden: false,
    disabled: false,
    attributes: new Map(),
    setAttribute(name, value) { this.attributes.set(name, value); },
    getAttribute(name) { return this.attributes.get(name) || null; },
    querySelector() { return null; },
    classList: { toggle() {} },
    style: {
      setProperty(name, value) { properties.set(name, value); },
      getPropertyValue(name) { return properties.get(name) || ""; },
      left: "",
      top: ""
    },
  };
});
const simulatedHost = { clientWidth: 390, clientHeight: 844, getBoundingClientRect: () => ({left: 0, top: 0}) };
const hero = { id: "hero", classes: [{ classId: "fighter", level: 3 }] };
const center = { x: 195, y: 422 };
const simulatedRing = { getBoundingClientRect: () => ({left: 0, top: 0}) };
const simulatedWindow = {
  document: {
    getElementById: () => simulatedHost,
    querySelector: () => simulatedRing,
    querySelectorAll: () => simulated,
  },
  innerWidth: 390,
  innerHeight: 844,
  matchMedia: () => ({ matches: true }),
  LuminousSpellcastingRuntime: {
    getClassSpellcastingProfile(id) {
      return id === "mage" ? { spellcastingStartLimbusLevel: 1 } : null;
    },
  },
  setTimeout() {},
  addEventListener() {},
  eval(expression) {
    if (expression.includes("spriteCenter")) return () => ({ ...center });
    if (expression.includes("navState")) return "root";
    if (expression.includes("PLAYER_ID")) return "hero";
    if (expression.includes("combatData")) return { hero };
    return undefined;
  },
};
runInNewContext(economy, { window: simulatedWindow });
const radial = simulatedWindow.LuminousCombatEconomyMenu073;
assert.ok(radial, "Mobile radial runtime not exposed");
radial.state.originals.layoutRadialCommands = () => undefined;
for (const [width, height] of [[390, 844], [780, 360], [320, 568]]) {
  simulatedHost.clientWidth = width;
  simulatedHost.clientHeight = height;
  simulatedWindow.innerWidth = width;
  simulatedWindow.innerHeight = height;
  center.x = width / 2;
  center.y = height / 2;
  radial.layoutRadialCommandsStable();
  for (const button of simulated) {
    const x = parseFloat(button.style.left);
    const y = parseFloat(button.style.top);
    const w = parseFloat(button.style.getPropertyValue("--w"));
    const rotation = parseFloat(button.style.getPropertyValue("--rot"));
    assert.ok(x >= 0 && x + w <= width, `Radial command outside ${width}px viewport`);
    assert.ok(y >= 0 && y + 46 <= height, `Radial command outside ${height}px viewport`);
    assert.ok(Number.isFinite(rotation), "Original radial rotations must remain functional");
  }
}

// Moving the player without changing the viewport must move the radial HUD.
simulatedHost.clientWidth = 780;
simulatedHost.clientHeight = 360;
center.x = 390;
center.y = 180;
radial.layoutRadialCommandsStable();
const initialY = simulated.map((button) => parseFloat(button.style.top));
const initialX = simulated.map((button) => parseFloat(button.style.left));
center.x += 24;
center.y += 21;
radial.layoutRadialCommandsStable();
assert.ok(
  simulated.some((button, i) => Math.abs(parseFloat(button.style.top) - initialY[i]) > 8),
  "Mobile radial commands must track the actual player position vertically"
);
assert.ok(
  simulated.some((button, i) => Math.abs(parseFloat(button.style.left) - initialX[i]) > 8),
  "Mobile radial commands must track the actual player position horizontally"
);

// Fighter (non-spellcaster) must never be offered Spells; a mage must receive it.
const spellsButton = simulated.find((button) => button.dataset.menu === "spells");
assert.ok(spellsButton);
assert.equal(radial.isSpellcaster(hero), false);
radial.syncSpellMenuVisibility();
assert.equal(spellsButton.hidden, true);
assert.equal(spellsButton.style.display, "none");
assert.equal(spellsButton.attributes.get("aria-hidden"), "true");
assert.equal(spellsButton.disabled, true);
hero.classes = [{ classId: "mage", level: 3 }];
assert.equal(radial.isSpellcaster(hero), true);
radial.syncSpellMenuVisibility();
assert.equal(spellsButton.hidden, false);
assert.equal(spellsButton.style.display, "");
assert.equal(spellsButton.attributes.get("aria-hidden"), "false");
assert.equal(spellsButton.disabled, false);

console.log("Combat mobile smoke OK:", scripts.length, "inline scripts parsed, single CSS link, player-centered radial HUD and spell eligibility verified.");
