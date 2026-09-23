import { GameEngine } from "../src/core/GameEngine.js";
import { DMDirector } from "../src/dm/DMDirector.js";
import { createLabPlayer } from "../src/player/createLabPlayer.js";
import { LuminousItemsBridge } from "../src/bridges/luminous/LuminousItemsBridge.js";
import { WORLD_SPACE_CONTRACT } from "../src/world/WorldSpaceContract.js";
import { CombatMovementTracker } from "../src/world/ContinuousMovement.js";

const engine = new GameEngine();
const player = createLabPlayer();
const items = engine.registerBridge("luminous-items", new LuminousItemsBridge());
const dm = new DMDirector(engine);
const combatMovement = new CombatMovementTracker();
engine.session.dm = dm;
engine.session.worldSpace = WORLD_SPACE_CONTRACT;
engine.session.combatMovement = combatMovement;
engine.setPlayer(player);

const $ = (id) => document.getElementById(id);
const frame = $("gameFrame");
const mirroredDefinitionIds = new Set();
let gameConnected = false;
let syncTimer = null;
let shopProvider = null;

function log(type, payload = {}) {
  if (new URLSearchParams(location.search).has("debugLab")) {
    console.debug("[LuminousLab]", type, payload);
  }
}

function containerCount(container) {
  return Object.values(container || {}).reduce((sum, item) => sum + Math.max(1, Number(item?.quantity || 1)), 0);
}

function render() {
  const metrics = engine.metrics();
  const status = items.status();
  const activeCount = containerCount(player.inventario_activo);
  const stashCount = containerCount(player.inventario_stash);
  const hp = player.resources?.hp || {};
  const sp = player.resources?.sp || {};

  $("runtimeDot").classList.toggle("on", metrics.running);
  $("runtimeLabel").textContent = metrics.running ? `Engine activo · ${metrics.frames} frames` : "Engine detenido";
  $("inventoryBadge").textContent = `Inventario ${activeCount} · Stash ${stashCount}`;
  $("walletBadge").textContent = `₳${Number(player.wallet?.AHN || 0).toLocaleString("es-MX")}`;
  $("hpStat").textContent = `${Number(hp.current ?? 0)}/${Number(hp.max ?? hp.current ?? 0)}`;
  $("spStat").textContent = `${Number(sp.current ?? 0)}/${Number(sp.max ?? sp.current ?? 0)}`;
  $("offStat").textContent = String(player.combatLevels?.offensive?.total ?? player.stats?.offensiveLevel ?? "—");
  $("defStat").textContent = String(player.combatLevels?.defensive?.total ?? player.stats?.defensiveLevel ?? "—");


  const badge = $("bridgeBadge");
  badge.textContent = gameConnected ? "Forest ↔ Items conectado" : "Conectando juego…";
  badge.classList.toggle("good", gameConnected);
  badge.classList.toggle("waiting", !gameConnected);
}

function gameWindow() {
  try { return frame.contentWindow || null; } catch (_) { return null; }
}

function canonicalIcon(win, item = {}) {
  const registry = win?.LuminousItemIconRegistry;
  const family = item.iconFamily || item.iconGroup || item.icon_family || item.group || item.family;
  return registry?.resolveIcon?.(family, {
    iconOverride: item.icon || item.iconUrl || item.icono || "",
    fallback: false
  }) || item.icon || item.iconUrl || item.icono || null;
}

function canonicalPrice(item = {}) {
  const candidates = [
    item.standardUnitValueAhn,
    item.unitValueAhn,
    item.baseUnitValueAhn,
    item.productionValueAhn,
    item.priceAhn,
    item.valueAhn,
    item.basePriceAhn
  ];
  for (const value of candidates) {
    const n = Number(value);
    if (Number.isFinite(n) && n > 0) return Math.round(n);
  }
  return 0;
}

