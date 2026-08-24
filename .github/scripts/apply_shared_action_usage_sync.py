from pathlib import Path

p = Path('js/player-trait-runtime.js')
text = p.read_text(encoding='utf-8')

def rep(old, new, count=1):
    global text
    if old not in text:
        raise SystemExit('missing player runtime block')
    text = text.replace(old, new, count)

rep('''    dmEffects: {},
    dmEffectsBound: false,
  };''', '''    dmEffects: {},
    dmEffectsBound: false,
    sharedActions: {},
    sharedActionsBound: false,
    seenSharedActionResolutions: new Set(),
  };''')

marker = '''  function targetMatchesDmEffect(target, effect = {}) {'''
helper = '''  function processSharedActionResolutions() {
    const playerId = String(state.playerId || "").trim();
    if (!playerId) return 0;
    let changed = 0;
    const unit = currentCombatUnit();
    Object.entries(state.sharedActions || {}).forEach(([unitId, slots]) => {
      Object.entries(slots || {}).forEach(([slotIndexRaw, action]) => {
        if (!action || action.status !== "resolved" || !action.traitId) return;
        if (String(action.scheduledBy || "") !== playerId) return;
        const resolutionKey = `${unitId}:${slotIndexRaw}:${action.resolvedAt || "resolved"}`;
        if (state.seenSharedActionResolutions.has(resolutionKey)) return;
        state.seenSharedActionResolutions.add(resolutionKey);

        const trait = resolveTraits().find((entry) => normalizeId(entry?.id || entry?.name) === normalizeId(action.traitId));
        if (trait?.activation?.uses) {
          if (!state.traitState) state.traitState = global.LuminousTraitEngine?.createState?.() || { usages: {} };
          if (!state.traitState.usages) state.traitState.usages = {};
          const traitId = normalizeId(trait.id || trait.name);
          const record = state.traitState.usages[traitId] || (state.traitState.usages[traitId] = {
            used: 0,
            reset: normalizeId(trait.activation.uses.reset || "never"),
          });
          record.used = Math.max(0, Number(record.used || 0)) + 1;
          changed += 1;
        }

        if (unit && sharedUnitId(unit) === String(unitId)) {
          const slotIndex = Number(slotIndexRaw);
          if (Number.isInteger(slotIndex)) global.LuminousActionEconomy?.cancelAction?.(unit, slotIndex);
        }
      });
    });
    if (changed) refresh();
    return changed;
  }

'''
if marker not in text:
    raise SystemExit('shared resolution insertion marker missing')
text = text.replace(marker, helper + marker, 1)

rep('''    state.playerRef.on("value", state.playerListener);
    return true;
  }''', '''    state.playerRef.on("value", state.playerListener);
    processSharedActionResolutions();
    return true;
  }''')

rep('''    if (!state.dmEffectsBound) {
      state.dmEffectsBound = true;
      state.db.ref(DM_MANAGED_EFFECTS_ROOT).on("value", (snapshot) => { state.dmEffects = snapshot.val() || {}; });
    }
    return true;
  }''', '''    if (!state.dmEffectsBound) {
      state.dmEffectsBound = true;
      state.db.ref(DM_MANAGED_EFFECTS_ROOT).on("value", (snapshot) => { state.dmEffects = snapshot.val() || {}; });
    }
    if (!state.sharedActionsBound) {
      state.sharedActionsBound = true;
      state.db.ref(SHARED_PLANNED_ACTIONS_ROOT).on("value", (snapshot) => {
        state.sharedActions = snapshot.val() || {};
        processSharedActionResolutions();
      });
    }
    return true;
  }''')

p.write_text(text, encoding='utf-8')

p = Path('tests/universal_action_economy.spec.js')
test_text = p.read_text(encoding='utf-8')
test_text += '''\n\ntest("player runtime reconciles resolved shared Trait Actions into local usage state", () => {\n  const source = fs.readFileSync(path.join(__dirname, "..", "js", "player-trait-runtime.js"), "utf8");\n  expect(source).toContain("function processSharedActionResolutions()");\n  expect(source).toContain('action.status !== "resolved"');\n  expect(source).toContain('String(action.scheduledBy || "") !== playerId');\n  expect(source).toContain('record.used = Math.max(0, Number(record.used || 0)) + 1');\n  expect(source).toContain("LuminousActionEconomy?.cancelAction?.(unit, slotIndex)");\n  expect(source).toContain("state.db.ref(SHARED_PLANNED_ACTIONS_ROOT).on");\n});\n'''
p.write_text(test_text, encoding='utf-8')

print('shared Action usage reconciliation applied')
