import fs from "node:fs";
import assert from "node:assert/strict";

const html = fs.readFileSync("hoja_de_DM.html", "utf8");
const hud = fs.readFileSync("css/theatre-hud.css", "utf8");
const policy = fs.readFileSync("css/theatre-message-policy.css", "utf8");

assert.ok(
  html.includes('class="theatre-controls theatre-dm-composer"'),
  "DM dialogue composer must have a dedicated responsive container",
);
assert.ok(
  html.includes('class="theatre-dm-composer-selects"'),
  "DM composer selects need their own responsive grid",
);
assert.ok(
  hud.includes("grid-template-columns: minmax(0, 1.35fr) minmax(0, 1fr)"),
  "DM speaker/type controls must use a bounded two-column grid",
);
assert.ok(
  hud.includes("#theatre-expression-select") && hud.includes("grid-column: 1 / -1"),
  "Expression selector must occupy a safe full row",
);
assert.match(
  policy,
  /#theatre-director-panel \.theatre-message-policy \.tmp-grid\s*\{[^}]*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/s,
  "MESSAGE FLOW must use a panel-safe 2x2 grid instead of four fixed desktop columns",
);
assert.ok(
  policy.includes("#btn-theatre-message-next") && policy.includes("max-width: 100%"),
  "NEXT control must not escape the director panel",
);
assert.ok(
  html.includes("css/theatre-message-policy.css?v=20261004-dm-input-visible-1") &&
  html.includes("css/theatre-hud.css?v=20261004-dm-input-visible-1"),
  "DM composer CSS must be cache-busted",
);

console.log("DM dialogue composer layout smoke: OK");