function normalizeVisualDefinition(detail) {
  const item = detail?.item || {};
  const icon = detail?.icon || canonicalIcon(gameWindow(), item);
  return {
    id: String(detail?.itemId || item.id || "unknown_item"),
    name: item.name || item.nombre || detail?.itemId || "Item",
    tier: "I",
    value: canonicalPrice(item),
    category: item.category === "consumable" ? "consumable" : (item.category === "weapon" ? "weapon" : "utility"),
    tags: [
      item.family,
      item.group,
      item.iconFamily,
      ...(item.functionalTags || []),
      ...(item.craftTags || [])
    ].filter(Boolean),
    quality: "STANDARD",
    description: [
      item.group,
      ...(item.functionalTags || []),
      ...(item.craftTags || [])
    ].filter(Boolean).join(" · ") || "Objeto canónico de Luminous.",
    icon: icon || null
  };
}

function insertCanonicalInstance(detail) {
  if (!items.available) return { ok: false, reason: "item_runtime_unavailable" };
  const definition = detail?.item || detail?.itemId;
  if (!definition) return { ok: false, reason: "missing_definition" };

  const quantity = Math.max(1, Math.trunc(Number(detail.quantity) || 1));
  const instance = items.createInstance(definition, {
    quantity,
    ownerId: player.id,
    source: detail.source || "game"
  });

  let result = items.insert(player, instance, { container: "active" });
  let containerType = "active";
  if (!result?.inserted) {
    result = items.insert(player, instance, { container: "stash" });
    containerType = "stash";
  }
  if (!result?.inserted) return { ok: false, reason: result?.reason || "inventory_full", result };

  const key = result.insertedKeys?.[0] || result.instanceId || instance.instanceId;
  engine.events.emit("items:acquired-lab", {
    source: detail.source || "game",
    itemId: detail.itemId || instance.definitionId,
    quantity: result.quantity || quantity,
    instanceId: key,
    containerType
  });
  return { ok: true, key, instance, quantity: result.quantity || quantity, containerType, result };
}

function mirrorIntoGame(detail, canonical) {
  const win = gameWindow();
  const paper = win?.PaperInventory;
  if (!paper) return { added: false, reason: "paper_inventory_unavailable" };

  const visualDef = normalizeVisualDefinition(detail);
  paper.registerDefinition(visualDef);
  mirroredDefinitionIds.add(visualDef.id);

  let destination = canonical.containerType === "stash" ? "stash" : "active";
  let visual = paper.addItem(visualDef.id, canonical.quantity, destination);
  if (!visual?.added && destination === "active") {
    visual = paper.addItem(visualDef.id, canonical.quantity, "stash");
    destination = "stash";
    if (visual?.added) items.moveToStash(player, canonical.key);
  }

  return { ...visual, destination, icon: visualDef.icon };
}

async function grantFromGame(detail) {
  const canonical = insertCanonicalInstance(detail);
  if (!canonical.ok) return canonical;

  const visual = mirrorIntoGame(detail, canonical);
  render();
  return {
    ok: true,
    itemId: detail.itemId,
    quantity: canonical.quantity,
    instanceId: canonical.key,
    containerType: canonical.containerType,
    visual
  };
}

function shopDescription(item = {}) {
  return [
    item.group,
    item.family,
    ...(item.functionalTags || []),
    ...(item.craftTags || [])
  ].filter(Boolean).join(" · ") || "Mercancía canónica de Luminous.";
}

