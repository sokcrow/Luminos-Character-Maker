const { test, expect } = require('@playwright/test');

test('world interaction requests only authorize the requesting player own token', async () => {
  delete require.cache[require.resolve('../js/vtt/interaction-intent.js')];
  const intents=require('../js/vtt/interaction-intent.js');
  const playerToken={id:'player:a',canonicalScope:'player',canonicalOwnerUid:'uid-a',playerId:'alice',canonicalPlayerKey:'alice'};
  expect(intents.requesterOwnsActor({requesterUid:'uid-a',playerId:'alice'},playerToken)).toBe(true);
  expect(intents.requesterOwnsActor({requesterUid:'uid-b',playerId:'bob'},playerToken)).toBe(false);
  expect(intents.requesterOwnsActor({requesterUid:'uid-x',playerId:'alice'},playerToken)).toBe(true);
  expect(intents.requesterOwnsActor({requesterUid:'uid-a',playerId:'alice'},{id:'npc',canonicalScope:'world'})).toBe(false);
});
