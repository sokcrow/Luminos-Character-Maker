const { test, expect } = require("@playwright/test");
const fs = require("node:fs");
const path = require("node:path");

const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");
const dmHtml = read("pantalla_dm.html");
const editorUx = read("js/dm-character-editor-ux.js");
const editorCss = read("css/dm-character-editor-ux.css");
const utils = read("js/utils.js");

test("Gestión de Personajes conserva un editor real y botones Editar", () => {
  expect(dmHtml).toContain('id="dashboard-actores"');
  expect(dmHtml).toContain('class="actor-studio-wrapper"');
  expect(dmHtml).toContain('id="actor-nombre"');
  expect(dmHtml).toContain('id="btn-crear-actor"');
  expect(dmHtml).toContain('btnEdit.textContent = "Editar"');
  expect(dmHtml).toContain("loadActorIntoFormInternal(actor.id, actor)");
});

test("el wrapper normaliza etiquetas legacy antes de abrir el editor", () => {
  expect(editorUx).toContain("function normalizeTags");
  expect(editorUx).toContain("Array.isArray(value)");
  expect(editorUx).toContain('typeof value === "string"');
  expect(editorUx).toContain('value.split(",")');
  expect(editorUx).toContain("normalizeActorForEditor(actorData)");
  expect(editorUx).toContain("etiquetas: normalizeTags(source.etiquetas)");
});

test("expresiones legacy aceptan string u objeto de sprite", () => {
  expect(editorUx).toContain("function expressionUrl");
  expect(editorUx).toContain("value.sprite || value.url || value.imagen || value.image");
  expect(editorUx).toContain("function normalizeExpressions");
});

test("Editar lleva al Actor Studio y ofrece feedback inequívoco", () => {
  expect(editorUx).toContain("function ensureEditContext");
  expect(editorUx).toContain('wrapper.classList.add("dm-character-editor-active")');
  expect(editorUx).toContain("EDITANDO FUENTE");
  expect(editorUx).toContain('stateBanner.textContent = "EDITANDO"');
  expect(editorUx).toContain('save.textContent = "GUARDAR CAMBIOS"');
  expect(editorUx).toContain('wrapper.scrollIntoView({ behavior: "smooth", block: "start" })');
  expect(editorUx).toContain('getElementById("actor-nombre")?.focus');
});

test("la función existente queda envuelta sin reescribir la persistencia", () => {
  expect(editorUx).toContain("const original = global.loadActorIntoFormInternal");
  expect(editorUx).toContain("original.call(this, actorId, normalized)");
  expect(editorUx).toContain("global.loadActorIntoFormInternal = wrappedLoadActorIntoForm");
  expect(editorUx).not.toContain("firebase.database");
  expect(editorUx).not.toContain("db.ref(");
});

test("si un actor legacy falla al cargar se conserva un fallback visible", () => {
  expect(editorUx).toContain("function populateSafeFallback");
  expect(editorUx).toContain("aplicando fallback seguro");
  expect(editorUx).toContain("finally");
  expect(editorUx).toContain("ensureEditContext(actorId, normalized)");
});

test("utils carga el arreglo solo en Gestión de Personajes del DM", () => {
  expect(utils).toContain("function ensureDmCharacterEditorAssets");
  expect(utils).toContain("#dashboard-actores");
  expect(utils).toContain("css/dm-character-editor-ux.css");
  expect(utils).toContain("js/dm-character-editor-ux.js");
  expect(utils).toContain("ensureDmCharacterEditorAssets(document)");
});

test("el modo edición tiene contraste visual propio", () => {
  expect(editorCss).toContain(".dm-character-editor-active");
  expect(editorCss).toContain(".dm-character-edit-context");
  expect(editorCss).toContain("#btn-crear-actor");
  expect(editorCss).toContain("scroll-margin-top");
});
