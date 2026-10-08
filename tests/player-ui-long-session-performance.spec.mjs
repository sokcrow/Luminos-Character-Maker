import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.LIFECYCLE_BASE_URL || "http://127.0.0.1:4173";
const ROOT = process.cwd();

const firebaseStub = `
(() => {
  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
  const state = {
    ".info": { connected: true },
    "campaña": {
      "hora_actual": "12:00",
      "calendario": { "año": 984, "mes": 1, "dia": 1, "clima": "Despejado" },
      "ajustes_globales": { "alijo_desbloqueado": false },
      "estado_mundo": {
        "instancia_activa": "ninguno",
        "tienda_activa": null,
        "mesa_crafteo_activa": false
      },
      "actores": {},
      "base_datos_npcs": {},
      "tiendas": {},
      "teatro": {
        "max_sprites": 4,
        "locacion": "",
        "fondo": "",
        "estado_actual": null,
        "log": {},
        "bloqueo_interaccion": false
      },
      "economia": { "contratos": {} },
      "comms": { "chats": {} },
      "jugadores": {
        "player_test": {
          "uid": "player-uid",
          "status": "approved",
          "characterName": "Performance Test",
          "phoneNumber": "LCM-0001",
          "ahn": 1000,
          "hp": 24,
          "hp_max": 24,
          "sp": 0,
          "luck": 2,
          "luck_max": 2,
          "xp": 0,
          "level": 1,
          "stats": {
            "fuerza": 10, "destreza": 10, "constitucion": 10,
            "inteligencia": 10, "sabiduria": 10, "carisma": 10
          },
          "baseStats": { "cuerpo": 1, "mente": 1, "alma": 1 },
          "modifiers": {},
          "perks": {},
          "humanPerks": {},
          "mails": {},
          "correos": {},
          "finance": { "transactionHistory": {} },
          "chats": {},
          "inventario_activo": {},
          "inventario_stash": {},
          "itemSchemaVersion": 3,
          "itemEquipmentRefs": {},
          "attunedItemInstanceIds": [],
          "characterBuild": { "classes": {} },
          "combatStats": { "hp_actual": 24, "hp_max": 24, "sp_actual": 0 }
        }
      }
    }
  };

  const listeners = new Map();
  const listenerOrigins = new Map();
  let pushId = 0;

  const normalize = (raw) => String(raw || "").replace(/^\\/+|\\/+$/g, "");
  const parts = (raw) => normalize(raw).split("/").filter(Boolean);

  function read(raw) {
    const p = parts(raw);
    let node = state;
    for (const key of p) {
      if (node == null || typeof node !== "object") return null;
      node = node[key];
    }
    return node === undefined ? null : node;
  }

  function write(raw, value) {
    const p = parts(raw);
    if (!p.length) return;
    let node = state;
    for (let i = 0; i < p.length - 1; i += 1) {
      const key = p[i];
      if (!node[key] || typeof node[key] !== "object") node[key] = {};
      node = node[key];
    }
    node[p[p.length - 1]] = clone(value);
  }

  function makeSnapshot(raw, explicitValue) {
    const normalized = normalize(raw);
    const value = arguments.length > 1 ? explicitValue : read(normalized);
    const key = parts(normalized).at(-1) || null;
    return {
      key,
      val: () => clone(value),
      exists: () => value !== null && value !== undefined,
      child: (name) => makeSnapshot(normalized + "/" + name),
      forEach(callback) {
        if (!value || typeof value !== "object") return false;
        for (const [childKey, childValue] of Object.entries(value)) {
          const child = makeSnapshot(normalized + "/" + childKey, childValue);
          if (callback(child) === true) return true;
        }
        return false;
      }
    };
  }

  function listenerKey(raw, event) {
    return normalize(raw) + "|" + String(event || "value");
  }

  function emit(raw, event = "value") {
    const key = listenerKey(raw, event);
    const handlers = [...(listeners.get(key) || [])];
    const snap = makeSnapshot(raw);
    handlers.forEach((handler) => queueMicrotask(() => handler(snap)));
  }

  function emitChild(parentRaw, event, childKey) {
    const key = listenerKey(parentRaw, event);
    const handlers = [...(listeners.get(key) || [])];
    const snap = makeSnapshot(normalize(parentRaw) + "/" + childKey);
    handlers.forEach((handler) => queueMicrotask(() => handler(snap)));
  }

  class Ref {
    constructor(raw, query = {}) {
      this.path = normalize(raw);
      this.query = query;
      this.key = parts(this.path).at(-1) || null;
    }
    child(name) { return new Ref(this.path + "/" + name); }
    orderByChild(name) { return new Ref(this.path, { ...this.query, orderByChild: name }); }
    equalTo(value) { return new Ref(this.path, { ...this.query, equalTo: value }); }
    limitToLast(value) { return new Ref(this.path, { ...this.query, limitToLast: value }); }
    _snapshot() {
      let value = read(this.path);
      if (this.query.orderByChild && Object.prototype.hasOwnProperty.call(this.query, "equalTo") && value && typeof value === "object") {
        value = Object.fromEntries(Object.entries(value).filter(([, item]) => item?.[this.query.orderByChild] === this.query.equalTo));
      }
      if (this.query.limitToLast && value && typeof value === "object") {
        const entries = Object.entries(value).slice(-Number(this.query.limitToLast));
        value = Object.fromEntries(entries);
      }
      return makeSnapshot(this.path, value);
    }
    on(event, handler) {
      const key = listenerKey(this.path, event);
      if (!listeners.has(key)) listeners.set(key, new Set());
      listeners.get(key).add(handler);
      if (!listenerOrigins.has(key)) listenerOrigins.set(key, new Map());
      listenerOrigins.get(key).set(
        handler,
        String(new Error("Firebase listener registered").stack || "")
          .split("\\n")
          .slice(1, 9)
          .join("\\n")
      );
      if (event === "value") queueMicrotask(() => handler(this._snapshot()));
      return handler;
    }
    off(event, handler) {
      if (!event) {
        for (const key of [...listeners.keys()]) {
          if (key.startsWith(this.path + "|")) {
            listeners.delete(key);
            listenerOrigins.delete(key);
          }
        }
        return;
      }
      const key = listenerKey(this.path, event);
      if (!handler) {
        listeners.delete(key);
        listenerOrigins.delete(key);
        return;
      }
      listeners.get(key)?.delete(handler);
      listenerOrigins.get(key)?.delete(handler);
    }
    once() { return Promise.resolve(this._snapshot()); }
    onDisconnect() { return { set: () => Promise.resolve() }; }
    set(value) {
      write(this.path, value);
      emit(this.path, "value");
      return Promise.resolve();
    }
    update(patch) {
      const current = read(this.path);
      const next = current && typeof current === "object" ? { ...current, ...clone(patch) } : clone(patch);
      write(this.path, next);
      emit(this.path, "value");
      return Promise.resolve();
    }
    remove() { return this.set(null); }
    push(value) {
      const child = this.child("mock_" + (++pushId));
      if (arguments.length) child.set(value);
      return child;
    }
    transaction(updateFn) {
      const next = updateFn(clone(read(this.path)));
      return this.set(next).then(() => ({ committed: true, snapshot: this._snapshot() }));
    }
  }

  const db = { ref: (raw) => new Ref(raw) };
  function database() { return db; }
  database.ServerValue = { TIMESTAMP: 1234567890 };

  const authState = {
    currentUser: { uid: "player-uid" },
    onAuthStateChanged(callback) {
      let active = true;
      queueMicrotask(() => { if (active) callback(authState.currentUser); });
      return () => { active = false; };
    }
  };
  function auth() { return authState; }

  window.__fakeFirebase = {
    emitPath(raw, value) {
      write(raw, value);
      emit(raw, "value");
    },
    emitPlayer(patch = {}) {
      const raw = "campaña/jugadores/player_test";
      const current = read(raw) || {};
      const next = { ...current, ...clone(patch) };
      write(raw, next);
      Object.keys(patch).forEach((childKey) => {
        const event = Object.prototype.hasOwnProperty.call(current, childKey) ? "child_changed" : "child_added";
        emitChild(raw, event, childKey);
      });
      emit(raw, "value");
    },
    listenerCount() {
      let count = 0;
      for (const set of listeners.values()) count += set.size;
      return count;
    },
    listenerKeys() {
      return [...listeners.entries()]
        .filter(([, handlers]) => handlers.size > 0)
        .map(([key]) => key)
        .sort();
    },
    listenerOrigins() {
      return Object.fromEntries(
        [...listenerOrigins.entries()]
          .map(([key, origins]) => [key, [...origins.values()]])
          .filter(([, origins]) => origins.length > 0)
      );
    }
  };

  window.firebase = {
    apps: [{}],
    initializeApp() {},
    database,
    auth
  };
})();
`;

async function installPageInstrumentation(page) {
  await page.addInitScript(() => {
    const nativeSetInterval = window.setInterval.bind(window);
    const nativeClearInterval = window.clearInterval.bind(window);
    const nativeClearTimeout = window.clearTimeout.bind(window);
    const active = new Map();

    window.setInterval = (fn, delay, ...args) => {
      const id = nativeSetInterval(fn, delay, ...args);
      active.set(id, {
        delay: Number(delay) || 0,
        stack: String(new Error("interval-created").stack || "")
      });
      return id;
    };
    window.clearInterval = (id) => {
      active.delete(id);
      return nativeClearInterval(id);
    };
    window.clearTimeout = (id) => {
      active.delete(id);
      return nativeClearTimeout(id);
    };
    window.__perfIntervalRegistry = {
      activeCount: () => active.size,
      details: () => [...active.values()].map((entry) => ({ ...entry }))
    };
  });

  await page.route("https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js", (route) =>
    route.fulfill({ status: 200, contentType: "application/javascript", body: firebaseStub })
  );
  for (const url of [
    "https://www.gstatic.com/firebasejs/8.10.1/firebase-auth.js",
    "https://www.gstatic.com/firebasejs/8.10.1/firebase-database.js"
  ]) {
    await page.route(url, (route) =>
      route.fulfill({ status: 200, contentType: "application/javascript", body: "" })
    );
  }

  await page.route(/https:\/\/(fonts\.googleapis\.com|fonts\.gstatic\.com|i\.imgur\.com|limbuscompany\.wiki\.gg)\/.*/, (route) =>
    route.fulfill({ status: 204, body: "" })
  );
}

