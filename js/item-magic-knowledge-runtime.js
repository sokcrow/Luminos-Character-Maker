(function (global) {
  "use strict";

  if (global.LuminousItemMagicKnowledgeRuntime) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousItemMagicKnowledgeRuntime;
    return;
  }

  function safeRequire(path) {
    if (typeof require !== "function") return null;
    try { return require(path); } catch (_) { return null; }
  }

  const Magic = global.LuminousItemMagicRuntime || safeRequire("./item-magic-runtime.js");
  const Enchantments = global.LuminousEnchantmentCatalog || safeRequire("./item-catalog-enchantments.js");
  if (!Magic) throw new Error("LuminousItemMagicRuntime is required before LuminousItemMagicKnowledgeRuntime.");
  if (!Enchantments) throw new Error("LuminousEnchantmentCatalog is required before LuminousItemMagicKnowledgeRuntime.");

  const VERSION = 1;
  const ARCANA_IDENTIFY_TH = Object.freeze({ 1:22, 2:28, 3:34 });
  const PASSIVE_DIFFICULTY_VISIBILITY = 10;
  const DURABILITY_MARGIN = 8;
  const RUNE_GLYPHS = Object.freeze(Array.from("ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛋᛏᛒᛖᛗᛚᛜᛞᛟ"));

  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
  const normalizeId = (value) => String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  const asArray = (value) => value == null ? [] : (Array.isArray(value) ? value : [value]);
  const numberOr = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

  function instanceIdOf(item = {}) {
    return String(item.instanceId || item.instance_id || item.id || item.definitionId || "").trim();
  }

  function baseItemName(item = {}) {
    const candidates = [
      item.baseItemName,
      item.baseName,
      item.mundaneName,
      item.nombreBase,
      item.name,
      item.nombre,
      item.displayName,
      item.definitionName,
      item.definitionId,
      "Item",
    ];
    const raw = String(candidates.find((value) => String(value || "").trim()) || "Item").trim();
    return raw
      .replace(/^Cursed\s+/i, "")
      .replace(/^Enchanted\s+/i, "")
      .replace(/\s+\+[1-9]\d*$/i, "");
  }

  function arcanaModifier(viewer = {}) {
    const direct = [
      viewer.arcanaMod,
      viewer.arcanaModifier,
      viewer.arcana_mod,
      viewer.skillModifiers?.arcana,
      viewer.skill_modifiers?.arcana,
      viewer.skills?.arcana?.modifier,
      viewer.skills?.arcana?.mod,
      viewer.skills?.arcana,
      viewer.habilidades?.arcana?.modifier,
      viewer.habilidades?.arcana?.mod,
      viewer.habilidades?.arcana,
      viewer.dndStats?.skills?.arcana?.modifier,
      viewer.dndStats?.skills?.arcana?.mod,
      viewer.dndStats?.skills?.arcana,
    ].find((value) => Number.isFinite(Number(value)));
    return numberOr(direct, 0);
  }

  function passiveArcana(viewer = {}) {
    const explicit = viewer.passiveArcana ?? viewer.arcanaPassive ?? viewer.arcana_passive;
    if (Number.isFinite(Number(explicit))) return Number(explicit);
    return 10 + arcanaModifier(viewer);
  }

  function highestRank(item = {}) {
    return Magic.highestEnchantmentRank?.(item) || 0;
  }

  function identifyThreshold(itemOrRank = {}) {
    const rank = typeof itemOrRank === "number" ? itemOrRank : highestRank(itemOrRank);
    if (ARCANA_IDENTIFY_TH[rank]) return ARCANA_IDENTIFY_TH[rank];
    if (rank > 3) return null;
    return ARCANA_IDENTIFY_TH[1];
  }

  function knowledgeContainer(viewer = {}, create = false) {
    const candidates = ["itemMagicKnowledge", "magicItemKnowledge", "conocimientoItemsMagicos"];
    for (const key of candidates) {
      if (viewer[key] && typeof viewer[key] === "object" && !Array.isArray(viewer[key])) return { key, value:viewer[key] };
    }
    if (!create) return { key:"itemMagicKnowledge", value:{} };
    viewer.itemMagicKnowledge = {};
    return { key:"itemMagicKnowledge", value:viewer.itemMagicKnowledge };
  }

  function knowledgeOf(viewer = {}, item = {}) {
    const id = instanceIdOf(item);
    const stored = id ? knowledgeContainer(viewer).value[id] : null;
    return clone(stored || {});
  }

  function writeKnowledge(viewer, item, patch = {}) {
    if (!viewer || !item) return null;
    const id = instanceIdOf(item);
    if (!id) return null;
    const store = knowledgeContainer(viewer, true).value;
    const previous = store[id] && typeof store[id] === "object" ? store[id] : {};
    store[id] = {
      ...previous,
      ...clone(patch),
      itemInstanceId:id,
      updatedAt:Number(patch.updatedAt || Date.now()),
    };
    return clone(store[id]);
  }

  function truth(item = {}) {
    const enchantments = Magic.enchantmentRefs?.(item) || [];
    const resolved = enchantments.map((ref) => ({
      ref:clone(ref),
      definition:Enchantments.get(ref.definitionId || ref.enchantmentId || ref.id),
    })).filter((entry) => entry.definition);
    const cursed = Magic.isCursed?.(item) === true;
    const magical = Magic.isMagicItem?.(item) === true;
    const durability = Magic.magicalDurabilityState?.(item) || {current:null,max:null,depleted:false};
    return Object.freeze({
      magical,
      cursed,
      bound:Magic.isBoundItem?.(item) === true,
      enchantments:Object.freeze(resolved.map((entry) => Object.freeze(entry))),
      highestRank:resolved.reduce((max,entry)=>Math.max(max,Number(entry.ref.rank)||0),0),
      durability,
    });
  }

  function hashSeed(value) {
    let hash = 2166136261;
    for (const char of String(value || "")) {
      hash ^= char.codePointAt(0);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function arcaneRunes(text, seed = "") {
    const source = String(text || "Arcane inscription");
    let state = hashSeed(String(seed) + "|" + source);
    let out = "";
    for (let index = 0; index < Math.max(6, Math.min(36, source.replace(/\s+/g,"").length)); index += 1) {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      out += RUNE_GLYPHS[state % RUNE_GLYPHS.length];
      if ((index + 1) % 6 === 0 && index + 1 < 36) out += " ";
    }
    return out.trim();
  }

  function passiveObservation(viewer = {}, item = {}) {
    const score = passiveArcana(viewer);
    const target = identifyThreshold(item);
    const actual = truth(item);
    if (!actual.magical) return Object.freeze({score,target,magicDetected:false,difficultyVisible:false,identified:false});
    const difficultyVisible = score >= PASSIVE_DIFFICULTY_VISIBILITY;
    const identified = target != null && score >= target;
    const durabilityKnown = identified && score >= target + DURABILITY_MARGIN;
    return Object.freeze({
      score,
      target,
      magicDetected:difficultyVisible || identified,
      difficultyVisible,
      identified,
      durabilityKnown,
    });
  }

  function syncPassiveKnowledge(viewer, item) {
    const passive = passiveObservation(viewer, item);
    if (!passive.magicDetected && !passive.identified) return knowledgeOf(viewer,item);
    const patch = {
      magicDetected:passive.magicDetected,
      difficultyKnown:passive.difficultyVisible,
      lastPassiveArcana:passive.score,
    };
    if (passive.identified) {
      patch.enchantmentIdentified = true;
      patch.rankKnown = true;
      patch.effectsKnown = true;
    }
    if (passive.durabilityKnown) patch.magicalDurabilityKnown = true;
    return writeKnowledge(viewer,item,patch);
  }

  function rollD20(options = {}) {
    if (Number.isFinite(Number(options.roll))) return Math.max(1, Math.min(20, Math.trunc(Number(options.roll))));
    if (typeof options.rollD20 === "function") return Math.max(1, Math.min(20, Math.trunc(Number(options.rollD20())) || 1));
    return 1 + Math.floor(Math.random() * 20);
  }

  function studyArcana(viewer, item, options = {}) {
    if (!viewer || !item) return Object.freeze({studied:false,reason:"missing_viewer_or_item"});
    const sp = Math.max(0, Number(viewer.sp) || 0);
    if (sp < 1) return Object.freeze({studied:false,reason:"insufficient_sp",sp});
    viewer.sp = sp - 1;

    const actual = truth(item);
    const target = identifyThreshold(item);
    const die = rollD20(options);
    const modifier = arcanaModifier(viewer);
    const total = die + modifier;
    const margin = target == null ? null : total - target;

    const patch = {
      magicDetected:actual.magical,
      difficultyKnown:passiveArcana(viewer) >= PASSIVE_DIFFICULTY_VISIBILITY,
      lastArcanaStudy:Object.freeze({die,modifier,total,target,margin}),
    };

    if (actual.magical && target != null && total >= target) {
      patch.enchantmentIdentified = true;
      patch.rankKnown = true;
      patch.effectsKnown = true;
      if (margin >= DURABILITY_MARGIN) patch.magicalDurabilityKnown = true;
    }

    const knowledge = writeKnowledge(viewer,item,patch);
    return Object.freeze({
      studied:true,
      spSpent:1,
      spAfter:viewer.sp,
      die,
      modifier,
      total,
      target,
      margin,
      success:Boolean(target != null && total >= target),
      knowledge:Object.freeze(knowledge || {}),
    });
  }

  function identifyItem(viewer, item, options = {}) {
    if (!viewer || !item) return Object.freeze({identified:false,reason:"missing_viewer_or_item"});
    const actual = truth(item);
    if (!actual.magical) return Object.freeze({identified:false,reason:"item_not_magical"});
    const patch = {
      magicDetected:true,
      difficultyKnown:true,
      enchantmentIdentified:true,
      rankKnown:true,
      effectsKnown:true,
      identifyUsed:true,
    };
    if (actual.cursed) patch.curseFlagKnown = true;
    if (options.revealDurability === true) patch.magicalDurabilityKnown = true;
    const knowledge = writeKnowledge(viewer,item,patch);
    return Object.freeze({
      identified:true,
      cursedFlagged:actual.cursed,
      curseDetailsRevealed:false,
      knowledge:Object.freeze(knowledge || {}),
    });
  }

  function detectCurse(viewer, item) {
    if (!viewer || !item) return Object.freeze({detected:false,reason:"missing_viewer_or_item"});
    const actual = truth(item);
    const knowledge = writeKnowledge(viewer,item,{
      magicDetected:actual.magical,
      curseFlagKnown:actual.cursed,
      curseChecked:true,
    });
    return Object.freeze({
      detected:actual.cursed,
      curseDetailsRevealed:false,
      knowledge:Object.freeze(knowledge || {}),
    });
  }

  function identifyCurse(viewer, item, options = {}) {
    if (!viewer || !item) return Object.freeze({identified:false,reason:"missing_viewer_or_item"});
    const actual = truth(item);
    if (!actual.cursed) {
      const knowledge = writeKnowledge(viewer,item,{curseFlagKnown:false,curseChecked:true});
      return Object.freeze({identified:false,reason:"item_not_cursed",knowledge:Object.freeze(knowledge || {})});
    }
    const knowledge = writeKnowledge(viewer,item,{
      magicDetected:true,
      curseFlagKnown:true,
      curseDetailsKnown:true,
      curseIdentifiedBy:normalizeId(options.source || "curse_reading") || "curse_reading",
    });
    return Object.freeze({identified:true,knowledge:Object.freeze(knowledge || {})});
  }

  function enchantmentNames(actual, knowledge) {
    if (!knowledge.enchantmentIdentified) return [];
    return actual.enchantments.map((entry) => entry.definition?.name).filter(Boolean);
  }

  function displayName(viewer, item, options = {}) {
    if (options.syncPassive !== false) syncPassiveKnowledge(viewer,item);
    const knowledge = knowledgeOf(viewer,item);
    const actual = truth(item);
    const base = baseItemName(item);
    if (!actual.magical || !knowledge.magicDetected) return base;

    const names = enchantmentNames(actual,knowledge);
    let name = names.length
      ? `${names.join(" / ")} ${base}`
      : `Enchanted ${base}`;

    if (actual.cursed && knowledge.curseFlagKnown) name = `Cursed ${name}`;
    return name;
  }

  function difficultyLabel(target) {
    if (target == null) return "Relic / Unknown";
    if (target <= 22) return "Difficult";
    if (target <= 28) return "Dangerous";
    return "Extremely Dangerous";
  }

  function normalEffectText(entry) {
    const rank = Enchantments.resolveRank(entry.definition, Number(entry.ref.rank));
    const effects = asArray(rank?.effects);
    if (!effects.length) return "Magical property identified.";
    return effects.map((effect) => {
      const type = normalizeId(effect.type);
      if (type === "damage_percent") return `Damage +${Number(effect.value) || 0}%${effect.damageType ? ` (${effect.damageType})` : ""}`;
      if (type === "secondary_damage_percent") return `Secondary Damage +${Number(effect.value) || 0}%`;
      if (type === "magic_hit") return "Magic Hit";
      if (type === "resistance_percent") return `Resistance +${Number(effect.value) || 0}%`;
      if (type === "max_hp_percent") return `Max HP +${Number(effect.value) || 0}%`;
      if (type === "max_sp_percent") return `Max SP +${Number(effect.value) || 0}%`;
      if (type === "speed_percent") return `Speed +${Number(effect.value) || 0}%`;
      if (type === "initiative_flat") return `Initiative +${Number(effect.value) || 0}`;
      if (type === "spell_grant") return `Granted spell: ${String(effect.spellName || effect.spellId || "Spell")}`;
      return String(effect.label || "Magical property");
    }).join(" · ");
  }

  function presentation(viewer, item, options = {}) {
    if (options.syncPassive !== false) syncPassiveKnowledge(viewer,item);
    const knowledge = knowledgeOf(viewer,item);
    const actual = truth(item);
    const name = displayName(viewer,item,{syncPassive:false});
    const active = Magic.magicalPowerActive?.(item) !== false;
    const inscriptionSeed = instanceIdOf(item) || baseItemName(item);
    const target = identifyThreshold(item);

    const enchantmentLines = actual.enchantments.map((entry,index) => {
      const rank = Number(entry.ref.rank) || 0;
      if (!knowledge.enchantmentIdentified) {
        return Object.freeze({
          tone:"enchantment",
          known:false,
          text:arcaneRunes(`${entry.definition.name} ${rank}`, `${inscriptionSeed}:enchantment:${index}`),
        });
      }
      return Object.freeze({
        tone:"enchantment",
        known:true,
        text:`${entry.definition.name}${knowledge.rankKnown ? ` ${["","I","II","III"][rank] || rank}` : ""}${knowledge.effectsKnown ? ` — ${normalEffectText(entry)}` : ""}`,
      });
    });

    const curseLines = [];
    if (actual.cursed) {
      if (!knowledge.curseFlagKnown) {
        curseLines.push(Object.freeze({
          tone:"curse",
          known:false,
          hidden:true,
          text:arcaneRunes("Hidden curse", `${inscriptionSeed}:curse`),
        }));
      } else if (!knowledge.curseDetailsKnown) {
        curseLines.push(Object.freeze({
          tone:"curse",
          known:false,
          hidden:false,
          text:`Cursed — ${arcaneRunes("Unknown curse effect", `${inscriptionSeed}:curse:detail`)}`,
        }));
      } else {
        const profile = Magic.curseProfile?.(item) || {};
        curseLines.push(Object.freeze({
          tone:"curse",
          known:true,
          hidden:false,
          text:String(profile.description || profile.name || (actual.bound ? "Bound Curse: cannot be normally unequipped or unattuned." : "Curse properties identified.")),
        }));
      }
    }

    const durability = knowledge.magicalDurabilityKnown
      ? clone(actual.durability)
      : null;

    return Object.freeze({
      displayName:name,
      baseName:baseItemName(item),
      magical:actual.magical,
      magicDetected:knowledge.magicDetected === true,
      identified:knowledge.enchantmentIdentified === true,
      cursed:actual.cursed && knowledge.curseFlagKnown === true,
      curseDetailsKnown:knowledge.curseDetailsKnown === true,
      difficulty:knowledge.difficultyKnown ? Object.freeze({threshold:target,label:difficultyLabel(target)}) : null,
      magicalDurability:durability,
      inscriptionGlowing:Boolean(actual.magical && active),
      enchantmentLines:Object.freeze(enchantmentLines),
      curseLines:Object.freeze(curseLines),
      knowledge:Object.freeze(clone(knowledge)),
    });
  }

  const API = Object.freeze({
    VERSION,
    ARCANA_IDENTIFY_TH,
    PASSIVE_DIFFICULTY_VISIBILITY,
    DURABILITY_MARGIN,
    RUNE_GLYPHS,
    instanceIdOf,
    baseItemName,
    arcanaModifier,
    passiveArcana,
    identifyThreshold,
    knowledgeOf,
    writeKnowledge,
    truth,
    arcaneRunes,
    passiveObservation,
    syncPassiveKnowledge,
    studyArcana,
    identifyItem,
    detectCurse,
    identifyCurse,
    displayName,
    difficultyLabel,
    presentation,
  });

  global.LuminousItemMagicKnowledgeRuntime = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof window !== "undefined" ? window : globalThis);
