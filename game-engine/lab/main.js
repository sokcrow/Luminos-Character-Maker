import { GameEngine } from "../src/core/GameEngine.js";
import { DMDirector } from "../src/dm/DMDirector.js";
import { createLabPlayer } from "../src/player/createLabPlayer.js";
import { LuminousItemsBridge } from "../src/bridges/luminous/LuminousItemsBridge.js";

const engine = new GameEngine();
const player = createLabPlayer();
const items = engine.registerBridge("luminous-items", new LuminousItemsBridge());
const dm = new DMDirector(engine);
engine.session.dm = dm;
engine.setPlayer(player);

const $ = (id) => document.getElementById(id);
const eventLines = [];
const renderJson = (id, value) => { $(id).textContent = JSON.stringify(value, null, 2); };

function render() {
  renderJson("runtimeState", { engine: engine.metrics(), items: items.status(), playerId: player.id });
  renderJson("inventoryState", items.available ? items.snapshot(player) : { error: "Item runtime unavailable" });
}

function log(type, payload) {
  eventLines.unshift(`${new Date().toLocaleTimeString()}  ${type}\n${JSON.stringify(payload, null, 2)}`);
  eventLines.splice(40);
  $("eventLog").textContent = eventLines.join("\n\n");
}

["engine:start","engine:stop","engine:player-changed","engine:bridge-registered","items:moved","items:used","dm:player-flag"]
  .forEach((type) => engine.events.on(type, (payload) => { log(type, payload); render(); }));

$("startEngine").addEventListener("click", () => { engine.start(); render(); });
$("stopEngine").addEventListener("click", () => { engine.stop(); render(); });
$("inspectPlayer").addEventListener("click", () => renderJson("dmState", dm.execute({ type: "inspect_player" })));
$("setFlag").addEventListener("click", () => renderJson("dmState", dm.execute({ type: "set_player_flag", key: "lab_ready", value: true })));

$("seedItem").addEventListener("click", () => {
  if (!items.available) return;
  const definition = {
    id: "lab_forest_sample",
    canonicalId: "lab_forest_sample",
    name: "Muestra del bosque",
    category: "ingredient",
    family: "plant_produce",
    quantity: 1,
    stackable: true,
    tags: ["ingredient","material","lab_only"]
  };
  const instance = items.createInstance(definition, { quantity: 1, ownerId: player.id });
  const key = instance.instanceId || `lab_${Date.now()}`;
  instance.instanceId = key;
  player.inventario_activo[key] = instance;
  log("lab:item-seeded", { key, definitionId: instance.definitionId || definition.id });
  render();
});

function firstKey(container) {
  return Object.keys(container || {})[0] || null;
}

$("moveStash").addEventListener("click", () => {
  const key = firstKey(player.inventario_activo);
  if (!key) return;
  renderJson("dmState", items.moveToStash(player, key));
  render();
});

$("moveActive").addEventListener("click", () => {
  const key = firstKey(player.inventario_stash);
  if (!key) return;
  renderJson("dmState", items.moveToActive(player, key));
  render();
});

render();
log("lab:ready", { url: location.href, itemRuntime: items.status() });
