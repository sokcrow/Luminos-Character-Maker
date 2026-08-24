from pathlib import Path
import json


def replace_once(path, old, new):
    p = Path(path)
    text = p.read_text(encoding='utf-8')
    if old not in text:
        raise SystemExit(f'missing expected block in {path}: {old[:120]!r}')
    text = text.replace(old, new, 1)
    p.write_text(text, encoding='utf-8')

# 1) Bind shared planned actions to the authenticated player's own Firebase player bucket.
p = Path('js/player-trait-runtime.js')
t = p.read_text(encoding='utf-8')
t = t.replace('    seenSharedActionResolutions: new Set(),\n', '    seenSharedActionResolutions: new Set(),\n    seenDmResponses: new Set(),\n', 1)
old = '''    const payload = {
      kind: "trait",
      traitId: trait?.id || local.traitId || null,
      sourceId: trait?.id || local.sourceId || null,
      unitId, slotIndex,
      slotId: result.slotId || `${unitId}_slot_${slotIndex}`,
      targetId: local.targetId || runtime.target?.id || runtime.defender?.id || null,
      schedulerUid,
      scheduledBy: state.playerId || null,
      status: "planned",
      scheduledAt: global.firebase?.database?.ServerValue?.TIMESTAMP || Date.now(),
    };
    state.db.ref(`${SHARED_PLANNED_ACTIONS_ROOT}/${unitId}/${slotIndex}`).set(payload).catch((error) => console.error("No se pudo compartir el Action Slot planeado:", error));
'''
new = '''    const ownerPlayerId = String(state.playerId || "").trim();
    if (!ownerPlayerId) {
      global.LuminousActionEconomy?.cancelAction?.(unit, slotIndex);
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
      scheduledBy: ownerPlayerId,
      status: "planned",
      scheduledAt: global.firebase?.database?.ServerValue?.TIMESTAMP || Date.now(),
    };
    state.db.ref(`${SHARED_PLANNED_ACTIONS_ROOT}/${ownerPlayerId}/${slotIndex}`).set(payload).catch((error) => console.error("No se pudo compartir el Action Slot planeado:", error));
'''
if old not in t: raise SystemExit('persist shared action block not found')
t = t.replace(old, new, 1)
old = '''    Object.entries(state.sharedActions || {}).forEach(([unitId, slots]) => {
      Object.entries(slots || {}).forEach(([slotIndexRaw, action]) => {
        if (!action || action.status !== "resolved" || !action.traitId) return;
        if (String(action.scheduledBy || "") !== playerId) return;
        const resolutionKey = `${unitId}:${slotIndexRaw}:${action.resolvedAt || "resolved"}`;
'''
new = '''    Object.entries(state.sharedActions || {}).forEach(([ownerPlayerId, slots]) => {
      if (String(ownerPlayerId) !== playerId) return;
      Object.entries(slots || {}).forEach(([slotIndexRaw, action]) => {
        if (!action || action.status !== "resolved" || !action.traitId) return;
        if (String(action.scheduledBy || "") !== playerId) return;
        const resolutionKey = `${ownerPlayerId}:${slotIndexRaw}:${action.resolvedAt || "resolved"}`;
'''
if old not in t: raise SystemExit('shared resolution owner loop not found')
t = t.replace(old, new, 1)
t = t.replace('        if (unit && sharedUnitId(unit) === String(unitId)) {\n', '        if (unit && sharedUnitId(unit) === String(action.unitId || "")) {\n', 1)
old = '''    const record = { id: ref.key, effectId: descriptor.effectId || descriptor.sourceTraitId || "dm_effect", name: descriptor.name || "DM Managed Effect", sourceTraitId: descriptor.sourceTraitId || null, subjectUid, subjectPlayerId: state.playerId || null, subjectName: character?.characterName || character?.nombre || character?.name || state.playerId || "Player", targetId: descriptor.targetId || target?.id || target?.actorId || target?.characterId || null, targetName: descriptor.targetName || target?.name || target?.nombre || target?.characterName || "Target", check: { ...(descriptor.check || {}) }, modifier: { ...(descriptor.modifier || {}) }, note: descriptor.note || "", active: true, approved: false, startsAt: now, expiresAt: now + Math.round(hours * 3600000), durationHours: hours };
'''
new = '''    const record = { id: ref.key, effectId: descriptor.effectId || descriptor.sourceTraitId || "dm_effect", name: descriptor.name || "DM Managed Effect", kind: normalizeId(descriptor.kind || "effect") || "effect", prompt: descriptor.prompt || "", sourceTraitId: descriptor.sourceTraitId || null, subjectUid, subjectPlayerId: state.playerId || null, subjectName: character?.characterName || character?.nombre || character?.name || state.playerId || "Player", targetId: descriptor.targetId || target?.id || target?.actorId || target?.characterId || null, targetName: descriptor.targetName || target?.name || target?.nombre || target?.characterName || "Target", check: { ...(descriptor.check || {}) }, modifier: { ...(descriptor.modifier || {}) }, note: descriptor.note || "", active: true, approved: false, startsAt: now, expiresAt: now + Math.round(hours * 3600000), durationHours: hours };
'''
if old not in t: raise SystemExit('dm record block not found')
t = t.replace(old, new, 1)
marker = '''  function applyApprovedDmEffects(check = {}, runtimeInput = {}) {
'''
insert = '''  function processDmResponses() {
    const subjectUid = currentAuthUid();
    if (!subjectUid) return 0;
    let delivered = 0;
    Object.values(state.dmEffects || {}).forEach((effect) => {
      if (normalizeId(effect?.kind) !== "request") return;
      if (String(effect?.subjectUid || "") !== subjectUid) return;
      const response = String(effect?.response || "").trim();
      if (!response) return;
      const key = `${effect.id || effect.effectId}:${effect.respondedAt || response}`;
      if (state.seenDmResponses.has(key)) return;
      state.seenDmResponses.add(key);
      const detail = { effect, response, target: effect.targetName || effect.targetId || null };
      emit("luminous:dm-trait-response", detail);
      global.alert?.(`${effect.name || "Trait"} — ${effect.targetName || effect.targetId || "Target"}\n${response}`);
      delivered += 1;
    });
    return delivered;
  }

'''
if marker not in t: raise SystemExit('applyApproved marker missing')
t = t.replace(marker, insert + marker, 1)
t = t.replace('      state.db.ref(DM_MANAGED_EFFECTS_ROOT).on("value", (snapshot) => { state.dmEffects = snapshot.val() || {}; });\n', '      state.db.ref(DM_MANAGED_EFFECTS_ROOT).on("value", (snapshot) => { state.dmEffects = snapshot.val() || {}; processDmResponses(); });\n', 1)
p.write_text(t, encoding='utf-8')