test("source keeps the static player surface free of permanent polling and duplicate progression Firebase renders", async () => {
  const sheet = fs.readFileSync(path.join(ROOT, "hoja_personaje.js"), "utf8");
  const css = fs.readFileSync(path.join(ROOT, "hoja_personaje.css"), "utf8");
  const tree = fs.readFileSync(path.join(ROOT, "js/player-progression-tree.js"), "utf8");
  const allocation = fs.readFileSync(path.join(ROOT, "js/player-progression-level-allocation.js"), "utf8");
  const instance = fs.readFileSync(path.join(ROOT, "js/instance-control.js"), "utf8");

  expect(sheet).not.toContain("setInterval(() => {\n        const deviceNumberUI");
  expect(sheet).toContain('window.dispatchEvent(new CustomEvent("luminous:player-data"');
  expect(sheet).toContain('playerRef.on("child_changed"');
  expect(sheet).toContain("RUNTIME_IGNORED_PLAYER_KEYS");
  expect(sheet).not.toMatch(/playerRef\.on\(\s*["']value["']/);
  expect(sheet).toContain("lastCharacterSheetRenderSignature");
  expect(css).toContain("content-visibility: hidden");
  expect(css).not.toMatch(/animation:\s*scanline\s+[^;]*infinite/i);
  expect(tree).not.toContain('state.playerRef.on("value"');
  expect(allocation).not.toContain('state.playerRef.on("value"');
  expect(allocation).toContain("nextRenderSignature === state.renderSignature");
  const watchdog = fs.readFileSync(path.join(ROOT, "js/theatre-check-retry-watchdog.js"), "utf8");
  const statusEngine = fs.readFileSync(path.join(ROOT, "js/status-engine.js"), "utf8");
  const traitCatalog = fs.readFileSync(path.join(ROOT, "js/trait-catalog-core.js"), "utf8");
  const idleRuntimeFiles = [
    "js/player-stats-ability-bar.js",
    "js/player-splash-framing.js",
    "js/player-ux-polish-core.js",
    "js/player-stat-tooltip-runtime.js",
    "js/derived-stats-runtime.js",
    "js/rest-runtime-integration.js",
    "js/theatre-special-language-enforcement-hotfix.js",
    "js/theatre-special-language-log-hotfix.js",
    "js/canonical-race-integration.js",
    "js/existing-racial-stat-integration.js",
    "js/unit-rank-runtime.js",
    "js/injury-engine.js",
    "js/trait-formula-view-patch.js",
    "js/skill-trait-breakdown-patch.js",
    "js/milestone-revert-patch.js",
    "js/devil-lineage-runtime.js",
    "js/college-of-whispers-runtime.js",
    "js/spellcasting-runtime.js",
    "js/injury-equipment-runtime.js",
    "js/caster-spellcasting-traits-runtime.js",
    "js/spellcasting-basic-rules-runtime.js",
    "js/scene-time-runtime.js",
    "js/fixed-damage-runtime.js",
  ];
  expect(instance).toContain("syncPlayerCombatOcclusion");
  expect(watchdog).not.toContain("setInterval");
  expect(watchdog).toContain('addEventListener?.("online", start)');
  expect(statusEngine).toContain('browserContext() !== "combat"');
  expect(statusEngine).toContain("ensureCombatRuntimeGraph");
  expect(traitCatalog).not.toContain("barbarian-class-runtime.js");
  expect(traitCatalog).not.toContain("shield-duration-runtime.js");
  idleRuntimeFiles.forEach((file) => {
    const source = fs.readFileSync(path.join(ROOT, file), "utf8");
    expect(source, file).not.toMatch(/(?:global\.)?setInterval\s*\(/);
  });
});

test("mobile Theatre renders live dialogue and sprites on the real player sheet", async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 844, height: 390 },
    isMobile: true,
    hasTouch: true,
    userAgent: "Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 Chrome/140 Mobile Safari/537.36",
    colorScheme: "dark"
  });
  const page = await context.newPage();
  await installPageInstrumentation(page);
  await page.goto(BASE + "/hoja_personaje.html", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.datosJugador?.characterName === "Performance Test", null, { timeout: 20_000 });

  await page.evaluate(() => {
    const sprite = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='260'%3E%3Crect width='180' height='260' fill='%23b98a32'/%3E%3C/svg%3E";
    const background = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='9'%3E%3Crect width='16' height='9' fill='%23121212'/%3E%3C/svg%3E";

    window.__fakeFirebase.emitPath("campaña/estado_mundo/instancia_activa", "teatro");
    window.__fakeFirebase.emitPath("campaña/teatro/conocimiento_identidad/player_test/actor_mobile", { known: true });
    window.__fakeFirebase.emitPath("campaña/estado_mundo/escena_actual", {
      locacion: "Mobile Theatre",
      fondo: background,
      max_actores_visibles: 5,
      actores_visibles: ["actor_mobile"],
      actores: {
        actor_mobile: {
          nombre: "Mobile Actor",
          titulo: "Test",
          color_nombre: "#416268",
          color_titulo: "#3b2918",
          sprite,
          escala: 0.72,
          orientacion: "normal"
        }
      },
      active_actor: "actor_mobile",
      focus_mode: "dialogo",
      transitioning: false
    });
    window.__fakeFirebase.emitPath("campaña/estado_mundo/dialogo_activo", {
      actorId: "actor_mobile",
      nombre: "Mobile Actor",
      titulo: "Test",
      mensaje: "Mobile dialogue visible",
      color_nombre: "#416268",
      color_titulo: "#3b2918",
      tipo_dialogo: "dialogo",
      mostrar_identidad: true,
      startedAt: Date.now() - 5000,
      speedMs: 1
    });
  });

  await expect(page.locator("body")).toHaveClass(/player-instance-theatre/);
  await expect(page.locator("#theatre-view-player")).toHaveCSS("display", "flex");
  await expect(page.locator("#theatre-stage .theatre-sprite")).toHaveCount(1);
  await expect(page.locator("#dialogue-name")).not.toHaveText("");
  await expect(page.locator("#dialogue-text")).toContainText("Mobile dialogue visible", { timeout: 5_000 });
  await expect(page.locator("#theatre-location")).toContainText("Mobile Theatre");

  const surface = await page.evaluate(() => {
    const box = (selector) => {
      const node = document.querySelector(selector);
      if (!node) return null;
      const rect = node.getBoundingClientRect();
      const style = getComputedStyle(node);
      return {
        width: rect.width,
        height: rect.height,
        display: style.display,
        visibility: style.visibility,
        opacity: Number(style.opacity || 1),
        zIndex: Number.parseInt(style.zIndex || "0", 10) || 0
      };
    };
    return {
      theatre: box("#theatre-view-player"),
      stage: box("#theatre-stage"),
      dialogue: box("#theatre-view-player .theatre-dialogue-wrapper"),
      hud: box(".hud-sidebar-right"),
      sprite: box("#theatre-stage .theatre-sprite")
    };
  });

  for (const [name, entry] of Object.entries(surface)) {
    expect(entry, name).not.toBeNull();
    expect(entry.width, name + " width").toBeGreaterThan(0);
    expect(entry.height, name + " height").toBeGreaterThan(0);
    expect(entry.display, name + " display").not.toBe("none");
    expect(entry.visibility, name + " visibility").not.toBe("hidden");
    expect(entry.opacity, name + " opacity").toBeGreaterThan(0);
  }
  expect(surface.theatre.zIndex).toBeGreaterThan(3010);
  expect(surface.hud.zIndex).toBeGreaterThan(surface.theatre.zIndex);

  // The mobile entry gate is not the subject of this test; once gameplay is
  // active, every menu opened from the Theatre command rail must beat the
  // Theatre stacking context and remain touchable.
  await page.evaluate(() => {
    const gate = document.getElementById("player-mobile-entry-gate");
    if (gate) gate.hidden = true;
  });

  const ensureRailOpen = async () => {
    const rail = page.locator(".hud-sidebar-right");
    if (!(await rail.evaluate((node) => node.classList.contains("is-open")))) {
      await page.locator("#btn-toggle-hud-menu").tap();
    }
    await expect(rail).toHaveClass(/is-open/);
  };

  await ensureRailOpen();

  await page.locator('button[name="act_hud_stats"]').tap();
  await expect(page.locator("#stats-modal")).toBeVisible();
  const statsLayers = await page.evaluate(() => ({
    theatre: Number.parseInt(getComputedStyle(document.getElementById("theatre-view-player")).zIndex || "0", 10) || 0,
    modal: Number.parseInt(getComputedStyle(document.getElementById("stats-modal")).zIndex || "0", 10) || 0,
    pointerEvents: getComputedStyle(document.getElementById("stats-modal")).pointerEvents
  }));
  expect(statsLayers.modal).toBeGreaterThan(statsLayers.theatre);
  expect(statsLayers.pointerEvents).not.toBe("none");

  await page.locator('#stats-modal button[name="act_hud_close"]').tap();
  await expect(page.locator("#stats-modal")).toBeHidden();

  const hudCases = [
    ['button[name="act_hud_perks"]', "#perks-modal"],
    ['button[name="act_hud_skills"]', "#skills-modal"],
    ['button[name="act_hud_apego"]', "#apego-modal"]
  ];

  for (const [buttonSelector, modalSelector] of hudCases) {
    await page.locator("#btn-toggle-hud-menu").tap();
    await expect(page.locator(".hud-sidebar-right")).toHaveClass(/is-open/);
    await page.locator(buttonSelector).tap();
    await expect(page.locator(modalSelector)).toBeVisible();
    const layers = await page.evaluate((selector) => ({
      theatre: Number.parseInt(getComputedStyle(document.getElementById("theatre-view-player")).zIndex || "0", 10) || 0,
      modal: Number.parseInt(getComputedStyle(document.querySelector(selector)).zIndex || "0", 10) || 0
    }), modalSelector);
    expect(layers.modal).toBeGreaterThan(layers.theatre);
    await page.locator(`${modalSelector} button[name="act_hud_close"]`).tap();
    await expect(page.locator(modalSelector)).toBeHidden();
  }

  await ensureRailOpen();
  await page.locator("#btn-toggle-hud").tap();
  await expect(page.locator("#player-combat-hud")).toBeVisible();
  const vitalsLayers = await page.evaluate(() => ({
    theatre: Number.parseInt(getComputedStyle(document.getElementById("theatre-view-player")).zIndex || "0", 10) || 0,
    vitals: Number.parseInt(getComputedStyle(document.getElementById("player-combat-hud")).zIndex || "0", 10) || 0
  }));
  expect(vitalsLayers.vitals).toBeGreaterThan(vitalsLayers.theatre);
  await page.locator("#btn-toggle-hud").tap();
  await expect(page.locator("#player-combat-hud")).toBeHidden();

  await ensureRailOpen();
  await page.locator("#btn-toggle-theatre-log-player").tap();
  await expect(page.locator("#theatre-log-container")).toHaveClass(/open/);
  await page.locator("#btn-toggle-theatre-log-player").tap();
  await expect(page.locator("#theatre-log-container")).not.toHaveClass(/open/);

  await ensureRailOpen();

  await page.locator("#btn-global-inventory").tap();
  await expect(page.locator("#inventory-modal")).toHaveClass(/active/);
  await expect(page.locator("#inventory-modal")).toBeVisible();
  const inventoryLayers = await page.evaluate(() => ({
    theatre: Number.parseInt(getComputedStyle(document.getElementById("theatre-view-player")).zIndex || "0", 10) || 0,
    modal: Number.parseInt(getComputedStyle(document.getElementById("inventory-modal")).zIndex || "0", 10) || 0,
    pointerEvents: getComputedStyle(document.getElementById("inventory-modal")).pointerEvents
  }));
  expect(inventoryLayers.modal).toBeGreaterThan(inventoryLayers.theatre);
  expect(inventoryLayers.pointerEvents).not.toBe("none");

  await context.close();
});