function buildShopProvider(win) {
  const plantCatalog = win?.LuminousPlantProduceCatalog;
  const toolCatalog = win?.LuminousToolCatalog;
  const plantItems = plantCatalog?.list?.() || [];
  const toolItems = toolCatalog?.list?.() || [];
  const definitions = new Map(
    [...plantItems, ...toolItems]
      .filter(item => item?.id)
      .map(item => [String(item.id), item])
  );
  const stock = new Map();

  function makeStore(id, nombre, preferredIds, defaultStock = 4) {
    const items = preferredIds
      .map(itemId => definitions.get(itemId))
      .filter(item => item?.id && canonicalPrice(item) > 0)
      .map((definition, index) => {
        const itemId = String(definition.id);
        const qty = Math.max(1, defaultStock - Math.floor(index / 4));
        stock.set(`${id}:${itemId}`, qty);
        return {
          id: itemId,
          nombre: definition.name || definition.nombre || itemId,
          descripcion: shopDescription(definition),
          tier: 1,
          precio: canonicalPrice(definition),
          stock_actual: qty,
          icono: canonicalIcon(win, definition),
          canonical: true,
          definition
        };
      });
    return { id, nombre, items };
  }

  const stores = [
    makeStore("forest-roadside-store", "Puesto del Camino", [
      "apple",
      "carrot",
      "medicinal_herb",
      "bitterroot",
      "feverleaf",
      "calming_herb",
      "harvesting_tools",
      "herbalism_botanical_gathering_kit"
    ], 6),
    makeStore("canal-general-store", "Tienda del Canal", [
      "apple",
      "carrot",
      "cooks_utensils",
      "cartographers_tools",
      "calligraphers_supplies",
      "harvesting_tools",
      "repair_kit"
    ], 4)
  ];
  const storeById = new Map(stores.map(store => [store.id, store]));

  return {
    id: "game-engine-market",
    label: "GAME ENGINE · CANONICAL MARKET",
    async listStores() { return stores; },
    async getShop(id) {
      const store = storeById.get(String(id));
      if (!store) return null;
      store.items.forEach(item => {
        item.stock_actual = stock.get(`${store.id}:${item.id}`) ?? 0;
      });
      return store;
    },
    async getBalance() { return Number(player.wallet?.AHN || 0); },
    async purchase(shopId, itemId) {
      const store = storeById.get(String(shopId));
      if (!store) return { ok: false, message: "Tienda no disponible." };
      const item = store.items.find(entry => entry.id === String(itemId));
      const definition = definitions.get(String(itemId));
      if (!item || !definition) return { ok: false, message: "El artículo ya no está disponible." };

      const stockKey = `${store.id}:${item.id}`;
      const available = Number(stock.get(stockKey) ?? 0);
      const price = Number(item.precio || 0);
      const balance = Number(player.wallet?.AHN || 0);
      if (available <= 0) return { ok: false, message: "AGOTADO" };
      if (balance < price) return { ok: false, message: "Ahn insuficiente para esta compra." };

      stock.set(stockKey, available - 1);
      player.wallet.AHN = balance - price;
      render();

      const result = {
        ok: true,
        shopId: store.id,
        itemId: item.id,
        itemName: item.nombre,
        price,
        balance: player.wallet.AHN
      };
      engine.events.emit("shop:purchased", result);
      return result;
    }
  };
}

function attachShopProvider(win) {
  if (!win?.LuminousShop?.attachProvider) return false;
  shopProvider = buildShopProvider(win);
  win.LuminousShop.attachProvider(shopProvider);
  log("shop:provider-attached", {
    provider: shopProvider.id,
    itemIconFamilies: win.LuminousItemIconRegistry?.list?.().length || 0
  });
  return true;
}

function syncCanonicalLocationsFromGame() {
  if (!gameConnected || !mirroredDefinitionIds.size) return;
  const paper = gameWindow()?.PaperInventory;
  const state = paper?.getState?.();
  if (!state) return;

  const activeDefs = new Set(Object.values(state.active || {}).map(x => x?.definitionId).filter(Boolean));
  const stashDefs = new Set(Object.values(state.stash || {}).map(x => x?.definitionId).filter(Boolean));

  for (const [key, instance] of Object.entries({ ...(player.inventario_activo || {}) })) {
    const defId = instance?.definitionId;
    if (mirroredDefinitionIds.has(defId) && stashDefs.has(defId) && !activeDefs.has(defId)) {
      items.moveToStash(player, key);
    }
  }
  for (const [key, instance] of Object.entries({ ...(player.inventario_stash || {}) })) {
    const defId = instance?.definitionId;
    if (mirroredDefinitionIds.has(defId) && activeDefs.has(defId) && !stashDefs.has(defId)) {
      items.moveToActive(player, key);
    }
  }
  render();
}

