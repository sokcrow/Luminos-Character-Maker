(function (global) {
  "use strict";

  if (global.LuminousBattleViewerDmEncounterRoster074?.version === "0.7.4") {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousBattleViewerDmEncounterRoster074;
    return;
  }

  const VERSION = "0.7.4";
  const CARD_ID = "dm074-encounter-roster";
  const STYLE_ID = "dm074-encounter-roster-style";
  const ROOTS = Object.freeze({
    combatants: "campaña/combate/combatants",
    reserves: "campaña/combate/reserves",
  });

  const state = {
    db: null,
    combatants: {},
    reserves: {},
    started: false,
    listeners: [],
    mountTimer: null,
  };

  const clean = (value) => String(value ?? "").trim();
  const normalized = (value) => clean(value).toLowerCase().replace(/[\s-]+/g, "_");
  const escapeHtml = (value) => clean(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

  function consoleApi() {
    return global.LuminousBattleViewerDmConsole074 || null;
  }

  function labelFor(key, unit = {}) {
    return clean(unit.characterName || unit.character_name || unit.nombre || unit.name || unit.displayName || key || "UNIT") || "UNIT";
  }

  function sideFor(unit = {}) {
    const category = normalized(unit.actorCategory || unit.category || unit.type || unit.kind);
    const faction = normalized(unit.faction || unit.faccion || unit.team || unit.side);
    if (unit.isPlayer === true || category === "player") return "ally";
    if (["ally", "allied", "friendly", "player", "players", "aliado", "aliados"].includes(faction)) return "ally";
    if (["ally", "allied", "friendly", "aliado"].includes(category)) return "ally";
    if (["enemy", "enemies", "hostile", "enemigo", "enemigos", "boss"].includes(faction)) return "enemy";
    if (["enemy", "hostile", "enemigo", "boss", "monster", "monstruo"].includes(category)) return "enemy";
    if (unit.hostile === true || unit.enemy === true || unit.isEnemy === true) return "enemy";
    return "neutral";
  }

  function roleFor(unit = {}) {
    const category = normalized(unit.actorCategory || unit.category || unit.type || unit.kind);
    const faction = normalized(unit.faction || unit.faccion || unit.team || unit.side);
    if (unit.isPlayer === true || category === "player") return "player";
    if (category === "boss" || faction === "boss" || unit.isBoss === true) return "boss";
    return sideFor(unit) === "ally" ? "ally" : sideFor(unit) === "enemy" ? "enemy" : "neutral";
  }

  function entriesFor(collection = {}, deployment = "field") {
    return Object.entries(collection || {})
      .filter(([, unit]) => unit && typeof unit === "object")
      .map(([key, unit]) => ({
        key,
        unit,
        name: labelFor(key, unit),
        side: sideFor(unit),
        role: roleFor(unit),
        deployment,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  function sectionSummary(entries = []) {
    return {
      total: entries.length,
      players: entries.filter((entry) => entry.role === "player").length,
      allies: entries.filter((entry) => entry.role === "ally").length,
      enemies: entries.filter((entry) => entry.role === "enemy").length,
      bosses: entries.filter((entry) => entry.role === "boss").length,
      neutral: entries.filter((entry) => entry.role === "neutral").length,
    };
  }

  function summarizeRoster(combatants = state.combatants, reserves = state.reserves) {
    const fieldEntries = entriesFor(combatants, "field");
    const backupEntries = entriesFor(reserves, "backup");
    const split = (entries, side) => entries.filter((entry) => entry.side === side);
    const fieldAlly = split(fieldEntries, "ally");
    const fieldEnemy = split(fieldEntries, "enemy");
    const fieldNeutral = split(fieldEntries, "neutral");
    const backupAlly = split(backupEntries, "ally");
    const backupEnemy = split(backupEntries, "enemy");
    const backupNeutral = split(backupEntries, "neutral");
    return {
      field: {
        entries: fieldEntries,
        allies: fieldAlly,
        enemies: fieldEnemy,
        neutral: fieldNeutral,
        counts: sectionSummary(fieldEntries),
      },
      backup: {
        entries: backupEntries,
        allies: backupAlly,
        enemies: backupEnemy,
        neutral: backupNeutral,
        counts: sectionSummary(backupEntries),
      },
      allied: {
        field: sectionSummary(fieldAlly),
        backup: sectionSummary(backupAlly),
      },
      enemy: {
        field: sectionSummary(fieldEnemy),
        backup: sectionSummary(backupEnemy),
      },
    };
  }

  function ensureStyle() {
    const doc = global.document;
    if (!doc?.head || doc.getElementById(STYLE_ID)) return false;
    const style = doc.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      #${CARD_ID} .dm074-roster-score{display:grid;grid-template-columns:1fr 1fr;gap:5px;margin-bottom:6px}
      #${CARD_ID} .dm074-roster-side{border:1px solid #2d281f;padding:5px;background:rgba(255,255,255,.02)}
      #${CARD_ID} .dm074-roster-side b{display:block;color:#f0d17f;font-size:12px}
      #${CARD_ID} .dm074-roster-side small{color:#8f8778}
      #${CARD_ID} .dm074-roster-columns{display:grid;grid-template-columns:1fr 1fr;gap:6px}
      #${CARD_ID} .dm074-roster-column{min-width:0}
      #${CARD_ID} .dm074-roster-subtitle{color:#a8997d;font-size:9px;font-weight:700;letter-spacing:.5px;margin:4px 0 2px}
      #${CARD_ID} .dm074-roster-list{display:grid;gap:2px;max-height:100px;overflow:auto}
      #${CARD_ID} .dm074-roster-entry{font-size:10px;border-bottom:1px solid #211e18;padding:2px 0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      #${CARD_ID} .dm074-roster-entry span{color:#7f7565;margin-right:4px}
      #${CARD_ID} .dm074-roster-empty{font-size:9px;color:#6f685d;font-style:italic}
    `;
    doc.head.appendChild(style);
    return true;
  }

  function badge(entry) {
    if (entry.role === "player") return "P";
    if (entry.role === "boss") return "BOSS";
    if (entry.side === "ally") return "A";
    if (entry.side === "enemy") return "E";
    return "N";
  }

  function listHtml(entries, emptyText) {
    if (!entries.length) return `<div class="dm074-roster-empty">${escapeHtml(emptyText)}</div>`;
    return entries.map((entry) => `<div class="dm074-roster-entry" title="${escapeHtml(entry.key)}"><span>[${badge(entry)}]</span>${escapeHtml(entry.name)}</div>`).join("");
  }

  function mount() {
    const doc = global.document;
    const dashboard = doc?.getElementById?.("dm-dashboard");
    const body = doc?.getElementById?.("dm074-body") || dashboard?.querySelector?.(".dm074-body");
    if (!dashboard?.classList?.contains("dm074") || !body) return false;
    ensureStyle();
    let card = doc.getElementById(CARD_ID);
    if (!card) {
      card = doc.createElement("section");
      card.id = CARD_ID;
      card.className = "dm074-card";
      const firstCard = body.querySelector?.(".dm074-card");
      if (firstCard) body.insertBefore(card, firstCard);
      else body.appendChild(card);
    }
    const roster = summarizeRoster();
    const af = roster.allied.field;
    const ab = roster.allied.backup;
    const ef = roster.enemy.field;
    const eb = roster.enemy.backup;
    card.innerHTML = `
      <div class="dm074-title">Encounter Roster</div>
      <div class="dm074-roster-score">
        <div class="dm074-roster-side"><b>ALLIED · FIELD ${af.total} / BACKUP ${ab.total}</b><small>${af.players} Players · ${af.allies} Allied Units</small></div>
        <div class="dm074-roster-side"><b>ENEMY · FIELD ${ef.total} / BACKUP ${eb.total}</b><small>${ef.enemies} Enemies · ${ef.bosses} Bosses</small></div>
      </div>
      <div class="dm074-roster-columns">
        <div class="dm074-roster-column">
          <div class="dm074-roster-subtitle">ALLIED FIELD</div><div class="dm074-roster-list">${listHtml(roster.field.allies, "No allied units deployed.")}</div>
          <div class="dm074-roster-subtitle">ALLIED BACKUP</div><div class="dm074-roster-list">${listHtml(roster.backup.allies, "No allied backups.")}</div>
        </div>
        <div class="dm074-roster-column">
          <div class="dm074-roster-subtitle">ENEMY FIELD</div><div class="dm074-roster-list">${listHtml(roster.field.enemies, "No enemies deployed.")}</div>
          <div class="dm074-roster-subtitle">ENEMY BACKUP</div><div class="dm074-roster-list">${listHtml(roster.backup.enemies, "No enemy backups.")}</div>
        </div>
      </div>
      ${(roster.field.neutral.length || roster.backup.neutral.length) ? `<div class="dm074-roster-subtitle">UNASSIGNED / NEUTRAL · FIELD ${roster.field.neutral.length} / BACKUP ${roster.backup.neutral.length}</div>` : ""}`;
    return true;
  }

  function stop() {
    for (const listener of state.listeners) {
      try { listener.ref.off("value", listener.handler); } catch (_) {}
    }
    state.listeners = [];
    if (state.mountTimer && typeof global.clearInterval === "function") global.clearInterval(state.mountTimer);
    state.mountTimer = null;
    state.started = false;
  }

  function subscribe(path, assign) {
    const ref = state.db.ref(path);
    const handler = (snapshot) => {
      assign(snapshot?.val?.() || {});
      mount();
    };
    ref.on("value", handler);
    state.listeners.push({ ref, handler });
  }

  function init(options = {}) {
    const db = options.db || consoleApi()?._state?.db || (() => {
      try { return global.firebase?.database?.() || null; } catch (_) { return null; }
    })();
    if (!db?.ref) return false;
    if (state.started && state.db === db) {
      mount();
      return true;
    }
    if (state.started) stop();
    state.db = db;
    state.started = true;
    subscribe(ROOTS.combatants, (value) => { state.combatants = value; });
    subscribe(ROOTS.reserves, (value) => { state.reserves = value; });
    if (typeof global.setInterval === "function") {
      state.mountTimer = global.setInterval(mount, 750);
      state.mountTimer?.unref?.();
    }
    mount();
    return true;
  }

  const api = Object.freeze({
    version: VERSION,
    ROOTS,
    state,
    labelFor,
    sideFor,
    roleFor,
    entriesFor,
    summarizeRoster,
    mount,
    init,
    stop,
  });

  global.LuminousBattleViewerDmEncounterRoster074 = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