test("real player sheet reaches interval-idle after boot", async ({ page }) => {
  await installPageInstrumentation(page);
  await page.goto(BASE + "/hoja_personaje.html", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.datosJugador?.characterName === "Performance Test", null, { timeout: 20_000 });
  await page.waitForTimeout(2_000);
  const runtimeState = await page.evaluate(() => ({
    intervals: window.__perfIntervalRegistry?.details?.() || [],
    firebaseListeners: window.__fakeFirebase?.listenerKeys?.() || [],
    listenerOrigins: window.__fakeFirebase?.listenerOrigins?.() || {},
  }));
  expect(runtimeState.intervals, JSON.stringify(runtimeState.intervals, null, 2)).toEqual([]);

  const forbiddenIdleListeners = [
    "campaña/actores|value",
    "campaña/base_datos_npcs|value",
    "campaña/teatro/log|value",
    "campaña/teatro/bloqueo_interaccion|value",
    "campaña/economia/contratos|value",
    "campaña/estado_mundo/mesa_crafteo_activa|value",
    "campaña/jugadores/player_test/inventario_activo|value",
    "campaña/jugadores/player_test/inventario_stash|value",
    "campaña/jugadores/player_test/settings/isMuted|value",
    "campaña/jugadores/player_test/finance/transactionHistory|value",
    "campaña/jugadores/player_test/correos|value",
    "campaña/jugadores/player_test/chats|value",
  ];
  forbiddenIdleListeners.forEach((listener) => {
    expect(runtimeState.firebaseListeners, JSON.stringify(runtimeState, null, 2)).not.toContain(listener);
  });
});

test("real player sheet stays stable for 60 seconds under background player updates", async ({ page }) => {
  test.setTimeout(110_000);
  await installPageInstrumentation(page);
  await page.goto(BASE + "/hoja_personaje.html", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.datosJugador?.characterName === "Performance Test", null, { timeout: 20_000 });
  // hoja_personaje.html removes its legacy system-loading overlay on a 5s
  // emergency fallback timer. That subtree is intentionally temporary, so do
  // not include it in the long-session DOM baseline.
  await page.waitForFunction(() => !document.getElementById("system-loading-overlay"), null, { timeout: 10_000 });
  await page.waitForTimeout(250);

  const result = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    // Establish the baseline only after the post-loading DOM has remained
    // unchanged for 3 continuous seconds. The final assertion below remains
    // exact, so real stacking/leaks still fail.
    let settledNodeCount = document.getElementsByTagName("*").length;
    let stableNodeSamples = 0;
    while (stableNodeSamples < 30) {
      await sleep(100);
      const nextNodeCount = document.getElementsByTagName("*").length;
      if (nextNodeCount === settledNodeCount) {
        stableNodeSamples += 1;
      } else {
        settledNodeCount = nextNodeCount;
        stableNodeSamples = 0;
      }
    }

    const watched = [
      document.getElementById("player-progression-tree-host"),
      document.getElementById("player-progression-level-allocation-host"),
      document.querySelector(".repeating_skills"),
      document.querySelector(".mail-inbox-list"),
      document.getElementById("lista-transacciones-banco")
    ].filter(Boolean);

    let heavyMutations = 0;
    const observer = new MutationObserver((records) => {
      heavyMutations += records.filter((record) => record.type === "childList").length;
    });
    watched.forEach((node) => observer.observe(node, { childList: true, subtree: true }));

    let runtimePlayerDataEvents = 0;
    const onRuntimePlayerData = () => { runtimePlayerDataEvents += 1; };
    window.addEventListener("luminous:player-data", onRuntimePlayerData);

    const baselineNodes = document.getElementsByTagName("*").length;
    const baselineIntervals = window.__perfIntervalRegistry?.activeCount?.() ?? -1;
    const baselineListeners = window.__fakeFirebase?.listenerCount?.() ?? -1;

    const buckets = Array.from({ length: 6 }, () => ({ frames: 0, maxDelta: 0 }));
    const started = performance.now();
    let lastFrame = started;
    let sampling = true;
    function sample(now) {
      if (!sampling) return;
      const bucket = Math.min(5, Math.floor((now - started) / 10_000));
      if (bucket >= 0) {
        buckets[bucket].frames += 1;
        buckets[bucket].maxDelta = Math.max(buckets[bucket].maxDelta, now - lastFrame);
      }
      lastFrame = now;
      requestAnimationFrame(sample);
    }
    requestAnimationFrame(sample);

    let updates = 0;
    const targetUpdates = 600;
    while (performance.now() - started < 60_000) {
      // Drive load from elapsed wall time, not from callback frequency. GitHub
      // runners can heavily clamp timers, but the same 60-second soak must still
      // deliver the same amount of player-node churn.
      const elapsed = Math.min(60_000, performance.now() - started);
      const expectedSoFar = Math.min(
        targetUpdates,
        Math.max(1, Math.ceil((elapsed / 60_000) * targetUpdates)),
      );
      while (updates < expectedSoFar) {
        window.__fakeFirebase.emitPlayer({ backgroundHeartbeat: updates });
        updates += 1;
      }
      await sleep(100);
    }
    while (updates < targetUpdates) {
      window.__fakeFirebase.emitPlayer({ backgroundHeartbeat: updates });
      updates += 1;
    }
    await sleep(0);

    sampling = false;
    await sleep(100);
    observer.disconnect();
    window.removeEventListener("luminous:player-data", onRuntimePlayerData);

    const toggle = document.getElementById("btn-toggle-phone");
    const initialPhoneHidden = document.querySelector(".sheet-phone-wrapper")?.classList.contains("phone-hidden") ?? null;
    for (let i = 0; i < 720; i += 1) toggle?.click();
    await sleep(50);

    return {
      buckets,
      updates,
      heavyMutations,
      runtimePlayerDataEvents,
      baselineNodes,
      finalNodes: document.getElementsByTagName("*").length,
      baselineIntervals,
      finalIntervals: window.__perfIntervalRegistry?.activeCount?.() ?? -1,
      baselineListeners,
      finalListeners: window.__fakeFirebase?.listenerCount?.() ?? -1,
      initialPhoneHidden,
      phoneHidden: document.querySelector(".sheet-phone-wrapper")?.classList.contains("phone-hidden") ?? null
    };
  });

  expect(result.updates).toBeGreaterThanOrEqual(500);
  expect(result.runtimePlayerDataEvents).toBe(0);
  expect(result.baselineIntervals).toBe(0);
  expect(result.finalIntervals).toBe(0);
  expect(result.finalListeners).toBe(result.baselineListeners);
  expect(result.finalNodes).toBe(result.baselineNodes);
  expect(result.heavyMutations).toBe(0);
  expect(result.phoneHidden).toBe(result.initialPhoneHidden);

  const first = result.buckets[0].frames;
  const last = result.buckets.at(-1).frames;
  expect(first).toBeGreaterThan(200);
  expect(last).toBeGreaterThanOrEqual(Math.floor(first * 0.75));
  expect(result.buckets.at(-1).maxDelta).toBeLessThan(500);
});

