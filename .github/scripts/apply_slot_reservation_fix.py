from pathlib import Path

def rep(text, old, new, label):
    if old not in text: raise SystemExit('missing '+label)
    return text.replace(old,new,1)

p=Path('js/universal-action-economy.js')
t=p.read_text(encoding='utf-8')
t=rep(t,'''  function snapshot(unit = {}, options = {}) {
    const state = ensureState(unit);
    const phase = phaseFor(options);
    if (!state) return { phase, action: 0, quick_action: 0, reaction: 0, actionSlots: 0, plannedActions: {} };
    state.phase = phase;
    const max = actionSlotMaximum(unit);
    const planned = Object.keys(state.plannedActions || {}).length;
    return {
      phase,
      action: phase === PHASES.PLANNING ? Math.max(0, max - planned) : 0,''','''  function reservedSlotIndexes(options = {}, max = Number.POSITIVE_INFINITY) {
    const raw = options.reservedSlotIndexes ?? options.reservedSlots ?? [];
    const values = raw instanceof Set ? [...raw] : (Array.isArray(raw) ? raw : Object.keys(raw || {}).filter((key) => raw[key]));
    return new Set(values.map((value) => Number(value)).filter((value) => Number.isInteger(value) && value >= 0 && value < max));
  }

  function snapshot(unit = {}, options = {}) {
    const state = ensureState(unit);
    const phase = phaseFor(options);
    if (!state) return { phase, action: 0, quick_action: 0, reaction: 0, actionSlots: 0, plannedActions: {} };
    state.phase = phase;
    const max = actionSlotMaximum(unit);
    const occupied = new Set(Object.keys(state.plannedActions || {}).map(Number));
    reservedSlotIndexes(options, max).forEach((index) => occupied.add(index));
    return {
      phase,
      action: phase === PHASES.PLANNING ? Math.max(0, max - occupied.size) : 0,''','snapshot')
t=rep(t,'''    if (slotIndex == null) {
      slotIndex = Array.from({ length: max }, (_, index) => index).find((index) => !Object.prototype.hasOwnProperty.call(state.plannedActions, index));
    }
    if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex >= max) return { scheduled: false, reason: "invalid_action_slot" };
    if (Object.prototype.hasOwnProperty.call(state.plannedActions, slotIndex)) return { scheduled: false, reason: "action_slot_occupied", slotIndex };''','''    const reserved = reservedSlotIndexes(options, max);
    if (slotIndex == null) {
      slotIndex = Array.from({ length: max }, (_, index) => index).find((index) => !reserved.has(index) && !Object.prototype.hasOwnProperty.call(state.plannedActions, index));
    }
    if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex >= max) return { scheduled: false, reason: "invalid_action_slot" };
    if (reserved.has(slotIndex)) return { scheduled: false, reason: "action_slot_reserved", slotIndex };
    if (Object.prototype.hasOwnProperty.call(state.plannedActions, slotIndex)) return { scheduled: false, reason: "action_slot_occupied", slotIndex };''','schedule')
t=rep(t,'    actionSlotMaximum,\n    ensureState,','    actionSlotMaximum,\n    reservedSlotIndexes,\n    ensureState,','export')
p.write_text(t,encoding='utf-8')

p=Path('js/player-trait-runtime.js'); t=p.read_text(encoding='utf-8')
t=rep(t,'''  function getRuntime(overrides = {}) {
    const character = getCharacter();''','''  function combatReservedActionSlotIndexes(unit = {}) {
    const unitId = sharedUnitId(unit);
    if (!unitId) return [];
    let targets = global.slotTargets && typeof global.slotTargets === "object" ? global.slotTargets : null;
    let vectors = global.attackVectors && typeof global.attackVectors === "object" ? global.attackVectors : null;
    try {
      if (!targets && typeof global.eval === "function") targets = global.eval("typeof slotTargets !== 'undefined' ? slotTargets : null");
      if (!vectors && typeof global.eval === "function") vectors = global.eval("typeof attackVectors !== 'undefined' ? attackVectors : null");
    } catch (_) {}
    const prefix = `${unitId}_slot_`;
    const ids = new Set([...Object.keys(targets || {}), ...Object.keys(vectors || {})]);
    return [...ids].filter((slotId) => slotId.startsWith(prefix)).map((slotId) => Number(slotId.slice(prefix.length))).filter(Number.isInteger);
  }

  function getRuntime(overrides = {}) {
    const character = getCharacter();''','player helper')
