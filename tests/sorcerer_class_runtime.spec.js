const { test, expect } = require("@playwright/test");

function freshModules() {
  delete global.LuminousSorcererClassRuntime;
  delete global.LuminousTraitCatalogCore;
  delete global.LuminousTraitEngine;
  delete global.LuminousSpellcastingRuntime;
  delete global.LuminousUniversalSpeedRuntime;
  delete global.LuminousCasterSpellcastingTraitsRuntime;

  const paths = [
    "../js/trait-engine.js",
    "../js/trait-catalog-core.js",
    "../js/spellcasting-runtime.js",
    "../js/spellcasting-basic-rules-runtime.js",
    "../js/caster-spellcasting-traits-runtime.js",
    "../js/universal-speed-runtime.js",
    "../js/sorcerer-class-runtime.js",
  ];
  paths.forEach((path) => { delete require.cache[require.resolve(path)]; });

  require("../js/trait-engine.js");
  require("../js/trait-catalog-core.js");
  require("../js/spellcasting-runtime.js");
  require("../js/spellcasting-basic-rules-runtime.js");
  require("../js/caster-spellcasting-traits-runtime.js");
  require("../js/universal-speed-runtime.js");
  return require("../js/sorcerer-class-runtime.js");
}

function sorcerer(level, extra = {}) {
  return {
    stats: { cha: 20 },
    classes: [{ classId: "sorcerer", classLevel: level }],
    ...extra,
  };
}

