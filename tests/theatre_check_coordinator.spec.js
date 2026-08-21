const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

test('player rolls are gated by a DM request while Theatre is active', () => {
  const src = read('js/theatre-check-coordinator.js');
  expect(src).toContain('event.target?.closest?.(".player-dnd-roll")');
  expect(src).toContain('playerTheatreActive()');
  expect(src).toContain('event.stopImmediatePropagation()');
  expect(src).toContain('requestPlayerRoll(target)');
  expect(src).toContain('SOLICITUD ENVIADA AL DM');
});

test('DM can open, edit, approve, deny, and originate checks', () => {
  const src = read('js/theatre-check-coordinator.js');
  for (const contract of [
    'CHECK DIRECTOR',
    'ABRIR',
    'APROBAR Y ENVIAR',
    'RECHAZAR',
    'ENVIAR CHECK',
    'THRESHOLD OCULTO',
    'ADVANTAGE',
    'DISADVANTAGE',
  ]) expect(src).toContain(contract);
  expect(src).toContain('loadRequestIntoComposer');
  expect(src).toContain('issueDmCommand');
  expect(src).toContain('denyEditingRequest');
});

test('approved command returns to the requested player and only then starts the real roll UI', () => {
  const src = read('js/theatre-check-coordinator.js');
  expect(src).toContain('EL DM SOLICITA UNA TIRADA');
  expect(src).toContain('button.textContent = "TIRAR"');
  expect(src).toContain('state.authorizedElement = target');
  expect(src).toContain('global.LuminousTheatreRolls?.armCheck?.(command.check || {})');
  expect(src).toContain('target.click()');
  expect(src).not.toContain('Math.random()');
});

test('DM live HUD reads semantic resolved coins instead of inventing a second roll', () => {
  const src = read('js/theatre-check-coordinator.js');
  expect(src).toContain('wrapper.dataset.stopped === "true"');
  expect(src).toContain('attributeFilter: ["data-stopped", "src"]');
  expect(src).toContain('coin-toss-coins-container');
  expect(src).toContain('roll-total-score');
  expect(src).toContain('buildDmMirrorHud');
  expect(src).toContain('ROLLING ${numberOr(live.resolved, 0)} / 5');
});

test('check HUD is moved above dialogue and the legacy coin modal is visually suppressed', () => {
  const src = read('js/theatre-check-coordinator.js');
  const css = read('css/theatre-check-coordinator.css');
  expect(src).toContain('theatre-check-front-layer');
  expect(src).toContain('front.appendChild(child)');
  expect(css).toContain('z-index:8900');
  expect(css).toContain('body.theatre-check-active #coin-toss-panel');
  expect(css).toContain('visibility:hidden!important');
  expect(css).toContain('width:min(390px,64vw)!important');
  expect(css).toContain('width:38px!important');
});

test('request and live paths are outside campaign public read and rules scope them to DM/target', () => {
  const src = read('js/theatre-check-coordinator.js');
  const rules = read('database.rules.json');
  expect(src).toContain('const REQUEST_ROOT = "theatre_check_requests"');
  expect(src).toContain('const COMMAND_ROOT = "theatre_check_commands"');
  expect(src).toContain('const LIVE_ROOT = "theatre_check_live"');
  expect(rules).toContain('"theatre_check_requests"');
  expect(rules).toContain('"theatre_check_commands"');
  expect(rules).toContain('"theatre_check_live"');
  expect(rules).toContain('auth.uid === $uid');
});

test('instance control loads coordinator on both player and dashboard Theatre views', () => {
  const instance = read('js/instance-control.js');
  expect(instance).toContain('ensureTheatreCheckCoordinatorAssets');
  expect(instance).toContain('css/theatre-check-coordinator.css');
  expect(instance).toContain('js/theatre-check-coordinator.js');
  expect((instance.match(/ensureTheatreCheckCoordinatorAssets\(documentRef\)/g) || []).length).toBeGreaterThanOrEqual(2);
});
