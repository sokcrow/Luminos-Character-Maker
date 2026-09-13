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

  const spellWithExplicitTrauma = harvest.explainEvent({
    sourceType: 'spell',
    damageType: 'perforante',
    harvestTrauma: 'contundente',
    damageDealt: 12,
  });
  assert.equal(spellWithExplicitTrauma.physicalTraumaType, 'bludgeoning');

  console.log('Harvest integrity engine smoke: OK (physical vs magic/status separation)');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
