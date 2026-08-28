(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.LuminousRacialSenseRuntime = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  const DEFAULT_DARKVISION_FT = 60;
  const STANDARD_DARKVISION_RACES = Object.freeze([
    'dwarf', 'elf', 'gnome', 'half_elf', 'half_orc', 'orc',
    'kobold', 'goblin', 'fairy', 'aasimar', 'tiefling', 'felinae',
    'half_dragon', 'lupae', 'moonfae', 'yuan_ti_pureblood', 'undae', 'elnae',
  ]);
  const STANDARD_SET = new Set(STANDARD_DARKVISION_RACES);
  const SUPERIOR_DARKVISION = Object.freeze({
    'dwarf:duergar': 120,
    'elf:drow': 120,
  });

  const cleanId = (value) => String(value ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  const finiteNonNegative = (value, fallback = 0) => {
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(0, number) : fallback;
  };

  function buildFromCharacter(character = {}) {
    return character.characterBuild
      || character.build
      || character.character_build
      || character;
  }

  function resolveRacialSenses(build = {}) {
    const raceId = cleanId(build.raceId || build.race || build.razaId || build.raza);
    const subtypeId = cleanId(build.raceSubtypeId || build.subraceId || build.subtypeId || build.subrazaId);
    const superior = SUPERIOR_DARKVISION[`${raceId}:${subtypeId}`] || 0;
    const darkvisionFt = superior || (STANDARD_SET.has(raceId) ? DEFAULT_DARKVISION_FT : 0);
    return Object.freeze({
      raceId: raceId || null,
      raceSubtypeId: subtypeId || null,
      darkvisionFt,
      darkvisionMonochrome: darkvisionFt > 0,
      dimAsBright: darkvisionFt > 0,
      darknessAsDim: darkvisionFt > 0,
      source: darkvisionFt > 0 ? 'racial' : null,
    });
  }

  function resolveCharacterSenses(character = {}) {
    const racial = resolveRacialSenses(buildFromCharacter(character));
    const explicit = character.senses || character.vision || {};
    const explicitDarkvision = finiteNonNegative(explicit.darkvisionFt ?? explicit.darkvision_ft, 0);
    const darkvisionFt = Math.max(racial.darkvisionFt, explicitDarkvision);
    return Object.freeze({
      ...racial,
      darkvisionFt,
      darkvisionMonochrome: darkvisionFt > 0,
      dimAsBright: darkvisionFt > 0,
      darknessAsDim: darkvisionFt > 0,
      source: explicitDarkvision > racial.darkvisionFt ? 'character_override' : racial.source,
    });
  }

  function perceptionForLightLevel(lightLevel, senses = {}, distanceFt = 0) {
    const level = cleanId(lightLevel || 'bright');
    const distance = finiteNonNegative(distanceFt, 0);
    const darkvisionFt = finiteNonNegative(senses.darkvisionFt, 0);
    const inDarkvision = darkvisionFt > 0 && distance <= darkvisionFt;

    if (level === 'bright') {
      return Object.freeze({ visible: true, perceivedLight: 'bright', mode: 'normal', monochrome: false });
    }
    if (level === 'dim') {
      return Object.freeze({
        visible: true,
        perceivedLight: inDarkvision && senses.dimAsBright !== false ? 'bright' : 'dim',
        mode: inDarkvision ? 'darkvision_dim' : 'normal_dim',
        monochrome: false,
      });
    }
    if (level === 'darkness') {
      if (!inDarkvision || senses.darknessAsDim === false) {
        return Object.freeze({ visible: false, perceivedLight: 'darkness', mode: 'none', monochrome: false });
      }
      return Object.freeze({
        visible: true,
        perceivedLight: 'dim',
        mode: 'darkvision',
        monochrome: senses.darkvisionMonochrome !== false,
      });
    }
    return Object.freeze({ visible: true, perceivedLight: level || 'bright', mode: 'normal', monochrome: false });
  }

  return Object.freeze({
    DEFAULT_DARKVISION_FT,
    STANDARD_DARKVISION_RACES,
    SUPERIOR_DARKVISION,
    buildFromCharacter,
    resolveRacialSenses,
    resolveCharacterSenses,
    perceptionForLightLevel,
  });
});