export class CameraBridgeAdapter {
  constructor(source = null) {
    this.source = source || null;
  }

  available() {
    return Boolean(this.source);
  }

  profile() {
    const value = this.source?.cameraProfile;
    return typeof value === "function" ? value() : value || null;
  }

  follow(target, profile) {
    if (!this.source) return false;
    if (this.source.setCameraTarget) {
      this.source.setCameraTarget(target, profile);
      return true;
    }
    if (this.source.followCameraTarget) {
      this.source.followCameraTarget(target, profile);
      return true;
    }
    return false;
  }

  update(payload) {
    if (this.source?.updateCamera) {
      this.source.updateCamera(payload);
      return true;
    }
    return false;
  }

  snapshot() {
    return {
      available: this.available(),
      profile: this.profile()
    };
  }
}
