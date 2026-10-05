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
  await page.waitForTimeout(2_000);

  const result = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    // Warm the player-update path once before measuring long-session stability.
    // The first synthetic player snapshot performs deterministic one-time DOM
    // cleanup on the real sheet; measuring before that makes the soak report a
    // false node "loss" even when every subsequent update is stable.
    window.__fakeFirebase.emitPlayer({ backgroundHeartbeat: "warmup" });
    await sleep(0);
    await new Promise((resolve) => requestAnimationFrame(() => resolve()));

    // The sheet still performs a small amount of one-time DOM cleanup after
    // player data is ready. Slow CI runners can finish that cleanup after the
    // outer 2s boot wait, which makes a pre-cleanup baseline look like a node
    // loss during the soak. Establish the baseline only after node count has
    // remained unchanged for 3 continuous seconds; the final assertion below
    // remains exact, so real stacking/leaks still fail.
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

test("trait formula breakdown stays hidden on hover until Shift inspect mode is active", async ({ page }) => {
  await page.setContent(`
    <!doctype html>
    <html>
      <head>
        <link id="player-trait-tabs-stylesheet" rel="stylesheet" href="${BASE}/css/player-trait-tabs.css">
      </head>
      <body>
        <div id="perks-modal"><div id="trait-shift-host"></div></div>
        <script src="${BASE}/js/trait-engine.js"></script>
        <script src="${BASE}/js/trait-player-tray.js"></script>
        <script>
          window.LuminousTraitPlayerTray.mount({
            host: "#trait-shift-host",
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

  const resolvedControl = page.locator('[data-trait-id="shift_formula_trait"] .player-trait-resolved-control').first();
  const value = resolvedControl.locator(".player-trait-resolved-value");
  const tooltip = resolvedControl.locator(".player-trait-formula-tooltip");
  await expect(value.locator(".player-trait-formula-tooltip")).toHaveCount(0);
  await expect(value).toHaveAttribute("aria-describedby", await tooltip.getAttribute("id"));
  await value.hover();

  await expect(tooltip).toHaveCSS("visibility", "hidden");
  await page.keyboard.down("Shift");
  await expect(page.locator("body")).toHaveClass(/player-trait-formula-inspect/);
  await expect(tooltip).toHaveCSS("visibility", "visible");
  await expect(tooltip).toContainText("WIS Mod");
  await expect(tooltip).toContainText("Formula:");
  await expect(tooltip).toContainText("max(10, 10 * WisdomMod)");
  await page.keyboard.up("Shift");
  await expect(tooltip).toHaveCSS("visibility", "hidden");
});
