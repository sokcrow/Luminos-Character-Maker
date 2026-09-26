import { GameEngine } from "../src/core/GameEngine.js";
import { GameRuntime } from "../src/core/GameRuntime.js";
import { runtimeContractsSnapshot } from "../src/core/RuntimeContracts.js";
import { normalizeProceduralMapSpec } from "../src/map/procedural/ProceduralMapSpec.js";
import { HudDomAdapter } from "../src/ui/HudDomAdapter.js";
import { createHudViewModel } from "../src/ui/HudViewModel.js";
import { InventoryEquipmentDomAdapter } from "../src/ui/InventoryEquipmentDomAdapter.js";
import { createInventoryEquipmentViewModel } from "../src/ui/InventoryEquipmentViewModel.js";
import { ThreeVisualizer } from "./ThreeVisualizer.js";

const engine = new GameEngine();
const runtime = new GameRuntime({ engine }).mount();
const hud = new HudDomAdapter({ root: document });
const pressed = new Set();
const viewport = document.getElementById("visualizerViewport");
const rendererStatus = document.querySelector("[data-renderer-status]");
const inventoryPanelRoot = document.querySelector("[data-inventory-panel]");
const inventoryEvent = document.querySelector("[data-inventory-event]");
const inventoryToggle = document.querySelector("[data-inventory-toggle]");
const inventoryClose = document.querySelector("[data-inventory-close]");

const inventoryRuntime = globalThis.LuminousItemInventoryRuntime;
const equipmentBridge = globalThis.LuminousItemEquipmentBridge;
const anatomyEngine = globalThis.LuminousAnatomyEquipmentEngine;
const iconRegistry = globalThis.LuminousItemIconRegistry;

if (!inventoryRuntime || !equipmentBridge || !anatomyEngine) {
  throw new Error("Inventory/equipment runtime modules are required by the Early Alpha visualizer");
}

const mapSpec = normalizeProceduralMapSpec({
  id: "early-alpha-temperate-hills",
  kind: "procedural-biome",
  seed: "early-alpha-temperate-hills-v1",
  bounds: { minX: -64, maxX: 64, minZ: -64, maxZ: 64 },
  altitude: 2.6,
  moisture: 0.78,
  aridity: 0.12,
  scale: 1,
  biome: "colinas templadas",
  biomeProfile: "temperate",
  landform: { hills: 0.72, rolling: 0.32, ridges: 0.18 },
  hydrology: { type: "river" },
  metadata: {
    stage: "early-alpha",
    visualizer: true,
    legacyForestDependency: false
  }
});

function axis(positive, negative) {
  return Number(pressed.has(positive)) - Number(pressed.has(negative));
}

runtime.registerProceduralMap(mapSpec);
await runtime.loadMap(mapSpec.id);
const spawn = runtime.map.sampleTerrain({ x: 0, z: 0 }) || { height: 0 };

const player = runtime.registerUnit({
  id: "early-alpha-player",
  role: "player",
  tags: ["player", "early-alpha"],
  transform: { x: 0, y: Number(spawn.height) || 0, z: 0 },
  movement: { speed: 8, maxSpeed: 8 },
  controller: {
    resolveIntent() {
      return {
        moveX: axis("KeyD", "KeyA") + axis("ArrowRight", "ArrowLeft"),
        moveZ: axis("KeyS", "KeyW") + axis("ArrowDown", "ArrowUp")
      };
    }
  },
  metadata: { stage: "early-alpha" }
}, { cameraTarget: true });

player.anatomyRuntime = anatomyEngine.createHumanoidAnatomy();
player.inventario_activo = {};
player.inventario_stash = {};
player.equipment = { accessories: [] };
player.inventoryRules = { activeSlotLimit: 20, stashSlotLimit: 80 };

function sampleItem({ instanceId, definitionId, name, category, icon, quantity = 1, equipment = null }) {
  return {
    schemaVersion: inventoryRuntime.schemaVersion,
    instanceId,
    definitionId,
    name,
    displayName: name,
    category,
    itemType: category,
    quantity,
    conditionMax: 100,
    condition: 100,
    qualityTier: 1,
    equipped: false,
    icon,
    equipment: equipment || undefined
  };
}

function seedInventory() {
  const active = inventoryRuntime.describeInventory(player);
  if ((active.activeSlots || 0) + (active.stashSlots || 0) > 0) return;

  const items = [
    sampleItem({
      instanceId: "alpha_sword_01",
      definitionId: "weapon_sword",
      name: "Espada de prueba",
      category: "weapon",
      icon: "../../Assets/Icons/items/equipment/weapon_melee.png",
      equipment: { kind: "weapon", handCost: 1 }
    }),
    sampleItem({
      instanceId: "alpha_shield_01",
      definitionId: "shield_round",
      name: "Escudo de prueba",
      category: "shield",
      icon: "../../Assets/Icons/items/equipment/shield_round.png",
      equipment: { kind: "shield", handCost: 1 }
    }),
    sampleItem({
      instanceId: "alpha_armor_01",
      definitionId: "armor_light",
      name: "Armadura ligera",
      category: "armor",
      icon: "../../Assets/Icons/items/equipment/armor_light.png",
      equipment: { kind: "armor" }
    }),
    sampleItem({
      instanceId: "alpha_ration_01",
      definitionId: "ration",
      name: "Raciones",
      category: "consumable",
      icon: "../../Assets/Icons/items/consumable/ration.png",
      quantity: 3
    })
  ];

  items.forEach(item => inventoryRuntime.insertItem(player, item, "active"));
  inventoryRuntime.insertItem(player, sampleItem({
    instanceId: "alpha_pie_01",
    definitionId: "apple_pie",
    name: "Pay de manzana",
    category: "consumable",
    icon: "../../Assets/Icons/items/consumable/apple_pie.png",
    quantity: 2
  }), "stash");
}

