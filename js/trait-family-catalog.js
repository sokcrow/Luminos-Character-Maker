(function (global) {
  "use strict";

  if (global.LuminousTraitFamilies) return;

  // Presentation-only functional categories. Source (race/class/archetype/etc.)
  // remains a separate field; these labels never change Trait mechanics.
  const FAMILIES = Object.freeze({
    ofensiva: { label: "Ofensiva" },
    precision: { label: "Precisión" },
    defensa: { label: "Defensa" },
    supervivencia: { label: "Supervivencia" },
    movilidad: { label: "Movilidad" },
    instinto: { label: "Instinto" },
    potenciacion: { label: "Potenciación" },
    magia: { label: "Magia" },
    recursos: { label: "Recursos" },
    apoyo: { label: "Apoyo" },
    tecnica: { label: "Técnica" },
    especial: { label: "Especial" },
    social: { label: "Social" },
  });

  const ALIASES = Object.freeze({
    offense: "ofensiva", offensive: "ofensiva", attack: "ofensiva", damage: "ofensiva",
    accuracy: "precision", aim: "precision", critical: "precision",
    defense: "defensa", defensive: "defensa", protection: "defensa",
    survival: "supervivencia", survivability: "supervivencia", endurance: "supervivencia",
    mobility: "movilidad", movement: "movilidad", speed: "movilidad",
    instinct: "instinto", senses: "instinto", perception: "instinto",
    enhancement: "potenciacion", empowerment: "potenciacion", buff: "potenciacion",
    magic: "magia", spellcasting: "magia", spell: "magia",
    resource: "recursos", resources: "recursos",
    support: "apoyo", healing: "apoyo",
    technique: "tecnica", technical: "tecnica", maneuver: "tecnica",
    special: "especial", unique: "especial",
  });

  const clean = (value) => String(value == null ? "" : value)
    .trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");

  function normalize(value) {
    const id = clean(value);
    const known = ALIASES[id] || id;
    return Object.prototype.hasOwnProperty.call(FAMILIES, known) ? known : "";
  }

  function explicitFamily(trait) {
    if (!trait || typeof trait !== "object") return "";
    const values = [
      trait.family, trait.traitFamily, trait.functionalFamily,
      trait.classification && trait.classification.family,
      trait.metadata && trait.metadata.family,
    ];
    for (const value of values) {
      const match = normalize(value);
      if (match) return match;
    }
    return "";
  }

  // Canonical family for known class-granted Traits. Trait IDs, not display names,
  // define the icon: localization and free-text descriptions cannot change it.
  // An explicit family stored on the Trait still takes precedence.
  const CLASS_TRAIT_FAMILIES = Object.freeze(Object.fromEntries(
    Object.entries({
        "defensa": [
            "armorless_defense",
            "unarmored_defense",
            "patient_defense",
            "deflect_missiles",
            "uncanny_dodge",
            "slippery_mind"
        ],
        "supervivencia": [
            "unstoppable_rage",
            "second_wind",
            "indomitable",
            "stillness_of_mind",
            "purity_of_body",
            "diamond_soul",
            "timeless_body"
        ],
        "ofensiva": [
            "reckless_attack",
            "additional_attack",
            "additional_attack_plus",
            "additional_attack_plus_plus",
            "flurry_of_blows",
            "stunning_strike",
            "sneak_attack",
            "foe_slayer"
        ],
        "precision": [
            "brutal_critical",
            "stroke_of_luck"
        ],
        "movilidad": [
            "fast_movement",
            "step_of_the_wind",
            "unarmored_movement",
            "slow_fall",
            "evasion",
            "unarmored_movement_plus",
            "unarmored_movement_plus_plus",
            "cunning_action",
            "nimble_reflexes",
            "elusive",
            "lands_stride",
            "hide_in_plain_sight",
            "vanish"
        ],
        "instinto": [
            "danger_senses",
            "wild_instincts",
            "blindsense",
            "favored_enemy",
            "primeval_awareness",
            "feral_senses"
        ],
        "potenciacion": [
            "rage",
            "persistent_rage",
            "unstoppable_strength",
            "primordial_champion",
            "action_surge",
            "ki_empowered_strikes"
        ],
        "magia": [
            "spellcasting",
            "spellbook",
            "ritual_casting_wizard",
            "sorcerous_origin",
            "metamagic",
            "empty_body",
            "careful_spell",
            "distant_spell",
            "empowered_spell",
            "extended_spell",
            "heightened_spell",
            "quickened_spell",
            "subtle_spell",
            "twinned_spell",
            "seeking_spell",
            "transmuted_spell"
        ],
        "recursos": [
            "ki",
            "perfect_self",
            "font_of_inspiration",
            "superior_inspiration",
            "arcane_recovery",
            "spell_mastery",
            "signature_spells",
            "font_of_magic",
            "sorcerous_restoration"
        ],
        "apoyo": [
            "bardic_inspiration",
            "resting_song",
            "countercharm"
        ],
        "tecnica": [
            "fighting_style",
            "martial_arts",
            "jack_of_all_trades",
            "expertise",
            "rogue_expertise",
            "reliable_talent",
            "natural_explorer"
        ],
        "social": [
            "thieves_cant",
            "tongue_of_the_sun_and_moon"
        ]
    }).flatMap(([family, ids]) =>
      ids.map((id) => [id, family]))
  ));

  const SIGNALS = Object.freeze([
    // Strong indicators of what the Trait does, rather than who grants it.
    ["social", /\b(persuasion|deception|intimidation|charisma_check|dialogue|diplomacy|negotiat|reputation|conversation|persuad|persuasi[oó]n|engañ|convencer)\b/i],
    ["magia", /\b(spellcast|spell_slot|spellbook|spell|magic|cantrip|conjuration|evocation|metamagic|magic_damage|arcane|hechizo|conjuro|magical|magia)\b/i],
    ["instinto", /\b(perception|insight|observation|analyse_check|analyze|sense|scent|darkvision|blindsight|truesight|tracking|intuition|awareness|olfato|rastrear|percepci[oó]n)\b/i],
    ["recursos", /\b(superiority|ki_points?|mana|spell_points?|resource_gain|resource_recovery|resource_max|regain_sp|recover_sp|restore_sp|energy|ammunition|ammo|supplies|currency|coin_gain|rage_charges?)\b/i],
    ["movilidad", /\b(movement_speed|move_speed|speed_bonus|walking_speed|dash|disengage|teleport|haste|flight|climb|swim_speed|extra_movement|speed|mobility|evasion_movement|desplazamiento|velocidad)\b/i],
    ["precision", /\b(accuracy|hit_chance|critical|crit_damage|crit_chance|poise|aim|target_lock|precision|attack_roll_bonus|punteria|acierto)\b/i],
    ["apoyo", /\b(ally_heal|heal_allies|healing_allies|restore_ally|team_heal|party_heal|ally_buff|allies_gain|allies_receive|chosen_ally|random_ally|teamwide|inspire|inspiration|aid_ally|healing_word|curar_aliado|apoyo)\b/i],
    ["supervivencia", /\b(regeneration|revive|death_save|death_saving|relentless_endurance|second_wind|self_heal|self_recovery|regain_hp|recover_hp|hit_points?_recovery|survival|resurrection|undying|supervivencia|revivir)\b/i],
    ["defensa", /\b(defense|defence|defensive_level|damage_reduction|damage_taken|armor|armour|shield|guard|parry|block|resistance|stagger_threshold|counter_power|protection|ward|defensa|escudo)\b/i],
    ["tecnica", /\b(maneuver|manoeuvre|technique|artisan|craft|tool_proficiency|weapon_mastery|fighting_style|proficiency|counterattack|martial_arts|combat_style|tactician|tecnica|t[ée]cnica)\b/i],
    ["potenciacion", /\b(enhance|empower|boost|buff|bonus_power|clash_power_up|strength_bonus|ability_increase|amplif|potenciaci[oó]n|improve_stat)\b/i],
    ["ofensiva", /\b(damage_dealt|damage_bonus|damage_multiplier|offensive_level|extra_attack|attack_bonus|bleed|burn|rupture|tremor|sinking|smite|strike|rage_damage|offensive|damage|attack|ataque|daño)\b/i],
  ]);

  function semantics(trait) {
    // Only use the actual Trait definition, not its origin/source class.
    const parts = [
      trait && trait.id, trait && trait.name, trait && trait.description,
      trait && trait.mechanics, trait && trait.effects, trait && trait.rules,
    ];
    const text = parts.map((part) => typeof part === "string" ? part :
      part && typeof part === "object" ? JSON.stringify(part) : "").join(" ")
      .replace(/([a-z])([A-Z])/g, "$1_$2");
    return text + " " + text.replace(/[_-]/g, " ");
  }

  function classify(trait) {
    const specified = explicitFamily(trait);
    if (specified) return specified;
    const knownClassTrait = CLASS_TRAIT_FAMILIES[clean(trait?.id)];
    if (knownClassTrait) return knownClassTrait;
    const subject = semantics(trait || {});
    for (const [id, pattern] of SIGNALS) {
      // Scan original names and expanded mechanic identifiers.
      if (pattern.test(subject)) return id;
    }
    return "especial"; // Honest catch-all, never mistaken for a source category.
  }

  function resolve(trait) {
    const id = classify(trait);
    const definition = FAMILIES[id];
    return Object.freeze({
      id,
      label: definition.label,
      icon: "Assets/Icons/trait-families/" + id + ".png",
    });
  }

  // One node may grant several Traits from different families. Keep each
  // distinct family and never classify the synthetic class-choice placeholder.
  function forMilestone(node) {
    const unique = new Map();
    for (const item of node?.items || []) {
      if (!item || item.kind === "milestone_choice") continue;
      const definition = item.definition || { id: item.id, name: item.name, description: item.description };
      const family = resolve(definition);
      if (!unique.has(family.id)) unique.set(family.id, family);
    }
    return [...unique.values()];
  }

  global.LuminousTraitFamilies = Object.freeze({ FAMILIES, CLASS_TRAIT_FAMILIES, normalize, classify, resolve, forMilestone });
  if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousTraitFamilies;
})(typeof window !== "undefined" ? window : globalThis);
