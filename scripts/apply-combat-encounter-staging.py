from pathlib import Path
import re


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected 1 occurrence, found {count}")
    return text.replace(old, new, 1)

# combatEngine: no combat exists before an encounter is started.
p = Path('js/combatEngine.js')
s = p.read_text()
s = replace_once(s, "    currentState: 'COMBAT_ACTIVE',", "    currentState: 'IDLE',", 'combatEngine initial state')
p.write_text(s)

# Runtime: load the neutral actor library and encounter session before dependent DM modules.
p = Path('js/battle-viewer-runtime-074.js')
s = p.read_text()
s = replace_once(
    s,
    '  const runtimeScripts = [\n    ["battle-viewer-firebase-session-074-script", "js/battle-viewer-firebase-session-074.js", "LuminousBattleViewerFirebaseSession074"],',
    '  const runtimeScripts = [\n    ["actor-library-script", "js/actor-library.js", "LuminousActorLibrary"],\n    ["battle-viewer-encounter-session-074-script", "js/battle-viewer-encounter-session-074.js", "LuminousBattleViewerEncounterSession074"],\n    ["battle-viewer-firebase-session-074-script", "js/battle-viewer-firebase-session-074.js", "LuminousBattleViewerFirebaseSession074"],',
    'runtime script dependencies',
)
s = replace_once(
    s,
    '      && global.LuminousBattleViewerFirebaseSession074\n      && global.CombatSkillSchema',
    '      && global.LuminousActorLibrary\n      && global.LuminousBattleViewerEncounterSession074\n      && global.LuminousBattleViewerFirebaseSession074\n      && global.CombatSkillSchema',
    'runtime ready dependencies',
)
s = replace_once(
    s,
    '    try { if (!global.LuminousBattleViewerFirebaseSession074) require("./battle-viewer-firebase-session-074.js"); } catch (_) {}',
    '    try { if (!global.LuminousActorLibrary) require("./actor-library.js"); } catch (_) {}\n    try { if (!global.LuminousBattleViewerEncounterSession074) require("./battle-viewer-encounter-session-074.js"); } catch (_) {}\n    try { if (!global.LuminousBattleViewerFirebaseSession074) require("./battle-viewer-firebase-session-074.js"); } catch (_) {}',
    'runtime commonjs dependencies',
)
p.write_text(s)

# Player entry: stage Players in the draft instead of writing live combatants.
p = Path('js/battle-viewer-player-entry-074.js')
s = p.read_text()
s = s.replace('global?.LuminousVttActorLibrary', 'global?.LuminousActorLibrary')
s = s.replace('global.LuminousVttActorLibrary', 'global.LuminousActorLibrary')
s = s.replace('require("./vtt/actor-library.js")', 'require("./actor-library.js")')
s = replace_once(s, '    combatants: "campaña/combate/combatants",', '    draftCombatants: "campaña/combate/encounterDraft/combatants",', 'player draft root')
s = replace_once(s, '    const ref = db.ref(`${ROOTS.combatants}/${key}`);', '    const ref = db.ref(`${ROOTS.draftCombatants}/${key}`);', 'player draft write')
s = s.replace('Campaign Players → Combat', 'Encounter Draft · Campaign Players')
s = s.replace('>ADD PLAYER</button>', '>STAGE PLAYER</button>')
s = s.replace(' · IN COMBAT', ' · STAGED')
s = s.replace('Player is already in combat.', 'Player is already staged for this encounter.')
s = s.replace('Select a Player to add to combat.', 'Select a Player to stage for the encounter.')
s = s.replace('${entry.actor.name} added to combat.', '${entry.actor.name} staged for encounter.')
s = s.replace('${entry.actor.name} is already in combat.', '${entry.actor.name} is already staged.')
s = replace_once(s, '    state.db = options.db || state.db || (global.firebase?.database ? global.firebase.database() : null);\n    if (!state.db && global.document) return false;', '    state.db = options.db || state.db || (global.firebase?.database ? global.firebase.database() : null);\n    if (!state.db && global.document) return false;\n    global.LuminousBattleViewerEncounterSession074?.init?.({ db: state.db });', 'player session init')
s = replace_once(s, '    subscribe(ROOTS.combatants, (value) => { state.combatants = value; });', '    subscribe(ROOTS.draftCombatants, (value) => { state.combatants = value; });', 'player draft subscribe')
p.write_text(s)

