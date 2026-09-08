(function (global) {
  "use strict";

  if (global.LuminousBattleViewerDmConsole074?.version === "0.7.4") {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousBattleViewerDmConsole074;
    return;
  }

  const VERSION = "0.7.4";
  const DM_UID = "e9JwFZrtk6g8UMqq2Hf9EHVY7Ay1";
  const ROOTS = Object.freeze({
    players: "campaña/jugadores",
    combatants: "campaña/combate/combatants",
    state: "campaña/combate/estado",
    audit: "campaña/combate/dmAudit",
  });
  const PANEL_ID = "dm-dashboard";
  const STYLE_ID = "battle-viewer-dm-console-074-style";
  const PROFICIENCY_MULTIPLIER = Object.freeze({ none: 0, half: 0.5, proficient: 1, expertise: 2 });
  const ABILITIES = Object.freeze([
    { id: "str", key: "fuerza", english: "strength", code: "STR", name: "Strength", skills: [{ id: "athletics", name: "Athletics" }] },
    { id: "dex", key: "destreza", english: "dexterity", code: "DEX", name: "Dexterity", skills: [
      { id: "acrobatics", name: "Acrobatics" }, { id: "sleight_of_hand", name: "Sleight of Hand" }, { id: "stealth", name: "Stealth" },
    ] },
    { id: "con", key: "constitucion", english: "constitution", code: "CON", name: "Constitution", skills: [] },
    { id: "int", key: "inteligencia", english: "intelligence", code: "INT", name: "Intelligence", skills: [
      { id: "arcana", name: "Arcana" }, { id: "history", name: "History" }, { id: "investigation", name: "Investigation" }, { id: "nature", name: "Nature" }, { id: "religion", name: "Religion" },
    ] },
    { id: "wis", key: "sabiduria", english: "wisdom", code: "WIS", name: "Wisdom", skills: [
      { id: "animal_handling", name: "Animal Handling" }, { id: "insight", name: "Insight" }, { id: "medicine", name: "Medicine" }, { id: "perception", name: "Perception" }, { id: "survival", name: "Survival" },
    ] },
    { id: "cha", key: "carisma", english: "charisma", code: "CHA", name: "Charisma", skills: [
      { id: "deception", name: "Deception" }, { id: "intimidation", name: "Intimidation" }, { id: "performance", name: "Performance" }, { id: "persuasion", name: "Persuasion" },
    ] },
  ]);
  const ABILITY_BY_ID = Object.freeze(Object.fromEntries(ABILITIES.map((entry) => [entry.id, entry])));
  const SKILL_TO_ABILITY = Object.freeze(Object.fromEntries(ABILITIES.flatMap((ability) => ability.skills.map((skill) => [skill.id, ability.id]))));

  const state = {
    db: null,
    players: {},
    combatants: {},
    selectedUnitId: null,
    mounted: false,
    authorized: false,
    listenersBound: false,
    logs: [],
  };

  const normalizeId = (value) => String(value ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  const numberOr = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const integerOr = (value, fallback = 0) => Number.isFinite(Number.parseInt(value, 10)) ? Number.parseInt(value, 10) : fallback;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
  const signed = (value) => numberOr(value, 0) >= 0 ? `+${numberOr(value, 0)}` : String(numberOr(value, 0));

  function currentUid() {
    try { return global.firebase?.auth?.().currentUser?.uid || null; } catch (_) { return null; }
  }

  function isBattleViewerSurface() {
    const doc = global.document;
    return Boolean(doc?.getElementById?.("battlefield") && doc?.getElementById?.("combat-log-terminal"));
  }

  function isDmAuthorized() {
    if (!isBattleViewerSurface()) return false;
    if (!global.firebase?.auth) return true;
    const uid = currentUid();
    return uid === DM_UID;
  }

  function identityValues(entity = {}) {
    return [
      entity.combatId, entity.combat_id, entity.id, entity.unitId, entity.unit_id, entity.playerId, entity.player_id,
      entity.ownerPlayerId, entity.owner_player_id, entity.characterId, entity.character_id, entity.actorId, entity.actor_id,
      entity.uid, entity.vinculo_jugador,
    ].filter((value) => value != null && String(value).trim() !== "").map((value) => String(value).trim());
  }

  function entityLabel(id, entity = {}) {
    return String(entity.characterName || entity.character_name || entity.nombre || entity.name || id || "UNIT").trim() || "UNIT";
  }

  function playerForUnit(unit, players = state.players) {
    if (!unit) return null;
    const ids = new Set(identityValues(unit));
    for (const [playerId, player] of Object.entries(players || {})) {
      if (ids.has(String(playerId)) || identityValues(player).some((id) => ids.has(id))) return { id: playerId, player };
    }
    const unitName = normalizeId(entityLabel("", unit));
    if (!unitName) return null;
    for (const [playerId, player] of Object.entries(players || {})) {
      if (normalizeId(entityLabel(playerId, player)) === unitName) return { id: playerId, player };
    }
    return null;
  }

  function normalizeProfState(value) {
    const id = normalizeId(value || "none");
    return Object.prototype.hasOwnProperty.call(PROFICIENCY_MULTIPLIER, id) ? id : "none";
  }

  function playerLevel(player = {}) {
    const explicit = [player.level, player.characterBuild?.calculatedAtLevel].find((value) => Number.isFinite(Number(value)));
    if (explicit != null) return Math.max(1, Math.trunc(Number(explicit)));
    if (typeof global.calculateLevelData === "function") {
      try {
        const result = global.calculateLevelData(Math.max(0, numberOr(player.xp, 0)));
        if (Number.isFinite(Number(result?.level))) return Math.max(1, Math.trunc(Number(result.level)));
      } catch (_) {}
    }
    return 1;
  }

  function proficiencyBonus(level) {
    return Math.ceil(Math.max(0, numberOr(level, 1)) / 20);
  }

  function proficiencyContribution(level, proficiencyState) {
    return Math.floor(proficiencyBonus(level) * PROFICIENCY_MULTIPLIER[normalizeProfState(proficiencyState)]);
  }

  function abilityModifier(score) {
    return Math.floor((numberOr(score, 10) - 10) / 2);
  }

  function effectiveAbilityScore(player = {}, abilityId) {
    const ability = ABILITY_BY_ID[normalizeId(abilityId)] || ABILITIES[0];
    const stats = player.stats || player.dndStats || {};
    const base = player.baseStats || {};
    const candidates = [
      stats[ability.key], stats[ability.english], stats[ability.id],
      base[ability.key], base[ability.english], base[ability.id],
      player[ability.key], player[ability.english], player[ability.id],
    ];
    const found = candidates.find((value) => Number.isFinite(Number(value)));
    return found == null ? 10 : Number(found);
  }

  function abilityProficiencyState(player = {}, abilityId) {
    const ability = ABILITY_BY_ID[normalizeId(abilityId)] || ABILITIES[0];
    return normalizeProfState(player.abilityProficiency?.[ability.id] ?? player.abilityProficiency?.[ability.key]);
  }

  function skillProficiencyState(player = {}, skillId) {
    const id = normalizeId(skillId);
    return normalizeProfState(player.skillProficiency?.[id] ?? player.skillProficiencies?.[id] ?? player.dndSkills?.[id]?.proficiency ?? player.dndSkills?.[id]?.proficiencyState);
  }

  function saveTotal(player = {}, abilityId) {
    const level = playerLevel(player);
    return abilityModifier(effectiveAbilityScore(player, abilityId)) + proficiencyContribution(level, abilityProficiencyState(player, abilityId));
  }

  function abilityCheckTotal(player = {}, abilityId) {
    return saveTotal(player, abilityId);
  }

  function skillTotal(player = {}, skillId) {
    const id = normalizeId(skillId);
    const abilityId = SKILL_TO_ABILITY[id] || "str";
    const stored = player.dndSkills?.[id]?.value;
    if (Number.isFinite(Number(stored))) return Number(stored);
    return abilityModifier(effectiveAbilityScore(player, abilityId)) + proficiencyContribution(playerLevel(player), skillProficiencyState(player, id));
  }

  function unitSp(unit = {}) {
    const found = [unit.sp, unit.currentSp, unit.currentSP, unit.sp_actual, unit.combatStats?.sp_actual].find((value) => Number.isFinite(Number(value)));
    return found == null ? 0 : Number(found);
  }

  function writeSp(unit, value) {
    const next = clamp(Math.floor(numberOr(value, 0)), -45, 45);
    if (Object.prototype.hasOwnProperty.call(unit, "sp")) unit.sp = next;
    else if (Object.prototype.hasOwnProperty.call(unit, "currentSp")) unit.currentSp = next;
    else if (unit.combatStats && Object.prototype.hasOwnProperty.call(unit.combatStats, "sp_actual")) unit.combatStats.sp_actual = next;
    else unit.sp = next;
    return next;
  }

  function writeShield(unit, value) {
    unit.shield = Math.max(0, Math.floor(numberOr(value, 0)));
    return unit.shield;
  }

  function readHp(unit = {}) {
    const found = [unit.hp, unit.currentHp, unit.currentHP, unit.hp_actual, unit.combatStats?.hp_actual].find((value) => Number.isFinite(Number(value)));
    return found == null ? 0 : Number(found);
  }

  function readMaxHp(unit = {}) {
    const found = [unit.maxHp, unit.maxHP, unit.hp_max, unit.combatStats?.hp_max].find((value) => Number.isFinite(Number(value)));
    return found == null ? Math.max(1, readHp(unit)) : Number(found);
  }

  function writeHp(unit, value) {
    const next = clamp(Math.floor(numberOr(value, 0)), 0, Math.max(1, readMaxHp(unit)));
    if (Object.prototype.hasOwnProperty.call(unit, "hp")) unit.hp = next;
    else if (Object.prototype.hasOwnProperty.call(unit, "currentHp")) unit.currentHp = next;
    else if (unit.combatStats && Object.prototype.hasOwnProperty.call(unit.combatStats, "hp_actual")) unit.combatStats.hp_actual = next;
    else unit.hp = next;
    return next;
  }

  function thresholdPenalty(unit, kind, abilityId, skillId = null) {
    const context = { kind: normalizeId(kind), abilityId: normalizeId(abilityId), skillId: normalizeId(skillId || "") };
    let penalty = 0;
    const conditions = global.LuminousConditionRuntime;
    if (typeof conditions?.thresholdModifier === "function") penalty += numberOr(conditions.thresholdModifier(unit, context), 0);
    const elemental = global.LuminousElementalStatusRuntime;
    if (["ability", "skill", "check"].includes(context.kind) && typeof elemental?.poisonCheckThresholdPenalty === "function") {
      penalty += numberOr(elemental.poisonCheckThresholdPenalty(unit), 0);
    }
    return Math.max(0, Math.floor(penalty));
  }

  function rollCheck(unit, player, spec = {}, random = Math.random) {
    const kind = normalizeId(spec.kind || "ability");
    const abilityId = normalizeId(spec.abilityId || "str");
    const skillId = normalizeId(spec.skillId || "");
    const rawThreshold = Math.max(0, Math.floor(numberOr(spec.threshold, 0)));
    const auto = global.LuminousConditionRuntime?.automaticCheckFailure?.(unit, { kind, abilityId, skillId });
    const base = kind === "skill" ? skillTotal(player || {}, skillId) : kind === "save" ? saveTotal(player || {}, abilityId) : abilityCheckTotal(player || {}, abilityId);
    const penalty = thresholdPenalty(unit, kind, abilityId, skillId);
    const threshold = rawThreshold + penalty;
    if (auto?.failed) return { kind, abilityId, skillId: skillId || null, base, heads: 0, coins: [], total: base, rawThreshold, thresholdPenalty: penalty, threshold, passed: false, automaticFailure: true, reason: auto.reason || "automatic_failure" };
    const headsChance = clamp(50 + unitSp(unit), 5, 95);
    const coins = Array.from({ length: 5 }, () => Number(random()) * 100 < headsChance);
    const heads = coins.filter(Boolean).length;
    const total = Math.floor(base + heads * 4);
    return { kind, abilityId, skillId: skillId || null, base, headsChance, heads, coins, total, rawThreshold, thresholdPenalty: penalty, threshold, passed: total >= threshold, automaticFailure: false };
  }

  function applyDamageToUnit(unit, amount) {
    const damage = Math.max(0, Math.floor(numberOr(amount, 0)));
    const engine = global.CombatEngine;
    if (typeof engine?.applyDamage === "function") return engine.applyDamage(unit, damage, "dm_console", false, null);
    writeHp(unit, readHp(unit) - damage);
    return { damageTaken: damage };
  }

  function applyFixedDamageToUnit(unit, amount) {
    const fixed = global.LuminousFixedDamageRuntime;
    if (typeof fixed?.applyFixedDamage === "function") return fixed.applyFixedDamage(unit, amount, { damageKind: "dm_console", skillUsed: null });
    return applyDamageToUnit(unit, amount);
  }

  function healUnit(unit, amount) {
    const value = Math.max(0, Math.floor(numberOr(amount, 0)));
    const elemental = global.LuminousElementalStatusRuntime;
    const before = readHp(unit);
    writeHp(unit, before + value);
    elemental?.onHealingReceived?.(unit, value, { source: "dm_console", passiveRegeneration: false });
    return { healed: readHp(unit) - before, hp: readHp(unit) };
  }

  function applyStatusToUnit(unit, statusId, input = {}) {
    const id = normalizeId(statusId);
    if (!id || !unit) return null;
    const condition = global.LuminousConditionRuntime;
    if (condition?.getDefinition?.(id)) return condition.applyCondition(unit, id, { ...input, mode: input.mode || "set" });
    return global.LuminousStatusEngine?.applyStatus?.(unit, id, { ...input, mode: input.mode || "set" }) || null;
  }

  function removeStatusFromUnit(unit, statusId, options = {}) {
    return global.LuminousStatusEngine?.removeStatus?.(unit, normalizeId(statusId), { from: "dm_console", ignoreProtection: Boolean(options.force) }) || { removed: false };
  }

  function runTurnStart(units, selectedId, options = {}) {
    const list = Object.values(units || {});
    const unit = units?.[selectedId] || list.find((entry) => identityValues(entry).includes(String(selectedId)));
    if (!unit) return null;
    const out = {
      elemental: global.LuminousElementalStatusRuntime?.onTurnStart?.(unit, { allUnits: list, source: "dm_console" }) || null,
      conditions: global.LuminousConditionRuntime?.turnStart?.(unit, { units: list, random: options.random || Math.random, source: "dm_console" }) || null,
    };
    return { unit, out };
  }

  function runTurnEnd(units, selectedId, options = {}) {
    const list = Object.values(units || {});
    const unit = units?.[selectedId] || list.find((entry) => identityValues(entry).includes(String(selectedId)));
    if (!unit) return null;
    const conditionResult = global.LuminousConditionRuntime?.turnEnd?.(unit, { units: list, resolveCheck: options.resolveCheck, source: "dm_console" }) || null;
    const elementalResult = global.LuminousElementalStatusRuntime?.onTurnEnd?.(unit, { allUnits: list, source: "dm_console" }) || null;
    return { unit, out: { conditions: conditionResult, elemental: elementalResult } };
  }

  function runRest(units, selectedId, type) {
    const list = Object.values(units || {});
    const unit = units?.[selectedId] || list.find((entry) => identityValues(entry).includes(String(selectedId)));
    if (!unit) return null;
    const elemental = global.LuminousElementalStatusRuntime?.onRest?.(unit, type, { allUnits: list, source: "dm_console" }) || null;
    const exhaustion = global.LuminousExhaustionEngine;
    if (normalizeId(type) === "long_rest") exhaustion?.onLongRest?.(unit);
    return { unit, out: { elemental } };
  }

  function runEncounterEnd(units, selectedId) {
    const list = Object.values(units || {});
    const unit = units?.[selectedId] || list.find((entry) => identityValues(entry).includes(String(selectedId)));
    if (!unit) return null;
    const elemental = global.LuminousElementalStatusRuntime?.onEncounterEnd?.(unit, { allUnits: list, source: "dm_console" }) || null;
    return { unit, out: { elemental } };
  }

  function sanitizeForFirebase(value) {
    if (Array.isArray(value)) return value.map(sanitizeForFirebase);
    if (!value || typeof value !== "object") return value;
    const out = {};
    Object.entries(value).forEach(([key, item]) => {
      if (typeof item === "function" || item === undefined) return;
      out[key] = sanitizeForFirebase(item);
    });
    return out;
  }

  function combatantKey(unitId, combatants = state.combatants) {
    const wanted = String(unitId || "");
    if (Object.prototype.hasOwnProperty.call(combatants || {}, wanted)) return wanted;
    for (const [key, unit] of Object.entries(combatants || {})) if (identityValues(unit).includes(wanted)) return key;
    return null;
  }

  async function mutateCombatants(mutator, audit = {}) {
    const db = state.db;
    if (!db?.ref || typeof mutator !== "function") throw new Error("DM console database is not ready.");
    const ref = db.ref(ROOTS.combatants);
    let resultPayload = null;
    const transaction = await ref.transaction((current) => {
      const working = clone(current || {});
      resultPayload = mutator(working) ?? null;
      return sanitizeForFirebase(working);
    });
    if (!transaction?.committed) throw new Error("Combatant transaction was not committed.");
    appendLog(audit.label || audit.type || "DM MUTATION", resultPayload);
    writeAudit({ ...audit, result: sanitizeForFirebase(resultPayload) }).catch(() => {});
    return { committed: true, result: resultPayload, combatants: transaction.snapshot?.val?.() || null };
  }

  async function mutateSelected(mutator, audit = {}) {
    const selected = state.selectedUnitId;
    if (!selected) throw new Error("Select a combatant first.");
    return mutateCombatants((working) => {
      const key = combatantKey(selected, working);
      if (!key || !working[key]) throw new Error(`Combatant ${selected} is no longer available.`);
      return mutator(working[key], working, key);
    }, { ...audit, unitId: selected });
  }

  async function writeAudit(payload = {}) {
    if (!state.db?.ref) return false;
    const ref = state.db.ref(ROOTS.audit).push();
    await ref.set({ schemaVersion: 1, version: VERSION, dmUid: currentUid(), createdAt: Date.now(), ...sanitizeForFirebase(payload) });
    return true;
  }

  function appendLog(label, data = null) {
    const entry = { at: Date.now(), label: String(label || "DM"), data: sanitizeForFirebase(data) };
    state.logs.unshift(entry);
    state.logs = state.logs.slice(0, 30);
    const combatLog = global.document?.getElementById?.("combat-log-terminal");
    if (combatLog) {
      const line = global.document.createElement("div");
      line.className = "log-entry interrupt";
      line.textContent = `> [ DM 0.7.4 ] ${entry.label}`;
      combatLog.appendChild(line);
      combatLog.scrollTop = combatLog.scrollHeight;
    }
    renderLog();
    return entry;
  }

  function ensureStyle() {
    const doc = global.document;
    if (!doc?.head || doc.getElementById(STYLE_ID)) return;
    const style = doc.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
#${PANEL_ID}.dm074{width:390px;max-height:94vh;top:12px;right:12px;background:rgba(8,8,10,.97);border:1px solid #8f6a32;box-shadow:0 12px 40px rgba(0,0,0,.65);font-family:Arial,sans-serif;font-size:11px;}
.dm074 .dm074-head{display:flex;justify-content:space-between;align-items:center;padding:8px 10px;background:#1e1207;border-bottom:1px solid #8f6a32;color:#ffd766;font-family:var(--font-limbus,'Bebas Neue',sans-serif);letter-spacing:1px;font-size:16px;}
.dm074 .dm074-head small{display:block;color:#ad966e;font:10px Arial,sans-serif;letter-spacing:0}.dm074 .dm074-body{padding:8px;display:grid;gap:8px}.dm074 select,.dm074 input{background:#080808;border:1px solid #57472e;color:#eee;padding:5px;min-width:0}.dm074 button{background:#12100c;border:1px solid #9a7438;color:#e6c278;padding:5px 7px;cursor:pointer}.dm074 button:hover{background:#2a1e0f}.dm074 button.danger{border-color:#a33;color:#ff9b86}.dm074 button.good{border-color:#47794d;color:#aee6b6}.dm074 .dm074-row{display:flex;gap:5px;align-items:center;flex-wrap:wrap}.dm074 .dm074-row>*{flex:1}.dm074 .dm074-card{border:1px solid #392f20;background:rgba(0,0,0,.28);padding:7px}.dm074 .dm074-title{color:#d7b05c;font-weight:700;margin-bottom:6px;text-transform:uppercase}.dm074 .dm074-summary{display:grid;grid-template-columns:repeat(4,1fr);gap:4px}.dm074 .dm074-stat{border:1px solid #28231b;padding:4px;text-align:center}.dm074 .dm074-stat b{display:block;color:#fff;font-size:14px}.dm074 .dm074-stat small{color:#9d927c}.dm074 .dm074-abilities{display:grid;grid-template-columns:repeat(3,1fr);gap:4px}.dm074 .dm074-ability{border:1px solid #29241c;padding:5px}.dm074 .dm074-ability b{color:#ffd766}.dm074 .dm074-ability span{display:block;color:#bbb}.dm074 .dm074-statuses{max-height:115px;overflow:auto;display:grid;gap:3px}.dm074 .dm074-status{display:flex;justify-content:space-between;border-bottom:1px solid #242018;padding:3px 0}.dm074 .dm074-test-grid{display:grid;grid-template-columns:1fr 1fr;gap:5px}.dm074 .dm074-log{max-height:110px;overflow:auto;font:10px 'Courier New',monospace;color:#b8b1a0}.dm074 .dm074-log div{border-bottom:1px solid #211e18;padding:3px 0}.dm074 .dm074-muted{color:#817968}.dm074 [hidden]{display:none!important}`;
    doc.head.appendChild(style);
  }

  function make(tag, attrs = {}, text = "") {
    const node = global.document.createElement(tag);
    Object.entries(attrs).forEach(([key, value]) => {
      if (key === "class") node.className = value;
      else if (key === "html") node.innerHTML = value;
      else node.setAttribute(key, String(value));
    });
    if (text !== "") node.textContent = text;
    return node;
  }

  function mount() {
    const doc = global.document;
    if (!doc?.body || !isBattleViewerSurface() || !state.authorized) return false;
    ensureStyle();
    let panel = doc.getElementById(PANEL_ID);
    if (!panel) {
      panel = make("aside", { id: PANEL_ID, class: "dm074" });
      doc.getElementById("game-container")?.appendChild(panel);
    }
    panel.classList.add("dm074");
    panel.innerHTML = `
      <div class="dm074-head"><div>DM TEST CONSOLE<small>Battle Viewer · Runtime ${VERSION}</small></div><button type="button" id="dm074-collapse">—</button></div>
      <div class="dm074-body" id="dm074-body">
        <div class="dm074-row"><select id="dm074-unit"><option value="">— Select combatant —</option></select><button id="dm074-refresh" type="button">REFRESH</button></div>
        <section class="dm074-card"><div class="dm074-title">Runtime Snapshot</div><div id="dm074-overview" class="dm074-summary"></div></section>
        <section class="dm074-card"><div class="dm074-title">Player Scores</div><div id="dm074-abilities" class="dm074-abilities"></div></section>
        <section class="dm074-card"><div class="dm074-title">Status / Conditions</div><div id="dm074-statuses" class="dm074-statuses"></div>
          <div class="dm074-test-grid" style="margin-top:6px"><select id="dm074-status-id"></select><select id="dm074-source-type"><option value="normal">Normal</option><option value="magic">Magic</option><option value="item">Item</option><option value="ephemeral">Ephemeral</option></select><input id="dm074-potency" type="number" value="0" placeholder="Potency"><input id="dm074-count" type="number" value="1" placeholder="Count"><input id="dm074-threshold" type="number" placeholder="Save Threshold"><input id="dm074-source-unit" placeholder="Source Unit ID"></div>
          <div class="dm074-row" style="margin-top:5px"><button id="dm074-apply-status" type="button">APPLY / SET</button><button id="dm074-remove-status" class="danger" type="button">FORCE REMOVE</button></div>
        </section>
        <section class="dm074-card"><div class="dm074-title">Direct Runtime Controls</div>
          <div class="dm074-row"><input id="dm074-amount" type="number" value="10"><button id="dm074-damage" class="danger" type="button">DAMAGE</button><button id="dm074-fixed" class="danger" type="button">FIXED</button><button id="dm074-heal" class="good" type="button">HEAL</button></div>
          <div class="dm074-row"><input id="dm074-sp-delta" type="number" value="5"><button id="dm074-sp" type="button">± SP</button><input id="dm074-shield-delta" type="number" value="10"><button id="dm074-shield" type="button">± SHIELD</button></div>
          <div class="dm074-row"><button id="dm074-turn-start" type="button">TURN START</button><button id="dm074-turn-end" type="button">TURN END</button><button id="dm074-enc-end" type="button">ENCOUNTER END</button></div>
          <div class="dm074-row"><button id="dm074-short-rest" type="button">SHORT REST</button><button id="dm074-long-rest" type="button">LONG REST</button><button id="dm074-break-conc" class="danger" type="button">BREAK CONC.</button></div>
        </section>
        <section class="dm074-card"><div class="dm074-title">5-Coin Check Test</div><div class="dm074-test-grid"><select id="dm074-check-kind"><option value="ability">Ability Check</option><option value="save">Saving Throw</option><option value="skill">Skill Check</option></select><select id="dm074-check-ability">${ABILITIES.map((a) => `<option value="${a.id}">${a.code} · ${a.name}</option>`).join("")}</select><select id="dm074-check-skill"></select><input id="dm074-check-threshold" type="number" value="12" placeholder="Threshold"></div><div class="dm074-row" style="margin-top:5px"><button id="dm074-roll" type="button">ROLL 5 COINS</button><div id="dm074-roll-result" class="dm074-muted">—</div></div></section>
        <section class="dm074-card"><div class="dm074-title">DM Audit</div><div id="dm074-log" class="dm074-log"></div></section>
      </div>`;
    bindUi(panel);
    state.mounted = true;
    renderAll();
    return true;
  }

  function unmount() {
    global.document?.getElementById?.(PANEL_ID)?.remove();
    state.mounted = false;
  }

  function renderUnitOptions() {
    const select = global.document?.getElementById?.("dm074-unit");
    if (!select) return;
    const previous = state.selectedUnitId || select.value;
    select.innerHTML = '<option value="">— Select combatant —</option>';
    Object.entries(state.combatants || {}).sort((a, b) => entityLabel(a[0], a[1]).localeCompare(entityLabel(b[0], b[1]))).forEach(([key, unit]) => {
      const option = global.document.createElement("option"); option.value = key; option.textContent = `${entityLabel(key, unit)} · ${unit.faction || "?"}`; select.appendChild(option);
    });
    if (previous && state.combatants?.[previous]) select.value = previous;
    else if (!state.selectedUnitId && select.options.length > 1) { select.selectedIndex = 1; state.selectedUnitId = select.value; }
  }

  function selectedUnit() { return state.combatants?.[state.selectedUnitId] || null; }

  function renderOverview() {
    const host = global.document?.getElementById?.("dm074-overview");
    if (!host) return;
    const unit = selectedUnit();
    if (!unit) { host.innerHTML = '<span class="dm074-muted">No combatant selected.</span>'; return; }
    const playerLink = playerForUnit(unit);
    const off = numberOr(unit.offensiveLevel ?? unit.offenseLevel ?? unit.offensive_level ?? unit.level, 0);
    const def = numberOr(unit.defensiveLevel ?? unit.defenseLevel ?? unit.defensive_level ?? unit.level, 0);
    const items = [
      ["HP", `${readHp(unit)}/${readMaxHp(unit)}`], ["SP", unitSp(unit)], ["Shield", numberOr(unit.shield, 0)], ["Speed", numberOr(unit.speed, 0)],
      ["OFF", off], ["DEF", def], ["Slots", numberOr(unit.actionSlots ?? unit.activeSlots, 1)], ["Player", playerLink ? entityLabel(playerLink.id, playerLink.player) : "NPC"],
    ];
    host.innerHTML = items.map(([label, value]) => `<div class="dm074-stat"><small>${label}</small><b>${value}</b></div>`).join("");
  }

  function renderAbilities() {
    const host = global.document?.getElementById?.("dm074-abilities");
    if (!host) return;
    const unit = selectedUnit(); const linked = playerForUnit(unit); const player = linked?.player;
    if (!player) { host.innerHTML = '<span class="dm074-muted">No linked Player record. NPC runtime values remain available above.</span>'; return; }
    host.innerHTML = ABILITIES.map((ability) => {
      const score = effectiveAbilityScore(player, ability.id); const mod = abilityModifier(score); const save = saveTotal(player, ability.id);
      return `<div class="dm074-ability"><b>${ability.code} ${score}</b><span>MOD ${signed(mod)}</span><span>SAVE ${signed(save)}</span></div>`;
    }).join("");
  }

  function renderStatuses() {
    const host = global.document?.getElementById?.("dm074-statuses"); if (!host) return;
    const statuses = selectedUnit()?.statusEffects || {};
    const rows = Object.entries(statuses);
    host.innerHTML = rows.length ? rows.map(([id, entry]) => `<div class="dm074-status"><span>${id}</span><b>P ${numberOr(entry?.potency, 0)} · C ${numberOr(entry?.count, 0)}</b></div>`).join("") : '<span class="dm074-muted">No active Status/Conditions.</span>';
  }

  function renderStatusOptions() {
    const select = global.document?.getElementById?.("dm074-status-id"); if (!select) return;
    const current = select.value;
    const ids = new Set(Object.keys(global.STATUS_REGISTRY || {}));
    Object.keys(global.LuminousConditionRuntime?.DEFINITIONS || {}).forEach((id) => ids.add(id));
    Object.keys(global.LuminousElementalStatusRuntime?.STATUS_DEFINITIONS || {}).forEach((id) => ids.add(id));
    select.innerHTML = Array.from(ids).sort().map((id) => `<option value="${id}">${id}</option>`).join("");
    if (current && ids.has(current)) select.value = current;
  }

  function renderSkills() {
    const abilityId = global.document?.getElementById?.("dm074-check-ability")?.value || "str";
    const select = global.document?.getElementById?.("dm074-check-skill"); if (!select) return;
    const ability = ABILITY_BY_ID[abilityId] || ABILITIES[0];
    select.innerHTML = ability.skills.length ? ability.skills.map((skill) => `<option value="${skill.id}">${skill.name}</option>`).join("") : '<option value="">— no skills —</option>';
  }

  function renderLog() {
    const host = global.document?.getElementById?.("dm074-log"); if (!host) return;
    host.innerHTML = state.logs.length ? state.logs.map((entry) => `<div>${new Date(entry.at).toLocaleTimeString()} · ${entry.label}</div>`).join("") : '<div class="dm074-muted">No DM mutations yet.</div>';
  }

  function renderAll() { renderUnitOptions(); renderStatusOptions(); renderOverview(); renderAbilities(); renderStatuses(); renderSkills(); renderLog(); }

  function bindUi(panel) {
    const $ = (id) => panel.querySelector(`#${id}`);
    $("dm074-collapse").onclick = () => { const body = $("dm074-body"); body.hidden = !body.hidden; $("dm074-collapse").textContent = body.hidden ? "+" : "—"; };
    $("dm074-unit").onchange = (event) => { state.selectedUnitId = event.target.value || null; renderAll(); };
    $("dm074-refresh").onclick = renderAll;
    $("dm074-check-ability").onchange = renderSkills;

    $("dm074-damage").onclick = () => mutateSelected((unit) => applyDamageToUnit(unit, $("dm074-amount").value), { type: "damage", label: "DAMAGE" }).catch(showError);
    $("dm074-fixed").onclick = () => mutateSelected((unit) => applyFixedDamageToUnit(unit, $("dm074-amount").value), { type: "fixed_damage", label: "FIXED DAMAGE" }).catch(showError);
    $("dm074-heal").onclick = () => mutateSelected((unit) => healUnit(unit, $("dm074-amount").value), { type: "heal", label: "HEAL" }).catch(showError);
    $("dm074-sp").onclick = () => mutateSelected((unit) => ({ sp: writeSp(unit, unitSp(unit) + numberOr($("dm074-sp-delta").value, 0)) }), { type: "sp", label: "SP CHANGE" }).catch(showError);
    $("dm074-shield").onclick = () => mutateSelected((unit) => ({ shield: writeShield(unit, numberOr(unit.shield, 0) + numberOr($("dm074-shield-delta").value, 0)) }), { type: "shield", label: "SHIELD CHANGE" }).catch(showError);

    $("dm074-apply-status").onclick = () => mutateSelected((unit) => {
      const id = $("dm074-status-id").value; const sourceType = $("dm074-source-type").value; const threshold = $("dm074-threshold").value;
      const entry = applyStatusToUnit(unit, id, { mode: "set", potency: numberOr($("dm074-potency").value, 0), count: numberOr($("dm074-count").value, 1), sourceType, sourceUnitId: $("dm074-source-unit").value || null, saveThreshold: threshold === "" ? null : numberOr(threshold, 0), removalMode: sourceType === "magic" ? "concentration" : undefined });
      if (!entry) throw new Error(`${id} was rejected by its application rules or immunity gate.`);
      return { id, entry };
    }, { type: "apply_status", label: "APPLY STATUS" }).catch(showError);
    $("dm074-remove-status").onclick = () => mutateSelected((unit) => ({ id: $("dm074-status-id").value, result: removeStatusFromUnit(unit, $("dm074-status-id").value, { force: true }) }), { type: "remove_status", label: "FORCE REMOVE STATUS" }).catch(showError);

    $("dm074-turn-start").onclick = () => mutateSelected((unit, all, key) => runTurnStart(all, key), { type: "turn_start", label: "FORCE TURN START" }).catch(showError);
    $("dm074-turn-end").onclick = () => mutateSelected((unit, all, key) => runTurnEnd(all, key), { type: "turn_end", label: "FORCE TURN END" }).catch(showError);
    $("dm074-enc-end").onclick = () => mutateSelected((unit, all, key) => runEncounterEnd(all, key), { type: "encounter_end", label: "FORCE ENCOUNTER END" }).catch(showError);
    $("dm074-short-rest").onclick = () => mutateSelected((unit, all, key) => runRest(all, key, "short_rest"), { type: "short_rest", label: "SHORT REST" }).catch(showError);
    $("dm074-long-rest").onclick = () => mutateSelected((unit, all, key) => runRest(all, key, "long_rest"), { type: "long_rest", label: "LONG REST" }).catch(showError);
    $("dm074-break-conc").onclick = () => mutateSelected((unit, all) => global.LuminousConditionRuntime?.loseConcentration?.(unit, { units: Object.values(all), reason: "dm_console" }) || null, { type: "break_concentration", label: "BREAK CONCENTRATION" }).catch(showError);

    $("dm074-roll").onclick = () => {
      const unit = selectedUnit(); const linked = playerForUnit(unit); if (!unit || !linked) return showError(new Error("Selected combatant has no linked Player scores."));
      const kind = $("dm074-check-kind").value; const abilityId = $("dm074-check-ability").value; const skillId = $("dm074-check-skill").value; const threshold = $("dm074-check-threshold").value;
      const result = rollCheck(unit, linked.player, { kind, abilityId, skillId, threshold });
      $("dm074-roll-result").textContent = result.automaticFailure ? `AUTO FAIL · THR ${result.threshold}` : `${result.heads}/5 Heads · ${result.total} vs ${result.threshold} · ${result.passed ? "PASS" : "FAIL"}`;
      appendLog(`CHECK ${result.passed ? "PASS" : "FAIL"} · ${result.total}/${result.threshold}`, result);
      writeAudit({ type: "check_test", unitId: state.selectedUnitId, result }).catch(() => {});
    };
  }

  function showError(error) {
    console.error("[DM Console 0.7.4]", error);
    appendLog(`ERROR · ${error?.message || error}`);
  }

  function bindFirebase() {
    if (!state.db?.ref || state.listenersBound) return false;
    state.listenersBound = true;
    state.db.ref(ROOTS.players).on("value", (snapshot) => { state.players = snapshot.val() || {}; renderAll(); });
    state.db.ref(ROOTS.combatants).on("value", (snapshot) => {
      state.combatants = snapshot.val() || {};
      if (state.selectedUnitId && !state.combatants[state.selectedUnitId]) state.selectedUnitId = null;
      renderAll();
    });
    return true;
  }

  function authorizeAndBoot(user = undefined) {
    const uid = user === undefined ? currentUid() : user?.uid || null;
    state.authorized = !global.firebase?.auth || uid === DM_UID;
    if (!state.authorized) { unmount(); return false; }
    state.db = state.db || (global.firebase?.database ? global.firebase.database() : null);
    mount(); bindFirebase();
    return true;
  }

  function init(options = {}) {
    if (!isBattleViewerSurface() && global.document) return false;
    if (options.db) state.db = options.db;
    if (!global.document) return true;
    const auth = global.firebase?.auth?.();
    if (auth?.onAuthStateChanged) {
      auth.onAuthStateChanged((user) => authorizeAndBoot(user));
      if (auth.currentUser) authorizeAndBoot(auth.currentUser);
      return true;
    }
    return authorizeAndBoot(undefined);
  }

  const api = Object.freeze({
    version: VERSION, DM_UID, ROOTS, ABILITIES, PROFICIENCY_MULTIPLIER,
    normalizeId, identityValues, playerForUnit, playerLevel, proficiencyBonus, proficiencyContribution, abilityModifier,
    effectiveAbilityScore, abilityProficiencyState, skillProficiencyState, saveTotal, abilityCheckTotal, skillTotal,
    unitSp, writeSp, readHp, readMaxHp, writeHp, writeShield, thresholdPenalty, rollCheck,
    applyDamageToUnit, applyFixedDamageToUnit, healUnit, applyStatusToUnit, removeStatusFromUnit,
    runTurnStart, runTurnEnd, runRest, runEncounterEnd, sanitizeForFirebase, combatantKey,
    mutateCombatants, mutateSelected, isBattleViewerSurface, isDmAuthorized, mount, unmount, init,
    _state: state,
  });

  global.LuminousBattleViewerDmConsole074 = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;

  if (global.document) {
    const boot = () => init();
    if (global.document.readyState === "loading") global.document.addEventListener("DOMContentLoaded", boot, { once: true });
    else boot();
  }
})(typeof window !== "undefined" ? window : globalThis);
