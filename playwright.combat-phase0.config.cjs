const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({
  testDir: './tests',
  testMatch: ['combat-phase0-online.spec.mjs', 'combat-phase2-online.spec.mjs', 'combat-phase3-stage.spec.mjs', 'combat-phase4-hud.spec.mjs', 'combat-phase5-online.spec.mjs'],
  timeout: 120000,
  workers: 1,
  outputDir: 'artifacts/combat-phase0/playwright',
  use: {
    headless: true,
    viewport: { width: 1365, height: 768 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
  },
  webServer: {
    command: 'python3 -m http.server 4173 --bind 127.0.0.1',
    url: 'http://127.0.0.1:4173/Battle-viewer.html',
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
});