# Encounter setup: stage library units, then atomically start the encounter.
p = Path('js/battle-viewer-encounter-setup-074.js')
s = p.read_text()
s = s.replace('global?.LuminousVttActorLibrary', 'global?.LuminousActorLibrary')
s = s.replace('global.LuminousVttActorLibrary', 'global.LuminousActorLibrary')
s = s.replace('require("./vtt/actor-library.js")', 'require("./actor-library.js")')
s = replace_once(s, '    combatants: "campaña/combate/combatants",', '    combatants: "campaña/combate/combatants",\n    draftCombatants: "campaña/combate/encounterDraft/combatants",', 'encounter roots')
s = replace_once(s, '  const STATUS_ID = "dm074-encounter-setup-status";', '  const STATUS_ID = "dm074-encounter-setup-status";\n  const START_ID = "dm074-encounter-start";\n  const CLEAR_ID = "dm074-encounter-clear";', 'encounter action ids')
s = s.replace('await db.ref(ROOTS.combatants).update(updates);', 'await db.ref(ROOTS.draftCombatants).update(updates);')
s = s.replace('Library Units deploy directly into the canonical FIELD roster.', 'Players and Units are staged here. Nothing enters the live FIELD until START ENCOUNTER.')
s = s.replace('>DEPLOY ENEMY</button>', '>STAGE ENEMY</button>')
s = s.replace('>DEPLOY ALLY</button>', '>STAGE ALLY</button>')
s = replace_once(
    s,
    '          <button id="${UNIT_ALLY_ID}" type="button">STAGE ALLY</button>\n        </div>\n        <div id="${STATUS_ID}"',
    '          <button id="${UNIT_ALLY_ID}" type="button">STAGE ALLY</button>\n        </div>\n        <div class="dm074-row" style="margin-top:7px">\n          <button id="${START_ID}" type="button" style="flex:1">START ENCOUNTER</button>\n          <button id="${CLEAR_ID}" type="button">CLEAR DRAFT</button>\n        </div>\n        <div id="${STATUS_ID}"',
    'encounter start controls',
)
s = replace_once(
    s,
    '      const enemyButton = card.querySelector(`#${UNIT_ENEMY_ID}`);\n      const allyButton = card.querySelector(`#${UNIT_ALLY_ID}`);',
    '      const enemyButton = card.querySelector(`#${UNIT_ENEMY_ID}`);\n      const allyButton = card.querySelector(`#${UNIT_ALLY_ID}`);\n      const startButton = card.querySelector(`#${START_ID}`);\n      const clearButton = card.querySelector(`#${CLEAR_ID}`);',
    'encounter action nodes',
)
s = s.replace('setStatus(`Deploying ${qty} × ${actor.name} as ${faction.toUpperCase()}…`);', 'setStatus(`Staging ${qty} × ${actor.name} as ${faction.toUpperCase()}…`);')
s = s.replace('deployed as ${faction.toUpperCase()} from Unit Library.', 'staged as ${faction.toUpperCase()} from Unit Library.')
s = replace_once(
    s,
    '      enemyButton.addEventListener("click", () => deploy("enemy"));\n      allyButton.addEventListener("click", () => deploy("ally"));',
    '''      enemyButton.addEventListener("click", () => deploy("enemy"));
      allyButton.addEventListener("click", () => deploy("ally"));
      startButton.addEventListener("click", async () => {
        const session = global.LuminousBattleViewerEncounterSession074;
        if (!session?.startEncounter) return setStatus("Encounter session runtime is unavailable.", "error");
        startButton.disabled = true;
        clearButton.disabled = true;
        setStatus("Starting staged encounter…");
        try {
          const result = await session.startEncounter({ db: state.db, draftCombatants: state.combatants });
          setStatus(`Encounter ${result.encounterId} started in PRE_COMBAT_PLANNING.`, "ok");
        } catch (error) {
          setStatus(error?.message === "EMPTY_ENCOUNTER_DRAFT" ? "Draft is empty. Stage Players or Units first." : `Could not start encounter: ${error?.message || error}`, "error");
        } finally {
          startButton.disabled = false;
          clearButton.disabled = false;
        }
      });
      clearButton.addEventListener("click", async () => {
        const session = global.LuminousBattleViewerEncounterSession074;
        if (!session?.clearDraft) return setStatus("Encounter session runtime is unavailable.", "error");
        clearButton.disabled = true;
        try {
          await session.clearDraft({ db: state.db });
          setStatus("Encounter draft cleared.", "ok");
        } catch (error) {
          setStatus(`Could not clear draft: ${error?.message || error}`, "error");
        } finally {
          clearButton.disabled = false;
        }
      });''',
    'encounter action handlers',
)
s = replace_once(s, '    state.db = options.db || state.db || (global.firebase?.database ? global.firebase.database() : null);\n    if (!state.db && global.document) return false;', '    state.db = options.db || state.db || (global.firebase?.database ? global.firebase.database() : null);\n    if (!state.db && global.document) return false;\n    global.LuminousBattleViewerEncounterSession074?.init?.({ db: state.db });', 'encounter session init')
s = replace_once(s, '    subscribe(ROOTS.combatants, (value) => { state.combatants = value; }, (value) => { repairCanonicalSprites(value).catch(() => {}); });', '    subscribe(ROOTS.draftCombatants, (value) => { state.combatants = value; }, (value) => { repairCanonicalSprites(value).catch(() => {}); });', 'encounter draft subscribe')
p.write_text(s)

