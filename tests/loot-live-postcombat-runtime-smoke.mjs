import assert from "node:assert/strict";
import fs from "node:fs";

globalThis.window = globalThis;

await import("../js/item-runtime-engine.js");
await import("../js/item-inventory-runtime.js");
await import("../js/item-quality-engine.js");
await import("../js/item-size-lineage-engine.js");
await import("../js/item-culinary-affinity-data.js");
await import("../js/item-affinity-engine.js");
await import("../js/item-processing-engine.js");
await import("../js/item-harvest-integrity-engine.js");
await import("../js/item-economy-standard.js");
await import("../js/creature-type-catalog.js");
await import("../js/loot-social-profile-contract.js");
await import("../js/loot-encounter-context.js");
await import("../js/corpse-harvest-runtime.js");
await import("../js/loot-ammo-reconciliation.js");
await import("../js/item-catalog-meat.js");
await import("../js/item-catalog-hide-pelt.js");
await import("../js/item-catalog-hard-parts.js");
await import("../js/item-catalog-organ-gland.js");
await import("../js/item-catalog-blood-ichor.js");
await import("../js/item-catalog-venom-secretion.js");
await import("../js/item-catalog-ooze-gel.js");
await import("../js/item-catalog-scale-shell-chitin.js");
await import("../js/item-catalog-feather-raw-fiber.js");
await import("../js/item-catalog-salvage-raw.js");
await import("../js/loot-instance-runtime.js");
await import("../js/loot-check-runtime.js");
await import("../js/loot-knowledge-runtime.js");
await import("../js/loot-postcombat-runtime.js");
await import("../js/loot-recovery-delivery-runtime.js");
await import("../js/loot-live-postcombat-runtime.js");

const live = globalThis.LuminousLootLivePostCombatRuntime;
const postCombat = globalThis.LuminousLootPostCombatRuntime;
const inventory = globalThis.LuminousItemInventoryRuntime;
const knowledge = globalThis.LuminousLootKnowledgeRuntime;
assert.ok(live);
assert.ok(postCombat);
assert.ok(inventory);
assert.ok(knowledge);

function deepClone(value) {
  return value == null ? value : structuredClone(value);
}
function splitPath(path = "") {
  return String(path).split("/").filter(Boolean);
}
function getPath(root, path) {
  let node = root;
  for (const key of splitPath(path)) node = node?.[key];
  return node === undefined ? null : node;
}
function setPath(root, path, value) {
  const parts = splitPath(path);
  if (!parts.length) {
    for (const key of Object.keys(root)) delete root[key];
    Object.assign(root, deepClone(value || {}));
    return;
  }
  let node = root;
  parts.slice(0, -1).forEach((key) => {
    if (!node[key] || typeof node[key] !== "object") node[key] = {};
    node = node[key];
  });
  const last = parts.at(-1);
  if (value === null || value === undefined) delete node[last];
  else node[last] = deepClone(value);
}
function fakeDb(initial = {}) {
  const data = deepClone(initial);
  let pushCounter = 0;
  function ref(path = "") {
    return {
      key: splitPath(path).at(-1) || null,
      async once() {
        const value = deepClone(getPath(data, path));
        return {
          val: () => deepClone(value),
          exists: () => value !== null && value !== undefined,
        };
      },
      async set(value) {
        setPath(data, path, value);
      },
      async update(patch) {
        for (const [key, value] of Object.entries(patch || {})) {
          setPath(data, [path, key].filter(Boolean).join("/"), value);
        }
      },
      async remove() {
        setPath(data, path, null);
      },
      push() {
        pushCounter += 1;
        const key = `push_${String(pushCounter).padStart(4, "0")}`;
        return { key, set: async (value) => setPath(data, [path, key].filter(Boolean).join("/"), value) };
      },
      async transaction(updater) {
        const current = deepClone(getPath(data, path));
        const next = updater(current);
        if (next === undefined) {
          return {
            committed: false,
            snapshot: { val: () => deepClone(getPath(data, path)) },
          };
        }
        setPath(data, path, next);
        return {
          committed: true,
          snapshot: { val: () => deepClone(getPath(data, path)) },
        };
      },
    };
  }
  return { data, ref };
}

