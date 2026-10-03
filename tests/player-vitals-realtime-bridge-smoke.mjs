import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

await import("../js/player-vitals-realtime-bridge.js");
await import("../js/player-vitals-hud.js");
await import("../js/battle-viewer-player-entry-074.js");

const bridge = globalThis.LuminousPlayerVitalsRealtimeBridge;
const hud = globalThis.LuminousPlayerVitalsHud;
const playerEntry = globalThis.LuminousBattleViewerPlayerEntry074;

assert.ok(bridge, "Player vitals bridge should register");
assert.ok(hud, "Player vitals HUD runtime should register");
assert.ok(playerEntry, "Player entry runtime should register");

const combatants = {
  "player:alice": {
    id: "player:alice",
    isPlayer: true,
    canonicalPlayerKey: "alice",
    hp: 37,
    maxHp: 80,
    sp: -12,
  },
  "player:bob": {
    id: "player:bob",
    actorCategory: "player",
    characterLink: { mode: "player", playerId: "bob" },
    hp: 0,
    maxHp: 60,
    sp: 45,
  },
  goblin: {
    id: "goblin",
    category: "enemy",
    hp: 5,
    maxHp: 20,
    sp: 0,
  },
};

const updates = bridge.firebaseUpdatesForSnapshot(combatants);
assert.deepEqual(
  Object.keys(updates).filter((key) => key.includes("/alice/")).sort(),
  [
    "campaña/jugadores/alice/combatStats/hp_actual",
    "campaña/jugadores/alice/combatStats/hp_max",
    "campaña/jugadores/alice/combatStats/sp_actual",
    "campaña/jugadores/alice/hp",
    "campaña/jugadores/alice/hp_actual",
    "campaña/jugadores/alice/hp_max",
    "campaña/jugadores/alice/sp",
    "campaña/jugadores/alice/sp_actual",
  ],
);
assert.equal(updates["campaña/jugadores/alice/hp"], 37);
assert.equal(updates["campaña/jugadores/alice/combatStats/hp_actual"], 37);
assert.equal(updates["campaña/jugadores/alice/sp"], -12);
assert.equal(updates["campaña/jugadores/bob/hp"], 0);
assert.equal(updates["campaña/jugadores/bob/sp"], 45);
assert.equal(Object.keys(updates).some((key) => key.includes("goblin")), false, "enemy vitals must never be mirrored into Player records");

const writes = [];
const db = {
  ref(pathValue = "") {
    assert.equal(pathValue, "", "bridge should use one root multi-location update");
    return {
      async update(patch) {
        writes.push(patch);
      },
    };
  },
};
const synced = await bridge.syncSnapshot(db, combatants, { force: true });
assert.equal(synced.synced, true);
assert.equal(writes.length, 1);
const unchanged = await bridge.syncSnapshot(db, combatants);
assert.equal(unchanged.synced, false);
assert.equal(unchanged.reason, "UNCHANGED");
assert.equal(writes.length, 1, "unchanged combat snapshots should not spam Player writes");

assert.deepEqual(
  hud.resolveVitals({
    hp: 99,
    hp_max: 99,
    sp: 20,
    combatStats: { hp_actual: 25, hp_max: 100, sp_actual: -15 },
  }),
  { hpActual: 25, hpMax: 100, spActual: -15 },
  "HUD must prefer canonical combatStats over legacy root aliases",
);
assert.equal(hud.hpDashOffset(100, 100), 0);
assert.equal(hud.hpDashOffset(50, 100), 500);
assert.equal(hud.hpDashOffset(0, 100), 1000);
assert.equal(hud.spVisual(-45).maxNegative, true);
assert.equal(hud.spVisual(45).maxPositive, true);

function fakeNode() {
  const classes = new Set();
  const props = {};
  return {
    textContent: "",
    dataset: {},
    attrs: {},
    style: {
      strokeDashoffset: "",
      setProperty(key, value) { props[key] = value; },
      getPropertyValue(key) { return props[key] || ""; },
    },
    classList: {
      toggle(name, enabled) {
        if (enabled) classes.add(name);
        else classes.delete(name);
      },
      contains(name) { return classes.has(name); },
    },
    setAttribute(key, value) { this.attrs[key] = String(value); },
  };
}
const nodes = Object.fromEntries([
  "hud-hp-actual",
  "hud-hp-max",
  "hud-sp-text",
  "hp-bar",
  "hp-bar-delay",
  "hud-sp-sphere",
  "player-combat-hud",
].map((id) => [id, fakeNode()]));
const fakeDoc = { getElementById(id) { return nodes[id] || null; } };
const rendered = hud.sync({ combatStats: { hp_actual: 25, hp_max: 100, sp_actual: -45 } }, fakeDoc);
assert.equal(rendered.hpDashOffset, 750);
assert.equal(nodes["hp-bar"].style.strokeDashoffset, "750");
assert.equal(nodes["hp-bar-delay"].style.strokeDashoffset, "750");
assert.equal(nodes["hud-hp-actual"].textContent, "25");
assert.equal(nodes["hud-hp-max"].textContent, "100");
assert.equal(nodes["hud-sp-text"].textContent, "-45");
assert.equal(nodes["hud-sp-sphere"].classList.contains("waves-min"), true);
assert.equal(nodes["player-combat-hud"].dataset.hpActual, "25");

const actor = {
  category: "player",
  playerId: "alice",
  sourceId: "alice",
  linkedActorId: "actor-alice",
  name: "Alice",
  raw: {
    hp: 90,
    hp_actual: 85,
    hp_max: 90,
    maxHp: 999,
    sp: 10,
    combatStats: { hp_actual: 37, hp_max: 80, sp_actual: -12 },
  },
};
const combatant = playerEntry.buildPlayerCombatant(actor, {
  unitResolution: { ok: false, reason: "NO_UNIT", unitId: null, unit: null },
  now: 1234,
});
assert.equal(combatant.hp, 37, "combat entry must use realtime Player HP");
assert.equal(combatant.maxHp, 80, "combat entry must use realtime Player max HP");
assert.equal(combatant.sp, -12, "combat entry must use realtime Player SP");

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(here, "..");
const authoritySource = fs.readFileSync(path.join(repoRoot, "js/combat-v073-authority.js"), "utf8");
const battleViewer = fs.readFileSync(path.join(repoRoot, "Battle-viewer.html"), "utf8");
const playerHtml = fs.readFileSync(path.join(repoRoot, "hoja_personaje.html"), "utf8");
const playerJs = fs.readFileSync(path.join(repoRoot, "hoja_personaje.js"), "utf8");

assert.match(authoritySource, /playerVitalFirebaseUpdates\(snapshot\)/);
assert.match(authoritySource, /\.\.\.playerVitalFirebaseUpdates\(snapshot\)/);
assert.match(authoritySource, /s\.db\.ref\(\)\.update\(updates\)/);
assert.match(battleViewer, /player-vitals-realtime-bridge\.js/);
assert.ok(
  playerHtml.indexOf("js/player-vitals-hud.js") < playerHtml.indexOf("hoja_personaje.js"),
  "Player vitals HUD runtime must load before the sheet renderer",
);
assert.match(playerJs, /LuminousPlayerVitalsHud\?\.sync\?\.\(data, document\)/);

console.log("player-vitals-realtime-bridge-smoke: ok");
