(function (global) {
  "use strict";

  const doc = global.document;
  if (!doc || global.LuminousArchetypeRuntime) return;

  const PLAYER_ROOT = "campaña/jugadores";
  const PLAYER_ID_STORAGE_KEY = "playerId";
  const PATCH_INTERVAL_MS = 500;
  const DEVIL_ARCHETYPE_ID = "path_of_the_devil_lineage";

  const state = {
    dependencyPromise: null,
    engineSource: null,
    coreSource: null,
    racialSource: null,
    traySource: null,
    theatreSource: null,
    combatSource: null,
    lastSelectionSignature: "",
    cursedByUnit: new Map(),
  };

  const normalizeId = (value) => String(value ?? "").trim().toLowerCase().replace(/\s+/g, "_");
  const numberOr = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));

  function ensureScript(id, src, ready) {
    if (ready?.()) return Promise.resolve();
    const existing = doc.getElementById(id);
    if (existing) {
      return new Promise((resolve, reject) => {
        if (ready?.()) return resolve();
        existing.addEventListener("load", resolve, { once: true });
        existing.addEventListener("error", reject, { once: true });
      });
    }
    return new Promise((resolve, reject) => {
      const script = doc.createElement("script");
      script.id = id;
      script.src = src;
      script.async = false;
      script.addEventListener("load", resolve, { once: true });
      script.addEventListener("error", reject, { once: true });
      doc.head?.appendChild(script);
    });
  }

  function ensureStyles() {
    if (!doc.querySelector?.(".sheet-phone-wrapper")) return;
    if (doc.getElementById("player-archetype-runtime-stylesheet")) return;
    const link = doc.createElement("link");
    link.id = "player-archetype-runtime-stylesheet";
    link.rel = "stylesheet";
    link.href = "css/player-archetype-runtime.css";
    link.dataset.ui = "player-archetypes";
    doc.head?.appendChild(link);
  }

  function ensureDependencies() {
    if (state.dependencyPromise) return state.dependencyPromise;
    state.dependencyPromise = Promise.resolve()
      .then(() => ensureScript("archetype-engine-script", "js/archetype-engine.js", () => Boolean(global.LuminousArchetypeEngine)))
      .then(() => ensureScript("archetype-trait-catalog-script", "js/archetype-trait-catalog.js", () => Boolean(global.LuminousArchetypeTraitCatalog)));
    return state.dependencyPromise;
  }

  function currentCharacter() {
    return global.LuminousPlayerTraitRuntime?.getCharacter?.() || global.datosJugador || {};
  }

  function currentPlayerId() {
    return String(global.localStorage?.getItem?.(PLAYER_ID_STORAGE_KEY) || "").trim();
  }

  function idsFor(entity = {}) {
    return [
      entity.combatId, entity.combat_id, entity.unitId, entity.unit_id,
      entity.id, entity.playerId, entity.player_id, entity.characterId, entity.character_id,
      entity.actorId, entity.actor_id, entity.uid,
    ]
      .filter((value) => value != null && String(value).trim() !== "")
      .map((value) => String(value).trim());
  }

  function entityName(entity = {}) {
    return normalizeId(entity.characterName || entity.character_name || entity.nombre || entity.name || "");
  }

  function combatUnitKey(unit = {}) {
    return idsFor(unit)[0] || entityName(unit) || null;
  }

  function isCurrentPlayerUnit(unit = {}) {
    const character = currentCharacter();
    if (unit === character) return true;
    const unitIds = new Set(idsFor(unit));
    const expectedIds = new Set([currentPlayerId(), ...idsFor(character)].filter(Boolean));
    if ([...unitIds].some((id) => expectedIds.has(id))) return true;
    const unitName = entityName(unit);
    return Boolean(unitName && unitName === entityName(character));
  }

  function characterForUnit(unit = {}) {
    if (!isCurrentPlayerUnit(unit)) return unit || {};
    const character = currentCharacter();
    return {
      ...(character || {}),
      ...(unit || {}),
      characterBuild: character?.characterBuild || unit?.characterBuild || {},
    };
  }

  function archetypeEngine() {
    return global.LuminousArchetypeEngine;
  }

  function catalog() {
    return global.LuminousArchetypeTraitCatalog;
  }

  function selectedDevilLineage(character = currentCharacter()) {
    const api = archetypeEngine();
    return Boolean(api?.isSelected?.(character, DEVIL_ARCHETYPE_ID, "barbarian"));
  }

  function devilLineageLevel(character = currentCharacter()) {
    const api = archetypeEngine();
    return selectedDevilLineage(character) ? api.getClassLevel(character, "barbarian") : 0;
  }

  function hasDevilLineageLevel(character, level) {
    return devilLineageLevel(character) >= Number(level || 0);
  }

  function statusStore(unit = {}) {
    return unit.statusEffects || unit.status_effects || unit.statuses || {};
  }

  function hasStatus(unit = {}, statusId) {
    const id = normalizeId(statusId);
    const statuses = statusStore(unit);
    if (Array.isArray(statuses)) return statuses.some((entry) => normalizeId(entry?.id || entry?.name || entry) === id);
    if (statuses && typeof statuses === "object") return Boolean(statuses[id] || Object.values(statuses).some((entry) => normalizeId(entry?.id || entry?.name) === id));
    return false;
  }

  function statMod(character = {}, stat) {
    const key = normalizeId(stat);
    const aliases = key === "strength" ? ["fuerza", "strength", "str"] : key === "constitution" ? ["constitucion", "constitution", "con"] : [key];
    const stats = character.stats || character.dndStats || {};
    const score = aliases.map((alias) => stats[alias] ?? character[alias]).find((value) => Number.isFinite(Number(value)));
    return Math.floor((numberOr(score, 10) - 10) / 2);
  }

  function activeInventoryBonus(character = currentCharacter()) {
    const level = devilLineageLevel(character);
    if (level >= 70) return 6;
    if (level >= 15) return 2;
    return 0;
  }

  function activeInventoryLimit(character = currentCharacter(), base = 10) {
    return Math.max(0, Math.floor(numberOr(base, 10) + activeInventoryBonus(character)));
  }

  function strengthThresholdModifier(character = currentCharacter()) {
    const level = devilLineageLevel(character);
    if (level >= 70) return -3;
    if (level >= 15) return -1;
    return 0;
  }

  function deathSavePowerBonus(character = currentCharacter()) {
    return devilLineageLevel(character) >= 50 ? 2 : 0;
  }

  function capabilities(character = currentCharacter()) {
    return devilLineageLevel(character) >= 50
      ? [{ archetypeId: DEVIL_ARCHETYPE_ID, classId: "barbarian", capabilityId: "flight", conditions: {} }]
      : [];
  }

  function statusDamageMultiplier(character = currentCharacter(), statusId) {
    if (devilLineageLevel(character) < 15) return 1;
    return ["burn", "poison"].includes(normalizeId(statusId)) ? 0.5 : 1;
  }

  function isDevilArchetypeTrait(trait = {}) {
    const source = trait?.source || {};
    const type = normalizeId(source.type || trait?.sourceType);
    const archetypeId = normalizeId(source.archetypeId || source.id || trait?.archetypeId);
    return ["archetype", "subclass", "class_archetype"].includes(type) && archetypeId === DEVIL_ARCHETYPE_ID;
  }

  function syncArchetypeTraitsForUnit(unit = {}) {
    const archetypeCatalog = catalog();
    if (!unit || !archetypeCatalog?.resolveTraitGrants) return [];
    const character = characterForUnit(unit);
    const granted = archetypeCatalog.resolveTraitGrants(character) || [];
    const existing = Array.isArray(unit.traitDefinitions) ? unit.traitDefinitions : [];
    const byId = new Map();
    [...existing.filter((trait) => !isDevilArchetypeTrait(trait)), ...granted].forEach((trait) => {
      const id = normalizeId(trait?.id || trait?.name);
      if (id && !byId.has(id)) byId.set(id, trait);
    });
    unit.traitDefinitions = [...byId.values()];
    global.LuminousTraitStandardizationRuntime?.registerCombatUnit?.(unit);
    return granted;
  }

  function patchTraitEngine() {
    const api = archetypeEngine();
    const archetypeCatalog = catalog();
    const source = global.LuminousTraitEngine;
    if (!api || !archetypeCatalog || !source?.resolveTraitGrants) return false;
    if (source.__archetypeGrantResolver) {
      state.engineSource = source;
      return true;
    }
    if (state.engineSource === source) return true;

    const originalResolve = source.resolveTraitGrants.bind(source);
    const wrapped = Object.freeze({
      ...source,
      __archetypeGrantResolver: true,
      resolveTraitGrants(character = {}, grants = [], definitions = {}) {
        const list = Array.isArray(grants) ? grants : Object.values(grants || {});
        const normal = list.filter((grant) => normalizeId(grant?.sourceType || grant?.source?.type) !== "archetype");
        const archetypeGrants = list.filter((grant) => normalizeId(grant?.sourceType || grant?.source?.type) === "archetype");
        const resolved = originalResolve(character, normal, definitions);
        const selected = api.resolveTraitGrants(character, archetypeGrants, definitions, archetypeCatalog.allArchetypes(), source);
        const byId = new Map();
        [...resolved, ...selected].forEach((trait) => {
          const id = normalizeId(trait?.id || trait?.name);
          if (id && !byId.has(id)) byId.set(id, trait);
        });
        return [...byId.values()];
      },
    });
    global.LuminousTraitEngine = wrapped;
    state.engineSource = wrapped;
    return true;
  }

  function patchCoreCatalog() {
    const source = global.LuminousTraitCatalogCore;
    const archetypeCatalog = catalog();
    if (!source?.allDefinitions || !source?.allGrants || !archetypeCatalog) return false;
    if (source.__archetypeCatalogIntegrated) {
      state.coreSource = source;
      return true;
    }
    if (state.coreSource === source) return true;

    const originalDefinitions = source.allDefinitions.bind(source);
    const originalGrants = source.allGrants.bind(source);
    const originalGet = typeof source.getDefinition === "function" ? source.getDefinition.bind(source) : null;
    const wrapped = Object.freeze({
      ...source,
      __archetypeCatalogIntegrated: true,
      allDefinitions() {
        return { ...originalDefinitions(), ...archetypeCatalog.allDefinitions() };
      },
      allGrants() {
        return [...originalGrants(), ...archetypeCatalog.allGrants()];
      },
      getDefinition(id) {
        const key = normalizeId(id);
        const local = archetypeCatalog.allDefinitions()[key];
        return local ? clone(local) : originalGet?.(id) || null;
      },
    });
    global.LuminousTraitCatalogCore = wrapped;
    state.coreSource = wrapped;
    return true;
  }

  function patchRacialCapabilities() {
    const source = global.LuminousRacialTraitCatalog;
    if (!source?.resolveCapabilities) return false;
    if (source.__archetypeCapabilitiesIntegrated) {
      state.racialSource = source;
      return true;
    }
    if (state.racialSource === source) return true;

    const original = source.resolveCapabilities.bind(source);
    const wrapped = Object.freeze({
      ...source,
      __archetypeCapabilitiesIntegrated: true,
      resolveCapabilities(character = {}) {
        const merged = [...(original(character) || []), ...capabilities(character)];
        const seen = new Set();
        return merged.filter((entry) => {
          const key = `${normalizeId(entry?.capabilityId)}:${normalizeId(entry?.raceId || entry?.archetypeId || entry?.sourceId)}`;
          if (!entry?.capabilityId || seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      },
    });
    global.LuminousRacialTraitCatalog = wrapped;
    state.racialSource = wrapped;
    return true;
  }

  function archetypeIdForTrait(trait = {}) {
    const source = trait.source || {};
    return normalizeId(source.archetypeId || source.subclassId || source.id);
  }

  function decorateArchetypeSubtabs(tray) {
    const api = archetypeEngine();
    if (!tray?.root || !api) return;
    tray.root.querySelector(".player-archetype-subtabs")?.remove();
    if (normalizeId(tray.filter) !== "archetype") return;

    const traits = tray.normalizedTraits?.() || [];
    const groups = api.groupTraitsByArchetype(traits);
    if (groups.length <= 1) return;

    const validIds = new Set(groups.map((group) => group.archetypeId));
    if (!validIds.has(normalizeId(tray.archetypeFilter))) tray.archetypeFilter = groups[0].archetypeId;
    const activeId = normalizeId(tray.archetypeFilter);
    const nav = doc.createElement("nav");
    nav.className = "player-archetype-subtabs";
    nav.setAttribute("aria-label", "Filter Archetype Traits");

    groups.forEach((group) => {
      const button = doc.createElement("button");
      button.type = "button";
      button.className = `player-archetype-subtab${activeId === group.archetypeId ? " is-active" : ""}`;
      button.dataset.archetypeFilter = group.archetypeId;
      button.setAttribute("aria-pressed", activeId === group.archetypeId ? "true" : "false");
      const name = doc.createElement("span");
      name.textContent = group.name;
      const count = doc.createElement("b");
      count.textContent = String(group.traits.length);
      button.append(name, count);
      button.addEventListener("click", () => {
        tray.archetypeFilter = group.archetypeId;
        tray.render();
      });
      nav.appendChild(button);
    });

    const filters = tray.root.querySelector(".player-trait-filters");
    filters?.insertAdjacentElement("afterend", nav);
    const byTraitId = new Map(traits.map((trait) => [normalizeId(trait.id), archetypeIdForTrait(trait)]));
    tray.root.querySelectorAll(".player-trait-card").forEach((card) => {
      const traitArchetype = byTraitId.get(normalizeId(card.dataset.traitId));
      card.dataset.archetypeId = traitArchetype || "";
      card.hidden = Boolean(traitArchetype && traitArchetype !== activeId);
    });
  }

  function patchTraitTray() {
    const source = global.LuminousTraitPlayerTray;
    const Tray = source?.TraitPlayerTray;
    if (!Tray?.prototype?.render) return false;
    if (Tray.prototype.render.__archetypeSubtabsIntegrated) {
      state.traySource = source;
      return true;
    }
    if (state.traySource === source) return true;

    const originalRender = Tray.prototype.render;
    function renderWithArchetypeSubtabs(...args) {
      const result = originalRender.apply(this, args);
      decorateArchetypeSubtabs(this);
      return result;
    }
    Object.defineProperty(renderWithArchetypeSubtabs, "__archetypeSubtabsIntegrated", { value: true });
    Tray.prototype.render = renderWithArchetypeSubtabs;
    state.traySource = source;
    global.LuminousPlayerTraitRuntime?.refresh?.();
    return true;
  }

  function classArchetypeOptions(character = currentCharacter()) {
    const api = archetypeEngine();
    const archetypeCatalog = catalog();
    if (!api || !archetypeCatalog) return [];
    const all = Object.values(archetypeCatalog.allArchetypes());
    return api.classEntries(character).map((entry) => {
      const options = all.filter((archetype) => normalizeId(archetype.classId) === entry.classId);
      if (!options.length) return null;
      return {
        classId: entry.classId,
        classLevel: entry.levels,
        className: options[0]?.className || entry.classId,
        selected: api.selectedForClass(character, entry.classId),
        options,
      };
    }).filter(Boolean);
  }

  function persistArchetypeSelection(classId, archetypeId) {
    const api = archetypeEngine();
    const archetypeCatalog = catalog();
    const character = currentCharacter();
    if (!api || !archetypeCatalog) return Promise.reject(new Error("Archetype Engine is unavailable."));
    let selections;
    try {
      selections = api.selectArchetype(character, classId, archetypeId, archetypeCatalog.allArchetypes());
    } catch (error) {
      return Promise.reject(error);
    }

    if (!character.characterBuild || typeof character.characterBuild !== "object") character.characterBuild = {};
    character.characterBuild.archetypes = selections;
    const playerId = currentPlayerId();
    const db = global.firebase?.database?.();
    if (!playerId || !db) {
      global.LuminousPlayerTraitRuntime?.refresh?.();
      renderArchetypeSelector();
      return Promise.resolve(selections);
    }
    return db.ref(`${PLAYER_ROOT}/${playerId}/characterBuild/archetypes`).set(selections).then(() => {
      global.LuminousPlayerTraitRuntime?.refresh?.();
      renderArchetypeSelector();
      return selections;
    });
  }

  function renderArchetypeSelector() {
    const host = doc.getElementById("player-trait-runtime-host");
    if (!host) return false;
    let panel = doc.getElementById("player-archetype-selector");
    if (!panel) {
      panel = doc.createElement("section");
      panel.id = "player-archetype-selector";
      panel.className = "player-archetype-selector";
      host.prepend(panel);
    }

    const character = currentCharacter();
    const rows = classArchetypeOptions(character);
    const signature = JSON.stringify({ rows, selections: archetypeEngine()?.normalizeSelections?.(character) || [] });
    if (signature === state.lastSelectionSignature && panel.childElementCount) return true;
    state.lastSelectionSignature = signature;
    panel.replaceChildren();
    if (!rows.length) {
      panel.hidden = true;
      return false;
    }
    panel.hidden = false;

    const head = doc.createElement("div");
    head.className = "player-archetype-selector__head";
    const title = doc.createElement("strong");
    title.textContent = "ARCHETYPES";
    const help = doc.createElement("span");
    help.textContent = "Each Class tracks its own Archetype by Class Level.";
    head.append(title, help);
    panel.appendChild(head);

    rows.forEach((row) => {
      const item = doc.createElement("div");
      item.className = "player-archetype-selector__row";
      item.dataset.classId = row.classId;
      const identity = doc.createElement("div");
      identity.className = "player-archetype-selector__class";
      const className = doc.createElement("b");
      className.textContent = row.className;
      const classLevel = doc.createElement("span");
      classLevel.textContent = `CLASS LV.${row.classLevel}`;
      identity.append(className, classLevel);
      item.appendChild(identity);

      const choices = doc.createElement("div");
      choices.className = "player-archetype-selector__choices";
      if (row.selected) {
        const selected = row.options.find((entry) => normalizeId(entry.id) === row.selected.archetypeId);
        const badge = doc.createElement("span");
        badge.className = "player-archetype-selector__selected";
        badge.textContent = selected?.name || row.selected.archetypeId;
        badge.title = "Archetype selection is stored per Class.";
        choices.appendChild(badge);
      } else {
        row.options.forEach((option) => {
          const required = Math.max(0, Number(option.unlockLevel) || 0);
          const button = doc.createElement("button");
          button.type = "button";
          button.className = "player-archetype-selector__choice";
          button.dataset.archetypeId = option.id;
          button.disabled = row.classLevel < required;
          button.textContent = row.classLevel < required ? `${option.name} · LV.${required}` : `SELECT · ${option.name}`;
          button.addEventListener("click", () => {
            button.disabled = true;
            persistArchetypeSelection(row.classId, option.id).catch((error) => {
              button.disabled = false;
              global.alert?.(error.message || "Could not select Archetype.");
            });
          });
          choices.appendChild(button);
        });
      }
      item.appendChild(choices);
      panel.appendChild(item);
    });
    return true;
  }

  function numericThresholdField(check = {}) {
    for (const key of ["difficulty", "thresholdRaw", "threshold"]) {
      if (Number.isFinite(Number(check[key]))) return key;
    }
    return null;
  }

  function applyTheatreCheckMechanics(checkInput = {}) {
    const check = { ...(checkInput || {}) };
    if (check.__archetypeAdjusted) return check;
    const character = currentCharacter();
    const level = devilLineageLevel(character);
    if (level < 15) return check;
    const ability = normalizeId(check.abilityId || check.statId || check.ability || check.stat);
    const skill = normalizeId(check.skillId || check.skill || check.actionId);
    const tags = Array.isArray(check.tags) ? check.tags.map(normalizeId) : [];
    const thresholdKey = numericThresholdField(check);

    if (["str", "strength", "fuerza"].includes(ability) && thresholdKey) {
      check[thresholdKey] = numberOr(check[thresholdKey]) + strengthThresholdModifier(character);
    }
    if (skill === "performance") check.finalPower = numberOr(check.finalPower) + statMod(character, "strength");
    const jumpCheck = skill === "jump" || tags.includes("jump");
    if (jumpCheck && thresholdKey && hasStatus(character, "rage")) check[thresholdKey] = numberOr(check[thresholdKey]) / 2;
    Object.defineProperty(check, "__archetypeAdjusted", { value: true, enumerable: false, configurable: true });
    return check;
  }

  function patchTheatreRolls() {
    const source = global.LuminousTheatreRolls;
    if (!source?.armCheck) return false;
    if (source.__archetypeRuntimeIntegrated) {
      state.theatreSource = source;
      return true;
    }
    if (state.theatreSource === source) return true;
    const originalArmCheck = source.armCheck.bind(source);
    const wrapped = Object.freeze({
      ...source,
      __archetypeRuntimeIntegrated: true,
      armCheck(check = {}) {
        return originalArmCheck(applyTheatreCheckMechanics(check));
      },
    });
    global.LuminousTheatreRolls = wrapped;
    state.theatreSource = wrapped;
    return true;
  }

  function currentHp(unit = {}) {
    return numberOr(unit.hp ?? unit.currentHp ?? unit.current_hp, 0);
  }

  function maxHp(unit = {}) {
    return numberOr(unit.maxHp ?? unit.max_hp ?? unit.hp_max, currentHp(unit));
  }

  function setHp(unit = {}, value) {
    const next = Math.max(0, numberOr(value));
    if (Object.prototype.hasOwnProperty.call(unit, "hp")) unit.hp = next;
    else if (Object.prototype.hasOwnProperty.call(unit, "currentHp")) unit.currentHp = next;
    else unit.hp = next;
    return next;
  }

  function cursedState(unit = {}) {
    const key = combatUnitKey(unit);
    if (key) {
      if (!state.cursedByUnit.has(key)) state.cursedByUnit.set(key, { used: false, pending: false });
      return state.cursedByUnit.get(key);
    }
    if (!unit.__devilLineageCursedJuggernaut) {
      Object.defineProperty(unit, "__devilLineageCursedJuggernaut", {
        value: { used: false, pending: false },
        writable: true,
        configurable: true,
        enumerable: false,
      });
    }
    return unit.__devilLineageCursedJuggernaut;
  }

  function armCursedJuggernaut(unit = {}) {
    const record = cursedState(unit);
    if (!record.used) {
      record.used = true;
      record.pending = true;
    }
    return record;
  }

  function resolveCursedJuggernautRecovery(unit = {}) {
    const record = cursedState(unit);
    if (!record.pending) return 0;
    record.pending = false;
    const character = characterForUnit(unit);
    const percent = Math.max(14, 14 * statMod(character, "constitution"));
    const maximum = maxHp(unit);
    const amount = Math.floor(maximum * percent / 100);
    setHp(unit, Math.min(maximum, currentHp(unit) + amount));
    return amount;
  }

  function coinSpendsAmmo(skill = {}, context = {}) {
    const coin = context?.currentCoin || context?.coin || context?.coinData || null;
    const coinCost = numberOr(coin?.ammoCost ?? coin?.ammo_cost ?? coin?.ammo?.cost, 0);
    const skillCost = numberOr(skill?.ammo?.cost ?? skill?.ammoCost ?? skill?.ammo_cost, 0);
    return coin?.spendsAmmo === true || coin?.spendAmmo === true || coinCost > 0 || skillCost > 0;
  }

  function patchCombatEngine() {
    const engine = global.CombatEngine;
    if (!engine) return false;
    if (engine.__archetypeRuntimeIntegrated) {
      state.combatSource = engine;
      return true;
    }
    if (state.combatSource === engine) return true;

    const originalInitialize = typeof engine.initializeUnitData === "function" ? engine.initializeUnitData : null;
    if (originalInitialize) {
      engine.initializeUnitData = function (unit, ...rest) {
        const result = originalInitialize.call(this, unit, ...rest);
        syncArchetypeTraitsForUnit(unit);
        return result;
      };
    }

    const originalCoinDamage = typeof engine.calculateCoinDamage === "function" ? engine.calculateCoinDamage : null;
    if (originalCoinDamage) {
      engine.calculateCoinDamage = function (attacker, defender, skill, coinFinalPower, isCritical, clashCount, context = null) {
        const character = characterForUnit(attacker);
        const level = devilLineageLevel(character);
        const rage = hasStatus(attacker, "rage");
        let restorePhysRes = null;
        if (level >= 30 && rage && defender && Number(defender.physRes) === 0.5) {
          const damageType = normalizeId(skill?.attackType || skill?.damageType || skill?.damage_type);
          if (["slash", "pierce", "piercing", "blunt"].includes(damageType)) {
            restorePhysRes = defender.physRes;
            defender.physRes = 1;
          }
        }
        let result;
        try {
          result = originalCoinDamage.call(this, attacker, defender, skill, coinFinalPower, isCritical, clashCount, context);
        } finally {
          if (restorePhysRes != null) defender.physRes = restorePhysRes;
        }
        if (level >= 15 && coinSpendsAmmo(skill, context)) {
          const multiplier = 1 + (10 * statMod(character, "strength")) / 100;
          if (typeof result === "number") result = Math.max(0, Math.floor(result * multiplier));
        }
        return result;
      };
    }

    const originalApplyDamage = typeof engine.applyDamage === "function" ? engine.applyDamage : null;
    if (originalApplyDamage) {
      engine.applyDamage = function (unit, damage, ...rest) {
        const character = characterForUnit(unit);
        const active = hasDevilLineageLevel(character, 70) && hasStatus(unit, "rage");
        if (!active) return originalApplyDamage.call(this, unit, damage, ...rest);
        const hpBefore = currentHp(unit);
        const shieldBefore = Math.max(0, numberOr(unit?.shield, 0));
        const incoming = Math.max(0, numberOr(damage, 0));
        const projectedHpLoss = Math.max(0, incoming - shieldBefore);
        const reachesFloor = hpBefore - projectedHpLoss <= 1;
        let adjustedDamage = incoming;
        if (reachesFloor) {
          const allowedHpLoss = Math.max(0, hpBefore - 1);
          adjustedDamage = Math.min(incoming, shieldBefore + allowedHpLoss);
          armCursedJuggernaut(unit);
        }
        const result = originalApplyDamage.call(this, unit, adjustedDamage, ...rest);
        if (currentHp(unit) < 1) setHp(unit, 1);
        return result;
      };
    }

    const originalProcessStatuses = typeof engine.processStatusEffects === "function" ? engine.processStatusEffects : null;
    if (originalProcessStatuses) {
      engine.processStatusEffects = function (unit, triggerKey, context = {}) {
        const character = characterForUnit(unit);
        const resistant = hasDevilLineageLevel(character, 15);
        const store = unit?.statusEffects && typeof unit.statusEffects === "object" ? unit.statusEffects : null;
        const changed = [];
        if (resistant && store) {
          ["burn", "poison"].forEach((id) => {
            const status = store[id];
            if (status && typeof status === "object" && Number.isFinite(Number(status.potency))) {
              changed.push([status, status.potency]);
              status.potency = Number(status.potency) * 0.5;
            }
          });
        }
        const hpBefore = currentHp(unit);
        let result;
        try {
          result = originalProcessStatuses.call(this, unit, triggerKey, context);
        } finally {
          changed.forEach(([status, potency]) => { status.potency = potency; });
        }
        if (hasDevilLineageLevel(character, 70) && hasStatus(unit, "rage") && currentHp(unit) <= 1) {
          if (hpBefore > 1) armCursedJuggernaut(unit);
          if (currentHp(unit) < 1) setHp(unit, 1);
        }
        return result;
      };
    }

    const originalEncounterStart = typeof engine.triggerEncounterStart === "function" ? engine.triggerEncounterStart : null;
    if (originalEncounterStart) {
      engine.triggerEncounterStart = function (allUnits = [], ...rest) {
        state.cursedByUnit.clear();
        (Array.isArray(allUnits) ? allUnits : []).forEach((unit) => {
          syncArchetypeTraitsForUnit(unit);
          if (!hasDevilLineageLevel(characterForUnit(unit), 70)) return;
          const record = cursedState(unit);
          record.used = false;
          record.pending = false;
        });
        return originalEncounterStart.call(this, allUnits, ...rest);
      };
    }

    const originalTriggerPhase = typeof engine.triggerPhase === "function" ? engine.triggerPhase : null;
    if (originalTriggerPhase) {
      engine.triggerPhase = function (phaseTag, allUnits, ...rest) {
        const units = Array.isArray(allUnits) ? allUnits : [];
        units.forEach(syncArchetypeTraitsForUnit);
        const result = originalTriggerPhase.call(this, phaseTag, allUnits, ...rest);
        if (phaseTag === "[Round Start]") {
          units.forEach((unit) => {
            if (hasDevilLineageLevel(characterForUnit(unit), 70)) resolveCursedJuggernautRecovery(unit);
          });
        }
        return result;
      };
    }

    Object.defineProperty(engine, "__archetypeRuntimeIntegrated", { value: true, configurable: true });
    state.combatSource = engine;
    return true;
  }

  function watchCombatEngineAssignment() {
    if (global.CombatEngine || global.__luminousArchetypeCombatAssignmentWatch) return false;
    global.__luminousArchetypeCombatAssignmentWatch = true;
    try {
      Object.defineProperty(global, "CombatEngine", {
        configurable: true,
        enumerable: true,
        get() { return undefined; },
        set(value) {
          Object.defineProperty(global, "CombatEngine", {
            value,
            writable: true,
            configurable: true,
            enumerable: true,
          });
          state.combatSource = null;
          patchCombatEngine();
        },
      });
      return true;
    } catch (_) {
      return false;
    }
  }

  function installActiveInventoryBridge() {
    if (global.__luminousArchetypeInventoryBridge) return true;
    global.__luminousArchetypeInventoryBridge = true;
    global.addEventListener("item-move-action", (event) => {
      const detail = event?.detail || {};
      if (!detail.fromStash) return;
      const character = currentCharacter();
      const bonus = activeInventoryBonus(character);
      if (bonus <= 0) return;

      const playerId = currentPlayerId();
      const db = global.firebase?.database?.();
      if (!playerId || !db || !detail.itemKey || !detail.itemData) return;
      event.stopImmediatePropagation();

      const itemKey = detail.itemKey;
      const itemData = detail.itemData;
      const sourceRef = db.ref(`${PLAYER_ROOT}/${playerId}/inventario_stash/${itemKey}`);
      const targetRef = db.ref(`${PLAYER_ROOT}/${playerId}/inventario_activo`);
      const sourceCurrentCant = Math.max(1, Number.parseInt(itemData.cantidad, 10) || 1);

      targetRef.once("value", (snapshot) => {
        const targetData = snapshot.val() || {};
        let foundKey = null;
        let targetCurrentCant = 0;
        Object.entries(targetData).some(([key, targetItem]) => {
          if (targetItem?.nombre === itemData.nombre && (targetItem?.tier || 1) == (itemData.tier || 1)) {
            foundKey = key;
            targetCurrentCant = targetItem.cantidad || 1;
            return true;
          }
          return false;
        });

        const activeStackLimit = Number.parseInt(itemData.limite_activo, 10) || 2;
        const maxCanMove = activeStackLimit - targetCurrentCant;
        if (maxCanMove <= 0) {
          global.alert?.(`No puedes equipar más de ${activeStackLimit} de este ítem a la vez.`);
          return;
        }
        const limit = activeInventoryLimit(character, 10);
        if (!foundKey && Object.keys(targetData).length >= limit) {
          global.alert?.(`El Inventario Activo está lleno. Solo puedes llevar ${limit} espacios.`);
          return;
        }

        const moveAmount = Math.min(sourceCurrentCant, maxCanMove);
        const itemToMove = { ...itemData, cantidad: moveAmount };
        delete itemToMove.key;
        const add = foundKey
          ? targetRef.child(foundKey).update({ cantidad: targetCurrentCant + moveAmount })
          : targetRef.push(itemToMove);
        Promise.resolve(add).then(() => sourceRef.once("value", (sourceSnapshot) => {
          const sourceItem = sourceSnapshot.val();
          if (!sourceItem) return;
          const newSourceCant = (Number(sourceItem.cantidad) || 1) - moveAmount;
          if (newSourceCant > 0) sourceRef.update({ cantidad: newSourceCant });
          else sourceRef.remove();
        }));
      });
    }, true);
    return true;
  }

  function installPatches() {
    patchTraitEngine();
    patchCoreCatalog();
    patchRacialCapabilities();
    patchTraitTray();
    patchTheatreRolls();
    patchCombatEngine();
    renderArchetypeSelector();
  }

  function boot() {
    ensureStyles();
    watchCombatEngineAssignment();
    installActiveInventoryBridge();
    installPatches();
    global.addEventListener?.("luminous:traits-refreshed", () => {
      state.lastSelectionSignature = "";
      renderArchetypeSelector();
    });
    global.setInterval(installPatches, PATCH_INTERVAL_MS);
  }

  const api = Object.freeze({
    currentCharacter,
    selectedDevilLineage,
    devilLineageLevel,
    activeInventoryBonus,
    activeInventoryLimit,
    strengthThresholdModifier,
    deathSavePowerBonus,
    capabilities,
    statusDamageMultiplier,
    syncArchetypeTraitsForUnit,
    coinSpendsAmmo,
    applyTheatreCheckMechanics,
    classArchetypeOptions,
    persistArchetypeSelection,
    renderArchetypeSelector,
    patchTraitEngine,
    patchCoreCatalog,
    patchRacialCapabilities,
    patchTraitTray,
    patchTheatreRolls,
    patchCombatEngine,
    watchCombatEngineAssignment,
    resolveCursedJuggernautRecovery,
  });

  global.LuminousArchetypeRuntime = api;
  ensureDependencies().then(boot).catch((error) => console.error("Player Archetype Runtime:", error));
})(window);