const wolf = {
  id: "wolf",
  name: "Wolf",
  species: "wolf",
  creatureType: "beast",
  bodyProfile: {
    version: 1,
    kind: "organic",
    sizeClass: "medium",
    materials: ["flesh", "blood", "bone", "pelt"],
    edible: true,
    resources: [
      { id: "meat", integrityFamily: "meat", sourceMaterial: "flesh", itemId: "meat_wolf", catalogFamily: "meat", culinary: true, knownUses: ["cooking"], yield: { min: 1, max: 1 } },
      { id: "pelt", integrityFamily: "hide_pelt", sourceMaterial: "pelt", itemId: "pelt_fur", catalogFamily: "hide_pelt", valuable: true, knownUses: ["armor_crafting"], yield: { min: 1, max: 1 } },
    ],
  },
  lootProfile: {
    version: 1,
    carried: [],
    equipment: { source: "none" },
    currency: null,
    harvest: { source: "body_profile" },
    impossibleCategories: [],
  },
};

const goblin = {
  id: "goblin",
  name: "Goblin",
  species: "goblin",
  creatureType: "humanoid",
  scores: { str: 8, dex: 14, con: 10, int: 10, wis: 8, cha: 8 },
  bodyProfile: {
    version: 1,
    kind: "organic",
    sizeClass: "small",
    materials: ["flesh", "blood", "bone"],
    edible: true,
    resources: [
      { id: "internal_organs", integrityFamily: "organ_internal", sourceMaterial: "flesh", itemId: "internal_organ", catalogFamily: "organ_gland", valuable: true, knownUses: ["medicine"] },
    ],
  },
  lootProfile: {
    version: 1,
    carried: [],
    equipment: { source: "none" },
    currency: null,
    harvest: { source: "body_profile" },
    impossibleCategories: [],
  },
};

const db = fakeDb({
  campaña: {
    combate: {
      estado: { phase: "PLANNING", active: true },
      combatants: {
        "enemy:wolf:001": {
          ...deepClone(wolf),
          id: "enemy:wolf:001",
          combatId: "enemy:wolf:001",
          libraryUnitId: "wolf",
          faction: "enemy",
          defeated: true,
          dead: true,
          lootEligible: true,
        },
        "enemy:wolf:escaped": {
          ...deepClone(wolf),
          id: "enemy:wolf:escaped",
          combatId: "enemy:wolf:escaped",
          libraryUnitId: "wolf",
          faction: "enemy",
          defeated: false,
          escaped: true,
          lootEligible: false,
        },
      },
    },
    base_datos_unidades: {
      wolf: deepClone(wolf),
      goblin: deepClone(goblin),
    },
    jugadores: {
      hunter: {
        id: "hunter",
        scores: { wis: 18, int: 12 },
        proficiencyBonus: 3,
        proficiencies: { skills: { survival: "expertise", investigation: "proficient", medicine: "proficient" } },
        sp: 45,
        inventoryRules: { activeSlotLimit: 20, stashSlotLimit: 80 },
        inventario_activo: {},
        inventario_stash: {},
        ahn: 50,
        finance: { currentBalance: 50, transactionHistory: {} },
      },
      rival: {
        id: "rival",
        scores: { wis: 18 },
        proficiencyBonus: 3,
        proficiencies: { skills: { survival: "expertise" } },
        sp: 45,
        inventoryRules: { activeSlotLimit: 20, stashSlotLimit: 80 },
        inventario_activo: {},
        inventario_stash: {},
      },
      full: {
        id: "full",
        scores: { wis: 18 },
        proficiencyBonus: 3,
        proficiencies: { skills: { survival: "expertise" } },
        sp: 45,
        inventoryRules: { activeSlotLimit: 0, stashSlotLimit: 0 },
        inventario_activo: {},
        inventario_stash: {},
      },
      searcher: {
        id: "searcher",
        scores: { int: 18, wis: 14 },
        proficiencyBonus: 3,
        proficiencies: { skills: { investigation: "expertise", medicine: "proficient" } },
        sp: 45,
        inventoryRules: { activeSlotLimit: 20, stashSlotLimit: 80 },
        inventario_activo: {},
        inventario_stash: {},
        ahn: 10,
        finance: { currentBalance: 10, transactionHistory: {} },
        transacciones: {},
      },
    },
  },
});

const encounterId1 = await live.ensureEncounterId({ db, idFactory: () => "encounter_live_001", now: 100 });
const encounterId2 = await live.ensureEncounterId({ db, idFactory: () => "encounter_should_not_replace", now: 101 });
assert.equal(encounterId1, "encounter_live_001");
assert.equal(encounterId2, "encounter_live_001");
assert.equal(getPath(db.data, "campaña/combate/estado/encounterId"), "encounter_live_001");

