const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

test('opposed mode is DM mediated and rolls the rival first', () => {
  const src = read('js/theatre-opposed-checks.js');
  expect(src).toContain('TIPO DE CHECK');
  expect(src).toContain('ENFRENTADO');
  expect(src).toContain('RIVAL / GENERADOR DE THRESHOLD');
  expect(src).toContain('status: "awaiting_threshold"');
  expect(src).toContain('opposedPhase: "threshold"');
  expect(src).toContain('issueResolverCommand');
  expect(src).toContain('opposedPhase: "resolver"');
});

test('hidden opposed threshold never enters the initiator command', () => {
  const src = read('js/theatre-opposed-checks.js');
  expect(src).toContain('thresholdRaw: hidden ? null : thresholdRaw');
  expect(src).toContain('thresholdHidden: Boolean(check.hiddenThreshold)');
  expect(src).toContain('threshold: check.hiddenThreshold ? null : effective');
});

test('participants only submit their phase result and DM computes final outcome', () => {
  const src = read('js/theatre-opposed-checks.js');
  expect(src).toContain('const child = phase === "threshold" ? "thresholdResult" : "resolverResult"');
  expect(src).toContain('outcomeFor(resolverTotal, thresholdRaw, check)');
  expect(src).toContain('global.LuminousTheatreRolls?.publishRoll?.({');
  expect(src).not.toContain('Math.random()');
});

test('opposed rolls suppress legacy visualizer capture without replacing Coin Engine RNG', () => {
  const src = read('js/theatre-opposed-checks.js');
  expect(src).toContain('original.cloneNode(true)');
  expect(src).toContain('panel.style.display = "none"');
  expect(src).toContain('clearArmedCheck');
  expect(src).toContain('coin-toss-close-btn');
  expect(src).toContain('theatre_check_live');
});

test('rival gets threshold-only HUD and resolver gets threshold vs outcome HUD', () => {
  const src = read('js/theatre-opposed-checks.js');
  const css = read('css/theatre-opposed-checks.css');
  expect(src).toContain('ENFRENTADA · GENERANDO THRESHOLD');
  expect(src).toContain('THRESHOLD REGISTRADO');
  expect(src).toContain('ESPERANDO RESULTADO DEL DM');
  expect(css).toContain('.theatre-opposed-threshold');
  expect(css).toContain('.theatre-opposed-compare');
  expect(css).toContain('width:min(390px,64vw)');
});

test('opposed private session and targeted result rules stay outside campaign public read', () => {
  const rules = read('database.rules.json');
  expect(rules).toContain('"theatre_opposed_checks"');
  expect(rules).toContain('"thresholdResult"');
  expect(rules).toContain('"resolverResult"');
  expect(rules).toContain('"theatre_opposed_results"');
  expect(rules).toContain("child('rivalUid').val() === auth.uid");
  expect(rules).toContain("child('initiatorUid').val() === auth.uid");
});

test('instance control loads opposed extension on player and DM theatre views', () => {
  const instance = read('js/instance-control.js');
  expect(instance).toContain('ensureTheatreOpposedAssets');
  expect(instance).toContain('css/theatre-opposed-checks.css');
  expect(instance).toContain('js/theatre-opposed-checks.js');
  expect((instance.match(/ensureTheatreOpposedAssets\(documentRef\)/g) || []).length).toBeGreaterThanOrEqual(2);
});
