"use strict";

const assert = require("assert");

require("../js/item-quality-engine.js");
require("../js/item-catalog-ore-ingot-gem.js");

const Catalog = globalThis.LuminousOreIngotGemCatalog;
assert.ok(Catalog);
assert.strictEqual(Catalog.VERSION,5);

const expectedProfiles = {
  ruby: {
    resonances:["fire","heat"],
    affinities:["fire","heat","vigor","hp","regeneration","fire_resistance"],
  },
  sapphire: {
    resonances:["cold","ice"],
    affinities:["cold","ice","sp","intelligence","focus","cold_resistance","control"],
  },
  aquamarine: {
    resonances:["water","flow"],
    affinities:["water","flow","mobility","dodge","recovery","cleansing","water_resistance"],
  },
  topaz: {
    resonances:["lightning","energy"],
    affinities:["lightning","energy","speed","initiative","movement","acceleration","lightning_resistance"],
  },
  garnet: {
    resonances:["blood","physical"],
    affinities:["blood","physical","strength","physical_damage","bleed","max_hp","endurance"],
  },
  emerald: {
    resonances:["vitality","nature"],
    affinities:["vitality","nature","max_hp","healing","regeneration","poison_resistance","recovery"],
  },
  amethyst: {
    resonances:["arcane","mental"],
    affinities:["arcane","mental","intelligence","sp","spell_power","focus","mental_resistance"],
  },
  onyx: {
    resonances:["shadow","necrotic"],
    affinities:["shadow","necrotic","life_drain","stealth","necrotic_resistance","curse"],
  },
  moonstone: {
    resonances:["spirit"],
    affinities:["spirit","sp","sanity","spirit_resistance","attunement","support"],
  },
  opal: {
    resonances:["prismatic"],
    affinities:["prismatic","adaptive_resistance","multi_element","resonance_blend"],
  },
  diamond: {
    resonances:["light","force"],
    affinities:["light","force","defense","barrier","armor","light_resistance","force_resistance"],
  },
  starstone_exotic_gem: {
    resonances:["exotic"],
    affinities:["exotic","rare_enchantment","relic_interaction","anomalous_magic"],
  },
};

assert.strictEqual(Object.keys(Catalog.GEM_MAGIC_PROFILES).length, 12);

for (const [id, expected] of Object.entries(expectedProfiles)) {
  const cut = Catalog.get(id);
  const rough = Catalog.get(`rough_${id}`);
  assert.ok(cut, id);
  assert.ok(rough, `rough_${id}`);

  const cutProfile = Catalog.gemMagicProfile(cut);
  const roughProfile = Catalog.gemMagicProfile(rough);

  assert.deepStrictEqual(cut.resonanceTags, expected.resonances, `${id} canonical resonance must stay unchanged`);
  assert.deepStrictEqual(cutProfile.resonances, expected.resonances, `${id} profile resonance must mirror resonanceTags`);
  assert.deepStrictEqual(cutProfile.enchantmentAffinities, expected.affinities, `${id} affinity matrix`);
  assert.strictEqual(cutProfile.canAnchorEnchantment, true, `${id} cut gem can anchor`);
  assert.strictEqual(cutProfile.enchantmentFeedstock, false, `${id} cut gem is not rough feedstock`);

  assert.deepStrictEqual(roughProfile.resonances, expected.resonances, `rough ${id} preserves resonance`);
  assert.deepStrictEqual(roughProfile.enchantmentAffinities, expected.affinities, `rough ${id} preserves affinity identity`);
  assert.strictEqual(roughProfile.canAnchorEnchantment, false, `rough ${id} is not socket/anchor ready`);
  assert.strictEqual(roughProfile.enchantmentFeedstock, true, `rough ${id} stays enchantment feedstock`);

  for (const resonance of expected.resonances) {
    assert.ok(expected.affinities.includes(resonance), `${id} affinity matrix must include core resonance ${resonance}`);
  }
}

assert.deepStrictEqual(Catalog.GEM_STABLE_RANK_BY_QUALITY, {
  ruined:0,
  poor:1,
  standard:1,
  fine:2,
  exceptional:3,
});
assert.deepStrictEqual(Catalog.GEM_QUALITY_STABILITY, {
  ruined:"depleted",
  poor:"unstable",
  standard:"stable",
  fine:"stable",
  exceptional:"stable",
});

