const { test, expect } = require("@playwright/test");
const fs = require("node:fs");
const path = require("node:path");

const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");
const playerUx = read("js/player-ux-polish.js");
const playerUxCss = read("css/player-ux-polish.css");
const actorStudio = read("js/theatre-actor-studio.js");
const actorStudioCss = read("css/theatre-actor-studio.css");
const utils = read("js/utils.js");
const instanceControl = read("js/instance-control.js");
const theatreControls = read("js/theatre-controls.js");
const playerHtml = read("hoja_personaje.html");

function block(source, start, end) {
  const from = source.indexOf(start);
  expect(from).toBeGreaterThanOrEqual(0);
  const to = end ? source.indexOf(end, from) : source.length;
  return source.slice(from, to < 0 ? source.length : to);
}

test("Vínculos y Directorio de Red quedan diferenciados", () => {
  expect(playerHtml).toContain('name="act_hud_apego"');
  expect(playerHtml).toContain('id="btn-show-contacts"');
  expect(playerHtml).toContain('id="new-contact-number"');
  expect(playerHtml).toContain('id="new-contact-alias"');
  expect(playerUx).toContain('label.textContent = "Vínculos"');
  expect(playerUx).toContain('directoryButton.textContent = "DIRECTORIO"');
  expect(playerUx).toContain("números y alias para comunicación");
  expect(playerUx).toContain("afinidad y las relaciones personales");
});

test("el log usa icono asignado y nunca el sprite como fuente preferida", () => {
  const iconResolver = block(playerUx, "function actorAssignedIcon", "function actorRecords");
  expect(iconResolver).toContain("actor?.icono");
  expect(iconResolver).toContain("actor?.icono_jugador");
  expect(iconResolver).toContain("actor?.icon_url");
  expect(iconResolver).not.toContain("sprite");
  expect(iconResolver).not.toContain("avatar");

  const logPolish = block(playerUx, "function polishLogRows", "function watchTheatreLog");
  expect(logPolish).toContain("actor?.sprite");
  expect(logPolish).toContain("actor?.url");
  expect(logPolish).toContain("actor?.avatar");
  expect(logPolish).toContain("initialsIcon(displayedName)");
});

test("el retrato del log es un heptágono y no un círculo", () => {
  expect(playerUxCss).toContain("clip-path: polygon(50% 0%, 88% 17%, 100% 55%, 78% 100%, 22% 100%, 0 55%, 12% 17%)");
  const border = block(playerUxCss, "#theatre-view-player #theatre-log-container .hex-border", "#theatre-view-player #theatre-log-container .hex-portrait");
  expect(border).toContain("border-radius: 0 !important");
  expect(border).not.toContain("border-radius: 50%");
});

test("los textos de módulos del celular pueden envolver sin salirse", () => {
  expect(playerUxCss).toContain("overflow-wrap: anywhere !important");
  expect(playerUxCss).toContain("white-space: normal !important");
  expect(playerUxCss).toContain("min-width: 0 !important");
  expect(playerUxCss).toContain("@media (max-width: 700px)");
});

test("Ajustes ofrece controles útiles y locales", () => {
  for (const id of [
    "player-setting-mute",
    "player-setting-volume",
    "player-setting-reduce-motion",
    "player-setting-large-text",
    "player-setting-compact",
    "player-settings-reset",
  ]) {
    expect(playerUx).toContain(id);
  }
  expect(playerUx).toContain("luminous.player.masterVolume");
  expect(playerUx).toContain("luminous.player.reduceMotion");
  expect(playerUx).toContain("luminous.player.largeText");
  expect(playerUx).toContain("luminous.player.compactUi");
  expect(playerUx).toContain('getElementById("btn-toggle-mute")');
});

test("utils carga los retoques del jugador de forma idempotente", () => {
  expect(utils).toContain("function ensurePlayerUxPolishAssets");
  expect(utils).toContain("player-ux-polish-stylesheet");
  expect(utils).toContain("css/player-ux-polish.css");
  expect(utils).toContain("player-ux-polish-script");
  expect(utils).toContain("js/player-ux-polish.js");
});

test("el DM diferencia cast temporal de actor persistente", () => {
  const existingSpawn = block(theatreControls, "function spawnSelectedActor", "function renderLiveActors");
  expect(existingSpawn).toContain('db.ref(`${paths().scene}/actores/${actorInstanceId}`).set(actorPayload)');

  expect(actorStudio).toContain('spawn.textContent = "AÑADIR AL CAST (TEMPORAL)"');
  expect(actorStudio).toContain("EDITAR / REPARAR FUENTE");
  expect(actorStudio).toContain("NUEVO ACTOR PERSISTENTE");
  expect(actorStudio).toContain('base: "campaña/base_datos_npcs"');
  expect(actorStudio).toContain('legacy: "campaña/actores"');
});

test("jugadores sin actor pueden repararse y quedan enlazados", () => {
  expect(actorStudio).toContain("JUGADORES SIN ACTOR THEATRE");
  expect(actorStudio).toContain('option.value = `__player__:${playerId}`');
  expect(actorStudio).toContain('await db.ref(`${ROOTS.players}/${context.playerId}/actorId`).set(actorId)');
  expect(actorStudio).toContain('await db.ref(`${root}/${actorId}`).set(Object.assign({ identityId: actorId }, payload))');
});

test("editar una fuente actualiza instancias del cast sin crear copias nuevas", () => {
  const propagate = block(actorStudio, "async function propagateActorSource", "async function saveEditor");
  expect(propagate).toContain('db.ref(`${scenePath()}/actores`).once("value")');
  expect(propagate).toContain("db.ref().update(updates)");
  expect(propagate).not.toContain("push()");

  const save = block(actorStudio, "async function saveEditor", "function findUniqueActorIdByName");
  expect(save).toContain('db.ref(`${root}/${actorId}`).update(payload)');
  expect(save).toContain("propagateActorSource");
});

test("Actor Studio separa icono de sprite", () => {
  expect(actorStudio).toContain("Icono · log/HUD");
  expect(actorStudio).toContain("Sprite · escena");
  const payload = block(actorStudio, "function editorPayload", "async function propagateActorSource");
  expect(payload).toContain("icono:");
  expect(payload).toContain("sprite:");
  expect(actorStudioCss).toContain("THEATRE ACTOR STUDIO / DM UX");
});

test("instance-control carga Actor Studio solo en dashboard DM", () => {
  expect(instanceControl).toContain("function ensureDashboardActorStudioAssets");
  expect(instanceControl).toContain("css/theatre-actor-studio.css");
  expect(instanceControl).toContain("js/theatre-actor-studio.js");
  expect(instanceControl).toContain('body?.classList.contains("on-game-dashboard")');
});

test("los observers quedan acotados y no vigilan todo el body del Actor Studio", () => {
  expect(actorStudio).not.toContain("observer.observe(doc.body");
  expect(actorStudio).toContain("observe(select, { childList: true, subtree: true })");
  expect(actorStudio).toContain("observe(liveList, { childList: true, subtree: true })");
  expect(playerUx).not.toContain("observe(doc.body");
});
