(function (global) {
  "use strict";

  const doc = global.document;
  const engine = global.LuminousTraitEngine;
  if (!doc || !engine || global.LuminousTraitBuilder) return;

  const TRIGGER_OPTIONS = [
    "passive", "on_use", "encounter_start", "encounter_end", "turn_start", "turn_end",
    "before_check", "after_check", "before_skill", "after_skill", "before_clash", "clash_win",
    "clash_lose", "before_attack", "on_hit", "on_crit", "on_kill", "on_evade", "attack_end",
    "short_rest", "long_rest", "day_start",
  ];
  const CONDITION_OPERATORS = ["eq", "ne", "gt", "gte", "lt", "lte", "truthy", "falsy", "contains", "not_contains", "in", "not_in", "between"];
  const OPERATION_TYPES = ["modify", "resource", "apply_status", "remove_status", "heal_hp", "heal_sp", "gain_shield", "set_flag", "clear_flag", "log"];
  const MODIFY_MODES = ["add", "multiply", "set", "override", "min", "max"];
  const RESOURCE_MODES = ["gain", "spend", "set", "consume_all"];

  const $ = (id, root = doc) => root.querySelector(`#${id}`);
  const value = (id, root = doc) => String($(id, root)?.value ?? "").trim();

  function parseLiteral(raw) {
    const text = String(raw ?? "").trim();
    if (!text) return "";
    if (text === "true") return true;
    if (text === "false") return false;
    if (text === "null") return null;
    if (/^-?\d+(?:\.\d+)?$/.test(text)) return Number(text);
    if ((text.startsWith("[") && text.endsWith("]")) || (text.startsWith("{") && text.endsWith("}"))) {
      try { return JSON.parse(text); } catch (_) { return text; }
    }
    return text;
  }

  function selectOptions(select, values) {
    values.forEach((entry) => {
      const option = doc.createElement("option");
      option.value = entry;
      option.textContent = entry.replaceAll("_", " ").toUpperCase();
      select.appendChild(option);
    });
  }

  function field(label, input) {
    const wrapper = doc.createElement("label");
    wrapper.className = "trait-builder-field";
    const span = doc.createElement("span");
    span.textContent = label;
    wrapper.append(span, input);
    return wrapper;
  }

  function input(name, placeholder = "") {
    const node = doc.createElement("input");
    node.type = "text";
    node.dataset.field = name;
    node.placeholder = placeholder;
    return node;
  }

  function select(name, options) {
    const node = doc.createElement("select");
    node.dataset.field = name;
    selectOptions(node, options);
    return node;
  }

  function effectCard(seed = {}) {
    const card = doc.createElement("article");
    card.className = "trait-builder-effect";
    card.innerHTML = `<header><strong>EFFECT</strong><button type="button" data-remove-effect>REMOVE</button></header>`;

    const grid = doc.createElement("div");
    grid.className = "trait-builder-grid";
    const context = select("context", ["any", "theatre", "combat"]);
    const trigger = select("trigger", TRIGGER_OPTIONS);
    const conditionPath = input("conditionPath", "check.abilityId / skill.coinCount");
    const conditionOperator = select("conditionOperator", CONDITION_OPERATORS);
    const conditionValue = input("conditionValue", "dex / 5 / [\"insight\",\"perception\"]");
    const operationType = select("operationType", OPERATION_TYPES);
    const operationPath = input("operationPath", "check.finalPower / self.damagePercent");
    const operationMode = select("operationMode", MODIFY_MODES);
    const operationFormula = input("operationFormula", "2 / floor(ClassLevel / 7)");
    const resourceId = input("resourceId", "devil_gauge");
    const resourceMode = select("resourceMode", RESOURCE_MODES);
    const statusId = input("statusId", "rage");
    const duration = select("duration", Object.values(engine.DURATION_TYPES));
    const flagId = input("flagId", "spell_skills_blocked");
    const storeAs = input("storeAs", "ConsumedGauge");

    [
      field("Context", context), field("Trigger", trigger),
      field("Condition path / formula", conditionPath), field("Condition operator", conditionOperator), field("Condition value", conditionValue),
      field("Operation", operationType), field("Target path", operationPath), field("Modify mode", operationMode), field("Value / formula", operationFormula),
      field("Resource id", resourceId), field("Resource mode", resourceMode), field("Store result as", storeAs),
      field("Status id", statusId), field("Duration", duration), field("Flag id", flagId),
    ].forEach((node) => grid.appendChild(node));
    card.appendChild(grid);

    const set = (name, val) => {
      const node = card.querySelector(`[data-field="${name}"]`);
      if (node && val != null) node.value = val;
    };
    set("context", seed.context || "any");
    set("trigger", seed.trigger || "passive");
    set("conditionPath", seed.conditionPath || "");
    set("conditionOperator", seed.conditionOperator || "eq");
    set("conditionValue", seed.conditionValue || "");
    set("operationType", seed.operationType || "modify");
    set("operationPath", seed.operationPath || "");
    set("operationMode", seed.operationMode || "add");
    set("operationFormula", seed.operationFormula || "");
    set("resourceId", seed.resourceId || "");
    set("resourceMode", seed.resourceMode || "gain");
    set("storeAs", seed.storeAs || "");
    set("statusId", seed.statusId || "");
    set("duration", seed.duration || "immediate");
    set("flagId", seed.flagId || "");

    card.querySelector("[data-remove-effect]").addEventListener("click", () => {
      card.remove();
      updatePreview();
    });
    card.addEventListener("input", updatePreview);
    card.addEventListener("change", updatePreview);
    return card;
  }

  function readEffect(card, index) {
    const read = (name) => String(card.querySelector(`[data-field="${name}"]`)?.value ?? "").trim();
    const conditionPath = read("conditionPath");
    const conditionOperator = read("conditionOperator") || "eq";
    const conditionValue = parseLiteral(read("conditionValue"));
    const operationType = read("operationType");
    const operationFormula = read("operationFormula");
    const operation = { type: operationType };

    if (operationType === "modify") {
      operation.path = read("operationPath");
      operation.mode = read("operationMode") || "add";
      if (operationFormula) operation.formula = operationFormula;
      else operation.value = 0;
    } else if (operationType === "resource") {
      operation.resourceId = read("resourceId");
      operation.mode = read("resourceMode") || "gain";
      if (operationFormula) operation.formula = operationFormula;
      if (read("storeAs")) operation.storeAs = read("storeAs");
    } else if (["apply_status", "remove_status"].includes(operationType)) {
      operation.statusId = read("statusId");
      if (operationType === "apply_status") {
        operation.duration = read("duration") || "until_removed";
        if (operationFormula) operation.potency = { formula: operationFormula };
      }
    } else if (["heal_hp", "heal_sp", "gain_shield"].includes(operationType)) {
      if (read("operationPath")) operation.path = read("operationPath");
      if (operationFormula) operation.formula = operationFormula;
    } else if (["set_flag", "clear_flag"].includes(operationType)) {
      operation.flagId = read("flagId");
    } else if (operationType === "log") {
      operation.message = operationFormula;
    }

    const conditions = [];
    if (conditionPath) {
      if (conditionPath.startsWith("=")) conditions.push({ formula: conditionPath.slice(1), operator: conditionOperator, value: conditionValue });
      else conditions.push({ path: conditionPath, operator: conditionOperator, value: conditionValue });
    }

    return {
      id: `effect_${index + 1}`,
      context: read("context") || "any",
      trigger: read("trigger") || "passive",
      conditions,
      operations: [operation],
    };
  }

  function readTrait() {
    const contexts = [];
    if ($("trait-context-theatre")?.checked) contexts.push("theatre");
    if ($("trait-context-combat")?.checked) contexts.push("combat");
    if (!contexts.length) contexts.push("any");
    const activation = {
      type: value("trait-activation") || "passive",
      actionCost: value("trait-action-cost") || "none",
    };
    const usesFormula = value("trait-uses-formula");
    if (usesFormula) activation.uses = { formula: usesFormula, reset: value("trait-reset") || "never" };
    const sourceType = value("trait-source-type") || "special";
    const sourceId = value("trait-source-id");
    const effects = Array.from(doc.querySelectorAll("#trait-effects .trait-builder-effect")).map(readEffect);

    return {
      schemaVersion: engine.SCHEMA_VERSION,
      id: value("trait-id") || engine.normalizeId(value("trait-name")),
      name: value("trait-name"),
      description: value("trait-description"),
      source: { type: sourceType, id: sourceId, ...(sourceType === "class" ? { classId: sourceId } : {}) },
      contexts,
      activation,
      effects,
    };
  }

  function updatePreview() {
    const output = $("trait-json-output");
    const validationNode = $("trait-validation");
    if (!output || !validationNode) return;
    const trait = readTrait();
    const validation = engine.validateTrait(trait);
    output.textContent = JSON.stringify(validation.trait, null, 2);
    validationNode.className = `trait-validation ${validation.valid ? "is-valid" : "is-invalid"}`;
    validationNode.textContent = validation.valid
      ? (validation.warnings.length ? `VALID · ${validation.warnings.join(" · ")}` : "VALID TRAIT")
      : validation.errors.join(" · ");
  }

  function addEffect(seed) {
    $("trait-effects")?.appendChild(effectCard(seed));
    updatePreview();
  }

  async function copyJson() {
    const validation = engine.validateTrait(readTrait());
    if (!validation.valid) return false;
    const text = JSON.stringify(validation.trait, null, 2);
    if (global.navigator?.clipboard?.writeText) await global.navigator.clipboard.writeText(text);
    return text;
  }

  function saveLocal() {
    const validation = engine.validateTrait(readTrait());
    if (!validation.valid) return false;
    const key = `luminous_trait_${validation.trait.id}`;
    global.localStorage?.setItem(key, JSON.stringify(validation.trait));
    return key;
  }

  function boot() {
    if (!$("trait-builder-root")) return;
    $("trait-add-effect")?.addEventListener("click", () => addEffect());
    $("trait-copy-json")?.addEventListener("click", () => copyJson().catch(console.error));
    $("trait-save-local")?.addEventListener("click", saveLocal);
    $("trait-builder-root")?.addEventListener("input", updatePreview);
    $("trait-builder-root")?.addEventListener("change", updatePreview);
    if (!$("trait-effects")?.children.length) addEffect({
      trigger: "before_check",
      context: "theatre",
      conditionPath: "check.abilityId",
      conditionOperator: "eq",
      conditionValue: "dex",
      operationType: "modify",
      operationPath: "check.difficulty",
      operationMode: "add",
      operationFormula: "-4",
    });
    updatePreview();
  }

  const api = Object.freeze({ readTrait, updatePreview, addEffect, copyJson, saveLocal, parseLiteral });
  global.LuminousTraitBuilder = api;
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})(typeof window !== "undefined" ? window : globalThis);