test.describe("Sorcerer base class runtime", () => {
  test("registers base class traits and grants without duplicating Spellcasting", () => {
    const runtime = freshModules();
    const catalog = global.LuminousTraitCatalogCore;
    const definitions = catalog.allDefinitions();
    const grants = catalog.allGrants();

    expect(definitions.sorcerous_origin.name).toBe("Sorcerous Origin");
    expect(definitions.font_of_magic.name).toBe("Font of Magic");
    expect(definitions.metamagic.name).toBe("Metamagic");
    expect(definitions.sorcerous_restoration.name).toBe("Sorcerous Restoration");
    expect(runtime.METAMAGIC_IDS).toHaveLength(10);
    runtime.METAMAGIC_IDS.forEach((id) => expect(definitions[id].mechanics.metamagicOption).toBe(true));

    const sorcererGrants = grants.filter((grant) => grant.sourceId === "sorcerer");
    expect(sorcererGrants.some((grant) => grant.traitId === "sorcerous_origin" && grant.atLevel === 1)).toBe(true);
    expect(sorcererGrants.some((grant) => grant.traitId === "font_of_magic" && grant.atLevel === 10)).toBe(true);
    expect(sorcererGrants.some((grant) => grant.traitId === "metamagic" && grant.atLevel === 15)).toBe(true);
    expect(sorcererGrants.some((grant) => grant.traitId === "sorcerous_restoration" && grant.atLevel === 100)).toBe(true);
    expect(sorcererGrants.filter((grant) => grant.traitId === "spellcasting_ability_sorcerer")).toHaveLength(1);
  });

  test("Sorcery Points scale from Sorcerer Class Level and respect recovery", () => {
    const runtime = freshModules();
    const character = sorcerer(15);
    expect(runtime.sorceryPointMaximum(sorcerer(9))).toBe(0);
    expect(runtime.sorceryPointMaximum(character)).toBe(3);
    expect(runtime.sorceryPointPool(character)).toEqual({ current: 3, maximum: 3, available: 3 });

    expect(runtime.spendSorceryPoints(character, 2).success).toBe(true);
    expect(runtime.sorceryPointPool(character).current).toBe(1);
    runtime.handleRest(character, "long_rest");
    expect(runtime.sorceryPointPool(character).current).toBe(3);

    character.classes[0].classLevel = 100;
    runtime.ensureSorcererState(character);
    runtime.recoverAllSorceryPoints(character);
    runtime.spendSorceryPoints(character, 20);
    expect(runtime.sorceryPointPool(character).current).toBe(0);
    runtime.handleRest(character, "short_rest");
    expect(runtime.sorceryPointPool(character).current).toBe(4);
  });

  test("Font of Magic creates and converts Spell Slots", () => {
    const runtime = freshModules();
    const character = sorcerer(15);

    const created = runtime.createSpellSlot(character, 1);
    expect(created.success).toBe(true);
    expect(created.cost).toBe(2);
    expect(runtime.sorceryPointPool(character).current).toBe(1);
    expect(runtime.temporarySpellSlotPool(character)["1"]).toBe(1);

    runtime.spendSorceryPoints(character, 1);
    const converted = runtime.convertSpellSlotToSorceryPoints(character, 1);
    expect(converted.success).toBe(true);
    expect(converted.recovered).toBe(1);
    expect(runtime.temporarySpellSlotPool(character)["1"]).toBe(0);
    expect(runtime.sorceryPointPool(character).current).toBe(1);

    runtime.grantTemporarySpellSlot(character, 5);
    runtime.handleRest(character, "long_rest");
    expect(runtime.temporarySpellSlotPool(character)["5"]).toBe(0);
  });

  test("Metamagic option count follows CL15, CL50 and CL85", () => {
    const runtime = freshModules();
    expect(runtime.metamagicChoiceCount(sorcerer(14))).toBe(0);
    expect(runtime.metamagicChoiceCount(sorcerer(15))).toBe(2);
    expect(runtime.metamagicChoiceCount(sorcerer(50))).toBe(3);
    expect(runtime.metamagicChoiceCount(sorcerer(85))).toBe(4);
  });

  test("Distant, Empowered, Subtle and Seeking use Limbus combat semantics", () => {
    const runtime = freshModules();
    const character = sorcerer(85);
    runtime.setKnownMetamagics(character, ["distant_spell", "empowered_spell", "subtle_spell", "seeking_spell"]);

    let result = runtime.applyMetamagic(character, { level: 1 }, "distant_spell", {
      caster: { speed: 8 },
      target: { speed: 4 },
    });
    expect(result.success).toBe(true);
    expect(result.spell.clashPowerBonus).toBe(3);

    runtime.recoverAllSorceryPoints(character);
    result = runtime.applyMetamagic(character, { level: 1 }, "empowered_spell");
    expect(result.spell.finalPowerBonus).toBe(3);

    runtime.recoverAllSorceryPoints(character);
    result = runtime.applyMetamagic(character, { level: 1 }, "subtle_spell");
    expect(result.spell.isUnclashable).toBe(true);
    expect(result.spell.isClashable).toBe(false);

    runtime.recoverAllSorceryPoints(character);
    result = runtime.applyMetamagic(character, {
      level: 1,
      coinType: "normal",
      coins: [{ type: "normal" }, { type: "normal" }],
    }, "seeking_spell");
    expect(result.spell.coinType).toBe("unbreakable");
    expect(result.spell.coins.every((coin) => coin.type === "unbreakable")).toBe(true);
  });

  test("Twinned, Quickened, Extended and Heightened transform only their intended channels", () => {
    const runtime = freshModules();
    const character = sorcerer(85);
    runtime.setKnownMetamagics(character, ["twinned_spell", "quickened_spell", "extended_spell", "heightened_spell"]);

    let result = runtime.applyMetamagic(character, { level: 3, attackWeight: 1, targetType: "single" }, "twinned_spell");
    expect(result.success).toBe(true);
    expect(result.cost).toBe(3);
    expect(result.spell.attackWeight).toBe(2);
    expect(result.spell.metamagic.twinned.additionalTargetFaction).toBe("enemy");

    runtime.recoverAllSorceryPoints(character);
    result = runtime.applyMetamagic(character, { level: 1, castingTime: "action" }, "quickened_spell");
    expect(result.success).toBe(true);
    expect(result.spell.castingTimeSeconds).toBe(3);
    expect(result.spell.actionCost).toBe("quick_action");

    runtime.recoverAllSorceryPoints(character);
    result = runtime.applyMetamagic(character, { level: 1, durationSeconds: 120 }, "extended_spell");
    expect(result.success).toBe(true);
    expect(result.spell.durationSeconds).toBe(240);

    runtime.recoverAllSorceryPoints(character);
    result = runtime.applyMetamagic(character, { level: 1 }, "heightened_spell", { target: { id: "enemy-1" } });
    expect(result.success).toBe(true);
    expect(result.spell.metamagic.heightened).toEqual({ targetId: "enemy-1", thresholdBonus: 5, firstSaveOnly: true });
  });

  test("Careful and Transmuted preserve their Limbus-specific targeting and Sin rules", () => {
    const runtime = freshModules();
    const character = sorcerer(85);
    runtime.setKnownMetamagics(character, ["careful_spell", "transmuted_spell"]);

    let result = runtime.applyMetamagic(character, { level: 1, isIndiscriminate: true }, "careful_spell", {
      protectedUnits: [{ id: "ally-1" }, { id: "ally-2" }, { id: "ally-3" }, { id: "ally-4" }, { id: "ally-5" }, { id: "ally-6" }],
    });
    expect(result.success).toBe(true);
    expect(result.spell.metamagic.careful.maximumUnits).toBe(5);
    expect(result.spell.metamagic.careful.autoSaveSuccessUnitIds).toHaveLength(5);

    runtime.recoverAllSorceryPoints(character);
    result = runtime.applyMetamagic(character, {
      level: 1,
      sinAffinity: "wrath",
      effects: [{ sinType: "wrath", inflict: "example" }, { sinType: "pride", inflict: "unchanged" }],
    }, "transmuted_spell", { sinType: "gloom" });
    expect(result.success).toBe(true);
    expect(result.spell.sinAffinity).toBe("gloom");
    expect(result.spell.effects[0].sinType).toBe("gloom");
    expect(result.spell.effects[1].sinType).toBe("pride");
  });

  test("Empowered or Seeking may combine with one other Metamagic, but arbitrary pairs may not", () => {
    const runtime = freshModules();
    const character = sorcerer(85);
    runtime.setKnownMetamagics(character, ["empowered_spell", "seeking_spell", "subtle_spell", "distant_spell"]);

    let result = runtime.applyMetamagic(character, { level: 1 }, ["empowered_spell", "subtle_spell"]);
    expect(result.success).toBe(true);
    expect(result.spell.finalPowerBonus).toBe(3);
    expect(result.spell.isUnclashable).toBe(true);

    runtime.recoverAllSorceryPoints(character);
    result = runtime.applyMetamagic(character, { level: 1 }, ["distant_spell", "subtle_spell"]);
    expect(result.success).toBe(false);
    expect(result.reason).toContain("Only one Metamagic");
  });
});
