import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const ROOT = process.cwd();
const REGISTRY_PATH = path.join(ROOT, "js", "item-icon-registry.js");
const TEST_PATH = path.join(ROOT, "tests", "item-icon-registry-smoke.cjs");
const CATALOG_PATH = path.join(ROOT, "Assets", "Icons", "items", "catalog.json");
const PNG_SIGNATURE = Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]);

const ITEMS = [
  { id:"chocolate", label:"Chocolate", labelEs:"Chocolate", domain:"material", source:"https://imgur.com/EMS3YO5.png" },
  { id:"chocolate_chips", label:"Chocolate Chips", labelEs:"Chispas de chocolate", domain:"material", source:"https://imgur.com/669Qpk4.png" },
  { id:"donut", label:"Donut", labelEs:"Dona", domain:"consumable", source:"https://imgur.com/YbJ8lyO.png" },
  { id:"glazed_donut", label:"Glazed Donut", labelEs:"Dona glaseada", domain:"consumable", source:"https://imgur.com/0wkzXjQ.png" },
  { id:"sugar_donut", label:"Sugar Donut", labelEs:"Dona de azúcar", domain:"consumable", source:"https://imgur.com/7T6EB9l.png" },
  { id:"chocolate_donut", label:"Chocolate Donut", labelEs:"Dona de chocolate", domain:"consumable", source:"https://imgur.com/52tS3jH.png" },
  { id:"cinnamon_donut", label:"Cinnamon Donut", labelEs:"Dona de canela", domain:"consumable", source:"https://imgur.com/fOCk4nd.png" },
  { id:"jam_filled_donut", label:"Jam-Filled Donut", labelEs:"Dona rellena de mermelada", domain:"consumable", source:"https://imgur.com/nTaDMmZ.png" },
  { id:"cream_filled_donut", label:"Cream-Filled Donut", labelEs:"Dona rellena de crema", domain:"consumable", source:"https://imgur.com/qfy4yIr.png" },
  { id:"chocolate_filled_donut", label:"Chocolate-Filled Donut", labelEs:"Dona rellena de chocolate", domain:"consumable", source:"https://imgur.com/Ed4Q8yK.png" },
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
          "user-agent":"Luminous-Character-Maker food asset vendor/1.0",
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

const materialized = [];
for (const item of ITEMS) {
  const buffer = await fetchPng(directUrl(item.source));
  const rel = "Assets/Icons/items/" + item.domain + "/" + item.id + ".png";
  const abs = path.join(ROOT, rel);
  await fs.mkdir(path.dirname(abs), { recursive:true });
  await fs.writeFile(abs, buffer);
  materialized.push({ ...item, path:rel, bytes:buffer.length, hash:sha256(buffer) });
  console.log("Vendored", item.id, buffer.length, "bytes", sha256(buffer));
}

let registry = await fs.readFile(REGISTRY_PATH, "utf8");
for (const item of ITEMS) {
  if (registry.includes('["' + item.id + '"')) throw new Error("Registry already contains " + item.id);
}
registry = registry.replace(/const VERSION = 35;/, "const VERSION = 36;");
if (!registry.includes("const VERSION = 36;")) throw new Error("Unexpected item icon registry version.");

const materialAnchor = '    ["culinary_culture","Culinary Culture","Cultivo culinario","material","Assets/Icons/items/material/culinary_culture.png"],';
if (!registry.includes(materialAnchor)) throw new Error("Material registry anchor not found.");
const materialRows = materialized.filter((x)=>x.domain==="material").map((item)=>
  '    ["' + item.id + '","' + item.label + '","' + item.labelEs + '","material","' + item.path + '"],'
).join("\n");
registry = registry.replace(materialAnchor, materialAnchor + "\n" + materialRows);

const consumableAnchor = '    ["coconut_muffin","Coconut Muffin","Muffin de coco","consumable","Assets/Icons/items/consumable/coconut_muffin.png"],';
if (!registry.includes(consumableAnchor)) throw new Error("Consumable registry anchor not found.");
const consumableRows = materialized.filter((x)=>x.domain==="consumable").map((item)=>
  '    ["' + item.id + '","' + item.label + '","' + item.labelEs + '","consumable","' + item.path + '"],'
).join("\n");
registry = registry.replace(consumableAnchor, consumableAnchor + "\n" + consumableRows);
await fs.writeFile(REGISTRY_PATH, registry, "utf8");

let test = await fs.readFile(TEST_PATH, "utf8");
test = test.replace(/assert\.equal\(registry\.VERSION,\s*35\);/, "assert.equal(registry.VERSION, 36);");
test = test.replace(/assert\.equal\(Object\.keys\(registry\.GROUPS\)\.length,\s*589\);/, "assert.equal(Object.keys(registry.GROUPS).length, 599);");
if (!test.includes("assert.equal(registry.VERSION, 36);")) throw new Error("Registry version assertion was not updated.");
if (!test.includes("assert.equal(Object.keys(registry.GROUPS).length, 599);")) throw new Error("Registry family count assertion was not updated.");

const testAnchor = "  const fruitIcons = {";
if (!test.includes(testAnchor)) throw new Error("Registry smoke insertion anchor not found.");
const iconTest = `  const chocolateDonutIcons = {
    chocolate:'Assets/Icons/items/material/chocolate.png',
    chocolate_chips:'Assets/Icons/items/material/chocolate_chips.png',
    donut:'Assets/Icons/items/consumable/donut.png',
    glazed_donut:'Assets/Icons/items/consumable/glazed_donut.png',
    sugar_donut:'Assets/Icons/items/consumable/sugar_donut.png',
    chocolate_donut:'Assets/Icons/items/consumable/chocolate_donut.png',
    cinnamon_donut:'Assets/Icons/items/consumable/cinnamon_donut.png',
    jam_filled_donut:'Assets/Icons/items/consumable/jam_filled_donut.png',
    cream_filled_donut:'Assets/Icons/items/consumable/cream_filled_donut.png',
    chocolate_filled_donut:'Assets/Icons/items/consumable/chocolate_filled_donut.png'
  };
  for (const [id, icon] of Object.entries(chocolateDonutIcons)) {
    assert.equal(registry.has(id), true, id);
    assert.equal(registry.resolveIcon(id), icon, id);
  }
  assert.equal(registry.get('chocolate').domain, 'material');
  assert.equal(registry.get('chocolate_chips').domain, 'material');
  for (const id of ['donut','glazed_donut','sugar_donut','chocolate_donut','cinnamon_donut','jam_filled_donut','cream_filled_donut','chocolate_filled_donut']) {
    assert.equal(registry.get(id).domain, 'consumable', id);
  }

`;
test = test.replace(testAnchor, iconTest + testAnchor);
await fs.writeFile(TEST_PATH, test, "utf8");

const catalog = JSON.parse(await fs.readFile(CATALOG_PATH, "utf8"));
if (catalog.familyCount !== 589 || catalog.uniqueAssetCount !== 636) {
  throw new Error("Unexpected starting catalog counts: " + catalog.familyCount + "/" + catalog.uniqueAssetCount);
}
const familyIds = new Set(catalog.families.map((entry)=>entry.id));
const assetPaths = new Set(catalog.assets.map((entry)=>entry.path));
for (const item of materialized) {
  if (familyIds.has(item.id)) throw new Error("Catalog family already exists: " + item.id);
  if (assetPaths.has(item.path)) throw new Error("Catalog asset already exists: " + item.path);
  catalog.families.push({
    id:item.id, label:item.label, labelEs:item.labelEs, domain:item.domain,
    path:item.path, legacySource:item.source,
  });
  catalog.assets.push({
    path:item.path, primaryId:item.id, domain:item.domain, familyIds:[item.id],
    bytes:item.bytes, sha256:item.hash, legacySource:item.source,
  });
}
catalog.familyCount = catalog.families.length;
catalog.uniqueAssetCount = catalog.assets.length;
catalog.assets.sort((a,b)=>a.path.localeCompare(b.path));
if (catalog.familyCount !== 599 || catalog.uniqueAssetCount !== 646) {
  throw new Error("Unexpected final catalog counts: " + catalog.familyCount + "/" + catalog.uniqueAssetCount);
}
await fs.writeFile(CATALOG_PATH, JSON.stringify(catalog, null, 2) + "\n", "utf8");
console.log("Food icon vendoring complete:", catalog.familyCount, "families,", catalog.uniqueAssetCount, "assets.");