# Encounter roster: show the draft before start, and only the current encounter after start.
p = Path('js/battle-viewer-dm-encounter-roster-074.js')
s = p.read_text()
s = replace_once(s, '    combatants: "campaña/combate/combatants",\n    reserves: "campaña/combate/reserves",', '    combatants: "campaña/combate/combatants",\n    draftCombatants: "campaña/combate/encounterDraft/combatants",\n    reserves: "campaña/combate/reserves",\n    activeEncounterId: "campaña/combate/activeEncounterId",\n    combatState: "campaña/combate/estado",', 'roster roots')
s = replace_once(s, '    combatants: {},\n    reserves: {},', '    combatants: {},\n    draftCombatants: {},\n    reserves: {},\n    activeEncounterId: null,\n    combatState: "IDLE",', 'roster state')
anchor = '  function summarizeRoster(combatants = state.combatants, reserves = state.reserves) {'
insert = '''  function visibleLiveCombatants() {
    const encounterId = clean(state.activeEncounterId);
    const live = ["PRE_COMBAT_PLANNING", "COMBAT_ACTIVE"].includes(clean(state.combatState).toUpperCase());
    if (!encounterId || !live) return {};
    return Object.fromEntries(Object.entries(state.combatants || {}).filter(([, unit]) => clean(unit?.encounterId) === encounterId));
  }

'''
s = replace_once(s, anchor, insert + anchor, 'roster live filter')
s = replace_once(s, '    const roster = summarizeRoster();\n    const af = roster.allied.field;', '    const liveCombatants = visibleLiveCombatants();\n    const isLive = Object.keys(liveCombatants).length > 0;\n    const roster = summarizeRoster(isLive ? liveCombatants : state.draftCombatants, isLive ? state.reserves : {});\n    const rosterMode = isLive ? "ACTIVE" : "DRAFT";\n    const af = roster.allied.field;', 'roster displayed collection')
s = replace_once(s, '      <div class="dm074-title">Encounter Roster</div>', '      <div class="dm074-title">Encounter Roster · ${rosterMode}</div>', 'roster title')
s = replace_once(s, '    subscribe(ROOTS.combatants, (value) => { state.combatants = value; });\n    subscribe(ROOTS.reserves, (value) => { state.reserves = value; });', '    subscribe(ROOTS.combatants, (value) => { state.combatants = value; });\n    subscribe(ROOTS.draftCombatants, (value) => { state.draftCombatants = value; });\n    subscribe(ROOTS.reserves, (value) => { state.reserves = value; });\n    subscribe(ROOTS.activeEncounterId, (value) => { state.activeEncounterId = clean(value) || null; });\n    subscribe(ROOTS.combatState, (value) => { state.combatState = clean(value || "IDLE").toUpperCase(); });', 'roster subscriptions')
p.write_text(s)

# Battle viewer: no legacy field materialization; render only the current started encounter.
p = Path('Battle-viewer.html')
s = p.read_text()
s = s.replace('VTT LUMINOS SYSTEM INITIALIZED...', 'LUMINOUS COMBAT ENGINE READY · WAITING FOR ENCOUNTER...')
s = replace_once(s, "    const COMBAT_STATE_PATH = 'campaña/combate/estado';\n    const SHARED_PLANNED_ACTIONS_PATH = 'campaña/combate/plannedActions';\n    let luminousCombatPhaseState = null;", "    const COMBAT_STATE_PATH = 'campaña/combate/estado';\n    const ACTIVE_ENCOUNTER_PATH = 'campaña/combate/activeEncounterId';\n    const SHARED_PLANNED_ACTIONS_PATH = 'campaña/combate/plannedActions';\n    let luminousCombatPhaseState = 'IDLE';\n    let activeEncounterId = null;", 'viewer encounter constants')
s = replace_once(s, "        }\n\n        luminousCombatPhaseState = normalized;\n        window.LuminousCombatPhaseState = normalized;", "        } else {\n            CombatEngine.currentState = 'IDLE';\n        }\n\n        luminousCombatPhaseState = normalized || 'IDLE';\n        window.LuminousCombatPhaseState = luminousCombatPhaseState;\n        const executeButton = document.getElementById('btn-execute-clash');\n        if (executeButton) executeButton.disabled = !(activeEncounterId && luminousCombatPhaseState === 'PRE_COMBAT_PLANNING');", 'viewer idle phase')
s = replace_once(s, "    async function executeCombatTimeline() {\n        // Pressing Execute is the authoritative Planning -> Combat transition for this timeline.", "    async function executeCombatTimeline() {\n        if (!activeEncounterId || luminousCombatPhaseState !== 'PRE_COMBAT_PLANNING') {\n            addLogEntry('[ ENCOUNTER ] - No hay un encuentro iniciado en fase de planeación.', 'interrupt');\n            return;\n        }\n        // Pressing Execute is the authoritative Planning -> Combat transition for this timeline.", 'execute encounter guard')

