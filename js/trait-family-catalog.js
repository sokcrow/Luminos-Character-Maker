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

  const SIGNALS = Object.freeze([
    // Strong indicators of what the Trait does, rather than who grants it.
    ["social", /\b(persuasion|deception|intimidation|charisma_check|dialogue|diplomacy|negotiat|reputation|conversation|persuad|persuasi[oó]n|engañ|convencer)\b/i],
    ["magia", /\b(spellcast|spell_slot|spellbook|cantrip|conjuration|evocation|metamagic|magic_damage|arcane|hechizo|conjuro|magical|magia)\b/i],
    ["instinto", /\b(perception|insight|observation|analyse_check|analyze|sense|scent|darkvision|blindsight|truesight|tracking|intuition|awareness|olfato|rastrear|percepci[oó]n)\b/i],
    ["recursos", /\b(superiority|ki_points?|mana|spell_points?|resource_gain|resource_recovery|resource_max|regain_sp|recover_sp|restore_sp|energy|ammunition|ammo|supplies|currency|coin_gain|rage_charges?)\b/i],
    ["movilidad", /\b(movement_speed|move_speed|speed_bonus|walking_speed|dash|disengage|teleport|haste|flight|climb|swim_speed|extra_movement|mobility|evasion_movement|desplazamiento|velocidad)\b/i],
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

  global.LuminousTraitFamilies = Object.freeze({ FAMILIES, normalize, classify, resolve });
  if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousTraitFamilies;
})(typeof window !== "undefined" ? window : globalThis);
