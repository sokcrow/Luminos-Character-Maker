import { CameraBridgeAdapter } from "./CameraBridgeAdapter.js";
import { resolveCameraProfile } from "./CameraProfiles.js";

export class CameraSystem {
  constructor({ unitRuntime = null, profile = "localFixed", bridge = null } = {}) {
    this.unitRuntime = unitRuntime || null;
    this.profile = resolveCameraProfile(profile);
    this.bridge = bridge instanceof CameraBridgeAdapter ? bridge : new CameraBridgeAdapter(bridge);
    this.targetUnitId = null;
    this.engine = null;
    this.enabled = true;
  }

  install(engine) {
    this.engine = engine;
  }

  enable() {
    this.enabled = true;
  }

  disable() {
    this.enabled = false;
  }

  setUnitRuntime(unitRuntime) {
    this.unitRuntime = unitRuntime || null;
    return this;
  }

  setProfile(profile) {
    this.profile = resolveCameraProfile(profile);
    this.engine?.events?.emit?.("camera:profile-changed", { profile: this.profile });
    return this.profile;
  }

  setTargetUnit(id) {
    this.targetUnitId = id == null ? null : String(id);
    const target = this.targetUnitId ? this.unitRuntime?.get?.(this.targetUnitId) : null;
    this.bridge.follow(target?.transform || null, this.profile);
    this.engine?.events?.emit?.("camera:target-changed", { unitId: this.targetUnitId });
    return target;
  }

  attachBridge(bridge) {
    this.bridge = bridge instanceof CameraBridgeAdapter ? bridge : new CameraBridgeAdapter(bridge);
    if (this.targetUnitId) this.setTargetUnit(this.targetUnitId);
    this.engine?.events?.emit?.("camera:bridge-attached", this.snapshot());
    return this.bridge;
  }

  update(dt) {
    if (!this.enabled || !this.targetUnitId) return;
    const target = this.unitRuntime?.get?.(this.targetUnitId);
    if (!target) return;
    this.bridge.update({
      dt,
      target: { ...target.transform },
      profile: this.profile,
      unitId: target.id
    });
  }

  snapshot() {
    return {
      enabled: this.enabled,
      targetUnitId: this.targetUnitId,
      profile: this.profile,
      bridge: this.bridge.snapshot()
    };
  }

  dispose() {
    this.targetUnitId = null;
    this.bridge = new CameraBridgeAdapter();
    this.engine = null;
  }
}