const finalized = await live.finalizeEncounterLoot({
  db,
  encounterId: encounterId1,
  result: "victory",
  now: 110,
});
assert.equal(finalized.finalized.length, 1, "only defeated loot-eligible enemy becomes a persisted corpse");
assert.equal(finalized.skipped.length, 0);
const corpse = finalized.finalized[0];
assert.equal(corpse.sourceUnitId, "wolf");
const lockedLoot = getPath(db.data, `campaña/loot_instances/${corpse.lootInstanceId}`);
const persistedInteraction = getPath(db.data, `campaña/loot_postcombat/${corpse.lootInstanceId}`);
assert.equal(lockedLoot.locked, true);
assert.equal(lockedLoot.encounterId, encounterId1);
assert.equal(persistedInteraction.lootInstanceId, corpse.lootInstanceId);
assert.equal(getPath(db.data, `campaña/loot_encounters/${encounterId1}/meta/open`), true);

const finalizedAgain = await live.finalizeEncounterLoot({
  db,
  encounterId: encounterId1,
  result: "victory",
  now: 111,
});
assert.equal(finalizedAgain.finalized.length, 1);
assert.equal(finalizedAgain.finalized[0].lootInstanceId, corpse.lootInstanceId);
assert.equal(finalizedAgain.finalized[0].reused, true, "refresh/retry must reuse the same persisted corpse Loot Instance");

const allHeads = () => 0;
const hunterBefore = deepClone(getPath(db.data, "campaña/jugadores/hunter"));
const harvest = await live.executeAction({
  db,
  lootInstanceId: corpse.lootInstanceId,
  playerId: "hunter",
  actor: hunterBefore,
  actionId: "harvest",
  targetResourceId: "meat",
  rng: allHeads,
  now: 120,
});
assert.equal(harvest.committed, true);
assert.equal(harvest.delivery.delivered, true);
const hunterAfter = getPath(db.data, "campaña/jugadores/hunter");
const harvestedMeat = [
  ...Object.values(hunterAfter.inventario_activo || {}),
  ...Object.values(hunterAfter.inventario_stash || {}),
].find((item) => item.definitionId === "meat_wolf");
assert.ok(harvestedMeat, "live recovery must persist the harvested Item Instance into Player inventory authority");
assert.equal(harvestedMeat.currentOwnerId, "hunter");
assert.equal(harvestedMeat.provenance.encounterId, encounterId1);
assert.equal(harvestedMeat.provenance.corpseId, corpse.corpseId);
assert.equal(harvestedMeat.provenance.acquisitionMethod, "harvest");

const hunterCompendium = getPath(db.data, "campaña/jugadores/hunter/compendium");
assert.ok(hunterCompendium.units.wolf.facts["loot.known_uses"], "materialized culinary/crafting knowledge must persist into local Compendium");

const rivalBefore = deepClone(getPath(db.data, "campaña/jugadores/rival"));
const contested = await live.executeAction({
  db,
  lootInstanceId: corpse.lootInstanceId,
  playerId: "rival",
  actor: rivalBefore,
  actionId: "harvest",
  targetResourceId: "meat",
  rng: allHeads,
  now: 121,
});
const rivalAfter = getPath(db.data, "campaña/jugadores/rival");
const rivalMeat = [
  ...Object.values(rivalAfter.inventario_activo || {}),
  ...Object.values(rivalAfter.inventario_stash || {}),
].filter((item) => item.definitionId === "meat_wolf");
assert.equal(rivalMeat.length, 0, "a second player cannot recover the same finite corpse resource twice");
assert.equal(
  getPath(db.data, `campaña/loot_postcombat/${corpse.lootInstanceId}/harvest/resources/0/remaining`),
  0,
);

const fullBefore = deepClone(getPath(db.data, "campaña/jugadores/full"));
const pending = await live.executeAction({
  db,
  lootInstanceId: corpse.lootInstanceId,
  playerId: "full",
  actor: fullBefore,
  actionId: "harvest",
  targetResourceId: "pelt",
  rng: allHeads,
  now: 130,
});
assert.equal(pending.committed, true);
assert.equal(pending.delivery.delivered, false);
assert.equal(pending.delivery.reason, "inventory_capacity_exceeded");
const stateWithPending = getPath(db.data, `campaña/loot_postcombat/${corpse.lootInstanceId}`);
const pendingRow = stateWithPending.pendingDeliveries.find((entry) => entry.actorId === "full");
assert.ok(pendingRow, "failed capacity delivery must survive refresh as persistent Pending Delivery");

