import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const ROOT = process.cwd();
const REGISTRY_PATH = path.join(ROOT, "js", "item-icon-registry.js");
const TEST_PATH = path.join(ROOT, "tests", "item-icon-registry-smoke.cjs");
const ASSET_ROOT = path.join(ROOT, "Assets", "Icons", "items");
const CATALOG_PATH = path.join(ASSET_ROOT, "catalog.json");

const PNG_SIGNATURE = Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]);

function slug(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || "misc";
}

function toPosix(value) {
  return value.split(path.sep).join("/");
}

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function sourceDownloadUrl(source) {
  return source.replace("https://imgur.com/", "https://i.imgur.com/");
}

async function readIfExists(file) {
  try { return await fs.readFile(file); } catch (error) {
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
          "user-agent": "Luminous-Character-Maker asset vendor/1.0",
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
      if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
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

async function validateAlreadyVendored() {
  const catalogRaw = await readIfExists(CATALOG_PATH);
  if (!catalogRaw) throw new Error("Registry has no remote Imgur rows, but catalog.json is missing.");
  const catalog = JSON.parse(catalogRaw.toString("utf8"));
  for (const asset of catalog.assets || []) {
    const file = path.join(ROOT, asset.path);
    const buffer = await fs.readFile(file);
    if (!buffer.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) {
      throw new Error("Invalid PNG signature: " + asset.path);
    }
    if (sha256(buffer) !== asset.sha256) throw new Error("SHA-256 mismatch: " + asset.path);
  }
  console.log("Item icons already vendored: " + (catalog.families?.length || 0) + " families, " + (catalog.assets?.length || 0) + " unique assets.");
}

async function main() {
  let registry = await fs.readFile(REGISTRY_PATH, "utf8");
  const rowPattern = /\["([^"]+)","([^"]*)","([^"]*)","([^"]+)","(https?:\/\/imgur\.com\/[^"]+\.png)"\]/g;
  const rows = [];
  let match;
  while ((match = rowPattern.exec(registry))) {
    rows.push({
      id: match[1],
      label: match[2],
      labelEs: match[3],
      domain: match[4],
      source: match[5]
    });
  }

  if (rows.length === 0) {
    await validateAlreadyVendored();
    return;
  }

  const sourceGroups = new Map();
  for (const row of rows) {
    if (!sourceGroups.has(row.source)) sourceGroups.set(row.source, []);
    sourceGroups.get(row.source).push(row);
  }

  const sourceToPath = new Map();
  const uniqueAssets = [];
  for (const [source, familyRows] of sourceGroups) {
    const primary = familyRows[0];
    const rel = toPosix(path.join("Assets", "Icons", "items", slug(primary.domain), slug(primary.id) + ".png"));
    sourceToPath.set(source, rel);
    uniqueAssets.push({ source, path: rel, primaryId: primary.id, domain: primary.domain, familyIds: familyRows.map((row) => row.id) });
  }

  await fs.mkdir(ASSET_ROOT, { recursive: true });

  const materialized = await mapLimit(uniqueAssets, 12, async (asset, index) => {
    const absolute = path.join(ROOT, asset.path);
    await fs.mkdir(path.dirname(absolute), { recursive: true });
    let buffer = await readIfExists(absolute);
    if (!buffer || buffer.length < PNG_SIGNATURE.length || !buffer.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) {
      buffer = await fetchBuffer(sourceDownloadUrl(asset.source));
      await fs.writeFile(absolute, buffer);
    }
    if ((index + 1) % 25 === 0 || index + 1 === uniqueAssets.length) {
      console.log("Vendored " + (index + 1) + "/" + uniqueAssets.length + " unique icons");
    }
    return {
      path: asset.path,
      primaryId: asset.primaryId,
      domain: asset.domain,
      familyIds: asset.familyIds,
      bytes: buffer.length,
      sha256: sha256(buffer),
      legacySource: asset.source
    };
  });

  for (const [source, localPath] of sourceToPath) {
    registry = registry.split('"' + source + '"').join('"' + localPath + '"');
  }

  let migratedVersion = null;
  registry = registry.replace(/const VERSION = (\d+);/, (_, value) => {
    migratedVersion = Number(value) + 1;
    return "const VERSION = " + migratedVersion + ";";
  });
  if (/https?:\/\/imgur\.com\/[^"'\s]+\.png/.test(registry)) {
    throw new Error("Remote Imgur icon URL remains in item-icon-registry.js after rewrite.");
  }
  await fs.writeFile(REGISTRY_PATH, registry, "utf8");

  let test = await fs.readFile(TEST_PATH, "utf8");
  for (const [source, localPath] of sourceToPath) {
    test = test.split(source).join(localPath);
  }
  if (migratedVersion !== null) {
    test = test.replace(/assert\.equal\(registry\.version, \d+\);/, "assert.equal(registry.version, " + migratedVersion + ");");
  }
  await fs.writeFile(TEST_PATH, test, "utf8");

  const families = rows.map((row) => ({
    id: row.id,
    label: row.label,
    labelEs: row.labelEs,
    domain: row.domain,
    path: sourceToPath.get(row.source),
    legacySource: row.source
  }));

  const catalog = {
    schemaVersion: 1,
    authority: "repository-local",
    registry: "js/item-icon-registry.js",
    familyCount: families.length,
    uniqueAssetCount: materialized.length,
    note: "Runtime icon resolution uses repository-local paths. legacySource is provenance only and is never required at runtime.",
    families,
    assets: materialized.sort((a, b) => a.path.localeCompare(b.path))
  };
  await fs.writeFile(CATALOG_PATH, JSON.stringify(catalog, null, 2) + "\n", "utf8");

  console.log("Vendoring complete: " + families.length + " families -> " + materialized.length + " unique local PNG assets.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
