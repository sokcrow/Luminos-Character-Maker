"use strict";

const assert=require("assert");

require("../js/item-catalog-enchantments.js");
require("../js/item-magic-runtime.js");
require("../js/item-magic-knowledge-runtime.js");
require("../js/item-enchantment-compendium-runtime.js");

const Compendium=globalThis.LuminousEnchantmentCompendiumRuntime;
assert.ok(Compendium);
assert.strictEqual(Compendium.VERSION,1);
assert.strictEqual(Compendium.MAX_DERIVED_REPRODUCIBLE_RANK,3);

const source={
  sourceId:"draconic_flame_tome",
  title:"Ashen Lexicon",
  sourceType:"book",
  definitionId:"flamebound",
  languageId:"draconic",
  knownRanks:[1,2],
  text:"Ruby channels Flamebound through a prepared weapon.",
  resonanceRoutes:["fire","heat"],
  materialHints:["Ruby","Arcane Powder"],
};

const unknown={id:"unknown_reader",languages:{draconic:{percent:0}}};
const hidden=Compendium.sourcePresentation(unknown,source);
assert.strictEqual(hidden.understood,false);
assert.deepStrictEqual(hidden.ranks,[]);
assert.deepStrictEqual(hidden.materialHints,[]);
assert.ok(!hidden.content.includes("Ruby"));
assert.ok(!hidden.content.includes("Flamebound"));
assert.strictEqual(Compendium.learnFromSource(unknown,source).learned,false);
assert.strictEqual(Compendium.entryOf(unknown,"flamebound"),null);

const partial={id:"partial_reader",languages:{draconic:{percent:50}}};
assert.strictEqual(Compendium.understandsLanguage(partial,"draconic"),false);
assert.strictEqual(Compendium.understandsLanguage(partial,"draconic",{minimumLanguagePercent:50}),true);

const reader={id:"reader",languages:{draconic:{percent:100}}};
const visible=Compendium.sourcePresentation(reader,source);
assert.strictEqual(visible.understood,true);
assert.strictEqual(visible.content,source.text);
assert.deepStrictEqual(visible.ranks,[1,2]);
const learned=Compendium.learnFromSource(reader,source);
assert.strictEqual(learned.learned,true);
assert.deepStrictEqual(learned.entry.knownRanks,[1,2]);
assert.strictEqual(Compendium.knowsRecipe(reader,"flamebound",1),true);
assert.strictEqual(Compendium.knowsRecipe(reader,"flamebound",2),true);
assert.strictEqual(Compendium.knowsRecipe(reader,"flamebound",3),false);
const recipe=Compendium.recipeKnowledge(reader,"flamebound");
assert.strictEqual(recipe.known,true);
assert.deepStrictEqual(recipe.resonanceRoutes,["fire","heat"]);
assert.strictEqual(recipe.sources[0].sourceId,"draconic_flame_tome");

const commonReader={id:"common_reader"};
assert.strictEqual(Compendium.understandsLanguage(commonReader,"common"),true);

const relic={
  instanceId:"relic_ember_crown_001",
  name:"Crown of the First Ember",
  magic:{
    relic:{
      rank:5,
      derivedRecipes:[
        {definitionId:"flamebound",maxRank:3,title:"Crown Ember Pattern"},
        {definitionId:"stormbound",maxRank:2,title:"Crown Storm Pattern"},
      ],
    },
  },
};
const unstudied=Compendium.deriveLowerRankKnowledge({},relic);
assert.strictEqual(unstudied.derived,false);
assert.strictEqual(unstudied.reason,"relic_study_not_resolved");

const scholar={id:"relic_scholar"};
const derived=Compendium.deriveLowerRankKnowledge(scholar,relic,{arcanaSuccess:true});
assert.strictEqual(derived.derived,true);
assert.deepStrictEqual(Compendium.entryOf(scholar,"flamebound").knownRanks,[1,2,3]);
assert.deepStrictEqual(Compendium.entryOf(scholar,"stormbound").knownRanks,[1,2]);
assert.strictEqual(Compendium.entryOf(scholar,"flamebound").derivedFromRelic,true);
assert.strictEqual(Compendium.knowsRecipe(scholar,"flamebound",4),false,"Relic study never turns Rank IV/V into reproducible Compendium ranks");

console.log("Enchantment Compendium language/relic derivation smoke: OK");