await db.ref("campaña/jugadores/full/inventoryRules").set({ activeSlotLimit: 20, stashSlotLimit: 80 });
const resumed = await live.deliverPending({
  db,
  lootInstanceId: corpse.lootInstanceId,
  deliveryId: pendingRow.id,
  playerId: "full",
  now: 131,
});
assert.equal(resumed.delivered, true);
assert.equal(
  getPath(db.data, `campaña/loot_postcombat/${corpse.lootInstanceId}/pendingDeliveries`).length,
  0,
);
const resumedAgain = await live.deliverPending({
  db,
  lootInstanceId: corpse.lootInstanceId,
  deliveryId: pendingRow.id,
  playerId: "full",
  now: 132,
});
assert.equal(resumedAgain.delivered, true);
assert.equal(resumedAgain.duplicate, true, "delivery receipt makes refresh/retry idempotent");

const ration = inventory.createItemInstance({
  id: "ration",
  name: "Ration",
  category: "food",
  itemType: "consumable",
  stackable: true,
}, {
  instanceId: "live_ration_001",
  quantity: 1,
  provenance: {
    sourceUnitId: "goblin",
    sourceUnitInstanceId: "enemy:goblin:001",
    corpseId: "corpse:goblin:001",
    encounterId: encounterId1,
    lootInstanceId: "loot_live_currency",
  },
});
const currencyLoot = {
  lootInstanceId: "loot_live_currency",
  locked: true,
  sourceUnitId: "goblin",
  sourceUnitInstanceId: "enemy:goblin:001",
  corpseId: "corpse:goblin:001",
  encounterId: encounterId1,
  sourceDigest: "live_currency_digest",
  generation: 0,
  carried: [ration],
  currency: { currencyId: "ahn", amount: 100, provenance: { sourceUnitId: "goblin" } },
  equipment: { source: "none", items: [] },
  harvest: { bodyKind: "organic", sizeClass: "small", resources: [] },
};
await db.ref("campaña/loot_instances/loot_live_currency").set(currencyLoot);
await db.ref("campaña/loot_postcombat/loot_live_currency").set(postCombat.createInteractionState(currencyLoot, { now: 200 }));

const searcherBefore = deepClone(getPath(db.data, "campaña/jugadores/searcher"));
const searched = await live.executeAction({
  db,
  lootInstanceId: "loot_live_currency",
  playerId: "searcher",
  actor: searcherBefore,
  actionId: "search",
  rng: allHeads,
  now: 201,
});
assert.equal(searched.committed, true);
assert.equal(searched.delivery.delivered, true);
const searcherAfter = getPath(db.data, "campaña/jugadores/searcher");
assert.equal(searcherAfter.ahn, 110);
assert.equal(searcherAfter.finance.currentBalance, 110);
const lootTxKey = Object.keys(searcherAfter.finance.transactionHistory).find((key) => key.startsWith("loot_"));
assert.ok(lootTxKey);
assert.equal(searcherAfter.finance.transactionHistory[lootTxKey].monto, 100);
assert.equal(searcherAfter.transacciones[lootTxKey].monto, 100);
assert.ok(searcherAfter.lootRecoveryReceipts);

const examined = await live.executeAction({
  db,
  lootInstanceId: "loot_live_currency",
  playerId: "searcher",
  actor: deepClone(searcherAfter),
  actionId: "examine",
  rng: allHeads,
  now: 202,
});
assert.equal(examined.committed, true);
const examinedCompendium = getPath(db.data, "campaña/jugadores/searcher/compendium");
assert.ok(examinedCompendium.units.goblin);
assert.ok(Object.keys(examinedCompendium.units.goblin.facts).some((id) => id.startsWith("environment.") || id.startsWith("loot.")));

const battleHtml = fs.readFileSync(new URL("../Battle-viewer.html", import.meta.url), "utf8");
const playerHtml = fs.readFileSync(new URL("../hoja_personaje.html", import.meta.url), "utf8");
const playerUi = fs.readFileSync(new URL("../js/player-postcombat-loot.js", import.meta.url), "utf8");
assert.match(battleHtml, /js\/loot-live-postcombat-runtime\.js/);
assert.match(playerHtml, /js\/loot-live-postcombat-runtime\.js/);
assert.match(playerHtml, /js\/player-postcombat-loot\.js/);
assert.match(playerUi, /RECUPERACIÓN POST-COMBATE/);
assert.match(playerUi, />Botín</);
assert.doesNotMatch(playerUi, /debug|sourceDigest|lootGeneration|exact percentage/i, "player-facing post-combat surface must not expose debug/internal Loot data");

console.log("Live post-combat Loot persistence, concurrency, finance, resume and player bootstrap smoke passed.");
