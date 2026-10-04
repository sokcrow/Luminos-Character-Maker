import fs from "node:fs";
import assert from "node:assert/strict";

const js = fs.readFileSync("hoja_personaje.js", "utf8");
const html = fs.readFileSync("hoja_personaje.html", "utf8");
const rules = fs.readFileSync("database.rules.json", "utf8");

assert.ok(js.includes("campaña/jugadores/${playerId}/contactos"), "Phone contacts must use canonical playerId paths");
assert.ok(!js.includes("campaña/jugadores/${pName}/contactos"), "Legacy character-name contact paths must not return");
assert.ok(js.includes("campaña/economia/p2pInbox/${targetPlayerId}"), "Transfers must queue into the recipient P2P inbox");
assert.ok(js.includes("processedP2P[transferId]"), "Incoming transfers need an idempotency marker");
assert.ok(js.includes("initP2PInboxSettlement();"), "P2P settlement must start during player hydration");
assert.ok(html.includes('id="transfer-contact-options"'), "Bank transfer UI must expose saved-contact autocomplete");
assert.ok(rules.includes('"p2pInbox"'), "Firebase rules must authorize the P2P inbox");
assert.ok(rules.includes("newData.child(\'senderUid\').val() === auth.uid"), "P2P inbox creation must be bound to the authenticated sender");

console.log("Phone directory + P2P transfer regression checks passed.");
