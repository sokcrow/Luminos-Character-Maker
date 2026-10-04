import fs from "node:fs";
import assert from "node:assert/strict";

const dm = fs.readFileSync("pantalla_dm.html", "utf8");

assert.ok(dm.includes('id="dm-p2p-live-feed"'), "DM bank must expose a realtime P2P feed");
assert.ok(dm.includes("function renderDmP2PLiveFeed"), "DM bank needs a P2P feed renderer");
assert.ok(dm.includes("p2pOutbox"), "DM P2P feed must observe sender-owned outboxes");
assert.ok(dm.includes("processedP2P"), "DM P2P feed must infer settlement from the recipient idempotency marker");
assert.ok(dm.includes('"LIQUIDADA" : "PENDIENTE"'), "DM P2P feed must show settlement state");
assert.ok(dm.includes('"finance/currentBalance": nuevoAhn'), "Forced DM balance edits must sync canonical finance balance");
assert.ok(dm.includes('type: "dm_adjustment"'), "DM bank adjustments must be recorded in canonical transaction history");
assert.ok(dm.includes("tx.timestamp || tx.fecha"), "DM history must understand modern transaction timestamps");

console.log("DM realtime P2P ledger smoke: OK");
