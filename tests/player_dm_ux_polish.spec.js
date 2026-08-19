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

test("launcher del celular muestra solo iconos, sin labels ni MODULE READY", () => {
  expect(playerUx).toContain("function normalizePhoneLauncher");
  expect(playerUx).toContain('button.setAttribute("aria-label", label)');
  expect(playerUx).toContain("button.title = label");

  const launcher = block(playerUxCss, "LAUNCHER: ICONOS SOLAMENTE", "El sistema actual de atributos");
  expect(launcher).toContain(".sheet-app-btn > span");
  expect(launcher).toContain(".sheet-app-btn::before");
  expect(launcher).toContain("display: none !important;");
  expect(launcher).toContain("content: none !important;");
  expect(launcher).toContain("width: 38px !important;");
  expect(launcher).toContain("grid-template-columns: repeat(3, minmax(0, 1fr)) !important;");
});

test("la carcasa del celular contiene statusbar pantalla navbar y contenido", () => {
  const frame = block(playerUxCss, "CONTRATO FÍSICO DEL CELULAR", "LAUNCHER: ICONOS SOLAMENTE");
  expect(frame).toContain(".sheet-phone-wrapper *");
  expect(frame).toContain("box-sizing: border-box;");
  expect(frame).toContain("display: flex !important;");
  expect(frame).toContain("flex-direction: column !important;");
  expect(frame).toContain(".sheet-phone-screen");
  expect(frame).toContain("flex: 1 1 0 !important;");
  expect(frame).toContain("height: auto !important;");
  expect(frame).toContain(".sheet-phone-navbar");
  expect(frame).toContain("position: relative !important;");
  expect(frame).toContain("overflow: hidden !important;");
  expect(frame).toContain("max-width: 100% !important;");
});

