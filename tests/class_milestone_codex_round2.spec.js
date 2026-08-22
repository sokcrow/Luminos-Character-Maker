const { test, expect } = require("@playwright/test");
const fs = require("node:fs");
const path = require("node:path");

const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");

test("milestone submission keeps DOM updates scoped to the submitted player", () => {
  const source = read("js/dm-player-class-milestones.js");

  expect(source).toContain("const submittedPlayerId = state.playerId;");
  expect(source).toContain("state.db.ref(`${PLAYER_ROOT}/${submittedPlayerId}`)");
  expect(source).toContain("const samePlayer = state.playerId === submittedPlayerId;");
  expect(source).toContain("if (resultingStats && samePlayer)");
  expect(source).toContain('if (samePlayer) setFeedback("MILESTONE APLICADO Y GUARDADO.", "success")');
  expect(source).toContain('if (state.playerId === submittedPlayerId) setFeedback("ERROR AL GUARDAR EL MILESTONE.", "error")');
});

test("General Trait options exclude traits already selected by milestones", () => {
  const source = read("js/dm-player-class-milestones.js");

  expect(source).toContain("const selected = new Set(api.selectedGeneralTraitIds(state.player || {}));");
  expect(source).toContain(".filter((entry) => entry.id && !selected.has(entry.id))");
});

test("duplicate General Trait choice is revalidated inside the Firebase transaction", () => {
  const source = read("js/dm-player-class-milestones.js");

  expect(source).toContain("api.selectedGeneralTraitIds(current).includes(traitId)");
  expect(source).toContain('abortReason = "Ese Trait General ya fue elegido en otro milestone.";');
});
