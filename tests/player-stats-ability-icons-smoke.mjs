import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const base = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const stats = ["str", "dex", "con", "int", "wis", "cha"];
const pngMagic = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
for (const code of stats) {
  const file = path.join(base, "Assets", "Icons", "stats", code + ".png");
  assert.ok(fs.existsSync(file), code + " must be a local repo asset");
  const png = fs.readFileSync(file);
  assert.ok(png.subarray(0, 8).equals(pngMagic), code + " must be a real PNG");
  assert.ok(png.readUInt32BE(16) >= 32 && png.readUInt32BE(20) >= 32,
    code + " PNG must have sufficient dimensions");
}
const runtime = fs.readFileSync(path.join(base, "js/player-stats-ability-bar.js"), "utf8");
const css = fs.readFileSync(path.join(base, "css/player-stats-ability-bar.css"), "utf8");
assert.match(runtime, /src="Assets\/Icons\/stats\/\$\{ability\.id\}\.png"/);
assert.match(runtime, /class="player-ability-icon"/);
assert.match(runtime, /class="player-ability-name"/);
assert.match(runtime, /class="player-prof-indicator"/);
assert.match(runtime, /role="tab"/);
assert.match(runtime, /data-stat="\\$\\{ability\\.id\\}"/);
assert.match(runtime, /aria-selected="\\$\\{index === 0/);
// The original bar's dimensions, click bindings and tab state remain unchanged.
assert.match(css, /\\.player-ability-bar\\{flex:0 0 98px/);
assert.match(runtime, /button\.addEventListener\("click", \(\) => activate\(panel, button\.dataset\.stat\)\)/);
assert.match(runtime, /image\.addEventListener\("error", \(\) => \{ image\.hidden = true; \}/);
assert.match(css, /\.player-ability-icon\[hidden\]/);
assert.match(css, /object-fit:contain/);
assert.match(css, /gap:3px/);
console.log("player-stats-ability-icons-smoke: ok (6 PNGs, existing Stats tabs preserved)");