test("terminal/combat visibility can cycle 720 times without stacking Battle viewers", async ({ page }) => {
  await page.goto(BASE + "/index.html", { waitUntil: "domcontentloaded" });
  await page.setContent(`
    <!doctype html><html><head>
      <link rel="stylesheet" href="/hoja_personaje.css">
    </head><body>
      <div class="sheet-phone-wrapper"></div>
      <div id="theatre-view-player" style="display:none"></div>
      <div id="player-instance-blackout"></div>
      <script src="/js/instance-control.js"></script>
    </body></html>
  `);
  await page.waitForFunction(() => Boolean(window.LuminousInstanceControl));

  await page.evaluate(() => window.LuminousInstanceControl.applyPlayerInstance("combate"));
  await expect(page.locator("#player-instance-combat")).toHaveCount(1);
  await expect(page.locator("#player-instance-combat")).toHaveCSS("visibility", "hidden");
  await expect(page.locator("#player-instance-combat")).toHaveAttribute("aria-hidden", "true");

  const cycled = await page.evaluate(() => {
    const control = window.LuminousInstanceControl;
    const phone = document.querySelector(".sheet-phone-wrapper");
    const originalFrame = document.getElementById("player-instance-combat");

    for (let i = 0; i < 720; i += 1) {
      phone.classList.toggle("phone-hidden");
      control.syncPlayerCombatOcclusion(document);
      if (document.querySelectorAll("#player-instance-combat").length !== 1) return false;
      if (document.getElementById("player-instance-combat") !== originalFrame) return false;
    }

    return {
      stable: true,
      frameCount: document.querySelectorAll("#player-instance-combat").length,
      phoneHidden: phone.classList.contains("phone-hidden"),
      visibility: originalFrame.style.visibility,
      ariaHidden: originalFrame.getAttribute("aria-hidden")
    };
  });

  expect(cycled).toEqual({
    stable: true,
    frameCount: 1,
    phoneHidden: false,
    visibility: "hidden",
    ariaHidden: "true"
  });

  await page.evaluate(() => {
    const phone = document.querySelector(".sheet-phone-wrapper");
    phone.classList.add("phone-hidden");
    window.LuminousInstanceControl.syncPlayerCombatOcclusion(document);
  });
  await expect(page.locator("#player-instance-combat")).toHaveCSS("visibility", "visible");
  await expect(page.locator("#player-instance-combat")).toHaveAttribute("aria-hidden", "false");

  const hiddenStyle = await page.locator(".sheet-phone-wrapper").evaluate((node) => getComputedStyle(node).contentVisibility);
  expect(hiddenStyle).toBe("hidden");

  await page.evaluate(() => window.LuminousInstanceControl.applyPlayerInstance("teatro"));
  await expect(page.locator("#player-instance-combat")).toHaveCount(0);
});


test("stats HUD keeps fixed geometry and scrolls internally when content changes", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(BASE + "/index.html", { waitUntil: "domcontentloaded" });
  await page.setContent(`
    <!doctype html>
    <html>
      <head>
        <link rel="stylesheet" href="${BASE}/hoja_personaje.css">
        <link rel="stylesheet" href="${BASE}/css/player-stats-ability-bar.css">
      </head>
      <body>
        <div id="stats-modal" class="hud-modal modal-stats active">
          <div class="hud-modal-content">
            <button type="button" class="hud-modal-close">×</button>
            <div class="hud-modal-body">
              <div class="hud-tab-content">
                <div class="stats-header">
                  <div class="toggle-container">Modo Auto</div>
                </div>
                <div id="stats-container"></div>
              </div>
            </div>
          </div>
        </div>
        <script>
          window.datosJugador = {
            characterName: "Fixed Geometry Test",
            level: 20,
            xp: 150,
            stats: {
              fuerza: 12, destreza: 14, constitucion: 13,
              inteligencia: 16, sabiduria: 11, carisma: 15
            },
            combatStats: { hp_actual: 27, hp_max: 40, sp_actual: 5 }
          };
        </script>
        <script src="${BASE}/js/player-stats-ability-bar.js"></script>
      </body>
    </html>
  `, { waitUntil: "load" });

  await page.waitForFunction(() =>
    Boolean(window.LuminousPlayerStats && document.querySelector("#stats-modal .player-stats-frame"))
  );

  const geometry = () => page.evaluate(() => {
    const content = document.querySelector("#stats-modal .hud-modal-content");
    const wrapper = document.querySelector("#stats-modal .hud-tab-content");
    const statsContainer = document.querySelector("#stats-modal #stats-container");
    const frame = document.querySelector("#stats-modal .player-stats-frame");
    const art = document.querySelector("#stats-modal .player-stats-character-panel");
    const info = document.querySelector("#stats-modal .player-stats-information-panel");
    const abilityBar = document.querySelector("#stats-modal .player-ability-bar");
    const rect = content.getBoundingClientRect();
    const normalize = (node) => {
      const child = node.getBoundingClientRect();
      return {
        x: (child.left - rect.left) / rect.width,
        y: (child.top - rect.top) / rect.height,
        width: child.width / rect.width,
        height: child.height / rect.height,
      };
    };
    return {
      contentCssWidth: getComputedStyle(content).width,
      contentCssHeight: getComputedStyle(content).height,
      renderedWidth: rect.width,
      renderedHeight: rect.height,
      scale: Number(document.getElementById("stats-modal").dataset.playerStatsHudScale || 1),
      bodyOverflowY: getComputedStyle(document.querySelector("#stats-modal .hud-modal-body")).overflowY,
      wrapperOverflowY: getComputedStyle(wrapper).overflowY,
      wrapper: normalize(wrapper),
      statsContainer: normalize(statsContainer),
      frameDisplay: getComputedStyle(frame).display,
      frameColumns: getComputedStyle(frame).gridTemplateColumns,
      abilityColumns: getComputedStyle(abilityBar).gridTemplateColumns,
      art: normalize(art),
      info: normalize(info),
      abilityBar: normalize(abilityBar),
    };
  });

  const desktop = await geometry();
  expect(desktop.contentCssWidth).toBe("1600px");
  expect(desktop.contentCssHeight).toBe("920px");
  expect(desktop.bodyOverflowY).toBe("hidden");
  expect(desktop.wrapperOverflowY).toBe("hidden");
  expect(desktop.statsContainer.y).toBeCloseTo(desktop.wrapper.y, 3);
  expect(desktop.statsContainer.height).toBeCloseTo(desktop.wrapper.height, 3);
  expect(desktop.frameDisplay).toBe("grid");
  expect(desktop.art.width).toBeCloseTo(0.5, 2);
  expect(desktop.info.x).toBeCloseTo(0.5, 2);

  await page.setViewportSize({ width: 760, height: 640 });
  await page.evaluate(() => window.LuminousPlayerStats.syncHudCanvasScale());
  const compact = await geometry();

  expect(compact.scale).toBeLessThan(desktop.scale);
  expect(compact.contentCssWidth).toBe(desktop.contentCssWidth);
  expect(compact.contentCssHeight).toBe(desktop.contentCssHeight);
  expect(compact.frameColumns).toBe(desktop.frameColumns);
  expect(compact.abilityColumns).toBe(desktop.abilityColumns);
  expect(compact.frameDisplay).toBe("grid");
  expect(compact.bodyOverflowY).toBe("hidden");
  expect(compact.wrapperOverflowY).toBe("hidden");
  expect(compact.wrapper.y).toBeCloseTo(desktop.wrapper.y, 3);
  expect(compact.wrapper.height).toBeCloseTo(desktop.wrapper.height, 3);
  expect(compact.statsContainer.y).toBeCloseTo(desktop.statsContainer.y, 3);
  expect(compact.statsContainer.height).toBeCloseTo(desktop.statsContainer.height, 3);
  expect(compact.art.x).toBeCloseTo(desktop.art.x, 3);
  expect(compact.art.y).toBeCloseTo(desktop.art.y, 3);
  expect(compact.art.width).toBeCloseTo(desktop.art.width, 3);
  expect(compact.art.height).toBeCloseTo(desktop.art.height, 3);
  expect(compact.info.x).toBeCloseTo(desktop.info.x, 3);
  expect(compact.info.width).toBeCloseTo(desktop.info.width, 3);
  expect(compact.abilityBar.y).toBeCloseTo(desktop.abilityBar.y, 3);
  expect(compact.abilityBar.height).toBeCloseTo(desktop.abilityBar.height, 3);

  const beforeOverflow = await geometry();
  const overflow = await page.evaluate(() => {
    const skills = document.querySelector("#stats-modal .player-skill-list");
    const resistances = document.querySelector("#stats-modal .player-resistance-list");

    skills.replaceChildren(...Array.from({ length: 80 }, (_, index) => {
      const row = document.createElement("button");
      row.type = "button";
      row.className = "dnd-skill";
      row.innerHTML = `<span class="skill-proficiency"></span><span class="dnd-skill-name">Skill ${index}</span><strong class="dnd-skill-value">+${index}</strong>`;
      return row;
    }));

    resistances.replaceChildren(...Array.from({ length: 40 }, (_, index) => {
      const row = document.createElement("div");
      row.className = "player-resistance-item";
      row.textContent = `Resistance ${index}`;
      return row;
    }));

    const metrics = (node) => ({
      clientHeight: node.clientHeight,
      scrollHeight: node.scrollHeight,
      overflowY: getComputedStyle(node).overflowY,
    });

    skills.scrollTop = skills.scrollHeight;
    resistances.scrollTop = resistances.scrollHeight;

    return {
      skills: { ...metrics(skills), scrollTop: skills.scrollTop },
      resistances: { ...metrics(resistances), scrollTop: resistances.scrollTop },
      modalBodyOverflowY: getComputedStyle(document.querySelector("#stats-modal .hud-modal-body")).overflowY,
    };
  });
  const afterOverflow = await geometry();

  expect(overflow.modalBodyOverflowY).toBe("hidden");
  expect(overflow.skills.overflowY).toBe("auto");
  expect(overflow.skills.scrollHeight).toBeGreaterThan(overflow.skills.clientHeight);
  expect(overflow.skills.scrollTop).toBeGreaterThan(0);
  expect(overflow.resistances.overflowY).toBe("auto");
  expect(overflow.resistances.scrollHeight).toBeGreaterThan(overflow.resistances.clientHeight);
  expect(overflow.resistances.scrollTop).toBeGreaterThan(0);

  expect(afterOverflow.art.x).toBeCloseTo(beforeOverflow.art.x, 3);
  expect(afterOverflow.art.y).toBeCloseTo(beforeOverflow.art.y, 3);
  expect(afterOverflow.art.width).toBeCloseTo(beforeOverflow.art.width, 3);
  expect(afterOverflow.art.height).toBeCloseTo(beforeOverflow.art.height, 3);
});


