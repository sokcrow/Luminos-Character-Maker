import { GameEngine } from "../src/core/GameEngine.js";
import { GameRuntime } from "../src/core/GameRuntime.js";
import { runtimeContractsSnapshot } from "../src/core/RuntimeContracts.js";
import { normalizeProceduralMapSpec } from "../src/map/procedural/ProceduralMapSpec.js";
import { HudDomAdapter } from "../src/ui/HudDomAdapter.js";
import { createHudViewModel } from "../src/ui/HudViewModel.js";
import { ThreeVisualizer } from "./ThreeVisualizer.js";

const engine = new GameEngine();
const runtime = new GameRuntime({ engine }).mount();
const hud = new HudDomAdapter({ root: document });
const pressed = new Set();
const viewport = document.getElementById("visualizerViewport");
const rendererStatus = document.querySelector("[data-renderer-status]");

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
const hudTimer = window.setInterval(renderHud, 100);

function dispose(reason = "visualizer-dispose") {
  window.clearInterval(hudTimer);
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
  contracts: runtimeContractsSnapshot(),
  snapshot: renderHud,
  dispose
});
