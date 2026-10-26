import assert from "node:assert/strict";
import fs from "node:fs";

globalThis.window = globalThis;

await import("../js/item-quality-engine.js");
await import("../js/item-size-lineage-engine.js");
await import("../js/item-affinity-engine.js");
await import("../js/item-culinary-affinity-data.js");
await import("../js/item-inventory-runtime.js");
await import("../js/item-harvest-integrity-engine.js");
await import("../js/item-economy-standard.js");
await import("../js/creature-type-catalog.js");
await import("../js/unit-loot-profile-contract.js");
await import("../js/loot-social-profile-contract.js");
await import("../js/loot-encounter-context.js");
await import("../js/corpse-harvest-runtime.js");
await import("../js/loot-instance-runtime.js");
await import("../js/dm-loot-studio.js");

const inventory = globalThis.LuminousItemInventoryRuntime;
const lootContract = globalThis.LuminousUnitLootProfileContract;
const social = globalThis.LuminousLootSocialProfileContract;
const studio = globalThis.LuminousDmLootStudio;

assert.ok(inventory);
assert.ok(studio);

const items = {
  ration: { id: "ration", name: "Ration", category: "food", stackable: true },
  medkit: { id: "medkit", name: "Medkit", category: "medicine", stackable: true },
};

const profiles = lootContract.createProfiles({
  bodyProfile: {
    kind: "organic",
    sizeClass: "small",
    materials: ["flesh", "blood", "bone"],
    resources: [
      { id: "meat", integrityFamily: "meat", sourceMaterial: "flesh", itemId: "meat_humanoid", catalogFamily: "meat" },
    ],
  },
  lootProfile: {
    carried: [
      { itemId: "ration", category: "food", rarity: "guaranteed", quantity: 1 },
    ],
    equipment: { source: "unit_loadout" },
    currency: { currencyId: "ahn", min: 50, max: 50, zeroAllowed: true },
    harvest: { source: "body_profile" },
    impossibleCategories: ["luxury"],
  },
});

const unit = {
  id: "studio_goblin",
  name: "Studio Goblin",
  species: "goblin",
  metadata: { creatureType: "humanoid" },
  bodyProfile: profiles.bodyProfile,
  lootProfile: profiles.lootProfile,
  wealthProfile: social.normalizeWealthProfile({ bandId: "backstreets_very_poor", source: "test" }),
  roleProfile: social.normalizeRoleProfile({ roles: ["scavenger"], source: "test" }),
  mechanics: {
    weaponLoadout: [
      { weaponId: "scimitar", range: "melee", skillId: "slash" },
    ],
  },
};

function fakeDb(initial = {}) {
  const store = new Map(Object.entries(initial).map(([key, value]) => [key, structuredClone(value)]));
  return {
    store,
    ref(path) {
      return {
        async once() {
          return { val: () => structuredClone(store.get(path) ?? null) };
        },
        async set(value) {
          store.set(path, structuredClone(value));
        },
        async update(patch) {
          const current = structuredClone(store.get(path) || {});
          store.set(path, { ...current, ...structuredClone(patch) });
        },
      };
    },
  };
}

studio.state.items = structuredClone(items);
studio.state.overrideItems.splice(0);
studio.state.removeItemIds.splice(0);
studio.resetPreview(unit.id);

studio.state.overrideItems.push({ itemId: "medkit", category: "medicine", quantity: 2 });
studio.state.removeItemIds.push("ration");

const zone = {
  id: "studio_forest",
  profileId: "forest",
  impossibleCategories: ["gems"],
};
const events = [
  { id: "war_01", eventType: "war" },
];

const preview = studio.generatePreview(unit, {
  zone,
  events,
  catalog: items,
  now: 100,
});
assert.equal(preview.locked, false);
assert.equal(preview.generation, 0);
assert.equal(preview.sourceUnitId, unit.id);
assert.ok(preview.carried.some((item) => item.definitionId === "medkit"));
assert.ok(!preview.carried.some((item) => item.definitionId === "ration"), "DM remove override must exclude authored carried Item");
assert.ok(preview.impossibleCategories.all.includes("gems"));

const model = studio.viewModel(unit, preview);
assert.equal(model.unit.id, unit.id);
assert.equal(model.unit.bodyKind, "organic");
assert.equal(model.unit.wealthBand, "backstreets_very_poor");
assert.deepEqual(model.unit.roles, ["scavenger"]);
assert.equal(model.context.zone, "forest");
assert.deepEqual(model.context.events, ["war"]);
assert.ok(model.generated.carried.length > 0);
assert.ok(model.generated.harvest.length > 0);
assert.ok(model.context.impossibleCategories.includes("gems"));
assert.equal(model.locked, false);
assert.equal(model.overrides.guaranteedItems[0].itemId, "medkit");
assert.ok(model.overrides.removeItemIds.includes("ration"));

const regenerated = studio.regeneratePreview(unit, {
  zone,
  events,
  catalog: items,
  now: 110,
});
assert.equal(regenerated.generation, 1);
assert.notEqual(regenerated.lootInstanceId, preview.lootInstanceId);

const db = fakeDb({
  "campaña/jugadores/player_1": {
    id: "player_1",
    inventoryRules: { activeSlotLimit: 20, stashSlotLimit: 80 },
    inventario_activo: {},
    inventario_stash: {},
  },
});

