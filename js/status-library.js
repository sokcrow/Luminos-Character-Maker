(function (global) {
  "use strict";

  const VERSION = "0.7.4-unified";
  if (global.LuminousStatusLibrary?.version === VERSION) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousStatusLibrary;
    return;
  }

  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
  const rawId = (value) => String(value ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");

  // Canonical identity / presentation / semantic definitions migrated from
  // alpha-v0.7.3-combat-engine-1.html STATUS_CORE_REGISTRY.  Runtime-specific
  // mechanical rules are merged below, but these fields win on conflicts.
  const SOURCE_DEFINITIONS = {
    bleed:{name:'Bleed',type:'negative',mode:'double',icon:'https://imgur.com/mp9fbme.png',maxPotency:99,maxCount:99,decay:'coin_flip',description:'Attack Coin toss: take fixed damage equal to Potency, then lose 1 Count.'},
    rupture:{name:'Rupture',type:'negative',mode:'double',icon:'https://limbuscompany.wiki.gg/wiki/Special:Redirect/file/Rupture.png',maxPotency:99,maxCount:99,decay:'getting_hit',description:'When hit by an attack, take fixed damage equal to Potency, then lose 1 Count.'},
    tremor:{name:'Tremor',type:'negative',mode:'double',icon:'https://imgur.com/fuDGjpn.png',maxPotency:99,maxCount:99,description:'Tremor stores Potency and Count. Tremor Burst raises the unit’s remaining Stagger Thresholds by Tremor Potency, then loses 1 Count.'},
    tremor_burst:{name:'Tremor Burst',type:'neutral',mode:'zero',icon:'https://imgur.com/fuDGjpn.png',description:'Triggers the target’s Tremor immediately, raising its remaining Stagger Thresholds by current Tremor Potency. Tremor Burst itself is not stored as a Status.'},
    sinking:{name:'Sinking',type:'negative',mode:'double',icon:'https://imgur.com/ZnulGzZ.png',maxPotency:99,maxCount:99,decay:'getting_hit',description:'When hit, take SP damage equal to Potency, then lose 1 Count.'},
    attack_power_up:{name:'Attack Power Up',type:'positive',mode:'single',icon:'https://imgur.com/JbDs4X0.png',decay:'total_loss',description:'Attack Skill Final Power is Raised by Count.'},
    attack_power_down:{name:'Attack Power Down',type:'negative',mode:'single',icon:'https://imgur.com/g69L38F.png',decay:'total_loss',description:'Attack Skill Final Power is Lowered by Count.'},
    haste:{name:'Haste',type:'positive',mode:'single',icon:'https://imgur.com/zxUsYIN.png',decay:'total_loss',description:'Speed is Raised by Count.'},
    bind:{name:'Bind',type:'negative',mode:'single',icon:'https://imgur.com/QndWew8.png',decay:'total_loss',description:'Speed is Lowered by Count.'},
    clash_power_up:{name:'Clash Power Up',type:'positive',mode:'single',icon:'https://imgur.com/Q49TCVN.png',decay:'total_loss',description:'Clash Power is Raised by Count.'},
    clash_power_down:{name:'Clash Power Down',type:'negative',mode:'single',icon:'https://imgur.com/TppbWXb.png',decay:'total_loss',description:'Clash Power is Lowered by Count.'},
    defense_power_up:{name:'Defense Power Up',type:'positive',mode:'single',icon:'https://imgur.com/AkiiCza.png',decay:'total_loss',description:'Defense Skill Power is Raised by Count.'},
    defense_power_down:{name:'Defense Power Down',type:'negative',mode:'single',icon:'https://imgur.com/MGdXCaC.png',decay:'total_loss',description:'Defense Skill Power is Lowered by Count.'},
    offense_level_up:{name:'Offensive Level Up',type:'positive',mode:'single',icon:'https://imgur.com/p70Fei4.png',decay:'total_loss',description:'Offensive Level is Raised by Count.'},
    offense_level_down:{name:'Offensive Level Down',type:'negative',mode:'single',icon:'https://imgur.com/usBnT9m.png',decay:'total_loss',description:'Offensive Level is Lowered by Count.'},
    defense_level_up:{name:'Defensive Level Up',type:'positive',mode:'single',icon:'https://imgur.com/C0apZVL.png',decay:'total_loss',description:'Defensive Level is Raised by Count.'},
    defense_level_down:{name:'Defensive Level Down',type:'negative',mode:'single',icon:'https://imgur.com/s2jUtlo.png',decay:'total_loss',description:'Defensive Level is Lowered by Count.'},
    damage_up:{name:'DMG Up',type:'positive',mode:'single',icon:'https://imgur.com/KDLYRCR.png',maxCount:10,decay:'total_loss',description:'Damage dealt by Skills is Increased by 10% per Count.'},
    damage_down:{name:'DMG Down',type:'negative',mode:'single',icon:'https://imgur.com/bo7reA0.png',maxCount:10,decay:'total_loss',description:'Damage dealt by Skills is Lowered by 10% per Count.'},
    burn:{name:'Burn',type:'negative',mode:'double',icon:'https://imgur.com/L4bRd44.png',maxPotency:99,maxCount:99,decay:'burn_round_count_1',description:'On Turn End, take Fixed Damage equal to Potency and lose 1 Count.'},
    paralyze:{name:'Paralysis',type:'negative',mode:'single',icon:'https://imgur.com/9TkO8Ce.png',maxCount:99,decay:'coin_head',description:'Each time a Coin lands Heads, its Coin value becomes 0 and 1 Count is lost.'},
    poise:{name:'Poise',type:'positive',mode:'double',icon:'https://imgur.com/KFEmJB5.png',maxPotency:99,maxCount:99,decay:'round_count_1',description:'Gain 5% Critical Hit Chance per Potency. On Critical Hit, lose 1 Count. On Turn End, lose 1 Count.'},
    fragile:{name:'Fragile',type:'negative',mode:'single',icon:'https://imgur.com/wSFboZT.png',maxCount:99,decay:'total_loss',description:'Damage taken is Increased by 10% per Count.'},
    protection:{name:'Protection',type:'positive',mode:'single',icon:'https://imgur.com/yjPgnjd.png',maxCount:99,decay:'total_loss',description:'Damage taken is Lowered by 10% per Count.'},
    hp_healing_up:{name:'HP Healing Up',type:'positive',mode:'single',icon:'https://imgur.com/uynjNTN.png',maxCount:5,decay:'total_loss',description:'HP Healing is Raised by 10% per Count. Maximum 5.'},
    hp_healing_down:{name:'HP Healing Down',type:'negative',mode:'single',icon:'https://imgur.com/5WYFFVt.png',maxCount:5,decay:'total_loss',description:'HP Healing is Lowered by 10% per Count. Maximum 5.'},

    chill:{name:'Chill',type:'negative',mode:'single',icon:'https://imgur.com/kJY0rBP.png',maxCount:999,description:'Speed is Lowered by 1 every 2 Count. At Turn End, reaching the Size-based Cold threshold consumes all Chill and gains 1 Frozen. Frozen doubles Chill gained. Cold Resistance triples the threshold; Cold Immunity prevents Chill.'},
    frozen:{name:'Frozen',type:'negative',mode:'single',icon:'https://imgur.com/dbhWrJQ.png',maxCount:5,description:'Gain a Frozen Shield = 100 + 10% Max HP. Chill gained is doubled. At Turn End take Fixed Damage equal to 5% Max HP. If the Frozen Shield breaks, remove Frozen. At 5 Count, the unit is Annihilated.'},
    shock:{name:'Shock',type:'negative',mode:'single',icon:'https://imgur.com/KMQuv3T.png',maxCount:99,description:'At Turn Start, every 3 Count becomes 1 Paralysis and those 3 Shock Count are consumed.'},
    corrosion:{name:'Corrosion',type:'negative',mode:'single',icon:'https://imgur.com/gUySOsd.png',maxCount:10,description:'Offensive Level and Defensive Level are Lowered by 1 every 2 Count. At Turn Start take Fixed Damage equal to 1% Max HP per Count, then lose 1 Count.'},
    poison:{name:'Poison',type:'negative',mode:'double',icon:'https://imgur.com/FNjARTt.png',maxPotency:99,maxCount:999,description:'Potency represents persistent intoxication; Count represents active poison damage. At Turn End take Fixed Damage equal to Count, increased by 50% per Potency; gain 1 Potency every 5 Count, then halve Count (Floor). Ability/Skill Check Threshold +2 every 2 Potency; Clash Power -1 every 3 Potency. Short Rest: -3 Potency. Long Rest: -6 Potency. At 1+ Potency, Poison persists between Encounters.'},
    decay:{name:'Decay',type:'negative',mode:'single',icon:'https://imgur.com/TBIak3k.png',maxCount:99,description:'Reduce Max HP by 1% of Original Max HP per Count, minimum 1 Max HP. Stagger Threshold positions update immediately. Removing Decay restores Max HP but does not heal Current HP. Normal Healing removes 5 Count; Passive Regeneration removes 2; Short Rest halves Count; Long Rest removes it.'},
    radiance:{name:'Radiance',type:'negative',mode:'single',icon:'https://imgur.com/kT4mJUi.png',maxCount:10,description:'When hit, take extra Fixed Damage equal to 1% of that Hit per 2 Count. Shields take double damage; Radiance-only Shield overflow never reaches HP. Encounter End: -2 Count. Short Rest: -5. Long Rest: remove.'},

    blinded:{name:'Blinded',type:'negative',mode:'zero',icon:'https://imgur.com/ZFpviIn.png',description:'Analyse automatically fails. Perception Checks affected by blindness receive +99 Threshold. Clash Power -5. The battlefield is obscured except your own HUD/sprite and enemy Action Slots. Beneficial ally targeting requires a Perception Check Threshold 18. Repeat the stored removal Save at Turn End.'},
    charmed:{name:'Charmed',type:'negative',mode:'single',icon:'https://imgur.com/3KhkLcm.png',maxCount:99,description:'Cannot target or damage the Charmer. The Charmer gains +5 Final Power on Charisma Checks against this unit. Normal Charmed loses 1 Count at Turn End; Charmed - Magic lasts while the source maintains Concentration.'},
    paralyzed:{name:'Paralyzed',type:'negative',mode:'single',icon:'https://imgur.com/BqchBbA.png',maxCount:99,description:'Action Slots are blocked; Speed is 1; automatically fails STR/DEX Saves; takes +10% Damage. Attackers with Poise automatically Crit and do not consume Poise. Normal Paralyzed repeats its stored Save at Turn End; Ephemeral loses 1 Count; Magic lasts with Concentration.'},
    confusion:{name:'Confusion',type:'negative',mode:'zero',icon:'https://imgur.com/eadmX77.png',description:'Cannot use Quick Actions or Reactions. Turn Start: 60% cannot use Actions and Speed becomes 1; 20% Skills/Actions become Indiscriminate with random targets; 20% no additional effect. Turn End: repeat the stored WIS Save; Pass removes Confusion.'},
    frightened:{name:'Frightened',type:'negative',mode:'single',icon:'https://imgur.com/cKs7hB0.png',maxCount:99,description:'Cannot target the source. Clash Power -2. Turn End: lose 5 SP and 1 Count. When Count reaches 0, automatically Retreat or Escape as defined by the source. CALM can remove it with CHA against the stored Threshold.'},
    grappling:{name:'Grappling',type:'neutral',mode:'zero',icon:'https://imgur.com/FiKy3ea.png',description:'This unit is maintaining a Grapple against the linked unit. Its automatic Grapple Action is reserved to maintain the hold.'},
    grappled:{name:'Grappled',type:'negative',mode:'zero',icon:'https://imgur.com/FiKy3ea.png',description:'This unit is held by the linked Grappler. Grappled uses the dedicated Grapple Action economy and automatic Break Free checks; it is not Restrained.'},
    restrained:{name:'Restrained',type:'negative',mode:'single',icon:'https://imgur.com/YjsjaQX.png',maxCount:99,description:'Speed is 1. Clash Power -1 per Count. Evasion Power -2 per Count. DEX Save Threshold +1 every 2 Count. It only ends through LIBERATE: Sleight of Hand 12+Count or STR/Athletics 14+Count; self-liberation +4 Threshold; out of combat -4.'},
    incapacitated:{name:'Incapacitated',type:'negative',mode:'zero',icon:'https://limbuscompany.wiki.gg/images/Immobilized.png?50bc49=&format=original',description:'Cannot use Actions, Quick Actions, Reactions, or Universal Actions. Remains until its removal trigger occurs.'},
    invisible:{name:'Invisible',type:'positive',mode:'zero',icon:'https://imgur.com/Vn90820.png',description:'Undetected Invisible units are not targetable by Skills with ATK Weight 3 or less. Gain +5 Final Power and +5 Defense Power. Each Turn units first make an Arcane Check to notice an invisible presence; FIND then uses Perception to locate it. Detection makes it targetable at low opacity but does not remove its bonuses.'},
    petrified:{name:'Petrified',type:'negative',mode:'zero',icon:'https://imgur.com/TqLvGlK.png',description:'Speed is 1; no Actions, Quick Actions, or Reactions. Turn Start: gain 5 Protection. Immune to Poison and Poison damage. Only Magic or Items can apply Petrified; removal depends on the source.'},
    prone:{name:'Prone',type:'negative',mode:'zero',icon:'https://imgur.com/OAQzop8.png',description:'Speed is fixed to 1 for the next Turn. Evasion Power -15 and Counter Power -15 while Prone. Attack Skills targeting this unit gain +2 Final Power. At Turn Start, lock Speed to 1 for that Turn, then remove Prone.'},
    sleep:{name:'Sleep',type:'negative',mode:'single',icon:'https://imgur.com/CWT37Mq.png',maxCount:99,description:'Speed is 1 and SP resets to 0. Take triple SP Damage and +15% Damage from the next Attack. Automatically fails STR/DEX Checks and immediately loses Spell Concentration. Taking any Damage removes Sleep. Magic lasts with Concentration; Ephemeral loses 1 Count at Turn End. WAKE UP removes Sleep at Turn End.'},
    exhaustion:{name:'Exhaustion',type:'negative',mode:'single',icon:'https://imgur.com/vO8CczE.png',maxCount:6,description:'6 cumulative levels. Lv1: Ability/Skill Check Threshold +2. Lv2: Max Speed -2. Lv3: Save Threshold +2 and Clash Power -2. Lv4: Max HP halved. Lv5: Speed 1. Lv6: Death. Long Rest reduces Exhaustion by 1.'},
    deafened:{name:'Deafened',type:'negative',mode:'zero',icon:'https://imgur.com/QwqqQd2.png',description:'Mechanics reserved for the v0.7.4 Deafened pass.'}
  };

  const passive = (affectation, operation = "add", condInput = 1, condType = "count") => ({ trigger:"passive", cond_input:condInput, cond_type:condType, operation, aff_input:1, affectation, decay:"none" });
  const totalLoss = () => ({ trigger:"on_round_end", cond_input:1, cond_type:"count", operation:"add", aff_input:0, affectation:"", decay:"total_loss" });

  // Mechanical fields retained from the modular runtimes.  They supplement the
  // source definitions above; they never override source identity/presentation.
  const MECHANICS = {
    burn:{rules:[{trigger:'on_round_end',cond_input:1,cond_type:'potency',operation:'sub',aff_input:1,affectation:'hp',decay:'sub_count_1'}]},
    bleed:{rules:[{trigger:'on_coin_flip',cond_input:1,cond_type:'potency',operation:'sub',aff_input:1,affectation:'hp',decay:'sub_count_1'}]},
    rupture:{rules:[{trigger:'getting_hit',cond_input:1,cond_type:'potency',operation:'sub',aff_input:1,affectation:'hp',decay:'sub_count_1'}]},
    tremor:{rules:[{trigger:'on_tremor_burst',cond_input:1,cond_type:'potency',operation:'add',aff_input:1,affectation:'stagger_threshold',decay:'sub_count_1'}]},
    sinking:{rules:[{trigger:'getting_hit',cond_input:1,cond_type:'potency',operation:'sub',aff_input:1,affectation:'sp',decay:'sub_count_1'}]},
    poise:{rules:[{trigger:'on_crit',cond_input:1,cond_type:'count',operation:'add',aff_input:0,affectation:'',decay:'sub_count_1'},{trigger:'on_round_end',cond_input:1,cond_type:'count',operation:'add',aff_input:0,affectation:'',decay:'sub_count_1'}]},
    paralyze:{rules:[{trigger:'on_coin_head',cond_input:1,cond_type:'count',operation:'set',aff_input:0,affectation:'coin_power',decay:'sub_count_1'}]},
    attack_power_up:{rules:[passive('final_power'),totalLoss()]},
    attack_power_down:{rules:[passive('final_power','sub'),totalLoss()]},
    defense_power_up:{rules:[passive('defense_power'),totalLoss()]},
    defense_power_down:{rules:[passive('defense_power','sub'),totalLoss()]},
    clash_power_up:{rules:[passive('clash_power'),totalLoss()]},
    clash_power_down:{rules:[passive('clash_power','sub'),totalLoss()]},
    offense_level_up:{rules:[passive('offensive_level'),totalLoss()]},
    offense_level_down:{rules:[passive('offensive_level','sub'),totalLoss()]},
    defense_level_up:{rules:[passive('defensive_level'),totalLoss()]},
    defense_level_down:{rules:[passive('defensive_level','sub'),totalLoss()]},
    damage_up:{rules:[passive('damage_dealt_multiplier'),totalLoss()]},
    damage_down:{rules:[passive('damage_dealt_multiplier','sub'),totalLoss()]},
    haste:{rules:[passive('speed'),totalLoss()]},
    bind:{rules:[passive('speed','sub'),totalLoss()]},
    fragile:{rules:[passive('damage_taken_multiplier','sub'),totalLoss()]},
    protection:{rules:[passive('damage_taken_multiplier'),totalLoss()]},
    hp_healing_up:{rules:[passive('healing_multiplier'),totalLoss()]},
    hp_healing_down:{rules:[passive('healing_multiplier','sub'),totalLoss()]},
    chill:{rules:[passive('speed','sub',2)]},
    corrosion:{rules:[passive('offensive_level','sub',2),passive('defensive_level','sub',2)]},
    poison:{rules:[passive('clash_power','sub',3,'potency')]},
    frightened:{defaultCount:5},
  };

  // Runtime-only statuses are kept as extensions of this same Library rather
  // than living in a second registry.
  const EXTENSIONS = {
    crit_dmg_up:{name:'Crit DMG Up',type:'positive',mode:'single',icon:'https://limbuscompany.wiki.gg/images/Crit_DMG_Up.png?fd7a3d=&format=original',rules:[passive('crit_damage_multiplier'),totalLoss()],description:'Critical attacks deal 10% more damage per Count for one turn.'},
    counter_power_up:{name:'Counter Power Up',type:'positive',mode:'single',rules:[passive('counter_power'),totalLoss()],description:'Counter Skills gain Counter Power by Count for one turn.'},
    evade_power_up:{name:'Evade Power Up',type:'positive',mode:'single',rules:[passive('evade_power'),totalLoss()],description:'Evade Skills gain Evade Power by Count for one turn.'},
    guard_power_up:{name:'Guard Power Up',type:'positive',mode:'single',rules:[passive('guard_power'),totalLoss()],description:'Guard Skills gain Guard Power by Count for one turn.'},
    base_power_up:{name:'Base Power Up',type:'positive',mode:'single',rules:[passive('base_power'),totalLoss()],description:'Raise the Base Power of Skills by Count.'},
    plus_coin_boost:{name:'Plus Coin Boost',type:'positive',mode:'single',rules:[passive('coin_power'),totalLoss()],description:'Raise the Power of Plus Coins by Count for one turn.'},
    minus_coin_drop:{name:'Minus Coin Drop',type:'positive',mode:'single',rules:[passive('coin_power','sub'),totalLoss()],description:'Reduce the Power of Minus Coins by Count for one turn.'},
    weak_resist_dmg_boost:{name:'Weak-resist DMG Boost',type:'positive',mode:'single',rules:[passive('damage_dealt_multiplier'),totalLoss()],description:'Boost damage against Weak resistances by 1% per Count for one turn.'},
    ego_resource_amp:{name:'E.G.O Resource Amp',type:'positive',mode:'single',rules:[passive('resource'),totalLoss()],description:'Increase E.G.O resources earned from Skills by Count for one turn.'},
    power_down:{name:'Power Down',type:'negative',mode:'single',rules:[passive('final_power','sub'),totalLoss()],description:'All Skills lose Final Power by Count for one turn.'},
    counter_power_down:{name:'Counter Power Down',type:'negative',mode:'single',rules:[passive('counter_power','sub'),totalLoss()],description:'Counter Skills lose Counter Power by Count for one turn.'},
    evade_power_down:{name:'Evade Power Down',type:'negative',mode:'single',rules:[passive('evade_power','sub'),totalLoss()],description:'Evade Skills lose Evade Power by Count for one turn.'},
    guard_power_down:{name:'Guard Power Down',type:'negative',mode:'single',rules:[passive('guard_power','sub'),totalLoss()],description:'Guard Skills lose Guard Power by Count for one turn.'},
    plus_coin_drop:{name:'Plus Coin Drop',type:'negative',mode:'single',rules:[passive('coin_power','sub'),totalLoss()],description:'Reduce the Power of Plus Coins by Count for one turn.'},
    minus_coin_boost:{name:'Minus Coin Boost',type:'negative',mode:'single',rules:[passive('coin_power'),totalLoss()],description:'Raise the Power of Minus Coins by Count for one turn.'},
    immobilized:{name:'Immobilized',type:'negative',mode:'zero',rules:[],description:'Does not act for this turn.'}
  };

  const DAMAGE_TYPES = Object.freeze(['Slash','Pierce','Blunt']);
  const SIN_TYPES = Object.freeze(['Wrath','Lust','Sloth','Gluttony','Gloom','Pride','Envy']);
  const generated = {};
  [...DAMAGE_TYPES, ...SIN_TYPES].forEach((type) => {
    const prefix = type.toLowerCase();
    const tagKey = SIN_TYPES.includes(type) ? 'sin_affinity_tag' : 'damage_type_tag';
    generated[`${prefix}_dmg_up`] = {name:`${type} DMG Up`,type:'positive',mode:'single',[tagKey]:type,maxCount:10,rules:[passive('damage_dealt_multiplier'),totalLoss()],description:`Deal 10% more damage with ${type} Skills per Count for one turn. (Max 10)`};
    generated[`${prefix}_power_up`] = {name:`${type} Power Up`,type:'positive',mode:'single',[tagKey]:type,rules:[passive('final_power'),totalLoss()],description:`${type} Skills gain Final Power by Count for one turn.`};
    generated[`${prefix}_protection`] = {name:`${type} Protection`,type:'positive',mode:'single',[tagKey]:type,maxCount:10,rules:[passive('damage_taken_multiplier'),totalLoss()],description:`Take 10% less damage from ${type} Skills per Count for one turn. (Max 10)`};
    generated[`${prefix}_dmg_down`] = {name:`${type} DMG Down`,type:'negative',mode:'single',[tagKey]:type,maxCount:10,rules:[passive('damage_dealt_multiplier','sub'),totalLoss()],description:`Deal 10% less damage with ${type} Skills per Count for one turn. (Max 10)`};
    generated[`${prefix}_power_down`] = {name:`${type} Power Down`,type:'negative',mode:'single',[tagKey]:type,rules:[passive('final_power','sub'),totalLoss()],description:`${type} Skills lose Final Power by Count for one turn.`};
    generated[`${prefix}_fragility`] = {name:`${type} Fragility`,type:'negative',mode:'single',[tagKey]:type,maxCount:10,rules:[passive('damage_taken_multiplier','sub'),totalLoss()],description:`Take 10% more damage from ${type} Skills per Count for one turn. (Max 10)`};
  });

  const ALIASES = Object.freeze({
    paralysis:'paralyze',
    binding:'bind',
    offense_up:'offense_level_up',
    offense_down:'offense_level_down',
    offensive_level_up:'offense_level_up',
    offensive_level_down:'offense_level_down',
    defense_up:'defense_level_up',
    defense_down:'defense_level_down',
    defensive_level_up:'defense_level_up',
    defensive_level_down:'defense_level_down',
    clash_up:'clash_power_up',
    clash_down:'clash_power_down',
    vulnerability:'fragile',
    hp_healing_boost:'hp_healing_up',
    immobilised:'immobilized'
  });

  const CONDITION_IDS = Object.freeze(['blinded','charmed','paralyzed','confusion','frightened','grappling','grappled','restrained','incapacitated','invisible','petrified','prone','sleep','exhaustion','deafened']);
  const MAGIC_ELEMENT_RULES = Object.freeze({
    fire:{sin:'wrath',status:'burn'},cold:{sin:'gloom',status:'chill'},lightning:{sin:'envy',status:'shock'},acid:{sin:'gluttony',status:'corrosion'},poison:{sin:'gluttony',status:'poison'},necrotic:{sin:'gloom',status:'decay'},radiant:{sin:'pride',status:'radiance'},psychic:{sin:'lust',status:'sinking'},thunder:{sin:'wrath',status:'tremor'},force:{sin:'sloth',status:null}
  });

  function resolveId(value) {
    let key = rawId(value);
    const seen = new Set();
    while (ALIASES[key] && !seen.has(key)) { seen.add(key); key = ALIASES[key]; }
    return key;
  }

  const core = {};
  const ids = new Set([...Object.keys(SOURCE_DEFINITIONS), ...Object.keys(EXTENSIONS), ...Object.keys(generated)]);
  ids.forEach((id) => {
    const mechanics = MECHANICS[id] || {};
    const extension = EXTENSIONS[id] || generated[id] || {};
    const source = SOURCE_DEFINITIONS[id] || {};
    const definition = {
      id,
      icon:null,
      rules:[],
      ...clone(extension),
      ...clone(mechanics),
      ...clone(source),
      rules:clone(mechanics.rules || extension.rules || source.rules || []),
      canonicalSource: SOURCE_DEFINITIONS[id] ? 'alpha-v0.7.3-combat-engine-1' : 'modular-runtime-extension'
    };
    core[id] = Object.freeze(definition);
  });
  Object.freeze(core);

  const runtimeExtensions = Object.create(null);
  function get(statusId) {
    const id = resolveId(statusId);
    return core[id] || runtimeExtensions[id] || null;
  }
  function has(statusId) { return Boolean(get(statusId)); }
  function list() { return [...Object.values(core), ...Object.values(runtimeExtensions)]; }
  function registerExtension(statusId, definition = {}) {
    const id = resolveId(statusId);
    if (!id || core[id]) return core[id] || null;
    runtimeExtensions[id] = Object.freeze({ id, icon:null, rules:[], ...clone(definition), canonicalSource:'runtime-extension' });
    return runtimeExtensions[id];
  }

  const registryView = new Proxy(Object.create(null), {
    get(_target, property) {
      if (typeof property === 'symbol') return undefined;
      return get(property);
    },
    set(_target, property, value) {
      const id = resolveId(property);
      if (!id || core[id]) return true;
      registerExtension(id, value && typeof value === 'object' ? value : {});
      return true;
    },
    deleteProperty(_target, property) {
      const id = resolveId(property);
      if (!id || core[id]) return true;
      delete runtimeExtensions[id];
      return true;
    },
    has(_target, property) { return has(property); },
    ownKeys() { return [...new Set([...Object.keys(core), ...Object.keys(runtimeExtensions)])]; },
    getOwnPropertyDescriptor(_target, property) {
      const value = get(property);
      return value ? { configurable:true, enumerable:true, writable:false, value } : undefined;
    }
  });

  function canonicalizeMap(source) {
    if (!source || typeof source !== 'object' || Array.isArray(source)) return source;
    Object.keys(source).forEach((key) => {
      const id = resolveId(key);
      if (!id || id === key) return;
      if (!Object.prototype.hasOwnProperty.call(source, id)) {
        source[id] = source[key];
        if (source[id] && typeof source[id] === 'object') source[id].id = id;
      }
      delete source[key];
    });
    return source;
  }

  function canonicalizeUnit(unit) {
    if (!unit || typeof unit !== 'object') return unit;
    canonicalizeMap(unit.statusEffects);
    canonicalizeMap(unit.statusProtections);
    canonicalizeMap(unit.protectedStatuses);
    return unit;
  }

  function installStatusEngineBridge() {
    const source = global.LuminousStatusEngine;
    if (!source || source.__luminousStatusLibraryBridge) return Boolean(source);
    const wrapped = Object.freeze({
      ...source,
      __luminousStatusLibraryBridge:true,
      normalizeId:resolveId,
      getDefinition(statusId) {
        const definition = get(statusId);
        if (definition) return clone(definition);
        return source.getDefinition(resolveId(statusId));
      },
      ensureStore(unit) { canonicalizeUnit(unit); return source.ensureStore(unit); },
      applyStatus(unit, statusId, input = {}) { canonicalizeUnit(unit); return source.applyStatus(unit, resolveId(statusId), input); },
      removeStatus(unit, statusId, options = {}) { canonicalizeUnit(unit); return source.removeStatus(unit, resolveId(statusId), options); },
      hasStatus(unit, statusId) { canonicalizeUnit(unit); return source.hasStatus(unit, resolveId(statusId)); },
      getStatus(unit, statusId) { canonicalizeUnit(unit); return source.getStatus(unit, resolveId(statusId)); },
      protectStatus(unit, statusId, protection = {}) { canonicalizeUnit(unit); return source.protectStatus(unit, resolveId(statusId), protection); },
      syncTraitState(unit, traitState = {}) {
        const statuses = {};
        const protections = {};
        Object.entries(traitState.statuses || {}).forEach(([id, value]) => { statuses[resolveId(id)] = value; });
        Object.entries(traitState.protectedStatuses || {}).forEach(([id, value]) => { protections[resolveId(id)] = value; });
        return source.syncTraitState(unit, { ...traitState, statuses, protectedStatuses:protections });
      },
      advanceDurations(unit, trigger) { canonicalizeUnit(unit); return source.advanceDurations(unit, trigger); },
      listStatuses(unit) { canonicalizeUnit(unit); return source.listStatuses(unit); }
    });
    global.LuminousStatusEngine = wrapped;
    return true;
  }

  function displayMode(definitionOrId, instance = {}) {
    const def = typeof definitionOrId === 'string' ? get(definitionOrId) : definitionOrId;
    if (!def) return 'single';
    const duration = rawId(instance?.durationType || instance?.duration || '');
    if (resolveId(def.id) === 'paralyzed' && duration !== 'ephemeral') return 'zero';
    if (resolveId(def.id) === 'sleep' && duration !== 'ephemeral') return 'zero';
    return def.mode || 'single';
  }

  const api = Object.freeze({
    version:VERSION,
    registry:registryView,
    definitions:core,
    aliases:ALIASES,
    conditionIds:CONDITION_IDS,
    damageTypes:DAMAGE_TYPES,
    sinTypes:SIN_TYPES,
    magicElementRules:MAGIC_ELEMENT_RULES,
    normalizeId:resolveId,
    resolveId,
    get,
    has,
    list,
    registerExtension,
    canonicalizeUnit,
    installStatusEngineBridge,
    displayMode,
    install() {
      global.STATUS_REGISTRY = registryView;
      installStatusEngineBridge();
      return registryView;
    }
  });

  global.LuminousStatusLibrary = api;
  api.install();
  const bridgeTimer = typeof global.setInterval === 'function' ? global.setInterval(installStatusEngineBridge, 250) : null;
  bridgeTimer?.unref?.();

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
