export class MapBridgeAdapter {
  constructor(bridge = null) {
    this.bridge = bridge || null;
  }

  available() {
    return Boolean(this.bridge);
  }

  contractId() {
    return this.bridge?.contract || null;
  }

  activeMapId() {
    return this.bridge?.mapId?.() ?? this.bridge?.activeMapId?.() ?? this.bridge?.currentMapId ?? null;
  }

  sampleTerrain(point = {}) {
    if (!this.bridge?.sampleTerrain) return null;
    return this.bridge.sampleTerrain(Number(point.x) || 0, Number(point.z) || 0);
  }

  sampleWater(point = {}) {
    if (this.bridge?.sampleWater) {
      return this.bridge.sampleWater(Number(point.x) || 0, Number(point.z) || 0);
    }
    return this.sampleTerrain(point)?.water || null;
  }

  resolveMovement(unit, from, proposed, dt) {
    if (this.bridge?.resolveMovement) {
      return this.bridge.resolveMovement({ unit, from, proposed, dt }) || proposed;
    }
    return proposed;
  }

  snapshot() {
    return {
      available: this.available(),
      contract: this.contractId(),
      mapId: this.activeMapId(),
      grid: this.bridge?.grid || null,
      cameraProfile: this.bridge?.cameraProfile || null
    };
  }
}
