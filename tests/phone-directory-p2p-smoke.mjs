import fs from "node:fs";
import assert from "node:assert/strict";

const js = fs.readFileSync("hoja_personaje.js", "utf8");
const html = fs.readFileSync("hoja_personaje.html", "utf8");

assert.ok(js.includes("campaña/jugadores/${playerId}/contactos"), "Phone contacts must use canonical playerId paths");
assert.ok(!js.includes("campaña/jugadores/${pName}/contactos"), "Legacy character-name contact paths must not return");
assert.ok(js.includes("playerData.phoneNumber"), "An assigned phone number must count as a ready device");
assert.ok(js.includes("checkCellphone(playerId"), "Bank/mail device checks must use canonical playerId");
assert.ok(!js.includes("checkCellphone(pName"), "Character display names must not be used as player keys");
assert.ok(js.includes("initPhoneCommunicationTabs"), "Phone communication subtabs need an explicit initializer");
assert.ok(js.includes('document.readyState === "loading"'), "Phone subtab binding must work after async auth/DOMContentLoaded");
assert.ok(js.includes("p2pOutbox"), "Transfers must queue into the sender-owned outbox");
assert.ok(js.includes("processedP2P[transferId]"), "Incoming transfers need an idempotency marker");
assert.ok(js.includes('playersRef.on("child_added", inspectSenderSnapshot)'), "Recipients must discover existing sender outboxes");
assert.ok(js.includes('playersRef.on("child_changed", inspectSenderSnapshot)'), "Recipients must discover new sender outbox transfers");
assert.ok(js.includes("candidateData?.characterName"), "Transfer lookup must support canonical characterName");
assert.ok(!js.includes("campaña/economia/p2pInbox/${targetPlayerId}"), "New transfers must not depend on p2pInbox write rules");
assert.ok(html.includes('id="transfer-contact-options"'), "Bank transfer UI must expose saved-contact autocomplete");
assert.ok(html.includes("hoja_personaje.js?v=20261004-phone-groups-1"), "Phone fix must cache-bust the deployed player sheet");

console.log("Phone directory + P2P live regression checks passed.");
