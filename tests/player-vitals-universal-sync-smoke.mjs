import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8');

globalThis.window = globalThis;
delete globalThis.LuminousPlayerVitalsHud;
delete globalThis.LuminousPlayerVitalsRealtimeBridge;

await import('../js/player-vitals-hud.js');
await import('../js/player-vitals-realtime-bridge.js');

const hud = globalThis.LuminousPlayerVitalsHud;
const bridge = globalThis.LuminousPlayerVitalsRealtimeBridge;
assert.ok(hud);
assert.ok(bridge);

const patch = hud.persistencePatch({ hp: 42, hp_max: 80, sp: 17 });
assert.deepEqual(patch, {
  hp: 42,
  'combatStats/hp_actual': 42,
  hp_max: 80,
  'combatStats/hp_max': 80,
  sp: 17,
  'combatStats/sp_actual': 17,
}, 'canonical Player persistence must mirror HP/SP to root and combatStats');

const combatant = {
  id: 'player:p1',
  isPlayer: true,
  canonicalPlayerKey: 'p1',
  hp: 55,
  maxHp: 90,
  sp: -8,
};
assert.deepEqual(
  bridge.firebaseUpdatesForSnapshot({ 'player:p1': combatant }, {}),
  {
    'campaña/jugadores/p1/hp': 55,
    'campaña/jugadores/p1/combatStats/hp_actual': 55,
    'campaña/jugadores/p1/hp_max': 90,
    'campaña/jugadores/p1/combatStats/hp_max': 90,
    'campaña/jugadores/p1/sp': -8,
    'campaña/jugadores/p1/combatStats/sp_actual': -8,
  },
  'Combat authority must publish combatant HP/SP to the canonical Player record'
);

function fakeDb({ phase = 'PRE_COMBAT_PLANNING', combatants = {} } = {}) {
  return {
    ref(path) {
      return {
        async once() {
          if (path === 'campaña/combate/combatants') return { val: () => combatants };
          if (path === 'campaña/combate/estado') return { val: () => ({ phase }) };
          return { val: () => null };
        },
      };
    },
  };
}

const deployed = {
  'player:p1': {
    id: 'player:p1',
    isPlayer: true,
    canonicalPlayerKey: 'p1',
    battleActive: true,
  },
};

globalThis.document = {
  body: {
    classList: {
      contains(name) { return name === 'player-instance-theatre'; },
    },
  },
};
let gate = await hud.outOfCombatWriteGate(fakeDb({ phase: 'PRE_COMBAT_PLANNING', combatants: deployed }), 'p1');
assert.equal(gate.allowed, true, 'Theatre must not be blocked by a stale deployed combatant outside active combat authority');
assert.equal(gate.staleDeploymentIgnored, true);

globalThis.document = {
  body: {
    classList: {
      contains(name) { return name === 'player-instance-combat'; },
    },
  },
};
gate = await hud.outOfCombatWriteGate(fakeDb({ phase: 'PRE_COMBAT_PLANNING', combatants: deployed }), 'p1');
assert.equal(gate.allowed, false, 'Combat UI planning must keep Combat Engine authority');
assert.equal(gate.reason, 'PLAYER_COMBAT_UI_ACTIVE');

globalThis.document = {
  body: {
    classList: {
      contains(name) { return name === 'player-instance-theatre'; },
    },
  },
};
gate = await hud.outOfCombatWriteGate(fakeDb({ phase: 'COMBAT', combatants: deployed }), 'p1');
assert.equal(gate.allowed, false, 'active Combat authority must block out-of-combat HP/SP writes even if Theatre UI is visible');
assert.equal(gate.reason, 'ACTIVE_COMBAT_AUTHORITY');

const inventoryHud = read('js/inventory-hud-v2.js');
assert.ok(inventoryHud.includes('...vitals.persistencePatch(unit || {})'), 'Inventory HUD must persist item effects and Player vitals in the same canonical Player update');
assert.ok(inventoryHud.includes('await saveUnitWithVitals(`USED //'), 'using an Item outside Combat must persist vitals after use');

const playerSheet = read('hoja_personaje.js');
assert.ok(playerSheet.includes('playerRef.on("child_changed"'), 'Player HUD must subscribe to canonical Player changes');
assert.ok(playerSheet.includes('renderCharacterSheet(window.datosJugador)'), 'Player/Theatre HUD must rerender from canonical Player changes');

const dmStudio = read('js/dm-player-dnd-studio.js');
assert.ok(dmStudio.includes('state.db.ref(PLAYERS_ROOT).on("value"'), 'DM Player HUD must subscribe to the canonical Player root');
assert.ok(dmStudio.includes('player?.hp ?? player?.hp_actual ?? combatStats.hp_actual'), 'DM Player HUD must read canonical HP');
assert.ok(dmStudio.includes('player?.sp ?? combatStats.sp_actual'), 'DM Player HUD must read canonical SP');

const authority = read('js/combat-v073-authority.js');
assert.ok(authority.includes('...playerVitalFirebaseUpdates(snapshot)'), 'Combat checkpoints must publish Player vitals to the canonical Player record');
assert.ok(authority.includes('...combatantFirebaseUpdates(snapshot)'), 'round completion must persist Combatant vitals too');

console.log('universal Player HP/SP sync contract: ok');
