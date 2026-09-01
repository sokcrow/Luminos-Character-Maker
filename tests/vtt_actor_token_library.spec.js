const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const actors = require('../js/vtt/actor-library.js');

const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

test('actor library classifies players, NPCs and hostile enemies', () => {
  expect(actors.normalizeActor('players', 'p1', { name: 'Player' }).category).toBe('player');
  expect(actors.normalizeActor('npcs', 'n1', { name: 'Shopkeeper' }).category).toBe('npc');
  expect(actors.normalizeActor('npcs', 'e1', { name: 'Guard', hostile: true }).category).toBe('enemy');
  expect(actors.normalizeActor('actors', 'b1', { name: 'Boss', type: 'boss' }).category).toBe('boss');
});

test('dropping an actor creates a snapped token linked back to its permanent actor', () => {
  const actor = actors.normalizeActor('npcs', 'guard_1', { name: 'Guard', hostile: true, speedFt: 35 });
  const mapData = { grid: { cols: 10, rows: 10, size: 70 }, zLevels: { 1: { elevationFt: 15 } }, defaultZStepFt: 15 };
  const token = actors.tokenFromActor(actor, { x: 145, y: 215 }, mapData, 1);
  expect(token.actorRef).toEqual({ scope: 'npcs', id: 'guard_1' });
  expect(token.actorCategory).toBe('enemy');
  expect(token.dynamicActorToken).toBe(true);
  expect(token.canonicalScope).toBe('world');
  expect(token.gridPosition).toEqual({ col: 2, row: 3, z: 1 });
  expect(token.elevationFt).toBe(15);
  expect(token.speedFt).toBe(35);
});

test('player actor token uses canonical player scope instead of spawning a world duplicate', () => {
  const actor = actors.normalizeActor('players', 'Alice', { name: 'Alice', uid: 'uid-1' });
  const token = actors.tokenFromActor(actor, { x: 35, y: 35 }, { grid: { cols: 5, rows: 5, size: 70 }, zLevels: { 0: { elevationFt: 0 } } }, 0);
  expect(token.canonicalScope).toBe('player');
  expect(token.canonicalPlayerKey).toBe('Alice');
  expect(token.dynamicActorToken).toBe(false);
});

test('actor library reads all three campaign actor sources', () => {
  const source = read('js/vtt/actor-library-state.js');
  expect(source).toContain("campaña/jugadores");
  expect(source).toContain("campaña/actores");
  expect(source).toContain("campaña/base_datos_npcs");
});

test('dynamic token patch persists full token snapshots and can create or delete world tokens', () => {
  const source = read('js/vtt/token-state-dynamic-patch.js');
  expect(source).toContain('schemaVersion: 2');
  expect(source).toContain('token: tokenSnapshot(token)');
  expect(source).toContain('createWorldToken');
  expect(source).toContain('deleteWorldToken');
  expect(source).toContain('applyDynamicRecords');
  expect(source).toContain("canonicalScope = 'world'");
});

test('DM actor UI supports drag onto canvas, token images and right-click removal', () => {
  const source = read('js/vtt/actor-library-bootstrap.js');
  expect(source).toContain('ACTOR / TOKEN LIBRARY');
  expect(source).toContain('card.draggable = true');
  expect(source).toContain("card.addEventListener('dragstart'");
  expect(source).toContain("addEventListener('drop'");
  expect(source).toContain('createWorldToken');
  expect(source).toContain('deleteWorldToken');
  expect(source).toContain('drawPersonIcon = function actorTokenImage');
});

test('main installs dynamic token support before creating the token bridge', () => {
  const source = read('js/vtt/main.js');
  const patchIndex = source.indexOf("import './token-state-dynamic-patch.js'");
  const bridgeIndex = source.indexOf('tokenStateApi.createBridge');
  expect(patchIndex).toBeGreaterThan(-1);
  expect(bridgeIndex).toBeGreaterThan(patchIndex);
  expect(source).toContain("import('./actor-library-bootstrap.js')");
});
