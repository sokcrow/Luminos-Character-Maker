import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const legacyCreator = fs.readFileSync("creacion_personaje.html", "utf8");
const match = legacyCreator.match(/const backgroundsData\s*=\s*(\[[\s\S]*?\]);/);
assert.ok(match, "Legacy creation data must be present");
const creatorEntries = JSON.parse(match[1].replace(/^\s*\/\/.*$/gm, ""));

function node(tag = "div", className = "") {
  return {
    tag, className, children: [], dataset: {}, attributes: {}, hidden: false,
    classList: { add() {}, remove() {}, toggle() {} },
    append(...items) { this.children.push(...items); },
    appendChild(item) { this.children.push(item); return item; },
    replaceChildren(...items) { this.children = items; },
    setAttribute(name, value) { this.attributes[name] = value; },
    addEventListener() {},
    get childElementCount() { return this.children.length; },
    get isConnected() { return true; },
  };
}
function textContent(item) {
  return [item?.textContent || "", ...(item?.children || []).flatMap(textContent)].filter(Boolean).join(" | ");
}

const document = {
  head: node("head"),
  getElementById() { return null; },
  createElement(tag) { return node(tag); },
  querySelector() { return null; },
};
const engine = {
  createState: () => ({}),
  normalizeTrait: (trait) => trait,
  listAvailableTraitActions: () => [],
};
const scope = { document, console, LuminousTraitEngine: engine };
scope.window = scope;
const context = vm.createContext(scope);
function load(path) { vm.runInContext(fs.readFileSync(path, "utf8"), context, { filename: path }); }
load("js/legacy-background-catalog.js");
load("js/trait-player-tray.js");

const catalog = scope.LuminousLegacyBackgroundCatalog;
const trayApi = scope.LuminousTraitPlayerTray;
assert.equal(catalog.all().length, 18, "All 18 legacy backgrounds must remain available");
assert.equal(new Set(catalog.all().map((item) => item.id)).size, 18, "All legacy IDs must be unique");
assert.equal(catalog.get("nonexistent"), null);

for (const original of creatorEntries) {
  const migrated = catalog.get(original.id);
  assert.ok(migrated, "Creator background must be supported: " + original.id);
  assert.equal(migrated.name, original.name);
  assert.equal(migrated.description, original.desc);
  assert.equal(migrated.benefit, original.benefit);
  assert.equal(migrated.initialFunds, original.funds);

  const character = {
    backgroundId: original.id,
    psychologicalBackgroundId: "el_apostador",
    psychologicalIdeal: "Valentía",
    psychologicalVinculo: "Amistad",
    psychologicalGrieta: "Desconfianza",
  };
  const tray = new trayApi.TraitPlayerTray({ getRuntime: () => ({ character }), getTraits: () => [] });
  tray.backgroundPanel = node("section");
  tray.renderBackground();
  const summary = textContent(tray.backgroundPanel);
  assert.ok(summary.includes(original.name), "Missing saved background name: " + original.id);
  assert.ok(summary.includes(original.desc), "Missing description: " + original.id);
  assert.ok(summary.includes(original.benefit), "Missing original benefit: " + original.id);
  assert.ok(summary.includes(original.funds), "Missing starting funds: " + original.id);
  assert.ok(summary.includes("NO REPRESENTA EL SALDO ACTUAL"), "Do not report original funds as current balance");
  assert.ok(summary.includes("Valentía"), "Saved psychological choices should be visible");
  assert.ok(!summary.includes("HP COEF +0.00"), "Legacy creator does not grant HP Coef");

  const trait = tray.renderNarrativeBackgroundTrait(tray.currentBackground());
  assert.ok(trait, "Legacy background must have visible Background Trait: " + original.id);
  const traitText = textContent(trait);
  assert.ok(traitText.includes(original.benefit));
  assert.ok(traitText.includes("no las suma de nuevo"), "Never double-apply legacy modifiers");
  tray.root = node("section");
  tray.render();
  const filters = tray.root.children[0];
  const backgroundFilter = filters.children.find((item) => item.dataset.traitFilter === "background");
  assert.ok(backgroundFilter, "Background Trait filter must be shown: " + original.id);
  tray.filter = "background";
  tray.render();
  assert.ok(textContent(tray.root).includes(original.benefit), "Background filter must show saved benefits");
}

