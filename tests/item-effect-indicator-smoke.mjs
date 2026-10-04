import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = path.resolve(".");
const load = (file) => import(pathToFileURL(path.join(root, file)).href);

for (const key of [
  "LuminousItemRuntime",
  "LuminousItemEffectIndicator",
  "LuminousHpHealingCatalog",
  "LuminousSpHealingCatalog",
  "LuminousHybridHealingCatalog",
  "LuminousStatusCureCatalog",
  "LuminousStatusLibrary",
  "STATUS_REGISTRY",
]) delete globalThis[key];

await load("js/item-runtime-engine.js");
await load("js/item-catalog-hp-healing.js");
await load("js/item-catalog-sp-healing.js");
await load("js/item-catalog-hybrid-healing.js");
await load("js/item-catalog-status-cure.js");
await load("js/status-library.js");
await load("js/item-effect-indicator.js");

const runtime = globalThis.LuminousItemRuntime;
const indicator = globalThis.LuminousItemEffectIndicator;
const hpCatalog = globalThis.LuminousHpHealingCatalog;
const spCatalog = globalThis.LuminousSpHealingCatalog;
const hybridCatalog = globalThis.LuminousHybridHealingCatalog;
const cureCatalog = globalThis.LuminousStatusCureCatalog;

assert.ok(runtime);
assert.ok(indicator);

const unit = { hp: 50, hp_max: 180, sp: 0, sp_max: 45 };

const hpItem = hpCatalog.get("hp_generic_pocket_recovery_patch");
const hpIndicators = indicator.indicators(hpItem, unit, { runtime });
assert.ok(hpIndicators.some((entry) => entry.kind === "hp" && entry.label === "HP +7"), "50/180 Pocket Recovery Patch should advertise HP +7");

const hpRegenItem = hpCatalog.get("hp_generic_slowburn_strip");
const hpRegenIndicators = indicator.indicators(hpRegenItem, unit, { runtime });
assert.ok(hpRegenIndicators.some((entry) => entry.kind === "hp_regen" && entry.label === "HP REGEN +2 ×2"), "HP regen badge should show floored tick amount and turns");

const spItem = spCatalog.get("sp_generic_pocket_focus_tablets");
const spIndicators = indicator.indicators(spItem, unit, { runtime });
assert.ok(spIndicators.some((entry) => entry.kind === "sp" && entry.label === "SP +2"));

const spRegenItem = spCatalog.get("sp_generic_slowbreath_strip");
const spRegenIndicators = indicator.indicators(spRegenItem, unit, { runtime });
assert.ok(spRegenIndicators.some((entry) => entry.kind === "sp_regen" && entry.label === "SP REGEN +1 ×2"));

const hybrid = hybridCatalog.ITEMS.find((entry) => entry.runtime?.hybridHealing?.hp?.regen) || hybridCatalog.ITEMS[0];
const hybridIndicators = indicator.indicators(hybrid, unit, { runtime });
assert.ok(hybridIndicators.some((entry) => entry.kind === "hp"));
assert.ok(hybridIndicators.some((entry) => entry.kind === "sp"));

const cure = cureCatalog.ITEMS.find((entry) => entry.runtime?.statusCure?.statusAdjustments?.some((adj) => adj.statusId === "bleed"));
assert.ok(cure);
const cureIndicators = indicator.indicators(cure, unit, { runtime, statusLibrary: globalThis.LuminousStatusLibrary });
const bleed = cureIndicators.find((entry) => entry.kind === "cleanse" && entry.statusId === "bleed");
assert.ok(bleed, "Bleed cleanse should expose a status indicator");
assert.ok(bleed.icon, "Bleed cleanse should reuse the canonical status icon");
assert.match(bleed.detail, /Bleed/i);

const regenRuntimeItem = {
  ...spRegenItem,
  instanceId: "sp_regen_test",
  quantity: 1,
  cantidad: 1,
};
const regenUnit = {
  id: "regen-unit",
  hp: 100,
  hp_max: 100,
  sp: 0,
  sp_max: 45,
  inventario_activo: { sp_regen_test: regenRuntimeItem },
};
const used = runtime.useItem(regenUnit, regenRuntimeItem, { ignoreActionCost: true });
assert.equal(used.used, true);
assert.equal(regenUnit.sp, 1, "SP regen item should apply its immediate SP restoration");
assert.ok(regenUnit.itemRuntimeEffects?.some((entry) => entry.kind === "sp_regen"), "SP regen item should create a live regen effect");

runtime.processTurnStartEffects(regenUnit, { round: 1 });
assert.equal(regenUnit.sp, 2);
runtime.processTurnStartEffects(regenUnit, { round: 2 });
assert.equal(regenUnit.sp, 3);
assert.equal(regenUnit.itemRuntimeEffects?.some((entry) => entry.kind === "sp_regen"), false, "SP regen should expire after its configured turns");

const offCombatTimed = {
  runtime: {
    actionCost: "off_combat",
    healing: {
      flat: 0,
      maxHpPercent: 0,
      capMaxHpPercent: 100,
      regen: { flatPerTurn: 5, durationMinutes: 30 },
    },
  },
};
const timed = indicator.indicators(offCombatTimed, unit, { runtime });
const timedBadge = timed.find((entry) => entry.kind === "hp_regen");
assert.ok(timedBadge);
assert.match(timedBadge.label, /30m/);
assert.match(timedBadge.detail, /off combat/i);

console.log("item effect indicator smoke: OK (HP/SP/Regen/Cleanse + SP regen runtime)");
