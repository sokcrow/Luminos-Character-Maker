const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const rulesPath = path.join(__dirname, '..', 'database.rules.json');
const rules = JSON.parse(fs.readFileSync(rulesPath, 'utf8'));
const campaign = rules.rules['campaña'];
const DM_UID = 'e9JwFZrtk6g8UMqq2Hf9EHVY7Ay1';

test('shared Trait Firebase paths keep campaign writes scoped', () => {
  expect(campaign['.write']).toBeUndefined();
  expect(campaign.combate['.write']).toBeUndefined();
  expect(campaign.combate.$other['.write']).toContain(DM_UID);

  const plannedWrite = campaign.combate.plannedActions.$unitId.$slotIndex['.write'];
  expect(plannedWrite).toContain("PRE_COMBAT_PLANNING");
  expect(plannedWrite).toContain("schedulerUid");
  expect(plannedWrite).toContain("auth.uid");
  expect(plannedWrite).toContain("status");
  expect(plannedWrite).toContain("planned");

  const effectWrite = campaign.efectos_dm.$effectId['.write'];
  expect(effectWrite).toContain("subjectUid");
  expect(effectWrite).toContain("active");
  expect(effectWrite).toContain("approved");
  expect(effectWrite).toContain("consumedAt");

  const consumeWrite = campaign.efectos_dm.$effectId.consumedAt['.write'];
  expect(consumeWrite).toContain("subjectUid");
  expect(consumeWrite).toContain("approved");
  expect(consumeWrite).toContain("!data.exists()");
  expect(consumeWrite).toContain("newData.isNumber()");
});
