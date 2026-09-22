import { EventBus } from "./EventBus.js";

const now = () => globalThis.performance?.now?.() ?? Date.now();

export class GameEngine {
  constructor({ events = new EventBus(), log = console } = {}) {
    this.events = events;
    this.log = log;
    this.systems = new Map();
    this.bridges = new Map();
    this.session = { player: null, dm: null };
    this.running = false;
    this.disposed = false;
    this.frameHandle = null;
    this.lastFrameAt = 0;
    this.frameCount = 0;
    this.startedAt = 0;
  }

  setPlayer(player) {
    this.session.player = player || null;
    this.events.emit("engine:player-changed", { player: this.session.player });
    return this.session.player;
  }

  registerBridge(id, bridge) {
    if (!id || !bridge) throw new Error("registerBridge requires id and bridge");
    this.bridges.set(String(id), bridge);
    bridge.attach?.(this);
    this.events.emit("engine:bridge-registered", { id: String(id), bridge });
    return bridge;
  }

  bridge(id) {
    return this.bridges.get(String(id)) || null;
  }

  registerSystem(id, system, { enabled = true } = {}) {
    if (!id || !system) throw new Error("registerSystem requires id and system");
    const key = String(id);
    const record = { id: key, system, enabled: Boolean(enabled), installed: false };
    this.systems.set(key, record);
    system.install?.(this);
    record.installed = true;
    if (record.enabled) system.enable?.(this);
    this.events.emit("engine:system-registered", { id: key, enabled: record.enabled });
    return system;
  }

  enableSystem(id) {
    const record = this.systems.get(String(id));
    if (!record || record.enabled) return false;
    record.enabled = true;
    record.system.enable?.(this);
    this.events.emit("engine:system-enabled", { id: record.id });
    return true;
  }

  disableSystem(id) {
    const record = this.systems.get(String(id));
    if (!record || !record.enabled) return false;
    record.enabled = false;
    record.system.disable?.(this);
    this.events.emit("engine:system-disabled", { id: record.id });
    return true;
  }

  update(dt) {
    if (this.disposed) return;
    for (const record of this.systems.values()) {
      if (!record.enabled) continue;
      record.system.update?.(dt, this);
    }
    this.frameCount += 1;
    this.events.emit("engine:frame", { dt, frameCount: this.frameCount });
  }

  #scheduleFrame() {
    if (!this.running || this.disposed) return;
    const request = globalThis.requestAnimationFrame
      ? (cb) => globalThis.requestAnimationFrame(cb)
      : (cb) => globalThis.setTimeout(() => cb(now()), 16);
    this.frameHandle = request((t) => {
      if (!this.running || this.disposed) return;
      const dt = this.lastFrameAt ? Math.min(0.1, Math.max(0, (t - this.lastFrameAt) / 1000)) : 0;
      this.lastFrameAt = t;
      this.update(dt);
      this.#scheduleFrame();
    });
  }

  start() {
    if (this.running || this.disposed) return false;
    this.running = true;
    this.startedAt = now();
    this.lastFrameAt = 0;
    this.events.emit("engine:start", { engine: this });
    this.#scheduleFrame();
    return true;
  }

  stop() {
    if (!this.running) return false;
    this.running = false;
    if (this.frameHandle != null) {
      if (globalThis.cancelAnimationFrame) globalThis.cancelAnimationFrame(this.frameHandle);
      else globalThis.clearTimeout?.(this.frameHandle);
    }
    this.frameHandle = null;
    this.events.emit("engine:stop", { engine: this });
    return true;
  }

  metrics() {
    const enabledSystems = [...this.systems.values()].filter((record) => record.enabled).length;
    return {
      running: this.running,
      disposed: this.disposed,
      systems: this.systems.size,
      enabledSystems,
      bridges: this.bridges.size,
      frames: this.frameCount,
      uptimeMs: this.startedAt ? Math.max(0, now() - this.startedAt) : 0
    };
  }

  dispose(reason = "disposed") {
    if (this.disposed) return false;
    this.stop();
    for (const record of [...this.systems.values()].reverse()) {
      try {
        if (record.enabled) record.system.disable?.(this);
        record.system.dispose?.(this);
      } catch (error) {
        this.log?.warn?.(`GameEngine dispose failed for ${record.id}`, error);
      }
    }
    for (const bridge of [...this.bridges.values()].reverse()) {
      try { bridge.detach?.(this); } catch (error) { this.log?.warn?.("Bridge detach failed", error); }
    }
    this.systems.clear();
    this.bridges.clear();
    this.disposed = true;
    this.events.emit("engine:dispose", { reason });
    this.events.clear();
    return true;
  }
}
