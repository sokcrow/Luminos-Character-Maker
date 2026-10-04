(function (global) {
  "use strict";

  if (global.LuminousCombatEconomyMenu073) return;

  const VERSION = "0.7.3-economy-menu.2-canonical-player-menu";
  const TABBED_MENUS = new Set(["global", "skills", "spells", "items"]);
  const ECONOMY = Object.freeze({ ACTION: "action", QUICK: "quick_action", REACTION: "reaction" });
  const state = {
    installed: false,
    tabByMenu: { global: ECONOMY.ACTION, skills: ECONOMY.ACTION, spells: ECONOMY.ACTION, items: ECONOMY.ACTION },
    originals: {},
    traitStateById: new Map(),
    preparedReaction: null,
    pendingTarget: null,
    lastPlanningRound: null,
    lastEconomyUnit: null,
    quickSpentRound: null,
    reactionSpentRound: null,
    classObserver: null,
    menuObserver: null,
    itemRowByInstanceId: new Map(),
  };

  const clean = (value) => String(value ?? "").trim();
  const normalizeId = (value) => clean(value).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
  const asArray = (value) => value == null ? [] : (Array.isArray(value) ? value : [value]);
  const htmlEscape = (value) => clean(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  function lexical(name, fallback = null) {
    try {
      return typeof global.eval === "function"
        ? (global.eval(`typeof ${name} !== 'undefined' ? ${name} : undefined`) ?? fallback)
        : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function assignLexical(name, valueExpression) {
    try {
      global.eval(`${name} = ${valueExpression}`);
      return true;
    } catch (error) {
      global.console?.error?.(`[CombatEconomy073] Could not patch ${name}`, error);
      return false;
    }
  }

  function activeMenu() { return clean(lexical("activeMenu", "")); }
  function playerId() { return clean(lexical("PLAYER_ID", global.LuminousCombat073?.playerId?.() || "")); }
  function combatData() { return lexical("combatData", global.LuminousCombat073?.combatants?.() || {}) || {}; }
  function canonicalPlayerId(unit = {}) {
    return clean(unit.canonicalPlayerKey || unit.ownerPlayerId || unit.playerId || unit.characterLink?.playerId);
  }
  function playerUnit() {
    const id = playerId();
    const rows = combatData();
    if (id && rows?.[id]) return rows[id];
    const canonical = clean(global.LuminousCombatLiveAdapter073?.state?.playerId);
    return Object.values(rows || {}).find((unit) =>
      unit?.controlled === "player"
      || (canonical && canonicalPlayerId(unit) === canonical)
      || (id && clean(unit?.id || unit?.combatId) === id)
    ) || null;
  }
  function unitKits() { return lexical("UNIT_KITS", {}) || {}; }
  function playerKit() {
    const kits = unitKits();
    const unit = playerUnit() || {};
    const candidates = [
      playerId(),
      clean(unit.id),
      clean(unit.combatId),
      clean(global.LuminousCombatLiveAdapter073?.state?.playerId),
      canonicalPlayerId(unit),
    ].filter(Boolean);
    for (const id of candidates) if (kits?.[id]) return kits[id];
    return {};
  }
  function permanent() { return lexical("permanent", {}) || {}; }
  function roundNumber() { return Math.max(1, Number(lexical("round", 1)) || 1); }
  function selectedSlotIndex() { return Math.max(0, Number(lexical("selectedSlotIndex", 0)) || 0); }

  function normalizeEconomyCost(source = {}, fallback = ECONOMY.ACTION) {
    const raw = normalizeId(
      source?.economyCost ?? source?.economy_cost ?? source?.economy?.cost ?? source?.actionCost ??
      source?.action_cost ?? source?.activation?.actionCost ?? source?.activation?.action_cost ??
      source?.activationCost ?? source?.activation_cost ?? fallback
    );
    if (["quick", "quickaction", "quick_action", "bonus", "bonus_action", "bonusaction"].includes(raw)) return ECONOMY.QUICK;
    if (["reaction", "react", "reactive"].includes(raw)) return ECONOMY.REACTION;
    if (["none", "free", "free_action", "automatic", "passive", "special"].includes(raw)) return raw;
    return ECONOMY.ACTION;
  }

  function economyTabFor(source = {}) {
    const cost = normalizeEconomyCost(source);
    return cost === ECONOMY.QUICK || cost === ECONOMY.REACTION ? cost : ECONOMY.ACTION;
  }

  function costLabel(source = {}) {
    const cost = normalizeEconomyCost(source);
    if (cost === ECONOMY.QUICK) return "1 Quick Action";
    if (cost === ECONOMY.REACTION) return "1 Reaction";
    if (["none", "free", "free_action"].includes(cost)) return "Free";
    return clean(source.cost || source.costLabel || "1 Action Slot");
  }

  function sourceIsManualTrait(trait = {}) {
    const cost = normalizeEconomyCost(trait, "none");
    const activation = normalizeId(trait.activation?.type || trait.activationType || trait.activation_type || "passive");
    const contexts = asArray(trait.contexts || trait.context || ["any"]).map(normalizeId);
    if (contexts.length && !contexts.includes("any") && !contexts.includes("combat")) return false;
    if (cost === ECONOMY.ACTION || cost === ECONOMY.QUICK || cost === ECONOMY.REACTION) return true;
    return ["manual", "prompt", "choice"].includes(activation) && !["none", "free", "automatic", "passive"].includes(cost);
  }

  function flattenTraitRows(value) {
    if (!value) return [];
    if (Array.isArray(value)) return value.flatMap(flattenTraitRows);
    if (typeof value !== "object") return [];
    if (value.activation || value.effects || value.rules || value.mechanics || value.traitId || value.id) return [value];
    return Object.values(value).flatMap(flattenTraitRows);
  }

  function resolvedArchetypeTraits(unit = {}) {
    const catalog = global.LuminousArchetypeTraitCatalog;
    if (!catalog?.resolveTraitGrants) return [];
    try {
      const resolved = catalog.resolveTraitGrants(unit) || [];
      return flattenTraitRows(resolved).map((entry) => entry.trait || entry.definition || entry.traitDefinition || entry).filter(Boolean);
    } catch (error) {
      global.console?.warn?.("[CombatEconomy073] Archetype trait resolution failed", error);
      return [];
    }
  }

  function traitDefinitionsForPlayer() {
    const unit = playerUnit() || {};
    const candidates = [
      unit.traitDefinitions,
      unit.combatTraits,
      unit.actionTraits,
      unit.traits,
      unit.classTraits,
      unit.archetypeTraits,
      unit.features,
      unit.characterBuild?.traitDefinitions,
      resolvedArchetypeTraits(unit),
    ];
    const unique = new Map();
    candidates.flatMap(flattenTraitRows).forEach((trait) => {
      if (!trait || typeof trait !== "object") return;
      const id = normalizeId(trait.id || trait.traitId || trait.name);
      if (!id || !sourceIsManualTrait(trait)) return;
      unique.set(id, {
        ...clone(trait),
        id,
        traitId: id,
        kind: "trait",
        sourceType: "trait",
        economyCost: normalizeEconomyCost(trait),
        cost: costLabel(trait),
        name: clean(trait.name || trait.nombre || id) || id,
        tag: clean(trait.tag || `Trait · ${normalizeEconomyCost(trait).replaceAll("_", " ")}`),
        description: clean(trait.description || trait.descripcion || "Trait action."),
      });
    });
    return [...unique.values()];
  }

  function liveActions(kind) {
    const kit = playerKit();
    return asArray(kit.actions).filter((row) => {
      const raw = normalizeId(row?.kind || row?.actionType || row?.action_type || "");
      if (raw) return raw === kind;
      // Canonical Skill records often use `type` for Slash/Pierce/Guard rather
      // than for the content kind.  A missing `kind` must therefore default to
      // Skill unless the record positively identifies itself as something else.
      const type = normalizeId(row?.type || "");
      const defense = row?.isDefense === true || row?.is_defense === true
        || ["defense", "guard", "evade", "counter", "clashable_guard", "clashable_counter"].includes(type);
      const spell = row?.isSpell === true || row?.is_spell === true || type.includes("spell");
      if (kind === "skill") return !defense && !spell;
      if (kind === "spell") return spell;
      return false;
    });
  }

  function spellLoadoutRuntime() {
    return global.LuminousCombatSpellLoadout074 || null;
  }

  function normalizeSpellForMenu(spell = {}, spellId = "") {
    const id = normalizeId(spell.spellId || spell.id || spellId || spell.name);
    const casting = normalizeId(spell.castingTime || spell.casting_time || spell.actionCost || spell.action_cost || "action");
    const actionCost = ["quick", "quick_action", "bonus", "bonus_action"].includes(casting)
      ? ECONOMY.QUICK
      : (["reaction", "reactive"].includes(casting) ? ECONOMY.REACTION : ECONOMY.ACTION);
    return {
      ...clone(spell),
      id,
      spellId: id,
      kind: "spell",
      sourceType: "spell",
      actionCost,
      economyCost: actionCost,
      name: clean(spell.name || spell.nombre || id) || id,
      description: clean(spell.description || spell.descripcion || ""),
    };
  }

  function classEntries(unit = playerUnit() || {}) {
    const build = unit?.characterBuild && typeof unit.characterBuild === "object" ? unit.characterBuild : {};
    let raw = Array.isArray(unit.classes) ? unit.classes : (Array.isArray(build.classes) ? build.classes : []);
    if (!raw.length) {
      const levels = unit.classLevels || build.classLevels || {};
      raw = Object.entries(levels || {}).map(([classId, value]) => typeof value === "object" ? { classId, ...value } : { classId, levels: value });
    }
    return raw.map((entry) => ({
      classId: normalizeId(entry?.classId || entry?.id || entry?.name),
      levels: Math.max(0, Number.parseInt(entry?.levels ?? entry?.level ?? entry?.classLevel ?? 0, 10) || 0),
    })).filter((entry) => entry.classId && entry.levels > 0);
  }

  function spellcastingClasses(unit = playerUnit() || {}) {
    const runtime = global.LuminousSpellcastingRuntime;
    if (!runtime?.getClassSpellcastingProfile) return [];
    return classEntries(unit).map((entry) => {
      let profile = null;
      try { profile = runtime.getClassSpellcastingProfile(entry.classId); } catch (_) {}
      if (!profile) return null;
      const start = Math.max(1, Number.parseInt(profile.spellcastingStartLimbusLevel ?? 1, 10) || 1);
      return entry.levels >= start ? { ...entry, profile, startLevel: start } : null;
    }).filter(Boolean);
  }

  function isSpellcaster(unit = playerUnit() || {}) {
    return spellcastingClasses(unit).length > 0;
  }

  function collectSpellIds(value, out = new Set()) {
    if (value == null) return out;
    if (typeof value === "string" || typeof value === "number") {
      const id = normalizeId(value);
      if (id) out.add(id);
      return out;
    }
    if (Array.isArray(value)) {
      value.forEach((entry) => collectSpellIds(entry, out));
      return out;
    }
    if (typeof value === "object") {
      const explicit = normalizeId(value.spellId || value.id || value.key || value.definitionId);
      if (explicit) out.add(explicit);
      else Object.entries(value).forEach(([key, entry]) => {
        if (entry === true) collectSpellIds(key, out);
        else collectSpellIds(entry, out);
      });
    }
    return out;
  }

  function selectedSpellIds(unit = playerUnit() || {}) {
    const out = new Set();
    [
      unit.spellIds,
      unit.spellSelections,
      unit.knownSpellIds,
      unit.preparedSpellIds,
      unit.characterBuild?.spellIds,
      unit.characterBuild?.spellSelections,
      unit.characterBuild?.knownSpellIds,
      unit.characterBuild?.preparedSpellIds,
    ].forEach((value) => collectSpellIds(value, out));
    return out;
  }

  function spellIdOf(row = {}) {
    return normalizeId(row.spellId || row.id || row.key || row.definitionId || row.name);
  }

  function spellRowsForPlayer() {
    const unit = playerUnit() || {};
    if (!isSpellcaster(unit)) return [];

    const loadout = spellLoadoutRuntime();
    if (loadout?.spellIdsFor && loadout?.resolveSpellDefinition) {
      const ids = loadout.spellIdsFor(unit);
      const resolved = ids.map((id) => {
        const definition = loadout.resolveSpellDefinition(id);
        return definition?.ok && definition.spell ? normalizeSpellForMenu(definition.spell, id) : null;
      }).filter(Boolean);
      if (resolved.length) return resolved;
    }

    const live = liveActions("spell").map((row) => normalizeSpellForMenu(row, row?.id));
    if (live.length) return live;

    const selected = selectedSpellIds(unit);
    if (!selected.size) return [];
    return asArray(permanent()?.spells)
      .filter((row) => selected.has(spellIdOf(row)))
      .map((row) => normalizeSpellForMenu(row, row?.id));
  }

  function inventoryEntries(container) {
    if (Array.isArray(container)) return container.map((item, index) => [String(index), item]);
    return container && typeof container === "object" ? Object.entries(container) : [];
  }

  function quantityOf(item = {}) {
    const runtime = global.LuminousItemRuntime;
    if (runtime?.quantityOf) return Math.max(0, Number(runtime.quantityOf(item)) || 0);
    const value = Number(item.quantity ?? item.qty ?? item.cantidad ?? item.stack ?? item.count ?? 1);
    return Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
  }

  function itemTiming(item = {}) {
    const runtime = global.LuminousItemRuntime;
    return normalizeId(runtime?.actionCostFor?.(item) || item.runtime?.actionCost || item.runtime?.action_cost || item.consumable_details?.action_cost || item.actionCost || item.action_cost || "action");
  }

  function itemCanUseInCombat(item = {}) {
    if (!item || typeof item !== "object" || quantityOf(item) <= 0) return false;
    if (itemTiming(item) === "off_combat") return false;
    const runtime = global.LuminousItemRuntime;
    if (runtime?.hasFunction?.(item, "use")) return true;
    const category = normalizeId(item.category || item.tipo_categoria || item.itemType || item.item_type || item.type);
    return category === "consumable" || Boolean(item.runtime?.effects || item.runtime?.healing || item.runtime?.spHealing || item.runtime?.statusCure);
  }

  function stableItemRow(instanceId, snapshot = {}) {
    const key = clean(instanceId);
    if (!key) return snapshot;
    let row = state.itemRowByInstanceId.get(key);
    if (!row) {
      row = {};
      state.itemRowByInstanceId.set(key, row);
    }
    Object.keys(row).forEach((field) => { if (!Object.prototype.hasOwnProperty.call(snapshot, field)) delete row[field]; });
    Object.assign(row, snapshot);
    return row;
  }

  function itemRowsForPlayer(unit = playerUnit() || {}) {
    const kitItems = asArray(playerKit()?.items);
    const container = unit.inventario_activo || unit.activeInventory || unit.inventory
      || (kitItems.length ? kitItems : {});
    const seen = new Set();
    const rows = inventoryEntries(container).map(([key, raw]) => {
      if (!itemCanUseInCombat(raw)) return null;
      const instanceId = clean(raw.instanceId || raw.instance_id || key);
      const definitionId = clean(raw.definitionId || raw.definition_id || raw.canonicalId || raw.itemId || raw.item_id || raw.id || key);
      const timing = itemTiming(raw);
      const actionCost = timing === ECONOMY.QUICK ? ECONOMY.QUICK : (timing === ECONOMY.REACTION ? ECONOMY.REACTION : ECONOMY.ACTION);
      seen.add(instanceId);
      return stableItemRow(instanceId, {
        ...clone(raw),
        id: instanceId || definitionId,
        itemId: instanceId || definitionId,
        instanceId: instanceId || null,
        definitionId: definitionId || null,
        kind: "item",
        sourceType: "item",
        inventoryContainer: "inventario_activo",
        actionCost,
        economyCost: actionCost,
        name: clean(raw.displayName || raw.name || raw.nombre || definitionId || instanceId || "Item"),
        description: clean(raw.description || raw.descripcion || raw.desc || ""),
        quantity: quantityOf(raw),
      });
    }).filter(Boolean);
    for (const key of [...state.itemRowByInstanceId.keys()]) if (!seen.has(key)) state.itemRowByInstanceId.delete(key);
    return rows;
  }

  function findActiveInventoryItem(unit = playerUnit() || {}, ref = null) {
    const wanted = clean(typeof ref === "object" ? (ref.instanceId || ref.instance_id || ref.itemId || ref.id) : ref);
    if (!wanted) return null;
    for (const [key, item] of inventoryEntries(unit.inventario_activo || {})) {
      if (!item || typeof item !== "object") continue;
      const ids = [key, item.instanceId, item.instance_id, item.itemId, item.item_id, item.id].map(clean).filter(Boolean);
      if (ids.includes(wanted)) return item;
    }
    return null;
  }

  function spellMenuNodes() {
    if (!global.document?.querySelectorAll) return [];
    const selectors = [
      '[data-menu="spells"]',
      '[data-category="spells"]',
      '[data-action="spells"]',
      '[data-command="spells"]',
      'img[src*="Spells.png"]',
      'img[src*="spells.png"]',
      '#command-ring button',
      '.command-ring button',
      '.command-option',
      '.menu-option'
    ];
    const nodes = new Set();
    selectors.forEach((selector) => {
      try {
        global.document.querySelectorAll(selector).forEach((node) => {
          const isImage = normalizeId(node?.tagName) === "img";
          const candidate = isImage
            ? (node.closest?.('button,[data-menu],[data-category],[data-action],[data-command],.command-option,.menu-option') || node.parentElement || node)
            : node;
          nodes.add(candidate);
        });
      } catch (_) {}
    });
    return [...nodes].filter((node) => {
      const data = node?.dataset || {};
      const direct = normalizeId(data.menu || data.category || data.action || data.command || data.key || node?.id || node?.getAttribute?.("aria-label") || node?.getAttribute?.("title"));
      if (direct === "spells" || direct === "spell") return true;
      const img = node?.querySelector?.("img");
      const src = clean(img?.getAttribute?.("src") || img?.src).toLowerCase();
      if (src.includes("/spells.png") || src.endsWith("spells.png")) return true;
      return normalizeId(node?.textContent) === "spells";
    });
  }

  function syncSpellMenuVisibility() {
    const caster = isSpellcaster(playerUnit() || {});
    spellMenuNodes().forEach((node) => {
      node.hidden = !caster;
      if (node.style) node.style.display = caster ? "" : "none";
      node.setAttribute?.("aria-hidden", caster ? "false" : "true");
      if ("disabled" in node) node.disabled = !caster;
    });
    if (!caster && activeMenu() === "spells") {
      try { lexical("goRoot", () => {})(); } catch (_) {}
    }
    return caster;
  }

  function rowsFor(menu, tab = state.tabByMenu[menu] || ECONOMY.ACTION) {
    if (menu === "global") {
      const traits = traitDefinitionsForPlayer().filter((row) => economyTabFor(row) === tab);
      if (tab !== ECONOMY.ACTION) return traits;
      const contextual = lexical("contextualGlobalActions", null);
      const globals = [...asArray(permanent()?.global), ...asArray(typeof contextual === "function" ? contextual() : [])]
        .filter((row) => economyTabFor(row) === ECONOMY.ACTION);
      return [...globals, ...traits];
    }
    if (menu === "skills") {
      return liveActions("skill").filter((row) => economyTabFor(row) === tab);
    }
    if (menu === "spells") {
      return spellRowsForPlayer().filter((row) => economyTabFor(row) === tab);
    }
    if (menu === "items") {
      return itemRowsForPlayer().filter((row) => economyTabFor(row) === tab);
    }
    return [];
  }

  function economyRuntime() { return global.LuminousActionEconomy || null; }

  function planningSnapshot() {
    const unit = playerUnit();
    const economy = economyRuntime();
    if (!unit || !economy?.snapshot) return { action: 0, quick_action: 1, reaction: 1 };
    try { return economy.snapshot(unit, { phase: "planning" }); }
    catch (_) { return { action: 0, quick_action: 1, reaction: 1 }; }
  }

  function syncQuickBadge() {
    const badge = global.document?.querySelector?.(".quick-badge");
    if (!badge) return;
    const snapshot = planningSnapshot();
    badge.innerHTML = `QUICK ACTION <strong>${Math.max(0, Number(snapshot.quick_action) || 0)} / 1</strong>`;
  }

  function syncPlanningEconomy(force = false) {
    const unit = playerUnit(), economy = economyRuntime();
    if (!unit || !economy?.beginPlanning) return false;
    const currentRound = roundNumber();
    const newRound = state.lastPlanningRound !== currentRound;
    const newUnitObject = state.lastEconomyUnit !== unit;
    if (!force && !newRound && !newUnitObject) { syncQuickBadge(); return true; }
    economy.beginPlanning(unit);
    const runtimeState = economy.ensureState?.(unit);
    if (state.quickSpentRound === currentRound && runtimeState) runtimeState.quickActionRemaining = 0;
    if (state.reactionSpentRound === currentRound && runtimeState) runtimeState.reactionRemaining = 0;
    if (newRound) {
      state.preparedReaction = null;
      if (state.quickSpentRound !== currentRound) state.quickSpentRound = null;
      if (state.reactionSpentRound !== currentRound) state.reactionSpentRound = null;
    }
    state.lastPlanningRound = currentRound;
    state.lastEconomyUnit = unit;
    syncQuickBadge();
    return true;
  }

  function beginCombatEconomy() {
    const unit = playerUnit(), economy = economyRuntime();
    if (!unit || !economy?.beginCombat) return false;
    economy.beginCombat(unit);
    syncQuickBadge();
    return true;
  }

  function ensureStyles() {
    if (!global.document || global.document.getElementById("combat073-economy-tabs-style")) return;
    const style = global.document.createElement("style");
    style.id = "combat073-economy-tabs-style";
    style.textContent = `
      .combat-economy-tabs{display:flex;gap:3px;padding:5px 7px 4px;background:rgba(4,3,2,.88);border-left:1px solid var(--accent);border-right:1px solid rgba(255,255,255,.08)}
      .combat-economy-tab{flex:1;min-width:0;padding:5px 3px;border:1px solid rgba(255,255,255,.16);background:#0b0907;color:#9a9184;font:900 7px/1 Arial,sans-serif;letter-spacing:.7px;text-transform:uppercase;cursor:pointer}
      .combat-economy-tab.active{color:#090705;background:var(--accent);border-color:#fff}
      .combat-economy-tab:disabled{opacity:.42;cursor:default}
      .combat-economy-empty{padding:22px 14px;text-align:center;color:#8f8679;font:800 9px/1.45 Arial,sans-serif;letter-spacing:1px;text-transform:uppercase;border:1px dashed rgba(255,255,255,.16);background:rgba(0,0,0,.25)}
      .economy-action-detail{padding:12px;background:#100c08;border-left:3px solid var(--accent);box-shadow:7px 7px 0 rgba(0,0,0,.45)}
      .economy-action-detail h3{margin:0 0 5px;color:#f0e5d4;font:22px/1 var(--font);text-transform:uppercase}
      .economy-action-detail .economy-kind{color:var(--accent);font:900 8px Arial,sans-serif;letter-spacing:1.4px;text-transform:uppercase}
      .economy-action-detail .economy-copy{margin-top:10px;color:#c9bfaf;font:11px/1.45 Arial,sans-serif}
      .economy-action-detail .economy-cost{margin-top:10px;color:#ffe877;font:900 9px Arial,sans-serif;text-transform:uppercase}
      .economy-action-detail button{margin-top:12px;width:100%;padding:9px;border:1px solid var(--accent);background:#090705;color:var(--accent);font:900 10px Arial,sans-serif;letter-spacing:1px;text-transform:uppercase;cursor:pointer}
      .economy-action-detail button:disabled{opacity:.4;cursor:default}
      #game-container.economy-targeting .command-ring,#game-container.economy-targeting .category-surface,#game-container.economy-targeting .category-back{pointer-events:none;opacity:.26}
      #game-container.economy-targeting .sprite-container{cursor:crosshair}
    `;
    global.document.head.appendChild(style);
  }

  function ensureTabs() {
    const surface = global.document?.getElementById?.("category-surface");
    const context = global.document?.getElementById?.("category-context");
    if (!surface || !context) return null;
    let tabs = global.document.getElementById("combat-economy-tabs");
    if (!tabs) {
      tabs = global.document.createElement("div");
      tabs.id = "combat-economy-tabs";
      tabs.className = "combat-economy-tabs";
      tabs.innerHTML = `<button type="button" class="combat-economy-tab" data-economy="action">ACTION</button><button type="button" class="combat-economy-tab" data-economy="quick_action">QUICK</button><button type="button" class="combat-economy-tab" data-economy="reaction">REACTION</button>`;
      context.insertAdjacentElement("afterend", tabs);
      tabs.addEventListener("click", (event) => {
        const button = event.target?.closest?.("[data-economy]");
        if (!button) return;
        const menu = activeMenu();
        if (!TABBED_MENUS.has(menu)) return;
        setTab(menu, button.dataset.economy);
      });
    }
    return tabs;
  }

  function tabLabel(tab) {
    const snap = planningSnapshot();
    if (tab === ECONOMY.QUICK) return `QUICK ${Math.max(0, Number(snap.quick_action) || 0)}/1`;
    if (tab === ECONOMY.REACTION) return `REACTION ${Math.max(0, Number(snap.reaction) || 0)}/1`;
    return "ACTION";
  }

  function syncTabs() {
    const menu = activeMenu();
    const tabs = ensureTabs();
    if (!tabs) return;
    tabs.style.display = TABBED_MENUS.has(menu) ? "flex" : "none";
    if (!TABBED_MENUS.has(menu)) return;
    const current = state.tabByMenu[menu] || ECONOMY.ACTION;
    tabs.querySelectorAll("[data-economy]").forEach((button) => {
      button.classList.toggle("active", button.dataset.economy === current);
      button.textContent = tabLabel(button.dataset.economy);
    });
  }

  function updateCategoryContext() {
    const context = global.document?.getElementById?.("category-context");
    const menu = activeMenu();
    if (!context || !TABBED_MENUS.has(menu)) return;
    const tab = state.tabByMenu[menu] || ECONOMY.ACTION;
    const snap = planningSnapshot();
    if (tab === ECONOMY.QUICK) context.textContent = `QUICK ACTION · AVAILABLE ${Math.max(0, Number(snap.quick_action) || 0)} / 1`;
    else if (tab === ECONOMY.REACTION) context.textContent = `REACTION · AVAILABLE ${Math.max(0, Number(snap.reaction) || 0)} / 1`;
    else context.textContent = `ACTION SLOT ${selectedSlotIndex() + 1}`;
  }

  function setTab(menu, tab) {
    const normalized = normalizeEconomyCost({ economyCost: tab });
    if (!TABBED_MENUS.has(menu) || ![ECONOMY.ACTION, ECONOMY.QUICK, ECONOMY.REACTION].includes(normalized)) return false;
    state.tabByMenu[menu] = normalized;
    try { global.eval("navState='category';selected=null;focusedIndex=0"); } catch (_) {}
    const render = lexical("renderCategory");
    if (typeof render === "function") render();
    return true;
  }

  function skillRowButton(row, type) {
    const button = global.document.createElement("button");
    const sinInfo = lexical("sinInfo", () => ({ color: "#ff4a22" }));
    const markup = lexical("skillOptionMarkup", (d) => `<strong>${htmlEscape(d.name)}</strong>`);
    const sin = sinInfo(row);
    button.className = "skill-option";
    button.style.setProperty("--sin", sin?.color || "#ff4a22");
    button.innerHTML = markup(row);
    button.onclick = () => api.selectAction({ type, slotIndex: selectedSlotIndex(), data: row });
    return button;
  }

  function renderSkills() {
    const tab = state.tabByMenu.skills || ECONOMY.ACTION;
    const body = global.document?.getElementById?.("category-body");
    if (!body) return;
    body.innerHTML = "";
    const rows = rowsFor("skills", tab);
    if (!rows.length) { body.innerHTML = `<div class="combat-economy-empty">No ${tab.replaceAll("_", " ")} Skills available.</div>`; return; }
    const stack = global.document.createElement("div");
    stack.className = "skill-stack";
    rows.forEach((row) => stack.appendChild(skillRowButton(row, "skill")));
    body.appendChild(stack);
  }

  function renderSpells() {
    const tab = state.tabByMenu.spells || ECONOMY.ACTION;
    const body = global.document?.getElementById?.("category-body");
    if (!body) return;
    body.innerHTML = "";
    const rows = rowsFor("spells", tab);
    if (!rows.length) { body.innerHTML = `<div class="combat-economy-empty">No ${tab.replaceAll("_", " ")} Spells available.</div>`; return; }
    const stack = global.document.createElement("div");
    stack.className = "skill-stack";
    rows.forEach((row) => stack.appendChild(skillRowButton(row, "spell")));
    body.appendChild(stack);
  }

  function renderItems() {
    const tab = state.tabByMenu.items || ECONOMY.ACTION;
    const body = global.document?.getElementById?.("category-body");
    if (!body) return;
    body.innerHTML = "";
    const rows = rowsFor("items", tab);
    if (!rows.length) {
      body.innerHTML = `<div class="combat-economy-empty">No ${tab.replaceAll("_", " ")} Items available in Active Inventory.</div>`;
      lexical("layoutCategory", () => {})();
      return;
    }
    const list = global.document.createElement("div");
    list.className = "clean-list";
    rows.forEach((row, index) => {
      const button = global.document.createElement("button");
      button.type = "button";
      button.className = `clean-row ${index === 0 ? "focused" : ""}`;
      button.dataset.itemInstanceId = row.instanceId || row.id || "";
      button.style?.setProperty?.("--row-accent", lexical("menuMeta", {})?.items?.accent || "#f0bf72");
      const qty = Math.max(0, Number(row.quantity) || 0);
      button.innerHTML = `<span class="clean-name">${htmlEscape(row.name)}</span><span class="clean-cost">x${qty} · ${htmlEscape(costLabel(row))}</span>`;
      button.onclick = () => api.selectAction({ type: "items", slotIndex: selectedSlotIndex(), data: row });
      list.appendChild(button);
    });
    body.appendChild(list);
    lexical("layoutCategory", () => {})();
  }

  function renderGlobalList() {
    const body = global.document?.getElementById?.("category-body");
    if (!body) return;
    const rows = rowsFor("global", state.tabByMenu.global || ECONOMY.ACTION);
    body.innerHTML = "";
    if (!rows.length) { body.innerHTML = `<div class="combat-economy-empty">No ${(state.tabByMenu.global || ECONOMY.ACTION).replaceAll("_", " ")} Trait / Action available.</div>`; return; }
    const list = global.document.createElement("div");
    list.className = "clean-list";
    rows.forEach((row, index) => {
      const button = global.document.createElement("button");
      button.className = `clean-row ${index === 0 ? "focused" : ""}`;
      button.style.setProperty("--row-accent", lexical("menuMeta", {})?.global?.accent || "#ffe877");
      const icon = row.iconUrl ? `<img src="${htmlEscape(row.iconUrl)}" alt="">` : htmlEscape(row.name?.[0] || "A");
      button.innerHTML = `<span class="clean-icon action-png-icon">${icon}</span><span class="clean-name">${htmlEscape(row.name)}</span><span class="clean-cost">${htmlEscape(costLabel(row))}</span>`;
      button.onclick = () => api.selectAction({ type: row.kind === "trait" ? "trait" : "global", slotIndex: selectedSlotIndex(), data: row });
      list.appendChild(button);
    });
    body.appendChild(list);
    const desc = global.document.createElement("div");
    desc.id = "clean-description";
    desc.className = "description-box";
    const first = rows[0];
    desc.innerHTML = first ? `<div class="description-kicker">${htmlEscape(first.tag || "ACTION")}</div><div class="description-name">${htmlEscape(first.name)}</div><div class="description-text">${first.description || ""}</div><div class="description-cost">${htmlEscape(costLabel(first))}</div>` : "";
    body.appendChild(desc);
  }

  function renderCleanList() {
    if (activeMenu() !== "global") return state.originals.renderCleanList?.();
    return renderGlobalList();
  }

  function renderCategory() {
    const result = state.originals.renderCategory?.();
    // The bundled 0.7.3 renderer has no dedicated renderItems function and
    // consequently falls through to its static demo list.  Re-render dynamic
    // menus here after the shell/title has been prepared by the legacy code.
    // This also makes the menu independent from load order: whether the live
    // hydration or this bridge finishes first, current kit/inventory data wins.
    const menu = activeMenu();
    if (menu === "items") renderItems();
    else if (menu === "skills" && (state.tabByMenu.skills || ECONOMY.ACTION) !== ECONOMY.ACTION) renderSkills();
    else if (menu === "spells" && (state.tabByMenu.spells || ECONOMY.ACTION) !== ECONOMY.ACTION) renderSpells();
    else if (menu === "global" && (state.tabByMenu.global || ECONOMY.ACTION) !== ECONOMY.ACTION) renderGlobalList();
    syncSpellMenuVisibility();
    syncTabs();
    updateCategoryContext();
    syncQuickBadge();
    return result;
  }

  function reactionModeOf(source = {}) {
    const raw = normalizeId(source.reaction?.mode || source.reactionMode || source.reaction_mode || source.activation?.reactionMode || source.activation?.reaction_mode || "");
    if (raw === "prepared" || raw === "adaptive") return raw;
    const activation = normalizeId(source.activation?.type || "");
    return ["prompt", "automatic"].includes(activation) ? "adaptive" : "prepared";
  }

  function detailForEconomySelection(sel) {
    const source = sel?.data || {};
    const tab = economyTabFor(source);
    const body = global.document?.getElementById?.("category-body");
    if (!body) return;
    const quick = tab === ECONOMY.QUICK;
    const reactionMode = reactionModeOf(source);
    const canPrepare = tab === ECONOMY.REACTION && reactionMode === "prepared";
    const buttonLabel = quick ? "USE QUICK ACTION" : (canPrepare ? "PREPARE REACTION" : "ADAPTIVE REACTION");
    body.innerHTML = `<div class="economy-action-detail"><div class="economy-kind">${htmlEscape(tab.replaceAll("_", " "))}${tab === ECONOMY.REACTION ? ` · ${reactionMode}` : ""}</div><h3>${htmlEscape(source.name || source.id || "Action")}</h3><div class="economy-copy">${source.description || ""}</div><div class="economy-cost">${htmlEscape(costLabel(source))}</div><button id="economy-action-confirm" ${tab === ECONOMY.REACTION && !canPrepare ? "disabled" : ""}>${buttonLabel}</button></div>`;
    const confirm = global.document.getElementById("economy-action-confirm");
    if (confirm && !confirm.disabled) confirm.onclick = () => quick ? beginQuickAction(sel) : prepareReaction(sel);
    lexical("layoutCategory", () => {})();
  }

  function selfTargetedItem(source = {}) {
    return normalizeId(source.runtime?.targetMode || source.runtime?.target_mode || source.targetMode || source.target_mode) === "self";
  }

  function planTargetRuleCompat(source = {}) {
    const original = state.originals.planTargetRule;
    if (typeof original !== "function") return null;
    if (selfTargetedItem(source)) {
      return original({ ...source, itemType: "hp_healing", item_type: "hp_healing" });
    }
    return original(source);
  }

  function selectAction(sel) {
    const menu = activeMenu();
    const tab = economyTabFor(sel?.data || {});
    if (!TABBED_MENUS.has(menu) || tab === ECONOMY.ACTION) return state.originals.selectAction?.(sel);
    global.__luminousEconomySelected = sel;
    try { global.eval("selected=window.__luminousEconomySelected;navState='action'"); } catch (_) {}
    detailForEconomySelection(sel);
    lexical("setStatus", () => {})(`${tab === ECONOMY.QUICK ? "QUICK ACTION" : "REACTION"} · ${sel?.data?.name || "Action"}`);
  }

  function targetingAllegiance(source = {}) {
    const runtimeTarget = normalizeId(source.runtime?.targetMode || source.runtime?.target_mode || source.targetMode || source.target_mode || "");
    if (runtimeTarget === "self") return "self";
    const raw = normalizeId(source.targeting?.allegiance || source.targetSide || (source.targetAlly === true ? "ally" : ""));
    if (raw === "self") return "self";
    if (["ally", "allies", "friendly"].includes(raw)) return "ally";
    if (["neutral", "any"].includes(raw)) return "neutral";
    return "enemy";
  }

  function targetCandidates(source = {}) {
    const unit = playerUnit();
    if (!unit) return [];
    const allegiance = targetingAllegiance(source);
    if (allegiance === "self") return [unit];
    return Object.values(combatData()).filter((candidate) => {
      if (!candidate || candidate.dead || candidate.defeated || candidate.battleActive === false || Number(candidate.hp) <= 0) return false;
      if (allegiance === "neutral") return candidate.id !== unit.id;
      return allegiance === "ally" ? candidate.faction === unit.faction : candidate.faction !== unit.faction;
    });
  }

  function needsTarget(source = {}) {
    const mode = normalizeId(source.targeting?.mode || source.targetType || source.targetingType || "single");
    return targetingAllegiance(source) !== "self" && mode !== "self";
  }

  function cancelEconomyTargeting() {
    state.pendingTarget = null;
    global.document?.getElementById?.("game-container")?.classList.remove("economy-targeting");
    global.document?.querySelectorAll?.(".sprite-container.economy-target-candidate")?.forEach((node) => node.classList.remove("economy-target-candidate"));
  }

  function beginTargetPick(sel) {
    const source = sel.data || {};
    const candidates = targetCandidates(source);
    if (!candidates.length) {
      lexical("setStatus", () => {})(`QUICK ACTION · ${source.name || source.id} · NO VALID TARGETS`);
      return false;
    }
    state.pendingTarget = { sel, candidateIds: new Set(candidates.map((unit) => clean(unit.id))) };
    const host = global.document?.getElementById?.("game-container");
    host?.classList.add("economy-targeting");
    candidates.forEach((unit) => global.document?.getElementById?.(`token-${unit.id}`)?.classList.add("economy-target-candidate"));
    lexical("setStatus", () => {})(`QUICK ACTION · ${source.name || source.id} · SELECT TARGET`);
    return true;
  }

  function compilerFor(sel, targetId = null) {
    const source = sel?.data || {}, actor = playerUnit();
    const schema = global.LuminousCombatAction, adapters = global.LuminousCombatActionAdapters;
    if (!actor || !schema || !adapters) return null;
    const options = {
      actorId: clean(actor.id), targetId, mainTargetId: targetId, targetIds: targetId ? [targetId] : [],
      allegiance: targetingAllegiance(source), cost: normalizeEconomyCost(source),
      selectedAt: schema.PHASES.PLANNING_PHASE_PLAYER,
      executesAt: normalizeEconomyCost(source) === ECONOMY.QUICK ? schema.PHASES.PLANNING_PHASE_PLAYER : schema.PHASES.COMBAT_PHASE,
      sourceId: source.id || source.traitId || source.skillId || source.spellId,
      metadata: { viewer073EconomyMenu: true, sourceDefinition: clone(source) },
    };
    if (sel.type === "trait") return adapters.compileTraitToCombatAction(actor, source, options);
    if (sel.type === "spell") return adapters.compileSpellToCombatAction(actor, source, options);
    if (sel.type === "skill") return adapters.compileSkillToCombatAction(actor, source, options);
    if (sel.type === "global") return adapters.compileUniversalAction(actor, source.actionKey || source.id, options);
    if (sel.type === "item" || sel.type === "items") {
      return schema.createCombatAction({
        actorId: clean(actor.id),
        actionSlotId: null,
        source: { type: "item", id: clean(source.instanceId || source.itemId || source.id) },
        phase: { selectedAt: schema.PHASES.PLANNING_PHASE_PLAYER, executesAt: schema.PHASES.PLANNING_PHASE_PLAYER },
        economy: { cost: ECONOMY.QUICK },
        targeting: { allegiance: targetingAllegiance(source), mode: needsTarget(source) ? "single" : "self", mainTargetId: targetId || clean(actor.id), targetIds: targetId ? [targetId] : [clean(actor.id)] },
        resolution: { type: "automatic" },
        effects: [],
        metadata: { viewer073EconomyMenu: true, sourceDefinition: clone(source), name: source.name || source.id || "Item" },
      });
    }
    return null;
  }

  function executeTraitQuickAction(source, action, targetId) {
    const engine = global.LuminousTraitEngine;
    if (!engine?.dispatchTrait) return { handled: false, reason: "trait_runtime_unavailable" };
    const actor = playerUnit();
    const id = normalizeId(source.id || source.traitId || source.name);
    let traitState = state.traitStateById.get(id);
    if (!traitState) { traitState = engine.createState?.() || { usages: {}, ruleScopes: {}, counters: {} }; state.traitStateById.set(id, traitState); }
    const target = targetId ? combatData()?.[targetId] || null : actor;
    try {
      const result = engine.dispatchTrait(source, "on_use", { context: "combat", character: actor, self: actor, actor, target, combatAction: action }, traitState);
      const hasGenericRuntime = asArray(source.effects).length > 0 || asArray(source.rules).length > 0 || asArray(result?.outcomes).length > 0;
      return { handled: hasGenericRuntime, result, reason: hasGenericRuntime ? null : "trait_specific_runtime_required" };
    } catch (error) {
      return { handled: false, reason: clean(error?.message || error) || "trait_runtime_failed" };
    }
  }

  function quickMutationSnapshot(unit = {}, item = null) {
    return {
      hp: unit.hp,
      hpActual: unit.hp_actual,
      sp: unit.sp,
      spActual: unit.sp_actual,
      combatStats: clone(unit.combatStats || null),
      statusEffects: clone(unit.statusEffects || {}),
      itemRuntimeEffects: clone(unit.itemRuntimeEffects || []),
      item: item ? clone(item) : null,
    };
  }

  function restoreQuickMutation(unit = {}, item = null, snapshot = null) {
    if (!snapshot) return false;
    if (snapshot.hp !== undefined) unit.hp = snapshot.hp;
    if (snapshot.hpActual !== undefined) unit.hp_actual = snapshot.hpActual;
    if (snapshot.sp !== undefined) unit.sp = snapshot.sp;
    if (snapshot.spActual !== undefined) unit.sp_actual = snapshot.spActual;
    if (snapshot.combatStats) unit.combatStats = clone(snapshot.combatStats);
    unit.statusEffects = clone(snapshot.statusEffects || {});
    unit.itemRuntimeEffects = clone(snapshot.itemRuntimeEffects || []);
    if (item && snapshot.item) {
      Object.keys(item).forEach((key) => { if (!Object.prototype.hasOwnProperty.call(snapshot.item, key)) delete item[key]; });
      Object.assign(item, clone(snapshot.item));
    }
    return true;
  }

  async function persistQuickItemState(unit = {}) {
    const adapterState = global.LuminousCombatLiveAdapter073?.state;
    const db = adapterState?.db;
    if (!db?.ref) return { saved: false, skipped: true, reason: "combat_db_unavailable" };
    const playerKey = canonicalPlayerId(unit) || clean(adapterState?.playerId);
    const persistence = global.LuminousItemPersistenceRuntime;
    if (!playerKey) return { saved: false, reason: "canonical_player_id_missing" };
    if (!persistence?.serializeInventoryState) return { saved: false, reason: "item_persistence_runtime_unavailable" };

    const serialized = persistence.serializeInventoryState(unit);
    const combatantEntry = Object.entries(combatData() || {}).find(([key, row]) =>
      row === unit
      || clean(row?.id || row?.combatId) === clean(unit.id || unit.combatId)
      || canonicalPlayerId(row || {}) === playerKey
    );
    const combatantKey = clean(combatantEntry?.[0] || unit.id || unit.combatId);
    const updates = {
      [`campaña/jugadores/${playerKey}/inventario_activo`]: clone(serialized.inventario_activo || {}),
      [`campaña/jugadores/${playerKey}/inventario_stash`]: clone(serialized.inventario_stash || {}),
      [`campaña/jugadores/${playerKey}/itemInventorySchemaVersion`]: serialized.schemaVersion || 3,
      [`campaña/jugadores/${playerKey}/itemEquipmentRefs`]: clone(serialized.equipmentRefs || {}),
      [`campaña/jugadores/${playerKey}/attunedItemInstanceIds`]: clone(serialized.attunedItemInstanceIds || []),
    };
    if (combatantKey) {
      updates[`campaña/combate/combatants/${combatantKey}/inventario_activo`] = clone(serialized.inventario_activo || {});
      updates[`campaña/combate/combatants/${combatantKey}/inventario_stash`] = clone(serialized.inventario_stash || {});
      updates[`campaña/combate/combatants/${combatantKey}/itemInventorySchemaVersion`] = serialized.schemaVersion || 3;
      updates[`campaña/combate/combatants/${combatantKey}/itemEquipmentRefs`] = clone(serialized.equipmentRefs || {});
      updates[`campaña/combate/combatants/${combatantKey}/attunedItemInstanceIds`] = clone(serialized.attunedItemInstanceIds || []);
    }
    try {
      Object.assign(updates, global.LuminousPlayerVitalsRealtimeBridge?.firebaseUpdatesForSnapshot?.({
        [combatantKey || clean(unit.id) || "player"]: unit,
      }, {}) || {});
      await db.ref().update(updates);
      return { saved: true, playerId: playerKey, combatantId: combatantKey || null, updates };
    } catch (error) {
      return { saved: false, reason: "quick_item_persistence_failed", error };
    }
  }

  function requestQuickResolution(sel, action, targetId) {
    const detail = { version: VERSION, action, source: clone(sel.data || {}), sourceType: sel.type, targetId, handled: false, result: null };
    try { global.dispatchEvent(new CustomEvent("luminous:combat073-quick-action-request", { detail })); } catch (_) {}
    if (detail.handled) return { handled: true, result: detail.result };
    if (sel.type === "trait") return executeTraitQuickAction(sel.data || {}, action, targetId);
    if (sel.type === "item" || sel.type === "items") {
      const unit = playerUnit(), runtime = global.LuminousItemRuntime;
      const liveItem = findActiveInventoryItem(unit || {}, sel.data || {});
      if (!unit || !liveItem) return { handled: false, reason: "active_inventory_item_missing" };
      if (!runtime?.useItem) return { handled: false, reason: "item_runtime_unavailable" };
      const target = targetId ? combatData()?.[targetId] || null : unit;
      const result = runtime.useItem(unit, liveItem, { phase: "planning", target, ignoreActionCost: true });
      return result?.used ? { handled: true, result } : { handled: false, reason: result?.reason || "item_use_failed", result };
    }
    return { handled: false, reason: "quick_action_runtime_unavailable" };
  }

  async function useQuickAction(sel, targetId = null) {
    const unit = playerUnit(), economy = economyRuntime();
    if (!unit || !economy) return false;
    const gate = economy.availability?.(unit, ECONOMY.QUICK, { phase: "planning" });
    if (gate?.available === false) { lexical("setStatus", () => {})(`QUICK ACTION · ${gate.reason || "UNAVAILABLE"}`); return false; }
    const action = compilerFor(sel, targetId);
    if (!action) { lexical("setStatus", () => {})("QUICK ACTION · COMBAT ACTION COMPILER UNAVAILABLE"); return false; }

    const isItem = sel.type === "item" || sel.type === "items";
    const liveItem = isItem ? findActiveInventoryItem(unit, sel.data || {}) : null;
    const before = isItem ? quickMutationSnapshot(unit, liveItem) : null;
    const resolution = requestQuickResolution(sel, action, targetId);
    if (!resolution.handled) {
      lexical("setStatus", () => {})(`QUICK ACTION · ${sel.data?.name || "Action"} · ${String(resolution.reason || "RUNTIME NOT CONNECTED").replaceAll("_", " ").toUpperCase()}`);
      return false;
    }

    if (isItem) {
      const persisted = await persistQuickItemState(unit);
      if (persisted.saved === false && persisted.skipped !== true) {
        restoreQuickMutation(unit, liveItem, before);
        lexical("setStatus", () => {})(`QUICK ACTION · ${sel.data?.name || "Item"} · PERSISTENCE FAILED`);
        return false;
      }
    }

    if (!economy.consume(unit, ECONOMY.QUICK, { phase: "planning" })) {
      if (isItem) restoreQuickMutation(unit, liveItem, before);
      return false;
    }
    state.quickSpentRound = roundNumber();
    syncQuickBadge(); syncTabs(); updateCategoryContext();
    lexical("setStatus", () => {})(`QUICK ACTION · ${sel.data?.name || "Action"} · USED`);
    try { global.dispatchEvent(new CustomEvent("luminous:combat073-quick-action-resolved", { detail: { version: VERSION, action, result: resolution.result || null } })); } catch (_) {}
    lexical("goRoot", () => {})();
    return true;
  }

  function beginQuickAction(sel) {
    const source = sel?.data || {};
    if (needsTarget(source)) return beginTargetPick(sel);
    return useQuickAction(sel, playerId());
  }

  function prepareReaction(sel) {
    const unit = playerUnit(), economy = economyRuntime();
    if (!unit || !economy) return false;
    const gate = economy.availability?.(unit, ECONOMY.REACTION, { phase: "combat" });
    if (gate?.available === false) { lexical("setStatus", () => {})(`REACTION · ${gate.reason || "UNAVAILABLE"}`); return false; }
    const action = compilerFor(sel, null);
    if (!action) return false;
    action.reaction = { ...(action.reaction || {}), mode: "prepared", trigger: clone(sel.data?.reaction?.trigger || sel.data?.trigger || sel.data?.activation?.trigger || null) };
    state.preparedReaction = { sel: clone(sel), action };
    try { global.dispatchEvent(new CustomEvent("luminous:combat073-reaction-prepared", { detail: { version: VERSION, action: clone(action), source: clone(sel.data || {}) } })); } catch (_) {}
    lexical("setStatus", () => {})(`REACTION · ${sel.data?.name || "Reaction"} · PREPARED`);
    lexical("goRoot", () => {})();
    return true;
  }

  function triggerPreparedReaction(context = {}) {
    const prepared = state.preparedReaction, unit = playerUnit(), economy = economyRuntime();
    if (!prepared || !unit || !economy) return { triggered: false, reason: "no_prepared_reaction" };
    const gate = economy.availability?.(unit, ECONOMY.REACTION, { phase: "combat" });
    if (gate?.available === false) return { triggered: false, reason: gate.reason || "reaction_unavailable" };
    const detail = { version: VERSION, action: clone(prepared.action), source: clone(prepared.sel.data || {}), context: clone(context), handled: false, result: null };
    try { global.dispatchEvent(new CustomEvent("luminous:combat073-reaction-trigger", { detail })); } catch (_) {}
    if (!detail.handled) return { triggered: false, reason: "reaction_runtime_unavailable", action: prepared.action };
    if (!economy.consume(unit, ECONOMY.REACTION, { phase: "combat" })) return { triggered: false, reason: "reaction_spend_failed" };
    state.reactionSpentRound = roundNumber(); state.preparedReaction = null; syncTabs();
    return { triggered: true, action: detail.action || prepared.action, result: detail.result || null };
  }

  function loadScript(id, src, ready) {
    if (ready?.()) return Promise.resolve(true);
    if (!global.document) return Promise.resolve(false);
    const existing = global.document.getElementById(id);
    if (existing) {
      if (ready?.()) return Promise.resolve(true);
      return new Promise((resolve) => {
        existing.addEventListener("load", () => resolve(Boolean(ready?.())), { once: true });
        existing.addEventListener("error", () => resolve(false), { once: true });
      });
    }
    return new Promise((resolve) => {
      const script = global.document.createElement("script");
      script.id = id; script.src = src; script.async = false;
      script.addEventListener("load", () => resolve(Boolean(ready?.() ?? true)), { once: true });
      script.addEventListener("error", () => resolve(false), { once: true });
      global.document.head?.appendChild(script);
    });
  }

  async function ensureDependencies() {
    await loadScript("combat-action-schema-economy073", "js/combat-action-schema.js", () => Boolean(global.LuminousCombatAction));
    await loadScript("content-registry-economy073", "js/content-registry.js", () => Boolean(global.LuminousContentRegistry));
    await loadScript("content-registry-bootstrap-economy073", "js/content-registry-bootstrap.js", () => Boolean(global.LuminousContentRegistryBootstrap));
    await loadScript("spell-catalog-core-economy073", "js/spell-catalog-core.js", () => Boolean(global.LuminousSpellCatalog));
    await loadScript("combat-spell-loadout-074-economy073", "js/combat-spell-loadout-074.js", () => Boolean(global.LuminousCombatSpellLoadout074));
    await loadScript("combat-action-adapters-economy073", "js/combat-action-adapters.js", () => Boolean(global.LuminousCombatActionAdapters));
    await loadScript("trait-engine-economy073", "js/trait-engine.js", () => Boolean(global.LuminousTraitEngine));
    await loadScript("archetype-engine-economy073", "js/archetype-engine.js", () => Boolean(global.LuminousArchetypeEngine));
    await loadScript("archetype-trait-catalog-economy073", "js/archetype-trait-catalog.js", () => Boolean(global.LuminousArchetypeTraitCatalog));
    await loadScript("action-economy-economy073", "js/universal-action-economy.js", () => Boolean(global.LuminousActionEconomy));
    return Boolean(global.LuminousCombatAction && global.LuminousCombatActionAdapters && global.LuminousActionEconomy);
  }

  function installTargetHandler() {
    global.document?.addEventListener?.("click", (event) => {
      if (!state.pendingTarget) return;
      const token = event.target?.closest?.(".sprite-container");
      if (!token) return;
      const targetId = clean(token.id).replace(/^token-/, "");
      if (!state.pendingTarget.candidateIds.has(targetId)) return;
      event.preventDefault(); event.stopPropagation();
      const pending = state.pendingTarget;
      cancelEconomyTargeting(); useQuickAction(pending.sel, targetId);
    }, true);
    global.addEventListener?.("keydown", (event) => {
      if (event.key !== "Escape" || !state.pendingTarget) return;
      event.preventDefault(); cancelEconomyTargeting();
      lexical("setStatus", () => {})("QUICK ACTION · TARGETING CANCELLED");
    }, true);
  }

  function installPhaseHooks() {
    const originalBeginPlanning = lexical("beginPlanningPhase", null);
    if (typeof originalBeginPlanning === "function" && !originalBeginPlanning.__luminousEconomyWrapped) {
      global.__luminousEconomyOriginalBeginPlanning = originalBeginPlanning;
      global.__luminousEconomyWrappedBeginPlanning = function (...args) {
        const result = global.__luminousEconomyOriginalBeginPlanning.apply(this, args);
        syncPlanningEconomy(true); return result;
      };
      Object.defineProperty(global.__luminousEconomyWrappedBeginPlanning, "__luminousEconomyWrapped", { value: true });
      assignLexical("beginPlanningPhase", "window.__luminousEconomyWrappedBeginPlanning");
    }
    const host = global.document?.getElementById?.("game-container");
    if (host && typeof MutationObserver === "function") {
      state.classObserver = new MutationObserver(() => { if (host.classList.contains("round-running")) beginCombatEconomy(); else syncQuickBadge(); });
      state.classObserver.observe(host, { attributes: true, attributeFilter: ["class"] });
    }
  }

  function install() {
    if (state.installed || !global.document) return state.installed;
    const required = ["renderCategory", "renderSkills", "renderSpells", "renderCleanList", "selectAction"];
    if (required.some((name) => typeof lexical(name) !== "function")) return false;
    state.originals = { renderCategory: lexical("renderCategory"), renderSkills: lexical("renderSkills"), renderSpells: lexical("renderSpells"), renderItems: lexical("renderItems", null), renderCleanList: lexical("renderCleanList"), selectAction: lexical("selectAction"), planTargetRule: lexical("planTargetRule", null) };
    ensureStyles(); ensureTabs();
    if (typeof state.originals.planTargetRule === "function") {
      global.__luminousEconomyPlanTargetRuleCompat = planTargetRuleCompat;
      assignLexical("planTargetRule", "window.__luminousEconomyPlanTargetRuleCompat");
    }
    assignLexical("renderSkills", "window.LuminousCombatEconomyMenu073.renderSkills");
    assignLexical("renderSpells", "window.LuminousCombatEconomyMenu073.renderSpells");
    if (typeof state.originals.renderItems === "function") assignLexical("renderItems", "window.LuminousCombatEconomyMenu073.renderItems");
    assignLexical("renderCleanList", "window.LuminousCombatEconomyMenu073.renderCleanList");
    assignLexical("renderCategory", "window.LuminousCombatEconomyMenu073.renderCategory");
    assignLexical("selectAction", "window.LuminousCombatEconomyMenu073.selectAction");
    installPhaseHooks(); installTargetHandler(); syncPlanningEconomy(false); syncQuickBadge(); syncSpellMenuVisibility();
    if (!state.menuObserver && typeof MutationObserver === "function" && global.document?.body) {
      state.menuObserver = new MutationObserver(() => syncSpellMenuVisibility());
      state.menuObserver.observe(global.document.body, { childList: true, subtree: true });
    }
    state.installed = true; return true;
  }

  const api = { version: VERSION, ECONOMY, state, normalizeEconomyCost, economyTabFor, costLabel, canonicalPlayerId, playerUnit, playerKit, traitDefinitionsForPlayer, liveActions, spellLoadoutRuntime, normalizeSpellForMenu, classEntries, spellcastingClasses, isSpellcaster, selectedSpellIds, spellRowsForPlayer, inventoryEntries, quantityOf, itemTiming, itemCanUseInCombat, stableItemRow, itemRowsForPlayer, findActiveInventoryItem, spellMenuNodes, syncSpellMenuVisibility, selfTargetedItem, planTargetRuleCompat, persistQuickItemState, rowsFor, renderSkills, renderSpells, renderItems, renderCleanList, renderCategory, selectAction, setTab, syncTabs, syncQuickBadge, syncPlanningEconomy, beginCombatEconomy, prepareReaction, triggerPreparedReaction, useQuickAction, install };

  async function boot() { await ensureDependencies(); return install(); }
  api.boot = boot; api.ensureDependencies = ensureDependencies;
  global.LuminousCombatEconomyMenu073 = Object.freeze(api);
  global.addEventListener?.("luminous:combat073-hydrated", () => { syncPlanningEconomy(false); syncQuickBadge(); syncSpellMenuVisibility(); const render = lexical("renderCategory"); if (activeMenu() && typeof render === "function") render(); });
  global.addEventListener?.("luminous:combat073-runtime-ready", () => global.setTimeout(boot, 0));
  global.setTimeout(boot, 0);

  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
