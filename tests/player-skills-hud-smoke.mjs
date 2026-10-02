import assert from "node:assert/strict";

await import("../js/player-skills-hud.js");

const hud = globalThis.LuminousPlayerSkillsHud;
assert.ok(hud, "player skills HUD runtime should register");

const library = {
  slash_combo: {
    id: "slash_combo",
    name: "Slash Combo",
    tier: 1,
    type: "Attack",
    basePower: 4,
    coinPower: 3,
    coinAmount: 2,
    sinAffinity: "wrath",
    damageType: "cortante",
  },
  guard_break: {
    id: "guard_break",
    name: "Guard Break",
    tier: 2,
    type: "Attack",
    basePower: 8,
    coinPower: 2,
    coinAmount: 1,
  },
  veteran_feint: {
    id: "veteran_feint",
    name: "Veteran Feint",
    tier: 3,
    type: "Defense",
    basePower: 5,
    coinPower: 4,
    coinAmount: 1,
  },
};

const loadout = {
  skillSlotEntries(character = {}) {
    const deck = character.characterBuild?.skillDeck || {};
    const out = [];
    [[deck.tier1, 3], [deck.tier2, 2], [deck.tier3, 1]].forEach(([id, copies]) => {
      for (let index = 0; id && index < copies; index += 1) out.push({ index: out.length, skillId: id });
    });
    return out;
  },
  skillLibrary() {
    return library;
  },
};

const progression = {
  normalizeClasses(character = {}) {
    return character.characterBuild?.classes || [];
  },
  buildProgressionModel() {
    return {
      classes: [{
        classId: "fighter",
        commonNodes: [{
          level: 20,
          status: "earned",
          items: [{ id: "veteran_feint", kind: "skill" }],
        }],
        branches: [{
          id: "champion",
          status: "selected",
          nodes: [{
            level: 35,
            status: "future",
            items: [{ id: "future_skill", kind: "skill" }],
          }],
        }],
      }],
    };
  },
};

const fighter = {
  characterName: "Test Fighter",
  characterBuild: {
    classes: [{ classId: "fighter", levels: 40 }],
    skillDeck: { tier1: "slash_combo", tier2: "guard_break", tier3: "" },
  },
};

const fighterModel = hud.buildSkillViewModel(fighter, {
  skillLoadout: loadout,
  progressionCore: progression,
  spellcasting: { getClassSpellcastingProfile() { return null; } },
});

assert.equal(fighterModel.spellcaster, false);
assert.equal(fighterModel.assignedEntries.length, 5, "3/2/1 deck copies should match Combat loadout expansion");
assert.equal(fighterModel.assignedUnique, 2);
assert.equal(fighterModel.learnedUnique, 1);
assert.equal(fighterModel.skills.find((row) => row.id === "slash_combo")?.copies, 3);
assert.equal(fighterModel.skills.find((row) => row.id === "slash_combo")?.assigned, true);
assert.equal(fighterModel.skills.find((row) => row.id === "veteran_feint")?.learned, true);
assert.equal(fighterModel.skills.some((row) => row.id === "future_skill"), false, "future progression grants must not be shown as learned");

const indexOnlyLoadout = {
  skillSlotEntries() { return []; },
  skillIdsFor(character = {}) {
    return Object.entries(character.equippedSkillIndex || {})
      .filter(([, enabled]) => enabled === true)
      .map(([id]) => id);
  },
  skillLibrary() { return library; },
};
const indexOnlyModel = hud.buildSkillViewModel({
  equippedSkillIndex: { slash_combo: true, guard_break: true },
}, {
  skillLoadout: indexOnlyLoadout,
  progressionCore: { buildProgressionModel() { return { classes: [] }; }, normalizeClasses() { return []; } },
  spellcasting: { getClassSpellcastingProfile() { return null; } },
});
assert.equal(indexOnlyModel.assignedUnique, 2, "equippedSkillIndex-only Combat loadouts must remain visible as assigned");
assert.equal(indexOnlyModel.skills.find((row) => row.id === "slash_combo")?.assigned, true);

const filterRows = [
  { id: "assigned_only", assigned: true, learned: false },
  { id: "learned_only", assigned: false, learned: true },
];
assert.equal(hud.visibleSelectionId(filterRows.filter((row) => row.assigned), "learned_only"), "assigned_only", "filter changes must select a visible Skill");
assert.equal(hud.visibleSelectionId([], "assigned_only"), null, "empty filtered views must clear the detail selection");

const casterRuntime = {
  getClassSpellcastingProfile(classId) {
    if (classId === "wizard") return { classId, abilityId: "int", spellcastingStartLimbusLevel: 1 };
    if (classId === "paladin") return { classId, abilityId: "cha", spellcastingStartLimbusLevel: 10 };
    return null;
  },
};

const wizard = {
  characterBuild: {
    classes: [{ classId: "wizard", levels: 12 }],
    skillDeck: {},
  },
};
assert.equal(hud.isSpellcaster(wizard, { progressionCore: progression, spellcasting: casterRuntime }), true);

const novicePaladin = {
  characterBuild: {
    classes: [{ classId: "paladin", levels: 5 }],
    skillDeck: {},
  },
};
assert.equal(hud.isSpellcaster(novicePaladin, { progressionCore: progression, spellcasting: casterRuntime }), false, "half-caster icon should not switch before its Limbus casting start");

const castingPaladin = {
  characterBuild: {
    classes: [{ classId: "paladin", levels: 10 }],
    skillDeck: {},
  },
};
assert.equal(hud.isSpellcaster(castingPaladin, { progressionCore: progression, spellcasting: casterRuntime }), true);

assert.equal(hud.hudScaleForViewport(1600, 920) < 1, true, "HUD should leave its viewport gutter");
assert.equal(hud.hudScaleForViewport(2200, 1300), 1);
assert.equal(hud.HUD_CANVAS.width, 1600);
assert.equal(hud.HUD_CANVAS.height, 920);

console.log("player-skills-hud-smoke: ok");
