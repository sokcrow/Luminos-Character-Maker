(function (global) {
  "use strict";
  if (global.LuminousFightingStyleRuntime) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousFightingStyleRuntime;
    return;
  }

  const VERSION = 1;
  const RULESET = "dnd5e_2014";
  const STYLE_IDS = Object.freeze(["archery", "defense", "dueling", "great_weapon_fighting", "protection", "two_weapon_fighting"]);
  const normalizeId = (value) => String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
  const styleId = (value) => normalizeId(typeof value === "object" ? value?.styleId || value?.id || value?.name : value).replace(/^fighting_style_/, "");
  const traitId = (value) => `fighting_style_${styleId(value)}`;
  const source = Object.freeze({ type: "fighting_style", id: "fighting_styles_2014", ruleset: RULESET });

  function freeze(value, seen = new WeakSet()) {
    if (!value || typeof value !== "object" || seen.has(value)) return value;
    seen.add(value); Reflect.ownKeys(value).forEach((key) => freeze(value[key], seen)); return Object.freeze(value);
  }

  const attack = (mode) => ({ all: [
    { path: "skill.skillFamily", operator: "eq", value: "attack" },
    { path: "skill.attackMode", operator: "eq", value: mode },
  ] });
  const mainMelee1 = { all: [
    { path: "equipment.mainHand.category", operator: "eq", value: "weapon" },
    { path: "equipment.mainHand.classification", operator: "contains", value: "melee" },
    { path: "equipment.mainHand.equipment.handCost", operator: "eq", value: 1 },
  ] };
  const offNoWeapon = { any: [
    { path: "equipment.offHand", operator: "falsy" },
    { path: "equipment.offHand.category", operator: "eq", value: "shield" },
    { path: "equipment.offHand.itemType", operator: "eq", value: "shield" },
    { path: "equipment.offHand.tags", operator: "contains", value: "shield" },
  ] };
  const mainMelee2 = { all: [
    { path: "equipment.mainHand.category", operator: "eq", value: "weapon" },
    { path: "equipment.mainHand.classification", operator: "contains", value: "melee" },
    { path: "equipment.mainHand.equipment.handCost", operator: "gte", value: 2 },
  ] };
  const dualMelee = { all: [mainMelee1,
    { path: "equipment.offHand.category", operator: "eq", value: "weapon" },
    { path: "equipment.offHand.classification", operator: "contains", value: "melee" },
    { path: "equipment.offHand.equipment.handCost", operator: "eq", value: 1 },
  ] };

  function def(id, name, description, rules, mechanics = {}, activation = null) {
    return freeze({ schemaVersion: 1, id: traitId(id), styleId: id, name, description, source,
      contexts: ["combat"], activation: activation || { type: "passive", actionCost: "none" }, effects: [], rules,
      mechanics: { fightingStyle: true, ruleset: RULESET, uniqueStyle: true, ...mechanics } });
  }
  const damageRule = (conditions) => ({ type: "modifier", trigger: "passive", target: "self", channel: "damage_dealt_multiplier", mode: "add", value: 10, unit: "percent", conditions });

  const DEFINITIONS = freeze({
    archery: def("archery", "Archery", "Ranged Attack Skills gain +1 Clash Power.", [
      { type: "modifier", trigger: "passive", target: "self", channel: "clash_power", mode: "add", value: 1, conditions: [attack("ranged")] },
    ], { adaptation: "ranged_accuracy_to_clash_power" }),
    defense: def("defense", "Defense", "While wearing Armor, gain +1 Defensive Level.", [
      { type: "modifier", trigger: "passive", target: "self", channel: "defensive_level", mode: "add", value: 1, conditions: [{ path: "equipment.armorEquipped", operator: "truthy" }] },
    ], { requiresArmor: true }),
    dueling: def("dueling", "Dueling", "With a one-handed melee weapon and no second weapon, Melee Attack Skills deal +10% Damage. A Shield is allowed.", [damageRule([attack("melee"), mainMelee1, offNoWeapon])], { damageBonusPercent: 10, allowsShield: true }),
    great_weapon_fighting: def("great_weapon_fighting", "Great Weapon Fighting", "With a two-handed melee weapon, Melee Attack Skills deal +10% Damage.", [damageRule([attack("melee"), mainMelee2])], { damageBonusPercent: 10, requiredHands: 2 }),
    protection: def("protection", "Protection", "Reaction — with a Shield, when a visible adjacent Ally is targeted by an Attack Skill, reduce that Skill's Final Power by 2 for the attack.", [],
      { trigger: "before_attack", requiresShield: true, allyRange: 1, attackFinalPowerModifier: -2, resolver: "LuminousFightingStyleRuntime.useProtection" },
      { type: "manual", actionCost: "reaction", target: "ally" }),
    two_weapon_fighting: def("two_weapon_fighting", "Two-Weapon Fighting", "With a one-handed melee weapon in each hand, Melee Attack Skills deal +10% Damage.", [damageRule([attack("melee"), dualMelee])], { damageBonusPercent: 10, requiresTwoWeapons: true }),
  });

  const CLASS_OPTIONS = freeze({
    fighter: { classId: "fighter", dndUnlockLevel: 1, limbusUnlockLevel: 1, styles: STYLE_IDS.slice() },
    ranger: { classId: "ranger", dndUnlockLevel: 2, limbusUnlockLevel: 10, styles: ["archery", "defense", "dueling", "two_weapon_fighting"] },
    paladin: { classId: "paladin", dndUnlockLevel: 2, limbusUnlockLevel: 10, styles: ["defense", "dueling", "great_weapon_fighting", "protection"] },
  });

  function get(value) { const x = DEFINITIONS[styleId(value)]; return x ? clone(x) : null; }
  function list() { return STYLE_IDS.map(get); }
  function allDefinitions() { return Object.fromEntries(STYLE_IDS.map((id) => [traitId(id), get(id)])); }
  function classFeature(classId) { const x = CLASS_OPTIONS[normalizeId(classId)]; return x ? clone(x) : null; }
  function forClass(classId) { const x = classFeature(classId); return x ? x.styles.map(get) : []; }
  function isAllowed(style, classId) { const x = CLASS_OPTIONS[normalizeId(classId)]; return Boolean(x?.styles.includes(styleId(style))); }
  function asTrait(style, overrideSource = {}) { const x = get(style); if (!x) return null; x.source = { ...clone(source), ...clone(overrideSource) }; return x; }
  function normalizeSelection(value) { return (Array.isArray(value) ? value : value && typeof value === "object" ? Object.values(value) : value ? [value] : []).map(styleId).filter(Boolean); }
  function validateSelection(value, options = {}) {
    const selections = normalizeSelection(value), seen = new Set(), errors = [], max = Math.max(1, Number(options.maxChoices || 1));
    selections.forEach((id) => { if (!DEFINITIONS[id]) errors.push(`Unknown Fighting Style: ${id}`); if (seen.has(id)) errors.push(`Duplicate Fighting Style: ${id}`); seen.add(id); if (options.classId && DEFINITIONS[id] && !isAllowed(id, options.classId)) errors.push(`${id} is not available to ${normalizeId(options.classId)} in 2014.`); });
    if (selections.length > max) errors.push(`At most ${max} Fighting Style choice(s) allowed.`);
    return { valid: !errors.length, errors, selections };
  }
  function choiceForClass(classId) { const x = classFeature(classId); return x ? { type: "fighting_style_choice", ruleset: RULESET, classId: x.classId, atLevel: x.limbusUnlockLevel, maxChoices: 1, allowDuplicate: false, options: x.styles.slice() } : null; }
  function grantFor(style, input = {}) {
    const id = styleId(style); if (!DEFINITIONS[id]) return null;
    const sourceType = normalizeId(input.sourceType || "class"), sourceId = normalizeId(input.sourceId || input.classId || input.source?.id); if (!sourceId) throw new Error("Fighting Style grant requires sourceId.");
    const out = { id: input.id || `${sourceType}_${sourceId}_${traitId(id)}`, sourceType, sourceId, traitId: traitId(id), grantType: "trait", multiclassPolicy: input.multiclassPolicy || "allowed" };
    if (input.atLevel != null) out.atLevel = Math.max(1, Math.trunc(Number(input.atLevel))); return out;
  }

  const CATALOG = freeze({ VERSION, RULESET, STYLE_IDS, DEFINITIONS, CLASS_OPTIONS, normalizeId, styleId, traitId, get, list, allDefinitions, classFeature, forClass, isAllowed, asTrait, normalizeSelection, validateSelection, choiceForClass, grantFor });
  global.LuminousFightingStyleCatalog = CATALOG;

  function selectedStyles(character = {}) {
    const build = character.characterBuild || {}, tc = character.traitChoices || {}, btc = build.traitChoices || {};
    const raw = [character.fightingStyles, character.fighting_styles, build.fightingStyles, build.fighting_styles, tc.fighting_style, tc.fighting_styles, btc.fighting_style, btc.fighting_styles];
    const traits = [character.traitDefinitions, character.traits, build.traitDefinitions, build.traits];
    const values = (v) => Array.isArray(v) ? v : v && typeof v === "object" ? Object.values(v) : v ? [v] : [];
    const ids = [...raw.flatMap(values), ...traits.flatMap(values)].map((entry) => styleId(entry)).filter((id) => DEFINITIONS[id]);
    return [...new Set(ids)];
  }
  function hasStyle(character, style) { return selectedStyles(character).includes(styleId(style)); }
  function resolveSelectedTraits(character, options = {}) { return selectedStyles(character).filter((id) => !options.classId || isAllowed(id, options.classId)).map((id) => asTrait(id, options.source || (options.classId ? { type: "class", id: options.classId, classId: options.classId } : {}))); }

  function wrapCoreCatalog() {
    const core = global.LuminousTraitCatalogCore; if (!core) return false; if (core.__fightingStyles2014Integrated) return true;
    const defs = allDefinitions(), baseDefs = core.allDefinitions?.bind(core) || (() => clone(core.DEFINITIONS || {})), baseGrants = core.allGrants?.bind(core) || (() => clone(core.GRANTS || [])), baseGet = core.getDefinition?.bind(core) || (() => null);
    const mergedDefs = () => ({ ...baseDefs(), ...clone(defs) });
    global.LuminousTraitCatalogCore = Object.freeze({ ...core, __fightingStyles2014Integrated: true, DEFINITIONS: Object.freeze(mergedDefs()), allDefinitions: mergedDefs, allGrants: baseGrants, getDefinition(id) { return clone(defs[traitId(id)] || baseGet(id)); } });
    return true;
  }

  function modifiers() { return global.LuminousUniversalModifiers || null; }
  function equipment(unit) { return modifiers()?.resolveEquipment?.(unit) || { ...(unit?.equipment || {}), armorEquipped: Boolean(unit?.equipment?.armor) }; }
  function isShield(item) { const ids = [item?.category, item?.itemType, item?.kind, item?.type].map(normalizeId); return ids.includes("shield") || (item?.tags || []).map(normalizeId).includes("shield"); }
  function hasShield(unit) { const eq = equipment(unit); return Boolean(eq.shield || isShield(eq.mainHand) || isShield(eq.offHand)); }
  function attackSkill(skill = {}) { return modifiers()?.normalizeSkill?.({ ...skill }) || { ...skill, skillFamily: normalizeId(skill.skillFamily || skill.skill_family || "attack"), attackMode: normalizeId(skill.attackMode || skill.attack_mode || (skill.isRanged ? "ranged" : "melee")) }; }
  function distance(a, b) { const pa = a?.grid_pos || a?.gridPos, pb = b?.grid_pos || b?.gridPos; if (!pa || !pb) return null; return Math.max(Math.abs(Number(pa.x) - Number(pb.x)), Math.abs(Number(pa.y) - Number(pb.y))); }
  function same(a, b) { if (a === b) return true; const id = (x) => String(x?.id || x?.unitId || x?.characterId || ""); return Boolean(id(a) && id(a) === id(b)); }

  function canUseProtection(options = {}) {
    const protector = options.protector || options.self, ally = options.ally || options.target || options.defender, attacker = options.attacker, skill = attackSkill(options.skill || options.attackSkill || {});
    if (!protector || !ally || !attacker) return { available: false, reason: "missing_protection_participant" };
    if (options.requireStyle !== false && !hasStyle(protector, "protection")) return { available: false, reason: "protection_style_not_selected" };
    if (!hasShield(protector)) return { available: false, reason: "shield_required" }; if (same(protector, ally)) return { available: false, reason: "protection_requires_other_ally" };
    if (skill.skillFamily !== "attack") return { available: false, reason: "protection_requires_attack_skill" }; if (options.visible === false) return { available: false, reason: "attacker_not_visible" };
    const d = Number.isFinite(Number(options.distance)) ? Number(options.distance) : distance(protector, ally); if (d != null && d > 1) return { available: false, reason: "ally_out_of_protection_range", distance: d };
    const ae = options.actionEconomy || global.LuminousActionEconomy?.runtimeFor?.(protector, { phase: options.phase || "combat" }); const gate = ae?.availability?.("reaction") || { available: true }; if (gate.available === false) return { available: false, reason: gate.reason || "reaction_unavailable" };
    return { available: true, protector, ally, attacker, skill, distance: d, finalPowerModifier: -2, actionEconomy: ae };
  }
  function useProtection(options = {}) {
    const gate = canUseProtection(options); if (!gate.available) return { used: false, ...gate };
    const spent = gate.actionEconomy?.consume?.("reaction") || { consumed: true }; if (spent.consumed === false || spent.available === false || spent.success === false) return { used: false, available: false, reason: spent.reason || "reaction_unavailable", spent };
    return { used: true, available: true, styleId: "protection", traitId: traitId("protection"), actionCost: "reaction", finalPowerModifier: -2, spent, outcome: { type: "fighting_style_protection", finalPowerModifier: -2, duration: "this_attack" } };
  }

  function install() { return wrapCoreCatalog(); }
  const API = Object.freeze({ VERSION, catalog: CATALOG, selectedStyles, hasStyle, resolveSelectedTraits, wrapCoreCatalog, hasShield, canUseProtection, useProtection, install });
  global.LuminousFightingStyleRuntime = API;
  const installed = install();
  if (!installed && global.document && global.setInterval) { const timer = global.setInterval(() => { if (install()) global.clearInterval?.(timer); }, 500); }
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof window !== "undefined" ? window : globalThis);
