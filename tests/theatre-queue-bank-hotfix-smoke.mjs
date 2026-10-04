import fs from "node:fs";
import assert from "node:assert/strict";

const dashboard = fs.readFileSync("js/on-game-dashboard.js", "utf8");
const playerJs = fs.readFileSync("hoja_personaje.js", "utf8");
const playerCss = fs.readFileSync("hoja_personaje.css", "utf8");
const playerHtml = fs.readFileSync("hoja_personaje.html", "utf8");
const dmHtml = fs.readFileSync("hoja_de_DM.html", "utf8");

assert.ok(
  dashboard.includes('instanceValue === "teatro" || instanceValue === "combat_theatre"'),
  "Theatre queue consumer must run for both standalone Theatre and Combat Theater",
);
assert.ok(
  dashboard.includes("!theatreOutputIsActive(instanceSnap.val())"),
  "Queue processing gate must use the shared Theatre-output predicate",
);
assert.ok(
  dashboard.includes("if (theatreOutputIsActive(snapshot.val())) processQueue();"),
  "Changing into Combat Theater must wake the FIFO queue processor",
);

assert.ok(
  playerJs.includes('el.style.display = tabName === "banco" ? "block" : "flex"'),
  "Phone device gate must preserve the Bank vertical document layout",
);
assert.ok(
  playerCss.includes(".sheet-tab-banco .sheet-app-body") &&
  playerCss.includes("display: block;"),
  "Bank app body must be hardened as a block layout",
);
assert.ok(
  playerCss.includes(".sheet-tab-banco #btn-open-transfer"),
  "Transfer CTA must have a Bank-scoped width constraint",
);
assert.ok(
  playerHtml.includes("hoja_personaje.css?v=20261004-theatre-bank-hotfix-1") &&
  playerHtml.includes("hoja_personaje.js?v=20261004-theatre-bank-hotfix-1"),
  "Player bank hotfix assets must be cache-busted",
);
assert.ok(
  dmHtml.includes("js/on-game-dashboard.js?v=20261004-theatre-bank-hotfix-1"),
  "DM Theatre queue consumer must be cache-busted",
);

console.log("Theatre queue + Bank layout hotfix smoke: OK");
