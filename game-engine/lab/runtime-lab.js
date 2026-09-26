import { GameEngine } from "../src/core/GameEngine.js";
import { GameRuntime } from "../src/core/GameRuntime.js";
import { normalizeProceduralMapSpec } from "../src/map/procedural/ProceduralMapSpec.js";
import { HudDomAdapter } from "../src/ui/HudDomAdapter.js";
import { createHudViewModel } from "../src/ui/HudViewModel.js";

const engine = new GameEngine();
const runtime = new GameRuntime({ engine }).mount();
const hud = new HudDomAdapter({ root: document });
const pressed = new Set();

const mapSpec = normalizeProceduralMapSpec({
  id: "module-lab-temperate-hills",
  kind: "procedural-biome",
  seed: "module-lab-temperate-hills-v1",
  bounds: { minX: -48, maxX: 48, minZ: -48, maxZ: 48 },
  altitude: 2.6,
  moisture: 0.78,
  aridity: 0.12,
  scale: 1,
  biome: "colinas templadas",
  biomeProfile: "temperate",
  landform: { hills: 0.72, rolling: 0.32, ridges: 0.18 },
  hydrology: { type: "river" },
  metadata: {
    purpose: "module-only-lab",
    legacyForestDependency: false
  }
});

function axis(positive, negative) {
  return Number(pressed.has(positive)) - Number(pressed.has(negative));
}

runtime.registerProceduralMap(mapSpec);
await runtime.loadMap(mapSpec.id);

const player = runtime.registerUnit({
  id: "module-lab-player",
  role: "player",
  tags: ["player", "lab"],
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
  metadata: { source: "module-only-lab" }
}, { cameraTarget: true });

function render() {
  return hud.render(createHudViewModel({ engine, runtime, unitId: player.id }));
}

function normalizeKey(event) {
  return event.code || event.key;
}

window.addEventListener("keydown", event => {
  pressed.add(normalizeKey(event));
  if (event.code?.startsWith("Arrow")) event.preventDefault();
});
window.addEventListener("keyup", event => pressed.delete(normalizeKey(event)));
window.addEventListener("blur", () => pressed.clear());

engine.start();
render();
const renderTimer = window.setInterval(render, 100);

window.addEventListener("beforeunload", () => {
  window.clearInterval(renderTimer);
  engine.dispose("module-lab-unload");
});

globalThis.LuminousRuntimeLab = Object.freeze({
  engine,
  runtime,
  player,
  mapSpec,
  hud,
  snapshot() {
    return createHudViewModel({ engine, runtime, unitId: player.id });
  },
  dispose() {
    window.clearInterval(renderTimer);
    engine.dispose("module-lab-dispose");
  }
});
