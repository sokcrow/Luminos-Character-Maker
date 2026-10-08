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

console.log("PASS: 18/18 legacy backgrounds match saved creation data, Background and Traits render, and canonical Stats/Traits/Background tabs remain intact.");
