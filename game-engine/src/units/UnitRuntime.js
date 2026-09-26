import { UnitRegistry, unitContractViolations } from "./UnitRegistry.js";
import { ensureUnitRuntimeState } from "./UnitState.js";
import { UnitControllerSystem } from "./UnitControllerSystem.js";
import { UnitMovementSystem } from "./UnitMovementSystem.js";
import { UnitEnvironmentSystem } from "./UnitEnvironmentSystem.js";

function syncFromBinding(unit) {
  const binding = unit.binding;
  if (!binding?.readTransform) return;
  const transform = binding.readTransform(unit);
  if (!transform) return;
  for (const key of ["x", "y", "z", "yaw"]) {
    const value = Number(transform[key]);
    if (Number.isFinite(value)) unit.transform[key] = value;
  }
}

function syncToBinding(unit) {
  unit.binding?.writeTransform?.({ ...unit.transform }, unit);
}

export class UnitRuntime {
  constructor({ registry = new UnitRegistry(), mapSystem = null } = {}) {
    this.registry = registry;
    this.mapSystem = mapSystem;
    this.engine = null;
    this.controllerSystem = new UnitControllerSystem();
    this.movementSystem = new UnitMovementSystem();
    this.environmentSystem = new UnitEnvironmentSystem();
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

  setMapSystem(mapSystem) {
    this.mapSystem = mapSystem || null;
    return this;
  }

  register(spec) {
    const unit = this.registry.register(spec);
    ensureUnitRuntimeState(unit);
    const violations = unitContractViolations(unit);
    if (violations.length) {
      this.registry.unregister(unit.id);
      throw new Error(`Invalid Unit ${unit.id}: ${violations.join(", ")}`);
    }
    this.engine?.events?.emit?.("units:registered", { unit });
    return unit;
  }

  unregister(id) {
    const unit = this.registry.get(id);
    const removed = this.registry.unregister(id);
    if (removed) this.engine?.events?.emit?.("units:unregistered", { unit });
    return removed;
  }

  get(id) {
    return this.registry.get(id);
  }

  list(options) {
    return this.registry.list(options);
  }

  update(dt) {
    if (!this.enabled) return;
    const context = { engine: this.engine, mapSystem: this.mapSystem, unitRuntime: this };
    for (const unit of this.registry.list({ enabledOnly: true })) {
      ensureUnitRuntimeState(unit);
      unit.state.movement.movedDistanceFrame = 0;
      syncFromBinding(unit);
      this.controllerSystem.update(unit, dt, context);
      this.movementSystem.update(unit, dt, context);
      this.environmentSystem.update(unit, dt, context);
      syncToBinding(unit);
      this.engine?.events?.emit?.("units:updated", { unit, dt });
    }
  }

  snapshot() {
    return this.registry.list().map(unit => ({
      id: unit.id,
      role: unit.role,
      tags: [...unit.tags],
      transform: { ...unit.transform },
      movement: { ...unit.movement },
      state: {
        contract: unit.state.contract,
        locomotion: unit.state.locomotion,
        velocity: { ...unit.state.velocity },
        movement: { ...unit.state.movement },
        environment: { ...unit.state.environment }
      },
      runtimeContract: unit.runtimeContract,
      stateContract: unit.stateContract
    }));
  }

  dispose() {
    this.registry.clear();
    this.engine = null;
  }
}