const locked = await studio.lockPreview(unit, { db, now: 120 });
assert.equal(locked.locked, true);
assert.equal(locked.lockReason, "dm_loot_studio_finalize");
assert.deepEqual(
  db.store.get(`campaña/loot_instances/${locked.lootInstanceId}`),
  locked,
  "finalized Loot Instance must be persisted as its own source entity",
);

assert.throws(
  () => studio.regeneratePreview(unit, { zone, events, catalog: items }),
  /LOCKED_LOOT_INSTANCE_CANNOT_REGENERATE/,
);

const granted = await studio.grantLockedToPlayer("player_1", { db, now: 130 });
assert.equal(granted.granted, true);
const playerAfter = db.store.get("campaña/jugadores/player_1");
const grantedItems = [
  ...Object.values(playerAfter.inventario_stash || {}),
  ...Object.values(playerAfter.inventario_activo || {}),
];
assert.ok(grantedItems.length > 0);
for (const item of grantedItems) {
  assert.equal(item.schemaVersion, inventory.schemaVersion);
  assert.equal(item.currentOwnerId, "player_1");
  assert.ok(item.instanceId);
  assert.ok(item.provenance?.sourceUnitId);
  assert.equal(item.provenance.acquisitionMethod, "dm_grant");
  assert.equal(item.provenance.grantedFromLootInstanceId, locked.lootInstanceId);
}

await assert.rejects(
  () => studio.grantLockedToPlayer("player_1", { db, now: 140 }),
  /DM_LOOT_ALREADY_GRANTED_TO_PLAYER/,
  "locked Loot cannot be duplicated to the same player by clicking Grant twice",
);

const legacyDb = fakeDb({
  "campaña/jugadores/player_legacy": {
    id: "player_legacy",
    inventoryRules: { activeSlotLimit: 20, stashSlotLimit: 80 },
    inventario_activo: {},
    inventario_stash: {},
  },
});
const legacy = await studio.grantLegacyTemplateDrops({
  db: legacyDb,
  playerId: "player_legacy",
  templateId: "street_thug_custom",
  items: [
    { itemId: "ration", definition: items.ration, quantity: 1 },
  ],
});
assert.equal(legacy.granted, true);
const legacyPlayer = legacyDb.store.get("campaña/jugadores/player_legacy");
const legacyItem = Object.values(legacyPlayer.inventario_stash)[0];
assert.equal(legacyItem.schemaVersion, inventory.schemaVersion);
assert.equal(legacyItem.definitionId, "ration");
assert.equal(legacyItem.provenance.acquisitionMethod, "dm_grant");
assert.equal(legacyItem.provenance.sourceKind, "dm_custom_loot_template");
assert.equal(legacyItem.provenance.templateId, "street_thug_custom");

assert.equal(studio.isDeferredMagicDefinition({ tags: ["enchanted"] }), true);
assert.equal(studio.isDeferredMagicDefinition({ category: "medicine" }), false);
await assert.rejects(
  () => studio.grantLegacyTemplateDrops({
    db: legacyDb,
    playerId: "player_legacy",
    templateId: "magic_should_wait",
    items: [
      { itemId: "cursed_relic", definition: { id: "cursed_relic", name: "Cursed Relic", tags: ["cursed"] } },
    ],
  }),
  /MAGIC_LOOT_DEFERRED/,
);

const fullPlayer = {
  id: "full",
  inventoryRules: { activeSlotLimit: 0, stashSlotLimit: 0 },
  inventario_activo: {},
  inventario_stash: {},
};
const fullItem = inventory.createItemInstance(items.ration, {
  currentOwnerId: "full",
  provenance: { acquisitionMethod: "dm_grant" },
});
const blocked = studio.grantInstancesToPlayerRecord(fullPlayer, [fullItem], { ownerId: "full" });
assert.equal(blocked.granted, false);
assert.equal(Object.keys(blocked.player.inventario_stash).length, 0);
assert.equal(Object.keys(blocked.player.inventario_activo).length, 0);

const html = fs.readFileSync(new URL("../pantalla_dm.html", import.meta.url), "utf8");
assert.match(html, /id="tab-loot"/);
assert.match(html, /id="dm-loot-studio-app"/);
for (const id of [
  "dm-loot-unit",
  "dm-loot-zone",
  "dm-loot-event",
  "dm-loot-player",
  "dm-loot-override-item",
  "dm-loot-preview",
  "dm-loot-regenerate",
  "dm-loot-lock",
  "dm-loot-grant",
  "dm-loot-source",
  "dm-loot-context",
  "dm-loot-output",
  "dm-loot-provenance",
]) {
  assert.ok(html.includes(`id="${id}"`), `DM Loot Studio control missing: ${id}`);
}
assert.match(html, /Plantillas Custom \/ Compatibilidad/);
assert.match(html, /window\.LuminousDmLootStudio/);
assert.match(html, /studio\.grantLegacyTemplateDrops/);
assert.doesNotMatch(
  html.slice(html.indexOf("// D. GENERADOR DE BOTÍN"), html.indexOf("// --- LÓGICA GESTIÓN DE ACTORES ---")),
  /inventario_stash[^\n]*\.push\(item\)/,
  "legacy loot grant must not push raw definitions directly into stash",
);

console.log("DM Loot Studio smoke passed.");
