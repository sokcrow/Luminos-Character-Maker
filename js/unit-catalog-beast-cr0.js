(function (global) {
  "use strict";

  const clone = (value) => JSON.parse(JSON.stringify(value));
  const skillCatalog = global.LuminousBeastCr0SkillCatalog || (typeof require !== "undefined" ? (() => { try { return require("./skill-catalog-beast-cr0.js"); } catch (_) { return null; } })() : null);
  const proficiencyRuntime = global.LuminousProficiencyRuntime || (typeof require !== "undefined" ? (() => { try { return require("./proficiency-runtime.js"); } catch (_) { return null; } })() : null);
  const movementRuntime = global.LuminousMovementSpeedRuntime || (typeof require !== "undefined" ? (() => { try { return require("./movement-speed-runtime.js"); } catch (_) { return null; } })() : null);

  const STAGGER_THRESHOLDS = Object.freeze([75, 50, 25]);

  const ELEVATED_TARGETABILITY = Object.freeze({
    canBeHitIfAny: Object.freeze([
      "lost_clash_against_skill",
      "attacker_weapon_is_ranged",
      "attacker_weapon_has_reach",
    ]),
  });

  const FLIGHT_RULES = Object.freeze({
    capable: true,
    groundedQuickAction: "fly",
    quickActionSetsFlying: true,
    quickActionRemovesProne: true,
    whileFlyingTargetability: ELEVATED_TARGETABILITY,
    onKnockedDown: Object.freeze({ setFlying: false, applyStatus: "prone" }),
  });

  const BLINDSIGHT_RULES = Object.freeze({
    ignoresDarkness: true,
    detectsInvisible: true,
    ignoresInvisibleDisadvantage: true,
  });

  const DARKVISION_RULES = Object.freeze({ ignoresDarkness: true });

  const WATER_BREATHING_RULES = Object.freeze({
    onlyUnderwater: true,
    underwater: Object.freeze({ gainsAirCounter: false }),
    outsideWater: Object.freeze({ gainsAirCounter: true }),
  });

  const TRAITS = Object.freeze({
    jumper: Object.freeze({
      id: "jumper",
      name: "Jumper",
      type: "passive",
      mechanics: Object.freeze({ jumpCheckAbility: "dex", jumpCheckFinalPowerBonus: 3 }),
    }),
    amphibious: Object.freeze({
      id: "amphibious",
      name: "Amphibious",
      type: "passive",
      mechanics: Object.freeze({
        underwaterEncounter: Object.freeze({ gainsAirCounter: false }),
        outsideWater: Object.freeze({ gainsAirCounter: false }),
      }),
    }),
    agile: Object.freeze({
      id: "agile",
      name: "Agile",
      type: "passive",
      mechanics: Object.freeze({ skillsTriggerCounterAttacks: false }),
    }),
    standing_leap: Object.freeze({
      id: "standing_leap",
      name: "Standing Leap",
      type: "passive",
      mechanics: Object.freeze({ jumpRequiresRunningStart: false }),
    }),
    illumination: Object.freeze({
      id: "illumination",
      name: "Illumination",
      type: "passive",
      mechanics: Object.freeze({ brightLightFeet: 10, dimLightAdditionalFeet: 10 }),
    }),
    spider_climb: Object.freeze({
      id: "spider_climb",
      name: "Spider Climb",
      type: "active",
      activation: Object.freeze({
        actionCost: "quick_action",
        requirementsAny: Object.freeze(["encounter_is_interior", "encounter_has_climbable_objects"]),
      }),
      mechanics: Object.freeze({
        terrestrial: true,
        setState: "climbing",
        targetabilityWhileClimbing: ELEVATED_TARGETABILITY,
        validSurfaces: Object.freeze(["interior_structure", "climbable_object"]),
      }),
    }),
    compression: Object.freeze({
      id: "compression",
      name: "Compression",
      type: "passive",
      mechanics: Object.freeze({ ignoreNarrowSpaceMovementPenalty: true, minimumOpeningInches: 1 }),
    }),
    water_breathing: Object.freeze({
      id: "water_breathing",
      name: "Water Breathing",
      type: "passive",
      mechanics: WATER_BREATHING_RULES,
    }),
    flyby: Object.freeze({
      id: "flyby",
      name: "Flyby",
      type: "passive",
      mechanics: Object.freeze({ whileFlying: Object.freeze({ evasionPowerBonus: 8 }) }),
    }),
    mimicry: Object.freeze({
      id: "mimicry",
      name: "Mimicry",
      type: "active",
      activation: Object.freeze({ actionCost: "quick_action", target: "enemy_that_can_hear" }),
      mechanics: Object.freeze({
        save: Object.freeze({ ability: "wis", threshold: 10 }),
        onFail: Object.freeze({ status: "clash_power_down", potency: 1 }),
      }),
    }),
    ink_spitting: Object.freeze({
      id: "ink_spitting",
      name: "Ink Spitting",
      type: "reaction",
      activation: Object.freeze({ actionCost: "reaction", uses: Object.freeze({ max: 1, reset: "encounter" }), target: "attacker" }),
      mechanics: Object.freeze({
        usableOutsideWater: true,
        applyToAttacker: Object.freeze({ status: "blind", potency: 1 }),
        afterSkill: Object.freeze({ action: "escape" }),
      }),
    }),
    bubble_dash: Object.freeze({
      id: "bubble_dash",
      name: "Bubble Dash",
      type: "active",
      activation: Object.freeze({
        actionCost: "action",
        requirementsAll: Object.freeze(["encounter_is_underwater"]),
      }),
      mechanics: Object.freeze({
        movementMode: "swim",
        moveUpToMovementSpeed: true,
        reposition: true,
        provokesCounterAttacks: false,
        provokesOpportunityAttacks: false,
      }),
    }),
    web_walker: Object.freeze({
      id: "web_walker",
      name: "Web Walker",
      type: "passive",
      mechanics: Object.freeze({
        encounterModifierId: "web",
        ignoresWebBind: true,
        ignoresWebMovementRestrictions: true,
        detectsUnitsInSameWeb: true,
      }),
    }),
  });

  const CAT_APPEARANCES = Object.freeze([
    Object.freeze({ id: "domestic_longhair", name: "Domestic Longhair", sprite: "https://imgur.com/v0YAKCC" }),
    Object.freeze({ id: "bombay", name: "Bombay", sprite: "https://imgur.com/D5XUyMO" }),
    Object.freeze({ id: "persian", name: "Persa", sprite: "https://imgur.com/dOFAnyH" }),
    Object.freeze({ id: "siamese", name: "Siamés", sprite: "https://imgur.com/xcbK6Pk" }),
    Object.freeze({ id: "maine_coon", name: "Maine Coon", sprite: "https://imgur.com/CboUXvn" }),
    Object.freeze({ id: "russian_blue", name: "Azul Ruso", sprite: "https://imgur.com/xCBHiEa" }),
    Object.freeze({ id: "calico", name: "Calicó", sprite: "https://imgur.com/RUDnEd0" }),
    Object.freeze({ id: "tuxedo", name: "Tuxedo", sprite: "https://imgur.com/XfZN9J4" }),
    Object.freeze({ id: "bengal", name: "Bengalí", sprite: "https://imgur.com/gY8PySP" }),
    Object.freeze({ id: "sphynx", name: "Sphynx", sprite: "https://imgur.com/H1pcIg0" }),
  ]);

  function visual(sprite, variants = []) {
    return {
      spriteUrl: sprite,
      idle_sprite: sprite,
      moving_sprite: "",
      guard_sprite: "",
      evade_sprite: "",
      hurt_sprite: "",
      dead_sprite: "",
      scale: 1,
      spriteX: 0,
      spriteY: 0,
      uiX: 0,
      uiY: 0,
      isFocused: false,
      variants: clone(variants),
    };
  }

  function canonicalProficiencies({ savingThrows = {}, skills = {} } = {}) {
    return { savingThrows: { ...savingThrows }, skills: { ...skills } };
  }

  function makeUnit(cfg) {
    const traitIds = (cfg.traits || []).map((trait) => trait.id);
    const traits = (cfg.traits || []).map((trait) => {
      if (trait.source === "racial_trait_catalog") return clone(trait);
      return clone(TRAITS[trait.id] || trait);
    });
    const skillIds = cfg.skills.slice();

    const mechanics = {
      hpModel: "chassis_coefficient",
      hpBase: cfg.hpBase,
      hpCoefficient: cfg.hpCoefficient,
      sp: 0,
      actionSlots: 1,
      maxSlotsLimit: 1,
      skills: skillIds.slice(),
      staggerThresholds: clone(STAGGER_THRESHOLDS),
      stagger: "75%,50%,25%",
      proficiencyModel: "universal_level",
      movementFeet: clone(cfg.movement),
      preferredMovementMode: cfg.defaultMovementMode || "ground",
      senses: clone(cfg.senses || {}),
      ...clone(cfg.mechanics || {}),
    };

    if (cfg.movement?.fly) {
      mechanics.flying = true;
      mechanics.flight = clone(FLIGHT_RULES);
      mechanics.flyingTargetability = clone(ELEVATED_TARGETABILITY);
    }
    if (cfg.senses?.blindsight) mechanics.blindsight = clone(BLINDSIGHT_RULES);
    if (cfg.senses?.darkvision) mechanics.darkvision = clone(DARKVISION_RULES);

    const unit = {
      id: cfg.id,
      name: cfg.name,
      species: cfg.id,
      family: "beast_cr0",
      creatureType: "beast",
      challengeRating: 0,
      // D&D CR 0 gives 10 XP when the stat block has attacks, otherwise 0.
      // Luminos Seahorse has no attack Skills; all other 23 CR0 units do.
      xpValue: skillIds.length ? 10 : 0,
      unitType: "beast",
      faction: "neutral",
      actorCategory: "npc",
      isPlayer: false,
      linkedPlayerUID: "",
      tags: ["canonical", "beast", "cr0", "find_familiar", ...(cfg.tags || [])],
      icono: cfg.sprite,
      visual: visual(cfg.sprite, cfg.appearances || []),
      summonAppearanceOptions: clone(cfg.appearances || []),
      naturalWorldLevel: { min: 1, max: 1 },
      baseLevel: { min: 1, max: 1 },
      scores: clone(cfg.scores),
      proficiencies: canonicalProficiencies(cfg.proficiencies),
      size: cfg.size,
      movement: clone(cfg.movement),
      movementFeet: clone(cfg.movement),
      preferredMovementMode: cfg.defaultMovementMode || "ground",
      senses: clone(cfg.senses || {}),
      resistances: clone(cfg.resistances || {}),
      traitIds,
      traits,
      flying: cfg.startsFlying === true,
      climbing: false,
      capabilities: {
        flight: Boolean(cfg.movement?.fly),
        climb: Boolean(cfg.movement?.climb),
        swim: Boolean(cfg.movement?.swim),
        burrow: Boolean(cfg.movement?.burrow),
      },
      staggerThresholds: clone(STAGGER_THRESHOLDS),
      allowedRanks: ["normal"],
      action_slots: skillIds.slice(),
      attack_tier_1_sequence: skillIds.slice(),
      attack_tier_2_sequence: [],
      attack_tier_3_sequence: [],
      mechanics,
      summon: {
        eligible: true,
        findFamiliar: true,
        selectableAppearance: Boolean((cfg.appearances || []).length),
      },
      schemaVersion: 2,
      metadata: {
        canonicalUnit: true,
        canonicalSource: "D&D 2024",
        catalog: "beast-cr0",
        hpModel: "chassis_coefficient",
        naturalWorldLevelIsReferenceOnly: true,
        canonicalScores: true,
        canonicalProficiencies: true,
        speedModel: "movement_feet_plus_size",
        ...(cfg.canonicalSourceName ? { canonicalSourceName: cfg.canonicalSourceName } : {}),
        ...(cfg.canonicalSourceBook ? { canonicalSourceBook: cfg.canonicalSourceBook } : {}),
      },
    };

    movementRuntime?.decorateEntity?.(unit, { movementMode: cfg.defaultMovementMode || (cfg.startsFlying ? "fly" : "ground") });
    return unit;
  }

  const freezeCompendiumContent = value => {
    if (value && typeof value === 'object') { Object.values(value).forEach(freezeCompendiumContent); Object.freeze(value); }
    return value;
  };
  const COMPENDIUM_CONTENT = freezeCompendiumContent({
  "baboon": {
    "basicDescription": "Primate de hocico alargado, extremidades robustas y manos capaces de sujetar objetos. Su postura cambia entre la marcha a cuatro patas y breves incorporaciones.",
    "lore": {
      "context": "Los grupos de babuinos pueden asentarse cerca de ruinas y zonas habitadas donde encuentran alimento; su presencia no indica por sí sola adiestramiento ni pertenencia a una facción.",
      "behavior": "Busca alimento en grupo y utiliza manos y mandíbula al disputar recursos. Ante una amenaza, los movimientos y vocalizaciones de unos individuos pueden arrastrar la respuesta de los demás."
    },
    "compendium": {
      "schemaVersion": 1,
      "knowledge": [
        {
          "id": "context",
          "skill": "history",
          "contentPath": "lore.context"
        },
        {
          "id": "behavior",
          "skill": "nature",
          "contentPath": "lore.behavior"
        }
      ],
      "bodyStudy": {
        "skill": "medicine",
        "text": "Su cuerpo es biológico. El estudio de mandíbula, musculatura y extremidades requiere examinar el ejemplar; verlo combatir no revela el estado de sus órganos."
      }
    }
  },
  "badger": {
    "basicDescription": "Mamífero de cuerpo bajo y compacto, patas cortas y garras visibles. Presenta un hocico alargado y pelaje denso.",
    "lore": {
      "context": "Puede ocupar taludes, terrenos removidos y refugios bajo construcciones abandonadas. Los daños en el suelo no demuestran que exista una criatura mayor detrás de ellos.",
      "behavior": "Excava y utiliza refugios bajo el suelo. Puede defender con insistencia la entrada de su madriguera, especialmente cuando una amenaza le corta la retirada."
    },
    "compendium": {
      "schemaVersion": 1,
      "knowledge": [
        {
          "id": "context",
          "skill": "history",
          "contentPath": "lore.context"
        },
        {
          "id": "behavior",
          "skill": "nature",
          "contentPath": "lore.behavior"
        }
      ],
      "bodyStudy": {
        "skill": "medicine",
        "text": "Es un animal de carne, hueso y órganos. La conservación de sus tejidos y cualquier aprovechamiento sólo se determinan tras el examen corporal."
      }
    }
  },
  "bat": {
    "basicDescription": "Pequeño mamífero de cuerpo cubierto de pelo, orejas prominentes y alas formadas por membranas extendidas entre dedos largos.",
    "lore": {
      "context": "Los espacios oscuros y poco transitados de edificios y ruinas pueden albergar colonias. Su presencia no demuestra una maldición ni un origen sobrenatural.",
      "behavior": "Sale de refugios oscuros para alimentarse y vuelve a lugares protegidos para descansar. Sus desplazamientos entre obstáculos no deben confundirse con un vuelo torpe por su pequeño tamaño."
    },
    "compendium": {
      "schemaVersion": 1,
      "knowledge": [
        {
          "id": "context",
          "skill": "history",
          "contentPath": "lore.context"
        },
        {
          "id": "behavior",
          "skill": "nature",
          "contentPath": "lore.behavior"
        }
      ],
      "bodyStudy": {
        "skill": "medicine",
        "text": "Sus alas son tejido vivo sostenido por huesos finos. Un examen puede distinguir lesiones de membrana y daños óseos; ninguna sustancia especial se presupone por su aspecto."
      }
    }
  },
  "cat": {
    "basicDescription": "Felino pequeño de orejas móviles, bigotes largos y cola flexible. El pelaje y la silueta varían entre ejemplares.",
    "lore": {
      "context": "Los gatos conviven con habitantes de distintas regiones y también forman poblaciones sin dueño. Encontrarlo junto a un grupo no acredita que sea su mascota o familiar mágico.",
      "behavior": "Acecha desde posiciones resguardadas, explora pasos estrechos y alterna la inmovilidad con carreras breves. Su respuesta a las personas cambia según su experiencia y el trato recibido."
    },
    "compendium": {
      "schemaVersion": 1,
      "knowledge": [
        {
          "id": "context",
          "skill": "history",
          "contentPath": "lore.context"
        },
        {
          "id": "behavior",
          "skill": "nature",
          "contentPath": "lore.behavior"
        }
      ],
      "bodyStudy": {
        "skill": "medicine",
        "text": "Tiene anatomía felina biológica. Garras, dientes y tejidos deben examinarse directamente para conocer su estado, sin atribuirles propiedades mágicas por asociación."
      }
    }
  },
  "crab": {
    "basicDescription": "Animal de caparazón rígido, varias patas articuladas y dos pinzas delanteras. Su desplazamiento presenta un marcado movimiento lateral.",
    "lore": {
      "context": "Puede encontrarse en orillas húmedas y entornos acuáticos de las regiones. Restos de caparazón aislados no permiten determinar cuántos ejemplares hay presentes.",
      "behavior": "Busca alimento cerca de superficies y refugios. Utiliza las pinzas tanto para manipular como para defenderse, y puede sujetar un objeto mientras intenta retirarse."
    },
    "compendium": {
      "schemaVersion": 1,
      "knowledge": [
        {
          "id": "context",
          "skill": "history",
          "contentPath": "lore.context"
        },
        {
          "id": "behavior",
          "skill": "nature",
          "contentPath": "lore.behavior"
        }
      ],
      "bodyStudy": {
        "skill": "medicine",
        "text": "Su cubierta externa y sus tejidos blandos son partes diferentes del cuerpo. Es necesario estudiar el ejemplar para distinguir estructuras útiles, daños y condiciones de conservación."
      }
    }
  },
  "deer": {
    "basicDescription": "Mamífero de patas largas, cuello esbelto y orejas grandes. Algunos ejemplares presentan cornamenta; su presencia y forma deben describirse según el individuo.",
    "lore": {
      "context": "Puede habitar zonas de vegetación y márgenes poco ocupados de las regiones. Un ciervo visto cerca de construcciones no implica domesticación.",
      "behavior": "Se alimenta de vegetación y mantiene atención sobre ruidos y movimientos. Suele buscar distancia ante una amenaza, pero puede golpear con las patas si queda encerrado."
    },
    "compendium": {
      "schemaVersion": 1,
      "knowledge": [
        {
          "id": "context",
          "skill": "history",
          "contentPath": "lore.context"
        },
        {
          "id": "behavior",
          "skill": "nature",
          "contentPath": "lore.behavior"
        }
      ],
      "bodyStudy": {
        "skill": "medicine",
        "text": "Posee anatomía biológica de ungulado. La cornamenta, cuando existe, debe distinguirse de los huesos del cráneo durante el estudio corporal."
      }
    }
  },
  "eagle": {
    "basicDescription": "Ave de pico curvado, garras marcadas y alas amplias. Su postura y cabeza le dan una silueta compacta cuando está posada.",
    "lore": {
      "context": "Puede utilizar puntos elevados de las regiones como descanso y vigilancia. Su aparición sobre un lugar no demuestra que esté obedeciendo a un observador.",
      "behavior": "Observa desde posiciones altas y utiliza el vuelo para acercarse a una presa. Pico y garras intervienen en la captura; la dirección de aproximación importa más que su mera presencia sobre la escena."
    },
    "compendium": {
      "schemaVersion": 1,
      "knowledge": [
        {
          "id": "context",
          "skill": "history",
          "contentPath": "lore.context"
        },
        {
          "id": "behavior",
          "skill": "nature",
          "contentPath": "lore.behavior"
        }
      ],
      "bodyStudy": {
        "skill": "medicine",
        "text": "Las plumas y las estructuras de vuelo pertenecen a un cuerpo biológico. El estado de alas, garras y tejidos se determina con examen, no a partir de una maniobra aislada."
      }
    }
  },
  "frog": {
    "basicDescription": "Anfibio de cuerpo corto, piel sin pelaje y patas posteriores plegadas. Los ojos sobresalen de la parte superior de la cabeza.",
    "lore": {
      "context": "Puede aparecer junto a depósitos de agua y zonas húmedas. Su presencia no permite afirmar que el agua sea potable ni que el entorno sea seguro.",
      "behavior": "Pasa largos periodos junto a superficies húmedas y puede permanecer inmóvil hasta que una presa o amenaza se aproxima. Sus patas posteriores permiten cambios bruscos de posición."
    },
    "compendium": {
      "schemaVersion": 1,
      "knowledge": [
        {
          "id": "context",
          "skill": "history",
          "contentPath": "lore.context"
        },
        {
          "id": "behavior",
          "skill": "nature",
          "contentPath": "lore.behavior"
        }
      ],
      "bodyStudy": {
        "skill": "medicine",
        "text": "Su piel y órganos son tejidos delicados. Cualquier propiedad medicinal o tóxica requiere evidencia específica y un análisis apropiado."
      }
    }
  },
  "giant_fire_beetle": {
    "basicDescription": "Escarabajo de cuerpo abombado, cubierta dura y puntos luminosos visibles. La luz destaca especialmente cuando el entorno está oscuro.",
    "lore": {
      "context": "Su luminosidad puede llamar la atención en espacios cerrados y ruinas. Hallar uno no prueba la existencia de fuego, instalaciones activas ni actividad arcana.",
      "behavior": "Explora el suelo y las superficies próximas mientras sus puntos luminosos hacen visible su posición. La luz permite reconocer su presencia, aunque no explica por sí sola cómo funcionan esas estructuras."
    },
    "compendium": {
      "schemaVersion": 1,
      "knowledge": [
        {
          "id": "context",
          "skill": "history",
          "contentPath": "lore.context"
        },
        {
          "id": "behavior",
          "skill": "nature",
          "contentPath": "lore.behavior"
        }
      ],
      "bodyStudy": {
        "skill": "medicine",
        "text": "La cubierta externa protege tejidos y estructuras luminosas. Su separación, conservación y utilidad deben confirmarse mediante las acciones de estudio y recuperación del cuerpo."
      }
    }
  },
  "goat": {
    "basicDescription": "Mamífero de pezuñas hendidas, cuerpo recio y hocico estrecho. Cuernos, barba y pelaje dependen del ejemplar observado.",
    "lore": {
      "context": "Puede formar parte de grupos cuidados por habitantes de las regiones o vivir sin manejo humano. La presencia de marcas o arreos debe comprobarse antes de atribuirle un dueño.",
      "behavior": "Busca alimento y apoyos firmes, utilizando con soltura superficies irregulares. Puede empujar con la cabeza al disputar espacio o defenderse de una aproximación."
    },
    "compendium": {
      "schemaVersion": 1,
      "knowledge": [
        {
          "id": "context",
          "skill": "history",
          "contentPath": "lore.context"
        },
        {
          "id": "behavior",
          "skill": "nature",
          "contentPath": "lore.behavior"
        }
      ],
      "bodyStudy": {
        "skill": "medicine",
        "text": "Tiene anatomía biológica de ungulado. Cuernos, pezuñas, piel y tejidos internos requieren inspección para determinar su estado y posible aprovechamiento."
      }
    }
  },
  "hawk": {
    "basicDescription": "Ave de presa de pico curvado, patas con garras y alas que se pliegan junto al cuerpo cuando está posada.",
    "lore": {
      "context": "Utiliza lugares elevados y espacios abiertos para observar. Su presencia en una escena no acredita entrenamiento ni vínculo con una facción.",
      "behavior": "Vigila desde altura y aprovecha movimientos de presas pequeñas para iniciar una aproximación. Al posarse busca apoyos que permitan observar y volver al vuelo."
    },
    "compendium": {
      "schemaVersion": 1,
      "knowledge": [
        {
          "id": "context",
          "skill": "history",
          "contentPath": "lore.context"
        },
        {
          "id": "behavior",
          "skill": "nature",
          "contentPath": "lore.behavior"
        }
      ],
      "bodyStudy": {
        "skill": "medicine",
        "text": "Sus alas, plumas y garras son estructuras biológicas. Las lesiones y materiales recuperables sólo se determinan tras un examen del cuerpo."
      }
    }
  },
  "hyena": {
    "basicDescription": "Mamífero de mandíbula marcada, cuello robusto y silueta inclinada hacia los cuartos traseros. Sus vocalizaciones pueden ser llamativas.",
    "lore": {
      "context": "Puede buscar alimento en las periferias y en lugares donde se acumulan restos. No toda presencia de hienas implica que ellas causaron las muertes encontradas.",
      "behavior": "Combina la búsqueda de restos con oportunidades de caza. Los individuos se comunican mediante postura y vocalizaciones, y pueden concentrarse en torno a una fuente de alimento."
    },
    "compendium": {
      "schemaVersion": 1,
      "knowledge": [
        {
          "id": "context",
          "skill": "history",
          "contentPath": "lore.context"
        },
        {
          "id": "behavior",
          "skill": "nature",
          "contentPath": "lore.behavior"
        }
      ],
      "bodyStudy": {
        "skill": "medicine",
        "text": "Su cuerpo es biológico, con una mandíbula y musculatura que pueden estudiarse directamente. El estado de los tejidos y posibles contaminantes requiere examen específico."
      }
    }
  },
  "jackal": {
    "basicDescription": "Cánido de hocico fino, orejas erguidas y cuerpo ligero. La cola y el pelaje completan una silueta más estrecha que la de un lobo robusto.",
    "lore": {
      "context": "Puede recorrer márgenes de asentamientos y zonas con restos de alimento. Verlo cerca de otros depredadores no demuestra cooperación entre ellos.",
      "behavior": "Recorre bordes y refugios en busca de pequeños animales y restos. Puede regresar a una fuente de alimento conocida, manteniendo distancia de competidores mayores."
    },
    "compendium": {
      "schemaVersion": 1,
      "knowledge": [
        {
          "id": "context",
          "skill": "history",
          "contentPath": "lore.context"
        },
        {
          "id": "behavior",
          "skill": "nature",
          "contentPath": "lore.behavior"
        }
      ],
      "bodyStudy": {
        "skill": "medicine",
        "text": "Posee anatomía biológica de cánido. Dientes, piel y órganos deben examinarse para conocer su estado; no se asignan propiedades especiales por parentesco con otras especies."
      }
    }
  },
  "lizard": {
    "basicDescription": "Reptil pequeño de cuerpo alargado, escamas visibles y cola larga. La posición de las patas y el relieve de la piel dependen del ejemplar.",
    "lore": {
      "context": "Puede refugiarse en grietas y superficies resguardadas de las regiones. Su presencia no indica necesariamente un ambiente intacto o libre de sustancias nocivas.",
      "behavior": "Busca refugios estrechos y alterna exposición y reposo según las condiciones del entorno. Tiende a huir hacia una grieta próxima cuando un movimiento grande interrumpe su actividad."
    },
    "compendium": {
      "schemaVersion": 1,
      "knowledge": [
        {
          "id": "context",
          "skill": "history",
          "contentPath": "lore.context"
        },
        {
          "id": "behavior",
          "skill": "nature",
          "contentPath": "lore.behavior"
        }
      ],
      "bodyStudy": {
        "skill": "medicine",
        "text": "Su cuerpo es biológico y escamoso. Cualquier glándula o sustancia aprovechable debe identificarse en el ejemplar y no suponerse por tratarse de un reptil."
      }
    }
  },
  "octopus": {
    "basicDescription": "Animal acuático de cuerpo blando y varios brazos con ventosas. Carece de una cubierta rígida visible que marque la forma del torso.",
    "lore": {
      "context": "Puede ocupar refugios sumergidos y espacios estrechos de entornos acuáticos. Su presencia no permite establecer el origen o la seguridad del agua.",
      "behavior": "Explora con los brazos, se sujeta a superficies y utiliza refugios sumergidos. Su cuerpo flexible puede acomodarse a aberturas que otros animales de tamaño parecido no atraviesan."
    },
    "compendium": {
      "schemaVersion": 1,
      "knowledge": [
        {
          "id": "context",
          "skill": "history",
          "contentPath": "lore.context"
        },
        {
          "id": "behavior",
          "skill": "nature",
          "contentPath": "lore.behavior"
        }
      ],
      "bodyStudy": {
        "skill": "medicine",
        "text": "Sus brazos y órganos forman un cuerpo blando. El estudio de tejidos, sustancias y estructuras internas requiere disponer del ejemplar y conservarlo adecuadamente."
      }
    }
  },
  "owl": {
    "basicDescription": "Ave de cabeza ancha, ojos orientados hacia el frente y plumaje denso. La forma de las plumas de la cabeza puede variar entre ejemplares.",
    "lore": {
      "context": "Puede refugiarse en estructuras elevadas y lugares poco transitados. Su aparición nocturna no demuestra un presagio ni un vínculo sobrenatural.",
      "behavior": "Utiliza lugares elevados para observar y puede aproximarse con poco ruido de alas. Sus periodos de actividad y los refugios elegidos dependen del entorno y del ejemplar."
    },
    "compendium": {
      "schemaVersion": 1,
      "knowledge": [
        {
          "id": "context",
          "skill": "history",
          "contentPath": "lore.context"
        },
        {
          "id": "behavior",
          "skill": "nature",
          "contentPath": "lore.behavior"
        }
      ],
      "bodyStudy": {
        "skill": "medicine",
        "text": "Sus plumas, alas y garras son partes biológicas. El examen del cuerpo permite valorar daños y materiales sin atribuirles propiedades rituales automáticamente."
      }
    }
  },
  "piranha": {
    "basicDescription": "Pez de cuerpo comprimido, aletas visibles y mandíbula dentada. La coloración del agua puede dificultar apreciar sus rasgos.",
    "lore": {
      "context": "Puede formar parte de poblaciones acuáticas de las regiones. Su presencia no demuestra que todos los ejemplares actúen de forma idéntica ni que un cuerpo sumergido sea accesible.",
      "behavior": "Responde a movimientos y recursos disponibles dentro del agua. Su alimentación y la conducta de los ejemplares próximos influyen en la forma en que se aproxima a un posible objetivo."
    },
    "compendium": {
      "schemaVersion": 1,
      "knowledge": [
        {
          "id": "context",
          "skill": "history",
          "contentPath": "lore.context"
        },
        {
          "id": "behavior",
          "skill": "nature",
          "contentPath": "lore.behavior"
        }
      ],
      "bodyStudy": {
        "skill": "medicine",
        "text": "Tiene anatomía biológica de pez. Dientes, branquias y tejidos deben estudiarse en un ejemplar para determinar estado y posibles usos."
      }
    }
  },
  "rat": {
    "basicDescription": "Roedor pequeño de hocico estrecho, incisivos visibles y cola larga. Se desplaza cerca de bordes, huecos y objetos que le dan cobertura.",
    "lore": {
      "context": "Puede vivir junto a asentamientos, almacenes y estructuras abandonadas. Su presencia señala acceso a refugio y recursos, pero no confirma por sí sola una enfermedad.",
      "behavior": "Busca alimento siguiendo bordes y rutas con acceso a huecos de refugio. Aprende recorridos habituales y puede habituarse a la presencia humana cuando no recibe amenazas directas."
    },
    "compendium": {
      "schemaVersion": 1,
      "knowledge": [
        {
          "id": "context",
          "skill": "history",
          "contentPath": "lore.context"
        },
        {
          "id": "behavior",
          "skill": "nature",
          "contentPath": "lore.behavior"
        }
      ],
      "bodyStudy": {
        "skill": "medicine",
        "text": "Su cuerpo es biológico. El estado sanitario y cualquier posible contaminación requieren un examen específico; no se establecen por el nombre de la especie."
      }
    }
  },
  "raven": {
    "basicDescription": "Ave de plumaje oscuro, pico robusto y patas prensiles. Las plumas producen una silueta reconocible al desplegar las alas.",
    "lore": {
      "context": "Puede aparecer cerca de lugares habitados y restos abandonados. Su asociación con malos augurios pertenece a las creencias locales y no prueba una propiedad sobrenatural.",
      "behavior": "Explora objetos, restos y fuentes de alimento con el pico. Recuerda lugares útiles y observa la actividad de otros animales antes de aproximarse."
    },
    "compendium": {
      "schemaVersion": 1,
      "knowledge": [
        {
          "id": "context",
          "skill": "history",
          "contentPath": "lore.context"
        },
        {
          "id": "behavior",
          "skill": "nature",
          "contentPath": "lore.behavior"
        }
      ],
      "bodyStudy": {
        "skill": "medicine",
        "text": "Sus plumas y tejidos son biológicos. Cualquier uso ritual o arcano exige evidencia adicional y no se deduce de su color."
      }
    }
  },
  "scorpion": {
    "basicDescription": "Animal de cubierta segmentada, pinzas delanteras y cola curvada que termina en un aguijón visible.",
    "lore": {
      "context": "Puede refugiarse en huecos, escombros y lugares resguardados. Un aguijón encontrado no permite identificar por sí solo la variedad ni sus propiedades.",
      "behavior": "Permanece resguardado y utiliza las pinzas para sujetar mientras orienta el aguijón. La naturaleza de una sustancia y los efectos de una picadura se estudian por separado."
    },
    "compendium": {
      "schemaVersion": 1,
      "knowledge": [
        {
          "id": "context",
          "skill": "history",
          "contentPath": "lore.context"
        },
        {
          "id": "behavior",
          "skill": "nature",
          "contentPath": "lore.behavior"
        }
      ],
      "bodyStudy": {
        "skill": "medicine",
        "text": "La cola y sus estructuras internas deben examinarse para determinar qué sustancias existen y en qué estado. Recuperar un componente no demuestra conocer su uso."
      }
    }
  },
  "seahorse": {
    "basicDescription": "Pez de cuerpo erguido, hocico tubular y cola que puede enrollarse. Su contorno presenta relieves visibles en lugar de una silueta lisa.",
    "lore": {
      "context": "Puede permanecer entre estructuras sumergidas que le sirven de apoyo. La presencia de un ejemplar no certifica la salud de todo el entorno acuático.",
      "behavior": "Se mantiene cerca de apoyos sumergidos y utiliza la cola para sujetarse. Se alimenta mediante el hocico tubular mientras conserva una posición relativamente estable."
    },
    "compendium": {
      "schemaVersion": 1,
      "knowledge": [
        {
          "id": "context",
          "skill": "history",
          "contentPath": "lore.context"
        },
        {
          "id": "behavior",
          "skill": "nature",
          "contentPath": "lore.behavior"
        }
      ],
      "bodyStudy": {
        "skill": "medicine",
        "text": "Tiene anatomía biológica de pez con estructuras corporales especializadas. Su estudio no autoriza atribuirle propiedades medicinales o mágicas sin evidencia."
      }
    }
  },
  "spider": {
    "basicDescription": "Arácnido de ocho patas y cuerpo dividido en dos regiones principales. Los detalles de ojos y quelíceros requieren una observación cercana.",
    "lore": {
      "context": "Puede ocupar rincones, grietas y estructuras abandonadas. Una tela aislada no identifica de forma segura a su autora ni la peligrosidad de sus sustancias.",
      "behavior": "Utiliza patas y quelíceros para desplazarse y capturar alimento. La función de una tela, la presencia de sustancias y la respuesta ante vibraciones deben comprobarse en el ejemplar."
    },
    "compendium": {
      "schemaVersion": 1,
      "knowledge": [
        {
          "id": "context",
          "skill": "history",
          "contentPath": "lore.context"
        },
        {
          "id": "behavior",
          "skill": "nature",
          "contentPath": "lore.behavior"
        }
      ],
      "bodyStudy": {
        "skill": "medicine",
        "text": "Su cuerpo es biológico y debe distinguirse del de las arañas minerales de zafiro. Glándulas, sustancias y tejidos requieren un examen del ejemplar."
      }
    }
  },
  "vulture": {
    "basicDescription": "Ave de alas amplias, pico curvado y cabeza cuyo plumaje puede ser escaso. En reposo mantiene una postura encorvada característica.",
    "lore": {
      "context": "Puede acudir a lugares donde hay restos animales. Su presencia puede señalar alimento disponible, pero no identifica la causa de una muerte.",
      "behavior": "Busca restos desde puntos elevados y puede reunirse con otras aves en una misma fuente de alimento. La actividad del grupo aporta señales sobre un cadáver cercano."
    },
    "compendium": {
      "schemaVersion": 1,
      "knowledge": [
        {
          "id": "context",
          "skill": "history",
          "contentPath": "lore.context"
        },
        {
          "id": "behavior",
          "skill": "nature",
          "contentPath": "lore.behavior"
        }
      ],
      "bodyStudy": {
        "skill": "medicine",
        "text": "Sus alas y tejidos son biológicos. El contacto con restos hace necesario examinar las condiciones del cuerpo antes de determinar cualquier aprovechamiento."
      }
    }
  },
  "weasel": {
    "basicDescription": "Mamífero de cuerpo muy alargado, patas cortas y hocico fino. Su silueta permite distinguirlo de roedores pequeños.",
    "lore": {
      "context": "Puede utilizar huecos y pasos estrechos en entornos naturales o construidos. Verla junto a pertenencias no prueba que las haya sustraído.",
      "behavior": "Persigue presas pequeñas a través de huecos y pasos estrechos. Su cuerpo alargado le permite continuar una aproximación entre obstáculos que detienen a depredadores más voluminosos."
    },
    "compendium": {
      "schemaVersion": 1,
      "knowledge": [
        {
          "id": "context",
          "skill": "history",
          "contentPath": "lore.context"
        },
        {
          "id": "behavior",
          "skill": "nature",
          "contentPath": "lore.behavior"
        }
      ],
      "bodyStudy": {
        "skill": "medicine",
        "text": "Tiene anatomía biológica de pequeño carnívoro. El estado de dientes, piel y tejidos internos requiere inspección directa."
      }
    }
  }
});

  const DEFINITIONS = Object.freeze(Object.fromEntries(Object.entries({
    baboon: Object.freeze(makeUnit({
      id: "baboon", name: "Baboon", size: "small", sprite: "https://imgur.com/AMRt4K4",
      hpBase: 5, hpCoefficient: 0.06,
      scores: { str: 8, dex: 14, con: 11, int: 4, wis: 12, cha: 6 },
      proficiencies: {}, movement: { ground: 30, climb: 30 }, senses: { passivePerception: 11 },
      traits: [{ id: "pack_tactics", source: "racial_trait_catalog" }], skills: ["baboon_bite"],
    })),
    badger: Object.freeze(makeUnit({
      id: "badger", name: "Badger", size: "tiny", sprite: "https://imgur.com/HAPK4Na",
      hpBase: 5, hpCoefficient: 0.08,
      scores: { str: 10, dex: 11, con: 16, int: 2, wis: 12, cha: 5 },
      proficiencies: { skills: { perception: "proficient" } },
      movement: { ground: 20, burrow: 5 }, senses: { darkvision: 30, passivePerception: 13 },
      resistances: { poison: true },
      mechanics: {
        poisonResistance: { statusDamageMultiplier: 0.5 },
        burrow: { type: "temporary_retreat", untargetable: true, durationTurns: 1, returnAfterDuration: true },
      },
      skills: ["badger_bite"],
    })),
    bat: Object.freeze(makeUnit({
      id: "bat", name: "Bat", size: "tiny", sprite: "https://imgur.com/iYN0uye",
      hpBase: 5, hpCoefficient: 0.05,
      scores: { str: 2, dex: 15, con: 8, int: 2, wis: 12, cha: 4 },
      proficiencies: {}, movement: { ground: 5, fly: 30 }, defaultMovementMode: "fly", startsFlying: true,
      senses: { blindsight: 60, passivePerception: 11 }, skills: ["bat_bite"],
    })),
    cat: Object.freeze(makeUnit({
      id: "cat", name: "Cat", size: "tiny", sprite: "https://imgur.com/v0YAKCC", appearances: CAT_APPEARANCES,
      hpBase: 5, hpCoefficient: 0.05,
      scores: { str: 3, dex: 15, con: 10, int: 3, wis: 12, cha: 7 },
      proficiencies: { savingThrows: { dex: "proficient" }, skills: { perception: "proficient", stealth: "proficient" } },
      movement: { ground: 40, climb: 40 }, senses: { darkvision: 60, passivePerception: 13 },
      traits: [{ id: "jumper" }], skills: ["cat_scratch"],
    })),
    crab: Object.freeze(makeUnit({
      id: "crab", name: "Crab", size: "tiny", sprite: "https://imgur.com/hWfiKo7",
      hpBase: 5, hpCoefficient: 0.06,
      scores: { str: 6, dex: 11, con: 12, int: 1, wis: 8, cha: 2 },
      proficiencies: { skills: { stealth: "proficient" } },
      movement: { ground: 20, swim: 20 }, senses: { blindsight: 30, passivePerception: 9 },
      traits: [{ id: "amphibious" }], skills: ["crab_claw"],
    })),
    deer: Object.freeze(makeUnit({
      id: "deer", name: "Deer", size: "medium", sprite: "https://imgur.com/DV2j7Yx",
      hpBase: 7, hpCoefficient: 0.07,
      scores: { str: 11, dex: 16, con: 11, int: 2, wis: 14, cha: 5 },
      proficiencies: { skills: { perception: "proficient" } },
      movement: { ground: 50 }, senses: { darkvision: 60, passivePerception: 14 },
      traits: [{ id: "agile" }], skills: ["deer_ram"],
    })),
    eagle: Object.freeze(makeUnit({
      id: "eagle", name: "Eagle", size: "small", sprite: "https://imgur.com/ma1CaXa",
      hpBase: 6, hpCoefficient: 0.06,
      scores: { str: 6, dex: 15, con: 12, int: 2, wis: 14, cha: 7 },
      proficiencies: { skills: { perception: "expertise" } },
      movement: { ground: 10, fly: 60 }, defaultMovementMode: "fly", startsFlying: true,
      senses: { passivePerception: 16 }, skills: ["eagle_talons"],
    })),
    frog: Object.freeze(makeUnit({
      id: "frog", name: "Frog", size: "tiny", sprite: "https://imgur.com/5178aOJ",
      hpBase: 5, hpCoefficient: 0.05,
      scores: { str: 1, dex: 13, con: 8, int: 1, wis: 8, cha: 3 },
      proficiencies: { skills: { perception: "proficient", stealth: "proficient" } },
      movement: { ground: 20, swim: 20 }, senses: { darkvision: 30, passivePerception: 11 },
      traits: [{ id: "amphibious" }, { id: "standing_leap" }], skills: ["frog_bite"],
    })),
    giant_fire_beetle: Object.freeze(makeUnit({
      id: "giant_fire_beetle", name: "Giant Fire Beetle", size: "small", sprite: "https://imgur.com/L9qe1px",
      hpBase: 6, hpCoefficient: 0.07,
      scores: { str: 8, dex: 10, con: 12, int: 1, wis: 7, cha: 3 },
      proficiencies: {}, movement: { ground: 30, climb: 30 }, senses: { blindsight: 30, passivePerception: 8 },
      resistances: { fire: true }, traits: [{ id: "illumination" }], skills: ["giant_fire_beetle_bite"],
    })),
    goat: Object.freeze(makeUnit({
      id: "goat", name: "Goat", size: "medium", sprite: "https://imgur.com/mlTs9SU",
      hpBase: 6, hpCoefficient: 0.07,
      scores: { str: 11, dex: 10, con: 11, int: 2, wis: 10, cha: 5 },
      proficiencies: { savingThrows: { str: "proficient" }, skills: { perception: "proficient" } },
      movement: { ground: 40, climb: 30 }, senses: { darkvision: 60, passivePerception: 12 }, skills: ["goat_ram"],
    })),
    hawk: Object.freeze(makeUnit({
      id: "hawk", name: "Hawk", size: "tiny", sprite: "https://imgur.com/cydn2Fq",
      hpBase: 5, hpCoefficient: 0.05,
      scores: { str: 5, dex: 16, con: 8, int: 2, wis: 14, cha: 6 },
      proficiencies: { skills: { perception: "expertise" } },
      movement: { ground: 10, fly: 60 }, defaultMovementMode: "fly", startsFlying: true,
      senses: { passivePerception: 16 }, skills: ["hawk_talons"],
    })),
    hyena: Object.freeze(makeUnit({
      id: "hyena", name: "Hyena", size: "medium", sprite: "https://imgur.com/JqNrGNJ",
      hpBase: 7, hpCoefficient: 0.08,
      scores: { str: 11, dex: 13, con: 12, int: 2, wis: 12, cha: 5 },
      proficiencies: { skills: { perception: "proficient" } },
      movement: { ground: 50 }, senses: { darkvision: 60, passivePerception: 13 },
      traits: [{ id: "pack_tactics", source: "racial_trait_catalog" }], skills: ["hyena_bite"],
    })),
    jackal: Object.freeze(makeUnit({
      id: "jackal", name: "Jackal", size: "small", sprite: "https://imgur.com/epN41sW",
      hpBase: 5, hpCoefficient: 0.05,
      scores: { str: 8, dex: 15, con: 11, int: 3, wis: 12, cha: 6 },
      proficiencies: { skills: { perception: "expertise", stealth: "proficient" } },
      movement: { ground: 40 }, senses: { darkvision: 90, passivePerception: 15 }, skills: ["jackal_bite"],
    })),
    lizard: Object.freeze(makeUnit({
      id: "lizard", name: "Lizard", size: "tiny", sprite: "https://imgur.com/TJyipfD",
      hpBase: 5, hpCoefficient: 0.05,
      scores: { str: 2, dex: 11, con: 10, int: 1, wis: 8, cha: 3 },
      proficiencies: {}, movement: { ground: 20, climb: 20 }, senses: { darkvision: 30, passivePerception: 9 },
      traits: [{ id: "spider_climb" }], skills: ["lizard_bite"],
    })),
    octopus: Object.freeze(makeUnit({
      id: "octopus", name: "Octopus", size: "small", sprite: "https://imgur.com/R05Yylv",
      hpBase: 5, hpCoefficient: 0.06,
      scores: { str: 4, dex: 15, con: 11, int: 3, wis: 10, cha: 4 },
      proficiencies: { skills: { perception: "proficient", stealth: "expertise" } },
      movement: { ground: 5, swim: 30 }, defaultMovementMode: "swim",
      senses: { darkvision: 30, passivePerception: 12 },
      traits: [{ id: "compression" }, { id: "water_breathing" }, { id: "ink_spitting" }],
      mechanics: { waterBreathing: WATER_BREATHING_RULES },
      skills: ["octopus_tentacles"],
    })),
    owl: Object.freeze(makeUnit({
      id: "owl", name: "Owl", size: "tiny", sprite: "https://imgur.com/vWQEbDW",
      hpBase: 5, hpCoefficient: 0.05,
      scores: { str: 3, dex: 13, con: 8, int: 2, wis: 12, cha: 7 },
      proficiencies: { skills: { perception: "expertise", stealth: "expertise" } },
      movement: { ground: 5, fly: 60 }, defaultMovementMode: "fly", startsFlying: true,
      senses: { darkvision: 120, passivePerception: 15 }, traits: [{ id: "flyby" }], skills: ["owl_talons"],
    })),
    piranha: Object.freeze(makeUnit({
      id: "piranha", name: "Piranha", size: "tiny", sprite: "https://imgur.com/XgAyzp2",
      hpBase: 5, hpCoefficient: 0.05,
      scores: { str: 2, dex: 16, con: 9, int: 1, wis: 7, cha: 2 },
      proficiencies: {}, movement: { ground: 5, swim: 40 }, defaultMovementMode: "swim",
      senses: { darkvision: 60, passivePerception: 8 },
      traits: [{ id: "water_breathing" }], mechanics: { waterBreathing: WATER_BREATHING_RULES },
      skills: ["piranha_bite"],
    })),
    rat: Object.freeze(makeUnit({
      id: "rat", name: "Rat", size: "tiny", sprite: "https://imgur.com/5CSdJgg",
      hpBase: 5, hpCoefficient: 0.05,
      scores: { str: 2, dex: 11, con: 9, int: 2, wis: 10, cha: 4 },
      proficiencies: { skills: { perception: "proficient" } },
      movement: { ground: 20, climb: 20 }, senses: { darkvision: 30, passivePerception: 12 },
      traits: [{ id: "agile" }], skills: ["rat_bite"],
    })),
    raven: Object.freeze(makeUnit({
      id: "raven", name: "Raven", size: "tiny", sprite: "https://imgur.com/Ib3X9Dm",
      hpBase: 5, hpCoefficient: 0.05,
      scores: { str: 2, dex: 14, con: 10, int: 5, wis: 13, cha: 6 },
      proficiencies: { skills: { perception: "proficient" } },
      movement: { ground: 10, fly: 50 }, defaultMovementMode: "fly", startsFlying: true,
      senses: { passivePerception: 13 }, traits: [{ id: "mimicry" }], skills: ["raven_beak"],
    })),
    scorpion: Object.freeze(makeUnit({
      id: "scorpion", name: "Scorpion", size: "tiny", sprite: "https://imgur.com/ylih8ga",
      hpBase: 5, hpCoefficient: 0.05,
      scores: { str: 2, dex: 11, con: 8, int: 1, wis: 8, cha: 2 },
      proficiencies: {}, movement: { ground: 10 }, senses: { blindsight: 10, passivePerception: 9 },
      skills: ["scorpion_sting"],
    })),
    seahorse: Object.freeze(makeUnit({
      id: "seahorse", name: "Seahorse", size: "tiny", sprite: "https://imgur.com/C2FzYsB",
      canonicalSourceName: "Seahorse", canonicalSourceBook: "Basic Rules (2024)",
      hpBase: 5, hpCoefficient: 0.05,
      scores: { str: 1, dex: 12, con: 8, int: 1, wis: 10, cha: 2 },
      proficiencies: { skills: { perception: "proficient", stealth: "expertise" } },
      movement: { ground: 5, swim: 20 }, defaultMovementMode: "swim",
      senses: { passivePerception: 12 },
      traits: [{ id: "water_breathing" }, { id: "bubble_dash" }],
      mechanics: { waterBreathing: WATER_BREATHING_RULES },
      skills: [],
    })),
    spider: Object.freeze(makeUnit({
      id: "spider", name: "Spider", size: "tiny", sprite: "https://imgur.com/f7L5sIP",
      canonicalSourceName: "Spider", canonicalSourceBook: "Monster Manual (2025)",
      hpBase: 5, hpCoefficient: 0.05,
      scores: { str: 2, dex: 14, con: 8, int: 1, wis: 10, cha: 2 },
      proficiencies: { skills: { stealth: "proficient" } },
      movement: { ground: 20, climb: 20 }, senses: { darkvision: 30, passivePerception: 10 },
      traits: [{ id: "spider_climb" }, { id: "web_walker" }],
      mechanics: { webWalker: { encounterModifierId: "web", ignoresWebBind: true, detectsUnitsInSameWeb: true } },
      skills: ["spider_bite"],
    })),
    vulture: Object.freeze(makeUnit({
      id: "vulture", name: "Vulture", size: "medium", sprite: "https://imgur.com/EnY1GTK",
      canonicalSourceName: "Vulture", canonicalSourceBook: "Monster Manual (2025)",
      hpBase: 7, hpCoefficient: 0.07,
      scores: { str: 7, dex: 10, con: 13, int: 2, wis: 12, cha: 4 },
      proficiencies: { skills: { perception: "proficient" } },
      movement: { ground: 10, fly: 50 }, defaultMovementMode: "fly", startsFlying: true,
      senses: { passivePerception: 13 },
      traits: [{ id: "pack_tactics", source: "racial_trait_catalog" }],
      skills: ["vulture_beak"],
    })),
    weasel: Object.freeze(makeUnit({
      id: "weasel", name: "Weasel", size: "tiny", sprite: "https://imgur.com/q2qcdIH",
      canonicalSourceName: "Weasel", canonicalSourceBook: "Monster Manual (2025)",
      hpBase: 5, hpCoefficient: 0.05,
      scores: { str: 3, dex: 16, con: 8, int: 2, wis: 12, cha: 3 },
      proficiencies: { skills: { acrobatics: "proficient", perception: "proficient", stealth: "proficient" } },
      movement: { ground: 30, climb: 30 }, senses: { darkvision: 60, passivePerception: 13 },
      traits: [], skills: ["weasel_bite"],
    })),
  }).map(([id, unit]) => [id, Object.freeze({ ...unit, ...COMPENDIUM_CONTENT[id] })])));

  function list() { return Object.values(DEFINITIONS).map(clone); }
  function get(id) {
    const value = DEFINITIONS[String(id || "")];
    return value ? clone(value) : null;
  }
  function normalizeRuntimeLevel(level) {
    const value = Math.floor(Number(level));
    if (!Number.isFinite(value) || value < 1) throw new Error(`UNIT_LEVEL_OUT_OF_RANGE:${level}`);
    return value;
  }
  function resolveSkill(skillId) {
    if (!skillCatalog?.get) throw new Error("BEAST_CR0_SKILL_CATALOG_REQUIRED");
    const skill = skillCatalog.get(skillId);
    if (!skill) throw new Error(`UNKNOWN_BEAST_CR0_SKILL:${skillId}`);
    return skill;
  }
  function resolve(id, options = {}) {
    const unit = get(id);
    if (!unit) throw new Error(`UNKNOWN_BEAST_CR0_UNIT:${id}`);
    const level = normalizeRuntimeLevel(options.level ?? options.baseLevel ?? 1);
    const maxHp = Math.floor(Number(unit.mechanics.hpBase || 0) + level * Number(unit.mechanics.hpCoefficient || 0));
    const proficiencyBonus = proficiencyRuntime?.proficiencyBonus ? proficiencyRuntime.proficiencyBonus(level) : Math.ceil(level / 20);
    if (options.flying != null) unit.flying = options.flying === true;
    if (options.climbing != null) unit.climbing = options.climbing === true;
    if (Array.isArray(options.encounterTags)) unit.encounterTags = options.encounterTags.slice();
    if (Array.isArray(options.environmentTags)) unit.environmentTags = options.environmentTags.slice();
    movementRuntime?.decorateEntity?.(unit, { movementMode: options.movementMode });

    unit.rank = "normal";
    unit.runtimeLevel = level;
    unit.baseLevelSelected = level;
    unit.effectiveLevel = level;
    unit.proficiencyBonus = proficiencyBonus;
    unit.resolvedSkills = unit.mechanics.skills.map(resolveSkill);
    unit.hp = maxHp;
    unit.maxHp = maxHp;
    unit.mechanics = {
      ...unit.mechanics,
      hp: maxHp,
      maxHp,
      level,
      runtimeLevel: level,
      proficiencyBonus,
      rank: "normal",
    };
    return unit;
  }

  function firebasePayload() {
    const payload = {};
    list().forEach((unit) => { payload[unit.id] = unit; });
    return payload;
  }
  function firebaseSkillPayload(schema) {
    if (!skillCatalog?.firebasePayload) throw new Error("BEAST_CR0_SKILL_CATALOG_REQUIRED");
    return skillCatalog.firebasePayload(schema);
  }

  const api = Object.freeze({
    version: "1.2.0",
    STAGGER_THRESHOLDS,
    ELEVATED_TARGETABILITY,
    FLIGHT_RULES,
    BLINDSIGHT_RULES,
    DARKVISION_RULES,
    WATER_BREATHING_RULES,
    TRAITS,
    CAT_APPEARANCES,
    DEFINITIONS,
    list,
    get,
    resolve,
    resolveSkill,
    firebasePayload,
    firebaseSkillPayload,
  });

  global.LuminousBeastCr0UnitCatalog = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);

