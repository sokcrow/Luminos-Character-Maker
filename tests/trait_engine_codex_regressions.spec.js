const { test, expect } = require("@playwright/test");
const fs = require("node:fs");
const path = require("node:path");
const traits = require("../js/trait-engine.js");

const builderSource = fs.readFileSync(path.join(__dirname, "..", "js", "trait-builder.js"), "utf8");

test("mutation paths reject prototype-pollution segments before execution", () => {
  delete Object.prototype.traitPwned;

  expect(() => traits.setPath({}, "__proto__.traitPwned", 1)).toThrow(/Unsafe trait path segment/);
  expect(Object.prototype.traitPwned).toBeUndefined();

  const malicious = {
    id: "prototype_attack",
    effects: [{
      trigger: "on_use",
      operations: [{ type: "modify", path: "__proto__.traitPwned", mode: "set", value: 1 }],
    }],
  };
  const validation = traits.validateTrait(malicious);
  expect(validation.valid).toBe(false);
  expect(validation.errors.join(" ")).toContain("Unsafe trait path segment");
  expect(() => traits.dispatchTrait(malicious, "on_use", {})).toThrow(/Invalid Trait/);
  expect(Object.prototype.traitPwned).toBeUndefined();
});

test("dynamic Trait keys also reject prototype-sensitive identifiers", () => {
  const maliciousResource = {
    id: "resource_attack",
    effects: [{
      trigger: "on_use",
      operations: [{ type: "resource", resourceId: "__proto__", mode: "gain", value: 1 }],
    }],
  };
  const validation = traits.validateTrait(maliciousResource);
  expect(validation.valid).toBe(false);
  expect(validation.errors.join(" ")).toContain("unsafe key");
  expect(Object.prototype.value).toBeUndefined();
});

test("validator rejects operation types outside the V1 vocabulary", () => {
  const validation = traits.validateTrait({
    id: "unsupported_operation",
    effects: [{ trigger: "on_hit", operations: [{ type: "damage", value: 10 }] }],
  });

  expect(validation.valid).toBe(false);
  expect(validation.errors.join(" ")).toContain("unsupported operation type");
  expect(traits.OPERATION_TYPES).not.toContain("damage");
});

test("between conditions require max and execute when both bounds exist", () => {
  const missingMax = traits.validateTrait({
    id: "missing_between_max",
    effects: [{
      trigger: "before_check",
      conditions: [{ path: "check.score", operator: "between", value: 2 }],
      operations: [{ type: "log", message: "inside" }],
    }],
  });
  expect(missingMax.valid).toBe(false);
  expect(missingMax.errors.join(" ")).toContain("between operator requires max");

  const valid = {
    id: "valid_between",
    effects: [{
      trigger: "before_check",
      conditions: [{ path: "check.score", operator: "between", value: 2, max: 5 }],
      operations: [{ type: "log", message: "inside" }],
    }],
  };
  const result = traits.dispatchTrait(valid, "before_check", { check: { score: 4 } });
  expect(result.outcomes).toHaveLength(1);
});

test("Trait Builder emits a dedicated max bound for between", () => {
  expect(builderSource).toContain('input("conditionMax", "10 (required for BETWEEN)")');
  expect(builderSource).toContain('const conditionMax = parseLiteral(read("conditionMax"))');
  expect(builderSource).toContain('if (conditionOperator === "between") condition.max = conditionMax');
});
