import fs from "node:fs";
import assert from "node:assert/strict";

const js = fs.readFileSync("hoja_personaje.js", "utf8");
const html = fs.readFileSync("hoja_personaje.html", "utf8");

assert.ok(js.includes("resolveTheatreActorForSend"), "Theatre send must resolve actor independently of cache timing");
assert.ok(js.includes("window.datosJugador?.vinculo_jugador"), "Theatre send must support vinculo_jugador assignments");
assert.ok(js.includes("campaña/base_datos_npcs/${preferredId}"), "Theatre send must hydrate assigned NPC/actor directly when cache is empty");
assert.ok(!js.includes("replaceChild(newBtnSend"), "Theatre send must not replace the send button and erase listeners");
assert.ok(!js.includes("replaceChild(newInputEl"), "Theatre send must not replace the composer input and erase listeners");
assert.ok(js.includes("window.LuminousTheatreState?.getPaths?.().queue"), "Theatre send must honor active room queue paths");
assert.ok(html.includes("hoja_personaje.js?v=20261004-theatre-recovery-1"), "Player sheet JS must be cache-busted after Theatre recovery");

console.log("Theatre player send recovery smoke: OK");
