const { test, expect } = require("@playwright/test");
const fs = require("node:fs");
const path = require("node:path");

const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");
const rosterUx = require("../js/character-manager-roster-ux.js");
const uxSource = read("js/character-manager-roster-ux.js");
const loaderSource = read("js/character-manager-language-ux.js");
const cssSource = read("css/character-manager-roster-ux.css");

test("roster search includes faction, type, tags and linked player label", () => {
  const text = rosterUx.actorSearchText({
    actorId: "npc_77",
    actor: {
      nombre: "Operador Gris",
      titulo: "Supervisor",
      faccion: "SINDICATO",
      tipo: "Neutral",
      etiquetas: ["contacto", "muelle"],
    },
  }, "Agatha");

  for (const term of ["operador gris", "npc_77", "supervisor", "sindicato", "neutral", "contacto", "muelle", "agatha"]) {
    expect(text).toContain(term);
  }
});

test("all roster grouping modes are collapsible with independent persisted keys", () => {
  expect(rosterUx.collapseKey("type", "Aliado")).toBe("type:ALIADO");
  expect(rosterUx.collapseKey("faction", "LCB")).toBe("faction:LCB");
  expect(rosterUx.collapseKey("tag", "Contacto")).toBe("tag:CONTACTO");
  expect(uxSource).toContain("collapseKey(state.groupMode, label)");
  expect(uxSource).not.toContain('if (state.groupMode !== "faction") return;');
  expect(uxSource).toContain('entry.includes(":") ? entry : collapseKey("faction", entry)');
  expect(uxSource).toContain('setAttribute("aria-expanded"');
  expect(uxSource).toContain("state.collapsed");
  expect(uxSource).toContain("localStorage");
  expect(cssSource).toContain("position: sticky");
  expect(cssSource).toContain('data-collapsed="true"');
});

test("faction filter stays faction-only while collapse works for type faction and tag", () => {
  expect(uxSource).toContain('select.hidden = state.groupMode !== "faction"');
  expect(uxSource).toContain('state.groupMode !== "faction"');
  expect(uxSource).toContain('GROUP_MODES = ["type", "faction", "tag"]');
});

test("search input is decoupled so the original renderer keeps all 100+ actors available", () => {
  expect(uxSource).toContain('source.hidden = true');
  expect(uxSource).toContain('visible.id = "character-manager-search-ux"');
  expect(uxSource).toContain("actorSearchText(record, playerLabel(record))");
});

test("faction values are never hardcoded", () => {
  expect(rosterUx.factionLabel({ actor: { faccion: "LCB" } })).toBe("LCB");
  expect(rosterUx.factionLabel({ actor: {} })).toBe("SIN FACCIÓN");
  expect(uxSource).not.toMatch(/<option[^>]+value=["']LCB/i);
  expect(uxSource).not.toMatch(/<option[^>]+value=["']FIXER/i);
  expect(uxSource).not.toMatch(/<option[^>]+value=["']SINDICATO/i);
});

test("Character Manager language UX loads the roster extension without changing campaign data", () => {
  expect(loaderSource).toContain("ensureRosterUxAssets");
  expect(loaderSource).toContain("js/character-manager-roster-ux.js");
  expect(loaderSource).toContain("css/character-manager-roster-ux.css");
  expect(uxSource).not.toContain("firebase.database");
  expect(uxSource).not.toContain(".set(");
  expect(uxSource).not.toContain(".update(");
});
