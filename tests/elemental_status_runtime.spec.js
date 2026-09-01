const { test, expect } = require('@playwright/test');

function normalizeId(value) {
  return String(value ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');
}

function installBaseStatusEngine() {
  global.STATUS_REGISTRY = {
    burn: {
      name: 'Burn', type: 'negative', mode: 'double',
      rules: [{ trigger: 'on_round_end', cond_input: 1, cond_type: 'potency', operation: 'sub', aff_input: 1, affectation: 'hp', decay: 'sub_count_1' }],
    },
    paralyze: { name: 'Paralyze', type: 'negative', mode: 'single', rules: [] },
    sinking: { name: 'Sinking', type: 'negative', mode: 'double', rules: [] },
    tremor: { name: 'Tremor', type: 'negative', mode: 'double', rules: [] },
  };

  const engine = Object.freeze({
    ensureStore(unit) {
      if (!unit.statusEffects || typeof unit.statusEffects !== 'object') unit.statusEffects = {};
      return unit.statusEffects;
    },
    getDefinition(id) { return global.STATUS_REGISTRY[normalizeId(id)] || {}; },
    getStatus(unit, id) {
      const value = unit.statusEffects?.[normalizeId(id)];
      return value ? JSON.parse(JSON.stringify(value)) : null;
    },
    hasStatus(unit, id) { return Boolean(unit.statusEffects?.[normalizeId(id)]); },
    applyStatus(unit, id, input = {}) {
      const key = normalizeId(id);
      const store = this.ensureStore(unit);
      const definition = global.STATUS_REGISTRY[key] || {};
      const existing = store[key];
      const mode = normalizeId(input.mode || input.action || 'gain');
      let count = Math.max(0, Number(input.count ?? 1));
      let potency = Math.max(0, Number(input.potency ?? 0));
      let data = { ...(input.data || {}) };
      if (existing && mode !== 'set') {
        count += Number(existing.count || 0);
        potency += Number(existing.potency || 0);
        data = { ...(existing.data || {}), ...data };
      }
      if (definition.maxCount != null) count = Math.min(count, Number(definition.maxCount));
      const next = { id: key, name: definition.name || id, count, potency, data };
      store[key] = next;
      return next;
    },
    removeStatus(unit, id) {
      const key = normalizeId(id);
      const removed = Boolean(unit.statusEffects?.[key]);
      if (removed) delete unit.statusEffects[key];
      return { removed, protected: false, statusId: key };
    },
  });
  global.LuminousStatusEngine = engine;
}

function installCombatEngine() {
  global.CombatEngine = {
    currentState: 'PRE_COMBAT_PLANNING',
    modifyNextStaggerThreshold(unit, amount) { unit.staggerThresholds[0] += amount; },
    applyPassiveModifiers(unit) {
      const out = { speed: 0, defensive_level: 0, offensive_level: 0 };
      Object.entries(unit.statusEffects || {}).forEach(([id, instance]) => {
        const definition = global.STATUS_REGISTRY[id];
        (definition?.rules || []).forEach((rule) => {
          if (rule.trigger !== 'passive') return;
          const base = rule.cond_type === 'potency' ? Number(instance.potency || 0) : Number(instance.count || 0);
          const value = Math.floor(base / (rule.cond_input || 1)) * (rule.aff_input ?? 1);
          if (rule.operation === 'sub') out[rule.affectation] -= value;
          if (rule.operation === 'add') out[rule.affectation] += value;
        });
      });
      return out;
    },
    applyDamage(unit, damage) {
      let remaining = damage;
      if (unit.shield > 0) {
        const absorbed = Math.min(unit.shield, remaining);
        unit.shield -= absorbed;
        remaining -= absorbed;
      }
      unit.hp = Math.max(0, unit.hp - remaining);
      return { hp: unit.hp, shield: unit.shield };
    },
    triggerEncounterStart(allUnits = []) {
      this.currentState = 'COMBAT_ACTIVE';
      this.lastEncounterUnits = allUnits;
      return this.currentState;
    },
    triggerPhase() {},
    processStatusEffects(unit, trigger) {
      Object.entries(unit.statusEffects || {}).forEach(([id, instance]) => {
        const definition = global.STATUS_REGISTRY[id];
        (definition?.rules || []).forEach((rule) => {
          if (rule.trigger !== trigger) return;
          if (rule.affectation === 'hp' && rule.operation === 'sub') {
            const base = rule.cond_type === 'potency' ? Number(instance.potency || 0) : Number(instance.count || 0);
            this.applyDamage(unit, Math.floor(base / (rule.cond_input || 1)) * (rule.aff_input ?? 1), 'efecto_estado');
          }
          if (rule.decay === 'sub_count_1') instance.count -= 1;
        });
        if (instance?.count <= 0) delete unit.statusEffects[id];
      });
    },
  };
}

function loadRuntime() {
  delete global.LuminousElementalStatusRuntime;
  delete require.cache[require.resolve('../js/elemental-status-runtime.js')];
  return require('../js/elemental-status-runtime.js');
}

function loadCompatibility() {
  delete global.LuminousElementalStatusCompatibility;
  delete require.cache[require.resolve('../js/elemental-status-compat.js')];
  return require('../js/elemental-status-compat.js');
}

test.beforeEach(() => {
  installBaseStatusEngine();
  installCombatEngine();
});

test('element to Sin/status mapping is canonical', () => {
  const runtime = loadRuntime();
  expect(runtime.ELEMENT_TO_SIN).toMatchObject({
    fire: 'Wrath', cold: 'Gloom', lightning: 'Envy', acid: 'Gluttony', poison: 'Gluttony',
    necrotic: 'Gloom', radiant: 'Pride', psychic: 'Lust', thunder: 'Wrath', force: 'Sloth',
  });
  expect(runtime.ELEMENT_TO_STATUS.force).toBe('force');
});

test('Chill creates Frozen at 20, affects Speed, and Frozen drains HP directly', () => {
  const runtime = loadRuntime();
  const unit = { hp: 200, maxHp: 200, shield: 0, statusEffects: {}, staggerThresholds: [50] };
  global.LuminousStatusEngine.applyStatus(unit, 'chill', { count: 20 });

  expect(runtime.countOf(unit, 'frozen')).toBe(1);
  expect(unit.shield).toBe(120);
  expect(global.CombatEngine.applyPassiveModifiers(unit).speed).toBe(-10);

  global.CombatEngine.applyDamage(unit, 10, 'directo', false, { affinity: 'Wrath' });
  expect(runtime.countOf(unit, 'chill')).toBe(18);
  expect(unit.shield).toBe(100);

  runtime.onRoundStart(unit, { engine: global.CombatEngine });
  expect(unit.hp).toBe(190);
  expect(unit.shield).toBe(100);
});

test('Shock converts each 3 Count into Paralyze at turn start', () => {
  const runtime = loadRuntime();
  const unit = { hp: 100, maxHp: 100, shield: 0, statusEffects: {} };
  global.LuminousStatusEngine.applyStatus(unit, 'shock', { count: 7 });
  runtime.onRoundStart(unit, { engine: global.CombatEngine });
  expect(runtime.countOf(unit, 'paralyze')).toBe(2);
  expect(runtime.countOf(unit, 'shock')).toBe(1);
});

test('Corrosion caps at 10, lowers both Levels, damages by Max HP, then loses 1 Count', () => {
  const runtime = loadRuntime();
  const unit = { hp: 100, maxHp: 100, shield: 0, statusEffects: {} };
  global.LuminousStatusEngine.applyStatus(unit, 'corrosion', { count: 99 });
  expect(runtime.countOf(unit, 'corrosion')).toBe(10);
  const mods = global.CombatEngine.applyPassiveModifiers(unit);
  expect(mods.defensive_level).toBe(-5);
  expect(mods.offensive_level).toBe(-5);
  runtime.onRoundStart(unit, { engine: global.CombatEngine });
  expect(unit.hp).toBe(90);
  expect(runtime.countOf(unit, 'corrosion')).toBe(9);
});

test('Poison gains Potency, applies Poisoned at 10, and escalates x2 then x3', () => {
  const runtime = loadRuntime();
  const unit = { hp: 100, maxHp: 100, shield: 0, statusEffects: {} };
  global.LuminousStatusEngine.applyStatus(unit, 'poison', { count: 10, potency: 9 });
  runtime.onRoundEnd(unit, { engine: global.CombatEngine });
  expect(unit.hp).toBe(90);
  expect(runtime.countOf(unit, 'poison')).toBe(5);
  expect(runtime.potencyOf(unit, 'poison')).toBe(0);
  expect(runtime.countOf(unit, 'poisoned')).toBe(1);

  runtime.onRoundEnd(unit, { engine: global.CombatEngine });
  expect(unit.hp).toBe(80);

  unit.hp = 100;
  global.LuminousStatusEngine.applyStatus(unit, 'poison', { mode: 'set', count: 10, potency: 9, data: { damageMultiplier: 2 } });
  runtime.onRoundEnd(unit, { engine: global.CombatEngine });
  expect(unit.hp).toBe(80);
  expect(unit.statusEffects.poison.data.damageMultiplier).toBe(3);

  unit.hp = 100;
  runtime.onRoundEnd(unit, { engine: global.CombatEngine });
  expect(unit.hp).toBe(85);
});

test('Decay changes Max HP without healing current HP when Count is removed', () => {
  const runtime = loadRuntime();
  const unit = { hp: 100, maxHp: 100, shield: 0, statusEffects: {} };
  global.LuminousStatusEngine.applyStatus(unit, 'decay', { count: 40 });
  expect(unit.maxHp).toBe(60);
  expect(unit.hp).toBe(60);

  unit.hp = 50;
  runtime.onHealingReceived(unit);
  expect(runtime.countOf(unit, 'decay')).toBe(35);
  expect(unit.maxHp).toBe(65);
  expect(unit.hp).toBe(50);

  runtime.onRest(unit, 'short_rest');
  expect(runtime.countOf(unit, 'decay')).toBe(17);
  runtime.onRest(unit, 'long_rest');
  expect(runtime.countOf(unit, 'decay')).toBe(0);
  expect(unit.maxHp).toBe(100);
  expect(unit.hp).toBe(50);
});

test('Radiance adds fixed hit damage, doubles Shields, and rests reduce it', () => {
  const runtime = loadRuntime();
  const unit = { hp: 500, maxHp: 500, shield: 0, statusEffects: {} };
  global.LuminousStatusEngine.applyStatus(unit, 'radiance', { count: 10 });
  global.CombatEngine.applyDamage(unit, 200, 'directo', false, { affinity: 'Pride' });
  expect(unit.hp).toBe(290);

  unit.hp = 500;
  unit.shield = 100;
  global.CombatEngine.applyDamage(unit, 30, 'directo', false, { affinity: 'Pride' });
  expect(unit.shield).toBe(38);

  runtime.onEncounterEnd([unit]);
  expect(runtime.countOf(unit, 'radiance')).toBe(8);
  runtime.onRest(unit, 'short_rest');
  expect(runtime.countOf(unit, 'radiance')).toBe(3);
  runtime.onRest(unit, 'long_rest');
  expect(runtime.countOf(unit, 'radiance')).toBe(0);
});

test('Force raises Stagger Threshold by Count and immediately clears itself', () => {
  const runtime = loadRuntime();
  const unit = { hp: 100, maxHp: 100, statusEffects: {}, staggerThresholds: [50] };
  global.LuminousStatusEngine.applyStatus(unit, 'force', { count: 8 });
  expect(unit.staggerThresholds[0]).toBe(58);
  expect(runtime.countOf(unit, 'force')).toBe(0);
});

test('Burn keeps its base tick while reducing Chill and damaging Frozen Shield at x2', () => {
  const runtime = loadRuntime();
  const unit = { hp: 100, maxHp: 100, shield: 0, statusEffects: {}, staggerThresholds: [50] };
  global.LuminousStatusEngine.applyStatus(unit, 'chill', { count: 20 });
  unit.statusEffects.burn = { id: 'burn', name: 'Burn', count: 2, potency: 5, data: {} };
  const shieldBefore = unit.shield;

  global.CombatEngine.processStatusEffects(unit, 'on_round_end', {});

  expect(unit.shield).toBe(shieldBefore - 10);
  expect(runtime.countOf(unit, 'burn')).toBe(1);
  expect(runtime.countOf(unit, 'chill')).toBe(19);
});

test('compat bridge preserves protected statuses and detects encounter end', () => {
  const runtime = loadRuntime();
  const compat = loadCompatibility();
  const unit = {
    hp: 100,
    maxHp: 100,
    shield: 0,
    statusEffects: {},
    statusProtections: { radiance: { from: 'effects' } },
  };

  global.LuminousStatusEngine.applyStatus(unit, 'radiance', { count: 4 });
  const blocked = global.LuminousStatusEngine.removeStatus(unit, 'radiance', { from: 'effects' });
  expect(blocked.protected).toBe(true);
  expect(runtime.countOf(unit, 'radiance')).toBe(4);

  global.CombatEngine.triggerEncounterStart([unit]);
  expect(compat.state.units).toEqual([unit]);
  global.CombatEngine.currentState = 'PRE_COMBAT_PLANNING';
  compat.observeEncounterState();
  expect(runtime.countOf(unit, 'radiance')).toBe(2);
});
