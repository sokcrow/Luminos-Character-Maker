import fs from "node:fs";
import assert from "node:assert/strict";

const js = fs.readFileSync("js/on-game-dashboard.js", "utf8");
const html = fs.readFileSync("hoja_de_DM.html", "utf8");

assert.ok(js.includes("const sendDmTheatreMessage = async () =>"), "DM Theatre send must have one reusable async path");
assert.ok(js.includes('btnSendDialogue.dataset.sending = "true"'), "DM Theatre send must prevent duplicate submissions");
assert.ok(js.includes('btnSendDialogue.dataset.sending = "false"'), "DM Theatre send must recover the button after completion");
assert.ok(js.includes("No se pudo enviar el mensaje del DM"), "DM Theatre send failures must be visible in diagnostics");
assert.ok(js.includes('event.key !== "Enter" || event.shiftKey'), "DM composer must support Enter without breaking multiline input");
assert.ok(html.includes("theatre-engine.js?v=20261004-theatre-send-recovery-2"), "DM must receive the recovered shared Theatre engine");
assert.ok(html.includes("on-game-dashboard.js?v=20261004-theatre-send-recovery-2"), "DM must receive the recovered send handler");

console.log("Theatre DM send recovery smoke: OK");
