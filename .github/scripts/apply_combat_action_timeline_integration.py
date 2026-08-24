from pathlib import Path

ROOT = Path('.')
viewer_path = ROOT / 'Battle-viewer.html'
test_path = ROOT / 'tests' / 'universal_action_economy.spec.js'

viewer = viewer_path.read_text(encoding='utf-8')

phase_marker = "    let combatData = {};\n"
phase_block = """    let combatData = {};

    const COMBAT_STATE_PATH = 'campaña/combate/estado';
    let luminousCombatPhaseState = null;

    function combatUnitsForActionEconomy() {
        return Object.values(combatData || {}).filter(unit => unit && typeof unit === 'object');
    }

    function syncCombatEnginePhase(rawState) {
        const normalized = String(rawState || '').trim().toUpperCase();
        if (!window.CombatEngine) return normalized;

        const units = combatUnitsForActionEconomy();
        const economy = window.LuminousActionEconomy;
        const previous = luminousCombatPhaseState;

        if (normalized === 'PRE_COMBAT_PLANNING') {
            if (previous !== normalized) {
                CombatEngine.beginPlanningPhase(units);
            } else {
                CombatEngine.currentState = 'PRE_COMBAT_PLANNING';
                if (economy?.ensureState) {
                    units.forEach(unit => {
                        const state = economy.ensureState(unit);
                        if (state?.phase !== 'planning') economy.beginPlanning(unit);
                    });
                }
            }
        } else if (normalized === 'COMBAT_ACTIVE') {
            if (previous !== normalized) {
                CombatEngine.triggerEncounterStart(units);
            } else {
                CombatEngine.currentState = 'COMBAT_ACTIVE';
                if (economy?.ensureState) {
                    units.forEach(unit => {
                        const state = economy.ensureState(unit);
                        if (state?.phase !== 'combat') economy.beginCombat(unit);
                    });
                }
            }
        }

        luminousCombatPhaseState = normalized;
        window.LuminousCombatPhaseState = normalized;
        return normalized;
    }

    function collectPlannedActionSlotIds() {
        const economy = window.LuminousActionEconomy;
        if (!economy?.actionSlotMaximum || !economy?.getPlannedAction) return [];
        const slotIds = [];
        combatUnitsForActionEconomy().forEach(unit => {
            const unitId = String(unit.id || unit.unitId || unit.characterId || '');
            if (!unitId) return;
            const maximum = economy.actionSlotMaximum(unit);
            for (let slotIndex = 0; slotIndex < maximum; slotIndex++) {
                if (economy.getPlannedAction(unit, slotIndex)) slotIds.push(`${unitId}_slot_${slotIndex}`);
            }
        });
        return slotIds;
    }
"""
if 'function syncCombatEnginePhase(rawState)' not in viewer:
    assert viewer.count(phase_marker) == 1, 'combatData marker changed'
    viewer = viewer.replace(phase_marker, phase_block, 1)

init_marker = "    function initFirebaseCombat() {\n        // Escuchar datos de los combatientes\n"
init_replacement = """    function initFirebaseCombat() {
        // Firebase is the production source of truth for Planning vs Combat Phase.
        db.ref(COMBAT_STATE_PATH).on('value', snap => {
            syncCombatEnginePhase(snap.val());
        });

        // Escuchar datos de los combatientes
"""
if "db.ref(COMBAT_STATE_PATH).on('value'" not in viewer:
    assert viewer.count(init_marker) == 1, 'initFirebaseCombat marker changed'
    viewer = viewer.replace(init_marker, init_replacement, 1)

respawn_marker = """            Object.values(dbCombatData).forEach(unit => {
                spawnCombatant(unit);
            });
            drawArcs();
"""
respawn_replacement = """            Object.values(dbCombatData).forEach(unit => {
                spawnCombatant(unit);
            });
            // Initial Firebase callbacks can arrive in either order. Re-apply the already-known
            // phase to newly materialized Unit objects without resetting existing planned actions.
            if (luminousCombatPhaseState) syncCombatEnginePhase(luminousCombatPhaseState);
            drawArcs();
"""
if 'Re-apply the already-known' not in viewer:
    assert viewer.count(respawn_marker) == 1, 'combatant respawn marker changed'
    viewer = viewer.replace(respawn_marker, respawn_replacement, 1)

execute_marker = """    async function executeCombatTimeline() {
        addLogEntry('--- INICIANDO FASE DE RESOLUCIÓN ---', 'interrupt');
"""
execute_replacement = """    async function executeCombatTimeline() {
        // Pressing Execute is the authoritative Planning -> Combat transition for this timeline.
        syncCombatEnginePhase('COMBAT_ACTIVE');
        try {
            await db.ref(COMBAT_STATE_PATH).set('COMBAT_ACTIVE');
        } catch (error) {
            console.error('No se pudo sincronizar COMBAT_ACTIVE en Firebase:', error);
        }

        addLogEntry('--- INICIANDO FASE DE RESOLUCIÓN ---', 'interrupt');
"""
if "authoritative Planning -> Combat transition" not in viewer:
    assert viewer.count(execute_marker) == 1, 'executeCombatTimeline marker changed'
    viewer = viewer.replace(execute_marker, execute_replacement, 1)

