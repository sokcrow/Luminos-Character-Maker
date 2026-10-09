(function (global) {
  "use strict";

  if (global.LuminousGeneralTraitCatalog) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousGeneralTraitCatalog;
    return;
  }

  const CATALOG_VERSION = 1;
  const SIN_AFFINITIES = Object.freeze(["wrath", "lust", "sloth", "gluttony", "gloom", "pride", "envy"]);
  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
  const freeze = (value, seen = new WeakSet()) => {
    if (!value || typeof value !== "object" || seen.has(value)) return value;
    seen.add(value); Object.values(value).forEach((v) => freeze(v, seen)); return Object.freeze(value);
  };
  const modifier = (channel, value, conditions = [], unit = null) => ({
    type: "modifier", trigger: "passive", target: "self", channel, mode: "add", value,
    ...(unit ? { unit } : {}), conditions,
  });
  const stat = (statId) => ({ type: "stat", trigger: "passive", target: "self", statId, value: 1, max: 20 });
  const check = (id, conditions) => ({
    id, contexts: ["theatre"], trigger: "before_check", conditions,
    operations: [{ type: "modify", path: "check.difficulty", mode: "add", value: -4 }],
  });
  const any = (...entries) => ({ any: entries.map((value) => ({ path: "check.tags", operator: "contains", value })) });
  const mode = (type) => ({ path: "skill.attackMode", operator: "eq", value: type });
  const weaponFamily = (...names) => ({ any: names.map((value) => ({ path: "skill.weaponFamily", operator: "eq", value })) });
  function definition(id, name, context, activation, prerequisites, lines, extras = {}) {
    return {
      schemaVersion: 1, id, name, category: "general",
      source: { type: "general", id: "general_traits" },
      description: lines.map((line, i) => `${i + 1}. ${line}`).join("\n"),
      display: { type: "General Trait", activation: activation.display, context, prerequisites, effects: lines },
      contexts: context === "Theatre / Combat" ? ["theatre", "combat"] : [context.toLowerCase()],
      activation: { type: activation.type, actionCost: activation.actionCost },
      requirements: { text: prerequisites },
      effects: extras.effects || [],
      rules: extras.rules || [],
      mechanics: extras.mechanics || {},
    };
  }
  const passive = { type: "passive", actionCost: "none", display: "Passive" };
  const manualReaction = { type: "manual", actionCost: "reaction", display: "Manual (Reaction)" };
  const manualAction = { type: "manual", actionCost: "action", display: "Passive / Manual (Action)" };

  const DEFINITIONS = {
    actor: definition("actor", "ACTOR", "Theatre", passive, "None", [
      "Increase Charisma by +1, up to 20.",
      "Deception or Performance Checks when impersonating reduce Threshold by 4.",
      "Mimic voices or sounds after listening for 1 minute.",
      "Detection uses CHA Deception versus WIS Insight.",
    ], {
      rules: [stat("charisma")],
      effects: [check("actor_impersonation", [
        { path: "check.skillId", operator: "in", value: ["deception", "performance"] },
        { path: "check.tags", operator: "contains", value: "impersonation" },
      ])],
      mechanics: { mimicAfterListeningMinutes: 1, detectOpposedCheck: "deception_vs_insight" },
    }),
    alert: definition("alert", "ALERT", "Combat", passive, "None", [
      "[Encounter Start] During the first Turn of an Encounter, gain +5 Haste.",
      "While conscious, immune to Surprise and associated encounter-start penalties.",
      "Invisible enemies do not gain +5 Final Power against you solely from Invisibility.",
    ], { mechanics: { encounterStartHaste: 5, surpriseImmunity: true, invisibleAttackerFinalPowerNegation: 5 } }),
    athlete_strength: definition("athlete_strength", "ATHLETE — Strength", "Theatre / Combat", passive, "None", [
      "Increase Strength by +1, up to 20.",
      "[Turn Start] Standing from Prone costs 1 Speed instead of forcing Speed to 1.",
      "Climbing and jumping use the approved Athlete movement exceptions.",
    ], { rules: [stat("strength")], mechanics: { athleteAbilityChoice: "strength", proneStandSpeedCost: 1, climbMovementMultiplier: 1, runningJumpApproachFeet: 5 } }),
    athlete_dexterity: definition("athlete_dexterity", "ATHLETE — Dexterity", "Theatre / Combat", passive, "None", [
      "Increase Dexterity by +1, up to 20.",
      "[Turn Start] Standing from Prone costs 1 Speed instead of forcing Speed to 1.",
      "Climbing and jumping use the approved Athlete movement exceptions.",
    ], { rules: [stat("dexterity")], mechanics: { athleteAbilityChoice: "dexterity", proneStandSpeedCost: 1, climbMovementMultiplier: 1, runningJumpApproachFeet: 5 } }),
    charger: definition("charger", "CHARGER", "Combat", passive, "None", [
      "When your Speed is higher than your target's Speed, your Melee Attack Skills deal +5% Damage.",
    ], { rules: [modifier("damage_dealt_multiplier", 5, [
      mode("melee"), { path: "self.speed", operator: "gt", valueFormula: "TargetSpeed" },
      { path: "target.speed", operator: "gte", value: 0 },
    ], "percent")] }),
    trigger_expert: definition("trigger_expert", "TRIGGER EXPERT", "Combat", passive, "None", [
      "[Turn End] Reload your equipped Crossbow or Firearm.",
      "[Clash] Gain +1 Clash Power when using a Crossbow or Firearm Ranged Attack Skill against a Melee Attack Skill.",
    ], { mechanics: { autoReloadAtTurnEnd: ["crossbow", "firearm"], rangedAgainstMeleeClashPower: 1 } }),
    defensive_duelist: definition("defensive_duelist", "DEFENSIVE DUELIST", "Combat", manualReaction, "Dexterity 13", [
      "[Reaction] While wielding a proficient Finesse Weapon, spend 1 Reaction to perform a Guard with +4 Defense Power against that Melee Attack Skill. (Once per Turn)",
    ], { mechanics: { guardDefensePower: 4, requiresProficientFinesseWeapon: true, targetAttackMode: "melee", oncePerTurn: true, requiresGuardResolver: true } }),
    dual_wielder: definition("dual_wielder", "DUAL WIELDER", "Combat", passive, "None", [
      "While wielding a one-handed Melee Weapon in each hand, gain +1 Defensive Level.",
      "While dual-wielding, every 2nd Coin deals +5% Damage.",
    ], {
      rules: [modifier("defensive_level", 1, [
        { path: "equipment.mainHand.category", operator: "eq", value: "weapon" },
        { path: "equipment.mainHand.classification", operator: "contains", value: "melee" },
        { path: "equipment.mainHand.equipment.handCost", operator: "eq", value: 1 },
        { path: "equipment.offHand.category", operator: "eq", value: "weapon" },
        { path: "equipment.offHand.classification", operator: "contains", value: "melee" },
        { path: "equipment.offHand.equipment.handCost", operator: "eq", value: 1 },
      ])],
      mechanics: { everySecondCoinBonusDamagePercent: 5, noDoubleLightBonus: true },
    }),
    dungeon_delver: definition("dungeon_delver", "DUNGEON DELVER", "Theatre / Combat", passive, "None", [
      "[Theatre] Perception and Investigation Checks to detect Secret Doors or Traps reduce Threshold by 4.",
      "[Saving Throw] Checks to avoid or resist Traps reduce Threshold by 4.",
      "Take Half Damage from Traps.",
    ], {
      effects: [
        check("dungeon_delver_search", [
          { path: "check.skillId", operator: "in", value: ["perception", "investigation"] },
          any("secret_door", "trap"),
        ]),
        check("dungeon_delver_save", [
          { path: "check.kind", operator: "in", value: ["save", "saving_throw"] },
          { path: "check.tags", operator: "contains", value: "trap" },
        ]),
      ],
      mechanics: { trapDamageMultiplier: 0.5 },
    }),
    durable: definition("durable", "DURABLE", "Theatre / Combat", passive, "None", [
      "Increase Constitution by +1, up to 20.",
      "[Recover] Restore additional HP equal to 2 × your Constitution Modifier (minimum 2 HP).",
    ], { rules: [stat("constitution")], mechanics: { recoverFlatBonusFormula: "max(2, 2 * ConstitutionMod)" } }),
    grappler: definition("grappler", "GRAPPLER", "Combat", manualAction, "Strength 13", [
      "Deal +5% Damage to targets Grappled by you.",
      "[Action] While Grappling a target, spend 1 Action to perform another Grapple Check. On success, apply Restrained to both Units until the Grapple ends.",
    ], { mechanics: { grappledBySelfDamagePercent: 5, retrainOpposedGrappleCheck: true, restrainBothUntilGrappleEnd: true } }),
    great_weapon_master: definition("great_weapon_master", "GREAT WEAPON MASTER", "Combat", passive, "None", [
      "[Before Skill] With a proficient Heavy Melee Weapon, you may take -2 Clash Power to deal +15% Damage with that Skill.",
      "[On Crit / On Kill] Gain +1 Attack Power Up next Turn. (Once per Turn)",
    ], { mechanics: { optInHeavyTradeoff: { clashPower: -2, damagePercent: 15 }, nextTurnAttackPowerUp: 1, oncePerTurn: true } }),
    healer: definition("healer", "HEALER", "Theatre / Combat", passive, "None", [
      "[Stabilize] When you stabilize a Downed Unit, restore 5% Max HP to that Unit.",
      "[Item Use] When using an HP Healing Item on another Unit, restore an additional 5% of the target's Max HP. (Once per Target per Short or Long Rest)",
    ], { mechanics: { onStabilizeTargetMaxHpPercent: 5, healingItemAllyTargetMaxHpPercent: 5, healingItemAllyReset: "short_or_long_rest" } }),
    heavily_armored: definition("heavily_armored", "HEAVILY ARMORED", "Theatre / Combat", passive, "Medium Armor Proficiency", [
      "Increase Strength by +1, up to 20.",
      "Gain Heavy Armor Proficiency.",
    ], { rules: [stat("strength")], mechanics: { grantArmorProficiency: ["heavy"] } }),
  };

  for (const affinity of SIN_AFFINITIES) {
    const name = affinity[0].toUpperCase() + affinity.slice(1);
    DEFINITIONS[`elemental_adept_${affinity}`] = definition(
      `elemental_adept_${affinity}`, `ELEMENTAL ADEPT — ${name}`, "Combat", passive,
      "Can cast at least one Spell",
      [
        `Chosen Sin Affinity: ${name}.`,
        "[Spell] Spells of the chosen Sin Affinity ignore 0.3 of enemy Sin Resistance when it would reduce Damage.",
        "[Spell] Spells of the chosen Sin Affinity deal +5% Damage.",
        "This Trait can be selected multiple times, choosing a different Sin Affinity each time.",
      ], {
        rules: [modifier("damage_dealt_multiplier", 5, [
          { path: "skill.skillFamily", operator: "eq", value: "spell" },
          { path: "skill.sinAffinity", operator: "eq", value: affinity },
        ], "percent")],
        mechanics: { selectedSinAffinity: affinity, ignoreReducingSinResistance: 0.3 },
      }
    );
  }

  // The conceptual Feats Athlete and Elemental Adept are represented by
  // non-stackable choice IDs; the progression UI selects a concrete variant.
  const FEAT_IDS = freeze([
    "actor", "alert", "athlete", "charger", "trigger_expert",
    "defensive_duelist", "dual_wielder", "dungeon_delver", "durable",
    "elemental_adept", "grappler", "great_weapon_master", "healer", "heavily_armored",
  ]);
  const CATALOG = freeze(DEFINITIONS);
  const api = Object.freeze({
    CATALOG_VERSION, FEAT_IDS, SIN_AFFINITIES, DEFINITIONS: CATALOG,
    allDefinitions: () => clone(CATALOG),
    allGrants: () => [],
    getDefinition: (id) => clone(CATALOG[String(id || "").trim().toLowerCase().replace(/\s+/g, "_")] || null),
  });
  global.LuminousGeneralTraitCatalog = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
