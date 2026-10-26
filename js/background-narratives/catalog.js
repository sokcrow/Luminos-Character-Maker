(function (global) {
  "use strict";

  const CUSTOM_CHOICE = Object.freeze({
    id: "custom",
    label: "Personalizado",
    description: "Escribe una opción propia. Debe ser coherente con el pasado del personaje, pero no tiene que repetir las sugerencias del catálogo.",
    custom: true,
  });

  const CATEGORY_LABELS = Object.freeze({
    civilian: "Ciudadanos / Civil",
    labor: "Trabajo físico",
    backstreets: "Backstreets / Supervivencia",
    fixer: "Fixers / Offices",
    association: "Associations",
    workshop: "Workshops / Tecnología",
    syndicate: "Syndicates",
    finger: "Five Fingers",
    great_lake: "Great Lake / Marítimo",
    outskirts: "Outskirts / Ruins",
    wing: "Wings / Fuerzas corporativas",
    war: "Smoke War",
    lobotomy: "Lobotomy Corporation",
    anomaly: "Fenómenos / Anomalías",
    district8: "H Corp. / Hongyuan / Daguanyuan",
    social: "Social / Comunidad",
  });

  const TERMS = Object.freeze({
    city: "La Ciudad está dividida en 26 Distritos. Cada Distrito combina un Nest gobernado por una Wing y sus Backstreets, que quedan fuera de la protección directa de esa Wing.",
    wing: "Una Wing es uno de los grandes conglomerados que gobiernan un Distrito y su Nest. Su poder económico, político y tecnológico puede competir con organizaciones enormes de la Ciudad.",
    nest: "El Nest es la zona urbana bajo control directo de una Wing. Entrar o residir allí puede requerir permisos, visas o estatus reconocido por la Wing correspondiente.",
    feather: "Feather es un término común para ciudadanos del Nest y empleados de una Wing. Ser Feather suele asociarse con estabilidad y seguridad, pero también con dependencia del sistema corporativo.",
    backstreets: "Las Backstreets son las zonas fuera del dominio directo de una Wing. Allí conviven barrios residenciales, comercios, Offices, Syndicates y comunidades que dependen de grupos locales para sobrevivir.",
    fixer: "Un Fixer es un profesional licenciado por Hana Association que acepta solicitudes por contrato. Comienza en Grade 9 y puede ascender hasta Grade 1; los más célebres pueden recibir un Color.",
    office: "Una Office es un negocio de Fixers. Recibe solicitudes de clientes y las asigna a miembros capaces de cumplirlas; puede trabajar de forma independiente o vinculada a una Association.",
    association: "Las Associations son grandes organizaciones profesionales de Fixers. Cada una gestiona ciertos tipos de solicitudes y posee reglas, uniformes, ramas y especializaciones propias.",
    workshop: "Los Workshops son Offices especializadas en diseñar, fabricar y modificar armas, herramientas y prótesis. Sus productos comerciales están sujetos a regulación de Tres Association.",
    syndicate: "Syndicate es un término amplio para organizaciones criminales o no reguladas. Pueden ir desde pequeñas pandillas hasta los Five Fingers, capaces de rivalizar con Wings.",
    finger: "Los Five Fingers son los Syndicates más poderosos de las Backstreets. Cada Finger posee una cultura, jerarquía y reglas propias que sus miembros toman extremadamente en serio.",
    prescript: "Los Prescripts son órdenes que estructuran la vida del Index. Pueden exigir tareas absurdas o terribles; Proselytes, Proxies, Messengers y residentes bajo protección del Index organizan su vida alrededor de cumplirlos.",
    book_of_vengeance: "El Book of Vengeance del Middle registra agravios y la represalia correspondiente. Incluso ofensas pequeñas pueden generar castigos desproporcionados, y el Middle es conocido por no olvidar.",
    pinky_star: "Los miembros plenos del Pinky ocupan seats asociados a Stars y a una star-forged blade. Su afiliación suele mantenerse secreta incluso frente a otros miembros del Pinky.",
    great_lake: "El Great Lake está dividido en numerosos Lakes con Laws diferentes. Romper una Law puede atraer Waves, Whales y Mermaids, por lo que el conocimiento local y la preparación son vitales.",
    warp_cleanup: "Los Cleanup Agents de W Corp. restauran los trenes y pasajeros tras los viajes WARP. Los Levels indican responsabilidades y equipo diferentes; los niveles altos enfrentan incidentes clasificados como Congestions.",
    cca: "CCA significa Congestion Cleaning Armor, equipo extraordinariamente caro autorizado para Level 4 Cleanup Agents o superiores con alto rendimiento. Un Background no concede automáticamente conservar una CCA.",
    hcorp: "H Corp., Hongyuan Bioengineering Group, gobierna District 8. Todo el Distrito está contenido dentro del complejo Hongyuan, con Daguanyuan en la élite del Nest y sus grandes familias compitiendo por influencia.",
    heishou: "Los Heishou Packs son fuerzas aumentadas que sirven como ejército privado y servicio secreto de las grandes familias de Daguanyuan. Existen doce Branches zodiacales con rasgos y funciones propias.",
    smoke_war: "La Smoke War fue una guerra entre Wings ocurrida aproximadamente una década antes de Limbus Company. Involucró múltiples facciones, armas químicas y biológicas, y terminó con la caída de la antigua L Corp. y la antigua G Corp.",
    abnormality: "Las Abnormalities son entidades nacidas de la mente humana mediante la tecnología de Lobotomy Corporation. No son criaturas ordinarias: cada una puede obedecer reglas y patrones muy particulares.",
    distortion: "Una Distortion es un fenómeno humano anómalo relacionado con la manifestación de deseos, emociones y crisis personales. Conocer un caso no convierte a alguien en experto universal sobre todas las Distortions.",
  });

  const SOURCES = Object.freeze({
    city: "https://limbuscompany.wiki.gg/wiki/City",
    backstreets: "https://limbuscompany.wiki.gg/wiki/Backstreets",
    offices: "https://limbuscompany.wiki.gg/wiki/Offices",
    associations: "https://limbuscompany.wiki.gg/wiki/Associations",
    workshops: "https://limbuscompany.wiki.gg/wiki/Workshop",
    tres: "https://limbuscompany.wiki.gg/wiki/Tres_Association",
    oufi: "https://limbuscompany.wiki.gg/wiki/%C3%96ufi_Association",
    kurokumo: "https://limbuscompany.wiki.gg/wiki/Kurokumo_Clan",
    blade_lineage: "https://limbuscompany.wiki.gg/wiki/Blade_Lineage",
    yurodiviye: "https://limbuscompany.wiki.gg/wiki/Yurodiviye",
    twinhook: "https://limbuscompany.wiki.gg/wiki/Twinhook_Pirates",
    thumb: "https://limbuscompany.wiki.gg/wiki/The_Thumb",
    index: "https://limbuscompany.wiki.gg/wiki/The_Index",
    middle: "https://limbuscompany.wiki.gg/wiki/The_Middle",
    ring: "https://limbuscompany.wiki.gg/wiki/Ring",
    pinky: "https://limbuscompany.wiki.gg/wiki/The_Pinky",
    great_lake: "https://limbuscompany.wiki.gg/wiki/The_Great_Lake",
    r_corp: "https://limbuscompany.wiki.gg/wiki/R_Corp.",
    w_corp: "https://limbuscompany.wiki.gg/wiki/W_Corp.",
    k_corp: "https://limbuscompany.wiki.gg/wiki/K_Corp.",
    smoke_war: "https://limbuscompany.wiki.gg/wiki/Smoke_War",
    l_corp: "https://limbuscompany.wiki.gg/wiki/L_Corp.",
    abnormalities: "https://limbuscompany.wiki.gg/wiki/Abnormalities",
    h_corp: "https://limbuscompany.wiki.gg/wiki/H_Corp.",
    daguanyuan: "https://limbuscompany.wiki.gg/wiki/Daguanyuan",
    heishou: "https://limbuscompany.wiki.gg/wiki/Heishou_Packs",
  });

  const REMOVED_BACKGROUND_IDS = Object.freeze([
    "house_spiders_apprentice",
    "house_spiders_survivor",
  ]);

  const NAME_OVERRIDES = Object.freeze({
    nest_heir: "Heredero de familia del Nest",
    wing_executive_family: "Descendiente de familia ejecutiva de Wing",
    protected_backstreets: "Habitante bajo protección",
    backstreets_resident: "Habitante de Backstreets",
    experienced_street_dweller: "Callejero experimentado",
    rat: "Rat de Backstreets",
    childhood_street_survivor: "Criado en las calles",
    hooligan: "Matón de Backstreets",
    backstreets_bounty_hunter: "Cazarrecompensas de Backstreets",
    underground_guide: "Guía de rutas de Backstreets",
    community_protector: "Defensor barrial",
    district23_resident: "Habitante de las Backstreets de District 23",
    night_backstreets_survivor: "Superviviente de la Night in the Backstreets",
    novice_fixer: "Fixer recién licenciado — Grade 9",
    office_fixer: "Fixer de Office independiente",
    escort_fixer: "Fixer de protección / escolta",
    contract_veteran: "Fixer de contratos de alto riesgo",
    hana_fixer: "Hana Association Fixer",
    zwei_fixer: "Zwei Association Fixer",
    tres_inspector: "Tres Association Inspector",
    shi_assassin: "Shi Association Fixer",
    cinq_duelist: "Cinq Association Duelist",
    liu_combatant: "Liu Association Fixer",
    seven_investigator: "Seven Association Investigator",
    eight_explorer: "Eight Association Fixer",
    devyat_courier: "Devyat' Association Courier",
    dieci_researcher: "Dieci Association Researcher",
    oufi_mediator: "Öufi Contract Observer / Enforcer",
    workshop_apprentice: "Workshop Apprentice",
    workshop_technician: "Workshop Technician",
    weaponsmith: "Weaponsmith",
    prosthetic_engineer: "Prosthetic Engineer",
    dangerous_field_workshop: "Field Workshop Technician",
    dead_rabbits: "Dead Rabbits Member",
    tingtang: "Tingtang Gang Member",
    mariachis: "Los Mariachis Member",
    yurodiviye: "Yurodiviye Member",
    kurokumo_wakashu: "Kurokumo Clan Wakashu",
    kurokumo_captain: "Kurokumo Clan Captain",
    blade_lineage_veteran: "Blade Lineage Mentor",
    thumb_member: "Thumb Soldato",
    thumb_veteran: "Thumb Capo",
    middle_member: "Middle Little Sibling",
    middle_veteran: "Middle Big Sibling",
    ring_veteran: "Ring Docent",
    pinky_operator: "Pinky Star — Infiltrator",
    pinky_veteran: "Pinky Star — Deep Cover",
    pequod_survivor: "Whale-Interior Survivor",
    wing_military_recruit: "Corporate Security Recruit",
    r_corp_rabbit: "R Corp. Rabbit Team Soldier",
    r_corp_reindeer: "R Corp. Reindeer Team Soldier",
    r_corp_rhino: "R Corp. Rhino Team Soldier",
    r_corp_raven: "R Corp. Raven",
    r_corp_extermination_veteran: "R Corp. Extermination Veteran",
    w_cleanup_l2: "W Corp. L2 Cleanup Agent",
    w_cleanup_l3: "W Corp. L3 Cleanup Agent",
    w_cleanup_veteran: "W Corp. L3 Cleanup Captain",
    w_cleanup_l4: "W Corp. L4 Cleanup Agent — CCA",
    k_security_l1: "K Corp. Class 1 Search & Rescue Staff",
    k_security_l2: "K Corp. Class 2 Security / Checkpoint Staff",
    k_excision_l3: "K Corp. Class 3 Excision Staff",
    k_excision_veteran: "K Corp. Class 3 Excision Veteran",
    lcorp_containment_agent: "L Corp. Agent",
    lcorp_branch_fall_survivor: "L Corp. Branch Collapse Survivor",
    abnormality_survivor: "L Corp. Abnormality Exposure Veteran",
    nest_family_servant: "Daguanyuan Family Servant",
    personal_retainer: "Great Family Personal Retainer",
    family_bodyguard: "Great Family Bodyguard",
    political_heir: "Family Hierarch Candidate",
    duelist_heir: "Martially Trained Family Heir",
    family_strife_survivor: "Great Family Succession Survivor",
    heishou_trainee: "Heishou Pack Member",
    heishou_veteran: "Heishou Pack Adept",
  });

  // Coeficientes provisionales para los 15 trasfondos sociales nuevos. Se eligen por
  // analogía con oficios ya existentes y NO rebalancean ningún trasfondo de main.
  const ADDED_BUILD_BACKGROUNDS = Object.freeze([
    { id: "expelled_feather", name: "Feather expulsado", hpCoefBonus: 0.04, category: "social", balanceStatus: "provisional" },
    { id: "wing_exam_aspirant", name: "Aspirante a examen de Wing", hpCoefBonus: 0.04, category: "social", balanceStatus: "provisional" },
    { id: "office_dispatcher", name: "Office Clerk / Dispatcher", hpCoefBonus: 0.05, category: "social", balanceStatus: "provisional" },
    { id: "information_broker", name: "Information Broker", hpCoefBonus: 0.07, category: "social", balanceStatus: "provisional" },
    { id: "street_medic", name: "Médico de calle", hpCoefBonus: 0.14, category: "social", balanceStatus: "provisional" },
    { id: "innkeeper", name: "Posadero / encargado de hospedaje", hpCoefBonus: 0.10, category: "social", balanceStatus: "provisional" },
    { id: "bartender", name: "Bartender", hpCoefBonus: 0.10, category: "social", balanceStatus: "provisional" },
    { id: "community_mediator", name: "Mediador comunitario", hpCoefBonus: 0.10, category: "social", balanceStatus: "provisional" },
    { id: "residential_manager", name: "Administrador residencial", hpCoefBonus: 0.05, category: "social", balanceStatus: "provisional" },
    { id: "academy_tutor", name: "Tutor / instructor de academia", hpCoefBonus: 0.05, category: "social", balanceStatus: "provisional" },
    { id: "contract_scribe", name: "Escribano de contratos", hpCoefBonus: 0.07, category: "social", balanceStatus: "provisional" },
    { id: "funeral_worker", name: "Trabajador funerario", hpCoefBonus: 0.12, category: "social", balanceStatus: "provisional" },
    { id: "community_aid_worker", name: "Trabajador de ayuda comunitaria / religioso", hpCoefBonus: 0.10, category: "social", balanceStatus: "provisional" },
    { id: "independent_courier", name: "Courier independiente", hpCoefBonus: 0.12, category: "social", balanceStatus: "provisional" },
    { id: "transport_worker", name: "Trabajador de transporte", hpCoefBonus: 0.14, category: "social", balanceStatus: "provisional" },
  ]);

  const registry = new Map();

  function slug(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "choice";
  }

  function parseSeed(seed) {
    if (Array.isArray(seed)) return { label: String(seed[0] || ""), detail: String(seed[1] || seed[0] || "") };
    const raw = String(seed || "").trim();
    const pipe = raw.indexOf("|");
    if (pipe >= 0) return { label: raw.slice(0, pipe).trim(), detail: raw.slice(pipe + 1).trim() };
    return { label: raw, detail: raw };
  }

  function expandChoice(kind, seed, background, index) {
    const parsed = parseSeed(seed);
    const base = parsed.detail.replace(/[.!?]+$/, "");
    let suffix = "";
    if (kind === "ideal") {
      suffix = ` Este ideal resume una convicción que pudo nacer de tu vida como ${background.name}; orienta tus decisiones, pero no obliga a conservar la misma lealtad, moral o afiliación.`;
    } else if (kind === "bond") {
      suffix = " Este vínculo entrega al DM un referente concreto del pasado que puede reaparecer como apoyo, presión, deuda, rivalidad o conflicto; no garantiza que siga disponible ni amistoso.";
    } else {
      suffix = ` Este defecto describe una tendencia narrativa que tu experiencia como ${background.name} pudo dejarte. No aplica una penalización automática: aparece cuando esa costumbre, temor o sesgo complica tus decisiones.`;
    }
    return Object.freeze({
      id: `${kind}_${index + 1}_${slug(parsed.label)}`,
      label: parsed.label,
      description: `${base}.${suffix}`,
    });
  }

  function normalizeBackground(spec) {
    const result = {
      id: String(spec.id || "").trim(),
      name: String(spec.name || "").trim(),
      category: String(spec.category || "").trim(),
      overview: String(spec.overview || "").trim(),
      trait: Object.freeze({
        name: String(spec.trait?.name || "").trim(),
        description: String(spec.trait?.description || "").trim(),
      }),
      feature: Object.freeze({
        name: String(spec.feature?.name || "").trim(),
        description: String(spec.feature?.description || "").trim(),
        limits: String(spec.feature?.limits || "").trim(),
      }),
      loreTerms: Object.freeze([...(spec.loreTerms || [])]),
      loreSources: Object.freeze([...(spec.loreSources || [])]),
      canonStatus: String(spec.canonStatus || "canon-safe"),
      relationMode: String(spec.relationMode || "optional"),
      notes: String(spec.notes || ""),
    };
    result.ideals = Object.freeze((spec.ideals || []).map((choice, index) => expandChoice("ideal", choice, result, index)));
    result.bonds = Object.freeze((spec.bonds || []).map((choice, index) => expandChoice("bond", choice, result, index)));
    result.flaws = Object.freeze((spec.flaws || []).map((choice, index) => expandChoice("flaw", choice, result, index)));
    result.customChoice = CUSTOM_CHOICE;
    result.personality = Object.freeze({ optional: true, maxChoices: 2, suggestions: Object.freeze([...(spec.personality || [])]) });
    return Object.freeze(result);
  }

  function register(entries) {
    (entries || []).forEach((spec) => {
      const normalized = normalizeBackground(spec);
      if (!normalized.id) throw new Error("Background narrativo sin id");
      if (registry.has(normalized.id)) throw new Error(`Background narrativo duplicado: ${normalized.id}`);
      registry.set(normalized.id, normalized);
    });
    return api;
  }

  function get(id) {
    return registry.get(String(id || "")) || null;
  }

  function all() {
    return Object.freeze(Array.from(registry.values()));
  }

  function groups() {
    const grouped = new Map();
    all().forEach((entry) => {
      if (!grouped.has(entry.category)) grouped.set(entry.category, []);
      grouped.get(entry.category).push(entry);
    });
    return Object.freeze(Array.from(grouped.entries()).map(([category, entries]) => Object.freeze({
      category,
      label: CATEGORY_LABELS[category] || category,
      entries: Object.freeze(entries.slice()),
    })));
  }

  function buildBackgroundCatalog(baseBackgrounds) {
    const removed = new Set(REMOVED_BACKGROUND_IDS);
    const existing = (baseBackgrounds || [])
      .filter((entry) => !removed.has(entry.id))
      .map((entry) => Object.freeze({ ...entry, name: NAME_OVERRIDES[entry.id] || entry.name }));
    const existingIds = new Set(existing.map((entry) => entry.id));
    const added = ADDED_BUILD_BACKGROUNDS.filter((entry) => !existingIds.has(entry.id));
    return Object.freeze(existing.concat(added));
  }

  function validate(options = {}) {
    const expectedCount = Number(options.expectedCount || 158);
    const errors = [];
    const entries = all();
    if (entries.length !== expectedCount) errors.push(`Se esperaban ${expectedCount} entradas narrativas y existen ${entries.length}.`);
    entries.forEach((entry) => {
      if (entry.ideals.length !== 7) errors.push(`${entry.id}: requiere 7 ideales.`);
      if (entry.bonds.length !== 7) errors.push(`${entry.id}: requiere 7 vínculos.`);
      if (entry.flaws.length !== 7) errors.push(`${entry.id}: requiere 7 defectos.`);
      if (!entry.overview) errors.push(`${entry.id}: falta overview.`);
      if (!entry.trait.name || !entry.trait.description) errors.push(`${entry.id}: falta Trait.`);
      if (!entry.feature.name || !entry.feature.description) errors.push(`${entry.id}: falta Feature.`);
      entry.loreTerms.forEach((term) => {
        if (!TERMS[term]) errors.push(`${entry.id}: loreTerm desconocido ${term}.`);
      });
      entry.loreSources.forEach((source) => {
        if (!SOURCES[source]) errors.push(`${entry.id}: loreSource desconocida ${source}.`);
      });
    });
    REMOVED_BACKGROUND_IDS.forEach((id) => {
      if (registry.has(id)) errors.push(`${id}: House of Spiders no debe ser seleccionable.`);
    });
    return Object.freeze({ valid: errors.length === 0, errors: Object.freeze(errors) });
  }

  const api = Object.freeze({
    version: 1,
    reviewedAt: "2026-08-26",
    CATEGORY_LABELS,
    TERMS,
    SOURCES,
    CUSTOM_CHOICE,
    REMOVED_BACKGROUND_IDS,
    NAME_OVERRIDES,
    ADDED_BUILD_BACKGROUNDS,
    register,
    get,
    all,
    groups,
    buildBackgroundCatalog,
    validate,
  });

  global.LuminousBackgroundNarratives = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
