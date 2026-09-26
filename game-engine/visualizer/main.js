import { GameEngine } from "../src/core/GameEngine.js";
import { GameRuntime } from "../src/core/GameRuntime.js";
import { runtimeContractsSnapshot } from "../src/core/RuntimeContracts.js";
import { normalizeProceduralMapSpec } from "../src/map/procedural/ProceduralMapSpec.js";
import { HudDomAdapter } from "../src/ui/HudDomAdapter.js";
import { createHudViewModel } from "../src/ui/HudViewModel.js";

const engine = new GameEngine();
const runtime = new GameRuntime({ engine }).mount();
const hud = new HudDomAdapter({ root: document });
const pressed = new Set();

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

const player = runtime.registerUnit({
  id: "early-alpha-player",
  role: "player",
  tags: ["player", "early-alpha"],
  transform: { x: 0, y: 0, z: 0 },
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

function renderHud() {
  const model = createHudViewModel({ engine, runtime, unitId: player.id });
  hud.render(model);
  return model;
}

function key(event) {
  return event.code || event.key;
}

window.addEventListener("keydown", event => {
  pressed.add(key(event));
  if (event.code?.startsWith("Arrow")) event.preventDefault();
});
window.addEventListener("keyup", event => pressed.delete(key(event)));
window.addEventListener("blur", () => pressed.clear());

engine.start();
renderHud();
const hudTimer = window.setInterval(renderHud, 100);

function dispose(reason = "visualizer-dispose") {
  window.clearInterval(hudTimer);
  engine.dispose(reason);
}

window.addEventListener("beforeunload", () => dispose("visualizer-unload"));

globalThis.LuminousVisualizer = Object.freeze({
  engine,
  runtime,
  player,
  mapSpec,
  contracts: runtimeContractsSnapshot(),
  snapshot: renderHud,
  dispose
});
