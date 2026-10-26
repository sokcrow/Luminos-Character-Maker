const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  use: {
    headless: true,
    launchOptions: process.env.CHROMIUM_PATH
      ? { executablePath: process.env.CHROMIUM_PATH }
      : {},
  },
});