test("trait player tray source stays syntactically valid", () => {
  const source = fs.readFileSync(path.join(ROOT, "js", "trait-player-tray.js"), "utf8");
  expect(() => new Function(source)).not.toThrow();
});

test("shared trait formula display resolves class and archetype formulas without per-trait display metadata", async ({ page }) => {
  await page.setContent(`
    <!doctype html>
    <html>
      <head>
        <link id="player-trait-tabs-stylesheet" rel="stylesheet" href="${BASE}/css/player-trait-tabs.css">
      </head>
      <body>
        <div id="perks-modal"><div id="trait-test-host"></div></div>
        <script src="${BASE}/js/trait-engine.js"></script>
        <script src="${BASE}/js/trait-player-tray.js"></script>
        <script>
          const character = {
            level: 50,
            classLevels: { rogue: 40, barbarian: 28 },
            stats: {
              fuerza: 14, destreza: 16, constitucion: 14,
              inteligencia: 12, sabiduria: 18, carisma: 16
            }
          };
          const traits = [
            {
              schemaVersion: 1,
              id: "test_rogue_formula",
              name: "Sneak Formula",
              description: "Deal +max(1, floor(Rogue Class Level / 2))% Damage.",
              source: { type: "class", id: "rogue", classId: "rogue", className: "Rogue" },
              contexts: ["any"],
              activation: { type: "passive", actionCost: "none" },
              effects: [],
              rules: [],
              mechanics: { unopposedDamagePercentFormula: "max(1, floor(ClassLevel / 2))" }
            },
            {
              schemaVersion: 1,
              id: "test_zealot_formula",
              name: "Zealot Formula",
              description: "At Turn Start, all Allies gain Shield equal to floor(Class Level / 4).",
              source: {
                type: "archetype",
                id: "path_of_the_zealot",
                archetypeId: "path_of_the_zealot",
                classId: "barbarian",
                className: "Barbarian"
              },
              contexts: ["any"],
              activation: { type: "passive", actionCost: "none" },
              effects: [],
              rules: [],
              mechanics: { shieldFormula: "floor(ClassLevel / 4)" }
            },
            {
              schemaVersion: 1,
              id: "test_dynamic_formula",
              name: "Dynamic Formula",
              description: "Reduce incoming Damage by 10% × Spell Slot Level.",
              source: { type: "archetype", id: "bladesinger", classId: "wizard", className: "Wizard" },
              contexts: ["any"],
              activation: { type: "passive", actionCost: "none" },
              effects: [],
              rules: [],
              mechanics: { damageReductionPercentFormula: "10 * SpellSlotLevel" }
            }
          ];
          window.__traitTray = window.LuminousTraitPlayerTray.mount({
            host: "#trait-test-host",
            traits,
            runtime: { context: "theatre", character }
          });
        </script>
      </body>
    </html>
  `, { waitUntil: "load" });

  const rogue = page.locator('[data-trait-id="test_rogue_formula"]');
  const zealot = page.locator('[data-trait-id="test_zealot_formula"]');
  const dynamic = page.locator('[data-trait-id="test_dynamic_formula"]');
  const playerFacingText = async (card) => card.locator(".player-trait-card__description").evaluate((node) => {
    const copy = node.cloneNode(true);
    copy.querySelectorAll(".player-trait-formula-tooltip").forEach((tooltip) => tooltip.remove());
    return copy.textContent || "";
  });

  const rogueText = await playerFacingText(rogue);
  expect(rogueText).toContain("Deal +20% Damage.");
  expect(rogueText).not.toContain("floor(");
  expect(rogueText).not.toContain("Class Level / 2");

  const zealotText = await playerFacingText(zealot);
  expect(zealotText).toContain("Shield equal to 7");
  expect(zealotText).not.toContain("floor(");
  expect(zealotText).not.toContain("Class Level / 4");

  const pending = dynamic.locator(".player-trait-resolved-value.is-pending").first();
  await expect(pending.locator(".player-trait-resolved-value__display")).toHaveText("pending");
  await expect(pending.locator(".player-trait-formula-tooltip")).toHaveCount(0);
  const dynamicText = await playerFacingText(dynamic);
  expect(dynamicText).toContain("pending");
  expect(dynamicText).not.toContain("Spell Slot Level");
});

test("trait formula breakdown stays hidden until clicked and closes with Escape", async ({ page }) => {
  await page.setContent(`
    <!doctype html>
    <html>
      <head>
        <link id="player-trait-tabs-stylesheet" rel="stylesheet" href="${BASE}/css/player-trait-tabs.css">
      </head>
      <body>
        <div id="stats-modal"><div id="trait-disclosure-host"></div></div>
        <script src="${BASE}/js/trait-engine.js"></script>
        <script src="${BASE}/js/trait-player-tray.js"></script>
        <script>
          window.LuminousTraitPlayerTray.mount({
            host: "#trait-disclosure-host",
            traits: [{
              schemaVersion: 1,
              id: "shift_formula_trait",
              name: "Shift Formula",
              description: "Deal max(10, 10 × WIS Mod)% Damage.",
              source: { type: "class", id: "ranger", classId: "ranger", className: "Ranger" },
              contexts: ["any"],
              activation: { type: "passive", actionCost: "none" },
              effects: [],
              rules: [],
              mechanics: { damagePercentFormula: "max(10, 10 * WisdomMod)" }
            }],
            runtime: {
              context: "theatre",
              character: {
                level: 50,
                classLevels: { ranger: 50 },
                stats: { sabiduria: 18 }
              }
            }
          });
        </script>
      </body>
    </html>
  `, { waitUntil: "load" });

  const card = page.locator('[data-trait-id="shift_formula_trait"]');
  const value = card.locator(".player-trait-resolved-value").first();
  const panel = card.locator(".player-trait-formula-tooltip").first();
  await expect(value).toHaveAttribute("aria-controls", await panel.getAttribute("id"));
  await expect(value).toHaveAttribute("aria-expanded", "false");
  await expect(panel).toBeHidden();

  await value.hover();
  await expect(panel).toBeHidden();
  await page.keyboard.down("Shift");
  await expect(panel).toBeHidden();
  await page.keyboard.up("Shift");

  await value.click();
  await expect(value).toHaveAttribute("aria-expanded", "true");
  await expect(panel).toBeVisible();
  await expect(panel).toContainText("WIS Mod");
  await expect(panel).toContainText("Total:");
  await expect(panel).not.toContainText("Formula:");

  await page.keyboard.press("Escape");
  await expect(value).toHaveAttribute("aria-expanded", "false");
  await expect(panel).toBeHidden();

  await value.click();
  await expect(panel).toBeVisible();
  await value.click();
  await expect(panel).toBeHidden();
});


