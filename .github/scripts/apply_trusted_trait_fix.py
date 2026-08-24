from pathlib import Path

def rep(text, old, new, label):
    if old not in text: raise SystemExit('missing '+label)
    return text.replace(old,new,1)

p=Path('js/player-trait-runtime.js'); t=p.read_text(encoding='utf-8')
t=rep(t,'''  function getRuntime(overrides = {}) {
    const character = getCharacter();''','''  function currentAuthUid() {
    try { return String(global.firebase?.auth?.()?.currentUser?.uid || "").trim(); } catch (_) { return ""; }
  }

  function getRuntime(overrides = {}) {
    const character = getCharacter();''','auth helper')
t=rep(t,'''    const payload = {
      ...local,
      kind: "trait",
      traitId: trait?.id || local.traitId || null,
      sourceId: trait?.id || local.sourceId || null,
      unitId, slotIndex,
      slotId: result.slotId || `${unitId}_slot_${slotIndex}`,
      targetId: local.targetId || runtime.target?.id || runtime.defender?.id || null,
      data: { ...(local.data || {}), trait },
      scheduledBy: state.playerId || null,
      status: "planned",''','''    const schedulerUid = currentAuthUid();
    if (!schedulerUid) {
      global.LuminousActionEconomy?.cancelAction?.(unit, slotIndex);
      console.error("No se pudo compartir el Action Slot: usuario Firebase no autenticado.");
      return null;
    }
    const payload = {
      kind: "trait",
      traitId: trait?.id || local.traitId || null,
      sourceId: trait?.id || local.sourceId || null,
      unitId, slotIndex,
      slotId: result.slotId || `${unitId}_slot_${slotIndex}`,
      targetId: local.targetId || runtime.target?.id || runtime.defender?.id || null,
      schedulerUid,
      scheduledBy: state.playerId || null,
      status: "planned",''','payload')
p.write_text(t,encoding='utf-8')

p=Path('js/combatEngine.js'); t=p.read_text(encoding='utf-8')
anchor='''const RESONANCE_BONUS = {
    // Índice: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11+]
    REGULAR:  [0, 0, 1, 3, 3, 5, 5, 7, 7, 9, 9, 11],
    ABSOLUTE: [0, 0, 0, 3, 5, 5, 7, 7, 9, 9, 11, 11]
};
'''
helpers='''
function normalizeTrustedTraitId(value) {
    return String(value ?? '').trim().toLowerCase().replace(/\\s+/g, '_');
}

function normalizeTrustedGrantCharacter(unit = {}) {
    const build = unit.characterBuild && typeof unit.characterBuild === 'object' ? unit.characterBuild : {};
    return {
        ...unit,
        raceId: build.raceId ?? unit.raceId ?? unit.race?.id,
        raceSubtypeId: build.raceSubtypeId ?? unit.raceSubtypeId ?? unit.race?.subtypeId,
        classes: Array.isArray(build.classes) ? build.classes : unit.classes,
        level: build.calculatedAtLevel ?? unit.level,
        lineages: Array.isArray(build.lineages) ? build.lineages : unit.lineages,
        lineageId: build.lineageId ?? unit.lineageId,
    };
}

function trustedExplicitTraitIds(unit = {}) {
    const values = [];
    for (const key of ['traitIds', 'racialTraitIds', 'grantedTraitIds']) if (Array.isArray(unit?.[key])) values.push(...unit[key]);
    if (Array.isArray(unit?.traits)) values.push(...unit.traits.map((trait) => trait?.id || trait));
    return new Set(values.filter(Boolean).map(normalizeTrustedTraitId));
}

function resolveTrustedTraitForUnit(unit = {}, traitId) {
    const id = normalizeTrustedTraitId(traitId);
    if (!id) return null;
    const g = typeof globalThis !== 'undefined' ? globalThis : {};
    const engine = g.LuminousTraitEngine;
    const character = normalizeTrustedGrantCharacter(unit);
    const explicit = trustedExplicitTraitIds(unit);
    const racial = g.LuminousRacialTraitCatalog;
    const racialDefinition = racial?.getDefinition?.(id) || null;
    if (racialDefinition) {
        const granted = racial?.resolveTraitGrants?.(character, racial.allDefinitions?.() || {}) || [];
        return (explicit.has(id) || granted.some((trait) => normalizeTrustedTraitId(trait?.id) === id)) ? racialDefinition : null;
    }
    const core = g.LuminousTraitCatalogCore;
    const coreDefinition = core?.getDefinition?.(id) || null;
    if (coreDefinition) {
        const granted = engine?.resolveTraitGrants?.(character, core.allGrants?.() || [], core.allDefinitions?.() || {}) || [];
        return (explicit.has(id) || granted.some((trait) => normalizeTrustedTraitId(trait?.id) === id)) ? coreDefinition : null;
    }
    return null;
}
'''
if anchor not in t: raise SystemExit('missing resonance anchor')
t=t.replace(anchor,anchor+helpers,1)
t=rep(t,'''    resolveActionSlot: function(unit, slotIndex, context = {}) {''','''    resolveTrustedTraitForUnit: function(unit, traitId) {
        return resolveTrustedTraitForUnit(unit, traitId);
    },

    resolveActionSlot: function(unit, slotIndex, context = {}) {''','resolver method')
t=rep(t,'''        const planned = context.plannedAction || null;
        const trait = planned?.kind === 'trait' ? planned?.data?.trait : null;
        const traitEngine = (typeof globalThis !== 'undefined') ? globalThis.LuminousTraitEngine : null;
        if (!trait || !traitEngine?.activateTrait) return { handled: false, planned };''','''        const planned = context.plannedAction || null;
        const traitEngine = (typeof globalThis !== 'undefined') ? globalThis.LuminousTraitEngine : null;
        if (planned?.kind !== 'trait' || !planned?.traitId || !traitEngine?.activateTrait) return { handled: false, planned };
        const trait = resolveTrustedTraitForUnit(unit, planned.traitId);
        if (!trait) return { handled: true, planned, result: { available: false, reasons: ["Trait is not granted to this Unit or is not in a trusted catalog."], trait: null } };''','trusted execution')
p.write_text(t,encoding='utf-8')

p=Path('Battle-viewer.html'); t=p.read_text(encoding='utf-8')
t=rep(t,'''    <script src="https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js"></script>
    <script src="https://www.gstatic.com/firebasejs/8.10.1/firebase-database.js"></script>
    <script src="js/status-engine.js"></script>
    <script src="js/trait-engine.js"></script>
    <script src="js/racial-trait-catalog.js"></script>''','''    <script src="https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js"></script>
    <script src="https://www.gstatic.com/firebasejs/8.10.1/firebase-auth.js"></script>
    <script src="https://www.gstatic.com/firebasejs/8.10.1/firebase-database.js"></script>
    <script src="js/status-engine.js"></script>
    <script src="js/trait-engine.js"></script>
    <script src="js/trait-catalog-core.js"></script>
    <script src="js/racial-trait-catalog.js"></script>''','viewer dependencies')
p.write_text(t,encoding='utf-8')
print('trusted shared Trait fix applied')