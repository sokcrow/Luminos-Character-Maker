import fs from 'node:fs';
import vm from 'node:vm';
export const source = fs.readFileSync(new URL('../../combat/source/combat-v073-live.html', import.meta.url), 'utf8');
const legacy = JSON.parse(fs.readFileSync(new URL('combat-phase1-legacy.json', import.meta.url), 'utf8'));
export function functionSource(name, text = source) {
  const start = text.search(new RegExp('^(?:async )?function ' + name + '\\(', 'm'));
  if (start < 0) throw new Error(`Missing live function: ${name}`);
  const eol = text.indexOf('\n', start), first = text.slice(start, eol);
  return first.endsWith('}') ? first : text.slice(start, text.indexOf('\n}', eol) + 2);
}
const noop = () => {};
export function harness({ old = false, enabled = true, seed = 42, values, units = {} } = {}) {
  const data = structuredClone(units), trace = [], randoms = [];
  let cursor = 0, randomState = seed, frames = 0;
  const random = () => {
    randomState = (randomState + 0x6D2B79F5) >>> 0;
    let t = randomState; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    const value = values?.[cursor] ?? ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    randoms.push(value); cursor++; return value;
  };
  const node = { style: {}, classList: { add: noop, remove: noop, toggle: noop }, querySelector() { return node; },
    querySelectorAll: () => [], getBoundingClientRect: () => ({}), remove: noop, appendChild: noop };
  const sandbox = { console, Math: Object.assign(Object.create(Math), { random }), combatData: data, round: 1,
    PLAYER_ID: 'none', plannedActions: [], timelineResolutionActive: true, COMBAT_PACE: {}, TEST_COMBAT_LEVEL: 1,
    SAVE_COIN_COUNT:5,SAVE_COIN_POWER:4,activeGrapples: [], AUTO_UNIT_IDS: [], UNIT_KITS: {}, setTimeout: () => 0, clearTimeout: noop,
    document: { querySelectorAll: () => [], getElementById: () => null }, $: () => null };
  sandbox.window = sandbox;
  const context = vm.createContext(sandbox);
  // Compile real shipped rule helpers without running the demo initialization.
  for (const match of source.matchAll(/^(?:async )?function (\w+)\(/gm)) vm.runInContext(functionSource(match[1]), context);
  vm.runInContext(source.slice(source.indexOf('const SAVE_ABILITY_ALIASES='),source.indexOf('function normalizeSaveAbility')),context);
  const registry = source.slice(source.indexOf('const STATUS_CORE_REGISTRY='), source.indexOf('const MAGIC_ELEMENT_RULES='));
  vm.runInContext(registry, context);
  vm.runInContext(source.slice(source.indexOf('const STAGGER_LEVELS='), source.indexOf('function isStaggerEffectActive')), context);
  sandbox.CONDITION_IDS = new Set(['paralyzed','petrified','incapacitated','prone','sleep']);
  sandbox.COLD_FREEZE_THRESHOLDS = { medium: 20 };
  sandbox.sinInfo = () => ({ color: '#555' });
  sandbox.unitSlots = sandbox.playerSlots = () => [];
  sandbox.setStatus = noop;
  // Rendering-only adapters. HP, SP, damage, resistance, status and Stagger helpers stay real.
  for (const name of ['renderStatusEffects','pulseStatusIcon','syncConditionVisuals','syncUnitActionState','syncUnitVisibility',
    'syncCombatantVitalNumber','renderCombatantShield','showFloatingDamage','showFloatingRecovery','removeStaggerThresholdVisual',
    'showStaggerText','showThresholdConsumedText','applyStaggerGlassStage','renderTargetArrows','renderAllPlannedSlots',
    'moveEntryForAction','setFloatingPowerCoinState','setFloatingCoinDetail','setFloatingClashResult','moveClashUnitsToMidpoint','showClashCount',
    'closeFloatingClashHud','hideClashCount','settleClashUnits','clearSlotUnknown']) sandbox[name] = noop;
  sandbox.setFloatingClashHud = () => node;
  sandbox.prepareFloatingClashRoll = sandbox.renderFloatingClashCoins = () => node;
  sandbox.coinResultMarkup = () => '';
  for (const name of ['animateHitMotion','animateClashContact','animateClashOutcome','animateClashDefeat','wait']) sandbox[name] = async () => { await Promise.resolve(); };
  sandbox.LuminousCoinEngine = { coinSrc: side => side,
    rollSide: chance => { const value = random(), side = value * 100 < chance ? 'head' : 'tail'; trace.push(['roll', side]); return side; } };
  sandbox.animateSkillCoinRoll = async (id, count, container, callback, { attackCoin = true } = {}) => {
    const coins = [];
    for (let index = 0; index < count; index++) {
      await Promise.resolve();
      const side = sandbox.LuminousCoinEngine.rollSide(sandbox.coinHeadsChanceForUnit(id)), src = side;
      if (attackCoin) sandbox.triggerBleedOnCoinFlip(id);
      const coin = { index, side, src }; coins.push(coin); callback?.(coin);
    }
    return { coins, heads: coins.filter(c => c.side === 'head').length };
  };
  const names = ['coinHeadsChanceForUnit','clashLevelPowerBonus','statusAttackPowerModifier','statusClashPowerModifier',
    'targetFinalPowerVulnerabilityBonus','statusDefensePowerModifier','conditionCounterPowerModifier','conditionEvasionPowerModifier',
    'triggerBleedOnCoinFlip','consumeParalysisOnHead','isUnitTargetable','damageCombatant','healCombatant','triggerGettingHitStatuses',
    'applySkillStatusEffects','triggerTremorBurst','triggerCounterAfterHit','resolveEvadeAgainstCoin','processConditionRemovalTrigger',
    'markEntryStarted','healCombatantSP','addEphemeralShield','unitReactionBlocked','disarmEvade'];
  for (const name of ['triggerBleedOnCoinFlip','consumeParalysisOnHead','damageCombatant','healCombatant','applySkillStatusEffects','addEphemeralShield']) {
    const original = sandbox[name];
    sandbox[name] = (...args) => {
      const result = original(...args);
      trace.push([name, typeof args[0] === 'object' ? args[0].ownerId : args[0],
        name === 'applySkillStatusEffects' ? args[2] : args[1] ?? null]);
      return result;
    };
  }
  const snapshot = () => JSON.parse(JSON.stringify(data, (key, value) => key.startsWith('_') || key === 'reactiveDefense' ? undefined : value));
  vm.runInContext(fs.readFileSync(new URL('../../js/combat-v073-steps.js', import.meta.url), 'utf8'), context);
  const rules = { data: sandbox.clashData, unit: id => data[id], rollSide: sandbox.LuminousCoinEngine.rollSide, coinSrc: side => side };
  names.forEach(name => rules[name] = (...args) => sandbox[name](...args));
  const presentation = new Proxy({}, { get: () => async () => { frames++; await Promise.resolve(); } });
  const steps = sandbox.LuminousCombatSteps.create({ rules, presentation, context: () => ({ round: 1, seed, rngCursor: cursor }), snapshot });
  steps.setPresentationEnabled(enabled); steps.beginRound(); sandbox.combatStepRuntime = () => steps;
  if (old) for (const code of Object.values(legacy.functions)) vm.runInContext(code, context);
  return { sandbox, steps, data, trace, randoms, snapshot, cursor: () => cursor, frames: () => frames };
}
export const unit = (id, extra = {}) => ({ id, name: id, hp: 100, maxHp: 100, sp: 0, battleActive: true,
  statusEffects: {}, pendingStatusEffects: [], staggerThresholds: [], actionSlots: 1, level: 1, ...extra });
export const entry = (ownerId, targetId, data = {}) => ({ ownerId, localIndex: 0, controller: 'remote', slot: { classList: { add: noop, remove: noop } },
  plan: { type: 'auto', targetId, data: { name: 'Strike', basePower: 5, coinPower: 3, coinAmount: 3, damageType: 'Slash', ...data } } });
