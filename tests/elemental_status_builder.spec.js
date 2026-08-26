const { test, expect } = require('@playwright/test');

const EXPECTED = {
  chill: 'Speed decreases by 1 for every 2 Count.',
  frozen: 'Gain a Shield equal to 100 + 10% of Max HP.',
  shock: 'gain 1 Paralyze for every 3 Count',
  corrosion: 'Defense and Offense Levels decrease by 1 for every 2 Count.',
  poison: 'Max 10 Potency.',
  decay: 'Reduce Max HP by 1% per Count.',
  radiance: 'take fixed damage equal to 1% of hit damage for every 2 Count.',
  force: 'Raise Stagger Threshold by Count, then lose this effect.'
};

test('status builder catalog exposes elemental statuses and runtime', async ({ page }) => {
  let pageError = null;
  page.on('pageerror', (error) => {
    if (!String(error?.message || error).includes('PERMISSION_DENIED')) pageError = error;
  });

  await page.goto(`file://${process.cwd()}/dm-combat-creator.html`);
  await page.waitForFunction(() => Boolean(window.STATUS_REGISTRY?.chill));
  await page.waitForFunction(() => Boolean(window.LuminousElementalStatusRuntime));

  const definitions = await page.evaluate((ids) => Object.fromEntries(
    ids.map((id) => [id, window.STATUS_REGISTRY[id]])
  ), Object.keys(EXPECTED));

  expect(pageError).toBeNull();
  for (const [id, snippet] of Object.entries(EXPECTED)) {
    expect(definitions[id]).toBeTruthy();
    expect(definitions[id].description).toContain(snippet);
  }

  expect(definitions.corrosion.maxCount).toBe(10);
  expect(definitions.poison.mode).toBe('double');
  expect(definitions.poison.maxPotency).toBe(10);
  expect(definitions.decay.maxCount).toBe(99);
  expect(definitions.radiance.maxCount).toBe(10);
});
