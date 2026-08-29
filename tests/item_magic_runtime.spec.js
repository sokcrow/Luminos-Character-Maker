const { test, expect } = require("@playwright/test");

global.LuminousItemRuntime = require("../js/item-runtime-engine.js");
global.LuminousItemInventoryRuntime = require("../js/item-inventory-runtime.js");
global.LuminousSpellcastingRuntime = require("../js/spellcasting-runtime.js");
const magic = require("../js/item-magic-runtime.js");

test("attunement respects capacity and stores instance ids", () => {
  const user = { id: "player_1", attunementCapacity: 1 };
  const first = { instanceId: "ring_1", requiresAttunement: true };
  const second = { instanceId: "ring_2", requiresAttunement: true };

  expect(magic.attuneItem(user, first).attuned).toBe(true);
  expect(magic.isAttuned(user, first)).toBe(true);
  const blocked = magic.attuneItem(user, second);
  expect(blocked.attuned).toBe(false);
  expect(blocked.reason).toBe("attunement_capacity_reached");
});

test("item spell execution spends charges only after executor succeeds", () => {
  const user = { id: "caster" };
  const item = {
    instanceId: "wand_1",
    chargesCurrent: 3,
    chargesMax: 3,
    runtime: { magic: { spells: [{ spellId: "spell:bolt", chargeCost: 2, spellDC: 15 }] } },
  };

  const noExecutor = magic.castSpellFromItem(user, item, "spell:bolt");
  expect(noExecutor.cast).toBe(false);
  expect(noExecutor.reason).toBe("spell_executor_unavailable");
  expect(item.chargesCurrent).toBe(3);

  const cast = magic.castSpellFromItem(user, item, "spell:bolt", {
    executeSpell(payload) { return { executed: true, spellId: payload.spellId }; },
  });
  expect(cast.cast).toBe(true);
  expect(item.chargesCurrent).toBe(1);
});

test("attuned items reject spell activation until attuned", () => {
  const user = { id: "caster" };
  const item = {
    instanceId: "staff_1",
    requiresAttunement: true,
    chargesCurrent: 2,
    chargesMax: 2,
    runtime: { magic: { spells: [{ spellId: "spell:ward", chargeCost: 1 }] } },
  };

  expect(magic.canActivateSpellFromItem(user, item, "spell:ward").reason).toBe("item_not_attuned");
  expect(magic.attuneItem(user, item).attuned).toBe(true);
  expect(magic.canActivateSpellFromItem(user, item, "spell:ward").allowed).toBe(true);
});

test("spell scroll is consumed only after successful spell execution", () => {
  const user = { id: "caster" };
  const scroll = {
    instanceId: "scroll_1",
    definitionId: "item:spell_scroll",
    category: "spell_scroll",
    quantity: 2,
    runtimeState: { spellId: "spell:test" },
    runtime: { magic: { spells: [{ spellId: "spell:test", chargeCost: 0 }] } },
  };

  const failed = magic.useSpellScroll(user, scroll);
  expect(failed.used).toBe(false);
  expect(scroll.quantity).toBe(2);

  const used = magic.useSpellScroll(user, scroll, {
    executeSpell() { return { executed: true }; },
  });
  expect(used.used).toBe(true);
  expect(scroll.quantity).toBe(1);
});

test("curse state is explicit and removable", () => {
  const user = { id: "player" };
  const item = { instanceId: "blade_1", runtime: { curse: { id: "binding" } } };
  expect(magic.isCursed(item)).toBe(true);
  expect(magic.revealCurse(item).revealed).toBe(true);
  expect(magic.applyCurse(user, item).applied).toBe(true);
  expect(user.itemCurses).toHaveLength(1);
  expect(magic.removeCurse(user, item).removed).toBe(true);
  expect(user.itemCurses).toHaveLength(0);
});
