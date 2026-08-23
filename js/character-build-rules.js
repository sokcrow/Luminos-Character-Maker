(function (global) {
  "use strict";

  const SETTINGS = Object.freeze({
    version: 1,
    maxCharacterLevel: 100,
    naturalHpCoefCap: 3.40,
    raceOffModifier: 0,
    defaultRaceId: "human",
  });

  const CLASSES = Object.freeze([
    { id: "barbarian", name: "Bárbaro", code: "BAR", hpPer5: 12, hpCoefBase: 2.90, offMod: 0, defMod: 2 },
    { id: "fighter", name: "Guerrero", code: "GUE", hpPer5: 10, hpCoefBase: 2.86, offMod: 1, defMod: 1 },
    { id: "paladin", name: "Paladín", code: "PAL", hpPer5: 10, hpCoefBase: 2.88, offMod: 0, defMod: 2 },
    { id: "monk", name: "Monje", code: "MON", hpPer5: 10, hpCoefBase: 2.84, offMod: 1, defMod: 1 },
    { id: "druid", name: "Druida", code: "DRU", hpPer5: 8, hpCoefBase: 2.80, offMod: 0, defMod: 1 },
    { id: "artificer", name: "Artífice", code: "ART", hpPer5: 8, hpCoefBase: 2.81, offMod: 1, defMod: 1 },
    { id: "ranger", name: "Ranger", code: "RAN", hpPer5: 8, hpCoefBase: 2.82, offMod: 1, defMod: 0 },
    { id: "cleric", name: "Clérigo", code: "CLE", hpPer5: 8, hpCoefBase: 2.81, offMod: 0, defMod: 1 },
    { id: "rogue", name: "Pícaro", code: "PIC", hpPer5: 8, hpCoefBase: 2.78, offMod: 2, defMod: -1 },
    { id: "sorcerer", name: "Hechicero", code: "HEC", hpPer5: 6, hpCoefBase: 2.72, offMod: 2, defMod: -2 },
    { id: "bard", name: "Bardo", code: "BRD", hpPer5: 8, hpCoefBase: 2.77, offMod: 1, defMod: 0 },
    { id: "warlock", name: "Brujo", code: "BRU", hpPer5: 8, hpCoefBase: 2.76, offMod: 2, defMod: -1 },
    { id: "wizard", name: "Mago", code: "MAG", hpPer5: 6, hpCoefBase: 2.70, offMod: 2, defMod: -2 },
  ]);

  const RACES = Object.freeze([
    { id: "human", name: "Humano", hpCoefBonus: 0.00, defMod: 0, isDefault: true, tags: ["organic", "humanoid", "human"] },
    { id: "lizalin", name: "Lizalin", hpCoefBonus: 0.07, defMod: 0, tags: ["organic", "humanoid", "reptilian"] },
    { id: "kobold", name: "Kobold", hpCoefBonus: 0.00, defMod: 0, tags: ["organic", "humanoid", "reptilian", "small"] },
    { id: "kenku", name: "Kenku", hpCoefBonus: 0.00, defMod: 0, tags: ["organic", "humanoid", "avian"] },
    { id: "centaur", name: "Centauro", hpCoefBonus: 0.07, defMod: 0, tags: ["organic", "humanoid", "equine", "large_build"] },
    { id: "goliath", name: "Goliat", hpCoefBonus: 0.10, defMod: 1, tags: ["organic", "humanoid", "large_build", "mountain_adapted"] },
    { id: "lanae", name: "Lanae", hpCoefBonus: 0.06, defMod: 0, tags: ["organic", "humanoid", "lanae", "mountain_adapted"] },
    { id: "goblin", name: "Goblin", hpCoefBonus: 0.02, defMod: 0, tags: ["organic", "humanoid", "goblinoid", "small"] },
    { id: "fairy", name: "Hada", hpCoefBonus: 0.00, defMod: 0, tags: ["organic", "humanoid", "fae", "arcane_core"], subtypes: [
      { id: "fire", name: "Fuego", hpCoefBonus: 0.00, defMod: 0 },
      { id: "flowers", name: "Flores", hpCoefBonus: 0.00, defMod: 0 },
      { id: "ice", name: "Hielo", hpCoefBonus: 0.00, defMod: 0 },
      { id: "light", name: "Luz", hpCoefBonus: 0.00, defMod: 0 },
    ] },
    { id: "aasimar", name: "Aasimar", hpCoefBonus: 0.03, defMod: 0, tags: ["organic", "humanoid", "celestial"], subtypes: [
      { id: "protector", name: "Protector", hpCoefBonus: 0.00, defMod: 0 },
      { id: "scourge", name: "Azotador", hpCoefBonus: 0.00, defMod: 0 },
      { id: "fallen", name: "Caído", hpCoefBonus: 0.00, defMod: 0 },
    ] },
    { id: "tiefling", name: "Tiefling", hpCoefBonus: 0.03, defMod: 0, tags: ["organic", "humanoid", "infernal"], subtypes: [
      { id: "asmodeus", name: "Asmodeo", hpCoefBonus: 0.00, defMod: 0 },
      { id: "baalzebul", name: "Baalzebul", hpCoefBonus: 0.00, defMod: 0 },
      { id: "dispater", name: "Dispater", hpCoefBonus: 0.00, defMod: 0 },
      { id: "glasya", name: "Glasya", hpCoefBonus: 0.00, defMod: 0 },
      { id: "fierna", name: "Fierna", hpCoefBonus: 0.00, defMod: 0 },
      { id: "levistus", name: "Levistus", hpCoefBonus: 0.00, defMod: 0 },
      { id: "mammon", name: "Mammon", hpCoefBonus: 0.00, defMod: 0 },
      { id: "mephistopheles", name: "Mefistófeles", hpCoefBonus: 0.00, defMod: 0 },
      { id: "zariel", name: "Zariel", hpCoefBonus: 0.00, defMod: 0 },
    ] },
    { id: "half_demon", name: "Half-Demon", hpCoefBonus: 0.06, defMod: 0, tags: ["organic", "humanoid", "demonic"] },
    { id: "warforged", name: "Warforged", hpCoefBonus: 0.12, defMod: 1, tags: ["construct", "sapient", "mechanical"], subtypes: [
      { id: "envoy", name: "Envoy", hpCoefBonus: 0.00, defMod: 0 },
      { id: "juggernaut", name: "Juggernaut", hpCoefBonus: 0.04, defMod: 0 },
      { id: "skirmisher", name: "Skirmisher", hpCoefBonus: 0.00, defMod: 0 },
    ] },
    { id: "felinae", name: "Felinae", hpCoefBonus: 0.02, defMod: 0, tags: ["organic", "humanoid", "feline"], subtypes: [
      { id: "ordinary", name: "Ordinario", hpCoefBonus: 0.00, defMod: 0 },
      { id: "large", name: "Grande", hpCoefBonus: 0.04, defMod: 0 },
      { id: "mystic", name: "Místico", hpCoefBonus: 0.00, defMod: 0 },
    ] },
    { id: "half_dragon", name: "Semi Dragón", hpCoefBonus: 0.10, defMod: 0, tags: ["organic", "humanoid", "draconic"], subtypes: [
      { id: "red", name: "Rojo", hpCoefBonus: 0.00, defMod: 0 },
      { id: "black", name: "Negro", hpCoefBonus: 0.02, defMod: 0 },
      { id: "green", name: "Verde", hpCoefBonus: 0.00, defMod: 0 },
      { id: "white", name: "Blanco", hpCoefBonus: 0.02, defMod: 0 },
      { id: "blue", name: "Azul", hpCoefBonus: 0.00, defMod: 0 },
      { id: "gold", name: "Oro", hpCoefBonus: 0.00, defMod: 0 },
      { id: "brass", name: "Latón", hpCoefBonus: 0.00, defMod: 0 },
      { id: "copper", name: "Cobre", hpCoefBonus: 0.00, defMod: 0 },
      { id: "bronze", name: "Bronce", hpCoefBonus: 0.00, defMod: 0 },
      { id: "silver", name: "Plata", hpCoefBonus: 0.00, defMod: 0 },
    ] },
    { id: "lupae", name: "Lupae", hpCoefBonus: 0.06, defMod: 0, tags: ["organic", "humanoid", "canine"] },
    { id: "moonfae", name: "Moonfae", hpCoefBonus: 0.02, defMod: 0, tags: ["organic", "humanoid", "fae", "lunar"], subtypes: [
      { id: "full_moon", name: "Luna Llena", hpCoefBonus: 0.00, defMod: 0 },
      { id: "crescent_moon", name: "Luna Creciente", hpCoefBonus: 0.00, defMod: 0 },
      { id: "new_moon", name: "Luna Nueva", hpCoefBonus: 0.00, defMod: 0 },
      { id: "crimson_moon", name: "Luna Carmesí", hpCoefBonus: 0.00, defMod: 0 },
      { id: "blue_moon", name: "Luna Azul", hpCoefBonus: 0.00, defMod: 0 },
    ] },
    { id: "yuan_ti_pureblood", name: "Yuan-ti Pura Sangre", hpCoefBonus: 0.03, defMod: 0, tags: ["organic", "humanoid", "reptilian", "yuan_ti"], subtypes: [
      { id: "red_eyes", name: "Ojos Rojos — Ira", hpCoefBonus: 0.00, defMod: 0 },
      { id: "purple_eyes", name: "Ojos Morados — Envidia", hpCoefBonus: 0.00, defMod: 0 },
      { id: "cyan_eyes", name: "Ojos Cyan — Melancolía", hpCoefBonus: 0.00, defMod: 0 },
      { id: "blue_eyes", name: "Ojos Azules — Orgullo", hpCoefBonus: 0.00, defMod: 0 },
      { id: "green_eyes", name: "Ojos Verdes — Gula", hpCoefBonus: 0.00, defMod: 0 },
      { id: "orange_eyes", name: "Ojos Naranjas — Lujuria de Conocimiento", hpCoefBonus: 0.00, defMod: 0 },
      { id: "yellow_eyes", name: "Ojos Amarillos — Pereza", hpCoefBonus: 0.00, defMod: 0 },
      { id: "pale_eyes", name: "Los Pálidos — Mutaciones Empáticas", hpCoefBonus: 0.00, defMod: 0 },
    ] },
  ]);

  const BACKGROUNDS = Object.freeze([
    { id: "nest_heir", name: "Heredero de un Nest", hpCoefBonus: 0.02, category: "civilian" },
    { id: "wing_executive_family", name: "Familia ejecutiva de Wing", hpCoefBonus: 0.03, category: "civilian" },
    { id: "comfortable_feather", name: "Feather acomodado", hpCoefBonus: 0.04, category: "civilian" },
    { id: "wing_administrator", name: "Empleado administrativo de Wing", hpCoefBonus: 0.05, category: "civilian" },
    { id: "civil_researcher", name: "Académico / investigador civil", hpCoefBonus: 0.05, category: "civilian" },
    { id: "nest_student", name: "Estudiante de academia de Nest", hpCoefBonus: 0.04, category: "civilian" },
    { id: "docugrapher", name: "Docugrapher / trabajador de información", hpCoefBonus: 0.07, category: "civilian" },
    { id: "nest_merchant", name: "Comerciante de Nest", hpCoefBonus: 0.07, category: "civilian" },
    { id: "backstreets_merchant", name: "Comerciante de Backstreets", hpCoefBonus: 0.12, category: "civilian" },
    { id: "city_charlatan", name: "Estafador de la Ciudad", hpCoefBonus: 0.10, category: "civilian" },
    { id: "gambler", name: "Jugador profesional", hpCoefBonus: 0.10, category: "civilian" },
    { id: "urban_performer", name: "Artista / performer urbano", hpCoefBonus: 0.12, category: "civilian" },
    { id: "chef", name: "Chef / restaurateur", hpCoefBonus: 0.13, category: "civilian" },
    { id: "common_artisan", name: "Artesano común", hpCoefBonus: 0.14, category: "labor" },
    { id: "industrial_worker", name: "Trabajador industrial", hpCoefBonus: 0.17, category: "labor" },
    { id: "backstreets_heavy_worker", name: "Trabajador pesado de Backstreets", hpCoefBonus: 0.21, category: "labor" },
    { id: "farmer", name: "Agricultor", hpCoefBonus: 0.22, category: "labor" },
    { id: "protected_backstreets", name: "Habitante protegido de Backstreets", hpCoefBonus: 0.15, category: "backstreets" },
    { id: "backstreets_resident", name: "Habitante común de Backstreets", hpCoefBonus: 0.18, category: "backstreets" },
    { id: "experienced_street_dweller", name: "Callejero experimentado", hpCoefBonus: 0.21, category: "backstreets" },
    { id: "rat", name: "Rat", hpCoefBonus: 0.23, category: "backstreets" },
    { id: "backstreets_orphan", name: "Huérfano de Backstreets", hpCoefBonus: 0.24, category: "backstreets" },
    { id: "childhood_street_survivor", name: "Superviviente callejero desde niño", hpCoefBonus: 0.27, category: "backstreets" },
    { id: "hooligan", name: "Matón / hooligan", hpCoefBonus: 0.25, category: "backstreets" },
    { id: "protection_collector", name: "Cobrador de protección", hpCoefBonus: 0.25, category: "backstreets" },
    { id: "smuggler", name: "Contrabandista", hpCoefBonus: 0.24, category: "backstreets" },
    { id: "backstreets_bounty_hunter", name: "Cazarrecompensas de Backstreets", hpCoefBonus: 0.27, category: "backstreets" },
    { id: "underground_guide", name: "Guía de rutas clandestinas", hpCoefBonus: 0.24, category: "backstreets" },
    { id: "community_protector", name: "Protector comunitario", hpCoefBonus: 0.28, category: "backstreets" },
    { id: "district23_resident", name: "Habitante de District 23 Backstreets", hpCoefBonus: 0.27, category: "backstreets" },
    { id: "night_backstreets_survivor", name: "Superviviente habitual de Night in the Backstreets", hpCoefBonus: 0.31, category: "backstreets" },
    { id: "novice_fixer", name: "Fixer novato", hpCoefBonus: 0.18, category: "fixer" },
    { id: "office_fixer", name: "Fixer de Office ordinaria", hpCoefBonus: 0.22, category: "fixer" },
    { id: "escort_fixer", name: "Fixer escolta", hpCoefBonus: 0.24, category: "fixer" },
    { id: "investigator_fixer", name: "Fixer investigador", hpCoefBonus: 0.20, category: "fixer" },
    { id: "recovery_fixer", name: "Fixer de recuperación", hpCoefBonus: 0.23, category: "fixer" },
    { id: "bounty_fixer", name: "Fixer cazarrecompensas", hpCoefBonus: 0.27, category: "fixer" },
    { id: "combat_fixer", name: "Fixer de combate", hpCoefBonus: 0.28, category: "fixer" },
    { id: "extermination_fixer", name: "Fixer de exterminación", hpCoefBonus: 0.31, category: "fixer" },
    { id: "veteran_fixer", name: "Fixer veterano", hpCoefBonus: 0.32, category: "fixer" },
    { id: "contract_veteran", name: "Veterano de innumerables contratos", hpCoefBonus: 0.35, category: "fixer" },
    { id: "hana_fixer", name: "Antiguo Hana Fixer", hpCoefBonus: 0.27, category: "association" },
    { id: "zwei_fixer", name: "Zwei — Protección y escolta", hpCoefBonus: 0.28, category: "association" },
    { id: "tres_inspector", name: "Tres — Inspector técnico / Workshop", hpCoefBonus: 0.18, category: "association" },
    { id: "shi_assassin", name: "Shi — Asesino profesional", hpCoefBonus: 0.32, category: "association" },
    { id: "cinq_duelist", name: "Cinq — Duelista profesional", hpCoefBonus: 0.30, category: "association" },
    { id: "liu_combatant", name: "Liu — Combatiente de guerra abierta", hpCoefBonus: 0.34, category: "association" },
    { id: "seven_investigator", name: "Seven — Investigador de campo", hpCoefBonus: 0.21, category: "association" },
    { id: "eight_explorer", name: "Eight — Explorador / marino", hpCoefBonus: 0.30, category: "association" },
    { id: "devyat_courier", name: "Devyat — Courier de alto riesgo", hpCoefBonus: 0.31, category: "association" },
    { id: "dieci_researcher", name: "Dieci — Investigador / recolector", hpCoefBonus: 0.18, category: "association" },
    { id: "oufi_mediator", name: "Öufi — Mediador de contratos", hpCoefBonus: 0.17, category: "association" },
    { id: "workshop_apprentice", name: "Aprendiz de Workshop", hpCoefBonus: 0.13, category: "workshop" },
    { id: "workshop_technician", name: "Técnico de Workshop", hpCoefBonus: 0.16, category: "workshop" },
    { id: "weaponsmith", name: "Armero", hpCoefBonus: 0.17, category: "workshop" },
    { id: "prosthetic_engineer", name: "Ingeniero de prótesis", hpCoefBonus: 0.16, category: "workshop" },
    { id: "workshop_fixer", name: "Workshop Fixer", hpCoefBonus: 0.22, category: "workshop" },
    { id: "weapons_tester", name: "Tester de armamento", hpCoefBonus: 0.24, category: "workshop" },
    { id: "dangerous_field_workshop", name: "Workshop de campo peligroso", hpCoefBonus: 0.27, category: "workshop" },
    { id: "minor_syndicate", name: "Miembro de Syndicate pequeño", hpCoefBonus: 0.24, category: "syndicate" },
    { id: "syndicate_enforcer", name: "Enforcer de Syndicate", hpCoefBonus: 0.28, category: "syndicate" },
    { id: "hitman", name: "Sicario", hpCoefBonus: 0.30, category: "syndicate" },
    { id: "territorial_war_veteran", name: "Veterano de guerras territoriales", hpCoefBonus: 0.34, category: "syndicate" },
    { id: "gang_captain", name: "Capitán de pandilla", hpCoefBonus: 0.31, category: "syndicate" },
    { id: "dead_rabbits", name: "Dead Rabbits", hpCoefBonus: 0.27, category: "syndicate" },
    { id: "tingtang", name: "Tingtang Gang", hpCoefBonus: 0.26, category: "syndicate" },
    { id: "mariachis", name: "Los Mariachis", hpCoefBonus: 0.23, category: "syndicate" },
    { id: "yurodiviye", name: "Yurodiviye", hpCoefBonus: 0.25, category: "syndicate" },
    { id: "kurokumo_wakashu", name: "Kurokumo Wakashu", hpCoefBonus: 0.30, category: "syndicate" },
    { id: "kurokumo_captain", name: "Kurokumo Captain", hpCoefBonus: 0.33, category: "syndicate" },
    { id: "blade_lineage_salsu", name: "Blade Lineage Salsu", hpCoefBonus: 0.34, category: "syndicate" },
    { id: "blade_lineage_veteran", name: "Blade Lineage veterano", hpCoefBonus: 0.37, category: "syndicate" },
    { id: "twinhook_pirate", name: "Twinhook Pirate", hpCoefBonus: 0.31, category: "syndicate" },
    { id: "twinhook_veteran", name: "Twinhook veterano", hpCoefBonus: 0.34, category: "syndicate" },
    { id: "thumb_member", name: "Thumb — miembro inferior", hpCoefBonus: 0.32, category: "finger" },
    { id: "thumb_veteran", name: "Thumb — Enforcer veterano", hpCoefBonus: 0.36, category: "finger" },
    { id: "index_proselyte", name: "Index — Proselyte", hpCoefBonus: 0.29, category: "finger" },
    { id: "index_proxy", name: "Index — Proxy / Messenger", hpCoefBonus: 0.35, category: "finger" },
    { id: "middle_member", name: "Middle — miembro", hpCoefBonus: 0.33, category: "finger" },
    { id: "middle_veteran", name: "Middle — veterano de venganzas", hpCoefBonus: 0.36, category: "finger" },
    { id: "ring_student", name: "Ring — Student / combat artist", hpCoefBonus: 0.31, category: "finger" },
    { id: "ring_veteran", name: "Ring — artista veterano", hpCoefBonus: 0.35, category: "finger" },
    { id: "pinky_operator", name: "Pinky — operativo infiltrado", hpCoefBonus: 0.32, category: "finger" },
    { id: "pinky_veteran", name: "Pinky — operativo veterano", hpCoefBonus: 0.36, category: "finger" },
    { id: "great_lake_fisher", name: "Pescador del Great Lake", hpCoefBonus: 0.24, category: "great_lake" },
    { id: "sailor", name: "Marinero", hpCoefBonus: 0.28, category: "great_lake" },
    { id: "navigator", name: "Navegante", hpCoefBonus: 0.29, category: "great_lake" },
    { id: "harpooner", name: "Harpooner", hpCoefBonus: 0.33, category: "great_lake" },
    { id: "whaler", name: "Whaler", hpCoefBonus: 0.35, category: "great_lake" },
    { id: "ship_captain", name: "Capitán de barco", hpCoefBonus: 0.31, category: "great_lake" },
    { id: "pirate", name: "Pirata", hpCoefBonus: 0.31, category: "great_lake" },
    { id: "great_lake_veteran", name: "Veterano del Great Lake", hpCoefBonus: 0.37, category: "great_lake" },
    { id: "whale_survivor", name: "Superviviente de Whale encounter", hpCoefBonus: 0.40, category: "great_lake" },
    { id: "pequod_survivor", name: "Superviviente estilo Pequod", hpCoefBonus: 0.45, category: "great_lake" },
    { id: "outskirts_child", name: "Niño abandonado en Outskirts", hpCoefBonus: 0.30, category: "outskirts" },
    { id: "outskirts_settler", name: "Habitante de asentamiento Outskirts", hpCoefBonus: 0.32, category: "outskirts" },
    { id: "outskirts_explorer", name: "Explorador de Outskirts", hpCoefBonus: 0.35, category: "outskirts" },
    { id: "ruins_scavenger", name: "Recolector de Ruins", hpCoefBonus: 0.36, category: "outskirts" },
    { id: "settlement_hunter", name: "Hunter de asentamiento", hpCoefBonus: 0.38, category: "outskirts" },
    { id: "veteran_hunter", name: "Veterano Hunter", hpCoefBonus: 0.41, category: "outskirts" },
    { id: "outskirts_lone_survivor", name: "Superviviente solitario de Outskirts", hpCoefBonus: 0.43, category: "outskirts" },
    { id: "ruins_extreme_survivor", name: "Superviviente extremo de Ruins", hpCoefBonus: 0.45, category: "outskirts" },
    { id: "wing_military_recruit", name: "Recluta militar de Wing", hpCoefBonus: 0.27, category: "wing" },
    { id: "r_corp_rabbit", name: "R Corp Rabbit", hpCoefBonus: 0.34, category: "wing" },
    { id: "r_corp_reindeer", name: "R Corp Reindeer", hpCoefBonus: 0.32, category: "wing" },
    { id: "r_corp_rhino", name: "R Corp Rhino", hpCoefBonus: 0.37, category: "wing" },
    { id: "r_corp_raven", name: "R Corp Raven", hpCoefBonus: 0.36, category: "wing" },
    { id: "r_corp_extermination_veteran", name: "Veterano de exterminación R Corp", hpCoefBonus: 0.39, category: "wing" },
    { id: "w_cleanup_l2", name: "W Corp Cleanup Agent L2", hpCoefBonus: 0.23, category: "wing" },
    { id: "w_cleanup_l3", name: "W Corp Cleanup Agent L3", hpCoefBonus: 0.28, category: "wing" },
    { id: "w_cleanup_veteran", name: "W Corp Cleanup Agent veterano", hpCoefBonus: 0.31, category: "wing" },
    { id: "w_cleanup_l4", name: "W Corp Cleanup Agent L4+", hpCoefBonus: 0.34, category: "wing" },
    { id: "k_security_l1", name: "K Corp Class 1 Security", hpCoefBonus: 0.20, category: "wing" },
    { id: "k_security_l2", name: "K Corp Class 2 / Checkpoint", hpCoefBonus: 0.27, category: "wing" },
    { id: "k_excision_l3", name: "K Corp Class 3 Excision Staff", hpCoefBonus: 0.32, category: "wing" },
    { id: "k_excision_veteran", name: "Veterano Excision Staff", hpCoefBonus: 0.35, category: "wing" },
    { id: "k_researcher", name: "Investigador K Corp", hpCoefBonus: 0.07, category: "wing" },
    { id: "smoke_war_recruit", name: "Recluta de la Smoke War", hpCoefBonus: 0.32, category: "war" },
    { id: "smoke_war_soldier", name: "Soldado de la Smoke War", hpCoefBonus: 0.37, category: "war" },
    { id: "smoke_war_veteran", name: "Veterano de la Smoke War", hpCoefBonus: 0.40, category: "war" },
    { id: "smoke_war_extreme_survivor", name: "Superviviente de campaña extrema", hpCoefBonus: 0.43, category: "war" },
    { id: "lcorp_clerk", name: "Antiguo clerk de L Corp", hpCoefBonus: 0.16, category: "lobotomy" },
    { id: "lcorp_branch_employee", name: "Empleado de Branch facility", hpCoefBonus: 0.20, category: "lobotomy" },
    { id: "lcorp_containment_agent", name: "Agente de contención", hpCoefBonus: 0.30, category: "lobotomy" },
    { id: "lcorp_suppression_veteran", name: "Veterano de supresiones", hpCoefBonus: 0.34, category: "lobotomy" },
    { id: "lcorp_branch_fall_survivor", name: "Superviviente de caída de una Branch", hpCoefBonus: 0.36, category: "lobotomy" },
    { id: "abnormality_survivor", name: "Superviviente prolongado entre Abnormalities", hpCoefBonus: 0.40, category: "lobotomy" },
    { id: "ordinary_cultist", name: "Devoto / cultista ordinario", hpCoefBonus: 0.08, category: "anomaly" },
    { id: "militant_fanatic", name: "Fanático militante", hpCoefBonus: 0.24, category: "anomaly" },
    { id: "distortion_investigator", name: "Investigador de Distortions", hpCoefBonus: 0.23, category: "anomaly" },
    { id: "distortion_incident_survivor", name: "Superviviente de Distortion incident", hpCoefBonus: 0.29, category: "anomaly" },
    { id: "distortion_hunter", name: "Cazador de Distortions", hpCoefBonus: 0.34, category: "anomaly" },
    { id: "bloodfiend_hunter", name: "Cazador de Bloodfiends", hpCoefBonus: 0.35, category: "anomaly" },
    { id: "abnormality_incident_survivor", name: "Superviviente de Abnormality", hpCoefBonus: 0.34, category: "anomaly" },
    { id: "repeated_anomaly_survivor", name: "Superviviente repetido de fenómenos anómalos", hpCoefBonus: 0.39, category: "anomaly" },
    { id: "nest_family_servant", name: "Sirviente de familia de Nest", hpCoefBonus: 0.10, category: "district8" },
    { id: "personal_retainer", name: "Retainer / asistente personal", hpCoefBonus: 0.15, category: "district8" },
    { id: "family_bodyguard", name: "Bodyguard familiar", hpCoefBonus: 0.28, category: "district8" },
    { id: "political_heir", name: "Heredero entrenado para política", hpCoefBonus: 0.10, category: "district8" },
    { id: "duelist_heir", name: "Heredero entrenado para duelos", hpCoefBonus: 0.24, category: "district8" },
    { id: "family_strife_survivor", name: "Superviviente de luchas familiares", hpCoefBonus: 0.30, category: "district8" },
    { id: "heishou_trainee", name: "Heishou trainee", hpCoefBonus: 0.31, category: "district8" },
    { id: "heishou_veteran", name: "Heishou veterano", hpCoefBonus: 0.35, category: "district8" },
    { id: "house_spiders_apprentice", name: "House of Spiders Apprentice", hpCoefBonus: 0.40, category: "special" },
    { id: "house_spiders_survivor", name: "House of Spiders Survivor", hpCoefBonus: 0.43, category: "special" },
  ]);

  const CATEGORY_LABELS = Object.freeze({
    civilian: "Ciudadanos / Civil",
    labor: "Trabajo físico",
    backstreets: "Backstreets",
    fixer: "Fixers",
    association: "Associations",
    workshop: "Workshops",
    syndicate: "Syndicates",
    finger: "Five Fingers",
    great_lake: "Great Lake",
    outskirts: "Outskirts",
    wing: "Wings / Fuerzas corporativas",
    war: "Guerra",
    lobotomy: "Lobotomy Corporation",
    anomaly: "Fenómenos / Anomalías",
    district8: "District 8 / Familias",
    special: "Especiales",
  });

  const classMap = new Map(CLASSES.map((entry) => [entry.id, entry]));
  const raceMap = new Map(RACES.map((entry) => [entry.id, entry]));
  const backgroundMap = new Map(BACKGROUNDS.map((entry) => [entry.id, entry]));

  const numberOr = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const integerOr = (value, fallback = 0) => Number.isFinite(Number.parseInt(value, 10)) ? Number.parseInt(value, 10) : fallback;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  function symmetricRound(value) {
    const numeric = numberOr(value, 0);
    if (numeric === 0) return 0;
    return Math.sign(numeric) * Math.floor(Math.abs(numeric) + 0.5);
  }

  function normalizeClassChoices(value) {
    if (!Array.isArray(value)) return [];
    return value
      .map((entry) => ({
        classId: String(entry?.classId || entry?.id || "").trim(),
        levels: Math.max(0, integerOr(entry?.levels, 0)),
      }))
      .filter((entry) => entry.classId && entry.levels > 0 && classMap.has(entry.classId));
  }

  function classLevelTotal(value) {
    return normalizeClassChoices(value).reduce((sum, entry) => sum + entry.levels, 0);
  }

  function weightedClassValue(classes, selector) {
    const normalized = normalizeClassChoices(classes);
    const total = normalized.reduce((sum, entry) => sum + entry.levels, 0);
    if (!total) return 0;
    return normalized.reduce((sum, entry) => {
      const definition = classMap.get(entry.classId);
      return sum + entry.levels * selector(definition);
    }, 0) / total;
  }

  function raceSubtype(race, subtypeId) {
    if (!race || !subtypeId || !Array.isArray(race.subtypes)) return null;
    return race.subtypes.find((entry) => entry.id === subtypeId) || null;
  }

  function validateBuild(input = {}) {
    const level = clamp(integerOr(input.level, 1), 1, SETTINGS.maxCharacterLevel);
    const classes = normalizeClassChoices(input.classes);
    const total = classes.reduce((sum, entry) => sum + entry.levels, 0);
    const race = raceMap.get(String(input.raceId || "")) || null;
    const background = backgroundMap.get(String(input.backgroundId || "")) || null;
    const subtypeId = String(input.raceSubtypeId || "").trim();
    const subtype = raceSubtype(race, subtypeId);
    const errors = [];

    if (!classes.length) errors.push("Asigna al menos una clase.");
    if (classes.length && total !== level) errors.push(`Los niveles de clase suman ${total}; deben sumar ${level}.`);
    if (!background) errors.push("Selecciona un trasfondo.");
    if (!race) errors.push("Selecciona una raza.");
    if (race?.subtypes?.length && !subtype) errors.push("Selecciona la subraza / variante racial.");

    return {
      complete: errors.length === 0,
      errors,
      level,
      classes,
      classLevelTotal: total,
      race,
      subtype,
      background,
    };
  }

  function calculateBuild(input = {}) {
    const validation = validateBuild(input);
    const level = validation.level;
    const constitution = Math.max(1, integerOr(input.constitution, 10));
    const conMod = Math.floor((constitution - 10) / 2);
    const tier = Math.ceil(level / 5);
    const classes = validation.classes;

    const weightedHpPer5 = weightedClassValue(classes, (definition) => definition.hpPer5);
    const classHpCoef = weightedClassValue(classes, (definition) => definition.hpCoefBase);
    const classOffModRaw = weightedClassValue(classes, (definition) => definition.offMod);
    const classDefModRaw = weightedClassValue(classes, (definition) => definition.defMod);
    const classOffMod = symmetricRound(classOffModRaw);
    const classDefMod = symmetricRound(classDefModRaw);

    const backgroundHpCoefBonus = validation.background?.hpCoefBonus || 0;
    const raceHpCoefBonus = (validation.race?.hpCoefBonus || 0) + (validation.subtype?.hpCoefBonus || 0);
    const raceDefMod = (validation.race?.defMod || 0) + (validation.subtype?.defMod || 0);
    const transformationHpCoefBonus = numberOr(input.transformationHpCoefBonus, 0);

    const intrinsicHpCoefUncapped = classHpCoef + backgroundHpCoefBonus + raceHpCoefBonus + transformationHpCoefBonus;
    const intrinsicHpCoef = Math.min(SETTINGS.naturalHpCoefCap, intrinsicHpCoefUncapped);
    const runtimeHpCoef = numberOr(input.runtimeHpCoef, 0);
    const effectiveHpCoef = intrinsicHpCoef + runtimeHpCoef;

    const hpBaseRaw = tier * (weightedHpPer5 + conMod);
    const hpBase = Math.max(0, Math.round(hpBaseRaw));

    const baseOffLevel = Math.max(0, integerOr(input.baseOffLevel, level));
    const baseDefLevel = Math.max(0, integerOr(input.baseDefLevel, level));
    const runtimeOff = numberOr(input.runtimeOff, 0);
    const runtimeDef = numberOr(input.runtimeDef, 0);
    const offLevel = baseOffLevel + classOffMod + runtimeOff;
    const defLevel = baseDefLevel + classDefMod + raceDefMod + runtimeDef;
    const hp = Math.max(0, Math.round(hpBase + effectiveHpCoef * defLevel));

    return {
      valid: validation.complete,
      errors: validation.errors.slice(),
      level,
      constitution,
      conMod,
      tier,
      classes,
      classLevelTotal: validation.classLevelTotal,
      weightedHpPer5,
      hpBaseRaw,
      hpBase,
      classHpCoef,
      backgroundHpCoefBonus,
      raceHpCoefBonus,
      transformationHpCoefBonus,
      intrinsicHpCoefUncapped,
      intrinsicHpCoef,
      effectiveHpCoef,
      classOffModRaw,
      classOffMod,
      classDefModRaw,
      classDefMod,
      raceDefMod,
      baseOffLevel,
      baseDefLevel,
      offLevel,
      defLevel,
      hp,
      raceId: validation.race?.id || null,
      raceSubtypeId: validation.subtype?.id || null,
      backgroundId: validation.background?.id || null,
    };
  }

  function backgroundGroups() {
    const groups = {};
    BACKGROUNDS.forEach((entry) => {
      const key = entry.category || "other";
      if (!groups[key]) groups[key] = [];
      groups[key].push(entry);
    });
    return Object.entries(groups).map(([id, entries]) => ({
      id,
      label: CATEGORY_LABELS[id] || id,
      entries: entries.slice().sort((a, b) => a.name.localeCompare(b.name, "es")),
    }));
  }

  function getClass(id) { return classMap.get(String(id || "")) || null; }
  function getRace(id) { return raceMap.get(String(id || "")) || null; }
  function getBackground(id) { return backgroundMap.get(String(id || "")) || null; }

  const api = Object.freeze({
    SETTINGS,
    CLASSES,
    RACES,
    BACKGROUNDS,
    CATEGORY_LABELS,
    symmetricRound,
    normalizeClassChoices,
    classLevelTotal,
    validateBuild,
    calculateBuild,
    backgroundGroups,
    getClass,
    getRace,
    getBackground,
  });

  global.LuminousCharacterBuildRules = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
