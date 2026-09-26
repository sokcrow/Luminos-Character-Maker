import { GameEngine } from "../src/core/GameEngine.js";
import { GameRuntime } from "../src/core/GameRuntime.js";

const engine = new GameEngine();
const runtime = new GameRuntime({ engine }).mount();
const pressed = new Set();

const mapSpec = {
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
};

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

function runtimeView() {
  const snapshot = runtime.snapshot();
  const terrain = runtime.map.sampleTerrain(player.transform);
  const water = runtime.map.sampleWater(player.transform);
  return {
    engine: engine.metrics(),
    architecture: {
      legacyForestLoaded: false,
      viewBridgeConnected: snapshot.connected,
      mapAuthority: snapshot.map.authority,
      mapId: snapshot.map.mapId,
      mapGenerator: snapshot.map.active?.metadata?.generator || null,
      unitStateContract: player.stateContract,
      cameraTargetUnitId: snapshot.camera.targetUnitId
    },
    player: {
      x: Number(player.transform.x.toFixed(3)),
      y: Number(player.transform.y.toFixed(3)),
      z: Number(player.transform.z.toFixed(3)),
      locomotion: player.state?.locomotion || null,
      terrain: terrain ? {
        height: Number(terrain.height?.toFixed?.(3) ?? terrain.height ?? 0),
        slopeBand: terrain.slopeBand || null,
        moveMultiplier: terrain.moveMultiplier ?? null
      } : null,
      water: water ? {
        type: water.type,
        depth: water.depth,
        source: water.source
      } : null
    }
  };
}

function render() {
  const state = runtimeView();
  const status = document.getElementById("runtimeStatus");
  const output = document.getElementById("runtimeState");
  if (status) {
    status.textContent = state.engine.running
      ? `Runtime activo · ${state.architecture.mapAuthority || "sin mapa"}`
      : "Runtime detenido";
  }
  if (output) output.textContent = JSON.stringify(state, null, 2);
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
  snapshot: runtimeView,
  dispose() {
    window.clearInterval(renderTimer);
    engine.dispose("module-lab-dispose");
  }
});
