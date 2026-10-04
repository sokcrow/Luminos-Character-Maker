(function (global) {
  "use strict";

  if (global.LuminousDmPlayerLoadoutCore) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousDmPlayerLoadoutCore;
    return;
  }

  const VERSION = "0.1.0";
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
    const combat = normalizeSpellIds(combatSpellIds);
    const role = normalizeSpellIds(roleSpellIds);
    const index = Object.fromEntries(combat.map((id) => [id, true]));
    return {
      "spellIds": combat,
      "spellSelections": combat,
      "spellSelectionIndex": index,
      "roleSpellSelections": role,
      "characterBuild/spellIds": combat,
      "characterBuild/spellSelections": combat,
      "characterBuild/spellSelectionIndex": index,
      "characterBuild/roleSpellSelections": role,
      "characterBuild/spellLoadoutSource": source,
    };
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
    normalizeClassIds,
    spellAllowedClassIds,
    spellCompatibleWithPlayer,
    normalizeSpellIds,
    buildSkillDeckUpdates,
    buildSpellUpdates,
    deckFromPlayer,
  });

  global.LuminousDmPlayerLoadoutCore = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
