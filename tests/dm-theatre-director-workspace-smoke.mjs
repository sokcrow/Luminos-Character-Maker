import fs from "node:fs";
import assert from "node:assert/strict";
import vm from "node:vm";

const html = fs.readFileSync(new URL("../hoja_de_DM.html", import.meta.url), "utf8");
const controls = fs.readFileSync(new URL("../js/theatre-controls.js", import.meta.url), "utf8");
const workspace = fs.readFileSync(new URL("../js/theatre-dm-workspace.js", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../css/theatre-dm-workspace.css", import.meta.url), "utf8");
const runtime = fs.readFileSync(new URL("../js/on-game-dashboard.js", import.meta.url), "utf8");

new vm.Script(workspace, { filename: "theatre-dm-workspace.js" });

assert.match(html, /css\/theatre-dm-workspace\.css\?v=20261028-director-3/);
assert.match(html, /js\/theatre-dm-workspace\.js\?v=20261028-director-review-1/);
assert.ok(html.indexOf("js/on-game-dashboard.js") < html.indexOf("js/theatre-dm-workspace.js"), "workspace must keep the original send handler installed");
assert.ok(html.includes('id="theatre-speaker-select"') && html.includes('id="btn-send-dialogue"'), "canonical send controls must be retained");
assert.match(workspace, /\["voices", "Teatro"/);
assert.match(workspace, /\["cast", "Biblioteca"/);
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

// Execute the real Studio mount with both the nested Workspace and legacy DOM.
const studio = fs.readFileSync(new URL('../js/theatre-actor-studio.js', import.meta.url), 'utf8');
const mountSource = studio.slice(studio.indexOf('  function mountMasterPanel()'), studio.indexOf('  function bindMasterPanel()'));
for (const mode of ['slot', 'nested', 'legacy']) {
  const node = () => ({ children: [], parentNode: null, classList: { add() {} },
    appendChild(child) { child.parentNode = this; this.children.push(child); },
    prepend(child) { child.parentNode = this; this.children.unshift(child); },
    insertBefore(child, reference) {
      assert.equal(reference.parentNode, this, 'insertBefore requires a direct child');
      child.parentNode = this; this.children.splice(this.children.indexOf(reference), 0, child);
    }
  });
  const director = node(), cast = node(), quick = node(), slot = node();
  director.id = 'theatre-director-panel'; slot.id = 'theatre-actor-studio-slot';
  if (mode === 'legacy') director.appendChild(quick);
  else { director.appendChild(cast); cast.appendChild(quick); }
  if (mode === 'slot') cast.appendChild(slot);
  const find = (root, id) => root.id === id ? root : root.children.map(child => find(child, id)).find(Boolean);
  let bound = 0;
  const context = { doc: { getElementById: id => find(director, id), querySelector: () => quick, createElement: node },
    bindMasterPanel: () => { bound++; }, renderPlayerLinkOptions() {}, renderSourceList() {}, beginNewActor() {} };
  vm.runInNewContext(mountSource + '\nmountMasterPanel(); mountMasterPanel();', context);
  const panel = find(director, 'theatre-actor-master-panel');
  assert.equal(panel.parentNode, mode === 'slot' ? slot : quick.parentNode);
  assert.equal(bound, 1, 'Studio initialization must remain idempotent');
}
console.log('Actor Studio mount: lazy slot, nested cast and legacy director passed');
