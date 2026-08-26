const { test, expect } = require("@playwright/test");
const fs = require("node:fs");
const path = require("node:path");

const tooltipRuntime = require("../js/player-stat-tooltip-runtime.js");
const splashRuntime = fs.readFileSync(path.join(__dirname, "..", "js/player-splash-framing.js"), "utf8");

test("tooltip del Mod muestra solo fuentes distintas de cero", () => {
  const parts = tooltipRuntime.modifierContributions({
    baseScore: 14,
    proficiency: 2,
    racialScoreBonus: 2,
    backgroundScoreBonus: 0,
    traitsScoreBonus: -2,
  });

  expect(tooltipRuntime.buildModifierTooltip(parts)).toBe([
    "Mod actual: +4",
    "+2 Mod",
    "+2 Proficiency",
    "+1 Racial",
    "-1 Traits",
  ].join("\n"));
});

test("tooltip conserva Mod actual 0 pero oculta todas las fuentes en 0", () => {
  const parts = tooltipRuntime.modifierContributions({ baseScore: 10 });
  expect(tooltipRuntime.buildModifierTooltip(parts)).toBe("Mod actual: +0");
});

test("bonos de Score se convierten a aporte real del Mod sin doble conteo", () => {
  const parts = tooltipRuntime.modifierContributions({
    baseScore: 11,
    racialScoreBonus: 1,
    backgroundScoreBonus: 1,
    traitsScoreBonus: 1,
  });

  expect(parts.baseModifier).toBe(0);
  expect(parts.racial).toBe(1);
  expect(parts.background).toBe(0);
  expect(parts.traits).toBe(1);
  expect(parts.total).toBe(2);
  expect(tooltipRuntime.buildModifierTooltip(parts)).not.toContain("+0 Mod");
  expect(tooltipRuntime.buildModifierTooltip(parts)).not.toContain("Background");
});

test("runtime se carga tanto en Player como DM desde el bridge compartido", () => {
  expect(splashRuntime).toContain('script.id = "player-stat-tooltip-runtime-script"');
  expect(splashRuntime).toContain('script.src = "js/player-stat-tooltip-runtime.js"');
  expect(splashRuntime).toContain("ensureStatModifierTooltipRuntime();");
});

test("runtime aplica el mismo desglose al HUD del jugador y al editor del DM", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "js/player-stat-tooltip-runtime.js"), "utf8");
  expect(source).toContain("function syncPlayerTooltip()");
  expect(source).toContain("function syncDmTooltips()");
  expect(source).toContain('panel.querySelector("[data-stat-modifier]")');
  expect(source).toContain('doc.getElementById(`dm-player-stat-${ability.id}`)');
  expect(source).toContain("if (value === 0) return;");
});
