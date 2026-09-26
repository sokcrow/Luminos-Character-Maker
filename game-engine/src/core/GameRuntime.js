import { MapSystem } from "../map/MapSystem.js";
import { MapBridgeAdapter } from "../map/MapBridgeAdapter.js";
import { UnitRuntime } from "../units/UnitRuntime.js";
import { CameraSystem } from "../camera/CameraSystem.js";
import { CameraBridgeAdapter } from "../camera/CameraBridgeAdapter.js";

export class GameRuntime {
  constructor({ engine, worldSpace = null, movementTracker = null } = {}) {
    if (!engine) throw new Error("GameRuntime requires a GameEngine instance");
    this.engine = engine;
    this.map = new MapSystem({ worldSpace, movementTracker });
    this.units = new UnitRuntime({ mapSystem: this.map });
    this.camera = new CameraSystem({ unitRuntime: this.units });
    this.mounted = false;
    this.viewWindow = null;
  }

  mount() {
    if (this.mounted) return this;
    this.engine.registerSystem("map", this.map);
    this.engine.registerSystem("units", this.units);
    this.engine.registerSystem("camera", this.camera);
    this.engine.session.runtime = this;
    this.mounted = true;
    return this;
  }

  connectView(viewWindow) {
    this.viewWindow = viewWindow || null;
    const movementBridge = this.viewWindow?.LuminousWorldMovementBridge || null;
    this.map.attachBridge(new MapBridgeAdapter(movementBridge));
    this.camera.attachBridge(new CameraBridgeAdapter(movementBridge));

    if (!this.map.active && movementBridge) {
      this.map.adoptViewMap({
        id: this.map.bridge.activeMapId() || "legacy-forest-view",
        metadata: {
          contract: this.map.bridge.contractId(),
          adoptedBy: "GameRuntime.connectView"
        }
      });
    }

    this.engine.events.emit("runtime:view-connected", this.snapshot());
    return this.snapshot();
  }

  disconnectView() {
    this.viewWindow = null;
    this.map.detachBridge();
    this.camera.attachBridge(new CameraBridgeAdapter());
    this.engine.events.emit("runtime:view-disconnected", this.snapshot());
  }

  registerMap(definition, options) {
    return this.map.registerMap(definition, options);
  }

  activateMap(id, data, options) {
    return this.map.activateMap(id, data, options);
  }

  loadMap(id, context) {
    return this.map.loadMap(id, context);
  }

  registerUnit(spec, { cameraTarget = false } = {}) {
    const unit = this.units.register(spec);
    if (cameraTarget) this.camera.setTargetUnit(unit.id);
    return unit;
  }

  snapshot() {
    return {
      mounted: this.mounted,
      connected: Boolean(this.viewWindow),
      map: this.map.snapshot(),
      units: this.units.snapshot(),
      camera: this.camera.snapshot()
    };
  }
}
