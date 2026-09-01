const { test, expect } = require("@playwright/test");
const fs = require("node:fs");
const path = require("node:path");

const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");
const exists = (file) => fs.existsSync(path.join(__dirname, "..", file));
const engine = read("js/character-manager-engine.js");
const studio = read("js/character-manager-studio.js");
const studioCss = read("css/character-manager-studio.css");
const takeover = read("js/dm-character-manager-takeover.js");
const utils = read("js/utils.js");
const instanceControl = read("js/instance-control.js");
const theatreEngine = read("js/theatre-engine.js");

test("Character Manager centraliza las rutas persistentes sin borrar compatibilidad legacy", () => {
  expect(engine).toContain('"campaña/base_datos_npcs"');
  expect(engine).toContain('"campaña/actores"');
  expect(engine).toContain('"campaña/jugadores"');
  expect(engine).toContain('"campaña/idiomas"');
  expect(engine).toContain('"campaña/teatro/idiomas"');
  expect(engine).toContain("function rebuildActorSources");
  expect(engine).toContain("modern records win on duplicate IDs");
});

test("resuelve personajes de jugador aunque actorId esté obsoleto", () => {
  expect(engine).toContain("function linkedActorId");
  expect(engine).toContain("if (player?.actorId && actors[player.actorId]) return player.actorId");
  expect(engine).toContain("acceptedPlayerLinks");
  expect(engine).toContain("actor.vinculo_jugador");
  expect(engine).toContain("resolvePlayerCharacter");
});

test("guardar actor y asignación usa una actualización raíz atómica", () => {
  expect(engine).toContain("function buildPlayerLinkUpdates");
  expect(engine).toContain('updates[`${PATHS.players}/${playerId}/actorId`] = actorId');
  expect(engine).toContain('updates[`${actorRoot}/${actorId}/vinculo_jugador`] = playerId');
  expect(engine).toContain("await state.db.ref().update(updates)");
  expect(engine).toContain("previousActorId");
  expect(engine).toContain("previousPlayerId");
});

test("idiomas usan el formato canónico compatible con Theatre", () => {
  expect(engine).toContain("porcentaje: normalizePercent");
  expect(engine).toContain("comprendido: Boolean");
  expect(engine).toContain("setLanguageKnowledge");
  expect(engine).toContain('updates[`${PATHS.players}/${options.playerId}/idiomas`]');
  expect(theatreEngine).toContain("profile.idiomas");
  expect(theatreEngine).toContain("value.porcentaje");
  expect(theatreEngine).toContain("value.comprendido");
});

test("expresiones pueden crecer dinámicamente y se normalizan antes de persistir", () => {
  expect(engine).toContain("function normalizeExpressions");
  expect(engine).toContain("setExpressions");
  expect(studio).toContain("character-manager-add-expression");
  expect(studio).toContain("expressionRow");
  expect(studio).toContain("collectExpressions");
  expect(studio).toContain("cm-expression-preview");
});

test("Studio consume el motor y no accede Firebase directamente", () => {
  expect(studio).toContain("global.LuminousCharacterManager");
  expect(studio).toContain("manager.saveActor");
  expect(studio).toContain("manager.subscribeAll");
  expect(studio).not.toContain("firebase.database");
  expect(studio).not.toContain("db.ref(");
});

test("Studio usa una interfaz SVG propia sin emojis", () => {
  expect(studio).toContain("const ICONS = Object.freeze");
  expect(studio).toContain('<svg viewBox="0 0 24 24" aria-hidden="true">');
  expect(studio).toContain("aria-label=");
  expect(studio).toContain("title=");
  expect(studio).toContain("cm-icon-button");
  expect(studio).toContain("const idAttribute = id ?");
  expect(studio).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u);
  expect(studio).not.toContain("GUARDAR EN FIREBASE");
  expect(studio).not.toContain('id=""');
});

test("Studio reduce saturación con roster visual y módulos especializados", () => {
  expect(studio).toContain('id="character-manager-roster"');
  expect(studio).toContain("cm-roster-entry");
  expect(studio).toContain('data-section="identity"');
  expect(studio).toContain('data-section="assignment"');
  expect(studio).toContain('data-section="expressions"');
  expect(studio).toContain('data-section="languages"');
  expect(studio).toContain('data-section="advanced"');
  expect(studio).toContain("cm-distortion-toggle");
  expect(studio).not.toContain('id="character-manager-actor-select"');
});

test("lenguaje visual mantiene jerarquía industrial y estados accesibles", () => {
  expect(studioCss).toContain("--cm-gold");
  expect(studioCss).toContain("--cm-bone");
  expect(studioCss).toContain(".cm-module-nav");
  expect(studioCss).toContain(".cm-roster-entry.is-selected");
  expect(studioCss).toContain(".cm-icon-button:focus-visible");
  expect(studioCss).toContain("clip-path");
  expect(studioCss).toContain("currentColor");
});

test("Pantalla DM entrega Gestión de Personajes al nuevo motor y retira el resolver legacy", () => {
  expect(utils).toContain("function ensureDmCharacterManagerAssets");
  expect(utils).toContain("#dashboard-actores");
  expect(utils).toContain("js/character-manager-engine.js");
  expect(utils).toContain("js/character-manager-studio.js");
  expect(utils).toContain("js/dm-character-manager-takeover.js");
  expect(utils).not.toContain("dm-character-player-resolver");
  expect(takeover).toContain('typeof global.dbJugadoresCache !== "undefined"');
  expect(takeover).toContain("host.replaceChildren(panel)");
  expect(takeover).toContain('host.dataset.characterManagerAuthority = "engine"');
  expect(exists("js/dm-character-player-resolver.js")).toBe(false);
});

test("el takeover espera a que el DM legacy termine de registrar sus handlers", () => {
  expect(takeover).toContain("legacyDmInitializationCompleted");
  expect(takeover).toContain("READY_POLL_MS");
  expect(takeover).toContain("MAX_POLLS");
  expect(takeover).toContain("luminous:character-manager-takeover");
});

test("ON GAME inicializa solo el motor para que Theatre pueda consumirlo", () => {
  expect(instanceControl).toContain("function ensureDashboardCharacterManager");
  expect(instanceControl).toContain("js/character-manager-engine.js");
  expect(instanceControl).toContain("global.LuminousCharacterManager?.init?.({ db })");
  expect(instanceControl).toContain("ensureDashboardActorStudioAssets(documentRef)");
  expect(instanceControl).not.toContain("character-manager-studio.js");
});

test("el motor expone suscripciones en tiempo real para futuros consumidores", () => {
  expect(engine).toContain('ref.on("value", handler)');
  expect(engine).toContain("subscribeActors");
  expect(engine).toContain("subscribePlayers");
  expect(engine).toContain("subscribeLanguages");
  expect(engine).toContain("luminous:character-manager-change");
});
