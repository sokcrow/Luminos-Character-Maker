(function (global) {
  "use strict";

  if (global.LuminousCombatLiveAdapter073) return;
  global.LuminousCombatLiveMode = true;

  const VERSION = "0.7.3-live.1";
  const ROOTS = Object.freeze({
    dmUid: "campaña/config/dm_uid",
    players: "campaña/jugadores",
    combatants: "campaña/combate/combatants",
    state: "campaña/combate/estado",
    skills: "campaña/base_datos_skills",
    plannedActions: "campaña/combate/plannedActions",
  });
  const FALLBACK_DM_UID = "e9JwFZrtk6g8UMqq2Hf9EHVY7Ay1";
  const FIREBASE_CONFIG = Object.freeze({
    apiKey: "AIzaSyAIVIuKgXUsdrb9Mmss9PH7R3FpWAMG2hU",
    authDomain: "luminous-system.firebaseapp.com",
    databaseURL: "https://luminous-system-default-rtdb.firebaseio.com",
    projectId: "luminous-system",
    storageBucket: "luminous-system.firebasestorage.app",
    messagingSenderId: "330473029689",
    appId: "1:330473029689:web:44a05e870d493a3b294de8",
  });

  const state = {
    started: false,
    runtimeReady: false,
    firebaseReady: false,
    auth: null,
    db: null,
    user: null,
    uid: null,
    role: null,
    playerId: null,
    dmUid: FALLBACK_DM_UID,
    players: {},
    combatants: {},
    skills: {},
    combatState: "PRE_COMBAT_PLANNING",
    round: 1,
    unsubscribers: [],
    hydrateTimer: null,
    hydratedOnce: false,
    lastSignature: "",
  };

  const clean = (value) => String(value ?? "").trim();
  const finite = (value, fallback = null) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
  const normalizeId = (value) => clean(value).toLowerCase().replace(/[\s-]+/g, "_");

  function setStatus(message) {
    try {
      const node = global.document?.getElementById?.("status");
      if (node) node.textContent = message;
    } catch (_) {}
  }

  function ensureFirebase() {
    const firebase = global.firebase;
    if (!firebase?.initializeApp || !firebase?.auth || !firebase?.database) return false;
    try {
      if (!Array.isArray(firebase.apps) || firebase.apps.length === 0) firebase.initializeApp(FIREBASE_CONFIG);
      state.auth = firebase.auth();
      state.db = firebase.database();
      return Boolean(state.auth && state.db?.ref);
    } catch (error) {
      console.error("[Combat073] Firebase initialization failed", error);
      setStatus("COMBAT · FIREBASE INIT FAILED");
      return false;
    }
  }

  function playerUid(player = {}) {
    return clean(player.uid || player.vinculado_a || player.vinculo_jugador);
  }

  function resolveIdentity() {
    const uid = clean(state.uid);
    if (!uid) return { role: null, playerId: null };
    if (uid === state.dmUid || uid === FALLBACK_DM_UID) return { role: "dm", playerId: null };
    const matches = Object.entries(state.players || {}).filter(([, player]) => playerUid(player || {}) === uid);
    if (matches.length !== 1) return { role: null, playerId: null };
    return { role: "player", playerId: matches[0][0] };
  }

  function canonicalPlayerId(unit = {}) {
    return clean(unit.canonicalPlayerKey || unit.ownerPlayerId || unit.playerId || unit.characterLink?.playerId);
  }

  function canonicalOwnerUid(unit = {}) {
    return clean(unit.canonicalOwnerUid || unit.ownerUid || unit.characterLink?.uid);
  }

  function isPlayerUnit(unit = {}) {
    const category = normalizeId(unit.actorCategory || unit.category || unit.type);
    return unit.isPlayer === true || category === "player" || normalizeId(unit.canonicalScope) === "player";
  }

  function playerCombatantEntry() {
    if (!state.playerId) return null;
    const canonicalKey = `player:${state.playerId.replace(/[.#$\[\]\/]/g, "_")}`;
    if (state.combatants?.[canonicalKey]) return [canonicalKey, state.combatants[canonicalKey]];
    return Object.entries(state.combatants || {}).find(([, unit]) => isPlayerUnit(unit) && canonicalPlayerId(unit) === state.playerId) || null;
  }

  function dmFocusEntry() {
    const entries = Object.entries(state.combatants || {});
    return entries.find(([, unit]) => isPlayerUnit(unit)) || entries[0] || null;
  }

  function phaseAndRound(raw) {
    if (raw && typeof raw === "object") {
      return {
        phase: clean(raw.phase || raw.state || raw.status || "PRE_COMBAT_PLANNING") || "PRE_COMBAT_PLANNING",
        round: Math.max(1, Math.trunc(finite(raw.round ?? raw.turn, 1))),
      };
    }
    return { phase: clean(raw || "PRE_COMBAT_PLANNING") || "PRE_COMBAT_PLANNING", round: 1 };
  }

  function factionFor(unit = {}) {
    const explicit = normalizeId(unit.faction || unit.faccion || unit.side || unit.team);
    if (["ally", "allies", "player", "jugador", "aliado"].includes(explicit)) return "ally";
    if (["enemy", "enemies", "enemigo", "hostile"].includes(explicit)) return "enemy";
    if (isPlayerUnit(unit)) return "ally";
    const category = normalizeId(unit.actorCategory || unit.category || unit.type || unit.alignment || unit.alineamiento);
    return ["enemy", "enemigo", "hostile"].includes(category) ? "enemy" : "ally";
  }

  function spriteFor(unit = {}) {
    return clean(
      unit.combatSprite || unit.sprite_combate || unit.combat_sprite || unit.tokenImage || unit.sprite ||
      unit.idle_sprite || unit.portrait || unit.icono || unit.img || unit.image
    );
  }

  function maxHpFor(unit = {}) {
    return Math.max(1, finite(unit.maxHp ?? unit.maxHP ?? unit.hp_max ?? unit.combatStats?.hp_max, finite(unit.hp, 1)) || 1);
  }

  function hpFor(unit = {}, maxHp) {
    return Math.max(0, finite(unit.hp ?? unit.currentHp ?? unit.currentHP ?? unit.hp_actual ?? unit.combatStats?.hp_actual, maxHp) ?? maxHp);
  }

  function spFor(unit = {}) {
    return finite(unit.sp ?? unit.currentSp ?? unit.currentSP ?? unit.sp_actual ?? unit.combatStats?.sp_actual, 0) || 0;
  }

  function actionSlotsFor(unit = {}) {
    return Math.max(1, Math.trunc(finite(unit.activeSlots ?? unit.actionSlots ?? unit.action_slots_count, 1) || 1));
  }

  function defaultPosition(faction, index) {
    const row = index % 2;
    const column = Math.floor(index / 2);
    return faction === "enemy"
      ? { x: Math.max(58, 90 - column * 9), y: row ? 42 : 18 }
      : { x: Math.min(42, 10 + column * 9), y: row ? 42 : 18 };
  }

  function normalizedCombatants() {
    const sideIndex = { ally: 0, enemy: 0 };
    const result = [];
    for (const [key, rawValue] of Object.entries(state.combatants || {})) {
      const raw = rawValue || {};
      const id = clean(raw.id || raw.combatId || raw.unitId || key) || key;
      const faction = factionFor(raw);
      const pos = defaultPosition(faction, sideIndex[faction]++);
      const maxHp = maxHpFor(raw);
      const playerOwned = state.role === "player" && canonicalPlayerId(raw) === state.playerId && (!canonicalOwnerUid(raw) || canonicalOwnerUid(raw) === state.uid);
      const x = finite(raw.x ?? raw.position?.x ?? raw.combatPosition?.x, pos.x);
      const y = finite(raw.y ?? raw.position?.y ?? raw.combatPosition?.y, pos.y);
      result.push({
        ...clone(raw),
        id,
        name: clean(raw.characterName || raw.character_name || raw.nombre || raw.name || id) || id,
        faction,
        controlled: playerOwned ? "player" : "ai",
        focusMenu: playerOwned,
        speed: finite(raw.speed, 0) || 0,
        speedRange: Array.isArray(raw.speedRange) ? raw.speedRange.slice(0, 2) : [finite(raw.speedMin, 1) || 1, finite(raw.speedMax, 6) || 6],
        hp: hpFor(raw, maxHp),
        maxHp,
        sp: spFor(raw),
        minSp: finite(raw.minSp, -45),
        maxSp: finite(raw.maxSp, 45),
        actionSlots: actionSlotsFor(raw),
        img: spriteFor(raw),
        x,
        y,
        scale: finite(raw.scale ?? raw.visualScale ?? raw.escala, 1) || 1,
        spriteX: finite(raw.spriteX, 0) || 0,
        spriteY: finite(raw.spriteY, 0) || 0,
        staggerThresholds: Array.isArray(raw.staggerThresholds) && raw.staggerThresholds.length ? raw.staggerThresholds : [75, 50, 25],
        isBackup: raw.isBackup === true || raw.battleActive === false,
        battleActive: raw.battleActive !== false,
        level: finite(raw.level ?? raw.characterBuild?.calculatedAtLevel, 1) || 1,
        offensiveLevel: finite(raw.offensiveLevel ?? raw.offensive_level ?? raw.level, 1) || 1,
        defensiveLevel: finite(raw.defensiveLevel ?? raw.defensive_level ?? raw.level, 1) || 1,
        statusEffects: clone(raw.statusEffects || {}),
      });
    }
    return result;
  }

  function coinAmount(skill = {}) {
    if (Array.isArray(skill.coins) && skill.coins.length) return skill.coins.length;
    return Math.max(1, Math.trunc(finite(skill.coinAmount ?? skill.coin_amount, 1) || 1));
  }

  function normalizeSkill(id, skill = {}) {
    const kindRaw = normalizeId(skill.kind || skill.type || skill.actionType || "skill");
    const defenseTypes = new Set(["defense", "guard", "evade", "counter", "clashableguard", "clashablecounter"]);
    const kind = defenseTypes.has(kindRaw) ? "defense" : (kindRaw.includes("spell") ? "spell" : "skill");
    const affinity = normalizeId(skill.sinAffinity || skill.affinity || skill.sin || "sinless") || "sinless";
    const result = {
      ...clone(skill),
      id: clean(skill.id || id) || id,
      name: clean(skill.name || skill.nombre || id) || id,
      kind,
      basePower: finite(skill.basePower ?? skill.base_power, 0) || 0,
      coinPower: finite(skill.coinPower ?? skill.coin_power, 0) || 0,
      coinAmount: coinAmount(skill),
      coinType: clean(skill.coinType || skill.coin_type || "positive") || "positive",
      sinAffinity: affinity,
      damageType: clean(skill.damageType || skill.damage_type || skill.physicalType || "Blunt") || "Blunt",
      description: clean(skill.description || skill.descripcion || ""),
      effects: clone(skill.effects || []),
      coins: clone(skill.coins || []),
      cost: clean(skill.cost || "1 Action Slot"),
    };
    if (kind === "defense") result.defenseType = normalizeId(skill.defenseType || skill.defenseSubtype || skill.type || "guard");
    if (skill.range === true || skill.isRanged === true || finite(skill.skillRange, 1) > 1) result.range = true;
    return result;
  }

  function skillIdsFor(unit = {}) {
    if (Array.isArray(unit.skillIds)) return unit.skillIds.map(clean).filter(Boolean);
    if (Array.isArray(unit.equippedSkills)) return unit.equippedSkills.map((row) => clean(row?.id || row)).filter(Boolean);
    if (unit.equippedSkillIndex && typeof unit.equippedSkillIndex === "object") return Object.keys(unit.equippedSkillIndex).filter((id) => unit.equippedSkillIndex[id] === true);
    return [];
  }

  function kitsFor(combatants) {
    const kits = {};
    for (const unit of combatants) {
      const source = state.combatants?.[unit.id] || Object.values(state.combatants || {}).find((raw) => clean(raw?.id || raw?.combatId) === unit.id) || unit;
      const actions = skillIdsFor(source).map((skillId) => state.skills?.[skillId] ? normalizeSkill(skillId, state.skills[skillId]) : null).filter(Boolean);
      const embedded = Array.isArray(source.actions) ? source.actions.map((row, index) => normalizeSkill(clean(row?.id || `${unit.id}:action:${index}`), row || {})) : [];
      kits[unit.id] = { role: clean(source.buildRole || source.combatRole || source.role || ""), actions: actions.length ? actions : embedded };
    }
    return kits;
  }

  function hydrationSignature(combatants, playerId) {
    const summary = combatants.map((unit) => [unit.id, unit.hp, unit.maxHp, unit.sp, unit.x, unit.y, unit.actionSlots, unit.img, unit.battleActive, unit.statusEffects]);
    return JSON.stringify([state.role, playerId, state.combatState, state.round, summary, Object.keys(state.skills || {}).length]);
  }

  function setRoleUi() {
    const host = global.document?.getElementById?.("game-container");
    if (!host) return;
    host.dataset.viewerRole = state.role || "unknown";
    const styleId = "combat073-live-role-style";
    let style = global.document.getElementById(styleId);
    if (!style) {
      style = global.document.createElement("style");
      style.id = styleId;
      style.textContent = `
        #game-container[data-viewer-role="dm"] .command-ring,
        #game-container[data-viewer-role="dm"] .category-surface,
        #game-container[data-viewer-role="dm"] .category-back,
        #game-container[data-viewer-role="dm"] .player-ready-control,
        #game-container[data-viewer-role="dm"] .quick-badge { display:none!important; }
        #game-container[data-viewer-role="player"] .prototype-controls { display:none!important; }
      `;
      global.document.head.appendChild(style);
    }
  }

  function hydrateNow() {
    state.hydrateTimer = null;
    if (!state.runtimeReady || !state.firebaseReady || !global.LuminousCombat073) return false;
    const identity = resolveIdentity();
    state.role = identity.role;
    state.playerId = identity.playerId;
    if (!state.role) {
      setStatus("COMBAT · USER NOT LINKED TO A CAMPAIGN PLAYER");
      return false;
    }
    const focusEntry = state.role === "player" ? playerCombatantEntry() : dmFocusEntry();
    if (!focusEntry) {
      global.LuminousCombat073.reset();
      setStatus("COMBAT · WAITING FOR DM TO DEPLOY COMBATANTS");
      return false;
    }
    const [focusKey, focusUnit] = focusEntry;
    const focusId = clean(focusUnit?.id || focusUnit?.combatId || focusKey) || focusKey;
    const combatants = normalizedCombatants();
    const signature = hydrationSignature(combatants, focusId);
    if (signature === state.lastSignature) return true;
    state.lastSignature = signature;
    setRoleUi();
    global.LuminousCombat073.hydrate({
      playerId: focusId,
      combatants,
      kits: kitsFor(combatants),
      round: state.round,
      playIntro: !state.hydratedOnce && state.role === "player",
    });
    state.hydratedOnce = true;
    if (state.role === "dm") {
      global.LuminousCombat073.camera("full", false);
      setStatus(`TURN ${state.round} · DM VIEW · ${combatants.length} COMBATANTS`);
    } else {
      const phase = normalizeId(state.combatState);
      const planning = phase === "pre_combat_planning" || phase === "planning";
      const host = global.document?.getElementById?.("game-container");
      host?.classList.toggle("ready-menu-visible", planning);
      setStatus(`TURN ${state.round} · ${planning ? "PLANNING" : state.combatState} · ${focusUnit?.name || focusUnit?.characterName || state.playerId}`);
    }
    return true;
  }

  function scheduleHydrate() {
    if (state.hydrateTimer) return;
    state.hydrateTimer = global.setTimeout(() => hydrateNow(), 40);
  }

  function subscribe(path, assign) {
    const ref = state.db.ref(path);
    const handler = (snapshot) => { assign(snapshot.val()); scheduleHydrate(); };
    ref.on("value", handler);
    state.unsubscribers.push(() => ref.off("value", handler));
  }

  function bindRealtime() {
    if (!state.db?.ref || state.firebaseReady) return;
    state.firebaseReady = true;
    subscribe(ROOTS.players, (value) => { state.players = value && typeof value === "object" ? value : {}; });
    subscribe(ROOTS.combatants, (value) => { state.combatants = value && typeof value === "object" ? value : {}; });
    subscribe(ROOTS.skills, (value) => { state.skills = value && typeof value === "object" ? value : {}; });
    subscribe(ROOTS.state, (value) => {
      const parsed = phaseAndRound(value);
      state.combatState = parsed.phase;
      state.round = parsed.round;
    });
    state.db.ref(ROOTS.dmUid).once("value").then((snapshot) => {
      state.dmUid = clean(snapshot.val()) || FALLBACK_DM_UID;
      scheduleHydrate();
    }).catch(() => {});
  }

  function onAuth(user) {
    state.user = user || null;
    state.uid = clean(user?.uid) || null;
    if (!user) {
      setStatus("COMBAT · AUTH REQUIRED");
      return;
    }
    bindRealtime();
    scheduleHydrate();
  }

  function start() {
    if (state.started) return true;
    state.started = true;
    if (!ensureFirebase()) return false;
    state.auth.onAuthStateChanged(onAuth, (error) => {
      console.error("[Combat073] auth state failed", error);
      setStatus("COMBAT · AUTH ERROR");
    });
    return true;
  }

  function stop() {
    state.unsubscribers.splice(0).forEach((unsubscribe) => { try { unsubscribe(); } catch (_) {} });
    if (state.hydrateTimer) global.clearTimeout(state.hydrateTimer);
    state.hydrateTimer = null;
    state.firebaseReady = false;
    state.started = false;
  }

  global.addEventListener("luminous:combat073-runtime-ready", () => {
    state.runtimeReady = true;
    scheduleHydrate();
  });
  global.addEventListener("beforeunload", stop, { once: true });

  global.LuminousCombatLiveAdapter073 = Object.freeze({
    version: VERSION,
    ROOTS,
    state,
    start,
    stop,
    hydrateNow,
    normalizeSkill,
    normalizedCombatants,
    kitsFor,
  });

  start();
})(window);
