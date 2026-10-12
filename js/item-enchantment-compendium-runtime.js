(function (global) {
  "use strict";

  if (global.LuminousEnchantmentCompendiumRuntime) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousEnchantmentCompendiumRuntime;
    return;
  }

  function safeRequire(path) {
    if (typeof require !== "function") return null;
    try { return require(path); } catch (_) { return null; }
  }

  const Catalog = global.LuminousEnchantmentCatalog || safeRequire("./item-catalog-enchantments.js");
  const Knowledge = global.LuminousItemMagicKnowledgeRuntime || safeRequire("./item-magic-knowledge-runtime.js");
  if (!Catalog || !Knowledge) throw new Error("Enchantment Catalog and Magic Knowledge Runtime are required before Enchantment Compendium Runtime.");

  const VERSION = 1;
  const MAX_DERIVED_REPRODUCIBLE_RANK = 3;
  const clone=(value)=>value==null?value:JSON.parse(JSON.stringify(value));
  const normalizeId=(value)=>String(value??"").trim().toLowerCase().replace(/[^a-z0-9]+/g,"_").replace(/^_+|_+$/g,"");
  const asArray=(value)=>value==null?[]:(Array.isArray(value)?value:[value]);
  const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));

  function normalizeLanguageKnowledge(value) {
    if (typeof value==="number" || typeof value==="string") {
      return Object.freeze({percent:clamp(Number(value)||0,0,100),understands:false});
    }
    if (!value || typeof value!=="object") return Object.freeze({percent:0,understands:false});
    return Object.freeze({
      percent:clamp(Number(value.porcentaje ?? value.percent ?? value.conocimiento ?? value.knowledge ?? (value.habla===true?100:0))||0,0,100),
      understands:Boolean(value.entiende ?? value.understands ?? value.comprendido ?? value.understood ?? false),
    });
  }

  function languageContainers(viewer={}) {
    const nested=viewer.characterData || viewer.playerData || viewer.character || {};
    return [
      viewer.idiomas,viewer.lenguajes,viewer.languages,viewer.conocimiento_idiomas,viewer.languageKnowledge,
      nested.idiomas,nested.lenguajes,nested.languages,nested.conocimiento_idiomas,nested.languageKnowledge,
    ].filter((entry)=>entry && typeof entry==="object");
  }

  function languageKnowledge(viewer={},languageId="") {
    const id=normalizeId(languageId || "common") || "common";
    if (id==="common") return Object.freeze({languageId:id,percent:100,understands:true,universal:true});
    let best={percent:0,understands:false};
    for(const container of languageContainers(viewer)){
      const raw=container[id] ?? container[languageId];
      if (raw==null) continue;
      const normalized=normalizeLanguageKnowledge(raw);
      if (normalized.percent>best.percent || normalized.understands) best=normalized;
    }
    return Object.freeze({languageId:id,...best,universal:false});
  }

  function understandsLanguage(viewer={},languageId="",options={}) {
    const knowledge=languageKnowledge(viewer,languageId);
    const minimum=clamp(Number(options.minimumLanguagePercent ?? 100)||100,1,100);
    return knowledge.universal || knowledge.understands || knowledge.percent>=minimum;
  }

  function compendiumStore(viewer={},create=false) {
    if (viewer.enchantmentCompendium && typeof viewer.enchantmentCompendium==="object" && !Array.isArray(viewer.enchantmentCompendium)) {
      return viewer.enchantmentCompendium;
    }
    if (!create) return {};
    viewer.enchantmentCompendium={};
    return viewer.enchantmentCompendium;
  }

  function entryOf(viewer={},definitionId="") {
    const id=normalizeId(definitionId);
    const raw=compendiumStore(viewer)[id];
    return raw && typeof raw==="object" ? clone(raw) : null;
  }

  function writeEntry(viewer,definitionId,patch={}) {
    if (!viewer) return null;
    const id=normalizeId(definitionId);
    const definition=Catalog.get(id);
    if (!id || !definition) return null;
    const store=compendiumStore(viewer,true);
    const previous=store[id] && typeof store[id]==="object" ? store[id] : {};
    const ranks=[...new Set([...asArray(previous.knownRanks),...asArray(patch.knownRanks)].map(Number).filter((rank)=>Number.isInteger(rank)&&rank>=1&&rank<=MAX_DERIVED_REPRODUCIBLE_RANK))].sort((a,b)=>a-b);
    const sources=[...asArray(previous.sources),...asArray(patch.sources)].filter(Boolean);
    const sourceById=new Map();
    sources.forEach((source,index)=>{
      const key=String(source.sourceId || source.id || `source_${index}`);
      sourceById.set(key,{...clone(source),sourceId:key});
    });
    store[id]={
      ...previous,
      ...clone(patch),
      definitionId:id,
      displayName:definition.name,
      knownRanks:ranks,
      sources:[...sourceById.values()],
      updatedAt:Number(patch.updatedAt || Date.now()),
    };
    return clone(store[id]);
  }

  function normalizeSource(raw={}) {
    const definitionId=normalizeId(raw.definitionId || raw.enchantmentId);
    return Object.freeze({
      sourceId:String(raw.sourceId || raw.id || `${definitionId || "enchantment"}_source`),
      title:String(raw.title || raw.name || "Arcane Recipe").trim(),
      sourceType:normalizeId(raw.sourceType || raw.type || "book") || "book",
      definitionId,
      languageId:normalizeId(raw.languageId || raw.language || "common") || "common",
      knownRanks:Object.freeze([...new Set(asArray(raw.knownRanks || raw.ranks || raw.rank).map(Number).filter((rank)=>Number.isInteger(rank)&&rank>=1&&rank<=MAX_DERIVED_REPRODUCIBLE_RANK))].sort((a,b)=>a-b)),
      text:String(raw.text || raw.recipeText || raw.content || "").trim(),
      provenance:clone(raw.provenance || null),
      resonanceRoutes:Object.freeze(asArray(raw.resonanceRoutes || raw.resonances).map(normalizeId).filter(Boolean)),
      materialHints:Object.freeze(asArray(raw.materialHints || raw.materials).map((entry)=>typeof entry==="string"?entry:clone(entry))),
    });
  }

  function sourcePresentation(viewer={},sourceRaw={},options={}) {
    const source=normalizeSource(sourceRaw);
    const understood=understandsLanguage(viewer,source.languageId,options);
    const definition=Catalog.get(source.definitionId);
    const hiddenText=source.text || `${definition?.name || "Enchantment"} recipe ${source.knownRanks.join(",")}`;
    return Object.freeze({
      sourceId:source.sourceId,
      title:source.title,
      sourceType:source.sourceType,
      languageId:source.languageId,
      understood,
      content:understood
        ? source.text
        : Knowledge.arcaneRunes(hiddenText,`compendium:${source.sourceId}:${source.languageId}`),
      ranks:understood ? source.knownRanks : Object.freeze([]),
      resonanceRoutes:understood ? source.resonanceRoutes : Object.freeze([]),
      materialHints:understood ? source.materialHints : Object.freeze([]),
      provenance:understood ? clone(source.provenance) : null,
    });
  }

  function learnFromSource(viewer,sourceRaw={},options={}) {
    const source=normalizeSource(sourceRaw);
    if (!source.definitionId || !Catalog.get(source.definitionId)) return Object.freeze({learned:false,reason:"unknown_enchantment"});
    const presentation=sourcePresentation(viewer,source,options);
    if (!presentation.understood) {
      return Object.freeze({learned:false,reason:"source_language_not_understood",presentation});
    }
    const entry=writeEntry(viewer,source.definitionId,{
      knownRanks:source.knownRanks.length?source.knownRanks:[1],
      resonanceRoutes:source.resonanceRoutes,
      materialHints:source.materialHints,
      sources:[{
        sourceId:source.sourceId,
        title:source.title,
        sourceType:source.sourceType,
        languageId:source.languageId,
        provenance:clone(source.provenance),
      }],
    });
    return Object.freeze({learned:true,entry:Object.freeze(entry),presentation});
  }

  function knowsRecipe(viewer={},definitionId="",rank=1) {
    const entry=entryOf(viewer,definitionId);
    return Boolean(entry && asArray(entry.knownRanks).map(Number).includes(Number(rank)));
  }

  function recipeKnowledge(viewer={},definitionId="") {
    const definition=Catalog.get(definitionId);
    const entry=entryOf(viewer,definitionId);
    if (!definition) return Object.freeze({known:false,reason:"unknown_enchantment"});
    if (!entry) return Object.freeze({known:false,definitionId:definition.id,displayName:definition.name,knownRanks:Object.freeze([])});
    return Object.freeze({
      known:true,
      definitionId:definition.id,
      displayName:definition.name,
      knownRanks:Object.freeze(asArray(entry.knownRanks).map(Number)),
      sources:Object.freeze(asArray(entry.sources).map((source)=>Object.freeze(clone(source)))),
      resonanceRoutes:Object.freeze(asArray(entry.resonanceRoutes).map(normalizeId).filter(Boolean)),
      materialHints:Object.freeze(asArray(entry.materialHints).map((entry)=>typeof entry==="string"?entry:clone(entry))),
    });
  }

  function relicRecipeSources(relic={}) {
    const raw=[
      ...asArray(relic.relic?.derivedRecipes),
      ...asArray(relic.magic?.relic?.derivedRecipes),
      ...asArray(relic.magic?.derivedRecipes),
      ...asArray(relic.derivedRecipes),
    ];
    return raw.map((entry,index)=>Object.freeze({
      definitionId:normalizeId(entry?.definitionId || entry?.enchantmentId),
      maxRank:Math.min(MAX_DERIVED_REPRODUCIBLE_RANK,Math.max(1,Number(entry?.maxRank ?? entry?.rank ?? MAX_DERIVED_REPRODUCIBLE_RANK)||1)),
      sourceId:String(entry?.sourceId || `relic_${relic.instanceId || relic.id || "unknown"}_${index+1}`),
      languageId:normalizeId(entry?.languageId || "common") || "common",
      title:String(entry?.title || relic.name || "Relic Study").trim(),
      provenance:clone(entry?.provenance || {relicInstanceId:relic.instanceId || relic.id || null}),
    })).filter((entry)=>entry.definitionId && Catalog.get(entry.definitionId));
  }

  function deriveLowerRankKnowledge(viewer,relic={},options={}) {
    if (!viewer || !relic) return Object.freeze({derived:false,reason:"missing_viewer_or_relic"});
    if (options.arcanaSuccess!==true && options.identifiedRelic!==true) {
      return Object.freeze({derived:false,reason:"relic_study_not_resolved"});
    }
    const sources=relicRecipeSources(relic);
    if (!sources.length) return Object.freeze({derived:false,reason:"relic_has_no_derived_recipes"});
    const learned=[];
    for(const source of sources){
      const ranks=[];
      for(let rank=1;rank<=source.maxRank;rank+=1) ranks.push(rank);
      const entry=writeEntry(viewer,source.definitionId,{
        knownRanks:ranks,
        sources:[{
          sourceId:source.sourceId,
          title:source.title,
          sourceType:"relic_derivation",
          languageId:source.languageId,
          provenance:source.provenance,
        }],
        derivedFromRelic:true,
      });
      learned.push(entry);
    }
    return Object.freeze({derived:true,entries:Object.freeze(learned.map((entry)=>Object.freeze(entry)))});
  }

  function list(viewer={}) {
    return Object.values(compendiumStore(viewer)).map(clone).sort((a,b)=>String(a.displayName||a.definitionId).localeCompare(String(b.displayName||b.definitionId)));
  }

  const API=Object.freeze({
    VERSION,
    MAX_DERIVED_REPRODUCIBLE_RANK,
    normalizeLanguageKnowledge,
    languageKnowledge,
    understandsLanguage,
    entryOf,
    writeEntry,
    normalizeSource,
    sourcePresentation,
    learnFromSource,
    knowsRecipe,
    recipeKnowledge,
    relicRecipeSources,
    deriveLowerRankKnowledge,
    list,
  });

  global.LuminousEnchantmentCompendiumRuntime=API;
  if (typeof module!=="undefined" && module.exports) module.exports=API;
})(typeof window!=="undefined"?window:globalThis);
