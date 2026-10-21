(function (global) {
  'use strict';
  if (global.LuminousNpcBelongings) return;
  const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));
  const norm = value => String(value ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  const number = (value, fallback = 0) => value != null && Number.isFinite(Number(value)) ? Number(value) : fallback;
  const quantity = item => Math.max(0, number(item?.quantity ?? item?.qty ?? item?.cantidad, 1));
  const rows = unit => Object.entries(unit.inventario_activo || {});
  const isPlayer = unit => unit.isPlayer === true || unit.canonicalScope === 'player' || unit.category === 'player';
  function score(unit, short, long) {
    for (const source of [unit.scores, unit.abilityScores, unit.stats, unit.attributes, unit.mechanics?.scores, unit]) {
      if (source?.[short] != null || source?.[long] != null) return number(source[short] ?? source[long]);
    }
    return 0;
  }
  function creatureType(unit) {
    const raw = unit.creatureType || unit.metadata?.creatureType || unit.creature_type;
    return norm(typeof raw === 'object' ? raw.id || raw.type : raw);
  }
  function species(unit) { return norm(unit.species || unit.libraryUnitId || unit.unitRef?.id || unit.id); }
  function canCarry(unit) {
    if (isPlayer(unit)) return false;
    const type = creatureType(unit), family = species(unit);
    if (['beast', 'animal', 'ooze', 'plant'].includes(type) || /^(wolf|dire_wolf|beast_|animal_)/.test(family)) return false;
    return ['humanoid', 'giant', 'fey', 'fiend', 'celestial'].includes(type) || /goblin|kobold/.test(family);
  }
  function randomFor(seed) {
    let value = 2166136261;
    for (const char of String(seed)) value = Math.imul(value ^ char.charCodeAt(0), 16777619);
    return () => { value += 0x6D2B79F5; let n = Math.imul(value ^ value >>> 15, 1 | value); n ^= n + Math.imul(n ^ n >>> 7, 61 | n); return ((n ^ n >>> 14) >>> 0) / 4294967296; };
  }
  function definition(id) {
    return global.LuminousHpHealingCatalog?.get?.(id)
      || global.LuminousCulinaryStaplesCatalog?.get?.(id)
      || global.LuminousItemInventoryRuntime?.resolveDefinition?.(id) || null;
  }
  function safeCommonItem(item) {
    if (!item || item.magical || item.isMagic || item.cursed || item.enchantment || item.enchantments || item.magic) return false;
    const tier = String(item.tier || 'I').toUpperCase();
    const price = number(item.priceAhn ?? item.standardUnitValueAhn ?? item.valueAhn ?? item.price, Infinity);
    return ['I', '1', 'COMMON'].includes(tier) && price <= 10000;
  }
  function initialize(unit, options = {}) {
    // Identity and the generated marker are persisted with the combatant. Reconnect,
    // reserve promotion and catalog hydration must never reroll or refill its bag.
    if (isPlayer(unit) || unit.npcBelongings?.version === 1) return unit;
    const result = clone(unit), allowed = canCarry(result);
    result.npcBelongings = { version: 1, generated: true, canCarry: allowed, naturalCreature: ['beast', 'animal', 'ooze', 'plant'].includes(creatureType(result)) || /^(wolf|dire_wolf|beast_|animal_)/.test(species(result)) };
    if (!allowed) {
      if (['beast', 'animal', 'ooze', 'plant'].includes(creatureType(result)) || /^(wolf|dire_wolf|beast_|animal_)/.test(species(result))) result.inventario_activo = {};
      else result.inventario_activo = clone(result.inventario_activo || {});
      result.carriedCurrency = { currencyId: 'ahn', amount: 0 };
      return result;
    }
    result.wealthProfile ||= { bandId: 'backstreets_very_poor', source: 'npc_belongings_default' };
    result.roleProfile ||= { roles: ['scavenger'], source: 'npc_belongings_default' };
    const inventory = global.LuminousItemInventoryRuntime;
    if (!inventory?.createItemInstance) throw Error('NPC_INVENTORY_RUNTIME_REQUIRED');
    const rng = options.random || randomFor(options.seed || result.combatId || result.id);
    const boss = /boss/.test(species(result)) || norm(result.rank) === 'boss';
    const pool = result.lootProfile?.carried?.length ? result.lootProfile.carried : [
      { itemId: 'water', chance: 0.35 },
      { itemId: 'recycled_protein', chance: 0.30 },
      { itemId: 'hp_generic_pocket_recovery_patch', chance: boss ? 0.30 : 0.15 },
    ];
    result.inventario_activo = clone(result.inventario_activo || {});
    pool.forEach((candidate, index) => {
      const id = candidate.itemId || candidate.definitionId || candidate.id;
      const item = definition(id);
      if (!safeCommonItem(item)) return;
      const chance = candidate.rarity === 'guaranteed' ? 1 : Math.max(0, Math.min(1, number(candidate.chance, 0.25)));
      if (rng() >= chance) return;
      const instanceId = `npc_item_${String(result.id).replace(/[^a-zA-Z0-9_-]/g, '_')}_${index}`;
      const created = inventory.createItemInstance(item, {
        instanceId, quantity: Math.max(1, Math.min(2, Math.trunc(number(candidate.quantity ?? candidate.min, 1)))),
        currentOwnerId: result.id, provenance: { sourceMethod: 'npc_encounter_belongings', sourceUnitId: result.libraryUnitId || result.id },
      });
      result.inventario_activo[instanceId] = { ...clone(item), ...created };
    });
    // A poor creature's cash is separate from equipment value. There is no
    // level multiplier that can turn a common Goblin into an endgame reward.
    const kobold = /kobold/.test(species(result));
    const profile = result.lootProfile?.currency;
    const cap = boss ? 4000 : kobold ? 700 : 1500;
    const min = Math.max(0, Math.min(cap, number(profile?.min, boss ? 100 : 0)));
    const max = Math.max(min, Math.min(cap, number(profile?.max, cap)));
    result.carriedCurrency = clone(result.carriedCurrency || {
      currencyId: profile?.currencyId || 'ahn', amount: rng() < 0.55 ? min + Math.floor(rng() * (max - min + 1)) : 0,
    });
    return result;
  }
  const active = unit => unit && number(unit.hp) > 0 && unit.battleActive !== false && !unit.isBackup && !unit.dead && !unit.defeated && !unit.escaped && !unit.removed && !unit.incapacitated;
  const side = unit => norm(unit.faction || unit.faccion || unit.category);
  function healingAmount(item, target) {
    const healing = item.runtime?.healing;
    if (!healing || item.runtime?.actionCost !== 'action') return 0;
    const max = Math.max(1, number(target.maxHp, 1));
    const amount = Math.floor(number(healing.flat) + max * number(healing.maxHpPercent) / 100);
    const cap = number(healing.capMaxHpPercent) > 0 ? Math.floor(max * number(healing.capMaxHpPercent) / 100) : amount;
    return Math.max(0, Math.min(max - number(target.hp), amount, cap));
  }
  function itemCandidates(actor, units = []) {
    if (isPlayer(actor) || !active(actor) || score(actor, 'int', 'intelligence') <= 5 || actor.confusionTurnMode === 'indiscriminate') return [];
    const wisdom = score(actor, 'wis', 'wisdom');
    const targets = [actor, ...(wisdom >= 10 ? units.filter(unit => unit.id !== actor.id && side(unit) === side(actor) && active(unit)) : [])];
    const candidates = [];
    for (const [key, item] of rows(actor)) {
      if (quantity(item) < 1 || !item.runtime?.healing) continue;
      for (const target of targets) {
        if (!active(target)) continue;
        const ratio = number(target.hp) / Math.max(1, number(target.maxHp, 1));
        if (ratio > (target.id === actor.id ? 0.65 : 0.55)) continue;
        const recovery = healingAmount(item, target);
        if (recovery <= 0) continue;
        const priority = (1 - ratio) * 100 + (target.id === actor.id ? 5 : Math.min(15, wisdom / 2));
        candidates.push({ item, instanceId: item.instanceId || key, target, recovery, priority });
      }
    }
    return candidates.sort((a, b) => b.priority - a.priority || a.instanceId.localeCompare(b.instanceId) || a.target.id.localeCompare(b.target.id));
  }
  function selectItemPlan(actor, units = []) {
    const choice = itemCandidates(actor, units)[0];
    if (!choice) return null;
    return { type: 'items', slotIndex: 0, sourceSlotIndex: 0, targetId: choice.target.id, targetSlotIndex: 0,
      data: { ...clone(choice.item), id: choice.instanceId, instanceId: choice.instanceId, kind: 'item', itemType: 'hp_healing', npcItem: true,
        targetSide: choice.target.id === actor.id ? 'self' : 'ally' }, aiReason: 'RECOVER_WITH_CARRIED_ITEM' };
  }
  function useItem(actor, item, target) {
    if (!active(actor) || score(actor, 'int', 'intelligence') <= 5) return { used: false, reason: 'npc_item_intelligence_required' };
    if (!active(target) || side(target) !== side(actor)) return { used: false, reason: 'npc_item_target_unavailable' };
    if (target.id !== actor.id && score(actor, 'wis', 'wisdom') < 10) return { used: false, reason: 'npc_item_ally_wisdom_required' };
    const owned = rows(actor).find(([key, row]) => (row.instanceId || key) === item.instanceId)?.[1];
    if (!owned || quantity(owned) < 1 || !owned.runtime?.healing) return { used: false, reason: 'npc_item_unavailable' };
    return global.LuminousItemRuntime?.useItem?.(actor, owned, { phase: 'combat', target, ignoreActionCost: true }) || { used: false, reason: 'item_runtime_unavailable' };
  }
  function aiSources(actor, options = {}) {
    // One descriptor per physical item: an ally target and a self target cannot
    // reserve the same dose twice in the GOAP beam search.
    const best = new Map();
    for (const choice of itemCandidates(actor, options.allies || options.units || [])) if (!best.has(choice.instanceId)) best.set(choice.instanceId, choice);
    return [...best.values()].map(choice => ({ sourceType: 'item', role: 'recover', targetId: choice.target.id,
      definition: { ...clone(choice.item), id: choice.instanceId, instanceId: choice.instanceId, npcItem: true },
      available: true, maxUsesPerTurn: 1,
      planningResources: [{ type: 'item', id: choice.instanceId, amount: 1, current: quantity(choice.item) }],
      estimate: { damage: 0, recovery: choice.recovery + choice.priority / 3, safety: choice.priority / 5, resourceCost: 1 },
      compileOptions: { allegiance: choice.target.id === actor.id ? 'self' : 'ally' },
    }));
  }
  global.LuminousNpcBelongings = Object.freeze({ initialize, canCarry, score, randomFor, itemCandidates, selectItemPlan, useItem, aiSources, safeCommonItem });
})(typeof window !== 'undefined' ? window : globalThis);
