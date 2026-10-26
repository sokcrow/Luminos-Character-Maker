import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const browsers = [process.env.CHROME_BIN, "/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium", "/usr/bin/chromium-browser"].filter(Boolean);
const browser = browsers.find(existsSync);
assert.ok(browser, "A real Chromium/Chrome browser must be installed on the CI runner.");
const fixture = pathToFileURL(resolve("tests/fixtures/jackpot-performance-browser.html")).href;
const flags = [
  "--headless=new", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage",
  "--disable-extensions", "--no-first-run", "--no-default-browser-check",
  "--allow-file-access-from-files", "--virtual-time-budget=6500",
];
const rendered = spawnSync(browser, [...flags, "--dump-dom", fixture], {
  encoding: "utf8", timeout: 25000, maxBuffer: 12 * 1024 * 1024
});
if (rendered.error) throw rendered.error;
assert.equal(rendered.status, 0, "Chrome must finish rendering the actual Player Stats HUD.");
const result = rendered.stdout.match(/<pre id="browser-test-result">([\s\S]*?)<\/pre>/)?.[1];
assert.ok(result, "Chrome must render a test-result element in its actual DOM.");
assert.ok(result.startsWith("PASS "), "Actual Player Stats HUD browser check failed: " + result);
assert.match(result, /"visiblePerformance":"\+9"/);
assert.match(result, /"withoutArchetype":"\+5"/);
assert.match(result, /"restored":"\+9"/);
assert.match(result, /"coinCheckPower":4/);
assert.match(result, /"postCoinFinalPower":0/);
assert.match(result, /JACKPOT/);
console.log("Chromium real DOM: " + result);

if (process.env.SCREENSHOT_DIR) {
  const output = resolve(process.env.SCREENSHOT_DIR);
  mkdirSync(output, { recursive: true });
  const png = resolve(output, "jackpot-performance-browser.png");
  const screenshot = spawnSync(browser, [...flags, "--window-size=1300,850", "--screenshot=" + png, fixture], {
    encoding: "utf8", timeout: 25000, maxBuffer: 2 * 1024 * 1024
  });
  if (screenshot.error) throw screenshot.error;
  assert.equal(screenshot.status, 0, "A visual screenshot must be captured.");
  assert.ok(existsSync(png), "Screenshot artifact must actually exist.");
  console.log("Chromium screenshot: " + png);
}
