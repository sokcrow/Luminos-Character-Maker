import { test, expect } from '@playwright/test';
import fs from 'node:fs';

const studio = fs.readFileSync('pantalla_dm.html', 'utf8');
const entry = studio.match(/<script id="dm-live-session-entry">([\s\S]*?)<\/script>/)?.[1];
const legacyTabs = studio.slice(studio.indexOf('// --- LÓGICA DE TABS VISUALIZADOR DE JUEGO ---'), studio.indexOf('// --- COMUNICACIONES DM ---'));
const tabRuntime = fs.readFileSync('js/dm-tab-runtime-v2.js', 'utf8');

// Use the production Studio DOM/CSS and navigation handlers. Omit the unrelated
// Firebase tools so these tests cannot touch the campaign or start a combat.
async function mount(context, { scripts = true, popup = 'normal' } = {}) {
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin !== 'http://studio.test') return route.abort();
    if (url.pathname === '/hoja_de_DM.html') {
      return route.fulfill({ contentType: 'text/html', body: '<title>Director</title><p>Sesión en vivo</p>' });
    }
    if (url.pathname === '/stale.html') return route.fulfill({ contentType: 'text/html', body: '<p>Stale Director</p>' });
    if (url.pathname !== '/pantalla_dm.html') return route.fulfill({ status: 204 });
    const html = studio.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
    const override = popup === 'normal' ? '' : popup === 'null' ? 'window.open=()=>null;' :
      popup === 'throws' ? 'window.open=()=>{throw Error("blocked")};' :
      'window.open=()=>({focus(){throw Error("stale window")}});';
    return route.fulfill({ contentType: 'text/html', body: html + (scripts ? `
      <script>${override}</script><script>${entry}</script>
      <script>${tabRuntime}</script><script>${legacyTabs}</script>` : '') });
  });
  const page = await context.newPage();
  await page.goto('http://studio.test/pantalla_dm.html');
  // The management boot mask is irrelevant to navigation and would normally
  // be dismissed by the authenticated Firebase boot omitted in this fixture.
  await page.addStyleTag({ content: '#dm-loading-overlay,#system-loading-overlay{display:none!important}' });
  return page;
}

test('live entry preserves the Studio tab, recovers the named Director, and reopens after closing', async ({ context }) => {
  const page = await mount(context);
  const link = page.locator('#btn-modo-director');
  const before = await page.locator('.dm-tab-pane.active').evaluateAll(nodes => nodes.map(node => node.id));
  expect(before.length).toBeGreaterThan(0);
  const opened = context.waitForEvent('page');
  await link.click();
  const director = await opened;
  await director.waitForURL('http://studio.test/hoja_de_DM.html');
  await director.evaluate(() => { window.sessionMarker = 'preserved'; });
  await director.goto('http://studio.test/stale.html');
  await page.bringToFront();
  await link.click();
  await director.waitForURL('http://studio.test/hoja_de_DM.html');
  expect(context.pages()).toHaveLength(2);
  expect(await director.evaluate(() => window.sessionMarker)).toBeUndefined();
  expect(await page.locator('.dm-tab-pane.active').evaluateAll(nodes => nodes.map(node => node.id))).toEqual(before);
  await director.close();
  const reopened = context.waitForEvent('page');
  await link.focus();
  await page.keyboard.press('Enter');
  await (await reopened).waitForURL('http://studio.test/hoja_de_DM.html');
});

for (const popup of ['null', 'throws', 'focus-fails']) {
  test(`native link still opens the Director when popup handling ${popup}`, async ({ context }) => {
    const page = await mount(context, { popup });
    const opened = context.waitForEvent('page');
    await page.locator('#btn-modo-director').click();
    await (await opened).waitForURL('http://studio.test/hoja_de_DM.html');
    await expect(page.locator('#tab-tiempo')).toHaveClass(/active/);
  });
}

test('live entry navigates with JavaScript disabled', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const page = await mount(context, { scripts: false });
    const opened = context.waitForEvent('page');
    await page.locator('#btn-modo-director').click();
    await (await opened).waitForURL('http://studio.test/hoja_de_DM.html');
  } finally {
    await context.close();
  }
});
