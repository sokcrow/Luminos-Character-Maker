const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

test('movement validates Dash doors before committing and opens them canonically only at the traversal threshold', () => {
  const source = read('js/vtt/movement-bootstrap.js');
  const validateStart = source.indexOf('function validateDoorInteractions');
  const executeStart = source.indexOf('async function executeMovementInteraction');
  const resolveStart = source.indexOf('async function resolveMovementOrder');
  expect(validateStart).toBeGreaterThan(0);
  expect(executeStart).toBeGreaterThan(validateStart);
  expect(resolveStart).toBeGreaterThan(executeStart);

  const validateBody = source.slice(validateStart, source.indexOf('async function reserveDestination', validateStart));
  expect(validateBody).toContain("movementRules.doorTraversal({ mode: 'dash'");
  expect(validateBody).not.toContain("requestDirectAction(door.id, 'open')");

  const executeBody = source.slice(executeStart, resolveStart);
  expect(executeBody).toContain("runtime.bridge.requestDirectAction(door.id, 'open')");
  expect(executeBody).toContain('irreversible: true');
  expect(executeBody).toContain("soundEvent: traversal.soundEvent || interaction.soundEvent || 'DASH_DOOR_BURST'");

  const resolveBody = source.slice(resolveStart, source.indexOf('async function cancelActiveMotion', resolveStart));
  expect(resolveBody.indexOf('validateDoorInteractions(plan)')).toBeLessThan(resolveBody.indexOf('movement.commitMove'));
  expect(resolveBody).toContain('doorInteractions: doors.interactions');
  expect(resolveBody).toContain('stopAtDoor: plan.stopAtDoor || null');
});

test('Engine reaches the door threshold, resolves the canonical interaction, emits resolved noise, then continues traversal', () => {
  const source = read('js/vtt/engine.js');
  const animateStart = source.indexOf('async animateTokenPath');
  const mouseUpStart = source.indexOf('async handleTokenMouseUp');
  expect(animateStart).toBeGreaterThan(0);
  expect(mouseUpStart).toBeGreaterThan(animateStart);
  const animateBody = source.slice(animateStart, mouseUpStart);

  expect(animateBody).toContain('doorInteractions');
  expect(animateBody).toContain('const threshold =');
  expect(animateBody).toContain('await moveSegment(segmentStart, threshold)');
  expect(animateBody).toContain('await this.movementInteractionResolver');
  expect(animateBody).toContain('resolvedInteraction = { ...interaction, ...resolution.interaction }');
  expect(animateBody).toContain('if (resolution?.irreversible === true) motion.irreversible = true');
  expect(animateBody).toContain("emitSemanticEvent('vtt:movement-interaction'");
  expect(animateBody).toContain("CustomEvent('vtt:sound-event'");
  expect(animateBody).toContain('event: resolvedInteraction.soundEvent');
  expect(animateBody).toContain('await pause(resolvedInteraction.pauseMs)');
  expect(animateBody).toContain('const complete = await moveSegment(segmentStart, segmentEnd)');
  expect(source).toContain("CustomEvent('vtt:movement-stopped-at-door'");
});