(function (global) {
  "use strict";

  if (global.LuminousAgathaPlayerSkillRuntime) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousAgathaPlayerSkillRuntime;
    return;
  }

  const VERSION = "0.7.4-agatha-signature-1";
  const CHARACTER_ID = "agatha";
  const IDS = Object.freeze({
    highTime: "agatha_onryo_high_time",
    propShredder: "agatha_onryo_prop_shredder",
    helmBreaker: "agatha_onryo_helm_breaker",
    roundTrip: "agatha_onryo_round_trip",
    stinger: "agatha_onryo_stinger",
    millionStab: "agatha_onryo_million_stab",
    drive: "agatha_onryo_drive",
    aerialRave: "agatha_onryo_aerial_rave",
    danceMacabre: "agatha_onryo_dance_macabre",
    overdrive: "agatha_onryo_overdrive",
    twosomeTime: "agatha_ignovus_twosome_time",
    chargedShot: "agatha_ignovus_charged_shot",
    honeycombFire: "agatha_ignovus_honeycomb_fire",
    rainStorm: "agatha_ignovus_rain_storm",
  });

  const WEAPON_ARTS = Object.freeze({
    onryo: Object.freeze({
      id: "onryo",
      name: "Onryo",
      changeAfter: 2,
      skillIds: Object.freeze([
        IDS.highTime, IDS.propShredder, IDS.helmBreaker, IDS.roundTrip,
        IDS.stinger, IDS.millionStab, IDS.drive, IDS.aerialRave, IDS.danceMacabre,
      ]),
    }),
    ignovus: Object.freeze({
      id: "ignovus",
      name: "Ignovus",
      changeAfter: 2,
      skillIds: Object.freeze([IDS.twosomeTime, IDS.chargedShot, IDS.honeycombFire]),
    }),
  });

  const ALL_SKILL_IDS = Object.freeze([
    ...WEAPON_ARTS.onryo.skillIds,
    ...WEAPON_ARTS.ignovus.skillIds,
    IDS.overdrive,
    IDS.rainStorm,
  ]);

  const encounterState = new WeakMap();
  const normalizeId = (value) => String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  const numberOr = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));

  function skillId(skill = {}) {
    return normalizeId(skill.id || skill.skillId || skill.sourceId || skill.libraryKey);
  }

  function isAgathaSkill(skill = {}) {
    return ALL_SKILL_IDS.includes(skillId(skill));
  }

  function isAgathaUnit(unit = {}, skill = null) {
    const build = unit?.characterBuild && typeof unit.characterBuild === "object" ? unit.characterBuild : {};
    const ids = [
      unit?.characterId, unit?.playerId, unit?.canonicalPlayerKey, unit?.signatureSkillCharacterId,
      build?.signatureSkillCharacterId, build?.characterId, build?.playerId,
    ].map(normalizeId);
    if (ids.includes(CHARACTER_ID)) return true;
    return isAgathaSkill(skill || {});
  }

  function stateFor(unit, create = true) {
    if (!unit || (typeof unit !== "object" && typeof unit !== "function")) return null;
    let state = encounterState.get(unit);
    if (!state && create) {
      state = {
        currentWeapon: null,
        skillsUsedWithCurrentWeapon: 0,
        originalLoadout: null,
        rotationCount: 0,
      };
      encounterState.set(unit, state);
    }
    return state || null;
  }

  function catalog() {
    return global.LuminousPlayerSignatureSkillCatalog || null;
  }

  function skillDefinition(id) {
    const value = catalog()?.get?.(id) || catalog()?.DEFINITIONS?.[id] || null;
    return value ? clone(value) : null;
  }

  function weaponSkillDefinitions(weaponId) {
    const weapon = WEAPON_ARTS[normalizeId(weaponId)];
    return weapon ? weapon.skillIds.map(skillDefinition).filter(Boolean) : [];
  }

  function statusEntry(unit = {}, id) {
    const key = normalizeId(id);
    const collection = unit.statusEffects || unit.statuses || {};
    if (Array.isArray(collection)) {
      return collection.find((entry) => normalizeId(entry?.id || entry?.status || entry?.name) === key) || null;
    }
    return collection && typeof collection === "object" ? (collection[key] || collection[id] || null) : null;
  }

  function statusPotency(unit, id) {
    const entry = statusEntry(unit, id);
    if (typeof entry === "number") return Math.max(0, Number(entry) || 0);
    return Math.max(0, numberOr(entry?.potency, 0));
  }

  function statusCount(unit, id) {
    const entry = statusEntry(unit, id);
    if (typeof entry === "number") return Math.max(0, Number(entry) || 0);
    return Math.max(0, numberOr(entry?.count, 0));
  }

  function setStatus(unit, id, { potency = 0, count = 0, mode = "set", sourceSkillId = null } = {}) {
    if (!unit) return null;
    const key = normalizeId(id);
    if (typeof global.LuminousStatusEngine?.applyStatus === "function") {
      return global.LuminousStatusEngine.applyStatus(unit, key, {
        potency: Math.max(0, numberOr(potency, 0)),
        count: Math.max(0, numberOr(count, 0)),
        mode,
        data: { sourceSkillId: sourceSkillId || null, sourceCharacterId: CHARACTER_ID },
      });
    }
    if (!unit.statusEffects || typeof unit.statusEffects !== "object" || Array.isArray(unit.statusEffects)) unit.statusEffects = {};
    const current = unit.statusEffects[key] || { id: key, potency: 0, count: 0, data: {} };
    if (mode === "set") {
      current.potency = Math.max(0, numberOr(potency, 0));
      current.count = Math.max(0, numberOr(count, 0));
    } else {
      current.potency = Math.max(0, numberOr(current.potency, 0) + numberOr(potency, 0));
      current.count = Math.max(0, numberOr(current.count, 0) + numberOr(count, 0));
    }
    current.data = { ...(current.data || {}), sourceSkillId: sourceSkillId || null, sourceCharacterId: CHARACTER_ID };
    if (current.potency <= 0 && current.count <= 0) delete unit.statusEffects[key];
    else unit.statusEffects[key] = current;
    return unit.statusEffects[key] || null;
  }

  function applyStatus(unit, id, values = {}) {
    return setStatus(unit, id, { ...values, mode: "gain" });
  }

  function consumeStatusPotency(unit, id, amount) {
    const required = Math.max(0, numberOr(amount, 0));
    const current = statusPotency(unit, id);
    if (current < required) return false;
    const entry = statusEntry(unit, id) || {};
    setStatus(unit, id, { potency: current - required, count: statusCount(unit, id), mode: "set" });
    return true;
  }

  function reduceStatusCount(unit, id, amount = 1) {
    const current = statusCount(unit, id);
    const entry = statusEntry(unit, id) || {};
    setStatus(unit, id, {
      potency: statusPotency(unit, id),
      count: Math.max(0, current - Math.max(0, numberOr(amount, 0))),
      mode: "set",
    });
    return statusEntry(unit, id);
  }

  function scheduleStatusNextTurn(unit, id, values = {}) {
    if (!unit) return false;
    if (!Array.isArray(unit.delayed_effects)) unit.delayed_effects = [];
    const statusId = normalizeId(id);
    const payload = { potency: numberOr(values.potency, 0), count: numberOr(values.count, 0), sourceSkillId: values.sourceSkillId || null };
    unit.delayed_effects.push({
      attacker: unit,
      defender: unit,
      skill: null,
      currentCoin: null,
      effect: {
        execute() { applyStatus(unit, statusId, payload); },
      },
    });
    return true;
  }

  function ammoRuntime() {
    if (global.LuminousUniversalRangedAmmoRuntime) return global.LuminousUniversalRangedAmmoRuntime;
    if (typeof require === "function") {
      try { return require("./universal-ranged-ammo-runtime.js"); } catch (_) {}
    }
    return null;
  }

  function consumeBullet(unit, amount = 1) {
    const runtime = ammoRuntime();
    if (runtime?.consumeAmmo) return runtime.consumeAmmo(unit, "bullets", amount);
    const current = statusCount(unit, "bullets");
    if (current < amount) return { ok: false, current, required: amount, remaining: current, reason: "ammunition_unavailable" };
    setStatus(unit, "bullets", { potency: 0, count: current - amount, mode: "set" });
    return { ok: true, current, required: amount, remaining: current - amount };
  }

  function statScore(unit = {}, stat) {
    const stats = unit.stats || {};
    const aliases = stat === "strength"
      ? ["fuerza", "strength", "str"]
      : ["destreza", "dexterity", "dex"];
    for (const key of aliases) {
      if (Number.isFinite(Number(stats[key]))) return Number(stats[key]);
      if (Number.isFinite(Number(unit[key]))) return Number(unit[key]);
    }
    return 10;
  }

  function statMod(unit, stat) {
    const directKeys = stat === "strength"
      ? ["strengthMod", "strMod", "fuerzaMod"]
      : ["dexterityMod", "dexMod", "destrezaMod"];
    for (const key of directKeys) {
      if (Number.isFinite(Number(unit?.[key]))) return Number(unit[key]);
      if (Number.isFinite(Number(unit?.stats?.[key]))) return Number(unit.stats[key]);
    }
    return Math.floor((statScore(unit, stat) - 10) / 2);
  }

  function proficiency(unit = {}) {
    const direct = [unit.proficiency, unit.proficiencyBonus, unit.proficiency_bonus, unit.stats?.proficiency, unit.stats?.proficiencyBonus]
      .map(Number).find(Number.isFinite);
    return direct == null ? 0 : direct;
  }

  function offensiveLevel(unit, skill, engine) {
    if (engine && typeof engine.getOffensiveLevel === "function") {
      try { return numberOr(engine.getOffensiveLevel(unit, skill), 1); } catch (_) {}
    }
    const direct = [unit?.offensive_level, unit?.offensiveLevel, unit?.level].map(Number).find(Number.isFinite);
    return direct == null ? 1 : direct;
  }

  function dynamicPower(unit, skill, engine = global.CombatEngine) {
    const id = skillId(skill);
    if (!ALL_SKILL_IDS.includes(id)) return null;
    const str = statScore(unit, "strength");
    const dex = statScore(unit, "dexterity");
    const strMod = statMod(unit, "strength");
    const dexMod = statMod(unit, "dexterity");
    const off = offensiveLevel(unit, skill, engine);
    const offPart = off / 20;
    const table = {
      [IDS.highTime]: [1 + strMod + offPart, (str / 3) + offPart],
      [IDS.propShredder]: [1 + dexMod + offPart, (dex / 8) + offPart],
      [IDS.helmBreaker]: [1 + strMod + offPart, (str / 2) + offPart],
      [IDS.roundTrip]: [2 + strMod + offPart, (str / 5) + offPart],
      [IDS.stinger]: [1 + strMod + offPart, (str / 2) + offPart],
      [IDS.millionStab]: [1 + dexMod + offPart, (dex / 6) + offPart],
      [IDS.drive]: [2 + strMod + offPart, (str / 2) + offPart],
      [IDS.aerialRave]: [2 + dexMod + offPart, (dex / 6) + offPart],
      [IDS.danceMacabre]: [3 + dexMod + offPart, (dex / 6) + offPart],
      [IDS.overdrive]: [3 + strMod + offPart, (str / 3) + offPart],
      [IDS.twosomeTime]: [1 + strMod + offPart, (str / 6) + offPart],
      [IDS.chargedShot]: [2 + strMod + offPart, (str / 2) + offPart],
      [IDS.honeycombFire]: [3 + dexMod + offPart, (dex / 6) + offPart],
      [IDS.rainStorm]: [3 + proficiency(unit) + dexMod + offPart, (dex / 6) + offPart],
    };
    const values = table[id];
    return values ? { basePower: values[0], coinPower: values[1], offensiveLevel: off } : null;
  }

  function unitSpeed(unit = {}) {
    const direct = [unit.currentSpeed, unit.speed, unit.resolvedSpeed, unit.combatSpeed].map(Number).find(Number.isFinite);
    return direct == null ? 0 : direct;
  }

  function decorateSkillForTarget(unit, target, rawSkill) {
    const skill = clone(rawSkill) || rawSkill;
    const id = skillId(skill);
    if (!ALL_SKILL_IDS.includes(id)) return skill;
    const bleed = statusPotency(target, "bleed");
    const burn = statusPotency(target, "burn");
    const poise = statusPotency(unit, "poise");
    const speedDiff = Math.max(0, unitSpeed(unit) - unitSpeed(target));

    if ([IDS.helmBreaker, IDS.millionStab].includes(id)) {
      skill.__agathaClashPowerBonus = Math.min(3, Math.floor(bleed / 3));
    }
    if (id === IDS.chargedShot) skill.__agathaClashPowerBonus = Math.min(2, Math.floor(burn / 4));
    if (id === IDS.stinger) skill.__agathaFinalPowerBonus = Math.min(3, Math.floor(speedDiff));
    if (id === IDS.aerialRave && speedDiff > 0) skill.__agathaCoinPowerBonus = 1;
    if (id === IDS.honeycombFire) skill.__agathaFinalPowerBonus = Math.min(5, Math.floor(poise / 3));
    if (id === IDS.rainStorm && burn >= 10) skill.__agathaCoinPowerBonus = 1;
    return skill;
  }

  function evolvedSkillDefinition(id, fromId) {
    const evolved = skillDefinition(id);
    if (!evolved) return null;
    evolved.metadata = { ...(evolved.metadata || {}), evolvedFromSkillId: fromId, agathaEvolution: true };
    return evolved;
  }

  function evolveSkillForUnit(unit, target, skill) {
    const id = skillId(skill);
    if (id === IDS.danceMacabre && statusPotency(unit, "poise") >= 15) {
      return evolvedSkillDefinition(IDS.overdrive, IDS.danceMacabre) || skill;
    }
    if (id === IDS.honeycombFire && statusPotency(target, "burn") >= 10 && statusPotency(unit, "poise") >= 7) {
      return evolvedSkillDefinition(IDS.rainStorm, IDS.honeycombFire) || skill;
    }
    return skill;
  }

  function prepareSkill(unit, target, skill) {
    return decorateSkillForTarget(unit, target, evolveSkillForUnit(unit, target, skill));
  }

  function captureOriginalLoadout(unit) {
    const state = stateFor(unit, true);
    if (state.originalLoadout) return state.originalLoadout;
    state.originalLoadout = {
      skillSlotIds: clone(unit.skillSlotIds),
      skillIds: clone(unit.skillIds),
      equippedSkillIndex: clone(unit.equippedSkillIndex),
      skillDeck: clone(unit.characterBuild?.skillDeck),
    };
    return state.originalLoadout;
  }

  function mountWeaponDeck(unit, weaponId) {
    const weapon = WEAPON_ARTS[normalizeId(weaponId)];
    if (!unit || !weapon) return false;
    captureOriginalLoadout(unit);
    const ids = [...weapon.skillIds];
    unit.skillSlotIds = ids;
    unit.skillIds = ids;
    unit.equippedSkillIndex = Object.fromEntries(ids.map((id) => [id, true]));
    if (!unit.characterBuild || typeof unit.characterBuild !== "object") unit.characterBuild = {};
    unit.characterBuild.skillDeck = {};
    unit.characterBuild.weaponArt = weapon.id;
    unit.characterBuild.weaponArtSkillIds = ids;
    return true;
  }

  function chooseWeapon(currentWeapon = null, rng = Math.random) {
    const ids = Object.keys(WEAPON_ARTS);
    const available = ids.length > 1 ? ids.filter((id) => id !== normalizeId(currentWeapon)) : ids;
    const roll = Math.max(0, Math.min(0.999999999, Number(rng()) || 0));
    return available[Math.floor(roll * available.length)] || available[0] || null;
  }

  function setWeapon(unit, weaponId) {
    const id = normalizeId(weaponId);
    if (!WEAPON_ARTS[id]) return null;
    const state = stateFor(unit, true);
    state.currentWeapon = id;
    state.skillsUsedWithCurrentWeapon = 0;
    mountWeaponDeck(unit, id);
    return id;
  }

  function resetEncounter(unit, rng = Math.random) {
    if (!unit || !isAgathaUnit(unit)) return null;
    const state = stateFor(unit, true);
    state.skillsUsedWithCurrentWeapon = 0;
    state.rotationCount = 0;
    return setWeapon(unit, chooseWeapon(null, rng));
  }

  function currentWeapon(unit) {
    return stateFor(unit, false)?.currentWeapon || null;
  }

  function recordWeaponSkillUse(unit, skill, rng = Math.random) {
    if (!unit || !isAgathaUnit(unit, skill) || !isAgathaSkill(skill)) return null;
    const state = stateFor(unit, true);
    if (!state.currentWeapon) resetEncounter(unit, rng);
    state.skillsUsedWithCurrentWeapon += 1;
    const weapon = WEAPON_ARTS[state.currentWeapon];
    if (state.skillsUsedWithCurrentWeapon < (weapon?.changeAfter || 2)) {
      return { changed: false, weapon: state.currentWeapon, used: state.skillsUsedWithCurrentWeapon };
    }
    const previous = state.currentWeapon;
    const next = chooseWeapon(previous, rng);
    setWeapon(unit, next);
    state.rotationCount += 1;
    return { changed: next !== previous, previousWeapon: previous, weapon: next, used: 0 };
  }

  function currentCoinIndex(context = {}) {
    const coin = context.currentCoin;
    if (Number.isInteger(Number(coin?.index))) return Number(coin.index);
    const coins = context.skill?.coins || [];
    const index = coins.indexOf(coin);
    return index >= 0 ? index : null;
  }

  function triggerTremorBurst(target, engine = global.CombatEngine) {
    const potency = statusPotency(target, "tremor");
    const count = statusCount(target, "tremor");
    if (!potency || !count) return { triggered: false, potency, count };
    if (typeof engine?.modifyNextStaggerThreshold === "function") engine.modifyNextStaggerThreshold(target, potency);
    reduceStatusCount(target, "tremor", 1);
    return { triggered: true, potency, countBefore: count, countAfter: statusCount(target, "tremor") };
  }

  function triggerBurn(target, engine = global.CombatEngine, skill = null) {
    const potency = statusPotency(target, "burn");
    const count = statusCount(target, "burn");
    if (!potency || !count) return { triggered: false, potency, count };
    if (typeof engine?.applyDamage === "function") engine.applyDamage(target, potency, "fijo", false, skill || {});
    else if (Number.isFinite(Number(target?.hp))) target.hp = Math.max(0, Number(target.hp) - potency);
    reduceStatusCount(target, "burn", 1);
    return { triggered: true, potency, countBefore: count, countAfter: statusCount(target, "burn") };
  }

  function setAttackWeight(skill, amount) {
    if (!skill || amount <= 1) return false;
    skill.attackWeight = amount;
    skill.atkWeight = amount;
    skill.targetingType = "AoE";
    skill.targeting_type = "AoE";
    return true;
  }

  function handleSkillTrigger(tag, context = {}, rng = Math.random) {
    const skill = context.skill || {};
    const id = skillId(skill);
    if (!ALL_SKILL_IDS.includes(id)) return null;
    const attacker = context.attacker || context.unitAttacker || null;
    const target = context.currentTarget || context.defender || null;
    const coinIndex = currentCoinIndex(context);
    const out = [];

    if (tag === "[On Use]" && attacker) {
      if (id === IDS.highTime) applyStatus(attacker, "poise", { potency: 3, sourceSkillId: id });
      if (id === IDS.propShredder) applyStatus(attacker, "poise", { potency: 3, sourceSkillId: id });
      if (id === IDS.roundTrip) applyStatus(attacker, "poise", { potency: 4, sourceSkillId: id });

      if (id === IDS.millionStab && consumeStatusPotency(attacker, "poise", 7)) setAttackWeight(skill, 2);
      if (id === IDS.drive && consumeStatusPotency(attacker, "poise", 10)) skill.__agathaFinalPowerBonus = numberOr(skill.__agathaFinalPowerBonus, 0) + 4;
      if (id === IDS.overdrive && consumeStatusPotency(attacker, "poise", 7)) setAttackWeight(skill, 3);
      if (id === IDS.rainStorm && consumeStatusPotency(attacker, "poise", 7)) setAttackWeight(skill, 3);

      out.push({ weaponRotation: recordWeaponSkillUse(attacker, skill, rng) });
    }

    if (tag === "[On Clash Win]") {
      if (attacker && [IDS.stinger, IDS.millionStab].includes(id)) applyStatus(attacker, "poise", { count: 3, sourceSkillId: id });
      if (attacker && id === IDS.drive) scheduleStatusNextTurn(attacker, "attack_power_up", { count: 1, sourceSkillId: id });
      if (target && id === IDS.chargedShot) applyStatus(target, "burn", { count: 2, sourceSkillId: id });
    }

    if (tag === "[On Hit]" && target) {
      if (id === IDS.highTime && coinIndex === 0) {
        if (attacker) applyStatus(attacker, "poise", { count: 2, sourceSkillId: id });
        scheduleStatusNextTurn(target, "bind", { count: 2, sourceSkillId: id });
      }
      if (id === IDS.propShredder && [0, 1, 2].includes(coinIndex)) applyStatus(target, "bleed", { potency: 1, sourceSkillId: id });
      if (id === IDS.helmBreaker && coinIndex === 0) applyStatus(target, "tremor", { count: 2, sourceSkillId: id });
      if (id === IDS.roundTrip && coinIndex === 0) applyStatus(target, "bleed", { count: 3, sourceSkillId: id });
      if (id === IDS.roundTrip && coinIndex === 1) {
        const amount = Math.min(3, Math.floor(statusPotency(target, "bleed") / 2));
        if (amount) applyStatus(target, "offense_level_down", { count: amount, sourceSkillId: id });
      }
      if (id === IDS.stinger && coinIndex === 0) {
        applyStatus(target, "bleed", { potency: 3, sourceSkillId: id });
        if (attacker) scheduleStatusNextTurn(attacker, "haste", { count: 2, sourceSkillId: id });
      }
      if (id === IDS.millionStab && attacker) {
        if (coinIndex === 0 || coinIndex === 1) {
          applyStatus(target, "bleed", { potency: 1, sourceSkillId: id });
          applyStatus(attacker, "poise", { potency: 1, sourceSkillId: id });
        }
        if (coinIndex === 2) {
          applyStatus(target, "bleed", { count: 1, sourceSkillId: id });
          applyStatus(attacker, "poise", { potency: 1, sourceSkillId: id });
        }
      }
      if (id === IDS.aerialRave && coinIndex === 3) applyStatus(target, "fragile", { count: 1, sourceSkillId: id });
      if (id === IDS.danceMacabre) {
        if (coinIndex === 0) applyStatus(target, "bleed", { potency: 3, sourceSkillId: id });
        if (coinIndex === 1 && attacker) applyStatus(attacker, "poise", { potency: 3, sourceSkillId: id });
        if (coinIndex === 2) applyStatus(target, "bleed", { count: 3, sourceSkillId: id });
        if (coinIndex === 3 && attacker) applyStatus(attacker, "poise", { count: 4, sourceSkillId: id });
      }
      if (id === IDS.overdrive) {
        if (coinIndex === 0) applyStatus(target, "bleed", { potency: 4, count: 2, sourceSkillId: id });
        if (coinIndex === 1) applyStatus(target, "offense_level_down", { count: 4, sourceSkillId: id });
      }

      if (id === IDS.twosomeTime) {
        if (coinIndex === 0 && consumeBullet(attacker, 1).ok) applyStatus(target, "burn", { potency: 1, sourceSkillId: id });
        if (coinIndex === 1 && consumeBullet(attacker, 1).ok) applyStatus(target, "burn", { count: 2, sourceSkillId: id });
      }
      if (id === IDS.chargedShot && coinIndex === 0) consumeBullet(attacker, 1);
      if (id === IDS.honeycombFire) {
        if (coinIndex === 0 && consumeBullet(attacker, 1).ok) applyStatus(target, "burn", { potency: 2, sourceSkillId: id });
        if (coinIndex === 1 && consumeBullet(attacker, 1).ok) applyStatus(target, "burn", { potency: 2, sourceSkillId: id });
        if (coinIndex === 2 && consumeBullet(attacker, 1).ok) applyStatus(target, "burn", { count: 2, sourceSkillId: id });
      }
      if (id === IDS.rainStorm && [0, 1, 2, 3].includes(coinIndex) && consumeBullet(attacker, 1).ok) {
        out.push({ burnTrigger: triggerBurn(target, context.engine || global.CombatEngine, skill) });
      }
    }

    if (tag === "[On Crit]" && target) {
      if (id === IDS.helmBreaker && coinIndex === 0 && typeof (context.engine || global.CombatEngine)?.modifyNextStaggerThreshold === "function") {
        (context.engine || global.CombatEngine).modifyNextStaggerThreshold(target, numberOr(context.damageDealt, 0) * 0.30);
      }
      if (id === IDS.rainStorm && [0, 1, 2, 3].includes(coinIndex)) {
        scheduleStatusNextTurn(target, "burn", { count: 1, sourceSkillId: id });
      }
    }

    if (tag === "[On Hit without Cracking]" && target) {
      if ([IDS.helmBreaker, IDS.chargedShot].includes(id)) out.push({ tremorBurst: triggerTremorBurst(target, context.engine || global.CombatEngine) });
    }

    return out.length ? out : null;
  }

  function damageMultiplier(attacker, defender, skill, isCritical, context = {}) {
    const id = skillId(skill);
    const coinIndex = currentCoinIndex(context);
    const bleed = statusPotency(defender, "bleed");
    const burn = statusPotency(defender, "burn");
    let bonus = 0;

    if (id === IDS.millionStab && coinIndex === 3) bonus += Math.min(25, Math.floor(bleed / 2) * 5);
    if (id === IDS.aerialRave && [0, 1, 2].includes(coinIndex)) bonus += 10;
    if (id === IDS.drive && coinIndex === 0) {
      bonus += 50;
      if (context.currentCoin?.type === "unbreakable" && context.currentCoin?.status === "active") bonus += 20;
    }
    if (id === IDS.danceMacabre && coinIndex === 4 && isCritical) bonus += 50;
    if (id === IDS.overdrive && coinIndex === 2) bonus += Math.min(100, bleed * 5);
    if (id === IDS.chargedShot && statusPotency(attacker, "poise") >= 5) bonus += 10;
    if (id === IDS.chargedShot && coinIndex === 0 && burn >= 5) bonus += 30;
    return 1 + (bonus / 100);
  }

  function install(engine = global.CombatEngine) {
    if (!engine || engine.__agathaPlayerSkillRuntime074) return Boolean(engine);

    const originalTriggerEvent = typeof engine.triggerEvent === "function" ? engine.triggerEvent : null;
    const originalTriggerEncounterStart = typeof engine.triggerEncounterStart === "function" ? engine.triggerEncounterStart : null;
    const originalResolveClash = typeof engine.resolveClash === "function" ? engine.resolveClash : null;
    const originalResolveUnilateral = typeof engine.resolveUnilateralWithCounter === "function" ? engine.resolveUnilateralWithCounter : null;
    const originalApplyPassiveModifiers = typeof engine.applyPassiveModifiers === "function" ? engine.applyPassiveModifiers : null;
    const originalCalculateFinalPower = typeof engine.calculateFinalPower === "function" ? engine.calculateFinalPower : null;
    const originalCalculateCoinDamage = typeof engine.calculateCoinDamage === "function" ? engine.calculateCoinDamage : null;

    if (originalTriggerEvent) {
      engine.triggerEvent = function (tag, context, targetsHit = []) {
        const result = originalTriggerEvent.call(this, tag, context, targetsHit);
        try { handleSkillTrigger(tag, context || {}); } catch (_) {}
        return result;
      };
    }

    if (originalTriggerEncounterStart) {
      engine.triggerEncounterStart = function (allUnits = []) {
        if (Array.isArray(allUnits)) allUnits.forEach((unit) => {
          if (isAgathaUnit(unit)) resetEncounter(unit);
        });
        return originalTriggerEncounterStart.apply(this, arguments);
      };
    }

    if (originalResolveClash) {
      engine.resolveClash = function (unitA, skillA, unitB, skillB) {
        return originalResolveClash.call(
          this,
          unitA, prepareSkill(unitA, unitB, skillA),
          unitB, prepareSkill(unitB, unitA, skillB),
        );
      };
    }

    if (originalResolveUnilateral) {
      engine.resolveUnilateralWithCounter = function (unitAttacker, attackSkill, unitDefender, counterSkill, options = {}) {
        const preparedAttack = prepareSkill(unitAttacker, unitDefender, attackSkill);
        const preparedCounter = counterSkill ? prepareSkill(unitDefender, unitAttacker, counterSkill) : counterSkill;
        return originalResolveUnilateral.call(this, unitAttacker, preparedAttack, unitDefender, preparedCounter, options);
      };
    }

    if (originalApplyPassiveModifiers) {
      engine.applyPassiveModifiers = function (unit, contextOptions = null) {
        const base = originalApplyPassiveModifiers.call(this, unit, contextOptions) || {};
        const skill = contextOptions?.skill;
        if (!skill || !isAgathaSkill(skill)) return base;
        return {
          ...base,
          clash_power: numberOr(base.clash_power, 0) + numberOr(skill.__agathaClashPowerBonus, 0),
          final_power: numberOr(base.final_power, 0) + numberOr(skill.__agathaFinalPowerBonus, 0),
          coin_power: numberOr(base.coin_power, 0) + numberOr(skill.__agathaCoinPowerBonus, 0),
        };
      };
    }

    if (originalCalculateFinalPower) {
      engine.calculateFinalPower = function (skill, headsFlipped, unit = null) {
        if (!unit || !isAgathaSkill(skill)) return originalCalculateFinalPower.call(this, skill, headsFlipped, unit);
        const power = dynamicPower(unit, skill, this);
        if (!power) return originalCalculateFinalPower.call(this, skill, headsFlipped, unit);
        const prepared = { ...skill, basePower: power.basePower, coinPower: power.coinPower };
        return originalCalculateFinalPower.call(this, prepared, headsFlipped, unit);
      };
    }

    if (originalCalculateCoinDamage) {
      engine.calculateCoinDamage = function (attacker, defender, skill, coinFinalPower, isCritical, clashCount, context = null) {
        const baseDamage = originalCalculateCoinDamage.call(this, attacker, defender, skill, coinFinalPower, isCritical, clashCount, context);
        const multiplier = damageMultiplier(attacker, defender, skill, isCritical, context || {});
        return Math.max(0, Math.floor(numberOr(baseDamage, 0) * multiplier));
      };
    }

    Object.defineProperty(engine, "__agathaPlayerSkillRuntime074", { value: true, configurable: true });
    return true;
  }

  const api = Object.freeze({
    version: VERSION,
    CHARACTER_ID,
    IDS,
    WEAPON_ARTS,
    ALL_SKILL_IDS,
    isAgathaSkill,
    isAgathaUnit,
    stateFor,
    weaponSkillDefinitions,
    statusPotency,
    statusCount,
    consumeStatusPotency,
    scheduleStatusNextTurn,
    consumeBullet,
    dynamicPower,
    chooseWeapon,
    setWeapon,
    resetEncounter,
    currentWeapon,
    recordWeaponSkillUse,
    mountWeaponDeck,
    evolveSkillForUnit,
    prepareSkill,
    triggerTremorBurst,
    triggerBurn,
    handleSkillTrigger,
    damageMultiplier,
    install,
  });

  global.LuminousAgathaPlayerSkillRuntime = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  install();
})(typeof window !== "undefined" ? window : globalThis);