# 2) Trusted DM viewer maps each owner bucket back to that owner's actual combat Unit.
p = Path('Battle-viewer.html')
t = p.read_text(encoding='utf-8')
old = '''    function getSharedPlannedAction(unitId, slotIndex) {
        return sharedPlannedActions?.[unitId]?.[slotIndex] || sharedPlannedActions?.[unitId]?.[String(slotIndex)] || null;
    }
'''
new = '''    function combatUnitIdentityValues(unit = {}) {
        return [unit?.id, unit?.unitId, unit?.playerId, unit?.player_id, unit?.ownerPlayerId, unit?.owner_player_id, unit?.characterId, unit?.character_id, unit?.uid, unit?.vinculo_jugador]
            .filter(value => value != null && String(value).trim() !== '')
            .map(value => String(value).trim());
    }

    function combatUnitForOwner(ownerPlayerId) {
        const owner = String(ownerPlayerId || '').trim();
        if (!owner) return null;
        return Object.values(combatData || {}).find(unit => combatUnitIdentityValues(unit).includes(owner)) || null;
    }

    function combatUnitId(unit = {}) {
        return String(unit?.id || unit?.unitId || unit?.characterId || unit?.actorId || '').trim();
    }

    function getSharedPlannedAction(unitId, slotIndex) {
        const wantedUnitId = String(unitId || '');
        for (const [ownerPlayerId, slots] of Object.entries(sharedPlannedActions || {})) {
            const ownerUnit = combatUnitForOwner(ownerPlayerId);
            if (!ownerUnit || combatUnitId(ownerUnit) !== wantedUnitId) continue;
            const action = slots?.[slotIndex] || slots?.[String(slotIndex)] || null;
            if (action) return { ...action, __ownerPlayerId: ownerPlayerId };
        }
        return null;
    }
'''
if old not in t: raise SystemExit('viewer getShared block not found')
t = t.replace(old, new, 1)
old = '''    function collectPlannedActionSlotIds() {
        const slotIds = [];
        Object.entries(sharedPlannedActions || {}).forEach(([unitId, slots]) => {
            Object.entries(slots || {}).forEach(([slotIndex, action]) => {
                if (action?.status === 'planned') slotIds.push(`${unitId}_slot_${slotIndex}`);
            });
        });
        return slotIds;
    }

    async function claimSharedPlannedAction(unitId, slotIndex) {
        const ref = db.ref(`${SHARED_PLANNED_ACTIONS_PATH}/${unitId}/${slotIndex}`);
'''
new = '''    function collectPlannedActionSlotIds() {
        const slotIds = [];
        Object.entries(sharedPlannedActions || {}).forEach(([ownerPlayerId, slots]) => {
            const ownerUnit = combatUnitForOwner(ownerPlayerId);
            if (!ownerUnit) return;
            const unitId = combatUnitId(ownerUnit);
            const maxSlots = window.LuminousActionEconomy?.actionSlotMaximum?.(ownerUnit) || Number(ownerUnit.actionSlots || ownerUnit.activeSlots || 1);
            Object.entries(slots || {}).forEach(([slotIndexRaw, action]) => {
                const slotIndex = Number(slotIndexRaw);
                if (action?.status === 'planned' && Number.isInteger(slotIndex) && slotIndex >= 0 && slotIndex < maxSlots) slotIds.push(`${unitId}_slot_${slotIndex}`);
            });
        });
        return slotIds;
    }

    async function claimSharedPlannedAction(ownerPlayerId, slotIndex) {
        const ref = db.ref(`${SHARED_PLANNED_ACTIONS_PATH}/${ownerPlayerId}/${slotIndex}`);
'''
if old not in t: raise SystemExit('viewer collect/claim block not found')
t = t.replace(old, new, 1)
t = t.replace('    async function finishSharedPlannedAction(unitId, slotIndex, resolution) {\n', '    async function finishSharedPlannedAction(ownerPlayerId, slotIndex, resolution) {\n', 1)
t = t.replace('        await db.ref(`${SHARED_PLANNED_ACTIONS_PATH}/${unitId}/${slotIndex}`).update(payload);\n', '        await db.ref(`${SHARED_PLANNED_ACTIONS_PATH}/${ownerPlayerId}/${slotIndex}`).update(payload);\n', 1)
old = '''            const sharedAction = Number.isInteger(slotIndex) ? getSharedPlannedAction(attackerBaseId, slotIndex) : null;
            if (sharedAction?.status === 'planned' && typeof CombatEngine.resolveActionSlot === 'function') {
                let claimed = null;
                try { claimed = await claimSharedPlannedAction(attackerBaseId, slotIndex); } catch (error) { console.error('No se pudo reclamar el Action Slot compartido:', error); }
                if (claimed) {
                    const plannedResolution = CombatEngine.resolveActionSlot(attackerUnit, slotIndex, { phase: 'combat', combatData, attackerSlotId, plannedAction: claimed });
                    try { await finishSharedPlannedAction(attackerBaseId, slotIndex, plannedResolution); } catch (error) { console.error('No se pudo cerrar el Action Slot compartido:', error); }
'''
new = '''            const sharedAction = Number.isInteger(slotIndex) ? getSharedPlannedAction(attackerBaseId, slotIndex) : null;
            const sharedOwnerPlayerId = sharedAction?.__ownerPlayerId || null;
            if (sharedAction?.status === 'planned' && sharedOwnerPlayerId && !attackVectors[attackerSlotId] && typeof CombatEngine.resolveActionSlot === 'function') {
                let claimed = null;
                try { claimed = await claimSharedPlannedAction(sharedOwnerPlayerId, slotIndex); } catch (error) { console.error('No se pudo reclamar el Action Slot compartido:', error); }
                if (claimed && String(claimed.scheduledBy || '') === String(sharedOwnerPlayerId)) {
                    const plannedResolution = CombatEngine.resolveActionSlot(attackerUnit, slotIndex, { phase: 'combat', combatData, attackerSlotId, plannedAction: claimed });
                    try { await finishSharedPlannedAction(sharedOwnerPlayerId, slotIndex, plannedResolution); } catch (error) { console.error('No se pudo cerrar el Action Slot compartido:', error); }
'''
if old not in t: raise SystemExit('viewer timeline shared action block not found')
t = t.replace(old, new, 1)
p.write_text(t, encoding='utf-8')

