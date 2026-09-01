const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

test('PoV remote sync is subscription driven and never polls cached look records', () => {
  const state = read('js/vtt/pov-state.js');
  expect(state).toContain('subscribe(playersRef()');
  expect(state).toContain('subscribe(worldRef()');
  expect(state).not.toContain('setInterval');
  expect(state).not.toContain('clearInterval');
});
