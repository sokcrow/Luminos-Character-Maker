(function (global) {
  "use strict";
  const initialSpellcasting = global.LuminousSpellcastingRuntime || (typeof require === "function" ? (() => { try { return require("./spellcasting-basic-rules-runtime.js"); } catch (_) {} try { return require("./spellcasting-runtime.js"); } catch (_) {} return null; })() : null);
  const CLASS_ID = "wizard", CLASS_NAME = "Wizard", CATALOG_VERSION = 1, STATE_ROOT = "classResources", STATE_KEY = "wizard";
  const normalizeId = (v) => String(v ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  const intOr = (v, f = 0) => Number.isFinite(Number.parseInt(v, 10)) ? Number.parseInt(v, 10) : f;
  const clone = (v) => v == null ? v : JSON.parse(JSON.stringify(v));
  const uniqueIds = (v = []) => [...new Set((Array.isArray(v) ? v : []).map((x) => normalizeId(x?.spellId || x?.id || x)).filter(Boolean))];
  const spellcasting = () => global.LuminousSpellcastingRuntime || initialSpellcasting || null;
  const WIZARD_SOURCE = Object.freeze({ type: "class", id: CLASS_ID, classId: CLASS_ID, className: CLASS_NAME });

  function ensureBasicSpellcastingAsset() {
    const current = spellcasting();
    if (current?.castSpell && current?.spellSlotPool) return current;
    if (typeof require === "function" && !global.document) { try { return require("./spellcasting-basic-rules-runtime.js"); } catch (_) { return current; } }
    if (!global.document) return current;
    if (!global.document.getElementById("wizard-spellcasting-basic-rules-runtime")) {
      const script = global.document.createElement("script");
      script.id = "wizard-spellcasting-basic-rules-runtime"; script.src = "js/spellcasting-basic-rules-runtime.js"; script.async = false;
      global.document.head?.appendChild(script);
    }
    return current;
  }

  const WIZARD_DEFINITIONS = Object.freeze({
    spellbook: Object.freeze({ schemaVersion: 1, id: "spellbook", name: "Spellbook", source: WIZARD_SOURCE, contexts: ["any"], activation: { type: "passive", actionCost: "none" }, effects: [], rules: [], description: "At Wizard Level 1, learn 3 Wizard Cantrips and add 6 Level 1 Wizard Spells to your Spellbook. At Wizard Level 10 and every 5 Wizard Levels afterward, add 2 Wizard Spells you can cast to your Spellbook. After a Long Rest, choose your Prepared Spells from your Spellbook. Prepared Spell Limit = max(1, floor(Wizard Level / 5)) + Intelligence Modifier, minimum 1. Cantrips do not need to be Prepared.", mechanics: { startingCantrips: 3, startingSpellbookSpells: 6, additionalSpellbookSpells: 2, additionalSpellbookFirstWizardLevel: 10, additionalSpellbookEveryWizardLevels: 5, preparedSpellLimitFormula: "max(1, max(1, floor(ClassLevel / 5)) + IntelligenceMod)" } }),
    ritual_casting_wizard: Object.freeze({ schemaVersion: 1, id: "ritual_casting_wizard", name: "Ritual Casting", source: WIZARD_SOURCE, contexts: ["any"], activation: { type: "passive", actionCost: "none" }, effects: [], rules: [], description: "You can cast a Wizard Spell as a Ritual if it has the Ritual tag and is in your Spellbook. It does not need to be Prepared. Ritual Casting does not consume a Spell Slot and adds 10 minutes to the Spell's normal Casting Time.", mechanics: { ritualFromSpellbook: true, preparedRequired: false, spellSlotCost: 0, additionalCastingTimeSeconds: 600 } }),
    arcane_recovery: Object.freeze({ schemaVersion: 1, id: "arcane_recovery", name: "Arcane Recovery", source: WIZARD_SOURCE, contexts: ["any"], activation: { type: "passive", actionCost: "none" }, effects: [], rules: [], description: "After a Short Rest, recover expended Spell Slots. Recovery Limit = max(1, floor(Wizard Level / 10)). The total Levels of recovered Spell Slots cannot exceed the Recovery Limit. You cannot recover Level 6 or higher Spell Slots. Once per Long Rest.", mechanics: { recoveryLimitFormula: "max(1, floor(ClassLevel / 10))", maximumRecoveredSlotLevel: 5, reset: "long_rest", trigger: "short_rest" } }),
    spell_mastery: Object.freeze({ schemaVersion: 1, id: "spell_mastery", name: "Spell Mastery", source: WIZARD_SOURCE, contexts: ["any"], activation: { type: "choice", actionCost: "none" }, effects: [], rules: [], description: "Choose 1 Level 1 Wizard Spell and 1 Level 2 Wizard Spell from your Spellbook. While those Spells are Prepared, you can cast them at their base Level without consuming a Spell Slot. Upcasting them still consumes a Spell Slot normally. You can change your selected Spells after a Long Rest.", mechanics: { requiredWizardLevel: 90, selections: [{ spellLevel: 1, count: 1 }, { spellLevel: 2, count: 1 }], requiresPrepared: true, freeAtBaseLevel: true, reselectAfter: "long_rest" } }),
    signature_spells: Object.freeze({ schemaVersion: 1, id: "signature_spells", name: "Signature Spells", source: WIZARD_SOURCE, contexts: ["any"], activation: { type: "choice", actionCost: "none" }, effects: [], rules: [], description: "Choose 2 Level 3 Wizard Spells from your Spellbook. These Spells are always Prepared and do not count against your Prepared Spell Limit. You can cast each selected Spell once without consuming a Spell Slot. Free uses recover after a Short or Long Rest. Upcasting still consumes a Spell Slot normally.", mechanics: { requiredWizardLevel: 100, spellLevel: 3, count: 2, alwaysPrepared: true, freeUsesEach: 1, reset: "short_or_long_rest", freeAtBaseLevel: true } }),
  });

  const grant = (level, traitId) => ({ id: `core_class_wizard_l${level}_${traitId}`, sourceType: "class", sourceId: CLASS_ID, source: { className: CLASS_NAME, atLevel: level, requiredClassLevel: level }, atLevel: level, traitId, grantType: "trait", multiclassPolicy: "allowed" });
  const WIZARD_GRANTS = Object.freeze([grant(1, "spellbook"), grant(1, "ritual_casting_wizard"), grant(1, "arcane_recovery"), grant(90, "spell_mastery"), grant(100, "signature_spells")]);

  function classEntries(c = {}) { const b = c.characterBuild || {}; const v = Array.isArray(c.classes) ? c.classes : Array.isArray(b.classes) ? b.classes : []; return v.filter(Boolean); }
  function wizardLevel(c = {}) { const e = classEntries(c).find((x) => normalizeId(x.classId || x.id || x.name) === CLASS_ID); return Math.max(0, intOr(e?.classLevel ?? e?.levels ?? e?.level, 0)); }
  function wizardProgressionLevel(c = {}) { const l = wizardLevel(c); if (!l) return 0; return spellcasting()?.limbusClassLevelToDndLevel?.(l) ?? Math.min(20, Math.max(1, Math.floor(l / 5))); }
  function intelligenceModifier(c = {}) { const r = spellcasting()?.resolveSpellcasting?.(c, CLASS_ID); if (Number.isFinite(Number(r?.spellMod))) return Number(r.spellMod); const s = c.stats || c.dndStats || {}; const score = [s.int, s.intelligence, s.inteligencia, c.int].find((v) => Number.isFinite(Number(v))); return Math.floor(((score == null ? 10 : Number(score)) - 10) / 2); }
  function preparedSpellLimit(c = {}) { return wizardLevel(c) ? Math.max(1, wizardProgressionLevel(c) + intelligenceModifier(c)) : 0; }
  function freeSpellbookAllowance(c = {}) { const l = wizardProgressionLevel(c); return l ? 6 + (l - 1) * 2 : 0; }

  function ensureWizardState(c) {
    if (!c || typeof c !== "object") throw new Error("Wizard Runtime requires a character object.");
    c[STATE_ROOT] ||= {}; c[STATE_ROOT][STATE_KEY] ||= {};
    const s = c[STATE_ROOT][STATE_KEY]; s.schemaVersion = 1;
    if (Array.isArray(s.spellbook)) s.spellbook = { spellIds: s.spellbook };
    s.spellbook ||= {}; s.spellbook.spellIds = uniqueIds(s.spellbook.spellIds); s.spellbook.freeSpellIds = uniqueIds(s.spellbook.freeSpellIds).filter((id) => s.spellbook.spellIds.includes(id));
    s.cantrips = uniqueIds(s.cantrips).slice(0, 3); s.preparedSpells = uniqueIds(s.preparedSpells).filter((id) => s.spellbook.spellIds.includes(id));
    s.arcaneRecovery ||= {}; s.arcaneRecovery.used = s.arcaneRecovery.used === true; s.arcaneRecovery.eligible = s.arcaneRecovery.eligible === true;
    s.spellMastery ||= {}; s.spellMastery.level1 = normalizeId(s.spellMastery.level1) || null; s.spellMastery.level2 = normalizeId(s.spellMastery.level2) || null; s.spellMastery.canReselect = s.spellMastery.canReselect === true;
    s.signatureSpells ||= {}; s.signatureSpells.spellIds = uniqueIds(s.signatureSpells.spellIds).slice(0, 2); s.signatureSpells.used ||= {}; s.signatureSpells.spellIds.forEach((id) => { s.signatureSpells.used[id] = s.signatureSpells.used[id] === true; });
    return s;
  }

