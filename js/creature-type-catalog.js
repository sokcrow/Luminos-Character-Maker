(function (global) {
  'use strict';

  const normalizeToken = (value) => String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

  const TYPE_DEFINITIONS = Object.freeze({
    aberration: Object.freeze({ id: 'aberration', name: 'Aberration', labelEs: 'Aberración' }),
    beast: Object.freeze({ id: 'beast', name: 'Beast', labelEs: 'Bestia' }),
    celestial: Object.freeze({ id: 'celestial', name: 'Celestial', labelEs: 'Celestial' }),
    construct: Object.freeze({ id: 'construct', name: 'Construct', labelEs: 'Constructo' }),
    dragon: Object.freeze({ id: 'dragon', name: 'Dragon', labelEs: 'Dragón' }),
    elemental: Object.freeze({ id: 'elemental', name: 'Elemental', labelEs: 'Elemental' }),
    fey: Object.freeze({ id: 'fey', name: 'Fey', labelEs: 'Feérico' }),
    fiend: Object.freeze({ id: 'fiend', name: 'Fiend', labelEs: 'Infernal' }),
    giant: Object.freeze({ id: 'giant', name: 'Giant', labelEs: 'Gigante' }),
    humanoid: Object.freeze({ id: 'humanoid', name: 'Humanoid', labelEs: 'Humanoide' }),
    monstrosity: Object.freeze({ id: 'monstrosity', name: 'Monstrosity', labelEs: 'Monstruosidad' }),
    ooze: Object.freeze({ id: 'ooze', name: 'Ooze', labelEs: 'Cieno' }),
    plant: Object.freeze({ id: 'plant', name: 'Plant', labelEs: 'Planta' }),
    undead: Object.freeze({ id: 'undead', name: 'Undead', labelEs: 'No-muerto' }),
  });

  const CREATURE_TYPES = Object.freeze(Object.keys(TYPE_DEFINITIONS));
  const TYPE_SET = new Set(CREATURE_TYPES);

  const TYPE_ALIASES = Object.freeze({
    aberrations: 'aberration',
    beasts: 'beast',
    celestials: 'celestial',
    constructs: 'construct',
    dragons: 'dragon',
    elementals: 'elemental',
    feys: 'fey',
    fiends: 'fiend',
    giants: 'giant',
    humanoids: 'humanoid',
    monstrosities: 'monstrosity',
    oozes: 'ooze',
    plants: 'plant',
    undeads: 'undead',
  });

  const SPECIES_DEFAULTS = Object.freeze({
    wolf: Object.freeze({ creatureType: 'beast', creatureSubtypes: Object.freeze([]) }),
    dire_wolf: Object.freeze({ creatureType: 'beast', creatureSubtypes: Object.freeze([]) }),
    goblin: Object.freeze({ creatureType: 'humanoid', creatureSubtypes: Object.freeze(['goblinoid']) }),
    kobold: Object.freeze({ creatureType: 'humanoid', creatureSubtypes: Object.freeze(['kobold']) }),
  });

  const asArray = (value) => value == null ? [] : (Array.isArray(value) ? value : [value]);

  function normalizeCreatureType(value) {
    const token = normalizeToken(value);
    if (!token) return '';
    const id = TYPE_ALIASES[token] || token;
    return TYPE_SET.has(id) ? id : '';
  }

  function isValidCreatureType(value) {
    return Boolean(normalizeCreatureType(value));
  }

  function assertCreatureType(value) {
    const id = normalizeCreatureType(value);
    if (!id) throw new Error(`UNKNOWN_CREATURE_TYPE:${String(value ?? '')}`);
    return id;
  }

  function normalizeCreatureSubtypes(value) {
    return [...new Set(asArray(value).map(normalizeToken).filter(Boolean))];
  }

  function speciesId(unit = {}) {
    return normalizeToken(unit.species ?? unit.raceId ?? unit.race ?? unit.metadata?.species);
  }

  function defaultProfileForSpecies(species) {
    const key = normalizeToken(species);
    const profile = SPECIES_DEFAULTS[key];
    if (!profile) return null;
    return {
      creatureType: profile.creatureType,
      creatureSubtypes: [...profile.creatureSubtypes],
      inferredFromSpecies: true,
    };
  }

  function profileForUnit(unit = {}, options = {}) {
    const explicitRaw = unit.creatureType ?? unit.metadata?.creatureType;
    const explicitType = normalizeCreatureType(explicitRaw);
    if (explicitRaw != null && !explicitType) {
      if (options.allowUnknown === true) return null;
      throw new Error(`UNKNOWN_CREATURE_TYPE:${String(explicitRaw)}`);
    }

    const fallback = options.allowSpeciesDefault === false ? null : defaultProfileForSpecies(speciesId(unit));
    const creatureType = explicitType || fallback?.creatureType || '';
    if (!creatureType) {
      if (options.required === true) throw new Error(`CREATURE_TYPE_REQUIRED:${String((unit.id ?? unit.name ?? speciesId(unit)) || 'unit')}`);
      return null;
    }

    const explicitSubtypes = normalizeCreatureSubtypes(unit.creatureSubtypes ?? unit.metadata?.creatureSubtypes);
    const creatureSubtypes = explicitSubtypes.length ? explicitSubtypes : (fallback?.creatureSubtypes || []);
    return {
      creatureType,
      creatureSubtypes: [...creatureSubtypes],
      inferredFromSpecies: !explicitType && Boolean(fallback),
    };
  }

  function creatureTypeOf(unit = {}, options = {}) {
    return profileForUnit(unit, options)?.creatureType || '';
  }

  function creatureSubtypesOf(unit = {}, options = {}) {
    return profileForUnit(unit, options)?.creatureSubtypes || [];
  }

  function decorateUnit(unit, options = {}) {
    if (!unit || typeof unit !== 'object') throw new Error('CREATURE_TYPE_UNIT_REQUIRED');
    const profile = profileForUnit(unit, { ...options, required: true });
    const target = options.mutate === false ? { ...unit } : unit;
    target.creatureType = profile.creatureType;
    target.creatureSubtypes = [...profile.creatureSubtypes];
    return target;
  }

  function normalizeRuleTypes(value) {
    return [...new Set(asArray(value).map(assertCreatureType))];
  }

  function normalizeRuleSubtypes(value) {
    return normalizeCreatureSubtypes(value);
  }

  function matchesTargetRule(unit = {}, rule = {}) {
    const profile = profileForUnit(unit, { required: false });
    const allowedTypes = normalizeRuleTypes(rule.allowedCreatureTypes ?? rule.creatureTypes ?? []);
    const excludedTypes = normalizeRuleTypes(rule.excludedCreatureTypes ?? []);
    const allowedSubtypes = normalizeRuleSubtypes(rule.allowedCreatureSubtypes ?? []);
    const excludedSubtypes = normalizeRuleSubtypes(rule.excludedCreatureSubtypes ?? []);

    const hasRestrictions = allowedTypes.length || excludedTypes.length || allowedSubtypes.length || excludedSubtypes.length;
    if (!hasRestrictions) return true;
    if (!profile) return false;

    if (allowedTypes.length && !allowedTypes.includes(profile.creatureType)) return false;
    if (excludedTypes.includes(profile.creatureType)) return false;

    const subtypeSet = new Set(profile.creatureSubtypes);
    if (allowedSubtypes.length && !allowedSubtypes.some((id) => subtypeSet.has(id))) return false;
    if (excludedSubtypes.some((id) => subtypeSet.has(id))) return false;
    return true;
  }

  function validateUnitCreatureType(unit = {}, options = {}) {
    try {
      const profile = profileForUnit(unit, { ...options, required: true });
      return { valid: true, errors: [], profile };
    } catch (error) {
      return { valid: false, errors: [String(error?.message || error)], profile: null };
    }
  }

  function get(id) {
    const normalized = normalizeCreatureType(id);
    return normalized ? { ...TYPE_DEFINITIONS[normalized] } : null;
  }

  function list() {
    return CREATURE_TYPES.map((id) => ({ ...TYPE_DEFINITIONS[id] }));
  }

  const api = Object.freeze({
    version: '1.0.0',
    TYPE_DEFINITIONS,
    CREATURE_TYPES,
    SPECIES_DEFAULTS,
    normalizeCreatureType,
    isValidCreatureType,
    assertCreatureType,
    normalizeCreatureSubtypes,
    defaultProfileForSpecies,
    profileForUnit,
    creatureTypeOf,
    creatureSubtypesOf,
    decorateUnit,
    matchesTargetRule,
    validateUnitCreatureType,
    get,
    list,
  });

  global.LuminousCreatureTypeCatalog = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
