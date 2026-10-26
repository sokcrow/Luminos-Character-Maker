"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { pathToFileURL } = require("node:url");

(async () => {
  const ROOT = path.resolve(__dirname, "..");
  const registryPath = path.join(ROOT, "js", "item-icon-registry.js");
  const catalogPath = path.join(ROOT, "Assets", "Icons", "items", "catalog.json");
  const pngSignature = Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]);

  delete globalThis.LuminousItemIconRegistry;
  await import(pathToFileURL(registryPath).href);
  const registry = globalThis.LuminousItemIconRegistry;

  assert.ok(registry, "item icon registry must initialize");
  assert.equal(fs.existsSync(catalogPath), true, "catalog.json must exist");
  const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));

  assert.equal(catalog.schemaVersion, 1);
  assert.equal(catalog.authority, "repository-local");
  assert.equal(Array.isArray(catalog.families), true);
  assert.equal(Array.isArray(catalog.assets), true);
  assert.equal(catalog.familyCount, catalog.families.length);
  assert.equal(catalog.uniqueAssetCount, catalog.assets.length);
  assert.equal(registry.list().length, catalog.families.length);

  const assetByPath = new Map(catalog.assets.map((asset) => [asset.path, asset]));
  for (const family of catalog.families) {
    const entry = registry.get(family.id, { fallback: false });
    assert.ok(entry, family.id);
    assert.equal(entry.icon, family.path, family.id);
    assert.equal(/^https?:\/\//i.test(entry.icon), false, family.id + " must resolve locally");

    const asset = assetByPath.get(family.path);
    assert.ok(asset, family.path + " must be cataloged");

    const absolute = path.join(ROOT, family.path);
    assert.equal(fs.existsSync(absolute), true, family.path + " must exist");
  }

  for (const asset of catalog.assets) {
    const absolute = path.join(ROOT, asset.path);
    const buffer = fs.readFileSync(absolute);
    assert.equal(buffer.subarray(0, pngSignature.length).equals(pngSignature), true, asset.path + " must be PNG");
    const digest = crypto.createHash("sha256").update(buffer).digest("hex");
    assert.equal(digest, asset.sha256, asset.path + " sha256");
    assert.equal(buffer.length, asset.bytes, asset.path + " byte size");
  }

  const runtimeFiles = [
    "js/item-catalog-armor-components.js",
    "js/item-catalog-firearm-ammo.js",
    "js/item-catalog-firearm-components.js",
    "js/item-catalog-ranged-weapon-components.js",
    "js/item-catalog-shield-components.js",
    "js/item-catalog-weapon-components.js"
  ];

  assert.equal(catalog.runtimeReferenceCount, catalog.runtimeReferences.length);
  for (const ref of catalog.runtimeReferences) {
    assert.equal(/^https?:\/\//i.test(ref.path), false, ref.file + ":" + ref.key + " must resolve locally");
    assert.equal(fs.existsSync(path.join(ROOT, ref.path)), true, ref.path + " must exist");
  }

  for (const runtimeFile of runtimeFiles) {
    const runtimeText = fs.readFileSync(path.join(ROOT, runtimeFile), "utf8");
    assert.equal(/https?:\/\/(?:i\.)?imgur\.com\//i.test(runtimeText), false, runtimeFile + " must not depend on Imgur at runtime");
  }

  console.log("Item icon asset smoke: OK (" + catalog.familyCount + " families, " + catalog.uniqueAssetCount + " unique local PNGs)");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
