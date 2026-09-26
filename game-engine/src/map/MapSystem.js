import { MapBridgeAdapter } from "./MapBridgeAdapter.js";

export class MapSystem {
  constructor({ worldSpace = null, movementTracker = null, bridge = null } = {}) {
    this.worldSpace = worldSpace || null;
    this.movementTracker = movementTracker || null;
    this.bridge = bridge instanceof MapBridgeAdapter ? bridge : new MapBridgeAdapter(bridge);
    this.engine = null;
    this.enabled = true;
  }

  install(engine) {
    this.engine = engine;
    this.#syncMovementSampler();
  }

  enable() {
    this.enabled = true;
  }

  disable() {
    this.enabled = false;
  }

  attachBridge(bridge) {
    this.bridge = bridge instanceof MapBridgeAdapter ? bridge : new MapBridgeAdapter(bridge);
    this.#syncMovementSampler();
    this.engine?.events?.emit?.("map:bridge-attached", this.snapshot());
    return this.bridge;
  }

  detachBridge() {
    this.bridge = new MapBridgeAdapter();
    this.#syncMovementSampler();
  }

  #syncMovementSampler() {
    this.movementTracker?.setTerrainSampler?.(
      this.bridge?.bridge?.sampleTerrain
        ? point => this.sampleTerrain(point)
        : null
    );
  }

  activeMapId() {
    return this.bridge.activeMapId();
  }

  sampleTerrain(point) {
    return this.bridge.sampleTerrain(point);
  }

  sampleWater(point) {
    return this.bridge.sampleWater(point);
  }

  resolveMovement(unit, from, proposed, dt) {
    return this.bridge.resolveMovement(unit, from, proposed, dt);
  }

  update(dt) {
    if (!this.enabled) return;
    this.engine?.events?.emit?.("map:updated", { dt, mapId: this.activeMapId() });
  }

  snapshot() {
    return {
      worldSpace: this.worldSpace?.id || this.worldSpace || null,
      ...this.bridge.snapshot()
    };
  }

  dispose() {
    this.movementTracker?.setTerrainSampler?.(null);
    this.detachBridge();
    this.engine = null;
  }
}
