const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

test('review hardening does not alter DM writes and serializes only player memory saves', () => {
  const patch = read('js/vtt/memory-review-hardening-patch.js');
  expect(patch).toContain('if (options.isDm) return rawSaveMemory(playerId, rawMemory)');
  expect(patch).toContain('while (guard < 12)');
});
