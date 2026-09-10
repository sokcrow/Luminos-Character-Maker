(function (global) {
  'use strict';

  const normalizeId = (value) => String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
  const numberOr = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const intOr = (value, fallback = 0) => Number.isFinite(Number(value)) ? Math.trunc(Number(value)) : fallback;
  const asArray = (value) => value == null ? [] : (Array.isArray(value) ? value : [value]);

  function safeRequire(path) {
    if (typeof require !== 'function') return null;
    try { return require(path); } catch (_) { return null; }
  }

  const statusEngine = () => global.LuminousStatusEngine || safeRequire('./status-engine.js');
  const statusLibrary = () => global.LuminousStatusLibrary || safeRequire('./status-library.js');
  const itemRuntime = () => global.LuminousItemRuntime || safeRequire('./item-runtime-engine.js');
  const inventoryRuntime = () => global.LuminousItemInventoryRuntime || safeRequire('./item-inventory-runtime.js');
  const actionQueue = () => global.LuminousCombatActionQueue || safeRequire('./combat-action-queue.js');
  const actionEconomy = () => global.LuminousActionEconomy || safeRequire('./universal-action-economy.js');

  const AMMO = Object.freeze({
    pebbles: Object.freeze({ id: 'pebbles', name: 'Pebbles', icon: 'https://imgur.com/hhYbwsi.png', type: 'neutral', mode: 'single', description: 'Ammunition for ranged Skills.' }),
    rock: Object.freeze({ id: 'rock', name: 'Rock', icon: 'https://imgur.com/7rOv1S0.png', type: 'neutral', mode: 'single', maxCount: 1, description: 'Ammunition for ranged Skills.', metadata: Object.freeze({ projectileAsset: 'https://imgur.com/P4J48yc.png' }) }),
    arrows: Object.freeze({ id: 'arrows', name: 'Arrows', icon: 'https://imgur.com/ivdNbBA.png', type: 'neutral', mode: 'single', description: 'Ammunition for ranged Skills.', metadata: Object.freeze({ onHitStatusId: 'pierced' }) }),
    javelin: Object.freeze({ id: 'javelin', name: 'Javelin', icon: 'https://imgur.com/3wBN5qk.png', type: 'neutral', mode: 'single', description: 'Ammunition for ranged Skills.', metadata: Object.freeze({ onHitStatusId: 'pierced' }) }),
  });

  const PIERCED = Object.freeze({
    id: 'pierced',
    name: 'Pierced',
    icon: 'https://imgur.com/xyOtGec.png',
    type: 'negative',
    mode: 'single',
    description: 'Gain 1 Bind every 3 Count. Gain 1 Bleed Count every 4 Count. Use an Action to remove 3 Count.',
    metadata: Object.freeze({ bindEveryCount: 3, bleedCountEveryCount: 4, actionRemovalCount: 3 }),
  });

  function registerStatuses() {
    const library = statusLibrary();
    if (!library?.registerExtension) return false;
    Object.values(AMMO).forEach((definition) => library.registerExtension(definition.id, clone(definition)));
    library.registerExtension(PIERCED.id, clone(PIERCED));
    library.install?.();
    return true;
  }

  function statusCount(unit, statusId) {
    const entry = statusEngine()?.getStatus?.(unit, normalizeId(statusId));
    return Math.max(0, intOr(entry?.count, 0));
  }

  function setStatusCount(unit, statusId, amount, data = {}) {
    const id = normalizeId(statusId);
    const engine = statusEngine();
    const next = Math.max(0, intOr(amount, 0));
    if (!engine || !id) return 0;
    if (next <= 0) {
      engine.removeStatus?.(unit, id, { from: 'self', ignoreProtection: true });
      return 0;
    }
    engine.applyStatus?.(unit, id, { mode: 'set', count: next, potency: 0, data });
    return statusCount(unit, id);
  }

  function ammoDefinition(ammoId) { return AMMO[normalizeId(ammoId)] || null; }
  function ammoCount(unit, ammoId) { return statusCount(unit, ammoId); }

  function setAmmo(unit, ammoId, amount) {
    const id = normalizeId(ammoId);
    const definition = ammoDefinition(id);
    if (!definition) return 0;
    const cap = Number.isFinite(Number(definition.maxCount)) ? Number(definition.maxCount) : Number.POSITIVE_INFINITY;
    return setStatusCount(unit, id, Math.min(cap, Math.max(0, intOr(amount, 0))), { category: 'ammunition' });
  }

  function gainAmmo(unit, ammoId, amount = 1) {
    return setAmmo(unit, ammoId, ammoCount(unit, ammoId) + Math.max(0, intOr(amount, 0)));
  }

  function consumeAmmo(unit, ammoId, amount = 1) {
    const required = Math.max(1, intOr(amount, 1));
    const current = ammoCount(unit, ammoId);
    if (current < required) return { ok: false, current, required, remaining: current, reason: 'ammunition_unavailable' };
    const remaining = setAmmo(unit, ammoId, current - required);
    return { ok: true, current, required, remaining };
  }

  function skillRange(skill = {}) {
    const range = Number(skill.skillRange ?? skill.range ?? skill.metadata?.skillRange);
    return Number.isFinite(range) ? range : 1;
  }

  function sourceType(skill = {}) {
    return normalizeId(skill.sourceType || skill.metadata?.sourceType || skill.type);
  }

  function ammoCosts(skill = {}) {
    return asArray(skill.resourceCosts || skill.resources).filter((cost) => normalizeId(cost?.type || cost?.resourceType) === 'ammunition');
  }

  function isAmmoConsumingSkill(skill = {}, ammoId = null) {
    if (skillRange(skill) <= 1) return false;
    if (sourceType(skill) === 'spell' || normalizeId(skill.type) === 'spell') return false;
    const wanted = normalizeId(ammoId);
    const declared = normalizeId(skill.metadata?.ammoType || skill.ammoType || skill.ammunitionType);
    const costs = ammoCosts(skill).map((cost) => normalizeId(cost.id));
    if (!wanted) return Boolean(declared || costs.length);
    return declared === wanted || costs.includes(wanted);
  }

  function isRangedWeaponSkill(skill = {}) {
    if (skillRange(skill) <= 1) return false;
    if (sourceType(skill) === 'spell' || normalizeId(skill.type) === 'spell') return false;
    return skill.metadata?.weaponSkill === true || skill.weaponSkill === true || Boolean(skill.metadata?.weaponId || skill.weaponId);
  }

  function isMeleeSkill(skill = {}) { return skillRange(skill) <= 1; }

  function ammunitionHandler() {
    return {
      validate({ action, actor, resource }) {
        const skill = action?.metadata?.sourceDefinition || {};
        if (!isAmmoConsumingSkill(skill, resource?.id)) return { available: false, current: ammoCount(actor, resource?.id), required: Number(resource?.amount || 1), reason: 'ammunition_requires_ranged_skill' };
        const current = ammoCount(actor, resource?.id);
        const required = Math.max(1, Number(resource?.amount || 1));
        return { available: current >= required, current, required, reason: current >= required ? null : 'ammunition_unavailable' };
      },
      consume({ action, actor, resource }) {
        const skill = action?.metadata?.sourceDefinition || {};
        if (!isAmmoConsumingSkill(skill, resource?.id)) return { consumed: false, success: false, reason: 'ammunition_requires_ranged_skill' };
        const result = consumeAmmo(actor, resource.id, resource.amount);
        return { ...result, consumed: result.ok === true, success: result.ok === true };
      },
    };
  }

  function withAmmoResourceHandler(context = {}) {
    return { ...context, resourceHandlers: { ...(context.resourceHandlers || {}), ammunition: context.resourceHandlers?.ammunition || ammunitionHandler() } };
  }

  function ammoLoadout(unit = {}) {
    const raw = unit?.mechanics?.ammoLoadout || unit?.ammoLoadout || [];
    return asArray(raw).map((row) => ({
      id: normalizeId(row?.id || row?.ammoId || row?.type),
      amount: Math.max(0, intOr(row?.amount ?? row?.encounterStart, 0)),
      inventoryItemId: row?.inventoryItemId || row?.itemId || null,
    })).filter((row) => row.id && row.amount > 0);
  }

  function isPlayer(unit = {}) {
    return unit.isPlayer === true || normalizeId(unit.actorCategory) === 'player' || normalizeId(unit.unitType) === 'player';
  }

  function inventoryAmmoStacks(unit, ammoId) {
    const runtime = itemRuntime();
    const inventory = inventoryRuntime();
    if (!runtime || !inventory?.inventorySnapshot) return [];
    const wanted = normalizeId(ammoId);
    const snapshot = inventory.inventorySnapshot(unit, { hydrate: false });
    return [...(snapshot.active || []), ...(snapshot.stash || [])]
      .map((entry) => entry.item)
      .filter(Boolean)
      .filter((item) => {
        const resourceId = normalizeId(runtime.ammoResourceId?.(item));
        const definitionId = normalizeId(runtime.definitionId?.(item));
        return resourceId === wanted || definitionId === wanted || definitionId === `ammo_${wanted}`;
      });
  }

  function withdrawPlayerAmmo(unit, row) {
    const runtime = itemRuntime();
    if (!runtime?.consumeQuantity) return { withdrawn: 0, requested: row.amount, reason: 'item_runtime_unavailable' };
    let remaining = row.amount;
    let withdrawn = 0;
    const stacks = row.inventoryItemId ? [runtime.findItem?.(unit, row.inventoryItemId)].filter(Boolean) : inventoryAmmoStacks(unit, row.id);
    for (const item of stacks) {
      if (remaining <= 0) break;
      const available = Math.max(0, intOr(runtime.quantityOf?.(item), 0));
      const take = Math.min(remaining, available);
      if (!take) continue;
      const result = runtime.consumeQuantity(item, take);
      if (result?.consumed !== true) continue;
      withdrawn += take;
      remaining -= take;
    }
    return { withdrawn, requested: row.amount, remaining };
  }

  function onEncounterStart(unit) {
    registerStatuses();
    const applied = [];
    for (const row of ammoLoadout(unit)) {
      const granted = isPlayer(unit) ? withdrawPlayerAmmo(unit, row).withdrawn : row.amount;
      const total = gainAmmo(unit, row.id, granted);
      applied.push({ id: row.id, requested: row.amount, granted, total, fromInventory: isPlayer(unit) });
    }
    return applied;
  }

  function grantLifecycleAmmo(unit, trigger) {
    const grants = asArray(unit?.mechanics?.unitLifecycle?.[trigger]?.grantAmmunition);
    return grants.map((grant) => ({ id: normalizeId(grant?.id), amount: Math.max(0, intOr(grant?.amount, 1)), total: gainAmmo(unit, grant?.id, grant?.amount) }));
  }

  function onComeback(unit) { return grantLifecycleAmmo(unit, 'onComeback'); }

  function applyPierced(unit, amount = 1, options = {}) {
    const add = Math.max(0, intOr(amount, 0));
    const before = statusCount(unit, 'pierced');
    const after = before + add;
    setStatusCount(unit, 'pierced', after, { sourceUnitId: options.sourceUnitId || null });
    const bindGain = Math.max(0, Math.floor(after / 3) - Math.floor(before / 3));
    const bleedCountGain = Math.max(0, Math.floor(after / 4) - Math.floor(before / 4));
    if (bindGain) statusEngine()?.applyStatus?.(unit, 'bind', { mode: 'gain', count: bindGain, potency: 0, sourceUnitId: options.sourceUnitId || null });
    if (bleedCountGain) statusEngine()?.applyStatus?.(unit, 'bleed', { mode: 'gain', count: bleedCountGain, potency: 0, sourceUnitId: options.sourceUnitId || null });
    return { before, after: statusCount(unit, 'pierced'), bindGain, bleedCountGain };
  }

  function removePiercedCount(unit, amount = 3) {
    const before = statusCount(unit, 'pierced');
    const removed = Math.min(before, Math.max(0, intOr(amount, 3)));
    const after = setStatusCount(unit, 'pierced', before - removed);
    return { before, after, removed };
  }

  function scheduleRemovePierced(unit, options = {}) {
    if (statusCount(unit, 'pierced') <= 0) return { scheduled: false, reason: 'pierced_not_present' };
    const economy = actionEconomy();
    if (!economy?.scheduleAction) return { scheduled: false, reason: 'action_economy_unavailable' };
    return economy.scheduleAction(unit, { kind: 'status_action', sourceId: 'remove_pierced', data: { statusId: 'pierced', removeCount: 3 } }, options);
  }

  function installPiercedActionBridge() {
    const engine = global.CombatEngine;
    if (!engine || engine.__universalPiercedActionBridge || typeof engine.resolveActionSlot !== 'function') return Boolean(engine?.__universalPiercedActionBridge);
    const original = engine.resolveActionSlot;
    engine.resolveActionSlot = function (unit, slotIndex, context = {}) {
      const planned = context.plannedAction || null;
      if (normalizeId(planned?.kind) === 'status_action' && normalizeId(planned?.sourceId) === 'remove_pierced') {
        return { handled: true, planned, result: { resolved: true, action: 'remove_pierced', ...removePiercedCount(unit, 3) } };
      }
      return original.call(this, unit, slotIndex, context);
    };
    Object.defineProperty(engine, '__universalPiercedActionBridge', { value: true, configurable: true });
    return true;
  }

  function unitById(context = {}, id) {
    const wanted = String(id ?? '');
    const units = asArray(context.units || Object.values(context.combatData || {}));
    return units.find((unit) => String(unit?.id ?? unit?.unitId ?? unit?.characterId ?? '') === wanted) || null;
  }

  function actionSpeed(action = {}, context = {}) {
    const roundOrder = context.roundOrder || context.combatRoundOrder || context.queueState;
    const entry = roundOrder?.getEntry?.(action.id) || asArray(roundOrder?.entries).find((row) => String(row?.actionId || row?.action?.id || '') === String(action.id || ''));
    if (Number.isFinite(Number(entry?.speed))) return Number(entry.speed);
    const direct = [action.metadata?.resolvedSpeed, action.metadata?.actionSpeed, action.metadata?.speed].map(Number).find(Number.isFinite);
    if (direct != null) return direct;
    const unit = unitById(context, action.actorId);
    return actionQueue()?.resolveRoundSpeed?.(unit || {}, action) ?? 0;
  }

  function sourceDefinition(action = {}) { return action?.metadata?.sourceDefinition || {}; }

  function markRangedClashBonus(action, amount) {
    if (!action.metadata) action.metadata = {};
    if (!action.metadata.sourceDefinition) action.metadata.sourceDefinition = {};
    const skill = action.metadata.sourceDefinition;
    if (amount > 0) skill.__universalRangedWeaponClashPowerBonus = amount;
    else delete skill.__universalRangedWeaponClashPowerBonus;
    return action;
  }

  function prepareClashActions(actionA, actionB, context = {}) {
    const a = clone(actionA);
    const b = clone(actionB);
    const skillA = sourceDefinition(a);
    const skillB = sourceDefinition(b);
    const speedA = actionSpeed(a, context);
    const speedB = actionSpeed(b, context);
    markRangedClashBonus(a, isRangedWeaponSkill(skillA) && isMeleeSkill(skillB) && speedA > speedB ? 2 : 0);
    markRangedClashBonus(b, isRangedWeaponSkill(skillB) && isMeleeSkill(skillA) && speedB > speedA ? 2 : 0);
    return { actionA: a, actionB: b, speedA, speedB };
  }

  function installEngineClashBridge() {
    const engine = global.CombatEngine;
    if (!engine || engine.__universalRangedWeaponClashBridge || typeof engine.applyPassiveModifiers !== 'function') return Boolean(engine?.__universalRangedWeaponClashBridge);
    const original = engine.applyPassiveModifiers;
    engine.applyPassiveModifiers = function (unit, contextOptions = null) {
      const result = original.call(this, unit, contextOptions) || {};
      const bonus = Number(contextOptions?.skill?.__universalRangedWeaponClashPowerBonus || 0);
      if (Number.isFinite(bonus) && bonus) result.clash_power = Number(result.clash_power || 0) + bonus;
      return result;
    };
    Object.defineProperty(engine, '__universalRangedWeaponClashBridge', { value: true, configurable: true });
    return true;
  }

  function installResolverBridge() {
    const base = global.LuminousCombatActionResolver;
    if (!base || base.__universalRangedAmmoInstalled || typeof base.resolveCombatAction !== 'function') return Boolean(base?.__universalRangedAmmoInstalled);
    const wrapped = function (input = {}, rawContext = {}) {
      const context = withAmmoResourceHandler(rawContext);
      let action = clone(input);
      if (normalizeId(action?.resolution?.type) === 'clash' && context.opposingAction) {
        const prepared = prepareClashActions(action, context.opposingAction, context);
        action = prepared.actionA;
        context.opposingAction = prepared.actionB;
      }
      return base.resolveCombatAction(action, context);
    };
    global.LuminousCombatActionResolver = Object.freeze({ ...base, __universalRangedAmmoInstalled: true, withAmmoResourceHandler, resolveCombatAction: wrapped });
    return true;
  }

  function createAmmoTrait(ammoId, amount) {
    const id = normalizeId(ammoId);
    return {
      id: `ammo_${id}`,
      name: `Ammo — ${ammoDefinition(id)?.name || id}`,
      type: 'passive',
      source: { type: 'special', id: 'universal_ammo' },
      description: `[On Encounter Start] Gain ${Math.max(0, intOr(amount, 0))} ${ammoDefinition(id)?.name || id}.`,
      mechanics: { ammoId: id, encounterStart: Math.max(0, intOr(amount, 0)), statusMode: 'single', rangedSkillsOnly: true },
    };
  }

  function install() {
    registerStatuses();
    installEngineClashBridge();
    installResolverBridge();
    installPiercedActionBridge();
    return true;
  }

  const api = Object.freeze({
    version: '1.0.0', AMMO, PIERCED, registerStatuses, statusCount, ammoCount, setAmmo, gainAmmo, consumeAmmo,
    skillRange, isAmmoConsumingSkill, isRangedWeaponSkill, isMeleeSkill, ammunitionHandler, withAmmoResourceHandler,
    ammoLoadout, withdrawPlayerAmmo, onEncounterStart, onComeback, applyPierced, removePiercedCount, scheduleRemovePierced,
    actionSpeed, prepareClashActions, createAmmoTrait, installEngineClashBridge, installResolverBridge, installPiercedActionBridge, install,
  });

  global.LuminousUniversalRangedAmmoRuntime = api;
  install();
  if (global.document) {
    global.setTimeout?.(install, 0);
    global.setTimeout?.(install, 800);
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
