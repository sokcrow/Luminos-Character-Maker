import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const ROOT = process.cwd();
const CATALOG_PATH = path.join(ROOT, "Assets", "Icons", "items", "catalog.json");
const PNG_SIGNATURE = Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]);

const RUNTIME_FILES = [
  "js/item-catalog-armor-components.js",
  "js/item-catalog-firearm-ammo.js",
  "js/item-catalog-firearm-components.js",
  "js/item-catalog-ranged-weapon-components.js",
  "js/item-catalog-shield-components.js",
  "js/item-catalog-weapon-components.js"
];

const REFERENCE_FILES = [
  "tests/item-firearm-components-smoke.cjs",
  "tests/item-weapon-composition-smoke.cjs",
  "docs/item-cooking-handoff.md",
  "docs/item-firearms-handoff.md",
  "docs/item-general-chemistry-handoff.md",
  "docs/item-ranged-weapons-handoff.md",
  "docs/item-throwables-v1-handoff.md",
  "docs/item-tools-handoff.md",
  "docs/item-weapon-composition-handoff.md",
  "docs/item-weapons-handoff.md"
];

function normalizeSource(url) {
  const match = String(url).match(/^https?:\/\/(?:i\.)?imgur\.com\/([A-Za-z0-9]+)(?:\.png)?$/i);
  return match ? "https://imgur.com/" + match[1] + ".png" : String(url);
}

function sourceDownloadUrl(source) {
  return normalizeSource(source).replace("https://imgur.com/", "https://i.imgur.com/");
}

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function slug(value) {
  return String(value)
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "") || "runtime_icon";
}

async function readUtf8(rel) {
  return fs.readFile(path.join(ROOT, rel), "utf8");
}

async function readIfExists(file) {
  try { return await fs.readFile(file); }
  catch (error) {
    if (error && error.code === "ENOENT") return null;
    throw error;
  }
}

async function fetchBuffer(url, attempts = 4) {
  let lastError = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        redirect: "follow",
        headers: {
          "user-agent": "Luminous-Character-Maker component asset vendor/1.0",
          "accept": "image/png,image/*;q=0.9,*/*;q=0.1"
        }
      });
      if (!response.ok) throw new Error("HTTP " + response.status + " " + response.statusText);
      const buffer = Buffer.from(await response.arrayBuffer());
      if (buffer.length < PNG_SIGNATURE.length || !buffer.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) {
        throw new Error("response is not a PNG");
      }
      return buffer;
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, attempt * 500));
    }
  }
  throw new Error("Failed to download " + url + ": " + (lastError?.message || lastError));
}

