/* Local, incremental resolution. No DOM, clocks, Firebase or presentation RNG. */
(function (global) {
  'use strict';
  const VERSION = '0.7.3-steps.1', SCHEMA = 1;
  const copy = value => JSON.parse(JSON.stringify(value ?? null));
  function freeze(value) {
    if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
    return value;
  }
  function create({ rules: r, presentation = {}, context = () => ({}), snapshot = () => ({}), assertActive = () => {}, publish = async () => {}, onEvent = () => {}, onPresentation = () => {},
    schedulePresentation = () => null, presentScheduled = (_event, render) => render() }) {
    let enabled = true, capture = false, sequence = 0, journal = [];
    // A view failure cannot change rule ordering or interrupt the resolver.
    const notify = (callback, ...args) => { try { callback(...args); } catch (_) {} };
    const action = entry => ({ actionId: `${context().round}:${entry.ownerId}:${entry.localIndex ?? 0}`,
      ownerId: entry.ownerId, slotIndex: entry.localIndex ?? 0, targetId: entry.plan?.targetId ?? null });
    function emit(type, entry, detail = {}) {
      const event = freeze(copy({ schemaVersion: SCHEMA, engineVersion: VERSION, ...context(),
        sequence: ++sequence, type, ...(entry ? action(entry) : {}), ...detail }));
      journal.push(event);
      notify(onEvent, event);
      return event;
    }
    // Acting and targetability are distinct: Downed can be targeted but never acts.
    function canOwnerAct(ownerId) {
      const unit = r.unit(ownerId);
      if (!unit) return false;
      if (typeof r.canUnitAct === 'function') return Boolean(r.canUnitAct(unit));
      const life = String(unit.lifeState || unit.deploymentState || '').toLowerCase();
      if (unit.isDowned || unit.isDead || unit.dead || unit.isRetreated || unit.escaped ||
        ['downed', 'dead', 'defeated', 'retreated', 'escaped', 'backup'].includes(life)) return false;
      const hp = Number(unit.hp);
      return !Number.isFinite(hp) || hp > 0;
    }
    function cancelOwner(entry, coinIndex) {
      emit('ActionCancelled', entry, { reason: 'owner_unavailable', ...(coinIndex == null ? {} : { coinIndex }) });
    }
    function mutate(type, entry, detail, callback) {
      assertActive();
      const before = copy(snapshot()), result = callback(), after = copy(snapshot());
      const changes = Object.keys({ ...before, ...after }).sort().filter(id => JSON.stringify(before[id]) !== JSON.stringify(after[id]))
        .map(unitId => ({ unitId, before: before[unitId] ?? null, after: after[unitId] ?? null }));
      const event = emit(type, entry, { ...detail, result: result ?? null, changes });
      for (const change of changes) {
        const a = change.before || {}, b = change.after || {};
        if (a.hp !== b.hp) emit(Number(b.hp) < Number(a.hp) ? 'DamageApplied' : 'HealingApplied', entry,
          { causeSequence: event.sequence, unitId: change.unitId, before: a.hp, after: b.hp });
        if (JSON.stringify(a.statusEffects) !== JSON.stringify(b.statusEffects) || JSON.stringify(a.pendingStatusEffects) !== JSON.stringify(b.pendingStatusEffects))
          emit('StatusChanged', entry, { causeSequence: event.sequence, unitId: change.unitId,
            statusEffects: b.statusEffects || {}, pendingStatusEffects: b.pendingStatusEffects || [] });
        if (Number(b.staggerStage) > Number(a.staggerStage)) emit('UnitStaggered', entry, { causeSequence: event.sequence, unitId: change.unitId, stage: b.staggerStage });
        const wasDead = a.lifeState === 'dead' || a.isDead === true || a.dead === true;
        const dead = b.lifeState === 'dead' || b.isDead === true || b.dead === true;
        const downed = b.lifeState === 'downed' || b.isDowned === true;
        const wasDowned = a.lifeState === 'downed' || a.isDowned === true;
        if ((!wasDead && dead) || (Number(a.hp) > 0 && Number(b.hp) <= 0 && !downed))
          emit('UnitDefeated', entry, { causeSequence: event.sequence, unitId: change.unitId });
        else if (!wasDowned && downed && !dead)
          emit('UnitDowned', entry, { causeSequence: event.sequence, unitId: change.unitId });
      }
      return result;
    }
    // A presentation command contains domain values only. Queue entries carry
    // live element handles, so retain the plan/identity and rebuild handles locally.
    function presentationValue(value) {
      if (Array.isArray(value)) return value.map(presentationValue);
      if (value && typeof value === 'object') {
        if (value.ownerId && value.plan) return copy({ ownerId: value.ownerId, ownerName: value.ownerName,
          localIndex: value.localIndex ?? 0, controller: value.controller, plan: value.plan });
        return copy(value);
      }
      return value;
    }
    async function show(name, ...args) {
      assertActive();
      let event;
      if (capture) {
        const timing = schedulePresentation(name);
        event = emit('Presentation', null, { cue: name, args: args.map(presentationValue), combatants: snapshot(), ...(timing ? { timing } : {}) });
        // Enqueue the result before local animation. Transport acknowledgements
        // are drained at action checkpoints, outside the animation clock.
        await publish();
      }
      if (enabled) await presentScheduled(event, async () => {
        assertActive(); notify(onPresentation, name, args); await presentation[name]?.(...args);
      });
    }
    function powerState(entry, remaining, opponent) {
      const data = r.data(entry.plan), unit = r.unit(entry.ownerId), other = r.unit(opponent?.ownerId);
      const defenseType = global.LuminousClashableDefenses073?.defenseTypeOf(entry.plan?.data);
      const clashableDefense = global.LuminousClashableDefenses073?.isClashableDefensePlan(entry.plan);
      const power = Math.max(0, data.basePower + data.finalPowerBonus + (data.grappleCheck ? 0 :
        (clashableDefense
          ? r.clashableDefenseLevelPowerBonus(unit, other) + r.statusDefensePowerModifier(unit) +
            (defenseType === 'clashablecounter' ? r.conditionCounterPowerModifier(unit) : 0)
          : r.clashLevelPowerBonus(unit, other) + r.statusAttackPowerModifier(unit)) +
        r.statusClashPowerModifier(unit) + r.targetFinalPowerVulnerabilityBonus(other)));
      return { entry, remaining, data, power, coins: [] };
    }
    function toss(entry, index, { attackCoin = true, paralysis = false } = {}) {
      assertActive();
      // The rules roll and all toss effects commit before any renderer is called.
      const side = r.rollSide(r.coinHeadsChanceForUnit(entry.ownerId));
      let paralyzedHead = false;
      mutate('CoinRolled', entry, { coinIndex: index, side, attackCoin }, () => {
        if (attackCoin) r.triggerBleedOnCoinFlip(entry.ownerId);
        paralyzedHead = paralysis && side === 'head' && r.consumeParalysisOnHead(entry.ownerId);
        return { paralyzedHead: Boolean(paralyzedHead) };
      });
      return freeze({ index, side, src: r.coinSrc(side), paralyzedHead: Boolean(paralyzedHead) });
    }
    async function rollStates(states) {
      for (const state of states) await show('powerStart', state.entry, state.remaining, state.power);
      // Stable legacy timer order: A0, B0, A1, B1 ... even with unequal Coin counts.
      const cancelledOwners = new Set();
      for (let index = 0; index < Math.max(...states.map(s => s.remaining)); index++) {
        const frames = [];
        for (const state of states) {
          if (index >= state.remaining || cancelledOwners.has(state.entry.ownerId)) continue;
          if (!canOwnerAct(state.entry.ownerId)) {
            cancelOwner(state.entry, index); cancelledOwners.add(state.entry.ownerId); continue;
          }
          const coin = toss(state.entry, index, {
            attackCoin: !state.data.grappleCheck && !global.LuminousClashableDefenses073?.isClashableDefensePlan(state.entry.plan),
            paralysis: !state.data.grappleCheck
          });
          if (!canOwnerAct(state.entry.ownerId)) {
            cancelOwner(state.entry, index); cancelledOwners.add(state.entry.ownerId); continue;
          }
          if (coin.side === 'head' && !coin.paralyzedHead) state.power += state.data.coinPower;
          state.coins.push(coin);
          frames.push([state, coin]);
        }
        await Promise.all(frames.map(([state, coin]) => show('powerCoin', state.entry, coin, state.power, state.remaining)));
      }
      for (const state of states) await show('powerEnd', state.entry, state.remaining, state.power, state.coins);
      return states.map(state => ({ power: state.power, heads: state.coins.filter(c => c.side === 'head').length, coins: state.coins }));
    }
    async function rollPower(entry, remaining, opponent = null) { return (await rollStates([powerState(entry, remaining, opponent)]))[0]; }
    async function rollPair(a, countA, b, countB) { return rollStates([powerState(a, countA, b), powerState(b, countB, a)]); }
    async function hits(entry, targetId, remaining, { heal = false, mitigationPenalty = 0 } = {}) {
      const data = r.data(entry.plan), target = r.unit(targetId);
      if (!target || remaining <= 0) return 0;
      if (!canOwnerAct(entry.ownerId)) { cancelOwner(entry); return 0; }
      let power = Math.max(0, data.basePower + data.finalPowerBonus + (entry._counterReaction ?
        r.statusDefensePowerModifier(r.unit(entry.ownerId)) + r.conditionCounterPowerModifier(r.unit(entry.ownerId)) :
        r.statusAttackPowerModifier(r.unit(entry.ownerId))) + r.targetFinalPowerVulnerabilityBonus(target) - Math.max(0, Number(mitigationPenalty) || 0)), total = 0;
      const coins = [], first = Math.max(0, data.coinAmount - remaining);
      await show('hitsStart', entry, remaining);
      for (let index = 0; index < remaining; index++) {
        const coinIndex = first + index;
        if (!canOwnerAct(entry.ownerId)) { cancelOwner(entry, coinIndex); break; }
        if (!r.isUnitTargetable(r.unit(targetId))) {
          emit('ActionCancelled', entry, { reason: 'target_unavailable', coinIndex }); break;
        }
        await show('hitStart', entry, remaining, coinIndex, coins);
        if (!canOwnerAct(entry.ownerId)) { cancelOwner(entry, coinIndex); break; }
        // Legacy hit path consumes Paralysis after the toss; no rules run in the intervening animation.
        const coin = toss(entry, coinIndex, { paralysis: true });
        if (!canOwnerAct(entry.ownerId)) { cancelOwner(entry, coinIndex); break; }
        coins.push(coin);
        if (coin.side === 'head' && !coin.paralyzedHead) power += data.coinPower;
        const hit = Math.max(0, power);
        await show('hitCoin', entry, remaining, coinIndex, coins, hit);
        if (!canOwnerAct(entry.ownerId)) { cancelOwner(entry, coinIndex); break; }
        if (!heal) {
          const evade = await r.resolveEvadeAgainstCoin(targetId, hit, entry, { coinIndex, side: coin.side });
          if (!canOwnerAct(entry.ownerId)) { cancelOwner(entry, coinIndex); break; }
          if (evade?.evaded) { emit('HitEvaded', entry, { unitId: targetId, coinIndex, power: hit, evadePower: evade.power }); await show('wait', 'hitGap'); continue; }
        }
        // Damage is committed once here. Motion/impact callbacks only consume the result.
        const outcome = mutate('HitResolved', entry, { unitId: targetId, coinIndex, side: coin.side, power: hit, heal }, () => {
          if (heal) { r.healCombatant(targetId, hit); total += hit; return { healingPower: hit }; }
          const result = r.damageCombatant(targetId, hit, { damageType: data.damageType, attackerId: entry.ownerId, skillData: { ...(entry.plan?.data || {}), currentCoinIndex: coinIndex, __luminousDeathSaveSkillToken: action(entry).actionId } });
          total += Number(result?.finalDamage) || 0;
          r.triggerGettingHitStatuses(targetId, entry);
          if (result?.critical && canOwnerAct(entry.ownerId)) r.applySkillStatusEffects(entry, targetId, '[On Crit]', { coinIndex, side: coin.side, damageResult: result });
          if (entry.plan?.data?.tremorBurst && canOwnerAct(entry.ownerId)) r.triggerTremorBurst(targetId, entry.ownerId);
          if (canOwnerAct(entry.ownerId)) r.applySkillStatusEffects(entry, targetId, '[On Hit]', { coinIndex, side: coin.side });
          if (canOwnerAct(entry.ownerId)) r.applySkillStatusEffects(entry, targetId, coin.side === 'head' ? '[Heads Hit]' : '[Tails Hit]', { coinIndex, side: coin.side });
          return result;
        });
        if (!heal) await show('hitMotion', entry, targetId, outcome);
        else await show('healingMotion', entry, targetId, outcome);
        if (!heal && canOwnerAct(entry.ownerId)) await r.triggerCounterAfterHit(targetId, entry.ownerId, entry);
        if (!canOwnerAct(entry.ownerId)) { cancelOwner(entry, coinIndex); break; }
        await show('wait', 'hitGap');
      }
      await show('wait', 'totalHold');
      return total;
    }
    async function finishInterruptedClash(a, b, remainingA, remainingB) {
      const activeA = canOwnerAct(a.ownerId), activeB = canOwnerAct(b.ownerId);
      if (!activeA) cancelOwner(a);
      if (!activeB) cancelOwner(b);
      const survivor = activeA !== activeB ? (activeA ? a : b) : null;
      const fallen = survivor === a ? b : a;
      const remaining = survivor === a ? remainingA : survivor ? remainingB : 0;
      if (survivor) {
        const defenses = global.LuminousClashableDefenses073;
        // A Guard remains defensive when its opponent falls during a toss.
        const defensive = defenses?.defenseTypeOf(survivor.plan?.data);
        if (defensive === 'clashableguard') await guard(survivor);
        else {
          const targetId = r.isUnitTargetable(r.unit(fallen.ownerId)) ? fallen.ownerId :
            r.unopposedTargetId?.(survivor);
          if (targetId && r.isUnitTargetable(r.unit(targetId)))
            await hits(defensive === 'clashablecounter' ? { ...survivor, _counterReaction: true } : survivor, targetId, remaining);
          else emit('ActionCancelled', survivor, { reason: 'target_unavailable' });
        }
      }
      await show('clashEnd', a, b, survivor);
      emit('ActionFinished', a); emit('ActionFinished', b);
      return { winner: survivor, loser: survivor ? fallen : null, interrupted: true,
        cancelled: !survivor, reason: 'clash_actor_unavailable', spGain: 0, remaining };
    }
    async function clash(a, b) {
      if (!canOwnerAct(a.ownerId) || !canOwnerAct(b.ownerId)) {
        return finishInterruptedClash(a, b, r.data(a.plan).coinAmount, r.data(b.plan).coinAmount);
      }
      const da = r.data(a.plan), db = r.data(b.plan);
      mutate('ActionStarted', a, {}, () => { r.processConditionRemovalTrigger(a.ownerId, 'attack'); r.processConditionRemovalTrigger(b.ownerId, 'attack'); r.markEntryStarted(a); });
      mutate('ActionStarted', b, {}, () => { r.markEntryStarted(b); });
      emit('ClashStarted', a, { opponentActionId: action(b).actionId });
      let remainingA = da.coinAmount, remainingB = db.coinAmount, clashCount = 0, ties = 0, lastExchange = null;
      await show('clashStart', a, b, remainingA, remainingB);
      while (remainingA > 0 && remainingB > 0) {
        if (!canOwnerAct(a.ownerId) || !canOwnerAct(b.ownerId)) {
          return finishInterruptedClash(a, b, remainingA, remainingB);
        }
        clashCount++;
        await show('clashContact', a, b, clashCount);
        const [ra, rb] = await rollPair(a, remainingA, b, remainingB);
        if (!canOwnerAct(a.ownerId) || !canOwnerAct(b.ownerId)) {
          return finishInterruptedClash(a, b, remainingA, remainingB);
        }
        lastExchange = { a: ra.power, b: rb.power };
        const winner = ra.power === rb.power ? 'tie' : ra.power > rb.power ? 'a' : 'b';
        if (winner === 'a') remainingB--; else if (winner === 'b') remainingA--;
        emit('ClashRoundResolved', a, { opponentActionId: action(b).actionId, clashCount, powerA: ra.power, powerB: rb.power, winner, remainingA, remainingB });
        if (winner !== 'tie') emit('CoinBroken', winner === 'a' ? b : a, { clashCount, remaining: winner === 'a' ? remainingB : remainingA });
        await show('clashOutcome', a, b, winner, remainingA, remainingB, ra, rb);
        ties = winner === 'tie' ? ties + 1 : 0;
        // Equal fixed powers can never break a Coin. A finite stalemate
        // cancels both actions without inventing a winner, damage or SP gain.
        if (ties >= 20) {
          emit('ClashStalemate', a, { opponentActionId: action(b).actionId, clashCount, remainingA, remainingB });
          emit('ActionCancelled', a, { reason: 'clash_stalemate' });
          emit('ActionCancelled', b, { reason: 'clash_stalemate' });
          await show('clashEnd', a, b, null);
          emit('ActionFinished', a); emit('ActionFinished', b);
          return { winner: null, loser: null, stalemate: true, clashCount, spGain: 0, remaining: 0 };
        }
      }
      const winner = remainingA > 0 ? a : b, loser = winner === a ? b : a,
        remaining = winner === a ? remainingA : remainingB, spGain = 10 + clashCount;
      mutate('ClashFinished', winner, { loserId: loser.ownerId, clashCount, spGain }, () => {
        if (canOwnerAct(winner.ownerId)) r.applySkillStatusEffects(winner, loser.ownerId, '[Clash Win]', { clashCount });
        if (canOwnerAct(loser.ownerId)) r.applySkillStatusEffects(loser, winner.ownerId, '[Clash Lose]', { clashCount });
        if (canOwnerAct(winner.ownerId)) r.healCombatantSP(winner.ownerId, spGain);
      });
      const defenses = global.LuminousClashableDefenses073;
      const winningPower = winner === a ? lastExchange?.a : lastExchange?.b;
      const losingPower = loser === a ? lastExchange?.a : lastExchange?.b;
      const defenseResult = defenses?.resultForClash(winner.plan, loser.plan, losingPower, winningPower);
      if (canOwnerAct(winner.ownerId) && defenseResult?.guardWin && defenseResult.guardTremorPower > 0) {
        mutate('ClashableGuardTremorApplied', winner, {
          targetId: loser.ownerId, power: defenseResult.guardTremorPower
        }, () => r.raiseRemainingStaggerThresholdByDamage(loser.ownerId, defenseResult.guardTremorPower));
      }
      await show('clashDefeat', winner, loser);
      // Clashable Guard wins defensively, without dealing a normal attack.
      // When it loses, its last Clash Power mitigates every surviving attack Coin.
      // Clashable Counter wins as an attack with its surviving Coins.
      if (canOwnerAct(winner.ownerId) && defenseResult?.performHits !== false) {
        await hits(defenseResult?.counterWin ? { ...winner, _counterReaction: true } : winner, loser.ownerId, remaining, {
          heal: false, mitigationPenalty: defenseResult?.guardMitigation || 0
        });
      }
      await show('clashEnd', a, b, winner);
      emit('ActionFinished', a); emit('ActionFinished', b);
      return { winner, loser, clashCount, spGain, remaining };
    }
    async function guard(entry) {
      if (!canOwnerAct(entry.ownerId)) { cancelOwner(entry); return 0; }
      const data = entry.plan?.data || {}, unit = r.unit(entry.ownerId),
        base = Math.max(0, (Number(data.basePower) || 0) + (Number(entry.plan?._helpFinalPowerBonus) || 0) + r.statusDefensePowerModifier(unit));
      await show('powerStart', entry, 1, base);
      const coin = toss(entry, 0, { attackCoin: false });
      if (!canOwnerAct(entry.ownerId)) { cancelOwner(entry, 0); return 0; }
      const shield = Math.max(0, base + (coin.side === 'head' ? Number(data.coinPower) || 0 : 0));
      mutate('ShieldApplied', entry, { amount: shield }, () => r.addEphemeralShield(entry.ownerId, shield));
      await show('powerCoin', entry, coin, shield, 1); await show('powerEnd', entry, 1, shield, [coin]);
      await show('guardEnd', entry); return shield;
    }
    async function evade(defenderId, attackPower, attackerEntry, { coinIndex = 0, side = 'tail' } = {}) {
      const defender = r.unit(defenderId), state = defender?.reactiveDefense, armed = state?.turn === context().round ? state.evade : null;
      if (!armed?.active || !canOwnerAct(defenderId)) return { evaded: false, active: false };
      if (r.unitReactionBlocked(defender)) { r.disarmEvade(defenderId, { broken: true }); return { evaded: false, active: false, blocked: true }; }
      const entry = armed.entry, data = entry.plan?.data || {}, scaled = r.caveEvadePower?.(defender, entry.plan), base = Math.max(0, (Number(scaled?.basePower ?? data.basePower) || 0) +
        (Number(entry.plan?._helpFinalPowerBonus) || 0) + r.statusDefensePowerModifier(defender) + r.conditionEvasionPowerModifier(defender) + (r.caveEvadeBonus?.(defender, entry.plan) || 0));
      await show('powerStart', entry, 1, base);
      const coin = toss(entry, coinIndex, { attackCoin: false, paralysis: true });
      if (!canOwnerAct(defenderId)) { cancelOwner(entry, coinIndex); return { evaded: false, active: false }; }
      const power = Math.max(0, base + (coin.side === 'head' && !coin.paralyzedHead ? Number(scaled?.coinPower ?? data.coinPower) || 0 : 0)), evaded = Number(attackPower) <= power;
      mutate('EvadeResolved', entry, { coinIndex, power, evaded }, () => {
        if (evaded) r.applySkillStatusEffects(entry, attackerEntry?.ownerId, '[On Evade]', { coinIndex, side });
        else r.disarmEvade(defenderId, { broken: true });
      });
      await show('powerCoin', entry, coin, power, 1); await show('powerEnd', entry, 1, power, [coin]); await show('evadeEnd', entry, { evaded });
      return evaded ? { evaded: true, active: true, power, side: coin.side } : { evaded: false, active: false, broken: true, power, side: coin.side };
    }
    return Object.freeze({ version: VERSION, rollPower, rollPair, hits, clash, guard, evade, emit, mutate, show,
      beginRound() { sequence = 0; journal = []; emit('RoundSealed'); },
      // The transport reads many times per round. Never clone already sent
      // presentation snapshots again: every event has a contiguous sequence.
      events: (afterSequence = 0) => {
        const first = journal[0]?.sequence;
        if (first === undefined) return [];
        const start = Math.max(0, Math.trunc(Number(afterSequence) || 0) - first + 1);
        return copy(journal.slice(start));
      }, setPresentationEnabled(value) { enabled = Boolean(value); }, presentationEnabled: () => enabled,
      capturePresentation(value) { capture = Boolean(value); },
      async present(cue, args) { if (enabled) { notify(onPresentation, cue, args); await presentation[cue]?.(...args); } },
      acceptEvent(event) { journal.push(freeze(copy(event))); sequence = Math.max(sequence, event.sequence); notify(onEvent, event); },
      resetJournal(cursor = 0) { journal = []; sequence = Number(cursor) || 0; } });
  }
  global.LuminousCombatSteps = Object.freeze({ version: VERSION, schemaVersion: SCHEMA, create });
})(typeof window === 'undefined' ? globalThis : window);
