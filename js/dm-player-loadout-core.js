(function (global) {
  "use strict";

  if (global.LuminousDmPlayerLoadoutCore) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousDmPlayerLoadoutCore;
    return;
  }

  const VERSION = "0.1.2";
  const TIER_COPIES = Object.freeze({ 1: 3, 2: 2, 3: 1 });
  const clean = (value) => String(value ?? "").trim();
  const normalizeId = (value) => clean(value).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));

  function normalizeDeck(value = {}) {
    const source = value && typeof value === "object" ? value : {};
    return {
      tier1: normalizeId(source.tier1 ?? source.t1 ?? source["1"] ?? source.skill1),
      tier2: normalizeId(source.tier2 ?? source.t2 ?? source["2"] ?? source.skill2),
      tier3: normalizeId(source.tier3 ?? source.t3 ?? source["3"] ?? source.skill3),
    };
  }

  function expandDeck(value = {}) {
    const deck = normalizeDeck(value);
    const out = [];
    [1, 2, 3].forEach((tier) => {
      const id = deck[`tier${tier}`];
      for (let index = 0; id && index < TIER_COPIES[tier]; index += 1) out.push(id);
    });
    return out;
  }

  function uniqueDeckSkillIds(value = {}) {
    return [...new Set(expandDeck(value))];
  }

  function equippedSkillIndex(value = {}) {
    return Object.fromEntries(uniqueDeckSkillIds(value).map((id) => [id, true]));
  }

  function normalizedSkillLibrary(library = {}) {
    return Object.fromEntries(Object.entries(library || {}).map(([key, raw]) => {
      const id = normalizeId(raw?.id || key);
      return [id, { ...(clone(raw) || {}), id }];
    }).filter(([id]) => id));
  }

  function skillTier(skill = {}) {
    const tier = Number.parseInt(skill?.tier ?? skill?.skillTier ?? skill?.metadata?.tier, 10);
    return Number.isFinite(tier) ? tier : 0;
  }

  function validateDeck(value = {}, library = {}) {
    const deck = normalizeDeck(value);
    const skills = normalizedSkillLibrary(library);
    const errors = [];
    [1, 2, 3].forEach((tier) => {
      const id = deck[`tier${tier}`];
      if (!id) {
        errors.push(`Falta la Skill Tier ${tier}.`);
        return;
      }
      const skill = skills[id];
      if (!skill) {
        errors.push(`No existe la Skill ${id}.`);
        return;
      }
      if (skillTier(skill) !== tier) errors.push(`${skill.name || id} es Tier ${skillTier(skill) || "?"}, no Tier ${tier}.`);
    });
    return {
      valid: errors.length === 0,
      errors,
      deck,
      skillSlotIds: expandDeck(deck),
      skillIds: uniqueDeckSkillIds(deck),
      equippedSkillIndex: equippedSkillIndex(deck),
    };
  }

  function humanizeId(value) {
    return normalizeId(value)
      .split("_")
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  }

  function signaturePresets(catalog = {}) {
    const definitions = catalog?.DEFINITIONS || catalog?.definitions || {};
    const groups = new Map();
    Object.entries(definitions).forEach(([key, raw]) => {
      const id = normalizeId(raw?.id || key);
      const ownerId = normalizeId(raw?.metadata?.ownerCharacterId || raw?.ownerCharacterId);
      const tier = skillTier(raw);
      if (!id || !ownerId || ![1, 2, 3].includes(tier)) return;
      if (raw?.inDeck === false || Number(raw?.metadata?.deckCopies) === 0 || raw?.metadata?.evolvedSignatureSkill === true) return;
      if (!groups.has(ownerId)) {
        groups.set(ownerId, {
          id: ownerId,
          label: clean(raw?.metadata?.ownerCharacterName || raw?.metadata?.ownerLabel) || humanizeId(ownerId),
          deck: { tier1: "", tier2: "", tier3: "" },
        });
      }
      const preset = groups.get(ownerId);
      preset.deck[`tier${tier}`] = id;
    });
    return [...groups.values()]
      .filter((entry) => entry.deck.tier1 && entry.deck.tier2 && entry.deck.tier3)
      .sort((a, b) => a.label.localeCompare(b.label));
  }

  // Live presets use existing campaign records, never a copied Skill catalog.
  function eligiblePresetSkill(skill = {}) {
    if (skill?.inDeck === false || skill?.in_deck === false || skill?.deck?.enabled === false ||
        skill?.isDefense === true || skill?.isItemSkill === true || skill?.metadata?.evolvedSignatureSkill === true) return false;
    const availability = clean(skill?.availability?.type || skill?.availabilityType || "").toLowerCase();
    if (["off_deck", "offdeck", "defense", "defensive", "granted", "free"].includes(availability)) return false;
    if (clean(skill?.type).toLowerCase() === "defense") return false;
    const copies = skill?.metadata?.deckCopies ?? skill?.deckCopies;
    return copies == null || Number(copies) !== 0;
  }

  function playerCharacterName(player = {}, playerId = "") {
    return clean(player.characterName || player.character_name || player.nombre ||
      player.characterIdentity?.name || player.name) || humanizeId(playerId);
  }

  function ownerForSavedSkill(raw, knownPlayers) {
    const meta = raw?.metadata || {};
    const declaredId = normalizeId(meta.ownerCharacterId || raw?.ownerCharacterId ||
      meta.characterId || raw?.characterId);
    const declaredName = clean(meta.ownerCharacterName || raw?.ownerCharacterName || meta.ownerLabel);
    if (declaredId || declaredName) {
      return { id: declaredId || normalizeId(declaredName),
        label: declaredName || knownPlayers.find((p) => p.slug === declaredId)?.label || humanizeId(declaredId) };
    }
    // A legacy Skill may have no owner metadata; match only a real campaign
    // character's name as a complete leading token, not a substring.
    const tokens = [raw?.id, raw?.name, raw?.sourceId].map(normalizeId);
    return knownPlayers.find((p) => tokens.some((token) => token === p.slug || token.startsWith(p.slug + "_"))) || null;
  }

  function databaseSkillPresets(savedSkills = {}, players = {}, library = savedSkills) {
    const knownPlayers = Object.entries(players || {})
      .filter(([, player]) => player && typeof player === "object")
      .map(([playerId, player]) => {
        const label = playerCharacterName(player, playerId);
        return { id: normalizeId(playerId), slug: normalizeId(label), label };
      })
      .filter((p) => p.slug.length >= 3)
      .sort((a, b) => b.slug.length - a.slug.length);
    const groups = new Map();
    Object.entries(savedSkills || {}).sort(([a], [b]) => a.localeCompare(b)).forEach(([key, raw]) => {
      if (!raw || typeof raw !== "object" || !eligiblePresetSkill(raw)) return;
      const id = normalizeId(raw.id || key);
      const tier = skillTier(raw);
      const owner = ownerForSavedSkill(raw, knownPlayers);
      if (!id || !owner?.id || ![1, 2, 3].includes(tier)) return;
      if (!groups.has(owner.id)) groups.set(owner.id, {
        id: "library_" + owner.id, label: owner.label, source: "library",
        deck: { tier1: "", tier2: "", tier3: "" },
      });
      const preset = groups.get(owner.id);
      if (!preset.deck["tier" + tier]) preset.deck["tier" + tier] = id;
    });
    return [...groups.values()]
      .filter((entry) => validateDeck(entry.deck, library).valid)
      .sort((a, b) => a.label.localeCompare(b.label, "es"));
  }

  function playerDeckPresets(players = {}, library = {}) {
    const out = [];
    Object.entries(players || {}).forEach(([playerId, player]) => {
      if (!player || typeof player !== "object") return;
      const label = playerCharacterName(player, playerId);
      const saved = player.characterBuild?.skillDeckPresets || player.skillDeckPresets || [];
      const savedRows = Array.isArray(saved) ? saved : Object.values(saved || {});
      const candidates = [{ name: label, deck: deckFromPlayer(player, library) },
        ...savedRows.map((row, index) => ({
          name: label + " · " + (clean(row?.name) || "Deck " + (index + 1)),
          deck: row,
        }))];
      const seen = new Set();
      candidates.forEach((candidate, index) => {
        const validated = validateDeck(candidate.deck, library);
        if (!validated.valid) return;
        const signature = JSON.stringify(validated.deck);
        if (seen.has(signature)) return;
        seen.add(signature);
        out.push({
          id: "player_" + normalizeId(playerId) + "_" + index,
          label: candidate.name,
          source: "player", deck: validated.deck,
        });
      });
    });
    return out.sort((a, b) => a.label.localeCompare(b.label, "es"));
  }

  // Presets are derived from the *same* item definitions used by Combat
  // Master. We intentionally do not copy or maintain a second list of Decks.
  function equipmentDeckPresets(catalog = {}, skillCatalog = {}) {
    const items = Array.isArray(catalog?.ITEMS) ? catalog.ITEMS :
      typeof catalog?.list === "function" ? catalog.list() : [];
    const skills = skillCatalog?.DEFINITIONS || skillCatalog?.definitions || skillCatalog || {};
    const hasLibrary = Object.keys(skills).length > 0;
    const presets = [];
    for (const item of items) {
      const definitionId = normalizeId(item?.definitionId || item?.id);
      const loadouts = item?.runtime?.buildLoadouts?.modes;
      if (!definitionId || !loadouts || typeof loadouts !== "object") continue;
      for (const [rawModeId, mode] of Object.entries(loadouts)) {
        const modeId = normalizeId(rawModeId);
        const deck = normalizeDeck(mode?.deck || {});
        if (!modeId || ![deck.tier1, deck.tier2, deck.tier3].every(Boolean)) continue;
        if (hasLibrary && !validateDeck(deck, skills).valid) continue;
        const itemLabel = clean(item?.displayName || item?.name || item?.nombre) || humanizeId(definitionId);
        presets.push({
          id: `equipment_${definitionId}_${modeId}`,
          label: `${itemLabel} · ${clean(mode?.name) || humanizeId(modeId)}`,
          source: "equipment",
          definitionId,
          modeId,
          deck,
        });
      }
    }
    return presets.sort((a, b) => a.label.localeCompare(b.label, "es"));
  }

  function normalizeClassIds(player = {}) {
    const source = player?.characterBuild?.classes || player?.classes || player?.classLevels || [];
    const rows = Array.isArray(source)
      ? source
      : Object.entries(source || {}).map(([classId, value]) => typeof value === "object" ? { classId, ...value } : { classId, levels: value });
    return [...new Set(rows.map((entry) => normalizeId(entry?.classId || entry?.id || entry?.name)).filter(Boolean))];
  }

  function spellAllowedClassIds(spell = {}) {
    const ids = new Set();
    const add = (value) => {
      const id = normalizeId(value?.classId || value?.id || value);
      if (id) ids.add(id);
    };
    add(spell.sourceClassId || spell.classId || spell.class_id);
    [spell.classIds, spell.classes, spell.allowedClasses, spell.allowedClassIds]
      .forEach((list) => (Array.isArray(list) ? list : []).forEach(add));
    return [...ids];
  }

  function spellCompatibleWithPlayer(spell = {}, player = {}) {
    const allowed = spellAllowedClassIds(spell);
    if (!allowed.length) return true;
    const owned = new Set(normalizeClassIds(player));
    return allowed.some((id) => owned.has(id));
  }

  function normalizeSpellIds(values = []) {
    return [...new Set((Array.isArray(values) ? values : [])
      .map((entry) => normalizeId(entry?.spellId || entry?.id || entry))
      .filter(Boolean))].sort();
  }

  function buildSkillDeckUpdates(deckValue = {}, library = {}, source = "dm_loadout_manager") {
    const validation = validateDeck(deckValue, library);
    if (!validation.valid) return { valid: false, errors: validation.errors, updates: {} };
    const deck = { ...validation.deck, schemaVersion: 1 };
    return {
      valid: true,
      errors: [],
      validation,
      updates: {
        "skillDeck": deck,
        "skillSlotIds": validation.skillSlotIds,
        "skillIds": validation.skillIds,
        "equippedSkillIndex": validation.equippedSkillIndex,
        "characterBuild/skillDeck": deck,
        "characterBuild/skillSlotIds": validation.skillSlotIds,
        "characterBuild/skillIds": validation.skillIds,
        "characterBuild/equippedSkillIndex": validation.equippedSkillIndex,
        "characterBuild/skillLoadoutSource": source,
      },
    };
  }

  function buildSpellUpdates(combatSpellIds = [], roleSpellIds = [], source = "dm_loadout_manager") {
    if (!global.LuminousSpellLoadout) throw new Error("Spell assignments are still loading.");
    return global.LuminousSpellLoadout.buildUpdates([...combatSpellIds, ...roleSpellIds], source);
  }

  function deckFromPlayer(player = {}, library = {}) {
    const direct = player?.characterBuild?.skillDeck || player?.skillDeck;
    const normalized = normalizeDeck(direct);
    if (normalized.tier1 || normalized.tier2 || normalized.tier3) return normalized;

    const ids = player?.characterBuild?.skillSlotIds || player?.skillSlotIds || player?.characterBuild?.skillIds || player?.skillIds || [];
    const skills = normalizedSkillLibrary(library);
    const deck = { tier1: "", tier2: "", tier3: "" };
    (Array.isArray(ids) ? ids : Object.values(ids || {})).forEach((value) => {
      const id = normalizeId(value);
      const tier = skillTier(skills[id] || {});
      if ([1, 2, 3].includes(tier) && !deck[`tier${tier}`]) deck[`tier${tier}`] = id;
    });
    return deck;
  }

  // Resolve exactly one deployed Player using canonical identity, never by display name.
  // This is separate from the Unit Library: an active Encounter owns a snapshot.
  function activeCombatantForPlayer(playerId, combatants = {}, ownerUid = "") {
    const wanted = clean(playerId);
    const uid = clean(ownerUid);
    if (!wanted) return { ok: false, reason: "PLAYER_NOT_SELECTED", key: null };
    const matches = Object.entries(combatants || {}).filter(([key, unit]) => {
      if (!unit || typeof unit !== "object") return false;
      const isPlayer = unit.isPlayer === true || clean(unit.actorCategory || unit.category || unit.type).toLowerCase() === "player" ||
        clean(unit.canonicalScope).toLowerCase() === "player";
      if (!isPlayer) return false;
      const identities = [unit.canonicalPlayerKey, unit.ownerPlayerId, unit.playerId, unit.characterLink?.playerId, unit.actorRef?.scope === "players" ? unit.actorRef?.id : null];
      if (!identities.map(clean).includes(wanted)) return false;
      const combatOwnerUid = clean(unit.canonicalOwnerUid || unit.ownerUid || unit.characterLink?.uid);
      return !(uid && combatOwnerUid && uid !== combatOwnerUid);
    });
    if (matches.length > 1) return { ok: false, reason: "AMBIGUOUS_ACTIVE_COMBATANTS", key: null };
    if (!matches.length) return { ok: false, reason: "NOT_DEPLOYED", key: null };
    return { ok: true, reason: null, key: matches[0][0] };
  }

  const api = Object.freeze({
    VERSION,
    TIER_COPIES,
    normalizeId,
    normalizeDeck,
    expandDeck,
    uniqueDeckSkillIds,
    equippedSkillIndex,
    normalizedSkillLibrary,
    skillTier,
    validateDeck,
    signaturePresets,
    databaseSkillPresets,
    playerDeckPresets,
    equipmentDeckPresets,
    normalizeClassIds,
    spellAllowedClassIds,
    spellCompatibleWithPlayer,
    normalizeSpellIds,
    buildSkillDeckUpdates,
    buildSpellUpdates,
    deckFromPlayer,
    activeCombatantForPlayer,
  });

  global.LuminousDmPlayerLoadoutCore = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
