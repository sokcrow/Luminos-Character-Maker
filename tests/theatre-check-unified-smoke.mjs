import fs from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";

const read = (name) => fs.readFileSync(name, "utf8");
const files = [
  "js/theatre-roll-visualizer.js",
  "js/theatre-check-coordinator.js",
  "js/theatre-opposed-checks.js",
  "js/dm-npc-rolls.js",
  "js/instance-control.js",
];
for (const file of files) new vm.Script(read(file), { filename: file });

const database = () => ({ ref: () => ({}) });
database.ServerValue = { TIMESTAMP: 1234 };
const doc = {
  readyState: "loading",
  addEventListener() {},
  body: { classList: { contains(name) { return name === "on-game-dashboard"; } } },
};
const world = {
  document: doc,
  firebase: { database, auth: () => ({ currentUser: { uid: "dm" } }) },
};
world.window = world;
vm.runInNewContext(read("js/theatre-roll-visualizer.js"), world, { filename: "roll" });
vm.runInNewContext(read("js/theatre-opposed-checks.js"), world, { filename: "opposed" });
vm.runInNewContext(read("js/dm-npc-rolls.js"), world, { filename: "npc" });

const rolls = world.LuminousTheatreRolls;
const opposed = world.LuminousTheatreOpposedChecks;
const tests = [];
const check = (label, test) => tests.push([label, test]);
const plain = (value) => JSON.parse(JSON.stringify(value));

check("01 null threshold remains absent", () => assert.equal(rolls.normalizeCheckContext({thresholdRaw:null}).thresholdRaw, null));
check("02 empty threshold remains absent", () => assert.equal(rolls.normalizeCheckContext({thresholdRaw:""}).thresholdRaw, null));
check("03 omitted threshold remains absent", () => assert.equal(rolls.effectiveThreshold({}), null));
check("04 numeric zero threshold is valid", () => assert.equal(rolls.effectiveThreshold({thresholdRaw:0}), 0));
check("05 public threshold comparison succeeds on equality", () => assert.equal(rolls.checkOutcome(15,{thresholdRaw:15}), "passed"));
check("06 public threshold comparison fails below threshold", () => assert.equal(rolls.checkOutcome(14,{thresholdRaw:15}), "failed"));
check("07 no threshold never auto-passes", () => assert.equal(rolls.checkOutcome(50,{thresholdRaw:null}), null));
check("08 advantage lowers threshold", () => assert.equal(rolls.effectiveThreshold({thresholdRaw:15,modifierValue:3,modifierType:"advantage"}),12));
check("09 disadvantage raises threshold", () => assert.equal(rolls.effectiveThreshold({thresholdRaw:15,modifierValue:3,modifierType:"disadvantage"}),18));
check("10 advantage never lowers below zero", () => assert.equal(rolls.effectiveThreshold({thresholdRaw:1,modifierValue:9,modifierType:"advantage"}),0));
check("11 mystery mode stays classified", () => assert.equal(rolls.normalizeCheckContext({thresholdRaw:null,hiddenThreshold:true,thresholdVisibility:"mystery"}).thresholdVisibility,"mystery"));
check("12 hidden mode stays classified", () => assert.equal(rolls.normalizeCheckContext({thresholdRaw:null,hiddenThreshold:true,thresholdVisibility:"hidden"}).thresholdVisibility,"hidden"));
check("13 opposed null threshold does not resolve", () => assert.equal(opposed.outcomeFor(12,null,{}),null));
check("14 opposed tie is success", () => assert.equal(opposed.outcomeFor(12,12,{}),"passed"));
check("15 opposed below target fails", () => assert.equal(opposed.outcomeFor(11,12,{}),"failed"));
check("16 opposed modifier advantage uses challenger target", () => assert.equal(opposed.effectiveThreshold(15,{modifierType:"advantage",modifierValue:2}),13));
check("17 opposed modifier disadvantage uses challenger target", () => assert.equal(opposed.effectiveThreshold(15,{modifierType:"disadvantage",modifierValue:2}),17));