const canonical = {
  id: "street_medic", name: "Médico de calle",
  overview: "Conoce la medicina callejera",
  feature: { name: "Street Clinic Network", description: "Contactos sanitarios" },
  trait: { name: "Patchwork Medicine", description: "+X Power" },
};
scope.LuminousBackgroundNarratives = { get(id) { return id === canonical.id ? canonical : null; } };
scope.LuminousCharacterBuildRules = {
  getBackground(id) { return id === canonical.id ? { id, name: canonical.name, hpCoefBonus: 0.14 } : null; },
};
const canonicalCharacter = { characterBuild: { backgroundId: canonical.id, breakdown: { backgroundHpCoefBonus: 0.14 } } };
const tray = new trayApi.TraitPlayerTray({ getRuntime: () => ({ character: canonicalCharacter }), getTraits: () => [] });
tray.backgroundPanel = node("section");
tray.renderBackground();
assert.ok(textContent(tray.backgroundPanel).includes(canonical.feature.name), "Canonical feature must remain");
assert.ok(textContent(tray.backgroundPanel).includes("HP COEF +0.14"), "Canonical HP coefficient must remain");
const canonicalTraitText = textContent(tray.renderNarrativeBackgroundTrait(tray.currentBackground()));
assert.ok(canonicalTraitText.includes("Patchwork Medicine"));
assert.ok(canonicalTraitText.includes("un bono de Power"), "Unbalanced numeric placeholder must not appear in player UI");
assert.ok(!canonicalTraitText.includes("+X"), "Player UI must not show internal X placeholder");
const page = node("stats-page");
const ability = node("ability"), content = node("stats");
page.querySelector = (selector) => selector.includes("ability-bar") ? ability : selector.includes("stat-content") ? content : null;
page.querySelectorAll = () => [];
tray.statsConsole = page;
tray.host = node("traits-host");
tray.setStatsView("background");
assert.equal(tray.backgroundPanel.hidden, false);
assert.equal(tray.host.hidden, true);
assert.equal(ability.hidden, true);
tray.setStatsView("traits");
assert.equal(tray.backgroundPanel.hidden, true);
assert.equal(tray.host.hidden, false);
tray.setStatsView("stats");
assert.equal(content.hidden, false);


load("js/character-build-rules.js");
const realRules = scope.LuminousCharacterBuildRules;
const archivedIds = ["house_spiders_apprentice", "house_spiders_survivor"];
const selectableIds = new Set(realRules.backgroundGroups().flatMap((group) => group.entries.map((entry) => entry.id)));

for (const id of archivedIds) {
  assert.ok(!selectableIds.has(id), "Archived background must not be offered to new builds: " + id);
  const original = realRules.getBackground(id);
  assert.ok(original?.retired, "Archived background must remain resolvable: " + id);
  assert.ok(original.hpCoefBonus > 0, "Archived HP Coef must be retained");
  const calculation = realRules.calculateBuild({
    level: 1,
    raceId: "human",
    backgroundId: id,
    classes: [{ classId: realRules.CLASSES[0].id, levels: 1 }],
  });
  assert.ok(calculation.valid, "Saved archived builds must remain valid for calculation: " + id);
  assert.equal(calculation.backgroundHpCoefBonus, original.hpCoefBonus);

  const archivedCharacter = { characterBuild: { backgroundId: id } };
  const archivedTray = new trayApi.TraitPlayerTray({
    getRuntime: () => ({ character: archivedCharacter }),
    getTraits: () => [],
  });
  archivedTray.backgroundPanel = node("section");
  archivedTray.renderBackground();
  const archivedSummary = textContent(archivedTray.backgroundPanel);
  assert.ok(archivedSummary.includes(original.name), "Archived character name must be visible: " + id);
  assert.ok(archivedSummary.includes("TRASFONDO ARCHIVADO"), "Archive explanation is required");
  assert.ok(archivedSummary.includes("HP COEF +" + original.hpCoefBonus.toFixed(2)), "Keep archived HP Coef");
  assert.ok(!archivedSummary.includes("VER TRAIT DE BACKGROUND"), "Do not link to a missing Trait");
  assert.equal(archivedTray.renderNarrativeBackgroundTrait(archivedTray.currentBackground()), null);
  archivedTray.root = node("section");
  archivedTray.render();
  assert.ok(!archivedTray.root.children[0].children.some((item) => item.dataset.traitFilter === "background"),
    "Do not offer an empty Background Trait filter");
}

// Exercise the original DM selection helper independently of Firebase and the dashboard UI.
const dmSource = fs.readFileSync("js/dm-player-dnd-studio.js", "utf8");
const archivedSelectorSource = dmSource.match(/  function setSavedBackgroundSelection\([\s\S]*?\n  \}\n\n  function backgroundOptions\(\)/);
assert.ok(archivedSelectorSource, "DM archived-background selection helper must exist");
const options = [];
const select = {
  value: "",
  appendChild(option) { options.push(option); },
  querySelectorAll() { return options.filter((option) => option.dataset.retiredBackground === "true"); },
};
const getField = (id) => id === "dm-player-build-background" ? select : null;
const dmDoc = {
  createElement() {
    return { dataset: {}, value: "", remove() { options.splice(options.indexOf(this), 1); } };
  },
};
const setSavedBackgroundSelection = new Function("field", "rules", "doc",
  archivedSelectorSource[0].replace(/\n  function backgroundOptions\(\)$/, "") + "\nreturn setSavedBackgroundSelection;",
)(getField, () => realRules, dmDoc);
setSavedBackgroundSelection("house_spiders_apprentice");
assert.equal(select.value, "house_spiders_apprentice", "The saved archived selection must be preserved in DM editor");
assert.equal(options.length, 1, "The archived selection must be scoped to the current character");
assert.ok(options[0].textContent.includes("TRASFONDO ARCHIVADO"));
setSavedBackgroundSelection("street_medic");
assert.equal(select.value, "street_medic");
assert.equal(options.length, 0, "Archived option must disappear when a current background is selected");

console.log("PASS: 2/2 House of Spiders origins hidden for new builds, saved coefficients preserved, missing Trait links hidden, and DM replacement remains possible.");

console.log("PASS: 18/18 legacy backgrounds match saved creation data, Background and Traits render, and canonical Stats/Traits/Background tabs remain intact.");
