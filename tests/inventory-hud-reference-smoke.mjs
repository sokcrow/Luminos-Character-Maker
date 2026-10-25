import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const sheet = read("hoja_personaje.html");
const js = read("js/inventory-hud-v2.js");
const css = read("css/inventory-hud-reference.css");
// The project is ESM; the legacy registry is a browser-compatible IIFE.
const sandbox = { module: { exports: {} } };
vm.runInNewContext(read("js/item-icon-registry.js"), sandbox, { filename: "js/item-icon-registry.js" });
const registry = sandbox.module.exports;

// This lightweight structural smoke is intentionally separate from Playwright:
// it fails if the production sheet forgets to load the implementation / styles.
assert.match(sheet, /<link[^>]+href="css\/inventory-hud-reference\.css\?/);
assert.match(sheet, /<script[^>]+src="js\/inventory-hud-v2\.js\?/);
for (const id of [
  "inventory-modal", "inventory-v2-detail-overlay", "inventory-v2-detail-dialog",
  "inventory-v2-detail-close", "item-detail-card", "detail-title", "detail-desc",
  "detail-icon", "detail-cost-val", "inv-active-grid", "inv-stash-grid"
]) assert.match(sheet, new RegExp('id="' + id + '"'), "missing live inventory node: " + id);

assert.match(js, /ensureItemDetailPortal\(\)/);
assert.match(js, /detailOverlay\?\.addEventListener\("click"/);
assert.match(js, /function openItemDetail\(\)/);
assert.match(js, /function closeItemDetail\(/);
assert.match(js, /function renderActions\(/);
assert.match(js, /restoreActionFocus\(\)/);
assert.match(js, /shell\.inert = true/);
assert.match(js, /shell\.inert = false/);
assert.match(js, /function bindRealtime\(\)/);
assert.match(js, /state\.selectedContainer/);
assert.match(js, /function itemIcon\(/);

assert.match(css, /grid-template-columns:minmax\(0,1fr\) minmax\(0,1fr\)/);
assert.match(css, /#inv-active\.active\{display:flex\}/);
assert.match(css, /position:fixed;inset:0;z-index:10050/);
assert.match(css, /@media\(max-width:760px\)/);
assert.match(css, /@media\(pointer:coarse\) and \(orientation:landscape\)/);

for (const family of ["medicine_vial", "generic_item"]) {
  const src = registry.resolveIcon(family, { fallback: false });
  assert.ok(src?.startsWith("Assets/Icons/items/"), family + " must resolve from canonical registry");
  const icon = path.join(root, src);
  assert.ok(fs.existsSync(icon), "missing on-disk canonical icon " + icon);
  assert.equal(fs.readFileSync(icon).readUInt32BE(0), 0x89504e47, "invalid PNG " + icon);
}

console.log("Inventory live sheet, popup, mobile/desktop, real icon assets: structural smoke OK");