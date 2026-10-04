import fs from "node:fs";
import assert from "node:assert/strict";

const js = fs.readFileSync("hoja_personaje.js", "utf8");
const html = fs.readFileSync("hoja_personaje.html", "utf8");

assert.ok(js.includes("phoneGroups"), "Phone groups must live under a player-owned group registry");
assert.ok(js.includes("phoneGroupMessages"), "Group messages must be written under each sender's own player node");
assert.ok(js.includes("phoneGroupReads"), "Group read state must be player-owned");
assert.ok(js.includes('groupPlayersRef.on("child_added", syncGroupPlayerSnapshot)') && js.includes('groupPlayersRef.on("child_changed", syncGroupPlayerSnapshot)'), "Group membership/messages must be discovered incrementally in realtime");
assert.ok(js.includes("ownerPlayerId"), "Group ownership must be explicit");
assert.ok(js.includes("groupHasMember(currentGroupMeta, playerId)"), "Sending must require current membership");
assert.ok(js.includes("resolveGroupMembers"), "Selected contact phone numbers must resolve to canonical player IDs");
assert.ok(!js.includes("campaña/jugadores/${pId}/chats/${newChatRef.key}"), "Group creation must never write another player's chat registry");
assert.ok(!js.includes('db.ref("campaña/comms/chats").push()'), "New group creation must not depend on unwritable global comms paths");
assert.ok(html.includes('id="btn-manage-group"'), "Group owners need a member management control");
assert.ok(html.includes("hoja_personaje.js?v=20261004-phone-groups-1"), "Group chat fix must cache-bust player JS");

console.log("Phone group chat live smoke: OK");