t=rep(t,'''    const actionEconomy = context === "combat"
      ? (input.actionEconomy || global.LuminousActionEconomy?.runtimeFor?.(self, { phase: input.phase || global.CombatEngine?.currentState }))
      : input.actionEconomy;''','''    const actionEconomy = context === "combat"
      ? (input.actionEconomy || global.LuminousActionEconomy?.runtimeFor?.(self, { phase: input.phase || global.CombatEngine?.currentState, reservedSlotIndexes: combatReservedActionSlotIndexes(self) }))
      : input.actionEconomy;''','runtime options')
p.write_text(t,encoding='utf-8')

p=Path('Battle-viewer.html'); t=p.read_text(encoding='utf-8')
t=rep(t,'''    function collectPlannedActionSlotIds() {
        const slotIds = [];''','''    function isTraitActionSlotReserved(slotId) {
        const marker = '_slot_';
        const splitAt = String(slotId || '').lastIndexOf(marker);
        if (splitAt < 0) return false;
        const unitId = slotId.slice(0, splitAt);
        const slotIndex = Number(slotId.slice(splitAt + marker.length));
        if (!Number.isInteger(slotIndex)) return false;
        const shared = getSharedPlannedAction(unitId, slotIndex);
        if (shared && ['planned', 'resolving'].includes(shared.status)) return true;
        const unit = combatData[unitId];
        const local = unit ? window.LuminousActionEconomy?.getPlannedAction?.(unit, slotIndex) : null;
        return local?.kind === 'trait';
    }

    function collectPlannedActionSlotIds() {
        const slotIds = [];''','viewer helper')
t=rep(t,'''            if (slot && slot.dataset.faction === 'ally') {
                const baseId = slot.id.split('_slot_')[0];
                if (combatData[baseId] && combatData[baseId].isImmobilized) {''','''            if (slot && slot.dataset.faction === 'ally') {
                const baseId = slot.id.split('_slot_')[0];
                if (isTraitActionSlotReserved(slot.id)) {
                    addLogEntry(`[ ACTION SLOT ] - ${combatData[baseId]?.name || baseId} ya reservó este Slot para una Trait.`, 'interrupt');
                    return;
                }
                if (combatData[baseId] && combatData[baseId].isImmobilized) {''','drag')
t=rep(t,'''        allySlotsNodes.forEach(ally => {
            const baseId = ally.id.split('_slot_')[0];
            if (combatData[baseId] && combatData[baseId].isImmobilized) return;''','''        allySlotsNodes.forEach(ally => {
            const baseId = ally.id.split('_slot_')[0];
            if (isTraitActionSlotReserved(ally.id)) return;
            if (combatData[baseId] && combatData[baseId].isImmobilized) return;''','auto')
t=rep(t,'''    function selectMatrixCell(x, y) {
        const attackerId = pendingAttackerSlotId;
        const targetId = pendingTargetSlotId;

        // Clear previous selection by this attacker on this target if any''','''    function selectMatrixCell(x, y) {
        const attackerId = pendingAttackerSlotId;
        const targetId = pendingTargetSlotId;
        if (!attackerId || isTraitActionSlotReserved(attackerId)) {
            if (attackerId) addLogEntry('[ ACTION SLOT ] - Ese Slot está reservado para una Trait.', 'interrupt');
            closeTargetingMatrix();
            return;
        }

        // Clear previous selection by this attacker on this target if any''','matrix')
p.write_text(t,encoding='utf-8')
print('slot reservation fix applied')