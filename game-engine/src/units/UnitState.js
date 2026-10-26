function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function defineStateAlias(state, key, getter, setter) {
  const existing = Object.getOwnPropertyDescriptor(state, key);
  if (existing && !existing.configurable) return;
  Object.defineProperty(state, key, {
    configurable: true,
    enumerable: false,
    get: getter,
    set: setter
  });
}

export const UNIT_STATE_CONTRACT_ID = "luminous.unit-state.v2";

export function createUnitRuntimeState(seed = {}) {
  const state = { ...(seed || {}) };
  state.contract = UNIT_STATE_CONTRACT_ID;
  state.locomotion = seed?.locomotion || "ground";
  state.velocity = { x: 0, y: 0, z: 0, ...(seed?.velocity || {}) };
  state.movement = {
    movedDistance: 0,
    movedDistanceFrame: 0,
    desiredX: 0,
    desiredZ: 0,
    speedFactor: 1,
    speedScale: 1,
    blockedX: false,
    blockedZ: false,
    lastX: null,
    lastZ: null,
    lastDirX: 0,
    lastDirZ: 1,
    scriptedLockDepth: 0,
    ...(seed?.movement || {})
  };
  state.facing = {
    sign: 1,
    targetSign: 1,
    flipFrom: 1,
    flipT: 1,
    ...(seed?.facing || {})
  };
  state.vertical = {
    falling: Boolean(seed?.falling),
    fallVelocity: finite(seed?.fallVelocity),
    pendingLedgeDrop: seed?.pendingLedgeDrop || null,
    ...(seed?.vertical || {})
  };
  state.buoyancy = {
    active: false,
    velocity: 0,
    phase: 0,
    wasActive: false,
    ...(seed?.buoyancy || {})
  };
  state.environment = {
    temperature: null,
    current: null,
    surface: null,
    wetness: 0,
    water: null,
    slope: null,
    groundHeight: null,
    cell: null,
    mapId: null,
    ...(seed?.environment || {})
  };
  state.animation = {
    state: "idle",
    phase: 0,
    previousState: null,
    lock: null,
    wasMoving: false,
    ...(seed?.animation || {})
  };
  state.controllerState = {
    intent: null,
    followActive: false,
    patrolIndex: 0,
    paused: false,
    ...(seed?.controllerState || {})
  };
  state.overpassId = seed?.overpassId || null;
  state.environmentalMoved = finite(seed?.environmentalMoved);
  state.lastEnvironmentalForce = seed?.lastEnvironmentalForce || null;

  defineStateAlias(state, "falling", () => state.vertical.falling, value => {
    state.vertical.falling = Boolean(value);
  });
  defineStateAlias(state, "fallVelocity", () => state.vertical.fallVelocity, value => {
    state.vertical.fallVelocity = finite(value);
  });
  defineStateAlias(state, "pendingLedgeDrop", () => state.vertical.pendingLedgeDrop, value => {
    state.vertical.pendingLedgeDrop = value || null;
  });

  return state;
}

export function ensureUnitRuntimeState(unit) {
  if (!unit) return null;
  if (unit.state?.contract !== UNIT_STATE_CONTRACT_ID) {
    unit.state = createUnitRuntimeState(unit.state || {});
  }
  if (!unit.intent) {
    unit.intent = {
      moveX: 0,
      moveZ: 0,
      speedScale: 1,
      sprint: false,
      action: null,
      wantsRun: false,
      wantsInteract: false,
      wantsTalk: false,
      wantsUse: false
    };
  }
  unit.state.controllerState.intent = unit.intent;
  return unit.state;
}
