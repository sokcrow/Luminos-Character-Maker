const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

(async () => {
  delete globalThis.LuminousItemHarvestIntegrityEngine;
  await import(pathToFileURL(path.resolve(__dirname, '../js/item-harvest-integrity-engine.js')).href);
  const harvest = globalThis.LuminousItemHarvestIntegrityEngine;

  assert.ok(harvest);
  assert.equal(harvest.VERSION, 1);
  assert.equal(harvest.canonicalPhysicalDamageType('cortante'), 'slashing');
  assert.equal(harvest.canonicalPhysicalDamageType('perforante'), 'piercing');
  assert.equal(harvest.canonicalPhysicalDamageType('contundente'), 'bludgeoning');

  const record = harvest.createDamageRecord();

  harvest.recordEvent(record, {
    sourceType: 'weapon',
    damageType: 'cortante',
    damageDealt: 18,
    sinAffinity: 'pride',
  });
  assert.equal(record.totalDirectHits, 1);
  assert.equal(record.physical.slashing.hits, 1);
  assert.equal(record.physical.slashing.damage, 18);
  assert.equal(record.magic.manaCorruption, 0);

  harvest.recordEvent(record, {
    sourceType: 'spell',
    canonicalSpell: true,
    damageType: 'perforante',
    damageDealt: 20,
    sinAffinity: 'wrath',
    effects: [{ type: 'status', status: 'burn' }],
  });
  assert.equal(record.totalDirectHits, 2);
  assert.equal(record.physical.piercing.hits, 0, 'spell combat damageType must not become anatomical piercing');
  assert.equal(record.magic.hits, 1);
  assert.equal(record.magic.damage, 20);
  assert.equal(record.magic.manaCorruption, 20);
  assert.equal(record.magic.sinAffinities.wrath, 20);
  assert.equal(record.exposure.burn, 20);
  assert.equal(record.exposure.heat, 20);

  harvest.recordEvent(record, {
    sourceType: 'status',
    statusTick: true,
    status: 'bleed',
    damageMode: 'fixed',
    damageType: 'directo',
    damageDealt: 7,
  });
  assert.equal(record.totalDirectHits, 2, 'status/fixed ticks are not new direct hits');
  assert.equal(record.physical.slashing.hits, 1, 'bleed must not duplicate slashing trauma');
  assert.equal(record.exposure.blood_loss, 7);

  harvest.recordEvent(record, {
    sourceType: 'status',
    statusTick: true,
    status: 'rupture',
    damageMode: 'fixed',
    damageDealt: 9,
  });
  assert.equal(record.totalDirectHits, 2);
  assert.equal(record.physical.piercing.hits, 0, 'rupture must not invent piercing trauma');

  harvest.recordEvent(record, {
    sourceType: 'weapon',
    damageType: 'contundente',
    damageDealt: 16,
  });
  assert.equal(record.physical.bludgeoning.hits, 1);
  assert.equal(record.physical.bludgeoning.damage, 16);

  harvest.recordEvent(record, {
    sourceType: 'status',
    statusTick: true,
    status: 'poison',
    damageMode: 'fixed',
    damageDealt: 3,
  });
  assert.equal(record.exposure.contamination, 3);

  const pelt = harvest.harvestCondition(record, 'hide_pelt');
  assert.equal(pelt.directHitSensitive, true);
  assert.equal(pelt.totalDirectHits, 3);
  assert.equal(pelt.physical.slashing.primary, true);
  assert.equal(pelt.physical.slashing.damage, 18);
  assert.equal(pelt.manaCorruption, 20);
  assert.equal(pelt.exposures.burn, 20);

  const hard = harvest.harvestCondition(record, 'hard_parts');
  assert.equal(hard.directHitSensitive, false);
  assert.equal(hard.physical.bludgeoning.primary, true);
  assert.equal(hard.physical.bludgeoning.damage, 16);
  assert.equal(hard.manaCorruption, 20);

  const modularCover = harvest.harvestCondition(record, 'hard_cover_modular');
  assert.equal(modularCover.physical.bludgeoning.primary, true);
  assert.equal(modularCover.physical.bludgeoning.damage, 16);
  assert.equal(modularCover.physical.slashing.primary, false);
  assert.equal(modularCover.physical.slashing.damage, 18);
  assert.equal(modularCover.exposures.burn, 20);
  assert.equal(modularCover.exposures.mana_corruption, 20);

  const structuralCover = harvest.harvestCondition(record, 'hard_cover_structural');
  assert.equal(structuralCover.physical.bludgeoning.primary, true);
  assert.equal(structuralCover.physical.bludgeoning.damage, 16);
  assert.equal(structuralCover.physical.slashing, undefined);
  assert.equal(structuralCover.exposures.burn, 20);

  const feather = harvest.harvestCondition(record, 'feather_raw');
  assert.equal(feather.directHitSensitive, true);
  assert.equal(feather.physical.slashing.primary, true);
  assert.equal(feather.physical.slashing.damage, 18);
  assert.equal(feather.physical.bludgeoning.primary, false);
  assert.equal(feather.physical.bludgeoning.damage, 16);
  assert.equal(feather.exposures.burn, 20);
  assert.equal(feather.exposures.contamination, 3);

  const fiber = harvest.harvestCondition(record, 'raw_fiber');
  assert.equal(fiber.directHitSensitive, true);
  assert.equal(fiber.physical.slashing.primary, true);
  assert.equal(fiber.physical.piercing.primary, false);
  assert.equal(fiber.physical.bludgeoning, undefined);
  assert.equal(fiber.exposures.contamination, 3);
  assert.equal(fiber.exposures.mana_corruption, 20);

  const blood = harvest.harvestCondition(record, 'blood_ichor');
  assert.equal(blood.physical.slashing.primary, false);
  assert.equal(blood.physical.slashing.damage, 18);
  assert.equal(blood.physical.piercing.primary, false);
  assert.equal(blood.exposures.blood_loss, 7);
  assert.equal(blood.exposures.contamination, 3);
  assert.equal(blood.exposures.mana_corruption, 20);

  const organRecord = harvest.createDamageRecord();
  harvest.recordEvent(organRecord, { sourceType: 'weapon', damageType: 'perforante', damageDealt: 11 });
  harvest.recordEvent(organRecord, { sourceType: 'weapon', damageType: 'cortante', damageDealt: 7 });
  harvest.recordEvent(organRecord, { sourceType: 'weapon', damageType: 'contundente', damageDealt: 9 });

  const internal = harvest.harvestCondition(organRecord, 'organ_internal');
  assert.equal(internal.physical.piercing.primary, true);
  assert.equal(internal.physical.piercing.damage, 11);
  assert.equal(internal.physical.bludgeoning.primary, false);
  assert.equal(internal.physical.slashing, undefined);

  const sensory = harvest.harvestCondition(organRecord, 'organ_sensory');
  assert.equal(sensory.physical.piercing.primary, true);
  assert.equal(sensory.physical.slashing.primary, true);
  assert.equal(sensory.physical.bludgeoning.primary, false);

  const brain = harvest.harvestCondition(organRecord, 'organ_brain');
  assert.equal(brain.physical.bludgeoning.primary, true);
  assert.equal(brain.physical.piercing.primary, true);
  assert.equal(brain.physical.slashing, undefined);

  const gland = harvest.harvestCondition(organRecord, 'organ_gland');
  assert.equal(gland.physical.piercing.primary, true);
  assert.equal(gland.physical.bludgeoning.primary, false);

  const secretion = harvest.harvestCondition(organRecord, 'venom_secretion');
  assert.equal(secretion.physical.piercing.primary, true);
  assert.equal(secretion.physical.piercing.damage, 11);
  assert.equal(secretion.physical.bludgeoning.primary, false);
  assert.equal(secretion.physical.bludgeoning.damage, 9);
  assert.equal(secretion.physical.slashing, undefined);

  const spellWithExplicitTrauma = harvest.explainEvent({
    sourceType: 'spell',
    damageType: 'perforante',
    harvestTrauma: 'contundente',
    damageDealt: 12,
  });
  assert.equal(spellWithExplicitTrauma.physicalTraumaType, 'bludgeoning');

  console.log('Harvest integrity engine smoke: OK (physical vs magic/status + hard/fragile/organ/blood/secretion profiles)');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