function connectGameBridge() {
  const win = gameWindow();
  const bridge = win?.LuminousMapItemBridge;
  const paper = win?.PaperInventory;
  if (!bridge || !paper) return false;

  bridge.attachInventoryAdapter({ grantItem: grantFromGame });
  attachShopProvider(win);
  const movementBridge = win?.LuminousWorldMovementBridge;
  combatMovement.setTerrainSampler(movementBridge?.sampleTerrain
    ? (point) => movementBridge.sampleTerrain(point.x, point.z)
    : null);
  gameConnected = true;
  $("gameLoading").classList.add("off");
  log("game:bridge-connected", {
    mapBridgeVersion: bridge.version || 1,
    itemIconRegistryVersion: win.LuminousItemIconRegistry?.VERSION || null,
    plantCatalogVersion: win.LuminousPlantProduceCatalog?.VERSION || null,
    toolCatalogVersion: win.LuminousToolCatalog?.VERSION || null,
    worldMovementContract: movementBridge?.contract || WORLD_SPACE_CONTRACT.id,
    playerGridVisible: movementBridge?.grid?.playerVisible ?? WORLD_SPACE_CONTRACT.grid.playerVisible
  });
  render();

  clearInterval(syncTimer);
  syncTimer = setInterval(syncCanonicalLocationsFromGame, 600);
  return true;
}

function waitForGameBridge(attempt = 0) {
  if (connectGameBridge()) return;
  if (attempt >= 80) {
    $("gameLoading").classList.add("off");
    $("bridgeBadge").textContent = "Forest abierto · bridge pendiente";
    log("game:bridge-timeout", {});
    return;
  }
  setTimeout(() => waitForGameBridge(attempt + 1), 250);
}

function openGameInventory() {
  const paper = gameWindow()?.PaperInventory;
  if (!paper?.open) {
    log("game:inventory-unavailable", {});
    return;
  }
  paper.open();
}

async function grantHerbFromDm() {
  const bridge = gameWindow()?.LuminousMapItemBridge;
  if (!bridge?.requestGrant) {
    log("dm:grant-failed", { reason: "game_bridge_unavailable" });
    return;
  }
  const result = await bridge.requestGrant("medicinal_herb", 1, {
    source: "dm_lab",
    sourceId: "lab.toolbar"
  });
  log("dm:grant-item", result);
  render();
  setTimeout(openGameInventory, 80);
}

["engine:start", "engine:stop", "items:moved", "items:used", "items:inserted", "items:acquired-lab", "shop:purchased", "dm:player-flag"]
  .forEach(type => engine.events.on(type, payload => {
    log(type, payload);
    render();
  }));

$("openInventory").addEventListener("click", openGameInventory);
$("grantHerb").addEventListener("click", grantHerbFromDm);
async function lockLandscapeForFullscreen() {
  const orientation = screen.orientation;
  if (!orientation?.lock) {
    log("display:landscape-unavailable", { reason: "screen_orientation_api_unavailable" });
    return false;
  }
  try {
    await orientation.lock("landscape");
    log("display:landscape-locked", { type: orientation.type || "landscape" });
    return true;
  } catch (error) {
    log("display:landscape-lock-failed", { message: error?.message || String(error) });
    return false;
  }
}

async function enterGameFullscreen() {
  const stage = document.querySelector(".lab-stage");
  if (!stage?.requestFullscreen) {
    log("display:fullscreen-unavailable", {});
    return false;
  }
  try {
    await stage.requestFullscreen();
    await lockLandscapeForFullscreen();
    return true;
  } catch (error) {
    log("display:fullscreen-failed", { message: error?.message || String(error) });
    return false;
  }
}

$("fullscreenGame").addEventListener("click", enterGameFullscreen);

document.addEventListener("fullscreenchange", () => {
  const stage = document.querySelector(".lab-stage");
  if (document.fullscreenElement === stage) {
    lockLandscapeForFullscreen();
    return;
  }
  try { screen.orientation?.unlock?.(); } catch (_) {}
  log("display:fullscreen-exit", {});
});

frame.addEventListener("load", () => {
  log("game:frame-loaded", { src: frame.getAttribute("src") });
  waitForGameBridge();
});

engine.start();
render();
log("lab:ready", {
  url: location.href,
  game: "forest-0.3.3.1",
  itemRuntime: items.status()
});

window.addEventListener("beforeunload", () => {
  clearInterval(syncTimer);
  engine.dispose();
});
