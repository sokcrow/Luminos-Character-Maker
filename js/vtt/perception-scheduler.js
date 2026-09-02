export class PerceptionScheduler {
  constructor() {
    this.visionDirty = true;
    this.renderDirty = true;
    this.animationActive = false;
    this.cameraActive = false;
    this.cachedVision = null;
    this.hasCachedVision = false;
    this.metrics = {
      visionInvalidations: 0,
      visionRecomputes: 0,
      visionCacheHits: 0,
      renderRequests: 1,
      renderedFrames: 0,
      cameraDirtyEvents: 0,
      animationFrames: 0,
    };
  }

  invalidateVision() {
    if (!this.visionDirty) this.metrics.visionInvalidations += 1;
    this.visionDirty = true;
    return true;
  }

  requestRender() {
    if (!this.renderDirty) this.metrics.renderRequests += 1;
    this.renderDirty = true;
    return true;
  }

  markSceneDirty(detail = {}) {
    if (detail.vision === true) this.invalidateVision();
    if (detail.render !== false) this.requestRender();
    if (detail.reason === 'camera') {
      this.cameraActive = Boolean(detail.active);
      this.metrics.cameraDirtyEvents += 1;
    }
    return this.snapshot();
  }

  setAnimationActive(active) {
    this.animationActive = Boolean(active);
    if (this.animationActive) this.requestRender();
    return this.animationActive;
  }

  consumeVision(compute, { force = false } = {}) {
    if (force) this.invalidateVision();
    if (!this.visionDirty && this.hasCachedVision) {
      this.metrics.visionCacheHits += 1;
      return this.cachedVision;
    }
    if (typeof compute !== 'function') return this.cachedVision;
    this.cachedVision = compute();
    this.hasCachedVision = true;
    this.visionDirty = false;
    this.metrics.visionRecomputes += 1;
    return this.cachedVision;
  }

  shouldRender() {
    return this.renderDirty || this.animationActive || this.cameraActive;
  }

  didRender() {
    this.metrics.renderedFrames += 1;
    if (this.animationActive) this.metrics.animationFrames += 1;
    this.renderDirty = false;
    this.cameraActive = false;
  }

  snapshot() {
    return Object.freeze({
      visionDirty: this.visionDirty,
      renderDirty: this.renderDirty,
      animationActive: this.animationActive,
      cameraActive: this.cameraActive,
      hasCachedVision: this.hasCachedVision,
      ...this.metrics,
    });
  }
}