assert.strictEqual(Catalog.gemStableRankForQuality("bad"), 1, "quality aliases must resolve through universal Quality engine");
assert.strictEqual(Catalog.gemStableRankForQuality("good"), 2);
assert.strictEqual(Catalog.gemStableRankForQuality("excellent"), 3);

const poorOne = Catalog.validateGemChannelRank("ruby", 1, "poor");
assert.strictEqual(poorOne.valid, true);
assert.strictEqual(poorOne.stableRank, 1);
assert.strictEqual(poorOne.overchannel, false);
assert.strictEqual(poorOne.unstable, true);
assert.strictEqual(poorOne.reason, "unstable_quality");

const standardOne = Catalog.validateGemChannelRank("ruby", 1, "standard");
assert.strictEqual(standardOne.valid, true);
assert.strictEqual(standardOne.unstable, false);

const standardTwo = Catalog.validateGemChannelRank("ruby", 2, "standard");
assert.strictEqual(standardTwo.valid, true, "Overchannel is an allowed unstable attempt, not a hard rejection");
assert.strictEqual(standardTwo.overchannel, true);
assert.strictEqual(standardTwo.unstable, true);
assert.strictEqual(standardTwo.reason, "overchannel");

const fineTwo = Catalog.validateGemChannelRank("sapphire", 2, "fine");
assert.strictEqual(fineTwo.valid, true);
assert.strictEqual(fineTwo.overchannel, false);
assert.strictEqual(fineTwo.unstable, false);

const fineThree = Catalog.validateGemChannelRank("topaz", 3, "fine");
assert.strictEqual(fineThree.valid, true);
assert.strictEqual(fineThree.overchannel, true);

const exceptionalThree = Catalog.validateGemChannelRank("diamond", 3, "exceptional");
assert.strictEqual(exceptionalThree.valid, true);
assert.strictEqual(exceptionalThree.stableRank, 3);
assert.strictEqual(exceptionalThree.overchannel, false);

const ruined = Catalog.validateGemChannelRank("emerald", 1, "ruined");
assert.strictEqual(ruined.valid, false);
assert.strictEqual(ruined.reason, "gem_quality_cannot_channel");

const roughCannotAnchor = Catalog.validateGemChannelRank("rough_ruby", 1, "exceptional");
assert.strictEqual(roughCannotAnchor.valid, false);
assert.strictEqual(roughCannotAnchor.reason, "gem_not_anchor_ready");

const rubyStack = Catalog.createStack("ruby", {quantity:1, quality:"exceptional"});
assert.strictEqual(rubyStack.quality, "exceptional");
assert.deepStrictEqual(rubyStack.gemMagicProfile.enchantmentAffinities, expectedProfiles.ruby.affinities);
assert.strictEqual(rubyStack.gemMagicProfile.canAnchorEnchantment, true);

const topaz = Catalog.gemMagicProfile("topaz");
assert.ok(topaz.enchantmentAffinities.includes("speed"));
assert.ok(topaz.enchantmentAffinities.includes("initiative"));
assert.ok(topaz.enchantmentAffinities.includes("movement"));

const ruby = Catalog.gemMagicProfile("ruby");
assert.ok(ruby.enchantmentAffinities.includes("hp"));
assert.ok(ruby.enchantmentAffinities.includes("regeneration"));

const sapphire = Catalog.gemMagicProfile("sapphire");
assert.ok(sapphire.enchantmentAffinities.includes("sp"));
assert.ok(sapphire.enchantmentAffinities.includes("intelligence"));

assert.deepStrictEqual(Catalog.gemMagicProfile("opal").resonances, ["prismatic"]);
assert.deepStrictEqual(Catalog.gemMagicProfile("starstone").resonances, ["exotic"]);
assert.strictEqual(Catalog.gemMagicProfile("iron"), null);
assert.strictEqual(Catalog.validateGemChannelRank("iron", 1, "exceptional").reason, "not_a_gemstone");

console.log("Gem magic profile + Quality/Rank smoke: OK (12 gem identities)");