for (const width of [390, 1280]) {
  test(`Avance milestone and archetype selection at ${width}px`, async ({ page }) => {
    await page.goto(BASE + "/index.html");
    await page.setViewportSize({ width, height: width < 700 ? 844 : 900 });
    await page.setContent(`
      <!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1">
      <link rel="stylesheet" href="${BASE}/css/player-progression-tree.css">
      <style>
        body {margin:0; background:#0b0a09}
        #perks-modal {display:flex; justify-content:center; align-items:center; min-height:100dvh}
        .hud-modal-content {display:flex; flex-direction:column; position:relative}
        .hud-modal-body {overflow:auto}
      </style></head><body>
      <div id="perks-modal" class="hud-modal modal-progression active">
        <div class="hud-modal-content">
          <div class="hud-modal-body">
            <section class="player-progression-shell">
              <header class="player-progression-heading"><h2>PROGRESIÓN</h2></header>
              <div id="player-progression-tree-host"></div>
              <aside id="player-progression-detail"></aside>
            </section>
          </div>
        </div>
      </div>
      <script>
        window.currentPlayerId = "browser_test";
        window.__savedArchetypes = [];
        window.__denySelection = true;
        window.datosJugador = {
          level:20,
          characterBuild:{classes:[{classId:"monk",levels:20}],archetypes:[]}
        };
        window.LuminousCharacterBuildRules = {CLASSES:[{id:"monk",name:"Monk"}]};
        window.LuminousTraitCatalogCore = {
          allDefinitions:()=>({
            monk_base:{id:"monk_base",name:"Base Milestone",description:"Milestone reward"},
            monk_burst:{id:"monk_burst",name:"Burst Milestone",description:"Higher reward"}
          }),
          allGrants:()=>[
            {sourceType:"class",sourceId:"monk",classId:"monk",atLevel:5,traitId:"monk_base"},
            {sourceType:"class",sourceId:"monk",classId:"monk",atLevel:20,traitId:"monk_burst"}
          ]
        };
        window.LuminousArchetypeTraitCatalog = {
          allArchetypes:()=>({
            shadow:{id:"shadow",classId:"monk",name:"Shadow Monk",description:"Stealth choices",unlockLevel:15,traitLevels:[15,35]},
            sun:{id:"sun",classId:"monk",name:"Sun Monk",description:"Radiant choices",unlockLevel:15,traitLevels:[15,35]},
            high:{id:"high",classId:"monk",name:"High Monk",unlockLevel:35,traitLevels:[35,50]}
          }),
          allDefinitions:()=>({}),allGrants:()=>[]
        };
        window.firebase = {apps:[{}],database:()=>({
          ref:(path)=>({set:async (value)=>{
            if (window.__denySelection) throw new Error("Firebase rejected write");
            window.__savedArchetypes.push({path,value});
          }})
        })};
      </script>
      <script src="${BASE}/js/archetype-engine.js"></script>
      <script src="${BASE}/js/player-progression-tree-core.js"></script>
      <script src="${BASE}/js/player-progression-tree.js"></script>
      </body></html>
    `, { waitUntil: "load" });

    const tree = page.locator(".player-progression-ritual-tree");
    const viewport = page.locator(".player-progression-mystic-scroll");
    await expect(page.locator("#player-progression-mystic-stylesheet")).toHaveCount(1);
    // Class identity is rendered from the local PNG, not a generic SVG.
    const rootIcon = tree.locator(".player-progression-root__seal .player-progression-class-icon");
    await expect(rootIcon).toHaveCount(1);
    await expect(rootIcon).toHaveAttribute("src", "Assets/Icons/classes/monk.png");
    await expect.poll(() => rootIcon.evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true);
    await expect(tree.locator(".player-progression-milestone-list .player-progression-node__seal .player-progression-class-icon")).toHaveCount(2);
    await expect(tree.locator(".player-progression-fork")).toHaveCount(1);
    await expect(tree.locator(".player-progression-branch-preview__seal svg")).toHaveCount(3);
    await expect(tree.locator(".player-progression-archetype-list")).toHaveCSS("display", "grid");
    const geometry = await viewport.evaluate(el => ({
      content:el.scrollWidth,visible:el.clientWidth,
      rootConnector:getComputedStyle(el.querySelector(".player-progression-root"),"::after").content,
      forkConnector:getComputedStyle(el.querySelector(".player-progression-archetype-list"),"::before").content
    }));
    expect(geometry.rootConnector).not.toBe("none");
    expect(geometry.forkConnector).not.toBe("none");
    expect(geometry.content > geometry.visible + 2).toBe(width < 700);
    if (width < 700) {
      const start = await viewport.evaluate(el => el.scrollLeft);
      await page.getByRole("button",{name:"Desplazar árbol hacia la derecha"}).click();
      await expect.poll(() => viewport.evaluate(el => el.scrollLeft)).toBeGreaterThan(start);
    }
    const milestones = page.locator(".player-progression-milestone-list .player-progression-node");
    await expect(milestones).toHaveCount(2);
    await milestones.first().click();
    await expect(milestones.first()).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("#player-progression-detail")).toContainText("Base Milestone");
    await milestones.last().click();
    await expect(milestones.first()).toHaveAttribute("aria-pressed", "false");
    await expect(page.locator("#player-progression-detail")).toContainText("Burst Milestone");

    const archetypes = page.locator(".player-progression-archetype-list");
    await expect(archetypes.locator(".player-progression-branch-label")).toHaveCount(3);
    await expect(archetypes.locator(".player-progression-branch-milestones .player-progression-node")).toHaveCount(6);
    await expect(archetypes.locator(".is-future")).toContainText("DISPONIBLE EN LV. 35");
    const shadow = archetypes.locator(".player-progression-branch-label").filter({hasText:"Shadow Monk"});
    await shadow.locator(".player-progression-branch-milestones .player-progression-node").first().click();
    await expect(page.locator("#player-progression-detail")).toContainText("Hito · Nivel 15");
    await shadow.locator(".player-progression-branch-preview").click();
    await expect(page.locator("#player-progression-detail")).toContainText("Shadow Monk");

    const choose = shadow.getByRole("button", {name:"Elegir Shadow Monk para Monk"});
    await expect(choose).toBeEnabled();
    await choose.click();
    await expect(shadow.locator(".player-progression-choose-error")).toContainText("Firebase rejected write");
    expect(await page.evaluate(() => window.__savedArchetypes)).toHaveLength(0);
    expect(await page.evaluate(() => window.datosJugador.characterBuild.archetypes)).toHaveLength(0);

    await page.evaluate(() => window.__denySelection = false);
    await choose.click();
    await expect(archetypes.locator(".player-progression-branch-label.is-selected")).toContainText("Shadow Monk");
    await expect(page.locator("#player-progression-detail")).toContainText("Shadow Monk");
    expect(await page.evaluate(() => window.__savedArchetypes)).toEqual([{
      path:"campaña/jugadores/browser_test/characterBuild/archetypes",
      value:[{classId:"monk",archetypeId:"shadow",selectedAtClassLevel:20}]
    }]);
    await expect(archetypes.locator(".player-progression-branch-label.is-locked").filter({ hasText: "Sun Monk" })).toContainText("Sun Monk");
    const noOverflow = await page.locator(".player-progression-class").evaluate(el => el.scrollWidth <= el.clientWidth + 2);
    expect(noOverflow).toBe(true);
  });
}