async function mapLimit(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  async function run() {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      results[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return results;
}

function discoverRuntimeReferences(file, content) {
  const refs = [];
  const urlPattern = /https?:\/\/(?:i\.)?imgur\.com\/[A-Za-z0-9]+(?:\.png)?/g;
  const lines = content.split("\n");
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex];
    const urls = line.match(urlPattern) || [];
    for (const rawSource of urls) {
      const before = line.slice(0, line.indexOf(rawSource));
      const property = before.match(/([A-Za-z0-9_]+)\s*:\s*["']?$/);
      const constant = before.match(/const\s+([A-Za-z0-9_]+)\s*=\s*["']?$/);
      const imgurId = normalizeSource(rawSource).match(/\/([A-Za-z0-9]+)\.png$/)?.[1] || "asset";
      let key = property?.[1] || constant?.[1] || (path.basename(file, path.extname(file)) + "_" + imgurId);
      if (key === "GENERIC_AMMO_ICON") key = "ammo_generic";
      refs.push({
        file,
        line: lineIndex + 1,
        key: slug(key),
        rawSource,
        source: normalizeSource(rawSource)
      });
    }
  }
  return refs;
}

async function main() {
  const catalog = JSON.parse(await readUtf8("Assets/Icons/items/catalog.json"));
  const sourceToPath = new Map();

  for (const asset of catalog.assets || []) {
    if (asset.legacySource) sourceToPath.set(normalizeSource(asset.legacySource), asset.path);
  }
  for (const family of catalog.families || []) {
    if (family.legacySource && family.path) sourceToPath.set(normalizeSource(family.legacySource), family.path);
  }

  const runtimeContents = new Map();
  const references = [];
  for (const file of RUNTIME_FILES) {
    const content = await readUtf8(file);
    runtimeContents.set(file, content);
    references.push(...discoverRuntimeReferences(file, content));
  }

  if (references.length === 0) {
    for (const file of RUNTIME_FILES) {
      const content = runtimeContents.get(file);
      if (/https?:\/\/(?:i\.)?imgur\.com\//i.test(content)) {
        throw new Error("Remote Imgur reference remains in " + file);
      }
    }
    console.log("Component/runtime item icons already repository-local.");
    return;
  }

  const uniqueNewSources = new Map();
  for (const ref of references) {
    if (sourceToPath.has(ref.source)) continue;
    if (!uniqueNewSources.has(ref.source)) {
      uniqueNewSources.set(ref.source, {
        source: ref.source,
        key: ref.key,
        path: "Assets/Icons/items/equipment/" + ref.key + ".png"
      });
    }
  }

  const newAssets = await mapLimit([...uniqueNewSources.values()], 12, async (asset, index) => {
    const absolute = path.join(ROOT, asset.path);
    await fs.mkdir(path.dirname(absolute), { recursive: true });
    let buffer = await readIfExists(absolute);
    if (!buffer || buffer.length < PNG_SIGNATURE.length || !buffer.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) {
      buffer = await fetchBuffer(sourceDownloadUrl(asset.source));
      await fs.writeFile(absolute, buffer);
    }
    sourceToPath.set(asset.source, asset.path);
    if ((index + 1) % 10 === 0 || index + 1 === uniqueNewSources.size) {
      console.log("Vendored component icon " + (index + 1) + "/" + uniqueNewSources.size);
    }
    return {
      path: asset.path,
      primaryId: asset.key,
      domain: "equipment",
      familyIds: [],
      bytes: buffer.length,
      sha256: sha256(buffer),
      legacySource: asset.source
    };
  });

  const runtimeReferences = [];
  for (const file of RUNTIME_FILES) {
    let content = runtimeContents.get(file);
    const fileRefs = references.filter((ref) => ref.file === file);
    for (const ref of fileRefs) {
      const localPath = sourceToPath.get(ref.source);
      if (!localPath) throw new Error("No local path resolved for " + ref.source);
      content = content.split(ref.rawSource).join(localPath);
      runtimeReferences.push({
        file,
        key: ref.key,
        path: localPath,
        legacySource: ref.source
      });
    }
    if (/https?:\/\/(?:i\.)?imgur\.com\//i.test(content)) {
      throw new Error("Remote Imgur reference remains in runtime file " + file);
    }
    await fs.writeFile(path.join(ROOT, file), content, "utf8");
  }

  for (const file of REFERENCE_FILES) {
    let content = await readUtf8(file);
    const urls = [...new Set(content.match(/https?:\/\/(?:i\.)?imgur\.com\/[A-Za-z0-9]+(?:\.png)?/gi) || [])];
    for (const rawSource of urls) {
      const localPath = sourceToPath.get(normalizeSource(rawSource));
      if (localPath) content = content.split(rawSource).join(localPath);
    }
    await fs.writeFile(path.join(ROOT, file), content, "utf8");
  }

  const assetsByPath = new Map((catalog.assets || []).map((asset) => [asset.path, asset]));
  for (const asset of newAssets) assetsByPath.set(asset.path, asset);

  catalog.assets = [...assetsByPath.values()].sort((a, b) => a.path.localeCompare(b.path));
  catalog.uniqueAssetCount = catalog.assets.length;
  catalog.runtimeReferences = runtimeReferences;
  catalog.runtimeReferenceCount = runtimeReferences.length;
  catalog.note = "Runtime icon resolution uses repository-local paths. legacySource is provenance only and is never required at runtime.";

  await fs.writeFile(CATALOG_PATH, JSON.stringify(catalog, null, 2) + "\n", "utf8");

  console.log(
    "Component icon vendoring complete: " +
    references.length + " runtime references, " +
    newAssets.length + " new unique PNG assets, " +
    catalog.uniqueAssetCount + " total unique cataloged assets."
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
