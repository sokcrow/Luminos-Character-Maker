(function (global) {
  'use strict';
  const clone = x => x == null ? x : JSON.parse(JSON.stringify(x));
  const skillCatalog = global.LuminousCaveSapphireSpiderSkillCatalog;
  const movement = global.LuminousMovementSpeedRuntime;
  const loot = global.LuminousUnitLootProfileContract;
  const sharedSprite = 'Assets/Images/Units/Cave_Crystal/sapphire_spider.png';
  const mineralProfile = sizeClass => loot?.createProfiles({
    bodyProfile: {
      kind: 'mineral', sizeClass, materials: ['stone', 'crystal'], edible: false,
      resources: [
        { id: 'sapphire_fragments', integrityFamily: 'hard_parts', sourceMaterial: 'crystal',
          itemId: 'hard_exotic', anatomicalIdentity: 'crystal_fragment', lineageId: 'sapphire_spider',
          lineageName: 'Sapphire Spider', valuable: true, knownUses: ['crafting', 'enchanting'],
          tags: ['crystal', 'sapphire'], yield: sizeClass === 'large' ? { min: 2, max: 5 } : { min: 1, max: 3 } },
        { id: 'stone_carapace', integrityFamily: 'hard_cover_modular', sourceMaterial: 'stone',
          itemId: 'hard_exotic', anatomicalIdentity: 'stone_carapace', lineageId: 'sapphire_spider',
          lineageName: 'Sapphire Spider', knownUses: ['crafting'], tags: ['stone', 'carapace'],
          yield: sizeClass === 'large' ? { min: 2, max: 4 } : { min: 1, max: 2 } }
      ],
      notes: 'Animated stone and crystal; contains no meat, blood, venom glands or medical organs.'
    },
    lootProfile: {
      carried: [], equipment: { source: 'none' }, currency: null,
      harvest: { source: 'body_profile' }, impossibleCategories: [],
      notes: 'Mineral body materials use Salvage (Arcana); no anatomical extraction with Medicine.'
    }
  }) || null;
  const scoreMap = s => ({ fuerza: s.str, destreza: s.dex, constitucion: s.con,
    inteligencia: s.int, sabiduria: s.wis, carisma: s.cha });
  function define({id, name, size, classification, challengeRating, scores, hpBase, hpCoefficient, offensiveLevelModifier,
    defensiveLevelModifier, movementFeet, thresholds, traits, skills}) {
    const profile = mineralProfile(size);
    return {
      id, name, species: 'sapphire_spider', family: 'cave_sapphire_spiders',
      creatureType: 'elemental', unitType: 'enemy', actorCategory: 'enemy', faction: 'enemy', isPlayer: false,
      // DM-approved Homebrew CR: separate from Luminos runtime Level.
      challengeRating,
      tags: ['cave', 'mineral', 'crystal', ...(classification === 'hard' ? ['hard_unit'] : []), 'pride', 'sapphire_spider'],
      naturalWorldLevel: {min: 30, max: 30}, baseLevel: {min: 30, max: 30},
      scores, stats: scoreMap(scores), proficiencies: {savingThrows:{}, skills:{}},
      size, movement: {ground:movementFeet,climb:movementFeet},
      movementFeet: {ground:movementFeet,climb:movementFeet}, preferredMovementMode: 'ground',
      senses: {darkvision:60}, hpBase, hpCoefficient,
      offensiveLevelModifier, defensiveLevelModifier, offensiveLevel:30+offensiveLevelModifier,
      defensiveLevel:30+defensiveLevelModifier,
      allowedRanks:['normal'], rank:'normal', staggerThresholds:thresholds,
      resistances: {SLASH:'WEAK', PIERCE:'RESIST', BLUNT:'NORMAL', PRIDE:'RESIST'},
      sinResistances: {wrath:1,lust:1,sloth:1,gluttony:1,gloom:1,pride:.5,envy:1},
      primarySin: 'pride',
      actionSlots:1, activeSlots:1, action_slots:skills, traitIds:traits.map(x=>x.id),
      traits, bodyProfile:profile?.bodyProfile, lootProfile:profile?.lootProfile,
      // Canonical visual contract shared by Kobold, Beast and Sapphire Units.
      // Both variants use ONE original repository PNG; only scale differs.
      visual:{spriteUrl:sharedSprite,idle_sprite:sharedSprite,moving_sprite:'',
        guard_sprite:'',evade_sprite:'',hurt_sprite:'',dead_sprite:'',
        spriteX:0,spriteY:0,uiX:0,uiY:0,spritePending:false,
        scale:size === 'medium' ? 0.72 : 1},
      icono:sharedSprite,
      mechanics:{hpBase,hpCoefficient,hpModel:'chassis_coefficient',sp:0,actionSlots:1,maxSlotsLimit:1,
        skills:[...skills],staggerThresholds:[...thresholds],movementFeet:{ground:movementFeet,climb:movementFeet},
        preferredMovementMode:'ground',build:['Poise','Speed','Bind',...(size==='large'?['Restrained']:[])],
        offensiveLevelModifier,defensiveLevelModifier},
      metadata:{canonicalUnit:true,catalog:'cave-sapphire-spider',homebrew:true,classification,crPending:false,
        spritePending:!sharedSprite,speedModel:'movement_feet_plus_size',levelCapContext:65,
        naturalWorldLevelIsReferenceOnly:true,physicalProfilePending:false},schemaVersion:5
    };
  }
  const ADULT_SCORES={str:13,dex:18,con:12,int:3,wis:12,cha:5};
  const JUVENILE_SCORES={str:10,dex:16,con:10,int:2,wis:10,cha:4};
  const freezeCompendiumContent = value => {
    if (value && typeof value === 'object') { Object.values(value).forEach(freezeCompendiumContent); Object.freeze(value); }
    return value;
  };
  const COMPENDIUM_CONTENT = freezeCompendiumContent({
  "sapphire_spider": {
    "basicDescription": "Criatura arácnida grande cuyo cuerpo combina superficies pétreas y formaciones cristalinas azules. Sus extremidades presentan un aspecto mineral.",
    "lore": {
      "context": "Las arañas de zafiro forman parte de los peligros minerales registrados en cavidades y espacios de roca de Limbus. Su parecido con una araña no demuestra parentesco biológico con los arácnidos de carne.",
      "behavior": "Combina desplazamientos rápidos con técnicas vinculadas a su estructura cristalina. Sus ataques y los efectos que producen deben registrarse por separado; su aspecto mineral no revela todas sus resistencias."
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
          "skill": "arcana",
          "contentPath": "lore.behavior"
        }
      ],
      "bodyStudy": {
        "skill": "arcana",
        "text": "Su cuerpo está formado por piedra y cristal animados. El estudio arcano y material corresponde a esta estructura; no se presuponen carne, sangre, glándulas de veneno ni órganos médicos."
      }
    }
  },
  "sapphire_spiderling": {
    "basicDescription": "Criatura arácnida mineral de menor tamaño que la araña de zafiro adulta. Presenta un cuerpo pétreo con formaciones de cristal azul.",
    "lore": {
      "context": "La denominación Spiderling diferencia esta forma del ejemplar adulto del registro. Sus relaciones de grupo deben comprobarse y no equivalen a un sistema de castas conocido.",
      "behavior": "Se mueve alrededor de otros ejemplares y utiliza técnicas propias de su forma menor. Haber estudiado un adulto no demuestra que la cría posea exactamente los mismos movimientos o condiciones."
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
          "skill": "arcana",
          "contentPath": "lore.behavior"
        }
      ],
      "bodyStudy": {
        "skill": "arcana",
        "text": "Posee una estructura mineral animada de piedra y cristal. Las técnicas de estudio corporal deben atender a ese material y no buscar órganos biológicos inexistentes."
      }
    }
  }
});

  const DEFINITIONS=Object.freeze(Object.fromEntries(Object.entries({
    sapphire_spider:define({
      id:'sapphire_spider',name:'Sapphire Spider',size:'large',classification:'hard',challengeRating:3,scores:ADULT_SCORES,
      hpBase:48,hpCoefficient:1.5,offensiveLevelModifier:2,defensiveLevelModifier:-2,
      movementFeet:45,thresholds:[70,40,15],
      traits:[{id:'swift_predator',name:'Swift Predator',type:'passive',
        description:'[On Turn Start] Gain 1 Haste per 3 Poise Potency. Deal +5% Damage per point of positive Speed difference (Max +20%).'}],
      skills:skillCatalog.loadout('sapphire_spider')
    }),
    sapphire_spiderling:define({
      id:'sapphire_spiderling',name:'Sapphire Spiderling',size:'medium',classification:'normal',challengeRating:1,scores:JUVENILE_SCORES,
      hpBase:15,hpCoefficient:1.2,offensiveLevelModifier:-1,defensiveLevelModifier:-1,
      movementFeet:35,thresholds:[65,30],
      traits:[{id:'brood_instinct',name:'Brood Instinct',type:'passive',
        description:'[On Turn Start] Gain 1 Haste per 4 Poise Potency (Max 2). Deal +5% Damage per point of positive Speed difference (Max +10%).'}],
      skills:skillCatalog.loadout('sapphire_spiderling')
    })
  }).map(([id, unit]) => [id, Object.freeze({ ...unit, ...COMPENDIUM_CONTENT[id] })])));
  const get = id => DEFINITIONS[id] ? clone(DEFINITIONS[id]) : null;
  const list = () => Object.keys(DEFINITIONS).map(get);
  function resolve(id, options = {}) {
    const unit = get(id);
    if (!unit) throw Error('UNKNOWN_SAPPHIRE_SPIDER_UNIT:' + id);
    const rank = options.rank || 'normal';
    if (rank !== 'normal') throw Error('SAPPHIRE_SPIDER_NORMAL_RANK_ONLY:' + rank);
    const level = Math.floor(Number(options.level ?? options.baseLevel ?? 30));
    if (level < 1 || level > 65) throw Error('SAPPHIRE_SPIDER_LEVEL_OUT_OF_RANGE:' + level);
    const hp = Math.floor(unit.hpBase + unit.hpCoefficient * level);
    const range = movement?.rangeForEntity?.(unit);
    if (!range) throw Error('SAPPHIRE_MOVEMENT_RUNTIME_REQUIRED');
    Object.assign(unit,{level,runtimeLevel:level,effectiveLevel:level,hp,maxHp:hp,
      offensiveLevel:level+unit.offensiveLevelModifier,defensiveLevel:level+unit.defensiveLevelModifier,
      speedRange:[range.min,range.max],speedMin:range.min,speedMax:range.max});
    unit.resolvedSkills=unit.mechanics.skills.map(id=>skillCatalog.get(id));
    Object.assign(unit.mechanics,{hp,maxHp:hp,level,runtimeLevel:level,speedRange:[range.min,range.max]});
    return unit;
  }
  function firebasePayload(){return Object.fromEntries(list().map(unit=>[unit.id,unit]));}
  const firebaseSkillPayload = schema => skillCatalog.firebasePayload(schema);
  const api=Object.freeze({version:'1.0.0',DEFINITIONS,get,list,resolve,firebasePayload,firebaseSkillPayload});
  global.LuminousCaveSapphireSpiderUnitCatalog=api;
  if (typeof module !== 'undefined' && module.exports)module.exports=api;
})(typeof window !== 'undefined' ? window : globalThis);

