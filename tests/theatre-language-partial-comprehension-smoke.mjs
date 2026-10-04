import fs from "node:fs";
import assert from "node:assert/strict";
import vm from "node:vm";

function loadBrowserUmdApi(file) {
  const source = fs.readFileSync(file, "utf8");
  const context = { module: { exports: {} }, console };
  vm.runInNewContext(source, context, { filename: file });
  return context.module.exports;
}

const rules = loadBrowserUmdApi("js/theatre-special-language-enforcement-hotfix.js");
const log = loadBrowserUmdApi("js/theatre-special-language-log-hotfix.js");

const definitions = {
  common: { nombre: "Común", universal: true, estilo_ofuscacion: "ellipsis" },
  elvish: { nombre: "Élfico", tipo: "standard", estilo_ofuscacion: "ellipsis" },
  dwarvish: { nombre: "Enano", tipo: "standard", estilo_ofuscacion: "runes" },
  distortion_red: {
    nombre: "Distorsión Roja",
    especial: true,
    tipo: "distortion",
    texto_desconocido: "[No comprendes la Distorsión Roja.]",
  },
};

const normalMessage = {
  idiomaId: "elvish",
  mensaje: "La luna roja cruza sobre el bosque antiguo esta noche.",
  tipo_dialogo: "dialogo",
};

const p0 = [{ idiomas: { elvish: { porcentaje: 0 } } }];
const p40 = [{ idiomas: { elvish: { porcentaje: 40 } } }];
const p100 = [{ idiomas: { elvish: { porcentaje: 100 } } }];

const hidden = rules.resolveLanguageText(normalMessage, definitions, p0);
const partial = rules.resolveLanguageText(normalMessage, definitions, p40);
const full = rules.resolveLanguageText(normalMessage, definitions, p100);

assert.notEqual(hidden, normalMessage.mensaje, "0% knowledge must not expose the original normal-language message");
assert.ok(hidden.includes("…"), "ellipsis languages must hide unknown words with ellipses");
assert.notEqual(partial, normalMessage.mensaje, "partial knowledge must not become a full translation");
assert.ok(partial.includes("…"), "partial knowledge must retain hidden fragments");
assert.notEqual(partial, hidden, "40% knowledge should reveal more than 0%");
assert.equal(full, normalMessage.mensaje, "100% knowledge must reveal the full message");
assert.equal(
  rules.resolveLanguageText(normalMessage, definitions, p40),
  partial,
  "partial comprehension must be deterministic between active Theatre and Log rerenders",
);

assert.equal(
  rules.resolveLanguageKnowledgePercentage(
    [{ idiomas: { elvish: { porcentaje: 20 } } }, { idiomas: { elvish: { porcentaje: 100 } } }],
    "elvish",
    definitions.elvish,
  ),
  20,
  "the first canonical live profile must remain authoritative for language percentage",
);

const runeMessage = { idiomaId: "dwarvish", mensaje: "Piedra hierro juramento.", tipo_dialogo: "dialogo" };
const runes = rules.resolveLanguageText(runeMessage, definitions, [{ idiomas: { dwarvish: { porcentaje: 0 } } }]);
assert.match(runes, /[ᚠ-ᛟ]/u, "runes obfuscation must render runic glyphs");
assert.notEqual(runes, runeMessage.mensaje, "0% runes language must not leak raw text");

const universal = { idiomaId: "common", mensaje: "Esto sí lo entiende cualquiera." };
assert.equal(
  rules.resolveLanguageText(universal, definitions, [{ idiomas: { common: { porcentaje: 0 } } }]),
  universal.mensaje,
  "universal/common language must remain readable",
);

const specialMessage = {
  idiomaId: "distortion_red",
  mensaje: "La carne recuerda el nombre.",
  tipo_dialogo: "dialogo",
};
assert.equal(
  rules.resolveLanguageText(
    specialMessage,
    definitions,
    [{ idiomas: { distortion_red: { porcentaje: 100, entiende: false } } }],
  ),
  definitions.distortion_red.texto_desconocido,
  "special languages stay binary: percentage alone must not bypass ENTIENDE",
);
assert.equal(
  rules.resolveLanguageText(
    specialMessage,
    definitions,
    [{ idiomas: { distortion_red: { porcentaje: 0, entiende: true } } }],
  ),
  specialMessage.mensaje,
  "special languages with ENTIENDE must reveal the full message regardless of percentage",
);

assert.equal(
  log.resolveLogMessageText(normalMessage, definitions, p40, rules),
  partial,
  "Theatre Log must use the same percentage comprehension as the active dialogue",
);

const action = {
  idiomaId: "elvish",
  mensaje: "/em levanta la espada contra el cielo",
  tipo_dialogo: "actuar",
  nombre: "Agatha",
};
const actionLog = log.resolveLogMessageText(action, definitions, p40, rules);
assert.match(actionLog, /^\(Agatha /, "action formatting must survive partial language obfuscation");
assert.ok(!actionLog.includes("/em"), "action command prefix must never leak into the rendered Log");

const logSource = fs.readFileSync("js/theatre-special-language-log-hotfix.js", "utf8");
assert.ok(
  logSource.includes('instance === "teatro" || instance === "combat_theatre"'),
  "language privacy in the Log must initialize in both Theatre and Combat Theater",
);

const catalogSource = fs.readFileSync("js/language-catalog-engine.js", "utf8");
const policySource = fs.readFileSync("js/theatre-language-policy.js", "utf8");
for (const source of [catalogSource, policySource]) {
  assert.ok(
    source.includes("theatre-special-language-enforcement-hotfix.js?v=20261004-language-comprehension-1"),
    "language enforcement runtime must be cache-busted",
  );
  assert.ok(
    source.includes("theatre-special-language-log-hotfix.js?v=20261004-language-comprehension-1"),
    "language Log runtime must be cache-busted",
  );
}

console.log("Theatre language partial comprehension smoke: OK");
