import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const ROOT = process.cwd();
const REGISTRY_PATH = path.join(ROOT, "js", "item-icon-registry.js");
const TEST_PATH = path.join(ROOT, "tests", "item-icon-registry-smoke.cjs");
const CATALOG_PATH = path.join(ROOT, "Assets", "Icons", "items", "catalog.json");
const ASSET_DIR = path.join(ROOT, "Assets", "Icons", "items", "consumable");
const PNG_SIGNATURE = Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]);

const ITEMS = [
  { id:"muffin", label:"Muffin", labelEs:"Muffin", source:"https://imgur.com/6AoUXjT.png" },
  { id:"blueberry_muffin", label:"Blueberry Muffin", labelEs:"Muffin de arándano", source:"https://imgur.com/z1zBf2g.png" },
  { id:"chocolate_muffin", label:"Chocolate Muffin", labelEs:"Muffin de chocolate", source:"https://imgur.com/0pNm4Au.png" },
  { id:"banana_muffin", label:"Banana Muffin", labelEs:"Muffin de plátano", source:"https://imgur.com/gRqe16T.png" },
  { id:"apple_muffin", label:"Apple Muffin", labelEs:"Muffin de manzana", source:"https://imgur.com/hRmuvxI.png" },
  { id:"strawberry_muffin", label:"Strawberry Muffin", labelEs:"Muffin de fresa", source:"https://imgur.com/7Wu3VR7.png" },
  { id:"lemon_muffin", label:"Lemon Muffin", labelEs:"Muffin de limón", source:"https://imgur.com/FAeYM9H.png" },
  { id:"coconut_muffin", label:"Coconut Muffin", labelEs:"Muffin de coco", source:"https://imgur.com/HNo6kmK.png" },
];

function directUrl(source) {
  return source.replace("https://imgur.com/", "https://i.imgur.com/");
}
function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}
async function fetchPng(url, attempts = 5) {
  let lastError = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        redirect:"follow",
        headers:{
          "user-agent":"Luminous-Character-Maker muffin asset vendor/1.0",
          "accept":"image/png,image/*;q=0.9,*/*;q=0.1"
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
      if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, 750 * attempt));
    }
  }
  throw new Error("Failed to download " + url + ": " + (lastError?.message || lastError));
}

await fs.mkdir(ASSET_DIR, { recursive:true });

const materialized = [];
for (const item of ITEMS) {
  const buffer = await fetchPng(directUrl(item.source));
  const rel = "Assets/Icons/items/consumable/" + item.id + ".png";
  await fs.writeFile(path.join(ROOT, rel), buffer);
  materialized.push({
    ...item,
    path: rel,
    bytes: buffer.length,
    hash: sha256(buffer),
  });
  console.log("Vendored", item.id, buffer.length, "bytes", sha256(buffer));
}

let registry = await fs.readFile(REGISTRY_PATH, "utf8");
for (const item of ITEMS) {
  if (registry.includes('["' + item.id + '"')) throw new Error("Registry already contains " + item.id);
}
registry = registry.replace(/const VERSION = 34;/, "const VERSION = 35;");
if (!registry.includes("const VERSION = 35;")) throw new Error("Unexpected item icon registry version.");

const anchor = '    ["coffee_cookie_retail_pack","Coffee Cookie Retail Pack","Pack retail de galletas de café","consumable","Assets/Icons/items/consumable/coffee_cookie_retail_pack.png"],';
if (!registry.includes(anchor)) throw new Error("Registry insertion anchor not found.");
const rows = materialized.map((item) =>
  '    ["' + item.id + '","' + item.label + '","' + item.labelEs + '","consumable","' + item.path + '"],'
).join("\n");
registry = registry.replace(anchor, anchor + "\n" + rows);
await fs.writeFile(REGISTRY_PATH, registry, "utf8");

let test = await fs.readFile(TEST_PATH, "utf8");
test = test.replace(/assert\.equal\(registry\.VERSION,\s*34\);/, "assert.equal(registry.VERSION, 35);");
test = test.replace(/assert\.equal\(Object\.keys\(registry\.GROUPS\)\.length,\s*581\);/, "assert.equal(Object.keys(registry.GROUPS).length, 589);");
if (!test.includes("assert.equal(registry.VERSION, 35);")) throw new Error("Registry version assertion was not updated.");
if (!test.includes("assert.equal(Object.keys(registry.GROUPS).length, 589);")) throw new Error("Registry family-count assertion was not updated.");

const testAnchor = "  const fruitIcons = {";
if (!test.includes(testAnchor)) throw new Error("Registry smoke insertion anchor not found.");
const muffinTest = `  const muffinIcons = {
    muffin:'Assets/Icons/items/consumable/muffin.png',
    blueberry_muffin:'Assets/Icons/items/consumable/blueberry_muffin.png',
    chocolate_muffin:'Assets/Icons/items/consumable/chocolate_muffin.png',
    banana_muffin:'Assets/Icons/items/consumable/banana_muffin.png',
    apple_muffin:'Assets/Icons/items/consumable/apple_muffin.png',
    strawberry_muffin:'Assets/Icons/items/consumable/strawberry_muffin.png',
    lemon_muffin:'Assets/Icons/items/consumable/lemon_muffin.png',
    coconut_muffin:'Assets/Icons/items/consumable/coconut_muffin.png'
  };
  for (const [id, icon] of Object.entries(muffinIcons)) {
    assert.equal(registry.has(id), true, id);
    assert.equal(registry.resolveIcon(id), icon, id);
    assert.equal(registry.get(id).domain, 'consumable');
  }

`;
test = test.replace(testAnchor, muffinTest + testAnchor);
await fs.writeFile(TEST_PATH, test, "utf8");

const catalog = JSON.parse(await fs.readFile(CATALOG_PATH, "utf8"));
if (catalog.familyCount !== 581 || catalog.uniqueAssetCount !== 628) {
  throw new Error("Unexpected starting catalog counts: " + catalog.familyCount + "/" + catalog.uniqueAssetCount);
}
const familyIds = new Set(catalog.families.map((entry) => entry.id));
const assetPaths = new Set(catalog.assets.map((entry) => entry.path));
for (const item of materialized) {
  if (familyIds.has(item.id)) throw new Error("Catalog family already exists: " + item.id);
  if (assetPaths.has(item.path)) throw new Error("Catalog asset already exists: " + item.path);
  catalog.families.push({
    id:item.id,
    label:item.label,
    labelEs:item.labelEs,
    domain:"consumable",
    path:item.path,
    legacySource:item.source,
  });
  catalog.assets.push({
    path:item.path,
    primaryId:item.id,
    domain:"consumable",
    familyIds:[item.id],
    bytes:item.bytes,
    sha256:item.hash,
    legacySource:item.source,
  });
}
catalog.familyCount = catalog.families.length;
catalog.uniqueAssetCount = catalog.assets.length;
catalog.assets.sort((a,b) => a.path.localeCompare(b.path));
if (catalog.familyCount !== 589 || catalog.uniqueAssetCount !== 636) {
  throw new Error("Unexpected final catalog counts: " + catalog.familyCount + "/" + catalog.uniqueAssetCount);
}
await fs.writeFile(CATALOG_PATH, JSON.stringify(catalog, null, 2) + "\n", "utf8");

console.log("Muffin icon vendoring complete:", catalog.familyCount, "families,", catalog.uniqueAssetCount, "assets.");
