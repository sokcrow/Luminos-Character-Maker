(function (global) {
  "use strict";

  if (global.LuminousCombatEconomyMenu073) return;

  const VERSION = "0.7.3-economy-menu.11-all-units-independent-actions";
  const TABBED_MENUS = new Set(["global", "skills", "spells", "items"]);
  const ECONOMY = Object.freeze({ ACTION: "action", QUICK: "quick_action", FREE: "free_action", REACTION: "reaction" });
  const state = {
    installed: false,
    tabByMenu: { global: ECONOMY.ACTION, skills: ECONOMY.ACTION, spells: ECONOMY.ACTION, items: ECONOMY.ACTION },
    originals: {},
    traitStateById: new Map(),
    traitCatalogDefinitions: {},
    traitCatalogGrants: {},
    traitDb: null,
    traitDbListeners: [],
    preparedReaction: null,
    pendingTarget: null,
    lastPlanningRound: null,
    lastEconomyUnit: null,
    quickSpentRound: null,
    reactionSpentRound: null,
    classObserver: null,
    menuObserver: null,
    itemRowByInstanceId: new Map(),
    rootMenuClickInstalled: false,
    actionBackRecoveryInstalled: false,
    menuRefreshGeneration: 0,
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
      source?.activationCost ?? source?.activation_cost ?? source?.castingTime ?? source?.casting_time ?? fallback
    );
    if (["quick", "quickaction", "quick_action", "bonus", "bonus_action", "bonusaction"].includes(raw)) return ECONOMY.QUICK;
    if (["reaction", "react", "reactive"].includes(raw)) return ECONOMY.REACTION;
    if (["none", "free", "free_action", "automatic", "passive", "special"].includes(raw)) return raw;
    return ECONOMY.ACTION;
  }

  function economyTabFor(source = {}) {
    const cost = normalizeEconomyCost(source);
    return cost === ECONOMY.QUICK || cost === ECONOMY.REACTION ? cost : (["none", "free", "free_action"].includes(cost) && (["manual", "choice", "prompt"].includes(normalizeId(source.activation?.type)) || normalizeId(source.kind || source.sourceType) !== "trait") ? ECONOMY.FREE : ECONOMY.ACTION);
  }

  function costLabel(source = {}) {
    const cost = normalizeEconomyCost(source);
    if (cost === ECONOMY.QUICK) return "1 Quick Action";
    if (cost === ECONOMY.REACTION) return "1 Reaction";
    if (["none", "free", "free_action"].includes(cost)) return "Free Action";
    return clean(source.cost || source.costLabel || "1 Action Slot");
  }

  function sourceIsManualTrait(trait = {}) {
    const cost = normalizeEconomyCost(trait, "none");
    const activation = normalizeId(trait.activation?.type || trait.activationType || trait.activation_type || "passive");
    const contexts = asArray(trait.contexts || trait.context || ["any"]).map(normalizeId);
    if (contexts.length && !contexts.includes("any") && !contexts.includes("combat")) return false;
    if (cost === ECONOMY.ACTION || cost === ECONOMY.QUICK || cost === ECONOMY.REACTION) return true;
    if (["none", "free", "free_action"].includes(cost) && ["manual", "choice", "prompt"].includes(activation)) return true;
    return ["manual", "prompt", "choice"].includes(activation) && !["none", "free", "automatic", "passive"].includes(cost);
  }

  function flattenTraitRows(value) {
    if (!value) return [];
    if (typeof value === "string") return [value];
    if (Array.isArray(value)) return value.flatMap(flattenTraitRows);
    if (typeof value !== "object") return [];
    if (value.trait || value.definition || value.traitDefinition) {
      return flattenTraitRows(value.trait || value.definition || value.traitDefinition);
    }
    if (value.activation || value.effects || value.rules || value.mechanics || value.traitId || value.id) return [value];
    return Object.entries(value).flatMap(([key, row]) => row === true ? [key] : flattenTraitRows(row));
  }

  // Never resolve the Combat Player's grants from the DM's character or from
  // a stale linked Unit. The campaign Player record owns the current build.
  function authoritativeCharacter(unit = playerUnit() || {}) {
    const id = canonicalPlayerId(unit) || clean(global.LuminousCombatLiveAdapter073?.state?.playerId);
    const player = global.LuminousCombatLiveAdapter073?.state?.players?.[id] || {};
    return {
      ...unit,
      ...player,
      characterBuild: { ...(unit.characterBuild || {}), ...(player.characterBuild || {}) },
    };
  }

  function traitCatalogDefinitions() {
    return {
      ...(global.LuminousTraitCatalogCore?.allDefinitions?.() || {}),
      ...(global.LuminousRacialTraitCatalog?.allDefinitions?.() || {}),
      ...(global.LuminousArchetypeTraitCatalog?.allDefinitions?.() || {}),
      ...(global.LuminousDmTraitLibrary?.getDefinitions?.() || {}),
      ...state.traitCatalogDefinitions,
    };
  }

  function resolveGrantedTraits(character, definitions) {
    const engine = global.LuminousTraitEngine;
    if (!engine?.resolveTraitGrants) return [];
    const grants = [
      ...(global.LuminousTraitCatalogCore?.allGrants?.() || []),
      ...Object.values(state.traitCatalogGrants || {}),
    ];
    const resolved = [];
    try {
      resolved.push(...engine.resolveTraitGrants(character, grants, definitions));
      resolved.push(...(global.LuminousRacialTraitCatalog?.resolveTraitGrants?.(character, definitions) || []));
      resolved.push(...(global.LuminousArchetypeTraitCatalog?.resolveTraitGrants?.(character, definitions) || []));
      resolved.push(...(global.LuminousClassMilestones?.resolveSelectedGeneralTraits?.(character, definitions) || []));
    } catch (error) {
      global.console?.warn?.("[CombatEconomy073] Trait grant resolution failed", error);
    }
    return resolved;
  }

  function resolvedArchetypeTraits(unit = {}) {
    const catalog = global.LuminousArchetypeTraitCatalog;
    if (!catalog?.resolveTraitGrants) return [];
    try {
      return flattenTraitRows(catalog.resolveTraitGrants(unit) || [])
        .map((entry) => entry.trait || entry.definition || entry.traitDefinition || entry).filter(Boolean);
    } catch (error) {
      global.console?.warn?.("[CombatEconomy073] Archetype trait resolution failed", error);
      return [];
    }
  }

  function traitDefinitionsForPlayer() {
    const unit = playerUnit() || {};
    const character = authoritativeCharacter(unit);
    const definitions = traitCatalogDefinitions();
    const candidates = [
      unit.traitDefinitions, unit.combatTraits, unit.actionTraits, unit.traits,
      unit.classTraits, unit.archetypeTraits, unit.features,
      unit.characterBuild?.traitDefinitions, unit.characterBuild?.traits,
      character.traitDefinitions, character.combatTraits, character.actionTraits,
      character.traits, character.classTraits, character.archetypeTraits,
      character.features, character.characterBuild?.traitDefinitions,
      character.characterBuild?.traits,
      resolvedArchetypeTraits(character),
      resolveGrantedTraits(character, definitions),
    ];
    const canonicalId = canonicalPlayerId(unit) || clean(global.LuminousCombatLiveAdapter073?.state?.playerId);
    let localId = "";
    try { localId = clean(global.localStorage?.getItem?.("playerId")); } catch (_) {}
    if (canonicalId && localId === canonicalId) {
      candidates.push(global.LuminousPlayerTraitRuntime?.getTraits?.() || []);
    }
    const unique = new Map();
    candidates.flatMap(flattenTraitRows).forEach((candidate) => {
      const id = normalizeId(typeof candidate === "string" ? candidate : candidate?.id || candidate?.traitId || candidate?.name);
      if (!id) return;
      const definition = definitions[id] || {};
      const source = typeof candidate === "string" ? {} : candidate;
      const trait = {
        ...clone(definition),
        ...clone(source),
        ...(definition.activation || source.activation
          ? { activation: { ...(definition.activation || {}), ...(source.activation || {}) } }
          : {}),
      };
      if (!sourceIsManualTrait(trait)) {
        // The active Class runtime can change a Trait's action cost (e.g. an
        // upgraded Action becoming Quick). Do not hardcode class exceptions.
        if (!trait.activation || !global.LuminousTraitEngine?.canActivateTrait) return;
      }
      try {
        const effective = global.LuminousTraitEngine?.canActivateTrait?.(trait, {
          context: "combat", character, self: unit, actor: unit,
          actionEconomy: { canUse: () => true },
        }, { usages: {}, ruleScopes: {}, counters: {} });
        const cost = effective?.actionCost || effective?.trait?.activation?.actionCost;
        if (cost && normalizeEconomyCost({ actionCost: cost }, "none") !== "none") {
          trait.activation = { ...(trait.activation || {}), actionCost: cost };
        }
      } catch (_) {}
      if (!sourceIsManualTrait(trait)) return;
      const economyCost = normalizeEconomyCost(trait);
      unique.set(id, {
        ...trait,
        id,
        traitId: id,
        kind: "trait",
        sourceType: "trait",
        economyCost,
        cost: costLabel(trait),
        name: clean(trait.name || trait.nombre || id) || id,
        tag: clean(trait.tag || `Trait · ${economyCost.replaceAll("_", " ")}`),
        description: clean(trait.description || trait.descripcion || "Trait action."),
      });
    });
    const shared = global.LuminousUnitIndependentActions;
    if (shared) {
      for (const [id, row] of unique) if ([ECONOMY.QUICK, ECONOMY.FREE].includes(economyTabFor(row))) unique.delete(id);
      for (const row of shared.sourcesFor(unit).filter(row => row.sourceType === "trait")) {
        const trait = row.definition, id = normalizeId(trait.id);
        unique.set(id, { ...clone(trait), id, traitId: id, kind: "trait", sourceType: "trait", economyCost: row.cost, cost: costLabel({ actionCost: row.cost }) });
      }
    }
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

  function spellUnavailableLabel(reason){
    return ({
      SPELLCASTING_ABILITY_REQUIRED:"Necesita una fuente de magia válida.",
      SPELL_NOT_SELECTED:"Este hechizo no está asignado.",
      SPELL_DEFINITION_NOT_FOUND:"El hechizo no está disponible en la Biblioteca.",
      CONTENT_REGISTRY_REQUIRED:"La Biblioteca de hechizos no está disponible.",
      SPELL_CASTING_CLASS_NOT_FOUND:"No hay una clase de lanzamiento válida.",
      SPELL_CLASS_NOT_AVAILABLE:"Tu clase no permite este lanzamiento.",
      SPELL_CLASS_AMBIGUOUS:"Selecciona una clase de lanzamiento.",
      SPELL_RUNTIME_NOT_READY:"Los hechizos aún se están preparando."
    })[reason]||"Este hechizo no puede lanzarse ahora.";
  }

  // Explicit canonical selection takes priority over any legacy/demo Unit kit.
  function spellRowsForPlayer(){
    const unit=playerUnit()||{},canonical=global.LuminousSpellLoadout,loadout=spellLoadoutRuntime();
    const explicit=Boolean(canonical?.hasSelection(unit))||
      ["spellLoadout","spellIds","spellSelections","spellSelectionIndex"].some(key=>
        unit[key]!=null||unit.characterBuild?.[key]!=null);
    if(explicit){
      const ids=canonical?.selectedIds(unit)||[...selectedSpellIds(unit)];
      return [...new Set(ids.map(normalizeId).filter(Boolean))].map(id=>{
        const result=loadout?.resolveSpellForCombatant?.(unit,id)||
          {ok:false,reason:"SPELL_RUNTIME_NOT_READY"};
        const definition=loadout?.resolveSpellDefinition?.(id);
        const row=normalizeSpellForMenu(result.spell||definition?.spell||{id,name:id},id);
        return result.ok?row:{...row,__spellUnavailableReason:spellUnavailableLabel(result.reason)};
      });
    }
    if(!isSpellcaster(unit))return [];
    return liveActions("spell").map(row=>normalizeSpellForMenu(row,row?.id));
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

  function localItemIconAsset(value) {
    const raw = clean(value);
    if (!raw || /^(?:https?:)?\/\//i.test(raw) || /^(?:data|blob):/i.test(raw)) return "";
    return raw;
  }

  function itemIconUrl(item = {}) {
    const runtime = global.LuminousItemInventoryRuntime || global.LuminousItemRuntime;
    let resolved = item;
    try { resolved = runtime?.resolveItem?.(item) || item; } catch (_) {}
    const registry = global.LuminousItemIconRegistry;

    const families = [
      item.iconFamily, item.icon_family,
      resolved?.iconFamily, resolved?.icon_family,
      item.family, item.group,
      resolved?.family, resolved?.group,
    ].map(clean).filter(Boolean);

    for (const family of families) {
      const icon = clean(registry?.resolveIcon?.(family, { fallback: false }));
      if (icon) return icon;
    }

    const explicit = [
      item.icono, item.icon, item.image, item.img,
      resolved?.icono, resolved?.icon, resolved?.image, resolved?.img,
    ].map(localItemIconAsset).find(Boolean);
    if (explicit) return explicit;

    return clean(registry?.resolveIcon?.("generic_item", { fallback: false }));
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
    // A defensive Enchantment is a prepared Reaction, not a consumable Item
    // action. Put it in the existing Items > REACTION tab, not an overlay.
    const magic=global.LuminousItemMagicRuntime;
    for(const equipped of magic?.equippedMagicItems?.(unit)||[]){
      const instanceId=clean(equipped?.instanceId||equipped?.instance_id);
      if(!instanceId)continue;
      const canonical=inventoryEntries(unit.inventario_activo||{})
        .map(([,entry])=>entry)
        .find(entry=>clean(entry?.instanceId||entry?.instance_id)===instanceId) || equipped;
      const resolution=magic.enchantmentEffectResolution?.(unit,canonical,{
        trigger:"before_getting_hit",requireEquipped:true,requireLivingActor:true,
        specialUse:true,
      });
      if(!resolution?.resolved || !asArray(resolution.effects).length ||
        asArray(resolution.effects).some(effect=>normalizeId(effect.type)!=="status_apply"))continue;
      const rowKey="enchantment_reaction:"+instanceId;
      seen.add(rowKey);
      rows.push(stableItemRow(rowKey,{
        id:instanceId,itemId:instanceId,instanceId,
        definitionId:clean(canonical.definitionId||canonical.definition_id),
        kind:"item",sourceType:"item",enchantmentReaction:true,
        actionCost:ECONOMY.REACTION,economyCost:ECONOMY.REACTION,
        reaction:{trigger:"before_getting_hit"},
        targetMode:"self",inventoryContainer:"inventario_activo",
        name:clean(canonical.displayName||canonical.nombre||canonical.name||"Item")+" · Reacción",
        description:"Preparar este encantamiento para el próximo golpe recibido.",
        iconFamily:canonical.iconFamily,iconId:canonical.iconId,
        quantity:1,
      }));
    }
    if(clean(unit.__luminousSelectedEnchantmentReaction)){
      rows.push({
        id:"cancel_enchantment_reaction",name:"Cancelar reacción preparada",
        cancelEnchantmentReaction:true,economyCost:ECONOMY.REACTION,
        actionCost:ECONOMY.REACTION,quantity:1,kind:"item",
      });
    }
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
    const unit=playerUnit()||{};
    const caster=isSpellcaster(unit)||Boolean(global.LuminousSpellLoadout?.selectedIds(unit)?.length)||
      selectedSpellIds(unit).size>0;
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
      const deck=global.LuminousCombatSlotDeck073;
      if(!deck)return liveActions("skill").filter((row)=>economyTabFor(row)===tab);
      const unit=playerUnit(),slot=selectedSlotIndex();
      const hand=unit?deck.hand(unit.id,slot).map(card=>({...card.skill,__deckCard:{drawId:card.drawId,slotIndex:slot}})):[];
      const granted=liveActions("skill").filter(row=>!deck.eligible(row));
      return [...hand,...granted].filter(row=>economyTabFor(row)===tab);
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
    global.LuminousUnitIndependentActions?.prepareRound(unit, currentRound);
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

  function ensureMobileStyles() {
    if (!global.document?.head || global.document.getElementById("combat-mobile-runtime-stylesheet")) return;
    const link = global.document.createElement("link");
    link.id = "combat-mobile-runtime-stylesheet";
    link.rel = "stylesheet";
    link.href = "css/combat-mobile-runtime.css?v=20261015-player-centered-v1";
    link.dataset.ui = "combat-mobile-runtime";
    global.document.head.appendChild(link);
  }

  function ensureStyles() {
    ensureMobileStyles();
    if (!global.document || global.document.getElementById("combat073-economy-tabs-style")) return;
    const style = global.document.createElement("style");
    style.id = "combat073-economy-tabs-style";
    style.textContent = `
      .combat-economy-tabs{display:flex;gap:3px;overflow-x:auto;overscroll-behavior-x:contain;padding:5px 7px 4px;background:rgba(4,3,2,.88);border-left:1px solid var(--accent);border-right:1px solid rgba(255,255,255,.08)}
      .combat-economy-tab{flex:1 0 auto;min-width:48px;min-height:40px;padding:5px 3px;border:1px solid rgba(255,255,255,.16);background:#0b0907;color:#9a9184;font:900 7px/1 Arial,sans-serif;letter-spacing:.7px;text-transform:uppercase;cursor:pointer}
      .combat-economy-tab.active{color:#090705;background:var(--accent);border-color:#fff}
      .combat-economy-tab:disabled{opacity:.42;cursor:default}
      .combat-economy-empty{padding:22px 14px;text-align:center;color:#8f8679;font:800 9px/1.45 Arial,sans-serif;letter-spacing:1px;text-transform:uppercase;border:1px dashed rgba(255,255,255,.16);background:rgba(0,0,0,.25)}
      .combat-item-icon{display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;flex:0 0 26px;margin-right:7px}
      .combat-item-icon img{display:block;width:24px;height:24px;object-fit:contain}
      .economy-action-detail{padding:12px;background:#100c08;border-left:3px solid var(--accent);box-shadow:7px 7px 0 rgba(0,0,0,.45)}
      .economy-action-detail h3{margin:0 0 5px;color:#f0e5d4;font:22px/1 var(--font);text-transform:uppercase}
      .economy-action-detail .economy-kind{color:var(--accent);font:900 8px Arial,sans-serif;letter-spacing:1.4px;text-transform:uppercase}
      .economy-action-detail .economy-copy{margin-top:10px;color:#c9bfaf;font:11px/1.45 Arial,sans-serif}
      .economy-action-detail .economy-cost{margin-top:10px;color:#ffe877;font:900 9px Arial,sans-serif;text-transform:uppercase}
      .economy-action-detail button{margin-top:12px;width:100%;padding:9px;border:1px solid var(--accent);background:#090705;color:var(--accent);font:900 10px Arial,sans-serif;letter-spacing:1px;text-transform:uppercase;cursor:pointer}
      .economy-action-detail button:disabled{opacity:.4;cursor:default}
      #game-container.economy-targeting .command-ring,#game-container.economy-targeting .category-surface,#game-container.economy-targeting .category-back{pointer-events:none;opacity:.26}
      #game-container.economy-targeting .sprite-container{cursor:crosshair}
      /* Responsive Combat HUD geometry is managed by css/combat-mobile-runtime.css. */
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
      tabs.innerHTML = `<button type="button" class="combat-economy-tab" data-economy="action">ACTION</button><button type="button" class="combat-economy-tab" data-economy="quick_action">QUICK</button><button type="button" class="combat-economy-tab" data-economy="free_action">FREE</button><button type="button" class="combat-economy-tab" data-economy="reaction">REACTION</button>`;
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
    if (tab === ECONOMY.FREE) return "FREE";
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
    else if (tab === ECONOMY.FREE) context.textContent = "FREE ACTIONS · UNIT ABILITIES";
    else if (tab === ECONOMY.REACTION) context.textContent = `REACTION · AVAILABLE ${Math.max(0, Number(snap.reaction) || 0)} / 1`;
    else context.textContent = `ACTION SLOT ${selectedSlotIndex() + 1}`;
  }

  function setTab(menu, tab) {
    const normalized = normalizeEconomyCost({ economyCost: tab });
    if (!TABBED_MENUS.has(menu) || ![ECONOMY.ACTION, ECONOMY.QUICK, ECONOMY.FREE, ECONOMY.REACTION].includes(normalized)) return false;
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
    if(row.__deckCard)button.dataset.deckDrawId=row.__deckCard.drawId;
    if(row.__spellUnavailableReason){
      button.disabled=true;
      button.classList.add("spell-unavailable");
      button.title=row.__spellUnavailableReason;
      button.setAttribute("aria-label",clean(row.name||row.id)+": "+row.__spellUnavailableReason);
      const reason=global.document.createElement("small");
      reason.className="spell-unavailable-reason";
      reason.textContent=row.__spellUnavailableReason;
      button.appendChild(reason);
    }
    button.onclick = () => api.selectAction({ type:row.__deckCard?"deck":type, slotIndex:selectedSlotIndex(), ...(row.__deckCard?{drawId:row.__deckCard.drawId}:{}), data:row });
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
      const iconUrl = itemIconUrl(row);
      const icon = iconUrl ? `<span class="combat-item-icon"><img src="${htmlEscape(iconUrl)}" alt=""></span>` : "";
      button.innerHTML = `${icon}<span class="clean-name">${htmlEscape(row.name)}</span><span class="clean-cost">${row.enchantmentReaction?"PREPARAR":("x"+qty)} · ${htmlEscape(costLabel(row))}</span>`;
      button.onclick = () => {
        if(row.cancelEnchantmentReaction){
          const unit=playerUnit();
          if(unit)delete unit.__luminousSelectedEnchantmentReaction;
          state.preparedReaction=null;
          try{global.dispatchEvent(new CustomEvent("luminous:combat073-reaction-prepared",{
            detail:{version:VERSION,action:null,source:{}},
          }));}catch(_){}
          lexical("setStatus",()=>{})("REACTION · CANCELADA");
          renderItems();
          return;
        }
        return api.selectAction({ type: "items", slotIndex: selectedSlotIndex(), data: row });
      };
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
    if (activeMenu() === "global") return renderGlobalList();

    // Never bounce into the review wrapper as an "original" renderer. Depending
    // on script timing, that wrapper may have been installed before this module
    // captured its lexical originals, creating EconomyMenu -> ReviewFixes ->
    // EconomyMenu recursion until the HUD exhausts the call stack.
    const original = state.originals.renderCleanList;
    const reviewWrapper = global.LuminousCombatEconomyReviewFixes073?.renderCleanList;
    if (typeof original === "function" && original !== renderCleanList && original !== reviewWrapper) {
      return original();
    }
    return undefined;
  }

  function layoutRadialCommandsStable() {
    const original = state.originals.layoutRadialCommands;
    const result = typeof original === "function" ? original() : undefined;
    if (clean(lexical("navState", "root")) !== "root") return result;

    const host = global.document?.getElementById?.("game-container");
    const ring = global.document?.querySelector?.(".command-ring");
    if (!host || !ring) return result;

    const coarsePointer = global.matchMedia?.("(pointer: coarse)")?.matches === true;
    const viewportWidth = Number(host.clientWidth) || Number(global.innerWidth) || 0;
    const viewportHeight = Number(host.clientHeight) || Number(global.innerHeight) || 0;
    const compact = coarsePointer || viewportWidth <= 900;

    if (compact && viewportWidth > 0 && viewportHeight > 0) {
      // Same origin as Desktop: the current PLAYER_ID sprite, not the
      // viewport edges or the first allied combatant in the encounter.
      const spriteCenter = lexical("spriteCenter", null);
      let center = null;
      try { if (typeof spriteCenter === "function") center = spriteCenter(); } catch (_) {}
      const screenX = Number(center?.x), screenY = Number(center?.y);
      if (!center || !Number.isFinite(screenX) || !Number.isFinite(screenY)) return result;

      const hostRect = host.getBoundingClientRect();
      const ringRect = ring.getBoundingClientRect();
      const playerX = screenX - hostRect.left;
      const playerY = screenY - hostRect.top;
      const portrait = viewportHeight > viewportWidth;
      const safeInset = 10;
      const menuScale = Math.max(.70, Math.min(1.05, viewportWidth / 510));
      const maxButtonWidth = Math.max(84, (viewportWidth - 3 * safeInset) / 2);
      const rx = Math.max(96, Math.min(190, viewportWidth * .31));
      const ry = Math.max(48, Math.min(105, viewportHeight * .135));

      global.document.querySelectorAll(".command-ring .command").forEach((button) => {
        const angle = Number(button.dataset?.angle);
        if (!Number.isFinite(angle)) return;
        const radians = angle * Math.PI / 180;
        const leftSide = Math.cos(radians) < 0;
        const width = Math.min(maxButtonWidth, (Number(button.dataset?.width) || 150) * menuScale);
        const height = 46;
        const naturalX = playerX + rx * Math.cos(radians) - (leftSide ? width : 0);
        const naturalY = playerY + ry * Math.sin(radians) - height / 2;
        // Clamp only to avoid clipping: do not replace the player as origin.
        const x = Math.max(safeInset, Math.min(viewportWidth - width - safeInset, naturalX));
        const y = Math.max(54, Math.min(viewportHeight - height - safeInset, naturalY));
        const originalRotation = leftSide ? (angle > 90 ? angle - 180 : angle + 180) : angle;
        const rotation = originalRotation * (portrait ? .35 : .42);

        button.style.setProperty("--w", `${width}px`);
        if (button.dataset?.accent) button.style.setProperty("--accent", button.dataset.accent);
        button.classList.toggle("radial-left", leftSide);
        button.classList.toggle("radial-right", !leftSide);
        button.style.setProperty("--rot", `${rotation}deg`);
        button.style.setProperty("--icon-counter-rot", `${-rotation}deg`);
        button.style.left = `${hostRect.left - ringRect.left + x}px`;
        button.style.top = `${hostRect.top - ringRect.top + y}px`;
      });
      try { lexical("syncReadyControl", () => {})(); } catch (_) {}
      return result;
    }

    // Desktop: retain the established camera-relative fan untouched.
    const spriteCenter = lexical("spriteCenter", null);
    if (typeof spriteCenter !== "function") return result;
    const center = spriteCenter();
    const ringRect = ring.getBoundingClientRect();
    const cx = Number(center?.x), cy = Number(center?.y);
    if (!Number.isFinite(cx) || !Number.isFinite(cy)) return result;
    const localX = cx - ringRect.left, localY = cy - ringRect.top;
    const rx = 225, ry = 145, menuScale = 1.27;

    global.document.querySelectorAll(".command").forEach((button) => {
      const angle = Number(button.dataset?.angle);
      if (!Number.isFinite(angle)) return;
      const rad = angle * Math.PI / 180;
      const width = (Number(button.dataset?.width) || 150) * menuScale;
      const height = 50;
      const px = localX + rx * Math.cos(rad);
      const py = localY + ry * Math.sin(rad);
      const leftSide = Math.cos(rad) < 0;
      const rotation = leftSide ? (angle > 90 ? angle - 180 : angle + 180) : angle;

      button.style.setProperty("--w", `${width}px`);
      if (button.dataset?.accent) button.style.setProperty("--accent", button.dataset.accent);
      button.classList.toggle("radial-left", leftSide);
      button.classList.toggle("radial-right", !leftSide);
      button.style.setProperty("--rot", `${rotation}deg`);
      button.style.setProperty("--icon-counter-rot", `${-rotation}deg`);
      button.style.left = `${leftSide ? px - width : px}px`;
      button.style.top = `${py - height / 2}px`;
    });

    try { lexical("syncReadyControl", () => {})(); } catch (_) {}
    return result;
  }

  function syncResponsiveMenuLayout() {
    const host = global.document?.getElementById?.("game-container");
    if (!host) return false;
    const coarsePointer = global.matchMedia?.("(pointer: coarse)")?.matches === true;
    const compact = coarsePointer || Number(host.clientWidth || global.innerWidth || 0) <= 900;
    const menu = activeMenu();
    host.classList.toggle("combat-compact-menu", compact);
    host.classList.toggle("combat-root-menu-active", compact && !menu);
    host.classList.toggle("combat-category-active", compact && Boolean(menu));
    return compact;
  }

  function renderActiveMenuBody(menu = activeMenu()) {
    if (menu === "items") renderItems();
    else if (menu === "skills") renderSkills();
    else if (menu === "spells") renderSpells();
    else if (menu === "global") renderGlobalList();
    else return false;
    return true;
  }

  function ensureCategorySurfaceOpen(menu = activeMenu()) {
    if (!TABBED_MENUS.has(menu) || activeMenu() !== menu) return false;
    const meta = lexical("menuMeta", {})?.[menu] || {};
    const surface = global.document?.getElementById?.("category-surface");
    const back = global.document?.getElementById?.("back");
    if (!surface) return false;

    // The packed desktop runtime hides the category surface while its command
    // transition is running. If that Web Animation is cancelled or never fires
    // onfinish, navState remains "category" while the only usable panel stays
    // visibility:hidden, which effectively locks the Player HUD.
    surface.style.visibility = "";
    surface.style.opacity = "";
    surface.classList.remove("left-side", "right-side");
    if (meta.side) surface.classList.add(meta.side === "left" ? "left-side" : "right-side");
    surface.classList.add("open");
    if (meta.accent) surface.style.setProperty("--accent", meta.accent);

    if (back) {
      back.style.visibility = "";
      back.style.opacity = "1";
      back.classList.add("open");
      if (meta.accent) back.style.setProperty("--accent", meta.accent);
    }

    try { lexical("layoutCategory", () => {})(); } catch (_) {}
    return true;
  }

  function refreshOpenedMenu(menu, delay = 560) {
    const generation = ++state.menuRefreshGeneration;
    const stillCurrent = () => generation === state.menuRefreshGeneration && activeMenu() === menu;

    // Desktop transitions are 230ms in the packed runtime. Give the animation
    // its normal chance to finish, then recover the surface if it got stranded
    // hidden. This is intentionally earlier than the data refresh below.
    global.setTimeout?.(() => {
      if (!stillCurrent()) return;
      ensureCategorySurfaceOpen(menu);
    }, Math.min(Math.max(280, Number(delay) || 0), 360));

    global.setTimeout?.(() => {
      if (!stillCurrent()) return;
      ensureCategorySurfaceOpen(menu);
      // Opening recovery must not replace a detail the user already selected.
      if (clean(lexical("navState", "")) === "category") renderActiveMenuBody(menu);
      syncTabs();
      updateCategoryContext();
      syncSpellMenuVisibility();
      syncQuickBadge();
      syncResponsiveMenuLayout();
    }, Math.max(0, Number(delay) || 0));
  }

  function openCompactMenu(menu) {
    const host = global.document?.getElementById?.("game-container");
    if (!host?.classList?.contains?.("combat-compact-menu") || !TABBED_MENUS.has(menu)) return false;
    global.__luminousEconomyCompactMenu = menu;
    try {
      global.eval("activeMenu=window.__luminousEconomyCompactMenu;navState='category';selected=null;focusedIndex=0");
    } catch (_) { return false; }

    const meta = lexical("menuMeta", {})?.[menu] || {};
    const surface = global.document?.getElementById?.("category-surface");
    const back = global.document?.getElementById?.("back");
    const title = global.document?.getElementById?.("category-title");
    const subtitle = global.document?.getElementById?.("category-subtitle");
    if (surface) {
      surface.style.visibility = "";
      surface.style.opacity = "";
      surface.classList.remove("left-side", "right-side");
      if (meta.side) surface.classList.add(meta.side === "left" ? "left-side" : "right-side");
      surface.classList.add("open");
      if (meta.accent) surface.style.setProperty("--accent", meta.accent);
    }
    if (back) {
      back.style.visibility = "";
      back.style.opacity = "1";
      back.classList.add("open");
      if (meta.accent) back.style.setProperty("--accent", meta.accent);
    }
    if (title) title.textContent = meta.title || String(menu).toUpperCase();
    if (subtitle) subtitle.textContent = meta.subtitle || "";

    renderActiveMenuBody(menu);
    syncTabs();
    updateCategoryContext();
    syncSpellMenuVisibility();
    syncQuickBadge();
    syncResponsiveMenuLayout();
    lexical("setStatus", () => {})(`${String(meta.title || menu).toUpperCase()} · PLAYER MENU`);
    return true;
  }

  function restoreGlobalCategoryFromActionDetail() {
    if (activeMenu() !== "global" || clean(lexical("navState", "")) !== "action") return false;
    try {
      global.eval("selected=null;navState='category';focusedIndex=0");
    } catch (_) {
      return false;
    }
    ensureCategorySurfaceOpen("global");
    renderGlobalList();
    syncTabs();
    updateCategoryContext();
    syncSpellMenuVisibility();
    syncQuickBadge();
    syncResponsiveMenuLayout();
    lexical("setStatus", () => {})("ACTIONS · PLAYER MENU");
    return true;
  }

  function installActionBackRecovery() {
    if (state.actionBackRecoveryInstalled || !global.document?.addEventListener) return state.actionBackRecoveryInstalled;
    global.document.addEventListener("click", (event) => {
      const back = event.target?.closest?.("#back,.category-back");
      if (!back) return;
      if (activeMenu() !== "global" || clean(lexical("navState", "")) !== "action") return;
      event.preventDefault();
      event.stopImmediatePropagation();
      restoreGlobalCategoryFromActionDetail();
    }, true);
    state.actionBackRecoveryInstalled = true;
    return true;
  }

  function installRootMenuClickHandler() {
    if (state.rootMenuClickInstalled || !global.document?.addEventListener) return state.rootMenuClickInstalled;
    global.document.addEventListener("click", (event) => {
      const button = event.target?.closest?.(".command-ring button[data-menu],.command-ring [data-menu]");
      if (!button) return;
      const menu = normalizeId(button.dataset?.menu);
      if (!TABBED_MENUS.has(menu)) return;

      // Preserve the original radial transition for mobile and desktop.
      // The economy runtime refreshes the canonical list after it settles.
      // Large-layout viewers keep the original radial transition. Refresh live
      // data once that transition has fully settled.
      refreshOpenedMenu(menu, 560);
    }, true);
    state.rootMenuClickInstalled = true;
    return true;
  }

  function renderCategory() {
    syncResponsiveMenuLayout();
    const result = state.originals.renderCategory?.();
    // Always replace legacy/demo category contents with canonical live Player data.
    renderActiveMenuBody(activeMenu());
    syncSpellMenuVisibility();
    syncTabs();
    updateCategoryContext();
    syncQuickBadge();
    syncResponsiveMenuLayout();
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
    const quick = tab === ECONOMY.QUICK || tab === ECONOMY.FREE;
    const actionItem = tab === ECONOMY.ACTION && normalizeId(source.kind || source.sourceType) === "item";
    const reactionMode = reactionModeOf(source);
    const canPrepare = tab === ECONOMY.REACTION && reactionMode === "prepared";
    const buttonLabel = actionItem ? "USE ITEM" : (tab === ECONOMY.FREE ? "USE FREE ACTION" : (quick ? "USE QUICK ACTION" : (canPrepare ? "PREPARE REACTION" : "ADAPTIVE REACTION")));
    body.innerHTML = `<div class="economy-action-detail"><div class="economy-kind">${htmlEscape(tab.replaceAll("_", " "))}${tab === ECONOMY.REACTION ? ` · ${reactionMode}` : ""}</div><h3>${htmlEscape(source.name || source.id || "Action")}</h3><div class="economy-copy">${source.description || ""}</div><div class="economy-cost">${htmlEscape(costLabel(source))}</div><button id="economy-action-confirm" ${tab === ECONOMY.REACTION && !canPrepare ? "disabled" : ""}>${buttonLabel}</button></div>`;
    const confirm = global.document.getElementById("economy-action-confirm");
    if (confirm && !confirm.disabled) {
      if (actionItem) confirm.onclick = () => confirmLegacyItemSelection(sel);
      else confirm.onclick = () => quick ? beginQuickAction(sel) : prepareReaction(sel);
    }
    lexical("layoutCategory", () => {})();
  }

  function confirmLegacyItemSelection(sel) {
    if (!sel) return undefined;
    return state.originals.selectAction?.({ ...sel, type: "items" });
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
    const actionItem = menu === "items" && tab === ECONOMY.ACTION && normalizeId(sel?.data?.kind || sel?.data?.sourceType) === "item";
    if (!TABBED_MENUS.has(menu) || (tab === ECONOMY.ACTION && !actionItem)) {
      // Menu rows use domain kinds, while the live planner uses granted/spells.
      // Passing "skill" through created an attack the Clash preview could not
      // recognize, even though the online resolver later reconstructed it.
      const type = sel?.type === "skill" ? "granted" : sel?.type === "spell" ? "spells" : sel?.type;
      return state.originals.selectAction?.({ ...sel, type });
    }

    global.__luminousEconomySelected = sel;
    try { global.eval("selected=window.__luminousEconomySelected;navState='action'"); } catch (_) {}
    detailForEconomySelection(sel);

    if (actionItem) {
      lexical("setStatus", () => {})(`ITEM · ${sel?.data?.name || "Item"}`);
      return sel;
    }
    lexical("setStatus", () => {})(`${tab === ECONOMY.QUICK ? "QUICK ACTION" : "REACTION"} · ${sel?.data?.name || "Action"}`);
    return sel;
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

  function independentMessage(reason) {
    if (/quick.*spent|No quick/.test(reason)) return "Ya usaste tu Quick Action este turno.";
    if (/invalid_target/.test(reason)) return "Elige un objetivo válido.";
    if (/uses remaining|Count remaining|not_enough|No .*remaining/.test(reason)) return "No tienes usos o recursos suficientes.";
    if (/trait_specific_runtime_required/.test(reason)) return "Esta habilidad necesita una selección o resolución que aún no está conectada.";
    if (/timeout|pending/.test(reason)) return "La habilidad sigue pendiente de confirmación del DM.";
    return "No se pudo usar la habilidad. Revisa sus requisitos e inténtalo de nuevo.";
  }
  async function useQuickAction(sel, targetId = null) {
    const unit = playerUnit(), independent = global.LuminousUnitIndependentActions;
    if (!unit || !independent) return false;
    const type = normalizeId(sel?.type === "items" ? "item" : sel?.type), source = sel?.data || {};
    const label = economyTabFor(source) === ECONOMY.FREE ? "FREE ACTION" : "QUICK ACTION";
    if (state.independentPending) return false;
    state.independentPending = true;
    lexical("setStatus", () => {})(`${label} · Confirmando ${source.name || "habilidad"}…`);
    try {
      const sync = global.LuminousCombatPlanSync073, online = global.LuminousCombatLiveAdapter073?.state?.db;
      const result = online
        ? await sync.requestIndependentAction({ unitId: unit.id, sourceId: clean(source.instanceId || source.id), sourceType: type,
          cost: independent.costOf(source), targetId: targetId || unit.id, round: roundNumber() })
        : independent.execute(unit, { sourceType: type, definition: source }, { round: roundNumber(), phase: "planning", target: combatData()?.[targetId] || unit, units: Object.values(combatData() || {}) });
      if (!result?.used) {
        lexical("setStatus", () => {})(`${source.name || "Habilidad"} · ${independentMessage(result?.reason || "")}`);
        return false;
      }
      if (result.cost === ECONOMY.QUICK) state.quickSpentRound = roundNumber();
      syncQuickBadge(); syncTabs(); updateCategoryContext();
      lexical("setStatus", () => {})(`${label} · ${source.name || "Habilidad"} · USADA`);
      lexical("goRoot", () => {})(); return true;
    } catch (error) {
      global.console?.error?.("[Independent Action]", error);
      lexical("setStatus", () => {})(independentMessage(error?.message || "")); return false;
    } finally { state.independentPending = false; }
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
    if(sel.data?.enchantmentReaction===true){
      const result=global.LuminousItemEnchantmentCombatRuntime?.queueDefensiveReaction?.(
        unit,sel.data?.instanceId);
      if(!result?.queued){
        lexical("setStatus",()=>{})("REACTION · ITEM NO DISPONIBLE");
        return false;
      }
      // The DM-authoritative Item bridge resolves this at the real pre-damage
      // window. Do not also register it with the legacy generic Reaction
      // runner, which would spend the same Reaction a second time.
      state.preparedReaction=null;
      const action={kind:"item",itemInstanceId:clean(sel.data.instanceId),
        reaction:{mode:"prepared",trigger:"before_getting_hit"}};
      try { global.dispatchEvent(new CustomEvent("luminous:combat073-reaction-prepared",{
        detail:{version:VERSION,action,source:clone(sel.data)},
      })); } catch (_) {}
      lexical("setStatus",()=>{})(`REACTION · ${sel.data.name} · PREPARADA`);
      lexical("goRoot",()=>{})();
      return true;
    }
    const action = compilerFor(sel, null);
    if (!action) return false;
    // Preparing another valid Reaction replaces the previous Item selection.
    if(unit)delete unit.__luminousSelectedEnchantmentReaction;
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
    await loadScript("item-icon-registry-economy073", "js/item-icon-registry.js", () => Boolean(global.LuminousItemIconRegistry));
    await loadScript("combat-action-schema-economy073", "js/combat-action-schema.js", () => Boolean(global.LuminousCombatAction));
    await loadScript("content-registry-economy073", "js/content-registry.js", () => Boolean(global.LuminousContentRegistry));
    await loadScript("content-registry-bootstrap-economy073", "js/content-registry-bootstrap.js", () => Boolean(global.LuminousContentRegistryBootstrap));
    await loadScript("spell-catalog-core-economy073", "js/spell-catalog-core.js", () => Boolean(global.LuminousSpellCatalog));
    await loadScript("combat-spell-loadout-074-economy073", "js/combat-spell-loadout-074.js", () => Boolean(global.LuminousCombatSpellLoadout074));
    await loadScript("combat-action-adapters-economy073", "js/combat-action-adapters.js", () => Boolean(global.LuminousCombatActionAdapters));
    await loadScript("trait-engine-economy073", "js/trait-engine.js", () => Boolean(global.LuminousTraitEngine));
    await loadScript("archetype-engine-economy073", "js/archetype-engine.js", () => Boolean(global.LuminousArchetypeEngine));
    await loadScript("archetype-trait-catalog-economy073", "js/archetype-trait-catalog.js", () => Boolean(global.LuminousArchetypeTraitCatalog));
    await loadScript("trait-catalog-core-economy073", "js/trait-catalog-core.js", () => Boolean(global.LuminousTraitCatalogCore));
    await loadScript("class-milestone-engine-economy073", "js/class-milestone-engine.js", () => Boolean(global.LuminousClassMilestones));
    await loadScript("racial-trait-catalog-economy073", "js/racial-trait-catalog.js", () => Boolean(global.LuminousRacialTraitCatalog));
    // Combat contexts load canonical class/archetype runtimes; they extend the
    // shared trait catalog and activation engine rather than a duplicate menu list.
    await loadScript("class-runtime-bootstrap-economy073", "js/class-runtime-bootstrap.js", () => Boolean(global.LuminousClassRuntimeBootstrap));
    await loadScript("action-economy-economy073", "js/universal-action-economy.js", () => Boolean(global.LuminousActionEconomy));
    await loadScript("unit-independent-actions-economy073", "js/unit-independent-actions.js", () => Boolean(global.LuminousUnitIndependentActions));
    await loadScript("combat-events-economy073", "js/combat-event-runtime.js", () => Boolean(global.LuminousCombatEventRuntime));
    if (playerUnit() && global.document) await global.LuminousUnitIndependentActions?.prepare(Object.values(combatData() || {}));
    return Boolean(global.LuminousCombatAction && global.LuminousCombatActionAdapters && global.LuminousActionEconomy);
  }

  function refreshTraitActionMenu() {
    if (state.installed && activeMenu() === "global") renderGlobalList();
  }

  function ensureTraitLibrarySubscriptions() {
    const db = global.LuminousCombatLiveAdapter073?.state?.db;
    if (!db?.ref || state.traitDb === db) return false;
    state.traitDbListeners.forEach(({ ref, callback }) => ref.off?.("value", callback));
    state.traitDbListeners = [];
    state.traitDb = db;
    [
      ["campaña/config/traits/definitions", "traitCatalogDefinitions"],
      ["campaña/config/traits/grants", "traitCatalogGrants"],
    ].forEach(([path, key]) => {
      const ref = db.ref(path);
      const callback = (snapshot) => {
        state[key] = snapshot.val() || {};
        global.LuminousUnitIndependentActions?.configureCatalog({ definitions: state.traitCatalogDefinitions, grants: state.traitCatalogGrants });
        refreshTraitActionMenu();
      };
      ref.on("value", callback, (error) => {
        global.console?.warn?.("[CombatEconomy073] Trait library read failed", error);
      });
      state.traitDbListeners.push({ ref, callback });
    });
    return true;
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
    state.originals = { renderCategory: lexical("renderCategory"), renderSkills: lexical("renderSkills"), renderSpells: lexical("renderSpells"), renderItems: lexical("renderItems", null), renderCleanList: lexical("renderCleanList"), selectAction: lexical("selectAction"), planTargetRule: lexical("planTargetRule", null), goRoot: lexical("goRoot", null), layoutRadialCommands: lexical("layoutRadialCommands", null) };
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
    if (typeof state.originals.layoutRadialCommands === "function") assignLexical("layoutRadialCommands", "window.LuminousCombatEconomyMenu073.layoutRadialCommandsStable");
    if (typeof state.originals.goRoot === "function") {
      global.__luminousEconomyOriginalGoRoot = state.originals.goRoot;
      global.__luminousEconomyGoRoot = function (...args) {
        state.menuRefreshGeneration += 1;
        const result = global.__luminousEconomyOriginalGoRoot.apply(this, args);
        global.setTimeout?.(syncResponsiveMenuLayout, 0);
        return result;
      };
      assignLexical("goRoot", "window.__luminousEconomyGoRoot");
    }
    installPhaseHooks(); installTargetHandler(); ensureTraitLibrarySubscriptions(); installRootMenuClickHandler(); installActionBackRecovery(); syncPlanningEconomy(false); syncQuickBadge(); syncSpellMenuVisibility(); syncResponsiveMenuLayout();
    global.addEventListener?.("resize", () => {
      syncResponsiveMenuLayout();
      layoutRadialCommandsStable();
      syncSpellMenuVisibility();
    });
    if (!state.menuObserver && typeof MutationObserver === "function" && global.document?.body) {
      state.menuObserver = new MutationObserver(() => { syncSpellMenuVisibility(); syncResponsiveMenuLayout(); });
      state.menuObserver.observe(global.document.body, { childList: true, subtree: true });
    }
    state.installed = true;
    try {
      global.dispatchEvent?.(new global.CustomEvent("luminous:combat073-economy-menu-ready", { detail: { version: VERSION } }));
    } catch (_) {}
    return true;
  }

  const api = { version: VERSION, ECONOMY, state, normalizeEconomyCost, economyTabFor, costLabel, canonicalPlayerId, playerUnit, playerKit, traitDefinitionsForPlayer, authoritativeCharacter, liveActions, spellLoadoutRuntime, normalizeSpellForMenu, classEntries, spellcastingClasses, isSpellcaster, selectedSpellIds, spellRowsForPlayer, inventoryEntries, quantityOf, itemTiming, itemIconUrl, itemCanUseInCombat, stableItemRow, itemRowsForPlayer, findActiveInventoryItem, spellMenuNodes, syncSpellMenuVisibility, layoutRadialCommandsStable, syncResponsiveMenuLayout, renderActiveMenuBody, ensureCategorySurfaceOpen, restoreGlobalCategoryFromActionDetail, installActionBackRecovery, refreshOpenedMenu, openCompactMenu, installRootMenuClickHandler, selfTargetedItem, planTargetRuleCompat, persistQuickItemState, rowsFor, renderSkills, renderSpells, renderItems, renderCleanList, renderCategory, selectAction, confirmLegacyItemSelection, setTab, syncTabs, syncQuickBadge, syncPlanningEconomy, beginCombatEconomy, prepareReaction, triggerPreparedReaction, useQuickAction, install };

  async function boot() { await ensureDependencies(); return install(); }
  api.boot = boot; api.ensureDependencies = ensureDependencies;
  global.LuminousCombatEconomyMenu073 = Object.freeze(api);
  global.addEventListener?.("luminous:combat073-spells-ready",()=>{
    syncSpellMenuVisibility();
    if(activeMenu()==="spells")renderSpells();
  });
  global.addEventListener?.("luminous:combat073-hydrated", () => { ensureTraitLibrarySubscriptions(); syncPlanningEconomy(false); syncQuickBadge(); syncSpellMenuVisibility(); syncResponsiveMenuLayout(); const render = lexical("renderCategory"); if (activeMenu() && typeof render === "function") render(); });
  global.addEventListener?.("luminous:combat073-runtime-ready", () => global.setTimeout(boot, 0));
  global.addEventListener?.("luminous:class-runtime-bootstrap-ready", refreshTraitActionMenu);
  global.addEventListener?.("luminous:class-runtimes-ready", refreshTraitActionMenu);
  global.addEventListener?.("luminous:traits-refreshed", refreshTraitActionMenu);
  global.addEventListener?.("luminous:player-data", refreshTraitActionMenu);
  global.setTimeout(boot, 0);

  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
