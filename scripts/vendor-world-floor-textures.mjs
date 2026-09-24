import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, "Assets", "Images", "World", "Floors");
const CATALOG_PATH = path.join(OUT_DIR, "catalog.json");
const PNG_SIGNATURE = Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]);

const FLOOR_TEXTURES = Object.freeze([
  ["floor_grass_01", "https://imgur.com/otkF8ZR.png"],
  ["floor_dirt_01", "https://imgur.com/ZwsiouC.png"],
  ["floor_sand_01", "https://imgur.com/2OlB8RD.png"],
  ["floor_stone_01", "https://imgur.com/Wx2Jp6R.png"],
  ["floor_gravel_01", "https://imgur.com/H1Bsk8d.png"],
  ["floor_mud_01", "https://imgur.com/IsjuRlA.png"],
  ["floor_snow_01", "https://imgur.com/wn5PkiE.png"],
  ["floor_ice_01", "https://imgur.com/RLzETn5.png"],
  ["floor_swamp_01", "https://imgur.com/hYTPSDK.png"],
  ["floor_cave_01", "https://imgur.com/OTYbatP.png"],
  ["floor_cobblestone_01", "https://imgur.com/uPCdZW1.png"],
  ["floor_flagstone_01", "https://imgur.com/uPCdZW1.png"],
  ["floor_wood_01", "https://imgur.com/FYcN5Ia.png"],
  ["floor_brick_01", "https://imgur.com/DqHTiJU.png"],
  ["floor_marble_01", "https://imgur.com/ZWipiHp.png"],
  ["floor_tile_01", "https://imgur.com/c4xa2rp.png"],
  ["floor_metal_01", "https://imgur.com/7piSJdL.png"],
  ["floor_concrete_01", "https://imgur.com/JeJGGPg.png"],
]);

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

function validPng(buffer) {
  return !!buffer && buffer.length >= PNG_SIGNATURE.length
    && buffer.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE);
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
          "user-agent": "Luminous-Character-Maker world floor texture vendor/1.0",
          "accept": "image/png,image/*;q=0.9,*/*;q=0.1"
        }
      });
      if (!response.ok) throw new Error("HTTP " + response.status + " " + response.statusText);
      const buffer = Buffer.from(await response.arrayBuffer());
      if (!validPng(buffer)) throw new Error("response is not a PNG");
      return buffer;
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, attempt * 600));
    }
  }
  throw new Error("Failed to download " + url + ": " + (lastError?.message || lastError));
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  const sourceCache = new Map();
  const assets = [];

  for (let index = 0; index < FLOOR_TEXTURES.length; index += 1) {
    const [id, sourceRaw] = FLOOR_TEXTURES[index];
    const source = normalizeSource(sourceRaw);
    const file = path.join(OUT_DIR, id + ".png");
    let buffer = await readIfExists(file);

    if (!validPng(buffer)) {
      if (sourceCache.has(source)) {
        buffer = sourceCache.get(source);
      } else {
        buffer = await fetchBuffer(sourceDownloadUrl(source));
        sourceCache.set(source, buffer);
      }
      await fs.writeFile(file, buffer);
    } else {
      sourceCache.set(source, buffer);
    }

    assets.push({
      id,
      path: "Assets/Images/World/Floors/" + id + ".png",
      bytes: buffer.length,
      sha256: sha256(buffer),
      legacySource: source
    });

    console.log("World floor texture " + (index + 1) + "/" + FLOOR_TEXTURES.length + ": " + id);
  }

  const catalog = {
    schemaVersion: 1,
    domain: "world.floor",
    runtimeMode: "repository-local",
    assetCount: assets.length,
    note: "Runtime uses repository-local PNG paths. legacySource is provenance/vendor input only.",
    assets
  };

  await fs.writeFile(CATALOG_PATH, JSON.stringify(catalog, null, 2) + "\n", "utf8");
  console.log("World floor texture vendoring complete: " + assets.length + " local PNG files.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
