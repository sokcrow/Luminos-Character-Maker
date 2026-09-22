import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [index, main, game] = await Promise.all([
  readFile(new URL("../lab/index.html", import.meta.url), "utf8"),
  readFile(new URL("../lab/main.js", import.meta.url), "utf8"),
  readFile(new URL("../lab/game/forest-0.3.3.1.html", import.meta.url), "utf8")
]);

assert.match(index, /forest-0\.3\.3\.1\.html/);
assert.match(index, /id="gameFrame"/);
assert.match(index, /id="openInventory"/);
assert.match(main, /LuminousMapItemBridge/);
assert.match(main, /PaperInventory/);
assert.match(main, /engine\.start\(\)/);
assert.match(game, /window\.LuminousMapItemBridge/);
assert.match(game, /window\.PaperInventory/);
assert.match(game, /Forest Floor Ecology/);

console.log("game-engine visual lab smoke: ok");
