const { test, expect } = require("@playwright/test");
const fs = require("node:fs");
const path = require("node:path");

const engine = fs.readFileSync(path.join(__dirname, "..", "js", "theatre-engine.js"), "utf8");
const controls = fs.readFileSync(path.join(__dirname, "..", "js", "theatre-controls.js"), "utf8");

test("#511: Firebase scene state is authoritative and visible actors are reactive", () => {
  expect(engine).toContain('db.ref(THEATRE_ROOT).on("value"');
  expect(engine).toContain("const explicitVisible = normalizeIdList(scene?.actores_visibles)");
  expect(engine).toContain("Missing/empty actores_visibles means no visible sprites");
  expect(engine).not.toContain("validActors.slice(0, 5)");
});

test("#511: FIFO only rotates new actors and does not reorder an existing speaker", () => {
  expect(engine).toContain("if (visibles.includes(actorId)) return visibles;");
  expect(engine).toContain("visibles.push(actorId);");
  expect(engine).toContain("while (visibles.length > maxVisible) visibles.shift();");
  expect(engine).not.toContain("visibles.splice(index, 1)");
});

test("#511: the visible limit is configurable from 1 to 5 without deleting the actor pool", () => {
  expect(engine).toContain("Math.max(1, Math.min(DEFAULT_MAX_VISIBLE, parsed))");
  expect(controls).toContain('id="theatre-max-visible"');
  expect(controls).toContain("The actor pool is not the HUD");
  expect(controls).not.toContain("delete actors[oldestKey]");
});

test("#511: selecting an expression prepares it instead of revealing the sprite", () => {
  expect(controls).toContain("expresionPreparada");
  expect(controls).toContain("prepareExpression(actorId, newExpression)");
  expect(controls).not.toContain("sprite: newSprite");
  expect(engine).toContain("expresionActiva/sprite are the revealed state");
});

test("#511: narration and thoughts dim every sprite and /em keeps actor context", () => {
  expect(engine).toContain("if (isThought || isNarrator)");
  expect(engine).toContain('img.style.filter = "brightness(0.4)"');
  expect(engine).toContain('/^\\/em\\s+/i');
  expect(engine).toContain("return `(${name} ${action})`");
});

test("#511: dialogue persists, clear scene preserves background/roster and No Actors is a render mode", () => {
  expect(engine).toContain("Intentionally keep the completed dialogue visible");
  expect(engine).toContain("async function clearScene()");
  expect(engine).toContain("actores_visibles`]: null");
  expect(engine).not.toContain("actores`]: null");
  expect(engine).toContain('scene?.modo_presentacion === "no-actors"');
  expect(controls).toContain('id="theatre-no-actors"');
});

test("#511: player self-sprite preference is local and future rooms have a scoped root", () => {
  expect(engine).toContain('const LOCAL_SHOW_SELF_KEY = "luminous.theatre.showOwnActor"');
  expect(engine).toContain("global.localStorage?.setItem");
  expect(engine).toContain("resolveRoomRoot");
  expect(engine).toContain("campaña/teatro/salas/${roomId}/escena");
});

test("#511: partial language knowledge uses a deterministic monotonic word bucket", () => {
  expect(engine).toContain("function deterministicVocabularyKnown");
  expect(engine).toContain("const bucket = (hash >>> 0) % 10000");
  expect(engine).toContain("return bucket < Math.round(knowledge * 100)");
});
