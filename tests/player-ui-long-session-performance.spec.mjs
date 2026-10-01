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
      if (event === "value") queueMicrotask(() => handler(this._snapshot()));
      return handler;
    }
    off(event, handler) {
      if (!event) {
        for (const key of [...listeners.keys()]) {
          if (key.startsWith(this.path + "|")) listeners.delete(key);
        }
        return;
      }
      const key = listenerKey(this.path, event);
      if (!handler) { listeners.delete(key); return; }
      listeners.get(key)?.delete(handler);
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
      write(raw, { ...current, ...clone(patch) });
      emit(raw, "value");
    },
    listenerCount() {
      let count = 0;
      for (const set of listeners.values()) count += set.size;
      return count;
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
  expect(sheet).toContain("lastCharacterSheetRenderSignature");
  expect(css).toContain("content-visibility: hidden");
  expect(css).not.toMatch(/animation:\s*scanline\s+[^;]*infinite/i);
  expect(tree).not.toContain('state.playerRef.on("value"');
  expect(allocation).not.toContain('state.playerRef.on("value"');
  expect(allocation).toContain("nextRenderSignature === state.renderSignature");
  expect(instance).toContain("syncPlayerCombatOcclusion");
});

test("real player sheet reaches interval-idle after boot", async ({ page }) => {
  await installPageInstrumentation(page);
  await page.goto(BASE + "/hoja_personaje.html", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.datosJugador?.characterName === "Performance Test", null, { timeout: 20_000 });
  await page.waitForTimeout(2_000);
  const details = await page.evaluate(() => window.__perfIntervalRegistry?.details?.() || []);
  expect(details, JSON.stringify(details, null, 2)).toEqual([]);
});

test("real player sheet stays stable for 60 seconds under background player updates", async ({ page }) => {
  test.setTimeout(110_000);
  await installPageInstrumentation(page);
  await page.goto(BASE + "/hoja_personaje.html", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.datosJugador?.characterName === "Performance Test", null, { timeout: 20_000 });
  await page.waitForTimeout(2_000);

  const result = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
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
    while (performance.now() - started < 60_000) {
      // CI browsers may clamp timers under load. Emit a short burst each turn so
      // the 60-second wall-clock soak still carries 500+ background updates.
      for (let burst = 0; burst < 3; burst += 1) {
        window.__fakeFirebase.emitPlayer({ backgroundHeartbeat: updates });
        updates += 1;
      }
      await sleep(100);
    }

    sampling = false;
    await sleep(100);
    observer.disconnect();

    const toggle = document.getElementById("btn-toggle-phone");
    for (let i = 0; i < 720; i += 1) toggle?.click();
    await sleep(50);

    return {
      buckets,
      updates,
      heavyMutations,
      baselineNodes,
      finalNodes: document.getElementsByTagName("*").length,
      baselineIntervals,
      finalIntervals: window.__perfIntervalRegistry?.activeCount?.() ?? -1,
      baselineListeners,
      finalListeners: window.__fakeFirebase?.listenerCount?.() ?? -1,
      phoneHidden: document.querySelector(".sheet-phone-wrapper")?.classList.contains("phone-hidden") ?? null
    };
  });

  expect(result.updates).toBeGreaterThanOrEqual(500);
  expect(result.baselineIntervals).toBe(0);
  expect(result.finalIntervals).toBe(0);
  expect(result.finalListeners).toBe(result.baselineListeners);
  expect(result.finalNodes).toBe(result.baselineNodes);
  expect(result.heavyMutations).toBe(0);
  expect(result.phoneHidden).toBe(false);

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
