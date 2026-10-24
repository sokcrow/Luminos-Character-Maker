(function (global) {
  'use strict';
  const unitKind = unit => {
    const id = String(unit?.libraryUnitId || unit?.canonicalUnitId ||
      unit?.definitionId || unit?.id || '').toLowerCase();
    if (id === 'sapphire_spiderling' || id.includes('sapphire_spiderling:')) return 'spiderling';
    if (id === 'sapphire_spider' || id.includes('sapphire_spider:')) return 'adult';
    if (unit?.metadata?.catalog === 'cave-sapphire-spider') {
      return String(unit?.name || '').toLowerCase().includes('spiderling') ? 'spiderling' : 'adult';
    }
    return null;
  };
  const count = (unit, id) => Math.max(0, Number(unit?.statusEffects?.[id]?.count ??
    unit?.statuses?.[id]?.count ?? 0) || 0);
  const potency = (unit, id) => Math.max(0, Number(unit?.statusEffects?.[id]?.potency ??
    unit?.statuses?.[id]?.potency ?? 0) || 0);
  const speed = unit => Math.max(1, Number(unit?.speed) || 1);
  function hasteOnTurnStart(unit, applyStatus) {
    const kind = unitKind(unit);
    if (!kind) return 0;
    const poisePotency = potency(unit, 'poise');
    const gained = kind === 'adult' ? Math.floor(poisePotency / 3) : Math.min(2, Math.floor(poisePotency / 4));
    if (gained > 0) applyStatus(unit.id, 'haste', { count: gained, sourceUnitId: unit.id });
    return gained;
  }
  function speedDamagePercent(attacker, target) {
    const kind = unitKind(attacker);
    if (!kind || !target) return 0;
    return Math.min(kind === 'adult' ? 20 : 10, Math.max(0, speed(attacker) - speed(target)) * 5);
  }
  function evadeBonus(unit, plan) {
    const id = String(plan?.data?.id || plan?.data?.sourceId || '');
    if (!unitKind(unit)) return 0;
    if (id === 'sapphire_spider_faceted_evasion') return Math.min(3, Math.floor(count(unit,'poise') / 3));
    if (id === 'sapphire_spiderling_skittering_evasion') return Math.min(2, Math.floor(count(unit,'poise') / 2));
    return 0;
  }
  function criticalDamageBonus(unit, target, skillData) {
    if (unitKind(unit) !== 'adult' || !target) return 0;
    return String(skillData?.id || '') === 'sapphire_spider_hunters_sting' &&
      Number(skillData?.currentCoinIndex) === 2 && count(target, 'restrained') > 0 ? 0.2 : 0;
  }
  function applyConditionalSkillEffects({entry,targetId,trigger,context={},units={},applyStatus,queueStatus}) {
    const id = String(entry?.plan?.data?.id || '');
    const coinIndex = Number(context.coinIndex);
    const self = units[entry?.ownerId], target = units[targetId];
    if (!self || !target || !unitKind(self)) return [];
    const effects = [];
    const selfStatus = (status, fields = {}) => { applyStatus(self.id,status,{...fields,sourceUnitId:self.id});effects.push({target:self.id,status,...fields}); };
    const targetStatus = (status,fields = {},next = false) => {
      (next ? queueStatus : applyStatus)(target.id,status,{...fields,sourceUnitId:self.id});
      effects.push({target:target.id,status,...fields, timing:next?'next_turn':'immediate'});
    };
    if (id === 'sapphire_spider_prismatic_slash' && trigger === '[On Hit]' && coinIndex === 2 && speed(self)>speed(target))
      selfStatus('poise',{count:2});
    if (id === 'sapphire_spider_crystal_thread' && trigger === '[On Crit]' && coinIndex === 1) {
      const applied = 1 + Number(speed(self)>speed(target)) + Number(count(target,'bind')>0);
      targetStatus('restrained',{count:applied});
    }
    if (id === 'sapphire_spider_hunters_sting') {
      if (trigger === '[On Hit]' && (coinIndex===1 || coinIndex===2) && count(target,'restrained')>0)
        targetStatus('fragile',{count:2},true);
      if (trigger === '[On Crit]' && coinIndex===2 && count(target,'restrained')>0)
        selfStatus('haste',{count:4});
    }
    return effects;
  }
  const api = Object.freeze({version:'1.0.0',unitKind,count,potency,speed,hasteOnTurnStart,
    speedDamagePercent,evadeBonus,criticalDamageBonus,applyConditionalSkillEffects});
  global.LuminousCaveSapphireSpiderRuntime = api;
  if (typeof module !== 'undefined' && module.exports) module.exports=api;
})(typeof window !== 'undefined' ? window : globalThis);
