const { test, expect } = require("@playwright/test");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");
const rolls = read("js/theatre-roll-visualizer.js");
const css = read("css/theatre-roll-visualizer.css");
const instanceControl = read("js/instance-control.js");
const rules = read("database.rules.json");

function loadRollApi(uid = "player-uid") {
  const database = () => ({});
  database.ServerValue = { TIMESTAMP: { ".sv": "timestamp" } };
  const fakeDocument = {
    readyState: "loading",
    addEventListener() {},
    body: { classList: { contains: () => false } },
  };
  const window = {
    document: fakeDocument,
    firebase: {
      database,
      auth: () => ({ currentUser: { uid } }),
    },
    sessionStorage: {
      getItem: () => "client-a",
      setItem() {},
    },
  };
  const context = vm.createContext({
    window,
    console,
    Date,
    Math,
    MutationObserver: class MutationObserver {},
    setTimeout,
    clearTimeout,
  });
  vm.runInContext(rolls, context);
  return window.LuminousTheatreRolls;
}

function fullRecord(overrides = {}) {
  const base = {
    schemaVersion: 3,
    kind: "check-result",
    presentation: "result-only",
    roller: { uid: "player-uid", actorId: "actor-a", name: "SO" },
    rollerUid: "player-uid",
    rollerClientId: "client-a",
    base: 6,
    total: 18,
    heads: 3,
    coinCount: 5,
    coinHeadBonus: 4,
    check: {
      thresholdRaw: 20,
      hiddenThreshold: false,
      modifierType: "advantage",
      modifierValue: 4,
      outcome: "passed",
    },
    visibility: "public",
    hiddenOutput: "none",
    hiddenOutcome: "success",
    hiddenText: "",
    durationMs: 7000,
    createdAt: 1,
    clientCreatedAt: 1,
    roomId: "default",
    privateRoomKey: "default",
    privateAvailable: false,
  };
  return Object.assign(base, overrides, {
    check: Object.assign({}, base.check, overrides.check || {}),
  });
}

test("reutiliza las imágenes reales del Coin Engine", () => {
  expect(rolls).toContain('const HEAD_SRC_MARKER = "yshLPnQ"');
  expect(rolls).toContain('const TAIL_SRC_MARKER = "XDx0ICt"');
  expect(rolls).toContain('const HEAD_SRC = "https://imgur.com/yshLPnQ.png"');
  expect(rolls).toContain('const TAIL_SRC = "https://imgur.com/XDx0ICt.png"');
  expect(rolls).toContain('#coin-toss-coins-container img');
  expect(rolls).toContain('img.className = "theatre-check-coin-image"');
  expect(css).toContain('.theatre-check-coin-image');
  expect(css).toContain('width:60px');
  expect(css).toContain('height:60px');
  expect(css).not.toContain('.theatre-roll-coin[data-side="head"]');
});

test("HUD local conserva el Coin Engine y el resultado remoto", () => {
  expect(rolls).toContain('function createLocalHud(check)');
  expect(rolls).toContain('function shouldSuppressRemoteForLocalRoller(roll)');
  expect(rolls).toContain('return roll.rollerClientId === CLIENT_ID;');
  expect(rolls).toContain('presentation: "result-only"');
  expect(rolls).toContain('buildRemoteResultCard');
});

test("una tirada oculta no publica total threshold ni outcome real en campaña", () => {
  const api = loadRollApi();
  const publicRecord = api.buildPublicRollRecord(fullRecord({
    visibility: "hidden",
    hiddenOutput: "outcome",
    privateAvailable: true,
    check: { hiddenThreshold: true },
  }));

  expect(publicRecord.publicOutcome).toBe("passed");
  expect(publicRecord.total).toBeUndefined();
  expect(publicRecord.base).toBeUndefined();
  expect(publicRecord.heads).toBeUndefined();
  expect(publicRecord.check).toBeUndefined();
  const serialized = JSON.stringify(publicRecord);
  expect(serialized).not.toContain("thresholdRaw");
  expect(serialized).not.toContain("modifierValue");
});

test("NADA no publica ni identidad ni resultado de una tirada oculta", () => {
  const api = loadRollApi();
  const publicRecord = api.buildPublicRollRecord(fullRecord({
    visibility: "hidden",
    hiddenOutput: "none",
    privateAvailable: true,
  }));
  expect(publicRecord.roller).toBeUndefined();
  expect(publicRecord.publicOutcome).toBeUndefined();
  expect(publicRecord.total).toBeUndefined();
});

test("hiddenThreshold mantiene el threshold fuera del stream público aunque la tirada sea pública", () => {
  const api = loadRollApi();
  const publicRecord = api.buildPublicRollRecord(fullRecord({
    visibility: "public",
    privateAvailable: true,
    check: { hiddenThreshold: true },
  }));
  expect(publicRecord.total).toBe(18);
  expect(publicRecord.check.outcome).toBe("passed");
  expect(publicRecord.check.hiddenThreshold).toBe(true);
  expect(publicRecord.check.thresholdRaw).toBeUndefined();
  expect(publicRecord.check.modifierType).toBeUndefined();
  expect(publicRecord.check.modifierValue).toBeUndefined();
});

