import { test, expect } from "@playwright/test";

const actor = { nombre: "Aldara", titulo: "Guardián", icono: "Assets/Images/Buttons/Player.svg", expresiones: { Neutral: "Assets/Images/Buttons/Player.svg" } };
const sample = {
  "campaña/base_datos_npcs": { aldara: actor },
  "campaña/actores": {},
  "campaña/estado_mundo/escena_actual/actores": { active_aldara: actor }
};

async function mount(page) {
  await page.setContent(`<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body class="on-game-dashboard">
<section id="modulo-teatro">
  <details class="theatre-dm-menu" open>
    <summary class="theatre-dm-menu-toggle">Menú</summary>
    <div id="theatre-director-panel">
      <h3 class="panel-title">Control de casting</h3>
      <div class="npc-spawner-section">
        <select id="select-npc-roster">
          <option value="">Seleccionar personaje</option>
          <option value="aldara" data-source-type="npc">Aldara</option>
        </select>
        <button id="btn-spawn-npc" type="button">Añadir a escena</button>
      </div>
      <div id="live-actors-list"></div>
      <div class="scenario-library">
        <select id="theatre-scenario-select"><option>Escena</option></select>
        <input id="theatre-background-input" type="url">
      </div>
      <div class="theatre-controls theatre-dm-composer">
        <h4 class="theatre-dm-composer-title">Compositor de Diálogo</h4>
        <div class="theatre-dm-composer-selects">
          <select id="theatre-speaker-select">
            <option value="narrador">Narrador</option>
            <option value="active_aldara" data-icono="Assets/Images/Buttons/Player.svg" data-expresiones='{"Neutral":"Assets/Images/Buttons/Player.svg"}'>Aldara</option>
          </select>
          <select id="dm-tipo-dialogo-select"><option value="dialogo">Diálogo</option><option value="narracion">Narración</option></select>
          <select id="theatre-expression-select"><option>Neutral</option></select>
        </div>
        <div id="theatre-message-policy" class="theatre-message-policy">
          <div class="tmp-head">Control de mensajes</div>
          <div class="tmp-grid"><button id="btn-theatre-message-next" disabled>Siguiente</button></div>
        </div>
        <div class="theatre-dm-compose-action" data-theatre-compose-action>
          <label for="theatre-dialogue-input">Mensaje</label>
          <textarea id="theatre-dialogue-input"></textarea>
          <button id="btn-send-dialogue">Enviar</button>
        </div>
      </div>
      <div id="theatre-render-policy">
        <label>Máximo visible <select><option>5</option></select></label>
        <button type="button">Limpiar escena</button>
      </div>
    </div>
  </details>
</section>
<style>
body { margin: 0; background: #080808; }
#modulo-teatro { position: relative; height: 100dvh; overflow: hidden; }
.theatre-dm-menu { position: absolute; inset: 0; }
.theatre-dm-menu-toggle { position: absolute; right: 20px; top: 10px; color: white; }
#theatre-director-panel { position: absolute; right: 0; top: 0; bottom: 0; overflow: auto; }
</style>
</body></html>`);
  await page.evaluate((data) => {
    window.spawnedNpc = "";
    window.firebase = { database: () => ({
      ref(path) {
        return {
          on(_type, callback) { callback({ val: () => data[path] || {} }); }
        };
      }
    }) };
    window.LuminousTheatreState = { getPaths: () => ({ scene: "campaña/estado_mundo/escena_actual" }) };
    document.getElementById("btn-spawn-npc").addEventListener("click", () => {
      window.spawnedNpc = document.getElementById("select-npc-roster").value;
    });
    document.getElementById("btn-send-dialogue").addEventListener("click", () => {
      window.sentText = document.getElementById("theatre-dialogue-input").value;
    });
  }, sample);
  await page.addStyleTag({ path: "css/on-game-dashboard.css" });
  await page.addStyleTag({ path: "css/theatre-hud.css" });
  await page.addStyleTag({ path: "css/theatre-message-policy.css" });
  await page.addStyleTag({ path: "css/theatre-dm-workspace.css" });
  await page.addScriptTag({ path: "js/theatre-dm-workspace.js" });
}

