const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

test('movement runtime opens Dash doors through the canonical topology action bridge before committing movement', () => {
  const source = read('js/vtt/movement-bootstrap.js');
  const prepareStart = source.indexOf('async function prepareDoorInteractions');
  const resolveStart = source.indexOf('async function resolveMovementOrder');
  expect(prepareStart).toBeGreaterThan(0);
  expect(resolveStart).toBeGreaterThan(prepareStart);
  const prepareBody = source.slice(prepareStart, resolveStart);
  expect(prepareBody).toContain("movementRules.doorTraversal({ mode: 'dash'");
  expect(prepareBody).toContain("runtime.bridge.requestDirectAction(door.id, 'open')");
  const resolveBody = source.slice(resolveStart, source.indexOf('function resetControlledMovement', resolveStart));
  expect(resolveBody.indexOf('await prepareDoorInteractions')).toBeLessThan(resolveBody.indexOf('movement.commitMove'));
  expect(resolveBody).toContain('doorInteractions: doors.interactions');
  expect(resolveBody).toContain('stopAtDoor: plan.stopAtDoor || null');
});

test('Engine pauses at door boundary, emits a noise event, then continues traversal', () => {
  const source = read('js/vtt/engine.js');
  const animateStart = source.indexOf('async animateTokenPath');
  const mouseUpStart = source.indexOf('async handleTokenMouseUp');
  expect(animateStart).toBeGreaterThan(0);
  expect(mouseUpStart).toBeGreaterThan(animateStart);
  const animateBody = source.slice(animateStart, mouseUpStart);
  expect(animateBody).toContain('doorInteractions.filter');
  expect(animateBody).toContain("CustomEvent('vtt:movement-interaction'");
  expect(animateBody).toContain("CustomEvent('vtt:sound-event'");
  expect(animateBody).toContain('await pause(interaction.pauseMs)');
  expect(animateBody.indexOf('await pause(interaction.pauseMs)')).toBeLessThan(animateBody.indexOf('await moveSegment'));
  expect(source).toContain("CustomEvent('vtt:movement-stopped-at-door'");
});
