import assert from "node:assert/strict";
import { EventBus } from "../src/core/EventBus.js";
import { GameEngine } from "../src/core/GameEngine.js";
import { DMDirector } from "../src/dm/DMDirector.js";
import { createLabPlayer } from "../src/player/createLabPlayer.js";

const events = new EventBus();
const engine = new GameEngine({ events });
const player = createLabPlayer();
engine.setPlayer(player);

let updates = 0;
engine.registerSystem("smoke", { update() { updates += 1; } });
engine.update(0.016);
assert.equal(updates, 1);

engine.disableSystem("smoke");
engine.update(0.016);
assert.equal(updates, 1);

engine.enableSystem("smoke");
engine.update(0.016);
assert.equal(updates, 2);

const dm = new DMDirector(engine);
assert.equal(dm.setPlayerFlag("smoke", true).ok, true);
assert.equal(player.flags.smoke, true);
assert.equal(engine.metrics().systems, 1);

engine.dispose("smoke-complete");
assert.equal(engine.disposed, true);
console.log("game-engine core smoke: ok");
