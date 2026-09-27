import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, "Assets", "Images", "World", "Water");
const CATALOG_PATH = path.join(OUT_DIR, "catalog.json");
const PNG_SIGNATURE = Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]);

const ASSETS = Object.freeze([
  {
    id:"water_seamless",
    file:"water_seamless.png",
    source:"https://imgur.com/ZKjxmk7.png",
    direct:"https://i.imgur.com/ZKjxmk7.png",
    requireAlpha:false
  },
  {
    id:"coast_foam_seamless",
    file:"coast_foam_seamless.png",
    source:"https://imgur.com/tJMwx10.png",
    direct:"https://i.imgur.com/tJMwx10.png",
    requireAlpha:true
  }
]);

function pngInfo(buffer) {
  if (!buffer || buffer.length < 33 || !buffer.subarray(0,8).equals(PNG_SIGNATURE)) {
    throw new Error("Not a valid PNG");
  }
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  const bitDepth = buffer[24];
  const colorType = buffer[25];
  let offset = 8, hasTRNS = false;
  while (offset + 12 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    if (type === "tRNS") hasTRNS = true;
    offset += 12 + length;
    if (type === "IEND") break;
  }
  const hasAlpha = colorType === 4 || colorType === 6 || hasTRNS;
  return {width,height,bitDepth,colorType,hasAlpha,hasTRNS};
}

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

async function readIfExists(file) {
  try { return await fs.readFile(file); }
  catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

async function fetchPng(url, attempts=4) {
  let lastError = null;
  for (let attempt=1; attempt<=attempts; attempt+=1) {
    try {
      const response = await fetch(url, {
        redirect:"follow",
        headers:{
          "user-agent":"Luminous-Character-Maker water texture vendor/1.0",
          "accept":"image/png,image/*;q=0.9,*/*;q=0.1"
        }
      });
      if (!response.ok) throw new Error("HTTP " + response.status + " " + response.statusText);
      const buffer = Buffer.from(await response.arrayBuffer());
      pngInfo(buffer);
      return buffer;
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await new Promise(r=>setTimeout(r,attempt*700));
    }
  }
  throw new Error("Failed to download " + url + ": " + (lastError?.message || lastError));
}

async function downloadAsset(asset) {
  const urls = [asset.direct, asset.source];
  let lastError = null;
  for (const url of urls) {
    try { return await fetchPng(url); }
    catch (error) { lastError = error; }
  }
  throw lastError || new Error("Unable to download " + asset.id);
}

async function main() {
  await fs.mkdir(OUT_DIR,{recursive:true});
  const catalogAssets = [];

  for (const asset of ASSETS) {
    const filePath = path.join(OUT_DIR, asset.file);
    let buffer = await readIfExists(filePath);
    let info = null;

    try { if (buffer) info = pngInfo(buffer); }
    catch { buffer = null; }

    if (!buffer) {
      buffer = await downloadAsset(asset);
      info = pngInfo(buffer);
      await fs.writeFile(filePath, buffer);
    }

    if (asset.requireAlpha && !info.hasAlpha) {
      throw new Error(asset.id + " must preserve PNG alpha/transparency");
    }

    catalogAssets.push({
      id:asset.id,
      path:"Assets/Images/World/Water/" + asset.file,
      bytes:buffer.length,
      sha256:sha256(buffer),
      width:info.width,
      height:info.height,
      bitDepth:info.bitDepth,
      colorType:info.colorType,
      hasAlpha:info.hasAlpha,
      provenance:asset.source
    });

    console.log(asset.id + ": " + info.width + "x" + info.height + ", alpha=" + info.hasAlpha + ", bytes=" + buffer.length);
  }

  const catalog = {
    schemaVersion:1,
    domain:"world.water",
    runtimeMode:"repository-local",
    assetCount:catalogAssets.length,
    note:"Runtime uses repository-local PNGs only. provenance is maintenance metadata.",
    assets:catalogAssets
  };
  await fs.writeFile(CATALOG_PATH, JSON.stringify(catalog,null,2) + "\n","utf8");
  console.log("Water texture vendoring complete.");
}

main().catch(error=>{
  console.error(error);
  process.exitCode=1;
});