for (const [width, height] of [[360, 800], [390, 844], [844, 390], [768, 1024], [1280, 720], [1920, 1080]]) {
  test(`DM Director at ${width}x${height}: tabs, portraits, casting, modal and input are reachable`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await mount(page);
    await expect(page.getByRole("tab", { name: "Hablar" })).toHaveAttribute("aria-selected", "true");
    await expect(page.locator("#dm-director-voice-grid .dm-director-voice")).toHaveCount(2);
    await page.locator("#dm-director-voice-grid .dm-director-voice").last().click();
    await expect(page.locator("#dm-theatre-composer-modal")).toBeVisible();
    await expect(page.locator("#theatre-speaker-select")).toHaveValue("active_aldara");
    await page.locator("#theatre-dialogue-input").fill("¡Bienvenidos!");
    await page.locator("#btn-send-dialogue").click();
    expect(await page.evaluate(() => window.sentText)).toBe("¡Bienvenidos!");
    await page.locator("#dm-theatre-composer-modal").getByRole("button", { name: "Cerrar" }).click();
    await expect(page.locator("#dm-theatre-composer-modal")).toBeHidden();
    await page.getByRole("tab", { name: "Elenco" }).click();
    await page.getByRole("button", { name: "Añadir al elenco: Aldara" }).click();
    expect(await page.evaluate(() => window.spawnedNpc)).toBe("aldara");
    await page.getByRole("tab", { name: "Escenas" }).click();
    await expect(page.locator("#theatre-scenario-select")).toBeVisible();
    await page.getByRole("tab", { name: "Ajustes" }).click();
    await expect(page.locator("#theatre-render-policy")).toBeVisible();
    const bounds = await page.locator("#theatre-director-panel").boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds.x).toBeGreaterThanOrEqual(-1);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(width + 1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width + 1);
  });
}

for (const [width, height] of [[360, 800], [390, 844], [844, 390], [768, 1024], [1280, 720], [1920, 1080]]) {
  test(`DM library and stale speaker regression at ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await mount(page);
    await page.getByRole("tab", { name: "Elenco" }).click();
    await page.evaluate(() => {
      const select = document.getElementById("select-npc-roster");
      select.replaceChildren(new Option("Seleccionar personaje", ""));
      for (let i = 0; i < 55; i++) select.appendChild(new Option("Guardia", "guard_" + i));
    });
    await expect(page.locator("#dm-director-roster-grid .dm-director-person-card")).toHaveCount(48);
    await page.getByRole("button", { name: "Mostrar más personajes" }).click();
    const cards = page.locator("#dm-director-roster-grid .dm-director-person-card");
    await expect(cards).toHaveCount(55);
    await cards.last().click();
    expect(await page.evaluate(() => window.spawnedNpc)).toBe("guard_54");
    await page.locator(".dm-director-search").fill("Guardia");
    await expect(cards).toHaveCount(48);
    await expect(page.getByRole("button", { name: "Mostrar más personajes" })).toBeVisible();

    // A stale card must never open a different character's composer.
    const stale = await page.evaluate(() => {
      document.getElementById("theatre-speaker-select").querySelector('option[value="active_aldara"]').remove();
      return window.LuminousDmTheatreWorkspace.openComposer("active_aldara");
    });
    expect(stale).toBe(false);
    await expect(page.locator("#dm-theatre-composer-modal")).toBeHidden();
    await expect(page.getByRole("status")).toContainText("ya no está disponible");
    await page.getByRole("button", { name: "Hablar como Narrador" }).click();
    await expect(page.locator("#dm-theatre-composer-modal")).toBeVisible();
    await expect(page.locator("#theatre-speaker-select")).toHaveValue("narrador");
    await page.keyboard.press("Escape");
    await expect(page.locator("#dm-theatre-composer-modal")).toBeHidden();
  });
}
