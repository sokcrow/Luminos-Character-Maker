from pathlib import Path
p = Path('tests/universal_action_economy.spec.js')
t = p.read_text(encoding='utf-8')
old_claim = 'claimSharedPlannedAction(attackerBaseId, slotIndex)'
new_claim = 'claimSharedPlannedAction(sharedOwnerPlayerId, slotIndex)'
old_finish = 'finishSharedPlannedAction(attackerBaseId, slotIndex, plannedResolution)'
new_finish = 'finishSharedPlannedAction(sharedOwnerPlayerId, slotIndex, plannedResolution)'
if old_claim not in t:
    raise SystemExit('stale claim assertion not found')
if old_finish not in t:
    raise SystemExit('stale finish assertion not found')
t = t.replace(old_claim, new_claim, 1)
t = t.replace(old_finish, new_finish, 1)
anchor = '  expect(viewer).toContain("resolvedSlots.add(attackerSlotId)");\n'
extra = '  expect(viewer).toContain("function combatUnitForOwner(ownerPlayerId)");\n  expect(viewer).toContain("!attackVectors[attackerSlotId]");\n'
if extra.strip() not in t:
    if anchor not in t:
        raise SystemExit('timeline assertion anchor not found')
    t = t.replace(anchor, anchor + extra, 1)
p.write_text(t, encoding='utf-8')
print('final Codex tests updated')
