import fs from "node:fs";
import assert from "node:assert/strict";
import vm from "node:vm";

const html = fs.readFileSync(new URL("../hoja_de_DM.html", import.meta.url), "utf8");
const controls = fs.readFileSync(new URL("../js/theatre-controls.js", import.meta.url), "utf8");
const workspace = fs.readFileSync(new URL("../js/theatre-dm-workspace.js", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../css/theatre-dm-workspace.css", import.meta.url), "utf8");
const runtime = fs.readFileSync(new URL("../js/on-game-dashboard.js", import.meta.url), "utf8");

new vm.Script(workspace, { filename: "theatre-dm-workspace.js" });

assert.match(html, /css\/theatre-dm-workspace\.css\?v=20261025-director-1/);
assert.match(html, /js\/theatre-dm-workspace\.js\?v=20261025-director-1/);
assert.ok(html.indexOf("js/on-game-dashboard.js") < html.indexOf("js/theatre-dm-workspace.js"), "workspace must keep the original send handler installed");
assert.ok(html.includes('id="theatre-speaker-select"') && html.includes('id="btn-send-dialogue"'), "canonical send controls must be retained");
assert.match(workspace, /\["voices", "Hablar"/);
assert.match(workspace, /\["cast", "Elenco"/);
assert.match(workspace, /\["scenes", "Escenas"/);
assert.match(workspace, /\["settings", "Ajustes"/);
assert.match(workspace, /modal\.showModal\(\)/);
assert.match(workspace, /modal\.close\(\)/);
assert.match(workspace, /speakerSelect\.dispatchEvent\(new Event\("change"/);
assert.match(workspace, /document\.getElementById\("btn-spawn-npc"\)\?\.click\(\)/);
assert.match(workspace, /document\.getElementById\("btn-theatre-message-next"\)/);
assert.match(workspace, /settings\.appendChild\(messagePolicy\)/);
assert.match(workspace, /campaña\/base_datos_npcs/);
assert.match(workspace, /campaña\/actores/);
assert.match(workspace, /state\.sceneActors\[actorId\]/);
assert.match(workspace, /\["http:", "https:"\]/, "actor image URLs must not accept script protocols");
assert.match(controls, /card\.dataset\.actorId = actorId/);
assert.match(runtime, /theatre\.enqueueIntervention/, "the original queue remains the only publication route");

for (const marker of [
  "@media (max-width: 700px)",
  "@media (max-width: 390px)",
  "@media (max-height: 430px) and (orientation: landscape)",
  "min-height: 44px",
  "safe-area-inset-top",
  "safe-area-inset-bottom",
  "grid-template-columns: repeat(2, minmax(0, 1fr))"
]) assert.ok(css.includes(marker), "responsive director CSS missing: " + marker);
assert.match(css, /\.dm-theatre-composer-modal::backdrop/, "composer must appear above scene HUD");
assert.match(css, /\.dm-director-view\[hidden\]/, "only one drawer tab may be visible");
assert.doesNotMatch(workspace, /enqueueIntervention\(/, "do not add a second message pipeline");

console.log("Director workspace smoke: HTML wiring, real actor sources, modal, queue and responsive contracts OK");
