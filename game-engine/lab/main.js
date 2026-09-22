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

  $("runtimeDot").classList.toggle("on", metrics.running);
  $("runtimeLabel").textContent = metrics.running ? `Engine activo · ${metrics.frames} frames` : "Engine detenido";
  $("inventoryBadge").textContent = `Inventario ${activeCount} · Stash ${stashCount}`;
  $("walletBadge").textContent = `₳${Number(player.wallet?.AHN || 0).toLocaleString("es-MX")}`;

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

function normalizeVisualDefinition(detail) {
  const item = detail?.item || {};
  return {
    id: String(detail?.itemId || item.id || "unknown_item"),
    name: item.name || item.nombre || detail?.itemId || "Item",
    tier: "I",
    value: Number(item.standardUnitValueAhn || item.priceAhn || 0),
    category: item.category === "consumable" ? "consumable" : "utility",
    tags: [
      item.family,
      item.group,
      ...(item.functionalTags || []),
      ...(item.craftTags || [])
    ].filter(Boolean),
    quality: "STANDARD",
    description: [
      item.group,
      ...(item.functionalTags || []),
      ...(item.craftTags || [])
    ].filter(Boolean).join(" · ") || "Objeto canónico de Luminous.",
    icon: "box"
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
  const key = instance.instanceId || `game_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  instance.instanceId = key;
  player.inventario_activo[key] = instance;

  engine.events.emit("items:acquired-lab", {
    source: detail.source || "game",
    itemId: detail.itemId || instance.definitionId,
    quantity,
    instanceId: key
  });
  return { ok: true, key, instance, quantity };
}

function mirrorIntoGame(detail, canonical) {
  const win = gameWindow();
  const paper = win?.PaperInventory;
  if (!paper) return { added: false, reason: "paper_inventory_unavailable" };

  const visualDef = normalizeVisualDefinition(detail);
  paper.registerDefinition(visualDef);
  mirroredDefinitionIds.add(visualDef.id);

  let visual = paper.addItem(visualDef.id, canonical.quantity, "active");
  let destination = "active";
  if (!visual?.added) {
    visual = paper.addItem(visualDef.id, canonical.quantity, "stash");
    destination = "stash";
  }

  if (destination === "stash" && visual?.added) {
    items.moveToStash(player, canonical.key);
  }
  return { ...visual, destination };
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
    visual
  };
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
  gameConnected = true;
  $("gameLoading").classList.add("off");
  log("game:bridge-connected", { mapBridgeVersion: bridge.version || 1 });
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

function setDebug(open) {
  $("debugDrawer").classList.toggle("open", open);
  $("debugDrawer").setAttribute("aria-hidden", String(!open));
  $("toggleDebug").setAttribute("aria-expanded", String(open));
}

["engine:start", "engine:stop", "items:moved", "items:used", "items:acquired-lab", "dm:player-flag"]
  .forEach(type => engine.events.on(type, payload => {
    log(type, payload);
    render();
  }));

$("openInventory").addEventListener("click", openGameInventory);
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
