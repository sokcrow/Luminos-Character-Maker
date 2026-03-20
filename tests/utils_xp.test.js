const assert = require('assert');
const { calculateLevelData } = require('../js/utils.js');

function runTest(description, xp, expectedLevel, expectedPercent, expectedMissing) {
    console.log("Running test:", description);
    const result = calculateLevelData(xp);
    try {
        assert.strictEqual(result.level, expectedLevel, "Expected level " + expectedLevel + ", but got " + result.level);
        assert.strictEqual(result.xpPercent, expectedPercent, "Expected xpPercent " + expectedPercent + ", but got " + result.xpPercent);
        assert.strictEqual(result.xpMissing, expectedMissing, "Expected xpMissing " + expectedMissing + ", but got " + result.xpMissing);
        console.log("  -> SUCCESS\n");
    } catch (e) {
        console.error("  -> FAILED:", e.message, "\n");
        process.exitCode = 1;
    }
}

// Level 1
runTest("Level 1 (0 XP)", 0, 1, 0, 60);
runTest("Level 1 (59 XP)", 59, 1, 98, 1);

// Level 2
runTest("Level 2 (60 XP)", 60, 2, 0, 60);

// Mid levels
runTest("Level 30 (21200 XP)", 21200, 30, 0, 1800);
runTest("Level 30+ (22100 XP)", 22100, 30, 50, 900); // 900 xp into level 30 out of 1800 needed

// High levels (Nivel 81: 225,000)
runTest("Level 81 (225000 XP)", 225000, 81, 0, 8000);
runTest("Level 81+ (229000 XP)", 229000, 81, 50, 4000);

// Max level (100)
runTest("Level 100 (395000 XP)", 395000, 100, 100, 0);
runTest("Level 100+ (500000 XP)", 500000, 100, 100, 0);

// String input support
runTest("String input '225000'", '225000', 81, 0, 8000);

// Edge Cases
runTest("Negative XP (-100)", -100, 1, 0, 60);
runTest("Invalid text ('abc')", 'abc', 1, 0, 60);

console.log("All tests completed.");