# Remove production demo fixtures that manufacture Sinners/Hooligans.
s, n = re.subn(r"\n\s*// --- BASE DE DATOS DE TUS PECADORES ---.*?\n\s*function toggleGrid\(\)", "\n\n    function toggleGrid()", s, count=1, flags=re.S)
if n != 1: raise SystemExit(f'custom sinners demo removal: {n}')
s, n = re.subn(r"\n\s*// --- FIREBASE MOCK ---.*?\n\s*// --- FUNCIONES DEL EDITOR GENERALIZADO ---", "\n\n    // --- FUNCIONES DEL EDITOR GENERALIZADO ---", s, count=1, flags=re.S)
if n != 1: raise SystemExit(f'firebase mock removal: {n}')
s, n = re.subn(r"\n\s*// --- DESPLIEGUE HORDA 7v7 ---.*?\nfunction renderLoop\(\)", "\n\nfunction renderLoop()", s, count=1, flags=re.S)
if n != 1: raise SystemExit(f'7v7 demo removal: {n}')

helper = '''    function renderLiveEncounterCombatants() {
        const battlefield = document.getElementById('battlefield');
        if (!battlefield) return;
        battlefield.innerHTML = '';
        combatData = {};
        const liveState = luminousCombatPhaseState === 'PRE_COMBAT_PLANNING' || luminousCombatPhaseState === 'COMBAT_ACTIVE';
        if (!activeEncounterId || !liveState) {
            drawArcs();
            return;
        }
        Object.values(dbCombatData || {}).forEach(unit => {
            if (String(unit?.encounterId || '') !== String(activeEncounterId)) return;
            spawnCombatant(unit);
        });
        if (luminousCombatPhaseState) syncCombatEnginePhase(luminousCombatPhaseState);
        drawArcs();
    }

'''
s = replace_once(s, '    function initFirebaseCombat() {', helper + '    function initFirebaseCombat() {', 'viewer live render helper')
s = replace_once(s, "        db.ref(COMBAT_STATE_PATH).on('value', snap => {\n            syncCombatEnginePhase(snap.val());\n        });", "        db.ref(COMBAT_STATE_PATH).on('value', snap => {\n            syncCombatEnginePhase(snap.val());\n            renderLiveEncounterCombatants();\n        });\n\n        db.ref(ACTIVE_ENCOUNTER_PATH).on('value', snap => {\n            activeEncounterId = String(snap.val() || '').trim() || null;\n            const executeButton = document.getElementById('btn-execute-clash');\n            if (executeButton) executeButton.disabled = !(activeEncounterId && luminousCombatPhaseState === 'PRE_COMBAT_PLANNING');\n            renderLiveEncounterCombatants();\n        });", 'viewer state subscriptions')
old_listener = '''        db.ref('campaña/combate/combatants').on('value', snap => {
            const data = snap.val() || {};
            dbCombatData = data;

            // Re-render
            const battlefield = document.getElementById('battlefield');
            battlefield.innerHTML = '';
            combatData = {}; // Clear local combat data cache

            // Re-spawn each combatant based on db
            Object.values(dbCombatData).forEach(unit => {
                spawnCombatant(unit);
            });
            // Initial Firebase callbacks can arrive in either order. Re-apply the already-known
            // phase to newly materialized Unit objects without resetting existing planned actions.
            if (luminousCombatPhaseState) syncCombatEnginePhase(luminousCombatPhaseState);
            drawArcs();
        });'''
new_listener = '''        db.ref('campaña/combate/combatants').on('value', snap => {
            dbCombatData = snap.val() || {};
            renderLiveEncounterCombatants();
        });'''
s = replace_once(s, old_listener, new_listener, 'viewer combatants listener')
s = replace_once(s, "    window.onload = () => { initFirebaseCombat(); initDragAndDrop(); renderLoop(); };", "    window.onload = () => {\n        const executeButton = document.getElementById('btn-execute-clash');\n        if (executeButton) executeButton.disabled = true;\n        initFirebaseCombat(); initDragAndDrop(); renderLoop();\n    };", 'viewer onload')
p.write_text(s)

print('combat encounter staging patch applied')
