/* Canonical equipment effects. Items declare data; no character-specific handlers. */
(function (global) {
  "use strict";
  if (global.LuminousEquipmentEffects) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousEquipmentEffects;
    return;
  }

  const VERSION = 1;
  const TYPES = Object.freeze([
    "sin_resistance", "sp_loss_reduction", "skill_check_bonus",
    "check_threshold_reduction", "heal_hp_percent", "grant_skill"
  ]);
  const TRIGGERS = Object.freeze(["passive", "on_turn_start"]);
  const norm = value => String(value ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  const positive = value => Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0;
  const array = value => Array.isArray(value) ? value : [];

  function equippedItems(unit = {}) {
    if (unit.equipmentInactive === true || unit.statusEffects?.moonfae_rabbit_form) return [];
    const equipment = unit.equipment || {};
    const slots = [equipment.mainHand, equipment.offHand, equipment.armor, equipment.shield, ...array(equipment.accessories)];
    const augments = [unit.augmentations, unit.augments, unit.bodyAugmentations]
      .find(Array.isArray) || [];
    const active = [];
    const seen = new Set();
    for (const [index, item] of [...slots, ...augments].entries()) {
      if (!item || typeof item !== "object") continue;
      // Augments must actually be installed, not merely present on the unit.
      if (index >= slots.length && (item.installed !== true || item.equipped === false)) continue;
      if (item.broken === true || item.isBroken === true || item.disabled === true) continue;
      const id = String(item.instanceId || item.instance_id || item.id || "");
      const key = id || `slot:${index}`;
      if (seen.has(key)) continue;
      seen.add(key);
      active.push({ item, id: key });
    }
    return active;
  }

  function effectsFor(unit = {}, trigger = "passive") {
    const wanted = norm(trigger);
    const results = [];
    for (const { item, id } of equippedItems(unit)) {
      const configured = item.runtime?.equipmentEffects ?? item.equipmentEffects ?? [];
      for (const [index, effect] of array(configured).entries()) {
        if (!effect || typeof effect !== "object") continue;
        const type = norm(effect.type);
        const event = norm(effect.trigger || "passive");
        if (!TYPES.includes(type) || !TRIGGERS.includes(event) || event !== wanted) continue;
        results.push({ ...effect, type, trigger: event, sourceItemId: id, effectKey: `${id}:${index}` });
      }
    }
    return results;
  }

  function skillCheckBonus(unit = {}, skillId = "") {
    const skill = norm(skillId);
    return effectsFor(unit).reduce((sum, effect) =>
      sum + (effect.type === "skill_check_bonus" && norm(effect.skill) === skill
        ? Number(effect.value) || 0 : 0), 0);
  }

  function checkThresholdAdjustment(unit = {}, checkId = "") {
    const check = norm(checkId);
    const reduction = effectsFor(unit).reduce((sum, effect) =>
      sum + (effect.type === "check_threshold_reduction" && norm(effect.check) === check
        ? positive(effect.value) : 0), 0);
    return reduction > 0 ? -reduction : 0;
  }

  function resolveSinResistance(unit = {}, sin = "", base = 1) {
    const kind = norm(sin);
    const original = Number.isFinite(Number(base)) ? Math.max(0, Number(base)) : 1;
    return effectsFor(unit).reduce((best, effect) => {
      if (effect.type !== "sin_resistance" || norm(effect.sin) !== kind) return best;
      const value = Number(effect.multiplier ?? effect.value);
      return Number.isFinite(value) && value >= 0 ? Math.min(best, value) : best;
    }, original);
  }

  function mitigateSpLoss(unit = {}, loss = 0, options = {}) {
    const incoming = positive(loss);
    if (options.voluntary === true || options.isCost === true) return incoming;
    // All modifiers use the strongest single flat reduction by default.
    const reduction = effectsFor(unit).reduce((best, effect) =>
      effect.type === "sp_loss_reduction" ? Math.max(best, positive(effect.value)) : best, 0);
    return Math.max(0, incoming - reduction);
  }

  function grantedSkillIds(unit = {}) {
    const ids = new Set();
    for (const effect of effectsFor(unit)) {
      if (effect.type === "grant_skill" && effect.skillId) ids.add(String(effect.skillId));
    }
    return [...ids];
  }

  function applyTurnStart(unit = {}, options = {}) {
    if (options.authoritative !== true) return { applied: false, reason: "authority_required" };
    if (!unit || unit.battleActive === false || unit.dead === true || unit.defeated === true ||
        unit.incapacitated === true || positive(unit.hp) === 0)
      return { applied: false, reason: "inactive_unit" };
    const turn = Math.trunc(Number(options.round));
    if (!Number.isInteger(turn) || turn < 1) return { applied: false, reason: "round_required" };
    const encounter = String(options.encounterId || "active");
    if (!unit.equipmentEffectTurnLedger || typeof unit.equipmentEffectTurnLedger !== "object")
      unit.equipmentEffectTurnLedger = {};
    const ledger = unit.equipmentEffectTurnLedger;
    const prefix = `${encounter}:${turn}:`;
    let total = 0;
    const applied = [];
    const maxHp = Math.max(1, Math.floor(positive(unit.maxHp ?? unit.maxHP ?? unit.hp_max ?? unit.combatStats?.hp_max)));
    for (const effect of effectsFor(unit, "on_turn_start")) {
      const key = prefix + effect.effectKey;
      if (ledger[key] === true) continue;
      if (effect.type !== "heal_hp_percent") continue;
      ledger[key] = true;
      const amount = Math.floor(maxHp * positive(effect.value) / 100);
      const before = positive(unit.hp);
      unit.hp = Math.min(maxHp, before + amount);
      total += unit.hp - before;
      applied.push(effect.effectKey);
    }
    // Keep only the most recent rounds; the authority persists the ledger.
    if (Object.keys(ledger).length > 128) {
      for (const key of Object.keys(ledger)) if (!key.startsWith(prefix)) delete ledger[key];
    }
    return { applied: applied.length > 0, healed: total, effects: applied };
  }

  const api = Object.freeze({
    VERSION, TYPES, TRIGGERS, equippedItems, effectsFor, skillCheckBonus,
    checkThresholdAdjustment, resolveSinResistance, mitigateSpLoss,
    grantedSkillIds, applyTurnStart
  });
  global.LuminousEquipmentEffects = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : window);