test("datos privados viven fuera de campaña y solo el DM puede leerlos", () => {
  expect(rolls).toContain('const PRIVATE_ROLL_ROOT = "dm_private/theatre_rolls"');
  expect(rolls).toContain('resolvePrivateRollPath');
  expect(rolls).toContain('Multi-location update keeps the public redaction and DM-private copy atomic.');
  expect(rules).toContain('"dm_private"');
  expect(rules).toContain('".read": "auth != null && auth.uid === \'e9JwFZrtk6g8UMqq2Hf9EHVY7Ay1\'"');
  expect(rules).toContain("newData.child('rollerUid').val() === auth.uid");
  expect(rules).toContain("newData.child('privateRoomKey').val() === $room");
});

test("el inicio de una tirada es idempotente y no consume dos veces armCheck", () => {
  expect(rolls).toContain('let rollStartPending = false');
  expect(rolls).toContain('if (rollStartPending || pendingLocalRoll) return false;');
  expect(rolls).toContain('const armedCheck = nextCheckContext;');
  expect(rolls).toContain('nextCheckContext = null;');
  expect(rolls).toContain('rollStartPending = true;');
});

test("TOTAL publica y renderiza solo el total para jugadores", () => {
  const api = loadRollApi();
  const publicRecord = api.buildPublicRollRecord(fullRecord({
    visibility: "total",
    privateAvailable: true,
  }));
  expect(publicRecord.total).toBe(18);
  expect(publicRecord.check).toBeUndefined();
  expect(publicRecord.base).toBeUndefined();
  expect(publicRecord.heads).toBeUndefined();
  expect(rolls).toContain('if (!isDmView() && visibility === VISIBILITY.TOTAL) return card;');
});

test("rollerClientId solo suprime la sesión que originó la tirada", () => {
  const api = loadRollApi("player-uid");
  expect(api.getClientId()).toBe("client-a");
  expect(api.shouldSuppressRemoteForLocalRoller({
    rollerClientId: "client-a",
    roller: { uid: "player-uid" },
  })).toBe(true);
  expect(api.shouldSuppressRemoteForLocalRoller({
    rollerClientId: "client-b",
    roller: { uid: "player-uid" },
  })).toBe(false);
  expect(api.shouldSuppressRemoteForLocalRoller({
    roller: { uid: "player-uid" },
  })).toBe(true);
});

test("threshold aplica neutral ventaja y desventaja", () => {
  expect(rolls).toContain('ADVANTAGE: "advantage"');
  expect(rolls).toContain('DISADVANTAGE: "disadvantage"');
  expect(rolls).toContain('normalized.thresholdRaw - normalized.modifierValue');
  expect(rolls).toContain('normalized.thresholdRaw + normalized.modifierValue');
  expect(rolls).toContain('Number(total) >= threshold');
});

test("X igual a cero elimina el tip y fuerza neutral", () => {
  expect(rolls).toContain('modifierValue > 0 ? normalizeModifier(source.modifierType) : MODIFIER.NEUTRAL');
  expect(rolls).toContain('tipText: modifierValue > 0 ?');
  expect(rolls).toContain('if (normalized.modifierValue > 0 && normalized.tipText)');
});

test("threshold oculto muestra interrogantes en HUD local", () => {
  expect(rolls).toContain('normalized.hiddenThreshold ? "??"');
  expect(rolls).toContain('hiddenThreshold: check.hiddenThreshold');
});

test("colores del threshold son neutro amarillo y rojo", () => {
  expect(css).toContain('--neutral:#e1ddd5');
  expect(css).toContain('--advantage:#e7c34d');
  expect(css).toContain('--disadvantage:#d74a40');
  expect(css).toContain('.theatre-check-threshold.advantage .theatre-check-block-value');
  expect(css).toContain('.theatre-check-threshold.disadvantage .theatre-check-block-value');
});

test("no agrega skill o iconos de skill al HUD local", () => {
  expect(rolls).not.toContain('theatre-check-skill');
  expect(rolls).not.toContain('theatre-check-roll-label');
  expect(css).not.toContain('.theatre-check-skill');
});

test("no toca diálogo sprites foco ni crea un segundo motor", () => {
  expect(rolls).not.toContain('dialogo_activo');
  expect(rolls).not.toContain('actores_visibles');
  expect(rolls).not.toContain('active_actor');
  expect(rolls).not.toContain('publishIntervention');
  expect(rolls).not.toContain('currentTotal += 4');
});

test("mantiene API para armar el siguiente check y publicar resultados", () => {
  expect(rolls).toContain('function armCheck(options)');
  expect(rolls).toContain('armCheck,');
  expect(rolls).toContain('publishRoll,');
  expect(rolls).toContain('effectiveThreshold,');
  expect(rolls).toContain('checkOutcome,');
});

test("instance-control sigue cargando los assets", () => {
  expect(instanceControl).toContain('theatre-roll-visualizer.css');
  expect(instanceControl).toContain('theatre-roll-visualizer.js');
});
