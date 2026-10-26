import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import {
  FLOOR_TEXTURE_IDS,
  floorTextureId,
  floorTexturePath,
} from "../js/global-map-terrain-textures.js";

const ROOT = process.cwd();
const PNG_SIGNATURE = Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]);

const EXPECTED = [
  "floor_grass_01",
  "floor_dirt_01",
  "floor_sand_01",
  "floor_stone_01",
  "floor_gravel_01",
  "floor_mud_01",
  "floor_snow_01",
  "floor_ice_01",
  "floor_swamp_01",
  "floor_cave_01",
  "floor_cobblestone_01",
  "floor_flagstone_01",
  "floor_wood_01",
  "floor_brick_01",
  "floor_marble_01",
  "floor_tile_01",
  "floor_metal_01",
  "floor_concrete_01",
];

assert.deepEqual([...FLOOR_TEXTURE_IDS], EXPECTED);
assert.equal(floorTextureId("grass"), "floor_grass_01");
assert.equal(floorTextureId("playa_sandy"), "floor_sand_01");
assert.equal(floorTextureId({ terrain:"mountain" }), "floor_stone_01");
assert.equal(floorTextureId({ floorTextureId:"floor_marble_01" }), "floor_marble_01");
assert.equal(floorTexturePath("floor_metal_01"), "Assets/Images/World/Floors/floor_metal_01.png");
assert.equal(floorTexturePath("unknown_surface"), null);

const catalogPath = path.join(ROOT, "Assets", "Images", "World", "Floors", "catalog.json");
const catalog = JSON.parse(await fs.readFile(catalogPath, "utf8"));
assert.equal(catalog.domain, "world.floor");
assert.equal(catalog.runtimeMode, "repository-local");
assert.equal(catalog.assetCount, EXPECTED.length);

for (const id of EXPECTED) {
  const asset = catalog.assets.find((entry) => entry.id === id);
  assert.ok(asset, "catalog missing " + id);
  assert.equal(asset.path, "Assets/Images/World/Floors/" + id + ".png");
  const buffer = await fs.readFile(path.join(ROOT, asset.path));
  assert.ok(buffer.length > PNG_SIGNATURE.length, id + " must not be empty");
  assert.ok(buffer.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE), id + " must be PNG");
}

console.log("global map floor texture assets smoke: ok");