# 3) Realtime Database rules: player bucket is canonical owner; player may create/delete but never edit a planned record.
p = Path('database.rules.json')
rules = json.loads(p.read_text(encoding='utf-8'))
planned = rules['rules']['campaña']['combate']['plannedActions']
planned.clear()
planned['$ownerPlayerId'] = {
    '$slotIndex': {
        '.write': "auth != null && (auth.uid === 'e9JwFZrtk6g8UMqq2Hf9EHVY7Ay1' || (root.child('campaña').child('combate').child('estado').val() === 'PRE_COMBAT_PLANNING' && root.child('campaña').child('jugadores').child($ownerPlayerId).child('uid').val() === auth.uid && ((!data.exists() && newData.exists() && newData.child('schedulerUid').val() === auth.uid && newData.child('scheduledBy').val() === $ownerPlayerId && newData.child('status').val() === 'planned' && newData.child('kind').val() === 'trait' && newData.child('traitId').isString() && newData.child('unitId').isString()) || (data.exists() && data.child('schedulerUid').val() === auth.uid && data.child('scheduledBy').val() === $ownerPlayerId && !newData.exists()))))"
    }
}
p.write_text(json.dumps(rules, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

# 4) Empathy becomes a concrete DM request/response instead of an orphan flag.
replace_once('js/racial-trait-catalog.js',
'''      activation: { type: "manual", actionCost: "action", uses: { formula: "Proficiency", reset: "long_rest" }, target: "creature" },
      effects: [{ id: "moonfae_empathy_read", contexts: ["theatre"], trigger: "on_use", conditions: [], operations: [{ type: "set_flag", flagId: "empathy_read_requested", value: true }] }],
''',
'''      activation: { type: "manual", actionCost: "action", uses: { formula: "Proficiency", reset: "long_rest" }, target: "creature", conditions: [{ path: "target", operator: "truthy" }] },
      effects: [{ id: "moonfae_empathy_read", contexts: ["theatre"], trigger: "on_use", conditions: [], operations: [{ type: "register_dm_effect", kind: "request", effectId: "empathy_read", name: "Empathy", durationHours: 24, prompt: "Describe the target creature's general emotional state. The target is not made aware of this reading.", note: "Empathy: return only the target's general emotional state to the requesting player." }] }],
''')
replace_once('js/trait-engine.js',
'''      const descriptor = { effectId: normalizeId(op.effectId || env.trait.id), name: String(op.name || env.trait.name || env.trait.id), durationHours: Math.max(0, num(op.durationHours ?? op.hours, 1)), sourceTraitId: env.trait.id, targetId: target?.id ?? target?.actorId ?? target?.characterId ?? null, targetName: target?.name ?? target?.nombre ?? target?.characterName ?? null, check: clone(op.check || {}), modifier: clone(op.modifier || {}), note: String(op.note || "") };
''',
'''      const descriptor = { effectId: normalizeId(op.effectId || env.trait.id), name: String(op.name || env.trait.name || env.trait.id), kind: normalizeId(op.kind || "effect") || "effect", prompt: String(op.prompt || ""), durationHours: Math.max(0, num(op.durationHours ?? op.hours, 1)), sourceTraitId: env.trait.id, targetId: target?.id ?? target?.actorId ?? target?.characterId ?? null, targetName: target?.name ?? target?.nombre ?? target?.characterName ?? null, check: clone(op.check || {}), modifier: clone(op.modifier || {}), note: String(op.note || "") };
''')

p = Path('js/dm-managed-effect-engine.js')
t = p.read_text(encoding='utf-8')
old = '''      const modifier = Number(effect.modifier?.value || 0) || 0;
      appendTextLine(card, effect.name || effect.effectId || "Effect", "color:#fff;font-weight:700;");
      appendTextLine(card, `${effect.subjectName || effect.subjectPlayerId || "Player"} → ${effect.targetName || effect.targetId || "Target"}`);
      appendTextLine(card, `Tiempo restante: ${formatRemaining(effect, now)}`, "color:#e6c56c;");
      appendTextLine(card, effect.note || "", "font-size:11px;opacity:.8;margin-top:4px;");
      appendTextLine(card, `CHA Check · bono configurado: +${modifier} Check Power`, "font-size:11px;margin-top:4px;");
      const controls = global.document.createElement("div");
      controls.style.cssText = "display:flex;gap:6px;margin-top:6px;";
      const apply = global.document.createElement("button");
      apply.type = "button";
      apply.textContent = effect.approved ? "BONO LISTO" : "APLICAR AL PRÓXIMO CHA CHECK";
      apply.disabled = Boolean(effect.approved);
      apply.onclick = () => updateEffect(effect.id, { approved: true, approvedAt: Date.now() });
      const disable = global.document.createElement("button");
      disable.type = "button";
      disable.textContent = "DESACTIVAR";
      disable.onclick = () => updateEffect(effect.id, { active: false, disabledAt: Date.now() });
      controls.append(apply, disable);
'''
new = '''      const modifier = Number(effect.modifier?.value || 0) || 0;
      const isRequest = String(effect.kind || "").toLowerCase() === "request";
      appendTextLine(card, effect.name || effect.effectId || "Effect", "color:#fff;font-weight:700;");
      appendTextLine(card, `${effect.subjectName || effect.subjectPlayerId || "Player"} → ${effect.targetName || effect.targetId || "Target"}`);
      appendTextLine(card, `Tiempo restante: ${formatRemaining(effect, now)}`, "color:#e6c56c;");
      appendTextLine(card, effect.note || "", "font-size:11px;opacity:.8;margin-top:4px;");
      if (!isRequest) appendTextLine(card, `CHA Check · bono configurado: +${modifier} Check Power`, "font-size:11px;margin-top:4px;");
      const controls = global.document.createElement("div");
      controls.style.cssText = "display:flex;gap:6px;margin-top:6px;";
      const apply = global.document.createElement("button");
      apply.type = "button";
      if (isRequest) {
        apply.textContent = effect.response ? "RESPONDIDO" : "RESPONDER";
        apply.disabled = Boolean(effect.response);
        apply.onclick = () => {
          const response = global.prompt?.(effect.prompt || "Describe el resultado para el jugador:", effect.response || "");
          if (response == null || !String(response).trim()) return;
          updateEffect(effect.id, { response: String(response).trim(), respondedAt: Date.now(), active: false });
        };
      } else {
        apply.textContent = effect.approved ? "BONO LISTO" : "APLICAR AL PRÓXIMO CHA CHECK";
        apply.disabled = Boolean(effect.approved);
        apply.onclick = () => updateEffect(effect.id, { approved: true, approvedAt: Date.now() });
      }
      const disable = global.document.createElement("button");
      disable.type = "button";
      disable.textContent = "DESACTIVAR";
      disable.onclick = () => updateEffect(effect.id, { active: false, disabledAt: Date.now() });
      controls.append(apply, disable);
'''
if old not in t: raise SystemExit('dm renderer controls block missing')
t = t.replace(old, new, 1)
p.write_text(t, encoding='utf-8')

# 5) Regressions.
p = Path('tests/firebase_shared_trait_rules.spec.js')
t = p.read_text(encoding='utf-8')
t = t.replace('campaign.combate.plannedActions.$unitId.$slotIndex', 'campaign.combate.plannedActions.$ownerPlayerId.$slotIndex')
t = t.replace('  expect(plannedWrite).toContain("schedulerUid");\n', '  expect(plannedWrite).toContain("schedulerUid");\n  expect(plannedWrite).toContain("jugadores");\n  expect(plannedWrite).toContain("$ownerPlayerId");\n  expect(plannedWrite).toContain("scheduledBy");\n  expect(plannedWrite).toContain("!newData.exists()");\n')
p.write_text(t, encoding='utf-8')

p = Path('tests/racial_trait_engine_regressions.spec.js')
t = p.read_text(encoding='utf-8')
append = r'''

test("Moonfae Empathy registers a concrete DM request and returns no orphan flag", () => {
  const trait = racialCatalog.getDefinition("moonfae_empathy");
  const target = { id: "npc-heart", name: "Quiet Stranger" };
  let descriptor = null;
  const state = engine.createState();
  const result = engine.activateTrait(trait, {
    context: "theatre",
    character: { level: 20, proficiencyBonus: 3 },
    self: { level: 20 },
    target,
    registerDmEffect(value) { descriptor = value; return { id: "request-1", ...value }; },
  }, state);
  expect(result.available).toBeTruthy();
  expect(descriptor).toBeTruthy();
  expect(descriptor.kind).toBe("request");
  expect(descriptor.effectId).toBe("empathy_read");
  expect(descriptor.targetId).toBe("npc-heart");
  expect(state.flags?.empathy_read_requested).toBeUndefined();
});

test("shared Trait source binds Firebase owner buckets to actual combat Units", () => {
  const runtime = require("fs").readFileSync(require("path").join(__dirname, "..", "js", "player-trait-runtime.js"), "utf8");
  const viewer = require("fs").readFileSync(require("path").join(__dirname, "..", "Battle-viewer.html"), "utf8");
  expect(runtime).toContain("${SHARED_PLANNED_ACTIONS_ROOT}/${ownerPlayerId}/${slotIndex}");
  expect(runtime).toContain("scheduledBy: ownerPlayerId");
  expect(viewer).toContain("function combatUnitForOwner(ownerPlayerId)");
  expect(viewer).toContain("sharedOwnerPlayerId");
  expect(viewer).toContain("!attackVectors[attackerSlotId]");
});
'''
if 'Moonfae Empathy registers a concrete DM request' not in t: t += append
p.write_text(t, encoding='utf-8')

print('final Codex round fixes applied')