acting_marker = "        let actingSlots = Object.keys(attackVectors);\n"
acting_replacement = "        let actingSlots = [...new Set([...Object.keys(attackVectors), ...collectPlannedActionSlotIds()])];\n"
if 'collectPlannedActionSlotIds()])' not in viewer:
    assert viewer.count(acting_marker) == 1, 'actingSlots marker changed'
    viewer = viewer.replace(acting_marker, acting_replacement, 1)

loop_marker = """        for (let attackerSlotId of actingSlots) {
            const vector = attackVectors[attackerSlotId];
            const targetSlotId = vector.target;

            const attackerBaseId = attackerSlotId.split('_slot_')[0];
            const targetBaseId = targetSlotId.split('_slot_')[0];

            const attackerUnit = combatData[attackerBaseId];
            const targetUnit = combatData[targetBaseId];

            if (attackerUnit.isImmobilized) {
                addLogEntry(`[ INMOVILIZADO ] - ${attackerUnit.name} no puede actuar este turno.`, 'interrupt');
                continue;
            }

            addLogEntry(`${attackerUnit.name} se mueve hacia ${targetUnit.name}...`);
"""
loop_replacement = """        for (let attackerSlotId of actingSlots) {
            const attackerBaseId = attackerSlotId.split('_slot_')[0];
            const attackerUnit = combatData[attackerBaseId];
            if (!attackerUnit) continue;

            if (attackerUnit.isImmobilized) {
                addLogEntry(`[ INMOVILIZADO ] - ${attackerUnit.name} no puede actuar este turno.`, 'interrupt');
                continue;
            }

            const slotIndex = Number(attackerSlotId.split('_slot_')[1]);
            if (Number.isInteger(slotIndex) && typeof CombatEngine.resolveActionSlot === 'function') {
                const plannedResolution = CombatEngine.resolveActionSlot(attackerUnit, slotIndex, {
                    phase: 'combat',
                    combatData,
                    attackerSlotId,
                });
                if (plannedResolution?.handled) {
                    const actionName = plannedResolution.result?.trait?.name || plannedResolution.planned?.traitId || 'Trait';
                    if (plannedResolution.result?.available) {
                        addLogEntry(`[ ACTION ] - ${attackerUnit.name}: ${actionName}`);
                    } else {
                        addLogEntry(`[ ACTION FAILED ] - ${attackerUnit.name}: ${actionName}`, 'interrupt');
                    }
                    resolvedSlots.add(attackerSlotId);
                    continue;
                }
            }

            const vector = attackVectors[attackerSlotId];
            if (!vector?.target) {
                resolvedSlots.add(attackerSlotId);
                continue;
            }
            const targetSlotId = vector.target;
            const targetBaseId = targetSlotId.split('_slot_')[0];
            const targetUnit = combatData[targetBaseId];
            if (!targetUnit) {
                resolvedSlots.add(attackerSlotId);
                continue;
            }

            addLogEntry(`${attackerUnit.name} se mueve hacia ${targetUnit.name}...`);
"""
if 'const plannedResolution = CombatEngine.resolveActionSlot' not in viewer:
    assert viewer.count(loop_marker) == 1, 'timeline loop marker changed'
    viewer = viewer.replace(loop_marker, loop_replacement, 1)

viewer_path.write_text(viewer, encoding='utf-8')

tests = test_path.read_text(encoding='utf-8')
if 'production Battle viewer follows Firebase Planning state' not in tests:
    tests = tests.replace('const { test, expect } = require("@playwright/test");\n', 'const { test, expect } = require("@playwright/test");\nconst fs = require("node:fs");\nconst path = require("node:path");\n', 1)
    tests += """

test("production Battle viewer follows Firebase Planning state", () => {
  const viewer = fs.readFileSync(path.join(__dirname, "..", "Battle-viewer.html"), "utf8");
  expect(viewer).toContain("db.ref(COMBAT_STATE_PATH).on('value'");
  expect(viewer).toContain("CombatEngine.beginPlanningPhase(units)");
  expect(viewer).toContain("CombatEngine.triggerEncounterStart(units)");
  expect(viewer).toContain("syncCombatEnginePhase('COMBAT_ACTIVE')");
  expect(viewer).toContain("await db.ref(COMBAT_STATE_PATH).set('COMBAT_ACTIVE')");
});

test("production timeline resolves planned Trait Action Slots", () => {
  const viewer = fs.readFileSync(path.join(__dirname, "..", "Battle-viewer.html"), "utf8");
  expect(viewer).toContain("...collectPlannedActionSlotIds()");
  expect(viewer).toContain("CombatEngine.resolveActionSlot(attackerUnit, slotIndex");
  expect(viewer).toContain("if (plannedResolution?.handled)");
  expect(viewer).toContain("resolvedSlots.add(attackerSlotId)");
});
"""
    test_path.write_text(tests, encoding='utf-8')

print('Combat Action timeline integration applied successfully.')