test("Perfil oculta tiradas D&D legacy y Stats conserva el motor actual", () => {
  expect(playerHtml).toContain('class="sheet-dnd-stats-grid"');
  expect(playerHtml).toContain('id="stats-container"');
  expect(playerHtml).toContain('name="act_roll_cuerpo"');
  expect(playerHtml).toContain('name="attr_cuerpo_base"');

  const suppression = block(playerUx, "function suppressLegacyProfileRolls", "function renameRelationshipUx");
  expect(suppression).toContain('doc.querySelector(".sheet-tab-profile")');
  expect(suppression).toContain('#stats-modal #stats-container [name="act_roll_cuerpo"]');
  expect(suppression).toContain('profile.querySelector(".sheet-dnd-stats-grid")');
  expect(suppression).toContain('legacyGrid.dataset.legacyAttributes = "disabled"');
  expect(playerUxCss).toContain(".sheet-tab-profile .sheet-dnd-stats-grid");
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

test("la Pantalla de DM monta un Control Maestro visible y no un modal auxiliar", () => {
  expect(actorStudio).toContain('panel.id = "theatre-actor-master-panel"');
  expect(actorStudio).toContain("CONTROL MAESTRO DE ACTORES");
  expect(actorStudio).toContain("MASTER DATABASE / DM AUTHORITY");
  expect(actorStudio).toContain('director.insertBefore(panel, quickCast)');
  expect(actorStudio).not.toContain("theatre-actor-studio-overlay");
  expect(actorStudioCss).toContain("THEATRE ACTOR MASTER CONTROL / DM UX");
  expect(actorStudioCss).toContain("#theatre-actor-master-panel");
});

test("el DM lista siempre jugadores y fuentes persistentes aunque no estén en escena", () => {
  expect(actorStudio).toContain('playerGroup.label = "JUGADORES"');
  expect(actorStudio).toContain("SIN ACTOR THEATRE");
  expect(actorStudio).toContain('actorGroup.label = "NPCs / ACTORES SIN JUGADOR"');
  expect(actorStudio).toContain('base: "campaña/base_datos_npcs"');
  expect(actorStudio).toContain('legacy: "campaña/actores"');
  expect(actorStudio).toContain('players: "campaña/jugadores"');
});

test("el formulario maestro edita identidad visual, vínculo y expresiones", () => {
  for (const id of [
    "theatre-master-name",
    "theatre-master-title",
    "theatre-master-type",
    "theatre-master-player-link",
    "theatre-master-scale",
    "theatre-master-name-color",
    "theatre-master-title-color",
    "theatre-master-icon",
    "theatre-master-sprite",
    "theatre-master-expressions",
  ]) {
    expect(actorStudio).toContain(id);
  }
  expect(actorStudio).toContain("Icono · log / HUD");
  expect(actorStudio).toContain("Sprite base · escena");
  expect(actorStudio).toContain("EXPRESIONES / AVANZADO");
});

test("crear o reparar jugador escribe fuente persistente y actorId del jugador", () => {
  const save = block(actorStudio, "async function saveCurrentActor", "function selectContextInBrowser");
  expect(save).toContain('db.ref(ROOTS.base).push()');
  expect(save).toContain('context.mode === "repair-player"');
  expect(save).toContain("identityId: actorId");
  expect(actorStudio).toContain('updates[`${ROOTS.players}/${newPlayerId}/actorId`] = actorId');
});

test("guardar actor existente modifica su fuente y propaga al cast sin duplicarlo", () => {
  const save = block(actorStudio, "async function saveCurrentActor", "function selectContextInBrowser");
  expect(save).toContain('db.ref(`${root}/${actorId}`).update(payload)');
  expect(save).toContain("propagateActorSource");

  const propagate = block(actorStudio, "async function propagateActorSource", "async function saveCurrentActor");
  expect(propagate).toContain('db.ref(`${scenePath()}/actores`).once("value")');
  expect(propagate).toContain("db.ref().update(updates)");
  expect(propagate).not.toContain("push()");
});

test("el DM diferencia de forma explícita base maestra y cast temporal", () => {
  const existingSpawn = block(theatreControls, "function spawnSelectedActor", "function renderLiveActors");
  expect(existingSpawn).toContain('db.ref(`${paths().scene}/actores/${actorInstanceId}`).set(actorPayload)');
  expect(actorStudio).toContain("AÑADIR AL CAST (TEMPORAL)");
  expect(actorStudio).toContain("CAST RÁPIDO DE ESCENA");
  expect(actorStudio).toContain("Instancias temporales; no modifica la base maestra.");
  expect(actorStudio).toContain("async function addCurrentActorToCast");
  expect(actorStudio).toContain('db.ref(`${scenePath()}/actores/${instanceId}`).set(payload)');
});

test("el Control Maestro puede eliminar una fuente sin borrar al jugador", () => {
  const deletion = block(actorStudio, "async function deleteCurrentActor", "function decorateQuickCast");
  expect(deletion).toContain('db.ref(`${context.root}/${context.actorId}`).remove()');
  expect(deletion).toContain('db.ref(`${ROOTS.players}/${linkedPlayer}/actorId`).remove()');
  expect(deletion).toContain('db.ref(`${scenePath()}/actores/${instanceId}`).remove()');
  expect(deletion).toContain("El jugador, si existe, NO se elimina");
});

test("Actor Master separa icono de sprite en datos y cast", () => {
  const payload = block(actorStudio, "function buildPayload", "async function syncPlayerLink");
  expect(payload).toContain("icono:");
  expect(payload).toContain("sprite:");
  const cast = block(actorStudio, "async function addCurrentActorToCast", "async function deleteCurrentActor");
  expect(cast).toContain("icono: actor.icono");
  expect(cast).toContain("sprite: baseSprite");
});

test("instance-control carga Master Control solo en dashboard DM", () => {
  expect(instanceControl).toContain("function ensureDashboardActorStudioAssets");
  expect(instanceControl).toContain("css/theatre-actor-studio.css");
  expect(instanceControl).toContain("js/theatre-actor-studio.js");
  expect(instanceControl).toContain('body?.classList.contains("on-game-dashboard")');
});

test("los observers quedan acotados", () => {
  expect(actorStudio).not.toContain("observer.observe(doc.body");
  expect(actorStudio).toContain("observe(liveList, { childList: true, subtree: true })");
  expect(playerUx).not.toContain("observe(doc.body");
});
