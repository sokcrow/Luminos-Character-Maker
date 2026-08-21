(function (global) {
  "use strict";

  const SCHEMA_VERSION = 1;
  const CONTEXTS = Object.freeze({ ANY: "any", THEATRE: "theatre", COMBAT: "combat" });
  const ACTIVATION_TYPES = Object.freeze({ PASSIVE: "passive", AUTOMATIC: "automatic", MANUAL: "manual", PROMPT: "prompt", CHOICE: "choice" });
  const ACTION_COSTS = Object.freeze({ NONE: "none", ACTION: "action", QUICK_ACTION: "quick_action", REACTION: "reaction", SPECIAL: "special" });
  const TRIGGERS = Object.freeze({
    PASSIVE: "passive", ON_USE: "on_use", ENCOUNTER_START: "encounter_start", ENCOUNTER_END: "encounter_end",
    TURN_START: "turn_start", TURN_END: "turn_end", BEFORE_CHECK: "before_check", AFTER_CHECK: "after_check",
    BEFORE_SKILL: "before_skill", AFTER_SKILL: "after_skill", BEFORE_CLASH: "before_clash", CLASH_WIN: "clash_win",
    CLASH_LOSE: "clash_lose", BEFORE_ATTACK: "before_attack", ON_HIT: "on_hit", ON_CRIT: "on_crit",
    ON_KILL: "on_kill", ON_EVADE: "on_evade", ATTACK_END: "attack_end", SHORT_REST: "short_rest",
    LONG_REST: "long_rest", DAY_START: "day_start",
  });
  const RESET_SCOPES = Object.freeze({ TURN: "turn", ENCOUNTER: "encounter", SHORT_REST: "short_rest", LONG_REST: "long_rest", DAY: "day", NEVER: "never" });
  const DURATION_TYPES = Object.freeze({ IMMEDIATE: "immediate", THIS_SKILL: "this_skill", THIS_TURN: "this_turn", NEXT_TURN: "next_turn", NEXT_SKILL: "next_skill", ENCOUNTER: "encounter", UNTIL_REMOVED: "until_removed", PERMANENT: "permanent" });
  const OPERATION_TYPES = Object.freeze(["modify", "resource", "apply_status", "remove_status", "heal_hp", "heal_sp", "gain_shield", "set_flag", "clear_flag", "log"]);
  const CONDITION_OPERATORS = Object.freeze(["eq", "equals", "ne", "not_equals", "gt", "gte", "lt", "lte", "truthy", "falsy", "contains", "not_contains", "in", "not_in", "between"]);
  const FORBIDDEN_PATH_SEGMENTS = new Set(["__proto__", "prototype", "constructor"]);
  const ALLOWED_FUNCTIONS = Object.freeze({ floor: Math.floor, ceil: Math.ceil, round: Math.round, abs: Math.abs, min: Math.min, max: Math.max, clamp: (v, lo, hi) => Math.max(lo, Math.min(hi, v)) });

  const num = (v, fallback = 0) => Number.isFinite(Number(v)) ? Number(v) : fallback;
  const int = (v, fallback = 0) => Number.isFinite(Number.parseInt(v, 10)) ? Number.parseInt(v, 10) : fallback;
  const normalizeId = (v) => String(v ?? "").trim().toLowerCase().replace(/\s+/g, "_");
  const clone = (v) => v == null ? v : JSON.parse(JSON.stringify(v));

  function assertSafeKey(value, label = "Trait key") {
    const key = normalizeId(value);
    if (FORBIDDEN_PATH_SEGMENTS.has(key)) throw new Error(`${label} uses unsafe key: ${key}`);
    return key;
  }

  function pathParts(path, required = false) {
    const parts = String(path || "").split(".").filter(Boolean);
    if (required && !parts.length) throw new Error("Trait operation requires a target path.");
    const forbidden = parts.find((part) => FORBIDDEN_PATH_SEGMENTS.has(part));
    if (forbidden) throw new Error(`Unsafe trait path segment: ${forbidden}`);
    return parts;
  }

  function getPath(root, path, fallback) {
    let cur = root;
    for (const key of pathParts(path)) {
      if (cur == null || !Object.prototype.hasOwnProperty.call(Object(cur), key)) return fallback;
      cur = cur[key];
    }
    return cur === undefined ? fallback : cur;
  }

  function setPath(root, path, value) {
    const parts = pathParts(path, true);
    let cur = root;
    for (const key of parts.slice(0, -1)) {
      if (!Object.prototype.hasOwnProperty.call(Object(cur), key) || !cur[key] || typeof cur[key] !== "object") cur[key] = {};
      cur = cur[key];
    }
    cur[parts.at(-1)] = value;
    return value;
  }

  function classEntries(character = {}) {
    if (Array.isArray(character.classes)) return character.classes.map((x) => ({ classId: normalizeId(x?.classId || x?.id), levels: Math.max(0, int(x?.levels ?? x?.level)) })).filter((x) => x.classId && x.levels);
    const source = character.classLevels || character.classesById || {};
    return Object.entries(source).map(([classId, levels]) => ({ classId: normalizeId(classId), levels: Math.max(0, int(levels?.levels ?? levels?.level ?? levels)) })).filter((x) => x.classId && x.levels);
  }

  function getClassLevel(character = {}, classId) {
    return classEntries(character).find((x) => x.classId === normalizeId(classId))?.levels || 0;
  }

  function statMod(score) { return Math.floor((num(score, 10) - 10) / 2); }

  function buildVariables(character = {}, runtime = {}, trait = {}) {
    const level = Math.max(0, int(runtime.Level ?? runtime.level ?? character.level));
    const source = trait.source || {};
    const classId = normalizeId(source.type || trait.sourceType) === "class" ? normalizeId(source.classId || source.id || trait.sourceId) : normalizeId(runtime.sourceClassId);
    const stats = character.stats || {};
    const combat = character.combatStats || {};
    return Object.assign({
      Level: level,
      ClassLevel: classId ? getClassLevel(character, classId) : Math.max(0, int(runtime.ClassLevel ?? runtime.classLevel)),
      Proficiency: num(runtime.Proficiency ?? character.proficiency, Math.ceil(level / 20)),
      StrengthMod: num(runtime.StrengthMod, statMod(stats.fuerza ?? stats.strength ?? character.strength)),
      DexterityMod: num(runtime.DexterityMod, statMod(stats.destreza ?? stats.dexterity ?? character.dexterity)),
      ConstitutionMod: num(runtime.ConstitutionMod, statMod(stats.constitucion ?? stats.constitution ?? character.constitution)),
      IntelligenceMod: num(runtime.IntelligenceMod, statMod(stats.inteligencia ?? stats.intelligence ?? character.intelligence)),
      WisdomMod: num(runtime.WisdomMod, statMod(stats.sabiduria ?? stats.wisdom ?? character.wisdom)),
      CharismaMod: num(runtime.CharismaMod, statMod(stats.carisma ?? stats.charisma ?? character.charisma)),
      OffensiveLevel: num(runtime.OffensiveLevel ?? runtime.offensiveLevel ?? combat.offensiveLevel ?? combat.off_level ?? character.offensiveLevel, level),
      DefensiveLevel: num(runtime.DefensiveLevel ?? runtime.defensiveLevel ?? combat.defensiveLevel ?? combat.def_level ?? character.defensiveLevel, level),
      MinSpeed: num(runtime.MinSpeed ?? runtime.minSpeed ?? combat.minSpeed ?? character.minSpeed),
      MaxSpeed: num(runtime.MaxSpeed ?? runtime.maxSpeed ?? combat.maxSpeed ?? character.maxSpeed),
      MaxHP: num(runtime.MaxHP ?? runtime.maxHp ?? combat.hp_max ?? character.maxHp), CurrentHP: num(runtime.CurrentHP ?? runtime.currentHp ?? combat.hp_actual ?? character.currentHp),
      MaxSP: num(runtime.MaxSP ?? runtime.maxSp ?? combat.sp_max ?? character.maxSp), CurrentSP: num(runtime.CurrentSP ?? runtime.currentSp ?? combat.sp_actual ?? character.sp),
      SkillCoinCount: num(runtime.SkillCoinCount ?? getPath(runtime, "skill.coinCount")), SkillWeight: num(runtime.SkillWeight ?? getPath(runtime, "skill.weight")), SpellSlotLevel: num(runtime.SpellSlotLevel ?? getPath(runtime, "skill.spellSlotLevel")),
      TargetLevel: num(runtime.TargetLevel ?? getPath(runtime, "target.level")), TargetMaxHP: num(runtime.TargetMaxHP ?? getPath(runtime, "target.maxHp")), TargetCurrentHP: num(runtime.TargetCurrentHP ?? getPath(runtime, "target.currentHp")),
      TargetOffensiveLevel: num(runtime.TargetOffensiveLevel ?? getPath(runtime, "target.offensiveLevel")), TargetDefensiveLevel: num(runtime.TargetDefensiveLevel ?? getPath(runtime, "target.defensiveLevel")),
      AliveAllies: num(runtime.AliveAllies ?? runtime.aliveAllies), AliveEnemies: num(runtime.AliveEnemies ?? runtime.aliveEnemies), TurnNumber: num(runtime.TurnNumber ?? runtime.turnNumber), RoundNumber: num(runtime.RoundNumber ?? runtime.roundNumber),
    }, runtime.variables || {});
  }

  function tokenize(source) {
    const text = String(source ?? "0").trim();
    const out = [];
    for (let i = 0; i < text.length;) {
      const c = text[i];
      if (/\s/.test(c)) { i += 1; continue; }
      if (/[0-9.]/.test(c)) {
        const start = i; while (i < text.length && /[0-9.]/.test(text[i])) i += 1;
        const raw = text.slice(start, i); if (!/^\d*\.?\d+$/.test(raw)) throw new Error(`Invalid number in formula: ${raw}`);
        out.push(["n", Number(raw)]); continue;
      }
      if (/[A-Za-z_]/.test(c)) {
        const start = i; while (i < text.length && /[A-Za-z0-9_.]/.test(text[i])) i += 1;
        out.push(["id", text.slice(start, i)]); continue;
      }
      if ("+-*/%(),".includes(c)) { out.push([c, c]); i += 1; continue; }
      throw new Error(`Unsupported token in formula: ${c}`);
    }
    out.push(["eof", null]); return out;
  }

  function evaluateFormula(formula, vars = {}) {
    if (formula == null || formula === "") return 0;
    if (typeof formula === "number") return Number.isFinite(formula) ? formula : 0;
    const t = tokenize(formula); let i = 0;
    const peek = () => t[i][0];
    const take = (type) => { if (peek() !== type) throw new Error(`Expected ${type}, received ${peek()}.`); return t[i++][1]; };
    const variable = (name) => { const key = Object.keys(vars).find((k) => k.toLowerCase() === name.toLowerCase()); return num(key ? vars[key] : 0); };
    let expression;
    const primary = () => {
      if (peek() === "n") return take("n");
      if (peek() === "id") {
        const name = take("id");
        if (peek() !== "(") return variable(name);
        take("("); const args = [];
        if (peek() !== ")") { do { args.push(expression()); if (peek() !== ",") break; take(","); } while (true); }
        take(")"); const fn = ALLOWED_FUNCTIONS[name.toLowerCase()]; if (!fn) throw new Error(`Formula function is not allowed: ${name}`);
        return num(fn(...args));
      }
      if (peek() === "(") { take("("); const v = expression(); take(")"); return v; }
      throw new Error(`Unexpected formula token: ${peek()}`);
    };
    const unary = () => peek() === "+" ? (take("+"), unary()) : peek() === "-" ? (take("-"), -unary()) : primary();
    const term = () => { let v = unary(); while (["*", "/", "%"].includes(peek())) { const op = take(peek()), r = unary(); if ((op === "/" || op === "%") && r === 0) return 0; v = op === "*" ? v * r : op === "/" ? v / r : v % r; } return v; };
    expression = () => { let v = term(); while (["+", "-"].includes(peek())) { const op = take(peek()), r = term(); v = op === "+" ? v + r : v - r; } return v; };
    const result = expression(); if (peek() !== "eof") throw new Error("Unexpected trailing formula input."); return num(result);
  }

  function normalizeContexts(v) { return [...new Set((Array.isArray(v) ? v : v ? [v] : ["any"]).map(normalizeId).filter(Boolean))]; }
  function contextMatches(expected, actual) { const list = normalizeContexts(expected); return list.includes("any") || list.includes(normalizeId(actual || "any")); }

  function normalizeTrait(input = {}) {
    const t = clone(input) || {};
    t.schemaVersion = int(t.schemaVersion, SCHEMA_VERSION); t.id = normalizeId(t.id || t.name); t.name = String(t.name || t.id || "Unnamed Trait").trim();
    t.contexts = normalizeContexts(t.contexts || t.context); t.source = Object.assign({ type: "special", id: "" }, t.source || {});
    t.source.type = normalizeId(t.source.type || t.sourceType || "special"); t.source.id = normalizeId(t.source.id || t.sourceId || t.source.classId); if (t.source.type === "class") t.source.classId = normalizeId(t.source.classId || t.source.id);
    t.activation = Object.assign({ type: "passive", actionCost: "none" }, t.activation || {}); t.activation.type = normalizeId(t.activation.type); t.activation.actionCost = normalizeId(t.activation.actionCost || "none");
    t.effects = (Array.isArray(t.effects) ? t.effects : []).map((e, idx) => { const x = clone(e) || {}; x.id = normalizeId(x.id || `${t.id}_effect_${idx + 1}`); x.contexts = normalizeContexts(x.contexts || x.context || t.contexts); x.trigger = normalizeId(x.trigger || "passive"); x.conditions = Array.isArray(x.conditions) ? x.conditions : x.condition ? [x.condition] : []; x.operations = Array.isArray(x.operations) ? x.operations : x.operation ? [x.operation] : []; return x; });
    return t;
  }

  function validatePath(path, label, errors, required = false) {
    try { pathParts(path, required); } catch (error) { errors.push(`${label}: ${error.message}`); }
  }

  function validateTrait(input = {}) {
    const trait = normalizeTrait(input), errors = [], warnings = [];
    if (!trait.id) errors.push("Trait requires an id or name.");
    else try { assertSafeKey(trait.id, "Trait id"); } catch (error) { errors.push(error.message); }
    if (!Object.values(ACTIVATION_TYPES).includes(trait.activation.type)) errors.push(`Unknown activation type: ${trait.activation.type}`);
    if (!Object.values(ACTION_COSTS).includes(trait.activation.actionCost)) errors.push(`Unknown action cost: ${trait.activation.actionCost}`);
    const formula = (f, label) => { if (f == null || f === "") return; try { evaluateFormula(f, {}); } catch (e) { errors.push(`${label}: ${e.message}`); } };
    formula(trait.activation?.uses?.formula, `${trait.id} uses formula`);
    trait.effects.forEach((effect) => {
      if (!effect.operations.length) warnings.push(`${effect.id} has no operations.`);
      effect.conditions.forEach((c, idx) => {
        const label = `${effect.id} condition ${idx + 1}`;
        formula(c?.formula, label); formula(c?.valueFormula, `${label} value`);
        if (c?.path) validatePath(c.path, `${label} path`, errors);
        const op = normalizeId(c?.operator || "eq");
        if (!CONDITION_OPERATORS.includes(op)) errors.push(`${label} has unsupported operator: ${c?.operator}`);
        if (op === "between" && c?.max == null) errors.push(`${label} between operator requires max.`);
      });
      effect.operations.forEach((op, idx) => {
        const type = normalizeId(op?.type), label = `${effect.id} operation ${idx + 1}`;
        if (!type) errors.push(`${effect.id} contains an operation without type.`);
        else if (!OPERATION_TYPES.includes(type)) errors.push(`${effect.id} contains unsupported operation type: ${op?.type}`);
        if (type === "modify") validatePath(op.path, `${effect.id} modify operation path`, errors, true);
        if (type === "resource" && !op.resourceId) errors.push(`${effect.id} resource operation requires resourceId.`);
        if (type === "resource" && op.resourceId) try { assertSafeKey(op.resourceId, `${label} resourceId`); } catch (error) { errors.push(error.message); }
        if (type === "resource" && op.storeAs) try { assertSafeKey(op.storeAs, `${label} storeAs`); } catch (error) { errors.push(error.message); }
        if (["apply_status", "remove_status"].includes(type) && !op.statusId) errors.push(`${effect.id} ${type} requires statusId.`);
        if (["apply_status", "remove_status"].includes(type) && op.statusId) try { assertSafeKey(op.statusId, `${label} statusId`); } catch (error) { errors.push(error.message); }
        if (["set_flag", "clear_flag"].includes(type) && (op.flagId || op.path)) try { assertSafeKey(op.flagId || op.path, `${label} flagId`); } catch (error) { errors.push(error.message); }
        if (["heal_hp", "heal_sp", "gain_shield"].includes(type) && op.path) validatePath(op.path, `${label} path`, errors);
        if (["heal_hp", "heal_sp", "gain_shield"].includes(type) && op.maxPath) validatePath(op.maxPath, `${label} maxPath`, errors);
        formula(op?.formula, label); formula(op?.value?.formula, `${label} value`);
      });
    });
    return { valid: !errors.length, errors, warnings, trait };
  }

  function createState(initial = {}) { return { resources: clone(initial.resources || {}), statuses: clone(initial.statuses || {}), usages: clone(initial.usages || {}), choices: clone(initial.choices || {}), flags: clone(initial.flags || {}), history: clone(initial.history || []) }; }
  function environment(trait, runtime, state) { const character = runtime.character || runtime.self || {}; return { trait, runtime, state, context: runtime.context || "any", variables: buildVariables(character, runtime, trait) }; }
  function valueOf(v, env, fallback = 0) { if (v && typeof v === "object" && v.formula != null) return evaluateFormula(v.formula, env.variables); if (typeof v === "string" && /[A-Za-z()+*/%]/.test(v)) return evaluateFormula(v, env.variables); return num(v, fallback); }

  function conditionMatches(c, env) {
    if (!c || typeof c !== "object") return Boolean(c);
    if (Array.isArray(c.all)) return c.all.every((x) => conditionMatches(x, env)); if (Array.isArray(c.any)) return c.any.some((x) => conditionMatches(x, env)); if (c.not) return !conditionMatches(c.not, env);
    const left = c.formula != null ? evaluateFormula(c.formula, env.variables) : c.resourceId ? num(env.state.resources[normalizeId(c.resourceId)]?.value) : c.statusId ? Boolean(env.state.statuses[normalizeId(c.statusId)]) : c.variable ? env.variables[c.variable] : c.path ? getPath(env.runtime, c.path) : c.left;
    const right = c.valueFormula != null ? evaluateFormula(c.valueFormula, env.variables) : c.value, op = normalizeId(c.operator || "eq");
    if (["eq", "equals"].includes(op)) return left === right; if (["ne", "not_equals"].includes(op)) return left !== right;
    if (op === "gt") return Number(left) > Number(right); if (op === "gte") return Number(left) >= Number(right); if (op === "lt") return Number(left) < Number(right); if (op === "lte") return Number(left) <= Number(right);
    if (op === "truthy") return Boolean(left); if (op === "falsy") return !left; if (op === "contains") return Array.isArray(left) ? left.includes(right) : String(left ?? "").includes(String(right ?? "")); if (op === "not_contains") return !(Array.isArray(left) ? left.includes(right) : String(left ?? "").includes(String(right ?? "")));
    if (op === "in") return Array.isArray(right) && right.includes(left); if (op === "not_in") return Array.isArray(right) && !right.includes(left); if (op === "between") return Number(left) >= Number(right) && Number(left) <= Number(c.max);
    throw new Error(`Unsupported trait condition operator: ${c.operator}`);
  }
  function conditionsMatch(list, env) { return (list || []).every((c) => conditionMatches(c, env)); }

  function mutate(root, path, mode, amount) {
    const before = num(getPath(root, path)), m = normalizeId(mode || "add"); let after;
    if (m === "add") after = before + amount; else if (m === "multiply") after = before * amount; else if (["set", "override"].includes(m)) after = amount; else if (m === "min") after = Math.max(before, amount); else if (m === "max") after = Math.min(before, amount); else throw new Error(`Unsupported trait modification mode: ${mode}`);
    setPath(root, path, after); return { before, after, delta: after - before };
  }

  function executeOperation(operation, env, effect) {
    const op = clone(operation) || {}, type = normalizeId(op.type), amount = op.formula != null ? evaluateFormula(op.formula, env.variables) : valueOf(op.value, env), base = { type, traitId: env.trait.id, effectId: effect.id }; let out;
    if (type === "modify") out = Object.assign(base, { path: op.path, mode: normalizeId(op.mode || "add"), amount }, mutate(env.runtime, op.path, op.mode, amount));
    else if (type === "resource") {
      const id = assertSafeKey(op.resourceId, "Resource id"); if (!env.state.resources[id]) env.state.resources[id] = { value: valueOf(op.definition?.initial, env), min: num(op.definition?.min), max: op.definition?.max == null ? null : Math.max(0, valueOf(op.definition.max, env)) };
      const r = env.state.resources[id], before = num(r.value), mode = normalizeId(op.mode || "gain"); let after = mode === "consume_all" ? 0 : mode === "set" ? amount : mode === "spend" || mode === "subtract" ? before - amount : before + amount;
      if (r.max != null) after = Math.min(num(r.max), after); after = Math.max(num(r.min), after); r.value = after; if (op.storeAs) env.variables[assertSafeKey(op.storeAs, "Resource storeAs")] = mode === "consume_all" ? before : Math.abs(after - before); out = Object.assign(base, { resourceId: id, mode, before, after, amount: mode === "consume_all" ? before : amount });
    } else if (type === "apply_status") {
      const id = assertSafeKey(op.statusId, "Status id"); env.state.statuses[id] = { id, name: op.name || id, potency: valueOf(op.potency ?? op.value, env), count: valueOf(op.count ?? 1, env, 1), duration: normalizeId(op.duration || "until_removed"), sourceTraitId: env.trait.id, sourceUnitId: env.runtime.sourceUnitId || env.runtime.character?.id || null, data: clone(op.data || {}) }; out = Object.assign(base, { statusId: id, status: clone(env.state.statuses[id]) });
    } else if (type === "remove_status") { const id = assertSafeKey(op.statusId, "Status id"), removed = Boolean(env.state.statuses[id]); delete env.state.statuses[id]; out = Object.assign(base, { statusId: id, removed }); }
    else if (["heal_hp", "heal_sp", "gain_shield"].includes(type)) { const path = op.path || (type === "heal_hp" ? "self.currentHp" : type === "heal_sp" ? "self.currentSp" : "self.shield"), m = mutate(env.runtime, path, "add", amount); if (op.maxPath) setPath(env.runtime, path, Math.min(num(getPath(env.runtime, op.maxPath), m.after), m.after)); out = Object.assign(base, { path, amount, before: m.before, after: num(getPath(env.runtime, path), m.after) }); }
    else if (type === "set_flag") { const id = assertSafeKey(op.flagId || op.path, "Flag id"); env.state.flags[id] = op.value == null ? true : op.value; out = Object.assign(base, { flagId: id, value: env.state.flags[id] }); }
    else if (type === "clear_flag") { const id = assertSafeKey(op.flagId || op.path, "Flag id"); delete env.state.flags[id]; out = Object.assign(base, { flagId: id, cleared: true }); }
    else if (type === "log") out = Object.assign(base, { message: String(op.message || "") }); else throw new Error(`Unsupported trait operation type: ${op.type}`);
    env.state.history.push(Object.assign({ at: Date.now() }, clone(out))); return out;
  }

  function dispatchTrait(input, trigger, runtime = {}, stateInput) {
    const validation = validateTrait(input);
    if (!validation.valid) throw new Error(`Invalid Trait ${validation.trait.id || "<unknown>"}: ${validation.errors.join(" | ")}`);
    const trait = validation.trait, state = stateInput || createState(), env = environment(trait, runtime, state), outcomes = [];
    trait.effects.forEach((effect) => { if (effect.trigger === normalizeId(trigger) && contextMatches(effect.contexts, env.context) && conditionsMatch(effect.conditions, env)) effect.operations.forEach((op) => outcomes.push(executeOperation(op, env, effect))); });
    return { trait, state, runtime, variables: env.variables, outcomes };
  }
  function dispatchTraits(traits, trigger, runtime = {}, stateInput) { const state = stateInput || createState(), outcomes = []; (traits || []).forEach((t) => outcomes.push(...dispatchTrait(t, trigger, runtime, state).outcomes)); return { state, runtime, outcomes }; }
  function usageRecord(state, trait) { const id = assertSafeKey(trait.id, "Trait id"); if (!state.usages[id]) state.usages[id] = { used: 0, reset: normalizeId(trait.activation?.uses?.reset || "never") }; return state.usages[id]; }
  function maxUses(trait, runtime) { const uses = trait.activation?.uses; if (!uses) return null; const env = environment(trait, runtime, createState()), v = uses.formula != null ? evaluateFormula(uses.formula, env.variables) : valueOf(uses.max ?? uses.value, env); return Math.max(0, Math.floor(v)); }
  function actionAvailable(runtime, cost) { const c = normalizeId(cost || "none"); if (["none", "special"].includes(c) || !runtime.actionEconomy) return true; return num(runtime.actionEconomy[c] ?? getPath(runtime.actionEconomy, `available.${c}`)) > 0; }

  function canActivateTrait(input, runtime = {}, stateInput) {
    const validation = validateTrait(input), state = stateInput || createState();
    if (!validation.valid) return { available: false, reasons: validation.errors.slice(), maximum: null, remaining: null, actionCost: validation.trait.activation.actionCost, trait: validation.trait, state };
    const trait = validation.trait, activation = trait.activation, env = environment(trait, runtime, state), reasons = [];
    if (!["manual", "prompt", "choice"].includes(activation.type)) reasons.push("Trait is not player-activated."); if (!contextMatches(trait.contexts, runtime.context)) reasons.push(`Trait is not available in ${runtime.context || "any"}.`); if (!conditionsMatch(activation.conditions || [], env)) reasons.push("Activation conditions are not met."); if (!actionAvailable(runtime, activation.actionCost)) reasons.push(`No ${activation.actionCost} remaining.`);
    const maximum = maxUses(trait, runtime), record = usageRecord(state, trait), remaining = maximum == null ? null : Math.max(0, maximum - record.used); if (maximum != null && remaining <= 0) reasons.push(`No uses remaining until ${record.reset}.`);
    return { available: !reasons.length, reasons, maximum, remaining, actionCost: activation.actionCost, trait, state };
  }

  function activateTrait(input, runtime = {}, stateInput) {
    const state = stateInput || createState(), check = canActivateTrait(input, runtime, state); if (!check.available) return Object.assign(check, { outcomes: [] }); const trait = check.trait, cost = trait.activation.actionCost;
    if (!["none", "special"].includes(cost) && runtime.actionEconomy) { if (Object.prototype.hasOwnProperty.call(runtime.actionEconomy, cost)) runtime.actionEconomy[cost] = Math.max(0, num(runtime.actionEconomy[cost]) - 1); else if (runtime.actionEconomy.available) runtime.actionEconomy.available[cost] = Math.max(0, num(runtime.actionEconomy.available[cost]) - 1); }
    const record = usageRecord(state, trait); if (check.maximum != null) record.used += 1; if (trait.activation.type === "choice" && runtime.choice != null) state.choices[assertSafeKey(trait.id, "Trait id")] = clone(runtime.choice);
    const result = dispatchTrait(trait, "on_use", runtime, state); return { available: true, reasons: [], maximum: check.maximum, remaining: check.maximum == null ? null : Math.max(0, check.maximum - record.used), actionCost: cost, trait, state, runtime, outcomes: result.outcomes };
  }

  function resetUsage(state, scope) { Object.values(state?.usages || {}).forEach((r) => { if (normalizeId(r.reset) === normalizeId(scope)) r.used = 0; }); return state; }
  function listAvailableTraitActions(traits, runtime = {}, stateInput) { const state = stateInput || createState(); return (traits || []).map((t) => canActivateTrait(t, runtime, state)).filter((r) => ["manual", "prompt", "choice"].includes(r.trait.activation.type)).map((r) => ({ traitId: r.trait.id, name: r.trait.name, activationType: r.trait.activation.type, actionCost: r.actionCost, available: r.available, reasons: r.reasons, maximum: r.maximum, remaining: r.remaining, target: r.trait.activation.target || "self", inputs: clone(r.trait.activation.inputs || []) })); }
  function resolveTheatreCheck({ character = {}, traits = [], check = {}, state } = {}) { const runtime = { context: "theatre", character, self: character, check: Object.assign({ difficulty: 0, abilityPower: 0, finalPower: 0 }, clone(check || {})) }, result = dispatchTraits(traits, "before_check", runtime, state || createState()); return { check: runtime.check, state: result.state, outcomes: result.outcomes }; }
  function dispatchCombatEvent(trigger, { character = {}, traits = [], state, ...input } = {}) { const runtime = Object.assign({ context: "combat", character, self: input.self || character }, input); return dispatchTraits(traits, trigger, runtime, state || createState()); }

  function resolveTraitGrants(character = {}, grants = [], catalog = {}) {
    const byId = catalog instanceof Map ? catalog : new Map(Object.entries(catalog || {}).map(([k, v]) => [normalizeId(k), v]));
    return (grants || []).filter((g) => { const type = normalizeId(g.sourceType || g.source?.type), id = normalizeId(g.sourceId || g.source?.id || g.source?.classId), required = Math.max(0, int(g.atLevel ?? g.level)); if (type === "class") return getClassLevel(character, id) >= required; if (type === "race") return normalizeId(character.raceId || character.race?.id) === id; if (type === "background") return normalizeId(character.backgroundId || character.background?.id) === id; if (type === "lineage") return (Array.isArray(character.lineages) ? character.lineages : [character.lineageId]).filter(Boolean).map(normalizeId).includes(id); return true; }).map((g) => {
      const definition = byId.get(normalizeId(g.traitId || g.id)); if (!definition) return null; const t = normalizeTrait(definition), type = normalizeId(g.sourceType || g.source?.type || t.source.type), id = normalizeId(g.sourceId || g.source?.id || t.source.id); t.source = Object.assign({}, t.source, g.source || {}, { type, id }); if (type === "class") t.source.classId = id; return t;
    }).filter(Boolean);
  }

  const api = Object.freeze({ SCHEMA_VERSION, CONTEXTS, ACTIVATION_TYPES, ACTION_COSTS, TRIGGERS, RESET_SCOPES, DURATION_TYPES, OPERATION_TYPES, normalizeId, getPath, setPath, getClassLevel, buildVariables, evaluateFormula, normalizeTrait, validateTrait, createState, conditionMatches, conditionsMatch, dispatchTrait, dispatchTraits, canActivateTrait, activateTrait, listAvailableTraitActions, resetUsage, resolveTheatreCheck, dispatchCombatEvent, resolveTraitGrants });
  global.LuminousTraitEngine = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
