import { GameEngine } from "../src/core/GameEngine.js";
import { DMDirector } from "../src/dm/DMDirector.js";
import { createLabPlayer } from "../src/player/createLabPlayer.js";
import { LuminousItemsBridge } from "../src/bridges/luminous/LuminousItemsBridge.js";

const engine = new GameEngine();
const player = createLabPlayer();
const items = engine.registerBridge("luminous-items", new LuminousItemsBridge());
const dm = new DMDirector(engine);
engine.session.dm = dm;
engine.setPlayer(player);

const $ = (id) => document.getElementById(id);
const frame = $("gameFrame");
const mirroredDefinitionIds = new Set();
const eventLines = [];
let gameConnected = false;
let syncTimer = null;
let shopProvider = null;

function log(type, payload = {}) {
  eventLines.unshift(`${new Date().toLocaleTimeString()}  ${type}\n${JSON.stringify(payload, null, 2)}`);
  eventLines.splice(24);
  $("eventLog").textContent = eventLines.join("\n\n");
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

  $("engineSummary").textContent = metrics.running
    ? `ACTIVO · ${metrics.systemsEnabled} sistemas · ${metrics.frames} frames`
    : "DETENIDO";
  $("itemSummary").textContent = status.available
    ? `LISTO · schema ${status.inventorySchemaVersion} · runtime ${status.inventoryVersion}`
    : "NO DISPONIBLE";
  $("bridgeSummary").textContent = gameConnected ? "CONECTADO · Forest ↔ Game Engine" : "ESPERANDO FOREST";
  $("playerSummary").textContent = `${player.name || player.id} · ${activeCount} activos · ${stashCount} stash`;

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
    iconOverride: item.icon || item.iconUrl || item.icono || ""
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
    icon: icon || "box"
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

  const chosen = [
    ...plantItems.filter(item => item?.id && canonicalPrice(item) > 0).slice(0, 10),
    ...toolItems.filter(item => item?.id && canonicalPrice(item) > 0).slice(0, 5)
  ];

  const stock = new Map();
  const definitions = new Map();
  const storeItems = chosen.map((definition, index) => {
    const id = String(definition.id);
    const qty = index < 10 ? 6 : 2;
    stock.set(id, qty);
    definitions.set(id, definition);
    return {
      id,
      nombre: definition.name || definition.nombre || id,
      descripcion: shopDescription(definition),
      tier: 1,
      precio: canonicalPrice(definition),
      stock_actual: qty,
      icono: canonicalIcon(win, definition),
      canonical: true,
      definition
    };
  });

  const store = {
    id: "forest-roadside-store",
    nombre: "Puesto del Camino",
    items: storeItems
  };

  return {
    id: "game-engine-market",
    label: "GAME ENGINE · CANONICAL MARKET",
    async listStores() { return [store]; },
    async getShop(id) {
      if (String(id) !== store.id) return null;
      store.items.forEach(item => { item.stock_actual = stock.get(item.id) ?? 0; });
      return store;
    },
    async getBalance() { return Number(player.wallet?.AHN || 0); },
    async purchase(shopId, itemId) {
      if (String(shopId) !== store.id) return { ok: false, message: "Tienda no disponible." };
      const item = store.items.find(entry => entry.id === String(itemId));
      const definition = definitions.get(String(itemId));
      if (!item || !definition) return { ok: false, message: "El artículo ya no está disponible." };

      const available = Number(stock.get(item.id) ?? 0);
      const price = Number(item.precio || 0);
      const balance = Number(player.wallet?.AHN || 0);
      if (available <= 0) return { ok: false, message: "AGOTADO" };
      if (balance < price) return { ok: false, message: "Ahn insuficiente para esta compra." };

      stock.set(item.id, available - 1);
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
  gameConnected = true;
  $("gameLoading").classList.add("off");
  log("game:bridge-connected", {
    mapBridgeVersion: bridge.version || 1,
    itemIconRegistryVersion: win.LuminousItemIconRegistry?.VERSION || null,
    plantCatalogVersion: win.LuminousPlantProduceCatalog?.VERSION || null,
    toolCatalogVersion: win.LuminousToolCatalog?.VERSION || null
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

async function openGameShop() {
  const shop = gameWindow()?.LuminousShop;
  if (!shop?.open) {
    log("game:shop-unavailable", {});
    return;
  }
  try {
    await shop.open("forest-roadside-store");
  } catch (error) {
    log("game:shop-open-error", { message: error?.message || String(error) });
  }
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

function setDebug(open) {
  $("debugDrawer").classList.toggle("open", open);
  $("debugDrawer").setAttribute("aria-hidden", String(!open));
  $("toggleDebug").setAttribute("aria-expanded", String(open));
}

["engine:start", "engine:stop", "items:moved", "items:used", "items:inserted", "items:acquired-lab", "shop:purchased", "dm:player-flag"]
  .forEach(type => engine.events.on(type, payload => {
    log(type, payload);
    render();
  }));

$("openInventory").addEventListener("click", openGameInventory);
$("openShop").addEventListener("click", openGameShop);
$("grantHerb").addEventListener("click", grantHerbFromDm);
$("toggleDebug").addEventListener("click", () => setDebug(!$("debugDrawer").classList.contains("open")));
$("closeDebug").addEventListener("click", () => setDebug(false));
$("inspectPlayer").addEventListener("click", () => {
  $("dmState").textContent = JSON.stringify(dm.execute({ type: "inspect_player" }), null, 2);
});
$("fullscreenGame").addEventListener("click", async () => {
  const stage = document.querySelector(".lab-stage");
  try { await stage?.requestFullscreen?.(); } catch (_) {}
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
