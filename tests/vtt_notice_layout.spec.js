const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const read = (relativePath) => fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');

function cssBlock(source, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = source.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`, 's'));
  expect(match, `Missing CSS block for ${selector}`).toBeTruthy();
  return match[1];
}

function numericProperty(block, property) {
  const match = block.match(new RegExp(`${property}\\s*:\\s*(\\d+)`));
  expect(match, `Missing numeric ${property}`).toBeTruthy();
  return Number(match[1]);
}

test('global VTT notice uses a top fixed lane above the tactical HUD', () => {
  const css = read('css/vtt.css');
  const hudSource = read('js/vtt/map-hud-bootstrap.js');
  const notice = cssBlock(css, '.vtt-notice');
  const hud = hudSource.match(/#\$\{HUD_ID\}\{([^}]*)\}/s)?.[1];

  expect(hud, 'Missing tactical HUD style block').toBeTruthy();
  expect(notice).toContain('position: fixed');
  expect(notice).toMatch(/top\s*:/);
  expect(notice).not.toMatch(/bottom\s*:/);
  expect(notice).toContain('pointer-events: none');
  expect(notice).toContain('overflow-wrap: anywhere');
  expect(numericProperty(notice, 'z-index')).toBeGreaterThan(numericProperty(hud, 'z-index'));
});

test('DM edit mode reserves horizontal space for the notice lane', () => {
  const css = read('css/vtt.css');
  const dmNotice = cssBlock(css, 'body.vtt-dm-edit-active .vtt-notice');
  expect(dmNotice).toMatch(/max-width\s*:/);
  expect(dmNotice).toContain('100vw - 440px');
});

test('VTT exposes exactly one polite global notice live region', () => {
  const html = read('vtt.html');
  expect((html.match(/id="vtt-notice"/g) || []).length).toBe(1);
  expect(html).toMatch(/id="vtt-notice"[^>]*role="status"[^>]*aria-live="polite"/);
});
