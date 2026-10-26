import { MapBridgeAdapter } from "./MapBridgeAdapter.js";
import { MapRegistry } from "./MapRegistry.js";

function callMapHandler(active, name, ...args) {
  if (!active) return undefined;
  const generatedHandler = active.data?.[name];
  if (typeof generatedHandler === "function") return generatedHandler(...args, active);
  const definitionHandler = active.definition?.[name];
  if (typeof definitionHandler === "function") return definitionHandler(...args, active);
  return undefined;
}

export class MapSystem {
  constructor({ worldSpace = null, movementTracker = null, bridge = null, registry = new MapRegistry() } = {}) {
    this.worldSpace = worldSpace || null;
    this.movementTracker = movementTracker || null;
    this.bridge = bridge instanceof MapBridgeAdapter ? bridge : new MapBridgeAdapter(bridge);
    this.registry = registry;
    this.active = null;
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

  registerMap(definition, { replace = false } = {}) {
    const map = replace ? this.registry.upsert(definition) : this.registry.register(definition);
    this.engine?.events?.emit?.("map:registered", { map });
    return map;
  }

  unregisterMap(id) {
    if (this.active?.id === String(id)) this.unloadMap("unregistered");
    const removed = this.registry.unregister(id);
    if (removed) this.engine?.events?.emit?.("map:unregistered", { id: String(id) });
    return removed;
  }

  activateMap(id, data = null, { source = "module" } = {}) {
    const definition = this.registry.get(id);
    if (!definition) throw new Error(`Unknown map: ${id}`);
    if (this.active?.id && this.active.id !== definition.id) this.unloadMap("replaced");

    this.active = {
      id: definition.id,
      definition,
      data: data || null,
      source,
      loadedAt: Date.now()
    };
    this.#syncMovementSampler();
    this.bridge.presentMap(this.presentationSnapshot());
    this.engine?.events?.emit?.("map:activated", { map: this.snapshot() });
    return this.active;
  }

  async loadMap(id, context = {}) {
    const definition = this.registry.get(id);
    if (!definition) throw new Error(`Unknown map: ${id}`);
    const generated = definition.generate
      ? await definition.generate({
          engine: this.engine,
          mapSystem: this,
          worldSpace: this.worldSpace,
          definition,
          ...context
        })
      : null;
    return this.activateMap(id, generated, { source: "module" });
  }

  adoptViewMap({ id, metadata = {} } = {}) {
    const mapId = String(id || this.bridge.activeMapId() || "legacy-view-map");
    if (!this.registry.has(mapId)) {
      this.registerMap({ id: mapId, kind: "legacy-view", metadata: { ...metadata, legacyView: true } });
    }
    return this.activateMap(mapId, null, { source: "view-bridge" });
  }

  unloadMap(reason = "unloaded") {
    if (!this.active) return false;
    const previous = this.active;
    try {
      callMapHandler(previous, "dispose", { reason, engine: this.engine, mapSystem: this });
    } finally {
      this.active = null;
      this.bridge.clearMap({ id: previous.id, reason });
      this.#syncMovementSampler();
      this.engine?.events?.emit?.("map:unloaded", { id: previous.id, reason });
    }
    return true;
  }

  attachBridge(bridge) {
    this.bridge = bridge instanceof MapBridgeAdapter ? bridge : new MapBridgeAdapter(bridge);
    this.#syncMovementSampler();
    if (this.active) this.bridge.presentMap(this.presentationSnapshot());
    this.engine?.events?.emit?.("map:bridge-attached", this.snapshot());
    return this.bridge;
  }

  detachBridge() {
    this.bridge = new MapBridgeAdapter();
    this.#syncMovementSampler();
  }

  #syncMovementSampler() {
    const hasModuleTerrain = Boolean(this.active && (
      typeof this.active.data?.sampleTerrain === "function" ||
      typeof this.active.definition?.sampleTerrain === "function"
    ));
    const hasLegacyTerrain = Boolean(this.bridge?.bridge?.sampleTerrain);
    this.movementTracker?.setTerrainSampler?.(
      hasModuleTerrain || hasLegacyTerrain ? point => this.sampleTerrain(point) : null
    );
  }

  activeMapId() {
    return this.active?.id || this.bridge.activeMapId();
  }

  sampleTerrain(point) {
    const moduleSample = callMapHandler(this.active, "sampleTerrain", point);
    return moduleSample !== undefined ? moduleSample : this.bridge.sampleTerrain(point);
  }

  sampleWater(point) {
    const moduleSample = callMapHandler(this.active, "sampleWater", point);
    if (moduleSample !== undefined) return moduleSample;
    const terrainWater = this.sampleTerrain(point)?.water;
    return terrainWater !== undefined ? terrainWater : this.bridge.sampleWater(point);
  }

  resolveMovement(unit, from, proposed, dt) {
    const moduleResolved = callMapHandler(this.active, "resolveMovement", { unit, from, proposed, dt });
    return moduleResolved !== undefined
      ? moduleResolved
      : this.bridge.resolveMovement(unit, from, proposed, dt);
  }

  update(dt) {
    if (!this.enabled) return;
    callMapHandler(this.active, "update", { dt, engine: this.engine, mapSystem: this });
    if (this.active) this.bridge.updateMap({ dt, map: this.presentationSnapshot() });
    this.engine?.events?.emit?.("map:updated", { dt, mapId: this.activeMapId() });
  }

  presentationSnapshot() {
    if (!this.active) return null;
    return {
      id: this.active.id,
      kind: this.active.definition.kind,
      seed: this.active.definition.seed,
      bounds: this.active.definition.bounds,
      metadata: { ...this.active.definition.metadata },
      source: this.active.source,
      data: this.active.data
    };
  }

  snapshot() {
    return {
      worldSpace: this.worldSpace?.id || this.worldSpace || null,
      mapId: this.activeMapId(),
      authority: this.active?.source || (this.bridge.available() ? "view-bridge" : null),
      registeredMaps: this.registry.list().map(map => map.id),
      active: this.active ? {
        id: this.active.id,
        kind: this.active.definition.kind,
        source: this.active.source,
        seed: this.active.definition.seed,
        metadata: { ...this.active.definition.metadata }
      } : null,
      bridge: this.bridge.snapshot()
    };
  }

  dispose() {
    this.movementTracker?.setTerrainSampler?.(null);
    this.unloadMap("disposed");
    this.detachBridge();
    this.registry.clear();
    this.engine = null;
  }
}
