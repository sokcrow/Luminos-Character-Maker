(function (global) {
  'use strict';
  if (global.LuminousUnitCombatInstantiator) return;

  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
  const clean = (value) => String(value ?? '').trim();
  const finite = (value, fallback = null) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const safe = (value, fallback = 'unit') => clean(value).replace(/[.#$\[\]\/]/g, '_') || fallback;
  const safeRequire = (path) => {
    if (typeof require !== 'function') return null;
    try { return require(path); } catch (_) { return null; }
  };

  function firstNumber(object, paths, fallback = null) {
    for (const path of paths) {
      let value = object;
      for (const part of path.split('.')) value = value?.[part];
      const number = finite(value, null);
      if (number != null) return number;
    }
    return fallback;
  }

  function parseRange(value) {
    if (Array.isArray(value) && value.length >= 2) {
      const a = finite(value[0], null), b = finite(value[1], null);
      if (a != null && b != null) return [Math.min(a, b), Math.max(a, b)];
    }
    if (value && typeof value === 'object') {
      const a = finite(value.min ?? value.minimum ?? value.low, null);
      const b = finite(value.max ?? value.maximum ?? value.high, null);
      if (a != null && b != null) return [Math.min(a, b), Math.max(a, b)];
    }
    if (typeof value === 'string') {
      const match = value.match(/^\s*(-?\d+(?:\.\d+)?)\s*[-–]\s*(-?\d+(?:\.\d+)?)\s*$/);
      if (match) {
        const a = Number(match[1]), b = Number(match[2]);
        return [Math.min(a, b), Math.max(a, b)];
      }
    }
    const number = finite(value, null);
    return number == null ? null : [number, number];
  }

  function spriteFor(record = {}) {
    return clean(
      record.combatSprite || record.sprite_combate || record.combat_sprite || record.combatVisual?.spriteUrl ||
      record.visual?.spriteUrl || record.tokenImage || record.sprite || record.idle_sprite || record.icono ||
      record.img || record.image || record.portrait
    );
  }

  function skillIdsFor(record = {}) {
    const raw = record.action_slots ?? record.skillSlotIds ?? record.skillIds ?? record.skill_ids ?? record.mechanics?.skills ?? record.equippedSkills ?? [];
    let ids = [];
    if (Array.isArray(raw)) ids = raw.map((entry) => clean(entry?.id || entry?.skillId || entry)).filter(Boolean);
    else if (raw && typeof raw === 'object') ids = Object.values(raw).map((entry) => clean(entry?.id || entry?.skillId || entry)).filter(Boolean);
    if (!ids.length && Array.isArray(record.resolvedSkills)) ids = record.resolvedSkills.map((entry) => clean(entry?.id)).filter(Boolean);
    if (!ids.length && record.equippedSkillIndex && typeof record.equippedSkillIndex === 'object') {
      ids = Object.keys(record.equippedSkillIndex).filter((id) => record.equippedSkillIndex[id] === true);
    }
    return [...new Set(ids)];
  }

  function actionSlotsFor(record = {}) {
    return Math.max(1, Math.trunc(firstNumber(record, [
      'actionSlots', 'activeSlots', 'action_slots_count', 'initialActionSlots', 'maxActionSlots',
      'mechanics.actionSlots', 'mechanics.activeSlots', 'mechanics.maxSlotsLimit'
    ], 1) || 1));
  }

  function levelFor(record = {}, fallback = 1) {
    const direct = firstNumber(record, ['runtimeLevel', 'baseLevelSelected', 'level', 'mechanics.runtimeLevel', 'mechanics.level'], null);
    if (direct != null && direct >= 1) return Math.floor(direct);
    const min = firstNumber(record, ['naturalWorldLevel.min', 'baseLevel.min'], null);
    return Math.max(1, Math.floor(min ?? fallback));
  }

  function rankFor(record = {}) {
    return clean(record.rank || record.mechanics?.rank || record.allowedRanks?.[0] || 'normal').toLowerCase();
  }

  function catalogFor(unitId, record = {}) {
    const id = clean(unitId || record.id).toLowerCase();
    const species = clean(record.species || record.family).toLowerCase();
    const catalog = clean(record.metadata?.catalog).toLowerCase();
    if (species.includes('goblin') || id.startsWith('goblin') || catalog.includes('goblin')) {
      return global.LuminousGoblinUnitCatalog || safeRequire('./unit-catalog-goblin.js');
    }
    if (species.includes('kobold') || id.includes('kobold') || catalog.includes('kobold')) {
      return global.LuminousKoboldUnitCatalog || safeRequire('./unit-catalog-kobold-tier1.js');
    }
    if (species.includes('wolf') || id.includes('wolf') || catalog.includes('wolf')) {
      return global.LuminousWolfUnitCatalog || safeRequire('./unit-catalog-wolf.js');
    }
    return null;
  }

  function resolveDefinition(unitId, definition = {}, options = {}) {
    const source = clone(definition) || {};
    const catalog = catalogFor(unitId, source);
    let resolved = null;
    let catalogResolved = false;
    if (catalog?.get?.(unitId) && typeof catalog.resolve === 'function') {
      const level = Math.max(1, Math.floor(finite(options.level, levelFor(source, 1)) || 1));
      const rank = clean(options.rank || rankFor(source));
      resolved = catalog.resolve(unitId, { level, rank, baseLevel: level, initializeEncounter: options.initializeEncounter !== false });
      catalogResolved = true;
    }
    const material = resolved ? {
      ...source,
      ...clone(resolved),
      visual: { ...(clone(resolved.visual) || {}), ...(clone(source.visual) || {}) },
      metadata: { ...(clone(resolved.metadata) || {}), ...(clone(source.metadata) || {}) },
      mechanics: { ...(clone(resolved.mechanics) || {}), ...(clone(source.mechanics) || {}) }
    } : source;

    const creatureTypes = global.LuminousCreatureTypeCatalog || safeRequire('./creature-type-catalog.js');
    if (creatureTypes?.decorateUnit) {
      try { creatureTypes.decorateUnit(material, { mutate: true, required: false }); } catch (_) {}
    }
    return { material, catalogResolved };
  }

  function speedRangeFor(record = {}) {
    return parseRange(record.speedRange) ||
      ((finite(record.speedMin, null) != null || finite(record.speedMax, null) != null)
        ? [finite(record.speedMin, finite(record.speedMax, 1)), finite(record.speedMax, finite(record.speedMin, 6))]
        : null) ||
      parseRange(record.mechanics?.speedRange) || parseRange(record.mechanics?.speed) || parseRange(record.speed);
  }

  function normalizeDefinition(unitId, definition = {}, options = {}) {
    const { material, catalogResolved } = resolveDefinition(unitId, definition, options);
    const maxHp = Math.max(1, firstNumber(material, [
      'maxHp', 'maxHP', 'hpMax', 'hp_max', 'mechanics.maxHp', 'mechanics.hp', 'combatStats.hp_max', 'hp'
    ], 1) || 1);
    const hp = Math.max(0, firstNumber(material, ['hp', 'currentHp', 'currentHP', 'hp_actual', 'combatStats.hp_actual'], maxHp) ?? maxHp);
    const sp = firstNumber(material, ['sp', 'currentSp', 'currentSP', 'sp_actual', 'mechanics.sp', 'combatStats.sp_actual'], 0) || 0;
    const skills = skillIdsFor(material);
    const actionSlots = actionSlotsFor(material);
    let speedRange = speedRangeFor(material);
    let speedFallback = false;
    if (!speedRange) {
      speedRange = [1, 6];
      speedFallback = true;
    }
    speedRange = [Math.trunc(Math.min(...speedRange)), Math.trunc(Math.max(...speedRange))];
    const sprite = spriteFor(material);
    const scale = firstNumber(material, ['visualScale', 'scale', 'combatScale', 'combatVisual.scale', 'visual.scale'], 1) || 1;
    const spriteX = firstNumber(material, ['spriteX', 'combatSpriteX', 'combatVisual.x', 'visual.spriteX'], 0) || 0;
    const spriteY = firstNumber(material, ['spriteY', 'combatSpriteY', 'combatVisual.y', 'visual.spriteY'], 0) || 0;
    const level = levelFor(material, 1);
    const rank = rankFor(material);
    return {
      ...clone(material),
      id: clean(material.id || unitId) || unitId,
      hp,
      maxHp,
      sp,
      level,
      rank,
      speedRange,
      speedMin: speedRange[0],
      speedMax: speedRange[1],
      actionSlots,
      activeSlots: actionSlots,
      actionSlotIndex: Object.fromEntries(Array.from({ length: actionSlots }, (_, index) => [String(index), true])),
      skillIds: skills,
      skillSlotIds: skills,
      action_slots: skills,
      equippedSkillIndex: Object.fromEntries(skills.map((id) => [id, true])),
      combatSprite: sprite || null,
      sprite_combate: sprite || null,
      tokenImage: sprite || null,
      img: sprite || null,
      spriteX,
      spriteY,
      scale,
      visualScale: scale,
      combatVisual: { ...(clone(material.combatVisual) || {}), spriteUrl: sprite || null, x: spriteX, y: spriteY, scale },
      runtimeDiagnostics: {
        ...(clone(material.runtimeDiagnostics) || {}),
        unitInstantiationVersion: 1,
        catalogResolved,
        speedFallback,
        missingSprite: !sprite,
        missingSkills: skills.length === 0
      }
    };
  }

  function instantiate(unitId, definition = {}, options = {}) {
    const normalized = normalizeDefinition(unitId, definition, options);
    const faction = options.faction === 'ally' ? 'ally' : 'enemy';
    const serial = clean(options.serial || Date.now().toString(36));
    const combatId = clean(options.combatId) || `${faction}:unit:${safe(unitId)}:${serial}`;
    return {
      ...normalized,
      id: combatId,
      combatId,
      libraryUnitId: unitId,
      unitRef: { scope: 'units', id: unitId },
      canonicalScope: 'unit',
      category: faction,
      actorCategory: faction,
      faction,
      faccion: faction,
      isPlayer: false,
      battleActive: true,
      deploymentState: 'field',
      statusEffects: clone(normalized.statusEffects || {}),
      entrySource: 'unit_combat_instantiator_v1',
      enteredCombatAt: Date.now()
    };
  }

  function diagnostics(unitId, definition = {}, options = {}) {
    const normalized = normalizeDefinition(unitId, definition, options);
    return clone(normalized.runtimeDiagnostics);
  }

  const api = Object.freeze({
    version: '1.0.0',
    parseRange,
    spriteFor,
    skillIdsFor,
    actionSlotsFor,
    catalogFor,
    resolveDefinition,
    normalizeDefinition,
    instantiate,
    diagnostics
  });

  global.LuminousUnitCombatInstantiator = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