seedInventory();

function setInventoryMessage(message, ok = true) {
  if (!inventoryEvent) return;
  inventoryEvent.textContent = message;
  inventoryEvent.style.color = ok ? "#b7d7c3" : "#f0b3b3";
}

function renderInventory() {
  const model = createInventoryEquipmentViewModel({
    unit: player,
    inventoryRuntime,
    equipmentBridge,
    iconRegistry
  });
  inventoryAdapter.render(model);
  return model;
}

const inventoryAdapter = new InventoryEquipmentDomAdapter({
  root: inventoryPanelRoot,
  onAction(action) {
    let result = null;
    if (action.action === "equip") {
      result = equipmentBridge.equipTo(player, action.instanceId, action.slot);
      setInventoryMessage(result.equipped ? `Equipado: ${action.slot}` : `No se pudo equipar: ${result.reason || "error"}`, result.equipped);
    } else if (action.action === "unequip") {
      result = equipmentBridge.unequipSlot(player, action.slot);
      setInventoryMessage(result.unequipped ? `Desequipado: ${action.slot}` : `No se pudo quitar: ${result.reason || "error"}`, result.unequipped);
    } else if (action.action === "stash") {
      result = equipmentBridge.moveItem(player, action.instanceId, "active", "stash");
      setInventoryMessage(result.moved ? "Movido al alijo" : `No se pudo mover: ${result.reason || "error"}`, result.moved);
    } else if (action.action === "active") {
      result = equipmentBridge.moveItem(player, action.instanceId, "stash", "active");
      setInventoryMessage(result.moved ? "Movido al inventario activo" : `No se pudo mover: ${result.reason || "error"}`, result.moved);
    }
    renderInventory();
  }
});

function setInventoryOpen(open) {
  if (!inventoryPanelRoot) return;
  inventoryPanelRoot.hidden = !open;
  inventoryToggle?.setAttribute("aria-expanded", String(open));
}

inventoryToggle?.addEventListener("click", () => setInventoryOpen(inventoryPanelRoot?.hidden));
inventoryClose?.addEventListener("click", () => setInventoryOpen(false));
setInventoryOpen(true);

const visualizer = new ThreeVisualizer({ root: viewport, runtime, player });
try {
  await visualizer.mount();
  if (rendererStatus) rendererStatus.textContent = "Renderer 3D activo · mapa procedural modular";
} catch (error) {
  console.error("ThreeVisualizer mount failed", error);
  if (rendererStatus) rendererStatus.textContent = `Renderer 3D no disponible: ${error?.message || error}`;
  viewport?.setAttribute("data-renderer-error", "true");
}

function renderHud() {
  const model = createHudViewModel({ engine, runtime, unitId: player.id });
  hud.render(model);
  return model;
}

function key(event) {
  return event.code || event.key;
}

function isMovementKey(event) {
  return ["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowLeft", "ArrowDown", "ArrowRight"].includes(key(event));
}

window.addEventListener("keydown", event => {
  if (key(event) === "KeyI") {
    setInventoryOpen(inventoryPanelRoot?.hidden);
    event.preventDefault();
    return;
  }
  if (!isMovementKey(event)) return;
  pressed.add(key(event));
  event.preventDefault();
});
window.addEventListener("keyup", event => {
  if (!isMovementKey(event)) return;
  pressed.delete(key(event));
  event.preventDefault();
});
window.addEventListener("blur", () => pressed.clear());

engine.start();
renderHud();
renderInventory();
const hudTimer = window.setInterval(renderHud, 100);
const inventoryTimer = window.setInterval(renderInventory, 300);

function dispose(reason = "visualizer-dispose") {
  window.clearInterval(hudTimer);
  window.clearInterval(inventoryTimer);
  inventoryAdapter.dispose();
  visualizer.dispose();
  engine.dispose(reason);
}

window.addEventListener("beforeunload", () => dispose("visualizer-unload"));

globalThis.LuminousVisualizer = Object.freeze({
  engine,
  runtime,
  player,
  mapSpec,
  visualizer,
  inventoryRuntime,
  equipmentBridge,
  inventorySnapshot: renderInventory,
  contracts: runtimeContractsSnapshot(),
  snapshot: renderHud,
  dispose
});
