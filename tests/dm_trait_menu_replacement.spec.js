const { test, expect } = require("@playwright/test");
const { ensureDmTraitLibraryAssets } = require("../js/utils.js");

function fakeElement(tagName = "div") {
  const listeners = {};
  return {
    tagName,
    id: "",
    src: "",
    href: "",
    rel: "",
    async: true,
    textContent: "",
    dataset: {},
    addEventListener(type, handler) { listeners[type] = handler; },
    click() { listeners.click?.(); },
  };
}

function fakeDmDocument() {
  const keywordTab = fakeElement("button");
  keywordTab.dataset.tab = "tab-keywords";
  keywordTab.textContent = "Keywords";

  const keywordPane = fakeElement("div");
  keywordPane.id = "tab-keywords";

  const players = fakeElement("div");
  players.id = "dashboard-jugadores";

  const nav = {
    querySelector(selector) {
      if (selector === '[data-tab="tab-keywords"]' && keywordTab.dataset.tab === "tab-keywords") return keywordTab;
      return null;
    },
  };

  const byId = new Map([
    [keywordPane.id, keywordPane],
    [players.id, players],
  ]);

  const documentRef = {
    head: { appendChild(node) { if (node.id) byId.set(node.id, node); } },
    createElement: fakeElement,
    getElementById(id) {
      if (keywordTab.id === id) return keywordTab;
      return byId.get(id) || null;
    },
    querySelector(selector) {
      if (selector === ".dm-tabs-nav") return nav;
      if (selector === "#dashboard-jugadores") return players;
      return null;
    },
  };

  return { documentRef, keywordTab, keywordPane };
}

test("Traits reutiliza el slot de Keywords sin dejar una pestaña duplicada", () => {
  const { documentRef, keywordTab, keywordPane } = fakeDmDocument();
  const result = ensureDmTraitLibraryAssets(documentRef);

  expect(result.traitTab).toBe(keywordTab);
  expect(keywordTab.id).toBe("dm-tab-traits");
  expect(keywordTab.dataset.tab).toBe("dashboard-traits");
  expect(keywordTab.textContent).toBe("Traits");
  expect(keywordTab.dataset.traitMenuBound).toBe("true");

  // El pane legacy queda inaccesible desde el menú pero permanece para no romper
  // inicialización inline que todavía pueda consultar controles de Keywords.
  expect(documentRef.getElementById("tab-keywords")).toBe(keywordPane);
});
