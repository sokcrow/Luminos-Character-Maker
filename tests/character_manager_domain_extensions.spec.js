const { test, expect } = require("@playwright/test");
const fs = require("node:fs");
const path = require("node:path");

const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");
const liveSync = read("js/character-manager-live-sync.js");
const messagePolicy = read("js/theatre-message-policy.js");
const languageCatalog = read("js/language-catalog-engine.js");
const languagePolicy = read("js/theatre-language-policy.js");
const specialLanguageAccess = read("js/theatre-special-language-access.js");
const bondEngine = read("js/bond-engine.js");
const socialStudio = read("js/character-manager-social-studio.js");
const socialCss = read("css/character-manager-social.css");
const dm = read("hoja_de_DM.html");
const utils = read("js/utils.js");
const theatreEngine = read("js/theatre-engine.js");

test("la escala maestra se propaga a instancias vivas por identityId", () => {
  expect(liveSync).toContain("identityId");
  expect(liveSync).toContain("sourceActorId");
  expect(liveSync).toContain('updates[`actores/${instanceId}/escala`] = masterScale');
  expect(liveSync).toContain("manager.subscribeActors");
  expect(liveSync).toContain("sync_master_scale === false");
  expect(dm).toContain('src="js/character-manager-live-sync.js"');
});

test("la política de mensajes permite timing configurable y avance manual", () => {
  expect(messagePolicy).toContain('mode: "auto", speedMs: 30, holdMs: 3000');
  expect(messagePolicy).toContain("calculateDuration");
  expect(messagePolicy).toContain('config.mode === "manual"');
  expect(messagePolicy).toContain("releaseCurrent");
  expect(messagePolicy).toContain("btn-theatre-message-next");
  expect(messagePolicy).toContain('campaña/config/theatre_messages');
  expect(dm.indexOf('src="js/theatre-message-policy.js"')).toBeLessThan(dm.indexOf('src="js/on-game-dashboard.js"'));
});

test("el roster puede agrupar por tipo facción o etiqueta", () => {
  expect(socialStudio).toContain('<option value="type">TIPO</option>');
  expect(socialStudio).toContain('<option value="faction">FACCIÓN</option>');
  expect(socialStudio).toContain('<option value="tag">ETIQUETA</option>');
  expect(socialStudio).toContain("actor.faccion");
  expect(socialStudio).toContain("actor.etiquetas");
  expect(socialStudio).toContain("cm-taxonomy-tags");
  expect(socialCss).toContain(".cm-roster-group");
});

test("etiquetas se persisten mediante Character Manager y no Firebase directo", () => {
  expect(socialStudio).toContain("manager.saveActor");
  expect(socialStudio).toContain("actor: { etiquetas: tags, tags }");
  expect(socialStudio).not.toContain("firebase.database");
  expect(socialStudio).not.toContain("db.ref(");
});

test("Vínculos almacena conocimiento y nivel y alimenta conocimiento de identidad de Theatre", () => {
  expect(bondEngine).toContain('campaña/estado_mundo/vinculos');
  expect(bondEngine).toContain('campaña/teatro/conocimiento_identidad');
  expect(bondEngine).toContain("conocido");
  expect(bondEngine).toContain("nivel");
  expect(bondEngine).toContain("bondLevel");
  expect(socialStudio).toContain("cm-bond-known");
  expect(socialStudio).toContain('type="range" min="0" max="5"');
  expect(theatreEngine).toContain("isIdentityKnown");
});

test("el catálogo D&D se crea sin reemplazar idiomas existentes", () => {
  ["common", "dwarvish", "elvish", "giant", "gnomish", "goblin", "halfling", "orc", "abyssal", "celestial", "draconic", "deep_speech", "infernal", "primordial", "sylvan", "undercommon"].forEach((id) => {
    expect(languageCatalog).toContain(`${id}:`);
  });
  expect(languageCatalog).toContain("Object.prototype.hasOwnProperty.call(merged, languageId)");
  expect(languageCatalog).toContain('const ROOT = "campaña/teatro/idiomas"');
});

test("los idiomas especiales de distorsión conservan gate binario y texto desconocido", () => {
  expect(specialLanguageAccess).toContain('kind === "distortion" ? "distortion" : "special"');
  expect(specialLanguageAccess).toContain("distortion: true");
  expect(specialLanguageAccess).toContain("texto_desconocido: unknownText");
  expect(theatreEngine).toContain("understandsDistortion(profile, languageId)");
  expect(theatreEngine).toContain('"Tik... Tok..."');
});

test("Común es default y los selectores limitan idiomas por conocimiento del hablante", () => {
  expect(languagePolicy).toContain('option.value = ""');
  expect(languagePolicy).toContain('definition?.nombre');
  expect(languagePolicy).toContain("known.porcentaje <= 0");
  expect(languagePolicy).toContain("function speakerKnowledge()");
  expect(languagePolicy).toContain("managerRecord.actor.idiomas");
  expect(languagePolicy).toContain("player-theatre-language-select");
  expect(languagePolicy).toContain("next.idiomaId = languageId");
  expect(dm).toContain('src="js/theatre-language-policy.js"');
  expect(utils).toContain("ensurePlayerTheatreLanguagePolicy");
});

test("las extensiones nuevas no usan emojis como iconografía", () => {
  const uiCode = [messagePolicy, socialStudio, socialCss].join("\n");
  const emojiPresentation = /\p{Extended_Pictographic}/u;
  expect(emojiPresentation.test(uiCode)).toBe(false);
  expect(messagePolicy).toContain("<svg");
  expect(socialStudio).toContain("<svg");
});
