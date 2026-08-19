const { test, expect } = require("@playwright/test");
const fs = require("node:fs");
const path = require("node:path");

const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");
const resolver = read("js/dm-character-player-resolver.js");
const utils = read("js/utils.js");

test("el editor de jugador no confía ciegamente en actorId stale", () => {
  expect(resolver).toContain("async function fetchActorById");
  expect(resolver).toContain('"campaña/base_datos_npcs"');
  expect(resolver).toContain('"campaña/actores"');
  expect(resolver).toContain("const candidates = [selectedActorId, playerData.actorId]");
  expect(resolver).toContain("const direct = await fetchActorById(db, actorId)");
  expect(resolver).toContain("findActorLinkedToPlayer");
});

test("si actorId no existe se busca por vinculo_jugador", () => {
  expect(resolver).toContain("acceptedLinks");
  expect(resolver).toContain("actor.vinculo_jugador");
  expect(resolver).toContain("acceptedLinks.has(link)");
  expect(resolver).toContain("playerId");
  expect(resolver).toContain("displayName");
});

test("el click Editar de jugador intercepta el handler viejo", () => {
  expect(resolver).toContain('#grid-personajes-jugadores .btn-action');
  expect(resolver).toContain('if (!/editar/i.test(button.textContent || "")) return;');
  expect(resolver).toContain("event.stopImmediatePropagation()");
  expect(resolver).toContain("openResolvedPlayerActor(button)");
});

test("el actor resuelto entra al Actor Studio existente", () => {
  expect(resolver).toContain("const loader = global.loadActorIntoFormInternal");
  expect(resolver).toContain("loader(resolved.actorId, resolved.actor)");
  expect(resolver).toContain("normalizeActorForLegacyEditor");
});

test("utils carga el resolver de jugadores junto al editor DM", () => {
  expect(utils).toContain("dm-character-player-resolver-script");
  expect(utils).toContain("js/dm-character-player-resolver.js");
  expect(utils).toContain("playerResolver");
});
