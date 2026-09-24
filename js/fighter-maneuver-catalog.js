(function (global) {
  "use strict";

  if (global.LuminousFighterManeuverCatalog) return;

  const normalizeId = (value) => String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  const freeze = (value) => Object.freeze(value);

  const maneuver = (id, name, description, mechanics = {}) => freeze({
    schemaVersion: 1,
    id,
    name,
    description,
    source: freeze({ type: "class_maneuver", classId: "fighter", className: "Fighter" }),
    mechanics: freeze({ ...mechanics }),
  });

  const MANEUVERS = freeze({
    commanders_strike: maneuver("commanders_strike", "Commander's Strike", "Quick Action; Spend 20 Superiority; select an Ally. [On Combat Start] you and the selected Ally perform free Unopposed Attacks against the same selected target.", { actionCost: "quick_action", superiorityCost: 20, target: "selected_ally", trigger: "combat_start", freeUnopposedAttacks: 2, sameTarget: true }),
    disarming_attack: maneuver("disarming_attack", "Disarming Attack", "+1% Damage per Superiority Count. [On Hit] inflict 1 Clash Power Down every 10 Superiority Count.", { damagePerSuperiority: 0.01, baseDamageCap: 0.10, onHit: { clashPowerDownEverySuperiority: 10, amount: 1 } }),
    distracting_attack: maneuver("distracting_attack", "Distracting Attack", "+1% Damage per Superiority Count. Apply +1 Clash Power Up to 1 random Ally every 5 Superiority Count, up to 5 Allies.", { damagePerSuperiority: 0.01, baseDamageCap: 0.10, allyBuff: { status: "clash_power_up", amount: 1, randomAlliesEverySuperiority: 5, maxAllies: 5 } }),
    evasive_footwork: maneuver("evasive_footwork", "Evasive Footwork", "+1 Defensive Level every 5 Superiority Count (Max 5); +1 Defense Power every 5 Superiority Count (Max 3); [On Turn Start] +1 Haste every 3 Superiority Count (Max 3).", { defensiveLevelEverySuperiority: 5, defensiveLevelCap: 5, defensePowerEverySuperiority: 5, defensePowerCap: 3, turnStartHasteEverySuperiority: 3, hasteCap: 3 }),
    feinting_attack: maneuver("feinting_attack", "Feinting Attack", "+1% Damage per Superiority Count; +1 Clash Power Up every 5 Superiority Count (Max 3).", { damagePerSuperiority: 0.01, baseDamageCap: 0.10, clashPowerUpEverySuperiority: 5, clashPowerUpCap: 3 }),
    goading_attack: maneuver("goading_attack", "Goading Attack", "Spend 5 Superiority; +10% Damage. [On Hit] inflict Duel Mark - [Unit Name]. Duel Mark gives -3 Clash Power against Units other than the inflictor.", { superiorityCost: 5, flatDamageBonus: 0.10, onHitStatus: "duel_mark_[unit_name]", duelMarkOtherTargetClashPower: -3, dynamicInflictorIdentity: true }),
    lunging_attack: maneuver("lunging_attack", "Lunging Attack", "+1% Damage per Superiority Count; gain +1 Clash Power every 5 Superiority Count against slower targets (Max 4).", { damagePerSuperiority: 0.01, baseDamageCap: 0.10, slowerTargetClashPowerEverySuperiority: 5, slowerTargetClashPowerCap: 4 }),
    maneuvering_attack: maneuver("maneuvering_attack", "Maneuvering Attack", "+1% Damage per Superiority Count; apply +1 Haste to 1 random Ally every 5 Superiority Count, up to 5 Allies.", { damagePerSuperiority: 0.01, baseDamageCap: 0.10, allyBuff: { status: "haste", amount: 1, randomAlliesEverySuperiority: 5, maxAllies: 5 } }),
    menacing_attack: maneuver("menacing_attack", "Menacing Attack", "Spend 10 Superiority; +10% Damage. [On Hit] inflict 2 Frightened.", { superiorityCost: 10, flatDamageBonus: 0.10, onHit: { status: "frightened", amount: 2 } }),
    parry: maneuver("parry", "Parry", "[On Clash Win] raise the target's Stagger Threshold by 1 per Superiority Count.", { trigger: "clash_win", staggerThresholdPerSuperiority: 1 }),
    precision_attack: maneuver("precision_attack", "Precision Attack", "+2% Damage per Superiority Count.", { damagePerSuperiority: 0.02, baseDamageCap: 0.10 }),
    pushing_attack: maneuver("pushing_attack", "Pushing Attack", "+1% Damage per Superiority Count. [On Hit] raise Stagger Threshold by 1 every 2 Superiority Count.", { damagePerSuperiority: 0.01, baseDamageCap: 0.10, onHit: { staggerThresholdEverySuperiority: 2, amount: 1 } }),
    rally: maneuver("rally", "Rally", "+1% Damage per Superiority Count; apply 8 × Superiority Count Shield to a chosen Ally.", { damagePerSuperiority: 0.01, baseDamageCap: 0.10, shieldPerSuperiority: 8, target: "chosen_ally" }),
    riposte: maneuver("riposte", "Riposte", "[On Evade] Consume 5 Superiority; when the attacker's Skill ends, use a Counter against that attacker.", { trigger: "on_evade", superiorityCost: 5, counterOnAttackerSkillEnd: true }),
    sweeping_attack: maneuver("sweeping_attack", "Sweeping Attack", "+1% Damage per Superiority Count; +1 ATK Weight every 10 Superiority Count (Max 2).", { damagePerSuperiority: 0.01, baseDamageCap: 0.10, atkWeightEverySuperiority: 10, atkWeightCap: 2 }),
    trip_attack: maneuver("trip_attack", "Trip Attack", "Spend 15 Superiority; +10% Damage. [On Hit] inflict Prone.", { superiorityCost: 15, flatDamageBonus: 0.10, onHit: { status: "prone", amount: 1 } }),
    ambush: maneuver("ambush", "Ambush", "[On Encounter Start] gain 10 Superiority and 5 Haste.", { trigger: "encounter_start", gainSuperiority: 10, gainHaste: 5 }),
    bait_and_switch: maneuver("bait_and_switch", "Bait and Switch", "Gain 1 Aggro every 2 Superiority Count; for every Unit that targets you, apply 2 Haste to an Ally.", { aggroEverySuperiority: 2, hastePerTargetingUnit: 2, allySelection: "runtime_choice_pending" }),
    brace: maneuver("brace", "Brace", "Quick Action; Spend 15 Superiority; use a Tier 1 Skill on an Enemy.", { actionCost: "quick_action", superiorityCost: 15, useSkillTier: 1, target: "enemy", unopposed: false }),
    commanding_presence: maneuver("commanding_presence", "Commanding Presence", "[On Turn Start] Allies heal 3 SP every 5 Superiority Count; Enemies lose 1 SP every 5 Superiority Count.", { trigger: "turn_start", allySpEverySuperiority: 5, allySpAmount: 3, enemySpEverySuperiority: 5, enemySpAmount: -1 }),
    grappling_strike: maneuver("grappling_strike", "Grappling Strike", "Spend 10 Superiority. [On Hit] inflict Grappled.", { superiorityCost: 10, onHit: { status: "grappled", amount: 1 } }),
    quick_toss: maneuver("quick_toss", "Quick Toss", "Quick Action; Spend 10 Superiority; use a Tier 1 Ranged/Thrown Skill as an Unopposed Attack.", { actionCost: "quick_action", superiorityCost: 10, useSkillTier: 1, skillMode: ["ranged", "thrown"], unopposed: true }),
    tactical_assessment: maneuver("tactical_assessment", "Tactical Assessment", "[On Encounter Start] gain +1 Clash Power Up every 5 Superiority Count (Max 3) and apply +1 Clash Power Up to 1 random Ally every 10 Superiority Count, up to 2 Allies.", { trigger: "encounter_start", selfClashPowerUpEverySuperiority: 5, selfClashPowerUpCap: 3, allyClashPowerUpEverySuperiority: 10, allyClashPowerUpAmount: 1, maxAllies: 2, allySelection: "random" }),
  });

  function all() { return { ...MANEUVERS }; }
  function list() { return Object.values(MANEUVERS); }
  function get(id) { return MANEUVERS[normalizeId(id)] || null; }

  const api = freeze({ MANEUVERS, all, list, get, normalizeId });
  global.LuminousFighterManeuverCatalog = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
