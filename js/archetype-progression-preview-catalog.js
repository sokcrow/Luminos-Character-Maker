(function (global) {
  "use strict";
  if (global.LuminousArchetypeProgressionPreviews) return;
  // Display-only feature previews extracted from real archetype runtime
  // grants/definitions (Additional Attack uses the shared Trait Catalog).
  // Do NOT load unselected combat runtimes or award these grants to players.
  const FEATURES = Object.freeze([
  {
    "archetypeId": "battle_master",
    "classId": "fighter",
    "level": 15,
    "id": "combat_superiority",
    "name": "Combat Superiority",
    "description": "Learn 3 Maneuvers from the Fighter Maneuver list. You can gain Superiority. [On Clash Win] Gain +3 Superiority. [On Hit] Gain +1 Superiority. Maneuver Damage Cap is 10%. When multiple Maneuver Damage bonuses apply to the same attack, their combined bonus cannot exceed this cap. Non-Damage effects use their own limits."
  },
  {
    "archetypeId": "battle_master",
    "classId": "fighter",
    "level": 15,
    "id": "student_of_war",
    "name": "Student of War",
    "description": "Gain proficiency with 1 Artisan Tool of your choice."
  },
  {
    "archetypeId": "battle_master",
    "classId": "fighter",
    "level": 35,
    "id": "know_your_enemy",
    "name": "Know Your Enemy",
    "description": "Every 10 Turns, unlock 1 feature from the currently observed Enemy Type without requiring an Analyse Check. This advances that Enemy Type's Observation Level in the Player Compendium."
  },
  {
    "archetypeId": "battle_master",
    "classId": "fighter",
    "level": 50,
    "id": "combat_superiority_plus",
    "name": "Combat Superiority+",
    "description": "Learn +1 additional Maneuver. [On Clash Win] Gain +4 Superiority. [On Hit] Gain +2 Superiority. Maneuver Damage Cap becomes 15% (shared by combined Maneuver Damage bonuses on the same attack)."
  },
  {
    "archetypeId": "battle_master",
    "classId": "fighter",
    "level": 75,
    "id": "relentless",
    "name": "Relentless",
    "description": "While at 25% Max HP or lower, double all Maneuver effects and their caps. Superiority costs are not doubled."
  },
  {
    "archetypeId": "battle_master",
    "classId": "fighter",
    "level": 90,
    "id": "combat_superiority_plus_plus",
    "name": "Combat Superiority++",
    "description": "Learn +1 additional Maneuver. [On Clash Win] Gain +5 Superiority. [On Hit] Gain +3 Superiority. Maneuver Damage Cap becomes 20% (shared by combined Maneuver Damage bonuses on the same attack)."
  },
  {
    "archetypeId": "champion",
    "classId": "fighter",
    "level": 15,
    "id": "improved_critical",
    "name": "Improved Critical",
    "description": "Deal +10% Crit Damage. Gain +1 additional Poise from Skills that grant Poise. [On Turn Start] Gain 2 Poise."
  },
  {
    "archetypeId": "champion",
    "classId": "fighter",
    "level": 35,
    "id": "remarkable_athlete",
    "name": "Remarkable Athlete",
    "description": "Gain +1 Final Power on STR, DEX and CON Checks. Gain +1 Max Speed."
  },
  {
    "archetypeId": "champion",
    "classId": "fighter",
    "level": 50,
    "id": "additional_fighting_style",
    "name": "Additional Fighting Style",
    "description": "Gain 1 additional Fighting Style from the Fighter Fighting Style list."
  },
  {
    "archetypeId": "champion",
    "classId": "fighter",
    "level": 75,
    "id": "superior_critical",
    "name": "Superior Critical",
    "description": "Replaces Improved Critical. Deal +20% Crit Damage. Gain +2 additional Poise from Skills that grant Poise. [On Turn Start] Gain 3 Poise."
  },
  {
    "archetypeId": "champion",
    "classId": "fighter",
    "level": 90,
    "id": "survivor",
    "name": "Survivor",
    "description": "[On Turn Start] If HP is 50% or lower, heal 5% Max HP."
  },
  {
    "archetypeId": "samurai",
    "classId": "fighter",
    "level": 15,
    "id": "fighting_spirit",
    "name": "Fighting Spirit",
    "description": "[On Hit] Gain 1 Fighting Spirit Count. [On Kill] Gain 3 Fighting Spirit Count. Gain 1 Shield per Fighting Spirit Count gained. Gain +1 Clash Power for every 5 Fighting Spirit Count (Max 2)."
  },
  {
    "archetypeId": "samurai",
    "classId": "fighter",
    "level": 35,
    "id": "elegant_courtier",
    "name": "Elegant Courtier",
    "description": "On Persuasion Checks, add your WIS Modifier to Final Power. Gain Proficiency on WIS Save Checks. If already proficient in WIS Saves, choose INT or CHA Save Checks instead."
  },
  {
    "archetypeId": "samurai",
    "classId": "fighter",
    "level": 50,
    "id": "fighting_spirit_plus",
    "name": "Fighting Spirit+",
    "description": "[On Hit] Gain 2 Fighting Spirit Count. [On Kill] Gain 5 Fighting Spirit Count. Gain 2 Shield per Fighting Spirit Count gained. Gain +1 Clash Power for every 5 Fighting Spirit Count (Max 2). Gain +1 Final Power for every 15 Fighting Spirit Count (Max 2)."
  },
  {
    "archetypeId": "samurai",
    "classId": "fighter",
    "level": 50,
    "id": "tireless_spirit",
    "name": "Tireless Spirit",
    "description": "[Encounter Start] Gain 5 Fighting Spirit Count. [On Turn Start] Gain 2 Fighting Spirit Count."
  },
  {
    "archetypeId": "samurai",
    "classId": "fighter",
    "level": 75,
    "id": "rapid_strike",
    "name": "Rapid Strike",
    "description": "[On Melee Skill End] Once per Turn: at 10+ Fighting Spirit use a random Tier 1 Skill against a random Enemy; at 20+ use Tier 2 instead; at 30+ use Tier 3 instead."
  },
  {
    "archetypeId": "samurai",
    "classId": "fighter",
    "level": 90,
    "id": "fighting_spirit_plus_plus",
    "name": "Fighting Spirit++",
    "description": "[On Hit] Gain 3 Fighting Spirit Count. [On Kill] Gain 7 Fighting Spirit Count. Gain 3 Shield per Fighting Spirit Count gained. Gain +1 Clash Power for every 5 Fighting Spirit Count (Max 2). Gain +1 Final Power for every 15 Fighting Spirit Count (Max 2). Deal +1% Damage for every Fighting Spirit Count."
  },
  {
    "archetypeId": "samurai",
    "classId": "fighter",
    "level": 90,
    "id": "strength_before_death",
    "name": "Strength Before Death",
    "description": "[On HP reaching 0] If you have Fighting Spirit Count, survive at 1 HP instead. Consume all Fighting Spirit Count. Recover 1% Max HP for each Fighting Spirit Count consumed. Once per Encounter."
  },
  {
    "archetypeId": "banneret",
    "classId": "fighter",
    "level": 15,
    "id": "rallying_cry",
    "name": "Rallying Cry",
    "description": "[On Use Second Wind] Heal the 3 Allies with the lowest current HP percentage for 10% of their Max HP."
  },
  {
    "archetypeId": "banneret",
    "classId": "fighter",
    "level": 35,
    "id": "royal_envoy",
    "name": "Royal Envoy",
    "description": "Gain Proficiency on Persuasion Checks. If already Proficient, gain Expertise on Persuasion Checks instead."
  },
  {
    "archetypeId": "banneret",
    "classId": "fighter",
    "level": 50,
    "id": "inspiring_surge",
    "name": "Inspiring Surge",
    "description": "[On Use Action Surge] The Ally with the highest Speed immediately uses a completely random offensive Skill against a random Enemy. Once per Action Surge."
  },
  {
    "archetypeId": "banneret",
    "classId": "fighter",
    "level": 75,
    "id": "bulwark",
    "name": "Bulwark",
    "description": "[On Use Indomitable] The Ally with the lowest Save Check result against the same effect immediately rerolls that Save Check and uses the new result. Once per Indomitable use."
  },
  {
    "archetypeId": "banneret",
    "classId": "fighter",
    "level": 90,
    "id": "inspiring_surge_plus",
    "name": "Inspiring Surge+",
    "description": "Replaces Inspiring Surge. [On Use Action Surge] The 2 Allies with the highest Speed each immediately use a completely random offensive Skill against a random Enemy. Once per Action Surge."
  },
  {
    "archetypeId": "mastermind",
    "classId": "rogue",
    "level": 15,
    "id": "master_of_intrigue",
    "name": "Master of Intrigue",
    "description": "You gain proficiency with the Disguise Kit, Forgery Kit, and one Gaming Set of your choice. You learn two additional languages. After listening to a creature speak for at least 1 minute, you can mimic its speech patterns, accent, and mannerisms well enough to pass yourself off as a native speaker of the same region or background."
  },
  {
    "archetypeId": "mastermind",
    "classId": "rogue",
    "level": 15,
    "id": "master_of_tactics",
    "name": "Master of Tactics",
    "description": "You use Help as a Quick Action. Your Help gives +1 additional Final Power; if used on a slower ally, +2 instead; if used on the slowest ally, +3 instead."
  },
  {
    "archetypeId": "mastermind",
    "classId": "rogue",
    "level": 45,
    "id": "insightful_manipulator",
    "name": "Insightful Manipulator",
    "description": "After observing or interacting with a creature for at least 1 minute outside of combat, you can assess its behavior and capabilities. You may determine whether selected mental or social attributes, or its overall experience, appear superior, equal, or inferior to your own. The DM may also reveal additional details about the creature's personality, habits, or background."
  },
  {
    "archetypeId": "mastermind",
    "classId": "rogue",
    "level": 65,
    "id": "misdirection",
    "name": "Misdirection",
    "description": "When you use Help on an ally, that ally applies 1 Assist Guard. Assist Guard - [Unit Name]: when [Unit Name] is targeted by an Unopposed Attack, redirect the attack and force a Clash using an available Skill you haven't used or selected. Consume 1 Count."
  },
  {
    "archetypeId": "mastermind",
    "classId": "rogue",
    "level": 85,
    "id": "soul_of_deceit",
    "name": "Soul of Deceit",
    "description": "Your thoughts cannot be read unless you allow it. When a creature attempts to read your mind, you may present false thoughts instead. Effects that attempt to determine whether you are speaking truthfully treat you as truthful if you choose."
  },
  {
    "archetypeId": "bladesinger",
    "classId": "wizard",
    "level": 10,
    "id": "training_in_war_and_song",
    "name": "Training in War and Song",
    "description": "Gain proficiency with Light Armor, Performance, and one One-Handed Melee Weapon type of your choice."
  },
  {
    "archetypeId": "bladesinger",
    "classId": "wizard",
    "level": 10,
    "id": "bladesong",
    "name": "Bladesong",
    "description": "Quick Action: Activate Bladesong. While active, gain +INT Modifier Defense Power, +1 Min & Max Speed, +4 on Acrobatics Checks, and +INT Modifier to Constitution Saves made to maintain Concentration. Bladesong ends if you become Incapacitated or use incompatible equipment."
  },
  {
    "archetypeId": "bladesinger",
    "classId": "wizard",
    "level": 30,
    "id": "additional_attack",
    "name": "Additional Attack",
    "description": "Melee Attack Skills with 2 or 3 Coins reuse the Skill's last Coin once per Skill."
  },
  {
    "archetypeId": "bladesinger",
    "classId": "wizard",
    "level": 50,
    "id": "song_of_defense",
    "name": "Song of Defense",
    "description": "While Bladesong is active, when you take Damage: spend 1 Spell Slot and reduce that Damage by 10% × Spell Slot Level."
  },
  {
    "archetypeId": "bladesinger",
    "classId": "wizard",
    "level": 70,
    "id": "song_of_victory",
    "name": "Song of Victory",
    "description": "While Bladesong is active, Melee Attack Skills deal +(5% × INT Modifier) Damage."
  },
  {
    "archetypeId": "path_of_the_zealot",
    "classId": "barbarian",
    "level": 15,
    "id": "divine_fury",
    "name": "Divine Fury",
    "description": "While having Rage, Radiance deals +1% Fixed Damage."
  },
  {
    "archetypeId": "path_of_the_zealot",
    "classId": "barbarian",
    "level": 15,
    "id": "warrior_of_the_gods",
    "name": "Warrior of the Gods",
    "description": "When you are Revived or Resurrected, gain Rage without spending a use. When you are reduced to 0 HP, Inflict 4 Radiance on 3 random enemies."
  },
  {
    "archetypeId": "path_of_the_zealot",
    "classId": "barbarian",
    "level": 30,
    "id": "fanatical_focus",
    "name": "Fanatical Focus",
    "description": "While having Rage, when you fail a Check, re-toss all Coins that rolled Tails once. This effect can only trigger once per Rage."
  },
  {
    "archetypeId": "path_of_the_zealot",
    "classId": "barbarian",
    "level": 50,
    "id": "zealous_presence",
    "name": "Zealous Presence",
    "description": "At Turn Start, all Allies gain Shield equal to floor(Class Level / 4) and recover 4 SP. Quick Action — Once per Long Rest: Triple the amount of Shield gained and SP recovered by this Trait at your next Turn Start."
  },
  {
    "archetypeId": "path_of_the_zealot",
    "classId": "barbarian",
    "level": 70,
    "id": "rage_beyond_death",
    "name": "Rage Beyond Death",
    "description": "While having Rage, being reduced to 0 HP does not prevent you from acting while Downed. You continue making Death Saves normally. If you would die from failed Death Saves while having Rage, your Death is delayed until Rage ends. When Rage ends, you die only if you still have 0 HP."
  },
  {
    "archetypeId": "bilgewater_buccaneer",
    "classId": "ranger",
    "level": 15,
    "id": "target_shift",
    "name": "Target Shift",
    "description": "While using a Pistol, the first Hit of a Ranged Skill deals +15% Damage and inflicts Target Mark. A unit with your Target Mark cannot receive the Damage bonus. Hitting a different target moves your Target Mark. Only one unit can have your Target Mark at a time."
  },
  {
    "archetypeId": "bilgewater_buccaneer",
    "classId": "ranger",
    "level": 35,
    "id": "ricochet",
    "name": "Ricochet",
    "description": "Unlock the Ricochet Quick Action. Activate it to empower your next Pistol Ranged Skill this Turn. Its first Hit ricochets to one additional enemy for 50% Damage, or 100% if that Hit defeats the main target."
  },
  {
    "archetypeId": "bilgewater_buccaneer",
    "classId": "ranger",
    "level": 50,
    "id": "sea_legs",
    "name": "Sea Legs",
    "description": "At Turn Start, if you did not take Damage during the previous Turn, gain 2 Haste this Turn. When Target Shift activates, gain 1 Haste next Turn. Haste gained from Sea Legs cannot exceed 3."
  },
  {
    "archetypeId": "bilgewater_buccaneer",
    "classId": "ranger",
    "level": 75,
    "id": "powder_rain",
    "name": "Powder Rain",
    "description": "Unlock the Powder Rain Quick Action. Up to 4 enemies make a DEX Save against Ranger Spell Save DC. Failed Save: full Damage and 2 Bind + 2 Fragile next Turn. Successful Save: half Damage and no statuses."
  },
  {
    "archetypeId": "bilgewater_buccaneer",
    "classId": "ranger",
    "level": 90,
    "id": "broadside",
    "name": "Broadside",
    "description": "Unlock Broadside and Covering Fire. Broadside is a Pistol Ranged Skill with Base Power 5, Coin Power 4, 5 Coins and ATK Weight 8. Each Coin selects and attacks a target independently. While in Backup, Covering Fire activates during the Combat Phase and each Hit deals 25% Damage. While Deployed, Broadside activates at Turn End at full Damage."
  },
  {
    "archetypeId": "bilgewater_demolisher",
    "classId": "ranger",
    "level": 15,
    "id": "new_destiny",
    "name": "New Destiny",
    "description": "Shotgun Ranged Skills deal +20% Damage. Shotgun Ranged Skills gain +1 ATK Weight. Secondary targets take only 60% of the Damage dealt to the main target. Shotguns deal +10% Critical Damage."
  },
  {
    "archetypeId": "bilgewater_demolisher",
    "classId": "ranger",
    "level": 35,
    "id": "smoke_screen",
    "name": "Smoke Screen",
    "description": "Unlock the Smoke Screen Skill. It is an Action, DEX Save Skill with ATK Weight 3. Each target that fails gains 3 Bind and 3 Clash Power Down next Turn. While an enemy is affected by Smoke Screen, you deal +10% Damage to that enemy. A successful Save negates all effects."
  },
  {
    "archetypeId": "bilgewater_demolisher",
    "classId": "ranger",
    "level": 50,
    "id": "quickdraw",
    "name": "Quickdraw",
    "description": "At Turn Start, if you have Haste, reload 1 Shotgun Ammunition for free."
  },
  {
    "archetypeId": "bilgewater_demolisher",
    "classId": "ranger",
    "level": 50,
    "id": "true_grit",
    "name": "True Grit",
    "description": "When a Shotgun Ranged Skill Hits, gain 1 Protection next Turn. Max 1 activation per Skill. True Grit can grant up to 3 Protection at a time."
  },
  {
    "archetypeId": "bilgewater_demolisher",
    "classId": "ranger",
    "level": 75,
    "id": "collateral_damage",
    "name": "Collateral Damage",
    "description": "When a Shotgun Ranged Skill Hits, its main target takes additional Fixed Damage equal to your Ranger Level ÷ 5. Secondary targets take Fixed Damage equal to half that amount. Triggers once per Skill."
  },
  {
    "archetypeId": "bilgewater_demolisher",
    "classId": "ranger",
    "level": 90,
    "id": "end_of_the_line",
    "name": "End of the Line",
    "description": "When a Shotgun Ranged Skill Hits its main target, mark that target until Attack End. At Attack End, the marked target takes an additional Hit equal to 30% of the Damage dealt by that Skill. Triggers once per Turn."
  }
]);
  const definitions = Object.freeze(Object.fromEntries(FEATURES.map(entry => [
    entry.id,
    Object.freeze({
      id: entry.id,
      name: entry.name,
      description: entry.description,
      source: { type:"archetype", archetypeId:entry.archetypeId, classId:entry.classId },
    }),
  ])));
  const grants = Object.freeze(FEATURES.map(entry => Object.freeze({
    sourceType:"archetype",
    sourceId:entry.archetypeId,
    archetypeId:entry.archetypeId,
    classId:entry.classId,
    atLevel:entry.level,
    traitId:entry.id,
  })));
  global.LuminousArchetypeProgressionPreviews = Object.freeze({
    FEATURES, DEFINITIONS:definitions, GRANTS:grants,
    allDefinitions:()=>({...definitions}),
    allGrants:()=>grants.map(entry=>({...entry})),
  });
})(typeof window !== "undefined" ? window : globalThis);