const publicFull = {
  schemaVersion:3, visibility:"public", total:18, base:6, heads:3,
  check:{thresholdRaw:15,hiddenThreshold:false,modifierType:"neutral",modifierValue:0,outcome:"passed"},
  roller:{uid:"player",name:"Hero"}, durationMs:7000, roomId:"default",
};
check("18 public outcome is visible", () => assert.equal(rolls.buildPublicRollRecord(publicFull).check.outcome,"passed"));
check("19 public threshold is visible", () => assert.equal(rolls.buildPublicRollRecord(publicFull).check.thresholdRaw,15));
check("20 private threshold is never public", () => {
  const result = rolls.buildPublicRollRecord({...publicFull,check:{...publicFull.check,hiddenThreshold:true}});
  assert.equal(result.check.thresholdRaw, undefined);
});
check("21 private outcome can be shown without threshold", () => assert.equal(rolls.buildPublicRollRecord({...publicFull,check:{...publicFull.check,hiddenThreshold:true}}).check.outcome,"passed"));
check("22 no check threshold never becomes zero", () => {
  const result = rolls.buildPublicRollRecord({...publicFull,check:{thresholdRaw:null,hiddenThreshold:false,outcome:null}});
  assert.equal(result.check, undefined);
});
check("23 total-only roll conceals threshold", () => {
  const result = rolls.buildPublicRollRecord({...publicFull,visibility:"total"});
  assert.equal(result.check, undefined);
});
check("24 hidden roll conceals result number", () => {
  const result = rolls.buildPublicRollRecord({...publicFull,visibility:"hidden",hiddenOutput:"none"});
  assert.equal(result.total, undefined);
});
check("25 DM renderer exists only once for all Checks", () => {
  const files = read("js/theatre-opposed-checks.js");
  assert.ok(files.includes("createSharedCheckHud"));
  assert.ok(!files.includes('className = `theatre-opposed-hud'));
});
check("26 opposed does not replace Legacy close button", () => {
  const code = read("js/theatre-opposed-checks.js");
  assert.ok(!code.includes("cloneNode(true)"));
  assert.ok(!code.includes("beginVisualizerIsolation"));
});
check("27 NPC auto calls the canonical Coin Engine", () => {
  const code = read("js/dm-npc-rolls.js");
  assert.ok(code.includes("async function rollOpposedThreshold"));
  assert.ok(code.includes("LuminousCoinEngine.runAnimatedRoll"));
});
check("28 DM reveals only redacted threshold to player", () => {
  const code = read("js/theatre-check-coordinator.js");
  assert.ok(code.includes("thresholdRaw: null"));
  assert.ok(code.includes("dm_private/theatre_check_secrets"));
});
check("29 result paths are player-scoped", () => {
  const rules = JSON.parse(read("database.rules.json")).rules;
  assert.ok(rules.theatre_check_results?.$uid);
  assert.ok(rules.dm_private?.theatre_check_secrets);
});
check("30 player prompts escape the Stats stacking context", () => {
  const code = read("js/theatre-check-coordinator.js");
  assert.ok(code.includes("isDmSurface() ? root : doc.body"));
});
check("31 hidden controls do not use display none on Coin Engine", () => {
  const css = read("css/theatre-opposed-checks.css");
  assert.ok(css.includes("body.theatre-opposed-roll-active #coin-toss-panel{visibility:hidden"));
  assert.ok(!css.includes("body.theatre-opposed-roll-active #coin-toss-panel{display:none"));
});
check("32 DM has a responsive Check Director", () => {
  const css = read("css/theatre-check-coordinator.css");
  assert.ok(css.includes(".theatre-check-director-workspace"));
  assert.ok(css.includes("width: min(1120px"));
});
check("33 UI exposes exactly three threshold presentation modes", () => {
  const js = read("js/theatre-check-coordinator.js");
  assert.ok(js.includes('<option value="public">'));
  assert.ok(js.includes('<option value="mystery">'));
  assert.ok(js.includes('<option value="hidden">'));
});
check("34 NPC assets load into DM", () => {
  assert.ok(read("js/instance-control.js").includes("ensureDmNpcCheckAssets(documentRef)"));
});
check("35 legacy roll automation remains hidden only during Checks", () => {
  assert.ok(read("css/theatre-check-coordinator.css").includes("body.theatre-check-active #coin-toss-panel"));
});

for (const [label, fn] of tests) {
  try { fn(); console.log("OK:",label); }
  catch (error) { console.error("FAIL:",label); throw error; }
}
console.log(`Theatre Check unification: ${tests.length}/${tests.length} cases passed`);
