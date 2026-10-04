import fs from "node:fs";
import assert from "node:assert/strict";

const html = fs.readFileSync("hoja_de_DM.html", "utf8");
const hud = fs.readFileSync("css/theatre-hud.css", "utf8");
const policyJs = fs.readFileSync("js/theatre-message-policy.js", "utf8");

assert.ok(
  html.includes('data-theatre-compose-action'),
  "DM composer must keep textarea/send button in a dedicated action area",
);
assert.ok(
  html.includes('id="theatre-dialogue-input"') &&
  html.includes('placeholder="Escribe el diálogo aquí..."'),
  "DM composer must expose an explicit writable dialogue textarea",
);
assert.ok(
  html.includes('id="btn-send-dialogue"'),
  "DM composer must keep the send button adjacent to the textarea",
);
assert.match(
  hud,
  /\.theatre-dm-compose-action\s*\{[^}]*position:\s*sticky;[^}]*bottom:/s,
  "DM compose action must remain visible at the bottom of the director panel",
);
assert.match(
  hud,
  /\.theatre-dm-compose-action \.theatre-dm-composer-textarea\s*\{[^}]*height:\s*112px\s*!important;[^}]*min-height:\s*112px\s*!important;/s,
  "DM dialogue textarea needs a guaranteed visible writing height",
);
assert.ok(
  policyJs.includes('host.querySelector("[data-theatre-compose-action]")'),
  "MESSAGE FLOW must insert above the compose action instead of assuming textarea is a direct child",
);
assert.ok(
  html.includes("css/theatre-hud.css?v=20261004-dm-input-visible-1") &&
  html.includes("js/theatre-message-policy.js?v=20261004-dm-input-visible-1"),
  "DM input visibility hotfix assets must be cache-busted",
);

console.log("DM dialogue input visibility smoke: OK");
