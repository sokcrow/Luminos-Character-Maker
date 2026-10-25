/* Run with node tests/luminous-audio-responsive.mjs. No live Firebase writes. */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
let playwright;
try { playwright = require("playwright"); }
catch { playwright = createRequire(path.resolve(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES || "/nonexistent", "package.json"))("playwright"); }

const script = fs.readFileSync("js/luminous-audio-director.js", "utf8");
const styles = fs.readFileSync("css/luminous-audio-director.css", "utf8");
const sizes = [[360,800],[390,844],[844,390],[768,1024],[1280,720],[1920,1080]];
const browser = await playwright.chromium.launch({ headless: true, args: ["--no-sandbox"], ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {}) });
try {
  for (const role of ["player", "dm"]) for (const [width, height] of sizes) {
    const page = await browser.newPage({ viewport: { width, height }, hasTouch: width < 900 });
    const pageErrors = [];
    page.on("pageerror", error => pageErrors.push(error.message));
    const markup = role === "player" ? '<nav id="hud-menu-dropdown"></nav>' : "<main>Panel Director</main>";
    await page.setContent("<!doctype html><html lang='es'><head><meta name='viewport' content='width=device-width,initial-scale=1'></head><body>" + markup + "</body></html>");
    await page.addStyleTag({ content: styles });
    await page.evaluate((role) => {
      class TestAudio {
        constructor(url = "") { this.src = url; this.volume = 0; this.readyState = 0; this.loop = false; }
        play() { return Promise.resolve(); }
        pause() {}
        load() {}
        removeAttribute(name) { this[name] = ""; }
        addEventListener() {}
      }
      window.Audio = TestAudio;
      if (role === "dm") {
        window.firebase = {
          apps: [{}],
          auth() { return { onAuthStateChanged: fn => fn({ uid: "dm-test" }) }; },
          database() { return { ref(path) {
            return {
              on(event, fn) { fn({ val: () => path === "campaña/config/dm_uid" ? "dm-test" : null }); },
              off() {}, child() { return this; },
              push() { return { key: "new-event" }; },
              set() { return Promise.resolve(); }
            };
          } }; }
        };
      }
    }, role);
    await page.addScriptTag({ content: script });
    await page.locator("#luminous-audio-open").click();
    const dialog = page.locator("#luminous-audio-panel");
    assert.equal(await dialog.isVisible(), true, role + " " + width);
    const geometry = await page.evaluate(() => {
      const rect = document.querySelector(".luminous-audio-card").getBoundingClientRect();
      return { x: rect.left, y: rect.top, right: rect.right, bottom: rect.bottom, scrollWidth: document.documentElement.scrollWidth };
    });
    assert.ok(geometry.x >= -1 && geometry.y >= -1, JSON.stringify({role,width,height,geometry}));
    assert.ok(geometry.right <= width + 1 && geometry.bottom <= height + 1, JSON.stringify({role,width,height,geometry}));
    assert.ok(geometry.scrollWidth <= width + 1, "horizontal overflow " + width);
    await page.locator('[data-audio-range="music"]').fill("25");
    assert.equal(await page.locator('[data-audio-value="music"]').textContent(), "25%");
    assert.equal(await page.locator("[data-audio-director]").isVisible(), role === "dm");
    if (role === "dm") assert.equal(await page.locator('[data-audio-command="play-music"]').isEnabled(), true);
    await page.locator("[data-audio-close]").click();
    assert.equal(await dialog.isVisible(), false);
    assert.deepEqual(pageErrors, [], JSON.stringify({role,width,height,pageErrors}));
    await page.close();
  }
  console.log("Audio options responsive: player/DM x six viewports OK");
} finally { await browser.close(); }