for (const width of [390, 1280]) {
  test(`Avance class milestone and Battle Master maneuver picks at ${width}px`, async ({ page }) => {
    await page.goto(BASE + "/index.html");
    await page.setViewportSize({ width, height: width < 700 ? 844 : 900 });
    await page.setContent(`
      <!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
      <link rel="stylesheet" href="${BASE}/css/player-progression-tree.css">
      <link rel="stylesheet" href="${BASE}/css/player-progression-mystic.css">
      <style>
        body{margin:0;background:#080808}
        #perks-modal{display:flex;justify-content:center;align-items:center;min-height:100dvh}
        .hud-modal-content{display:flex;flex-direction:column;position:relative}
        .hud-modal-body{overflow:auto}
      </style></head><body>
        <div id="perks-modal" class="hud-modal modal-progression active"><div class="hud-modal-content">
          <div class="hud-modal-body"><section class="player-progression-shell">
            <header class="player-progression-heading"><h2>AVANCE</h2></header>
            <div id="player-progression-tree-host"></div>
            <aside id="player-progression-detail"></aside>
          </section></div>
        </div></div>
      <script>
        window.currentPlayerId = "choice_test";
        window.datosJugador = {
          level:40,
          stats:{fuerza:14,destreza:12,constitucion:13,inteligencia:10,sabiduria:11,carisma:12},
          characterBuild:{
            classes:[{classId:"fighter",levels:40}],
            archetypes:[{classId:"fighter",archetypeId:"battle_master"}],
            classMilestones:{}
          }
        };
        window.__server = structuredClone(window.datosJugador);
        window.__rejectWrite = false;
        window.__writes = 0;
        window.firebase = {apps:[{}],database:()=>({
          ref: path=>({
            once:async()=>({val:()=>({
              general_keen:{id:"general_keen",name:"Keen Eye",description:"Improved observation.",source:{type:"general"}}
            })}),
            transaction:async update=>{
              if(window.__rejectWrite)throw new Error("Firebase rejected write");
              const next=update(structuredClone(window.__server));
              if(next===undefined)return {committed:false,snapshot:{val:()=>structuredClone(window.__server)}};
              window.__server=structuredClone(next);
              window.__writes++;
              return {committed:true,snapshot:{val:()=>structuredClone(window.__server)}};
            }
          })
        })};
        window.LuminousCharacterBuildRules = {CLASSES:[{id:"fighter",name:"Fighter"}]};
        window.LuminousTraitCatalogCore = {
          allGrants:()=>[],allDefinitions:()=>({
            general_keen:{id:"general_keen",name:"Keen Eye",description:"Improved observation.",source:{type:"general"}}
          })
        };
      </script>
      <script src="${BASE}/js/archetype-engine.js"></script>
      <script src="${BASE}/js/archetype-trait-catalog.js"></script>
      <script src="${BASE}/js/archetype-progression-preview-catalog.js"></script>
      <script src="${BASE}/js/class-milestone-engine.js"></script>
      <script src="${BASE}/js/fighter-maneuver-catalog.js"></script>
      <script src="${BASE}/js/player-progression-tree-core.js"></script>
      <script src="${BASE}/js/player-progression-choices.js"></script>
      <script src="${BASE}/js/player-progression-tree.js"></script>
    </body></html>`, {waitUntil:"load"});

    const fighter = page.locator(".player-progression-class");
    const level20 = page.locator('[data-progression-key="fighter:milestone:base:20"]');
    const level30 = page.locator('[data-progression-key="fighter:milestone:base:30"]');
    const level40 = page.locator('[data-progression-key="fighter:milestone:base:40"]');
    await expect(level20).toHaveCount(1);
    await expect(level30).toHaveCount(1);
    await expect(level40).toHaveCount(1);

    await level20.click();
    let editor = page.locator("#player-progression-detail .player-progression-choice-panel");
    await expect(editor).toContainText("MEJORA DE CLASE");
    await editor.locator(".player-progression-choice-stat").selectOption("fuerza");
    await editor.getByRole("button",{name:"CONFIRMAR MEJORA"}).click();
    await expect(editor).toContainText("GUARDADO");
    expect(await page.evaluate(()=>window.__server.stats.fuerza)).toBe(16);
    expect(await page.evaluate(()=>window.__server.characterBuild.classMilestones.fighter["20"].type)).toBe("stats");

    await level30.click();
    editor = page.locator("#player-progression-detail .player-progression-choice-panel");
    await editor.locator(".player-progression-choice-select").selectOption("trait");
    await editor.locator(".player-progression-choice-trait").selectOption("general_keen");
    await editor.getByRole("button",{name:"CONFIRMAR MEJORA"}).click();
    await expect(editor).toContainText("GUARDADO");
    expect(await page.evaluate(()=>window.__server.characterBuild.classMilestones.fighter["30"].traitId)).toBe("general_keen");

    await level40.click();
    editor = page.locator("#player-progression-detail .player-progression-choice-panel");
    await editor.locator(".player-progression-choice-select").selectOption("stats_split");
    const stats = editor.locator(".player-progression-choice-stat");
    await stats.nth(0).selectOption("destreza");
    await stats.nth(1).selectOption("constitucion");
    await page.evaluate(()=>window.__rejectWrite=true);
    await editor.getByRole("button",{name:"CONFIRMAR MEJORA"}).click();
    await expect(editor.locator(".player-progression-choice-feedback")).toContainText("Firebase rejected write");
    expect(await page.evaluate(()=>window.__server.characterBuild.classMilestones.fighter["40"])).toBeUndefined();
    await page.evaluate(()=>window.__rejectWrite=false);
    await editor.getByRole("button",{name:"CONFIRMAR MEJORA"}).click();
    await expect(editor).toContainText("GUARDADO");
    expect(await page.evaluate(()=>window.__server.stats.destreza)).toBe(13);
    expect(await page.evaluate(()=>window.__server.stats.constitucion)).toBe(14);

    const master = fighter.locator(".player-progression-branch-label.is-selected");
    await expect(master).toContainText("Battle Master");
    await master.locator(".player-progression-branch-configure").click();
    const maneuvers = page.locator("#player-progression-detail .player-progression-maneuver-panel");
    await expect(maneuvers.locator(".player-progression-maneuver")).toHaveCount(23);
    await expect(maneuvers.locator(".player-progression-maneuver-counter")).toContainText("0 / 3");
    for (const key of ["parry","rally","ambush"]) {
      await maneuvers.locator('input[value="'+key+'"]').check();
    }
    await expect(maneuvers.locator(".player-progression-maneuver-counter")).toContainText("3 / 3");
    await maneuvers.getByRole("button",{name:"GUARDAR MANIOBRAS"}).click();
    await expect(maneuvers.locator(".player-progression-maneuver-counter")).toContainText("3 / 3");
    expect(await page.evaluate(()=>window.__server.characterBuild.maneuvers.battle_master.sort()))
      .toEqual(["ambush","parry","rally"]);
    await expect(master).toContainText("MANIOBRAS 3/3");

    const champion = fighter.locator(".player-progression-branch-label").filter({hasText:"Champion"});
    await champion.locator(".player-progression-branch-preview").click();
    const preview = page.locator("#player-progression-detail .player-progression-preview-features").first();
    await expect(preview).toContainText("Improved Critical");
    await expect(preview).toContainText("Crit Damage");
    await expect(fighter.locator(".player-progression-mystic-scroll")).toHaveCount(1);

    // The saved character can use all supported legacy map formats. The class
    // tree, choice form, transaction, and maneuver capacity must all agree.
    for (const format of ["build_class_levels", "top_class_levels", "classes_by_id", "build_classes_map"]) {
      await page.evaluate((kind) => {
        const char = {
          level: 40,
          stats:{fuerza:14,destreza:12,constitucion:13,inteligencia:10,sabiduria:11,carisma:12},
          characterBuild:{
            archetypes:{fighter:{archetypeId:"battle_master"}},
            classMilestones:{},
            maneuvers:{}
          },
        };
        const fighterEntry = {fighter:{levels:40}};
        if (kind === "build_class_levels") char.characterBuild.classLevels = fighterEntry;
        else if (kind === "top_class_levels") char.classLevels = fighterEntry;
        else if (kind === "classes_by_id") char.classesById = fighterEntry;
        else char.characterBuild.classes = fighterEntry;
        window.datosJugador = char;
        window.__server = structuredClone(char);
        window.LuminousPlayerProgressionTree.refresh();
      }, format);
      await expect(page.locator(".player-progression-class")).toContainText("CLASS LV. 40");
      await expect(page.locator(".player-progression-branch-label.is-selected")).toContainText("MANIOBRAS 0/3");
      const milestone20 = page.locator('[data-progression-key="fighter:milestone:base:20"]');
      await milestone20.click();
      const choicePanel = page.locator("#player-progression-detail .player-progression-choice-panel");
      await expect(choicePanel).toContainText("MEJORA DE CLASE");
      await expect(choicePanel).not.toContainText("Se desbloquea al alcanzar");
      await choicePanel.locator(".player-progression-choice-stat").selectOption("fuerza");
      await choicePanel.getByRole("button",{name:"CONFIRMAR MEJORA"}).click();
      await expect(choicePanel).toContainText("GUARDADO");
      expect(await page.evaluate(()=>window.__server.characterBuild.classMilestones.fighter["20"].type)).toBe("stats");
      expect(await page.evaluate(()=>window.__server.stats.fuerza)).toBe(16);
    }

    // Codex P1 regression: legacy milestone arrays must not be replaced by
    // empty objects when claiming another level. Previously chosen General
    // Traits, allocated stats, timestamps and arbitrary metadata must survive.
    await page.evaluate(() => {
      const char = {
        level: 40,
        stats:{fuerza:16,destreza:12,constitucion:13,inteligencia:10,sabiduria:11,carisma:12},
        characterBuild:{
          classes:[{classId:"fighter",levels:40}],
          archetypes:[{classId:"fighter",archetypeId:"battle_master"}],
          classMilestones:[
            {classId:"fighter",milestoneLevel:20,type:"stats",allocation:{fuerza:2},selectedAt:111},
            {classId:"fighter",milestoneLevel:30,type:"trait",traitId:"general_keen",selectedAt:222,notes:"legacy-choice"}
          ]
        }
      };
      window.datosJugador = char;
      window.__server = structuredClone(char);
      window.LuminousPlayerProgressionTree.refresh();
    });
    await level20.click();
    const oldChoice = page.locator("#player-progression-detail .player-progression-choice-panel");
    await expect(oldChoice).toContainText("GUARDADO");
    await expect(oldChoice.getByRole("button",{name:"CONFIRMAR MEJORA"})).toHaveCount(0);
    await level40.click();
    const newChoice = page.locator("#player-progression-detail .player-progression-choice-panel");
    await newChoice.locator(".player-progression-choice-stat").selectOption("constitucion");
    await newChoice.getByRole("button",{name:"CONFIRMAR MEJORA"}).click();
    await expect(newChoice).toContainText("GUARDADO");
    const historical = await page.evaluate(() => {
      const player = window.__server;
      const api = window.LuminousClassMilestones;
      return {
        isArray: Array.isArray(player.characterBuild.classMilestones),
        previousStat: api.choiceAt(player.characterBuild.classMilestones,"fighter",20),
        previousTrait: api.choiceAt(player.characterBuild.classMilestones,"fighter",30),
        newClaim: api.choiceAt(player.characterBuild.classMilestones,"fighter",40),
        rawTrait: player.characterBuild.classMilestones.fighter["30"],
        chosenGeneralTraits: api.selectedGeneralTraitIds(player),
        stats: player.stats,
      };
    });
    expect(historical.isArray).toBe(false);
    expect(historical.previousStat.allocation.fuerza).toBe(2);
    expect(historical.previousTrait.traitId).toBe("general_keen");
    expect(historical.rawTrait.selectedAt).toBe(222);
    expect(historical.rawTrait.notes).toBe("legacy-choice");
    expect(historical.chosenGeneralTraits).toContain("general_keen");
    expect(historical.newClaim.allocation.constitucion).toBe(2);
    expect(historical.stats.fuerza).toBe(16);
    expect(historical.stats.constitucion).toBe(15);
    await level20.click();
    await expect(page.locator("#player-progression-detail .player-progression-choice-panel")).toContainText("GUARDADO");

    // Codex P1 regression: historical claims stored ONLY at the top level
    // must remain selectable, preserve General Traits, and be migrated before
    // an entirely new reward can be claimed.
    await page.evaluate(() => {
      const char = {
        level:40,
        stats:{fuerza:16,destreza:12,constitucion:13,inteligencia:10,sabiduria:11,carisma:12},
        classMilestones:[
          {classId:"fighter",milestoneLevel:20,type:"stats",allocation:{fuerza:2},selectedAt:101,notes:"original-stat"},
          {classId:"fighter",milestoneLevel:30,type:"trait",traitId:"general_keen",selectedAt:202,notes:"original-trait"}
        ],
        characterBuild:{classes:[{classId:"fighter",levels:40}],
          archetypes:[{classId:"fighter",archetypeId:"battle_master"}],classMilestones:{}}
      };
      window.datosJugador=char;
      window.__server=structuredClone(char);
      window.LuminousPlayerProgressionTree.refresh();
    });
    await level20.click();
    await expect(page.locator("#player-progression-detail .player-progression-choice-panel")).toContainText("GUARDADO");
    await level30.click();
    await expect(page.locator("#player-progression-detail .player-progression-choice-panel")).toContainText("GUARDADO");
    await level40.click();
    const topLegacy = page.locator("#player-progression-detail .player-progression-choice-panel");
    await topLegacy.locator(".player-progression-choice-stat").selectOption("constitucion");
    await topLegacy.getByRole("button",{name:"CONFIRMAR MEJORA"}).click();
    await expect(topLegacy).toContainText("GUARDADO");
    const preserved = await page.evaluate(() => {
      const player=window.__server,api=window.LuminousClassMilestones;
      return {
        oldStat:player.characterBuild.classMilestones.fighter["20"],
        oldTrait:player.characterBuild.classMilestones.fighter["30"],
        newStat:player.characterBuild.classMilestones.fighter["40"],
        selectedGeneral:api.selectedGeneralTraitIds(player),
        legacyTopCleared:!Object.prototype.hasOwnProperty.call(player,'classMilestones'),
        fuerza:player.stats.fuerza,
        constitucion:player.stats.constitucion
      };
    });
    expect(preserved.oldStat.notes).toBe("original-stat");
    expect(preserved.oldStat.selectedAt).toBe(101);
    expect(preserved.oldTrait.notes).toBe("original-trait");
    expect(preserved.oldTrait.selectedAt).toBe(202);
    expect(preserved.newStat.allocation.constitucion).toBe(2);
    expect(preserved.selectedGeneral).toContain("general_keen");
    expect(preserved.legacyTopCleared).toBe(true);
    expect(preserved.fuerza).toBe(16);
    expect(preserved.constitucion).toBe(15);

    // Both a top-level and a nested claim for the same level but different
    // payouts are ambiguous; saving must abort, not overwrite either.
    await page.evaluate(() => {
      const char = {
        level:40,
        stats:{fuerza:16,destreza:12,constitucion:13,inteligencia:10,sabiduria:11,carisma:12},
        classMilestones:{fighter:{20:{classId:"fighter",milestoneLevel:20,
          type:"stats",allocation:{fuerza:2},selectedAt:11}}},
        characterBuild:{
          classes:[{classId:"fighter",levels:40}],
          archetypes:[{classId:"fighter",archetypeId:"battle_master"}],
          classMilestones:{fighter:{20:{classId:"fighter",milestoneLevel:20,
            type:"stats",allocation:{destreza:2},selectedAt:22}}}
        }
      };
      window.datosJugador=char;
      window.__server=structuredClone(char);
      window.LuminousPlayerProgressionTree.refresh();
    });
    await level40.click();
    const conflict = page.locator("#player-progression-detail .player-progression-choice-panel");
    await conflict.locator(".player-progression-choice-stat").selectOption("constitucion");
    await conflict.getByRole("button",{name:"CONFIRMAR MEJORA"}).click();
    await expect(conflict.locator(".player-progression-choice-feedback")).toContainText("duplicados incompatibles");
    expect(await page.evaluate(() => window.__server.characterBuild.classMilestones.fighter["40"])).toBeUndefined();
    expect(await page.evaluate(() => window.__server.stats.constitucion)).toBe(13);

    // Codex P1: DM Studio persists effective Stats from baseStats + racial.
    // Claiming a Milestone must update both scores AND migrate legacy claims.
    await page.evaluate(() => {
      const char = {
        level:40,
        stats:{fuerza:14,destreza:12,constitucion:13,inteligencia:10,sabiduria:11,carisma:12},
        baseStats:{fuerza:12,destreza:12,constitucion:13,inteligencia:10,sabiduria:11,carisma:12},
        classMilestones:[
          {classId:"fighter",milestoneLevel:30,type:"trait",traitId:"general_keen",
            selectedAt:121,notes:"keep-this-trait"}
        ],
        characterBuild:{
          classes:[{classId:"fighter",levels:40}],
          archetypes:[{classId:"fighter",archetypeId:"battle_master"}],
          breakdown:{racialStatBonuses:{str:2}},
          classMilestones:{}
        }
      };
      window.datosJugador=char;
      window.__server=structuredClone(char);
      window.LuminousPlayerProgressionTree.refresh();
    });
    await level20.click();
    const studioClaim = page.locator("#player-progression-detail .player-progression-choice-panel");
    await studioClaim.locator(".player-progression-choice-stat").selectOption("fuerza");
    await studioClaim.getByRole("button",{name:"CONFIRMAR MEJORA"}).click();
    await expect(studioClaim).toContainText("GUARDADO");
    const studioPersistence = await page.evaluate(() => {
      const c=window.__server,api=window.LuminousClassMilestones;
      return {
        effective:c.stats.fuerza,
        base:c.baseStats.fuerza,
        recomputedFromStudio:c.baseStats.fuerza+c.characterBuild.breakdown.racialStatBonuses.str,
        legacyRemoved:!Object.hasOwn(c,"classMilestones"),
        oldTrait:c.characterBuild.classMilestones.fighter["30"],
        savedMilestone:api.choiceAt(c.characterBuild.classMilestones,"fighter",20)
      };
    });
    expect(studioPersistence.effective).toBe(16);
    expect(studioPersistence.base).toBe(14);
    expect(studioPersistence.recomputedFromStudio).toBe(16);
    expect(studioPersistence.legacyRemoved).toBe(true);
    expect(studioPersistence.oldTrait?.notes).toBe("keep-this-trait");
    expect(studioPersistence.savedMilestone?.allocation?.fuerza).toBe(2);

    // Codex P2: legacy stat aliases must not remain next to the canonical
    // score after claiming a reward. This test uses the actual Player DOM
    // and mock Firebase transaction, then the DM's real reversion logic.
    await page.evaluate(() => {
      const char = {
        level:40,
        stats:{str:14,destreza:12,constitucion:13,inteligencia:10,sabiduria:11,carisma:12,
          customScore:"keep"},
        baseStats:{str:12,destreza:12,constitucion:13,inteligencia:10,sabiduria:11,carisma:12,
          customBase:"keep"},
        characterBuild:{
          classes:[{classId:"fighter",levels:40}],
          archetypes:[{classId:"fighter",archetypeId:"battle_master"}],
          classMilestones:{}
        }
      };
      window.datosJugador=char;
      window.__server=structuredClone(char);
      window.LuminousPlayerProgressionTree.refresh();
    });
    await level20.click();
    const aliasClaim=page.locator("#player-progression-detail .player-progression-choice-panel");
    await aliasClaim.locator(".player-progression-choice-stat").selectOption("fuerza");
    await aliasClaim.getByRole("button",{name:"CONFIRMAR MEJORA"}).click();
    await expect(aliasClaim).toContainText("GUARDADO");
    const aliasAward=await page.evaluate(() => ({
      stats:window.__server.stats,
      base:window.__server.baseStats,
      awarded:window.__server.characterBuild.classMilestones.fighter["20"],
    }));
    expect(aliasAward.stats.fuerza).toBe(16);
    expect(aliasAward.base.fuerza).toBe(14);
    expect(aliasAward.stats).not.toHaveProperty("str");
    expect(aliasAward.base).not.toHaveProperty("str");
    expect(aliasAward.stats.customScore).toBe("keep");
    expect(aliasAward.base.customBase).toBe("keep");
    expect(aliasAward.awarded.baseStatsApplied).toBe(true);

    await page.addScriptTag({url:BASE + "/js/milestone-revert-patch.js"});
    const reversed=await page.evaluate(() =>
      window.LuminousMilestoneRevertPatch.revertMilestoneState(window.__server,"fighter",20));
    expect(reversed.valid).toBe(true);
    expect(reversed.player.stats.fuerza).toBe(14);
    expect(reversed.player.baseStats.fuerza).toBe(12);
    expect(reversed.player.stats).not.toHaveProperty("str");
    expect(reversed.player.baseStats).not.toHaveProperty("str");
    expect(reversed.player.characterBuild.classMilestones.fighter?.["20"]).toBeUndefined();
    expect(reversed.player.stats.customScore).toBe("keep");

    // Codex P2: reverting Superior Technique removes one maneuver slot. The
    // player must be able to discard ONLY excess learned maneuvers, not swap
    // previously learned ones for an unrelated new choice.
    await page.evaluate(() => {
      const char = {
        level:40,
        stats:{fuerza:14,destreza:12,constitucion:13,inteligencia:10,sabiduria:11,carisma:12},
        characterBuild:{
          classes:[{classId:"fighter",levels:40}],
          archetypes:[{classId:"fighter",archetypeId:"battle_master"}],
          classMilestones:{fighter:{"20":{classId:"fighter",milestoneLevel:20,type:"trait",
            traitId:"superior_technique",selectedAt:111}}},
          maneuvers:{battle_master:["parry","rally","ambush","bait_and_switch"]}
        }
      };
      window.datosJugador=char;
      window.__server=structuredClone(char);
      window.LuminousPlayerProgressionTree.refresh();
    });
    const battleMaster=page.locator(".player-progression-branch-label.is-selected");
    await expect(battleMaster).toContainText("MANIOBRAS 4/4");
    await battleMaster.locator(".player-progression-branch-configure").click();
    const shrinkPanel=page.locator("#player-progression-detail .player-progression-maneuver-panel");
    await expect(shrinkPanel.locator(".player-progression-maneuver-counter")).toContainText("4 / 4");
    await page.evaluate(() => {
      const result=window.LuminousMilestoneRevertPatch.revertMilestoneState(window.__server,"fighter",20);
      if(!result.valid) throw Error(result.error||"Superior Technique reversion failed");
      window.__server=structuredClone(result.player);
      window.datosJugador=structuredClone(result.player);
      window.LuminousPlayerProgressionTree.refresh();
    });
    await expect(battleMaster).toContainText("MANIOBRAS 4/3");
    await battleMaster.locator(".player-progression-branch-configure").click();
    await expect(shrinkPanel.locator(".player-progression-maneuver-counter")).toContainText("4 / 3");
    await expect(shrinkPanel).toContainText("Desmarca 1 maniobra");
    await expect(shrinkPanel.locator('input[value="parry"]')).toBeEnabled();
    await expect(shrinkPanel.locator('input[value="feinting_attack"]')).toBeDisabled();
    await expect(shrinkPanel.getByRole("button",{name:"GUARDAR MANIOBRAS"})).toBeDisabled();
    await shrinkPanel.locator('input[value="ambush"]').uncheck();
    await expect(shrinkPanel.locator(".player-progression-maneuver-counter")).toContainText("3 / 3");
    // A concurrent addition must not be silently discarded by an open editor.
    await page.evaluate(()=>window.__server.characterBuild.maneuvers.battle_master.push("feinting_attack"));
    await shrinkPanel.getByRole("button",{name:"GUARDAR MANIOBRAS"}).click();
    await expect(shrinkPanel.locator(".player-progression-choice-feedback")).toContainText("Las maniobras cambiaron");
    expect(await page.evaluate(()=>window.__server.characterBuild.maneuvers.battle_master.length)).toBe(5);
    await page.evaluate(()=>window.__server.characterBuild.maneuvers.battle_master.pop());
    await shrinkPanel.getByRole("button",{name:"GUARDAR MANIOBRAS"}).click();
    expect(await page.evaluate(()=>window.__server.characterBuild.maneuvers.battle_master.sort()))
      .toEqual(["bait_and_switch","parry","rally"]);
    await expect(battleMaster).toContainText("MANIOBRAS 3/3");
    await battleMaster.locator(".player-progression-branch-configure").click();
    await expect(shrinkPanel.locator('input[value="parry"]')).toBeDisabled();
    await expect(shrinkPanel.locator('input[value="feinting_attack"]')).toBeEnabled();
    await expect(shrinkPanel.getByRole("button",{name:"GUARDAR MANIOBRAS"})).toBeDisabled();
  });
}
